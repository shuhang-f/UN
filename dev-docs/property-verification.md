# Operations demo verification

Verified September 12, 2026 at `/operations` using the local app with no provider credentials.

- `npm run verify`: typechecks and 122 tests passed across the shared workspaces (37 agent-core, 22 channel, 63 web). This includes tests from the separate rent-control task in the same repository.
- `npm run build --workspace web`: passed. The inherited Google Vertex provider utility produces a dynamic-dependency warning; it did not prevent compilation or route generation.
- Browser: fictional portfolio loads three selected messages; assessment shows three distinct workflow candidates with matching sources and product links.
- Review: cancelling created no plan. Editing the apartment-readiness title and approving a local save created a real record. Reloading retained the same ID, edited title, and all three steps.
- Pasted context: a fictional dishwasher message with the Maintenance focus produced one maintenance finding, with the selected message as evidence.
- Connections: absent model configuration shows a setup explanation. The guided workflow remains usable. No mailbox is presented as connected.
- Catalog: all five property vendors render with official product and tour links; no product setup or external account writes occurred.
- Layout: desktop and 390-pixel mobile views inspected. Mobile navigation and the three-step overview fit; document width equals viewport width. The temporary viewport override was reset.
- Browser console: no errors captured during these flows.

The sample saved plan remains available in the test browser session. No real resident records were used. Live model responses, Exa results, and Ambiguous writes were not tested; these require configured credentials. See [integration setup](property-integrations.md) and the [demo script](property-demo.md).
