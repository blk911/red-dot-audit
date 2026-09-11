import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { getD1 } from "@/lib/commerce/config";
import { discoverOfficialContact, verifyOfficialContactUrl } from "@/lib/admin/official-contact";

export const runtime = "edge";
type Platform = "REDDIT" | "FACEBOOK" | "INSTAGRAM";
type Action = "activate" | "discover_destination" | "prepare" | "save_destination" | "save_target" | "approve" | "hold" | "delivered" | "delivered_target";
type Body = { id?: string; action?: Action; destinationName?: string; destinationAddress?: string; destinationSourceUrl?: string; platform?: Platform; postTitle?: string; postBody?: string };

async function withTargets(db: ReturnType<typeof getD1>, campaign: Record<string, unknown> | null) {
  if (!campaign) return campaign;
  const targets = await db.prepare("SELECT * FROM admin_campaign_delivery_targets WHERE campaign_id=? ORDER BY CASE platform WHEN 'REDDIT' THEN 1 WHEN 'FACEBOOK' THEN 2 ELSE 3 END").bind(String(campaign.id)).all();
  const contact = await db.prepare("SELECT * FROM admin_official_contacts WHERE normalized_jurisdiction=lower(trim(?)) AND status='VERIFIED' ORDER BY verified_at DESC LIMIT 1").bind(String(campaign.jurisdiction || "")).first();
  return { ...campaign, official_contact: contact || null, delivery_targets: targets.results || [] };
}

async function enrichDestination(db: ReturnType<typeof getD1>, campaign: Record<string, unknown>) {
  const jurisdiction = String(campaign.jurisdiction || "");
  const contact = await discoverOfficialContact(jurisdiction, String(campaign.destination_name || ""), String(campaign.destination_address || ""));
  if (contact.status !== "VERIFIED") return contact;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO admin_official_contacts (id,jurisdiction,normalized_jurisdiction,name,title,organization,email,phone,source_url,status,verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'VERIFIED',?,?,?) ON CONFLICT(normalized_jurisdiction,email) DO UPDATE SET name=excluded.name,title=excluded.title,organization=excluded.organization,phone=excluded.phone,source_url=excluded.source_url,status='VERIFIED',verified_at=excluded.verified_at,updated_at=excluded.updated_at").bind(crypto.randomUUID(), jurisdiction, jurisdiction.toLowerCase().trim(), contact.name, contact.title || null, contact.organization || null, contact.email, contact.phone || null, contact.sourceUrl, now, now, now),
    db.prepare("UPDATE admin_campaign_batches SET destination_status='VERIFIED',destination_channel='PROFESSIONAL_EMAIL',destination_name=?,destination_address=?,destination_source_url=? WHERE id=?").bind(contact.name, contact.email, contact.sourceUrl, String(campaign.id)),
  ]);
  return contact;
}

function platformCopy(platform: Platform, jurisdiction: string, issue: string) {
  const title = platform === "REDDIT" ? `What the public record shows in ${jurisdiction}` : `${jurisdiction}: what the public record shows`;
  const core = `Red Dot Audit is reviewing the source-linked public record behind this ${issue.toLowerCase()} issue in ${jurisdiction}. The first questions are what the agency was authorized to do, what the records establish, and what remains missing.`;
  const liveReport = `Red Dot Audit live report: https://reddotaudit.com/?target=${encodeURIComponent(jurisdiction)}`;
  const body = platform === "INSTAGRAM"
    ? `${core}\n\n${liveReport}\n\n#PublicRecords #ALPR #GovernmentAccountability`
    : `${core}\n\n${liveReport}`;
  return { title, body };
}

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const db = getD1();
  const campaigns = await db.prepare("SELECT * FROM admin_campaign_batches ORDER BY priority_score DESC, created_at DESC LIMIT 30").all();
  return NextResponse.json({ campaigns: await Promise.all((campaigns.results || []).map((row) => withTargets(db, row as Record<string, unknown>))) });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.id || !body.action) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const db = getD1();
  const campaign = await db.prepare("SELECT * FROM admin_campaign_batches WHERE id=? LIMIT 1").bind(body.id).first<Record<string, unknown>>();
  if (!campaign) return NextResponse.json({ error: "Outreach job was not found." }, { status: 404 });
  const now = new Date().toISOString();

  if (body.action === "activate") {
    const source = await db.prepare("SELECT destination,source_conversation_url FROM admin_community_opportunities WHERE case_file_id=? ORDER BY created_at DESC LIMIT 1").bind(`radar:${String(campaign.cluster_key || "")}`).first<Record<string, unknown>>();
    const remembered = await db.prepare("SELECT destination_channel,destination_name,destination_address,destination_source_url FROM admin_campaign_batches WHERE lower(trim(jurisdiction))=lower(trim(?)) AND destination_status='VERIFIED' AND id<>? ORDER BY delivered_at DESC, created_at DESC LIMIT 1").bind(String(campaign.jurisdiction || ""), body.id).first<Record<string, unknown>>();
    const address = String(source?.source_conversation_url || remembered?.destination_address || ""); const name = String(source?.destination || remembered?.destination_name || "");
    await db.prepare("UPDATE admin_campaign_batches SET status='ACTIVE',destination_channel=COALESCE(destination_channel,?),destination_name=COALESCE(destination_name,?),destination_address=COALESCE(destination_address,?),destination_source_url=COALESCE(destination_source_url,?) WHERE id=? AND status='PROPOSED'").bind(String(remembered?.destination_channel || (address ? "SOCIAL" : "")) || null, name || null, address || null, String(source?.source_conversation_url || remembered?.destination_source_url || "") || null, body.id).run();
    if (!String(campaign.marketing_route || "").startsWith("SOCIAL") && !campaign.destination_source_url) await enrichDestination(db, campaign);
  } else if (body.action === "discover_destination") {
    const contact = await enrichDestination(db, campaign);
    if (contact.status !== "VERIFIED") return NextResponse.json({ error: "No contact could be confirmed on an official government page. Existing suggestions remain proposed." }, { status: 422 });
  } else if (body.action === "prepare" || body.action === "save_destination") {
    const social = String(campaign.marketing_route || "").startsWith("SOCIAL");
    let name = body.destinationName?.trim() || String(campaign.destination_name || ""); let url = body.destinationAddress?.trim() || String(campaign.destination_address || ""); let sourceUrl = body.destinationSourceUrl?.trim() || String(campaign.destination_source_url || "");
    if (social && !url) { const community = await db.prepare("SELECT destination,source_conversation_url FROM admin_community_opportunities WHERE case_file_id=? ORDER BY created_at DESC LIMIT 1").bind(`radar:${String(campaign.cluster_key || "")}`).first<Record<string, unknown>>(); name = String(community?.destination || "Originating social conversation"); url = String(community?.source_conversation_url || ""); sourceUrl = url; }
    if (!social && (!name || !url || !sourceUrl)) return NextResponse.json({ error: "Verify the recipient name, delivery address and supporting source before building the draft." }, { status: 422 });
    if (!social) {
      const verified = await verifyOfficialContactUrl(sourceUrl, name, url);
      if (!verified) return NextResponse.json({ error: "That address was not found on the supplied official .gov page. The contact remains proposed." }, { status: 422 });
      name = verified.name; url = verified.email; sourceUrl = verified.sourceUrl;
      const stamp = new Date().toISOString();
      await db.prepare("INSERT INTO admin_official_contacts (id,jurisdiction,normalized_jurisdiction,name,title,organization,email,phone,source_url,status,verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'VERIFIED',?,?,?) ON CONFLICT(normalized_jurisdiction,email) DO UPDATE SET name=excluded.name,title=excluded.title,organization=excluded.organization,phone=excluded.phone,source_url=excluded.source_url,status='VERIFIED',verified_at=excluded.verified_at,updated_at=excluded.updated_at").bind(crypto.randomUUID(), String(campaign.jurisdiction || ""), String(campaign.jurisdiction || "").toLowerCase().trim(), verified.name, verified.title || null, verified.organization || null, verified.email, verified.phone || null, verified.sourceUrl, stamp, stamp, stamp).run();
    }
    if (social && !url) return NextResponse.json({ error: "The originating conversation is unavailable. Verify a social destination first." }, { status: 422 });
    const jurisdiction = String(campaign.jurisdiction || "this jurisdiction"); const issue = String(campaign.issue_type || "ALPR public-record issue"); const reddit = platformCopy("REDDIT", jurisdiction, issue);
    const subject = social ? reddit.title : `${jurisdiction} ALPR evidence and case file`;
    const draft = social ? reddit.body : `${name} —\n\nRed Dot Audit identified a current ${issue.toLowerCase()} issue involving ALPR activity in ${jurisdiction}. We compare documented authority with contracts, policies, public records and reported system activity, then package the unresolved gaps into a source-linked case file.\n\nReview the methodology: https://reddotaudit.com/methodology\n\nSpencer Wendt\nRed Dot Audit`;
    await db.prepare("UPDATE admin_campaign_batches SET destination_status='VERIFIED',destination_channel=?,destination_name=?,destination_address=?,destination_source_url=?,draft_status='READY_REVIEW',draft_subject=?,draft_body=? WHERE id=?").bind(social ? "SOCIAL" : "PROFESSIONAL_EMAIL", name, url, sourceUrl, subject, draft, body.id).run();
    if (social) {
      const remembered = await db.prepare("SELECT platform,destination_name,destination_url,source_url FROM admin_campaign_delivery_targets WHERE campaign_id IN (SELECT id FROM admin_campaign_batches WHERE lower(trim(jurisdiction))=lower(trim(?)) AND id<>?) ORDER BY delivered_at DESC,updated_at DESC").bind(jurisdiction, body.id).all<Record<string, unknown>>();
      const memory = new Map((remembered.results || []).map((row) => [String(row.platform), row]));
      await db.batch((["REDDIT", "FACEBOOK", "INSTAGRAM"] as Platform[]).map((platform) => { const old = memory.get(platform); const copy = platformCopy(platform, jurisdiction, issue); const targetName = platform === "REDDIT" ? name : String(old?.destination_name || ""); const targetUrl = platform === "REDDIT" ? url : String(old?.destination_url || ""); const targetSource = platform === "REDDIT" ? sourceUrl : String(old?.source_url || ""); return db.prepare("INSERT INTO admin_campaign_delivery_targets (id,campaign_id,platform,destination_name,destination_url,source_url,post_title,post_body,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,platform) DO UPDATE SET destination_name=excluded.destination_name,destination_url=excluded.destination_url,source_url=excluded.source_url,post_title=excluded.post_title,post_body=excluded.post_body,status=CASE WHEN admin_campaign_delivery_targets.status='DELIVERED' THEN 'DELIVERED' WHEN excluded.destination_url<>'' THEN 'READY' ELSE 'NEEDS_DESTINATION' END,updated_at=excluded.updated_at").bind(crypto.randomUUID(), body.id, platform, targetName || null, targetUrl || null, targetSource || null, copy.title, copy.body, targetUrl ? "READY" : "NEEDS_DESTINATION", now, now); }));
    }
  } else if (body.action === "save_target") {
    if (!body.platform) return NextResponse.json({ error: "Choose a platform." }, { status: 400 });
    const name = body.destinationName?.trim() || ""; const url = body.destinationAddress?.trim() || ""; const source = body.destinationSourceUrl?.trim() || url;
    if (!name || !url) return NextResponse.json({ error: "Add the destination name and URL." }, { status: 422 });
    const copy = platformCopy(body.platform, String(campaign.jurisdiction || "this jurisdiction"), String(campaign.issue_type || "public-record"));
    await db.prepare("INSERT INTO admin_campaign_delivery_targets (id,campaign_id,platform,destination_name,destination_url,source_url,post_title,post_body,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,platform) DO UPDATE SET destination_name=excluded.destination_name,destination_url=excluded.destination_url,source_url=excluded.source_url,post_title=excluded.post_title,post_body=excluded.post_body,status='READY',updated_at=excluded.updated_at").bind(crypto.randomUUID(), body.id, body.platform, name, url, source || null, body.postTitle?.trim() || copy.title, body.postBody?.trim() || copy.body, "READY", now, now).run();
  } else if (body.action === "approve") {
    if (String(campaign.draft_status) !== "READY_REVIEW") return NextResponse.json({ error: "Build and review the package before approval." }, { status: 409 });
    await db.batch([db.prepare("UPDATE admin_campaign_batches SET approval_status='APPROVED',approved_at=? WHERE id=?").bind(now, body.id), db.prepare("UPDATE admin_campaign_delivery_targets SET status=CASE WHEN destination_url IS NOT NULL AND destination_url<>'' THEN 'APPROVED' ELSE status END,updated_at=? WHERE campaign_id=? AND status<>'DELIVERED'").bind(now, body.id)]);
  } else if (body.action === "hold") await db.prepare("UPDATE admin_campaign_batches SET approval_status='HOLD' WHERE id=?").bind(body.id).run();
  else if (body.action === "delivered_target") {
    if (!body.platform || String(campaign.approval_status) !== "APPROVED") return NextResponse.json({ error: "Approve the package before recording delivery." }, { status: 409 });
    await db.batch([db.prepare("UPDATE admin_campaign_delivery_targets SET status='DELIVERED',delivered_at=?,updated_at=? WHERE campaign_id=? AND platform=?").bind(now, now, body.id, body.platform), db.prepare("UPDATE admin_campaign_batches SET delivered_at=COALESCE(delivered_at,?) WHERE id=?").bind(now, body.id)]);
  } else if (body.action === "delivered") await db.prepare("UPDATE admin_campaign_batches SET delivered_at=? WHERE id=? AND approval_status='APPROVED'").bind(now, body.id).run();

  const updated = await db.prepare("SELECT * FROM admin_campaign_batches WHERE id=? LIMIT 1").bind(body.id).first<Record<string, unknown>>();
  await db.prepare("INSERT INTO admin_activity_log (id,actor,event_type,entity_type,entity_id,summary,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "ADMIN", `OUTREACH_${body.action.toUpperCase()}`, "CAMPAIGN", body.id, `${String(campaign.label)}: ${body.action}.`, JSON.stringify({ platform: body.platform || null }), now).run();
  return NextResponse.json({ ok: true, campaign: await withTargets(db, updated), sent: false });
}
