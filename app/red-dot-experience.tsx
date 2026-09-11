"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  FileSearch,
  LockKeyhole,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  isLaunchTarget,
  releaseReadyTargets,
  redDotTargets,
  type RedDotTarget,
} from "./red-dot-targets";
import type { CommerceReadiness } from "@/lib/commerce/config";
import type { CharterOfferStatus } from "@/lib/commerce/charter-offer";

type Stage = "entry" | "scan" | "teaser" | "report";
export type ReportTier = "brief" | "autopsy";
const canonicalSiteUrl = "https://reddotaudit.com";
const reportAsOf = "September 4, 2026";

const scanSteps = [
  "Validating jurisdiction and system",
  "Checking the reviewed-target inventory",
  "Matching available public sources",
  "Applying the evidence boundary",
  "Determining report availability",
  "Preparing jurisdiction status",
];

type TargetDot = {
  id: string;
  severity: "HIGH" | "MEDIUM";
  request: "A" | "B" | "C";
  title: string;
  summary: string;
  requirement: string;
  observed: string;
  status: string;
  resolution: string;
  custodian: string;
};

const dots: TargetDot[] = [
  {
    id: "RD–01",
    severity: "HIGH",
    request: "B",
    title: "Sharing universe requires reconciliation",
    summary:
      "A nationwide outside-access population appears alongside a policy requiring a legitimate law-enforcement purpose tied to a specific investigation.",
    requirement:
      "Specific investigative purpose; documented case number and reason.",
    observed:
      "Broad external sharing population reported through the operational portal.",
    status: "Unresolved — obtain the sharing and network-audit exports.",
    resolution:
      "Compare the complete SharedNetworks configuration with the Network Audit population for the same period.",
    custodian: "Grand Island Police Department · ALPR records custodian",
  },
  {
    id: "RD–02",
    severity: "HIGH",
    request: "A",
    title: "Written authorization trail not yet reconciled",
    summary:
      "Department policy describes a written request, named requester, intended purpose and administrator approval before outside release.",
    requirement:
      "Written request retained and approved by the ALPR Administrator.",
    observed:
      "Outside organizations are shown as granted access; approval population is not public.",
    status: "Missing proof — request approval records and SharedNetworks.csv.",
    resolution:
      "Match every outside organization to a written request, intended purpose and administrator disposition.",
    custodian: "Grand Island Police Department · ALPR administrator",
  },
  {
    id: "RD–03",
    severity: "MEDIUM",
    request: "C",
    title: "Public representation needs definition",
    summary:
      "The public page says data is never shared with third parties while the vendor portal describes organizations granted access.",
    requirement:
      "Public representation: data is not shared with third parties.",
    observed:
      "Operational representation: organizations are granted network access.",
    status:
      "Definition conflict — may reconcile if ‘third party’ excludes law enforcement.",
    resolution:
      "Obtain the approved meaning of ‘third party’ and the records used to review the public representation.",
    custodian: "City communications office and police records custodian",
  },
  {
    id: "RD–04",
    severity: "MEDIUM",
    request: "A",
    title: "Required audit artifact not located",
    summary:
      "The policy calls for recurring utilization sampling and a retained memorandum to the Chief documenting errors discovered.",
    requirement:
      "Semiannual sampling and a retained internal audit memorandum.",
    observed:
      "No responsive audit memorandum located in the preliminary public scan.",
    status: "Document gap — request 2024–2026 memoranda and workpapers.",
    resolution:
      "Produce the required audit memoranda, samples, exceptions and corrective-action records for the review period.",
    custodian: "Grand Island Police Department · Chief / audit custodian",
  },
];

const publicPreviewLimit = 4;

const requestPackets = [
  {
    id: "A",
    title: "Authority, approvals & audit controls",
    recipient: "Records Custodian · Grand Island Police Department",
    address: "111 Public Safety Drive · Grand Island, NE 68801",
    route:
      "Submit through the City of Grand Island Public Records Request form",
    routeUrl:
      "https://www.grand-island.com/forms/public-records-request-information",
    items: [
      "All written requests from outside agencies for access to or release of Grand Island ALPR data, including requester, agency, intended purpose, disposition and administrator approval or denial.",
      "All semiannual or annual ALPR audit memoranda, samples, findings, exceptions, corrective actions and supporting workpapers required by General Order O2416.",
      "Records sufficient to identify each designated ALPR Administrator, authorized user, role, approval date and required training during the requested period.",
    ],
  },
  {
    id: "B",
    title: "System activity & configuration",
    recipient: "Records Custodian · Grand Island Police Department",
    address: "111 Public Safety Drive · Grand Island, NE 68801",
    route:
      "Submit through the City of Grand Island Public Records Request form",
    routeUrl:
      "https://www.grand-island.com/forms/public-records-request-information",
    items: [
      "Native SharedNetworks exports and configuration histories showing every organization granted, removed or denied access to Grand Island ALPR data.",
      "Native Network Audit and Organization Audit exports showing outside searches, organization, timestamp, purpose, case number, search type and available event identifiers.",
      "Native Event Log exports showing user, role, network-sharing, camera, hotlist and administrative changes, with timestamps and event identifiers preserved.",
    ],
  },
  {
    id: "C",
    title: "Vendor, procurement & incident records",
    recipient: "City Clerk / Finance Purchasing · City of Grand Island",
    address: "100 East First Street · Grand Island, NE 68801",
    route:
      "Submit through the city form; copy the general city records channel",
    routeUrl:
      "https://www.grand-island.com/forms/public-records-request-information",
    items: [
      "Contracts, amendments, statements of work, orders, invoices, implementation records and data-sharing terms for Flock Safety ALPR services.",
      "Communications with Flock Safety concerning statewide or nationwide sharing, erroneous access, audit results, configuration changes, incidents or corrective action.",
      "Records explaining the public statement that data is not shared with third parties, including the intended definition of third party and any review or approval of that language.",
    ],
  },
] as const;

const tourSteps = [
  {
    label: "01 · DEFINE THE JURISDICTION",
    title: "Enter your city or county.",
    copy: "Start with a United States municipality or county using Flock Safety ALPR.",
    image: "/tour/rda-tour-step-1.png",
    alt: "Red Dot Audit jurisdiction scan input",
    points: ["No account required", "City or county plus state"],
  },
  {
    label: "02 · START THE SCAN",
    title: "Put the public record to work.",
    copy: "Enter the jurisdiction, then launch the preliminary scan from the same panel.",
    image: "/tour/rda-tour-step-2.png",
    alt: "Grand Island entered in the jurisdiction scan",
    points: ["Public sources only", "Policies, contracts and audit material"],
  },
  {
    label: "03 · READ THE SIGNAL",
    title: "See the discrepancy at a glance.",
    copy: "The first result combines the evidence count, observed footprint and unresolved Red Dots.",
    image: "/tour/rda-tour-step-3.png",
    alt: "Grand Island preliminary scan result",
    points: [
      "Red Dot Score",
      "Six evidence metrics",
      "Primary documentary signal",
    ],
  },
  {
    label: "04 · OPEN THE RED DOTS",
    title: "Compare requirement to observed state.",
    copy: "Expand any Red Dot to see the controlling requirement, the public observation and the next proof needed.",
    image: "/tour/rda-tour-step-4.png",
    alt: "Expanded Red Dot evidence comparison",
    points: ["Requirement", "Observed", "Status and next proof"],
  },
  {
    label: "05 · CHOOSE THE DEPTH",
    title: "Select the investigative package.",
    copy: "The Evidence Brief tests whether the target warrants more work. The Full Autopsy adds the actor map and acquisition plan.",
    image: "/tour/rda-tour-step-5.png",
    alt: "Full Autopsy purchase comparison",
    points: [
      "Evidence Brief · $195",
      "Full Autopsy · $395",
      "Secure Stripe checkout",
    ],
  },
  {
    label: "06 · TAKE THE NEXT MOVE",
    title: "Open the source-linked report.",
    copy: "After payment confirmation, the protected report provides the authority map, missing proof and ready-to-use investigative work product.",
    image: "/tour/rda-tour-step-6.png",
    alt: "Unlocked Full Autopsy authority map",
    points: [
      "Authority map",
      "Evidence-acquisition sequence",
      "Print and download",
    ],
  },
] as const;

const sources = [
  [
    "Grand Island Police — ALPR overview",
    "grand-island.com",
    "https://www.grand-island.com/o/gipd/page/automatic-license-plate-readers",
    "Public description of system purpose, search justification, third-party sharing and traffic-enforcement limits.",
  ],
  [
    "GIPD General Order O2416",
    "GIPD policy PDF",
    "https://core-docs.s3.us-east-1.amazonaws.com/documents/asset/uploaded_file/5042/GIPD/4856824/Automatic_License_Plate_Re.pdf",
    "Departmental controls for specific-investigation use, case documentation, outside release, administrator approval and recurring audit.",
  ],
  [
    "Nebraska ALPR Privacy Act §60-3204",
    "nebraskalegislature.gov",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=60-3204",
    "State-law standard for manual queries: relevance and materiality to an ongoing criminal or missing-person investigation, with the reason documented.",
  ],
  [
    "Flock transparency portal",
    "transparency.flocksafety.com",
    "https://transparency.flocksafety.com/grand-island-ne-pd",
    "Operational public snapshot of cameras, detections, searches and organizations shown as having access to Grand Island data.",
  ],
];

function missingProofItems(target: RedDotTarget) {
  return target.missingProof
    .replace(/\.$/, "")
    .split(/,|;|\band\b/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function proofProfile(item: string): Pick<TargetDot, "title" | "request" | "severity" | "custodian"> {
  const value = item.toLowerCase();
  if (/network|query|event log|sharing export|configuration|access path/.test(value)) {
    return {
      title: "Native system record not yet reconciled",
      request: "B",
      severity: "HIGH",
      custodian: "Agency ALPR administrator / system records custodian",
    };
  }
  if (/approval|authorization|requestor|requester|supervis|training|user/.test(value)) {
    return {
      title: "Authorization and supervision trail remains incomplete",
      request: "A",
      severity: "HIGH",
      custodian: "Agency records custodian / supervising official",
    };
  }
  if (/contract|vendor|procurement|invoice|work order|technical|root-cause/.test(value)) {
    return {
      title: "Vendor and procurement proof remains material",
      request: "C",
      severity: "MEDIUM",
      custodian: "City or county clerk / procurement records custodian",
    };
  }
  if (/audit|finding|review|corrective|incident|termination|disciplin/.test(value)) {
    return {
      title: "Audit and corrective-action record is not complete",
      request: "A",
      severity: "HIGH",
      custodian: "Agency audit / internal-affairs records custodian",
    };
  }
  return {
    title: "Required documentary proof has not been located",
    request: "A",
    severity: "MEDIUM",
    custodian: "Agency public-records custodian",
  };
}

function targetDots(target: RedDotTarget): TargetDot[] {
  const primary: TargetDot = {
    id: "RD–01",
    severity: "HIGH",
    request: "A",
    title: "Documented control and observed activity require reconciliation",
    summary: target.teaser,
    requirement: target.control,
    observed: target.observed,
    status: "Unresolved — the available record does not yet reconcile the two populations.",
    resolution: `Obtain and test ${target.missingProof}`,
    custodian: `Records Custodian · ${target.agency}`,
  };

  const proofDots = missingProofItems(target).map((item, index): TargetDot => {
    const profile = proofProfile(item);
    return {
      id: `RD–${String(index + 2).padStart(2, "0")}`,
      ...profile,
      summary: `${item.replace(/^./, (letter) => letter.toUpperCase())} is required to test the scope, authority or disposition of the reported activity.`,
      requirement: target.control,
      observed: target.observed,
      status: `Missing proof — ${item}.`,
      resolution: `Request ${item} in native electronic form, preserve available metadata, and compare it with the documented control and reported event.`,
    };
  });

  return [primary, ...proofDots];
}

function targetRequestPackets(target: RedDotTarget) {
  const publicBody =
    "Please provide the records in native electronic format, including available CSV fields, timestamps, event identifiers, organization names and metadata. If material is withheld, identify the legal basis and release all reasonably segregable records.";
  return [
    {
      id: "A",
      title: "Authority, approvals & audit controls",
      recipient: `Records Custodian · ${target.agency}`,
      items: [
        target.missingProof,
        "All policies, approvals, audit memoranda, exception findings and corrective actions governing the activity described in this request.",
        "Records identifying the officials, administrators and supervisors responsible for access approval and audit review.",
      ],
      body: publicBody,
    },
    {
      id: "B",
      title: "System activity & configuration",
      recipient: `ALPR Records Custodian · ${target.agency}`,
      items: [
        "Native Network Audit, Organization Audit, SharedNetworks and Event Log exports for the relevant period.",
        "User-role, search-purpose, case-number, sharing, configuration-change and alert records associated with the observed activity.",
        target.missingProof,
      ],
      body: publicBody,
    },
    {
      id: "C",
      title: "Vendor, procurement & incident records",
      recipient: `Clerk / Purchasing Records Custodian · ${target.place}`,
      items: [
        "Contracts, amendments, statements of work, invoices and data-control terms for Flock Safety or the relevant ALPR service.",
        "Communications concerning the observed activity, configuration, audit, investigation, suspension, termination or corrective action.",
        "Vendor explanations, technical incident reports, preservation notices and remediation records.",
      ],
      body: publicBody,
    },
  ];
}

type CorrespondencePacket = {
  id: string;
  title: string;
  recipient: string;
  items: readonly string[];
  body?: string;
  address?: string;
  route?: string;
  routeUrl?: string;
};

type CorrespondenceDraft = {
  recipient: string;
  subject: string;
  body: string;
  route?: string;
  routeUrl?: string;
};

function packetCorrespondence({
  jurisdiction,
  packet,
  law,
  period,
}: {
  jurisdiction: string;
  packet: CorrespondencePacket;
  law: string;
  period: string;
}): CorrespondenceDraft {
  const subject = `${jurisdiction} / Flock Safety ALPR — ${packet.title}`;
  const body = [
    `${law}, please provide the following records in their native electronic format ${period}:`,
    "",
    ...packet.items.map((item, index) => `${index + 1}. ${item}`),
    "",
    packet.body ||
      "Please conduct a search reasonably calculated to locate responsive records, including agency email, shared drives and records maintained for the jurisdiction by its contractor. Preserve native CSV fields, timestamps, event identifiers, organization names and available metadata. If any portion is withheld, identify the statutory basis and release all reasonably segregable material. Please advise before incurring fees exceeding $50.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
  return {
    recipient: [packet.recipient.replace(" · ", "\n"), packet.address?.replace(" · ", "\n")]
      .filter(Boolean)
      .join("\n"),
    subject,
    body,
    route: packet.route,
    routeUrl: packet.routeUrl,
  };
}

function grandIslandCorrespondence(packet: CorrespondencePacket) {
  return packetCorrespondence({
    jurisdiction: "Grand Island",
    packet,
    law: "Pursuant to the Nebraska Public Records Act",
    period: "for January 1, 2024 through the date this request is processed",
  });
}

function targetCorrespondence(target: RedDotTarget, packet: CorrespondencePacket) {
  return packetCorrespondence({
    jurisdiction: target.place,
    packet,
    law: "Under the applicable public-records law",
    period: "for the period implicated by the source-linked event",
  });
}

function issueCorrespondence({
  jurisdiction,
  agency,
  dot,
  law,
  period,
  packet,
}: {
  jurisdiction: string;
  agency: string;
  dot: TargetDot;
  law: string;
  period: string;
  packet: CorrespondencePacket;
}): CorrespondenceDraft {
  return {
    recipient: dot.custodian.replace(" · ", "\n"),
    subject: `${jurisdiction} / ${dot.id} — ${dot.title}`,
    route: packet.route || `Submit to ${dot.custodian}`,
    routeUrl: packet.routeUrl,
    body: [
      `${law}, please provide records sufficient to resolve the following documented issue concerning ${agency}'s Flock Safety ALPR system ${period}.`,
      "",
      `ISSUE ${dot.id}: ${dot.title}`,
      `Documented requirement: ${dot.requirement}`,
      `Observed public record: ${dot.observed}`,
      `Unresolved proof: ${dot.status}`,
      "",
      "RECORDS REQUESTED",
      `1. ${dot.resolution}`,
      ...packet.items.slice(0, 2).map((item, index) => `${index + 2}. ${item}`),
      "",
      packet.body ||
        "Please conduct a search reasonably calculated to locate responsive records, including agency email, shared drives and records maintained for the jurisdiction by its contractor. Preserve native CSV fields, timestamps, event identifiers, organization names and available metadata. If any portion is withheld, identify the statutory basis and release all reasonably segregable material. Please advise before incurring fees exceeding $50.",
      "",
      "Please confirm receipt and identify the assigned records custodian or tracking number.",
      "",
      "Sincerely,",
      "[Your name]",
      "[Your organization, if applicable]",
      "[Your email] · [Your phone]",
    ].join("\n"),
  };
}

function correspondenceClipboardText(draft: CorrespondenceDraft) {
  return [`To: ${draft.recipient}`, `Subject: ${draft.subject}`, "", draft.body].join("\n");
}

function CopyCorrespondence({ draft, label = "Open request" }: { draft: CorrespondenceDraft; label?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="copy-correspondence" onClick={() => setOpen(true)}>
        <FileSearch />
        {label}
      </button>
      {open && (
        <div className="modal-backdrop correspondence-backdrop no-print" onMouseDown={() => setOpen(false)}>
          <section
            className="correspondence-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="correspondence-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>ISSUE-SPECIFIC CORRESPONDENCE · READY TO SEND</span>
                <h2 id="correspondence-title">Review the drafted request</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close correspondence">
                <X />
              </button>
            </header>
            <div className="correspondence-routing">
              <div>
                <span>RECIPIENT OFFICE</span>
                <strong>{draft.recipient}</strong>
              </div>
              <div>
                <span>SUBJECT</span>
                <strong>{draft.subject}</strong>
              </div>
              <div>
                <span>DELIVERY</span>
                {draft.routeUrl ? (
                  <a href={draft.routeUrl} target="_blank" rel="noreferrer">{draft.route} <ArrowRight /></a>
                ) : (
                  <strong>{draft.route || "Verify the current official submission portal before sending."}</strong>
                )}
              </div>
            </div>
            <div className="correspondence-letter">{draft.body}</div>
            <footer>
              <button type="button" className="correspondence-exit" onClick={() => setOpen(false)}>
                Exit
              </button>
              <button
                type="button"
                className="correspondence-copy"
                onClick={async () => {
                  await navigator.clipboard.writeText(correspondenceClipboardText(draft));
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Complete email copied" : "Copy complete email"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
    </span>
  );
}

const stateNames: Record<string, string> = {
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  FL: "Florida",
  GA: "Georgia",
  IL: "Illinois",
  IN: "Indiana",
  MA: "Massachusetts",
  MI: "Michigan",
  NC: "North Carolina",
  NE: "Nebraska",
  NY: "New York",
  OH: "Ohio",
  OR: "Oregon",
  TX: "Texas",
  VA: "Virginia",
  WA: "Washington",
  WI: "Wisconsin",
};

function normalizeTarget(value: string) {
  return value
    .toLowerCase()
    .replace(
      /\b(flock safety|automatic license plate recognition|license plate readers?|alpr)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function targetAliases(target: RedDotTarget) {
  const locality = target.place.split(",")[0];
  return [
    target.place,
    `${locality}, ${target.state}`,
    `${locality}, ${stateNames[target.state] || target.state}`,
  ].map(normalizeTarget);
}

function resolveCatalogTarget(value: string) {
  const normalized = normalizeTarget(value);
  if (!normalized) return null;
  return (
    redDotTargets.find((item) => targetAliases(item).includes(normalized)) ||
    null
  );
}

function enteredJurisdiction(value: string) {
  return (
    value
      .replace(
        /\+?\s*(Flock Safety|Automatic License Plate Recognition|ALPR).*$/i,
        "",
      )
      .trim() || "Grand Island, Nebraska"
  );
}

export default function RedDotExperience({
  commerceReadiness,
  charterOffer,
}: {
  commerceReadiness: CommerceReadiness;
  charterOffer: CharterOfferStatus;
}) {
  const [stage, setStage] = useState<Stage>("entry");
  const [query, setQuery] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [expanded, setExpanded] = useState<string | null>("RD–01");
  const [checkout, setCheckout] = useState<ReportTier | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLaunchUrl, setCheckoutLaunchUrl] = useState<string | null>(
    null,
  );
  const [sample, setSample] = useState<ReportTier | null>(null);
  const [showAllTargets, setShowAllTargets] = useState(true);
  const [activeTarget, setActiveTarget] = useState<RedDotTarget | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [testCardCopied, setTestCardCopied] = useState(false);
  const [readyOffer, setReadyOffer] = useState<{ token: string; expiresAt: string } | null>(null);
  const [charterModalOpen, setCharterModalOpen] = useState(false);
  const target = useMemo(
    () => query.trim() || "Grand Island, Nebraska + Flock Safety",
    [query],
  );
  const catalogTarget = useMemo(() => resolveCatalogTarget(query), [query]);
  const isCompletedSpecimen = normalizeTarget(query).startsWith(
    "grand island nebraska",
  );
  const publicDots = dots.slice(0, publicPreviewLimit);
  const additionalDotCount = Math.max(0, dots.length - publicPreviewLimit);

  useEffect(() => {
    if (stage !== "scan") return;
    const timer = window.setInterval(
      () =>
        setActiveStep((current) => {
          if (current >= scanSteps.length - 1) {
            window.clearInterval(timer);
            window.setTimeout(() => setStage("teaser"), 650);
            return current;
          }
          return current + 1;
        }),
      620,
    );
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (!charterOffer.active || stage !== "entry") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("checkout") || sessionStorage.getItem("red-dot-charter-seen") === "1") return;
    if (localStorage.getItem("red-dot-charter-hidden") === "1") return;
    const remindAfter = Number(localStorage.getItem("red-dot-charter-remind-after") || 0);
    if (remindAfter > Date.now()) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("red-dot-charter-seen", "1");
      setCharterModalOpen(true);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [charterOffer.active, stage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTier = params.get("checkout");
    const requestedTarget = params.get("target");
    const requestedOffer = params.get("offer");
    const validTier = requestedTier === "brief" || requestedTier === "autopsy";
    if (!validTier && !requestedTarget) return;
    params.delete("checkout");
    params.delete("target");
    params.delete("offer");
    const remaining = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${remaining ? `?${remaining}` : ""}${window.location.hash}`,
    );
    const timer = window.setTimeout(() => {
      setQuery(
        requestedTarget
          ? `${requestedTarget} + Flock Safety`
          : "Grand Island, Nebraska + Flock Safety",
      );
      setStage("teaser");
      setCheckoutError(null);
      setCheckoutLaunchUrl(null);
      setCheckoutBusy(false);
      setTestCardCopied(false);
      if (validTier) setCheckout(requestedTier);
      if (requestedOffer && requestedTarget) {
        fetch(`/api/ready-offer?target=${encodeURIComponent(requestedTarget)}&offer=${encodeURIComponent(requestedOffer)}`)
          .then((response) => response.ok ? response.json() : null)
          .then((result) => result?.valid && setReadyOffer({ token: requestedOffer, expiresAt: result.expiresAt }))
          .catch(() => undefined);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (tourStep === null) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTourStep(null);
      if (event.key === "ArrowLeft" && tourStep > 0) setTourStep(tourStep - 1);
      if (event.key === "ArrowRight" && tourStep < tourSteps.length - 1)
        setTourStep(tourStep + 1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [tourStep]);

  function runScan() {
    if (!query.trim()) setQuery("Grand Island, Nebraska + Flock Safety");
    setActiveStep(0);
    setStage("scan");
  }

  function closeCharterModal(permanent = false) {
    setCharterModalOpen(false);
    if (permanent) {
      localStorage.setItem("red-dot-charter-hidden", "1");
      localStorage.removeItem("red-dot-charter-remind-after");
    } else {
      localStorage.setItem("red-dot-charter-remind-after", String(Date.now() + 24 * 60 * 60 * 1000));
    }
  }

  function submitCharterScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setCharterModalOpen(false);
    setActiveStep(0);
    setStage("scan");
  }

  function openCheckout(tier: ReportTier) {
    setCheckoutError(null);
    setCheckoutLaunchUrl(null);
    setCheckoutBusy(false);
    setTestCardCopied(false);
    setCheckout(tier);
  }

  async function copyTestCard() {
    await navigator.clipboard.writeText("4242 4242 4242 4242");
    setTestCardCopied(true);
    window.setTimeout(() => setTestCardCopied(false), 1800);
  }

  function goToEntry(anchor: "top" | "red-dot-list") {
    setStage("entry");
    setCheckout(null);
    setSample(null);
    setActiveTarget(null);
    window.setTimeout(
      () =>
        document
          .getElementById(anchor)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }

  function viewAutopsySpecimen() {
    setQuery("Grand Island, Nebraska + Flock Safety");
    setStage("report");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function finishTour() {
    setTourStep(null);
    goToEntry("top");
    window.setTimeout(
      () => document.getElementById("jurisdiction")?.focus(),
      80,
    );
  }

  async function startCheckout() {
    if (!checkout || checkoutBusy) return;
    if (commerceReadiness === "unconfigured") {
      setCheckoutError("Checkout is awaiting activation.");
      return;
    }
    if (commerceReadiness === "live_email_missing") {
      setCheckoutError("Live checkout will open after report-delivery email is activated.");
      return;
    }
    if (catalogTarget && !isLaunchTarget(catalogTarget)) {
      setCheckoutError("This monitored target is still completing final source and custodian review.");
      return;
    }
    if (!isCompletedSpecimen && !catalogTarget) {
      setCheckoutError(
        "This jurisdiction must clear the source-review threshold before a report can be purchased.",
      );
      return;
    }
    if (window.location.hostname.endsWith("chatgpt.site")) {
      const purchasePlace = catalogTarget?.place || "Grand Island, Nebraska";
      window.location.assign(
        `${canonicalSiteUrl}/?checkout=${checkout}&target=${encodeURIComponent(purchasePlace)}&checkout_offer=1${readyOffer ? `&offer=${encodeURIComponent(readyOffer.token)}` : ""}`,
      );
      return;
    }
    // Embedded site viewers reject Stripe's automatic cross-origin navigation.
    // Prepare the session in place, then expose Stripe as a direct user-clicked link.
    setCheckoutBusy(true);
    setCheckoutError(null);
    setCheckoutLaunchUrl(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: checkout,
          targetQuery: catalogTarget?.place || "Grand Island, Nebraska",
          offer: readyOffer?.token,
          checkoutOffer: true,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json"))
        throw new Error("Checkout could not be prepared.");
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error || "Checkout could not be prepared.");
      const isEmbeddedViewer =
        window.self !== window.top || document.referrer.includes("chatgpt.com");
      if (!isEmbeddedViewer) {
        window.location.assign(result.url);
        return;
      }
      setCheckoutLaunchUrl(result.url);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Checkout could not be prepared.",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar no-print">
        <a
          className="brand"
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            goToEntry("top");
          }}
        >
          <Mark />
          <span>RED DOT AUDIT</span>
          <small>FOLLOW THE RECORD</small>
        </a>
        <div className="topbar-right">
          <a
            className="nav-link"
            href="#red-dot-list"
            onClick={(event) => {
              event.preventDefault();
              goToEntry("red-dot-list");
            }}
          >
            Target list
          </a>
          <button className="text-button" onClick={viewAutopsySpecimen}>
            View Full Autopsy Sample
          </button>
          <Link className="admin-gear" href="/admin" aria-label="Open Red Dot administration" title="Admin">
            <Settings aria-hidden="true" />
          </Link>
        </div>
      </header>

      {stage === "entry" && (
        <>
          <div id="top" className="entry-layout">
            <section className="hero-copy">
              <p className="eyebrow">
                PUBLIC TECHNOLOGY · PUBLIC MONEY · PUBLIC RECORD
              </p>
              <h1>
                Find where the public record <em>does not reconcile.</em>
              </h1>
              <p className="lede">
                Red Dot Audit compares documented authority with observed system
                activity—and identifies the portion the available public record
                does not explain.
              </p>
              <div className="hero-brief">
                <span>THE TEST</span>
                <strong>Documented authority</strong>
                <i>versus</i>
                <strong>Observed access</strong>
                <small>
                  Unresolved variance → evidence brief → next records request
                </small>
              </div>
            </section>
            <section className="scan-panel">
              <div className="panel-kicker">
                <span>JURISDICTION SCAN</span>
                <b>ALPR / FLOCK SAFETY</b>
              </div>
              <h2>Enter a U.S. city or county.</h2>
              <p className="coverage-copy">
                We examine the available policies, contracts, sharing records,
                audit material and official representations.
              </p>
              <label className="scan-label" htmlFor="jurisdiction">
                CITY OR COUNTY, STATE
              </label>
              <label className="scan-input-wrap">
                <Search />
                <textarea
                  id="jurisdiction"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                      runScan();
                  }}
                  placeholder="Grand Island, Nebraska"
                  rows={1}
                />
              </label>
              <div className="examples">
                <span>VIEW A COMPLETED SPECIMEN</span>
                <button
                  onClick={() =>
                    setQuery("Grand Island, Nebraska + Flock Safety")
                  }
                >
                  Grand Island, Nebraska
                </button>
              </div>
              <Button className="scan-button" onClick={runScan}>
                Run public-record scan <ArrowRight />
              </Button>
              <p className="input-note">
                <ShieldCheck /> Public sources only · No allegation is generated
              </p>
              <button
                className="walkthrough-trigger"
                onClick={() => setTourStep(0)}
              >
                <Sparkles />
                <span>
                  <small>FIRST TIME HERE?</small>
                  <b>See the 60-second walkthrough</b>
                </span>
                <ArrowRight />
              </button>
            </section>
            <section className="method-strip">
              <article className="method-card">
                <div className="method-card-label">
                  <span>01</span>
                  <b>EVIDENCE STANDARD</b>
                </div>
                <div className="method-card-body">
                  <div className="method-proof-list">
                    <span>
                      <ShieldCheck /> Source-linked
                    </span>
                    <span>
                      <FileSearch /> Evidence-first
                    </span>
                    <span>
                      <Target /> Pre-litigation
                    </span>
                  </div>
                  <a className="method-list-link" href="#red-dot-list">
                    Review {releaseReadyTargets.length} report-ready targets <ArrowRight />
                  </a>
                </div>
              </article>
              <article className="method-card">
                <div className="method-card-label">
                  <span>02</span>
                  <b>THE SCAN</b>
                </div>
                <ol className="method-steps">
                  <li>
                    <span>01</span>
                    <div>
                      <b>Define the jurisdiction</b>
                      <small>City or county using Flock Safety ALPR</small>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <b>Reconcile the record</b>
                      <small>
                        Documented authority against observed access
                      </small>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <b>Identify missing proof</b>
                      <small>Evidence map and precise records request</small>
                    </div>
                  </li>
                </ol>
              </article>
            </section>
          </div>
          <RedDotList
            showAll={showAllTargets}
            onToggle={() => setShowAllTargets((current) => !current)}
            onOpen={setActiveTarget}
            onTest={(place) => {
              setQuery(place ? `${place} + Flock Safety` : "");
              window.setTimeout(
                () => document.getElementById("jurisdiction")?.focus(),
                0,
              );
            }}
          />
        </>
      )}

      {stage === "scan" && (
        <section className="scan-state" aria-live="polite">
          <div className="scan-radar">
            <Mark />
            <span className="orbit one" />
            <span className="orbit two" />
          </div>
          <p className="eyebrow">PRELIMINARY SCAN IN PROGRESS</p>
          <h1>{target}</h1>
          <Progress
            className="scan-progress"
            value={((activeStep + 1) / scanSteps.length) * 100}
          />
          <div className="scan-ledger">
            {scanSteps.map((step, index) => (
              <div
                key={step}
                className={index <= activeStep ? "complete" : "pending"}
              >
                <span>
                  {index < activeStep ? (
                    <Check />
                  ) : index === activeStep ? (
                    <i className="pulse-dot" />
                  ) : null}
                </span>
                {step}
                <small>
                  {index < activeStep
                    ? "FOUND"
                    : index === activeStep
                      ? "SEARCHING"
                      : "QUEUED"}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      {(stage === "teaser" || stage === "report") && isCompletedSpecimen && (
        <div className="results-page">
          <section className="result-head">
            <div>
              <p className="eyebrow">PRELIMINARY DATA-CONTROL SCAN</p>
              <h1>Grand Island, Nebraska</h1>
              <p>Flock Safety · Automatic License Plate Recognition</p>
            </div>
            <div className="score-block">
              <span>RED DOT SCORE</span>
              <strong>87</strong>
              <small>/100</small>
              <em>High-interest discrepancy</em>
            </div>
          </section>
          <section className="metric-grid">
            <div>
              <strong>9</strong>
              <span>cameras identified</span>
            </div>
            <div>
              <strong>148,369</strong>
              <span>detections / 30 days</span>
            </div>
            <div>
              <strong>212</strong>
              <span>searches reported</span>
            </div>
            <div>
              <strong>60+</strong>
              <span>outside organizations</span>
            </div>
            <div>
              <strong>{sources.length}</strong>
              <span>core sources linked</span>
            </div>
            <div className="red-metric">
              <strong>{dots.length}</strong>
              <span>unresolved Red Dots</span>
            </div>
          </section>
          <section className="finding-summary">
            <div className="summary-icon">
              <CircleAlert />
            </div>
            <div className="signal-copy">
              <p>PRIMARY SIGNAL</p>
              <h2>
                Operational access does not yet reconcile with the documented
                control trail.
              </h2>
              <span>
                The available records establish a narrow stated-use standard,
                documented outside-release controls and a required audit trail.
                The public access configuration is materially broader and
                requires evidence-level reconciliation.
              </span>
            </div>
            <div className="finding-action no-print">
              <span>OPEN THE EVIDENCE</span>
              <div>
                <button
                  aria-label="Buy Evidence Brief for $195"
                  onClick={() => openCheckout("brief")}
                >
                  Brief <b>· $195</b>
                </button>
                <button
                  aria-label="Buy Full Autopsy for $395"
                  onClick={() => openCheckout("autopsy")}
                >
                  Autopsy <b>· $395</b>
                </button>
              </div>
              <small>Secure Stripe checkout</small>
            </div>
          </section>
          <section className="dots-section">
            <div className="section-title">
              <div>
                <p className="eyebrow">PUBLIC DISCREPANCY PREVIEW</p>
                <h2>
                  {Math.min(publicPreviewLimit, dots.length)} Red Dots opened
                </h2>
              </div>
              <span>Not findings of liability</span>
            </div>
            <div className="dot-list">
              {publicDots.map((dot) => {
                const open = expanded === dot.id;
                return (
                  <article className="dot-card" key={dot.id}>
                    <button
                      onClick={() => setExpanded(open ? null : dot.id)}
                      aria-expanded={open}
                    >
                      <span className="dot-id">
                        <i />
                        {dot.id}
                      </span>
                      <span
                        className={`severity ${dot.severity.toLowerCase()}`}
                      >
                        {dot.severity}
                      </span>
                      <span className="dot-title">
                        <strong>{dot.title}</strong>
                        <small>{dot.summary}</small>
                        <em>REQUEST {dot.request} DRAFTED</em>
                      </span>
                      <ChevronDown className={open ? "rotate" : ""} />
                    </button>
                    {open && (
                      <div className="dot-detail">
                        <div>
                          <span>REQUIREMENT</span>
                          <p>{dot.requirement}</p>
                        </div>
                        <div>
                          <span>OBSERVED</span>
                          <p>{dot.observed}</p>
                        </div>
                        <div>
                          <span>STATUS / NEXT PROOF</span>
                          <p>{dot.status}</p>
                        </div>
                        <div className="dot-resolution">
                          <span>WHAT RESOLVES IT</span>
                          <p>{dot.resolution}</p>
                          <small>{dot.custodian}</small>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="masked-request-gate no-print">
              <div>
                <p className="eyebrow">INVESTIGATIVE WORK PRODUCT READY</p>
                <h3>
                  {additionalDotCount > 0
                    ? `${additionalDotCount} additional Red Dots are reserved for the report.`
                    : "The investigative work product continues in the report."}
                </h3>
                <span>
                  All substantiated Red Dots are included—four is only the
                  public-preview limit. The Full Autopsy also contains three
                  separately routed public-records request packets.
                </span>
              </div>
              <div className="masked-request-list">
                {requestPackets.map((packet) => (
                  <div key={packet.id}>
                    <b>REQUEST {packet.id}</b>
                    <span>{packet.title}</span>
                    <em>DRAFTED</em>
                    <i aria-hidden="true">
                      Recipient and submission route reserved
                    </i>
                  </div>
                ))}
              </div>
              <div className="report-handoff-actions">
                <button onClick={() => openCheckout("brief")}>Buy report <ArrowRight /></button>
                <button onClick={() => setSample("autopsy")}>View Full Autopsy sample <ArrowRight /></button>
              </div>
            </div>
          </section>
          {stage === "teaser" ? (
            <section className="unlock-section no-print">
              <div className="unlock-heading">
                <span className="eyebrow">CHOOSE THE DEPTH</span>
                <h2>Turn the signal into an investigative next move.</h2>
                <p>
                  Both products are source-linked. The Full Autopsy adds the
                  people, proof requests and ready-to-send legal work product.
                </p>
              </div>
              {charterOffer.active && <CharterLaunchBanner offer={charterOffer} />}
              <div className="tier-grid">
                <article className="tier-card brief-tier">
                  <div className="tier-top">
                    <span>EVIDENCE BRIEF</span>
                    <strong>
                      <sup>$</sup>195
                    </strong>
                  </div>
                  <p>
                    Answers the first question:{" "}
                    <em>Is this target worth opening further?</em>
                  </p>
                  <div className="tier-counts">
                    <span><b>{dots.length}</b> Red Dots</span>
                    <span><b>{sources.length}</b> core sources</span>
                    <span><b>1</b> priority path</span>
                  </div>
                  <ul>
                    <li>
                      <Check /> Authority and policy map
                    </li>
                    <li>
                      <Check /> Every substantiated Red Dot
                    </li>
                    <li>
                      <Check /> Source findings register
                    </li>
                    <li>
                      <Check /> Missing-proof summary
                    </li>
                  </ul>
                  <button
                    className="sample-link"
                    onClick={() => setSample("brief")}
                  >
                    View Evidence Brief sample <ArrowRight />
                  </button>
                  <Button onClick={() => openCheckout("brief")}>
                    Buy Evidence Brief — $195 <ArrowRight />
                  </Button>
                </article>
                <article className="tier-card autopsy-tier">
                  <div className="best-value">
                    {charterOffer.active ? "CHARTER LAUNCH · SAVE $100" : "COMPLETE INVESTIGATIVE PACKAGE"}
                  </div>
                  <div className="tier-top">
                    <span>FULL AUTOPSY</span>
                    <strong>
                      {charterOffer.active && <del>$395</del>}<sup>$</sup>{charterOffer.active ? 295 : 395}
                    </strong>
                  </div>
                  <p>
                    Turns the Red Dots into a documented investigative next
                    move.
                  </p>
                  <div className="tier-counts">
                    <span><b>{dots.length}</b> Red Dots</span>
                    <span><b>6</b> missing records</span>
                    <span><b>3</b> drafted requests</span>
                  </div>
                  <ul>
                    <li>
                      <Check /> Everything in the Evidence Brief
                    </li>
                    <li>
                      <Check /> Responsible-actor chain
                    </li>
                    <li>
                      <Check /> Exact missing-proof inventory
                    </li>
                    <li>
                      <Check /> Three routed request packets
                    </li>
                  </ul>
                  <button
                    className="sample-link"
                    onClick={() => setSample("autopsy")}
                  >
                    View Full Autopsy sample <ArrowRight />
                  </button>
                  <Button onClick={() => openCheckout("autopsy")}>
                    {`Buy Full Autopsy — ${charterOffer.active ? "$295" : "$395"}`} <ArrowRight />
                  </Button>
                </article>
              </div>
              <p className="prototype-note">
                Secure Stripe checkout · card and email collected by Stripe
              </p>
            </section>
          ) : (
            <FullReport
              onDownload={() => downloadGrandIslandReport("autopsy")}
            />
          )}
        </div>
      )}

      {(stage === "teaser" || stage === "report") &&
        !isCompletedSpecimen &&
        catalogTarget &&
        isLaunchTarget(catalogTarget) && (
          <CatalogTargetResult
            target={catalogTarget}
            readyOffer={readyOffer}
            charterOffer={charterOffer}
            onReturn={() => goToEntry("red-dot-list")}
            onCheckout={openCheckout}
            onSample={setSample}
          />
        )}

      {(stage === "teaser" || stage === "report") &&
        !isCompletedSpecimen &&
        (!catalogTarget || !isLaunchTarget(catalogTarget)) && (
        <UnscannedResult
          query={enteredJurisdiction(query)}
          onReturn={() => goToEntry("red-dot-list")}
        />
      )}

      {sample && <SampleModal tier={sample} onClose={() => setSample(null)} />}

      {activeTarget && (
        <TargetModal
          target={activeTarget}
          onClose={() => setActiveTarget(null)}
          onTest={() => {
            setQuery(`${activeTarget.place} + Flock Safety`);
            setActiveTarget(null);
            setActiveStep(0);
            setStage("scan");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {checkout && (
        <CheckoutModal
          tier={checkout}
          target={catalogTarget}
          specimen={isCompletedSpecimen}
          busy={checkoutBusy}
          error={checkoutError}
          launchUrl={checkoutLaunchUrl}
          commerceReadiness={commerceReadiness}
          readyOffer={readyOffer}
          charterOffer={charterOffer}
          copied={testCardCopied}
          onClose={() => setCheckout(null)}
          onCopy={copyTestCard}
          onStart={startCheckout}
          onSelectTier={(next) => { setCheckout(next); setCheckoutError(null); setCheckoutLaunchUrl(null); }}
        />
      )}

      {charterModalOpen && stage === "entry" && (
        <div className="charter-modal-backdrop no-print" onMouseDown={() => closeCharterModal()}>
          <section className="charter-modal" role="dialog" aria-modal="true" aria-labelledby="charter-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close charter offer" onClick={() => closeCharterModal()}><X /></button>
            <Mark />
            <p className="eyebrow">CHARTER LAUNCH · 25 FULL AUTOPSIES</p>
            <h2 id="charter-modal-title">The complete investigation.<br /><em>$295.</em></h2>
            <div className="charter-modal-value">
              <div><small>REGULAR PRICE</small><del>$395</del></div>
              <b aria-hidden="true">→</b>
              <div className="charter-price"><small>CHARTER PRICE</small><strong>$295</strong></div>
              <b aria-hidden="true">→</b>
              <div className="charter-save"><small>YOU SAVE</small><strong>$100</strong></div>
              <p>Get the complete investigative work product for $100 less during the Charter Launch.</p>
            </div>
            <div className="charter-modal-command">
              <b>FIND YOUR JURISDICTION</b>
              <p>Enter the city or county you want examined.</p>
            </div>
            <form onSubmit={submitCharterScan}>
              <label htmlFor="charter-jurisdiction">CITY OR COUNTY, STATE</label>
              <span><Search /><input id="charter-jurisdiction" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Grand Island, Nebraska" autoFocus /></span>
              <button type="submit" disabled={!query.trim()}>CHECK THE PUBLIC RECORD <ArrowRight /></button>
            </form>
            <small>Available reports open immediately. If yours is not yet live, submit it for source review.</small>
            <footer><button onClick={() => closeCharterModal()}>Continue to the site</button><button onClick={() => closeCharterModal(true)}>Don&apos;t show again</button></footer>
          </section>
        </div>
      )}

      {tourStep !== null && (
        <div
          className="tour-backdrop no-print"
          onMouseDown={() => setTourStep(null)}
        >
          <section
            className="tour-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <Mark />
                <span>HOW RED DOT WORKS</span>
              </div>
              <em>
                {tourStep + 1} OF {tourSteps.length}
              </em>
              <button
                aria-label="Exit walkthrough"
                onClick={() => setTourStep(null)}
              >
                <X />
              </button>
            </header>
            <div className="tour-body">
              <div className={`tour-visual tour-visual-${tourStep + 1}`}>
                <Image
                  src={tourSteps[tourStep].image}
                  alt={tourSteps[tourStep].alt}
                  fill
                  sizes="(max-width: 760px) 100vw, 68vw"
                  priority={tourStep === 0}
                  unoptimized
                />
              </div>
              <article>
                <p>{tourSteps[tourStep].label}</p>
                <h2 id="tour-title">{tourSteps[tourStep].title}</h2>
                <span>{tourSteps[tourStep].copy}</span>
                <ul>
                  {tourSteps[tourStep].points.map((point) => (
                    <li key={point}>
                      <i />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <footer>
              <button className="tour-exit" onClick={() => setTourStep(null)}>
                Exit tour
              </button>
              <div
                className="tour-dots"
                aria-label={`Step ${tourStep + 1} of ${tourSteps.length}`}
              >
                {tourSteps.map((step, index) => (
                  <button
                    key={step.label}
                    aria-label={`Go to step ${index + 1}`}
                    className={index === tourStep ? "active" : ""}
                    onClick={() => setTourStep(index)}
                  />
                ))}
              </div>
              <div className="tour-controls">
                <button
                  disabled={tourStep === 0}
                  onClick={() =>
                    setTourStep((current) =>
                      current === null ? null : Math.max(0, current - 1),
                    )
                  }
                >
                  Back
                </button>
                <button
                  onClick={() =>
                    tourStep === tourSteps.length - 1
                      ? finishTour()
                      : setTourStep(tourStep + 1)
                  }
                >
                  {tourStep === tourSteps.length - 1
                    ? "Run your own scan"
                    : "Next"}
                  <ArrowRight />
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      <footer className="footer no-print">
        <div className="footer-brand">
          <Link className="brand" href="/">
            <Mark />
            <span>RED DOT AUDIT</span>
          </Link>
          <p>Public technology. Public money. Public record.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/vault">Report access</Link>
          <Link href="/methodology">Methodology</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/support">Support</Link>
        </nav>
        <div className="footer-meta">
          <span>RedDotAudit.com</span>
          <small>© {new Date().getFullYear()} Red Dot Audit</small>
        </div>
      </footer>
    </main>
  );
}

function CatalogTargetResult({
  target,
  readyOffer,
  charterOffer,
  onReturn,
  onCheckout,
}: {
  target: RedDotTarget;
  readyOffer: { token: string; expiresAt: string } | null;
  charterOffer: CharterOfferStatus;
  onReturn: () => void;
  onCheckout: (tier: ReportTier) => void;
  onSample: (tier: ReportTier) => void;
}) {
  const findings = targetDots(target);
  const previewFindings = findings.slice(0, publicPreviewLimit);
  const hiddenFindings = Math.max(0, findings.length - previewFindings.length);
  return (
    <div className="results-page catalog-result-page">
      <section className="catalog-result-head">
        <div>
          <p className="eyebrow">
            QUALIFIED RED DOT TARGET · #{String(target.rank).padStart(2, "0")}
          </p>
          <h1>{target.place}</h1>
          <p>{target.agency} · Flock Safety ALPR</p>
        </div>
        <div className="score-block">
          <span>RED DOT SCORE</span>
          <strong>{target.score}</strong>
          <small>/100</small>
          <em>Report available</em>
        </div>
      </section>
      <section className="metric-grid">
        {(target.publicMetrics || [
          { value: String(target.rank), label: "inventory rank" },
          { value: String(target.sources.length), label: "reviewed sources" },
          { value: String(findings.length), label: "substantiated Red Dots" },
          { value: "3", label: "requests drafted" },
        ]).map((metric) => (
          <div key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
        <div>
          <strong>{target.category}</strong>
          <span>primary class</span>
        </div>
        <div className="red-metric">
          <strong>{target.slug === "norfolk-va" ? "DIG" : target.score}</strong>
          <span>{target.slug === "norfolk-va" ? "evidence trace required" : "evidence readiness"}</span>
        </div>
      </section>
      <section className="catalog-signal">
        <div>
          <p className="eyebrow">PRIMARY SIGNAL</p>
          <h2>{target.teaser}</h2>
        </div>
        <aside>
          <CircleAlert />
          <span>
            <b>{target.slug === "norfolk-va" ? "Local baseline established" : "Source-qualified package"}</b>
            {target.slug === "norfolk-va"
              ? " Purchase opens the Norfolk-specific evidence trace; the baseline does not claim a proven unlawful search."
              : " Ready for Evidence Brief or Full Autopsy purchase."}
          </span>
        </aside>
      </section>
      <section className="catalog-evidence">
        <div>
          <p className="eyebrow">CONTROL AGAINST OBSERVED STATE</p>
          <p>
            <Check />
            {target.control}
          </p>
          <p>
            <CircleAlert />
            {target.observed}
          </p>
        </div>
        <div className="catalog-source-stack">
          <span>REVIEWED PUBLIC SOURCES</span>
          {target.sources.map((source) => (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              key={source.url}
            >
              <FileSearch />
              <b>{source.label}</b>
              <ArrowRight />
            </a>
          ))}
        </div>
      </section>
      <section className="catalog-resolution">
        <div>
          <p className="eyebrow">RESOLUTION INVENTORY</p>
          <h2>{target.slug === "norfolk-va" ? "The local footprint is established. The dig traces the operational record." : "The missing record is mapped to a custodian and a prepared request."}</h2>
        </div>
        <dl>
          <div><dt>RED DOTS</dt><dd>{findings.length}</dd></div>
          <div><dt>RECORD CATEGORIES</dt><dd>{missingProofItems(target).length}</dd></div>
          <div><dt>REQUEST PACKETS</dt><dd>3 drafted</dd></div>
        </dl>
      </section>
      <section className="dots-section qualified-dot-preview">
        <div className="section-title">
          <div>
            <p className="eyebrow">PUBLIC DISCREPANCY PREVIEW</p>
            <h2>
              {previewFindings.length} of {findings.length} Red Dots opened
            </h2>
          </div>
          <span>Not findings of liability</span>
        </div>
        <div className="dot-list">
          {previewFindings.map((dot) => (
            <article className="dot-card" key={dot.id}>
              <div className="qualified-dot-row">
                <span className="dot-id">
                  <i />
                  {dot.id}
                </span>
                <span className={`severity ${dot.severity.toLowerCase()}`}>
                  {dot.severity}
                </span>
                <span className="dot-title">
                  <strong>{dot.title}</strong>
                  <small>{dot.summary}</small>
                  <em>REQUEST {dot.request} DRAFTED</em>
                  <span className="qualified-resolution"><b>WHAT RESOLVES IT</b>{dot.resolution}</span>
                </span>
              </div>
            </article>
          ))}
        </div>
        {hiddenFindings > 0 && (
          <div className="preview-reserve">
            <b>{hiddenFindings} additional substantiated {hiddenFindings === 1 ? "Red Dot" : "Red Dots"}</b>
            <span>Included in either purchased report; supporting acquisition work is included in the Full Autopsy.</span>
          </div>
        )}
        <div className="catalog-report-handoff no-print">
          <div><p className="eyebrow">INVESTIGATIVE WORK PRODUCT READY</p><h3>The complete evidence file continues in the report.</h3><span>All substantiated Red Dots and three drafted records requests are ready.</span></div>
          <div className="report-handoff-actions"><button onClick={() => onCheckout("brief")}>Buy report <ArrowRight /></button><button onClick={() => onSample("autopsy")}>View Full Autopsy sample <ArrowRight /></button></div>
        </div>
      </section>
      <section className="unlock-section no-print">
        {readyOffer && (
          <div className="purchase-offer-banner">
            <div><b>YOUR REPORT IS READY</b><strong>Your private pricing is reserved for 24 hours.</strong></div>
            <span>Offer ends {new Date(readyOffer.expiresAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</span>
          </div>
        )}
        <div className="unlock-heading">
          <span className="eyebrow">REPORT INVENTORY READY</span>
          <h2>Open the evidence—or the complete investigative next move.</h2>
          <p>
            The briefing is built from this jurisdiction&apos;s record. No
            substitute-city evidence is used.
          </p>
        </div>
        {charterOffer.active && <CharterLaunchBanner offer={charterOffer} />}
        <div className="tier-grid">
          <article className="tier-card brief-tier">
            {readyOffer && <div className="offer-value">READY OFFER · SAVE $20</div>}
            <div className="tier-top">
              <span>EVIDENCE BRIEF</span>
              <strong>
                {readyOffer && <del>$195</del>}<sup>$</sup>{readyOffer ? 175 : 195}
              </strong>
            </div>
            <p>
              Answers the first question:{" "}
              <em>Is this target worth opening further?</em>
            </p>
            <div className="tier-counts">
              <span><b>{findings.length}</b> Red Dots</span>
              <span><b>{target.sources.length}</b> sources</span>
              <span><b>1</b> priority path</span>
            </div>
            <ul>
              <li>
                <Check /> Authority and control map
              </li>
              <li>
                <Check /> Every substantiated Red Dot
              </li>
              <li>
                <Check /> Complete source register
              </li>
              <li>
                <Check /> Missing-proof summary
              </li>
            </ul>
            <button className="sample-link" onClick={() => onSample("brief")}>
              View Evidence Brief sample <ArrowRight />
            </button>
            <Button onClick={() => onCheckout("brief")}>
              {readyOffer ? "Get the Evidence Brief — $175" : "Buy Evidence Brief — $195"} <ArrowRight />
            </Button>
          </article>
          <article className="tier-card autopsy-tier">
            <div className="best-value">{charterOffer.active ? "CHARTER LAUNCH · SAVE $100" : readyOffer ? "BEST VALUE · SAVE $75" : "COMPLETE INVESTIGATIVE PACKAGE"}</div>
            <div className="tier-top">
              <span>FULL AUTOPSY</span>
              <strong>
                {(charterOffer.active || readyOffer) && <del>$395</del>}<sup>$</sup>{charterOffer.active ? 295 : readyOffer ? 320 : 395}
              </strong>
            </div>
            <p>Turns the signal into a documented acquisition plan.</p>
            <div className="tier-counts">
              <span><b>{findings.length}</b> Red Dots</span>
              <span><b>{missingProofItems(target).length}</b> missing records</span>
              <span><b>3</b> drafted requests</span>
            </div>
            <ul>
              <li>
                <Check /> Everything in the Evidence Brief
              </li>
              <li>
                <Check /> Responsible-actor chain
              </li>
              <li>
                <Check /> Exact missing-proof inventory
              </li>
              <li>
                <Check /> Three drafted request packets
              </li>
            </ul>
            <button className="sample-link" onClick={() => onSample("autopsy")}>
              View Full Autopsy sample <ArrowRight />
            </button>
            <Button onClick={() => onCheckout("autopsy")}>
              {charterOffer.active ? "Get the Full Autopsy — $295" : readyOffer ? "Get the Full Autopsy — $320" : "Buy Full Autopsy — $395"} <ArrowRight />
            </Button>
          </article>
        </div>
        <button className="catalog-return" onClick={onReturn}>
          Review all {releaseReadyTargets.length} ready reports <ArrowRight />
        </button>
      </section>
    </div>
  );
}

function CheckoutModal({
  tier,
  target,
  specimen,
  busy,
  error,
  launchUrl,
  commerceReadiness,
  readyOffer,
  charterOffer,
  copied,
  onClose,
  onCopy,
  onStart,
  onSelectTier,
  onSample,
}: {
  tier: ReportTier;
  target: RedDotTarget | null;
  specimen: boolean;
  busy: boolean;
  error: string | null;
  launchUrl: string | null;
  commerceReadiness: CommerceReadiness;
  readyOffer: { token: string; expiresAt: string } | null;
  charterOffer: CharterOfferStatus;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
  onStart: () => void;
  onSelectTier: (tier: ReportTier) => void;
}) {
  const [checkoutUrlCopied, setCheckoutUrlCopied] = useState(false);
  const place = target?.place || "Grand Island, Nebraska";
  const findings = target ? targetDots(target) : dots;
  const sourceCount = target?.sources.length || sources.length;
  const highPriorityCount = findings.filter((finding) => finding.severity === "HIGH").length;
  const signal =
    target?.observed ||
    "Operational access does not yet reconcile with the documented control trail.";
  const price = tier === "brief" ? 175 : charterOffer.active ? 295 : 320;
  return (
    <div
      className="modal-backdrop no-print"
      onMouseDown={() => !busy && onClose()}
    >
      <section
        className="checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close checkout"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </button>
        <Mark />
        <p className="eyebrow">YOUR REPORT IS READY</p>
        <h2 id="checkout-title">Choose your {place} report.</h2>
        <p className="checkout-offer-lead">Complete your purchase now and save up to ${charterOffer.active ? 100 : 75}.</p>
        <div className="checkout-choice-grid">
          <button type="button" className={tier === "brief" ? "selected" : ""} onClick={() => onSelectTier("brief")}>
            <span>EVIDENCE BRIEF</span><strong className="price-line"><del>$195</del><small>SAVE $20</small><b>$175</b></strong><em>Evidence assessment + complete source findings register</em>
          </button>
          <button type="button" className={`autopsy-choice ${tier === "autopsy" ? "selected" : ""}`} onClick={() => onSelectTier("autopsy")}>
            <i>{charterOffer.active ? "CHARTER LAUNCH · SAVE $100" : "BEST VALUE · SAVE $75"}</i><span>FULL AUTOPSY</span><strong className="price-line"><del>$395</del><small>SAVE ${charterOffer.active ? 100 : 75}</small><b>${charterOffer.active ? 295 : 320}</b></strong><em>Complete investigation + responsibility map + three drafted records requests</em>
          </button>
        </div>
        {charterOffer.active && <CharterLaunchBanner offer={charterOffer} compact />}
        <div className="checkout-proof"><b>{place}</b><span>{findings.length} unresolved Red Dots · {highPriorityCount} high-priority · {sourceCount} reviewed sources</span></div>
        <div className="checkout-details checkout-details-visible">
          <b className="checkout-details-title">EVIDENCE AND REPORT CONTENTS</b>
          <p>{signal}</p>
          <div className="checkout-scope">
            <section><span>EVIDENCE BRIEF</span><ul><li><i>✓</i>Executive investigative assessment</li><li><i>✓</i>Every substantiated Red Dot</li><li><i>✓</i>Complete source findings register</li><li><i>✓</i>Established / not-established boundary</li></ul></section>
            <section><span>FULL AUTOPSY ADDS</span><ul><li><i>✓</i>Responsible-actor and control map</li><li><i>✓</i>Evidence-acquisition sequence</li><li><i>✓</i>Exact missing-proof inventory</li><li><i>✓</i>Three drafted request packets</li></ul></section>
          </div>
        </div>
        {readyOffer && <div className="ready-offer-expiry">24-hour offer reserved through {new Date(readyOffer.expiresAt).toLocaleString()}.</div>}
        {commerceReadiness === "sandbox" && (
          <div className="sandbox-helper">
            <div>
              <span>PRIVATE REVIEW · STRIPE SANDBOX</span>
              <b>Reviewer test card</b>
              <small>
                Use any future date, any three-digit CVC and a real delivery
                email. Skip Link and phone. No funds move in this mode.
              </small>
            </div>
            <button type="button" onClick={onCopy}>
              {copied ? "COPIED" : "4242 4242 4242 4242"}
            </button>
          </div>
        )}
        {(commerceReadiness === "unconfigured" || commerceReadiness === "live_email_missing") && (
          <div className="checkout-error" role="status">
            {commerceReadiness === "live_email_missing"
              ? "Live payment is paused until report-delivery email is active."
              : "Checkout is awaiting activation."}
          </div>
        )}
        {error && (
          <div className="checkout-error" role="alert">
            {error}
          </div>
        )}
        <div className="checkout-reassurance"><ShieldCheck /> Secure Stripe checkout · Immediate private report access</div>
        {launchUrl ? (
          <div className="checkout-launch-ready">
            <a
              className="checkout-fallback"
              href={launchUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Stripe in a browser tab <ArrowRight />
            </a>
            <button
              type="button"
              className="checkout-copy-link"
              onClick={async () => {
                await navigator.clipboard.writeText(launchUrl);
                setCheckoutUrlCopied(true);
                window.setTimeout(() => setCheckoutUrlCopied(false), 1800);
              }}
            >
              {checkoutUrlCopied
                ? "Checkout URL copied"
                : "Copy secure checkout URL"}
            </button>
          </div>
        ) : (
          <Button
            disabled={busy || commerceReadiness === "unconfigured" || commerceReadiness === "live_email_missing"}
            onClick={onStart}
          >
            {busy
              ? "Preparing secure checkout…"
              : tier === "brief"
                ? `Buy Evidence Brief — $${price}`
                : `Buy Full Autopsy — $${price}`}{" "}
            <ArrowRight />
          </Button>
        )}
        <small>
          {launchUrl
            ? "Private viewer: if the red button is blocked, copy the URL and paste it into Chrome's address bar."
            : specimen
              ? "This checkout is for the labeled Grand Island specimen."
              : `${tier === "autopsy" ? "Full Autopsy" : "Evidence Brief"} selected · report access is issued after Stripe confirms payment.`}
        </small>
      </section>
    </div>
  );
}

function CharterLaunchBanner({ offer, compact = false }: { offer: CharterOfferStatus; compact?: boolean }) {
  const showLiveCount = offer.sold >= 10;
  return <div className={`charter-launch-banner ${compact ? "compact" : ""}`}>
    <div><b>CHARTER LAUNCH</b><strong>Full Autopsy · $295</strong><span>Regularly $395 · Save $100</span></div>
    <p>{showLiveCount ? <><b>{offer.sold} taken</b><span>{offer.remaining} remaining</span></> : <><b>Charter cohort now forming</b><span>Limited to 25 clients</span></>}</p>
    {!compact && <small>Available through October 8, 2026, or until the first 25 paid Full Autopsies are claimed.</small>}
  </div>;
}

function UnscannedResult({
  query,
  onReturn,
}: {
  query: string;
  onReturn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState(false);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/research-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jurisdiction: query, email }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "The request could not be saved.");
      setReceived(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="results-page catalog-result-page unscanned-result">
      <section className="catalog-result-head">
        <div>
          <p className="eyebrow">JURISDICTION CHECK</p>
          <h1>{query}</h1>
          <p>United States municipality or county · Flock Safety ALPR</p>
        </div>
        <div className="catalog-result-label neutral">
          <span>NOT YET REVIEWED</span>
        </div>
      </section>
      <section className="catalog-boundary request-boundary">
        <div>
          <span>NO RELEASE-QUALIFIED PACKAGE YET</span>
          <h2>
            Request source review and a readiness notification.
          </h2>
          <p>
            We will not display another municipality&apos;s evidence under this
            name. This request adds the jurisdiction to the private research
            queue; it does not promise that a report will be produced.
          </p>
        </div>
        {received ? (
          <div className="research-request-success" role="status">
            <Check />
            <div>
              <b>REVIEW REQUESTED</b>
              <p>No report has been promised. We will email you only if this jurisdiction clears the source and evidence threshold.</p>
            </div>
          </div>
        ) : (
          <form className="research-request-form" onSubmit={submitRequest}>
            <label>
              <span>EMAIL FOR READINESS NOTICE</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <input className="request-honeypot" name="website" tabIndex={-1} autoComplete="off" />
            {error && <p className="research-request-error">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Adding to research queue…" : "Request source review"} <ArrowRight />
            </Button>
            <small>Review and notification only · no completion or timing promise</small>
          </form>
        )}
        <button className="request-return" onClick={onReturn}>
          Review {releaseReadyTargets.length} report-ready targets
        </button>
      </section>
    </div>
  );
}

function RedDotList({
  showAll,
  onToggle,
  onOpen,
  onTest,
}: {
  showAll: boolean;
  onToggle: () => void;
  onOpen: (target: RedDotTarget) => void;
  onTest: (place: string) => void;
}) {
  type TargetSort = "signal" | "newest" | "oldest" | "place";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TargetSort>("signal");
  const [state, setState] = useState("ALL");
  const [incident, setIncident] = useState("ALL");
  const [development, setDevelopment] = useState("ALL");
  const states = useMemo(
    () => [...new Set(releaseReadyTargets.map((target) => target.state))].sort(),
    [],
  );
  const incidents = useMemo(
    () => [...new Set(releaseReadyTargets.map((target) => target.category))].sort(),
    [],
  );
  const developments = useMemo(
    () => [...new Set(releaseReadyTargets.map((target) => target.status))].sort(),
    [],
  );
  const hasIndexSelection =
    query.trim() !== "" ||
    state !== "ALL" ||
    incident !== "ALL" ||
    development !== "ALL" ||
    sort !== "signal";
  const targets = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    const base = showAll || hasIndexSelection
      ? releaseReadyTargets
      : releaseReadyTargets.filter((target) => target.featured);
    return base
      .filter((target) => {
        const searchable = `${target.place} ${target.agency} ${target.state}`.toLowerCase();
        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (state === "ALL" || target.state === state) &&
          (incident === "ALL" || target.category === incident) &&
          (development === "ALL" || target.status === development)
        );
      })
      .sort((a, b) => {
        if (sort === "place") return a.place.localeCompare(b.place);
        if (sort === "newest" || sort === "oldest") {
          const aDate = a.evidenceDate ? Date.parse(a.evidenceDate) : 0;
          const bDate = b.evidenceDate ? Date.parse(b.evidenceDate) : 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return sort === "newest" ? bDate - aDate : aDate - bDate;
        }
        return b.score - a.score || a.rank - b.rank;
      });
  }, [development, hasIndexSelection, incident, query, showAll, sort, state]);
  const clearIndex = () => {
    setQuery("");
    setSort("signal");
    setState("ALL");
    setIncident("ALL");
    setDevelopment("ALL");
  };
  return (
    <section id="red-dot-list" className="target-list-section no-print">
      <div className="target-list-head">
        <div>
          <p className="eyebrow">THE RED DOT LIST</p>
          <h2>
            {releaseReadyTargets.length} source-qualified city and county report packages.
          </h2>
        </div>
        <p>
          These are source-backed investigative starting points—not findings of
          wrongdoing. Open a target to see what surfaced, or test your own
          jurisdiction.
        </p>
      </div>
      <div className="target-index" aria-label="Target catalog controls">
        <div className="target-index-head">
          <div>
            <span>CATALOG INDEX</span>
            <strong>{showAll || hasIndexSelection ? `Showing ${targets.length} of ${releaseReadyTargets.length} available reports` : `Showing ${targets.length} featured reports · ${releaseReadyTargets.length} available`}</strong>
          </div>
          <p>Filter the live inventory. New research records enter this same index.</p>
        </div>
        <div className="target-index-controls">
          <label className="target-index-search">
            <span>JURISDICTION OR AGENCY</span>
            <div>
              <Search aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the record"
              />
            </div>
          </label>
          <label>
            <span>SORT</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as TargetSort)}>
              <option value="signal">Highest signal</option>
              <option value="newest">Newest evidence</option>
              <option value="oldest">Oldest evidence</option>
              <option value="place">Jurisdiction A–Z</option>
            </select>
          </label>
          <label>
            <span>STATE</span>
            <select value={state} onChange={(event) => setState(event.target.value)}>
              <option value="ALL">All states</option>
              {states.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>INCIDENT</span>
            <select value={incident} onChange={(event) => setIncident(event.target.value)}>
              <option value="ALL">All incidents</option>
              {incidents.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>DEVELOPMENT</span>
            <select value={development} onChange={(event) => setDevelopment(event.target.value)}>
              <option value="ALL">All developments</option>
              {developments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearIndex} disabled={!hasIndexSelection}>
            RESET INDEX
          </button>
        </div>
      </div>
      <div className="target-grid">
        {targets.map((target, index) => (
          <Fragment key={target.slug}>
            <button className="target-card" onClick={() => onOpen(target)}>
              <span className="target-card-head">
                <b>{target.state}</b>
                <em>{target.category}</em>
              </span>
              <strong>{target.place}</strong>
              <small>{target.agency}</small>
              <span className="target-card-meta">
                <span className="target-status">
                  <i />
                  {target.status}
                </span>
                {target.evidenceDate && (
                  <time dateTime={target.evidenceDate}>
                    {new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(target.evidenceDate))}
                  </time>
                )}
              </span>
              <p>{target.teaser}</p>
              <span className="target-card-foot">
                View target <ArrowRight />
              </span>
            </button>
            {targets.length > 9 && (index === 8 || index === 17) && (
              <a
                className="city-cta grid-city-cta"
                href="#jurisdiction"
                onClick={() => onTest("")}
              >
                <span>PUT YOUR LOCAL RECORD TO THE TEST</span>
                <strong>Enter your city or county</strong>
                <ArrowRight />
              </a>
            )}
          </Fragment>
        ))}
        {targets.length === 0 && (
          <div className="target-index-empty">
            <span>NO MATCHING RECORDS</span>
            <p>Change one filter or reset the index to return to the full catalog.</p>
            <button type="button" onClick={clearIndex}>Reset index</button>
          </div>
        )}
      </div>
      <div className="target-list-actions">
        <Button variant="outline" onClick={hasIndexSelection ? clearIndex : onToggle}>
          {hasIndexSelection
            ? "Reset catalog index"
            : showAll
              ? "Show featured reports"
              : `View all ${releaseReadyTargets.length} ready reports`} <ArrowRight />
        </Button>
        <a className="city-cta" href="#jurisdiction" onClick={() => onTest("")}>
          <span>NOT ON THE LIST?</span>
          <strong>Enter your city or county</strong>
          <ArrowRight />
        </a>
      </div>
    </section>
  );
}

function TargetModal({
  target,
  onClose,
  onTest,
}: {
  target: RedDotTarget;
  onClose: () => void;
  onTest: () => void;
}) {
  return (
    <div className="modal-backdrop no-print" onMouseDown={onClose}>
      <section
        className="target-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close target preview"
        >
          <X />
        </button>
        <div className="target-modal-head">
          <span>{target.state}</span>
          <em>{target.category}</em>
          <p className="eyebrow">RED DOT TARGET · {target.status}</p>
          <h2 id="target-title">{target.place}</h2>
          <small>{target.agency}</small>
        </div>
        <div className="target-modal-body">
          <p className="target-lead">{target.teaser}</p>
          <div className="target-evidence">
            <span>WHAT SURFACED</span>
            {target.evidence.map((item) => (
              <p key={item}>
                <i />
                {item}
              </p>
            ))}
          </div>
          {target.publicMetrics && (
            <div className="target-baseline" aria-label={`${target.place} public baseline`}>
              {target.publicMetrics.map((metric) => (
                <div key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="target-boundary">
            <CircleAlert />
            <p>
              <b>Preliminary boundary</b>This identifies a public-record
              reconciliation question—not misconduct, liability or legal advice.
            </p>
          </div>
          <a
            className="target-source"
            href={target.sourceHref}
            target="_blank"
            rel="noreferrer"
          >
            Open source: {target.sourceLabel} <ArrowRight />
          </a>
        </div>
        <div className="target-modal-actions">
          <Button variant="outline" onClick={onClose}>
            Back to list
          </Button>
          <Button onClick={onTest}>
            {target.slug === "norfolk-va" ? "Dig this jurisdiction" : "Run this jurisdiction"} <ArrowRight />
          </Button>
        </div>
      </section>
    </div>
  );
}

function SampleModal({
  tier,
  onClose,
}: {
  tier: ReportTier;
  onClose: () => void;
}) {
  const full = tier === "autopsy";
  return (
    <div className="modal-backdrop no-print" onMouseDown={onClose}>
      <section
        className="sample-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          <X />
        </button>
        <div className="sample-cover">
          <Mark />
          <p className="eyebrow">SAMPLE DELIVERABLE</p>
          <h2>{full ? "$395 Full Autopsy" : "$195 Evidence Brief"}</h2>
          <span>Grand Island, Nebraska · Flock Safety ALPR</span>
        </div>
        <div className="sample-body">
          <div className="sample-score">
            <span>RED DOT SCORE</span>
            <strong>87</strong>
            <small>/100</small>
          </div>
          <div className="sample-section">
            <span>01 · AUTHORITY</span>
            <strong>
              Nebraska ALPR Privacy Act + GIPD General Order O2416
            </strong>
            <p>
              Manual queries require an investigative nexus and documented
              purpose. Department policy also describes approval and retention
              controls for outside release.
            </p>
          </div>
          <div className="sample-section red-sample">
            <span>02 · PRIMARY VARIANCE</span>
            <strong>
              Outside access does not yet reconcile with the documented control
              trail.
            </strong>
            <p>
              Operational sharing appears broader than the publicly established
              request-and-approval population.
            </p>
          </div>
          <div className="sample-table">
            <div>
              <b>Requirement</b>
              <b>Observed</b>
              <b>Status</b>
            </div>
            <div>
              <span>Specific investigation</span>
              <span>Broad external access</span>
              <span>Unresolved</span>
            </div>
            <div>
              <span>Retained approval trail</span>
              <span>Not publicly located</span>
              <span>Missing proof</span>
            </div>
          </div>
          {full ? (
            <>
              <div className="sample-full-addition">
                <div>
                  <LockKeyhole />
                  <span>
                    <b>RESPONSIBLE-ACTOR CHAIN</b>
                    <small>
                      Chief → ALPR Administrator → Authorized User → Vendor
                    </small>
                  </span>
                </div>
                <div>
                  <FileSearch />
                  <span>
                    <b>THREE ROUTED REQUEST PACKETS</b>
                    <small>
                      Authority/audits, system activity/configuration, and
                      vendor/procurement records—each separately drafted.
                    </small>
                  </span>
                </div>
              </div>
              <div className="sample-request-preview">
                <header>
                  <div>
                    <span>REQUEST A · SAMPLE CORRESPONDENCE</span>
                    <strong>{requestPackets[0].title}</strong>
                  </div>
                  <CopyCorrespondence
                    draft={grandIslandCorrespondence(requestPackets[0])}
                    label="Open sample request"
                  />
                </header>
                <div className="sample-letter">
                  <p>{requestPackets[0].recipient}</p>
                  <p><b>Re: Grand Island / Flock Safety ALPR — {requestPackets[0].title}</b></p>
                  <p>
                    Pursuant to the Nebraska Public Records Act, please provide
                    the following records in their native electronic format for
                    January 1, 2024 through the date this request is processed:
                  </p>
                  <ol>
                    {requestPackets[0].items.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                  <p>
                    Preserve native fields and metadata. If any portion is
                    withheld, identify the statutory basis and release all
                    reasonably segregable material.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="sample-boundary">
              <LockKeyhole />
              <p>
                <b>Reserved for the Full Autopsy</b>Responsible actors, exact
                missing-proof inventory, submission directory and three drafted
                request packets.
              </p>
            </div>
          )}
        </div>
        <div className="sample-footer">
          <span>
            Illustrative excerpt · complete deliverable is downloadable
          </span>
          <Button onClick={onClose}>Close sample</Button>
        </div>
      </section>
    </div>
  );
}

export function downloadGrandIslandReport(tier: ReportTier) {
  const isFull = tier === "autopsy";
  const body = [
    `RED DOT AUDIT — ${isFull ? "FULL AUTOPSY" : "EVIDENCE BRIEF"}`,
    "Grand Island, Nebraska · Flock Safety ALPR",
    `Record current through ${reportAsOf}`,
    "",
    "EXECUTIVE ASSESSMENT",
    "The available public record establishes specific investigative-use, documentation, outside-release and audit controls. The public operational snapshot shows a materially broader outside-access footprint. The present record does not establish that the difference was unauthorized; it establishes a concrete reconciliation question that can be resolved with identifiable records.",
    "",
    "ESTABLISHED",
    "• Documented-purpose and specific-investigation controls exist.",
    "• Outside release is described as requiring a request and administrator approval.",
    "• Recurring audit activity and retained audit documentation are contemplated by policy.",
    "• The public portal reports a broad outside-organization population.",
    "",
    "NOT ESTABLISHED",
    "• Whether every outside organization actually queried Grand Island data.",
    "• Whether statewide authority, MOUs or individual approvals reconcile the full population.",
    "• Who enabled or changed the relevant sharing configuration.",
    "• Whether required audits identified or resolved any discrepancy.",
    "",
    "DISCREPANCY REGISTER",
    ...dots.flatMap((dot) => [
      `${dot.id} · ${dot.severity} · ${dot.title}`,
      dot.summary,
      `Requirement: ${dot.requirement}`,
      `Observed: ${dot.observed}`,
      `Status: ${dot.status}`,
      `Resolution protocol: ${dot.resolution}`,
      `Likely custodian: ${dot.custodian}`,
      `Evidence strength: ${dot.severity === "HIGH" ? "Strong documentary basis; operational reconciliation incomplete." : "Documented signal; meaning or missing record requires confirmation."}`,
      "",
    ]),
    ...(isFull
      ? [
          "MISSING EVIDENCE",
          "1. SharedNetworks.csv and configuration history",
          "2. Network Audit export for 2024–2026",
          "3. ALPR event and administrator change logs",
          "4. Semiannual audit memoranda and workpapers",
          "5. Written outside-agency requests and approvals",
          "6. Current user-role and training records",
          "",
          "EVIDENCE-ACQUISITION SEQUENCE",
          "1. Preserve the current public sharing and transparency snapshots.",
          "2. Reconcile configured sharing against actual outside query activity.",
          "3. Attribute configuration changes to users, dates and approvals.",
          "4. Test statewide authority, MOUs and vendor explanations against the remaining variance.",
          "",
          "SUBMISSION DIRECTORY",
          "Police records: Grand Island Police Department, 111 Public Safety Drive, Grand Island, NE 68801 · (308) 385-5400 · Fax (308) 385-5398",
          "City / procurement records: City Clerk / Finance Purchasing, 100 East First Street, Grand Island, NE 68801 · cityofgi@grand-island.com · (308) 385-5444",
          "Official form: https://www.grand-island.com/forms/public-records-request-information",
          "",
          ...requestPackets.flatMap((packet) => [
            `REQUEST ${packet.id} — DRAFTED — ${packet.title.toUpperCase()}`,
            `To: ${packet.recipient}`,
            packet.address,
            packet.route,
            "",
            `Re: Grand Island / Flock Safety ALPR — ${packet.title}`,
            "Pursuant to the Nebraska Public Records Act, please provide the following records in their native electronic format for January 1, 2024 through the date this request is processed:",
            ...packet.items.map((item, index) => `${index + 1}. ${item}`),
            "Please conduct a search reasonably calculated to locate responsive records, including agency email, shared drives and records maintained for the City by its contractor. Preserve native CSV fields, timestamps, event identifiers, organization names and available metadata. If any portion is withheld, identify the statutory basis and release all reasonably segregable material. Please advise before incurring fees exceeding $50.",
            "",
          ]),
        ]
      : [
          "MISSING-PROOF SUMMARY",
          "Obtain SharedNetworks.csv and the Network Audit export first. Those two records determine whether the apparent footprint represents configured permission, actual use, or both.",
          "",
        ]),
    "CORE SOURCE FINDINGS",
    ...sources.flatMap((source, index) => [
      `${index + 1}. ${source[0]} — ${source[1]}`,
      source[3],
      source[2],
      "",
    ]),
    "This report identifies documentary discrepancies for investigation. It is not a finding of liability or legal advice.",
    "",
    "RedDotAudit.com · Follow the record.",
  ].join("\n");
  const href = URL.createObjectURL(
    new Blob([body], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = href;
  link.download = `red-dot-grand-island-${isFull ? "autopsy" : "evidence-brief"}.txt`;
  link.click();
  URL.revokeObjectURL(href);
}

export function downloadTargetReport(target: RedDotTarget, tier: ReportTier) {
  const full = tier === "autopsy";
  const findings = targetDots(target);
  const packets = targetRequestPackets(target);
  const lines = [
    `RED DOT AUDIT — ${full ? "FULL AUTOPSY" : "EVIDENCE BRIEF"}`,
    `${target.place} · ${target.agency} · Flock Safety ALPR`,
    `Red Dot Score: ${target.score}/100`,
    `Record current through ${reportAsOf}`,
    "",
    "EXECUTIVE ASSESSMENT",
    target.observed,
    "",
    "DOCUMENTED CONTROL / REPRESENTATION",
    target.control,
    "",
    "EVIDENTIARY BOUNDARY",
    "Established: a source-linked control and a concrete observed event are present.",
    `Not yet established: ${target.missingProof}`,
    "",
    "DISCREPANCY REGISTER",
    ...findings.flatMap((dot) => [
      dot.id + " · " + dot.severity + " · " + dot.title,
      dot.summary,
      `Requirement: ${dot.requirement}`,
      `Observed: ${dot.observed}`,
      `Status / next proof: ${dot.status}`,
      `Resolution protocol: ${dot.resolution}`,
      `Likely custodian: ${dot.custodian}`,
      "",
    ]),
    "SOURCE REGISTER",
    ...target.sources.flatMap((source, index) => [
      `${index + 1}. ${source.label}`,
      source.url,
    ]),
    "",
    ...(full
      ? [
          "RESPONSIBILITY CHAIN",
          `${target.agency} executive → ALPR administrator → authorized user → Flock Safety platform`,
          "",
          "MISSING-PROOF INVENTORY",
          target.missingProof,
          "",
          "EVIDENCE-ACQUISITION SEQUENCE",
          "1. Preserve the current public record.",
          "2. Obtain native access, sharing and event records.",
          "3. Attribute approvals and configuration changes.",
          "4. Test the remaining variance against policy, law, agreements and vendor explanations.",
          "",
          ...packets.flatMap((packet) => [
            `REQUEST ${packet.id} — DRAFTED — ${packet.title.toUpperCase()}`,
            `To: ${packet.recipient}`,
            `Re: ${target.place} / Flock Safety ALPR — ${packet.title}`,
            "Under the applicable public-records law, please provide:",
            ...packet.items.map((item, index) => `${index + 1}. ${item}`),
            packet.body,
            "",
          ]),
        ]
      : ["PRIORITY NEXT PROOF", target.missingProof, ""]),
    "ANALYTICAL BOUNDARY",
    "This report identifies documentary discrepancies and missing proof for investigation. Unreconciled does not mean unauthorized. It is not a finding of illegality, liability, intent or damages.",
    "",
    "RedDotAudit.com · Follow the record.",
  ];
  const href = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = href;
  link.download = `red-dot-${target.slug}-${full ? "autopsy" : "evidence-brief"}.txt`;
  link.click();
  URL.revokeObjectURL(href);
}

export function QualifiedReport({
  target,
  tier,
  onDownload,
}: {
  target: RedDotTarget;
  tier: ReportTier;
  onDownload: () => void;
}) {
  const full = tier === "autopsy";
  const findings = targetDots(target);
  const packets = targetRequestPackets(target);
  const missing = missingProofItems(target);
  return (
    <section className="full-report">
      <div className="report-toolbar no-print">
        <div>
          <Sparkles />
          <span>
            {full ? "Full autopsy" : "Evidence brief"} unlocked · {target.place}
          </span>
        </div>
        <div>
          {full && (
            <a className="report-correspondence-jump" href="#request-a">
              <FileSearch /> 3 drafted requests <ArrowRight />
            </a>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
          <Button onClick={onDownload}>
            <Download /> Download research file
          </Button>
        </div>
      </div>
      <div className="report-grid">
        <article className="report-card report-docket">
          <div><span>JURISDICTION</span><b>{target.place}</b></div>
          <div><span>AGENCY</span><b>{target.agency}</b></div>
          <div><span>RECORD CURRENT THROUGH</span><b>{reportAsOf}</b></div>
          <div><span>SCOPE</span><b>{findings.length} Red Dots · {target.sources.length} sources</b></div>
        </article>
        <article className="report-card assessment-card">
          <p className="eyebrow">01 · EXECUTIVE ASSESSMENT</p>
          <div className="assessment-lead">
            <span>{target.score}</span>
            <div>
              <h2>{target.observed}</h2>
              <p>
                The record supports a source-linked reconciliation inquiry—not a
                finding of unauthorized activity. The decisive next evidence is
                identifiable and obtainable.
              </p>
            </div>
          </div>
          <div className="assessment-verdict">
            <b>INVESTIGATIVE DISPOSITION</b>
            <span>Advance to targeted records acquisition</span>
            <small>{target.valueCase}</small>
          </div>
        </article>
        <article className="report-card authority-card">
          <p className="eyebrow">02 · AUTHORITY / CONTROL MAP</p>
          <h2>What the available record requires or represents</h2>
          <div className="authority-line">
            <span>DOCUMENTED CONTROL</span>
            <strong>{target.agency}</strong>
            <small>{target.control}</small>
          </div>
          <div className="authority-line">
            <span>OBSERVED STATE</span>
            <strong>Public-source event</strong>
            <small>{target.observed}</small>
          </div>
          <div className="authority-line">
            <span>DECISIVE MISSING PROOF</span>
            <strong>Records required to reconcile</strong>
            <small>{target.missingProof}</small>
          </div>
        </article>
        <article className="report-card report-boundary">
          <p className="eyebrow">03 · EVIDENTIARY BOUNDARY</p>
          <h2>What is established—and what remains open</h2>
          <div>
            <section>
              <b>ESTABLISHED</b>
              <ul>
                <li>A documented control or official representation exists.</li>
                <li>
                  A concrete operational event, audit result or official
                  response is source-linked.
                </li>
                <li>
                  The identified records provide a defined path to test the
                  discrepancy.
                </li>
              </ul>
            </section>
            <section>
              <b>NOT YET ESTABLISHED</b>
              <ul>
                <li>{target.missingProof}</li>
                <li>
                  Whether the complete activity was authorized, corrected or
                  technically mischaracterized.
                </li>
                <li>The complete responsibility and approval chain.</li>
              </ul>
            </section>
          </div>
        </article>
        <article className="report-card discrepancy-report">
          <p className="eyebrow">04 · COMPLETE DISCREPANCY REGISTER</p>
          <h2>{findings.length} Red Dots tested against the current record</h2>
          <div>
            {findings.map((dot) => (
              <section key={dot.id}>
                <header>
                  <span>{dot.id}</span>
                  <b className={dot.severity.toLowerCase()}>{dot.severity}</b>
                  <strong>{dot.title}</strong>
                  <em>REQUEST {dot.request} DRAFTED</em>
                </header>
                <p>{dot.summary}</p>
                <dl>
                  <div>
                    <dt>REQUIREMENT</dt>
                    <dd>{dot.requirement}</dd>
                  </div>
                  <div>
                    <dt>OBSERVED</dt>
                    <dd>{dot.observed}</dd>
                  </div>
                  <div>
                    <dt>STATUS / NEXT PROOF</dt>
                    <dd>{dot.status}</dd>
                  </div>
                </dl>
                <div className="resolution-protocol">
                  <span>RESOLUTION PROTOCOL</span>
                  <p>{dot.resolution}</p>
                  <div className="resolution-actions">
                    <small>Likely custodian: {dot.custodian}</small>
                    {full ? (
                      <CopyCorrespondence
                        draft={issueCorrespondence({
                          jurisdiction: target.place,
                          agency: target.agency,
                          dot,
                          law: "Under the applicable public-records law",
                          period: "for the period implicated by the source-linked event",
                          packet: packets.find((packet) => packet.id === dot.request) || packets[0],
                        })}
                        label={`Open request ${dot.request}`}
                      />
                    ) : (
                      <em>REQUEST {dot.request} · FULL AUTOPSY</em>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </article>
        {full && (
          <article className="report-card actor-card">
            <p className="eyebrow">05 · RESPONSIBILITY CHAIN</p>
            <h2>Who owns each control</h2>
            <div className="actor-flow">
              <span>
                <b>Agency Executive</b>
                <small>Policy and corrective action</small>
              </span>
              <ArrowRight />
              <span>
                <b>ALPR Administrator</b>
                <small>Access and audit controls</small>
              </span>
              <ArrowRight />
              <span>
                <b>Authorized User</b>
                <small>Purpose and case record</small>
              </span>
              <ArrowRight />
              <span>
                <b>Flock Safety</b>
                <small>Platform and entitlement layer</small>
              </span>
            </div>
          </article>
        )}
        <article className="report-card missing-card">
          <p className="eyebrow">
            {full ? "06 · MISSING PROOF" : "05 · PRIORITY PROOF"}
          </p>
          <h2>
            {full
              ? "The records that close—or eliminate—the gap"
              : "The first evidence needed to determine whether to continue"}
          </h2>
          <ol>
            {missing.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{item}</b>
                  <small>
                    Obtain in native form with available metadata and custodial
                    context.
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </article>
        {full && (
          <article className="report-card sequence-card">
            <p className="eyebrow">07 · EVIDENCE-ACQUISITION SEQUENCE</p>
            <h2>Obtain the answer in four controlled passes</h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <b>Preserve the public state</b>
                  <p>
                    Capture the current policy, public representations and
                    available source records.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <b>Acquire native system records</b>
                  <p>
                    Obtain access, sharing, audit, event and configuration
                    exports for the relevant period.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <b>Attribute the decisions</b>
                  <p>
                    Map users, administrators, approvals, alerts and corrective
                    actions.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <b>Test competing explanations</b>
                  <p>
                    Apply law, policy, agreements and vendor explanations to the
                    remaining variance.
                  </p>
                </div>
              </li>
            </ol>
          </article>
        )}
        {full &&
          packets.map((packet) => (
            <article
              className="report-card request-card"
              id={`request-${packet.id.toLowerCase()}`}
              key={packet.id}
            >
              <div className="request-head">
                <div>
                  <p className="eyebrow">REQUEST {packet.id} · READY TO COPY</p>
                  <h2>{packet.title}</h2>
                </div>
                <div className="request-head-actions">
                  <span>DRAFTED</span>
                  <CopyCorrespondence draft={targetCorrespondence(target, packet)} />
                </div>
              </div>
              <div className="request-routing">
                <b>{packet.recipient}</b>
                <span>
                  Verify the current official submission portal before sending.
                </span>
              </div>
              <div className="letter">
                <p>{packet.recipient}</p>
                <p>
                  <strong>
                    Re: {target.place} / Flock Safety ALPR — {packet.title}
                  </strong>
                </p>
                <p>
                  Under the applicable public-records law, please provide the
                  following records:
                </p>
                <ol>
                  {packet.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <p>{packet.body}</p>
              </div>
            </article>
          ))}
        <article className="report-card source-card source-findings">
          <p className="eyebrow">
            {full ? "08 · SOURCE FINDINGS" : "06 · SOURCE FINDINGS"}
          </p>
          <h2>{target.sources.length} reviewed public sources</h2>
          {target.sources.map((source, index) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{source.label}</strong>
                <small>Reviewed public-source path</small>
                <p>{index === 0 ? target.observed : target.control}</p>
              </div>
              <ArrowRight />
            </a>
          ))}
        </article>
      </div>
      <div className="report-disclaimer">
        <ShieldCheck />
        <p>
          <strong>Analytical boundary</strong>This report identifies documentary
          discrepancies, evidentiary limits and missing proof for further
          investigation. “Unreconciled” does not mean “unauthorized.” The report
          does not determine illegality, liability, intent or damages.
        </p>
      </div>
    </section>
  );
}

export function FullReport({
  onDownload,
  tier = "autopsy",
}: {
  onDownload: () => void;
  tier?: ReportTier;
}) {
  const isFull = tier === "autopsy";
  return (
    <section className="full-report">
      <div className="report-toolbar no-print">
        <div>
          <Sparkles />
          <span>{isFull ? "Full autopsy" : "Evidence brief"} unlocked</span>
        </div>
        <div>
          {isFull && (
            <a className="report-correspondence-jump" href="#request-a">
              <FileSearch /> 3 drafted requests <ArrowRight />
            </a>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
          <Button onClick={onDownload}>
            <Download /> Download research file
          </Button>
        </div>
      </div>
      <div className="report-grid">
        <article className="report-card report-docket">
          <div><span>JURISDICTION</span><b>Grand Island, Nebraska</b></div>
          <div><span>AGENCY</span><b>Grand Island Police Department</b></div>
          <div><span>RECORD CURRENT THROUGH</span><b>{reportAsOf}</b></div>
          <div><span>SCOPE</span><b>{dots.length} Red Dots · {sources.length} sources</b></div>
        </article>
        <article className="report-card assessment-card">
          <p className="eyebrow">01 · EXECUTIVE ASSESSMENT</p>
          <div className="assessment-lead">
            <span>87</span>
            <div>
              <h2>
                A defined control trail meets a materially broader public access
                footprint.
              </h2>
              <p>
                The record supports a high-interest reconciliation inquiry—not a
                finding of unauthorized access. The decisive evidence exists in
                identifiable configuration, activity and approval records.
              </p>
            </div>
          </div>
          <div className="assessment-verdict">
            <b>INVESTIGATIVE DISPOSITION</b>
            <span>Advance to targeted records acquisition</span>
            <small>
              Two high-priority documentary gaps can be tested without
              discovery.
            </small>
          </div>
        </article>
        <article className="report-card authority-card">
          <p className="eyebrow">02 · AUTHORITY MAP</p>
          <h2>What governs the system</h2>
          <div className="authority-line">
            <span>STATE LAW</span>
            <strong>Nebraska ALPR Privacy Act</strong>
            <small>
              Manual queries require relevance and materiality to an ongoing
              criminal or missing-person investigation; reason documented.
            </small>
          </div>
          <div className="authority-line">
            <span>DEPARTMENT POLICY</span>
            <strong>GIPD General Order O2416</strong>
            <small>
              Specific criminal investigation, case number and reason; written
              outside request and administrator approval.
            </small>
          </div>
          <div className="authority-line">
            <span>PUBLIC REPRESENTATION</span>
            <strong>GIPD ALPR overview</strong>
            <small>
              Crime-focused use; not intended for minor traffic or parking
              enforcement; data described as not sold or shared with third
              parties.
            </small>
          </div>
        </article>
        <article className="report-card report-boundary">
          <p className="eyebrow">03 · EVIDENTIARY BOUNDARY</p>
          <h2>What the record establishes—and what it does not</h2>
          <div>
            <section>
              <b>ESTABLISHED</b>
              <ul>
                <li>
                  Documented-purpose and specific-investigation controls exist.
                </li>
                <li>
                  Outside release is described as requiring a request and
                  administrator approval.
                </li>
                <li>
                  The policy calls for recurring review and retained audit
                  documentation.
                </li>
                <li>
                  The public portal reports a broad outside-organization
                  population.
                </li>
              </ul>
            </section>
            <section>
              <b>NOT YET ESTABLISHED</b>
              <ul>
                <li>
                  That every listed organization actually searched Grand Island
                  data.
                </li>
                <li>
                  That the full population lacks statewide, MOU or individual
                  authority.
                </li>
                <li>Who enabled or changed the operative sharing settings.</li>
                <li>Whether internal audits found or cured a variance.</li>
              </ul>
            </section>
          </div>
        </article>
        <article className="report-card discrepancy-report">
          <p className="eyebrow">04 · COMPLETE DISCREPANCY REGISTER</p>
          <h2>Every substantiated Red Dot, tested against the record</h2>
          <div>
            {dots.map((dot) => (
              <section key={dot.id}>
                <header>
                  <span>{dot.id}</span>
                  <b className={dot.severity.toLowerCase()}>{dot.severity}</b>
                  <strong>{dot.title}</strong>
                  <em>REQUEST {dot.request} DRAFTED</em>
                </header>
                <p>{dot.summary}</p>
                <dl>
                  <div>
                    <dt>REQUIREMENT</dt>
                    <dd>{dot.requirement}</dd>
                  </div>
                  <div>
                    <dt>OBSERVED</dt>
                    <dd>{dot.observed}</dd>
                  </div>
                  <div>
                    <dt>STATUS / NEXT PROOF</dt>
                    <dd>{dot.status}</dd>
                  </div>
                </dl>
                <div className="resolution-protocol">
                  <span>RESOLUTION PROTOCOL</span>
                  <p>{dot.resolution}</p>
                  <div className="resolution-actions">
                    <small>Likely custodian: {dot.custodian}</small>
                    {isFull ? (
                      <CopyCorrespondence
                        draft={issueCorrespondence({
                          jurisdiction: "Grand Island, Nebraska",
                          agency: "Grand Island Police Department",
                          dot,
                          law: "Pursuant to the Nebraska Public Records Act",
                          period: "for January 1, 2024 through the date this request is processed",
                          packet: requestPackets.find((packet) => packet.id === dot.request) || requestPackets[0],
                        })}
                        label={`Open request ${dot.request}`}
                      />
                    ) : (
                      <em>REQUEST {dot.request} · FULL AUTOPSY</em>
                    )}
                  </div>
                </div>
                <small>
                  <b>EVIDENCE STRENGTH</b>
                  {dot.severity === "HIGH"
                    ? "Strong documentary basis; operational reconciliation remains incomplete."
                    : "Documented signal; meaning or missing artifact requires confirmation."}
                </small>
              </section>
            ))}
          </div>
        </article>
        {isFull && (
          <article className="report-card actor-card">
            <p className="eyebrow">05 · RESPONSIBILITY CHAIN</p>
            <h2>Who owns each control</h2>
            <div className="actor-flow">
              <span>
                <b>Chief of Police</b>
                <small>Annual audit responsibility</small>
              </span>
              <ArrowRight />
              <span>
                <b>ALPR Administrator</b>
                <small>Access and release approval</small>
              </span>
              <ArrowRight />
              <span>
                <b>Authorized User</b>
                <small>Case number and purpose</small>
              </span>
              <ArrowRight />
              <span>
                <b>Flock Safety</b>
                <small>Platform and entitlement layer</small>
              </span>
            </div>
          </article>
        )}
        <article className="report-card missing-card">
          <p className="eyebrow">
            {isFull ? "06 · MISSING PROOF" : "05 · PRIORITY PROOF"}
          </p>
          <h2>
            {isFull
              ? "The six records that close—or eliminate—the gap"
              : "The first two records that determine whether to continue"}
          </h2>
          <ol>
            {[
              [
                "SharedNetworks.csv",
                "Configured sharing population and reciprocal network relationships.",
              ],
              [
                "Network Audit export",
                "Outside organizations that actually queried Grand Island data.",
              ],
              ...(isFull
                ? [
                    [
                      "ALPR Event Log",
                      "Who changed users, roles or network-sharing settings and when.",
                    ],
                    [
                      "2024–2026 audit memoranda",
                      "Required reviews, errors discovered and corrective action.",
                    ],
                    [
                      "Outside-agency requests",
                      "Agency, requester, purpose and administrator disposition.",
                    ],
                    [
                      "User-role and training records",
                      "Authorized population, access periods and required training.",
                    ],
                  ]
                : []),
            ].map((item, i) => (
              <li key={item[0]}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <b>{item[0]}</b>
                  <small>{item[1]}</small>
                </div>
              </li>
            ))}
          </ol>
        </article>
        {isFull && (
          <article className="report-card sequence-card">
            <p className="eyebrow">07 · EVIDENCE-ACQUISITION SEQUENCE</p>
            <h2>Obtain the answer in four controlled passes</h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <b>Preserve the public state</b>
                  <p>
                    Capture the current portal, sharing population, policy and
                    public representations with dates.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <b>Reconcile permission to activity</b>
                  <p>
                    Compare SharedNetworks configuration against outside
                    organizations appearing in Network Audit.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <b>Attribute the control decision</b>
                  <p>
                    Use Event Logs, administrator records and approvals to
                    determine who changed what and when.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <b>Test competing explanations</b>
                  <p>
                    Apply statewide authority, MOUs, individual approvals and
                    vendor explanations to the remaining variance.
                  </p>
                </div>
              </li>
            </ol>
          </article>
        )}
        {isFull && (
          <article className="report-card routing-card">
            <p className="eyebrow">08 · SUBMISSION DIRECTORY</p>
            <h2>Three requests. Two custodial routes.</h2>
            <div>
              <section>
                <span>POLICE RECORDS</span>
                <b>Grand Island Police Department</b>
                <p>
                  111 Public Safety Drive
                  <br />
                  Grand Island, NE 68801
                  <br />
                  (308) 385-5400 · Fax (308) 385-5398
                </p>
              </section>
              <section>
                <span>CITY / PROCUREMENT RECORDS</span>
                <b>City Clerk / Finance Purchasing</b>
                <p>
                  100 East First Street
                  <br />
                  Grand Island, NE 68801
                  <br />
                  cityofgi@grand-island.com · (308) 385-5444
                </p>
              </section>
              <a
                href="https://www.grand-island.com/forms/public-records-request-information"
                target="_blank"
                rel="noreferrer"
              >
                <FileSearch />
                <span>
                  <b>OFFICIAL SUBMISSION FORM</b>
                  <small>
                    Open the City of Grand Island public-records request channel
                  </small>
                </span>
                <ArrowRight />
              </a>
            </div>
            <small>
              Routing verified from official City of Grand Island and GIPD
              pages. Confirm the receiving custodian before sending.
            </small>
          </article>
        )}
        {isFull &&
          requestPackets.map((packet) => (
            <article
              className="report-card request-card"
              id={`request-${packet.id.toLowerCase()}`}
              key={packet.id}
            >
              <div className="request-head">
                <div>
                  <p className="eyebrow">REQUEST {packet.id} · READY TO SEND</p>
                  <h2>{packet.title}</h2>
                </div>
                <div className="request-head-actions">
                  <span>DRAFTED</span>
                  <CopyCorrespondence draft={grandIslandCorrespondence(packet)} />
                </div>
              </div>
              <div className="request-routing">
                <b>{packet.recipient}</b>
                <span>{packet.address}</span>
                <a href={packet.routeUrl} target="_blank" rel="noreferrer">
                  {packet.route} <ArrowRight />
                </a>
              </div>
              <div className="letter">
                <p>
                  {packet.recipient.replace(" · ", "\n")}
                  <br />
                  {packet.address.replace(" · ", "\n")}
                </p>
                <p>
                  <strong>
                    Re: Grand Island / Flock Safety ALPR — {packet.title}
                  </strong>
                </p>
                <p>
                  Pursuant to the Nebraska Public Records Act, please provide
                  the following records in their native electronic format for
                  January 1, 2024 through the date this request is processed:
                </p>
                <ol>
                  {packet.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <p>
                  Please conduct a search reasonably calculated to locate
                  responsive records, including agency email, shared drives and
                  records maintained for the City by its contractor. Preserve
                  native CSV fields, timestamps, event identifiers, organization
                  names and available metadata. If any portion is withheld,
                  identify the statutory basis and release all reasonably
                  segregable material. Please advise before incurring fees
                  exceeding $50.
                </p>
              </div>
            </article>
          ))}
        <article className="report-card source-card source-findings">
          <p className="eyebrow">
            {isFull ? "09 · SOURCE FINDINGS" : "06 · SOURCE FINDINGS"}
          </p>
          <h2>{sources.length} core records and what each contributes</h2>
          {sources.map((source, index) => (
            <a
              key={source[2]}
              href={source[2]}
              target="_blank"
              rel="noreferrer"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{source[0]}</strong>
                <small>{source[1]}</small>
                <p>{source[3]}</p>
              </div>
              <ArrowRight />
            </a>
          ))}
        </article>
      </div>
      <div className="report-disclaimer">
        <ShieldCheck />
        <p>
          <strong>Analytical boundary</strong>This report identifies documentary
          discrepancies, evidentiary limits and missing proof for further
          investigation. “Unreconciled” does not mean “unauthorized.” The report
          does not determine illegality, liability, intent or damages.
        </p>
      </div>
    </section>
  );
}
