# UN: applying the bus ticket theory

Project context and product review, September 12, 2026. Requested reference: Paul Graham, [The Bus Ticket Theory of Genius](https://paulgraham.com/genius.html), November 2019; read September 12, 2026. This review concerns the current UN homepage and its property-review workflow, with `/operations` and `/advisor` as supporting surfaces.

**The idea to retain.** Graham argues that sustained, intrinsic fascination with a consequential subject can produce discoveries that deliberate ambition overlooks. Interest draws people into details and apparently unpromising questions. Creating things and tackling difficult problems are useful signals, but the eventual value of an obsession remains uncertain. His account also leaves room for exploration that fails and cautions against spreading attention too thinly. [Source essay](https://paulgraham.com/genius.html)

**Our interpretation for UN.** Build a product that rewards close investigation of property records and preserves what the manager learns. The unit of progress should be a better-supported decision. This is a product hypothesis inspired by the essay; the essay does not establish that an AI system has intrinsic curiosity or that collecting more records improves decisions.

The team's own interest matters first. A useful discovery question is: “Which discrepancy in a lease, ledger, or message would we keep investigating even after the demo ends?” Renewal evidence is the strongest initial candidate in the present code. Working with a manager on actual recurring questions should determine whether it deserves continued investment.

**What the implementation already supports.**

| Observed in the code | Implication for this idea |
| --- | --- |
| [Review logic](../apps/web/src/lib/un-review.ts) checks structured unit facts and creates evidence tasks when records are missing or dates conflict. | The product already has a concrete reason to examine details. Its checks operate on prepared fields; they do not independently extract or establish those facts from arbitrary documents. |
| [Evidence and unit types](../apps/web/src/lib/un-types.ts) retain source IDs, dates, bodies, and optional URLs. | There is a starting point for traceable investigations. A particular fact is not yet explicitly linked to the sources supporting or contesting it. |
| [Saved reviews](../apps/web/src/lib/server/un-reviews.ts) retain a packet and reviewer note; saving recomputes the packet from the fixed demo unit. | There is a record of the review, but no mechanism for applying a supported correction to subsequent reviews. A note does not resolve the underlying conflict. |
| [The desk](../apps/web/src/app/page.tsx) reruns the seeded portfolio, while [the assistant](../apps/web/src/components/un-assistant.tsx) can explain supplied cases and open a unit. | The next opportunity is a visible investigation and resolution workflow. Prompt changes alone cannot provide evidence updates, persistent resolutions, or comparison with prior reviews. |

These are source-code observations, not a fresh execution or integration test. The earlier [daily-desk brief](property-review-desk.md) contains a planning snapshot; the current code already includes several features described there as future work.

**Recommended first addition: resolve one discrepancy completely.**

Use the existing fictional Unit 12 case. Its ledger gives March 1, 2026, as the previous increase date; its correspondence gives December 1, 2025. Those are seeded sample facts in [un-demo.ts](../apps/web/src/lib/un-demo.ts).

1. Open the discrepancy and show both claims beside their source records. State the precise question: which date records the applied increase?
2. Let the manager attach or select the supporting record, then propose a correction with a reason. For the first demo, provide clearly labeled synthetic follow-up evidence.
3. Show the proposed fact change and its supporting evidence for confirmation. Preserve the original claims and record who confirmed the resolution and when.
4. Recompute the review from the confirmed version. If March is confirmed, the existing demo logic still holds the proposed December increase for timing; resolving a conflict need not produce a draft.
5. Save and reload. Show the original conflict, confirmed resolution, resulting next action, and what changed since the previous review.

This gives the demonstration a substantive discovery: the manager learns why two records disagree, and the next review can use that knowledge. The UI can explain the process with ordinary labels such as **Investigate discrepancy**, **Confirm evidence**, and **Changes since last review**.

**How to implement that slice.**

| Change | Existing location and proposed extension |
| --- | --- |
| Represent an investigation | Extend [un-types.ts](../apps/web/src/lib/un-types.ts) with a questioned field, competing claims, source references, status, owner, and resolution. Give the case a stable identity scoped to property, unit, and tenancy or review cycle. |
| Preserve supported corrections | Extend [storage types](../apps/web/src/lib/un-storage-types.ts) and [server storage](../apps/web/src/lib/server/un-reviews.ts) with versioned evidence and confirmed resolutions. The server must load and validate that version before recomputing a packet; accepting a client-supplied status would bypass the existing review logic. |
| Make the result visible | Extend [page.tsx](../apps/web/src/app/page.tsx) with a focused resolution panel and a before/after explanation. Keep earlier saved packets intact. |
| Supply useful assistant context | Pass the selected investigation, relevant previous resolution, and changed source references into [un-assistant.tsx](../apps/web/src/components/un-assistant.tsx). The assistant should explain the remaining question and useful next record. |

Retain operating preferences, factual corrections, and applicable rules as distinct kinds of information. A manager confirming a date should not implicitly change a pricing preference or the rule used for the review. A later contradictory record should reopen the question with the prior resolution visible.

**How the idea can shape ongoing work.**

- **Discovery:** Keep a small notebook of surprising cases encountered with managers: the question, evidence, explanation, consequence, and unresolved uncertainty. Choose experiments from repeated puzzles that the team wants to understand.
- **Product:** Carry confirmed resolutions into the next review with their sources and scope. Surface a prior case as a potentially relevant example; verify its applicability before reusing its conclusion.
- **Exploration:** Reserve a small, explicit amount of team time for a question whose value is uncertain. In the product, let a manager choose a deeper investigation with a defined question and stopping point. Unanswered work should end in a useful missing-evidence task.
- **Focus:** Complete the renewal discrepancy workflow before expanding into additional property tasks. Expand when investigating a real case reveals a recurring adjacent need.

**What would validate this direction.** Compare the existing flow with the proposed flow on a small set of manager-reviewed cases. Measure time to a supported decision, repeated requests for the same evidence, incorrect conclusions, and whether the saved explanation helps another reviewer continue. Track unresolved cases as outcomes too. More generated drafts or longer assistant conversations would not by themselves demonstrate improvement.

For implementation, verify that an unsupported correction leaves the conflict unresolved; a supported correction recomputes all remaining checks; reload retains the resolution and its evidence; a repeat save creates no duplicate; and new contradictory evidence reopens the case. These are proposed acceptance checks, not claims that the feature exists.

**Recommended positioning:** “UN helps property managers investigate the details behind each decision—and keep what they learn.” The immediate build priority is the Unit 12 resolution loop. This document records the reference and proposal; it does not change application behavior.
