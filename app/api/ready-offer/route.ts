import { NextResponse } from "next/server";
import { resolveRedDotTarget } from "@/app/red-dot-targets";
import { validateReadyOffer } from "@/lib/commerce/ready-offer";

export const runtime = "edge";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = resolveRedDotTarget(url.searchParams.get("target") || "");
  const offer = target ? await validateReadyOffer(url.searchParams.get("offer"), target.slug) : null;
  if (!offer) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json({ valid: true, expiresAt: offer.expiresAt, brief: 175, autopsy: 320 });
}
