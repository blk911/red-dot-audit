import { getD1 } from "@/lib/commerce/config";

export type ResearchRequestStatus =
  | "requested"
  | "reviewing"
  | "not_qualified"
  | "notified";

export type ResearchRequestRow = {
  id: string;
  jurisdiction: string;
  normalized_jurisdiction: string;
  requester_email: string;
  status: ResearchRequestStatus;
  source_target_slug: string | null;
  acknowledgement_sent_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export function cleanJurisdiction(value: string) {
  return value
    .replace(/\+?\s*(Flock Safety|Automatic License Plate Recognition|ALPR).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeJurisdiction(value: string) {
  return cleanJurisdiction(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createOrFindResearchRequest(input: {
  jurisdiction: string;
  requesterEmail: string;
}) {
  const db = getD1();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const jurisdiction = cleanJurisdiction(input.jurisdiction);
  const normalized = normalizeJurisdiction(jurisdiction);
  const email = normalizeEmail(input.requesterEmail);

  await db.prepare(
    `INSERT INTO research_requests
       (id, jurisdiction, normalized_jurisdiction, requester_email, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'requested', ?, ?)
     ON CONFLICT(normalized_jurisdiction, requester_email)
     DO UPDATE SET jurisdiction = excluded.jurisdiction, updated_at = excluded.updated_at`,
  ).bind(id, jurisdiction, normalized, email, now, now).run();

  const row = await db.prepare(
    `SELECT * FROM research_requests
     WHERE normalized_jurisdiction = ? AND requester_email = ? LIMIT 1`,
  ).bind(normalized, email).first<ResearchRequestRow>();
  if (!row) throw new Error("Research request could not be stored.");
  return row;
}

export async function listResearchRequests(): Promise<ResearchRequestRow[]> {
  const result = await getD1().prepare(
    `SELECT * FROM research_requests
     ORDER BY CASE status
       WHEN 'requested' THEN 0 WHEN 'reviewing' THEN 1
       WHEN 'notified' THEN 2 ELSE 3 END, created_at DESC`,
  ).all<ResearchRequestRow>();
  return result.results || [];
}

export async function findResearchRequest(id: string) {
  return getD1().prepare("SELECT * FROM research_requests WHERE id = ? LIMIT 1")
    .bind(id).first<ResearchRequestRow>();
}

export async function updateResearchRequestStatus(
  id: string,
  status: ResearchRequestStatus,
  sourceTargetSlug?: string | null,
) {
  const now = new Date().toISOString();
  await getD1().prepare(
    `UPDATE research_requests
     SET status = ?, source_target_slug = COALESCE(?, source_target_slug), updated_at = ?
     WHERE id = ?`,
  ).bind(status, sourceTargetSlug || null, now, id).run();
}

export async function claimResearchAcknowledgement(id: string) {
  const result = await getD1().prepare(
    `UPDATE research_requests SET acknowledgement_sent_at = ?, updated_at = ?
     WHERE id = ? AND acknowledgement_sent_at IS NULL`,
  ).bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return Number(result.meta?.changes || 0) > 0;
}

export async function releaseResearchAcknowledgement(id: string) {
  await getD1().prepare(
    "UPDATE research_requests SET acknowledgement_sent_at = NULL WHERE id = ? AND notified_at IS NULL",
  ).bind(id).run();
}

export async function markResearchNotified(id: string, targetSlug: string) {
  const now = new Date().toISOString();
  await getD1().prepare(
    `UPDATE research_requests
     SET status = 'notified', source_target_slug = ?, notified_at = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(targetSlug, now, now, id).run();
}
