"use client";

import { useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VaultAccess() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function openVault(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = (await response.json()) as { accessUrl?: string; error?: string };
      if (!response.ok || !result.accessUrl) throw new Error(result.error || "The report could not be opened.");
      window.location.assign(result.accessUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be opened.");
      setBusy(false);
    }
  }

  return (
    <form className="vault-form" onSubmit={openVault}>
      <label htmlFor="access-code">REPORT ACCESS CODE</label>
      <div>
        <KeyRound />
        <input
          id="access-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="AB12-CD34-EF56"
          autoComplete="one-time-code"
          maxLength={14}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Opening evidence…" : "Open Evidence Vault"} <ArrowRight />
      </Button>
      <small><ShieldCheck /> Codes are issued only after Stripe confirms payment and expire with the report link.</small>
    </form>
  );
}
