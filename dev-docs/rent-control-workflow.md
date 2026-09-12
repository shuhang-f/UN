# Rent-control workflow

The homepage accepts name/email, property jurisdiction, existing software, a workflow description, and optional selected email text. Contact details are not authentication. Direct mailbox OAuth/scanning is not implemented; the starter has no mailbox connector. The assessment works without credentials using transparent topic rules.

The rent-control plan covers unit coverage review, rent-history/calculation and notice review, and approval/service follow-through. No legal rates or deadlines are calculated. City/state is user supplied, not verified coverage. One useful initial pilot is assembling a single unit’s rent-change review packet from a lease, ledger, and selected correspondence.

Starter reuse: CopilotKit context and review UI; existing approved local/Ambiguous plan persistence; Exa search capability as a suggested research component. Auth0’s included machine-to-machine example is not Gmail or Outlook OAuth. Adding mailbox access requires a separate provider connection and message-selection flow.

Official reference reviewed September 12, 2026: https://www.sf.gov/information/rent-board-housing-inventory-frequently-asked-questions-faq . San Francisco’s inventory/licensing process illustrates why registration checks belong in the review packet. Do not apply San Francisco requirements to other jurisdictions. Rules and effective dates must be checked for the actual unit and proposed action.

Verify: run npm run verify, then npm run build --workspace web. Browser flow: enter a city and workflow description, generate a plan, review, cancel without saving, review again, save locally, reload, and inspect the saved record. Live model/Exa/Ambiguous checks require separately configured credentials.

## Unit-level direction

The intake now asks for manager name/email, city/state, and property name/address. Selected correspondence must be scoped to that property. In rent-control focus, named-unit occupancy/turnover passages produce per-unit verification proposals with verbatim source references, followed by conditional make-ready work and regulated reletting review. Multiple or contradictory messages stay attached; there is no automatic vacancy confirmation, rent reset, or property-system write. Ambiguous multi-unit passages are skipped for manual attribution. This bounded rule-based extractor is not comprehensive mailbox analysis.

Next connection choice is Gmail/Google Workspace or Outlook/Microsoft 365. Neither is connected by this change. A real connection should let the manager authorize read access, choose the property/date scope, review matched messages, and then reconcile proposed unit facts against an authoritative property record. The existing pasted-message flow exercises the proposal layer while that provider decision is pending.

Validation for this change: workspace typecheck and all 63 web tests passed, including contradictory occupancy, future move-out, and ambiguous unit-attribution cases. No concurrent Next build/dev was started during this change.
