"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, BriefcaseBusiness, Check, ChevronRight, CircleDot, Database, FileSearch, Gauge, LoaderCircle, Radar, Settings, Target, Users, X } from "lucide-react";
import type { AdminCounts } from "@/lib/admin/store";
import { resolveRedDotTarget } from "@/app/red-dot-targets";

type Row = Record<string, unknown>;
type Platform = "REDDIT" | "FACEBOOK" | "INSTAGRAM";
type DeliveryFields = { destinationName?: string; destinationAddress?: string; destinationSourceUrl?: string; platform?: Platform; postTitle?: string; postBody?: string };
type Data = { markets: Row[]; targets: Row[]; endpoints: Row[]; cases: Row[]; outreach: Row[]; community: Row[]; census: Row[]; batches: Row[]; signals: Row[]; campaigns: Row[]; activity: Row[]; candidates: Row[]; generations: Row[]; metrics: Row[]; friction: Row[]; audits: Row[]; evidence: Row[]; scanReceipt: Row | null };
type Section = "today" | "survey" | "census" | "monitoring" | "signals" | "audits" | "research" | "cases" | "prospects" | "campaigns" | "results" | "activity" | "settings";
const sections: { id: Section; label: string; icon: typeof Gauge; group: "RUN" | "REFERENCE" }[] = [
  { id: "today", label: "1 · Today", icon: Gauge, group: "RUN" },
  { id: "survey", label: "2 · Acquisition Lab", icon: Database, group: "RUN" },
  { id: "audits", label: "3 · Evidence Review", icon: FileSearch, group: "RUN" },
  { id: "activity", label: "Acquisition Activity", icon: Activity, group: "REFERENCE" },
  { id: "settings", label: "Settings", icon: Settings, group: "REFERENCE" },
];
type RefreshResult = { checked: number; changed: number; relevant: number; feeds: number; candidates: number; signals: number; routed: number; go: number; hold: number; exceptions: number; campaigns: number; watch: number; developing: number; campaignReady: number; saleReady: number; auditsStarted: number };
const refreshSteps = ["Refresh source inventory", "Check monitored endpoints", "Capture 30-day friction + 90-day corroboration", "Deduplicate into a 50-item batch", "Resolve jurisdictions and agencies", "Score current friction", "Open 75+ jurisdiction audits", "Promote source-backed packages"];

export default function AdminConsole({ counts, data, orderStats, system }: { counts: AdminCounts; data: Data; orderStats: { total: number; paid: number }; system: { commerce: string; sendGrid: boolean; stripeWebhook: boolean; scheduler: boolean; automaticMail: boolean; automaticCommunityPosting: boolean } }) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("today");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [campaignRows, setCampaignRows] = useState<Row[]>(data.campaigns);
  const [frictionRows, setFrictionRows] = useState<Row[]>(data.friction);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(() => {
    const first = [...data.campaigns].filter((row) => row.status !== "PROPOSED").sort((a, b) => campaignActionRank(a) - campaignActionRank(b) || campaignTime(b) - campaignTime(a) || Number(b.priority_score || 0) - Number(a.priority_score || 0))[0];
    return first?.id ? String(first.id) : null;
  });
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshStep, setRefreshStep] = useState(-1);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [completedAction, setCompletedAction] = useState<string | null>(null);
  const [queueProgress, setQueueProgress] = useState<{ processed: number; queued: number; evidence: number; incomplete: number } | null>(null);
  function markComplete(key: string) { setCompletedAction(key); window.setTimeout(() => setCompletedAction((current) => current === key ? null : current), 4000); }
  useEffect(() => { setFrictionRows(data.friction); setCampaignRows(data.campaigns); }, [data.friction, data.campaigns]);
  const cards = useMemo(() => [
    ["Clean jurisdiction inputs", counts.censusJurisdictions, "survey"],
    ["Validated facts", counts.metricsAcquired, "audits"],
    ["Evidence-qualified jurisdictions", data.audits.filter((row) => row.status === "EVIDENCE_QUALIFIED").length, "audits"],
  ] as const, [counts, data.audits]);

  async function routeFriction(row: Row, action: "start_audit" | "watch" | "archive") {
    const id = String(row.id); setBusy(`friction:${id}`); setNotice(null);
    try {
      const response = await fetch("/api/admin/friction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const result = await response.json() as { error?: string; friction?: Row; campaign?: Row | null; qualification?: { qualificationState?: string; sourceCount?: number } };
      if (!response.ok) throw new Error(result.error || "Friction action failed.");
      setFrictionRows((rows) => action === "archive" ? rows.filter((item) => String(item.id) !== id) : rows.map((item) => String(item.id) === id ? { ...item, ...(result.friction || {}), state: action === "watch" ? "WATCH" : "AUDIT_STARTED", audit_qualification_state: result.qualification?.qualificationState, audit_source_count: result.qualification?.sourceCount } : item));
      if (result.campaign) setCampaignRows((rows) => [result.campaign!, ...rows.filter((item) => String(item.id) !== String(result.campaign!.id))]);
      setNotice(action === "start_audit" ? result.campaign ? "Audit passed the evidence gate and entered Campaign Desk." : `Audit started. The recombined record is ${result.qualification?.qualificationState || "still developing"}; no campaign was created.` : `Opportunity moved to ${action}.`);
      if (action === "start_audit") setSection(result.campaign ? "campaigns" : "audits");
      markComplete(`friction:${id}`);
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Friction action failed."); }
    finally { setBusy(null); }
  }

  async function processAutomaticQueue() {
    setBusy("queue"); setNotice("Automatic acquisition queue started.");
    let processed = 0; let queued = 1; let evidence = 0; let incomplete = 0;
    try {
      for (let batch = 0; batch < 25 && queued > 0; batch += 1) {
        const response = await fetch("/api/admin/census", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "process_queue", limit: 2 }) });
        const result = await response.json() as { error?: string; processed?: number; counts?: { queued?: number; evidence?: number; incomplete?: number } };
        if (!response.ok) throw new Error(result.error || "Automatic acquisition failed.");
        processed += Number(result.processed || 0); queued = Number(result.counts?.queued || 0); evidence = Number(result.counts?.evidence || 0); incomplete = Number(result.counts?.incomplete || 0);
        setQueueProgress({ processed, queued, evidence, incomplete });
        setNotice(`Automatic acquisition: ${processed} processed · ${queued} queued · ${evidence} evidence-bearing · ${incomplete} incomplete.`);
        if (!result.processed) break;
      }
      markComplete("queue"); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Automatic acquisition failed."); }
    finally { setBusy(null); }
  }

  async function harvestCandidates() {
    setBusy("harvest"); setNotice(null);
    try { const response = await fetch("/api/admin/census", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "harvest" }) }); const result = await response.json() as { error?: string; candidates?: number; pages?: Array<{ status: number; found: number }> }; if (!response.ok) throw new Error(result.error || `National harvest failed (${response.status}).`); setNotice(`National harvest complete: ${result.candidates || 0} candidates queued for automatic evidence acquisition.`); markComplete("harvest"); await processAutomaticQueue(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "National candidate harvest failed."); }
    finally { setBusy(null); }
  }

  async function updateOutreach(id: string, action: "activate" | "discover_destination" | "prepare" | "save_destination" | "save_target" | "approve" | "hold" | "delivered" | "delivered_target", fields?: DeliveryFields) {
    setBusy(`outreach:${id}`); setNotice(null);
    const response = await fetch("/api/admin/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, ...fields }) });
    const result = await response.json() as { error?: string; campaign?: Row };
    setBusy(null);
    if (!response.ok) throw new Error(result.error || "Outreach update failed.");
    if (result.campaign) setCampaignRows((rows) => rows.map((row) => String(row.id) === id ? result.campaign! : row));
    setNotice(`Outreach ${action.replace("_", " ")} complete.`);
    return result.campaign;
  }

  async function activateCampaign(row: Row) {
    const id = String(row.id);
    await updateOutreach(id, "activate");
    setExpandedCampaignId(id);
    setSection("campaigns");
  }

  async function runMarketRefresh() {
    setRefreshOpen(true); setRefreshStep(0); setRefreshResult(null); setRefreshError(null); setBusy("refresh");
    try {
      const censusResponse = await fetch("/api/admin/census", { method: "POST" });
      if (!censusResponse.ok) throw new Error("Source inventory refresh failed.");
      setRefreshStep(1);
      const monitorResponse = await fetch("/api/admin/monitor/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 30 }) });
      const monitor = await monitorResponse.json() as { error?: string; batch?: { checked: number; changes: number; relevant: number } };
      if (!monitorResponse.ok) throw new Error(monitor.error || "Endpoint monitoring failed.");
      setRefreshStep(2);
      const discoveryResponse = await fetch("/api/admin/discovery/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
      const discovery = await discoveryResponse.json() as { error?: string; discovery?: Partial<RefreshResult> };
      if (!discoveryResponse.ok) throw new Error(discovery.error || "Opportunity discovery failed.");
      for (let step = 3; step < refreshSteps.length; step += 1) setRefreshStep(step);
      const campaignResponse = await fetch("/api/admin/outreach");
      const campaignResult = await campaignResponse.json() as { campaigns?: Row[] };
      if (campaignResult.campaigns) {
        setCampaignRows(campaignResult.campaigns);
        const first = [...campaignResult.campaigns].filter((row) => row.status !== "PROPOSED").sort((a, b) => campaignActionRank(a) - campaignActionRank(b) || campaignTime(b) - campaignTime(a) || Number(b.priority_score || 0) - Number(a.priority_score || 0))[0];
        setExpandedCampaignId(first?.id ? String(first.id) : null);
      }
      const d = discovery.discovery || {};
      setRefreshResult({ checked: monitor.batch?.checked || 0, changed: monitor.batch?.changes || 0, relevant: monitor.batch?.relevant || 0, feeds: d.feeds || 0, candidates: d.candidates || 0, signals: d.signals || 0, routed: d.routed || 0, go: d.go || 0, hold: d.hold || 0, exceptions: d.exceptions || 0, campaigns: d.campaigns || 0, watch: d.watch || 0, developing: d.developing || 0, campaignReady: d.campaignReady || 0, saleReady: d.saleReady || 0, auditsStarted: d.auditsStarted || 0 });
      setRefreshStep(refreshSteps.length);
      setNotice("Market refresh complete. Review the routed opportunities.");
      router.refresh();
    } catch (error) { setRefreshError(error instanceof Error ? error.message : "Market refresh failed."); }
    finally { setBusy(null); }
  }

  async function resetGeneration() {
    if (!window.confirm("Archive and clear all derived scans, evidence, audits, campaigns and source inventory? Purchases, access, genuine inquiries and sent-outreach history will be preserved. The new acquisition cohort will begin empty.")) return;
    setBusy("generation"); setNotice(null);
    try {
      const response = await fetch("/api/admin/generation/reset", { method: "POST" }); const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Clean generation failed.");
      setFrictionRows([]); setCampaignRows([]); setNotice("Derived intelligence cleared. The acquisition cohort is empty and ready for brand-new jurisdictions."); markComplete("generation"); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Clean generation failed."); }
    finally { setBusy(null); }
  }

  async function runAction(name: "census" | "monitor") {
    setBusy(name); setNotice(null);
    try {
      const response = await fetch(name === "census" ? "/api/admin/census" : "/api/admin/monitor/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: name === "monitor" ? JSON.stringify({ limit: 30 }) : undefined });
      const result = await response.json() as { error?: string; jurisdictions?: number; endpoints?: number; batch?: { checked: number; changes: number; relevant: number } };
      if (!response.ok) throw new Error(result.error || "Action failed.");
      setNotice(name === "census" ? `${result.jurisdictions} jurisdictions and ${result.endpoints} source endpoints loaded.` : `${result.batch?.checked || 0} checked · ${result.batch?.changes || 0} changed · ${result.batch?.relevant || 0} relevant.`);
      setBusy(null);
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Action failed."); setBusy(null); }
  }

  return <div className="admin-shell"><aside className="admin-nav"><p>RUN THE MARKET</p>{sections.filter((item) => item.group === "RUN").map(({ id, label, icon: Icon }) => <button className={section === id ? "active" : ""} onClick={() => setSection(id)} key={id}><Icon />{label}</button>)}<p className="admin-nav-group">REFERENCE</p>{sections.filter((item) => item.group === "REFERENCE").map(({ id, label, icon: Icon }) => <button className={section === id ? "active" : ""} onClick={() => setSection(id)} key={id}><Icon />{label}</button>)}<div className="admin-lock"><CircleDot />Human approval remains required before outreach.</div></aside><section className="admin-workspace">
    {notice && <div className="admin-notice">{notice}</div>}
    {section === "today" && <><Title eyebrow="CANDIDATE ACQUISITION ONLY" title="Build the national Flock deployment list." action={<div className="admin-title-actions"><button onClick={resetGeneration} disabled={Boolean(busy)}><ScriptLabel running={busy === "generation"} complete={completedAction === "generation"} idle="CLEAR DERIVED DATA" runningText="RUNNING" /></button><button className="admin-primary admin-refresh-button" onClick={() => setSection("survey")}>OPEN NATIONAL HARVESTER</button></div>} /><div className="admin-summary-list">{cards.map(([label, value, destination]) => <button onClick={() => setSection(destination)} key={label}><strong>{value}</strong><span>{label}</span><ChevronRight /></button>)}</div><div className="admin-checkin"><div><b>DOWNSTREAM FROZEN</b><strong>{counts.censusJurisdictions} deployment candidates · {counts.metricsAcquired} sourced camera facts</strong><span>Nothing advances until the national source produces named agencies with visible provenance.</span></div><button onClick={() => setSection("survey")}>Open national harvester <ChevronRight /></button></div></>}
    {section === "survey" && <><Title eyebrow="LIVE NATIONAL SOURCE" title="Flock Deployment Harvester" badge={`${data.census.length} CANDIDATES`} action={<button className="admin-primary" disabled={Boolean(busy)} onClick={harvestCandidates}><ScriptLabel running={busy === "harvest" || busy === "queue"} complete={completedAction === "harvest" || completedAction === "queue"} idle="RUN NATIONAL HARVEST" runningText={busy === "queue" ? "RUNNING · ACQUIRING EVIDENCE" : "RUNNING · READING NATIONAL SOURCE"} /></button>} /><p className="admin-section-copy">Harvests named Flock Safety ALPR agencies, queues every candidate automatically, binds its evidence to the source candidate, and ranks completed acquisitions in Evidence Review.</p>{queueProgress && <div className="admin-notice">QUEUE PROGRESS · {queueProgress.processed} processed · {queueProgress.queued} queued · {queueProgress.evidence} evidence-bearing · {queueProgress.incomplete} incomplete</div>}<CandidateLedger rows={data.census} /></>}
    {section === "census" && <><Title eyebrow="ALPR CUSTOMER UNIVERSE" title="Census" badge={`${data.census.length} JURISDICTIONS`} action={<button className="admin-primary" onClick={() => runAction("census")} disabled={Boolean(busy)}>{busy === "census" ? "LOADING…" : data.census.length ? "REFRESH RESEARCH SEED" : "LOAD RESEARCH SEED"}</button>} /><p className="admin-section-copy">Broad, thin deployment identification. Confidence describes whether sources establish an operating ALPR customer—not misconduct.</p><DataTable rows={data.census} keys={["jurisdiction","agency","vendor_system","confidence","evidence_count","research_readiness"]} empty="No census records loaded." /></>}
    {section === "monitoring" && <><Title eyebrow="DID ANYTHING CHANGE?" title="Monitoring batches" badge={system.scheduler ? "SCHEDULED" : "MANUAL MODE"} action={<button className="admin-primary" onClick={() => runAction("monitor")} disabled={Boolean(busy) || !data.endpoints.length}>{busy === "monitor" ? "CHECKING…" : "RUN 30-SOURCE CHANGE GRAB"}</button>} /><p className="admin-section-copy">Each grab records what was checked, what changed, and what cleared the relevance gate. Discovery coverage now watches Flock Safety and the Axon family—including Fusus, Vehicle Intelligence and Draft One. First pulls establish fingerprints and create no false signals.</p><DataTable rows={data.batches} keys={["label","status","endpoints_checked","changes_detected","relevant_signals","completed_at"]} empty="Load the Census seed, then run the first controlled change grab." /></>}
    {section === "research" && <Panel eyebrow="CANONICAL WORKBENCH" title="Research"><p>Signals move into the existing source-review system. Radar never publishes a finding directly.</p><Link className="admin-primary" href="/research">Open Research workbench <ChevronRight /></Link></Panel>}
    {section === "cases" && <><Title eyebrow="DURABLE INTELLIGENCE" title="Case Files" badge={`${data.cases.length} FILES`} /><DataTable rows={data.cases} keys={["title","status","jurisdiction","agency","vendor","updated_at"]} empty="Case files appear here after Research promotion. Existing public reports remain unchanged." /></>}
    {section === "signals" && <><Title eyebrow="PRIORITY OVERLAY" title="Current Friction" badge="LIVE VOICE" action={<button className="admin-primary" onClick={runMarketRefresh} disabled={Boolean(busy)}>{busy === "refresh" ? "SCANNING…" : "RUN FRICTION SCAN"}</button>} /><p className="admin-section-copy">Complaints, reporting and public flags identify jurisdictions to accelerate. They never replace the authority-versus-operation audit.</p><FrictionQueue rows={frictionRows.filter((row) => row.channel !== "SYSTEMATIC")} receipt={data.scanReceipt} busy={busy} onAction={routeFriction} /></>}
    {section === "audits" && <><Title eyebrow="SOURCE · VALUE · DATE · PROVENANCE" title="Evidence Review" badge={`${data.audits.length} ACQUISITIONS`} /><p className="admin-section-copy">Only source-backed facts belong here. Blank statistics remain acquisition failures; they are not scored, packaged or promoted.</p><AuditQueue rows={frictionRows} audits={data.audits} metrics={data.metrics} evidence={data.evidence} busy={busy} completedAction={completedAction} onRescan={(row) => routeFriction(row, "start_audit")} onOpenCampaign={() => setSection("campaigns")} /></>}
    {section === "campaigns" && <><Title eyebrow="DOWNSTREAM FROZEN" title="Campaign Desk" badge="ACQUISITION FIRST" /><div className="admin-empty">Campaign creation is locked while the jurisdiction acquisition cohort is built. Only source-backed authority and operating data matter in this phase.</div></>}
    {section === "results" && <><Title eyebrow="CURRENT GENERATION" title="Results" badge="INTELLIGENCE → CAMPAIGN → SALE" /><div className="admin-results-grid"><span><strong>{counts.currentSources}</strong>Current sources</span><span><strong>{counts.metricsAcquired}</strong>Sourced statistics</span><span><strong>{counts.officialContacts}</strong>Verified contacts</span><span><strong>{counts.watch}</strong>Watch</span><span><strong>{counts.developing}</strong>Developing</span><span><strong>{counts.campaignReady}</strong>Campaign-ready</span><span><strong>{counts.saleReady}</strong>Sale-ready</span><span><strong>{orderStats.paid}</strong>Paid reports</span></div><p className="admin-section-copy">A single signal stays in Watch. Campaigns require at least four current, deduplicated sources plus either two independent publishers or an official anchor. Sale-ready additionally requires an 80+ score and at least two sourced operating statistics.</p><DataTable rows={data.candidates} keys={["jurisdiction","issue_type","qualification_state","score","source_count","independent_source_count","metric_count","newest_source_at"]} empty="Run the clean generation to establish current results." /></>}
    {section === "activity" && <><Title eyebrow="SYSTEM MEMORY" title="Activity log" badge={`${data.activity.length} RECENT EVENTS`} /><DataTable rows={data.activity} keys={["created_at","actor","event_type","entity_type","summary"]} empty="System and human actions will appear here." /></>}
    {section === "settings" && <><Title eyebrow="OPERATIONAL LOCKS" title="Settings" /><div className="admin-settings"><Status label="Commerce configuration" value={system.commerce} good={system.commerce !== "unconfigured"} /><Status label="SendGrid delivery" value={system.sendGrid ? "Configured" : "Missing"} good={system.sendGrid} /><Status label="Stripe webhook" value={system.stripeWebhook ? "Configured" : "Missing"} good={system.stripeWebhook} /><Status label="Radar scheduler" value={system.scheduler ? "Configured" : "Manual mode"} good={false} /><Status label="Production marketing mail" value="Locked" good /><Status label="Automatic community posting" value="Disabled" good /></div></>}
  </section>{refreshOpen && <RefreshModal step={refreshStep} result={refreshResult} error={refreshError} onClose={() => busy !== "refresh" && setRefreshOpen(false)} onResults={() => { setRefreshOpen(false); setSection("signals"); }} />}</div>;
}

function RefreshModal({ step, result, error, onClose, onResults }: { step: number; result: RefreshResult | null; error: string | null; onClose: () => void; onResults: () => void }) {
  return <div className="admin-modal-backdrop" role="presentation"><section className="admin-refresh-modal" role="dialog" aria-modal="true" aria-labelledby="market-refresh-title">
    <header><div><p>AUTOMATED MARKET ENGINE</p><h2 id="market-refresh-title">{result ? "Refresh complete." : error ? "Refresh stopped." : "Finding today’s opportunities…"}</h2></div>{(result || error) && <button onClick={onClose} aria-label="Close refresh"><X /></button>}</header>
    <div className="admin-refresh-steps">{refreshSteps.map((label, index) => <div className={index < step || result ? "complete" : index === step && !error ? "running" : "waiting"} key={label}><span>{index < step || result ? <Check /> : index === step && !error ? <LoaderCircle className="spin" /> : index + 1}</span><b>{label}</b><small>{index < step || result ? "DONE" : index === step && !error ? "RUNNING" : "WAITING"}</small></div>)}</div>
    {error && <div className="admin-refresh-error">{error}<button onClick={onClose}>Close and try again</button></div>}
    {result && <><div className="admin-refresh-outcomes"><span><strong>{result.auditsStarted}</strong>Audits opened</span><span><strong>{result.campaignReady}</strong>Campaign-ready</span><span><strong>{result.developing}</strong>Developing</span><span><strong>{result.watch}</strong>Watch</span></div><p className="admin-refresh-detail">{result.candidates} items in the current batch · {result.checked} endpoints checked · {result.changed} changed · {result.feeds} live feeds</p><footer><button className="admin-primary" onClick={onResults}>OPEN FRICTION DESK</button></footer></>}
  </section></div>;
}

function Title({ eyebrow, title, badge, action }: { eyebrow: string; title: string; badge?: string; action?: React.ReactNode }) { return <div className="admin-title"><div><p>{eyebrow}</p><h1>{title}</h1></div>{action || (badge && <span>{badge}</span>)}</div>; }
function ScriptLabel({ running, complete, idle, runningText = "RUNNING" }: { running: boolean; complete: boolean; idle: string; runningText?: string }) { return <span className={`admin-script-label ${running ? "running" : complete ? "complete" : ""}`}>{running ? <><LoaderCircle className="spin" />{runningText}</> : complete ? <><Check />COMPLETE</> : idle}</span>; }
function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <div className="admin-panel"><p>{eyebrow}</p><h1>{title}</h1>{children}</div>; }
function Status({ label, value, good }: { label: string; value: string; good: boolean }) { return <div><span>{label}</span><b className={good ? "good" : "waiting"}>{value}</b></div>; }
function tableColumns(keys: string[]) {
  if (keys.includes("lead_reason")) return "1.05fr 1.15fr .78fr 2.45fr .58fr .72fr";
  if (keys.includes("vendor_system")) return "1.05fr 1.25fr 1.05fr .75fr .62fr .78fr";
  if (keys.includes("source_url")) return "1.45fr .75fr .65fr 2fr .9fr";
  if (keys.includes("summary")) return ".9fr .75fr .85fr .8fr 2.7fr";
  return `repeat(${keys.length}, minmax(0, 1fr))`;
}
function DataTable({ rows, keys, empty }: { rows: Row[]; keys: string[]; empty: string }) { if (!rows.length) return <div className="admin-empty">{empty}</div>; const columns = tableColumns(keys); return <div className="admin-table"><div style={{ gridTemplateColumns: columns }}>{keys.map((key) => <b key={key}>{key.replaceAll("_", " ")}</b>)}</div>{rows.map((row, index) => <div style={{ gridTemplateColumns: columns }} key={String(row.id || index)}>{keys.map((key) => <span key={key}>{String(row[key] ?? "—")}</span>)}</div>)}</div>; }

function routeDetails(row: Row) {
  const route = String(row.marketing_route || "ROUTING PENDING");
  if (route.startsWith("SOCIAL")) return { channel: "REDDIT · INSTAGRAM · FACEBOOK", destination: "Active conversation + local social audiences", piece: "DROP-IN SOCIAL MARKET PACKAGE", next: "Build social package" };
  if (route.startsWith("PROFESSIONAL")) return { channel: "PROFESSIONAL EMAIL", destination: "Local attorneys · journalists · advocates", piece: "SOURCE-LINKED EMAIL INTRODUCTION", next: "Resolve recipients" };
  return { channel: "EMAIL · EDITORIAL · PARTNER OUTREACH", destination: "National legal, media and civil-liberties partners", piece: "NATIONAL ISSUE INTRODUCTION", next: "Build partner package" };
}

function FrictionQueue({ rows, receipt, busy, onAction }: { rows: Row[]; receipt: Row | null; busy: string | null; onAction: (row: Row, action: "start_audit" | "watch" | "archive") => void }) {
  if (!rows.length) { const rejected = (receipt?.rejected || {}) as Row; return <div className="admin-scan-empty"><strong>No live friction cleared the full routing gate.</strong>{receipt ? <><p>{String(receipt.checkedFeeds || 0)} of {String(receipt.totalFeeds || 0)} feeds succeeded · {String(receipt.failedFeeds || 0)} failed · {String(receipt.fetchedItems || 0)} items read · {String(receipt.relevant || 0)} relevant · {String(receipt.jurisdictionQualified || 0)} jurisdiction-qualified</p><small>Rejected: {String(rejected.noTechnology || 0)} outside technology scope · {String(rejected.noFriction || 0)} lacked a friction event · {String(rejected.stale || 0)} stale · {String(rejected.noUrl || 0)} missing source URL</small></> : <p>No completed friction-scan receipt exists yet. Run the friction scan.</p>}</div>; }
  return <div className="admin-friction-queue">{rows.map((row) => { const id = String(row.id); const started = row.state === "AUDIT_STARTED"; return <article key={id}>
    <span className={`admin-friction-score ${String(row.state).toLowerCase()}`}><b>{String(row.friction_score || 0)}</b><small>{String(row.state || "WATCH").replaceAll("_", " ")}</small></span>
    <div className="admin-friction-main"><small>{String(row.issue_type || "PUBLIC CONCERN")} · {String(row.voice_type || "PUBLIC VOICE")}</small><strong>{String(row.jurisdiction || "Jurisdiction pending")}</strong><p>{String(row.complaint_summary || "Current public friction requires review.")}</p><em>{String(row.source_count || 1)} source(s) · {String(row.independent_source_count || 1)} publisher(s) · {String(row.channel || "PUBLIC")}</em></div>
    <div className="admin-friction-actions"><a href={String(row.origin_url)} target="_blank" rel="noreferrer">OPEN SOURCE</a><button className="admin-primary" disabled={Boolean(busy) || started} onClick={() => onAction(row, "start_audit")}>{started ? "AUDIT STARTED" : busy === `friction:${id}` ? "RECOMBINING…" : "START AUDIT"}</button><button className={row.state === "WATCH" ? "selected" : ""} disabled={Boolean(busy) || row.state === "WATCH"} onClick={() => onAction(row, "watch")}>{row.state === "WATCH" ? "WATCHING" : "WATCH"}</button><button disabled={Boolean(busy)} onClick={() => onAction(row, "archive")}>ARCHIVE</button></div>
  </article>; })}</div>;
}

type CandidateSort = "most" | "least";

function CandidateLedger({ rows }: { rows: Row[] }) {
  const [sort, setSort] = useState<CandidateSort>("most");
  if (!rows.length) return <div className="admin-empty">No deployment candidates yet. Run the national harvester; a zero result will remain visible as a failed source run.</div>;
  const sorted = [...rows].sort((a, b) => {
    const aCount = Number(a.device_count); const bCount = Number(b.device_count); const aKnown = Number.isFinite(aCount) && aCount > 0; const bKnown = Number.isFinite(bCount) && bCount > 0;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (aKnown && bKnown && aCount !== bCount) return sort === "most" ? bCount - aCount : aCount - bCount;
    return String(a.agency || "").localeCompare(String(b.agency || ""));
  });
  const queueCounts = (status: string) => rows.filter((row) => String(row.acquisition_status || "QUEUED") === status).length;
  return <><div className="admin-candidate-toolbar"><div><small>CAMERA COUNT</small><strong>{rows.filter((row) => Number(row.device_count) > 0).length} quantified · {rows.filter((row) => !Number(row.device_count)).length} deployment-only</strong></div><div><small>AUTOMATIC ACQUISITION</small><strong>{queueCounts("ACQUIRING")} running · {queueCounts("QUEUED")} queued · {rows.filter((row) => ["COMPLETE", "EVIDENCE_FOUND", "NO_GAP"].includes(String(row.acquisition_status))).length} evidence-bearing</strong></div><nav aria-label="Sort deployment candidates"><button className={sort === "most" ? "active" : ""} onClick={() => setSort("most")}>MOST → LEAST</button><button className={sort === "least" ? "active" : ""} onClick={() => setSort("least")}>LEAST → MOST</button></nav></div><div className="admin-candidate-ledger">{sorted.map((row) => { const id = String(row.id); const urls = (() => { try { return JSON.parse(String(row.source_urls_json || "[]")) as string[]; } catch { return []; } })(); const status = String(row.acquisition_status || "QUEUED").replaceAll("_", " "); return <article key={id}><header><div><small>{String(row.confidence || "NATIONAL SOURCE")} · CANDIDATE {id.slice(0, 8)}</small><strong>{String(row.agency)}</strong><span>{String(row.jurisdiction)} · {String(row.vendor_system)}</span></div><b>{row.device_count ? `${String(row.device_count)} CAMERAS` : "DEPLOYMENT LISTED"}</b></header><p>{String(row.lead_reason || "Flock Safety ALPR deployment candidate")}</p><footer><span>{String(row.evidence_count || urls.length)} SOURCE LINK{Number(row.evidence_count || urls.length) === 1 ? "" : "S"}</span>{urls.slice(0, 4).map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>{index === 0 ? "ATLAS RECORD" : `SUPPORTING SOURCE ${index}`} ↗</a>)}<strong>{status}{row.acquisition_terminal_reason ? ` · ${String(row.acquisition_terminal_reason).replaceAll("_", " ")}` : ""}</strong></footer></article>; })}</div></>;
}

function SurveyQueue({ rows, audits, busy, completedAction, onAudit }: { rows: Row[]; audits: Row[]; busy: string | null; completedAction: string | null; onAudit: (row: Row) => void }) {
  if (!rows.length) return <div className="admin-empty">Load the source inventory to begin systematic jurisdiction surveys.</div>;
  return <div className="admin-friction-queue">{rows.map((row) => { const key = String(row.jurisdiction || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); const audit = audits.find((item) => String(item.normalized_jurisdiction) === key); const id = String(row.id); const active = Boolean(audit); return <article key={id}>
    <span className={`admin-friction-score ${active ? "audit_started" : "watch"}`}><b>{String(row.evidence_count || 0)}</b><small>{active ? "AUDIT OPEN" : "SURVEY"}</small></span>
    <div className="admin-friction-main"><small>{String(row.vendor_system || "ALPR")} · {String(row.confidence || "UNVERIFIED")}</small><strong>{String(row.jurisdiction)}</strong><p>{String(row.agency)} · {String(row.lead_reason || "Establish documented authority and actual operating statistics.")}</p><em>{String(row.evidence_count || 0)} seed source(s) · {audit ? String(audit.status).replaceAll("_", " ") : "not yet audited"}</em></div>
    <div className="admin-friction-actions"><button className="admin-primary" disabled={Boolean(busy)} onClick={() => onAudit(row)}><ScriptLabel running={busy === `survey:${id}`} complete={completedAction === `survey:${id}`} idle={active ? "CONTINUE SURVEY" : "AUDIT JURISDICTION"} runningText="RUNNING · SURVEYING" /></button></div>
  </article>; })}</div>;
}

type AuditFilter = "TOP OFFENDERS" | "STATISTICAL OUTLIERS" | "MATERIAL GAPS" | "NO GAP" | "INCOMPLETE" | "REJECTED";
const auditFilters: AuditFilter[] = ["TOP OFFENDERS", "STATISTICAL OUTLIERS", "MATERIAL GAPS", "NO GAP", "INCOMPLETE", "REJECTED"];

function numericMetric(value: unknown) { const match = String(value || "").replaceAll(",", "").match(/\d+(?:\.\d+)?/); return match ? Number(match[0]) : 0; }
function isStatisticalOutlier(metrics: Row[]) { return metrics.some((metric) => { const label = String(metric.label || metric.metric_label || metric.metric_key || "").toLowerCase(); const value = numericMetric(metric.value || metric.metric_value); return (/camera|device/.test(label) && value >= 100) || (/search|quer/.test(label) && value >= 10_000) || (/detect|read|alert/.test(label) && value >= 1_000_000) || (/outside|agenc|access|user/.test(label) && value >= 25); }); }
function auditRating(audit: Row | undefined, metrics: Row[], evidenceCount: number) { return Math.min(100, (audit?.authority_text ? 15 : 0) + (audit?.observed_text ? 15 : 0) + (audit?.discrepancy_text ? 30 : 0) + Math.min(20, metrics.length * 5) + Math.min(20, evidenceCount * 4)); }
function auditVerdict(audit: Row | undefined, metrics: Row[]): AuditFilter {
  const status = String(audit?.status || "");
  if (status === "REJECTED") return "REJECTED";
  const outlier = isStatisticalOutlier(metrics);
  if (audit?.discrepancy_text && audit?.authority_text && audit?.observed_text && metrics.length >= 2 && outlier) return "TOP OFFENDERS";
  if (audit?.discrepancy_text && (audit?.authority_text || audit?.observed_text)) return "MATERIAL GAPS";
  if (outlier) return "STATISTICAL OUTLIERS";
  if (status === "BASELINE_COMPLETE") return "NO GAP";
  return "INCOMPLETE";
}

function AuditQueue({ rows, audits: auditRows, metrics, evidence, busy, completedAction, onRescan, onOpenCampaign }: { rows: Row[]; audits: Row[]; metrics: Row[]; evidence: Row[]; busy: string | null; completedAction: string | null; onRescan: (row: Row) => void; onOpenCampaign: () => void }) {
  const [filter, setFilter] = useState<AuditFilter>("TOP OFFENDERS");
  const audits = rows.filter((row) => row.state === "AUDIT_STARTED");
  if (!audits.length) return <div className="admin-empty">No candidate acquisitions have completed yet. Evidence Review fills automatically as the acquisition queue runs.</div>;
  const ranked = audits.map((row) => { const id = String(row.id); const audit = auditRows.find((item) => String(item.friction_id) === id); const jurisdiction = String(row.jurisdiction || "Jurisdiction unresolved"); const target = resolveRedDotTarget(jurisdiction); const key = jurisdiction.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); const metricIdentity = (audit?.census_id ? String(audit.census_id) : null) || key; const sourcedMetrics = metrics.filter((metric) => String(metric.census_id ?? metric.normalized_jurisdiction) === metricIdentity); const displayMetrics = sourcedMetrics.length ? sourcedMetrics : (target?.publicMetrics || []).map((metric) => ({ value: metric.value, label: metric.label, source_url: target.sources[0]?.url })); const auditEvidence = evidence.filter((item) => String(item.audit_id) === String(audit?.id)); return { row, id, audit, jurisdiction, target, displayMetrics, auditEvidence, verdict: auditVerdict(audit, displayMetrics), rating: auditRating(audit, displayMetrics, auditEvidence.filter((item) => item.status === "VERIFIED_AUDIT_EVIDENCE").length) }; }).sort((a, b) => b.rating - a.rating);
  const counts = Object.fromEntries(auditFilters.map((value) => [value, ranked.filter((item) => item.verdict === value).length])); const selectedFilter = counts[filter] ? filter : auditFilters.find((value) => counts[value]) || filter; const visible = ranked.filter((item) => item.verdict === selectedFilter);
  return <><div className="admin-evidence-heading"><small>EVIDENCE RANKING</small><strong>Jurisdictions by finding</strong></div><div className="admin-evidence-filters" aria-label="Evidence review filters">{auditFilters.map((value) => <button className={selectedFilter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}><strong>{String(counts[value] || 0)}</strong><span>{value}</span></button>)}</div>{!visible.length ? <div className="admin-empty">No jurisdictions currently qualify as {selectedFilter.toLowerCase()}.</div> : <div className="admin-jurisdiction-audits">{visible.map(({ row, id, audit, jurisdiction, target, displayMetrics, auditEvidence, verdict, rating }) => { const verifiedEvidence = auditEvidence.filter((item) => item.status === "VERIFIED_AUDIT_EVIDENCE"); const verifiedContacts = auditEvidence.filter((item) => item.status === "VERIFIED_CONTACT"); const verifiedComplaints = auditEvidence.filter((item) => item.status === "VERIFIED_COMPLAINT"); const discoveryGateways = auditEvidence.filter((item) => item.status === "DISCOVERY_GATEWAY"); const pendingDocuments = auditEvidence.filter((item) => item.status === "NEEDS_DOCUMENT_PARSE"); const campaignReady = ["CAMPAIGN_READY", "SALE_READY"].includes(String(row.audit_qualification_state)); return <article key={id}>
    <header><div><small>{String(row.issue_type || "CURRENT ISSUE")} · CANDIDATE {String(audit?.census_id || "UNBOUND").slice(0, 8)}</small><h2>{jurisdiction}</h2><p>{String(audit?.agency || target?.agency || "Agency not yet resolved")} · {target ? "Flock Safety / ALPR" : "System and operator require verification"}</p></div><div className="admin-verdict"><b>{rating} EVIDENCE RATING</b><span className={verdict === "TOP OFFENDERS" || verdict === "MATERIAL GAPS" ? "baseline" : "acquiring"}>{verdict}</span></div></header>
    <section className="admin-audit-stats">{displayMetrics.length ? displayMetrics.slice(0, 6).map((metric, index) => <a href={String(metric.source_url || target?.sources[0]?.url || row.origin_url)} target="_blank" rel="noreferrer" key={`${String(metric.label)}-${index}`}><strong>{String(metric.value)}</strong><span>{String(metric.label)}</span><small>SOURCE ↗</small></a>) : ["CAMERAS / DEVICES", "SEARCHES / QUERIES", "DETECTIONS / READS", "OUTSIDE ACCESS"].map((label) => <div key={label}><strong>—</strong><span>{label}</span><small>NOT YET ACQUIRED</small></div>)}</section>
    <section className="admin-audit-comparison"><div><small>DOCUMENTED AUTHORITY / CONTROL</small><p>{String(audit?.authority_text || target?.control || "The controlling contract, policy, approval record and permitted-use language have not yet been acquired.")}</p>{audit?.authority_source_url && <a href={String(audit.authority_source_url)} target="_blank" rel="noreferrer">AUTHORITY SOURCE ↗</a>}</div><div><small>OBSERVED USE / REPORTED EVENT</small><p>{String(audit?.observed_text || target?.observed || row.complaint_summary || "The originating friction source is the current lead; operational use remains unverified.")}</p>{audit?.observed_source_url && <a href={String(audit.observed_source_url)} target="_blank" rel="noreferrer">USAGE SOURCE ↗</a>}</div><div className="delta"><small>UNRESOLVED DISCREPANCY</small><p>{String(audit?.discrepancy_text || target?.teaser || "Authority and observed use are not both sourced yet; no discrepancy is asserted.")}</p></div></section>
    <div className="admin-acquisition-ledger"><small>ACQUISITION LEDGER</small><strong>{verifiedEvidence.length} useful audit evidence · {verifiedContacts.length} contacts · {verifiedComplaints.length} complaints · {discoveryGateways.length} discovery gateways · {pendingDocuments.length} documents awaiting parse · {auditEvidence.filter((item) => item.status === "REJECTED").length} rejected</strong>{auditEvidence.slice(0, 8).map((item) => <a href={String(item.source_url)} target="_blank" rel="noreferrer" key={String(item.id)}><b>{String(item.evidence_type).replaceAll("_", " ")}</b><span>{String(item.title || item.publisher_domain)}</span><em>{String(item.status).replaceAll("_", " ")}</em></a>)}</div>
    <footer><div><small>MISSING PROOF / GENUINE UNKNOWNS</small><strong>{String(audit?.missing_proof || target?.missingProof || "Agency identity; deployment size; contract and authorization; query, retention, sharing and audit records; responsible users and outside organizations.")}</strong></div><div className="admin-audit-sources"><small>{String(audit?.source_count || 0)} USEFUL AUDIT SOURCE{Number(audit?.source_count || 0) === 1 ? "" : "S"}</small>{verifiedEvidence.slice(0, 4).map((source) => <a href={String(source.source_url)} target="_blank" rel="noreferrer" key={String(source.id)}>{String(source.source_class)} · {String(source.evidence_type)}</a>)}</div><aside><b className={campaignReady ? "passed" : "developing"}>{campaignReady ? "CAMPAIGN READY" : "ACQUISITION EXHAUSTED"}</b><button className="admin-primary" disabled={Boolean(busy)} onClick={() => onRescan(row)}><ScriptLabel running={busy === `friction:${id}`} complete={completedAction === `friction:${id}`} idle="RECHECK SOURCES" runningText="RUNNING · SEARCHING + VERIFYING" /></button>{campaignReady && <button className="admin-primary" onClick={onOpenCampaign}>OPEN CAMPAIGN DESK</button>}</aside></footer>
  </article>; })}</div>}</>;
}

type CampaignAction = (id: string, action: "activate" | "discover_destination" | "prepare" | "save_destination" | "save_target" | "approve" | "hold" | "delivered" | "delivered_target", fields?: DeliveryFields) => Promise<Row | undefined>;

function campaignStage(row: Row) {
  if (row.approval_status === "HOLD") return "HOLDING";
  if (row.closed_at) return "CLOSED / DEAD END";
  if (row.follow_up_at) return "FOLLOW-UP DUE";
  if (row.delivered_at || row.approval_status === "APPROVED") return "LIVE · WATCHING";
  return "ACTION NOW";
}

type CampaignQueueFilter = "action" | "today" | "signal" | "approval" | "live" | "all";

function campaignTime(row: Row) {
  return new Date(String(row.updated_at || row.created_at || 0)).getTime();
}

function isToday(row: Row) {
  const value = campaignTime(row);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return value >= start;
}

function needsCampaignAction(row: Row) {
  return !row.closed_at && row.approval_status !== "HOLD" && !row.delivered_at;
}

function campaignActionRank(row: Row) {
  if (row.follow_up_at) return 0;
  if (isToday(row) && Number(row.priority_score || 0) >= 80) return 1;
  if (isToday(row)) return 2;
  if (needsCampaignAction(row) && row.draft_status !== "READY_REVIEW") return 3;
  if (needsCampaignAction(row) && row.approval_status !== "APPROVED") return 4;
  if (needsCampaignAction(row)) return 5;
  if (row.delivered_at) return 6;
  return 7;
}

function CampaignDesk({ rows, expandedId, onToggle, busy, onAction }: { rows: Row[]; expandedId: string | null; onToggle: (id: string) => void; busy: string | null; onAction: CampaignAction }) {
  const [filter, setFilter] = useState<CampaignQueueFilter>("action");
  if (!rows.length) return <div className="admin-empty">No qualified opportunity has become a campaign yet.</div>;
  const filteredRows = rows.filter((row) => filter === "all"
    || (filter === "action" && needsCampaignAction(row))
    || (filter === "today" && isToday(row))
    || (filter === "approval" && row.draft_status === "READY_REVIEW" && row.approval_status !== "APPROVED")
    || (filter === "live" && Boolean(row.delivered_at))
    || filter === "signal");
  const currentRows = [...filteredRows].sort((a, b) => filter === "signal"
    ? Number(b.priority_score || 0) - Number(a.priority_score || 0) || campaignTime(b) - campaignTime(a)
    : campaignActionRank(a) - campaignActionRank(b) || campaignTime(b) - campaignTime(a) || Number(b.priority_score || 0) - Number(a.priority_score || 0));
  const jurisdictions = Array.from(new Set(currentRows.map((row) => String(row.jurisdiction || "Jurisdiction pending"))));
  const actionCount = rows.filter(needsCampaignAction).length; const todayCount = rows.filter(isToday).length; const followUpCount = rows.filter((row) => Boolean(row.follow_up_at)).length;
  return <><div className="admin-campaign-queue-head"><div><small>ACTION QUEUE</small><strong>{actionCount} need action · {todayCount} new today · {followUpCount} follow-ups due</strong></div><nav aria-label="Campaign queue filters">{([['action','Needs action'],['today','New today'],['signal','Highest signal'],['approval','Awaiting approval'],['live','Live'],['all','All']] as [CampaignQueueFilter,string][]).map(([value,label]) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</nav></div>{!currentRows.length ? <div className="admin-empty">No campaigns match this queue view.</div> : <div className="admin-campaign-desk">{jurisdictions.map((jurisdiction) => {
    const stageRows = currentRows.filter((row) => String(row.jurisdiction || "Jurisdiction pending") === jurisdiction);
    return <section key={jurisdiction}><h2><strong>{jurisdiction}</strong><span>{stageRows.length} ISSUE{stageRows.length === 1 ? "" : "S"}</span></h2>{stageRows.map((row) => {
      const id = String(row.id); const route = routeDetails(row); const open = expandedId === id; const targets = campaignTargets(row); const live = targets.length ? targets.filter((target) => target.status === "DELIVERED").length : row.delivered_at ? 1 : 0; const deliveryTotal = route.channel.startsWith("REDDIT") ? 3 : 1;
      return <article className={open ? "open" : ""} key={id}>
        <button className={`admin-campaign-summary ${needsCampaignAction(row) ? "needs-action" : ""}`} onClick={() => onToggle(id)} aria-expanded={open}>
          <span className="admin-campaign-score"><b>{String(row.priority_score || 0)}</b><small>SCORE</small></span>
          <span className="admin-campaign-name"><small>{campaignStage(row)}</small><strong>{String(row.issue_type || "CURRENT ISSUE")}</strong><em>{String(row.source_count || 1)} supporting signal(s) · Material Discrepancies Unreconciled</em></span>
          <span className="admin-campaign-flags"><b>EVIDENCE ✓</b><b>{row.draft_status === "READY_REVIEW" ? "PACKAGE READY" : "PACKAGE NEEDED"}</b><b>{live}/{deliveryTotal} POSTED</b><b>{live ? live === deliveryTotal ? "LIVE" : "PARTIAL" : "NO RESULTS"}</b></span>
          <span className="admin-campaign-open">{open ? "CLOSE MAP" : "OPEN CAMPAIGN MAP"}<ChevronRight /></span>
        </button>
        {open && <div className="admin-campaign-map">
          <div className="admin-campaign-why"><small>WHY NOW</small><strong>{String(row.source_count || 1)} supporting signal(s) indicate material discrepancies remain unreconciled in {String(row.jurisdiction || "this jurisdiction")}.</strong><p>{String(row.issue_type || "Current issue")} · score {String(row.priority_score || 0)}</p></div>
          <div className="admin-campaign-work"><CampaignSteps row={row} route={route} /><InlineCampaignBuild row={row} busy={busy === `outreach:${id}`} onAction={onAction} /></div>
          <div className="admin-campaign-history"><small>TRACKING</small><span>Created from qualified opportunity</span><span>{row.approved_at ? `Approved ${formatAdminDate(row.approved_at)}` : "Approval pending"}</span><span>{live ? `${live} of ${deliveryTotal} destinations posted` : "No delivery recorded"}</span><span>Clicks · replies · checkout · purchase: waiting</span></div>
        </div>}
      </article>;
    })}</section>;
  })}</div>}</>;
}

function campaignTargets(row: Row) {
  const stored = Array.isArray(row.delivery_targets) ? row.delivery_targets as Row[] : [];
  if (stored.length || row.draft_status !== "READY_REVIEW" || !String(row.marketing_route || "").startsWith("SOCIAL")) return stored;
  const title = String(row.draft_subject || ""); const body = String(row.draft_body || "");
  return (["REDDIT", "FACEBOOK", "INSTAGRAM"] as Platform[]).map((platform) => ({ platform, destination_name: platform === "REDDIT" ? row.destination_name : "", destination_url: platform === "REDDIT" ? row.destination_address : "", source_url: platform === "REDDIT" ? row.destination_source_url : "", post_title: platform === "REDDIT" ? title : `${String(row.jurisdiction || "Jurisdiction")}: what the public record shows`, post_body: platform === "INSTAGRAM" ? `${body.replace("https://reddotaudit.com/methodology", "reddotaudit.com/methodology")}\n\n#PublicRecords #ALPR #GovernmentAccountability` : body, status: "NEEDS_DESTINATION" }));
}

function CampaignSteps({ row, route }: { row: Row; route: ReturnType<typeof routeDetails> }) {
  const source = String(row.destination_source_url || row.destination_address || "");
  const targets = campaignTargets(row); const approved = row.approval_status === "APPROVED";
  if (!route.channel.startsWith("REDDIT")) { const contact = row.official_contact as Row | undefined; return <nav className="admin-campaign-steps" aria-label="Campaign route"><small>DELIVERY ROUTE · {contact ? "OFFICIAL SOURCE VERIFIED" : "PROPOSED"}</small><strong>{String(row.destination_name || route.destination)}</strong>{contact?.title && <p>{String(contact.title)}</p>}{row.destination_address && <p>{String(row.destination_address)}{contact?.phone ? ` · ${String(contact.phone)}` : ""}</p>}{source && <a href={source} target="_blank" rel="noreferrer">Open official source <ChevronRight /></a>}<p>{approved ? "Approved for manual delivery" : "Approval pending"}</p></nav>; }
  return <nav className="admin-campaign-steps admin-posting-routes" aria-label="Posting routes"><small>POSTING ROUTES</small>{targets.length ? targets.map((target) => {
    const url = String(target.destination_url || ""); const delivered = target.status === "DELIVERED";
    return <div className={url ? "done" : ""} key={String(target.platform)}><i>{delivered ? "✓" : url ? "↗" : "—"}</i><span><b>{String(target.platform)}</b><small>{String(target.destination_name || "Destination needed")}</small></span>{url && <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${String(target.platform)} destination`}>OPEN</a>}</div>;
  }) : <><div className={source ? "done" : ""}><i>{source ? "↗" : "—"}</i><span><b>REDDIT</b><small>{String(row.destination_name || "Source conversation")}</small></span>{source && <a href={source} target="_blank" rel="noreferrer">OPEN</a>}</div><p>Build the package to resolve Facebook and Instagram routes.</p></>}</nav>;
}

function InlineCampaignBuild({ row, busy, onAction }: { row: Row; busy: boolean; onAction: CampaignAction }) {
  const route = routeDetails(row); const social = route.channel.startsWith("REDDIT");
  const [name, setName] = useState(String(row.destination_name || "")); const [address, setAddress] = useState(String(row.destination_address || "")); const [source, setSource] = useState(String(row.destination_source_url || "")); const [error, setError] = useState<string | null>(null);
  async function act(action: "discover_destination" | "prepare" | "save_destination" | "approve" | "hold" | "delivered") { try { setError(null); const updated = await onAction(String(row.id), action, action === "save_destination" ? { destinationName: name, destinationAddress: address, destinationSourceUrl: source } : undefined); if (updated && action === "discover_destination") { setName(String(updated.destination_name || "")); setAddress(String(updated.destination_address || "")); setSource(String(updated.destination_source_url || "")); } } catch (value) { setError(value instanceof Error ? value.message : "Action failed."); } }
  const ready = row.draft_status === "READY_REVIEW"; const approved = row.approval_status === "APPROVED";
  return <div className="admin-inline-build"><small>CAMPAIGN BUILD · {route.channel}</small>
    {!ready && <><h3>{social ? "Resolve the originating conversation" : "Verify the professional destination"}</h3>{!social && <div className="admin-contact-state"><b>{source ? "OFFICIAL SOURCE FOUND" : "PROPOSED · NOT YET SOURCE-VERIFIED"}</b><button disabled={busy} onClick={() => act("discover_destination")}>FIND OFFICIAL CONTACT</button></div>}<label>Recipient / community<input value={name} onChange={(event) => setName(event.target.value)} placeholder={social ? "Originating conversation" : "Name and role"} /></label><label>Delivery address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={social ? "Conversation URL" : "Verified email or submission form"} /></label><label>Official verification source<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Exact .gov page showing this contact" /></label><button className="admin-primary" disabled={busy} onClick={() => social ? act("prepare") : act("save_destination")}>{busy ? "BUILDING…" : "VERIFY + BUILD DRAFT"}</button></>}
    {ready && social && <><h3>One message. Three posting destinations.</h3><p className="admin-package-intro">The source-backed message is adapted for each platform. Resolve a route once and it will be remembered for the next campaign in this jurisdiction.</p><div className="admin-platform-package">{campaignTargets(row).map((target) => <PlatformDelivery key={String(target.platform)} campaignId={String(row.id)} row={row} target={target} approved={approved} busy={busy} onAction={onAction} />)}</div><div className="admin-modal-actions">{approved ? <strong className="admin-package-approved">PACKAGE APPROVED · POST EACH ROUTE AND RECORD DELIVERY</strong> : <><button className="admin-primary" disabled={busy} onClick={() => act("approve")}>APPROVE FULL PACKAGE</button><button disabled={busy} onClick={() => act("hold")}>Hold</button></>}</div></>}
    {ready && !social && <><h3>Review the prepared piece</h3><label>Subject<input readOnly value={String(row.draft_subject || "")} /></label><label>Message<textarea readOnly value={String(row.draft_body || "")} /></label><a className="admin-live-report" href={campaignReportUrl(row)} target="_blank" rel="noreferrer"><b>Red Dot Audit live report:</b> {campaignReportUrl(row)}</a><ScanProofCard row={row} /><div className="admin-modal-actions admin-package-actions">{approved ? <><button className="admin-primary" onClick={() => navigator.clipboard.writeText(`${String(row.draft_subject || "")}\n\n${String(row.draft_body || "")}\n\nRed Dot Audit live report: ${campaignReportUrl(row)}`)}>COPY MESSAGE</button>{String(row.destination_address || "").startsWith("http") && <a href={String(row.destination_address)} target="_blank" rel="noreferrer">OPEN DESTINATION</a>}<button onClick={() => act("delivered")}>MARK DELIVERED</button></> : <><button className="admin-primary" disabled={busy} onClick={() => act("approve")}>APPROVE PACKAGE</button><button disabled={busy} onClick={() => act("hold")}>HOLD</button></>}</div></>}
    {error && <p className="admin-form-error">{error}</p>}
  </div>;
}

function PlatformDelivery({ campaignId, row, target, approved, busy, onAction }: { campaignId: string; row: Row; target: Row; approved: boolean; busy: boolean; onAction: CampaignAction }) {
  const platform = String(target.platform) as Platform; const [name, setName] = useState(String(target.destination_name || "")); const [url, setUrl] = useState(String(target.destination_url || "")); const [error, setError] = useState<string | null>(null);
  const delivered = target.status === "DELIVERED"; const ready = Boolean(name && url);
  const liveReportUrl = campaignReportUrl(row);
  const liveReportLine = `Red Dot Audit live report: ${liveReportUrl}`;
  const postBody = String(target.post_body || "");
  const displayBody = postBody.replace(/\n\nRed Dot Audit live report:\s*https?:\/\/\S+/i, "").trim();
  const copyBody = `${displayBody}\n\n${liveReportLine}`;
  async function save() { try { setError(null); await onAction(campaignId, "save_target", { platform, destinationName: name, destinationAddress: url, destinationSourceUrl: url, postTitle: String(target.post_title || ""), postBody: String(target.post_body || "") }); } catch (value) { setError(value instanceof Error ? value.message : "Route could not be saved."); } }
  async function markDelivered() { try { setError(null); await onAction(campaignId, "delivered_target", { platform }); } catch (value) { setError(value instanceof Error ? value.message : "Delivery could not be recorded."); } }
  return <section className={`admin-platform-delivery ${delivered ? "delivered" : ""}`}><header><div><small>{platform}</small><strong>{delivered ? "DELIVERED" : ready ? approved ? "READY TO POST" : "ROUTE READY" : "DESTINATION NEEDED"}</strong></div>{ready && <a href={url} target="_blank" rel="noreferrer">OPEN DESTINATION <ChevronRight /></a>}</header>{!ready && <div className="admin-platform-route"><label>Community / page<input value={name} onChange={(event) => setName(event.target.value)} placeholder={`${platform[0]}${platform.slice(1).toLowerCase()} destination`} /></label><label>Destination URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label><button disabled={busy} onClick={save}>SAVE ROUTE</button></div>}<div className="admin-platform-copy"><label>Post title<input readOnly value={String(target.post_title || "")} /></label><label>Post content<textarea readOnly value={displayBody} /></label></div><a className="admin-live-report" href={liveReportUrl} target="_blank" rel="noreferrer"><b>Red Dot Audit live report:</b> {liveReportUrl}</a><ScanProofCard row={row} />{approved && ready && !delivered && <footer><button onClick={() => navigator.clipboard.writeText(`${String(target.post_title || "")}\n\n${copyBody}`)}>COPY POST</button><button className="admin-primary" disabled={busy} onClick={markDelivered}>MARK DELIVERED</button></footer>}{error && <p className="admin-form-error">{error}</p>}</section>;
}

function campaignReportUrl(row: Row) { return `https://reddotaudit.com/?target=${encodeURIComponent(String(row.jurisdiction || ""))}`; }

type SnapshotMetric = readonly [string, string];

const grandIslandMetrics: SnapshotMetric[] = [["9", "CAMERAS IDENTIFIED"], ["148,369", "DETECTIONS / 30 DAYS"], ["212", "SEARCHES REPORTED"], ["60+", "OUTSIDE ORGANIZATIONS"]];

function normalizeJurisdiction(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function snapshotMetrics(row: Row): SnapshotMetric[] {
  if (normalizeJurisdiction(row.jurisdiction) === "grand island nebraska") return grandIslandMetrics;
  const canonicalTarget = resolveRedDotTarget(String(row.jurisdiction || ""));
  if (canonicalTarget?.publicMetrics?.length) {
    return canonicalTarget.publicMetrics.slice(0, 4).map(
      (metric) => [metric.value, metric.label.toUpperCase()] as SnapshotMetric,
    );
  }
  const acquired = Array.isArray(row.jurisdiction_metrics) ? row.jurisdiction_metrics as Row[] : [];
  if (acquired.length) return acquired.slice(0, 4).map((metric) => [String(metric.value || "—"), String(metric.label || metric.metric_key || "SOURCE-VERIFIED METRIC").toUpperCase()] as SnapshotMetric);
  const verified: Array<[string[], string]> = [
    [["cameras_identified", "camera_count"], "CAMERAS IDENTIFIED"],
    [["detections_30_days", "monthly_detections"], "DETECTIONS / 30 DAYS"],
    [["searches_reported", "search_count"], "SEARCHES REPORTED"],
    [["outside_organizations", "outside_org_count"], "OUTSIDE ORGANIZATIONS"],
  ];
  return verified.map(([keys, label]) => {
    const value = keys.map((key) => row[key]).find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim());
    return [value === undefined ? "—" : String(value), value === undefined ? `${label} · NOT YET ACQUIRED` : label] as SnapshotMetric;
  });
}

function ScanProofCard({ row }: { row: Row }) {
  const campaignJurisdiction = String(row.jurisdiction || "Local jurisdiction");
  const isGrandIsland = normalizeJurisdiction(campaignJurisdiction) === "grand island nebraska";
  const metrics = snapshotMetrics(row);
  const cardLabel = isGrandIsland ? "LIVE PRELIMINARY SCAN" : "PRELIMINARY LOCAL SNAPSHOT";
  function buildGraphic() {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 440;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#f4f6f8"; ctx.fillRect(0, 0, 1200, 440); ctx.fillStyle = "#18212c"; ctx.fillRect(0, 0, 1200, 14);
    ctx.fillStyle = "#bd2531"; ctx.beginPath(); ctx.arc(52, 50, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#18212c"; ctx.font = "700 22px Arial"; ctx.fillText("RED DOT AUDIT", 78, 58);
    ctx.fillStyle = "#9c1824"; ctx.font = "700 15px Arial"; ctx.fillText(cardLabel, 42, 104);
    ctx.fillStyle = "#18212c"; ctx.font = "44px Georgia"; ctx.fillText(campaignJurisdiction, 42, 158);
    const startX = 42; const top = 190; const width = 1116 / metrics.length;
    metrics.forEach(([value, label], index) => { const x = startX + (index * width); const featured = index === metrics.length - 1; ctx.strokeStyle = "#c9d1d9"; ctx.strokeRect(x, top, width, 140); ctx.fillStyle = featured ? "#bd2531" : "#18212c"; if (featured) ctx.fillRect(x, top, width, 140); ctx.fillStyle = featured ? "#fff" : "#18212c"; ctx.font = "42px Georgia"; ctx.fillText(value, x + 20, top + 58); ctx.font = "700 13px Arial"; const words = label.split(" "); let line = ""; let lineY = top + 98; for (const word of words) { const test = `${line}${word} `; if (ctx.measureText(test).width > width - 40 && line) { ctx.fillText(line.trim(), x + 20, lineY); line = `${word} `; lineY += 19; } else line = test; } ctx.fillText(line.trim(), x + 20, lineY); });
    ctx.fillStyle = "#5d6874"; ctx.font = "14px Arial";
    ctx.fillText("Source-linked public record · reddotaudit.com", 42, 386);
    return canvas;
  }
  function download() { const canvas = buildGraphic(); if (!canvas) return; const link = document.createElement("a"); link.download = `red-dot-audit-${normalizeJurisdiction(campaignJurisdiction).replace(/\s+/g, "-") || "local"}-snapshot.png`; link.href = canvas.toDataURL("image/png"); link.click(); }
  async function copy() { const canvas = buildGraphic(); if (!canvas) return; const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob || typeof ClipboardItem === "undefined") return download(); try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); } catch { download(); } }
  return <section className="admin-scan-proof"><header><span><i />RED DOT AUDIT</span><b>{cardLabel}</b></header><h4>{campaignJurisdiction}</h4><div style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>{metrics.map(([value, label]) => <span key={label}><strong>{value}</strong><small>{label}</small></span>)}</div><footer><small>Source-linked public record · reddotaudit.com</small><span><button type="button" onClick={copy}>COPY GRAPHIC</button><button type="button" onClick={download}>DOWNLOAD</button></span></footer></section>;
}

function OutreachLedger({ rows, onOpen }: { rows: Row[]; onOpen: (row: Row) => void }) {
  if (!rows.length) return <div className="admin-empty">No destination is ready for an outreach build.</div>;
  return <div className="admin-outreach-ledger">{rows.map((row, index) => { const route = routeDetails(row); const ready = row.draft_status === "READY_REVIEW"; const approved = row.approval_status === "APPROVED"; return <article key={String(row.id || index)}>
    <header><span>{String(index + 1).padStart(2, "0")}</span><div><small>{route.channel}</small><h2>{String(row.jurisdiction || "Jurisdiction pending")} · {String(row.issue_type || "Current issue")}</h2></div><b>{approved ? "APPROVED" : ready ? "READY FOR REVIEW" : row.destination_status === "VERIFIED" ? "DRAFT NEXT" : "DESTINATION NEXT"}</b></header>
    <div className="admin-outreach-body"><div><small>DELIVERY OBJECT</small><strong>{route.piece}</strong><p>{ready ? String(row.draft_body || "Draft prepared.").slice(0, 280) : route.channel.startsWith("REDDIT") ? "Resolve the originating conversation, then prepare Reddit, Instagram and Facebook variants." : "Verify the named professional and delivery route before generating a personalized introduction."}</p></div><div><small>DESTINATION</small><strong>{String(row.destination_name || route.destination)}</strong><p>{String(row.destination_address || `${String(row.source_count || 1)} current signal(s) · opportunity score ${String(row.priority_score || 0)}`)}</p></div></div>
    <footer><button className="admin-primary" onClick={() => onOpen(row)}>{approved ? "OPEN APPROVED DELIVERY" : ready ? "REVIEW DRAFT" : "RESOLVE + BUILD"}</button><span>SENDING / POSTING LOCKED</span></footer>
  </article>; })}</div>;
}

function OutreachModal({ row, busy, onClose, onAction }: { row: Row; busy: boolean; onClose: () => void; onAction: (id: string, action: "prepare" | "save_destination" | "approve" | "hold" | "delivered", fields?: { destinationName?: string; destinationAddress?: string; destinationSourceUrl?: string }) => Promise<Row | undefined> }) {
  const route = routeDetails(row); const social = route.channel.startsWith("REDDIT");
  const [name, setName] = useState(String(row.destination_name || "")); const [address, setAddress] = useState(String(row.destination_address || "")); const [source, setSource] = useState(String(row.destination_source_url || "")); const [error, setError] = useState<string | null>(null);
  async function act(action: "prepare" | "save_destination" | "approve" | "hold" | "delivered") { try { setError(null); await onAction(String(row.id), action, action === "save_destination" ? { destinationName: name, destinationAddress: address, destinationSourceUrl: source } : undefined); } catch (value) { setError(value instanceof Error ? value.message : "Action failed."); } }
  const ready = row.draft_status === "READY_REVIEW"; const approved = row.approval_status === "APPROVED";
  return <div className="admin-modal-backdrop"><section className="admin-outreach-modal" role="dialog" aria-modal="true"><header><div><p>OUTREACH DELIVERY</p><h2>{String(row.jurisdiction)} · {String(row.issue_type)}</h2></div><button onClick={onClose} aria-label="Close"><X /></button></header><div className="admin-outreach-modal-grid"><aside><small>ROUTE</small><b>{route.channel}</b><small>DELIVERABLE</small><b>{route.piece}</b><small>EVIDENCE</small><b>{String(row.source_count || 1)} signal(s) · score {String(row.priority_score || 0)}</b></aside><main>
    {!ready && <><h3>{social ? "Resolve the originating conversation" : "Verify the professional destination"}</h3><label>Recipient / community<input value={name} onChange={(event) => setName(event.target.value)} placeholder={social ? "Originating conversation" : "Name and role"} /></label><label>Delivery address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={social ? "Conversation URL" : "Verified email or submission form"} /></label><label>Verification source<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Public source proving this destination" /></label><button className="admin-primary" disabled={busy} onClick={() => social ? act("prepare") : act("save_destination")}>{busy ? "BUILDING…" : "VERIFY DESTINATION + BUILD DRAFT"}</button></>}
    {ready && <><h3>Review the prepared piece</h3><label>Subject<input readOnly value={String(row.draft_subject || "")} /></label><label>Draft<textarea readOnly value={String(row.draft_body || "")} /></label><div className="admin-modal-actions">{approved ? <><button className="admin-primary" onClick={() => navigator.clipboard.writeText(String(row.draft_body || ""))}>COPY APPROVED DELIVERY</button>{String(row.destination_address || "").startsWith("http") && <a href={String(row.destination_address)} target="_blank" rel="noreferrer">Open destination</a>}<button onClick={() => act("delivered")}>Mark manually delivered</button></> : <><button className="admin-primary" disabled={busy} onClick={() => act("approve")}>APPROVE DELIVERY</button><button disabled={busy} onClick={() => act("hold")}>Hold</button></>}</div></>}
    {error && <p className="admin-form-error">{error}</p>}
  </main></div></section></div>;
}

function formatAdminDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
