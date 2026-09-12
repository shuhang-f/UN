# UN: property manager's daily review desk

UN prepares approaching lease reviews from a fictional Los Angeles portfolio. It compares dated lease, ledger, correspondence and registration records, separates the manager's pricing instruction from the demo's reviewed rule, and produces either an internal notice draft or a specific follow-up. The complete review can be saved locally and exported as JSON.

The core showcase is deterministic and requires no API keys, model account, mailbox, property-management system or external database. The optional assistant can discuss the supplied cases; it is separate from the review calculation and local save workflow.

## Start the demo

Use Node.js 22 or later. From the repository root, install dependencies if needed and start the web app:

```bash
npm ci
npm run dev:web
```

Open [UN](http://127.0.0.1:3100/). The web process binds to loopback. Keep using the same hostname and browser profile when demonstrating saved records: `localhost` and `127.0.0.1` have separate browser cookies.

Enter any valid email-shaped address, or choose **Use a random sample email**, then **Open my demo workspace**. The email is a browser-only demo label; no sign-in, mailbox access, email delivery or account creation happens. All addresses open the same sample portfolio.

The first processing screen is **UN · Evidence review / SIMULATED**. It reads sample document, email and database records, presents the inferred property-manager role, and identifies renewal, leasing and rent-balance work. Choose **Show my review desk** after processing, or **Skip animation**. The separate Ambiguous AI drafting simulation begins only after the manager reviews and saves a unit’s evidence.

The completed walkthrough is remembered in this tab's `sessionStorage` under `un-demo-entry-v1`, so reloads reopen the desk. **Restart demo** returns to email entry. Finishing a new walkthrough restores the sample review preferences while keeping the separate saved-review database intact. If browser storage is unavailable, the flow still works for the current visit.

The initial simulation date is **September 12, 2026**. Preferences start at a **90-day internal review window**, **2% requested increase**, and reviewer **Alex Morgan**. This planning window is not a legal notice period. The fixed rule fixture covers an ordinary LA City RSO adjustment for July 1, 2026–June 30, 2027; the demo does not apply that rate to other periods or jurisdictions.

## Seven sample units

All people, properties, addresses and private records are fictional. The synthetic portfolio is Juniper Court, presented in the Juniper Residential demo workspace.

| Unit | Starting facts | Expected result on September 12, 2026 |
| --- | --- | --- |
| 04 | Lease ends October 12, 2026, exactly 30 days after the simulation date; base rent $2,000; last increase October 13, 2025; sample coverage and registration confirmed. | Internal draft for $2,040 from October 13, 2026 using the manager's 2% instruction. The 3% ordinary ceiling appears separately. |
| 12 | Lease ends November 30; ledger says last increase March 1, 2026; correspondence says December 1, 2025. | Needs evidence. Retain both dates and assign a reconciliation task; no definitive increase draft. |
| 08 | Lease ends December 10; unit-specific RSO coverage is unresolved. | Needs evidence. Request unit-level coverage information instead of assuming a property-level record covers every unit. |
| 09 | Lease ends October 31; the recorded last increase was March 1, 2026. | Timing blocked. The candidate November 1, 2026 date precedes the next 12-month anniversary. |
| 21 | Lease ends August 31, 2027. | Upcoming renewal. A separate $2,600 pending payment needs settlement verification; it is not treated as settled cash. |
| 05 | Confirmed possession and completed turnover. | Vacant and ready for listing preparation. |
| 17 | Confirmed possession, turnover incomplete. | Vacant; finish turnover before marketing as ready. |

The operational ledger also shows Unit 12 with $1,350 remaining after a partial September payment, 11 days after the due date. This is separate from its unresolved renewal evidence. The operations module keeps pending payments separate from confirmed overdue balances and never treats lease expiration alone as proof of vacancy.

## Three-minute showcase

1. Enter any sample email, show the initial document/email/database analysis, then open the desk. The role is an inference from sample records; email is only a browser label.
2. Open Unit 04, whose lease ends in **30 days**. Show **Evidence**, the $2,000 → $2,040 proposal, and the separate ordinary ceiling. Select **Review evidence & continue**, add a note, then **Confirm review & continue**.
3. On **Draft approvals**, inspect the exact saved packet and role inference. Choose **Send to Ambiguous AI · demo**. The simulated steps return an illustrative rent-adjustment letter to this in-app approval desk.
4. Read the returned letter, add an approval note, and choose **Approve draft**. The mock database persists both the returned draft and explicit approval. Reload and reopen **Draft approvals** to demonstrate persistence. Export the letter if useful. No real provider task, email, notice service, or rent update occurs.
5. Open **Leasing & rent**. Unit 05 is ready for listing preparation, Unit 17 needs turnover, and Unit 12 has $1,350 outstanding. Inspect the dated source records and tasks. Unit 21’s pending payment stays a separate settlement-review case.
6. Return to Unit 12’s renewal review to show conflicting increase dates and why a definitive increase draft is held. A follow-up can still be saved.

For another meaningful variation, set the requested increase to 4% and rerun the review: the known 3% ceiling blocks the proposal without silently replacing the manager's instruction. A 0% instruction produces an unchanged-rent follow-up, not an increase draft. Advance the simulation date to June 2, 2027 to bring Unit 21 into its 90-day window; it needs a rule for the new period rather than reusing the expired fixture.

Changing the date is an explicit simulation action. **Run daily review** recalculates the local portfolio; it does not install or demonstrate a background schedule.

## Mock data and local database

The source dataset is [un-demo.ts](../apps/web/src/lib/un-demo.ts). It exports five units, dated fictional evidence, the simulation date and default preferences. [un-review.ts](../apps/web/src/lib/un-review.ts) calculates review states, tasks and illustrative internal drafts. Changing seed evidence, rules or template output produces a new saved version when the case is saved again.

The API is [the UN reviews route](../apps/web/src/app/api/un/reviews/route.ts), backed by [un-reviews.ts](../apps/web/src/lib/server/un-reviews.ts):

- `GET /api/un/reviews` returns `{ records }` and establishes the browser session.
- `POST /api/un/reviews` accepts only the unit ID, simulation date, preferences, reviewer note and explicit `approved: true`. It recomputes the packet from server-side demo data and returns `{ record }`.
- The server stores each full snapshot as a private JSON file below `resolve(".data/un-reviews")`. Under the standard `npm run dev:web` launch this is `apps/web/.data/un-reviews/`. `.data/` is excluded from Git.
- An HttpOnly, SameSite=Strict cookie named `un-review-session` is scoped to `/api/un/reviews` and lasts 30 days. Each session has a separate hashed storage directory. Clearing or expiring the cookie starts a new history; it does not delete the previous files. This is a local demo session, not a shared account system.
- Files are published atomically. Identical normalized inputs and an identical recomputed packet return the existing record ID, including concurrent retries. Changed evidence, rule/template output, date, preferences or reviewer note creates a separate immutable snapshot while preserving earlier records.

The saved record contains its ID and creation time, simulation date, preferences, reviewer note, full unit/evidence snapshot, calculation, blockers, next steps, rule reference and draft body/version when available. Export downloads this saved snapshot. Saving the evidence records the manager’s initial review. A separate draft handoff and explicit draft approval occur afterward; neither indicates notice service or a rent change.

## Simulated drafting and operational records

`un-handoff-types.ts`, `server/un-handoffs.ts` and `/api/un/reviews/handoff` implement the mock provider return and approval history. The handoff uses the same browser session as saved reviews. The server derives all letter inputs from that session’s saved review; the client submits only a review ID. Held or incomplete reviews cannot produce a returned increase letter. Drafting retries reuse the existing run, and approval is a distinct persisted state.

`un-operations.ts` contains the additional operational fixtures and dated source records; `reviewOperations(asOf)` determines leasing work, settled balances and pending payments. `UNOperationsBoard` displays those findings with evidence and next steps. Payment figures are a sample ledger reconciliation, not legal demands or assessed late fees.

The drafting simulation is deterministic. The animation illustrates a future provider handoff; no network connection to Ambiguous AI is needed. The returned draft is shown in the manager’s **Draft approvals** view rather than emailed to the random demo address.

## Optional assistant

The existing server-side model configuration can enable **Ask UN** through the page-context integration. Follow the [model configuration guide](model-switching.md) and [sponsor setup guide](../using-sponsor-tools.md), keep credentials in the root `.env`, and restart the web app after configuring a provider.

The optional assistant receives the fictional review cases and selected unit. Its UN action can open an existing review. It does not save or approve a packet, send a notice, alter pricing, clear blockers or connect a property account. The no-key showcase does not establish a successful live model call; verify provider access separately before including assistant behavior in a recording.

The sidebar also links to the [investigation workspace](http://127.0.0.1:3100/agent), contributed by the parallel agent-workspace task. Its guided questions compare hypothetical proposals through the same backend review engine and can prepare a scenario for explicit saving to the same local review history. A configured model adds conversational control of those preview actions.

## Verification and scope

Focused checks from the repository root:

```bash
node --import tsx --test apps/web/src/lib/un-review.test.ts apps/web/src/lib/server/un-reviews.test.ts apps/web/src/lib/server/un-workbench.test.ts
npm run typecheck --workspace web
```

The storage suite covers full-packet persistence and restart, concurrent duplicate saves, preservation of earlier versions after seed changes, session isolation, blocked follow-ups, request validation, origin/body limits, storage path protections and sanitized failures. These checks do not call external accounts or validate real-property coverage.

UN currently has no background cron, live inbox, connected property database, automatic notice service, or ledger rent update. Draft wording is an illustrative internal template with explicit pending review. The existing operations and workflow-explorer pages remain supporting examples; vendor and government links are resources to evaluate, not active integrations.

See the [recorded UN verification](un-verification.md) for automated and browser checks.
