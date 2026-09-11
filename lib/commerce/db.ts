import { getD1, getReportTokenSecret } from "./config";
import { deriveAccessCode, deriveReportToken, hashReportToken } from "./security";

export type PurchaseTier = "brief" | "autopsy";

export const TIER_PRICE_CENTS: Record<PurchaseTier, number> = {
  brief: 19_500,
  autopsy: 39_500,
};

export const READY_OFFER_PRICE_CENTS: Record<PurchaseTier, number> = {
  brief: 17_500,
  autopsy: 32_000,
};

type PurchaseRow = {
  id: string;
  matter_id: string;
  target_query: string;
  jurisdiction: string;
  tier: PurchaseTier;
  amount_cents: number;
  status: string;
  buyer_email: string | null;
  stripe_session_id: string | null;
  access_code_hash: string | null;
  access_expires_at: string | null;
  email_delivery_status: string;
};

const PURCHASE_SELECT = `
  SELECT p.id, p.matter_id, m.target_query, m.jurisdiction, p.tier,
         p.amount_cents, p.status, p.buyer_email, p.stripe_session_id,
         p.access_code_hash, p.access_expires_at, p.email_delivery_status
  FROM purchases p
  INNER JOIN matters m ON m.id = p.matter_id
`;

export async function createPendingPurchase(targetQuery: string, tier: PurchaseTier, amountCents = TIER_PRICE_CENTS[tier]) {
  const db = getD1();
  const matterId = crypto.randomUUID();
  const purchaseId = crypto.randomUUID();
  const jurisdiction = targetQuery.trim();

  await db.batch([
    db.prepare(
      `INSERT INTO matters (id, target_query, jurisdiction, status)
       VALUES (?, ?, ?, 'checkout_pending')`,
    ).bind(matterId, jurisdiction, jurisdiction),
    db.prepare(
      `INSERT INTO purchases (id, matter_id, tier, amount_cents, status)
       VALUES (?, ?, ?, ?, 'pending')`,
    ).bind(purchaseId, matterId, tier, amountCents),
  ]);

  return { matterId, purchaseId, jurisdiction };
}

export async function attachStripeSession(purchaseId: string, sessionId: string) {
  await getD1()
    .prepare("UPDATE purchases SET stripe_session_id = ? WHERE id = ? AND status = 'pending'")
    .bind(sessionId, purchaseId)
    .run();
}

export async function markCheckoutFailed(purchaseId: string) {
  await getD1()
    .prepare("UPDATE purchases SET status = 'checkout_failed' WHERE id = ? AND status = 'pending'")
    .bind(purchaseId)
    .run();
}

export async function findPurchaseBySession(sessionId: string) {
  return getD1()
    .prepare(`${PURCHASE_SELECT} WHERE p.stripe_session_id = ? LIMIT 1`)
    .bind(sessionId)
    .first<PurchaseRow>();
}

export async function fulfillPurchase(input: {
  sessionId: string;
  buyerEmail: string | null;
  paymentIntentId: string | null;
}) {
  const purchase = await findPurchaseBySession(input.sessionId);
  if (!purchase) throw new Error("Purchase not found for Stripe session.");

  const accessToken = await deriveReportToken(purchase.id, getReportTokenSecret());
  const accessCode = await deriveAccessCode(purchase.id, getReportTokenSecret());
  if (purchase.status === "paid" && purchase.access_expires_at) {
    if (!purchase.access_code_hash) {
      await getD1()
        .prepare("UPDATE purchases SET access_code_hash = ? WHERE id = ? AND access_code_hash IS NULL")
        .bind(await hashReportToken(accessCode), purchase.id)
        .run();
    }
    return { ...purchase, accessToken, accessCode, accessExpiresAt: purchase.access_expires_at, newlyPaid: false };
  }
  const accessTokenHash = await hashReportToken(accessToken);
  const accessCodeHash = await hashReportToken(accessCode);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const paidAt = new Date().toISOString();

  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE purchases
         SET status = 'paid', buyer_email = COALESCE(?, buyer_email),
             stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
             access_token_hash = ?, access_code_hash = ?, access_expires_at = ?, paid_at = COALESCE(paid_at, ?)
         WHERE id = ?`,
      )
      .bind(input.buyerEmail, input.paymentIntentId, accessTokenHash, accessCodeHash, expiresAt, paidAt, purchase.id),
    getD1()
      .prepare("UPDATE matters SET status = 'report_ready', updated_at = ? WHERE id = ?")
      .bind(paidAt, purchase.matter_id),
  ]);

  return { ...purchase, buyer_email: input.buyerEmail || purchase.buyer_email, status: "paid", accessToken, accessCode, accessExpiresAt: expiresAt, newlyPaid: true };
}

export async function findPurchaseByAccessToken(token: string) {
  const tokenHash = await hashReportToken(token);
  return getD1()
    .prepare(
      `${PURCHASE_SELECT}
       WHERE p.access_token_hash = ? AND p.status = 'paid'
         AND p.access_expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<PurchaseRow>();
}

export async function findPurchaseByAccessCode(code: string) {
  const normalized = code.trim().toUpperCase();
  const codeHash = await hashReportToken(normalized);
  const purchase = await getD1()
    .prepare(
      `${PURCHASE_SELECT}
       WHERE p.access_code_hash = ? AND p.status = 'paid'
         AND p.access_expires_at > ?
       LIMIT 1`,
    )
    .bind(codeHash, new Date().toISOString())
    .first<PurchaseRow>();
  if (!purchase) return null;
  const accessToken = await deriveReportToken(purchase.id, getReportTokenSecret());
  return { ...purchase, accessToken };
}

export async function claimPurchaseEmailDelivery(purchaseId: string) {
  const result = await getD1()
    .prepare(
      `UPDATE purchases SET email_delivery_status = 'sending'
       WHERE id = ? AND status = 'paid' AND buyer_email IS NOT NULL
         AND email_delivery_status IN ('pending', 'failed')`,
    )
    .bind(purchaseId)
    .run();
  return Number(result.meta?.changes || 0) > 0;
}

export async function markPurchaseEmailDelivered(purchaseId: string) {
  await getD1()
    .prepare("UPDATE purchases SET email_delivery_status = 'sent', email_delivered_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), purchaseId)
    .run();
}

export async function markPurchaseEmailFailed(purchaseId: string) {
  await getD1()
    .prepare("UPDATE purchases SET email_delivery_status = 'failed' WHERE id = ? AND email_delivery_status = 'sending'")
    .bind(purchaseId)
    .run();
}
