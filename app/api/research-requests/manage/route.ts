import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isLaunchTarget, resolveRedDotTarget } from "@/app/red-dot-targets";
import { getPrivateResearchEmails, getPublicSiteUrl } from "@/lib/commerce/config";
import {
  findResearchRequest,
  markResearchNotified,
  updateResearchRequestStatus,
  type ResearchRequestStatus,
} from "@/lib/research-requests";
import { sendResearchReadyNotice } from "@/lib/research-email";
import { createReadyOffer } from "@/lib/commerce/ready-offer";

export const runtime = "edge";

async function isResearchAdmin() {
  const user = await getChatGPTUser();
  return Boolean(user && getPrivateResearchEmails().includes(user.email.toLowerCase()));
}

export async function POST(request: Request) {
  if (!(await isResearchAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    action?: "reviewing" | "not_qualified" | "notify_ready";
  } | null;
  if (!body?.id || !body.action) {
    return NextResponse.json({ error: "Select a queue action." }, { status: 400 });
  }
  const row = await findResearchRequest(body.id);
  if (!row) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  if (body.action === "notify_ready") {
    if (row.status === "notified") {
      return NextResponse.json({ ok: true, status: row.status });
    }
    const target = resolveRedDotTarget(row.jurisdiction);
    if (!target || !isLaunchTarget(target)) {
      return NextResponse.json(
        { error: "This jurisdiction is not in the release-qualified inventory yet." },
        { status: 409 },
      );
    }
    const offer = await createReadyOffer(target.slug);
    const readyUrl = `${getPublicSiteUrl(request.url)}/?target=${encodeURIComponent(target.place)}&offer=${encodeURIComponent(offer)}`;
    const sent = await sendResearchReadyNotice({
      email: row.requester_email,
      jurisdiction: row.jurisdiction,
      targetPlace: target.place,
      readyUrl,
    });
    if (!sent) {
      return NextResponse.json({ error: "SendGrid is not configured." }, { status: 503 });
    }
    await markResearchNotified(row.id, target.slug);
    return NextResponse.json({ ok: true, status: "notified" });
  }

  const status = body.action as ResearchRequestStatus;
  await updateResearchRequestStatus(row.id, status);
  return NextResponse.json({ ok: true, status });
}
