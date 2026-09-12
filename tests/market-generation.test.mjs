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
  assert.match(discovery, /deduplicated\.slice\(0, 50\)/);
  assert.match(discovery, /friction\.state === "DIG_NOW"/);
  assert.match(discovery, /startAuditFromFriction\(triggerId\)/);
  assert.match(discovery, /recordComplete = acquired\?\.status === "EVIDENCE_QUALIFIED"/);
  assert.match(discovery, /Boolean\(contact\) && metricCount >= 2 && sourceCount >= 3/);
  assert.match(discovery, /recordComplete \? "EVIDENCE_QUALIFIED"/);
  assert.match(discovery, /SET state='ARCHIVE'.*state<>'AUDIT_STARTED'/);
  assert.match(discovery, /jurisdiction IN \('Bitcoin','Android','American'/);
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
  assert.match(acquisition, /\$\{COURTLISTENER_BASE\}\/api\/rest\/v4\/search\/\?type=r&q=/);
  assert.match(acquisition, /async function courtListenerHits/);
  assert.match(acquisition, /federalCriminalCaption = \/\^united states v\\\.\/i/);
  assert.match(acquisition, /federalCriminalCaption\.test\(row\.caseName\)/);
  assert.match(acquisition, /const courtHits = await courtListenerHits\(jurisdiction, candidateAgency\)/);
  assert.match(acquisition, /for \(const hit of courtHits\) await recordEvidence\(auditId, frictionId, jurisdiction, hit, "VERIFIED_AUDIT_EVIDENCE"/);
});
