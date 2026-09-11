import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { getAdminCounts } from "@/lib/admin/store";

export const runtime = "edge";

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  return NextResponse.json({ counts: await getAdminCounts(), productionOutboundEnabled: false, automaticCommunityPosting: false });
}
