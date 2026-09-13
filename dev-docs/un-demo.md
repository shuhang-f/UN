# UN review walkthrough

UN compares lease, ledger, correspondence, and registration records for a fictional seven-unit portfolio. It prepares internal review packets, retains conflicting evidence, and saves the manager's decisions. Exa adds live public-source research. Ambiguous AI stores an explicitly approved packet and prepared letter as a real task.

## Start

Use Node.js 22 or later. From the repository root:

```bash
npm ci
npm run dev:web
```

Open [UN](http://127.0.0.1:3100/). The desk opens directly, with no email entry or simulated connection sequence. Keep the same hostname and browser profile to retain access to the same saved review history.

The sample date starts at September 12, 2026. Defaults are a 90-day internal review window, a 2% requested increase, and reviewer Alex Morgan. The review window is a planning preference. The rate and timing checks come from the sample rule fixture and dated evidence.

Local review and export need no keys. Configure `EXA_API_KEY` and `AMBIGUOUS_API_KEY` in the root `.env` for the provider tools, then restart the app. Follow [tool setup](un-tools.md) for credentials and credits. Model chat is optional and separate.

## Walkthrough

1. **Review Unit 04.** Its lease ends 30 days after the sample date. Inspect the dated evidence, the $2,000 to $2,040 proposal, and the separately displayed sample ceiling. Confirm the evidence review and save the packet with a reviewer note.
2. **Save to Ambiguous.** Open **Draft approvals** and inspect the saved packet and prepared letter. Explicitly approve the task save. The server uses the saved review to create a task through the existing Ambiguous MCP adapter and reads the provider record back. Inspect its provider ID and any link returned by Ambiguous.
3. **Approve the letter.** Read the prepared letter and save the manager's approval note. The letter comes from UN's review template; Ambiguous stores the packet and letter. Manager approval is a separate local record and does not send email, serve a notice, or change rent.
4. **Research with Exa.** Open **Tools**, enter a public research query, and run the search. Review the returned titles, URLs, and highlights. Open a source to check its context. Research results do not automatically change the saved evidence or sample rule fixture.
5. **Check other cases.** Open Unit 12 to inspect conflicting increase dates and its required follow-up. In **Leasing & rent**, compare Unit 05's ready vacancy, Unit 17's unfinished turnover, and Unit 21's pending payment.

Without provider keys, the desk reports missing setup and does not fabricate provider results. A configured key means credentials are present; a successful tool call is needed to establish working access.

## Sample cases

All people, properties, addresses, and private records are fictional.

| Unit | Review case |
| --- | --- |
| 04 | Evidence supports preparing an internal letter under the sample rule and manager's 2% instruction. |
| 12 | Ledger and correspondence disagree on the last increase date; preserve both and request reconciliation. The sample ledger also has an outstanding balance. |
| 08 | Unit-specific coverage remains unresolved; request that evidence before drafting an increase. |
| 09 | The proposed effective date is too early under the sample timing check. |
| 21 | Renewal is outside the initial review window. A pending payment requires settlement verification. |
| 05 | Possession and turnover are confirmed; prepare the listing. |
| 17 | Possession is confirmed and turnover is incomplete; finish turnover before listing as ready. |

For a useful variation, change the requested increase to 4% and rerun the review. The sample 3% ceiling blocks the proposal while retaining the manager's instruction. **Run daily review** recalculates on demand; it does not create a background schedule.

## Records and storage

[un-demo.ts](../apps/web/src/lib/un-demo.ts) supplies renewal fixtures; [un-operations.ts](../apps/web/src/lib/un-operations.ts) supplies the additional operating cases. [un-review.ts](../apps/web/src/lib/un-review.ts) calculates review states, next steps, and internal letters.

`GET /api/un/reviews` establishes the browser session and returns saved reviews. The save endpoint recomputes the packet from server-side sample data after explicit confirmation. The packet includes evidence, preferences, the reviewer note, calculation, blockers, and any prepared letter. Local snapshots live under `apps/web/.data/un-reviews/` in the standard web launch and are excluded from Git.

The HttpOnly `un-review-session` cookie identifies the local history. Clearing it or using another browser starts a separate history. This is a local session, not a shared account system. Repeating the same review save reuses its snapshot; changing inputs creates a new version.

`/api/un/reviews/handoff` handles approved Ambiguous task saves and separate local letter approvals. The client supplies a saved review ID, not replacement packet content. Provider IDs, returned links, and read-back metadata are retained with the local handoff record. Incomplete or held reviews cannot produce an increase-letter handoff. Persistent disk is needed to retain review and approval history across server restarts.

## Verification

From the repository root:

```bash
npm run typecheck
npm run verify
npm run build --workspace web
```

These commands check local behavior. For live verification, run one Exa query and inspect a source, then approve one Ambiguous task save and read back the same provider ID. Also verify that missing credentials show a setup message and that omitting save approval creates no provider task.

The app has no connected property database, inbox, background schedule, notice service, or ledger write. The [optional model configuration](model-switching.md) enables conversation over the supplied cases; it is separate from the calculations, provider credentials, and approval controls.
