import { getStripeSecret } from "./config";
import { TIER_PRICE_CENTS, type PurchaseTier } from "./db";

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  customer_details?: { email?: string | null } | null;
  customer_email?: string | null;
  metadata?: Record<string, string>;
};

async function stripeRequest(path: string, init: RequestInit = {}) {
  const secret = getStripeSecret();
  if (!secret) throw new Error("Stripe is not configured.");

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, ...init.headers },
  });
  const data = (await response.json()) as StripeCheckoutSession & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || "Stripe request failed.");
  return data;
}

export async function createCheckoutSession(input: {
  purchaseId: string;
  matterId: string;
  tier: PurchaseTier;
  jurisdiction: string;
  siteUrl: string;
  amountCents?: number;
}) {
  const params = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.purchaseId,
    success_url: `${input.siteUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.siteUrl}/?checkout=cancelled`,
    "metadata[purchase_id]": input.purchaseId,
    "metadata[matter_id]": input.matterId,
    "metadata[tier]": input.tier,
    "metadata[jurisdiction]": input.jurisdiction,
  });

  const amountCents = input.amountCents ?? TIER_PRICE_CENTS[input.tier];
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  params.set(
    "line_items[0][price_data][product_data][name]",
    input.tier === "brief" ? "Red Dot Evidence Brief" : "Red Dot Full Autopsy",
  );
  params.set(
    "line_items[0][price_data][product_data][description]",
    `Public-record intelligence for ${input.jurisdiction}`,
  );
  params.set("line_items[0][quantity]", "1");

  return stripeRequest("/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
}

export function retrieveCheckoutSession(sessionId: string) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export function stripeBuyerEmail(session: StripeCheckoutSession) {
  return session.customer_details?.email || session.customer_email || null;
}

export function stripePaymentIntentId(session: StripeCheckoutSession) {
  return typeof session.payment_intent === "string" ? session.payment_intent : null;
}

export function isStripeConfigured() {
  return Boolean(getStripeSecret());
}
