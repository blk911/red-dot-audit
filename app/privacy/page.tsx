import type { Metadata } from "next";
import LegalPage from "@/app/legal-page";

export const metadata: Metadata = { title: "Privacy Policy — Red Dot Audit", description: "How Red Dot Audit handles search inputs, purchase information and support communications." };

export default function PrivacyPage() {
  return <LegalPage eyebrow="PRIVACY" title="Privacy Policy" intro="We collect only the information needed to run a scan, complete a purchase, deliver a report and support the customer." sections={[
    { heading: "Information we collect", bullets: ["The city, county, agency, vendor, technology or issue entered for a scan.", "Purchase email, product selected, transaction identifiers and payment status supplied by Stripe.", "Messages and attachments you voluntarily send to support.", "Basic security and operational logs, such as request time, browser information and IP-derived network data."] },
    { heading: "Payment information", paragraphs: ["Stripe hosts checkout and processes payment. Red Dot Audit does not receive or store full card numbers or card security codes. Stripe’s handling of payment data is governed by its own privacy policy."] },
    { heading: "How information is used", bullets: ["Run and improve the requested public-record analysis.", "Confirm payment and issue secure report access.", "Prevent fraud, abuse and unauthorized access.", "Respond to support, correction and refund requests.", "Comply with legal obligations and enforce our terms."] },
    { heading: "Service providers and disclosure", paragraphs: ["We use infrastructure, payment and communications providers to operate the service. They receive information only as needed to perform those functions. We do not sell personal information. We may disclose information when required by law, to protect the service or in connection with a legitimate business transfer."] },
    { heading: "Retention and security", paragraphs: ["We retain purchase and report-access records for operational, accounting, fraud-prevention and legal purposes. Scan inputs and support communications are retained only as reasonably needed. We use access controls and technical safeguards, but no internet service can guarantee absolute security."] },
    { heading: "Your choices", paragraphs: ["You may ask about, correct or request deletion of personal information by emailing support@reddotaudit.com. Some transaction records may be retained where required for accounting, security or legal compliance."] },
    { heading: "Children and changes", paragraphs: ["The service is intended for professional and civic research and is not directed to children under 13. We may update this policy as the service changes; the effective date above identifies the current version."] },
  ]} />;
}
