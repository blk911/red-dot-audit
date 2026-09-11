import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getPrivateResearchEmails } from "@/lib/commerce/config";
import snapshot from "../../research/red-dot-survey-current.json";
import deepSurvey from "../../research/red-dot-deep-survey-current.json";
import proposed25 from "../../research/red-dot-proposed-25.json";
import ResearchRequestQueue from "./research-request-queue";
import { listResearchRequests } from "@/lib/research-requests";
import { isLaunchTarget, resolveRedDotTarget } from "../red-dot-targets";

export const metadata: Metadata = {
  title: "Private Research Sandbox — Red Dot Audit",
  description: "Internal jurisdiction survey and evidence-readiness inventory.",
  robots: { index: false, follow: false },
};

const statusClass: Record<string, string> = {
  SELLABLE: "sellable",
  "DEEP REVIEW": "deep",
  HOLD: "hold",
};

export default async function ResearchPage() {
  const user = await requireChatGPTUser("/research");
  if (!getPrivateResearchEmails().includes(user.email.toLowerCase())) notFound();
  const assessmentById = new Map(deepSurvey.assessments.map((item) => [item.id, item]));
  const candidates = snapshot.candidates
    .map((candidate) => ({ ...candidate, assessment: assessmentById.get(candidate.id) }))
    .sort((a, b) => {
      const order: Record<string, number> = { SELLABLE: 0, "DEEP REVIEW": 1, HOLD: 2 };
      return (order[a.assessment?.disposition || "HOLD"] - order[b.assessment?.disposition || "HOLD"]) || a.rank - b.rank;
    });
  const totals = candidates.reduce((result, candidate) => {
    const disposition = candidate.assessment?.disposition || "HOLD";
    result[disposition] = (result[disposition] || 0) + 1;
    return result;
  }, {} as Record<string, number>);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const researchRequests = await listResearchRequests();
  const queueItems = researchRequests.map((request) => {
    const target = resolveRedDotTarget(request.jurisdiction);
    return {
      id: request.id,
      jurisdiction: request.jurisdiction,
      requesterEmail: request.requester_email,
      status: request.status,
      createdAt: request.created_at,
      notifiedAt: request.notified_at,
      readyMatch: Boolean(target && isLaunchTarget(target)),
    };
  });

  return (
    <main className="research-page">
      <header className="research-topbar">
        <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>RED DOT AUDIT</span><small>PRIVATE RESEARCH</small></Link>
        <Link href="/">Return to scan</Link>
      </header>

      <section className="research-intro">
        <div>
          <p className="eyebrow">PRIVATE RESEARCH SANDBOX</p>
          <h1>Candidate survey</h1>
          <p>A completed public-source qualification pass: the documented control, observed activity, unresolved variance and next evidence needed for each candidate.</p>
        </div>
        <aside>
          <span>SNAPSHOT</span>
          <strong>{snapshot.snapshotDate}</strong>
          <small>Manual source review</small>
        </aside>
      </section>

      <section className="research-totals" aria-label="Survey totals">
        <div><strong>{candidates.length}</strong><span>Reviewed</span></div>
        <div><strong>{totals.SELLABLE || 0}</strong><span>Sellable packages</span></div>
        <div><strong>{totals["DEEP REVIEW"] || 0}</strong><span>Deep review</span></div>
        <div><strong>{totals.HOLD || 0}</strong><span>Hold / remove</span></div>
      </section>

      <section className="research-boundary">
        <b>READINESS, NOT LIABILITY</b>
        <span>{deepSurvey.method}</span>
      </section>

      <ResearchRequestQueue requests={queueItems} />

      <section className="research-shortlist">
        <header>
          <div><p className="eyebrow">PRIVATE REVIEW · NOT YET PUBLIC</p><h2>Proposed Red Dot 25</h2></div>
          <p>{proposed25.method}</p>
        </header>
        <div className="shortlist-table-wrap">
          <div className="shortlist-table-head" aria-hidden="true"><span>Rank</span><span>Jurisdiction</span><span>Score</span><span>Why it clears the screen</span><span>Sources</span></div>
          <div className="shortlist-table">
            {proposed25.proposed.map((target) => {
              const candidate = candidateById.get(target.id);
              return (
                <details className="shortlist-row" key={target.id}>
                  <summary>
                    <span>{String(target.proposedRank).padStart(2, "0")}</span>
                    <span><b>{candidate?.place || target.id}</b><small>{candidate?.agency}</small></span>
                    <span><strong>{target.score}</strong><small>/100 readiness</small></span>
                    <span>{target.valueCase}</span>
                    <span>{target.sourceCount}</span>
                  </summary>
                  <div className="shortlist-detail">
                    <section><span>CONTROL / REPRESENTATION</span><p>{target.control}</p></section>
                    <section><span>OBSERVED ACTIVITY</span><p>{target.observed}</p></section>
                    <section><span>FULL AUTOPSY MUST ACQUIRE</span><p>{target.missingProof}</p></section>
                    <section className="research-sources"><span>REVIEWED SOURCE PATHS</span>{target.sourceUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>{new URL(url).hostname.replace(/^www\./, "")}</a>)}</section>
                    {target.cautions.length > 0 && <section className="shortlist-caution"><span>EDITORIAL CAUTION</span><p>{target.cautions.join(" · ")}</p></section>}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
        <aside className="research-alternates"><b>HELD OUT</b>{proposed25.alternates.map((target) => <span key={target.id}>{candidateById.get(target.id)?.place || target.id} — {target.blockers[0] || "lower comparative market/readiness score"}</span>)}</aside>
      </section>

      <section className="research-inventory">
        <header>
          <div><p className="eyebrow">BATCH 01 · 50 SOURCE REVIEWS</p><h2>Qualified inventory</h2></div>
          <p>Sellable candidates are first. Open a row to inspect both sides of the variance and the exact missing proof.</p>
        </header>

        <div className="research-table-wrap">
          <div className="research-table-head" aria-hidden="true">
            <span>#</span><span>Jurisdiction</span><span>Sources</span><span>Control</span><span>Activity</span><span>Readiness</span><span>Decision</span>
          </div>
          <div className="research-table">
            {candidates.map((candidate) => (
              <details className="research-row" key={candidate.id}>
                <summary>
                  <span>{String(candidate.rank).padStart(2, "0")}</span>
                  <span><b>{candidate.place}</b><small>{candidate.agency}</small></span>
                  <span>{candidate.sourceCount}</span>
                  <span className="positive">FOUND</span>
                  <span>SIGNAL</span>
                  <span><b>{candidate.assessment?.disposition === "SELLABLE" ? 100 : candidate.assessment?.disposition === "DEEP REVIEW" ? 70 : 35}</b><i><em style={{ width: `${candidate.assessment?.disposition === "SELLABLE" ? 100 : candidate.assessment?.disposition === "DEEP REVIEW" ? 70 : 35}%` }} /></i></span>
                  <span className={`research-status ${statusClass[candidate.assessment?.disposition || "HOLD"]}`}>{candidate.assessment?.disposition || "HOLD"}</span>
                </summary>
                <div className="research-detail">
                  <section><span>DOCUMENTED CONTROL / REPRESENTATION</span><p>{candidate.assessment?.control}</p></section>
                  <section><span>OBSERVED ACTIVITY</span><p>{candidate.assessment?.observed}</p></section>
                  <section><span>EXACT MISSING PROOF</span><p>{candidate.assessment?.missingProof}</p></section>
                  <section className="research-sources"><span>REVIEWED SOURCE PATHS</span>{(candidate.assessment?.sourceUrls || candidate.sourceUrls).map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>{new URL(url).hostname.replace(/^www\./, "")}</a>)}</section>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="research-footer"><span>RED DOT AUDIT · INTERNAL WORKBENCH</span><Link href="/">Return to public-facing prototype</Link></footer>
    </main>
  );
}
