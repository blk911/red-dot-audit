import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findPurchaseByAccessToken, type PurchaseTier } from "@/lib/commerce/db";
import PurchasedReport from "./purchased-report";
import { resolveRedDotTarget } from "@/app/red-dot-targets";

export const dynamic = "force-dynamic";
export const runtime = "edge";
export const metadata: Metadata = { title: "Secure report — Red Dot Audit", robots: { index: false, follow: false } };

export default async function SecureReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const purchase = await findPurchaseByAccessToken(token);
  if (!purchase) notFound();
  const target = resolveRedDotTarget(purchase.jurisdiction);
  const isSpecimen = purchase.jurisdiction.toLowerCase().includes("grand island");
  if (!target && !isSpecimen) notFound();
  return <main className="secure-report-page"><header className="secure-report-head no-print"><Link href="/" className="purchase-brand"><span className="brand-mark" aria-hidden="true"><span /></span><b>RED DOT AUDIT</b></Link><div><span>SECURE PURCHASE ACCESS</span><b>{purchase.tier === "brief" ? "Evidence Brief" : "Full Autopsy"}</b></div></header><section className="secure-report-context"><p className="eyebrow">PURCHASED REPORT</p><h1>{purchase.jurisdiction}</h1><p>Flock Safety · Automatic License Plate Recognition</p></section><PurchasedReport tier={purchase.tier as PurchaseTier} target={target} /></main>;
}
