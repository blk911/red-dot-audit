import { resolveRedDotTarget } from "@/app/red-dot-targets";

export type OfficialContact = { name: string; title: string; organization: string; email: string; phone: string; sourceUrl: string; status: "VERIFIED" | "NOT_FOUND" };

function decode(value: string) { return value.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }
function plainText(html: string) { return decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim(); }
function officialDomain(url: string) { try { const host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); return host.endsWith(".gov") ? host : ""; } catch { return ""; } }

export function parseSearchResults(xml: string) {
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi) || []).map((block) => decode(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() || "")).filter(Boolean);
}

export function extractOfficialContact(html: string, sourceUrl: string, proposedName = "", proposedAddress = ""): OfficialContact | null {
  const domain = officialDomain(sourceUrl); if (!domain) return null;
  const text = plainText(html);
  const emails = [...new Set((`${html} ${text}`.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((email) => email.toLowerCase()))];
  const proposedEmail = proposedAddress.trim().toLowerCase();
  const email = emails.find((value) => value === proposedEmail) || emails.find((value) => value.endsWith(`@${domain}`) && /attorney|clerk|records|police|pio|communications/.test(value)) || emails.find((value) => value.endsWith(`@${domain}`)) || "";
  if (!email) return null;
  const index = text.toLowerCase().indexOf(email); const nearby = text.slice(Math.max(0, index - 280), Math.min(text.length, index + 280));
  const phone = nearby.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] || "";
  const title = /city attorney/i.test(nearby) ? "City Attorney's Office" : /city clerk/i.test(nearby) ? "City Clerk's Office" : /public records|records request/i.test(nearby) ? "Public Records" : "Official government contact";
  const name = proposedName && nearby.toLowerCase().includes(proposedName.toLowerCase()) ? proposedName : title;
  return { name, title, organization: domain, email, phone, sourceUrl, status: "VERIFIED" };
}

export async function verifyOfficialContactUrl(sourceUrl: string, proposedName: string, proposedAddress: string) {
  if (!officialDomain(sourceUrl)) return null;
  try {
    const response = await fetch(sourceUrl, { headers: { "User-Agent": "RedDotAudit-ContactVerifier/1.0", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!response.ok || !String(response.headers.get("content-type") || "").includes("text/html")) return null;
    const contact = extractOfficialContact((await response.text()).slice(0, 1_000_000), response.url || sourceUrl, proposedName, proposedAddress);
    return contact?.email.toLowerCase() === proposedAddress.toLowerCase() ? contact : null;
  } catch { return null; }
}

export async function discoverOfficialContact(jurisdiction: string, proposedName = "", proposedAddress = ""): Promise<OfficialContact> {
  const target = resolveRedDotTarget(jurisdiction);
  const seedUrls = [target?.sourceHref, ...(target?.sources || []).map((source) => source.url)].filter((value): value is string => Boolean(value));
  const domains = [...new Set(seedUrls.map(officialDomain).filter(Boolean))];
  const proposedDomain = proposedAddress.includes("@") ? proposedAddress.split("@").pop()!.toLowerCase() : "";
  if (proposedDomain.endsWith(".gov")) domains.unshift(proposedDomain);
  const domain = domains[0];
  if (!domain) return { name: proposedName, title: "", organization: "", email: proposedAddress, phone: "", sourceUrl: "", status: "NOT_FOUND" };
  const query = proposedAddress.includes("@") ? `\"${proposedAddress}\"` : `site:${domain} \"${jurisdiction.replace(/,.*$/, "")}\" (\"city attorney\" OR \"city clerk\" OR \"public records\") (email OR contact)`;
  const searchUrl = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const found = await fetch(searchUrl, { headers: { "User-Agent": "RedDotAudit-ContactVerifier/1.0", Accept: "application/rss+xml,text/xml" }, signal: AbortSignal.timeout(10_000) }).then(async (response) => response.ok ? parseSearchResults((await response.text()).slice(0, 500_000)) : []).catch(() => []);
  const candidates = [...new Set([...seedUrls, ...found])].filter((url) => officialDomain(url) === domain).slice(0, 8);
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "RedDotAudit-ContactVerifier/1.0", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
      if (!response.ok || !String(response.headers.get("content-type") || "").includes("text/html")) continue;
      const contact = extractOfficialContact((await response.text()).slice(0, 1_000_000), response.url || url, proposedName, proposedAddress);
      if (contact) return contact;
    } catch (error) { console.error("Official contact candidate failed", url, error); }
  }
  return { name: proposedName, title: "", organization: domain, email: proposedAddress, phone: "", sourceUrl: "", status: "NOT_FOUND" };
}
