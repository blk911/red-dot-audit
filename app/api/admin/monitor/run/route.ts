import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { runMonitorBatch } from "@/lib/admin/operations";

export const runtime = "edge";
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { limit?: number };
  return NextResponse.json({ ok: true, batch: await runMonitorBatch(body.limit || 30) });
}
