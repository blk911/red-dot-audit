"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Check, Search } from "lucide-react";

export type QueueItem = {
  id: string;
  jurisdiction: string;
  requesterEmail: string;
  status: "requested" | "reviewing" | "not_qualified" | "notified";
  createdAt: string;
  notifiedAt: string | null;
  readyMatch: boolean;
};

export default function ResearchRequestQueue({ requests }: { requests: QueueItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "reviewing" | "not_qualified" | "notify_ready") {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/research-requests/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Queue update failed.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Queue update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="research-queue">
      <header>
        <div>
          <p className="eyebrow">LIVE INTAKE · PRIVATE</p>
          <h2>Requested jurisdictions</h2>
        </div>
        <p>Public requests enter here once per jurisdiction and email. A readiness email can be sent only after the target joins the release-qualified inventory.</p>
      </header>
      {error && <div className="research-queue-error">{error}</div>}
      {requests.length === 0 ? (
        <div className="research-queue-empty"><Search /><b>No public research requests yet.</b><span>New requests will appear here automatically.</span></div>
      ) : (
        <div className="research-queue-table">
          <div className="research-queue-head"><span>Jurisdiction</span><span>Requester</span><span>Received</span><span>Status</span><span>Action</span></div>
          {requests.map((request) => (
            <article key={request.id}>
              <div><b>{request.jurisdiction}</b><small>{request.readyMatch ? "Release match available" : "No qualified package yet"}</small></div>
              <span>{request.requesterEmail}</span>
              <time dateTime={request.createdAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(request.createdAt))}</time>
              <span className={`queue-status ${request.status}`}>{request.status.replace("_", " ")}</span>
              <div className="queue-actions">
                {request.status === "requested" && <button disabled={busyId === request.id} onClick={() => act(request.id, "reviewing")}><Search /> Start review</button>}
                {request.status !== "notified" && request.status !== "not_qualified" && <button disabled={busyId === request.id} onClick={() => act(request.id, "not_qualified")}><span>×</span> No package</button>}
                {request.readyMatch && request.status !== "notified" && <button className="notify" disabled={busyId === request.id} onClick={() => act(request.id, "notify_ready")}><Bell /> Send ready note</button>}
                {request.status === "notified" && <span className="queue-complete"><Check /> Notified</span>}
                {!request.readyMatch && request.status === "reviewing" && <span className="queue-waiting">Research in progress <ArrowRight /></span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
