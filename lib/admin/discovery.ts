import { getD1 } from "@/lib/commerce/config";
import { fingerprintThinContent } from "@/lib/admin/types";
import { redDotTargets } from "@/app/red-dot-targets";
import { extractJurisdictionMetrics, saveJurisdictionMetrics } from "@/lib/admin/jurisdiction-metrics";
import { acquireJurisdictionAudit } from "@/lib/admin/audit-acquisition";

const feeds = [
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=%22Flock+Safety%22+ALPR+when%3A30d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=%22license+plate+reader%22+privacy+OR+lawsuit+OR+contract+when%3A30d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=%22Flock+Safety%22+%28complaint+OR+controversy+OR+misuse+OR+privacy%29+when%3A45d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=%22license+plate+readers%22+%28city+council+OR+police+OR+residents%29+when%3A45d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=ALPR+%28ACLU+OR+EFF+OR+privacy+advocates+OR+public+records%29+when%3A45d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=%22Flock+Safety%22+%28audit+OR+lawsuit+OR+misuse+OR+council%29+when%3A90d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=ALPR+%28searches+OR+sharing+OR+retention+OR+access+logs%29+when%3A90d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "NEWS", url: "https://news.google.com/rss/search?q=Axon+%28Fusus+OR+%22Vehicle+Intelligence%22+OR+surveillance%29+when%3A30d&hl=en-US&gl=US&ceid=US%3Aen" },
  { channel: "REDDIT", url: "https://www.reddit.com/search.rss?q=%22Flock%20Safety%22&sort=new" },
  { channel: "REDDIT", url: "https://www.reddit.com/search.rss?q=ALPR%20camera&sort=new" },
  { channel: "REDDIT", url: "https://www.reddit.com/search.rss?q=%22license%20plate%20reader%22&sort=new" },
] as const;

const techPattern = /\b(flock(?: safety)?|alpr|automatic license plate|automated license plate|license plate reader|axon|fusus|vehicle intelligence)\b/i;
const eventPattern = /\b(lawsuit|sues?|complaint|controversy|ban|cancel|terminate|reject|audit|misuse|abuse|privacy|sharing|ice|immigration|warrant|court|council|contract|oversight|surveillance|remove|pause|breach|stalk|track)\b/i;
type Item = { title: string; url: string; summary: string; publishedAt: string; channel: string; jurisdiction: string; issueType: string; speakerType: string; marketingPlay: string; clusterKey: string };

function clean(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function decode(value: string) { return value.replace(/^<!\[CDATA\[|\]\]>$/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function field(block: string, name: string) { return decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || ""); }
function parseFeed(xml: string) { return (xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || []).map((block) => ({ title: field(block, "title"), url: decode(block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || field(block, "link")), summary: field(block, "description") || field(block, "summary") || field(block, "content"), publishedAt: field(block, "pubDate") || field(block, "published") || field(block, "updated") })); }
function hostname(url: string) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "unknown"; } }
function publisher(item: Item) { const host = hostname(item.url); return host.includes("news.google.com") ? clean(item.title.split(" - ").pop() || host) : host; }

function findJurisdiction(text: string) {
  const normalized = text.toLowerCase();
  const target = [...redDotTargets].sort((a, b) => b.place.length - a.place.length).find((entry) => normalized.includes(entry.place.toLowerCase()) || normalized.includes(entry.place.replace(/,.*$/, "").toLowerCase()));
  if (target) return target.place;
  const states = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming";
  const government = text.match(new RegExp(`\\b(?:City|Town|Village|County) of ([A-Z][A-Za-z.'-]+(?:\\s+[A-Z][A-Za-z.'-]+){0,2})(?:,?\\s+(${states}|[A-Z]{2}))?`));
  if (government) return [government[1], government[2]].filter(Boolean).join(", ");
  const agency = text.match(new RegExp(`\\b([A-Z][A-Za-z.'-]+(?:\\s+[A-Z][A-Za-z.'-]+){0,2})\\s+(County|Police Department|City Council|Public Safety Committee)(?:,?\\s+(${states}|[A-Z]{2}))?`));
  if (agency) return `${agency[1]}${agency[2] === "County" ? " County" : ""}${agency[3] ? `, ${agency[3]}` : ""}`;
  const located = text.match(new RegExp(`\\b(?:in|near|around|from|at)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2})(?:,\\s*(${states}|[A-Z]{2}))?`));
  const blocked = /^(Android|Bitcoin|Reddit|Flock|Google|Police|Congress|America|American|United States|U\.S)$/i;
  if (located && !blocked.test(located[1])) return [located[1], located[2]].filter(Boolean).join(", ");
  const statewide = text.match(new RegExp(`\\b(${states})\\b`));
  return statewide ? `${statewide[1]} — statewide` : "National / jurisdiction pending";
}

function actionableJurisdiction(value: string) { return value !== "National / jurisdiction pending" && !value.endsWith("— statewide") && !/^(American|America|United States|Police|Congress)$/i.test(value); }

function classify(raw: Omit<Item, "jurisdiction" | "issueType" | "speakerType" | "marketingPlay" | "clusterKey">): Item {
  const text = `${raw.title} ${raw.summary}`;
  const issueType = /sue|lawsuit|court|complaint|legal action/i.test(text) ? "LEGAL ACTION" : /misread|wrongful|stalk|abuse|misuse|breach|track(?:ed|ing)/i.test(text) ? "PERSONAL HARM / MISUSE" : /council|mayor|contract|cancel|terminate|ban|remove|pause|vote|audit/i.test(text) ? "OFFICIAL ACTION" : /data|sharing|ice|immigration|retention|privacy|access request/i.test(text) ? "DATA GOVERNANCE" : "PUBLIC CONCERN";
  const speakerType = raw.channel === "REDDIT" ? "CITIZEN REPORT" : issueType === "OFFICIAL ACTION" ? "OFFICIAL ACTION" : issueType === "LEGAL ACTION" ? "LEGAL / MEDIA ALERT" : "PUBLIC ALERT";
  const jurisdiction = findJurisdiction(text); const local = jurisdiction !== "National / jurisdiction pending";
  const marketingPlay = raw.channel === "REDDIT" ? "SOCIAL · LOCAL EVIDENCE INVITATION" : local ? "PROFESSIONAL EMAIL · LOCAL ATTORNEYS / JOURNALISTS / ADVOCATES" : "NATIONAL · EDITORIAL + PROFESSIONAL PARTNER OUTREACH";
  return { ...raw, jurisdiction, issueType, speakerType, marketingPlay, clusterKey: clean(`${local ? jurisdiction : "national"}|${issueType}`) };
}

function canonicalItems(): Item[] {
  const cutoff = Date.now() - 180 * 86_400_000;
  return redDotTargets.flatMap((target) => {
    const publishedAt = target.evidenceDate || ""; const stamp = Date.parse(publishedAt); if (!Number.isFinite(stamp) || stamp < cutoff) return [];
    const summary = `${target.teaser} ${target.control} ${target.observed} ${target.evidence.join(" ")}`;
    return target.sources.map((source) => classify({ title: `${target.place}: ${target.teaser}`, url: source.url, summary, publishedAt, channel: "CANONICAL" }));
  });
}

function scoreGroup(items: Item[], metricCount: number, hasContact: boolean) {
  const text = items.map((item) => `${item.title} ${item.summary}`).join(" "); const sourceCount = new Set(items.map((item) => item.url)).size; const independent = new Set(items.map(publisher)).size;
  const issue = items[0].issueType; const discrepancy = issue === "LEGAL ACTION" || issue === "PERSONAL HARM / MISUSE" ? 25 : issue === "OFFICIAL ACTION" ? 22 : issue === "DATA GOVERNANCE" ? 18 : 12;
  const officialAnchor = items.some((item) => hostname(item.url).endsWith(".gov") || /court|audit|attorney general|official action/i.test(`${item.title} ${item.summary}`));
  const sourceStrength = Math.min(20, sourceCount * 2 + independent * 3 + (officialAnchor ? 5 : 0));
  const stamps = items.map((item) => Date.parse(item.publishedAt)).filter(Number.isFinite); const newest = stamps.length ? Math.max(...stamps) : Number.NaN; const age = Number.isFinite(newest) ? (Date.now() - newest) / 86_400_000 : 999;
  const recency = age <= 30 ? 15 : age <= 90 ? 11 : age <= 180 ? 7 : 2;
  const quantified = /\b\d[\d,.]*\+?\s+(?:cameras?|searches?|detections?|reads?|agencies|organizations|days?|months?|years?)\b/i.test(text) ? 15 : /\b\d[\d,.]*\+?\b/.test(text) ? 7 : 0;
  const officialAction = officialAnchor || /audit|lawsuit|court|terminated|suspended|council voted/i.test(text) ? 10 : 0;
  const audience = items[0].jurisdiction !== "National / jurisdiction pending" ? 7 + (items.some((item) => item.channel === "REDDIT") ? 3 : 0) : 2;
  const contact = hasContact ? 5 : 0; const score = Math.min(100, discrepancy + sourceStrength + recency + quantified + officialAction + audience + contact);
  const strongSet = sourceCount >= 4 && (independent >= 2 || officialAnchor);
  const qualificationState = !strongSet ? sourceCount <= 1 ? "WATCH" : "DEVELOPING" : score >= 80 && metricCount >= 2 ? "SALE_READY" : score >= 70 ? "CAMPAIGN_READY" : "DEVELOPING";
  return { sourceCount, independent, discrepancy, sourceStrength, recency, quantified, officialAction, audience, contact, score, qualificationState, newest: Number.isFinite(newest) ? new Date(newest).toISOString() : null };
}

function scoreFriction(items: Item[]) {
  const text = items.map((item) => `${item.title} ${item.summary}`).join(" ");
  const sourceCount = new Set(items.map((item) => item.url)).size;
  const independent = new Set(items.map(publisher)).size;
  const newest = Math.max(...items.map((item) => Date.parse(item.publishedAt)).filter(Number.isFinite), 0);
  const age = newest ? (Date.now() - newest) / 86_400_000 : 999;
  const harm = /misuse|abuse|wrongful|stalk|breach|lawsuit|court|complaint/i.test(text) ? 25 : /privacy|sharing|ice|warrant/i.test(text) ? 18 : 10;
  const specificity = actionableJurisdiction(items[0].jurisdiction) ? 10 : 2;
  const corroboration = Math.min(20, sourceCount * 3 + independent * 5);
  const officialResponse = /council|mayor|audit|lawsuit|court|terminated|suspended|official/i.test(text) ? 10 : 0;
  const reachability = items.some((item) => item.channel === "REDDIT") ? 10 : 5;
  const recency = age <= 7 ? 15 : age <= 30 ? 12 : age <= 45 ? 7 : 0;
  const frictionScore = Math.min(100, harm + specificity + corroboration + officialResponse + reachability + recency);
  const strongSingle = sourceCount === 1 && harm === 25 && officialResponse === 10 && specificity === 10;
  const state = frictionScore >= 75 && actionableJurisdiction(items[0].jurisdiction) && (sourceCount >= 2 || strongSingle) ? "DIG_NOW" : frictionScore >= 55 ? "VERIFY" : frictionScore >= 30 ? "WATCH" : "ARCHIVE";
  return { sourceCount, independent, harm, specificity, corroboration, officialResponse, reachability, recency, frictionScore, state };
}

export async function runDiscoveryPass(force = false) {
  const db = getD1(); const today = new Date().toISOString().slice(0, 10);
  const existing = await db.prepare("SELECT id FROM admin_activity_log WHERE event_type='DISCOVERY_PASS_COMPLETED' AND substr(created_at,1,10)=? LIMIT 1").bind(today).first();
  if (existing && !force) return { skipped: true, feeds: 0, candidates: 0, signals: 0, go: 0, hold: 0, watch: 0, developing: 0, campaignReady: 0, saleReady: 0, campaigns: 0 };
  let checkedFeeds = 0; let failedFeeds = 0; let fetchedItems = 0; const rejected = { noUrl: 0, noTechnology: 0, noFriction: 0, stale: 0 }; const collected: Item[] = [];
  for (const feed of feeds) {
    try { const response = await fetch(feed.url, { headers: { "User-Agent": "RedDotAudit-Discovery/2.1", Accept: "application/rss+xml,application/atom+xml,text/xml" }, signal: AbortSignal.timeout(12_000) }); if (!response.ok) { failedFeeds += 1; continue; } checkedFeeds += 1;
      const parsed = parseFeed((await response.text()).slice(0, 750_000)).slice(0, 75); fetchedItems += parsed.length;
      for (const raw of parsed) { const text = `${raw.title} ${raw.summary}`; if (!raw.url) { rejected.noUrl += 1; continue; } if (!techPattern.test(text)) { rejected.noTechnology += 1; continue; } if (!eventPattern.test(text)) { rejected.noFriction += 1; continue; } const stamp = Date.parse(raw.publishedAt); if (Number.isFinite(stamp) && Date.now() - stamp > 90 * 86_400_000) { rejected.stale += 1; continue; } collected.push(classify({ ...raw, channel: feed.channel })); }
    } catch (error) { failedFeeds += 1; console.error("Discovery feed failed", feed.channel, error); }
  }
  const deduplicated = [...new Map(collected.map((item) => [`${clean(item.url)}|${clean(item.title)}`, item])).values()].sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  const unique = deduplicated.slice(0, 50); const groups = new Map<string, Item[]>(); for (const item of unique) groups.set(item.clusterKey, [...(groups.get(item.clusterKey) || []), item]);
  const generation = await db.prepare("SELECT id FROM admin_market_generations WHERE status IN ('ACTIVE','COMPLETED') ORDER BY created_at DESC LIMIT 1").first<{ id: string }>();
  const generationId = generation?.id || "legacy"; let signals = 0; const auditTriggers: string[] = []; const states = { WATCH: 0, DEVELOPING: 0, CAMPAIGN_READY: 0, SALE_READY: 0 };
  await db.batch([
    db.prepare("UPDATE admin_friction_opportunities SET state='ARCHIVE',updated_at=CURRENT_TIMESTAMP WHERE generation_id=? AND state<>'AUDIT_STARTED'").bind(generationId),
    db.prepare("UPDATE admin_friction_opportunities SET state='ARCHIVE',audit_started_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE generation_id=? AND jurisdiction IN ('Bitcoin','Android','American','America','United States','Police','Congress')").bind(generationId),
    db.prepare("UPDATE admin_friction_opportunities SET state='VERIFY',audit_started_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE generation_id=? AND state='AUDIT_STARTED' AND (jurisdiction='National / jurisdiction pending' OR jurisdiction LIKE '%— statewide')").bind(generationId),
  ]);
  for (const [clusterKey, items] of groups) {
    const jurisdiction = items[0].jurisdiction; const metricRow = await db.prepare("SELECT COUNT(*) count FROM admin_jurisdiction_metrics WHERE normalized_jurisdiction=? AND verification_status='SOURCE_VERIFIED'").bind(clean(jurisdiction)).first<{ count: number }>();
    const contactRow = await db.prepare("SELECT 1 found FROM admin_official_contacts WHERE normalized_jurisdiction=? AND status='VERIFIED' LIMIT 1").bind(jurisdiction.toLowerCase().trim()).first();
    const scored = scoreGroup(items, Number(metricRow?.count || 0), Boolean(contactRow)); states[scored.qualificationState as keyof typeof states] += 1; const friction = scoreFriction(items); const now = new Date().toISOString();
    const primary = items.find((item) => item.channel === "REDDIT") || items[0];
    await db.prepare("INSERT INTO admin_friction_opportunities (id,generation_id,cluster_key,jurisdiction,issue_type,voice_type,voice_name,complaint_summary,origin_url,channel,published_at,source_count,independent_source_count,specificity_score,harm_score,corroboration_score,official_response_score,reachability_score,recency_score,friction_score,state,source_urls_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(generation_id,cluster_key) DO UPDATE SET jurisdiction=excluded.jurisdiction,issue_type=excluded.issue_type,voice_type=excluded.voice_type,voice_name=excluded.voice_name,complaint_summary=excluded.complaint_summary,origin_url=excluded.origin_url,channel=excluded.channel,published_at=excluded.published_at,source_count=excluded.source_count,independent_source_count=excluded.independent_source_count,specificity_score=excluded.specificity_score,harm_score=excluded.harm_score,corroboration_score=excluded.corroboration_score,official_response_score=excluded.official_response_score,reachability_score=excluded.reachability_score,recency_score=excluded.recency_score,friction_score=excluded.friction_score,state=CASE WHEN admin_friction_opportunities.state='AUDIT_STARTED' THEN 'AUDIT_STARTED' ELSE excluded.state END,source_urls_json=excluded.source_urls_json,updated_at=excluded.updated_at").bind(crypto.randomUUID(), generationId, clusterKey, jurisdiction, primary.issueType, primary.speakerType, publisher(primary), primary.summary.slice(0, 700) || primary.title, primary.url, primary.channel, primary.publishedAt || null, friction.sourceCount, friction.independent, friction.specificity, friction.harm, friction.corroboration, friction.officialResponse, friction.reachability, friction.recency, friction.frictionScore, friction.state, JSON.stringify([...new Set(items.map((item) => item.url))]), now, now).run();
    if (friction.state === "DIG_NOW") { const trigger = await db.prepare("SELECT id,state FROM admin_friction_opportunities WHERE generation_id=? AND cluster_key=? LIMIT 1").bind(generationId, clusterKey).first<{ id: string; state: string }>(); if (trigger?.state === "DIG_NOW") auditTriggers.push(trigger.id); }
    await db.prepare("INSERT INTO admin_market_candidates (id,generation_id,cluster_key,jurisdiction,issue_type,qualification_state,score,source_count,independent_source_count,source_strength_score,discrepancy_score,recency_score,quantified_score,official_action_score,audience_score,contact_score,metric_count,source_urls_json,newest_source_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(generation_id,cluster_key) DO UPDATE SET qualification_state=excluded.qualification_state,score=excluded.score,source_count=excluded.source_count,independent_source_count=excluded.independent_source_count,source_strength_score=excluded.source_strength_score,discrepancy_score=excluded.discrepancy_score,recency_score=excluded.recency_score,quantified_score=excluded.quantified_score,official_action_score=excluded.official_action_score,audience_score=excluded.audience_score,contact_score=excluded.contact_score,metric_count=excluded.metric_count,source_urls_json=excluded.source_urls_json,newest_source_at=excluded.newest_source_at,updated_at=excluded.updated_at").bind(crypto.randomUUID(), generationId, clusterKey, jurisdiction, items[0].issueType, scored.qualificationState, scored.score, scored.sourceCount, scored.independent, scored.sourceStrength, scored.discrepancy, scored.recency, scored.quantified, scored.officialAction, scored.audience, scored.contact, Number(metricRow?.count || 0), JSON.stringify([...new Set(items.map((item) => item.url))]), scored.newest, now, now).run();
    for (const item of items) {
      const endpointId = crypto.randomUUID(); await db.prepare("INSERT INTO admin_radar_endpoints (id,type,source_name,url,status,polling_enabled,target_polls_per_day,created_at,updated_at) VALUES (?,?,?,?, 'RESERVE',0,1,?,?) ON CONFLICT(url) DO UPDATE SET source_name=excluded.source_name,updated_at=excluded.updated_at").bind(endpointId, `DISCOVERY_${item.channel}`, publisher(item), item.url, now, now).run();
      const endpoint = await db.prepare("SELECT id FROM admin_radar_endpoints WHERE url=? LIMIT 1").bind(item.url).first<{ id: string }>(); if (!endpoint) continue;
      const fingerprint = await fingerprintThinContent(`${item.title}|${item.url}`); const status = ["CAMPAIGN_READY", "SALE_READY"].includes(scored.qualificationState) ? "AUTO_GO" : "AUTO_HOLD";
      const inserted = await db.prepare("INSERT INTO admin_radar_signals (id,endpoint_id,truth_level,status,title,summary,source_url,change_reason,diff_excerpt,change_fingerprint,detected_at,jurisdiction,issue_type,speaker_type,marketing_play,cluster_key,opportunity_score,cluster_signal_count) VALUES (?,?,'RADAR_SIGNAL',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(endpoint_id,change_fingerprint) DO NOTHING").bind(crypto.randomUUID(), endpoint.id, status, item.title.slice(0, 240), item.summary.slice(0, 1000), item.url, `${item.channel} source entered the current-generation evidence set`, item.summary.slice(0, 900), fingerprint, now, jurisdiction, item.issueType, item.speakerType, item.marketingPlay, clusterKey, scored.score, scored.sourceCount).run(); signals += Number(inserted.meta?.changes || 0);
    }
  }
  const openAudits = await db.prepare("SELECT id FROM admin_friction_opportunities WHERE generation_id=? AND state='AUDIT_STARTED'").bind(generationId).all<{ id: string }>();
  const auditsToRun = [...new Set([...auditTriggers, ...openAudits.results.map((row) => row.id)])];
  let auditsStarted = 0; let campaignsCreated = 0;
  for (const triggerId of auditsToRun) { try { const result = await startAuditFromFriction(triggerId); auditsStarted += 1; if (result.campaign) campaignsCreated += 1; } catch (error) { console.error("Automatic jurisdiction audit failed", triggerId, error); } }
  const now = new Date().toISOString(); const campaignTotal = await db.prepare("SELECT COUNT(*) campaigns FROM admin_campaign_batches WHERE status='PROPOSED'").first<{ campaigns: number }>();
  const jurisdictionQualified = unique.filter((item) => item.jurisdiction !== "National / jurisdiction pending").length;
  const receipt = { generationId, totalFeeds: feeds.length, checkedFeeds, failedFeeds, fetchedItems, deduplicatedItems: deduplicated.length, batchSize: unique.length, relevant: unique.length, jurisdictionQualified, rejected, clusters: groups.size, auditsStarted, campaignsCreated, states };
  await db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,summary,metadata_json,created_at) VALUES (?,?,'DISCOVERY_PASS_COMPLETED','RADAR_DISCOVERY',?,?,?)").bind(crypto.randomUUID(), "SYSTEM", `${checkedFeeds}/${feeds.length} feeds succeeded; ${fetchedItems} items read; ${unique.length} relevant; ${jurisdictionQualified} jurisdiction-qualified.`, JSON.stringify(receipt), now).run();
  return { skipped: false, feeds: checkedFeeds, failedFeeds, fetchedItems, deduplicatedItems: deduplicated.length, batchSize: unique.length, candidates: unique.length, jurisdictionQualified, auditsStarted, campaignsCreated, rejected, signals, go: states.CAMPAIGN_READY + states.SALE_READY, hold: states.WATCH + states.DEVELOPING, watch: states.WATCH, developing: states.DEVELOPING, campaignReady: states.CAMPAIGN_READY, saleReady: states.SALE_READY, campaigns: Number(campaignTotal?.campaigns || 0) + campaignsCreated };
}

export async function startAuditFromFriction(id: string, censusId?: string) {
  const db = getD1();
  const friction = await db.prepare("SELECT * FROM admin_friction_opportunities WHERE id=? LIMIT 1").bind(id).first<Record<string, unknown>>();
  if (!friction) throw new Error("Friction opportunity was not found.");
  const acquired = await acquireJurisdictionAudit(id, censusId);
  const jurisdiction = String(friction.jurisdiction); const issueType = String(friction.issue_type); const clusterKey = String(friction.cluster_key); const now = new Date().toISOString();
  const liveUrls = JSON.parse(String(friction.source_urls_json || "[]")) as string[];
  const canonical = canonicalItems().filter((item) => item.jurisdiction === jurisdiction);
  const target = redDotTargets.find((item) => item.place === jurisdiction);
  if (target?.sources[0]?.url) { const explicit = (target.publicMetrics || []).map((metric) => ({ key: clean(metric.label).replace(/\s+/g, "_"), value: metric.value, label: metric.label.toUpperCase() })); const extracted = extractJurisdictionMetrics(`${target.teaser} ${target.control} ${target.observed} ${target.evidence.join(" ")}`); const facts = [...new Map([...explicit, ...extracted].map((fact) => [fact.key, fact])).values()]; await saveJurisdictionMetrics(jurisdiction, target.sources[0].url, facts, target.evidenceDate || now); }
  const liveItems: Item[] = liveUrls.map((url) => ({ title: String(friction.complaint_summary), summary: String(friction.complaint_summary), url, publishedAt: String(friction.published_at || now), channel: String(friction.channel), jurisdiction, issueType, speakerType: String(friction.voice_type), marketingPlay: String(friction.channel) === "REDDIT" ? "SOCIAL · LOCAL EVIDENCE INVITATION" : "PROFESSIONAL EMAIL · LOCAL ATTORNEYS / JOURNALISTS / ADVOCATES", clusterKey }));
  const items = [...liveItems, ...canonical];
  const metricRow = await db.prepare("SELECT COUNT(*) count FROM admin_jurisdiction_metrics WHERE normalized_jurisdiction=? AND verification_status='SOURCE_VERIFIED'").bind(clean(jurisdiction)).first<{ count: number }>();
  const contact = await db.prepare("SELECT 1 found FROM admin_official_contacts WHERE normalized_jurisdiction=? AND status='VERIFIED' LIMIT 1").bind(clean(jurisdiction)).first();
  const acquiredUrls = (() => { try { return JSON.parse(String(acquired?.source_urls_json || "[]")) as string[]; } catch { return []; } })(); const metricCount = Number(metricRow?.count || 0); const sourceCount = Number(acquired?.source_count || 0); const independent = new Set(acquiredUrls.map((url) => hostname(url))).size;
  const authority = acquired?.authority_text ? 20 : 0; const observed = acquired?.observed_text ? 20 : 0; const discrepancy = acquired?.discrepancy_text ? 20 : 0; const metricStrength = Math.min(20, metricCount * 5); const provenance = Math.min(15, Number(acquired?.source_count || 0) * 3); const contactScore = contact ? 5 : 0; const auditScore = authority + observed + discrepancy + metricStrength + provenance + contactScore;
  const recordComplete = acquired?.status === "EVIDENCE_QUALIFIED" && Boolean(contact) && metricCount >= 2 && sourceCount >= 3;
  const qualificationState = recordComplete ? "EVIDENCE_QUALIFIED" : auditScore >= 45 ? "DEVELOPING" : "WATCH";
  const scored = { sourceCount, independent, sourceStrength: provenance, discrepancy, recency: 0, quantified: metricStrength, officialAction: authority, audience: observed, contact: contactScore, score: auditScore, qualificationState, newest: items.map((item) => Date.parse(item.publishedAt)).filter(Number.isFinite).sort((a, b) => b - a)[0] ? new Date(items.map((item) => Date.parse(item.publishedAt)).filter(Number.isFinite).sort((a, b) => b - a)[0]).toISOString() : null };
  await db.prepare("UPDATE admin_market_candidates SET qualification_state=?,score=?,source_count=?,independent_source_count=?,source_strength_score=?,discrepancy_score=?,recency_score=?,quantified_score=?,official_action_score=?,audience_score=?,contact_score=?,metric_count=?,source_urls_json=?,newest_source_at=?,updated_at=? WHERE generation_id=? AND cluster_key=?").bind(scored.qualificationState, scored.score, scored.sourceCount, scored.independent, scored.sourceStrength, scored.discrepancy, scored.recency, scored.quantified, scored.officialAction, scored.audience, scored.contact, metricCount, JSON.stringify([...new Set(items.map((item) => item.url))]), scored.newest, now, String(friction.generation_id), clusterKey).run();
  let campaign: Record<string, unknown> | null = null;
  if (["CAMPAIGN_READY", "SALE_READY"].includes(scored.qualificationState)) {
    const social = items.find((item) => item.channel === "REDDIT"); const route = social ? "SOCIAL · LOCAL EVIDENCE INVITATION" : items[0].marketingPlay;
    await db.prepare("INSERT INTO admin_campaign_batches (id,label,issue_summary,status,case_count,target_count,direct_count,referral_count,priority_score,review_minutes,created_at,cluster_key,jurisdiction,issue_type,marketing_route,source_count) VALUES (?,?,?,'ACTIVE',0,0,0,0,?,8,?,?,?,?,?,?) ON CONFLICT(cluster_key) DO UPDATE SET status='ACTIVE',issue_summary=excluded.issue_summary,priority_score=excluded.priority_score,source_count=excluded.source_count,marketing_route=excluded.marketing_route,created_at=excluded.created_at").bind(crypto.randomUUID(), `${jurisdiction} · ${issueType}`, `${scored.sourceCount} recombined sources · ${scored.independent} independent publishers · ${scored.qualificationState}`, scored.score, now, clusterKey, jurisdiction, issueType, route, scored.sourceCount).run();
    campaign = await db.prepare("SELECT * FROM admin_campaign_batches WHERE cluster_key=? LIMIT 1").bind(clusterKey).first<Record<string, unknown>>() || null;
  }
  await db.batch([db.prepare("UPDATE admin_friction_opportunities SET state='AUDIT_STARTED',audit_started_at=?,updated_at=? WHERE id=?").bind(now, now, id), db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,entity_id,summary,metadata_json,created_at) VALUES (?,?,'FRICTION_AUDIT_STARTED','FRICTION_OPPORTUNITY',?,?,?,?)").bind(crypto.randomUUID(), "ADMIN", id, `Started audit for ${jurisdiction}; recombined ${scored.sourceCount} current and canonical sources.`, JSON.stringify(scored), now)]);
  return { friction: { ...friction, state: "AUDIT_STARTED", audit_started_at: now }, audit: acquired, qualification: scored, campaign, baseline: target ? { agency: target.agency, control: target.control, observed: target.observed, missingProof: target.missingProof, sources: target.sources.length, metrics: target.publicMetrics?.length || 0 } : null };
}

export async function startSystematicAudit(censusId: string) {
  const db = getD1();
  const census = await db.prepare("SELECT * FROM admin_census_deployments WHERE id=? LIMIT 1").bind(censusId).first<Record<string, unknown>>();
  if (!census) throw new Error("Survey jurisdiction was not found.");
  const generation = await db.prepare("SELECT id FROM admin_market_generations WHERE status IN ('ACTIVE','COMPLETED') ORDER BY created_at DESC LIMIT 1").first<{id:string}>();
  const generationId = generation?.id || "legacy"; const jurisdiction = String(census.jurisdiction); const clusterKey = clean(`${censusId}|${jurisdiction}|systematic compliance survey`); const now = new Date().toISOString();
  const urls = (() => { try { return JSON.parse(String(census.source_urls_json || "[]")) as string[]; } catch { return []; } })();
  const existing = await db.prepare("SELECT id FROM admin_friction_opportunities WHERE generation_id=? AND cluster_key=? LIMIT 1").bind(generationId, clusterKey).first<{id:string}>(); const id = existing?.id || crypto.randomUUID();
  await db.prepare("INSERT INTO admin_friction_opportunities (id,generation_id,cluster_key,jurisdiction,issue_type,voice_type,voice_name,complaint_summary,origin_url,channel,published_at,source_count,independent_source_count,specificity_score,harm_score,corroboration_score,official_response_score,reachability_score,recency_score,friction_score,state,source_urls_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(generation_id,cluster_key) DO UPDATE SET state='AUDIT_STARTED',source_urls_json=excluded.source_urls_json,updated_at=excluded.updated_at").bind(id,generationId,clusterKey,jurisdiction,"SYSTEMATIC COMPLIANCE SURVEY","SYSTEMATIC SURVEY","RED DOT CENSUS",`Systematic review of ${String(census.agency)}: documented authority versus deployment, searches, detections, users, outside access, retention and sharing.`,urls[0] || "https://www.flocksafety.com/", "SYSTEMATIC", String(census.last_verified_at || now), urls.length, new Set(urls.map(hostname)).size, 10, 0, Math.min(20, urls.length * 3), 0, 0, 0, 50, "AUDIT_STARTED", JSON.stringify(urls), now, now).run();
  await db.prepare("INSERT INTO admin_market_candidates (id,generation_id,cluster_key,jurisdiction,issue_type,qualification_state,score,source_count,independent_source_count,source_strength_score,discrepancy_score,recency_score,quantified_score,official_action_score,audience_score,contact_score,metric_count,source_urls_json,created_at,updated_at) VALUES (?,?,?,?,?,'WATCH',0,0,0,0,0,0,0,0,0,0,0,'[]',?,?) ON CONFLICT(generation_id,cluster_key) DO NOTHING").bind(crypto.randomUUID(),generationId,clusterKey,jurisdiction,"SYSTEMATIC COMPLIANCE SURVEY",now,now).run();
  return startAuditFromFriction(id, censusId);
}
