import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const deepSurvey = JSON.parse(await readFile(resolve(root, "research/red-dot-deep-survey-current.json"), "utf8"));

// Marketing value is deliberately separate from evidentiary readiness. It reflects
// scale, name recognition, geographic reach, and likely relevance to professional buyers.
const marketValue = new Map(Object.entries({
  "pflugerville-tx": 20,
  "el-cajon-ca": 18,
  "ventura-county-ca": 19,
  "san-francisco-ca": 20,
  "renton-wa": 16,
  "denver-co": 20,
  "boulder-co": 17,
  "hall-county-ga": 16,
  "coweta-county-ga": 11,
  "jackson-county-in": 16,
  "highland-heights-oh": 16,
  "milwaukee-wi": 19,
  "sumter-county-fl": 16,
  "brevard-county-fl": 18,
  "brunswick-county-nc": 10,
  "new-bedford-ma": 17,
  "syracuse-ny": 19,
  "oxnard-ca": 14,
  "mountain-view-ca": 18,
  "johnson-county-tx": 19,
  "lufkin-tx": 17,
  "katy-tx": 16,
  "west-chicago-il": 14,
  "los-angeles-ca": 20,
  "westchester-county-ny": 20,
  "windsor-ct": 16,
  "cambridge-ma": 19,
  "eugene-or": 18,
}));

const numericSignal = /\b\d[\d,.+%-]*\b/;
const officialAction = /\b(attorney general|audit|charged|complaint|court|ended|fired|indicted|lawsuit|resigned|suspended|terminated|voted)\b/i;
const multiAgencySignal = /\b(access|agencies|federal|immigration|nationwide|organizations|sharing|states)\b/i;

const scored = deepSurvey.assessments
  .filter((item) => item.disposition === "SELLABLE")
  .map((item) => {
    const sources = item.sourceUrls || [];
    const evidence = Math.min(30, 12 + sources.length * 6);
    const contrast = 12 + (numericSignal.test(item.observed) ? 8 : 0) + (multiAgencySignal.test(item.observed) ? 5 : 0);
    const action = officialAction.test(item.observed) ? 15 : 7;
    const acquisition = item.missingProof.split(",").length >= 3 ? 10 : 7;
    const market = marketValue.get(item.id) || 10;
    const score = Math.min(98, evidence + contrast + action + acquisition + market);
    const blockers = [];
    const cautions = [];
    if (sources.length === 0) blockers.push("No direct reviewed source URL captured");
    if (!numericSignal.test(item.observed)) cautions.push("No quantified activity in captured summary");
    const valueCase = [
      numericSignal.test(item.observed) ? "quantified activity" : "documented activity",
      officialAction.test(item.observed) ? "official action or audit" : "concrete operational event",
      multiAgencySignal.test(item.observed) ? "access/sharing significance" : "individual misuse significance",
    ].join(" · ");
    return {
      id: item.id,
      disposition: item.disposition,
      score,
      components: { evidence, contrast, action, acquisition, market },
      sourceCount: sources.length,
      sourceUrls: sources,
      control: item.control,
      observed: item.observed,
      missingProof: item.missingProof,
      valueCase,
      blockers,
      cautions,
    };
  })
  .sort((a, b) => b.score - a.score || b.sourceCount - a.sourceCount || a.id.localeCompare(b.id));

const eligible = scored.filter((item) => item.blockers.length === 0);
const proposed = eligible.slice(0, 25).map((item, index) => ({ ...item, proposedRank: index + 1 }));
const alternates = scored.filter((item) => !proposed.some((candidate) => candidate.id === item.id));

if (proposed.length !== 25) {
  throw new Error(`Qualification produced ${proposed.length} publishable candidates; 25 are required.`);
}

const output = {
  schemaVersion: 1,
  snapshotDate: new Date().toISOString().slice(0, 10),
  status: "PROPOSED — PRIVATE REVIEW ONLY",
  method: "Evidence readiness (30), control/activity contrast (25), official action (15), evidence-acquisition specificity (10), and marketing value (20). A direct reviewed source URL is mandatory. The score measures package readiness and market interest, not liability.",
  totals: {
    reviewed: deepSurvey.assessments.length,
    sellableLeads: scored.length,
    sourceQualified: eligible.length,
    proposed: proposed.length,
    alternates: alternates.length,
  },
  proposed,
  alternates,
};

const snapshots = resolve(root, "research/snapshots");
await mkdir(snapshots, { recursive: true });
await writeFile(resolve(root, "research/red-dot-proposed-25.json"), `${JSON.stringify(output, null, 2)}\n`);
await writeFile(resolve(snapshots, `red-dot-proposed-25-${output.snapshotDate}.json`), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Qualified ${proposed.length} proposed targets from ${scored.length} sellable leads; ${alternates.length} held as alternates.`);
