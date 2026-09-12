<div align="center">

# Agents, Everywhere Hackathon Starter Kit

![Agents, Everywhere hackathon — OpenAI, CopilotKit, OpenRouter, Exa, Auth0, and Ambiguous AI](assets/banner.png)

**Build an agent that belongs where people already work, talk, and live.**

[Overview](#overview) · [Get started](#get-started) · [Templates](#templates) · [Coding agent](#coding-agent) · [Resources](#resources)

</div>

## UN: your property review desk

UN prepares renewal reviews for a fictional Los Angeles portfolio. Run `npm ci` and `npm run dev:web`, then open [UN](http://127.0.0.1:3100/). No API keys are required for the demo.

Enter any sample email and walk through a simulated document, email and database analysis. The seven-unit portfolio includes Unit 04's renewal in 30 days, two vacant units, an overdue balance and a pending payment. Review and save Unit 04's evidence, then send the confirmed packet through the mock Ambiguous AI workflow. The returned rent-adjustment letter waits for a separate manager approval, persisted in the local mock database. Inspect Unit 12's conflicting renewal records and overdue rent, or open Leasing & rent for the source-backed operations queue. The review runs when you open the desk or press **Run daily review**; it does not connect to a live inbox or run a background schedule.

See the [UN demo guide](dev-docs/un-demo.md) for setup, data storage, and a walkthrough. Existing operations workflows remain at [`/operations`](http://127.0.0.1:3100/operations) and the earlier workflow explorer is at [`/advisor`](http://127.0.0.1:3100/advisor).

## UN: vacancy and maintenance operations

UN’s operations workspace helps multifamily property managers review vacancy and maintenance messages, choose a workflow, and save an approved plan. Run `npm ci` and `npm run dev:web`, then open [UN operations](http://127.0.0.1:3100/operations). The homepage combines renewal drafting, manager approvals, leasing readiness and rent-balance review.

Choose **Try a sample portfolio** for a demonstration without API keys. Guided assessment, local workflow saves, and existing-product links work without external accounts. Model chat, public company research through Exa, and Ambiguous task saves are optional configured capabilities; no inbox or property-management platform is connected.

See the [three-minute demo and setup guide](dev-docs/property-demo.md) and [integration capabilities and boundaries](dev-docs/property-integrations.md). The original starter instructions follow below.

For the UN homepage's product direction, see the [bus ticket theory review](dev-docs/bus-ticket-product-review.md): the source essay, current implementation findings, and a proposed workflow for investigating discrepancies and retaining confirmed resolutions.

## Overview

Build for **[Agents, Everywhere: Bots, Channels, & More](https://aitinkerers.org/hackathons/global/agents-everywhere)**, the AI Tinkerers global hackathon on **September 12–13, 2026**. Choose your city on the event page for its local schedule. Put an agent inside a conversation, an app, a phone, or a physical environment. Make the context of that place essential to what it can do.

This kit gives you three runnable templates, files to hand to your coding agent, and sponsor setup notes. Pick a user, a problem, and one complete interaction. You can use any stack; you do not need every sponsor or every surface.

Your project and its core functionality must be created during the event. Existing libraries, templates, and starter code are allowed; describe what you reuse and what you build. Read [the rules](hackathon-rules.md), then follow your city's participant portal for the current deadline and judging criteria.

## Get started

### Onboarding Prompt

For web, paste this into your coding agent:

```text
Help me get started with CopilotKit. Run this command and follow the instructions:

npx --yes copilotkit@latest onboard start
```

For Slack, follow [Channels setup](apps/channel/README.md#get-started). For React Native, follow the [Expo setup instructions](apps/mobile/README.md#get-started).

## Templates

These starting points serve different kinds of context. **CopilotKit Channels** brings the Slack agent into the conversation; **CopilotKit React** connects the web agent to the app people are using; **CopilotKit React Native** brings the same agent pattern onto a phone.

### 1. Slack — an agent that joins the thread

**OpenAI + CopilotKit Channels + Exa**

An agent reads what people already said, researches with Exa, and answers in the same thread with native cards and source links. Start with a support conversation, a research discussion, or a team decision.

The included Slack app supplies thread history, subscriptions, search, and Channels UI. Configure your model, Exa, and a managed Channel, then run `npm run dev:slack`. No public tunnel is needed. Teams or other chat platforms can use the same Channels pattern, but this starter ships the Slack app.

**[Use the Slack template →](apps/channel/)**

### 2. Web — an agent inside your app

**OpenAI + CopilotKit React + Ambiguous AI**

An agent sees the page you are on and turns a request into a real workplace record you can still find after a refresh. Adapt it to customer follow-ups, a project workspace, or a personal planning app.

The included web app supplies page context, frontend tools, agent-rendered UI, and a browser approval step. Connect an Ambiguous AI workspace, then run `npm run dev:web`; approved follow-ups are saved through the server and can be read back after refresh.

**[Use the web template →](apps/web/)**

### 3. React Native — an agent in your pocket

**OpenAI or OpenRouter + CopilotKit React Native**

A mobile agent reads app state, renders native cards, and waits for a tap before changing local sample data. Start with a personal finance assistant, a field checklist, an inventory counter, or any workflow where phone context and approval matter.

The included Expo app supplies seeded finance state, native rendered tool UI, a human-in-the-loop expense approval, and a mobile-specific CopilotKit runtime endpoint served by the web app. Configure your model provider, start `npm run dev:web`, then run the mobile app from `apps/mobile`.

**[Use the React Native template →](apps/mobile/)**

### Make the demo yours

The supplied on-call and finance assistants are **infrastructure examples**: read ambient context, call a tool, render useful UI, and return a verifiable result. Choose a different user, problem, dataset, and interaction; the goal is your own project, not another version of the starter scenario.

Use the [demo prompts](dev-docs/demo-prompts.md) to learn how the pieces connect, then replace the sample domain. In the Slack sample incident flow, approval cards record decisions without executing production actions. In the web follow-up flow, the page approval button saves the reviewed Ambiguous task. In the mobile finance flow, approval changes local in-memory sample data. Enforce the same kind of write boundary around any external action you add.

Want another surface pattern? The web app also includes a voice route, and the shared agent can connect to remote MCP tools when configured. The event surfaces are inspiration, not separate tracks or a requirement to build multiple apps.

## Coding agent

Give your agent these files before it starts coding:

| File | What it provides |
|---|---|
| [hackathon-overview.md](hackathon-overview.md) | The challenge, four surfaces, and official judging criteria |
| [hackathon-rules.md](hackathon-rules.md) | Build eligibility, inherited code, and required deliverables |
| [using-sponsor-tools.md](using-sponsor-tools.md) | Every sponsor featured in this kit: access, authentication, configuration, and a first working call |
| [AGENTS.md](AGENTS.md) | Repository conventions and verification commands |
| [Channels skill](.agents/skills/build-channels-agent/SKILL.md) | Verified Channels APIs for the Slack template |

The app READMEs provide launch commands, files to customize, and a concrete result to check. Start with one template and add a second surface only if it helps your user.

## Resources

| Need | Go here |
|---|---|
| Event details, deadline, and judging | [Find your city](https://aitinkerers.org/hackathons/global/agents-everywhere), then open its participant portal and handbook |
| OpenAI agent development | [Agents SDK quickstart](https://openai.github.io/openai-agents-js/guides/quickstart/) |
| OpenRouter access and model choice | [Quickstart](https://openrouter.ai/docs/quickstart) · [Keys](https://openrouter.ai/keys) · [Model catalog](https://openrouter.ai/models) · [Model switching](dev-docs/model-switching.md) |
| CopilotKit app development | [Docs](https://docs.copilotkit.ai/) · [Tools and context](dev-docs/tools-and-context.md) · [Discord channel for technical questions](https://discord.com/channels/1122926057641742418/1548038338848489532) |
| CopilotKit Channels | [Channels guide](https://copilotkit.ai/channels-guide.md) · [Screenshot walkthrough](dev-docs/channels-sdk-walkthrough/README.md) · [OpenTag example app](https://github.com/CopilotKit/OpenTag) |
| Exa quickstart | [Search API guide](https://exa.ai/docs/reference/search-api-guide) · [Kit setup](using-sponsor-tools.md#exa) |
| Auth0 API authorization | [Node API](https://auth0.com/docs/quickstart/backend/nodejs) · [Kit setup](using-sponsor-tools.md#auth0) |
| Ambiguous AI quickstart | [Developer guide](https://www.ambiguous.ai/llms.txt) · [Kit setup](using-sponsor-tools.md#ambiguous-ai) |
| Rehearse and debug | [Demo prompts](dev-docs/demo-prompts.md) · [Troubleshooting](dev-docs/troubleshooting.md) |
| Prepare your entry | [Submission checklist](SUBMISSION.md) |

For credit redemption instructions, choose your city on the [global event page](https://aitinkerers.org/hackathons/global/agents-everywhere) and check its participant portal's **Credits & Offers** section.

For technical questions during the event, check your city's participant portal and ask your local organizers.

For the Slack/web workspaces, `npm run verify` runs typechecks and offline tests without credentials. The mobile app has its own install, tests, typecheck, and Metro export checks under `apps/mobile`. Each app reports missing configuration when the relevant integration is used. Live sponsor calls and platform delivery require your accounts. See [developer docs](dev-docs/README.md) for detailed setup and deployment.
