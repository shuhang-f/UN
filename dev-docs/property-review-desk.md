# Groundwork: property manager's daily review desk

Combined direction, September 12, 2026. Incorporates the user's pasted daily-review-desk proposal, the Los Angeles research brief, the current implementation, and the user's request for proactive rent-increase notice drafting near renewal.

Additional project context: [Paul Graham's bus ticket theory and the UN product review](bus-ticket-product-review.md) examines the current implementation and proposes a complete discrepancy-resolution workflow as the next step.

**Product focus.** Groundwork helps a manager of rent-regulated properties see which units need attention, compare relevant records, and prepare the next action. The lead demonstration is an approaching lease review that produces an internal rent-increase draft and a review packet. The manager continues to use their existing property-management software.

**Primary workflow.** A lease enters the manager's configured review window → the agent assembles dated evidence → checks coverage, rent history, lease terms and proposed timing → prepares the appropriate draft or identifies a blocker → the manager reviews → the approved internal work is saved and retrieved.

Automatic preparation of an internal draft is in scope. Sending or serving a notice, changing rent in the ledger, and changing tenancy status remain distinct actions. This refines the pasted proposal's blanket exclusion of automated notices to accommodate the user's explicitly requested drafting feature.

**Three dates with different meanings.**

| Date | Meaning | Treatment |
| --- | --- | --- |
| Internal review date | When the manager wants the agent to start preparing. | Configurable operating preference, such as 90 days before lease end. This is an example planning lead time, not a statutory notice period. |
| Lease end / renewal date | A reason to review the tenancy and any renewal proposal. | Does not itself establish permission to increase rent, end the tenancy or mark a unit vacant. |
| Proposed increase effective date | The date against which the applicable rules and notice timing must be checked. | Evaluate previous increases, lease terms, coverage, registration, notice/service requirements and any relevant restrictions. |

LAHD describes ordinary RSO increases as permitted once every 12 months. A lease renewal and an increase anniversary can therefore require separate review. [LAHD RSO overview](https://housing.lacity.gov/residents/rso-overview)

**What a daily desk card contains.**

- Unit and property identity; why the card appeared today.
- Dated lease and amendments, rent history and selected communications, with source references.
- Confirmed facts, conflicting facts and missing facts shown separately.
- Manager's confirmed rent instruction or operating policy; the applicable ceiling shown separately.
- Recommended next action, responsible person and unresolved blockers.
- An editable internal draft or a request for the missing information.
- Draft version, reviewer decision and saved record reference.

The legal maximum is not a default instruction to raise rent by that amount. If the manager has not provided an amount or a confirmed pricing policy, the agent can prepare the review structure and ask for that decision. If the requested amount conflicts with the applicable limit, explain the conflict and propose an option for review rather than silently changing the amount.

**Drafting states.**

| State | Agent behavior | Visible result |
| --- | --- | --- |
| Review due | Collect and compare authorized records. | Evidence packet with a reason for review. |
| Evidence incomplete or conflicting | Create a specific reconciliation task; leave consequential fields unresolved. | “Needs evidence,” naming the missing source and its owner. |
| Proposed increase blocked | Explain the amount or timing conflict using the applicable source. | A proposed correction or follow-up; no ready-to-serve designation. |
| Draft prepared | Populate a reviewed template from verified facts and the manager's instruction. | “Internal draft — pending review,” with calculation and sources alongside it. |
| Reviewed and saved | Persist the version and decision through the existing approval flow. | Retrievable packet/task ID. |
| Service recorded | In a later authorized workflow, retain the actual notice and service evidence. | Separate status from drafting, approval, or saving. |

Use a jurisdiction-appropriate, reviewed notice template. The assistant can extract facts and draft explanatory text, but it should not invent legally required wording. Notice timing is evaluated under the applicable requirements, including service method and any longer contractual period. [Civil Code §827](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=827.)

Unit coverage needs evidence. LAHD's property search can indicate RSO coverage when only some units on a property are covered. A positive property lookup is not enough to populate every unit's coverage automatically. [LAHD property-search limitation](https://housing.lacity.gov/rental-property-owners/rso-property-search)

**Proposed showcase: one successful draft and one blocked case.**

Use a clearly labeled synthetic portfolio and simulation date of September 12, 2026. “Run today's review” exercises the trigger locally; it must not be labeled a running background monitor.

| Sample case | Facts | Expected behavior |
| --- | --- | --- |
| Unit 4 — prepare a draft | Lease ends November 30, 2026; internal review window is 90 days; lawful base rent is $2,000; last increase was December 1, 2025; proposed effective date is December 1, 2026. Synthetic coverage and registration evidence are verified. Manager's confirmed instruction is a 2% increase, subject to the applicable rules. | Create an internal draft with a candidate base rent of $2,040. Show the manager's 2% instruction and the published 3% ordinary LA City RSO ceiling separately. Review lease, notice timing and template before release. |
| Unit 12 — resolve the conflict | Lease enters the same review window, but the ledger records an increase in March 2026 and an email says the increase anniversary is December. | Show the conflicting dates, request the supporting increase record, and assign a reviewer. Do not issue a definitive December increase draft. |

The rate used in this example is LAHD's published 3% ordinary annual adjustment for July 1, 2026–June 30, 2027, checked on the research date. These are synthetic ordinary-adjustment cases, excluding separately assessed permitted charges and special adjustment approvals. [LAHD current period](https://housing.lacity.gov/renter-protections-2)

Suggested two-minute sequence:

1. Open the daily desk and run the review for the sample date.
2. Open Unit 4 and show why it is due, the supporting records and the draft.
3. Change an editable operating preference, such as the review window, confirm it, and demonstrate its effect on another sample unit. The preference must not override legal requirements.
4. Open Unit 12 and show how conflicting records produce a reconciliation task.
5. Review and save the chosen packet/task. Reload to retrieve the same record. If Ambiguous is used, require successful provider read-back; otherwise clearly label local persistence.

Payment-status reconciliation and maintenance remain useful future card types. They should share the evidence-and-next-action pattern, but the first showcase should emphasize renewal review and its exception case. An overdue email alone should not become an allegation of unpaid rent.

**Other tasks reviewed.**

| Existing task | Work observed | Reuse and remaining gap |
| --- | --- | --- |
| Implement rent control workflow | Current code has manager/property intake, pasted correspondence, per-unit occupancy review proposals, generic rent-change review steps and local/Ambiguous save support. The task reported typechecking and 63 web tests passing. | Reuse intake, evidence references and proposal controls. The unit extractor currently looks for occupancy/turnover language; it does not implement renewal-date detection or notice drafting. |
| Review real estate agent workflow | Separate `/operations` route with vacancy, maintenance and leasing examples, editable steps/owners and product links. The task reported successful browser checks for cancel/save/reload and was running final verification when inspected. | Reuse the interaction pattern and preserve the route. It is a supporting operations demo, not the renewal workflow. |
| Investigate rent control solutions | Official LA sources, product comparison and tested public demo access are documented in `dev-docs/rent-control-la-research.md`. | Use task-specific resources in customer recommendations. Government rules, vendor capabilities and installed integrations must remain distinguishable. |

These are inspected code and other-task reports, not a fresh full-app test run by this research task. The other active task's production build was not interrupted or duplicated.

**Implementation sequence.**

1. Add a small synthetic lease, rent-history and correspondence dataset with stable property/unit/tenancy IDs and source dates.
2. Add date-based review detection with an explicit simulation date and configurable internal lead time. Repeated runs should update the same case rather than duplicate it.
3. Add evidence conflict checks and a deterministic calculation component scoped to the reviewed LA City example. Keep property coverage, increase eligibility and draft readiness as different statuses.
4. Add an internal notice draft preview with the manager's instruction, reviewed template reference, amount, candidate date, unresolved fields and source/version metadata.
5. Extend persistence to retain the full review packet and draft version; the existing saved checklist is not sufficient by itself.
6. Verify a ready case, an uncertain-coverage case, conflicting increase dates, a proposed amount above the ceiling, repeat runs, and save/reload. Demonstrate a relevant manager correction.
7. Add real scheduling, mailbox/PMS access and other Ambiguous record types only after their specific access and read/write behavior are tested. The current integration should not be described as supplying these automatically.

This file combines the product direction and records implementation gaps. It does not itself add a renewal scheduler, draft generator, external integration or background automation.
