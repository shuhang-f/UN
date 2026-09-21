# UN

A property review desk for lease renewals, vacancies, and rent balances. Review dated records, save an evidence packet, search public sources with Exa, and save a reviewed packet and its prepared letter as a task in Ambiguous AI.

The portfolio contains seven fictional Los Angeles units. Property records and letter calculations use sample data. Exa search and Ambiguous task saves make real provider calls when configured.

## Get started

Use Node.js 22 or later. From the repository root:

```bash
npm ci
npm run dev:web
```

Open [UN](http://127.0.0.1:3100/). The review desk opens directly. Local review and export work without API keys.

For the **Tools** tab and Ambiguous task saves, add these server-only values to the root `.env` and restart the web app:

```dotenv
EXA_API_KEY=your-exa-key
AMBIGUOUS_API_KEY=your-workspace-key
```

See [tool setup and sponsor credits](dev-docs/un-tools.md) for account setup and verification. Model chat is optional and configured separately through the [model guide](dev-docs/model-switching.md).

## Try the review

1. Open Unit 04 and review its dated evidence and prepared letter. Confirm and save the packet.
2. In **Draft approvals**, review what will be saved and approve the Ambiguous task creation. Inspect the returned provider ID and read-back result.
3. Review the letter and record the manager's approval. This approval is saved locally; it does not send email or serve a notice.
4. Open **Tools** and search public sources with Exa. Open the returned source links to check their highlights.
5. Inspect Unit 12's conflicting records, or open **Leasing & rent** for vacancies and balances.

[Walkthrough and storage details](dev-docs/un-demo.md) · [Tool setup](dev-docs/un-tools.md)

UN does not connect a live property database or inbox. **Review records** recalculates the sample portfolio when clicked. The app binds to loopback by default; shared deployment requires authentication and persistent storage.

## Development

```bash
npm run typecheck
npm run verify
npm run build --workspace web
```

These are local checks. Verify Exa search and Ambiguous create/read-back with the intended accounts before demonstrating live integrations.

Supporting workspaces are available at [`/operations`](http://127.0.0.1:3100/operations), [`/advisor`](http://127.0.0.1:3100/advisor), and [`/agent`](http://127.0.0.1:3100/agent).

## Templates

UN builds on the [CopilotKit Agents, Everywhere starter kit](https://github.com/CopilotKit/agents-everywhere-starter-kit). The inherited app guides describe the original examples:

| Reference | Purpose |
| --- | --- |
| [Web guide](apps/web/README.md) | CopilotKit context, frontend tools, and the Ambiguous MCP adapter |
| [Slack guide](apps/channel/README.md) | Managed Channels setup |
| [Mobile guide](apps/mobile/README.md) | Expo setup and mobile example |
| [Sponsor reference](using-sponsor-tools.md) | Starter integrations and authentication |
| [Project instructions](AGENTS.md) | Repository conventions |
| [Hackathon overview](hackathon-overview.md) and [rules](hackathon-rules.md) | Event requirements |
| [Submission checklist](SUBMISSION.md) | Deliverables and attribution |

### Onboarding prompt

For CopilotKit setup in a new environment, the starter's onboarding prompt is:

```text
Help me get started with CopilotKit. Run this command and follow the instructions:

npx --yes copilotkit@latest onboard start
```
