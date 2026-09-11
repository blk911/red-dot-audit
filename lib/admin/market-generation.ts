import { getD1 } from "@/lib/commerce/config";

const RESET_TABLES = [
  "admin_jurisdiction_evidence", "admin_jurisdiction_audits", "admin_friction_opportunities", "admin_market_candidates", "admin_jurisdiction_metrics",
  "admin_campaign_delivery_targets", "admin_campaign_batches", "admin_community_opportunities", "admin_radar_signals",
  "admin_radar_endpoints", "admin_monitor_batches", "admin_census_deployments", "admin_official_contacts", "admin_case_files",
] as const;

export async function currentGenerationId() {
  const row = await getD1().prepare("SELECT id FROM admin_market_generations WHERE status IN ('ACTIVE','COMPLETED') ORDER BY created_at DESC LIMIT 1").first<{ id: string }>();
  return row?.id || "legacy";
}

export async function resetAndRebuildMarket() {
  const db = getD1(); const generationId = crypto.randomUUID(); const now = new Date().toISOString(); const counts: Record<string, number> = {};
  await db.prepare("INSERT INTO admin_market_generations (id,status,reason,created_at) VALUES (?,'ARCHIVING',?,?)").bind(generationId, "Controlled go-live reset after qualification and sourcing model upgrade", now).run();
  try {
    for (const table of RESET_TABLES) {
      const rows = (await db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()).results || [];
      counts[table] = rows.length;
      for (let index = 0; index < rows.length; index += 60) {
        await db.batch(rows.slice(index, index + 60).map((row) => db.prepare("INSERT INTO admin_market_generation_rows (id,generation_id,table_name,record_id,payload_json,archived_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), generationId, table, String(row.id || "") || null, JSON.stringify(row), now)));
      }
    }
    const uncontactedTargets = (await db.prepare("SELECT t.* FROM admin_targets t WHERE NOT EXISTS (SELECT 1 FROM admin_outreach o WHERE o.target_id=t.id)").all<Record<string, unknown>>()).results || [];
    counts.admin_targets_uncontacted = uncontactedTargets.length;
    for (let index = 0; index < uncontactedTargets.length; index += 60) await db.batch(uncontactedTargets.slice(index, index + 60).map((row) => db.prepare("INSERT INTO admin_market_generation_rows (id,generation_id,table_name,record_id,payload_json,archived_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), generationId, "admin_targets_uncontacted", String(row.id || "") || null, JSON.stringify(row), now)));
    const scanActivity = (await db.prepare("SELECT * FROM admin_activity_log WHERE event_type IN ('CENSUS_IMPORTED','DISCOVERY_PASS_COMPLETED','MONITOR_BATCH_COMPLETED')").all<Record<string, unknown>>()).results || [];
    counts.admin_activity_log_scan_events = scanActivity.length;
    for (let index = 0; index < scanActivity.length; index += 60) await db.batch(scanActivity.slice(index, index + 60).map((row) => db.prepare("INSERT INTO admin_market_generation_rows (id,generation_id,table_name,record_id,payload_json,archived_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), generationId, "admin_activity_log_scan_events", String(row.id || "") || null, JSON.stringify(row), now)));
    await db.batch([
      ...RESET_TABLES.map((table) => db.prepare(`DELETE FROM ${table}`)),
      db.prepare("DELETE FROM admin_targets WHERE id NOT IN (SELECT DISTINCT target_id FROM admin_outreach)"),
      db.prepare("DELETE FROM admin_activity_log WHERE event_type IN ('CENSUS_IMPORTED','DISCOVERY_PASS_COMPLETED','MONITOR_BATCH_COMPLETED')"),
    ]);
    await db.prepare("UPDATE admin_market_generations SET status='ACTIVE',archived_counts_json=? WHERE id=?").bind(JSON.stringify(counts), generationId).run();
    const result = { generationId, archived: counts, mode: "ACQUISITION_ONLY", census: { jurisdictions: 0, endpoints: 0 }, monitor: null, discovery: null };
    await db.prepare("UPDATE admin_market_generations SET status='COMPLETED',scan_results_json=?,completed_at=? WHERE id=?").bind(JSON.stringify(result), new Date().toISOString(), generationId).run();
    await db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,entity_id,summary,metadata_json,created_at) VALUES (?,?,'MARKET_GENERATION_RESET','MARKET_GENERATION',?,?,?,?)").bind(crypto.randomUUID(), "ADMIN", generationId, `Archived and cleared all derived intelligence. Acquisition-only generation ${generationId.slice(0, 8)} is empty by design.`, JSON.stringify({ counts }), new Date().toISOString()).run();
    return result;
  } catch (error) {
    await db.prepare("UPDATE admin_market_generations SET status='FAILED',scan_results_json=?,completed_at=? WHERE id=?").bind(JSON.stringify({ error: error instanceof Error ? error.message : "Reset failed" }), new Date().toISOString(), generationId).run();
    throw error;
  }
}
