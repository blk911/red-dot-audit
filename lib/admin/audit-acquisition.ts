import { getD1 } from "@/lib/commerce/config";
import { redDotTargets } from "@/app/red-dot-targets";
import { extractJurisdictionMetrics, saveJurisdictionMetrics } from "@/lib/admin/jurisdiction-metrics";
import { renderPageText } from "@/lib/admin/browser-render";

type EvidenceType = "AGENCY" | "AUTHORITY" | "STATISTICS" | "USAGE" | "CONTACT" | "FRICTION" | "LEGAL_ACTION" | "OTHER";
type SearchHit = { title: string; url: string; summary: string; evidenceType: EvidenceType };
type ValidatedSource = SearchHit & { finalUrl: string; body: string; sourceClass: string; links: SearchHit[] };

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function escaped(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function plain(html: string) { return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); }
function field(block: string, name: string) { return plain(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || ""); }
function rssItems(xml: string) { return (xml.match(/<item\b[\s\S]*?<\/item>/gi) || []).map((block) => ({ title: field(block, "title"), url: field(block, "link"), summary: field(block, "description") })).filter((item) => /^https?:\/\//.test(item.url)); }
function hostname(url: string) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "unknown"; } }
function sourceClass(url: string) { const host = hostname(url); if (host.endsWith(".gov") || host.endsWith(".us")) return "OFFICIAL"; if (/court|legis|state\./.test(host)) return "LEGAL"; if (/reuters|apnews|tcpalm|record|journal|times|tribune|herald|dispatch|news/.test(host)) return "NEWS"; if (/aclu|eff|epic/.test(host)) return "ADVOCACY"; return "PUBLIC"; }
function excluded(url: string) { return /wikipedia|wikimedia|dictionary|facebook|instagram|youtube|pinterest|amazon|quora/.test(hostname(url)); }
const technology = /\b(Flock(?: Safety)?|ALPR|automatic license plate|automated license plate|license plate reader|plate reader)\b/i;
const authorityTerms = /\b(contract|agreement|policy|authorized|approved|ordinance|procurement|purchase|retention|permitted use|memorandum|resolution)\b/i;
const usageTerms = /\b(search(?:ed|es)?|quer(?:y|ies|ied)|shared|accessed|misuse|detections?|reads?|alerts?|hotlist|audit log)\b/i;
const contactTerms = /\b(contact|directory|city attorney|police chief|public records|records custodian|phone|email)\b/i;
const repositoryTerms = /\b(agenda|packet|minutes|contract|agreement|procurement|bid|purchase|policy|ordinance|resolution|public records|document center|laserfiche|legistar|granicus|civicclerk|opengov|bonfire|demandstar|municode)\b/i;
function sentence(text: string, pattern: RegExp) { return text.split(/(?<=[.!?])\s+/).find((value) => pattern.test(value) && value.length >= 45 && value.length <= 900) || null; }
function inferType(text: string): EvidenceType { if (/contact|directory|city attorney|police chief|public records/i.test(text)) return "CONTACT"; if (authorityTerms.test(text)) return "AUTHORITY"; if (/\b\d[\d,.+]*\b/.test(text) && technology.test(text)) return "STATISTICS"; if (usageTerms.test(text)) return "USAGE"; if (/police department|sheriff|public safety/i.test(text)) return "AGENCY"; return "OTHER"; }
function pageLinks(html: string, base: string): SearchHit[] { const links: SearchHit[] = []; for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) { const label = plain(match[2]); if (!/flock|alpr|license plate|contract|agreement|procurement|agenda|packet|minutes|policy|retention|public records|police|contact/i.test(`${label} ${match[1]}`)) continue; try { const url = new URL(match[1], base).toString(); if (/^https?:/.test(url) && !excluded(url)) links.push({ title: label || "Official linked record", url, summary: `Linked from ${base}`, evidenceType: inferType(`${label} ${url}`) }); } catch { /* invalid source link */ } } return [...new Map(links.map((item) => [item.url, item])).values()].slice(0, 16); }

// The `site:` operator does not work on this endpoint (bing.com/search?
// format=rss, a legacy/consumer-facing endpoint — Microsoft retired the
// actual Bing Search API product in August 2025, so this free endpoint is
// what's left). Confirmed three separate times this session against three
// different domains (a specific vendor portal, the .gov TLD, a specific
// .gov site) — every one returned results with no relationship to the
// domain restriction, not just weak results. Two of the removed queries had
// no viable non-site: substitute:
//   - `site:transparency.flocksafety.com` was also pointless independent of
//     the site: failure — that portal is behind a Cloudflare bot-challenge
//     (confirmed directly), so even a working site: search couldn't have
//     been followed by a fetch anyway.
//   - `site:${domain}` for an already-confirmed official domain (dig deeper
//     into a source we already trust) has no free equivalent once site:
//     doesn't work — there's no way to restrict a search to one domain
//     without either a paid search API or guessing URL paths blind. This is
//     an open capability gap, not silently worked around.
// The `site:.gov` query's *intent* (bias toward official sources) is kept
// via ordinary keyword terms instead — weaker than a real restriction, but
// still real signal, unlike the site: version which was contributing
// nothing.
function acquisitionQueries(jurisdiction: string, agency: string, officialDomains: string[] = []) {
  const place = jurisdiction.replace(/,.*$/, "").trim();
  return [
    [`"${agency}" "Flock Safety"`, "OTHER"],
    [`"${agency}" (ALPR OR "license plate reader")`, "OTHER"],
    [`"${place}" "Flock Safety"`, "OTHER"],
    [`"${place}" ALPR`, "OTHER"],
    [`"${jurisdiction}" (Flock OR ALPR OR "license plate reader") (contract OR agreement OR procurement OR council)`, "AUTHORITY"],
    [`"${jurisdiction}" (Flock OR ALPR OR "license plate reader") (cameras OR devices OR deployment)`, "STATISTICS"],
    [`"${jurisdiction}" (Flock OR ALPR) (searches OR queries OR detections OR reads OR alerts)`, "STATISTICS"],
    [`"${jurisdiction}" ("audit log" OR "transparency portal") Flock`, "STATISTICS"],
    [`"${jurisdiction}" ("authorized users" OR officers OR accounts) (Flock OR ALPR)`, "STATISTICS"],
    [`"${jurisdiction}" ("shared with" OR "agencies with access" OR "network lookup") Flock`, "STATISTICS"],
    [`"${jurisdiction}" (Flock OR ALPR) (sharing OR "outside agencies" OR access OR retention)`, "USAGE"],
    [`"${jurisdiction}" police (Flock OR ALPR) (policy OR audit OR misuse)`, "USAGE"],
    [`"${jurisdiction}" police department official contact public records email`, "CONTACT"],
    [`"${jurisdiction}" city attorney official email`, "CONTACT"],
    [`"${jurisdiction}" (Flock OR ALPR OR "license plate reader") (city council OR county commission OR official government website)`, "AGENCY"],
    [`"${jurisdiction}" (agenda packet OR minutes OR procurement OR contract) (Flock OR ALPR)`, "AUTHORITY"],
    [`"${jurisdiction}" (Laserfiche OR Legistar OR Granicus OR CivicClerk OR OpenGov OR Bonfire OR DemandStar)`, "OTHER"],
    ...officialDomains.map((domain) => [`"${jurisdiction}" ${domain} (agenda OR packet OR contract OR procurement OR policy)`, "AUTHORITY"] as [string, EvidenceType]),
  ] as Array<[string, EvidenceType]>;
}

async function searchOne(query: string, evidenceType: EvidenceType): Promise<SearchHit[]> {
  try { const response = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "RedDotAudit-Acquisition/3.0", Accept: "application/rss+xml,text/xml" }, signal: AbortSignal.timeout(9_000) }); if (!response.ok) return []; return rssItems((await response.text()).slice(0, 600_000)).filter((item) => !excluded(item.url)).map((item) => ({ ...item, evidenceType })); } catch { return []; }
}

async function discoverSources(jurisdiction: string, agency: string, officialDomains: string[] = []) {
  const batches = await Promise.all(acquisitionQueries(jurisdiction, agency, officialDomains).map(([query, type]) => searchOne(query, type))); const place = jurisdiction.replace(/,.*$/, "").replace(/\s+County$/i, "").trim(); const placePattern = new RegExp(`\\b${escaped(place)}\\b`, "i");
  const hits = batches.flat().filter((item) => placePattern.test(`${item.title} ${item.summary}`) && (technology.test(`${item.title} ${item.summary}`) || (item.evidenceType === "CONTACT" && contactTerms.test(`${item.title} ${item.summary}`)) || repositoryTerms.test(`${item.title} ${item.summary}`)));
  return [...new Map(hits.map((item) => [item.url, { ...item, evidenceType: item.evidenceType === "OTHER" ? inferType(`${item.title} ${item.summary}`) : item.evidenceType }])).values()].slice(0, 36);
}

// CourtListener/RECAP (Free Law Project) indexes full text of filed federal
// documents, not just docket metadata — so a jurisdiction/agency name can
// match a case even when neither term appears on the docket's own summary
// page. Its own search relevance is therefore treated as the verification
// (unlike the generic web hits above, these are recorded straight into
// evidence without a second fetch+body-content check) rather than something
// re-derived by refetching the docket page, which would spuriously reject
// real matches. No API key is required for this endpoint.
//
// The query below is a docket-level, not document-level, match: CourtListener
// can return a docket where the jurisdiction phrase and the technology terms
// each appear in *different* attached documents (or even just once, with the
// other clause matching loosely elsewhere), so the two concepts never
// actually co-occur anywhere. This was invisible until a live benchmark run
// against generic city/agency names (rather than one well-known case) turned
// up dozens of completely unrelated dockets — e.g. cash-seizure affidavits
// that merely happened to be notarized "at Montgomery, Alabama", the literal
// courthouse seat, with no ALPR/Flock term anywhere in the case. Requesting
// highlighted snippets and requiring a technology term to actually appear in
// at least one is what distinguishes that from a real match: verified
// against "Schmidt v. City of Norfolk" (kept, snippet highlights "FLOCK")
// vs. the Montgomery seizure case (dropped, snippet only highlights the city
// name) using this exact check.
const COURTLISTENER_BASE = "https://www.courtlistener.com";
type CourtListenerResult = { caseName?: string; court_citation_string?: string; docketNumber?: string; dateFiled?: string; cause?: string; docket_absolute_url?: string; recap_documents?: Array<{ snippet?: string }> };
// "United States v. [Defendant]" is the federal caption for an ordinary
// criminal prosecution. ALPR/Flock terms show up in plenty of these purely
// as a routine investigative detail (e.g. "officers located the vehicle via
// a Flock alert") — that is the system working as intended, not evidence of
// an authority/use gap, and including it would flood the evidence ledger
// with noise unrelated to oversight. Civil rights suits, class actions
// against the vendor, and other civil litigation keep the plaintiff's name
// as the caption's first party, so this pattern only excludes the criminal
// docket shape.
const federalCriminalCaption = /^united states v\./i;
// Bare "Flock" and bare "ALPR" are too ambiguous for this corpus: "Flock
// Specialty Finance" is a real distressed-debt investment firm that shows up
// as a creditor across many unrelated Chapter 11 bankruptcy schedules, and a
// giant multi-thousand-line creditor matrix or mass-tort plaintiff list can
// independently contain both a small department's name and an unrelated
// "Flock"/"ALPR" mention somewhere in the same huge filing — passing the
// snippet check above without the two ever being topically related. Only
// the two-word phrase "Flock Safety" and the three-word phrase "license
// plate reader" survive that same bankruptcy-schedule noise in testing;
// dropping the bare terms cuts recall but was necessary to stop false
// positives (verified against Pelham/Montgomery/Pell City/Prescott Valley,
// AL/AZ — all genuinely have zero ALPR litigation and all dropped to 0
// results under this version) while keeping the real Norfolk matches.
async function courtListenerHits(jurisdiction: string, agency: string): Promise<SearchHit[]> {
  const queries = [`"${agency}" ("Flock Safety" OR "license plate reader")`, `"${jurisdiction}" ("Flock Safety" OR "license plate reader")`];
  const batches = await Promise.all(queries.map(async (query) => {
    try {
      const response = await fetch(`${COURTLISTENER_BASE}/api/rest/v4/search/?type=r&highlight=on&q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "RedDotAudit-Acquisition/3.1", Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return [];
      const body = (await response.json()) as { results?: CourtListenerResult[] };
      return (body.results || []).slice(0, 8).map((row): SearchHit | null => {
        if (!row.docket_absolute_url || !row.caseName || federalCriminalCaption.test(row.caseName)) return null;
        const snippets = plain((row.recap_documents || []).map((doc) => doc.snippet || "").join(" "));
        if (!technology.test(snippets)) return null;
        const summary = `ALPR/Flock Safety civil litigation — ${row.court_citation_string || "federal court"} · docket ${row.docketNumber || "unknown"} · filed ${row.dateFiled || "unknown date"}${row.cause ? ` · ${row.cause}` : ""}`;
        return { title: row.caseName, url: `${COURTLISTENER_BASE}${row.docket_absolute_url}`, summary, evidenceType: "LEGAL_ACTION" };
      }).filter((hit): hit is SearchHit => Boolean(hit));
    } catch { return []; }
  }));
  return [...new Map(batches.flat().map((hit) => [hit.url, hit])).values()];
}

async function recordEvidence(auditId: string, frictionId: string, jurisdiction: string, hit: SearchHit, status: string, excerpt?: string | null, reason?: string | null, finalUrl?: string) {
  const db = getD1(); const now = new Date().toISOString(); const url = finalUrl || hit.url;
  await db.prepare("INSERT INTO admin_jurisdiction_evidence (id,audit_id,friction_id,jurisdiction,normalized_jurisdiction,evidence_type,title,source_url,publisher_domain,source_class,status,excerpt,failure_reason,discovered_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(audit_id,source_url) DO UPDATE SET evidence_type=excluded.evidence_type,title=excluded.title,publisher_domain=excluded.publisher_domain,source_class=excluded.source_class,status=excluded.status,excerpt=excluded.excerpt,failure_reason=excluded.failure_reason,verified_at=excluded.verified_at,updated_at=excluded.updated_at").bind(crypto.randomUUID(), auditId, frictionId, jurisdiction, normalized(jurisdiction), hit.evidenceType, hit.title || null, url, hostname(url), sourceClass(url), status, excerpt || null, reason || null, now, status.startsWith("VERIFIED_") ? now : null, now).run();
}

async function validateHit(hit: SearchHit, jurisdiction: string): Promise<{ source?: ValidatedSource; reason?: string }> {
  try { const response = await fetch(hit.url, { headers: { "User-Agent": "RedDotAudit-Acquisition/3.1", Accept: "text/html,application/xhtml+xml,application/pdf,text/plain" }, redirect: "follow", signal: AbortSignal.timeout(15_000) }); if (!response.ok) return { reason: `HTTP ${response.status}` }; const finalUrl = response.url || hit.url; const type = response.headers.get("content-type") || ""; let body = ""; let links: SearchHit[] = [];
    if (/pdf/i.test(type) || /\.pdf(?:$|[?#])/i.test(finalUrl)) { const length = Number(response.headers.get("content-length") || 0); if (length > 8_000_000) return { reason: "PDF exceeds the 8 MB acquisition limit" }; const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.byteLength > 8_000_000) return { reason: "PDF exceeds the 8 MB acquisition limit" }; const { extractText } = await import("unpdf"); body = plain((await extractText(bytes, { mergePages: true })).text).slice(0, 1_200_000); }
    else if (/html|text\//i.test(type)) { const html = (await response.text()).slice(0, 1_500_000); body = plain(html); links = pageLinks(html, finalUrl); }
    else return { reason: `Unsupported document type: ${type || "unknown"}` };
    const place = jurisdiction.replace(/,.*$/, "").replace(/\s+County$/i, "").trim(); if (body.length < 120) return { reason: "Document contained too little extractable text" }; if (!new RegExp(`\\b${escaped(place)}\\b`, "i").test(body)) return { reason: "Jurisdiction name was not present in the source" };
    if (hit.evidenceType === "CONTACT") { if (sourceClass(finalUrl) !== "OFFICIAL") return { reason: "Contact page was not hosted by an official government source" }; if (!contactTerms.test(body)) return { reason: "Official page did not establish a relevant contact" }; }
    else if (hit.evidenceType === "OTHER" && sourceClass(finalUrl) === "OFFICIAL" && repositoryTerms.test(`${hit.title} ${body}`)) { /* official discovery gateway; its linked records are evaluated separately */ }
    else if (!technology.test(body)) return { reason: "ALPR/Flock relevance was not present in the source" };
    if (hit.evidenceType === "AUTHORITY" && !authorityTerms.test(body)) return { reason: "Source did not establish authority or control" };
    if (hit.evidenceType === "STATISTICS" && !(technology.test(body) && /\b\d[\d,.+]*\b/.test(body))) return { reason: "Source did not contain quantified ALPR operations" };
    if (hit.evidenceType === "USAGE" && !usageTerms.test(body)) return { reason: "Source did not establish observed ALPR use" };
    return { source: { ...hit, finalUrl, body, sourceClass: sourceClass(finalUrl), links } }; } catch (error) { return { reason: error instanceof Error ? error.message : "Fetch or document parse failed" }; }
}

function extractAgency(text: string, jurisdiction: string) {
  const place = jurisdiction.replace(/,.*$/, "").replace(/\s+County$/i, "").trim();
  const explicit = [
    new RegExp(`\\b(${escaped(place)}(?: City)? Police Department)\\b`, "i"),
    new RegExp(`\\b(${escaped(place)} County Sheriff(?:'s)? Office)\\b`, "i"),
    new RegExp(`\\b(${escaped(place)} Public Safety Department)\\b`, "i"),
  ];
  for (const pattern of explicit) { const value = text.match(pattern)?.[1]?.replace(/\s+/g, " ").trim(); if (value && value.length <= 72) return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
  return null;
}
function extractContact(text: string) { const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:gov|us)\b/i)?.[0]; if (!email) return null; const at = text.indexOf(email); const around = text.slice(Math.max(0, at - 180), at + email.length + 80); const name = around.match(/(?:Chief|Sheriff|Attorney|Director|Officer|Manager)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})/)?.[0] || "Official contact"; const phone = around.match(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/)?.[0] || null; return { email, name, phone }; }

export async function acquireJurisdictionAudit(frictionId: string, censusId?: string) {
  const db = getD1(); const friction = await db.prepare("SELECT * FROM admin_friction_opportunities WHERE id=? LIMIT 1").bind(frictionId).first<Record<string, unknown>>(); if (!friction) throw new Error("Friction opportunity was not found.");
  const jurisdiction = String(friction.jurisdiction); const key = normalized(jurisdiction); const now = new Date().toISOString(); const target = redDotTargets.find((item) => normalized(item.place) === key); const existing = await db.prepare("SELECT id FROM admin_jurisdiction_audits WHERE friction_id=? LIMIT 1").bind(frictionId).first<{ id: string }>(); const auditId = existing?.id || crypto.randomUUID();
  const frictionUrls = JSON.parse(String(friction.source_urls_json || "[]")) as string[]; const systematic = String(friction.channel) === "SYSTEMATIC"; const censusRows = censusId ? await db.prepare("SELECT id,agency,device_count,source_urls_json,last_verified_at FROM admin_census_deployments WHERE id=? LIMIT 1").bind(censusId).all<Record<string, unknown>>() : { results: [] as Record<string, unknown>[] };
  await db.prepare("INSERT INTO admin_jurisdiction_audits (id,friction_id,census_id,generation_id,jurisdiction,normalized_jurisdiction,agency,status,source_urls_json,started_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?, 'RUNNING', ?,?,?,?) ON CONFLICT(friction_id) DO UPDATE SET census_id=excluded.census_id,agency=excluded.agency,status='RUNNING',started_at=excluded.started_at,updated_at=excluded.updated_at").bind(auditId, frictionId, censusId || null, String(friction.generation_id), jurisdiction, key, target?.agency || censusRows.results[0]?.agency || null, JSON.stringify(frictionUrls), now, now, now).run();
  const verified: ValidatedSource[] = []; const errors: string[] = [];
  // The originating complaint/story is what actually found this
  // jurisdiction — often the single most on-topic source, since it's
  // specifically about an ALPR usage event here — yet it previously only
  // ever got recorded using its feed summary/snippet: never fetched, never
  // metric-extracted, never folded into the authority/observed/discrepancy
  // detection every other source gets below. Closing that gap: validate the
  // real page, and when that succeeds, extract metrics and push it into
  // `verified` so it participates exactly like a discovered source does.
  // This only helps when origin_url is directly fetchable. Reddit links
  // resolve directly and do benefit. Google News RSS links do not: they are
  // JS-redirect wrappers with no server-side resolution — confirmed by
  // direct testing, the "URL" always returns Google's own SPA shell, never
  // the article — so News-channel items fail validation here and fall back
  // to the summary-only recording, unchanged from before this fix.
  const frictionHit: SearchHit = { title: systematic ? "Systematic survey seed" : "Originating complaint", url: String(friction.origin_url), summary: String(friction.complaint_summary), evidenceType: systematic ? "OTHER" : "FRICTION" };
  if (!systematic) {
    const frictionResult = await validateHit(frictionHit, jurisdiction);
    let source = frictionResult.source;
    if (!source) {
      // Plain fetch failed — often because the page needs JS to build its
      // content (Google News' redirect wrapper). One rendered-browser retry
      // before falling back to the summary-only recording; bounded to this
      // one hit per audit, not the whole discovery batch, to keep browser
      // launches rare. Returns null and no-ops cleanly if BROWSER isn't
      // provisioned, or if rendering succeeds but still doesn't clear the
      // same place+technology bar validateHit enforces (e.g. an active
      // anti-bot challenge page instead of the real content — this doesn't
      // defeat those, so Reddit/MuckRock-style blocks still fall through).
      const rendered = await renderPageText(frictionHit.url);
      if (rendered) {
        const place = jurisdiction.replace(/,.*$/, "").replace(/\s+County$/i, "").trim();
        if (new RegExp(`\\b${escaped(place)}\\b`, "i").test(rendered) && technology.test(rendered)) {
          source = { ...frictionHit, finalUrl: frictionHit.url, body: rendered, sourceClass: sourceClass(frictionHit.url), links: [] };
        }
      }
    }
    if (source) {
      await recordEvidence(auditId, frictionId, jurisdiction, frictionHit, "VERIFIED_COMPLAINT", sentence(source.body, technology) || frictionHit.summary, null, source.finalUrl);
      await saveJurisdictionMetrics(jurisdiction, source.finalUrl, extractJurisdictionMetrics(source.body), now, censusId);
      verified.push(source);
    } else {
      await recordEvidence(auditId, frictionId, jurisdiction, frictionHit, "VERIFIED_COMPLAINT", frictionHit.summary);
    }
  }
  const knownOfficial = await db.prepare("SELECT DISTINCT publisher_domain FROM admin_jurisdiction_evidence WHERE audit_id=? AND source_class='OFFICIAL' AND status<>'REJECTED'").bind(auditId).all<{ publisher_domain: string }>();
  const candidateAgency = String(censusRows.results[0]?.agency || target?.agency || jurisdiction); const searched = await discoverSources(jurisdiction, candidateAgency, knownOfficial.results.map((row) => row.publisher_domain)); const seedHits = systematic ? frictionUrls.map((url) => ({ title: `${candidateAgency} census source`, url, summary: `Survey seed for ${candidateAgency} in ${jurisdiction}`, evidenceType: "OTHER" as EvidenceType })) : []; const discovered = [...new Map([...seedHits, ...searched].map((hit) => [hit.url, hit])).values()]; for (const hit of discovered) await recordEvidence(auditId, frictionId, jurisdiction, hit, "DISCOVERED", hit.summary);
  const firstValidation = await Promise.all(discovered.map(async (hit) => ({ hit, result: await validateHit(hit, jurisdiction) }))); const officialLinks = firstValidation.flatMap((item) => item.result.source?.sourceClass === "OFFICIAL" ? item.result.source.links : []).filter((hit) => !discovered.some((item) => item.url === hit.url)).slice(0, 16); for (const hit of officialLinks) await recordEvidence(auditId, frictionId, jurisdiction, hit, "DISCOVERED", hit.summary); const linkedValidation = await Promise.all(officialLinks.map(async (hit) => ({ hit, result: await validateHit(hit, jurisdiction) }))); const validation = [...firstValidation, ...linkedValidation];
  for (const item of validation) { if (item.result.source) { const source = item.result.source; const status = item.hit.evidenceType === "CONTACT" ? "VERIFIED_CONTACT" : item.hit.evidenceType === "AGENCY" ? "VERIFIED_AGENCY" : item.hit.evidenceType === "OTHER" && !technology.test(source.body) ? "DISCOVERY_GATEWAY" : "VERIFIED_AUDIT_EVIDENCE"; if (status === "VERIFIED_AUDIT_EVIDENCE" || status === "VERIFIED_AGENCY" || status === "VERIFIED_CONTACT") verified.push(source); await recordEvidence(auditId, frictionId, jurisdiction, item.hit, status, sentence(source.body, technology) || item.hit.summary, null, source.finalUrl); } else { const status = /PDF exceeds|document parse/i.test(item.result.reason || "") ? "NEEDS_DOCUMENT_PARSE" : "REJECTED"; await recordEvidence(auditId, frictionId, jurisdiction, item.hit, status, item.hit.summary, item.result.reason); errors.push(`${item.hit.url}: ${item.result.reason}`); } }
  const courtHits = await courtListenerHits(jurisdiction, candidateAgency); for (const hit of courtHits) await recordEvidence(auditId, frictionId, jurisdiction, hit, "VERIFIED_AUDIT_EVIDENCE", hit.summary, null, hit.url);
  let authorityText = target?.control || null; let authoritySourceUrl = target?.sources[0]?.url || null; let observedText = target?.observed || (systematic ? null : String(friction.complaint_summary)); let observedSourceUrl = target?.sources[0]?.url || (systematic ? null : String(friction.origin_url)); let agency = target?.agency || String(censusRows.results[0]?.agency || "") || null; let sourcedDiscrepancy: string | null = target?.teaser || null;
  for (const row of censusRows.results) { const source = (() => { try { return (JSON.parse(String(row.source_urls_json || "[]")) as string[])[0]; } catch { return undefined; } })(); if (source && Number(row.device_count) > 0) await saveJurisdictionMetrics(jurisdiction, source, [{ key: "cameras_identified", value: String(row.device_count), label: "CAMERAS IDENTIFIED" }], String(row.last_verified_at || now), censusId); }
  for (const source of verified) { if (source.evidenceType !== "CONTACT") await saveJurisdictionMetrics(jurisdiction, source.finalUrl, extractJurisdictionMetrics(source.body), now, censusId); agency ||= extractAgency(source.body, jurisdiction); const authority = sentence(source.body, new RegExp(`${technology.source}.{0,220}${authorityTerms.source}|${authorityTerms.source}.{0,220}${technology.source}`, "i")); if (!authorityText && authority && ["OFFICIAL", "LEGAL", "NEWS"].includes(source.sourceClass)) { authorityText = authority; authoritySourceUrl = source.finalUrl; } const usage = sentence(source.body, new RegExp(`${technology.source}.{0,220}${usageTerms.source}|${usageTerms.source}.{0,220}${technology.source}`, "i")); if (usage) { observedText = usage; observedSourceUrl = source.finalUrl; } const variance = sentence(source.body, /\b(unauthorized|outside (?:the )?policy|policy violation|misuse|abuse|improper(?:ly)?|without approval|not permitted|violat(?:e|ed|ion)|discrepan(?:cy|cies)|failed to audit|access revoked)\b/i); if (!sourcedDiscrepancy && variance && ["OFFICIAL", "LEGAL", "NEWS", "ADVOCACY"].includes(source.sourceClass)) sourcedDiscrepancy = variance; const contact = extractContact(source.body); if (contact && source.sourceClass === "OFFICIAL") await db.prepare("INSERT INTO admin_official_contacts (id,jurisdiction,normalized_jurisdiction,name,title,organization,email,phone,source_url,status,verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'VERIFIED',?,?,?) ON CONFLICT(normalized_jurisdiction,email) DO UPDATE SET name=excluded.name,organization=excluded.organization,phone=excluded.phone,source_url=excluded.source_url,status='VERIFIED',verified_at=excluded.verified_at,updated_at=excluded.updated_at").bind(crypto.randomUUID(), jurisdiction, key, contact.name, null, agency, contact.email, contact.phone, source.finalUrl, now, now, now).run(); }
  if (target?.sources[0]?.url) { const explicit = (target.publicMetrics || []).map((metric) => ({ key: normalized(metric.label).replace(/\s+/g, "_"), value: metric.value, label: metric.label.toUpperCase() })); await saveJurisdictionMetrics(jurisdiction, target.sources[0].url, [...explicit, ...extractJurisdictionMetrics(`${target.teaser} ${target.control} ${target.observed} ${target.evidence.join(" ")}`)], target.evidenceDate || now, censusId); }
  const metricIdentity = censusId || key; const metricRows = await db.prepare("SELECT metric_key FROM admin_jurisdiction_metrics WHERE census_id=? AND verification_status='SOURCE_VERIFIED'").bind(metricIdentity).all<{ metric_key: string }>(); const metricKeys = new Set(metricRows.results.map((row) => row.metric_key)); const metricCount = metricKeys.size; const hasDeployment = metricKeys.has("cameras_identified"); const hasActivity = ["searches_reported", "detections_30_days", "alerts_reported"].some((metricKey) => metricKeys.has(metricKey)); const discrepancyText = sourcedDiscrepancy; const substantiveRows = await db.prepare("SELECT source_url,source_class FROM admin_jurisdiction_evidence WHERE audit_id=? AND status='VERIFIED_AUDIT_EVIDENCE'").bind(auditId).all<{source_url:string;source_class:string}>(); const substantiveCount = substantiveRows.results.length; const official = substantiveRows.results.filter((item) => item.source_class === "OFFICIAL").length; const documentPending = validation.filter((item) => /PDF exceeds|document parse/i.test(item.result.reason || "")).length; const baselineComplete = Boolean(agency && authorityText && observedText && hasDeployment && hasActivity && official); const status = baselineComplete && discrepancyText ? "EVIDENCE_QUALIFIED" : baselineComplete ? "BASELINE_COMPLETE" : substantiveCount ? "SOURCE_REVIEW" : "BLOCKED";
  const missing = [!agency && "responsible agency", !authorityText && "contract / policy authority", !hasDeployment && "camera / device count", !hasActivity && "search, detection or alert volume", !observedText && "observed use", !official && "official government source", documentPending && `${documentPending} document(s) remain unparsed`, !discrepancyText && "source-backed authority / usage discrepancy", "query, retention, sharing and audit records"].filter(Boolean).join("; "); const validatedUrls = verified.map((item) => item.finalUrl);
  await db.prepare("UPDATE admin_jurisdiction_audits SET agency=?,status=?,source_count=?,metric_count=?,authority_text=?,authority_source_url=?,observed_text=?,observed_source_url=?,discrepancy_text=?,missing_proof=?,source_urls_json=?,errors_json=?,completed_at=?,updated_at=? WHERE friction_id=?").bind(agency, status, substantiveCount, metricCount, authorityText, authoritySourceUrl, observedText, observedSourceUrl, discrepancyText, missing, JSON.stringify([...new Set([...frictionUrls, ...validatedUrls])]), JSON.stringify(errors), now, now, frictionId).run(); return db.prepare("SELECT * FROM admin_jurisdiction_audits WHERE friction_id=? LIMIT 1").bind(frictionId).first<Record<string, unknown>>();
}
