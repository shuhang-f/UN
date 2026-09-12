"use client";

import { useState } from "react";
import { reviewOperations, type UnOperationalReview } from "@/lib/un-operations";
import "./un-operations-board.css";

type Filter = "all" | "leasing" | "late";
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const labels: Record<UnOperationalReview["status"], string> = {
  "ready-to-list": "Leasing preparation",
  "turnover-needed": "Turnover first",
  "late-rent": "Balance to review",
  "payment-pending": "Payment processing",
  "needs-evidence": "Needs evidence",
  upcoming: "Not past due",
  settled: "Reconciled",
};

function OpsIcon({ kind }: { kind: "leasing" | "rent" }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "leasing" ? <><path d="M4 21V5l8-2v18M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2"/></> : <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h3m-3 4h3m3-3 2 2 3-4"/></>}
  </svg>;
}

export function UNOperationsBoard({ asOf }: { asOf: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const reviews = reviewOperations(asOf);
  const leasing = reviews.filter((item) => item.category === "leasing" && item.vacancyConfirmed);
  const late = reviews.filter((item) => item.status === "late-rent");
  const pending = reviews.filter((item) => item.status === "payment-pending");
  const visible = filter === "leasing" ? leasing : filter === "late" ? late : reviews;
  const count = { all: reviews.length, leasing: leasing.length, late: late.length };

  return <section className="un-ops" aria-labelledby="un-ops-heading">
    <header className="un-ops-heading">
      <div><p className="un-ops-kicker">BEYOND THE RENEWAL</p><h2 id="un-ops-heading">Keep the rest of the property moving.</h2><p>{reviews.length} operational reviews, shown separately from the lease review queue. Sample records as of {date(asOf)}.</p></div>
      <span className="un-ops-demo">Fictional operations data</span>
    </header>

    <div className="un-ops-stats" aria-label="Operational attention totals">
      <div><span>Confirmed vacant</span><strong>{leasing.length}<small>units for leasing preparation</small></strong><p>Includes turnover work still to finish</p></div>
      <div><span>Late rent to reconcile</span><strong>{money(late.reduce((total, item) => total + item.balance, 0))}<small>across {late.length} account{late.length === 1 ? "" : "s"}</small></strong><p>Posted charge minus settled payments</p></div>
      <div><span>Payment processing</span><strong>{money(pending.reduce((total, item) => total + item.pending, 0))}<small>pending, separate from settled funds</small></strong><p>Confirm settlement before another request</p></div>
    </div>

    <div className="un-ops-toolbar"><div className="un-ops-filters" aria-label="Filter operational reviews">{([
      ["all", "All"], ["leasing", "Needs leasing"], ["late", "Late rent"],
    ] as [Filter, string][]).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}<span>{count[value]}</span></button>)}</div><span>Pending payments have their own status in All.</span></div>

    {visible.length === 0 ? <div className="un-ops-empty"><h3>No matching operational reviews.</h3><p>{filter === "leasing" ? "No dated possession evidence confirms a vacant unit on this simulation date." : "No unmatched late-rent balance is recorded on this simulation date. Pending transfers remain separate."}</p><button type="button" onClick={() => setFilter("all")}>View all operational records</button></div> : <div className="un-ops-grid">{visible.map((review) => <article className={`un-ops-card ${review.status}`} key={review.id}>
      <header className="un-ops-card-top"><span className="un-ops-unit"><OpsIcon kind={review.category}/>Unit {review.unitNumber}</span><span className={`un-ops-status ${review.status}`}>{labels[review.status]}</span></header>
      <p className="un-ops-property">{review.propertyName}</p><h3>{review.title}</h3><p className="un-ops-summary">{review.summary}</p>
      {review.category === "leasing" ? <div className="un-ops-possession"><span>{review.vacancyConfirmed ? "Possession confirmed" : "Occupancy unresolved"}</span><strong>{review.daysVacant === null ? "Evidence needed" : `${review.daysVacant} days vacant`}</strong></div> : <>
        {review.rentPeriod && <p className="un-ops-period">{review.rentPeriod} · Due {date(review.dueDate!)}{review.daysLate > 0 ? ` · ${review.daysLate} days after due date` : ""}</p>}
        <dl className="un-ops-money"><div><dt>Settled</dt><dd>{money(review.settled)}</dd></div><div><dt>Posted balance</dt><dd>{money(review.balance)}</dd></div><div><dt>Pending</dt><dd>{money(review.pending)}</dd></div></dl>
      </>}
      <div className="un-ops-next"><h4>Suggested next steps</h4><ol>{review.tasks.map((task) => <li key={task.title}><strong>{task.title}</strong><p>{task.detail}</p><span>{task.owner}</span></li>)}</ol></div>
      <details className="un-ops-evidence"><summary>View {review.evidence.length} source record{review.evidence.length === 1 ? "" : "s"}<span>Evidence available by {date(asOf)}</span></summary>{review.evidence.length === 0 && <p>No dated source records are available yet.</p>}{review.evidence.map((evidence) => <article key={evidence.id}><header><span>{evidence.kind === "database" ? "Mock database" : evidence.kind}</span><time dateTime={evidence.date}>{date(evidence.date)}</time></header><h4>{evidence.title}</h4><p>{evidence.body}</p><code>{evidence.id}</code></article>)}</details>
    </article>)}</div>}
    <footer className="un-ops-footer">Two additional fictional units, 05 and 17, join the existing 12 and 21 for this operations view. Lease expiry alone never marks a unit vacant. No listings or messages are published or sent.</footer>
  </section>;
}
