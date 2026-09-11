import type { Metadata } from "next";
import PurchaseSuccess from "./purchase-success";

export const metadata: Metadata = {
  title: "Payment confirmation — Red Dot Audit",
  robots: { index: false, follow: false },
};

export default async function PurchaseSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId = "" } = await searchParams;
  return <PurchaseSuccess sessionId={sessionId} />;
}
