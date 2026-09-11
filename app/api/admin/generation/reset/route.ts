import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { resetAndRebuildMarket } from "@/lib/admin/market-generation";

export const runtime = "edge";

export async function POST() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  try { return NextResponse.json({ ok: true, result: await resetAndRebuildMarket() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Clean generation failed." }, { status: 500 }); }
}
