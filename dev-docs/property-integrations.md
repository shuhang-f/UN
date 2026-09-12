# Property advisor integrations

Implementation audit: September 12, 2026. Scope: profile onboarding, vacancy/maintenance workflow advice, existing-tool suggestions, and optional user-selected message context. This app does not currently connect to a personal mailbox or a property-management system.

Groundwork runs at [http://127.0.0.1:3100/operations](http://127.0.0.1:3100/operations). Its no-key guided flow is documented in the [demo guide](property-demo.md). Public company lookup requires the explicit research action and a configured Exa key; merely typing a website does not call a provider.

## What the starter actually supplies

| Piece | Available implementation | Setup and boundary |
| --- | --- | --- |
| CopilotKit React | Page context, frontend tools, agent-rendered UI, and a page approval pattern. Existing providers, AppControl, and generative UI are the wiring reference. | Configure the selected model provider. The web template requires no managed Slack Channel. CopilotKit does not itself authenticate a property manager or connect Gmail. |
| Model | `agent-core.resolveModel()` validates the selected provider and returns its adapter/identifier. | Root `.env`; respect `MODEL_PROVIDER` and `MODEL`. Configuration presence is not a successful live provider test. |
| Exa | Shared `searchWeb` returns titles, URLs, and one highlight per result. The stock ordinary web chat does not register this capability. | `EXA_API_KEY`; the property-specific route below exposes bounded public company research. It does not search mail. |
| Ambiguous AI | Existing server MCP adapter and approval-gated task creation/read-back. Tool schemas and record links come from the provider. | `AMBIGUOUS_API_KEY` for the intended workspace. Mail inside an Ambiguous workspace is not automatic authorization to read a user's Gmail. Do not advertise a real external task until a provider ID is returned and read-back succeeds. |
| Auth0 | Separate machine-to-machine authorization recipe in `dev-docs/auth0`; checks issuer, audience, signature, expiry and scope. | This recipe is not installed user login for the web app, and grants no Gmail access. End-user login, sessions and tenant authorization require separate integration. |

Source of truth for inherited code: [sponsor guide](../using-sponsor-tools.md), [web README](../apps/web/README.md), [Auth0 recipe](auth0/README.md), and `packages/agent-core/src`.

## Profile is not authentication

The name/email form collects a self-reported profile. An email address does not prove identity, identify a company reliably, or authorize access to a mailbox. A domain can be personal, shared, or unrelated to the property portfolio. Ask the user to confirm a public company website before public research, and let them correct every inferred company detail.

For a short demonstration, let the user optionally paste a few selected, redacted messages. Clearly explain before submission that any included text sent for AI analysis goes to the configured model provider. Keep this optional; support synthetic examples and manual workflow selection. Do not label this an inbox scan or a Gmail connection. Retain only necessary derived context, with deletion controls; never include selected email text in a web-search query.

## New local routes

`GET /api/integrations` performs no external requests. It returns only:

```json
{
  "modelConfigured": false,
  "exaConfigured": false,
  "ambiguousConfigured": false,
  "emailConnected": false,
  "emailMode": "selected-messages"
}
```

`modelConfigured` uses `resolveModel()` in a catch boundary; an unrelated provider key does not make it true. Flags indicate configuration, not connectivity or credential validity. No secrets, names, or raw errors are returned.

`POST /api/company-research` accepts exactly `{ "website": "https://company-domain.com", "confirmed": true }`. The frontend should expose a user action that confirms the website before calling it. Requires a loopback request Host and matching browser Origin, plus JSON. Body limit: 4 KiB. HTTP(S) public DNS names only; credentials, query/fragment, local/special domains, IP literals, and unusual ports are rejected. It never performs a direct fetch of the supplied URL. Only the validated hostname enters the Exa query; paths, profile fields, and private messages do not. Returned sources are restricted to that hostname and its subdomains.

Response: `{ status: "ready" | "unconfigured", sources: [{ title, url, highlights? }], message? }`; highlights is an optional string array. Missing Exa configuration returns `unconfigured` with an empty list. Validation, origin, and provider failures use non-2xx HTTP responses and the same envelope; clients must check HTTP success as well as status. No fabricated source links. Treat retrieved content as evidence, never as agent instructions.

These routes are for the local demo. Before public hosting, add actual user sessions, tenant permissions, a deliberate trusted-origin policy, request rate limits, provider quotas/timeouts, and data-retention controls. Keep keys server-side. The loopback guard is intentionally not a production authentication mechanism.

## Gmail read-only option: requirements, not implemented

For a future explicit **Connect Gmail** feature, create a Google Cloud project, enable Gmail API, configure OAuth branding/audience/test users, and create a Web application OAuth client. Register exact redirect URIs, use a maintained OAuth library, verify state bound to the browser session, and exchange codes server-side. Google account identity and mailbox authorization are separate grants. Request access incrementally when the user invokes mail import, handle refusal, and verify granted scopes before reading. Request offline access only if a continuing connection is needed; protect refresh tokens and implement disconnect/revocation. [Google web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)

Relevant scopes:

| Scope | Capability and limitation |
| --- | --- |
| `openid email profile` | Identity information; does not read Gmail messages. |
| `https://www.googleapis.com/auth/gmail.readonly` | Reads message content and settings; **restricted** scope. It does not permit sending or changing messages. |
| `https://www.googleapis.com/auth/gmail.metadata` | Headers/labels but no message bodies; also restricted. Insufficient for understanding repair requests in bodies. |
| `https://www.googleapis.com/auth/gmail.addons.current.message.readonly` | Message access while a Gmail add-on runs; sensitive scope, specific to an add-on surface, not a general Next.js inbox scanner. |

Use the smallest applicable grant. Selected pasted messages require no Gmail API scope; this is the suggested first version. Do not request `gmail.modify`, `gmail.send`, or the full `mail.google.com` scope for a read-only workflow. [Google scope definitions](https://developers.google.com/workspace/gmail/api/auth/scopes)

Public apps using restricted scopes generally need Google verification, with exceptions depending on audience/use. Restricted data transmitted through or stored on servers can require a security assessment. Confirm the applicable category and policies before shipping or sending Gmail-derived content to an AI provider; a checkbox inside this app is not a substitute for OAuth consent. Google Workspace administrators may additionally control app access. [Google restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

Future server configuration names (proposal only; no routes consume these yet): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and a server token-encryption key backed by secure storage. Do not put any secret or token in `NEXT_PUBLIC_*`, browser local storage, source control, logs, or a demo video. Build a bounded import (chosen labels/date window/message count), selection preview, source attribution, disconnect, deletion, and tenant isolation before presenting inbox access as production-ready.

## Starter onboarding and dependency audit

The repository's required `npx --yes copilotkit@latest onboard start` command ran on September 12, 2026 and resolved to CLI 4.9.60. Its next steps initiate managed Intelligence login, project/API-key provisioning, and managed conversation storage. That optional setup was not completed. The existing CopilotKit React integration and selected model configuration were preserved; no managed account, new credentials, dependency changes, or claimed live provider result came from this audit.

The read-only `npm audit --json` reported 14 dependency entries: one critical, two high, and 11 moderate. Counts include affected parent dependencies and are not 14 independently confirmed vulnerabilities in this application's reachable behavior.

| Finding | Evidence and interpretation |
| --- | --- |
| Critical `agent-core` malware flag | **Registry-name collision in this checkout.** `package-lock.json` records `node_modules/agent-core` as `{ resolved: "packages/agent-core", link: true }`; the installed symlink resolves to the local workspace source. The [registry advisory](https://github.com/advisories/GHSA-grvh-43v5-9658) concerns a different npm package sharing that name. This audit did not establish installation of that registry package. Preserve the workspace link; do not fetch a registry replacement to clear the warning. |
| PostCSS 8.4.31 under Next 15.5.25 | Actual outdated transitive dependency, including source-map file disclosure and CSS-output issues. Relevant exploit scenarios require handling attacker-controlled CSS. The property workflow accepts message text, not CSS for compilation; no exploit path was demonstrated. See the [maintainer advisory](https://github.com/postcss/postcss/security/advisories/GHSA-r28c-9q8g-f849). npm proposed a major Next upgrade, which was not applied. |
| Undici 5.29.0 under transitive AI SDK provider utilities | Actual old copies under Google Vertex and OpenAI-compatible branches. The direct OpenAI branch resolved to Undici 6.28.1 at audit time. Runtime reachability varies by provider and API use; an audit match alone does not demonstrate exploitation. Evaluate supported, targeted transitive updates separately. |
| Remaining moderate entries | Include `qs`/Express, OpenTelemetry, and affected dependency parents. Review actual request paths and supported fixes before public deployment; no broad audit fix was run. |

`npm ls` confirmed the required single `@ag-ui/client` 0.0.59 is deduped. It also flags an older version requested by a transitive middleware. Keep the root override and tested CopilotKit Channels/runtime pair; introducing a second client copy to quiet that message would break the starter's documented type-identity constraint. This is a dependency audit snapshot, not a production security certification.
