import { NextResponse } from "next/server";
import { resolveRedDotTarget } from "@/app/red-dot-targets";
import { getPublicSiteUrl } from "@/lib/commerce/config";
import { createPendingPurchase, markCheckoutFailed, attachStripeSession, type PurchaseTier } from "@/lib/commerce/db";
import { createCheckoutSession, isStripeConfigured } from "@/lib/commerce/stripe";
import { READY_OFFER_PRICE_CENTS } from "@/lib/commerce/db";
import { validateReadyOffer } from "@/lib/commerce/ready-offer";
import { CHARTER_AUTOPSY_PRICE_CENTS, getCharterOfferStatus } from "@/lib/commerce/charter-offer";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tier = url.searchParams.get("tier") as PurchaseTier | null;
  const requestedTarget = url.searchParams.get("target")?.trim() || "";
  const catalogTarget = resolveRedDotTarget(requestedTarget);
  const isSpecimen = requestedTarget.toLowerCase().includes("grand island");

  if ((tier !== "brief" && tier !== "autopsy") || (!catalogTarget && !isSpecimen)) {
    return NextResponse.redirect(`${getPublicSiteUrl(request.url)}/?checkout=invalid`, 303);
  }
  if (!isStripeConfigured()) {
    return NextResponse.redirect(`${getPublicSiteUrl(request.url)}/?checkout=unavailable`, 303);
  }

  const jurisdiction = catalogTarget?.place || "Grand Island, Nebraska";
  let purchaseId: string | null = null;
  try {
    const readyOffer = catalogTarget ? await validateReadyOffer(url.searchParams.get("offer"), catalogTarget.slug) : null;
    const charterOffer = tier === "autopsy" ? await getCharterOfferStatus() : null;
    const amountCents = charterOffer?.active
      ? CHARTER_AUTOPSY_PRICE_CENTS
      : readyOffer || url.searchParams.get("checkout_offer") === "1"
        ? READY_OFFER_PRICE_CENTS[tier]
        : undefined;
    const pending = await createPendingPurchase(jurisdiction, tier, amountCents);
    purchaseId = pending.purchaseId;
    const session = await createCheckoutSession({
      ...pending,
      tier,
      siteUrl: getPublicSiteUrl(request.url),
      amountCents,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    await attachStripeSession(pending.purchaseId, session.id);
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    if (purchaseId) await markCheckoutFailed(purchaseId).catch(() => undefined);
    console.error("Stripe checkout launch failed", error);
    return NextResponse.redirect(`${getPublicSiteUrl(request.url)}/?checkout=failed`, 303);
  }
}
