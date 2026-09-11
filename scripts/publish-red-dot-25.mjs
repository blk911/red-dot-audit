import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const proposal = JSON.parse(await readFile(resolve(root, "research/red-dot-proposed-25.json"), "utf8"));
const survey = JSON.parse(await readFile(resolve(root, "research/red-dot-survey-current.json"), "utf8"));
const byId = new Map(survey.candidates.map((item) => [item.id, item]));

function category(text) {
  if (/court|attorney general|complaint|constitutional|lawsuit/i.test(text)) return "LEGAL";
  if (/sharing|federal|nationwide|organizations|agencies/i.test(text)) return "SHARING";
  if (/audit|fired|resigned|charged|indicted/i.test(text)) return "AUDIT";
  return "ACCESS";
}

function status(text) {
  if (/terminated|ended the contract|ended Flock|cut off|disabled|suspended|voted.*turn off/i.test(text)) return "OFFICIAL RESPONSE";
  if (/attorney general|complaint|court|lawsuit/i.test(text)) return "DOCUMENT ADDED";
  if (/charged|indicted|arrested|fired|resigned/i.test(text)) return "RISING";
  return "REPORT AVAILABLE";
}

const targets = proposal.proposed.map((item) => {
  const seed = byId.get(item.id);
  if (!seed) throw new Error(`Missing survey identity for ${item.id}`);
  const sourceHref = item.sourceUrls[0];
  return {
    slug: item.id,
    place: seed.place,
    agency: seed.agency,
    state: seed.state,
    category: category(`${item.control} ${item.observed}`),
    status: status(item.observed),
    teaser: item.observed,
    evidence: [item.control, item.observed],
    sourceLabel: new URL(sourceHref).hostname.replace(/^www\./, ""),
    sourceHref,
    featured: item.proposedRank <= 6,
    rank: item.proposedRank,
    score: item.score,
    evidenceDate: item.evidenceDate || "",
    control: item.control,
    observed: item.observed,
    missingProof: item.missingProof,
    valueCase: item.valueCase,
    cautions: item.cautions,
    sources: item.sourceUrls.map((url) => ({ label: new URL(url).hostname.replace(/^www\./, ""), url })),
  };
});

if (targets.length !== 25 || new Set(targets.map((item) => item.slug)).size !== 25) {
  throw new Error("Published Red Dot inventory must contain 25 unique targets.");
}

await writeFile(resolve(root, "research/red-dot-25.v1.json"), `${JSON.stringify(targets, null, 2)}\n`);
console.log(`Published ${targets.length} card records from the approved private slate.`);
