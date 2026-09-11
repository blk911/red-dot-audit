export type OutreachState = "RESEARCHED" | "QUALIFIED" | "APPROVED" | "QUEUED" | "SENT" | "DELIVERED" | "OPENED" | "CLICKED" | "RED_DOT_VIEWED" | "ENGAGED" | "REPLIED" | "REFERRED" | "CONVERTED" | "STOPPED";
export type OutreachEventType = "DELIVERED" | "OPENED" | "CLICKED" | "RED_DOT_VIEWED" | "REPLIED" | "REFERRED" | "CONVERTED" | "BOUNCED" | "UNSUBSCRIBED";
export type FollowUpMode = "NONE" | "NEVER_OPENED" | "OPENED_NO_CLICK" | "CLICKED_NO_ACTION";

export type OutreachEvent = { id: string; outreachId: string; targetId: string; type: OutreachEventType; at: string; metadata?: Record<string, unknown> };
export type RadarEndpoint = { id: string; status: "ACTIVE" | "RESERVE" | "CHALLENGED" | "RETIRED"; pulls: number; changes: number; relevantChanges: number; researchEscalations: number; caseContributions: number; publishableEvents: number; yieldScore: number };

export function chooseFollowUpMode(events: OutreachEvent[]): FollowUpMode {
  const types = new Set(events.map((event) => event.type));
  if (["REPLIED", "REFERRED", "CONVERTED", "UNSUBSCRIBED"].some((type) => types.has(type as OutreachEventType))) return "NONE";
  if (types.has("CLICKED") || types.has("RED_DOT_VIEWED")) return "CLICKED_NO_ACTION";
  if (types.has("OPENED")) return "OPENED_NO_CLICK";
  return "NEVER_OPENED";
}

export function scoreRadarEndpoint(endpoint: RadarEndpoint) {
  if (endpoint.pulls <= 0) return 0;
  const value = endpoint.relevantChanges + endpoint.researchEscalations * 3 + endpoint.caseContributions * 8 + endpoint.publishableEvents * 13;
  return Math.max(0, (value - Math.max(0, endpoint.pulls - endpoint.changes) * 0.02) / endpoint.pulls);
}

export function planRadarRotation(endpoints: RadarEndpoint[], minPulls = 30, pruneFraction = 0.15) {
  const scored = endpoints.map((endpoint) => ({ ...endpoint, yieldScore: scoreRadarEndpoint(endpoint) })).sort((a, b) => b.yieldScore - a.yieldScore);
  const eligible = scored.filter((endpoint) => endpoint.status === "ACTIVE" && endpoint.pulls >= minPulls);
  const count = Math.floor(eligible.length * Math.min(0.5, Math.max(0.01, pruneFraction)));
  const challenged = new Set(eligible.slice(Math.max(0, eligible.length - count)).map((endpoint) => endpoint.id));
  return { keep: scored.filter((endpoint) => !challenged.has(endpoint.id)), challenge: scored.filter((endpoint) => challenged.has(endpoint.id)) };
}

export async function fingerprintThinContent(input: string) {
  const data = new TextEncoder().encode(input.replace(/\s+/g, " ").trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
