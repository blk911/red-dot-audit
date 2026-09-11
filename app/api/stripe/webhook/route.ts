import { NextResponse } from "next/server";
import { fulfillPurchase } from "@/lib/commerce/db";
import { getStripeWebhookSecret } from "@/lib/commerce/config";
import { verifyStripeSignature } from "@/lib/commerce/security";
import { stripeBuyerEmail, stripePaymentIntentId } from "@/lib/commerce/stripe";
import { deliverPurchaseEmail } from "@/lib/commerce/email";
import { getPublicSiteUrl } from "@/lib/commerce/config";

export const runtime = "edge";

export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  if (!secret || !signature || !(await verifyStripeSignature(rawBody, signature, secret))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    data: { object: Parameters<typeof stripeBuyerEmail>[0] };
  };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      const purchase = await fulfillPurchase({
        sessionId: session.id,
        buyerEmail: stripeBuyerEmail(session),
        paymentIntentId: stripePaymentIntentId(session),
      });
      await deliverPurchaseEmail({
        purchaseId: purchase.id,
        buyerEmail: purchase.buyer_email,
        tier: purchase.tier,
        jurisdiction: purchase.jurisdiction,
        accessToken: purchase.accessToken,
        accessCode: purchase.accessCode,
        accessExpiresAt: purchase.accessExpiresAt,
        siteUrl: getPublicSiteUrl(request.url),
      });
    }
  }

  return NextResponse.json({ received: true });
}
