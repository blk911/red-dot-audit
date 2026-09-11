import type { Metadata } from "next";
import LegalPage from "@/app/legal-page";

export const metadata: Metadata = { title: "Refund Policy — Red Dot Audit", description: "Refund and delivery policy for Red Dot Audit digital reports." };

export default function RefundsPage() {
  return <LegalPage eyebrow="PURCHASES" title="All Sales Final" intro="The preliminary summary shows the public-record basis before purchase. The customer is purchasing a curated digital report built from that disclosed information." sections={[
    { heading: "No refunds", paragraphs: ["All Red Dot Audit purchases are final. Reports are curated digital information products made available after payment, and we do not issue refunds because a customer changes direction, does not pursue the matter, disagrees with the analysis or finds that additional evidence reconciles the question."] },
    { heading: "What is purchased", paragraphs: ["The summary or teaser displayed before checkout identifies the jurisdiction, principal public-record question and available evidentiary basis. The purchased report organizes and expands that disclosed material with cited sources, analysis and the selected level of investigative detail. It does not promise a particular legal or factual outcome."] },
    { heading: "Submit a discrepancy", paragraphs: ["If you identify a material factual error or incorrect source attribution, submit the exact disputed statement, the supporting record and the requested correction to support@reddotaudit.com. We will review documented discrepancies and, when verified, correct the analysis or provide an updated report. A discrepancy submission is a correction process and does not create a right to a refund."] },
    { heading: "Access and billing corrections", paragraphs: ["If a valid purchase link does not open, contact support and we will restore access or provide the purchased report. Duplicate or unauthorized charges are handled as billing corrections. Include the checkout email, jurisdiction and purchase date; never send card numbers or security codes."] },
  ]} />;
}
