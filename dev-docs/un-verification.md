# UN demo verification — September 12, 2026

## Automated checks

- `npm run verify` passed: all workspace TypeScript checks and **185 tests** (37 agent-core, 22 channel, 126 web).
- The new handoff suite has **11 tests** covering saved snapshots, restart, concurrent drafting retries, separate immutable approvals, conflicting approval notes, session isolation, held cases, client-payload rejection, HTTP validation and storage protections.
- The new operations suite has **10 tests** covering confirmed possession, inspection readiness, future turnover records, partial payments, future settlements, pending-payment separation, due-date boundaries and strict simulation dates.
- A subsequent web typecheck passed after replacing the pre-handoff letter with a facts brief and limiting Ask UN to the review desk context.
- Final production build: in progress at the time of this update.

## Browser checks for the expanded demo

Verified against `http://127.0.0.1:3100/` in the Codex in-app browser:

1. Restarted onboarding, generated a random sample email and submitted it. The initial screen explicitly shows **UN · Evidence review / SIMULATED**, with document/email/database analysis, a role inference, and renewal/leasing/rent findings.
2. Opened the default review desk: four renewal reviews, one proposal eligible for drafting, two vacant units, one overdue balance and one pending payment. Unit 04 remains exactly 30 days from its October 12 lease end.
3. Inspected Unit 04's evidence, entered a review note, and confirmed the information packet. The UI navigated to **Draft approvals**, showing the saved names, source records, $2,000 → $2,040 proposal, October 13 candidate date and inferred property-manager role.
4. Selected **Send to Ambiguous AI · demo**. The simulated processing steps appeared, then the server-backed draft returned with **Your draft is back for approval**.
5. Entered a separate approval note and selected **Approve draft**. The page showed **Draft approved in the demo**. Reloaded and reopened Draft approvals: the same approval and note were restored.
6. Opened **Leasing & rent**: Unit 05 has confirmed possession and completed turnover; Unit 17 has confirmed possession but incomplete turnover. Unit 12 has $1,350 remaining after $1,000 settled, 11 days after the sample due date. Unit 21 has $2,600 pending and no settled payment.
7. Exercised **Late rent** and **Needs leasing** filters. The late-rent filter isolates Unit 12; expanding its evidence shows its lease, September charge, partial settlement and resident email. The later payment is not used before its date.
8. Advanced the simulation to September 18 using the date field and ran the review. Both rent accounts became reconciled, pending and late totals became zero, and Unit 17 became ready for leasing preparation. Restored September 12 afterward.
9. Visually checked desktop at 1280 pixels and mobile at 390 pixels. Operations and draft approvals had no document overflow (`scrollWidth === clientWidth === 390`). Temporary viewport overrides are reset after testing.

The tested saved packet is `a5752c41-0447-4933-846b-c60579eb0d98`; its simulated handoff is `12abaa21-b520-421e-9e8b-9aefdcb2b0df`. These are fictional demo records in this browser session, not production records or a provider task.

## Review findings resolved

- The review desk now shows an evidence/pricing brief before the handoff. It no longer shows the full letter prematurely; the returned letter appears in Draft approvals.
- Ask UN is shown only on the review desk, whose current renewal cases match its context. It is hidden in saved, approval and operations views.
- The random email remains a browser-only label and is absent from saved review and handoff payloads.

## Earlier regression coverage

Existing suites continue to cover the LA rule fixture, 12-month calendar boundaries, requested-rate preservation, unknown coverage, inconsistent increase dates, missing/future evidence, expired rule periods, immutable review snapshots, concurrent saves and session isolation. Earlier browser checks covered 4% proposals staying blocked, the 60-day queue containing Units 04 and 09, held Unit 12 follow-ups, saved-review JSON export, and review preferences surviving reload.

All provider processing in the new handoff is simulated. No live model, mailbox, Ambiguous AI account, property database, tenant message, listing publication, notice service or rent update was exercised or claimed.
