"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PropertyAssistant } from "@/components/property-assistant";
import { sampleMessages, sampleProfile } from "@/lib/property-samples";
import { toolCatalog } from "@/lib/property-catalog";
import type { AssessmentInput, EvidenceMessage, Finding, Profile, Report } from "@/lib/property-types";
import type { PropertyPlan, PropertyPlansResponse } from "@/lib/property-plan-types";

type View = "intake" | "recommendations" | "tools" | "saved";
type IconName = "leaf" | "home" | "spark" | "mail" | "check" | "arrow" | "tools" | "file" | "link" | "close" | "settings" | "lock";
type Integrations = { modelConfigured: boolean; exaConfigured: boolean; ambiguousConfigured: boolean };
type ResearchSource = { title: string; url: string; highlights?: string[] };
const propertyTools = toolCatalog.filter((tool) => ["happyco", "entrata", "funnel", "property-meld", "appfolio"].includes(tool.id));
const categories: Record<string, string> = { "make-ready": "Apartment readiness", leasing: "Leasing follow-up", maintenance: "Resident maintenance", "rent-control": "Rent-control review" };
const blankProfile: Profile = { name: "", email: "", company: "", website: "", role: "Property manager", units: "", system: "Not sure", focus: "both", context: "" };
const viewNames: Record<View, string> = { intake: "Your workspace", recommendations: "Recommendations", tools: "Explore tools", saved: "Saved workflows" };

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    leaf: <><path d="M20 3C11 2 3 8 6 15s14 3 14-12Z" /><path d="m4 21 12-12" /></>,
    home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    tools: <><path d="m15 5 4 4m-6 4 7 7M4 20l8-8M4 4l5 1 1 4-3 1-3-2Z" /><path d="M16 3a5 5 0 0 0-5 7l3 3a5 5 0 0 0 7-5l-4 2-3-3Z" /></>,
    file: <><path d="M5 3h10l4 4v14H5Z" /><path d="M14 3v5h5M8 12h8m-8 4h6" /></>,
    link: <><path d="M13 4h7v7M20 4 10 14" /><path d="M10 5H4v15h15v-6" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Modal({ title, eyebrow = "GROUNDWORK", children, onClose, wide = false, locked = false }: {
  title: string; eyebrow?: string; children: ReactNode; onClose(): void; wide?: boolean; locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className={`modal${wide ? " modal-wide" : ""}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }}>
    <div className="modal-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" disabled={locked} onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || "This action could not finish. Please try again.");
  return data as T;
}
// A single bootstrap request prevents Strict Mode's duplicate effects from creating competing cookies.
let plansBootstrap: Promise<PropertyPlansResponse> | undefined;
function loadPlans() {
  return plansBootstrap ??= fetch("/api/plans", { cache: "no-store" }).then(jsonResponse<PropertyPlansResponse>).finally(() => { plansBootstrap = undefined; });
}

export default function Operations() {
  const [view, setView] = useState<View>("intake");
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [messages, setMessages] = useState<EvidenceMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [assessedInput, setAssessedInput] = useState<AssessmentInput | null>(null);
  const [review, setReview] = useState<Finding | null>(null);
  const [plans, setPlans] = useState<PropertyPlan[]>([]);
  const [plansReady, setPlansReady] = useState(false);
  const [integrations, setIntegrations] = useState<Integrations>({ modelConfigured: false, exaConfigured: false, ambiguousConfigured: false });
  const [assessing, setAssessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);
  const [researchMessage, setResearchMessage] = useState("");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailDraft, setMailDraft] = useState({ from: "", subject: "", body: "" });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [aiConsented, setAiConsented] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const revision = useRef(0);
  const saveInFlight = useRef(false);
  const busy = assessing || saving || researching;

  useEffect(() => {
    let active = true;
    fetch("/api/integrations", { cache: "no-store" }).then(jsonResponse<Integrations>).then((data) => { if (active) setIntegrations(data); }).catch(() => {});
    loadPlans().then((data) => {
      if (!active) return;
      setPlans(data.plans); setPlansReady(true);
      setIntegrations((current) => ({ ...current, ambiguousConfigured: data.ambiguousConfigured }));
    }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [view]);

  function invalidate() {
    revision.current++; setReport(null); setAssessedInput(null); setReview(null); setAiConsented(false); setAssistantOpen(false); setNotice("");
  }
  function updateProfile(key: keyof Profile, value: string) {
    invalidate(); setProfile((current) => ({ ...current, [key]: value }));
    if (key === "website") { setResearchSources([]); setResearchMessage(""); }
  }
  function loadSample() {
    if (busy) return;
    invalidate(); setProfile({ ...sampleProfile, focus: "both" }); setMessages(sampleMessages.map((message) => ({ ...message }))); setSelectedIds(sampleMessages.map((message) => message.id));
    setResearchSources([]); setResearchMessage(""); setError(""); setView("intake"); setNotice("Sample workspace loaded. The company and all three messages are fictional.");
  }
  function selectMessage(id: string, checked: boolean) {
    invalidate(); setSelectedIds((current) => checked ? [...current, id] : current.filter((value) => value !== id));
  }
  function addMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!mailDraft.body.trim() || messages.length >= 30) return;
    const message: EvidenceMessage = { ...mailDraft, id: crypto.randomUUID(), source: "pasted", from: mailDraft.from.trim() || "Selected correspondence", subject: mailDraft.subject.trim() || "User-supplied message", body: mailDraft.body.trim() };
    invalidate(); setMessages((current) => [...current, message]); setSelectedIds((current) => [...current, message.id]); setMailDraft({ from: "", subject: "", body: "" }); setMailOpen(false);
  }
  async function assess(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const input: AssessmentInput = { profile: { ...profile }, messages: messages.filter((message) => selectedIds.includes(message.id)).map((message) => ({ ...message })) };
    const payload = JSON.stringify(input);
    if (new TextEncoder().encode(payload).byteLength > 100_000) { setError("The selected context is too large. Deselect or shorten some messages."); return; }
    const currentRevision = revision.current;
    setAssessing(true); setError(""); setReview(null); setAiConsented(false); setAssistantOpen(false);
    try {
      const data = await fetch("/api/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }).then(jsonResponse<{ report: Report }>);
      if (currentRevision !== revision.current) return;
      // This workspace focuses on the three property-operation categories; the homepage handles rent-control review.
      setReport({ ...data.report, findings: data.report.findings.filter((finding) => finding.category !== "rent-control") });
      setAssessedInput(input); setView("recommendations"); setNotice("");
    } catch (reason) { if (currentRevision === revision.current) setError(reason instanceof Error ? reason.message : "Assessment failed. Please retry."); }
    finally { setAssessing(false); }
  }
  async function researchCompany() {
    if (busy || !profile.website.trim()) return;
    setResearching(true); setError(""); setResearchSources([]); setResearchMessage("");
    try {
      const data = await fetch("/api/company-research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website: profile.website.trim(), confirmed: true }) }).then(jsonResponse<{ sources: ResearchSource[]; message?: string }>);
      setResearchSources(data.sources); setResearchMessage(data.message || "Public sources only. Review them and add any relevant facts to your description.");
    } catch (reason) { setResearchMessage(reason instanceof Error ? reason.message : "Research is unavailable. Continue with your company details."); }
    finally { setResearching(false); }
  }
  async function save(destination: "local" | "ambiguous") {
    if (!review || !plansReady || saveInFlight.current) return;
    saveInFlight.current = true; setSaving(true); setError("");
    const approved = { title: review.title.trim(), category: review.category, steps: review.steps.map((step) => ({ title: step.title.trim(), owner: step.owner.trim(), details: step.details.trim() })), toolIds: review.toolIds.filter((id) => propertyTools.some((tool) => tool.id === id)), destination, approved: true };
    try {
      const data = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(approved) }).then(jsonResponse<{ plan: PropertyPlan }>);
      setPlans((current) => [data.plan, ...current.filter((plan) => plan.id !== data.plan.id)]); setReview(null); setView("saved");
      setNotice(destination === "local" ? "Workflow saved locally. It will remain after a reload in this browser session." : "Planning task saved to Ambiguous and verified by readback.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Save failed. Please retry the same workflow."); }
    finally { saveInFlight.current = false; setSaving(false); }
  }
  async function refreshPlans() {
    setError("");
    try { const data = await loadPlans(); setPlans(data.plans); setPlansReady(true); setIntegrations((current) => ({ ...current, ambiguousConfigured: data.ambiguousConfigured })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load saved workflows."); }
  }
  function openReview(finding: Finding) {
    if (busy) return;
    setAssistantOpen(false); setError(""); setReview({ ...finding, steps: finding.steps.map((step) => ({ ...step })), toolIds: [...finding.toolIds] });
  }
  function editStep(index: number, key: "title" | "owner" | "details", value: string) {
    setReview((current) => current ? { ...current, steps: current.steps.map((step, i) => i === index ? { ...step, [key]: value } : step) } : null);
  }
  const profileField = (key: "name" | "email" | "company" | "role" | "units" | "system", label: string, maxLength: number, placeholder: string, type = "text") =>
    <label>{label}<input type={type} value={profile[key]} maxLength={maxLength} placeholder={placeholder} onChange={(event) => updateProfile(key, event.target.value)} /></label>;

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="/operations"><span className="brand-mark"><Icon name="leaf" size={29} /></span>UN<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR WORKSPACE</div><div className="workspace-name"><span className="workspace-icon"><Icon name="home" /></span><div>{profile.company || "Property operations"}<small>Vacancy & maintenance</small></div></div>
      <nav aria-label="Workspace navigation">{(["intake", "recommendations", "tools", "saved"] as View[]).map((item) => <button key={item} type="button" className={`nav-item${view === item ? " active" : ""}`} onClick={() => setView(item)} aria-current={view === item ? "page" : undefined}><Icon name={item === "intake" ? "home" : item === "recommendations" ? "spark" : item === "tools" ? "tools" : "file"} /><span>{viewNames[item]}</span>{item === "saved" && plans.length > 0 && <span className="nav-count">{plans.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="little-spark"><Icon name="spark" /></span><p>Better days start<br />with a clearer plan.</p><small>Practical workflows.<br />Tools that fit your team.</small></div><button className="nav-item" type="button" onClick={() => setConnectionsOpen(true)}><Icon name="settings" /><span>Connections</span><span className="status-dot" /></button><div className="user-row"><span className="avatar">{profile.name.trim() ? profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("") : "PM"}</span><div>{profile.name || "Your workspace"}<small>{profile.role || "Property manager"}</small></div></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span><strong>{viewNames[view]}</strong></div><div className="topbar-right"><span className="mode-badge"><span /> Guided assessment</span><button type="button" className="icon-button" aria-label="View connections" onClick={() => setConnectionsOpen(true)}><Icon name="settings" /></button></div></header>
      <main>
        {error && !review && <div className="banner error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError("")}><Icon name="close" size={15} /></button></div>}
        {notice && <div className="banner success" role="status"><Icon name="check" />{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><Icon name="close" size={15} /></button></div>}
        {view === "intake" && <>
          <div className="page-heading"><div><span className="eyebrow">A LITTLE CONTEXT GOES A LONG WAY</span><h1>Your properties.<br /><em>A clearer next step.</em></h1><p>Tell us about your team and the work that slows it down.<br className="desktop-break" /> We'll connect the context to practical workflows and useful tools.</p></div><button type="button" className="button secondary sample-button" disabled={busy} onClick={loadSample}><Icon name="spark" size={16} />Try a sample portfolio<Icon name="arrow" size={15} /></button></div>
          <div className="journey-strip"><span className="journey-active"><b>1</b>Your context</span><i /><span><b>2</b>Workflow recommendations</span><i /><span><b>3</b>Review & save</span></div>
          <div className="intake-grid"><form className="panel profile-panel" onSubmit={assess}><fieldset disabled={busy}><div className="section-heading"><span className="section-icon"><Icon name="home" size={20} /></span><div><h2>Let's get to know your business</h2><p>A starting point for recommendations that fit.</p></div><span className="subtle-tag">YOUR CONTEXT</span></div>
            <div className="form-grid">{profileField("name", "Your name", 160, "Alex Morgan")}{profileField("email", "Work email", 254, "alex@company.com", "email")}{profileField("company", "Company", 200, "Your property management company")}{profileField("role", "Your role", 160, "Community manager")}{profileField("units", "Units managed", 80, "e.g. 1,200")}{profileField("system", "Current property software", 160, "e.g. AppFolio, Entrata, spreadsheets")}</div>
            <div className="field-block"><span className="field-label" id="focus-label">Where would you like to focus?</span><div className="focus-options" role="radiogroup" aria-labelledby="focus-label">{([{ value: "vacancy", label: "Vacancy & leasing", icon: "home" }, { value: "maintenance", label: "Maintenance", icon: "tools" }, { value: "both", label: "A bit of both", icon: "spark" }] as const).map((option) => <label key={option.value} className={`focus-option${profile.focus === option.value ? " chosen" : ""}`}><input type="radio" name="focus" value={option.value} checked={profile.focus === option.value} onChange={() => updateProfile("focus", option.value)} /><Icon name={option.icon} size={15} /><span>{option.label}</span></label>)}</div></div>
            <label className="field-block">What is taking up too much of your team's time?<textarea rows={3} maxLength={6000} value={profile.context} placeholder="Tell us about one recurring task, a handoff that gets stuck, or a process you'd like to improve…" onChange={(event) => updateProfile("context", event.target.value)} /></label>
            <details className="research-details"><summary>Add public company context <span>Optional</span></summary><p>Confirm your company's public website. Clicking Search public website shares only its domain with Exa, when configured. It does not read your inbox or add findings automatically.</p><label>Company website<div className="input-action"><input type="url" maxLength={500} value={profile.website} placeholder="https://yourcompany.com" onChange={(event) => updateProfile("website", event.target.value)} /><button type="button" className="button secondary" disabled={!profile.website.trim() || !integrations.exaConfigured} onClick={researchCompany}>{researching ? "Searching…" : "Search public website"}</button></div></label>{!integrations.exaConfigured && <p>Public research is available after Exa is configured. You can continue with your own details.</p>}{researchMessage && <p role="status">{researchMessage}</p>}<div className="research-results">{researchSources.map((source) => <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<Icon name="link" size={13} /></a>{source.highlights?.map((highlight, index) => <p key={index}>{highlight}</p>)}</div>)}</div></details>
            <div className="form-footer"><p><Icon name="lock" size={12} />Only the context you choose.</p><button type="submit" className="button primary">{assessing ? "Reviewing context…" : "Find workflow improvements"}<Icon name="arrow" size={15} /></button></div>
          </fieldset></form>
          <div className="context-column"><section className="panel inbox-panel"><div className="section-heading"><span className="section-icon peach"><Icon name="mail" size={20} /></span><div><h2>Bring a little real-world context</h2><p>Selected correspondence, on your terms.</p></div></div><span className="optional-pill">OPTIONAL</span><p className="context-intro">Your team's messages can show where a workflow needs attention.</p><p className="muted">Add a few relevant excerpts. Choose which messages to include before running your assessment.</p><button type="button" className="button secondary full" disabled={busy || messages.length >= 30} onClick={() => setMailOpen(true)}><Icon name="mail" size={15} />Add selected messages</button><button type="button" className="text-button sample-mail" disabled={busy} onClick={loadSample}>Or explore with fictional sample messages <Icon name="arrow" size={13} /></button>
            {messages.length > 0 && <div className="message-list"><div className="list-label">{selectedIds.length} OF {messages.length} MESSAGES SELECTED</div>{messages.map((message) => <div className="message-item" key={message.id}><div className="message-top"><input type="checkbox" aria-label={`Include ${message.subject}`} checked={selectedIds.includes(message.id)} disabled={busy} onChange={(event) => selectMessage(message.id, event.target.checked)} /><span className={`source-label ${message.source}`}>{message.source === "sample" ? "Fictional sample" : "Pasted by you"}</span><button type="button" className="remove-message" aria-label={`Remove ${message.subject}`} disabled={busy} onClick={() => { invalidate(); setMessages((current) => current.filter((item) => item.id !== message.id)); setSelectedIds((current) => current.filter((id) => id !== message.id)); }}><Icon name="close" size={13} /></button></div><details><summary>{message.subject}</summary><p className="message-from">{message.from}</p><p className="message-body">{message.body}</p></details></div>)}</div>}
            <div className="privacy-note"><Icon name="lock" size={13} /><p>No inbox is connected. Your email address does not grant mailbox access. Only selected messages enter the guided assessment.</p></div></section><div className="what-you-get"><span className="eyebrow">WHAT YOU'LL LEAVE WITH</span>{["A workflow tied to your context", "Clear steps and responsible roles", "Existing tools worth exploring"].map((text) => <div key={text}><span><Icon name="check" size={11} /></span>{text}</div>)}</div></div></div>
          <p className="page-footnote"><Icon name="spark" size={12} />Guided topic rules and a curated catalog. Your team confirms the facts before acting.</p>
        </>}

        {view === "recommendations" && <><div className="page-heading compact"><div><span className="eyebrow">FROM CONTEXT TO A CLEARER PROCESS</span><h1>Small changes.<br /><em>Better handoffs.</em></h1><p>Start with the workflow your team can examine together.</p></div><button className="button secondary" type="button" onClick={() => setView("intake")}>Edit your context</button></div>
          {!report ? <div className="panel empty-state"><span className="empty-icon"><Icon name="spark" size={29} /></span><h2>A little context comes first.</h2><p>Add your team's details or try a fictional sample to see workflow candidates.</p><button className="button primary" type="button" onClick={() => setView("intake")}>Add your context<Icon name="arrow" size={15} /></button></div> : <>
            <section className="report-summary"><span className="summary-icon"><Icon name="spark" size={25} /></span><div><h2>A starting point for your team</h2><p>{report.summary}</p><div className="summary-tags"><span>{assessedInput?.messages.length || 0} selected messages</span><span>{report.findings.length} workflow {report.findings.length === 1 ? "candidate" : "candidates"}</span><span>Guided assessment</span></div></div></section>
            <div className="section-title"><h2>Workflows to explore</h2><span className="small muted">Review the evidence. Confirm what happens next.</span></div><div className="finding-list">{report.findings.map((finding) => <article className="panel finding-card" key={finding.id}><span className={`finding-symbol symbol-${finding.category}`}><Icon name={finding.category === "maintenance" ? "tools" : finding.category === "leasing" ? "mail" : "home"} size={27} /></span><div className="finding-content"><div className="finding-label"><span>{categories[finding.category]}</span><span className="evidence-count">{finding.evidence.length ? `${finding.evidence.length} supporting excerpt${finding.evidence.length > 1 ? "s" : ""}` : "Needs supporting evidence"}</span></div><h2>{finding.title}</h2><p>{finding.summary}</p>{finding.evidence.map((evidence, index) => <blockquote key={`${evidence.messageId}-${index}`}>{evidence.quote}<cite>{assessedInput?.messages.find((message) => message.id === evidence.messageId)?.source === "sample" ? "Fictional sample" : "Selected message"} · {assessedInput?.messages.find((message) => message.id === evidence.messageId)?.from || "Your selected context"}</cite></blockquote>)}<div className="finding-bottom"><div className="recommended-tools"><span>EXPLORE</span>{finding.toolIds.map((id) => propertyTools.find((tool) => tool.id === id)).filter((tool) => !!tool).map((tool) => <a key={tool.id} className="tool-chip" href={tool.url} target="_blank" rel="noreferrer">{tool.name}</a>)}</div><button type="button" className="button secondary" disabled={busy} onClick={() => openReview(finding)}>Review workflow<Icon name="arrow" size={14} /></button></div></div></article>)}</div>
            <div className="below-findings"><section className="panel unknowns"><span className="eyebrow">KEEP THE UNKNOWNS VISIBLE</span><h2>What still needs confirmation</h2><ul>{report.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></section><section className="assistant-invite"><Icon name="spark" size={24} /><h2>Think it through, together.</h2><p>Discuss the evidence and refine your next step with an assistant that can see this assessment.</p><button className="button secondary" type="button" onClick={() => setAssistantOpen(true)}>{integrations.modelConfigured ? "Open assistant" : "About the assistant"}<Icon name="arrow" size={14} /></button><small>Sharing selected context requires your confirmation.</small></section></div>
          </>}
        </>}

        {view === "tools" && <><div className="page-heading compact"><div><span className="eyebrow">BUILD ON WHAT ALREADY WORKS</span><h1>Good tools.<br /><em>A better fit.</em></h1><p>Explore five existing products for vacancy, leasing, and maintenance.</p></div></div><div className="catalog-note"><Icon name="tools" size={23} /><p>These are product recommendations and public tours. No property system is connected to this app.</p></div><div className="tool-grid">{propertyTools.map((tool, index) => <article className="panel tool-card" key={tool.id}><div className="tool-card-head"><span className={`tool-logo tool-logo-${index}`}>{tool.name[0]}</span><a href={tool.url} target="_blank" rel="noreferrer" aria-label={`Open ${tool.name} product page`}><Icon name="link" size={17} /></a></div><span className="eyebrow">{tool.category}</span><h2>{tool.name}</h2><p>{tool.description}</p><div className="tool-fit"><strong>WHEN TO EXPLORE IT</strong><p>{tool.fit}</p></div><details className="tool-setup"><summary>Access & setup</summary><p>{tool.setup}</p></details><a className="button secondary" href={tool.tourUrl} target="_blank" rel="noreferrer">Explore product / tour<Icon name="link" size={14} /></a></article>)}</div><p className="page-footnote">Some tours are scripted; some links require a sales-demo request. Confirm availability with each vendor.</p></>}

        {view === "saved" && <><div className="page-heading compact"><div><span className="eyebrow">READY FOR YOUR TEAM TO REVIEW</span><h1>A place for<br /><em>your next steps.</em></h1><p>Approved planning workflows, saved for this browser session.</p></div><button type="button" className="button secondary" disabled={saving} onClick={refreshPlans}>Refresh saved plans</button></div>
          {!plansReady ? <div className="panel empty-state"><h2>Loading saved workflows</h2><p>If loading failed, use Refresh saved plans to start the local session again.</p></div> : !plans.length ? <div className="panel empty-state"><span className="empty-icon"><Icon name="file" size={29} /></span><h2>Your next plan starts here.</h2><p>Review a workflow and approve its save to keep it after a reload.</p><button className="button primary" type="button" onClick={() => setView(report ? "recommendations" : "intake")}>Explore workflows<Icon name="arrow" size={15} /></button></div> : <div className="saved-list">{plans.map((plan) => <article className="panel saved-card" key={plan.id}><div className="saved-header"><span className="saved-check"><Icon name="check" size={19} /></span><div><span className="eyebrow">{categories[plan.category] || plan.category}</span><h2>{plan.title}</h2></div><span className="saved-badge">{plan.destination === "local" ? "Saved locally" : "Saved to Ambiguous"}</span></div><details><summary>View workflow steps</summary><ol className="saved-steps">{plan.steps.map((step, index) => <li key={index}><strong>{step.title}</strong><span className="owner">{step.owner}</span><p>{step.details}</p></li>)}</ol></details><div className="saved-meta"><span>{new Date(plan.createdAt).toLocaleDateString()}</span><span>Plan ID: <code>{plan.id}</code></span>{plan.externalTask && <span>Ambiguous ID: <code>{plan.externalTask.id}</code></span>}{plan.externalTask?.url && <a href={plan.externalTask.url} target="_blank" rel="noreferrer">Open saved task<Icon name="link" size={13} /></a>}</div></article>)}</div>}
          <p className="page-footnote"><Icon name="lock" size={12} />Local records are tied to this browser cookie. Ambiguous entries show the last confirmed save; no workflow steps have been executed.</p>
        </>}
      </main>
    </div>

    {mailOpen && <Modal title="Add selected correspondence" eyebrow="CONTEXT YOU CHOOSE" onClose={() => setMailOpen(false)}><p className="muted">Paste one relevant message. Remove unnecessary personal details. This does not connect or read your mailbox.</p><form onSubmit={addMessage}><label>Sender or team role<input maxLength={254} value={mailDraft.from} onChange={(event) => setMailDraft((current) => ({ ...current, from: event.target.value }))} placeholder="Maintenance supervisor" /></label><label className="field-block">Subject<input maxLength={500} value={mailDraft.subject} onChange={(event) => setMailDraft((current) => ({ ...current, subject: event.target.value }))} /></label><label className="field-block">Message excerpt<textarea required rows={7} maxLength={8000} value={mailDraft.body} onChange={(event) => setMailDraft((current) => ({ ...current, body: event.target.value }))} /></label><div className="modal-footer"><button className="button secondary" type="button" onClick={() => setMailOpen(false)}>Cancel</button><button className="button primary" type="submit" disabled={!mailDraft.body.trim() || messages.length >= 30}>Add message</button></div></form></Modal>}

    {review && <Modal title="Make this workflow yours" eyebrow="REVIEW BEFORE SAVING" wide locked={saving} onClose={() => setReview(null)}><form onSubmit={(event) => { event.preventDefault(); void save("local"); }}><fieldset disabled={saving}><span className="category-pill">{categories[review.category]}</span><label className="field-block">Workflow title<input required maxLength={200} value={review.title} onChange={(event) => setReview((current) => current ? { ...current, title: event.target.value } : null)} /></label><details className="review-evidence"><summary>Evidence & discovery question</summary>{review.evidence.map((evidence, index) => <blockquote key={index}>{evidence.quote}<cite>{assessedInput?.messages.find((message) => message.id === evidence.messageId)?.subject || evidence.messageId}</cite><p className="message-body">{assessedInput?.messages.find((message) => message.id === evidence.messageId)?.body}</p></blockquote>)}<p>{review.question}</p></details><ol className="review-steps">{review.steps.map((step, index) => <li key={index}><span className="step-number">{index + 1}</span><div><label>Step {index + 1}<input required maxLength={200} value={step.title} onChange={(event) => editStep(index, "title", event.target.value)} /></label><label className="step-owner">Responsible role<input required maxLength={150} value={step.owner} onChange={(event) => editStep(index, "owner", event.target.value)} /></label><label>Details<textarea required rows={3} maxLength={2000} value={step.details} onChange={(event) => editStep(index, "details", event.target.value)} /></label></div></li>)}</ol><div className="review-tool-links"><span className="eyebrow">TOOLS TO EXPLORE</span>{review.toolIds.map((id) => propertyTools.find((tool) => tool.id === id)).filter((tool) => !!tool).map((tool) => <a key={tool.id} href={tool.tourUrl} target="_blank" rel="noreferrer">{tool.name}<Icon name="link" size={12} /></a>)}</div><div className="confirm-note"><strong>You're saving a plan, not executing it.</strong><p>Saving does not send messages, dispatch vendors, book tours, authorize spending, or update property records. Only this reviewed title and these steps are saved.</p></div></fieldset>{error && <div className="banner error" role="alert">{error}</div>}{!plansReady && <p className="small">A browser session is needed before saving. <button type="button" className="text-button" onClick={refreshPlans}>Retry loading saved plans</button></p>}<div className="modal-footer"><button type="button" className="button secondary" disabled={saving} onClick={() => setReview(null)}>Cancel</button>{integrations.ambiguousConfigured && <button type="button" className="button secondary" disabled={saving || !plansReady || !review.title.trim() || review.steps.some((step) => !step.title.trim() || !step.owner.trim() || !step.details.trim())} onClick={() => save("ambiguous")}>Approve & save to Ambiguous</button>}<button type="submit" className="button primary" disabled={saving || !plansReady || !review.title.trim() || review.steps.some((step) => !step.title.trim() || !step.owner.trim() || !step.details.trim())}>{saving ? "Saving…" : "Approve & save locally"}</button></div></form></Modal>}

    {connectionsOpen && <Modal title="Your connections" eyebrow="KNOW WHAT'S CONNECTED" onClose={() => setConnectionsOpen(false)}><p className="muted">The guided assessment and local saves work without provider keys.</p>{[
      { name: "Guided assessment & local plans", status: plansReady ? "Ready" : "Loading", ready: plansReady, description: "Topic rules and reviewed workflows saved on this app's local disk." },
      { name: "AI assistant", status: integrations.modelConfigured ? "Configured" : "Not configured", ready: integrations.modelConfigured, description: "Uses the configured model after you choose to share assessment context. Configuration does not verify live account access." },
      { name: "Exa public research", status: integrations.exaConfigured ? "Configured" : "Not configured", ready: integrations.exaConfigured, description: "Search a company domain only after the explicit website action. It does not read private messages." },
      { name: "Ambiguous planning tasks", status: integrations.ambiguousConfigured ? "Configured" : "Not configured", ready: integrations.ambiguousConfigured, description: "Optional provider save after review. Real identity and task readback are checked when saving." },
      { name: "Gmail / Outlook", status: "Not connected", ready: false, description: "Direct inbox access is not implemented. Add only the selected correspondence you want assessed." },
    ].map((connection) => <div className="connection" key={connection.name}><span className="section-icon"><Icon name="link" /></span><div><strong>{connection.name}</strong><p>{connection.description}</p></div><span className={`connection-status${connection.ready ? " ready" : ""}`}>{connection.status}</span></div>)}<p className="small muted">Ask your workspace administrator to enable optional connections when you need them.</p><div className="modal-footer"><button type="button" className="button primary" onClick={() => setConnectionsOpen(false)}>Done</button></div></Modal>}

    {assistantOpen && report && assessedInput && <Modal title="Think through your next step" eyebrow="YOUR WORKFLOW ASSISTANT" wide onClose={() => setAssistantOpen(false)}>{!integrations.modelConfigured ? <div className="assistant-setup"><Icon name="spark" size={30} /><h3>The guided flow is ready to use.</h3><p>Configure a model provider on the server to enable the optional assistant. You can still review workflows, explore tools, and save plans locally.</p><button type="button" className="button primary" onClick={() => setAssistantOpen(false)}>Continue with guided workflows</button></div> : !aiConsented ? <div className="assistant-setup"><Icon name="lock" size={28} /><h3>Choose what you share.</h3><p>Opening the assistant shares this assessment, your selected business context, and {assessedInput.messages.length} selected message{assessedInput.messages.length === 1 ? "" : "s"} with the configured model provider. Name and email profile fields are excluded; pasted messages may contain contact details.</p><p>The assistant can explain recommendations and open a workflow for review. Only your page approval can save it.</p><button type="button" className="button primary" onClick={() => setAiConsented(true)}>Share selected context & open assistant</button></div> : <PropertyAssistant input={assessedInput} report={report} onReview={(id) => { const finding = report.findings.find((item) => item.id === id); if (finding) openReview(finding); }} />}</Modal>}
  </div>;
}
