import { getD1 } from "@/lib/commerce/config";
import { startSystematicAudit } from "@/lib/admin/discovery";

type QueueResult = { id: string; jurisdiction: string; agency: string; status: string; auditStatus?: string; error?: string; terminalReason?: string };

// A crashed or killed worker leaves a row stuck in ACQUIRING forever with no
// mechanism to reclaim it. Treat an ACQUIRING lease older than this as
// abandoned and eligible to be picked up again.
const STALE_LEASE_MINUTES = 10;
const MAX_ACQUISITION_ATTEMPTS = 5;
// Exponential-ish backoff before a failed candidate is eligible again,
// indexed by attempt number (1-based); caps at 24h so a persistently broken
// source doesn't get abandoned outright, just deprioritized.
const BACKOFF_MINUTES = [5, 15, 60, 240, 1440];

function backoffMinutes(attempts: number) {
  return BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] || 1440;
}

// Classifies a raw error into the small vocabulary CLAUDE_HANDOFF.md section
// 14 calls for, distinguishing "we couldn't even reach the source" from "we
// reached it but couldn't make sense of it" — the two need different fixes.
function classifyFailure(message: string): string {
  if (/abort|timed? ?out|ETIMEDOUT|ECONNRESET|ENOTFOUND|network/i.test(message)) return "SOURCE_UNAVAILABLE";
  if (/HTTP 4\d\d|forbidden|blocked|rate.?limit(?:ed)?|captcha/i.test(message)) return "FETCH_BLOCKED";
  if (/JSON|SyntaxError|Unexpected token|parse/i.test(message)) return "PARSE_FAILED";
  if (/D1_ERROR|SQLITE|database/i.test(message)) return "DATABASE_ERROR";
  return "UNKNOWN_ERROR";
}

export async function processAcquisitionQueue(requestedLimit = 1) {
  const db = getD1();
  const limit = Math.max(1, Math.min(Number(requestedLimit) || 1, 2));
  const now = new Date().toISOString();
  const staleLeaseCutoff = new Date(Date.now() - STALE_LEASE_MINUTES * 60_000).toISOString();
  const candidates = await db.prepare(
    "SELECT id,jurisdiction,agency FROM admin_census_deployments WHERE (acquisition_status IN ('QUEUED','RETRY') AND (acquisition_next_attempt_at IS NULL OR acquisition_next_attempt_at<=?)) OR (acquisition_status='ACQUIRING' AND acquisition_started_at<=?) ORDER BY CASE WHEN device_count IS NULL THEN 1 ELSE 0 END, device_count DESC, evidence_count DESC, updated_at ASC LIMIT ?",
  ).bind(now, staleLeaseCutoff, limit).all<{ id: string; jurisdiction: string; agency: string }>();
  const results: QueueResult[] = [];
  for (const candidate of candidates.results) {
    const startedAt = new Date().toISOString();
    // The claim itself is the atomic operation: this single conditional
    // UPDATE only succeeds if the row is still in a claimable state, so two
    // concurrent calls racing on the same candidate can't both "win" the
    // SELECT above and then both proceed to acquire it — only whichever
    // UPDATE actually lands first changes a row; the other sees 0 changes
    // and skips it below, rather than duplicating the work.
    const claim = await db.prepare(
      "UPDATE admin_census_deployments SET acquisition_status='ACQUIRING',acquisition_attempts=acquisition_attempts+1,acquisition_started_at=?,acquisition_error=NULL,acquisition_terminal_reason=NULL,updated_at=? WHERE id=? AND (acquisition_status IN ('QUEUED','RETRY') OR (acquisition_status='ACQUIRING' AND acquisition_started_at<=?))",
    ).bind(startedAt, startedAt, candidate.id, staleLeaseCutoff).run();
    if (!claim.meta?.changes) continue;
    try {
      const result = await startSystematicAudit(candidate.id);
      const audit = result.audit as Record<string, unknown> | undefined;
      const auditStatus = String(audit?.status || "BLOCKED");
      const status = auditStatus === "EVIDENCE_QUALIFIED" ? "COMPLETE" : auditStatus === "BASELINE_COMPLETE" ? "NO_GAP" : auditStatus === "SOURCE_REVIEW" ? "EVIDENCE_FOUND" : "INCOMPLETE";
      const completedAt = new Date().toISOString();
      await db.prepare("UPDATE admin_census_deployments SET acquisition_status=?,audit_id=?,acquisition_completed_at=?,acquisition_next_attempt_at=NULL,updated_at=? WHERE id=?").bind(status, audit?.id || null, completedAt, completedAt, candidate.id).run();
      results.push({ ...candidate, status, auditStatus });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Acquisition failed";
      const terminalReason = classifyFailure(message);
      const completedAt = new Date().toISOString();
      const attemptsRow = await db.prepare("SELECT acquisition_attempts FROM admin_census_deployments WHERE id=?").bind(candidate.id).first<{ acquisition_attempts: number }>();
      const attempts = Number(attemptsRow?.acquisition_attempts || 1);
      const exhausted = attempts >= MAX_ACQUISITION_ATTEMPTS;
      const status = exhausted ? "FAILED" : "RETRY";
      const nextAttemptAt = exhausted ? null : new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString();
      await db.prepare("UPDATE admin_census_deployments SET acquisition_status=?,acquisition_error=?,acquisition_terminal_reason=?,acquisition_next_attempt_at=?,acquisition_completed_at=?,updated_at=? WHERE id=?").bind(status, message.slice(0, 1000), terminalReason, nextAttemptAt, completedAt, completedAt, candidate.id).run();
      results.push({ ...candidate, status, error: message, terminalReason });
    }
  }
  const counts = await db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN acquisition_status IN ('QUEUED','RETRY') THEN 1 ELSE 0 END) queued, SUM(CASE WHEN acquisition_status='ACQUIRING' THEN 1 ELSE 0 END) acquiring, SUM(CASE WHEN acquisition_status IN ('COMPLETE','EVIDENCE_FOUND','NO_GAP') THEN 1 ELSE 0 END) evidence, SUM(CASE WHEN acquisition_status IN ('INCOMPLETE','FAILED') THEN 1 ELSE 0 END) incomplete FROM admin_census_deployments").first<Record<string, number>>();
  return { processed: results.length, results, counts: { total: Number(counts?.total || 0), queued: Number(counts?.queued || 0), acquiring: Number(counts?.acquiring || 0), evidence: Number(counts?.evidence || 0), incomplete: Number(counts?.incomplete || 0) } };
}
