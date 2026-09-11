import Link from "next/link";

type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };

export default function LegalPage({ eyebrow, title, intro, updated = "September 3, 2026", sections }: { eyebrow: string; title: string; intro: string; updated?: string; sections: Section[] }) {
  return <main className="legal-page">
    <header className="legal-topbar"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>RED DOT AUDIT</span></Link><Link href="/">Return to scan</Link></header>
    <article className="legal-document">
      <div className="legal-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p><small>Effective {updated}</small></div>
      <div className="legal-content">{sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}</div>
    </article>
    <footer className="legal-footer"><span>RedDotAudit.com · Follow the record.</span><nav><Link href="/methodology">Methodology</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds</Link><Link href="/support">Support</Link></nav></footer>
  </main>;
}
