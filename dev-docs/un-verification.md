# UN demo verification — September 12, 2026

## Automated checks

- The final `npm run verify` passed after the email-entry and 30-day seed changes: workspace TypeScript checks, 37 agent-core, 22 channel and 101 web tests (160 total).
- After changing Unit 04 to a lease ending exactly 30 days after the simulation date, the focused engine, storage and investigation-workspace suites passed: **38 tests** (20 engine, 12 storage, 6 workbench). These include the five seeded cases, calendar boundaries, requested increases, missing/conflicting evidence, saved snapshots, concurrent retries, version-aware deduplication, session isolation and request validation.
- The revised Unit 04 seed ends October 12, 2026; its candidate effective date is October 13, 2026 and previous increase is October 13, 2025. Automated checks confirm its 2% draft remains $2,040, the 30-day trigger is inclusive, and a 60-day window keeps Units 04 and 09 due. The generic 12-month boundary checks use explicit independent dates.
- The final production build passed with the new email-entry/processing UI, `/agent`, `/advisor`, `/operations`, their APIs and the parallel deployment middleware/standalone configuration. CopilotKit's transitive Google Vertex dependency reports an existing dynamic-dependency warning; the workbench CSS also reports one non-blocking alignment compatibility warning. The core UN demo does not use a live model.

## Browser checks

Verified in the Codex in-app browser against the loopback preview. The email-entry and 30-day seed update also received a fresh browser check:

- Default date and preferences show four due units, one prepared internal draft and three cases requiring attention.
- Unit 04's working draft proposes $2,040 from a $2,000 base at the requested 2%; the ordinary 3% ceiling appears separately.
- Cancelling review does not save. Confirming review creates one local packet with a reviewer note.
- The same record ID and content can be reopened after reloading the page.
- The same record was read again after stopping development mode and launching the production server.
- JSON export was downloaded and read back: it includes the same record ID, five evidence records, the reviewer note and template version `un-illustrative-internal-v2`.
- Changing the planning window and restoring 90 days was exercised. With the revised seed, the expected 60-day result is two due units, 04 and 09; restoring 90 days still produces four due units.
- A 4% requested increase remains $2,080 and is held for revision; it is not silently reduced to 3%.
- Unit 12's evidence includes both inconsistent increase dates; its notice tab does not create a definitive draft.
- The Upcoming filter selects Unit 21 and explains that its proposed period is outside the loaded rule window.
- The portfolio and review detail fit a 390-pixel viewport without document overflow. Selecting a unit brings its detail into view. The native confirmation dialog fits the mobile viewport and uses modal focus confinement.
- No application console errors were observed during the development preview checks; a dependency's development-mode warning was present.

## Email entry and simulated Ambiguous AI flow

- A fresh visit shows email entry before mounting the unit review desk. Invalid email input is rejected; the random sample-email button creates a usable `example.com` address.
- Submitting shows the clearly labeled **Ambiguous AI / Mock workflow workspace / SIMULATED** screen. Four timed steps finish, and **Show 4 units needing attention** becomes available. The screen starts at the top of the page.
- **Skip animation** completes the preview immediately without a later timer reverting progress.
- The opened desk shows Unit 04 with **30 days to lease end**, October 12, 2026 lease end and October 13 candidate effective date. Its internal 2% proposal remains $2,040.
- A 60-day window shows two due units. Reload preserves the completed walkthrough and the chosen review preferences.
- **Restart demo** returns to email entry. Finishing a new walkthrough restores the default four-unit queue and 2% proposal. Saved-review count is unchanged by replay.
- A reviewed packet for the revised 30-day case was saved successfully; earlier snapshots remain available.
- Reloading an unfinished walkthrough returns to email entry safely.
- Entry and processing screens fit a 390-pixel mobile viewport without document overflow. Supporting text and simulation labels were enlarged and darkened after visual inspection.
- Source review confirms the entered email is used only in browser state, `sessionStorage`, and a displayed demo label. It is absent from request payloads, saved packets, and assistant context. The mock processing screen creates no Ambiguous AI tasks or mailbox connection.

The sample preferences were restored after testing. One reviewed Unit 04 packet from the earlier seed remains in the demo browser's session. Saving its revised 30-day case creates a new snapshot while retaining the older reviewed version. Live model calls, background scheduling, external property systems and notice service were not exercised or claimed.
