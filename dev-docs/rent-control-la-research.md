# Los Angeles rent-control workflow research

Research date: September 12, 2026. Requested market: Los Angeles / California. This is a product and demonstration recommendation; the example below uses fictional unit facts and is not a determination about a real tenancy.

**Recommendation: focus Groundwork on reviewing a proposed rent increase for an occupied, rent-controlled apartment.** Start with an owner's message, assemble the relevant property facts and records, identify what prevents approval, and produce a review packet with specific next actions and suitable existing tools.

This is a credible workflow to investigate. It has an identifiable user, a recurring trigger, several handoffs, and a visible result. The commercial opportunity remains a hypothesis: this research did not include customer interviews or establish willingness to pay. Direct competitors already address calculations, evidence packets, and compliance tasks, so those features alone are not a unique market position.

**Resolve the jurisdiction before making a recommendation.**

| Situation | Verified distinction | Product implication |
| --- | --- | --- |
| City of Los Angeles, unit subject to RSO annual adjustments | LAHD publishes a 3% annual adjustment for July 1, 2026–June 30, 2027. | Attach the applicable source and effective window to the calculation. [LAHD bulletin](https://housing.lacity.gov/wp-content/uploads/2022/01/Allowable-Rent-Increase-Bulletin-English.pdf) |
| Unincorporated Los Angeles County, fully covered general unit | The County publishes 1.919% for the same period. Separate qualifying small-landlord and luxury-unit rates are 2.919% and 3.919%. | City and County are separate coverage paths. Higher category rates need their own qualification evidence. [County DCBA](https://dcba.lacounty.gov/rentstabilizationprogram/) |
| California property potentially covered by AB 1482 | The state cap is generally the lower of 5% plus applicable CPI or 10%, with coverage and exemptions to assess; stricter applicable local limits matter. | Being outside LA City RSO does not by itself establish exemption from rent caps. [California Attorney General](https://oag.ca.gov/rentcaps) |

A mailing address containing “Los Angeles” is insufficient. Confirm the municipality or unincorporated area, then the unit's coverage. LAHD directs users to ZIMAS for RSO lookup. Building age is supporting evidence, not a substitute for evaluating exceptions and unit history. [LAHD lookup instructions](https://housing.lacity.gov/rso-rent-increase-calculator)

**Prioritize these workflows.**

| Priority | Trigger | Specific suggestion Groundwork could give | Useful output |
| --- | --- | --- | --- |
| 1 — Rent-increase review | Owner requests a percentage increase or leasing prepares renewals. | “Confirm the unit's coverage, reconcile the base rent and previous increases, and compare the request against the rule effective on the proposed date.” | Calculation worksheet, evidence links, unresolved questions, reviewer and next action. |
| 2 — Registration evidence | The team cannot find the current registration record. | “Assign the manager to retrieve this property's registration certificate and attach it to the review.” | A named task with the correct government portal, completion evidence and status. |
| 3 — Notice and service tracking | A reviewed proposal needs to become an effective notice. | “Have the reviewer confirm the template, applicable notice period, service method and date before release; retain the served version and evidence.” | A versioned notice checklist and service record. |
| Later — Rule-change review | An authority publishes a new rate or requirement. | “Identify affected pending reviews, show what changed, and ask their owners to recheck the draft.” | An affected-unit queue with source versions and reviewer decisions. |

Registration is substantive: the City's registration portal states that valid registration is a prerequisite to demanding or accepting rent. [LAHD registration portal](https://housingbill.lacity.org/billing/ComCon/Tab/RenderTab?lang=en-US)

Notice timing requires more than generating a PDF. Civil Code §827 generally specifies at least 30 days for covered increases of 10% or less and 90 days for increases above 10%, measured with prior increases; mail service and longer applicable requirements affect the timing. Lease terms also need review. Do not equate an email, e-signature, or saved draft with completed legal service. [Civil Code §827](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=827.)

**Existing products and what we can actually use or showcase.**

Capabilities below are vendor descriptions unless a live browser observation is stated. No vendor account, production integration, purchase or sales request was created during this research.

| Product / resource | Relevant capability | Practical use and demonstration access |
| --- | --- | --- |
| **LAHD tools + ZIMAS** | Official coverage lookup instructions, rent calculator, published rules and registration services. | Best source material for the LA City example. Link the lookup and applicable bulletin from the review. The calculator page still labels its rate window 2025–26; use the bulletin's explicitly stated 2026–27 window for a current example. No public integration API was verified. [Calculator and lookup](https://housing.lacity.gov/rso-rent-increase-calculator) |
| **RentRight** | Address/property-based rent review, evidence packets and rent-roll renewal triage. | Closest direct competitor and an evaluation candidate. I reached the public LA calculation preview with synthetic inputs. Exact percentage, dollar ceiling and PDF required a free account; their accuracy was not tested. Its operations roadmap labels AppFolio/Yardi/Buildium synchronization as future integration work. Use a link or a reviewed export initially. [Manager workflow](https://rentright.io/for-property-managers), [calculator](https://rentright.io/), [integration roadmap](https://rentright.io/operations-layer) |
| **LandlordOS** | LA-specific obligations, notice/posting workflows and evidence logs. | Useful reference for a task card containing the obligation, source and completion proof. Its own site labels the product a prototype pending legal review. Treat it as an early product to evaluate, not an established compliance dependency. [Product and status](https://landlordos.net/) |
| **California Apartment Association** | AB 1482 applicability and regional CPI calculators, forms and educational material. | Useful if the manager already has membership and the relevant form access. Calculators are member-gated; online forms and the helpline are listed as membership add-ons. The AB 1482 calculator is not a replacement for LA City RSO calculation. [CAA tools](https://caanet.org/topics/ab-1482/) |
| **Buildium** | Property, resident and accounting data plus a documented Open API. | Most concrete API path among the operating systems examined. Begin with a customer-authorized rent-roll extract; evaluate API access when available. Premium starts at $400/month and includes Open API. A 14-day trial with sample data is advertised, but trial API entitlement was not verified. [API](https://www.buildium.com/features/open-api/), [pricing and trial](https://www.buildium.com/pricing/) |
| **LeaseConnectPro** | Markets California rent calculations, local rules, disclosures and notices. | Its homepage links to a no-signup live demo, but opening that link returned “Demo not available yet.” Exclude it from the live showcase until access and results can be verified. [Product](https://leaseconnectpro.app/), [demo checked](https://leaseconnectpro.app/demo) |
| **RentCeiling** | LA calculator and calculation worksheets. | Useful evidence of existing demand and competition, but not a recommended calculation dependency today: its LA page still uses a projected approximately 2.8% post-July-2026 rate, which differs from the City's published 3%. [Page examined](https://rentceiling.com/los-angeles) |

The practical selection is **official LA sources + the manager's existing property system + Groundwork's review workflow**. RentRight is worth evaluating before building substantial calculator infrastructure. Its published roadmap also overlaps the proposed product, so the case for Groundwork must rest on completing useful work from the team's actual correspondence and records, with clear handoffs. That advantage still needs customer validation.

Live calculator check: after dismissing LAHD's announcement overlay, entering a synthetic $2,000 base rent returned $2,060 before surcharges and $2,064.44 including the displayed RSO/SCEP surcharges. For the showcase, distinguish the base rent from these separate charges and their prerequisites. The page's old date label means this interaction verifies the arithmetic and public access, not the current rule window. [Calculator tested](https://housing.lacity.gov/rso-rent-increase-calculator)

**A concrete two-minute showcase.**

Use this fictional message:

> The owner wants Unit 4 to go from $2,000 to $2,160 on November 1, 2026. They used the statewide rent-cap guidance. The last increase was August 1, 2025. Our sample unit is confirmed subject to LA City RSO. I cannot find this year's registration certificate. Can you prepare the review?

Assume an ordinary annual adjustment, a verified lawful base rent, no special adjustment or recovery approval, and tenancy terms permitting a change after proper notice. Explicitly label the coverage record and messages as synthetic.

1. **0:00–0:25 — Read the request.** Extract the unit, current and proposed rents, intended date, previous increase and missing record. Show the original message beside the extracted facts.
2. **0:25–0:55 — Explain the discrepancy.** Show the requested 8% and, under the example assumptions, the published 3% ordinary adjustment: $2,000 × 1.03 = $2,060. This is a candidate base rent for review, excluding separately assessed permitted charges. [LAHD bulletin](https://housing.lacity.gov/wp-content/uploads/2022/01/Allowable-Rent-Increase-Bulletin-English.pdf)
3. **0:55–1:20 — Give actionable suggestions.** Create a manager-owned registration-evidence task, a reviewer-owned calculation/notice check, and a link to the appropriate existing resource for each. Keep the case waiting for required evidence.
4. **1:20–1:45 — Save the reviewed packet.** Show the source, effective dates, inputs, assumptions, blockers and assigned roles. Save through Groundwork's existing explicit save control. The demonstrated outcome is the persisted review record.
5. **1:45–2:00 — Show persistence and one exception.** Reload to retrieve the same record. Change coverage to unknown and show an evidence request instead of a definitive permitted amount. If changing the actual interface is deferred, label this exception screen as a proposed design.

The same bulletin limits ordinary annual adjustments to once each year and removes additional utility percentage increases effective February 2, 2026. Those provide useful later cases, but the first demo should stay focused. [LAHD annual-adjustment rules](https://housing.lacity.gov/wp-content/uploads/2022/01/Allowable-Rent-Increase-Bulletin-English.pdf)

**Fit with the current repository.**

The code inspected already includes a rent-control focus, jurisdiction input, a three-stage review workflow, source/uncertainty guidance, and a save path. The current guided assessment uses fixed topic rules. It does not already perform the proposed LA calculation or live coverage verification.

- `apps/web/src/lib/property-analysis.ts`: `toolsFor()` currently returns CopilotKit, Exa and Ambiguous AI for rent-control cases. Replace or supplement the customer-facing recommendations with task-specific government and property-management resources. Keep the implementation stack in developer documentation.
- `apps/web/src/lib/property-catalog.ts`: add source-verified entries with capability, workflow fit, access requirement, verification date and demo availability. A product-page link should not be presented as an installed integration.
- `apps/web/src/lib/property-samples.ts`: add the fictional LA message and structured unit facts. Avoid pretending a sample address was checked against official records.
- Calculation/review model: add rule identity, applicability status, effective window, source URL, reviewed inputs, candidate amount, blockers and reviewer status. Use deterministic arithmetic after coverage and date checks; use the assistant to extract facts and explain the next step.
- Save path: assess what additional packet metadata must persist alongside the existing reviewed workflow. A saved title and checklist alone will not preserve the calculation evidence.

For a first implementation, use a small, explicitly dated LA City rule set and human-confirmed coverage. Public search can help locate an updated authority, but discovery results should not silently overwrite reviewed rules. The source can be reachable while the text is stale; a successful fetch is not evidence of a current legal rule.

**How to validate the idea with managers.**

Ask a manager to walk through their last actual rent increase: where the owner request arrived, how they established coverage, where the previous increase and registration evidence lived, who reviewed the notice, and how completion was recorded. Compare the proposed flow with the tools they already pay for.

Measure minutes to assemble a review packet, manual record transfers, missing facts caught before approval, and whether another teammate can resume the case without asking for its history. Do not claim savings or prevented violations until measured. Proceed if the manager can identify a repeated handoff problem that their existing tools leave unresolved; narrow the scope if their current system already handles this well.

This research adds a decision brief only. It does not implement the proposed LA-specific workflow or connect the app to a vendor.
