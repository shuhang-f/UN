import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { hashReceiptEnvelope, receiptAbi } from "../apps/web/src/lib/un-receipt.ts";

// Run: node --import tsx scripts/check-receipts-live.mjs
// Requires the local UN app, configured deployed testnet registry, and the funded test-only key.
// The private checkpoint is gitignored; only the fictional exported packet is public.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = resolve(root, ".data");
let step = "initialization";

async function main() {
  await mkdir(data, { recursive: true });
  const origin = new URL(process.env.UN_RECEIPT_CHECK_ORIGIN || "http://127.0.0.1:3100");
  if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
    throw new Error("This smoke check only targets a local app.");
  const keyPath = resolve(root, process.env.MONAD_DEPLOYER_KEY_FILE || ".data/monad-test-deployer.json");
  const credentials = JSON.parse(await readFile(keyPath, "utf8"));
  if (credentials.chainId !== 10143 || !/^0x[0-9a-fA-F]{64}$/.test(credentials.privateKey || ""))
    throw new Error("Invalid testnet-only key file.");
  const account = privateKeyToAccount(credentials.privateKey);
  if (account.address.toLowerCase() !== String(credentials.address).toLowerCase()) throw new Error("Test account mismatch.");
  const rpcUrl = process.env.MONAD_RPC_URL?.trim() || monadTestnet.rpcUrls.default.http[0];
  if (new URL(rpcUrl).protocol !== "https:") throw new Error("Use HTTPS RPC.");
  const transport = http(rpcUrl, { timeout: 15_000, retryCount: 1 });
  const client = createPublicClient({ chain: monadTestnet, transport });
  const wallet = createWalletClient({ chain: monadTestnet, transport, account });
  if (await client.getChainId() !== 10143) throw new Error("Refusing to use a network other than Monad testnet.");
  const configurationResponse = await fetch(new URL("/api/un/reviews/receipt", origin));
  if (!configurationResponse.ok) throw new Error("Local receipt configuration is unavailable.");
  const configuration = await configurationResponse.json();
  if (!configuration.configured || configuration.chainId !== 10143 || !configuration.contractAddress)
    throw new Error("Configure the deployed Monad testnet registry in the local app.");
  const contract = configuration.contractAddress;
  const checkpointPath = resolve(data, "receipt-live-check-private.json");
  let checkpoint = { contractAddress: contract };
  try { checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  if (checkpoint.contractAddress.toLowerCase() !== contract.toLowerCase()) throw new Error("The local registry changed since the saved smoke check.");
  const saveCheckpoint = () => writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), { mode: 0o600 });
  const post = async (path, body) => {
    const response = await fetch(new URL(path, origin), { method: "POST", headers: {
      origin: origin.origin, "content-type": "application/json", ...(checkpoint.cookie ? { cookie: checkpoint.cookie } : {}),
    }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  step = "creating a browser-isolated fictional review";
  if (!checkpoint.cookie) {
    const response = await fetch(new URL("/api/un/reviews", origin));
    if (!response.ok) throw new Error("Could not create the review session.");
    checkpoint.cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!checkpoint.cookie) throw new Error("No review session returned.");
    await saveCheckpoint();
  }
  if (!checkpoint.reviewId) {
    const saved = await post("/api/un/reviews", {
      unitId: "un-demo-unit-04", asOf: "2026-09-12",
      preferences: { reviewLeadDays: 90, requestedIncreasePercent: 2, reviewer: "Monad testnet demo reviewer" },
      reviewerNote: "Fictional Unit 04 evidence reviewed for the Monad testnet demonstration. This does not send a notice, establish legal compliance, or change rent.", approved: true,
    });
    if (saved.status !== 200 || !saved.body.record?.id) throw new Error("Could not save the fictional review.");
    checkpoint.reviewId = saved.body.record.id;
    await saveCheckpoint();
  }
  const prepared = await post("/api/un/reviews/receipt", { action: "prepare", reviewId: checkpoint.reviewId });
  if (prepared.status !== 200 || hashReceiptEnvelope(prepared.body.envelope) !== prepared.body.commitment)
    throw new Error("The prepared commitment did not match the authoritative packet.");
  const commitment = prepared.body.commitment;
  console.log("Prepared a fictional Unit 04 receipt; private packet contents remain offchain.");

  step = "simulating empty-commitment rejection";
  const expectRevert = async (candidate, expected) => {
    try {
      await client.simulateContract({ account, address: contract, abi: receiptAbi, functionName: "record", args: [candidate] });
    } catch (error) {
      const reverted = error instanceof BaseError ? error.walk(cause => cause instanceof ContractFunctionRevertedError) : undefined;
      if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName === expected) return;
      throw new Error("The expected contract rejection was not verified.");
    }
    throw new Error("The contract unexpectedly accepted an invalid action.");
  };
  await expectRevert(`0x${"0".repeat(64)}`, "EmptyCommitment");

  step = "recording the testnet commitment";
  if (prepared.body.receipt) checkpoint.transactionHash = prepared.body.receipt.transactionHash;
  if (!checkpoint.transactionHash) {
    const existing = await client.readContract({ address: contract, abi: receiptAbi, functionName: "recordedAt", args: [account.address, commitment] });
    if (existing !== 0n) throw new Error("A receipt already exists; recover its transaction hash instead of creating another.");
    const simulated = await client.simulateContract({ account, address: contract, abi: receiptAbi, functionName: "record", args: [commitment] });
    checkpoint.transactionHash = await wallet.writeContract(simulated.request);
    await saveCheckpoint();
    console.log(`Testnet record transaction: ${checkpoint.transactionHash}`);
  }
  const transaction = await client.waitForTransactionReceipt({ hash: checkpoint.transactionHash, timeout: 120_000 });
  if (transaction.status !== "success") throw new Error("The record transaction reverted.");

  step = "verifying the transaction through UN's receipt API";
  const confirmed = await post("/api/un/reviews/receipt", { action: "confirm", reviewId: checkpoint.reviewId, transactionHash: checkpoint.transactionHash });
  if (confirmed.status !== 200 || !confirmed.body.receipt || hashReceiptEnvelope(confirmed.body.envelope) !== confirmed.body.commitment)
    throw new Error("UN did not confirm the exact chain receipt.");
  const artifact = confirmed.body;
  const verified = await post("/api/receipts/verify", { commitment: artifact.commitment, receipt: artifact.receipt });
  if (verified.status !== 200 || verified.body.valid !== true) throw new Error("Portable receipt verification failed.");

  step = "checking modified-file and duplicate rejection";
  const modifiedEnvelope = structuredClone(artifact.envelope);
  modifiedEnvelope.review.packet.requestedRent += 1;
  const modified = await post("/api/receipts/verify", { commitment: hashReceiptEnvelope(modifiedEnvelope), receipt: artifact.receipt });
  if (modified.status !== 400) throw new Error("A changed packet was not rejected.");
  await expectRevert(commitment, "AlreadyRecorded");
  const restored = await post("/api/un/reviews/receipt", { action: "prepare", reviewId: checkpoint.reviewId });
  if (restored.status !== 200 || restored.body.receipt?.transactionHash !== checkpoint.transactionHash)
    throw new Error("The confirmed receipt did not survive reload.");

  step = "writing the fictional sample export and public verification result";
  const sampleDirectory = resolve(root, "apps/web/public/examples");
  await mkdir(sampleDirectory, { recursive: true });
  await writeFile(resolve(sampleDirectory, "review-receipt.json"), JSON.stringify(artifact, null, 2));
  const result = {
    checkedAt: new Date().toISOString(), chainId: 10143, network: "Monad Testnet", fictionalData: true,
    contractAddress: contract, transactionHash: checkpoint.transactionHash, reviewer: artifact.receipt.reviewer,
    commitment: artifact.commitment, blockNumber: artifact.receipt.blockNumber, recordedAt: artifact.receipt.recordedAt,
    explorerUrl: `${monadTestnet.blockExplorers.default.url}/tx/${checkpoint.transactionHash}`,
    checks: { localPacketHash: true, confirmedThroughApi: true, portableVerification: true, modifiedPacketRejected: true, emptyCommitmentRejected: true, duplicateRejected: true, restoredAfterReload: true },
    publicExample: "/examples/review-receipt.json",
  };
  await writeFile(resolve(data, "receipt-live-check.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch(() => {
  console.error(`Receipt live check failed while ${step}. Inspect the local app/RPC and the gitignored checkpoint before retrying. No secret values are logged.`);
  process.exitCode = 1;
});
