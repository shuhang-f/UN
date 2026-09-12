"use client";

import { useEffect, useState } from "react";
import { PropertyAssistant } from "@/components/property-assistant";
import type { Profile, Report, Finding, EvidenceMessage } from "@/lib/property-types";
import type { PropertyPlan } from "@/lib/property-plan-types";
import { toolCatalog } from "@/lib/property-catalog";

const initial: Profile = { name: "", email: "", company: "", website: "", role: "Property manager", units: "", system: "", focus: "rent-control", jurisdiction: "", property: "", context: "" };
export default function Home() {
  const [profile, setProfile] = useState(initial);
  const [excerpt, setExcerpt] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [messages, setMessages] = useState<EvidenceMessage[]>([]);
  const [review, setReview] = useState<Finding | null>(null);
  const [plans, setPlans] = useState<PropertyPlan[]>([]);
  const [ready, setReady] = useState(false);
  const [model, setModel] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/integrations").then(r => r.json()).then(data => setModel(data.modelConfigured)).catch(() => {});
    fetch("/api/plans").then(async r => { if (!r.ok) throw new Error("Could not load saved workflows. Reload to retry."); return r.json(); }).then(data => { setPlans(data.plans); setAmbiguous(data.ambiguousConfigured); setReady(true); }).catch(e => setError(e.message));
  }, []);
  function field(key: keyof Profile, label: string, type = "text") {
    return <label>{label}<input type={type} required={["name", "email", "jurisdiction", "property"].includes(key)} value={profile[key] || ""} maxLength={key === "email" ? 254 : 160} onChange={e => { setProfile({ ...profile, [key]: e.target.value }); setReport(null); setReview(null); }} /></label>;
  }
  async function assess(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setReview(null);
    const selected: EvidenceMessage[] = excerpt.trim() ? [{ id: "selected-1", from: "Selected correspondence", subject: "User-supplied excerpt", body: excerpt.trim(), source: "pasted" }] : [];
    try {
      const response = await fetch("/api/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, messages: selected }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessages(selected); setReport(data.report);
    } catch (e) { setError(e instanceof Error ? e.message : "Assessment failed. Please retry."); } finally { setBusy(false); }
  }
  async function save(destination: "local" | "ambiguous") {
    if (!review) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: review.title, category: review.category, steps: review.steps, toolIds: review.toolIds, destination, approved: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setPlans(previous => [data.plan, ...previous.filter(p => p.id !== data.plan.id)]); setReview(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed. Please retry."); } finally { setBusy(false); }
  }
  return <main className="groundwork">
    <header><a href="/">UN <span> / PROPERTY OPERATIONS</span></a><span>Intake → Evidence → Action plan</span></header>
    <section className="gw-hero"><p className="gw-kicker">A clearer process for every property</p><h1>Know which units need attention.<br />Give every next step an owner.</h1><p>Bring property context and selected correspondence. Review possible vacancies, plan make-ready work, and check regulated reletting before acting.</p></section>
    <div className="gw-columns"><form className="gw-panel" onSubmit={assess}><p className="gw-kicker">01 / YOUR CONTEXT</p><h2>Start with the basics</h2><div className="gw-fields">{field("name", "Manager name")}{field("email", "Email", "email")}{field("jurisdiction", "Property city and state")}{field("property", "Property name or street address")}{field("system", "Current property software")}</div>
      <label>What would you like to improve?<select value={profile.focus} onChange={e => { setProfile({ ...profile, focus: e.target.value as Profile["focus"] }); setReport(null); setReview(null); }}><option value="rent-control">Rent-regulated units: vacancy and follow-through</option><option value="vacancy">Vacancy and leasing</option><option value="maintenance">Maintenance coordination</option><option value="both">Vacancy and maintenance</option></select></label>
      <label>Describe one workflow or blocker<textarea maxLength={6000} value={profile.context} placeholder="Which units may be vacant, what is blocking readiness, and what must be reviewed before reletting?" onChange={e => { setProfile({ ...profile, context: e.target.value }); setReport(null); setReview(null); }} /></label>
      <details open><summary>02 / Add evidence for this property</summary><p>No inbox is connected. Paste correspondence for this property only, including unit numbers and relevant dates; you can continue without it. Name and email do not grant mailbox access.</p><label>Message excerpt<textarea maxLength={8000} value={excerpt} onChange={e => { setExcerpt(e.target.value); setReport(null); setReview(null); }} placeholder="Example format: Unit 408 is vacant as of September 10. Inspection is pending. Include later updates too; remove unnecessary personal details." /></label><p>Direct Gmail / Outlook connection is not yet available. Assessment uses local topic rules; opening the configured assistant shares selected context with its model provider.</p></details>
      <button className="gw-primary" disabled={busy}>{busy ? "Working…" : "Propose workflow improvements →"}</button><p className="gw-small">Your contact details are not saved with the workflow.</p>
    </form><section className="gw-results" aria-live="polite"><p className="gw-kicker">03 / YOUR ACTION PLAN</p>{!report ? <div className="gw-panel"><h2>From a unit signal to a proposed action.</h2><p>For a rent-regulated property, review these handoffs:</p><ol><li>Move-out correspondence → verified occupancy</li><li>Confirmed vacancy → inspection and make-ready work</li><li>Verified readiness + regulation review → approved leasing handoff</li></ol><p>Start with your city and an example. Unknown facts remain visible for the reviewer.</p></div> : <><p>{report.summary}</p>{report.findings.map(finding => <article className="gw-panel" key={finding.id}><h2>{finding.title}</h2><p>{finding.summary}</p>{finding.evidence.map(e => <blockquote key={e.messageId}>{e.quote}<small>Source: {e.messageId}</small></blockquote>)}<ol>{finding.steps.map(step => <li key={step.title}><strong>{step.title}</strong><small>{step.owner}</small><p>{step.details}</p></li>)}</ol><h3>Tools to use</h3>{finding.toolIds.map(id => { const tool = toolCatalog.find(t => t.id === id); return tool && <div className="gw-tool" key={id}><a href={tool.url} target="_blank" rel="noreferrer">{tool.name} ↗</a><p>{tool.fit}</p><small>{tool.setup}</small></div>; })}<p><strong>Next question:</strong> {finding.question}</p><button type="button" onClick={() => setReview(finding)}>Review & save workflow</button></article>)}<details><summary>What still needs confirmation</summary><ul>{report.unknowns.map(u => <li key={u}>{u}</li>)}</ul></details></>}
    </section></div>
    {error && <p role="alert" className="gw-error">{error}</p>}
    {review && <section className="gw-panel"><h2>Review: {review.title}</h2><ol>{review.steps.map(s => <li key={s.title}><strong>{s.title} · {s.owner}</strong><p>{s.details}</p></li>)}</ol><p>This saves a planning task. Sending notices, scheduling reminders, and changing rent records require separate actions.</p><button disabled={busy || !ready} onClick={() => save("local")}>Approve & save locally</button> <button disabled={busy || !ready || !ambiguous} onClick={() => save("ambiguous")}>Approve & save to Ambiguous</button> <button disabled={busy} onClick={() => setReview(null)}>Cancel</button></section>}
    {plans.length > 0 && <section className="gw-panel"><h2>Saved workflows</h2>{plans.map(p => <details key={p.id}><summary>{p.title} · {p.destination}</summary><small>Record: {p.id}</small><ol>{p.steps.map(s => <li key={s.title}>{s.title} — {s.owner}<p>{s.details}</p></li>)}</ol>{p.externalTask?.url && <a href={p.externalTask.url} target="_blank" rel="noreferrer">Open saved task</a>}</details>)}</section>}
    {model && report && <section className="gw-panel"><h2>Refine the plan with your assistant</h2><PropertyAssistant input={{ profile, messages }} report={report} onReview={id => setReview(report.findings.find(f => f.id === id) || null)} /></section>}
  </main>;
}
