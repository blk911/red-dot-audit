import { NextResponse } from "next/server";
import { createPendingPurchase, markCheckoutFailed, attachStripeSession, type PurchaseTier } from "@/lib/commerce/db";
import { getCommerceReadiness, getPublicSiteUrl } from "@/lib/commerce/config";
import { createCheckoutSession, isStripeConfigured } from "@/lib/commerce/stripe";
import { READY_OFFER_PRICE_CENTS } from "@/lib/commerce/db";
import { validateReadyOffer } from "@/lib/commerce/ready-offer";
import { isLaunchTarget, resolveRedDotTarget } from "@/app/red-dot-targets";
import { CHARTER_AUTOPSY_PRICE_CENTS, getCharterOfferStatus } from "@/lib/commerce/charter-offer";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tier?: string; targetQuery?: string; offer?: string; checkoutOffer?: boolean } | null;
  const tier = body?.tier as PurchaseTier | undefined;
  const targetQuery = body?.targetQuery?.trim();

  if ((tier !== "brief" && tier !== "autopsy") || !targetQuery) {
    return NextResponse.json({ error: "Select a report and enter a city or county." }, { status: 400 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Checkout is awaiting activation.", code: "stripe_not_configured" },
      { status: 503 },
    );
  }
  if (getCommerceReadiness() === "live_email_missing") {
    return NextResponse.json(
      { error: "Live checkout is paused until report-delivery email is active.", code: "delivery_not_configured" },
      { status: 503 },
    );
  }
  const catalogTarget = resolveRedDotTarget(targetQuery);
  const isGrandIsland = /^grand island(?:,)?\s+nebraska$/i.test(targetQuery);
  if (!isGrandIsland && (!catalogTarget || !isLaunchTarget(catalogTarget))) {
    return NextResponse.json(
      { error: "This monitored target is still completing final source and custodian review.", code: "target_not_released" },
      { status: 409 },
    );
  }

  let purchaseId: string | null = null;
  try {
    const readyOffer = catalogTarget ? await validateReadyOffer(body?.offer, catalogTarget.slug) : null;
    const charterOffer = tier === "autopsy" ? await getCharterOfferStatus() : null;
    const amountCents = charterOffer?.active
      ? CHARTER_AUTOPSY_PRICE_CENTS
      : readyOffer || body?.checkoutOffer === true
        ? READY_OFFER_PRICE_CENTS[tier]
        : undefined;
    const pending = await createPendingPurchase(targetQuery, tier, amountCents);
    purchaseId = pending.purchaseId;
    const session = await createCheckoutSession({
      ...pending,
      tier,
      siteUrl: getPublicSiteUrl(request.url),
      amountCents,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    await attachStripeSession(pending.purchaseId, session.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (purchaseId) await markCheckoutFailed(purchaseId).catch(() => undefined);
    console.error("Stripe checkout creation failed", error);
    return NextResponse.json({ error: "Checkout could not be opened. Please try again from RedDotAudit.com." }, { status: 502 });
  }
}
