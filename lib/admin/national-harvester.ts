import { getD1 } from "@/lib/commerce/config";

const ATLAS_BASE = "https://www.atlasofsurveillance.org";
const ATLAS_QUERY = `${ATLAS_BASE}/search.html?vendor=Flock%20Safety`;

type Candidate = { recordId: string; agency: string; city: string; county: string; state: string; summary: string; links: string[]; cameras: number | null };

function text(html: string) { return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); }
function absolute(value: string) { try { return new URL(value, ATLAS_BASE).toString(); } catch { return ""; } }
function numberWord(value: string) { const words: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20 }; return /^\d+$/.test(value) ? Number(value) : words[value.toLowerCase()] || null; }
function cameraCount(summary: string) { const match = summary.match(/\b(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:Flock Safety\s+)?(?:automated license plate readers|license plate readers|ALPRs?|cameras)\b/i); return match ? numberWord(match[1]) : null; }

export function parseAtlasCandidates(html: string): Candidate[] {
  const rows: Candidate[] = [];
  const pattern = /<tr data-ref="([^"]+)" data-ori9="([^"]+)" class="desktop-only">([\s\S]*?)<\/tr>\s*<tr class="desktop-only">([\s\S]*?)<\/tr>/gi;
  for (const match of html.matchAll(pattern)) {
    const cells = [...match[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1]));
    if (cells.length < 6 || cells[5] !== "Flock Safety" || !/Automated License Plate Readers/i.test(cells[4])) continue;
    const detail = match[4]; const summary = text(detail.replace(/<p class="links">[\s\S]*$/i, ""));
    const links = [...detail.matchAll(/href="([^"]+)"/gi)].map((item) => absolute(item[1])).filter(Boolean);
    const recordUrl = `${ATLAS_BASE}/a/${match[2]}`;
    rows.push({ recordId: match[1], agency: cells[0], city: cells[1], county: cells[2], state: cells[3], summary, links: [...new Set([recordUrl, ...links])], cameras: cameraCount(summary) });
  }
  return rows;
}

// The Atlas of Surveillance's Flock Safety listing spans ~28 pages
// nationally (verified directly against the live site, not assumed) and
// grows over time as new deployments are documented. A fixed page cap goes
// stale silently — the earlier hardcoded limit of 5 pages was missing over
// 90% of the national dataset (only 4 states' worth) without ever surfacing
// an error, since "fewer pages than exist" and "reached the end" look
// identical from inside a bounded loop. Paginating until an empty page is
// reached, instead of a fixed count, is what keeps this correct as the
// source grows. MAX_PAGES is a safety ceiling against a pathological
// response (e.g. the site always returning >0 rows due to a bug on its
// end), not the expected stopping point.
const MAX_PAGES = 60;

export async function harvestNationalCandidates(pages = MAX_PAGES) {
  const db = getD1(); const now = new Date().toISOString(); const candidates: Candidate[] = []; const ledger: Array<{url:string;status:number;found:number}> = [];
  for (let page = 1; page <= Math.max(1, Math.min(pages, MAX_PAGES)); page += 1) {
    const url = `${ATLAS_QUERY}&page=${page}`; const response = await fetch(url, { headers: { "User-Agent": "RedDotAudit-National-Harvester/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(20_000) });
    const html = response.ok ? await response.text() : ""; const parsed = response.ok ? parseAtlasCandidates(html) : []; ledger.push({ url, status: response.status, found: parsed.length }); candidates.push(...parsed);
    if (response.ok && parsed.length === 0) break;
    if (!response.ok) break;
  }
  const unique = [...new Map(candidates.map((row) => [`${row.agency}|${row.state}`, row])).values()];
  for (let index = 0; index < unique.length; index += 40) {
    await db.batch(unique.slice(index, index + 40).map((row) => {
      const jurisdiction = `${row.city || row.county}, ${row.state}`; const id = crypto.randomUUID();
      return db.prepare("INSERT INTO admin_census_deployments (id,jurisdiction,agency,state,vendor_system,confidence,evidence_count,device_count,source_urls_json,lead_reason,research_readiness,acquisition_status,last_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,'NATIONAL_SOURCE',?,?,?,?,1,'QUEUED',?,?,?) ON CONFLICT(jurisdiction,agency) DO UPDATE SET vendor_system=excluded.vendor_system,confidence=excluded.confidence,evidence_count=excluded.evidence_count,device_count=excluded.device_count,source_urls_json=excluded.source_urls_json,lead_reason=excluded.lead_reason,research_readiness=1,acquisition_status=CASE WHEN admin_census_deployments.acquisition_status IN ('COMPLETE','EVIDENCE_FOUND','NO_GAP') THEN admin_census_deployments.acquisition_status ELSE 'QUEUED' END,last_verified_at=excluded.last_verified_at,updated_at=excluded.updated_at").bind(id,jurisdiction,row.agency,row.state,"Flock Safety · Automated License Plate Readers",row.links.length,row.cameras,JSON.stringify(row.links),row.summary,now,now,now);
    }));
  }
  await db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,summary,metadata_json,created_at) VALUES (?,?,'NATIONAL_CANDIDATE_HARVEST','DEPLOYMENT_CANDIDATE',?,?,?)").bind(crypto.randomUUID(),"SYSTEM",`${unique.length} Flock/ALPR candidates harvested from the EFF Atlas of Surveillance.`,JSON.stringify({ source: ATLAS_QUERY, pages: ledger, candidates: unique.length }),now).run();
  return { candidates: unique.length, pages: ledger, source: ATLAS_QUERY };
}
