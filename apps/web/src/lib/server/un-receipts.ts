import { createHash, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, realpath, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createPublicClient, decodeEventLog, getAddress, http, TransactionReceiptNotFoundError, type Address, type Hash, type Hex } from "viem";
import { monadTestnet } from "viem/chains";
import { z } from "zod";
import { hashReceiptEnvelope, MONAD_CHAIN_ID, MONAD_EXPLORER_URL, MONAD_RPC_URL, receiptAbi, receiptEnvelopeSchema, receiptProofSchema, type UnReceiptConfig, type UnReceiptProof, type UnReceiptResponse } from "../un-receipt";
import { trustedAppOrigin } from "./deployment";
import { UnReviewService } from "./un-reviews";

const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), reviewId: z.uuid() }).strict(),
  z.object({ action: z.literal("confirm"), reviewId: z.uuid(), transactionHash: hashSchema }).strict(),
]);
const preparedSchema = z.object({ envelope: receiptEnvelopeSchema, commitment: hashSchema }).strict();
const verifySchema = z.object({ commitment: hashSchema, receipt: receiptProofSchema }).strict();
const hasCode = (error: unknown, code: string) => error instanceof Error && "code" in error && error.code === code;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const sameHex = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const cookieName = "un-review-session";

export class UnReceiptError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface ReceiptChain {
  chainId(): Promise<number>;
  transaction(hash: Hash): Promise<{
    transactionHash: Hash; status: "success" | "reverted"; to: Address | null; from: Address;
    blockNumber: bigint; blockHash: Hash;
    logs: { address: Address; data: Hex; topics: readonly Hex[] }[];
  }>;
  timestamp(blockHash: Hash): Promise<bigint>;
  recordedAt(contract: Address, reviewer: Address, commitment: Hash): Promise<bigint>;
}

export function configuredReceiptChain(rpcUrl = process.env.MONAD_RPC_URL?.trim() || MONAD_RPC_URL): ReceiptChain {
  const url = new URL(rpcUrl);
  if (url.protocol !== "https:") throw new UnReceiptError("Configure an HTTPS Monad testnet RPC endpoint.", 503);
  const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl, { timeout: 12_000, retryCount: 1 }) });
  return {
    chainId: () => client.getChainId(),
    transaction: hash => client.getTransactionReceipt({ hash }),
    timestamp: async blockHash => (await client.getBlock({ blockHash })).timestamp,
    recordedAt: (address, reviewer, commitment) => client.readContract({ address, abi: receiptAbi, functionName: "recordedAt", args: [reviewer, commitment] }),
  };
}

export function receiptConfig(address = process.env.MONAD_RECEIPT_CONTRACT_ADDRESS): UnReceiptConfig {
  let contractAddress: Address | null = null;
  try { if (address?.trim()) contractAddress = getAddress(address.trim()); } catch { /* Missing/invalid setup cannot enable the wallet action. */ }
  if (contractAddress === "0x0000000000000000000000000000000000000000") contractAddress = null;
  return {
    chainId: MONAD_CHAIN_ID, chainName: "Monad Testnet", contractAddress,
    // A server RPC override may contain credentials; it is never exposed to clients.
    rpcUrl: MONAD_RPC_URL, explorerUrl: MONAD_EXPLORER_URL, configured: contractAddress !== null,
  };
}

/** Verify the exact deployed contract, transaction, event, wallet and stored commitment. */
export async function verifyReceiptTransaction(chain: ReceiptChain, config: UnReceiptConfig, commitment: Hash, transactionHash: Hash): Promise<UnReceiptProof> {
  if (!config.contractAddress) throw new UnReceiptError("The Monad testnet receipt contract has not been configured.", 503);
  if (await chain.chainId() !== MONAD_CHAIN_ID) throw new UnReceiptError("The RPC endpoint is not Monad testnet. No receipt was confirmed.", 502);
  let transaction: Awaited<ReturnType<ReceiptChain["transaction"]>>;
  try { transaction = await chain.transaction(transactionHash); }
  catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) throw new UnReceiptError("The transaction is not confirmed yet. Wait, then retry checking the same transaction.", 409);
    throw error;
  }
  if (!sameHex(transaction.transactionHash, transactionHash) || transaction.status !== "success")
    throw new UnReceiptError("The transaction failed or does not match the requested transaction. No receipt was confirmed.");
  if (!transaction.to || !sameHex(transaction.to, config.contractAddress))
    throw new UnReceiptError("This transaction did not call the configured review receipt contract.");
  const events = transaction.logs.flatMap(log => {
    if (!sameHex(log.address, config.contractAddress!)) return [];
    try {
      const event = decodeEventLog({ abi: receiptAbi, eventName: "ReviewRecorded", data: log.data, topics: log.topics as [Hex, ...Hex[]], strict: true });
      return sameHex(event.args.commitment, commitment) && sameHex(event.args.reviewer, transaction.from) ? [event.args] : [];
    } catch { return []; }
  });
  if (events.length !== 1) throw new UnReceiptError("This transaction does not contain the matching review commitment and signing wallet.");
  const event = events[0];
  const [timestamp, stored] = await Promise.all([
    chain.timestamp(transaction.blockHash), chain.recordedAt(config.contractAddress, event.reviewer, commitment),
  ]);
  if (stored !== event.recordedAt || timestamp !== event.recordedAt || stored <= 0n)
    throw new UnReceiptError("The event does not match the contract's stored receipt and block time.");
  return receiptProofSchema.parse({
    chainId: MONAD_CHAIN_ID, contractAddress: getAddress(config.contractAddress), transactionHash: transaction.transactionHash,
    reviewer: getAddress(event.reviewer), blockNumber: transaction.blockNumber.toString(),
    recordedAt: new Date(Number(timestamp) * 1000).toISOString(),
  });
}

export async function verifyPortableReceipt(chain: ReceiptChain, config: UnReceiptConfig, value: unknown) {
  const input = verifySchema.parse(value);
  if (!config.contractAddress || !sameHex(input.receipt.contractAddress, config.contractAddress))
    throw new UnReceiptError("This receipt belongs to a different contract than this verifier's configured registry.");
  const actual = await verifyReceiptTransaction(chain, config, input.commitment as Hash, input.receipt.transactionHash as Hash);
  if (!sameHex(actual.reviewer, input.receipt.reviewer) || actual.blockNumber !== input.receipt.blockNumber || actual.recordedAt !== input.receipt.recordedAt)
    throw new UnReceiptError("The exported receipt metadata does not match the chain record.");
  return { valid: true as const, commitment: input.commitment, receipt: actual };
}

async function readStored<T>(path: string, schema: z.ZodType<T>): Promise<T | undefined> {
  let handle;
  try {
    const entry = await lstat(path);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Invalid receipt storage file.");
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1_000_000) throw new Error("Invalid receipt storage file.");
    return schema.parse(JSON.parse(await handle.readFile("utf8")));
  } finally { await handle.close(); }
}

async function createOnce(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  try { await link(temporary, path); }
  catch (error) { if (!hasCode(error, "EEXIST")) throw error; }
  finally { await unlink(temporary); }
}

export class UnReceiptService {
  constructor(private options: { directory: string; reviewsDirectory: string; config: UnReceiptConfig; chain?: ReceiptChain }) {}

  private async directory(session: string) {
    if (!/^[a-f0-9]{64}$/.test(session)) throw new UnReceiptError("Invalid review session.", 403);
    const root = resolve(this.options.directory);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const rootInfo = await lstat(root);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Invalid receipt storage directory.");
    const path = join(await realpath(root), digest(session));
    await mkdir(path, { recursive: true, mode: 0o700 });
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) throw new Error("Invalid receipt session directory.");
    return path;
  }

  async act(session: string, value: unknown): Promise<UnReceiptResponse> {
    const input = inputSchema.parse(value);
    if (!/^[a-f0-9]{64}$/.test(session)) throw new UnReceiptError("Invalid review session.", 403);
    const review = (await new UnReviewService(this.options.reviewsDirectory).list(session)).find(record => record.id === input.reviewId);
    if (!review) throw new UnReceiptError("This review was not found in the current browser session. Save and select a review first.", 404);
    const directory = await this.directory(session);
    const key = digest(review.id);
    const preparedPath = join(directory, `${key}.prepared.json`);
    let prepared = await readStored(preparedPath, preparedSchema);
    if (!prepared) {
      if (input.action !== "prepare") throw new UnReceiptError("Prepare this review's receipt before confirming its transaction.", 409);
      const envelope = receiptEnvelopeSchema.parse({ schema: "un-review-receipt/v1", decision: "reviewed", nonce: `0x${randomBytes(32).toString("hex")}`, review });
      await createOnce(preparedPath, { envelope, commitment: hashReceiptEnvelope(envelope) });
      prepared = await readStored(preparedPath, preparedSchema);
    }
    if (!prepared || prepared.envelope.review.id !== review.id || prepared.commitment !== hashReceiptEnvelope(prepared.envelope))
      throw new Error("Invalid prepared review receipt.");
    const confirmedPath = join(directory, `${key}.confirmed.json`);
    let receipt = await readStored(confirmedPath, receiptProofSchema) ?? null;
    if (input.action === "confirm") {
      if (!this.options.chain) throw new UnReceiptError("The Monad testnet connection is unavailable.", 503);
      if (receipt && !sameHex(receipt.transactionHash, input.transactionHash))
        throw new UnReceiptError("This review already has a confirmed receipt. Its recorded transaction has not changed.", 409);
      const verified = await verifyReceiptTransaction(this.options.chain, this.options.config, prepared.commitment as Hash, input.transactionHash as Hash);
      await createOnce(confirmedPath, verified);
      receipt = await readStored(confirmedPath, receiptProofSchema) ?? null;
      if (!receipt || !sameHex(receipt.transactionHash, verified.transactionHash))
        throw new UnReceiptError("Another transaction was confirmed for this review. Reload its saved receipt.", 409);
    }
    return { envelope: prepared.envelope, commitment: prepared.commitment as Hash, receipt };
  }
}

async function readBody(request: Request) {
  const limit = 4096;
  if (Number(request.headers.get("content-length")) > limit) throw new UnReceiptError("The receipt request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new UnReceiptError("Provide a receipt request.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new UnReceiptError("The receipt request is too large.", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally { reader.releaseLock(); }
}
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function errorReply(error: unknown) {
  if (error instanceof UnReceiptError) return reply({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return reply({ error: "Invalid receipt request or artifact. Check its fields and version." }, 400);
  return reply({ error: "The receipt could not be verified or saved. Check the Monad connection and retry the same transaction." }, 502);
}
function validPost(request: Request) {
  const origin = trustedAppOrigin(request);
  return origin && request.headers.get("origin") === origin.origin && request.headers.get("sec-fetch-site") !== "cross-site" &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}

export function createUnReceiptHandler(options: { directory: string; reviewsDirectory: string; config(): UnReceiptConfig; chain(): ReceiptChain }) {
  return async (request: Request): Promise<Response> => {
    if (!trustedAppOrigin(request)) return reply({ error: "Untrusted app host." }, 403);
    if (request.method === "GET") return reply(options.config());
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    const session = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!validPost(request) || !session || !/^[a-f0-9]{64}$/.test(session)) return reply({ error: "Open a saved review in UN to prepare or confirm its receipt." }, 403);
    try {
      const input = inputSchema.parse(await readBody(request));
      const config = options.config();
      return reply(await new UnReceiptService({ ...options, config, chain: input.action === "confirm" ? options.chain() : undefined }).act(session, input));
    } catch (error) { return errorReply(error); }
  };
}

/** Receives only public commitment/proof metadata; never accepts the private review envelope. */
export function createReceiptVerifierHandler(options: { config(): UnReceiptConfig; chain(): ReceiptChain }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    if (!validPost(request)) return reply({ error: "Use the receipt verifier on this site." }, 403);
    try {
      const input = verifySchema.parse(await readBody(request));
      return reply(await verifyPortableReceipt(options.chain(), options.config(), input));
    } catch (error) { return errorReply(error); }
  };
}
