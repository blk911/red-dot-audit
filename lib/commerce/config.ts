import { env } from "cloudflare:workers";

type CommerceBindings = {
  DB?: D1Database;
  PUBLIC_SITE_URL?: string;
  REPORT_TOKEN_SECRET?: string;
  STRIPE_PRICE_BRIEF?: string;
  STRIPE_PRICE_AUTOPSY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  PRIVATE_RESEARCH_EMAILS?: string;
};

const bindings = env as CommerceBindings;

export function getD1(): D1Database {
  if (!bindings.DB) throw new Error("D1 binding DB is unavailable.");
  return bindings.DB;
}

export function getStripeSecret() {
  return bindings.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret() {
  return bindings.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function getStripePriceId(tier: "brief" | "autopsy") {
  const value = tier === "brief" ? bindings.STRIPE_PRICE_BRIEF : bindings.STRIPE_PRICE_AUTOPSY;
  return value?.trim() || null;
}

export function getPublicSiteUrl(requestUrl?: string) {
  const configured = bindings.PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (requestUrl) return new URL(requestUrl).origin;
  throw new Error("PUBLIC_SITE_URL is unavailable.");
}

export function getReportTokenSecret() {
  const secret = bindings.REPORT_TOKEN_SECRET?.trim() || getStripeSecret();
  if (!secret) throw new Error("REPORT_TOKEN_SECRET is unavailable.");
  return secret;
}

export function getSendGridApiKey() {
  return bindings.SENDGRID_API_KEY?.trim() || null;
}

export function getSendGridFromEmail() {
  return bindings.SENDGRID_FROM_EMAIL?.trim() || "support@reddotaudit.com";
}

export type CommerceReadiness =
  | "sandbox"
  | "live"
  | "live_email_missing"
  | "unconfigured";

export function getCommerceReadiness(): CommerceReadiness {
  const secret = getStripeSecret();
  if (!secret) return "unconfigured";
  if (secret.startsWith("sk_live_") || secret.startsWith("rk_live_")) {
    return getSendGridApiKey() ? "live" : "live_email_missing";
  }
  return "sandbox";
}

export function getPrivateResearchEmails() {
  return (bindings.PRIVATE_RESEARCH_EMAILS || "blk911@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
