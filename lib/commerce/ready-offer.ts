import { getReportTokenSecret } from "./config";
import { hashReportToken } from "./security";

const encoder = new TextEncoder();

function base64Url(value: string) {
  let binary = "";
  for (const byte of encoder.encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function signature(payload: string) {
  const secret = getReportTokenSecret();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(String.fromCharCode(...new Uint8Array(signed)));
}

export async function createReadyOffer(targetSlug: string) {
  const payload = base64Url(JSON.stringify({ targetSlug, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }));
  return `${payload}.${await signature(payload)}`;
}

export async function validateReadyOffer(token: string | null | undefined, targetSlug?: string) {
  if (!token || token.length > 1200) return null;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied || (await hashReportToken(supplied)) !== (await hashReportToken(await signature(payload)))) return null;
  try {
    const data = JSON.parse(decodeBase64Url(payload)) as { targetSlug?: string; expiresAt?: number };
    if (!data.targetSlug || !data.expiresAt || data.expiresAt <= Date.now()) return null;
    if (targetSlug && data.targetSlug !== targetSlug) return null;
    return { targetSlug: data.targetSlug, expiresAt: new Date(data.expiresAt).toISOString() };
  } catch { return null; }
}
