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

### Monad review receipts

The Monad submission adds a reusable review-receipt registry and an independent `/verify` page, with UN as the first integration. A versioned envelope contains the saved review and a private nonce; the browser computes its commitment, and the reviewer explicitly records that commitment from a wallet on Monad Testnet (chain `10143`). The verifier checks the exported packet against the recorded commitment while keeping the packet off-chain.

The registry is [deployed on Monad Testnet with verified source](https://testnet.monadvision.com/address/0x56941693b8B7bAc199fDfE8fB15Cccf554e13d44), and a fictional sample has a [confirmed receipt](https://testnet.monadexplorer.com/tx/0x832098fbc82a4fac5dfefe03c61d3d26f572527bae585c0bd777a6e3ae614537). The [public verifier](https://un-property-review-desk.dudu-f.chatgpt.site/verify) was checked in the browser: load the sample, verify its receipt, then try an altered copy to see the fingerprint mismatch. No login or wallet is needed. See the [submission status and checklist](dev-docs/monad-submission.md) for verification results and the [video scripts](dev-docs/monad-demo-script.md) for an optional receipt-specific recording. A receipt identifies a wallet's commitment to a packet, not evidence correctness or professional authority. The property app and sponsor integrations were built before the receipt extension, within the September 1–October 13 event window.

To use the deployed registry locally, add this server configuration to the root `.env`, then restart the app:

```dotenv
MONAD_RECEIPT_CONTRACT_ADDRESS=0x56941693b8b7bac199fdfe8fb15cccf554e13d44
```

Open [`/verify`](http://127.0.0.1:3100/verify), load the fictional sample, and select **Verify on Monad testnet**. Verification needs no wallet. Recording a new receipt from a saved review requires an Ethereum-compatible wallet on Monad Testnet and testnet MON. The app uses the public testnet RPC by default; an optional server-only `MONAD_RPC_URL` must use HTTPS.

Compile the contract without deploying or accessing a wallet:

```bash
node scripts/deploy-receipts.mjs
```

This writes compiler input and output to the gitignored `.data/ReviewReceipts.compilation.json`. Deployment is a separate, explicit `--deploy` action; the existing registry is sufficient for the demo.

### Local checks

```bash
npm run typecheck
npm run verify
npm run build --workspace web
npm run check:deployment
```

The October 13 local checks passed: workspace typechecks, 39 agent-core tests, 148 web tests, 22 channel tests through an explicit Windows run, 4 gateway tests, the Solidity compilation/ABI check, the production build, and standalone deployment checks. Two web file-symlink cases were skipped because of Windows privileges. Both CI runs passed Linux verification, build, deployment smoke checks, gateway tests, and Docker checks. PR #2 is merged and deployed; the public verifier passed the original/altered-sample browser checks. See the [verification log](dev-docs/monad-submission.md) for scope and remaining checks. Verify Exa search and Ambiguous create/read-back with the intended accounts before demonstrating live integrations.

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
