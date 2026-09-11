import { getD1 } from "./config";

export const CHARTER_AUTOPSY_PRICE_CENTS = 29_500;
export const CHARTER_AUTOPSY_LIMIT = 25;
export const CHARTER_AUTOPSY_ENDS_AT = "2026-10-08T23:59:59.999Z";

export type CharterOfferStatus = {
  active: boolean;
  sold: number;
  remaining: number;
  limit: number;
  endsAt: string;
};

export async function getCharterOfferStatus(): Promise<CharterOfferStatus> {
  const result = await getD1()
    .prepare(
      `SELECT COUNT(*) AS sold
       FROM purchases
       WHERE tier = 'autopsy' AND status = 'paid' AND amount_cents = ?`,
    )
    .bind(CHARTER_AUTOPSY_PRICE_CENTS)
    .first<{ sold: number | null }>();
  const sold = Number(result?.sold || 0);
  const remaining = Math.max(0, CHARTER_AUTOPSY_LIMIT - sold);
  return {
    active: Date.now() <= new Date(CHARTER_AUTOPSY_ENDS_AT).getTime() && remaining > 0,
    sold,
    remaining,
    limit: CHARTER_AUTOPSY_LIMIT,
    endsAt: CHARTER_AUTOPSY_ENDS_AT,
  };
}
