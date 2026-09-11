import Link from "next/link";
import VaultAccess from "./vault-access";

export default function VaultPage() {
  return (
    <main className="vault-page">
      <header className="legal-topbar">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>RED DOT AUDIT</span></Link>
        <Link href="/">Return to scan</Link>
      </header>
      <section className="vault-shell">
        <div className="vault-intro">
          <p className="eyebrow">PURCHASED WORK PRODUCT</p>
          <h1>Evidence Vault</h1>
          <p>Enter the code from your checkout confirmation or delivery email to reopen the purchased report.</p>
        </div>
        <VaultAccess />
        <aside><b>No account required.</b><span>The secure report link remains the fastest route; this code is the recovery path.</span></aside>
      </section>
    </main>
  );
}
