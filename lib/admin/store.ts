import { getD1 } from "@/lib/commerce/config";

export type AdminCounts = { outreachReady: number; newResearch: number; significantChanges: number; community: number; followUps: number; replies: number; referrals: number; hotTargets: number; censusJurisdictions: number; activeEndpoints: number; checksToday: number; currentSources: number; activeAudits: number; watch: number; developing: number; campaignReady: number; saleReady: number; metricsAcquired: number; officialContacts: number; digNow: number; verify: number; frictionWatch: number };

export async function getAdminCounts(): Promise<AdminCounts> {
  const db = getD1();
  const [targets, research, signals, community, followups, replies, referrals, census, endpoints, checks, candidates, metrics, contacts, friction, audits] = await Promise.all([
    db.prepare("SELECT SUM(CASE WHEN outreach_state IN ('QUALIFIED','APPROVED') THEN 1 ELSE 0 END) outreach_ready, SUM(CASE WHEN fit_score >= 80 AND outreach_state NOT IN ('CONVERTED','STOPPED') THEN 1 ELSE 0 END) hot_targets FROM admin_targets").first<{ outreach_ready: number | null; hot_targets: number | null }>(),
    db.prepare("SELECT COUNT(*) count FROM research_requests WHERE status = 'requested'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_radar_signals WHERE truth_level = 'RADAR_SIGNAL' AND status = 'AUTO_GO'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_community_opportunities WHERE status IN ('DISCOVERED','DRAFTED')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_outreach WHERE follow_up_due_at IS NOT NULL AND follow_up_due_at <= CURRENT_TIMESTAMP AND stopped_at IS NULL").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_outreach_events WHERE type = 'REPLIED'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_outreach_events WHERE type = 'REFERRED'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_census_deployments").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_radar_endpoints WHERE status='ACTIVE'").first<{ count: number }>(),
    db.prepare("SELECT COALESCE(SUM(endpoints_checked),0) count FROM admin_monitor_batches WHERE date(started_at)=date('now')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN qualification_state='WATCH' THEN 1 ELSE 0 END) watch, SUM(CASE WHEN qualification_state='DEVELOPING' THEN 1 ELSE 0 END) developing, SUM(CASE WHEN qualification_state='CAMPAIGN_READY' THEN 1 ELSE 0 END) campaign_ready, SUM(CASE WHEN qualification_state='SALE_READY' THEN 1 ELSE 0 END) sale_ready, COALESCE(SUM(source_count),0) sources FROM admin_market_candidates WHERE generation_id=(SELECT id FROM admin_market_generations ORDER BY created_at DESC LIMIT 1)").first<Record<string, number>>(),
    db.prepare("SELECT COUNT(*) count FROM admin_jurisdiction_metrics WHERE verification_status='SOURCE_VERIFIED'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM admin_official_contacts WHERE status='VERIFIED'").first<{ count: number }>(),
    db.prepare("SELECT SUM(CASE WHEN state='DIG_NOW' AND jurisdiction NOT IN ('National / jurisdiction pending','Bitcoin','Android') AND jurisdiction NOT LIKE '%— statewide' THEN 1 ELSE 0 END) dig_now, SUM(CASE WHEN state='VERIFY' OR (state='DIG_NOW' AND (jurisdiction IN ('National / jurisdiction pending','Bitcoin','Android') OR jurisdiction LIKE '%— statewide')) THEN 1 ELSE 0 END) verify, SUM(CASE WHEN state='WATCH' THEN 1 ELSE 0 END) watch FROM admin_friction_opportunities WHERE generation_id=(SELECT id FROM admin_market_generations ORDER BY created_at DESC LIMIT 1) AND state<>'ARCHIVE'").first<Record<string, number>>(),
    db.prepare("SELECT COUNT(*) count FROM admin_jurisdiction_audits a JOIN admin_friction_opportunities f ON f.id=a.friction_id WHERE a.generation_id=(SELECT id FROM admin_market_generations ORDER BY created_at DESC LIMIT 1) AND f.state='AUDIT_STARTED'").first<{ count: number }>(),
  ]);
  return { outreachReady: targets?.outreach_ready || 0, hotTargets: targets?.hot_targets || 0, newResearch: research?.count || 0, significantChanges: signals?.count || 0, community: community?.count || 0, followUps: followups?.count || 0, replies: replies?.count || 0, referrals: referrals?.count || 0, censusJurisdictions: census?.count || 0, activeEndpoints: endpoints?.count || 0, checksToday: checks?.count || 0, currentSources: Number(candidates?.sources || 0), activeAudits: audits?.count || 0, watch: Number(candidates?.watch || 0), developing: Number(candidates?.developing || 0), campaignReady: Number(candidates?.campaign_ready || 0), saleReady: Number(candidates?.sale_ready || 0), metricsAcquired: metrics?.count || 0, officialContacts: contacts?.count || 0, digNow: Number(friction?.dig_now || 0), verify: Number(friction?.verify || 0), frictionWatch: Number(friction?.watch || 0) };
}

export async function getAdminLists() {
  const db = getD1();
  const [markets, targets, endpoints, cases, outreach, community, census, batches, signals, campaigns, activity, candidates, generations, metrics, friction, audits, evidence] = await Promise.all([
    db.prepare("SELECT * FROM admin_markets ORDER BY updated_at DESC LIMIT 50").all(),
    db.prepare("SELECT * FROM admin_targets ORDER BY fit_score DESC, updated_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_radar_endpoints ORDER BY yield_score DESC, updated_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_case_files ORDER BY updated_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_outreach ORDER BY updated_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_community_opportunities ORDER BY updated_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_census_deployments ORDER BY CASE acquisition_status WHEN 'ACQUIRING' THEN 0 WHEN 'QUEUED' THEN 1 WHEN 'COMPLETE' THEN 2 WHEN 'EVIDENCE_FOUND' THEN 3 WHEN 'NO_GAP' THEN 4 ELSE 5 END, CASE WHEN device_count IS NULL THEN 1 ELSE 0 END, device_count DESC, evidence_count DESC LIMIT 250").all(),
    db.prepare("SELECT * FROM admin_monitor_batches ORDER BY started_at DESC LIMIT 30").all(),
    db.prepare("SELECT * FROM admin_radar_signals ORDER BY detected_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_campaign_batches ORDER BY priority_score DESC, created_at DESC LIMIT 30").all(),
    db.prepare("SELECT * FROM admin_activity_log ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_market_candidates WHERE generation_id=(SELECT id FROM admin_market_generations ORDER BY created_at DESC LIMIT 1) ORDER BY score DESC, source_count DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_market_generations ORDER BY created_at DESC LIMIT 10").all(),
    db.prepare("SELECT * FROM admin_jurisdiction_metrics WHERE verification_status='SOURCE_VERIFIED' ORDER BY verified_at DESC").all(),
    db.prepare("SELECT * FROM admin_friction_opportunities WHERE generation_id=(SELECT id FROM admin_market_generations ORDER BY created_at DESC LIMIT 1) AND state<>'ARCHIVE' ORDER BY friction_score DESC, published_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_jurisdiction_audits ORDER BY updated_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM admin_jurisdiction_evidence ORDER BY updated_at DESC LIMIT 500").all(),
  ]);
  const deliveryTargets = await db.prepare("SELECT * FROM admin_campaign_delivery_targets ORDER BY CASE platform WHEN 'REDDIT' THEN 1 WHEN 'FACEBOOK' THEN 2 ELSE 3 END").all();
  const targetRows = deliveryTargets.results || [];
  const metricRows = metrics.results || [];
  const candidateRows = candidates.results || [];
  const frictionRows = (friction.results || []).filter((item) => !["Bitcoin", "Android"].includes(String(item.jurisdiction))).map((item) => { const unresolved = String(item.jurisdiction) === "National / jurisdiction pending" || String(item.jurisdiction).endsWith("— statewide"); const normalizedItem = unresolved && item.state === "DIG_NOW" ? { ...item, state: "VERIFY" } : item; const audit = candidateRows.find((candidate) => String(candidate.generation_id) === String(item.generation_id) && String(candidate.cluster_key) === String(item.cluster_key)); return audit ? { ...normalizedItem, audit_qualification_state: audit.qualification_state, audit_score: audit.score, audit_source_count: audit.source_count, audit_independent_source_count: audit.independent_source_count, audit_metric_count: audit.metric_count } : normalizedItem; });
  const campaignRows = (campaigns.results || []).map((campaign) => ({
    ...campaign,
    delivery_targets: targetRows.filter((target) => String(target.campaign_id) === String(campaign.id)),
    jurisdiction_metrics: metricRows.filter((metric) => String(metric.normalized_jurisdiction) === String(campaign.jurisdiction || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()),
  }));
  const latestScan = (activity.results || []).find((row) => String(row.event_type) === "DISCOVERY_PASS_COMPLETED");
  let scanReceipt: Record<string, unknown> | null = null;
  try { scanReceipt = latestScan?.metadata_json ? JSON.parse(String(latestScan.metadata_json)) as Record<string, unknown> : null; } catch { scanReceipt = null; }
  return { markets: markets.results || [], targets: targets.results || [], endpoints: endpoints.results || [], cases: cases.results || [], outreach: outreach.results || [], community: community.results || [], census: census.results || [], batches: batches.results || [], signals: signals.results || [], campaigns: campaignRows, activity: activity.results || [], candidates: candidateRows, generations: generations.results || [], metrics: metricRows, friction: frictionRows, audits: audits.results || [], evidence: evidence.results || [], scanReceipt };
}
