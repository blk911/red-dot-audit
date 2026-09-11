import { NextResponse } from "next/server";
import {
  cleanJurisdiction,
  createOrFindResearchRequest,
  isValidEmail,
  normalizeEmail,
  normalizeJurisdiction,
  claimResearchAcknowledgement,
  releaseResearchAcknowledgement,
} from "@/lib/research-requests";
import { sendResearchAcknowledgement } from "@/lib/research-email";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    jurisdiction?: string;
    email?: string;
    website?: string;
  } | null;

  // Quietly accept the hidden bot field without creating a queue record.
  if (body?.website) return NextResponse.json({ received: true });

  const jurisdiction = cleanJurisdiction(body?.jurisdiction || "");
  const normalized = normalizeJurisdiction(jurisdiction);
  const email = normalizeEmail(body?.email || "");
  if (jurisdiction.length < 3 || jurisdiction.length > 120 || normalized.length < 3) {
    return NextResponse.json(
      { error: "Enter a city or county and state." },
      { status: 400 },
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address for the review notification." },
      { status: 400 },
    );
  }

  try {
    const row = await createOrFindResearchRequest({ jurisdiction, requesterEmail: email });
    if (!row.acknowledgement_sent_at && await claimResearchAcknowledgement(row.id)) {
      try {
        const sent = await sendResearchAcknowledgement({ email, jurisdiction });
        if (!sent) await releaseResearchAcknowledgement(row.id);
      } catch (error) {
        await releaseResearchAcknowledgement(row.id);
        console.error("Research acknowledgement email failed", error);
      }
    }
    return NextResponse.json({
      received: true,
      requestId: row.id,
      status: row.status,
      message:
        "Review requested. No report has been promised. We will email you only if this jurisdiction clears the source and evidence threshold.",
    });
  } catch (error) {
    console.error("Research request intake failed", error);
    return NextResponse.json(
      { error: "The request could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
