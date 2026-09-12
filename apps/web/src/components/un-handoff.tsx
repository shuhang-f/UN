"use client";

import { useEffect, useRef, useState } from "react";
import type { UnSavedReview } from "@/lib/un-storage-types";
import type { UnHandoffRun } from "@/lib/un-handoff-types";
import "./un-handoff.css";

const endpoint = "/api/un/reviews/handoff";
const draftsInFlight = new Map<string, Promise<UnHandoffRun>>();
const approvalsInFlight = new Map<string, Promise<UnHandoffRun>>();
let runsInFlight: Promise<UnHandoffRun[]> | undefined;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const day = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const animationPause = () => new Promise<void>(resolve => window.setTimeout(resolve, 1800));

async function jsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The simulated handoff could not finish. Please retry.");
  return data as T;
}

function loadRuns() {
  return runsInFlight ??= fetch(endpoint, { cache: "no-store" })
    .then(jsonResponse<{ runs: UnHandoffRun[] }>).then(data => data.runs)
    .finally(() => { runsInFlight = undefined; });
}

function draftOnce(reviewId: string) {
  const pending = draftsInFlight.get(reviewId);
  if (pending) return pending;
  const request = fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "draft", reviewId }),
  }).then(jsonResponse<{ run: UnHandoffRun }>).then(data => data.run)
    .finally(() => { draftsInFlight.delete(reviewId); });
  draftsInFlight.set(reviewId, request);
  return request;
}

function approveOnce(runId: string, approvalNote: string) {
  const pending = approvalsInFlight.get(runId);
  if (pending) return pending;
  const request = fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", runId, approvalNote }),
  }).then(jsonResponse<{ run: UnHandoffRun }>).then(data => data.run)
    .finally(() => { approvalsInFlight.delete(runId); });
  approvalsInFlight.set(runId, request);
  return request;
}

function Mark({ kind = "check" }: { kind?: "check" | "arrow" | "file" | "close" }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "check" ? <path d="m5 12 4 4L19 6"/> : kind === "arrow" ? <path d="M5 12h14m-5-5 5 5-5 5"/> : kind === "close" ? <path d="m6 6 12 12M6 18 18 6"/> : <><path d="M14 3H5v18h14V8l-5-5Zm0 0v6h5"/><path d="M8 13h8M8 17h5"/></>}
  </svg>;
}

export function UNHandoff({ record, onClose }: { record: UnSavedReview; onClose?: () => void }) {
  const [run, setRun] = useState<UnHandoffRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"draft" | "approve" | null>(null);
  const [error, setError] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [stage, setStage] = useState(0);
  const generation = useRef(0);
  const actionLock = useRef(false);
  const packet = record.packet;
  const eligible = packet.status === "draft-ready" && packet.draft !== null;
  const approved = run?.status === "approved";
  const pending = action !== null;
  const signals = ["lease", "ledger", "email"].filter(kind => packet.evidence.some(item => item.kind === kind));
  const processingSteps = ["Package the reviewed records", "Simulate the Ambiguous AI handoff", "Return the internal draft to your desk"];

  async function restore(token = generation.current) {
    setLoading(true); setError("");
    try {
      let existing: UnHandoffRun | null;
      const pendingDraft = draftsInFlight.get(record.id);
      if (pendingDraft) existing = await pendingDraft;
      else existing = (await loadRuns()).filter(item => item.reviewId === record.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
      if (existing && approvalsInFlight.has(existing.id)) existing = await approvalsInFlight.get(existing.id)!;
      if (generation.current !== token) return;
      setRun(existing); setApprovalNote(existing?.approvalNote || "");
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "The saved handoff could not be loaded.");
    } finally { if (generation.current === token) setLoading(false); }
  }

  useEffect(() => {
    const token = ++generation.current;
    actionLock.current = false; setRun(null); setApprovalNote(""); setAction(null); setStage(0);
    void restore(token);
    return () => { generation.current++; };
  }, [record.id]);

  useEffect(() => {
    if (action !== "draft") return;
    setStage(0);
    const timers = [window.setTimeout(() => setStage(1), 550), window.setTimeout(() => setStage(2), 1150)];
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [action]);

  async function sendPacket() {
    if (actionLock.current || loading || !eligible || run) return;
    actionLock.current = true; setAction("draft"); setError("");
    const token = generation.current;
    try {
      const [next] = await Promise.all([draftOnce(record.id), animationPause()]);
      if (generation.current === token) { setRun(next); setApprovalNote(next.approvalNote); }
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "The simulated draft could not be prepared. Retry the same reviewed packet.");
    } finally {
      if (generation.current === token) { actionLock.current = false; setAction(null); }
    }
  }

  async function approveDraft() {
    if (actionLock.current || loading || !run || run.status !== "awaiting-approval") return;
    actionLock.current = true; setAction("approve"); setError("");
    const token = generation.current;
    try {
      const next = await approveOnce(run.id, approvalNote.trim());
      if (generation.current === token) { setRun(next); setApprovalNote(next.approvalNote); }
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "Approval could not be recorded. Retry with the same note.");
    } finally {
      if (generation.current === token) { actionLock.current = false; setAction(null); }
    }
  }

  function exportLetter() {
    if (!run) return;
    const content = [run.letter.title, "", run.letter.body, "", `Simulation status: ${run.status}`, `Handoff record: ${run.id}`, "No notice has been sent or served."].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `UN-unit-${packet.unit.unitNumber}-internal-draft.txt`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="unh-app" aria-label={`Unit ${packet.unit.unitNumber} simulated draft handoff`}>
    <header className="unh-heading"><div><p className="unh-eyebrow">FROM REVIEWED RECORDS TO A DRAFT</p><h2>A draft, back on your desk.</h2><p>Unit {packet.unit.unitNumber} · {packet.unit.propertyName}</p></div>{onClose && <button className="unh-icon-button" onClick={onClose} aria-label="Close draft handoff"><Mark kind="close"/></button>}</header>
    <ol className="unh-journey" aria-label="Draft workflow progress">
      <li className="complete"><span><Mark/></span><div><strong>Information reviewed</strong><small>Saved by {record.preferences.reviewer}</small></div></li>
      <li className={run ? "complete" : action === "draft" ? "active" : ""}><span>{run ? <Mark/> : "02"}</span><div><strong>Ambiguous AI · demo</strong><small>{run ? "Draft returned" : action === "draft" ? "Simulated processing" : "Ready for a handoff"}</small></div></li>
      <li className={approved ? "complete" : run ? "active" : ""}><span>{approved ? <Mark/> : "03"}</span><div><strong>Manager approval</strong><small>{approved ? "Approval recorded" : run ? "Awaiting your decision" : "Review the returned draft"}</small></div></li>
    </ol>
    {loading && <p className="unh-loading" role="status">Loading the saved draft workflow…</p>}
    {error && <div className="unh-error" role="alert"><p>{error}</p><button className="unh-text-button" disabled={pending} onClick={() => void restore()}>Reload saved handoff</button></div>}
    <div className="unh-grid">
      <aside className="unh-packet">
        <div className="unh-packet-heading"><Mark kind="file"/><div><h3>Your reviewed information</h3><p>Saved review · {day(record.createdAt)}</p></div></div>
        <div className="unh-role"><span className="unh-label">WORKING ROLE</span><strong>Property manager</strong><span className="unh-inference">Inferred from sample records</span><p>{signals.map(signal => signal === "email" ? "correspondence" : signal).join(", ")} records indicate a property-management workflow. {record.preferences.reviewer} confirmed this information packet when saving the review.</p></div>
        <dl className="unh-facts"><div><dt>Review owner</dt><dd>{record.preferences.reviewer}</dd></div><div><dt>Resident in the sample</dt><dd>{packet.unit.residentName}</dd></div><div><dt>Current base rent</dt><dd>{money(packet.unit.baseRent)}</dd></div><div><dt>Requested base rent</dt><dd>{money(packet.requestedRent)} <span>({packet.requestedIncreasePercent}%)</span></dd></div><div><dt>Candidate effective date</dt><dd>{day(packet.effectiveDate)}</dd></div></dl>
        <details className="unh-sources"><summary>Reviewed sources <span>{packet.evidence.length}</span></summary>{packet.evidence.map(source => <article key={source.id}><span>{source.kind} · {day(source.date)}</span><h4>{source.title}</h4><p>{source.body}</p><code>{source.id}</code>{source.url && <a href={source.url} target="_blank" rel="noreferrer">Open official source ↗</a>}</article>)}</details>
        {record.reviewerNote && <div className="unh-review-note"><strong>Saved reviewer note</strong><p>{record.reviewerNote}</p></div>}
        <p className="unh-record-reference">Review record <code>{record.id}</code></p>
      </aside>
      <div className="unh-workspace">
        {!eligible ? <div className="unh-held"><span className="unh-held-icon">!</span><h3>The next step is to resolve the review.</h3><p>{packet.summary}</p><ul>{packet.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul><div className="unh-held-tasks">{packet.tasks.map((task, index) => <article key={index}><strong>{task.title}</strong><p>{task.details}</p><small>{task.owner}</small></article>)}</div><button className="unh-primary" disabled>Draft handoff unavailable</button><p className="unh-caption">A saved follow-up keeps its blockers. Saving does not make an increase eligible.</p></div>
          : action === "draft" ? <div className="unh-processing" aria-busy="true"><div className="unh-provider"><span className="unh-provider-mark">a.</span><div><strong>Ambiguous AI</strong><small>Simulated workflow</small></div><span className="unh-simulated">DEMO</span></div><h3>Preparing the internal draft.</h3><p>The mock workspace is using this saved information packet.</p><ol>{processingSteps.map((title, index) => <li className={index < stage ? "complete" : index === stage ? "active" : ""} key={title}><span>{index < stage ? <Mark/> : String(index + 1).padStart(2, "0")}</span><strong>{title}</strong></li>)}</ol><p className="unh-caption" role="status">{processingSteps[stage]}… Simulation only; no external workspace is contacted.</p></div>
          : run ? <><div className={`unh-result-banner ${approved ? "approved" : "awaiting"}`} role="status"><span><Mark kind={approved ? "check" : "file"}/></span><div><strong>{approved ? "Draft approved in the demo" : "Your draft is back for approval"}</strong><p>{approved ? `${run.reviewer}’s approval is recorded${run.approvedAt ? ` · ${day(run.approvedAt)}` : ""}.` : "Ambiguous AI · simulated. Review the returned letter before approving it."}</p></div></div><article className="unh-letter"><header><span className="unh-letter-brand">UN<span>·</span></span><span>INTERNAL WORKING DRAFT</span></header><h3>{run.letter.title}</h3><pre>{run.letter.body}</pre><footer>Fictional demo · template and service requirements require review</footer></article>
            {approved ? <div className="unh-approval-note"><strong>Approval note</strong><p>{run.approvalNote || "No additional note."}</p></div> : <form className="unh-approval" onSubmit={event => { event.preventDefault(); void approveDraft(); }}><label htmlFor={`unh-note-${record.id}`}>Your approval note <span>Optional</span></label><textarea id={`unh-note-${record.id}`} rows={3} maxLength={4000} disabled={pending} value={approvalNote} onChange={event => setApprovalNote(event.target.value)} placeholder="Record what you reviewed or what still needs checking before any real notice…"/><p>Approval records your decision in this local simulation. It does not send or serve a notice, change rent, or establish that the wording is legally ready to use.</p><button className="unh-primary" disabled={pending || loading} type="submit">{action === "approve" ? "Recording approval…" : "Approve draft"}<Mark/></button></form>}
            <div className="unh-result-footer"><button className="unh-secondary" onClick={exportLetter}><Mark kind="file"/>Export letter · .txt</button><span>Handoff record <code>{run.id}</code></span></div></>
          : <div className="unh-ready"><div className="unh-provider"><span className="unh-provider-mark">a.</span><div><strong>Ambiguous AI</strong><small>Simulated workflow</small></div><span className="unh-simulated">DEMO</span></div><h3>Turn the reviewed packet into a letter.</h3><p>Pass the saved names, dates, rent proposal and source records to a mock drafting workflow. The returned draft will wait here for your approval.</p><div className="unh-handoff-summary"><span className="unh-check-mark"><Mark/></span><div><strong>Ready to draft from reviewed information</strong><p>{packet.unit.residentName} · Unit {packet.unit.unitNumber}<br/>{money(packet.unit.baseRent)} → {money(packet.requestedRent)} · {day(packet.effectiveDate)}</p></div></div><button className="unh-primary" disabled={loading || pending || !!error} onClick={() => void sendPacket()}>Send to Ambiguous AI · demo<Mark kind="arrow"/></button><p className="unh-caption">This demo persists the workflow locally. No records are sent to Ambiguous AI and no email is delivered.</p></div>}
      </div>
    </div>
  </section>;
}
