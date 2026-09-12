"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DEMO_TODAY, defaultPreferences, demoUnits } from "@/lib/un-demo";
import { reviewPortfolio } from "@/lib/un-review";
import "./un-demo-entry.css";

const SESSION_KEY = "un-demo-entry-v1";
const sampleReviews = reviewPortfolio(demoUnits, DEMO_TODAY, defaultPreferences);
const hero = sampleReviews.find(item => item.unit.unitNumber === "04")!;
const attentionCount = sampleReviews.filter(item => item.status !== "upcoming").length;
const draftCount = sampleReviews.filter(item => item.draft !== null).length;
const steps = [
  { title: "Read documents, email, and database records", detail: "Compare fictional leases, manager messages, unit status, and dated rent transactions." },
  { title: "Infer the property-manager workspace", detail: "Lease administration and portfolio instructions suggest a property-manager role. Review this inference on the desk." },
  { title: "Identify what needs attention", detail: `Unit 04 renews in ${hero.daysUntilRenewal} days. Units 05 and 17 need leasing work; Unit 12 has an overdue balance.` },
  { title: "Prepare the manager’s review", detail: "Review the evidence first, then send a confirmed packet to mock Ambiguous AI for drafting and approval." },
];
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function Arrow() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>; }
function Tick() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>; }

/** Demo identity is a browser-only label, never authentication or a mailbox connection. */
export function UNDemoEntry({ children }: { children: (restart: () => void, email: string) => ReactNode }) {
  const [phase, setPhase] = useState<"restoring" | "email" | "processing" | "ready">("restoring");
  const [email, setEmail] = useState("");
  const [completedSteps, setCompletedSteps] = useState(0);
  const [validation, setValidation] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (value?.completed === true && typeof value.email === "string" && value.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
        setEmail(value.email); setPhase("ready"); return;
      }
    } catch { /* An unavailable or stale session starts the demo at the entry screen. */ }
    setPhase("email");
  }, []);

  useEffect(() => {
    if (phase === "email" || phase === "processing") window.scrollTo({ top: 0 });
    if (phase !== "processing") return;
    const timers = steps.map((_, index) => window.setTimeout(() => setCompletedSteps(previous => Math.max(previous, index + 1)), (index + 1) * 850));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [phase]);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
      setValidation("Enter an email-shaped address, such as manager@example.com."); return;
    }
    setEmail(normalized); setValidation(""); setCompletedSteps(0); setPhase("processing");
  }
  function finish() {
    if (completedSteps < steps.length) return;
    // A replay matches the sample counts and proposal shown in this walkthrough.
    // Saved review history uses a separate server session and remains intact.
    try { localStorage.removeItem("un-demo-preferences-v1"); } catch { /* The desk uses defaults when storage is unavailable. */ }
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, completed: true })); } catch { /* The demo still works for this page visit. */ }
    setPhase("ready"); window.scrollTo({ top: 0 });
  }
  function restart() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* State still resets without storage. */ }
    setPhase("email"); setCompletedSteps(0); setValidation(""); window.scrollTo({ top: 0 });
  }

  if (phase === "ready") return children(restart, email);
  if (phase === "restoring") return <main className="ude-app ude-restoring" aria-busy="true"><span className="ude-brand">UN<span>·</span></span><p role="status">Opening your demo…</p></main>;

  const finished = completedSteps === steps.length;
  return <div className="ude-app">
    <header className="ude-header"><span className="ude-brand">UN<span>·</span></span><span className="ude-header-label">PROPERTY INTELLIGENCE</span><span className="ude-demo-badge"><i/>Interactive demo</span></header>
    {phase === "email" ? <main className="ude-welcome">
      <section className="ude-intro">
        <p className="ude-eyebrow">A LITTLE CLARITY, EVERY DAY</p>
        <h1>Your next review<br/>starts here.</h1>
        <p className="ude-lead">Renewals, vacant units, and overdue rent. One clear place to review the evidence and decide what happens next.</p>
        <form className="ude-form" onSubmit={start}>
          <label htmlFor="ude-email">Enter an email to explore your demo</label>
          <div className="ude-email-input"><span aria-hidden="true">@</span><input ref={emailRef} id="ude-email" name="demoEmail" type="email" inputMode="email" autoComplete="off" placeholder="manager@example.com" maxLength={254} required value={email} onChange={event => { setEmail(event.target.value); setValidation(""); }} aria-describedby="ude-email-help"/></div>
          <p id="ude-email-help">Any email works. It’s a demo label for the same fictional portfolio, kept only in this browser.</p>
          {validation && <p className="ude-error" role="alert">{validation}</p>}
          <button className="ude-primary" type="submit">Open my demo workspace <Arrow/></button>
          <button className="ude-text-button" type="button" onClick={() => { setEmail(`manager-${Math.random().toString(36).slice(2, 8)}@example.com`); setValidation(""); emailRef.current?.focus(); }}>Use a random sample email</button>
        </form>
        <div className="ude-entry-notes"><span><Tick/>No sign-in needed</span><span><Tick/>Sample data included</span></div>
        <p className="ude-reset-note">Each new demo starts with sample review settings. Saved reviews stay available.</p>
      </section>
      <aside className="ude-preview" aria-label="Demo portfolio preview">
        <div className="ude-preview-caption"><span>YOUR DAILY REVIEW, AHEAD OF TIME</span><span>01 / 03</span></div>
        <div className="ude-sample-card">
          <div className="ude-sample-top"><span className="ude-building-icon" aria-hidden="true">⌂</span><div><strong>Juniper Residential</strong><small>Los Angeles · fictional portfolio</small></div><span className="ude-sample-dot"/></div>
          <div className="ude-renewal"><span>COMING UP NEXT</span><span className="ude-days">In {hero.daysUntilRenewal} days</span><h2>Unit 04’s lease is<br/>coming up for renewal.</h2><p>Review the proposal, send the evidence to mock Ambiguous AI, and approve the draft that comes back.</p></div>
          <div className="ude-rent"><div><span>Current base rent</span><strong>{money(hero.unit.baseRent)}</strong></div><Arrow/><div><span>Your {hero.requestedIncreasePercent}% proposal</span><strong>{money(hero.requestedRent)}</strong></div></div>
          <div className="ude-preview-task"><span className="ude-check"><Tick/></span><div><strong>Prepare the notice draft</strong><small>Internal draft · manager review required</small></div></div>
        </div>
        <div className="ude-floating-note"><span>↗</span><div><strong>{attentionCount} renewal reviews + leasing & rent</strong><p>Two vacant units. One overdue rent balance.</p></div></div>
        <p className="ude-preview-foot">Demo date: September 12, 2026 · {demoUnits.length} occupied + 2 vacant sample units</p>
      </aside>
    </main> : <main className="ude-processing">
      <div className="ude-process-heading"><p className="ude-eyebrow">FROM RECORDS TO NEXT STEPS</p><h1>{finished ? "Your review is ready." : "Preparing your review desk."}</h1><p>Demo workspace for <strong className="ude-email-label">{email}</strong></p></div>
      <section className="ude-process-panel" aria-label="Mock document and portfolio analysis">
        <header className="ude-process-header"><div className="ude-provider"><span className="ude-ambiguous-mark" aria-hidden="true">a.</span><div><strong>UN · Evidence review</strong><small>Mock document, email & database analysis</small></div></div><span className="ude-simulation-badge">SIMULATED</span></header>
        <div className="ude-process-grid"><section className="ude-progress-column" aria-label="Processing stages">
          <div className="ude-progress-caption"><strong>{finished ? "Sample review prepared" : "Working through the sample records"}</strong><span>{completedSteps} / {steps.length}</span></div>
          <progress className="ude-progress" max={steps.length} value={completedSteps} aria-label="Demo processing progress"/>
          <ol className="ude-steps">{steps.map((step, index) => <li key={step.title} className={index < completedSteps ? "complete" : index === completedSteps ? "active" : "queued"}><span className="ude-step-number">{index < completedSteps ? <Tick/> : String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><p>{step.detail}</p><small>{index < completedSteps ? "Complete" : index === completedSteps ? "In progress" : "Queued"}</small></div></li>)}</ol>
          <p className="ude-process-live" role="status" aria-live="polite">{finished ? `${attentionCount} renewal reviews, 2 leasing cases, and 1 overdue rent balance. ${draftCount} proposal is ready for a drafting handoff.` : steps[completedSteps].title + "…"}</p>
        </section><aside className="ude-mock-board" aria-label="Mock portfolio task preview"><div className="ude-board-heading"><span>REVIEW QUEUE</span><span>Sample tasks</span></div><h2>Ready for a human decision.</h2>
          <article className="ude-board-card"><div><span className="ude-priority">Due in {hero.daysUntilRenewal} days</span><span>Unit 04</span></div><h3>Review the renewal proposal</h3><p>{money(hero.unit.baseRent)} → {money(hero.requestedRent)} per month</p><footer><span className="ude-assignee">AM</span><span>Alex Morgan</span><span>Draft review</span></footer></article>
          <article className="ude-board-card secondary"><div><span className="ude-evidence-badge">Needs evidence</span><span>Unit 12</span></div><h3>Review the overdue rent balance</h3><p>$1,350 remains after a partial payment. Check the ledger and resident email.</p><footer><span className="ude-assignee">AM</span><span>Alex Morgan</span><span>Follow-up</span></footer></article>
          <p className="ude-board-note">This initial scan uses sample records. The Ambiguous AI drafting simulation starts after you review and save a unit’s evidence.</p>
        </aside></div>
        <footer className="ude-process-footer"><p>Simulation only · seeded records · no mailbox connection</p><div>{!finished && <button className="ude-text-button" onClick={() => setCompletedSteps(steps.length)}>Skip animation</button>}<button className="ude-primary" disabled={!finished} onClick={finish}>Show my review desk <Arrow/></button></div></footer>
      </section>
      <button className="ude-text-button ude-back" onClick={restart}>← Use a different demo email</button>
    </main>}
    <footer className="ude-page-footer"><span>UN · Thoughtful property operations.</span><span>Fictional portfolio. Internal drafts. Your review comes first.</span></footer>
  </div>;
}
