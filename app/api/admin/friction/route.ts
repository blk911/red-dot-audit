import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { getD1 } from "@/lib/commerce/config";
import { startAuditFromFriction } from "@/lib/admin/discovery";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; action?: "start_audit" | "watch" | "archive" } | null;
  if (!body?.id || !body.action) return NextResponse.json({ error: "Invalid friction action." }, { status: 400 });
  if (body.action === "start_audit") {
    try { return NextResponse.json({ ok: true, ...(await startAuditFromFriction(body.id)) }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Audit could not start." }, { status: 404 }); }
  }
  const state = body.action === "watch" ? "WATCH" : "ARCHIVE"; const now = new Date().toISOString();
  const result = await getD1().prepare("UPDATE admin_friction_opportunities SET state=?,updated_at=? WHERE id=?").bind(state, now, body.id).run();
  if (!result.meta?.changes) return NextResponse.json({ error: "Friction opportunity was not found." }, { status: 404 });
  return NextResponse.json({ ok: true, state });
}
