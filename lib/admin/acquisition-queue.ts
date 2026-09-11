import { getD1 } from "@/lib/commerce/config";
import { startSystematicAudit } from "@/lib/admin/discovery";

type QueueResult = { id: string; jurisdiction: string; agency: string; status: string; auditStatus?: string; error?: string };

export async function processAcquisitionQueue(requestedLimit = 1) {
  const db = getD1();
  const limit = Math.max(1, Math.min(Number(requestedLimit) || 1, 2));
  const queued = await db.prepare("SELECT id,jurisdiction,agency FROM admin_census_deployments WHERE acquisition_status IN ('QUEUED','RETRY') ORDER BY CASE WHEN device_count IS NULL THEN 1 ELSE 0 END, device_count DESC, evidence_count DESC, updated_at ASC LIMIT ?").bind(limit).all<{ id: string; jurisdiction: string; agency: string }>();
  const results: QueueResult[] = [];
  for (const candidate of queued.results) {
    const startedAt = new Date().toISOString();
    await db.prepare("UPDATE admin_census_deployments SET acquisition_status='ACQUIRING',acquisition_attempts=acquisition_attempts+1,acquisition_started_at=?,acquisition_error=NULL,updated_at=? WHERE id=?").bind(startedAt, startedAt, candidate.id).run();
    try {
      const result = await startSystematicAudit(candidate.id);
      const audit = result.audit as Record<string, unknown> | undefined;
      const auditStatus = String(audit?.status || "BLOCKED");
      const status = auditStatus === "EVIDENCE_QUALIFIED" ? "COMPLETE" : auditStatus === "BASELINE_COMPLETE" ? "NO_GAP" : auditStatus === "SOURCE_REVIEW" ? "EVIDENCE_FOUND" : "INCOMPLETE";
      const completedAt = new Date().toISOString();
      await db.prepare("UPDATE admin_census_deployments SET acquisition_status=?,audit_id=?,acquisition_completed_at=?,updated_at=? WHERE id=?").bind(status, audit?.id || null, completedAt, completedAt, candidate.id).run();
      results.push({ ...candidate, status, auditStatus });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Acquisition failed"; const completedAt = new Date().toISOString();
      await db.prepare("UPDATE admin_census_deployments SET acquisition_status='FAILED',acquisition_error=?,acquisition_completed_at=?,updated_at=? WHERE id=?").bind(message.slice(0, 1000), completedAt, completedAt, candidate.id).run();
      results.push({ ...candidate, status: "FAILED", error: message });
    }
  }
  const counts = await db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN acquisition_status IN ('QUEUED','RETRY') THEN 1 ELSE 0 END) queued, SUM(CASE WHEN acquisition_status='ACQUIRING' THEN 1 ELSE 0 END) acquiring, SUM(CASE WHEN acquisition_status IN ('COMPLETE','EVIDENCE_FOUND','NO_GAP') THEN 1 ELSE 0 END) evidence, SUM(CASE WHEN acquisition_status IN ('INCOMPLETE','FAILED') THEN 1 ELSE 0 END) incomplete FROM admin_census_deployments").first<Record<string, number>>();
  return { processed: results.length, results, counts: { total: Number(counts?.total || 0), queued: Number(counts?.queued || 0), acquiring: Number(counts?.acquiring || 0), evidence: Number(counts?.evidence || 0), incomplete: Number(counts?.incomplete || 0) } };
}
