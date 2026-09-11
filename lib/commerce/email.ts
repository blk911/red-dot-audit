import {
  claimPurchaseEmailDelivery,
  markPurchaseEmailDelivered,
  markPurchaseEmailFailed,
} from "./db";
import { getSendGridApiKey, getSendGridFromEmail } from "./config";

type DeliveryInput = {
  purchaseId: string;
  buyerEmail: string | null;
  tier: "brief" | "autopsy";
  jurisdiction: string;
  accessToken: string;
  accessCode: string;
  accessExpiresAt: string;
  siteUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

export async function deliverPurchaseEmail(input: DeliveryInput) {
  const apiKey = getSendGridApiKey();
  if (!apiKey || !input.buyerEmail) return { status: "not_configured" as const };
  if (!(await claimPurchaseEmailDelivery(input.purchaseId))) return { status: "already_claimed" as const };

  const product = input.tier === "brief" ? "Evidence Brief" : "Full Autopsy";
  const accessUrl = `${input.siteUrl.replace(/\/$/, "")}/report/${encodeURIComponent(input.accessToken)}`;
  const vaultUrl = `${input.siteUrl.replace(/\/$/, "")}/vault`;
  const expiry = new Date(input.accessExpiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.buyerEmail }] }],
        from: { email: getSendGridFromEmail(), name: "Red Dot Audit" },
        subject: `${input.jurisdiction} — ${product} access`,
        content: [
          {
            type: "text/plain",
            value: [
              "RED DOT AUDIT — REPORT ACCESS",
              "",
              `${input.jurisdiction} · ${product}`,
              "",
              `Open the report: ${accessUrl}`,
              `Evidence Vault: ${vaultUrl}`,
              `Access code: ${input.accessCode}`,
              "",
              `Access expires ${expiry}.`,
              "",
              "Keep this message. The code provides a fallback if the secure link is unavailable.",
              "RedDotAudit.com · Follow the record.",
            ].join("\n"),
          },
          {
            type: "text/html",
            value: `<div style="font-family:Arial,sans-serif;color:#17202b;max-width:640px;margin:auto"><p style="font-size:12px;font-weight:700;letter-spacing:.14em;color:#8c1820">RED DOT AUDIT · REPORT ACCESS</p><h1 style="font:400 30px Georgia,serif;margin:18px 0 8px">${escapeHtml(input.jurisdiction)}</h1><p style="margin:0 0 24px;color:#59636f">${product}</p><p><a href="${accessUrl}" style="display:inline-block;background:#b4232c;color:#fff;padding:14px 20px;text-decoration:none;font-weight:700">Open the report</a></p><div style="border:1px solid #cbd2d9;padding:18px;margin:24px 0"><small style="display:block;color:#59636f;letter-spacing:.1em">EVIDENCE VAULT ACCESS CODE</small><strong style="display:block;font-size:24px;letter-spacing:.08em;margin:8px 0">${input.accessCode}</strong><a href="${vaultUrl}">Open the Evidence Vault</a></div><p style="font-size:13px;color:#59636f">Access expires ${expiry}. Keep this message as your access receipt.</p><p style="font-size:12px;color:#59636f;margin-top:28px">RedDotAudit.com · Follow the record.</p></div>`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`SendGrid returned ${response.status}`);
    await markPurchaseEmailDelivered(input.purchaseId);
    return { status: "sent" as const };
  } catch (error) {
    await markPurchaseEmailFailed(input.purchaseId);
    console.error("Purchase delivery email failed", error);
    return { status: "failed" as const };
  }
}
