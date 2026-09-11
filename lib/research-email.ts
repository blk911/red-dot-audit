import {
  getSendGridApiKey,
  getSendGridFromEmail,
} from "@/lib/commerce/config";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] || character);
}

async function sendMessage(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = getSendGridApiKey();
  if (!apiKey) return false;
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: getSendGridFromEmail(), name: "Red Dot Audit" },
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
    }),
  });
  if (!response.ok) throw new Error(`SendGrid returned ${response.status}`);
  return true;
}

export async function sendResearchAcknowledgement(input: {
  email: string;
  jurisdiction: string;
}) {
  const place = escapeHtml(input.jurisdiction);
  return sendMessage({
    to: input.email,
    subject: `Review request received — ${input.jurisdiction}`,
    text: [
      "RED DOT AUDIT — REVIEW REQUEST RECEIVED", "", input.jurisdiction, "",
      "This jurisdiction has been added to the private research queue.",
      "This is a request for review, not a promise that a report will be produced.",
      "We will email you only if the jurisdiction clears the source and evidence threshold.",
      "", "RedDotAudit.com · Follow the record.",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;color:#17202b;max-width:640px;margin:auto"><p style="font-size:12px;font-weight:700;letter-spacing:.14em;color:#8c1820">RED DOT AUDIT · REVIEW REQUEST</p><h1 style="font:400 30px Georgia,serif">${place}</h1><p>This jurisdiction has been added to the private research queue.</p><p><strong>This is a request for review, not a promise that a report will be produced.</strong></p><p>We will email you only if it clears the source and evidence threshold.</p><p style="font-size:12px;color:#59636f;margin-top:28px">RedDotAudit.com · Follow the record.</p></div>`,
  });
}

export async function sendResearchReadyNotice(input: {
  email: string;
  jurisdiction: string;
  targetPlace: string;
  readyUrl: string;
}) {
  const place = escapeHtml(input.targetPlace);
  const url = escapeHtml(input.readyUrl);
  return sendMessage({
    to: input.email,
    subject: `${input.targetPlace} — source-qualified report is ready`,
    text: [
      "RED DOT AUDIT — REPORT INVENTORY READY", "", input.targetPlace, "",
      "The jurisdiction has cleared source review and a report package is now available.",
      `Open the evidence preview: ${input.readyUrl}`, "",
      "The preview identifies public-record reconciliation questions; it is not a finding of wrongdoing.",
      "RedDotAudit.com · Follow the record.",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;color:#17202b;max-width:640px;margin:auto"><p style="font-size:12px;font-weight:700;letter-spacing:.14em;color:#8c1820">RED DOT AUDIT · REPORT INVENTORY READY</p><h1 style="font:400 30px Georgia,serif">${place}</h1><p>The jurisdiction has cleared source review and a report package is now available.</p><p><a href="${url}" style="display:inline-block;background:#b4232c;color:#fff;padding:14px 20px;text-decoration:none;font-weight:700">Open the evidence preview</a></p><p style="font-size:12px;color:#59636f;margin-top:28px">The preview identifies public-record reconciliation questions; it is not a finding of wrongdoing.</p></div>`,
  });
}
