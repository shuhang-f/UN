"use client";

import { useEffect, useRef, useState } from "react";
import type { UnSavedReview } from "@/lib/un-storage-types";
import type { UnHandoffRun, UnHandoffsResponse } from "@/lib/un-handoff-types";
import "./un-handoff.css";

const endpoint = "/api/un/reviews/handoff";
const draftsInFlight = new Map<string, Promise<UnHandoffRun>>();
const approvalsInFlight = new Map<string, Promise<UnHandoffRun>>();
let runsInFlight: Promise<UnHandoffsResponse> | undefined;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const day = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

async function jsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not finish. Please retry.");
  return data as T;
}

function loadRuns() {
  return runsInFlight ??= fetch(endpoint, { cache: "no-store" })
    .then(jsonResponse<UnHandoffsResponse>)
    .finally(() => { runsInFlight = undefined; });
}

function draftOnce(reviewId: string) {
  const pending = draftsInFlight.get(reviewId);
  if (pending) return pending;
  const request = fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "draft", reviewId, approved: true }),
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

function Letter({ letter }: { letter: { title: string; body: string } }) {
  return <article className="unh-letter"><header><span className="unh-letter-brand">UN<span>·</span></span><span>INTERNAL TEMPLATE LETTER</span></header><h3>{letter.title}</h3><pre>{letter.body}</pre><footer>Prepared by UN from sample records. Review wording and service requirements before use.</footer></article>;
}

export function UNHandoff({ record, onClose, onOpenTools }: { record: UnSavedReview; onClose?: () => void; onOpenTools?: () => void }) {
  const [run, setRun] = useState<UnHandoffRun | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"draft" | "approve" | null>(null);
  const [error, setError] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const generation = useRef(0);
  const actionLock = useRef(false);
  const packet = record.packet;
  const eligible = packet.status === "draft-ready" && packet.draft !== null;
  const approved = run?.status === "approved";
  const pending = action !== null;

  async function restore(token = generation.current) {
    setLoading(true); setError("");
    try {
      const pendingDraft = draftsInFlight.get(record.id);
      const data = await loadRuns();
      let existing = pendingDraft ? await pendingDraft : data.runs.filter(item => item.reviewId === record.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
      if (existing && approvalsInFlight.has(existing.id)) existing = await approvalsInFlight.get(existing.id)!;
      if (generation.current !== token) return;
      setConfigured(data.ambiguousConfigured); setRun(existing); setApprovalNote(existing?.approvalNote || "");
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "The saved task could not be loaded.");
    } finally { if (generation.current === token) setLoading(false); }
  }

  useEffect(() => {
    const token = ++generation.current;
    actionLock.current = false; setRun(null); setConfigured(null); setApprovalNote(""); setAction(null);
    void restore(token);
    return () => { generation.current++; };
  }, [record.id]);

  async function sendPacket() {
    if (actionLock.current || loading || !configured || !eligible || run) return;
    actionLock.current = true; setAction("draft"); setError("");
    const token = generation.current;
    try {
      const next = await draftOnce(record.id);
      if (generation.current === token) { setRun(next); setApprovalNote(next.approvalNote); }
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "The task could not be saved. Retry the same reviewed packet.");
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
      if (generation.current === token) {
        setRun({ ...next, externalTask: run.externalTask, ...(run.verificationError ? { verificationError: run.verificationError } : {}) });
        setApprovalNote(next.approvalNote);
      }
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "Approval could not be recorded. Retry with the same note.");
    } finally {
      if (generation.current === token) { actionLock.current = false; setAction(null); }
    }
  }

  function exportLetter() {
    if (!run) return;
    const content = [run.letter.title, "", run.letter.body, "", `Approval status: ${run.status}`, `Ambiguous task: ${run.externalTask.id}`, "No notice has been sent or served."].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `UN-unit-${packet.unit.unitNumber}-internal-draft.txt`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
  }

  return <section className="unh-app" aria-label={`Unit ${packet.unit.unitNumber} draft approval`}>
    <header className="unh-heading"><div><p className="unh-eyebrow">REVIEWED PACKET</p><h2>Unit {packet.unit.unitNumber} · Draft approval</h2><p>{packet.unit.propertyName}</p></div>{onClose && <button className="unh-icon-button" onClick={onClose} aria-label="Close draft approval"><Mark kind="close"/></button>}</header>
    <ol className="unh-journey" aria-label="Review progress">
      <li className="complete"><span><Mark/></span><div><strong>Records reviewed</strong><small>Saved by {record.preferences.reviewer}</small></div></li>
      <li className={run ? "complete" : action === "draft" ? "active" : ""}><span>{run ? <Mark/> : "02"}</span><div><strong>Ambiguous AI task</strong><small>{run ? "Saved to workspace" : action === "draft" ? "Saving task…" : "Review letter, then save"}</small></div></li>
      <li className={approved ? "complete" : run ? "active" : ""}><span>{approved ? <Mark/> : "03"}</span><div><strong>Manager approval</strong><small>{approved ? "Recorded locally" : "Review the template letter"}</small></div></li>
    </ol>
    {loading && <p className="unh-loading" role="status">Loading saved tasks…</p>}
    {error && <div className="unh-error" role="alert"><p>{error}</p><button className="unh-text-button" disabled={pending || loading} onClick={() => void restore()}>Reload saved task</button></div>}
    <div className="unh-grid">
      <aside className="unh-packet">
        <div className="unh-packet-heading"><Mark kind="file"/><div><h3>Reviewed records</h3><p>Saved review · {day(record.createdAt)}</p></div></div>
        <dl className="unh-facts"><div><dt>Review owner</dt><dd>{record.preferences.reviewer}</dd></div><div><dt>Sample resident</dt><dd>{packet.unit.residentName}</dd></div><div><dt>Current base rent</dt><dd>{money(packet.unit.baseRent)}</dd></div><div><dt>Requested base rent</dt><dd>{money(packet.requestedRent)} <span>({packet.requestedIncreasePercent}%)</span></dd></div><div><dt>Candidate effective date</dt><dd>{day(packet.effectiveDate)}</dd></div></dl>
        <details className="unh-sources"><summary>Reviewed sources <span>{packet.evidence.length}</span></summary>{packet.evidence.map(source => <article key={source.id}><span>{source.kind} · {day(source.date)}</span><h4>{source.title}</h4><p>{source.body}</p><code>{source.id}</code>{source.url && <a href={source.url} target="_blank" rel="noreferrer">Open official source ↗</a>}</article>)}</details>
        {record.reviewerNote && <div className="unh-review-note"><strong>Saved reviewer note</strong><p>{record.reviewerNote}</p></div>}
        <p className="unh-record-reference">Local review <code>{record.id}</code></p>
      </aside>
      <div className="unh-workspace">
        {!eligible ? <div className="unh-held"><span className="unh-held-icon">!</span><h3>Resolve the review first</h3><p>{packet.summary}</p><ul>{packet.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul><div className="unh-held-tasks">{packet.tasks.map((task, index) => <article key={index}><strong>{task.title}</strong><p>{task.details}</p><small>{task.owner}</small></article>)}</div><p className="unh-caption">The saved follow-up keeps the open questions and next steps.</p></div>
          : run ? <><div className={`unh-result-banner ${approved ? "approved" : "awaiting"}`} role="status"><span><Mark kind={approved ? "check" : "file"}/></span><div><strong>{approved ? "Draft approval recorded" : "Saved to Ambiguous AI"}</strong><p>{approved ? `${run.reviewer}’s approval is saved locally${run.approvedAt ? ` · ${day(run.approvedAt)}` : ""}.` : "Your reviewed packet and UN template letter are saved as a task."}</p></div></div>
            <div className="unh-external-record"><strong>Ambiguous AI task</strong><code>{run.externalTask.id}</code>{run.externalTask.url && <a href={run.externalTask.url} target="_blank" rel="noreferrer">Open task in Ambiguous AI ↗</a>}<dl><div><dt>Workspace</dt><dd>{run.externalTask.workspaceId}</dd></div><div><dt>Connected as</dt><dd>{run.externalTask.identityName}</dd></div><div><dt>Last verified</dt><dd>{new Date(run.externalTask.verifiedAt).toLocaleString("en-US")}</dd></div></dl>{configured === false && <p className="unh-caption">Ambiguous AI is disconnected. This is the last verified task record.</p>}<button className="unh-text-button" disabled={loading || pending} onClick={() => void restore()}>{configured ? "Refresh from Ambiguous AI" : "Reload saved task"}</button></div>
            {run.verificationError && <div className="unh-error" role="alert"><strong>Showing the last verified task</strong><p>{run.verificationError}</p></div>}
            <Letter letter={run.letter}/>
            {approved ? <div className="unh-approval-note"><strong>Approval note</strong><p>{run.approvalNote || "No additional note."}</p></div> : <form className="unh-approval" onSubmit={event => { event.preventDefault(); void approveDraft(); }}><label htmlFor={`unh-note-${record.id}`}>Approval note <span>Optional</span></label><textarea id={`unh-note-${record.id}`} rows={3} maxLength={4000} disabled={pending} value={approvalNote} onChange={event => setApprovalNote(event.target.value)} placeholder="Record what you checked and any remaining notice or service requirements…"/><p>This records your decision locally. It does not send a notice, change rent, or update the Ambiguous task.</p><button className="unh-primary" disabled={pending || loading} type="submit">{action === "approve" ? "Recording approval…" : "Record draft approval"}<Mark/></button></form>}
            <div className="unh-result-footer"><button className="unh-secondary" onClick={exportLetter}><Mark kind="file"/>Export letter · .txt</button><span>Local approval record <code>{run.id}</code></span></div></>
          : <><div className="unh-ready" aria-busy={action === "draft"}><div className="unh-provider"><span className="unh-provider-mark">a.</span><div><strong>Ambiguous AI</strong><small>Workspace tasks</small></div></div><h3>Save the reviewed packet</h3><p>UN has prepared the template letter below. Saving creates a task in your connected Ambiguous AI workspace with the letter, reviewed source records, rent proposal, and reviewer note.</p>
            {configured === false && <div className="unh-connection"><strong>Connect Ambiguous AI to save</strong><p>Add your workspace connection in Tools, then return to this saved review.</p>{onOpenTools ? <button className="unh-secondary" onClick={onOpenTools}>Open tools <Mark kind="arrow"/></button> : <a href="https://app.ambiguous.ai" target="_blank" rel="noreferrer">Open Ambiguous AI connection settings ↗</a>}<button className="unh-text-button" disabled={loading || pending} onClick={() => void restore()}>Check connection again</button></div>}
            <button className="unh-primary" disabled={loading || pending || configured !== true} onClick={() => void sendPacket()}>{action === "draft" ? "Saving to Ambiguous AI…" : "Save to Ambiguous AI"}<Mark kind="arrow"/></button>
            <p className="unh-caption" role={action === "draft" ? "status" : undefined}>{action === "draft" ? "Waiting for Ambiguous AI to save and return the task." : "This sends the displayed sample records and letter to Ambiguous AI. Manager approval is recorded separately."}</p></div>{packet.draft && <Letter letter={packet.draft}/>}</>}
      </div>
    </div>
  </section>;
}
