import survey from "@/research/red-dot-survey-current.json";
import deepSurvey from "@/research/red-dot-deep-survey-current.json";
import { getD1 } from "@/lib/commerce/config";
import { fingerprintThinContent, scoreRadarEndpoint } from "@/lib/admin/types";
import { redDotTargets } from "@/app/red-dot-targets";
import { extractJurisdictionMetrics, saveJurisdictionMetrics } from "@/lib/admin/jurisdiction-metrics";

const relevancePattern = /\b(flock|alpr|license plate|camera|surveillance|audit|privacy|contract|sharing|lawsuit|court|policy|records?|misuse|search(?:es|ed)?|immigration|ice|border patrol)\b/i;

function normalizePublicContent(input: string) {
  return input
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200_000);
}

function describeDifference(before: string, after: string) {
  const oldWords = before.split(" ");
  const newWords = after.split(" ");
  let start = 0;
  while (start < oldWords.length && start < newWords.length && oldWords[start] === newWords[start]) start += 1;
  const from = Math.max(0, start - 12);
  return `Before: …${oldWords.slice(from, start + 28).join(" ")}\nAfter: …${newWords.slice(from, start + 28).join(" ")}`.slice(0, 900);
}

function confidence(candidate: (typeof survey.candidates)[number]) {
  if (candidate.authority === "FOUND" && !candidate.system.includes("verification pending")) return "CONFIRMED";
  if (candidate.sourceCount >= 2 || candidate.authority === "FOUND") return "PROBABLE";
  return "UNVERIFIED";
}

export async function bootstrapCensus() {
  const db = getD1();
  const now = new Date().toISOString();
  const dispositionById = new Map(deepSurvey.assessments.map((item) => [item.id, item.disposition]));
  const statements: D1PreparedStatement[] = [];
  for (const candidate of survey.candidates) {
    const marketId = `market-${candidate.id}`;
    const censusId = `census-${candidate.id}`;
    const disposition = dispositionById.get(candidate.id) || "HOLD";
    statements.push(db.prepare("INSERT INTO admin_markets (id,city,state,label,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,status=excluded.status,updated_at=excluded.updated_at").bind(marketId, candidate.place.replace(/,.*$/, ""), candidate.state, candidate.place, disposition === "SELLABLE" ? "ACTIVE" : "WATCH", now, now));
    statements.push(db.prepare("INSERT INTO admin_census_deployments (id,jurisdiction,agency,state,vendor_system,confidence,evidence_count,source_urls_json,lead_reason,research_readiness,last_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(jurisdiction,agency) DO UPDATE SET vendor_system=excluded.vendor_system,confidence=excluded.confidence,evidence_count=excluded.evidence_count,source_urls_json=excluded.source_urls_json,lead_reason=excluded.lead_reason,research_readiness=excluded.research_readiness,last_verified_at=excluded.last_verified_at,updated_at=excluded.updated_at").bind(censusId, candidate.place, candidate.agency, candidate.state, candidate.system, confidence(candidate), candidate.sourceCount, JSON.stringify(candidate.sourceUrls), candidate.leadReason, candidate.surveyReadiness, survey.snapshotDate, now, now));
    candidate.sourceUrls.forEach((url, index) => statements.push(db.prepare("INSERT INTO admin_radar_endpoints (id,market_id,type,source_name,url,status,polling_enabled,target_polls_per_day,created_at,updated_at) VALUES (?,?,?,?,?,'ACTIVE',1,3,?,?) ON CONFLICT(url) DO UPDATE SET market_id=excluded.market_id,source_name=excluded.source_name,polling_enabled=1,updated_at=excluded.updated_at").bind(`endpoint-${candidate.id}-${index + 1}`, marketId, classifyEndpoint(url), new URL(url).hostname.replace(/^www\./, ""), url, now, now)));
  }
  for (let index = 0; index < statements.length; index += 75) await db.batch(statements.slice(index, index + 75));
  for (const target of redDotTargets) {
    if (!target.publicMetrics?.length) continue;
    const facts = target.publicMetrics.slice(0, 4).map((metric) => ({ key: metric.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), value: metric.value, label: metric.label.toUpperCase() }));
    const seededCandidate = survey.candidates.find((item) => item.place === target.place);
    await saveJurisdictionMetrics(target.place, target.sourceHref, facts, target.evidenceDate || survey.snapshotDate, seededCandidate ? `census-${seededCandidate.id}` : undefined);
  }
  await db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,summary,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "SYSTEM", "CENSUS_IMPORTED", "CENSUS", `Imported ${survey.candidates.length} researched jurisdictions and ${survey.candidates.reduce((sum, item) => sum + item.sourceUrls.length, 0)} source endpoints.`, JSON.stringify({ snapshotDate: survey.snapshotDate }), now).run();
  return { jurisdictions: survey.candidates.length, endpoints: survey.candidates.reduce((sum, item) => sum + item.sourceUrls.length, 0) };
}

function classifyEndpoint(url: string) {
  const value = url.toLowerCase();
  if (/agenda|minutes|legistar|council/.test(value)) return "CITY_AGENDA";
  if (/court|law|legal|oag\.|aclu|eff\./.test(value)) return "COURT";
  if (/police|sheriff|\.gov/.test(value)) return "POLICE";
  if (/reddit/.test(value)) return "REDDIT";
  return "NEWS";
}

function safePublicUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Only HTTPS Radar endpoints are allowed.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) throw new Error("Private endpoint blocked.");
  return url;
}

async function fetchPublicSource(value: string) {
  let url = safePublicUrl(value);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(url, { headers: { "User-Agent": "RedDotAudit-Radar/1.0", Accept: "text/html,application/xml,text/plain;q=0.8" }, redirect: "manual", signal: AbortSignal.timeout(12_000) });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Radar redirect had no destination.");
    url = safePublicUrl(new URL(location, url).toString());
  }
  throw new Error("Radar source exceeded the redirect limit.");
}

export async function runMonitorBatch(limit = 30) {
  const db = getD1();
  const now = new Date();
  const id = crypto.randomUUID();
  const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const label = `${now.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} · ${now.getUTCHours() < 12 ? "Morning" : "Afternoon"} Change Grab`;
  const endpoints = (await db.prepare(`SELECT * FROM admin_radar_endpoints WHERE status='ACTIVE' AND polling_enabled=1 ORDER BY COALESCE(last_checked_at,'') ASC LIMIT ${boundedLimit}`).all<Record<string, unknown>>()).results || [];
  if (!endpoints.length) {
    const available = await db.prepare("SELECT COUNT(*) count FROM admin_radar_endpoints WHERE status='ACTIVE' AND polling_enabled=1").first<{ count: number }>();
    if (Number(available?.count || 0) > 0) throw new Error(`Radar found ${available?.count} enabled endpoints but could not select a batch.`);
  }
  await db.prepare("INSERT INTO admin_monitor_batches (id,label,status,endpoints_planned,started_at,created_at) VALUES (?,?,'RUNNING',?,?,?)").bind(id, label, endpoints.length, now.toISOString(), now.toISOString()).run();
  let checked = 0, changes = 0, relevant = 0;
  for (const endpoint of endpoints) {
    try {
      const response = await fetchPublicSource(String(endpoint.url));
      const raw = (await response.text()).slice(0, 500_000);
      const text = normalizePublicContent(raw);
      if (!response.ok) {
        checked += 1;
        await db.prepare("UPDATE admin_radar_endpoints SET pulls=pulls+1,last_checked_at=?,last_http_status=?,last_error=?,updated_at=? WHERE id=?").bind(now.toISOString(), response.status, `HTTP ${response.status}`, now.toISOString(), endpoint.id).run();
        continue;
      }
      const fingerprint = await fingerprintThinContent(text);
      const changed = Boolean(endpoint.content_fingerprint && endpoint.content_fingerprint !== fingerprint);
      const isRelevant = changed && relevancePattern.test(text);
      checked += 1; if (changed) changes += 1; if (isRelevant) relevant += 1;
      const next = { id: String(endpoint.id), status: String(endpoint.status) as "ACTIVE", pulls: Number(endpoint.pulls || 0) + 1, changes: Number(endpoint.changes || 0) + (changed ? 1 : 0), relevantChanges: Number(endpoint.relevant_changes || 0) + (isRelevant ? 1 : 0), researchEscalations: Number(endpoint.research_escalations || 0), caseContributions: Number(endpoint.case_contributions || 0), publishableEvents: Number(endpoint.publishable_events || 0), yieldScore: 0 };
      const score = scoreRadarEndpoint(next);
      await db.prepare("UPDATE admin_radar_endpoints SET pulls=?,changes=?,relevant_changes=?,last_checked_at=?,last_changed_at=CASE WHEN ? THEN ? ELSE last_changed_at END,content_fingerprint=?,content_excerpt=?,last_http_status=?,last_error=NULL,yield_score=?,updated_at=? WHERE id=?").bind(next.pulls, next.changes, next.relevantChanges, now.toISOString(), changed ? 1 : 0, now.toISOString(), fingerprint, text.slice(0, 4000), response.status, score, now.toISOString(), endpoint.id).run();
      const market = endpoint.market_id ? await db.prepare("SELECT label FROM admin_markets WHERE id=? LIMIT 1").bind(endpoint.market_id).first<{ label: string }>() : null;
      if (market?.label) await saveJurisdictionMetrics(market.label, String(endpoint.url), extractJurisdictionMetrics(text), now.toISOString());
      if (isRelevant) {
        const diff = describeDifference(String(endpoint.content_excerpt || ""), text);
        await db.prepare("INSERT INTO admin_radar_signals (id,endpoint_id,truth_level,status,title,summary,source_url,change_reason,diff_excerpt,change_fingerprint,detected_at) VALUES (?,?,'RADAR_SIGNAL','NEW',?,?,?,?,?,?,?) ON CONFLICT(endpoint_id,change_fingerprint) DO UPDATE SET detected_at=excluded.detected_at").bind(crypto.randomUUID(), endpoint.id, `Change detected at ${endpoint.source_name}`, "Content changed and matched the ALPR relevance vocabulary. Human review is required.", endpoint.url, "Normalized page text changed", diff, fingerprint, now.toISOString()).run();
      }
    } catch (error) {
      checked += 1;
      await db.prepare("UPDATE admin_radar_endpoints SET pulls=pulls+1,last_checked_at=?,last_error=?,updated_at=? WHERE id=?").bind(now.toISOString(), error instanceof Error ? error.message.slice(0, 500) : "Fetch failed", now.toISOString(), endpoint.id).run();
      console.error("Radar endpoint check failed", endpoint.id, error);
    }
  }
  await db.prepare("UPDATE admin_monitor_batches SET status='COMPLETED',endpoints_checked=?,changes_detected=?,relevant_signals=?,completed_at=? WHERE id=?").bind(checked, changes, relevant, new Date().toISOString(), id).run();
  await db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,entity_id,summary,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "SYSTEM", "MONITOR_BATCH_COMPLETED", "MONITOR_BATCH", id, `${label}: ${checked} checked, ${changes} changed, ${relevant} relevant.`, "{}", new Date().toISOString()).run();
  return { id, label, checked, changes, relevant };
}
