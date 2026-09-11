import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sourceText = await readFile(resolve(root, "app/red-dot-targets.ts"), "utf8");
const production = JSON.parse(await readFile(resolve(root, "research/red-dot-candidates.v1.json"), "utf8"));
const extras = JSON.parse(await readFile(resolve(root, "research/survey-extra-seeds.v1.json"), "utf8"));
const productionById = new Map(production.map((item) => [item.id, item]));
const publicSeeds = [];
const targetPattern = /slug:\s*"([^"]+)"[\s\S]*?place:\s*"([^"]+)"[\s\S]*?agency:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"[\s\S]*?teaser:\s*"([^"]+)"[\s\S]*?sourceHref:\s*"([^"]+)"/g;

for (const match of sourceText.matchAll(targetPattern)) {
  publicSeeds.push({ id: match[1], place: match[2], agency: match[3], state: match[4], leadReason: match[5], sourceUrls: [match[6]] });
}

if (publicSeeds.length !== 25) throw new Error(`Expected 25 public seed targets; parsed ${publicSeeds.length}.`);
if (extras.length !== 25) throw new Error(`Expected 25 additional survey targets; found ${extras.length}.`);

const seen = new Set();
const candidates = [...publicSeeds, ...extras].map((seed, index) => {
  if (seen.has(seed.id)) throw new Error(`Duplicate candidate id: ${seed.id}`);
  seen.add(seed.id);
  const enriched = productionById.get(seed.id);
  const richSources = enriched?.sources || [];
  const sourceUrls = [...new Set([...(seed.sourceUrls || []), ...richSources.map((source) => source.url)])];
  const hasPrimary = richSources.some((source) => ["official", "statute", "court"].includes(source.sourceType));
  const observed = Boolean(seed.leadReason);
  const sourceCount = sourceUrls.length;
  const readiness = Math.min(74, 8 + sourceCount * 9 + (hasPrimary ? 18 : 0) + (observed ? 14 : 0));
  const status = sourceCount >= 3 && hasPrimary ? "DEEP REVIEW" : sourceCount > 0 ? "SURVEYED" : "NO RESULT";
  return {
    rank: index + 1,
    id: seed.id,
    place: seed.place,
    agency: seed.agency,
    state: seed.state,
    system: enriched?.system || "Flock Safety / ALPR — verification pending",
    sourceCount,
    sourceUrls,
    authority: hasPrimary ? "FOUND" : "NOT YET",
    observed: observed ? "SIGNAL" : "NO RESULT",
    surveyReadiness: readiness,
    status,
    leadReason: seed.leadReason || "No substantive public signal captured in this survey pass.",
    nextAction: status === "DEEP REVIEW" ? "Extract controls, metrics, discrepancies and request routes." : "Locate an official policy, contract, audit, court record or transparency export.",
  };
});

const snapshot = {
  schemaVersion: 1,
  snapshotDate: new Date().toISOString().slice(0, 10),
  disclaimer: "Private research inventory. Survey readiness is not a Red Dot score or finding of wrongdoing.",
  totals: {
    candidates: candidates.length,
    deepReview: candidates.filter((item) => item.status === "DEEP REVIEW").length,
    surveyed: candidates.filter((item) => item.status === "SURVEYED").length,
    noResult: candidates.filter((item) => item.status === "NO RESULT").length,
  },
  candidates,
};

const snapshotDirectory = resolve(root, "research/snapshots");
await mkdir(snapshotDirectory, { recursive: true });
const datedPath = resolve(snapshotDirectory, `red-dot-survey-${snapshot.snapshotDate}.json`);
const currentPath = resolve(root, "research/red-dot-survey-current.json");
await writeFile(datedPath, `${JSON.stringify(snapshot, null, 2)}\n`);
await writeFile(currentPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Built ${snapshot.snapshotDate} survey: ${snapshot.totals.candidates} candidates · ${snapshot.totals.deepReview} deep review · ${snapshot.totals.surveyed} surveyed · ${snapshot.totals.noResult} no result.`);
