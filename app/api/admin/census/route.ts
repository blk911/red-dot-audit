import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { startSystematicAudit } from "@/lib/admin/discovery";
import { getD1 } from "@/lib/commerce/config";
import { harvestNationalCandidates } from "@/lib/admin/national-harvester";
import { processAcquisitionQueue } from "@/lib/admin/acquisition-queue";

export const runtime = "edge";
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  try {
    const body = await request.json().catch(() => null) as { action?: string; id?: string; jurisdiction?: string; agency?: string; limit?: number; pages?: number } | null;
    if (body?.action === "harvest") return NextResponse.json({ ok: true, ...(await harvestNationalCandidates(body.pages)) });
    if (body?.action === "process_queue") return NextResponse.json({ ok: true, ...(await processAcquisitionQueue(body.limit || 1)) });
    if (body?.action === "audit" && body.id) return NextResponse.json({ ok: true, ...(await startSystematicAudit(body.id)) });
    if (body?.action === "create") {
      const jurisdiction = String(body.jurisdiction || "").trim(); const agency = String(body.agency || "").trim();
      if (!/^[A-Za-z .'-]+,\s*[A-Za-z .'-]{2,}$/.test(jurisdiction)) return NextResponse.json({ error: "Enter a city/county and state, such as Mesa, Arizona." }, { status: 400 });
      const unresolvedAgency = `${jurisdiction.replace(/,.*$/, "")} law-enforcement operator — unresolved`; const selectedAgency = agency || unresolvedAgency;
      const id = crypto.randomUUID(); const now = new Date().toISOString();
      await getD1().prepare("INSERT INTO admin_census_deployments (id,jurisdiction,agency,state,vendor_system,confidence,evidence_count,source_urls_json,lead_reason,research_readiness,last_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,'UNVERIFIED',0,'[]',?,0,?,?,?) ON CONFLICT(jurisdiction,agency) DO UPDATE SET updated_at=excluded.updated_at").bind(id,jurisdiction,selectedAgency,jurisdiction.split(",").pop()?.trim() || "", "ALPR / Flock — verification required", "Clean live acquisition: resolve the operator, authority and operating data from current sources.", now, now, now).run();
      const row = await getD1().prepare("SELECT id FROM admin_census_deployments WHERE jurisdiction=? AND agency=? LIMIT 1").bind(jurisdiction,selectedAgency).first<{id:string}>();
      const result = await startSystematicAudit(row?.id || id);
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "Seed loading is disabled. Submit a new jurisdiction for live acquisition." }, { status: 410 });
  } catch (error) {
    console.error("Clean acquisition failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Clean acquisition failed." }, { status: 500 });
  }
}
