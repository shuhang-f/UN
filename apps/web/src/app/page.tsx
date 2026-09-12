"use client";

import { useEffect, useRef, useState } from "react";
import { demoUnits, defaultPreferences, DEMO_TODAY } from "@/lib/un-demo";
import { reviewPortfolio } from "@/lib/un-review";
import { reviewOperations } from "@/lib/un-operations";
import type { UnPreferences, UnReviewCase } from "@/lib/un-types";
import type { UnReviewsResponse, UnSavedReview } from "@/lib/un-storage-types";
import { UNAssistant } from "@/components/un-assistant";
import { UNDemoEntry } from "@/components/un-demo-entry";
import { UNHandoff } from "@/components/un-handoff";
import { UNOperationsBoard } from "@/components/un-operations-board";
import "./un.css";

type View = "desk" | "portfolio" | "saved" | "preferences" | "handoff" | "operations";
type DetailTab = "overview" | "evidence" | "draft";
type Glyph = "grid" | "building" | "folder" | "sliders" | "arrow" | "check" | "clock" | "file" | "spark" | "external" | "close";
function Icon({ name, size = 19 }: { name: Glyph; size?: number }) {
  const paths: Record<Glyph, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></>,
    building: <><path d="M4 21V5l8-2v18M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2"/></>,
    folder: <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>,
    sliders: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    file: <><path d="M14 3H5v18h14V8l-5-5Zm0 0v6h5M8 13h8M8 17h5"/></>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>,
    external: <><path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const statusLabel: Record<UnReviewCase["status"], string> = { "draft-ready": "Ready to draft", "needs-evidence": "Needs evidence", blocked: "Increase on hold", upcoming: "Upcoming" };
function Status({ status }: { status: UnReviewCase["status"] }) { return <span className={`un-status ${status}`}><span />{statusLabel[status]}</span>; }

// Strict Mode can replay the initial effect. Share the request so it creates one session.
let recordsRequest: Promise<UnReviewsResponse> | undefined;
function fetchRecords() {
  return recordsRequest ??= fetch("/api/un/reviews", { cache: "no-store" }).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Saved reviews could not be loaded.");
    return data as UnReviewsResponse;
  }).finally(() => { recordsRequest = undefined; });
}

export default function UNDemo() {
  return <UNDemoEntry>{(restart, email) => <UNDesk onRestartDemo={restart} demoEmail={email}/>}</UNDemoEntry>;
}

function UNDesk({ onRestartDemo, demoEmail }: { onRestartDemo: () => void; demoEmail: string }) {
  const [view, setView] = useState<View>("desk");
  const [preferences, setPreferences] = useState<UnPreferences>(defaultPreferences);
  const [form, setForm] = useState<UnPreferences>(defaultPreferences);
  const [asOf, setAsOf] = useState(DEMO_TODAY);
  const [dateInput, setDateInput] = useState(DEMO_TODAY);
  const [selectedId, setSelectedId] = useState(demoUnits[0].id);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [filter, setFilter] = useState<"all" | "upcoming">("all");
  const [records, setRecords] = useState<UnSavedReview[]>([]);
  const [savedSelection, setSavedSelection] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const [modelConfigured, setModelConfigured] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const cases = reviewPortfolio(demoUnits, asOf, preferences);
  const selected = cases.find(item => item.unit.id === selectedId) || cases[0];
  const reviewTasks = selected.draft ? [
    { title: "Review the source records and pricing instruction", owner: preferences.reviewer, details: "Compare the lease, correspondence, rent database and unit coverage. Confirm the proposal and save the evidence packet." },
    { title: "Request a draft from the reviewed packet", owner: "Ambiguous AI · simulated", details: "After your review, hand off the saved facts to the mock drafting workflow. The returned letter will appear in Draft approvals." },
    { title: "Review and approve the returned letter", owner: preferences.reviewer, details: "Inspect the draft, record your decision, and keep any wording, notice-period or service checks in the approval note." },
  ] : selected.tasks;
  const due = cases.filter(item => item.status !== "upcoming");
  const drafted = due.filter(item => item.status === "draft-ready");
  const held = due.filter(item => item.status !== "draft-ready");
  const visibleCases = filter === "all" ? due : cases.filter(item => item.status === filter);
  const saved = records.find(record => record.id === savedSelection);
  const draftRecords = records.filter(record => record.packet.draft);
  const handoffRecord = saved?.packet.draft ? saved : draftRecords[0];
  const operations = reviewOperations(asOf);
  const vacant = operations.filter(item => item.vacancyConfirmed).length;
  const overdue = operations.filter(item => item.status === "late-rent").length;
  const pending = operations.filter(item => item.status === "payment-pending").length;

  async function loadRecords() {
    try {
      const data = await fetchRecords();
      setRecords(data.records); setReady(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Saved reviews could not be loaded."); }
  }
  useEffect(() => {
    void loadRecords();
    fetch("/api/integrations").then(r => r.json()).then(data => setModelConfigured(data.modelConfigured === true)).catch(() => {});
    try {
      const cached = localStorage.getItem("un-demo-preferences-v1");
      if (cached) {
        const value = JSON.parse(cached) as UnPreferences;
        reviewPortfolio(demoUnits, DEMO_TODAY, value);
        setPreferences(value); setForm(value);
      }
    } catch { /* Invalid or unavailable browser storage keeps the demo defaults. */ }
  }, []);
  useEffect(() => {
    if (reviewing && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [reviewing]);
  function selectUnit(id: string) {
    setSelectedId(id); setFilter(cases.find(item => item.unit.id === id)?.status === "upcoming" ? "upcoming" : "all");
    setView("desk"); setTab("overview"); setNote(""); setReviewing(false); setMessage("");
    if (window.matchMedia("(max-width: 650px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start" }));
    }
  }
  function changeFilter(next: "all" | "upcoming") {
    const matches = cases.filter(item => next === "all" ? item.status !== "upcoming" : item.status === "upcoming");
    if (matches.length && !matches.some(item => item.unit.id === selectedId)) selectUnit(matches[0].unit.id);
    setFilter(next);
  }
  function runReview(next = preferences) {
    try {
      const result = reviewPortfolio(demoUnits, dateInput, next);
      setPreferences(next); setAsOf(dateInput); setReviewing(false); setError(""); setNote("");
      setSelectedId(result.find(item => item.status !== "upcoming")?.unit.id || result[0].unit.id);
      setTab("overview"); setFilter("all"); setView(view === "operations" ? "operations" : "desk");
      const count = result.filter(item => item.status !== "upcoming").length;
      setMessage(view === "operations" ? `Leasing and rent records reviewed as of ${date(dateInput)}.` : `Review complete. ${count} ${count === 1 ? "renewal needs" : "renewals need"} attention as of ${date(dateInput)}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check the review date and preferences."); }
  }
  function savePreferences(e: React.FormEvent) {
    e.preventDefault();
    try {
      reviewPortfolio(demoUnits, dateInput, form);
      try { localStorage.setItem("un-demo-preferences-v1", JSON.stringify(form)); } catch { /* Review works without localStorage. */ }
      runReview(form);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check your preferences."); }
  }
  async function saveReview() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/un/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitId: selected.unit.id, asOf, preferences, reviewerNote: note, approved: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The review could not be saved.");
      setRecords(previous => [data.record, ...previous.filter(record => record.id !== data.record.id)]);
      setSavedSelection(data.record.id); setReviewing(false); setView(data.record.packet.draft ? "handoff" : "saved"); setMessage(`Unit ${selected.unit.unitNumber} evidence review saved. ${data.record.packet.draft ? "Your reviewed packet is ready for the demo drafting handoff." : "Follow-up tasks are kept with the source records."}`); window.scrollTo({ top: 0 });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The review could not be saved."); }
    finally { setSaving(false); }
  }
  function downloadReview(record: UnSavedReview) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `UN-unit-${record.packet.unit.unitNumber}-review.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="un-app">
    <aside className="un-sidebar">
      <a className="un-brand" href="/" aria-label="UN home"><span className="un-monogram">UN<span>·</span></span><span>Property intelligence</span></a>
      <div className="un-workspace"><span className="un-workspace-mark"><Icon name="building" /></span><div><strong>Juniper Residential</strong><small>Los Angeles, California</small></div></div>
      <p className="un-nav-label">WORKSPACE</p>
      <nav aria-label="Workspace">{([
        ["desk", "grid", "Review desk"], ["operations", "building", "Leasing & rent"], ["handoff", "spark", "Draft approvals"], ["portfolio", "building", "Portfolio"], ["saved", "folder", "Saved reviews"], ["preferences", "sliders", "Preferences"],
      ] as [View, Glyph, string][]).map(([id, icon, label]) => <button key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => { setView(id); setReviewing(false); setMessage(""); }}><Icon name={icon}/>{label}{id === "desk" && <span className="un-nav-count">{due.length}</span>}{id === "saved" && records.length > 0 && <span className="un-nav-count">{records.length}</span>}</button>)}</nav>
      <div className="un-sidebar-bottom"><div className="un-demo-card"><span className="un-live-dot"/><strong>Your demo workspace</strong><p>Seven fictional units. Renewals, leasing, and rent collection.</p><a href="/agent">Investigation workspace <Icon name="external" size={13}/></a><a href="/operations">Advanced operations <Icon name="external" size={13}/></a><a href="/advisor">Workflow explorer <Icon name="external" size={13}/></a></div><div className="un-user"><span className="un-avatar">{preferences.reviewer.split(" ").map(word => word[0]).slice(0, 2).join("")}</span><div><strong>{preferences.reviewer}</strong><small>Property manager · Demo</small></div></div></div>
    </aside>
    <div className="un-main">
      <header className="un-topbar"><span>Workspace <span className="un-slash">/</span> <strong>{{ desk: "Review desk", portfolio: "Portfolio", saved: "Saved reviews", preferences: "Preferences", handoff: "Draft approvals", operations: "Leasing & rent" }[view]}</strong></span><div><span className="un-demo-pill" title={`Demo label: ${demoEmail}`}><span/>Demo data</span><button className="un-quiet" onClick={onRestartDemo}>Restart demo</button>{modelConfigured && view === "desk" && <button className="un-quiet" onClick={() => setAssistantOpen(!assistantOpen)}><Icon name="spark" size={16}/>Ask UN</button>}<span className="un-top-initial">UN</span></div></header>
      <main className="un-content">
        <section className="un-heading"><div><p className="un-eyebrow">A LITTLE CLARITY, EVERY DAY</p><h1>{{ desk: "Your portfolio, in focus.", portfolio: "Every unit. The full picture.", saved: "Good decisions, kept together.", preferences: "A desk that works your way.", handoff: "From reviewed facts to your approval.", operations: "Keep your units moving." }[view]}</h1><p>{{ desk: "Know what needs attention. See the evidence. Take the next step.", portfolio: "The lease and rent records behind your daily review.", saved: "Reviewed drafts, supporting records, and the context behind each decision.", preferences: "Choose when to start a review and what rent proposal to prepare.", handoff: "Send a reviewed packet through the simulated Ambiguous AI workflow. Review the letter that comes back.", operations: "Find units to lease and balances to reconcile, with the records behind every flag." }[view]}</p></div>{(view === "desk" || view === "operations") && <div className="un-run-controls"><label>Demo date<input type="date" aria-label="Demo date" value={dateInput} onChange={e => setDateInput(e.target.value)}/></label><button className="un-primary" onClick={() => runReview()}><Icon name="spark" size={17}/>Run daily review</button></div>}</section>
        {error && <div className="un-alert error" role="alert">{error}{!ready && <button onClick={() => void loadRecords()}>Retry loading reviews</button>}<button aria-label="Dismiss error" onClick={() => setError("")}><Icon name="close" size={16}/></button></div>}
        {message && <div className="un-alert success" role="status"><Icon name="check" size={17}/>{message}<button aria-label="Dismiss update" onClick={() => setMessage("")}><Icon name="close" size={16}/></button></div>}

        {view === "desk" && <>
          <div className="un-stats"><div><span>Renewals to review</span><strong>{due.length}<small>units in review</small></strong><p>Within your {preferences.reviewLeadDays}-day planning window</p></div><div><span>A letter to prepare</span><strong>{drafted.length}<small>ready for drafting</small></strong><p>Review evidence, then request a letter</p></div><div><span>Renewal questions</span><strong>{held.length}<small>need a closer look</small></strong><p>Evidence or timing to resolve</p></div></div>
          <div className="un-workflow-banner"><div><strong>Records → your review → Ambiguous AI → draft approval</strong><p>Review lease documents, email, and database records. Hand off the confirmed packet, then approve the returned letter.</p><p className="un-attention-counts">{vacant} vacant units · {overdue} overdue rent {overdue === 1 ? "balance" : "balances"} · {pending} pending {pending === 1 ? "payment" : "payments"}</p></div><button className="un-secondary" onClick={() => setView("operations")}>Check leasing & late rent <Icon name="arrow" size={16}/></button></div>
          <div className="un-section-title"><div><h2>Renewal review</h2><span>Simulated · {date(asOf)}</span></div><button className="un-text-button" onClick={() => { setForm(preferences); setView("preferences"); }}><Icon name="sliders" size={15}/>{preferences.reviewLeadDays}-day window</button></div>
          <div className="un-review-grid">
            <section className="un-queue" aria-label="Unit review queue"><div className="un-filters" aria-label="Filter reviews"><button className={filter === "all" ? "selected" : ""} onClick={() => changeFilter("all")}>Needs attention <span>{due.length}</span></button><button className={filter === "upcoming" ? "selected" : ""} onClick={() => changeFilter("upcoming")}>Upcoming</button></div>
              {visibleCases.length === 0 && <div className="un-empty"><Icon name="check" size={28}/><h3>You’re caught up.</h3><p>No units fall within this review window. Upcoming leases are still in your portfolio.</p><button className="un-text-button" onClick={() => changeFilter("upcoming")}>View upcoming leases <Icon name="arrow" size={15}/></button></div>}
              {visibleCases.map(item => <button key={item.id} className={`un-unit-card ${selectedId === item.unit.id ? "selected" : ""}`} onClick={() => selectUnit(item.unit.id)} aria-pressed={selectedId === item.unit.id}><div className="un-card-top"><span className="un-unit-number">{item.unit.unitNumber}</span><Status status={item.status}/></div><h3>{item.unit.propertyName}</h3><p>{item.status === "draft-ready" ? "Renewal approaching. Review the source records before requesting a letter." : item.blockers[0] || item.summary}</p><div className="un-card-bottom"><span className={item.daysUntilRenewal >= 0 && item.daysUntilRenewal <= 30 ? "un-renewal-soon" : undefined}><Icon name="clock" size={13}/>{item.daysUntilRenewal >= 0 ? `${item.daysUntilRenewal} days to lease end` : "Lease end passed"}</span><Icon name="arrow" size={16}/></div></button>)}
              <p className="un-queue-note">Based on dated sample records.<br/>Last reviewed for {date(asOf)}.</p>
            </section>
            <section ref={detailRef} className="un-detail" aria-label={`Unit ${selected.unit.unitNumber} review`}>
              <div className="un-detail-heading"><div><p className="un-eyebrow">UNIT {selected.unit.unitNumber} / RENEWAL REVIEW</p><h2>{selected.unit.propertyName}</h2><p>{selected.unit.address}</p></div><span className="un-detail-building"><Icon name="building" size={26}/></span></div>
              <div className="un-detail-tabs" role="tablist" aria-label="Review details">{(["overview", "evidence", "draft"] as DetailTab[]).map(id => <button key={id} role="tab" aria-selected={tab === id} aria-controls={`un-panel-${id}`} id={`un-tab-${id}`} onClick={() => setTab(id)}>{{ overview: "Review overview", evidence: `Evidence · ${selected.evidence.length}`, draft: "Drafting preview" }[id]}{id === "draft" && selected.draft && <span className="un-tab-dot"/>}</button>)}</div>
              <div className="un-detail-body" role="tabpanel" id={`un-panel-${tab}`} aria-labelledby={`un-tab-${tab}`}>
                {tab === "overview" && <>
                  <div className={`un-summary-box ${selected.status}`}><Icon name={selected.draft ? "spark" : "clock"} size={20}/><div><strong>{statusLabel[selected.status]}</strong><p>{selected.draft ? `The ${selected.requestedIncreasePercent}% proposal passes the loaded sample checks: ${money(selected.unit.baseRent)} → ${money(selected.requestedRent)} from ${date(selected.effectiveDate)}. Review the evidence before requesting the letter.` : selected.summary}</p></div></div>
                  <div className="un-facts"><div><span>Lease ends</span><strong>{date(selected.unit.leaseEnd)}</strong></div><div><span>Proposed effective date</span><strong>{date(selected.effectiveDate)}</strong></div><div><span>Last increase · ledger</span><strong>{selected.unit.lastIncreaseDate ? date(selected.unit.lastIncreaseDate) : "Not verified"}</strong></div><div><span>Unit coverage</span><strong>{selected.unit.coverage === "confirmed" ? "LA City RSO · sample verified" : "Needs unit-level evidence"}</strong></div></div>
                  <div className="un-rent-math"><div><span>Current base rent</span><strong>{money(selected.unit.baseRent)}</strong></div><Icon name="arrow" size={23}/><div><span>Your {selected.requestedIncreasePercent}% proposal</span><strong>{money(selected.requestedRent)}<small>/ month</small></strong></div></div>
                  <p className="un-math-caption">{selected.capPercent !== null ? `Published ordinary ceiling: ${selected.capPercent}% · ${money(selected.maximumRent!)} base rent. Your proposal uses the confirmed demo preference.` : "An applicable ceiling cannot be confirmed from these records."} Separate charges are excluded.</p>
                  {selected.blockers.length > 0 && <div className="un-blockers"><h3>What needs resolving</h3><ul>{selected.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></div>}
                  <h3 className="un-subheading">The next steps</h3><div className="un-steps">{reviewTasks.map((task, index) => <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{task.title}</strong><p>{task.details}</p><small>{task.owner}</small></div></div>)}</div>
                  {selected.rule && <a className="un-source" href={selected.rule.url} target="_blank" rel="noreferrer"><Icon name="file" size={20}/><div><strong>{selected.rule.title}</strong><span>Effective {date(selected.rule.effectiveFrom)} – {date(selected.rule.effectiveTo)} · checked {date(selected.rule.verifiedAt.slice(0, 10))}</span></div><Icon name="external" size={15}/></a>}
                </>}
                {tab === "evidence" && <><div className="un-tab-intro"><h3>Every fact has a source.</h3><p>These fictional records show what UN compares before preparing a draft. Conflicting information stays visible.</p></div>{selected.evidence.map(evidence => <article className="un-evidence" key={evidence.id}><div><span className={`un-evidence-kind ${evidence.kind}`}>{evidence.kind}</span><time>{date(evidence.date.slice(0, 10))}</time></div><h3>{evidence.title}</h3><p>{evidence.body}</p><footer><code>{evidence.id}</code>{evidence.url && <a href={evidence.url} target="_blank" rel="noreferrer">Official source <Icon name="external" size={12}/></a>}</footer></article>)}</>}
                {tab === "draft" && (selected.draft ? <><div className="un-draft-note"><Icon name="file" size={18}/><div><strong>Preview of the drafting brief</strong><p>Review and save the evidence below to send a confirmed packet to the mock Ambiguous AI workflow. Its returned letter needs a separate approval.</p></div></div><article className="un-paper"><div className="un-paper-logo">UN<span> / REVIEWED FACTS → DRAFTING BRIEF</span></div><p className="un-paper-label">FICTIONAL DEMONSTRATION</p><h3>Rent-adjustment brief · Unit {selected.unit.unitNumber}</h3><div className="un-review-facts"><span>Resident <strong>{selected.unit.residentName}</strong></span><span>Proposed monthly base rent <strong>{money(selected.unit.baseRent)} → {money(selected.requestedRent)} ({selected.requestedIncreasePercent}%)</strong></span><span>Candidate effective date <strong>{date(selected.effectiveDate)}</strong></span><span>Source records <strong>{selected.evidence.length} dated records · lease, ledger, email and coverage</strong></span></div><p className="un-brief-copy">The mock drafting workflow will use this information after you confirm the evidence. The returned letter appears in Draft approvals for your decision.</p><button className="un-text-button" onClick={() => setTab("evidence")}>Inspect the source records <Icon name="arrow" size={15}/></button></article></> : <div className="un-empty un-no-draft"><Icon name="file" size={34}/><h3>{selected.status === "upcoming" ? "We’ll start with the review window." : "A clear record comes first."}</h3><p>{selected.status === "upcoming" ? "This lease is outside the active planning window. Update your preferences or advance the demo date to review it." : "Resolve the listed evidence or timing issues before preparing a definitive rent-increase draft."}</p><button className="un-secondary" onClick={() => setTab("overview")}>View next steps <Icon name="arrow" size={15}/></button></div>)}
              </div>
              <footer className="un-detail-footer"><span><Icon name="folder" size={15}/>Saved locally after your review</span><button className="un-primary" disabled={!ready} onClick={() => { setReviewing(true); setError(""); }}>{selected.draft ? "Review evidence & continue" : "Review & save follow-up"}<Icon name="arrow" size={16}/></button></footer>
            </section>
          </div>
          <div className="un-tool-strip"><div><Icon name="building" size={20}/><div><strong>Work with the tools you know.</strong><span>Resources for this LA review. Connections are not required for the demo.</span></div></div><a href="https://housing.lacity.gov/rental-property-owners/rso-property-search" target="_blank" rel="noreferrer">LAHD coverage <Icon name="external" size={13}/></a><a href="https://rentright.io/for-property-managers" target="_blank" rel="noreferrer">Explore RentRight <Icon name="external" size={13}/></a><a href="https://www.buildium.com/features/open-api/" target="_blank" rel="noreferrer">Buildium integration <Icon name="external" size={13}/></a></div>
        </>}

        {view === "operations" && <UNOperationsBoard asOf={asOf}/>}

        {view === "handoff" && <>{handoffRecord ? <><div className="un-handoff-picker"><label htmlFor="un-handoff-record">Reviewed packet</label><select id="un-handoff-record" value={handoffRecord.id} onChange={event => setSavedSelection(event.target.value)}>{draftRecords.map(record => <option key={record.id} value={record.id}>Unit {record.packet.unit.unitNumber} · {record.preferences.requestedIncreasePercent}% · {date(record.simulationDate)} · {record.id.slice(-6)}</option>)}</select><span>Returned drafts and approvals stay with this review.</span></div><UNHandoff key={handoffRecord.id} record={handoffRecord}/></> : <div className="un-saved-empty"><Icon name="spark" size={36}/><h2>First, review a unit’s evidence.</h2><p>Start with Unit 04. Confirm its lease, email, rent database records, and pricing instruction. The saved packet becomes the input for the mock Ambiguous AI handoff.</p><button className="un-primary" onClick={() => selectUnit(demoUnits[0].id)}>Review Unit 04 <Icon name="arrow" size={16}/></button></div>}</>}

        {view === "portfolio" && <section className="un-table-panel"><div className="un-section-title"><div><h2>Juniper sample portfolio</h2><span>{demoUnits.length} occupied units · 2 additional vacant units in Leasing & rent</span></div></div><div className="un-table-scroll"><table><thead><tr><th>Property / unit</th><th>Resident</th><th>Base rent</th><th>Lease ends</th><th>Review status</th><th/></tr></thead><tbody>{cases.map(item => <tr key={item.id}><td><strong>{item.unit.propertyName}</strong><small>Unit {item.unit.unitNumber}</small></td><td>{item.unit.residentName}</td><td>{money(item.unit.baseRent)}</td><td>{date(item.unit.leaseEnd)}</td><td><Status status={item.status}/></td><td><button className="un-text-button" aria-label={`Open unit ${item.unit.unitNumber}`} onClick={() => selectUnit(item.unit.id)}>Review <Icon name="arrow" size={16}/></button></td></tr>)}</tbody></table></div><button className="un-secondary" onClick={() => setView("operations")}>View vacant units & rent balances <Icon name="arrow" size={16}/></button><p className="un-table-note">All people, properties, leases, and messages in this portfolio are fictional. No mailbox or property system is connected.</p></section>}

        {view === "preferences" && <div className="un-preferences-grid"><form className="un-preferences-panel" onSubmit={savePreferences}><div className="un-section-title"><h2>Your review preferences</h2><Icon name="sliders"/></div><label>Start preparing before lease end<select value={form.reviewLeadDays} onChange={e => setForm({ ...form, reviewLeadDays: Number(e.target.value) })}>{[30, 60, 90, 120, 180].map(days => <option key={days} value={days}>{days} days before</option>)}</select><small>This is your planning window. Verify required notice periods during draft review.</small></label><label>Proposed base rent increase<div className="un-percent-input"><input aria-label="Proposed base rent increase" type="number" min="0" max="10" step="0.1" required value={form.requestedIncreasePercent} onChange={e => setForm({ ...form, requestedIncreasePercent: Number(e.target.value) })}/><span>%</span></div><small>Applied to the fictional portfolio, then checked against each unit’s rules. A maximum allowed rate never replaces your instruction.</small></label><label>Review owner<input required maxLength={120} value={form.reviewer} onChange={e => setForm({ ...form, reviewer: e.target.value })}/></label><button className="un-primary" type="submit">Save preferences & review portfolio <Icon name="arrow" size={16}/></button><button className="un-text-button" type="button" onClick={() => setForm(defaultPreferences)}>Restore sample preferences</button></form><aside className="un-preference-help"><span className="un-help-icon"><Icon name="spark" size={28}/></span><h2>Make it your routine.</h2><p>Try a 60-day window to see which units move out of today’s queue. Try a 4% proposal to see UN flag an amount above the sample LA ceiling.</p><div><strong>Your preference, confirmed.</strong><p>UN uses the choices you save here. It does not silently learn a pricing policy from an email.</p></div><div><strong>Prepare now. Review before acting.</strong><p>This demo prepares internal drafts and follow-ups. Notice service and rent-ledger updates are separate steps.</p></div></aside></div>}

        {view === "saved" && <><div className="un-section-title"><div><h2>Saved review packets</h2><span>{records.length} {records.length === 1 ? "record" : "records"} · local demo database</span></div><button className="un-secondary" onClick={() => void loadRecords()}>Refresh records</button></div>{records.length === 0 ? <div className="un-saved-empty"><Icon name="folder" size={40}/><h2>A place for the full story.</h2><p>Save a reviewed draft or follow-up to keep its evidence, calculation, reviewer notes and next steps together.</p><button className="un-primary" onClick={() => setView("desk")}>Go to review desk <Icon name="arrow" size={16}/></button></div> : <div className="un-saved-grid"><div>{records.map(record => <button className={`un-saved-card ${savedSelection === record.id ? "selected" : ""}`} key={record.id} onClick={() => setSavedSelection(record.id)}><div><Icon name="file"/><Status status={record.packet.status}/></div><h3>Unit {record.packet.unit.unitNumber} · {record.packet.unit.propertyName}</h3><p>{record.packet.draft ? "Internal draft and supporting evidence" : "Review findings and assigned follow-ups"}</p><small>{record.preferences.reviewer} · {new Date(record.createdAt).toLocaleDateString("en-US")}</small></button>)}</div><section className="un-saved-detail">{saved ? <><p className="un-eyebrow">REVIEWED PACKET / LOCAL RECORD</p><h2>Unit {saved.packet.unit.unitNumber}</h2><p>{saved.packet.unit.propertyName} · Review date {date(saved.simulationDate)}</p><Status status={saved.packet.status}/><div className="un-saved-note"><strong>Reviewer note</strong><p>{saved.reviewerNote || "No additional note."}</p></div><p><strong>Requested base rent:</strong> {money(saved.packet.requestedRent)} · {saved.preferences.requestedIncreasePercent}%</p><p><strong>Review owner:</strong> {saved.preferences.reviewer}</p><details open><summary>Saved next steps</summary>{saved.packet.tasks.map((task, i) => <div className="un-saved-task" key={i}><strong>{task.title}</strong><small>{task.owner}</small><p>{task.details}</p></div>)}</details><details><summary>Evidence snapshot · {saved.packet.evidence.length} records</summary>{saved.packet.evidence.map(item => <div className="un-saved-task" key={item.id}><strong>{item.title}</strong><small>{item.date} · {item.id}</small><p>{item.body}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Source ↗</a>}</div>)}</details>{saved.packet.draft && <details><summary>Saved drafting brief</summary><p>Propose {money(saved.packet.requestedRent)} per month from {date(saved.packet.effectiveDate)}. Open drafting & approval to request or review the returned letter.</p></details>}<div className="un-record-id"><span>Record ID</span><code>{saved.id}</code></div>{saved.packet.draft && <button className="un-primary" onClick={() => { setView("handoff"); window.scrollTo({ top: 0 }); }}>Open drafting & approval <Icon name="arrow" size={16}/></button>}<button className="un-secondary" onClick={() => downloadReview(saved)}>Export full review packet <Icon name="file" size={16}/></button></> : <div className="un-empty"><Icon name="file" size={32}/><h3>Open a saved review.</h3><p>Inspect the exact evidence and draft kept at the time of review.</p></div>}</section></div>}</>}
        <footer className="un-page-footer"><span>UN · Thoughtful property operations.</span><span>Fictional portfolio · Simulated review · Internal drafts</span></footer>
      </main>
    </div>
    {reviewing && <dialog ref={dialogRef} className="un-modal" aria-labelledby="un-review-title" onCancel={e => { e.preventDefault(); if (!saving) setReviewing(false); }}><div className="un-modal-top"><span className="un-eyebrow">YOUR REVIEW, ON RECORD</span><button className="un-quiet" aria-label="Close review" disabled={saving} onClick={() => setReviewing(false)}><Icon name="close"/></button></div><h2 id="un-review-title">Save Unit {selected.unit.unitNumber}’s review</h2><p>{selected.draft ? "Confirm the evidence and pricing instruction below. Next, send this saved packet through the simulated Ambiguous AI drafting workflow." : "Keep the full evidence snapshot, open questions, and next steps."}</p><div className="un-review-facts"><span>Reviewing as <strong>Property manager · {preferences.reviewer}</strong></span><span>Sources <strong>Lease document · email · rent database · coverage record</strong></span><span>Pricing instruction <strong>{selected.requestedIncreasePercent}% · {money(selected.unit.baseRent)} → {money(selected.requestedRent)}</strong></span><span>Candidate effective date <strong>{date(selected.effectiveDate)}</strong></span></div><div className="un-modal-summary"><Status status={selected.status}/><span>{preferences.reviewer}</span></div><label>Reviewer note<textarea autoFocus disabled={saving} maxLength={4000} rows={4} placeholder="Add your decision, a correction to investigate, or context for the next person…" value={note} onChange={e => setNote(e.target.value)}/></label><p className="un-modal-caption">This saves an internal review in the local demo database. It does not serve a notice or update anyone’s rent.</p>{error && <p role="alert" className="un-inline-error">{error}</p>}<div className="un-modal-actions"><button className="un-secondary" disabled={saving} onClick={() => setReviewing(false)}>Cancel</button><button className="un-primary" disabled={saving || !ready} onClick={() => void saveReview()}>{saving ? "Saving review…" : selected.draft ? "Confirm review & continue" : "Confirm review & save"}<Icon name="check" size={16}/></button></div></dialog>}
    {assistantOpen && modelConfigured && view === "desk" && <aside className="un-assistant-panel"><div><strong>Ask UN</strong><button className="un-quiet" aria-label="Close assistant" onClick={() => setAssistantOpen(false)}><Icon name="close"/></button></div><p>Discuss the fictional records on this desk with your configured assistant.</p><UNAssistant cases={cases} selectedId={selectedId} asOf={asOf} onSelect={selectUnit}/></aside>}
  </div>;
}
