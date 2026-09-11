import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { runDiscoveryPass } from "@/lib/admin/discovery";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { force?: boolean };
  return NextResponse.json({ ok: true, discovery: await runDiscoveryPass(Boolean(body.force)) });
}
