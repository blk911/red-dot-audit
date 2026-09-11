import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const candidatesPath = resolve(root, "research/red-dot-candidates.v1.json");
const approvedPath = resolve(root, "research/red-dot-25.v1.json");
const surveyPath = resolve(root, "research/red-dot-survey-current.json");
const candidates = JSON.parse(await readFile(candidatesPath, "utf8"));
const approved = JSON.parse(await readFile(approvedPath, "utf8"));
const survey = JSON.parse(await readFile(surveyPath, "utf8"));
const errors = [];

const ids = new Set();

for (const [index, item] of candidates.entries()) {
  const at = `candidate[${index}]`;
  if (!item.id || ids.has(item.id)) errors.push(`${at}: missing or duplicate id`);
  ids.add(item.id);
  for (const key of ["place", "agency", "state", "system", "researchStatus", "publicationStatus"]) if (!item[key]) errors.push(`${at}: missing ${key}`);
  if (!Array.isArray(item.sources)) errors.push(`${at}: sources must be an array`);
  for (const [sourceIndex, source] of (item.sources || []).entries()) {
    for (const key of ["title", "publisher", "url", "sourceType", "proposition", "confidence"]) if (!source[key]) errors.push(`${at}.sources[${sourceIndex}]: missing ${key}`);
    try { new URL(source.url); } catch { errors.push(`${at}.sources[${sourceIndex}]: invalid URL`); }
  }
}

const publicSlugs = new Set();
const publicRanks = new Set();
for (const [index, item] of approved.entries()) {
  const at = `published[${index}]`;
  if (!item.slug || publicSlugs.has(item.slug)) errors.push(`${at}: missing or duplicate slug`);
  publicSlugs.add(item.slug);
  if (!Number.isInteger(item.rank) || item.rank < 1 || item.rank > 25 || publicRanks.has(item.rank)) errors.push(`${at}: rank must be unique from 1 through 25`);
  publicRanks.add(item.rank);
  for (const key of ["place", "agency", "state", "category", "status", "teaser", "control", "observed", "missingProof", "valueCase", "sourceLabel", "sourceHref"]) {
    if (!item[key]) errors.push(`${at}: missing ${key}`);
  }
  if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) errors.push(`${at}: score must be between 0 and 100`);
  if (!Array.isArray(item.evidence) || item.evidence.length !== 2 || item.evidence.some((value) => !value)) errors.push(`${at}: evidence must contain control and observed text`);
  if (!Array.isArray(item.sources) || item.sources.length < 1) errors.push(`${at}: at least one public source is required`);
  for (const [sourceIndex, source] of (item.sources || []).entries()) {
    if (!source.label) errors.push(`${at}.sources[${sourceIndex}]: missing label`);
    try { new URL(source.url); } catch { errors.push(`${at}.sources[${sourceIndex}]: invalid URL`); }
  }
}

if (approved.length !== 25) errors.push(`published inventory must contain exactly 25 targets; found ${approved.length}`);
if (approved.filter((item) => item.featured).length !== 6) errors.push("published inventory must contain exactly six featured targets");

if (survey.totals?.candidates !== 50 || survey.candidates?.length !== 50) errors.push("survey snapshot must contain exactly 50 candidates");
const surveyIds = new Set();
for (const [index, item] of (survey.candidates || []).entries()) {
  const at = `survey[${index}]`;
  if (!item.id || surveyIds.has(item.id)) errors.push(`${at}: missing or duplicate id`);
  surveyIds.add(item.id);
  for (const key of ["place", "agency", "state", "system", "authority", "observed", "status", "leadReason", "nextAction"]) if (!item[key]) errors.push(`${at}: missing ${key}`);
  if (!Array.isArray(item.sourceUrls)) errors.push(`${at}: sourceUrls must be an array`);
  for (const url of item.sourceUrls || []) try { new URL(url); } catch { errors.push(`${at}: invalid source URL`); }
  if (!Number.isFinite(item.surveyReadiness) || item.surveyReadiness < 0 || item.surveyReadiness > 74) errors.push(`${at}: invalid survey readiness`);
}

if (errors.length) {
  console.error(`Red Dot research validation failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Red Dot research validation passed: ${survey.candidates.length} surveyed leads · ${candidates.length} deep-seeded candidates · ${approved.length} publication-approved targets.`);
