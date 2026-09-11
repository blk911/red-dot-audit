import type { Metadata } from "next";
import LegalPage from "@/app/legal-page";

export const metadata: Metadata = { title: "Terms of Use — Red Dot Audit", description: "Terms governing use of Red Dot Audit public-record intelligence and purchased reports." };

export default function TermsPage() {
  return <LegalPage eyebrow="LEGAL" title="Terms of Use" intro="These terms govern access to Red Dot Audit, its preliminary scans, target summaries and purchased reports." sections={[
    { heading: "1. The service", paragraphs: ["Red Dot Audit organizes public-source material, identifies documentary inconsistencies and describes records that may resolve them. The service provides investigative starting points. It does not make findings of wrongdoing, illegality, liability, intent or damages."] },
    { heading: "2. Not legal advice", paragraphs: ["The service is informational and is not legal advice, an expert opinion, a substitute for independent investigation or a promise that a claim exists. Lawyers and other professionals remain responsible for source review, legal analysis, deadlines and decisions made from a report."] },
    { heading: "3. Permitted use", paragraphs: ["You may use the service for lawful research, reporting, oversight, administration, advocacy and legal work."], bullets: ["Do not use the service to harass, threaten, dox or unlawfully target a person.", "Do not misstate a Red Dot, score or unresolved question as a proven violation.", "Do not interfere with the service, bypass access controls or redistribute a paid report as a competing product.", "Do not use the service for credit, employment, housing, insurance or another eligibility decision governed by consumer-reporting law."] },
    { heading: "4. Sources and results", paragraphs: ["Public records can be incomplete, delayed, revised, removed or interpreted differently by the responsible agency. We do not guarantee that every source is current or that every apparent discrepancy will remain unresolved. Source links and confidence boundaries are part of the report and should remain attached when findings are shared."] },
    { heading: "5. Purchases and access", paragraphs: ["Prices are shown before checkout. Stripe processes payment and collects the delivery email. Purchased access is issued after payment confirmation and may expire as disclosed at checkout. Personalized digital reports are subject to the Refund Policy."] },
    { heading: "6. Intellectual property", paragraphs: ["Red Dot Audit owns its original selection, organization, analysis, scoring framework, report design and product software. Underlying public records and third-party material remain subject to their respective rights and terms."] },
    { heading: "7. Disclaimers and liability", paragraphs: ["The service is provided on an as-available basis. To the maximum extent permitted by law, Red Dot Audit disclaims implied warranties and is not liable for indirect, consequential, special or punitive damages arising from use of the service. Nothing in these terms excludes a right or remedy that cannot lawfully be excluded."] },
    { heading: "8. Changes and contact", paragraphs: ["We may revise these terms as the service develops. Material changes will be reflected by a new effective date. Questions may be sent to support@reddotaudit.com."] },
  ]} />;
}
