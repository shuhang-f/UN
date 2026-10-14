# UN — Verifiable Property Reviews

Submission record for the Monad Metropolis Trust / Identity / AI track. The participant portal shows **5/5 checklist items** complete and displays **“Submission ready for judging”** and **“Judges will review your latest saved entry after the deadline.”** The receipt registry is deployed on Monad Testnet. The checklist below distinguishes verified results from remaining checks.

The team's updated portal strategy was preserved. With the user's approval, a short **“Built for this submission”** receipt paragraph was appended and saved. The portal describes a proposed housing-availability network; that proposed product is not implemented by this receipt module. The technical reference below is not a verbatim copy of the portal's current one-liner, description, or go-to-market text.

## Receipt module technical reference

**Technical module:** UN — Verifiable Property Reviews

**Technical summary — 187 characters:**

> A reusable Monad receipt registry and independent verifier for exact review packets, with UN as the first property-review app. Keep evidence private and make review commitments checkable.

**Description:**

UN's Monad module is a reusable review-receipt registry and a portable verifier. It records a wallet's commitment to an exact review packet. Other applications can use the same small contract and verification flow; UN's property desk is the first integration.

A reviewer checks a saved packet and chooses to record its commitment on Monad Testnet. The versioned envelope contains the saved review, the decision `reviewed`, and a private random nonce. The server prepares the commitment, and the browser independently computes it before requesting a wallet transaction. Only the commitment is recorded on-chain, alongside the submitting wallet and the recording time. After confirmation, the reviewer can download the envelope and receipt together.

The independent `/verify` page checks an exported envelope against the on-chain receipt. The packet is hashed in the browser; the verification API receives only its commitment and receipt metadata. Changing a reviewed field changes its commitment, making an altered copy detectable. JSON whitespace and object key order do not affect the commitment.

The primitive establishes a wallet's review commitment. It does not establish the truth of the evidence, the reviewer's real-world identity or professional authority, or legal compliance. The demonstration uses UN's fictional property portfolio.

**Verified status:**

The receipt registry is deployed on Monad Testnet at `0x56941693b8b7bac199fdfe8fb15cccf554e13d44` (chain `10143`). Source verification reports exact creation and runtime bytecode matches, and the explorer displays **“Contract Source Code Verified Full Match.”** A fictional sample packet has a confirmed live receipt, verified through the receipt API and both local and public hosted browser verifiers. The public browser displays “Receipt verified” for the sample without a login or wallet; an altered copy produces a fingerprint mismatch without requesting a blockchain check. The live contract check confirms duplicate and empty-commitment rejection. The wallet flow is implemented; interactive browser-wallet checks remain unperformed. The existing UN app uses sample property records. Exa search makes real provider calls; Ambiguous task saving is implemented, but a live task creation has not been verified for this submission.

## Why this track

The submission's reusable component is the registry, with a reference envelope and verifier: a minimal ABI, a documented encoding, and a check that works without trusting UN's application database. The contract accepts a commitment from any application. UN supplies the first concrete packet producer. The current verifier supports the `un-review-receipt/v1` envelope and inspects an exported packet independently of the original review screen. Another domain can reuse the contract and adapt the reference envelope schema.

The contract's attribution is to a wallet. The envelope's `reviewed` decision records an acknowledgment of a specific packet, not an authorization to send a notice or change rent. No token, payment flow, identity oracle, or additional sponsor service is required.

## Technical scope

| Part | Implementation |
| --- | --- |
| Generic contract | `contracts/ReviewReceipts.sol`; `record(bytes32 commitment)` |
| Receipt event | `ReviewRecorded(address indexed reviewer, bytes32 indexed commitment, uint256 recordedAt)` |
| Duplicate handling | A given reviewer/commitment pair is recorded once |
| Envelope | Version `un-review-receipt/v1`, decision `reviewed`, a private 32-byte nonce, and the saved review |
| Hashing | Keccak-256 of UTF-8 canonical JSON: object keys sorted lexically, array order retained, JSON number encoding |
| Verification | Independent `/verify`; `/api/receipts/verify` receives commitment and receipt metadata, not private packet contents |
| Network | Monad Testnet, chain ID `10143`, native currency MON |
| RPC | `https://testnet-rpc.monad.xyz` |
| First application | UN property review desk with fictional source records |

Only claim a confirmed receipt after checking transaction success, the contract, event fields, signer, commitment, and receipt lookup. A wallet signature, submitted transaction hash, or successful local test alone does not establish an on-chain result.

Local setup uses the root `.env` setting `MONAD_RECEIPT_CONTRACT_ADDRESS=0x56941693b8b7bac199fdfe8fb15cccf554e13d44`; restart the web app after setting it. The default RPC is the public testnet endpoint above. An optional server-only `MONAD_RPC_URL` must use HTTPS. `node scripts/deploy-receipts.mjs` compiles only and writes `.data/ReviewReceipts.compilation.json`; it does not access a key or submit a transaction unless explicitly run with `--deploy`.

## Work and attribution

- **Inherited:** the MIT-licensed [CopilotKit Agents, Everywhere starter](https://github.com/CopilotKit/agents-everywhere-starter-kit), including model and workplace integration infrastructure.
- **UN work before the receipt extension:** property review and sample portfolio work committed September 12, 2026; real sponsor-tool integration merged September 20, 2026 (`36f1d27`). Both dates fall within the Monad event window of September 1–October 13, 2026. This work preceded the Monad receipt extension and should be attributed separately from it.
- **Receipt extension for this submission:** the generic receipt contract, versioned private review envelope, wallet recording flow, independent verifier, and receipt-focused tests and documentation. The checklist distinguishes implementation from demonstrated live behavior.

The older root [submission checklist](../SUBMISSION.md) describes the September AI Tinkerers event. This file describes the Monad submission; do not reuse the earlier event's eligibility or completion claims.

## Receipt pilot reference

This earlier receipt-focused pilot proposal is retained as a technical planning reference. It does not replace or reproduce the team's saved portal strategy.

Start with small property operations teams that already review renewal packets and need to preserve which version a reviewer checked. The proposed pilot pairs UN's review desk with an exported receipt that an owner or colleague can verify later. Test whether the version check is useful during handoffs and whether wallet signing adds acceptable friction before expanding the product.

Recruit a small number of design partners for supervised pilots using fictional or consented records. Measure completed reviews, successful independent verifications, time spent resolving version disputes, and willingness to keep using the workflow. If those pilots show value, test a team subscription for the review workflow and support. Keep receipt verification accessible to recipients; do not require them to adopt the full property app.

This is a proposed plan. No customer count, revenue, paid pilot, partnership, or measured time saving is claimed. A later integration kit could serve other document-review applications after the reference flow is validated; the current verifier supports UN's versioned envelope.

## Selected video and judge walkthrough

Both saved video fields use the [original UN prototype walkthrough](https://www.loom.com/share/ebc670ceadb14f6caa20623eec5e4040), approximately **4 minutes 49 seconds**. It shows an older property-review prototype and does **not** demonstrate the new Monad receipt or verifier flow. The user chose to reuse it; it exceeds both the two-minute pitch and three-minute technical-demo limits. The portal's saved/ready status does not remove these content limitations.

The [shorter recording scripts](monad-demo-script.md) remain available if a receipt-specific recording is made. The walletless judge path is `/verify` with a downloadable fictional example backed by a real testnet receipt. Live API, local browser, and public hosted browser verification passed. Publishing the fictional example also publishes its envelope and nonce; private user exports are not public samples.

**Judge access instructions:** Open https://un-property-review-desk.dudu-f.chatgpt.site/verify, choose **Load sample receipt**, then **Verify on Monad testnet**. No wallet, account, or testnet funds are needed to verify. After the confirmed result, choose **Try an altered sample** to see a changed packet fail the local fingerprint check. The example contains fictional property records; its real testnet transaction is linked from the result. A wallet with testnet MON is needed only to record a new receipt from a saved review.

## Submission evidence

| Field | Value |
| --- | --- |
| Repository | https://github.com/shuhang-f/UN |
| Receipt code | [Pull request #2](https://github.com/shuhang-f/UN/pull/2), merged `2026-10-14T03:17:09Z`; main merge commit `18d541945be404141d0ba7ac80a510cdfad5e603` |
| CI | Both runs passed Linux verification, build, deployment smoke checks, gateway tests, and Docker checks |
| Railway deployment | `c415345a-1689-40b0-b411-f55a9d53fdc1` — ACTIVE, “Deployment successful”, from merge commit `18d541945be404141d0ba7ac80a510cdfad5e603` |
| Portal status | Save Progress confirmed; 5/5 checklist items complete; “Submission ready for judging”; team strategy preserved and approved receipt paragraph appended and saved |
| Live application | https://un-property-review-desk.dudu-f.chatgpt.site — public proxy to the protected app; access confirmed October 13, 2026 |
| Independent verifier | https://un-property-review-desk.dudu-f.chatgpt.site/verify — sample confirmed and altered sample rejected in the public browser without login or wallet |
| Contract address | `0x56941693b8b7bac199fdfe8fb15cccf554e13d44` on Monad Testnet, chain `10143` |
| Contract explorer | https://testnet.monadexplorer.com/address/0x56941693b8b7bac199fdfe8fb15cccf554e13d44 |
| Verified source | https://testnet.monadvision.com/address/0x56941693b8B7bAc199fDfE8fB15Cccf554e13d44 — service confirms exact creation/runtime matches; browser confirms “Contract Source Code Verified Full Match” |
| Successful review transaction | https://testnet.monadexplorer.com/tx/0x832098fbc82a4fac5dfefe03c61d3d26f572527bae585c0bd777a6e3ae614537 |
| Reviewer wallet | `0x27123352229cCdCF471BB6152E54E6dAbD5FF021` — testnet demonstration account |
| Receipt commitment | `0xd04443650bae86c436c711ad498776a149c2cd64d55b36fa2fdaa7e8c07cdc1d` |
| Receipt block / time | `70853978` / `2026-10-14T03:01:23.000Z` (October 13, 20:01:23 PDT) |
| Fictional example | `apps/web/public/examples/review-receipt.json`; public URL `/examples/review-receipt.json` |
| Selected video | https://www.loom.com/share/ebc670ceadb14f6caa20623eec5e4040 — older prototype; approximately 4:49; does not show Monad receipts |
| Pitch video, at most 2 minutes | No separate compliant recording confirmed; selected older video exceeds this limit |
| Technical demo, at most 3 minutes | No separate compliant recording confirmed; selected older video exceeds this limit |
| Logo | `assets/un-logo.png` — 512 × 512; editable source at `assets/un-logo.svg` |

- [x] Contract compiles and the contract ABI check passes.
- [x] Application typechecks and regression checks pass: 39 agent-core tests, 148 web tests, 22 channel tests through an explicit Windows run, 4 gateway tests, and 1 contract check; 2 Windows file-symlink tests skipped.
- [x] Production build and standalone health, authentication, CSRF, secure-session, restart, and fail-closed configuration checks pass.
- [x] Both CI runs pass; PR #2 merged and Railway reports its deployment ACTIVE and successful.
- [x] Contract deployed to Monad Testnet; confirmed address recorded above.
- [x] Contract source verification service reports exact creation and runtime bytecode matches; explorer UI confirms Full Match.
- [x] Testnet demonstration wallet records a fictional sample packet; transaction succeeds and event fields match through the receipt API.
- [x] Portable verification API accepts the original commitment and metadata, rejects the commitment of a changed packet, and returns no private packet data.
- [x] Local browser verifier accepts the original sample and displays “Receipt verified”.
- [x] Public fictional example loads and verifies without a wallet or app credentials.
- [x] Local browser **Try an altered sample** produces a fingerprint mismatch and does not request a blockchain check.
- [x] Public hosted browser **Try an altered sample** produces the same local mismatch without a blockchain request.
- [x] Public app saves a fictional Unit 04 review and displays the configured receipt contract and stable commitment. With no wallet in the browser, it shows “Not recorded” and “No wallet detected”, with Connect wallet disabled.
- [x] Live contract simulation rejects the same reviewer/commitment with `AlreadyRecorded` and a zero commitment with `EmptyCommitment`.
- [x] Confirmed receipt persists after a local API reload.
- [x] Automated receipt checks reject wrong networks and unconfirmed/reverted or mismatched transactions.
- [ ] Browser wallet-network switching and rejected wallet requests are exercised interactively.
- [ ] Browser network inspection confirms private packet contents and nonce stay off the verification API and chain.
- [ ] Submission repository, app, verifier, and video links are accessible to judges.
- [x] Submission documentation identifies prior work, fictional data, and the reused video's limitations.
- [x] Portal Save Progress confirms 5/5 checklist items complete and “Submission ready for judging”.
- [x] Updated team strategy preserved; user-approved receipt paragraph appended and saved.

**Verification log:** October 13, 2026, 20:01 PDT: `node --import tsx scripts/check-receipts-live.mjs` completed against the local app and the deployed Monad Testnet registry. The testnet transaction above succeeded. Local packet hash, receipt API read-back, portable API verification, changed-packet rejection, empty/duplicate revert simulation, and persistence checks passed. This command uses the gitignored local testnet key and private checkpoint; neither belongs in the submission. The checked-in example contains only fictional records and public receipt data. Browser-wallet interaction was not part of this script.

The subsequent `npm run verify` completed successfully: workspace typechecks passed; agent-core reported 39 passed; web reported 148 passed and 2 skipped; the Solidity compilation/ABI test passed. The workspace command discovered no channel tests on Windows; an explicit Windows channel run then passed all 22 tests. All 4 gateway tests also passed. Both skipped web cases require Windows file-symlink privileges; directory-junction checks still ran. The main verification log is local `.data/monad-verify.log`.

`npm run build --workspace web` completed successfully. `npm run check:deployment` passed standalone health, authentication, CSRF, secure-session, restart, and fail-closed configuration checks. The local logs are `.data/monad-build.log` and `.data/monad-deployment-check.log`. Both CI runs also passed Linux verification, build, deployment smoke checks, gateway tests, and Docker checks. PR #2 merged at `2026-10-14T03:17:09Z`.

Local browser testing loaded the fictional sample, displayed **Receipt verified**, and showed a local mismatch for **Try an altered sample** without requesting a blockchain check. After Railway reported deployment `c415345a-1689-40b0-b411-f55a9d53fdc1` ACTIVE and successful, the same browser sequence passed at the public Sites `/verify` URL with no login or wallet. The verified transaction matched `0x832098fbc82a4fac5dfefe03c61d3d26f572527bae585c0bd777a6e3ae614537`. A further hosted UI check saved a fictional Unit 04 review and confirmed the receipt card's configured contract, stable commitment, “Not recorded” state, “No wallet detected” message, and disabled Connect wallet button. Interactive browser-wallet signing remains outside these checks.

At `2026-10-14T03:10:58Z`, the documented Monad BlockVision Sourcify service completed source verification with `creationMatch: exact_match` and `runtimeMatch: exact_match`. Public job metadata is saved locally in `.data/contract-source-verification.json`: verification ID `729dcaed-2ae6-4fee-ac8e-91a7168b42fa`, match ID `2054262`. Subsequent browser inspection of the contract explorer confirmed **“Contract Source Code Verified Full Match.”**

## Official references

[Monad developer summary](https://docs.monad.xyz/developer-essentials/summary) confirms EVM tooling and Viem support. [Monad's Hardhat guide](https://docs.monad.xyz/tooling-and-infra/toolkits/hardhat) supplies the current compiler and network setup. [Testnet information](https://docs.monad.xyz/developer-essentials/testnet) supplies faucet and network references. [Viem's Monad Testnet definition](https://github.com/wevm/viem/blob/main/src/chains/definitions/monadTestnet.ts) confirms chain ID, MON, RPC, and explorer configuration.
