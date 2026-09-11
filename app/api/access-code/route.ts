import { NextResponse } from "next/server";
import { findPurchaseByAccessCode } from "@/lib/commerce/db";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 12-character access code from your purchase receipt." }, { status: 400 });
  }
  const normalized = code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
  const purchase = await findPurchaseByAccessCode(normalized);
  if (!purchase) {
    return NextResponse.json({ error: "That code is invalid or has expired." }, { status: 404 });
  }
  return NextResponse.json({
    accessUrl: `/report/${purchase.accessToken}`,
    jurisdiction: purchase.jurisdiction,
    tier: purchase.tier,
    expiresAt: purchase.access_expires_at,
  });
}
