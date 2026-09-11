import catalog from "../research/red-dot-25.v1.json";

export type RedDotTarget = {
  slug: string;
  place: string;
  agency: string;
  state: string;
  category: "ACCESS" | "SHARING" | "AUDIT" | "OVERSIGHT" | "LEGAL";
  status: "NEW" | "RISING" | "DOCUMENT ADDED" | "OFFICIAL RESPONSE" | "RECONCILED" | "REMOVED" | "REPORT AVAILABLE";
  teaser: string;
  evidence: [string, string];
  sourceLabel: string;
  sourceHref: string;
  featured?: boolean;
  rank: number;
  score: number;
  evidenceDate?: string;
  control: string;
  observed: string;
  missingProof: string;
  valueCase: string;
  cautions: string[];
  sources: Array<{ label: string; url: string }>;
  publicMetrics?: Array<{ value: string; label: string }>;
};

const evidenceDates: Record<string, string> = {
  "pflugerville-tx": "2026-09-01",
  "denver-co": "2025-08-11",
  "san-francisco-ca": "2026-01-20",
  "ventura-county-ca": "2026-02-27",
  "eugene-or": "2025-12-16",
  "windsor-ct": "2026-02-19",
  "lufkin-tx": "2026-08-24",
  "westchester-county-ny": "2026-06-09",
  "johnson-county-tx": "2025-10-01",
  "renton-wa": "2025-06-23",
  "syracuse-ny": "2025-09-11",
  "el-cajon-ca": "2026-01-21",
  "mountain-view-ca": "2026-01-30",
  "los-angeles-ca": "2026-07-11",
  "new-bedford-ma": "2026-06-01",
  "jackson-county-in": "2026-08-31",
  "boulder-co": "2025-08-19",
  "cambridge-ma": "2025-12-01",
  "milwaukee-wi": "2026-07-21",
  "brevard-county-fl": "2026-08-28",
  "highland-heights-oh": "2026-08-21",
  "katy-tx": "2026-08-25",
  "sumter-county-fl": "2026-07-23",
  "hall-county-ga": "2026-09-02",
  "west-chicago-il": "2026-08-31",
};

export const redDotTargets = (catalog as unknown as RedDotTarget[]).map(
  (target) => ({
    ...target,
    evidenceDate: target.evidenceDate || evidenceDates[target.slug],
  }),
);

// v1.0 release cohort: these jurisdictions receive final source and routing QA
// before the remainder of the editorial catalog is promoted for purchase.
const launchTargetSlugs = new Set([
  "pflugerville-tx",
  "lufkin-tx",
  "johnson-county-tx",
  "denver-co",
  "ventura-county-ca",
  "los-angeles-ca",
  "syracuse-ny",
  "renton-wa",
  "new-bedford-ma",
  "hall-county-ga",
  "norfolk-va",
]);

export function isLaunchTarget(target: RedDotTarget) {
  return launchTargetSlugs.has(target.slug);
}

export const releaseReadyTargets = redDotTargets.filter(isLaunchTarget);

export function resolveRedDotTarget(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return redDotTargets.find((target) => {
    const place = target.place.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return normalized === place || normalized.includes(place) || normalized === target.slug.replace(/-/g, " ");
  }) || null;
}
