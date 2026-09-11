import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { getD1 } from "@/lib/commerce/config";

export const runtime = "edge";

const actions = {
  dismiss: "DISMISSED",
  research: "RESEARCH",
  restore: "NEW",
} as const;

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const result = await getD1().prepare("SELECT * FROM admin_radar_signals ORDER BY detected_at DESC LIMIT 100").all();
  return NextResponse.json({ signals: result.results || [] });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; action?: keyof typeof actions } | null;
  if (!body?.id || !body.action || !actions[body.action]) return NextResponse.json({ error: "Select a valid signal action." }, { status: 400 });
  const db = getD1();
  const now = new Date().toISOString();
  const status = actions[body.action];
  const result = await db.prepare("UPDATE admin_radar_signals SET status=?,reviewed_at=? WHERE id=?").bind(status, now, body.id).run();
  if (!Number(result.meta?.changes || 0)) return NextResponse.json({ error: "Signal not found." }, { status: 404 });
  if (body.action === "research") {
    await db.prepare("UPDATE admin_radar_endpoints SET research_escalations=research_escalations+1,updated_at=? WHERE id=(SELECT endpoint_id FROM admin_radar_signals WHERE id=?)").bind(now, body.id).run();
  }
  await db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,entity_id,summary,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "HUMAN", `SIGNAL_${status}`, "RADAR_SIGNAL", body.id, status === "NEW" ? "Radar signal restored to active review." : `Radar signal marked ${status.toLowerCase()}.`, "{}", now).run();
  return NextResponse.json({ ok: true, status });
}
