# UN tools and sponsor access

UN uses Exa for public web research and Ambiguous AI for saving reviewed work. Both integrations run on the server. The property portfolio remains sample data.

## Configure

Add the following to the repository root `.env`, then restart `npm run dev:web`:

```dotenv
EXA_API_KEY=your-exa-key
AMBIGUOUS_API_KEY=your-workspace-key
```

Keep keys out of browser code, `NEXT_PUBLIC_` variables, logs, and Git. Each provider can be configured independently. No model key is required for these direct tools; optional conversation uses the separate [model configuration](model-switching.md).

The **Tools** tab displays configuration state. `GET /api/integrations` reports whether credentials are present; it does not validate keys, check remaining credits, or establish a live connection. Successful search and task read-back establish access to the respective services.

## Exa: search public sources

Create a key in the [Exa dashboard](https://dashboard.exa.ai/api-keys) and set `EXA_API_KEY`.

In **Tools**, enter a query and run the bounded search. Results contain provider-returned titles, links, and highlights. Open the links to check the evidence. Only the submitted public query is needed; do not include private tenant details. Search results do not change a review's calculations or automatically become confirmed evidence.

UN calls Exa's documented search endpoint with a 45-second abort deadline. The installed SDK does not expose request cancellation, so the shared search capability uses native `fetch`. See the [search reference](https://exa.ai/docs/reference/search).

## Ambiguous AI: save a reviewed packet

Open the intended [Ambiguous workspace](https://app.ambiguous.ai/) and follow its **Connect** instructions to obtain an API key with task read/write access. Set that value as `AMBIGUOUS_API_KEY`. This is UN's environment variable; the vendor CLI manages its credentials separately. Use the [authentication guide](https://www.ambiguous.ai/auth.md) to check identity or resolve permissions.

UN reuses the existing [workplace adapter](../apps/web/src/lib/server/workplace.ts) and the MCP endpoint `https://app.ambiguous.ai/mcp`. Tool schemas and record links come from the provider.

1. Review and save a unit's evidence packet locally.
2. Inspect the packet and its already prepared letter in **Draft approvals**.
3. Explicitly approve saving the task to Ambiguous.
4. Check the returned task ID and read-back result. Open the provider link when one is returned.
5. Record the manager's letter approval separately in UN.

The external action saves a task containing the reviewed material. Ambiguous is not generating or emailing the letter. A manager approval remains local, and a failed provider call must not be presented as a successful save.

Retries use a saved attempt marker and read back the same task instead of blindly creating another. If a write's outcome is unknown, the attempt remains blocked even after a restart. Retry the same review to reconcile it; if it stays unresolved, inspect the workspace. Only after confirming no task exists should you save a new reviewed version with an updated note. A task that cannot be verified on refresh remains visible with its last verification time and a warning; it does not block other reviews.

See the [MCP guide](https://www.ambiguous.ai/agents/mcp), [live API schemas](https://app.ambiguous.ai/api/openapi.json), and [starter sponsor instructions](../using-sponsor-tools.md#ambiguous-ai).

## Credits and offers

Checked September 13, 2026. For event offers, sign in to the [Los Angeles participant portal](https://la.aitinkerers.org/hackathons/h_6xwsooXcdbo) and open **Credits & Offers**. Complete the participant survey if required. Redeem through the portal and verify the resulting balance in the provider account before relying on it. Private redemption links and individual codes do not belong in this repository.

| Provider | Available access |
| --- | --- |
| Exa | The participant portal includes a redemption offer; it does not state the amount. Exa's public free plan separately advertises $20 on signup and $10 monthly, with no payment method required. |
| Ambiguous AI | No event-specific credit offer was listed. The public free plan includes up to five teammates, counting humans and agents, and 1,000 AI actions per month. Routine CRUD by external agents using their own model is free; premium operations may consume actions. |
| OpenRouter | The participant portal provides an individual redemption code. These credits can support optional model chat after configuring OpenRouter. |
| OpenAI | The portal offer is 1,250 Codex credits, valued at $50. It expressly excludes API credits, so it does not fund UN's model API calls. The listed redemption deadline is September 26, 2026 UTC, with credits expiring after 30 days. Check the portal's current terms. |

Public plan details: [Exa pricing](https://exa.ai/pricing) and [Ambiguous pricing](https://www.ambiguous.ai/pricing.md). The event's Exa prizes are competition awards and should not be treated as an existing account balance.

## Check a live setup

- Run an Exa query and inspect its returned source links and highlights.
- Save one explicitly approved review task to the intended Ambiguous workspace and verify the same provider ID through read-back.
- Reload UN and confirm local review and manager approval history remain available.
- Check provider usage or credits in the provider dashboard. UN does not display those balances.

Local typechecks and tests do not verify account access or redeem credits. Keep the credential-backed development server on loopback until shared deployment has authentication, trusted-origin checks, and persistent storage.
