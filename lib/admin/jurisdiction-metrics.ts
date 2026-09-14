import { getD1 } from "@/lib/commerce/config";

export type MetricFact = { key: string; value: string; label: string; excerpt?: string; sourceDate?: string; confidence?: "HIGH" | "MEDIUM" };

const definitions: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: "cameras_identified", label: "CAMERAS IDENTIFIED", patterns: [/\b([\d,]+\+?)\s+(?:fixed\s+|mobile\s+|flock\s+|alpr\s+|license plate reader\s+){0,3}cameras?\b/i, /\b([\d,]+\+?)\s+(?:automatic|automated) license plate readers?\b/i, /\b(?:operat(?:e|es|ing)|deploy(?:ed|s|ment of)|install(?:ed|s|ation of)|uses?|has)\s+(?:approximately\s+|about\s+|more than\s+|over\s+)?([\d,]+\+?)\s+(?:flock\s+|alpr\s+)?(?:cameras?|readers?|devices?)\b/i] },
  { key: "detections_30_days", label: "DETECTIONS / 30 DAYS", patterns: [/\b([\d,.]+\s*(?:million|billion)?\+?)\s+(?:plate\s+)?(?:detections|reads|images|captures|vehicles scanned)\s+(?:per|a|each|in the last)\s+(?:30 days|month)\b/i, /\b(?:recorded|captured|scanned|generated)\s+([\d,.]+\s*(?:million|billion)?\+?)\s+(?:plate\s+)?(?:detections|reads|images|vehicles)\b/i] },
  { key: "searches_reported", label: "SEARCHES / INQUIRIES", patterns: [/\b([\d,]+\+?)\s+(?:immigration-related\s+|vehicle\s+|plate\s+)?(?:searches|queries|inquiries)\b/i, /\b(?:searched|queried)\s+(?:the\s+)?(?:system|database)\s+([\d,]+\+?)\s+times\b/i, /\b(?:conducted|performed|ran|made)\s+(?:approximately\s+|about\s+|more than\s+|over\s+)?([\d,]+\+?)\s+(?:searches|queries|inquiries)\b/i] },
  { key: "outside_organizations", label: "AGENCIES WITH ACCESS", patterns: [/\b([\d,]+\+?)\s+(?:outside|external|other|federal|law enforcement)\s+(?:agencies|organizations|departments)\b/i, /\b(?:shared|sharing|accessible)\s+(?:data\s+)?with\s+(?:approximately\s+|about\s+|more than\s+|over\s+)?([\d,]+\+?)\s+(?:agencies|organizations|departments|partners)\b/i, /\baccess\s+(?:to|from|with)\s+([\d,]+\+?)\s+(?:agencies|organizations|departments)\b/i] },
  { key: "authorized_users", label: "AUTHORIZED USERS", patterns: [/\b([\d,]+\+?)\s+(?:authorized|approved|sworn)\s+(?:users|officers|personnel|employees)\b/i, /\baccess (?:was |is )?(?:provided|granted) to\s+([\d,]+\+?)\s+(?:users|officers|personnel|employees)\b/i] },
  { key: "retention_days", label: "RETENTION / DAYS", patterns: [/\b(?:retain(?:ed|s|ing)?|retention(?: period)?(?: of)?)\s+(?:the data |images |records )?(?:for )?([\d,]+)\s+days?\b/i, /\b([\d,]+)\s*[- ]day\s+retention\b/i] },
  { key: "alerts_reported", label: "ALERTS / HITS", patterns: [/\b([\d,]+\+?)\s+(?:hotlist\s+)?(?:alerts|hits|matches)\b/i] },
  { key: "annual_cost", label: "ANNUAL COST", patterns: [/\$\s*([\d,.]+\s*(?:million|thousand)?\+?)\s+(?:per year|annually|annual)/i] },
];

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function extractJurisdictionMetrics(text: string): MetricFact[] {
  const facts: MetricFact[] = [];
  for (const definition of definitions) {
    const match = definition.patterns.map((pattern) => text.match(pattern)).find(Boolean);
    if (match?.[1]) { const start = Math.max(0, (match.index || 0) - 160); const end = Math.min(text.length, (match.index || 0) + match[0].length + 160); facts.push({ key: definition.key, value: match[1].replace(/\s+/g, " "), label: definition.label, excerpt: text.slice(start, end).replace(/\s+/g, " ").trim(), confidence: "HIGH" }); }
  }
  return facts;
}

// A bare jurisdiction string is not a stable identity: two different
// agencies (city PD, county sheriff, a second department entirely) can
// share the same city name, and without a candidate id their metrics would
// silently overwrite each other under the old (normalizedJurisdiction,
// metricKey) uniqueness. `censusId` — the admin_census_deployments row this
// metric was acquired for — is the real identity. When no census candidate
// is bound (canonical/seed jurisdictions, or callers that predate the
// census-driven pipeline), the normalized jurisdiction string is used as a
// fallback identity, preserving the old one-row-per-jurisdiction behavior
// for exactly those callers instead of silently going unbounded.
//
// A fallback-keyed row (census_id = its own normalized_jurisdiction — the
// tell that migration 0014's backfill or an uncensused caller wrote it, not
// a real candidate) is a *different* key from a real census_id, so once a
// jurisdiction is later re-acquired with its real identity the two rows
// don't collide on ON CONFLICT — the old one would otherwise sit there
// forever as an orphaned duplicate. Retiring it here, in the same write,
// is what makes migrated data self-heal as jurisdictions get reprocessed
// rather than needing a one-off cleanup script (which would also miss
// anything acquired after this ships).
export async function saveJurisdictionMetrics(jurisdiction: string, sourceUrl: string, facts: MetricFact[], verifiedAt = new Date().toISOString(), censusId?: string | null) {
  if (!facts.length || !jurisdiction || !sourceUrl) return 0;
  const db = getD1(); const key = normalized(jurisdiction); const now = new Date().toISOString(); const identity = censusId || key;
  const statements = facts.flatMap((fact) => {
    const insert = db.prepare("INSERT INTO admin_jurisdiction_metrics (id,normalized_jurisdiction,jurisdiction,metric_key,value,label,source_url,source_date,excerpt,confidence,verification_status,verified_at,created_at,updated_at,census_id) VALUES (?,?,?,?,?,?,?,?,?,?,'SOURCE_VERIFIED',?,?,?,?) ON CONFLICT(census_id,metric_key) DO UPDATE SET value=excluded.value,label=excluded.label,source_url=excluded.source_url,source_date=excluded.source_date,excerpt=excluded.excerpt,confidence=excluded.confidence,verification_status='SOURCE_VERIFIED',verified_at=excluded.verified_at,updated_at=excluded.updated_at,normalized_jurisdiction=excluded.normalized_jurisdiction,jurisdiction=excluded.jurisdiction").bind(crypto.randomUUID(), key, jurisdiction, fact.key, fact.value, fact.label, sourceUrl, fact.sourceDate || null, fact.excerpt || null, fact.confidence || "HIGH", verifiedAt, now, now, identity);
    if (!censusId) return [insert];
    const retireStaleFallback = db.prepare("DELETE FROM admin_jurisdiction_metrics WHERE normalized_jurisdiction=? AND metric_key=? AND census_id=?").bind(key, fact.key, key);
    return [retireStaleFallback, insert];
  });
  await db.batch(statements);
  return facts.length;
}
