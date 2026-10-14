# Monad submission video scripts

Project: **UN — Verifiable Property Reviews**. Record the pitch at or below two minutes and the technical demo at or below three minutes. These scripts describe the intended verified flow. Do not read a success claim until the corresponding check in [the submission draft](monad-submission.md) is complete. If a step fails, state that result plainly.

The user selected the [existing UN prototype Loom](https://www.loom.com/share/ebc670ceadb14f6caa20623eec5e4040), approximately 4:49. It predates the receipt extension, does not show the Monad flow, and exceeds both requested duration limits. The scripts below are for an optional new recording; they have not been recorded or verified as videos.

## Preparation

Use only the fictional portfolio. Have the application, an exported receipt envelope, the independent `/verify` page, and the actual contract explorer ready. Use a wallet funded with testnet MON and verify chain ID `10143`. Keep recovery phrases, private keys, API keys, and account balances out of the recording.

Prepare a second copy of the envelope with one saved-review value changed. Keep the original unchanged. The live transaction, signer, contract address, and commitment shown in the video must match the submission fields.

## Pitch — target 1 minute 45 seconds

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | UN review packet, with dated source records | “When someone reviews a document, the useful question is: which exact version did they review? A screenshot or an approval label can lose that connection when the underlying records change.” |
| 0:20–0:40 | Receipt registry and independent verifier | “We built a reusable review-receipt registry on Monad and an independent verifier. Any application can record a commitment through the same small contract. UN's property review desk is our first integration.” |
| 0:40–1:05 | Exported receipt and wallet-recording action | “The reviewer checks a packet and explicitly records it from their wallet. The browser hashes an envelope containing that review and a private random nonce. The chain records the commitment and wallet. The property documents stay off-chain.” |
| 1:05–1:30 | Original passes verification; altered copy fails | “Someone with the exported packet can verify it independently. This original matches the recorded commitment. Change one field and it no longer matches. The verifier checks the receipt without relying on UN's saved approval state.” |
| 1:30–1:45 | Signer and commitment result | “This checks a wallet's commitment to these review contents. It does not prove the evidence is true or that the wallet has legal authority. The reusable result is a checkable review receipt, with UN demonstrating where it helps.” |

If deployment or live verification is incomplete, replace “We built” with “We implemented the prototype for” and explicitly say which live check remains incomplete. Do not use the “original matches” or “changed field fails” lines without showing those results.

## Technical demo — target 2 minutes 45 seconds

| Time | Action | Narration |
| --- | --- | --- |
| 0:00–0:25 | Open a saved Unit 04 review | “This is UN's fictional property portfolio. The source records, reviewer note, and prepared output are saved together. The property desk was built earlier in the event window; the receipt registry and portable verification are the new extension.” |
| 0:25–0:50 | Open the receipt action and inspect its scope | “The envelope uses version `un-review-receipt/v1`, decision `reviewed`, a private 32-byte nonce, and this saved review. The browser computes its commitment. The action records this specific packet; it does not send a notice or update rent.” |
| 0:50–1:15 | Confirm Monad Testnet in the wallet and submit | “The wallet is on Monad Testnet, chain 10143. I am explicitly recording the commitment. We show a pending state until the transaction succeeds.” Pause while it confirms; do not narrate success early. |
| 1:15–1:40 | Show the successful receipt and explorer | “The receipt shows the actual contract, reviewer wallet, commitment, and transaction. The generic Solidity method is `record(bytes32)`. Its `ReviewRecorded` event records the wallet, commitment, and time; the same signer and commitment cannot be recorded twice.” |
| 1:40–2:10 | Open `/verify` independently and select the original export | “This verifier works from the exported envelope and receipt metadata. It recomputes the commitment in the browser and checks the on-chain record. It sends the verification API the commitment and receipt metadata, not the property packet or private nonce. The original matches.” |
| 2:10–2:30 | Select the copy with one changed field | “This copy changes one reviewed value. Its commitment differs, so it fails to match the receipt. The original record remains intact.” |
| 2:30–2:45 | Show contract ABI or implementation and final result | “Another app can use this registry without adopting UN's property workflow. It attests a wallet's review commitment, not evidence correctness or professional authority. The sample data is fictional.” |

## Recording checks

- Show the actual live result rather than a prepared success screen.
- Use the exact displayed state names if the final UI differs from this script.
- If verification is pending or fails, retain that result and describe it honestly.
- Avoid detouring into Exa or Ambiguous: the receipt path does not require either service. Ambiguous live task creation is not yet verified for this submission.
- After recording, check audio, duration, link access, and whether every shown address and transaction matches the submission evidence.
- The deployed registry is `0x56941693b8b7bac199fdfe8fb15cccf554e13d44` on chain `10143`. The sample receipt, portable API checks, and local browser original/altered-sample checks passed. Browser wallet and public hosted verifier checks remain pending. See the submission evidence for the actual transaction and commitment.
- For a walletless judge walkthrough, use the public fictional example once its actual receipt is confirmed. Explain that the sample envelope is intentionally public. The altered-copy demonstration must keep the original file unchanged.
