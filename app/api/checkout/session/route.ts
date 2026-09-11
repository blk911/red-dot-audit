import { NextResponse } from "next/server";
import { fulfillPurchase } from "@/lib/commerce/db";
import { retrieveCheckoutSession, stripeBuyerEmail, stripePaymentIntentId } from "@/lib/commerce/stripe";
import { deliverPurchaseEmail } from "@/lib/commerce/email";
import { getPublicSiteUrl } from "@/lib/commerce/config";

export const runtime = "edge";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim();
  if (!sessionId) return NextResponse.json({ error: "Missing checkout session." }, { status: 400 });

  try {
    const session = await retrieveCheckoutSession(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ status: "processing" }, { status: 202 });
    }
    const purchase = await fulfillPurchase({
      sessionId,
      buyerEmail: stripeBuyerEmail(session),
      paymentIntentId: stripePaymentIntentId(session),
    });
    const delivery = await deliverPurchaseEmail({
      purchaseId: purchase.id,
      buyerEmail: purchase.buyer_email,
      tier: purchase.tier,
      jurisdiction: purchase.jurisdiction,
      accessToken: purchase.accessToken,
      accessCode: purchase.accessCode,
      accessExpiresAt: purchase.accessExpiresAt,
      siteUrl: getPublicSiteUrl(request.url),
    });
    return NextResponse.json({
      status: "ready",
      tier: purchase.tier,
      jurisdiction: purchase.jurisdiction,
      accessUrl: `/report/${purchase.accessToken}`,
      accessCode: purchase.accessCode,
      accessExpiresAt: purchase.accessExpiresAt,
      emailDelivery: delivery.status,
    });
  } catch (error) {
    console.error("Checkout verification failed", error);
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 502 });
  }
}
