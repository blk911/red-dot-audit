"use client";

import { FullReport, QualifiedReport, downloadGrandIslandReport, downloadTargetReport, type ReportTier } from "@/app/red-dot-experience";
import type { RedDotTarget } from "@/app/red-dot-targets";

export default function PurchasedReport({ tier, target }: { tier: ReportTier; target: RedDotTarget | null }) {
  if (target) return <QualifiedReport target={target} tier={tier} onDownload={() => downloadTargetReport(target, tier)} />;
  return <FullReport tier={tier} onDownload={() => downloadGrandIslandReport(tier)} />;
}
