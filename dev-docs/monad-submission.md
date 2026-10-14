# UN — Verifiable Property Reviews

Submission draft for the Monad Metropolis Trust / Identity / AI track. The receipt registry is deployed on Monad Testnet; the verification checklist below is the authority for completed work. Do not present an unchecked item as demonstrated.

## Form copy

**Project name:** UN — Verifiable Property Reviews

**One-liner — 187 characters:**

> A reusable Monad receipt registry and independent verifier for exact review packets, with UN as the first property-review app. Keep evidence private and make review commitments checkable.

**Description:**

UN's Monad module is a reusable review-receipt registry and a portable verifier. It records a wallet's commitment to an exact review packet. Other applications can use the same small contract and verification flow; UN's property desk is the first integration.

A reviewer checks a packet, exports a versioned receipt envelope, and chooses to record its commitment on Monad Testnet. The envelope contains the saved review, the decision `reviewed`, and a private random nonce. The browser computes its Keccak-256 commitment. Only the commitment is recorded on-chain, alongside the submitting wallet and the recording time.

The independent `/verify` page checks an exported envelope against the on-chain receipt. The packet is hashed in the browser; the verification API receives only its commitment and receipt metadata. Changing a reviewed field changes its commitment, making an altered copy detectable. JSON whitespace and object key order do not affect the commitment.

The primitive establishes a wallet's review commitment. It does not establish the truth of the evidence, the reviewer's real-world identity or professional authority, or legal compliance. The demonstration uses UN's fictional property portfolio.

**Status statement — replace only after checks complete:**

The receipt registry is deployed on Monad Testnet at `0x56941693b8b7bac199fdfe8fb15cccf554e13d44` (chain `10143`). A fictional sample packet has a confirmed live receipt, verified through the receipt API and the local browser verifier. The local browser displays “Receipt verified” for the sample; an altered copy produces a fingerprint mismatch without requesting a blockchain check. The live contract check confirms duplicate and empty-commitment rejection. The wallet flow is implemented; interactive wallet and public-hosted verification checks remain pending. The existing UN app uses sample property records. Exa search makes real provider calls; Ambiguous task saving is implemented, but a live task creation has not been verified for this submission.

## Why this track

The submission's reusable component is the registry, with a reference envelope and verifier: a minimal ABI, a documented encoding, and a check that works without trusting UN's application database. The contract accepts a commitment from any application. UN supplies the first concrete packet producer. The current verifier supports the `un-review-receipt/v1` envelope and inspects an exported packet independently of the original review screen. Another domain can reuse the contract and adapt the reference envelope schema.

The contract's attribution is to a wallet. The envelope's `reviewed` decision records an acknowledgment of a specific packet, not an authorization to send a notice or change rent. No token, payment flow, identity oracle, or additional sponsor service is required.

## Technical scope

| Part | Intended implementation |
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

## Work and attribution

- **Inherited:** the MIT-licensed [CopilotKit Agents, Everywhere starter](https://github.com/CopilotKit/agents-everywhere-starter-kit), including model and workplace integration infrastructure.
- **UN work before the receipt extension:** property review and sample portfolio work committed September 12, 2026; real sponsor-tool integration merged September 20, 2026 (`36f1d27`). Both dates fall within the Monad event window of September 1–October 13, 2026. This work preceded the Monad receipt extension and should be attributed separately from it.
- **Receipt extension for this submission:** the generic receipt contract, versioned private review envelope, wallet recording flow, independent verifier, and receipt-focused tests and documentation. The checklist distinguishes implementation from demonstrated live behavior.

The older root [submission checklist](../SUBMISSION.md) describes the September AI Tinkerers event. This file describes the Monad submission; do not reuse the earlier event's eligibility or completion claims.

## Go-to-market draft

Start with small property operations teams that already review renewal packets and need to preserve which version a reviewer checked. The proposed pilot pairs UN's review desk with an exported receipt that an owner or colleague can verify later. Test whether the version check is useful during handoffs and whether wallet signing adds acceptable friction before expanding the product.

Recruit a small number of design partners for supervised pilots using fictional or consented records. Measure completed reviews, successful independent verifications, time spent resolving version disputes, and willingness to keep using the workflow. If those pilots show value, test a team subscription for the review workflow and support. Keep receipt verification accessible to recipients; do not require them to adopt the full property app.

This is a proposed plan. No customer count, revenue, paid pilot, partnership, or measured time saving is claimed. A later integration kit could serve other document-review applications after the reference flow is validated; the current verifier supports UN's versioned envelope.

## Selected video and judge walkthrough

The selected video is the [original UN prototype walkthrough](https://www.loom.com/share/ebc670ceadb14f6caa20623eec5e4040), approximately **4 minutes 49 seconds**. It shows an older property-review prototype and does **not** demonstrate the new Monad receipt or verifier flow. The user chose to reuse it; it exceeds both the two-minute pitch and three-minute technical-demo limits. Do not describe it as a newly recorded, compliant Monad demo.

The [shorter recording scripts](monad-demo-script.md) remain available if a receipt-specific recording is made. The walletless judge path is `/verify` with a downloadable fictional example backed by a real testnet receipt. The sample's live API and local browser verification passed; the public hosted path remains unverified until the checklist below is completed. Publishing the fictional example also publishes its envelope and nonce; private user exports are not public samples.

**Judge access instructions — use after the hosted check passes:** Open https://un-property-review-desk.dudu-f.chatgpt.site/verify, choose **Load sample receipt**, then **Verify on Monad testnet**. No wallet, account, or testnet funds are needed to verify. After the confirmed result, choose **Try an altered sample** to see a changed packet fail the local fingerprint check. The example contains fictional property records; its real testnet transaction is linked from the result. A wallet with testnet MON is needed only to record a new receipt from a saved review.

## Evidence to fill before submitting

| Field | Value |
| --- | --- |
| Repository | https://github.com/shuhang-f/UN |
| Submitted branch / commit | `[FILL: remote commit containing the receipt work]` |
| Live application | https://un-property-review-desk.dudu-f.chatgpt.site — public proxy to the protected app; access confirmed October 13, 2026 |
| Independent verifier | https://un-property-review-desk.dudu-f.chatgpt.site/verify — receipt-flow deployment and live verification pending |
| Contract address | `0x56941693b8b7bac199fdfe8fb15cccf554e13d44` on Monad Testnet, chain `10143` |
| Contract explorer | https://testnet.monadexplorer.com/address/0x56941693b8b7bac199fdfe8fb15cccf554e13d44 |
| Explorer source verification | `[FILL: verify source status; deployment alone does not establish source verification]` |
| Successful review transaction | https://testnet.monadexplorer.com/tx/0x832098fbc82a4fac5dfefe03c61d3d26f572527bae585c0bd777a6e3ae614537 |
| Reviewer wallet | `0x27123352229cCdCF471BB6152E54E6dAbD5FF021` — testnet demonstration account |
| Receipt commitment | `0xd04443650bae86c436c711ad498776a149c2cd64d55b36fa2fdaa7e8c07cdc1d` |
| Receipt block / time | `70853978` / `2026-10-14T03:01:23.000Z` (October 13, 20:01:23 PDT) |
| Fictional example | `apps/web/public/examples/review-receipt.json`; intended public URL `/examples/review-receipt.json` |
| Selected video | https://www.loom.com/share/ebc670ceadb14f6caa20623eec5e4040 — older prototype; approximately 4:49; does not show Monad receipts |
| Pitch video, at most 2 minutes | No separate compliant recording confirmed; selected older video exceeds this limit |
| Technical demo, at most 3 minutes | No separate compliant recording confirmed; selected older video exceeds this limit |
| Logo | `assets/un-logo.png` — 512 × 512; editable source at `assets/un-logo.svg` |

- [x] Contract compiles and the contract ABI check passes.
- [x] Application typecheck and regression suite pass: 39 agent-core tests, 148 web tests, and 1 contract check; 2 Windows file-symlink tests skipped.
- [x] Contract deployed to Monad Testnet; confirmed address recorded above.
- [ ] Contract source verified in the explorer.
- [x] Testnet demonstration wallet records a fictional sample packet; transaction succeeds and event fields match through the receipt API.
- [x] Portable verification API accepts the original commitment and metadata, rejects the commitment of a changed packet, and returns no private packet data.
- [x] Local browser verifier accepts the original sample and displays “Receipt verified”.
- [ ] Public fictional example loads and verifies without a wallet or app credentials.
- [x] Local browser **Try an altered sample** produces a fingerprint mismatch and does not request a blockchain check.
- [x] Live contract simulation rejects the same reviewer/commitment with `AlreadyRecorded` and a zero commitment with `EmptyCommitment`.
- [x] Confirmed receipt persists after a local API reload.
- [x] Automated receipt checks reject wrong networks and unconfirmed/reverted or mismatched transactions.
- [ ] Browser wallet-network switching and rejected wallet requests are exercised interactively.
- [ ] Browser network inspection confirms private packet contents and nonce stay off the verification API and chain.
- [ ] Submission repository, app, verifier, and video links are accessible to judges.
- [ ] Public copy accurately identifies prior work and remaining limitations.

**Verification log:** October 13, 2026, 20:01 PDT: `node --import tsx scripts/check-receipts-live.mjs` completed against the local app and the deployed Monad Testnet registry. The testnet transaction above succeeded. Local packet hash, receipt API read-back, portable API verification, changed-packet rejection, empty/duplicate revert simulation, and persistence checks passed. This command uses the gitignored local testnet key and private checkpoint; neither belongs in the submission. The checked-in example contains only fictional records and public receipt data. Browser wallet interaction, public hosted verifier checks, source verification, and remaining local test commands are not established by this run.

The subsequent `npm run verify` completed successfully: workspace typechecks passed; agent-core reported 39 passed; web reported 148 passed and 2 skipped; the Solidity compilation/ABI test passed. The channel workspace discovered no tests. Both skipped web cases require Windows file-symlink privileges; directory-junction checks still ran. The log is local `.data/monad-verify.log`. Local browser testing then loaded the fictional sample, displayed **Receipt verified**, and showed a local mismatch for **Try an altered sample** without requesting a blockchain check. These browser results do not establish hosted access or interactive wallet signing.

## Official references

[Monad developer summary](https://docs.monad.xyz/developer-essentials/summary) confirms EVM tooling and Viem support. [Monad's Hardhat guide](https://docs.monad.xyz/tooling-and-infra/toolkits/hardhat) supplies the current compiler and network setup. [Testnet information](https://docs.monad.xyz/developer-essentials/testnet) supplies faucet and network references. [Viem's Monad Testnet definition](https://github.com/wevm/viem/blob/main/src/chains/definitions/monadTestnet.ts) confirms chain ID, MON, RPC, and explorer configuration.
