# Groundwork: property operations demo

Groundwork helps a multifamily property manager turn supplied operational messages into a workflow to review, save, and discuss with their team. The current focus is apartment readiness, rental inquiry follow-up, and resident maintenance coordination. Product suggestions link to existing vendors; they are not connected integrations.

## Quickstart

Use Node.js 22 or newer. From the repository root:

```bash
npm ci
npm run dev:web
```

Open [Groundwork at http://127.0.0.1:3100/operations](http://127.0.0.1:3100/operations), then choose **Try a sample portfolio**. The homepage is a separate app; use `/operations` for this walkthrough. Use that same hostname throughout the demo so the browser retains its plan session. No API keys are needed for the guided assessment, sample messages, workflow review, local saves, or product links. An existing valid model configuration enables the optional assistant; missing credentials leave the guided flow available.

## Three-minute demonstration

| Time | Action | What to show or say |
| --- | --- | --- |
| 0:00–0:30 | At `/operations`, choose **Try a sample portfolio**. | “Juniper Residential and these messages are fictional. This community manager handles six apartment communities. We're examining what the supplied messages suggest.” |
| 0:30–1:10 | Run the assessment and choose **Review workflow** on the apartment-readiness finding. | Show the message about unit 408: flooring is delayed, cleaning depends on flooring, a final inspection is still needed, and leasing's sheet still says ready for Friday. Point to the cited message excerpt, then the steps and responsible roles. The app has not verified the apartment's actual condition or changed its move-in date. |
| 1:10–1:40 | Edit the plan and owners, then click **Approve & save locally**. | “This saves a reviewed plan. It does not assign real work, notify residents, or update our property system.” Show the saved plan and its destination. |
| 1:40–2:05 | Reload the page and inspect saved workflows. | Show that the same plan ID and steps remain. Repeat the identical save if desired: it should return the same plan, not create a duplicate. |
| 2:05–2:40 | Open a suggested product's tour. | HappyCo has a public scripted make-ready tour, Funnel has guided product tours, and Property Meld has an interactive vendor tutorial. These are vendor demonstrations, not connected workspaces. Entrata and other links may lead to sales-demo forms. Explain where the existing product fits and its setup requirements; opening its tour does not install it. |
| 2:40–3:00 | Return to the workflow and its discovery question. | Ask the team where a changed completion date currently reaches leasing and who verifies readiness. The result is a specific process to investigate, supporting context, and a saved plan—not a proven diagnosis or measured savings. |

For a resident-maintenance version, use the unit 211 sample: an unresolved dishwasher repair, an unfamiliar vendor phone number, resident availability, and no confirmed appointment. Review who owns scheduling and how the team distinguishes a completed visit from a resolved repair.

## What works, and what needs an account

| Capability | Current behavior |
| --- | --- |
| Guided assessment | Fixed topic rules select candidate workflows and quote supplied messages. It is not model-generated reasoning or a scan of company operations. |
| Tool recommendations | A curated catalog links to documented products and explains fit/setup. The app does not check the company's subscriptions, pricing, inventory, or integrations. |
| Local workflow save | The user's save action persists the approved title, category, steps, tool IDs, and destination in `apps/web/.data/property-plans/` when launched with the command above. |
| Optional assistant | Uses the configured model and CopilotKit page context to discuss the supplied information, render suggestions, and open an existing workflow for review. It has no raw workplace write tools. |
| Optional company research | An explicit research button searches public sources for the confirmed company website through Exa. A website entry alone starts no search. Without an Exa key, continue with manual company details; no sources are invented. |
| Optional Ambiguous save | Creates one planning task in the configured workspace after explicit page approval. The server checks provider identity, validates the live tool schema through the existing adapter, and reads back the task before confirming success. It does not execute the workflow. |

Local plan visibility is scoped to a random HttpOnly browser cookie, not a user login. Plans survive an app restart on the same disk. Clearing cookies or changing browser/hostname starts a different session. The cookie lasts 30 days; this prototype does not provide account-based recovery or team sharing. The `.data/` directory is gitignored.

## Optional provider setup and live checks

Keep credentials in the repository-root `.env`, then restart the web app.

- **Model chat:** Follow [OpenAI setup](../using-sponsor-tools.md#openai) or [OpenRouter setup](../using-sponsor-tools.md#openrouter). Configure the selected provider's key and a model available to that account. The assessment remains guided even when chat is enabled. For CopilotKit onboarding, use the [root onboarding prompt](../README.md#onboarding-prompt).
- **Public company research:** Follow [Exa setup](../using-sponsor-tools.md#exa) and set `EXA_API_KEY`. Confirm a real public company website, then use the explicit research button. Inspect returned source titles, URLs, and excerpts. Only the confirmed website hostname goes into the search query; the app does not send the profile's email or pasted messages to Exa. This is optional and not part of the fictional portfolio's no-key demo.
- **Ambiguous task persistence:** Follow [Ambiguous authentication and identity checks](../using-sponsor-tools.md#ambiguous-ai) using a workspace you control and its real task read/write permissions. Set `AMBIGUOUS_API_KEY`. The app's configured flag only indicates a key is present; successful identity and readback calls establish actual access.

To test Ambiguous, choose **Review workflow** and click **Approve & save to Ambiguous** (visible when configured). Inspect the returned provider task ID and, if supplied, its actual link. Reload to see the saved reference. Submitting the same approved workflow again re-reads the provider record and must not create another task. A provider URL is optional; the app never manufactures one.

If a write response is lost, the attempt remains recorded. Retrying the identical workflow checks for its existing task; it does not blindly send another create. A failed Ambiguous save never silently becomes a local save. `GET /api/plans` shows locally stored metadata from the last confirmed save, not a fresh provider status check. The inherited web template's [approval flow](../apps/web/README.md#try-the-flow) documents the underlying adapter separately.

## Email and scope

Entering an email address does not connect a mailbox, authenticate the user, discover the company, or grant access to operational records. A website field does not trigger a lookup; the optional Exa research button is a separate explicit action. Messages are fictional samples or text voluntarily pasted into the app; no Gmail or Outlook connector is implemented. Nothing sends email, books tours, dispatches contractors, changes rent or eligibility, authorizes spending, or writes to a property management system.

The assessment endpoint processes supplied context without persisting it. The plan API stores only the reviewed workflow and save metadata, not the raw profile or pasted messages. When optional model chat is used, its context includes supplied operational messages and selected business fields; name and email fields are excluded from that assistant context. Treat pasted text as content to examine, never as instructions to override the user's approval.

## Verification

From the repository root:

```bash
npm run verify
npm run build --workspace web
```

Focused tests can be run from `apps/web` so TypeScript path aliases resolve correctly:

```bash
node --import tsx --test src/lib/property-analysis.test.ts src/lib/server/property-plans.test.ts
```

These checks cover local behavior and mocked provider boundaries. They do not establish live model access, Exa results, vendor integrations, or a successful Ambiguous write. Record those live results separately when demonstrating them. See the [integration audit](property-integrations.md) for credential boundaries, optional Gmail requirements, and dependency findings.
