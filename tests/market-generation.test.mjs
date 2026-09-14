import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("clean generation archives derived intelligence and preserves commerce and outreach history", () => {
  const source = fs.readFileSync(new URL("../lib/admin/market-generation.ts", import.meta.url), "utf8");
  for (const table of ["admin_campaign_batches", "admin_radar_signals", "admin_radar_endpoints", "admin_census_deployments", "admin_jurisdiction_metrics"]) assert.match(source, new RegExp(table));
  for (const preserved of ["purchases", "research_requests", "admin_outreach", "admin_outreach_events", "admin_targets"]) assert.doesNotMatch(source.match(/const RESET_TABLES[\s\S]*?] as const/)?.[0] || "", new RegExp(`\\b${preserved}\\b`));
  assert.match(source, /admin_market_generation_rows/);
  assert.match(source, /admin_targets WHERE id NOT IN \(SELECT DISTINCT target_id FROM admin_outreach\)/);
  assert.match(source, /ACQUISITION_ONLY/);
  assert.doesNotMatch(source, /bootstrapCensus|runMonitorBatch|runDiscoveryPass/);
});

test("qualification requires a corroborated source set and sourced metrics for sale-ready", () => {
  const source = fs.readFileSync(new URL("../lib/admin/discovery.ts", import.meta.url), "utf8");
  assert.match(source, /sourceCount >= 4/);
  assert.match(source, /independent >= 2 \|\| officialAnchor/);
  assert.match(source, /score >= 80 && metricCount >= 2/);
  assert.match(source, /sourceCount <= 1 \? "WATCH"/);
});

test("friction intake preserves the public voice and requires an explicit audit bridge", () => {
  const discovery = fs.readFileSync(new URL("../lib/admin/discovery.ts", import.meta.url), "utf8");
  const route = fs.readFileSync(new URL("../app/api/admin/friction/route.ts", import.meta.url), "utf8");
  assert.match(discovery, /admin_friction_opportunities/);
  assert.match(discovery, /origin_url/);
  assert.match(discovery, /voice_type/);
  assert.match(discovery, /sourceCount === 1 && harm === 25 && officialResponse === 10/);
  assert.match(route, /startAuditFromFriction/);
  assert.match(discovery, /const items = \[\.\.\.liveItems, \.\.\.canonical\]/);
  assert.match(discovery, /if \(\["CAMPAIGN_READY", "SALE_READY"\]\.includes\(scored\.qualificationState\)\)/);
  assert.match(discovery, /failedFeeds/);
  assert.match(discovery, /jurisdictionQualified/);
  assert.match(discovery, /noTechnology/);
  assert.match(discovery, /noFriction/);
  assert.match(discovery, /actionableJurisdiction/);
  assert.match(discovery, /'ACTIVE'/);
  assert.match(discovery, /deduplicated\.slice\(0, 80\)/);
  assert.match(discovery, /friction\.state === "DIG_NOW"/);
  assert.match(discovery, /startAuditFromFriction\(triggerId\)/);
  assert.match(discovery, /recordComplete = acquired\?\.status === "EVIDENCE_QUALIFIED"/);
  assert.match(discovery, /Boolean\(contact\) && metricCount >= 2 && sourceCount >= 3/);
  assert.match(discovery, /recordComplete \? "EVIDENCE_QUALIFIED"/);
  assert.match(discovery, /SET state='ARCHIVE'.*state<>'AUDIT_STARTED'/);
  assert.match(discovery, /jurisdiction IN \('Bitcoin','Android','American'/);
  // Usage data almost always surfaces because someone already filed a
  // records request and published the result — this feed targets that
  // publication event specifically, not just generic ALPR news.
  assert.match(discovery, /%22records\+obtained%22\+OR\+%22public\+records\+request%22\+OR\+%22network\+audit%22\+OR\+FOIA/);
});

test("systematic jurisdiction survey does not require a complaint", () => {
  const discovery = fs.readFileSync(new URL("../lib/admin/discovery.ts", import.meta.url), "utf8");
  const admin = fs.readFileSync(new URL("../app/admin/admin-console.tsx", import.meta.url), "utf8");
  assert.match(discovery, /startSystematicAudit/);
  assert.match(discovery, /SYSTEMATIC COMPLIANCE SURVEY/);
  assert.match(discovery, /SYSTEMATIC SURVEY/);
  assert.match(admin, /Acquisition Lab/);
  assert.match(admin, /RUN NATIONAL HARVEST/);
  assert.match(admin, /READING NATIONAL SOURCE/);
  assert.doesNotMatch(discovery, /const resumed = await acquireJurisdictionAudit/);
});

test("admin exposes the audit middle stage and its evidence gaps", () => {
  const admin = fs.readFileSync(new URL("../app/admin/admin-console.tsx", import.meta.url), "utf8");
  assert.match(admin, /3 · Evidence Review/);
  assert.match(admin, /DOCUMENTED AUTHORITY \/ CONTROL/);
  assert.match(admin, /OBSERVED USE \/ REPORTED EVENT/);
  assert.match(admin, /UNRESOLVED DISCREPANCY/);
  assert.match(admin, /MISSING PROOF \/ GENUINE UNKNOWNS/);
  assert.match(admin, /ACQUISITION LEDGER/);
});

test("clean acquisition endpoint cannot reload the legacy seed", () => {
  const route = fs.readFileSync(new URL("../app/api/admin/census/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /bootstrapCensus/);
  assert.match(route, /Seed loading is disabled/);
  assert.match(route, /action === "create"/);
});

test("national harvester produces source-led Flock deployment candidates", () => {
  const harvester = fs.readFileSync(new URL("../lib/admin/national-harvester.ts", import.meta.url), "utf8");
  const admin = fs.readFileSync(new URL("../app/admin/admin-console.tsx", import.meta.url), "utf8");
  assert.match(harvester, /atlasofsurveillance\.org/);
  assert.match(harvester, /Flock Safety/);
  assert.match(harvester, /data-ref/);
  assert.match(harvester, /source_urls_json/);
  assert.match(harvester, /NATIONAL_CANDIDATE_HARVEST/);
  assert.match(admin, /RUN NATIONAL HARVEST/);
  assert.match(admin, /CandidateLedger/);
  assert.doesNotMatch(admin, /ACQUIRE DATA/);
  assert.match(admin, /AUTOMATIC ACQUISITION/);
  // A fixed page cap goes stale silently as the source grows — pagination
  // must stop on an empty/failed page, not a hardcoded count, or a future
  // reader has no way to tell "we paginated fully" from "we gave up early."
  assert.match(harvester, /if \(response\.ok && parsed\.length === 0\) break;/);
  const route = fs.readFileSync(new URL("../app/api/admin/census/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /harvestNationalCandidates\(2\)/);
});

test("discovery jurisdiction resolution requires a real place signal, and auto-audit requires it be unambiguous", () => {
  const discovery = fs.readFileSync(new URL("../lib/admin/discovery.ts", import.meta.url), "utf8");
  // The weakest extraction branch (bare "in/near/at X") must require a
  // trailing state — this is what stops company names and sentence
  // fragments like "Palantir" or "Parking Lots Every" from being accepted
  // as if they were real jurisdictions.
  assert.ok(discovery.includes(",\\\\s*(${states}|[A-Z]{2})\\\\b`));"), "the 'located' extraction must require a trailing state, not treat it as optional");
  assert.match(discovery, /Palantir/);
  assert.match(discovery, /Parking\|Lots\|Every/);
  // Actionability (auto-audit trigger, jurisdiction-qualified reporting)
  // must require either a curated target match or an explicit state suffix
  // — an unqualified "Richmond County" is real but ambiguous, and auditing
  // the wrong state's county wastes a real acquisition pass.
  assert.match(discovery, /function actionableJurisdiction/);
  assert.match(discovery, /redDotTargets\.some\(\(target\) => target\.place === value\)/);
  assert.match(discovery, /return stateSuffixPattern\.test\(value\);/);
  assert.match(discovery, /const jurisdictionQualified = unique\.filter\(\(item\) => actionableJurisdiction\(item\.jurisdiction\)\)\.length;/);
});

test("the originating complaint is fetched and metric-extracted, not just recorded from its feed snippet", () => {
  const acquisition = fs.readFileSync(new URL("../lib/admin/audit-acquisition.ts", import.meta.url), "utf8");
  // verified/errors must exist before the friction hit is processed, so its
  // validated source (when the fetch succeeds) can join the same array that
  // discovered sources use for authority/observed/discrepancy detection.
  const verifiedDeclIndex = acquisition.indexOf("const verified: ValidatedSource[] = []; const errors: string[] = [];");
  const frictionHitIndex = acquisition.indexOf("const frictionHit: SearchHit =");
  assert.ok(verifiedDeclIndex >= 0 && frictionHitIndex > verifiedDeclIndex, "verified/errors must be declared before the friction hit is validated");
  assert.match(acquisition, /const frictionResult = await validateHit\(frictionHit, jurisdiction\);/);
  assert.match(acquisition, /let source = frictionResult\.source;/);
  // When the plain fetch fails, one rendered-browser retry before falling
  // back — bounded to this single hit, not the whole discovery batch.
  assert.match(acquisition, /import \{ renderPageText \} from "@\/lib\/admin\/browser-render";/);
  assert.match(acquisition, /const rendered = await renderPageText\(frictionHit\.url\);/);
  assert.match(acquisition, /if \(source\) \{/);
  assert.match(acquisition, /await saveJurisdictionMetrics\(jurisdiction, source\.finalUrl, extractJurisdictionMetrics\(source\.body\), now, censusId\);/);
  assert.match(acquisition, /verified\.push\(source\);/);
  // Falling back to the summary-only recording when both the plain fetch
  // and the render retry fail (e.g. an active anti-bot challenge) must
  // remain — no regression for sources that can't be fixed by fetching harder.
  assert.match(acquisition, /await recordEvidence\(auditId, frictionId, jurisdiction, frictionHit, "VERIFIED_COMPLAINT", frictionHit\.summary\);/);
});

test("browser rendering is scoped to what it can actually fix, and honest about what it can't test locally", () => {
  const render = fs.readFileSync(new URL("../lib/admin/browser-render.ts", import.meta.url), "utf8");
  assert.match(render, /import puppeteer from "@cloudflare\/puppeteer";/);
  assert.match(render, /const binding = \(env as Record<string, unknown>\)\.BROWSER;/);
  assert.match(render, /if \(!binding\) return null;/);
  assert.match(render, /await puppeteer\.launch\(/);
  // Must document the two real constraints found this session: it doesn't
  // defeat active bot-challenges (only fixes pure-JS-rendering pages), and
  // it's untestable in local Miniflare dev without a real Cloudflare
  // account connection.
  assert.match(render, /anti-bot challenges/i);
  assert.match(render, /UNTESTED IN LOCAL DEV/);

  const viteConfig = fs.readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(viteConfig, /browser: \{ binding: "BROWSER" \}/);
});

test("the site: operator is not used in queries against the Bing RSS endpoint, since it doesn't work there", () => {
  const acquisition = fs.readFileSync(new URL("../lib/admin/audit-acquisition.ts", import.meta.url), "utf8");
  const queriesBlock = acquisition.slice(acquisition.indexOf("function acquisitionQueries"), acquisition.indexOf("async function searchOne"));
  assert.doesNotMatch(queriesBlock, /site:/, "site: was confirmed broken on this endpoint three separate times this session and must not be reintroduced");
  // The .gov-restriction intent survives as ordinary keyword terms instead
  // of a (non-functional) site: restriction.
  assert.match(queriesBlock, /city council OR county commission OR official government website/);
  // Digging deeper into an already-confirmed official domain has no free
  // site:-free equivalent — kept as a keyword term (weaker, but real signal,
  // unlike the site: version which contributed nothing).
  assert.match(queriesBlock, /officialDomains\.map\(\(domain\) => \[`"\$\{jurisdiction\}" \$\{domain\}/);
});

test("automatic acquisition queue binds every audit to its exact national candidate", () => {
  const queue = fs.readFileSync(new URL("../lib/admin/acquisition-queue.ts", import.meta.url), "utf8");
  const acquisition = fs.readFileSync(new URL("../lib/admin/audit-acquisition.ts", import.meta.url), "utf8");
  const discovery = fs.readFileSync(new URL("../lib/admin/discovery.ts", import.meta.url), "utf8");
  assert.match(queue, /acquisition_status IN \('QUEUED','RETRY'\)/);
  assert.match(queue, /startSystematicAudit\(candidate\.id\)/);
  assert.match(acquisition, /WHERE id=\? LIMIT 1/);
  assert.doesNotMatch(acquisition, /lower\(jurisdiction\) LIKE/);
  assert.match(acquisition, /census_id/);
  assert.match(discovery, /startAuditFromFriction\(id, censusId\)/);
});

test("jurisdiction acquisition stores search provenance and rejects unsourced values", () => {
  const acquisition = fs.readFileSync(new URL("../lib/admin/audit-acquisition.ts", import.meta.url), "utf8");
  assert.match(acquisition, /admin_jurisdiction_evidence/);
  assert.match(acquisition, /NEEDS_DOCUMENT_PARSE/);
  assert.match(acquisition, /import\("unpdf"\)/);
  assert.match(acquisition, /pageLinks/);
  assert.match(acquisition, /BASELINE_COMPLETE/);
  assert.match(acquisition, /Jurisdiction name was not present/);
  assert.match(acquisition, /ALPR\/Flock relevance was not present/);
  assert.match(acquisition, /official government source/);
  assert.match(acquisition, /source\.sourceClass === "OFFICIAL"/);
  const metrics = fs.readFileSync(new URL("../lib/admin/jurisdiction-metrics.ts", import.meta.url), "utf8");
  assert.match(metrics, /excerpt/);
  assert.match(metrics, /sourceDate/);
  assert.match(metrics, /confidence/);
});

test("court/legal-action evidence is sourced from CourtListener and recorded without a re-fetch", () => {
  const acquisition = fs.readFileSync(new URL("../lib/admin/audit-acquisition.ts", import.meta.url), "utf8");
  assert.match(acquisition, /LEGAL_ACTION/);
  assert.match(acquisition, /COURTLISTENER_BASE = "https:\/\/www\.courtlistener\.com"/);
  assert.match(acquisition, /\$\{COURTLISTENER_BASE\}\/api\/rest\/v4\/search\/\?type=r&highlight=on&q=/);
  assert.match(acquisition, /async function courtListenerHits/);
  assert.match(acquisition, /federalCriminalCaption = \/\^united states v\\\.\/i/);
  assert.match(acquisition, /federalCriminalCaption\.test\(row\.caseName\)/);
  assert.match(acquisition, /highlight=on/);
  assert.match(acquisition, /if \(!technology\.test\(snippets\)\) return null;/);
  assert.doesNotMatch(acquisition, /queries = \[`"\$\{agency\}" \(Flock OR ALPR/);
  assert.match(acquisition, /queries = \[`"\$\{agency\}" \("Flock Safety" OR "license plate reader"\)/);
  assert.match(acquisition, /const courtHits = await courtListenerHits\(jurisdiction, candidateAgency\)/);
  assert.match(acquisition, /for \(const hit of courtHits\) await recordEvidence\(auditId, frictionId, jurisdiction, hit, "VERIFIED_AUDIT_EVIDENCE"/);
});

test("jurisdiction metrics are keyed by candidate identity, not jurisdiction string, so same-name agencies cannot overwrite each other", () => {
  const migration = fs.readFileSync(new URL("../drizzle/0014_metric_candidate_identity.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN `census_id` text/);
  assert.match(migration, /DROP INDEX `admin_jurisdiction_metrics_jurisdiction_key_uidx`/);
  assert.match(migration, /CREATE UNIQUE INDEX `admin_jurisdiction_metrics_census_key_uidx` ON `admin_jurisdiction_metrics` \(`census_id`,`metric_key`\)/);
  assert.match(migration, /SET `census_id` = `normalized_jurisdiction` WHERE `census_id` IS NULL/);

  const metrics = fs.readFileSync(new URL("../lib/admin/jurisdiction-metrics.ts", import.meta.url), "utf8");
  assert.match(metrics, /censusId\?: string \| null/);
  assert.match(metrics, /const identity = censusId \|\| key/);
  assert.match(metrics, /ON CONFLICT\(census_id,metric_key\)/);
  // A real-identity write must retire the matching fallback-keyed row in the
  // same batch, or migrated/legacy data orphans permanently instead of
  // self-healing as jurisdictions get reprocessed.
  assert.match(metrics, /DELETE FROM admin_jurisdiction_metrics WHERE normalized_jurisdiction=\? AND metric_key=\? AND census_id=\?/);
  assert.match(metrics, /if \(!censusId\) return \[insert\];/);

  const acquisition = fs.readFileSync(new URL("../lib/admin/audit-acquisition.ts", import.meta.url), "utf8");
  assert.match(acquisition, /saveJurisdictionMetrics\(jurisdiction, source, \[\{ key: "cameras_identified".*\}\], String\(row\.last_verified_at \|\| now\), censusId\)/);
  assert.match(acquisition, /WHERE census_id=\? AND verification_status='SOURCE_VERIFIED'/);
});

test("acquisition queue claims candidates with an atomic guarded update, backs off before retrying, and classifies terminal failures", () => {
  const migration = fs.readFileSync(new URL("../drizzle/0015_acquisition_lease_retry.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN `acquisition_next_attempt_at` text/);
  assert.match(migration, /ADD COLUMN `acquisition_terminal_reason` text/);

  const queue = fs.readFileSync(new URL("../lib/admin/acquisition-queue.ts", import.meta.url), "utf8");
  // The claim must be a single conditional UPDATE (status re-checked in the
  // WHERE clause), not a separate SELECT-then-UPDATE — that's what makes two
  // concurrent calls unable to both "win" the same candidate.
  assert.match(queue, /const claim = await db\.prepare\(/);
  assert.match(queue, /WHERE id=\? AND \(acquisition_status IN \('QUEUED','RETRY'\) OR \(acquisition_status='ACQUIRING' AND acquisition_started_at<=\?\)\)/);
  assert.match(queue, /if \(!claim\.meta\?\.changes\) continue;/);
  // Stale ACQUIRING leases (a crashed worker) must become reclaimable, not stuck forever.
  assert.match(queue, /STALE_LEASE_MINUTES = 10/);
  // Failures must back off and eventually reach a real terminal state, not retry forever or immediately.
  assert.match(queue, /MAX_ACQUISITION_ATTEMPTS = 5/);
  assert.match(queue, /function backoffMinutes/);
  assert.match(queue, /function classifyFailure/);
  assert.match(queue, /SOURCE_UNAVAILABLE/);
  assert.match(queue, /FETCH_BLOCKED/);
  assert.match(queue, /PARSE_FAILED/);
});
