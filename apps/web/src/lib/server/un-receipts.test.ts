import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { encodeAbiParameters, encodeEventTopics, TransactionReceiptNotFoundError, type Address, type Hash } from "viem";
import { defaultPreferences, DEMO_TODAY } from "../un-demo";
import { canonicalizeReceipt, hashReceiptEnvelope, receiptAbi, receiptEnvelopeSchema } from "../un-receipt";
import { createReceiptVerifierHandler, createUnReceiptHandler, receiptConfig, UnReceiptService, verifyPortableReceipt, verifyReceiptTransaction, type ReceiptChain } from "./un-receipts";
import { UnReviewService } from "./un-reviews";

const session = "a".repeat(64);
const contract = `0x${"2".repeat(40)}` as Address;
const reviewer = `0x${"1".repeat(40)}` as Address;
const hash = `0x${"3".repeat(64)}` as Hash;
const config = receiptConfig(contract);
const reviewInput = { unitId: "un-demo-unit-04", asOf: DEMO_TODAY, preferences: defaultPreferences, reviewerNote: "Reviewed sources", approved: true };

class Chain implements ReceiptChain {
  network = 10143;
  time = 1_800_000_000n;
  stored = this.time;
  calls = 0;
  missing = false;
  unavailable = false;
  value: Awaited<ReturnType<ReceiptChain["transaction"]>> = {
    transactionHash: hash, status: "success", to: contract, from: reviewer,
    blockNumber: 4321n, blockHash: `0x${"4".repeat(64)}`, logs: [],
  };
  event(commitment: Hash, signer = reviewer) {
    this.value.logs = [{ address: contract,
      topics: encodeEventTopics({ abi: receiptAbi, eventName: "ReviewRecorded", args: { reviewer: signer, commitment } }) as Hash[],
      data: encodeAbiParameters([{ type: "uint256" }], [this.time]),
    }];
  }
  async chainId() { this.calls++; return this.network; }
  async transaction(requested: Hash) {
    this.calls++;
    if (this.missing) throw new TransactionReceiptNotFoundError({ hash: requested });
    if (this.unavailable) throw new Error("https://rpc.invalid/secret-api-key");
    return this.value;
  }
  async timestamp() { return this.time; }
  async recordedAt() { return this.stored; }
}

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "un-receipts-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const chain = new Chain();
  const options = { directory: join(directory, "receipts"), reviewsDirectory: join(directory, "reviews"), config, chain };
  const reviews = new UnReviewService(options.reviewsDirectory);
  const record = await reviews.save(session, reviewInput);
  const service = new UnReceiptService(options);
  const handler = createUnReceiptHandler({ ...options, config: () => config, chain: () => chain });
  const prepared = () => service.act(session, { action: "prepare", reviewId: record.id });
  return { options, chain, reviews, record, service, handler, prepared };
}
const headers = { origin: "http://localhost:3100", cookie: `un-review-session=${session}`, "content-type": "application/json" };
const request = (body: unknown, extra: Record<string, string> = {}) => new Request("http://localhost:3100/api/un/reviews/receipt", { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });

test("receipt preparation uses saved authoritative fields and one stable random nonce across retries/restarts", async t => {
  const { record, options, chain, prepared } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 8 }, prepared));
  assert.ok(results.every(result => JSON.stringify(result) === JSON.stringify(results[0])));
  assert.deepEqual(results[0].envelope.review, record);
  assert.equal(results[0].envelope.decision, "reviewed");
  assert.match(results[0].envelope.nonce, /^0x[0-9a-f]{64}$/);
  assert.equal(results[0].commitment, hashReceiptEnvelope(results[0].envelope));
  assert.equal(results[0].receipt, null);
  assert.equal(chain.calls, 0, "preparation performs no chain calls");
  assert.deepEqual(await new UnReceiptService(options).act(session, { action: "prepare", reviewId: record.id }), results[0]);
  const [folder] = await readdir(options.directory);
  assert.equal((await readdir(join(options.directory, folder))).length, 1);
});

test("canonicalization ignores object key order while preserving array order and all evidence content", async t => {
  const { prepared } = await fixture(t);
  const original = await prepared();
  const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)])) : value;
  const reordered = receiptEnvelopeSchema.parse(reorder(original.envelope));
  assert.equal(hashReceiptEnvelope(reordered), original.commitment);
  const changed = structuredClone(original.envelope);
  changed.review.packet.requestedRent += 1;
  assert.notEqual(hashReceiptEnvelope(changed), original.commitment);
  const reorderedSources = structuredClone(original.envelope);
  reorderedSources.review.packet.evidence.reverse();
  assert.notEqual(hashReceiptEnvelope(reorderedSources), original.commitment);
  assert.equal(canonicalizeReceipt({ z: -0, a: "\n" }), '{"a":"\\n","z":0}');
  for (const value of [undefined, NaN, Infinity, 2n, { x: undefined }]) assert.throws(() => canonicalizeReceipt(value));
  assert.throws(() => receiptEnvelopeSchema.parse({ ...original.envelope, providerLastVerifiedAt: new Date().toISOString() }));
});

test("preparation is available without a configured contract while confirmation cannot fake success", async t => {
  const { options, record, chain } = await fixture(t);
  const service = new UnReceiptService({ ...options, config: receiptConfig("") });
  const result = await service.act(session, { action: "prepare", reviewId: record.id });
  assert.equal(result.receipt, null);
  await assert.rejects(service.act(session, { action: "confirm", reviewId: record.id, transactionHash: hash }), { status: 503 });
  assert.equal(chain.calls, 0);
});

test("confirmation checks transaction/event/storage and persists a real chain receipt", async t => {
  const { prepared, chain, service, record, options } = await fixture(t);
  const packet = await prepared();
  chain.event(packet.commitment);
  const saved = await service.act(session, { action: "confirm", reviewId: record.id, transactionHash: hash });
  assert.deepEqual(saved.receipt, {
    chainId: 10143, contractAddress: contract, reviewer, transactionHash: hash,
    blockNumber: "4321", recordedAt: new Date(Number(chain.time) * 1000).toISOString(),
  });
  assert.deepEqual(await new UnReceiptService(options).act(session, { action: "prepare", reviewId: record.id }), saved);
  assert.deepEqual(await service.act(session, { action: "confirm", reviewId: record.id, transactionHash: hash }), saved);
  await assert.rejects(service.act(session, { action: "confirm", reviewId: record.id, transactionHash: `0x${"5".repeat(64)}` }), /already has a confirmed receipt/);
  assert.deepEqual(await service.act(session, { action: "prepare", reviewId: record.id }), saved);
});

test("unknown sessions and supplied review replacements cannot prepare or confirm another person's snapshot", async t => {
  const { prepared, service, record, chain } = await fixture(t);
  await prepared();
  await assert.rejects(service.act("b".repeat(64), { action: "prepare", reviewId: record.id }), { status: 404 });
  await assert.rejects(service.act("b".repeat(64), { action: "confirm", reviewId: record.id, transactionHash: hash }), { status: 404 });
  await assert.rejects(service.act(session, { action: "prepare", reviewId: randomUUID() }), { status: 404 });
  await assert.rejects(service.act("../outside", { action: "prepare", reviewId: record.id }), { status: 403 });
  await assert.rejects(service.act(session, { action: "prepare", reviewId: record.id, envelope: {} }));
  await assert.rejects(service.act(session, { action: "prepare", reviewId: record.id, commitment: hash }));
  assert.equal(chain.calls, 0);
});

test("confirmation before preparation and pending transactions preserve a retryable unconfirmed state", async t => {
  const { prepared, service, record, chain } = await fixture(t);
  await assert.rejects(service.act(session, { action: "confirm", reviewId: record.id, transactionHash: hash }), { status: 409 });
  const packet = await prepared();
  chain.event(packet.commitment);
  chain.missing = true;
  await assert.rejects(service.act(session, { action: "confirm", reviewId: record.id, transactionHash: hash }), /not confirmed yet/);
  assert.equal((await prepared()).receipt, null);
  chain.missing = false;
  assert.ok((await service.act(session, { action: "confirm", reviewId: record.id, transactionHash: hash })).receipt);
});

test("wrong chain, failed transaction, wrong target, altered hash, mismatched signer/event and storage are rejected", async t => {
  const { prepared } = await fixture(t);
  const packet = await prepared();
  const cases: ((chain: Chain) => void)[] = [
    chain => { chain.network = 1; },
    chain => { chain.value.status = "reverted"; },
    chain => { chain.value.to = reviewer; },
    chain => { chain.value.transactionHash = `0x${"5".repeat(64)}`; },
    chain => { chain.value.from = contract; },
    chain => { chain.event(`0x${"6".repeat(64)}`); },
    chain => { chain.value.logs[0].address = reviewer; },
    chain => { chain.value.logs.push(chain.value.logs[0]); },
    chain => { chain.time += 1n; },
    chain => { chain.stored = 0n; },
  ];
  for (const alter of cases) {
    const chain = new Chain(); chain.event(packet.commitment); alter(chain);
    await assert.rejects(verifyReceiptTransaction(chain, config, packet.commitment, hash));
  }
});

test("portable verifier requires exact exported metadata and rejects modified files' commitments", async t => {
  const { prepared, chain } = await fixture(t);
  const packet = await prepared();
  chain.event(packet.commitment);
  const receipt = await verifyReceiptTransaction(chain, config, packet.commitment, hash);
  const verified = await verifyPortableReceipt(chain, config, { commitment: packet.commitment, receipt });
  assert.equal(verified.valid, true);
  for (const altered of [
    { ...receipt, contractAddress: reviewer }, { ...receipt, reviewer: contract },
    { ...receipt, chainId: 1 }, { ...receipt, blockNumber: "123" }, { ...receipt, recordedAt: new Date().toISOString() },
  ]) await assert.rejects(verifyPortableReceipt(chain, config, { commitment: packet.commitment, receipt: altered }));
  const tampered = structuredClone(packet.envelope);
  tampered.review.reviewerNote = "Altered after recording";
  await assert.rejects(verifyPortableReceipt(chain, config, { commitment: hashReceiptEnvelope(tampered), receipt }), /matching review commitment/);
});

test("HTTP config reveals only public settings; same-origin session and bounded JSON checks precede provider calls", async t => {
  const { handler, chain, record } = await fixture(t);
  const initial = await handler(new Request("http://localhost:3100/api/un/reviews/receipt"));
  assert.deepEqual(await initial.json(), config);
  assert.equal(initial.headers.get("set-cookie"), null);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  const invalidHeaders: Record<string, string>[] = [{ cookie: "" }, { origin: "https://evil.test" }, { "content-type": "text/plain" }, { "sec-fetch-site": "cross-site" }, { host: "evil.test" }];
  for (const extra of invalidHeaders)
    assert.equal((await handler(request({ action: "prepare", reviewId: record.id }, extra))).status, 403);
  assert.equal((await handler(request({ action: "prepare", reviewId: record.id, privateKey: "do-not-accept" }))).status, 400);
  assert.equal((await handler(request({ action: "prepare", reviewId: record.id }, { "content-length": "5000" }))).status, 413);
  assert.equal((await handler(request({ x: "界".repeat(2000) }))).status, 413);
  assert.equal(chain.calls, 0);
  assert.equal((await handler(request({ action: "prepare", reviewId: record.id }))).status, 200);
});

test("verification endpoint needs no review cookie and accepts no envelope or private records", async t => {
  const { prepared, chain } = await fixture(t);
  const packet = await prepared();
  chain.event(packet.commitment);
  const receipt = await verifyReceiptTransaction(chain, config, packet.commitment, hash);
  const handler = createReceiptVerifierHandler({ config: () => config, chain: () => chain });
  const make = (body: unknown) => new Request("http://localhost:3100/api/receipts/verify", { method: "POST", headers: { origin: "http://localhost:3100", "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await handler(make({ commitment: packet.commitment, receipt }))).status, 200);
  assert.equal((await handler(make({ commitment: packet.commitment, receipt, envelope: {} }))).status, 400);
  chain.unavailable = true;
  const failed = await handler(make({ commitment: packet.commitment, receipt }));
  assert.equal(failed.status, 502);
  assert.doesNotMatch(await failed.text(), /secret-api-key|rpc.invalid/);
});

test("missing, zero and malformed registry addresses disable configuration", () => {
  for (const value of ["", "bad", "0x0000000000000000000000000000000000000000"])
    assert.deepEqual({ configured: receiptConfig(value).configured, address: receiptConfig(value).contractAddress }, { configured: false, address: null });
  assert.equal(receiptConfig(contract).chainId, 10143);
  assert.equal(receiptConfig(contract).rpcUrl, "https://testnet-rpc.monad.xyz");
});
