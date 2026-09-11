"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Confirmation = { status?: "processing" | "ready"; accessUrl?: string; accessCode?: string; jurisdiction?: string; tier?: "brief" | "autopsy"; accessExpiresAt?: string; emailDelivery?: "sent" | "failed" | "not_configured" | "already_claimed"; error?: string };

export default function PurchaseSuccess({ sessionId }: { sessionId: string }) {
  const [confirmation, setConfirmation] = useState<Confirmation>(sessionId ? { status: "processing" } : { error: "This confirmation link is missing its Stripe session." });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    async function confirm() {
      try {
        const response = await fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const result = (await response.json()) as Confirmation;
        if (cancelled) return;
        if (response.status === 202 && attempt < 8) { window.setTimeout(() => setAttempt((value) => value + 1), 1800); return; }
        setConfirmation(response.ok ? result : { error: result.error || "Payment confirmation failed." });
      } catch { if (!cancelled) setConfirmation({ error: "Payment confirmation could not be reached." }); }
    }
    void confirm();
    return () => { cancelled = true; };
  }, [attempt, sessionId]);

  return <main className="purchase-page">
    <Link className="purchase-brand" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><b>RED DOT AUDIT</b></Link>
    <section className="purchase-confirmation">
      {confirmation.error ? <><CircleAlert className="purchase-status-icon error" /><p className="eyebrow">PAYMENT CONFIRMATION</p><h1>We could not issue the report link yet.</h1><p>{confirmation.error} Your card is not charged twice by retrying this confirmation page.</p><Button onClick={() => setAttempt((value) => value + 1)}>Retry confirmation <ArrowRight /></Button></> : confirmation.status !== "ready" ? <><LoaderCircle className="purchase-status-icon spin" /><p className="eyebrow">PAYMENT RECEIVED</p><h1>Confirming your report access.</h1><p>Stripe is confirming the transaction. This normally takes only a few seconds.</p></> : <><Check className="purchase-status-icon ready" /><p className="eyebrow">REPORT READY</p><h1>{confirmation.jurisdiction}</h1><p>Your {confirmation.tier === "brief" ? "Evidence Brief" : "Full Autopsy"} is ready. The secure access link remains active for 30 days.</p><div className="purchase-access"><Button asChild><a href={confirmation.accessUrl}>Open your report <ArrowRight /></a></Button>{confirmation.accessCode && <div><span>EVIDENCE VAULT CODE</span><strong>{confirmation.accessCode}</strong><Link href="/vault">Open vault</Link></div>}</div><small><ShieldCheck /> Access was issued only after Stripe confirmed payment.{confirmation.emailDelivery === "sent" ? " A copy was sent to the checkout email." : " Save this code as your access receipt."}</small></>}
    </section>
  </main>;
}
