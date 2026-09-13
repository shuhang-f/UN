import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { defaultPreferences, DEMO_TODAY, demoUnits } from "../un-demo";
import { createUnReviewsHandler, UnReviewService } from "./un-reviews";
import { createUnHandoffsHandler, UnHandoffService } from "./un-handoffs";
import type { Workplace, WorkplaceTask } from "./workplace";

const session = "a".repeat(64);
const otherSession = "b".repeat(64);
const reviewInput = {
  unitId: "un-demo-unit-04", asOf: DEMO_TODAY, preferences: defaultPreferences,
  reviewerNote: "Check the template and evidence before notice delivery.", approved: true as const,
};
const saveInput = (reviewId: string) => ({ action: "draft", reviewId, approved: true });
class TestWorkplace implements Workplace {
  tasks: WorkplaceTask[] = [];
  writes = 0;
  reads: string[] = [];
  identityCalls = 0;
  workspaceId = "workspace-one";
  identityId = "manager-one";
  failBefore = false;
  failAfter = false;
  failGet = false;
  omitResults = false;
  dropWrite = false;
  changeBeforeWrite = false;
  async identity() {
    this.identityCalls++;
    return { id: this.identityId, workspaceId: this.workspaceId, name: "Property manager" };
  }
  async list(marker: string) { return this.omitResults ? [] : this.tasks.filter(task => task.description.includes(marker)); }
  async get(id: string) {
    this.reads.push(id);
    if (this.failGet) throw new Error("private provider error");
    const task = this.tasks.find(task => task.id === id);
    if (!task) throw new Error("task missing");
    return { ...task };
  }
  async create(title: string, description: string, beforeWrite: () => Promise<void>) {
    if (this.failBefore) throw new Error("schema discovery failed");
    if (this.changeBeforeWrite) this.workspaceId = "workspace-two";
    await beforeWrite();
    this.writes++;
    const task = { id: randomUUID(), title, description, url: null };
    if (!this.dropWrite) this.tasks.push(task);
    if (this.failAfter || this.dropWrite) throw new Error("lost response");
    return task;
  }
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "un-handoffs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workplace = new TestWorkplace();
  const options = { directory: join(root, "handoffs"), reviewsDirectory: join(root, "reviews"), workplace };
  let connections = 0;
  let closes = 0;
  const handlerOptions = {
    ...options, isAmbiguousConfigured: () => true,
    connect: () => { connections++; return { workplace, close: async () => { closes++; } }; },
  };
  return {
    root, options, workplace, handlerOptions, connections: () => connections, closes: () => closes,
    service: new UnHandoffService(options), reviews: new UnReviewService(options.reviewsDirectory),
    handler: createUnHandoffsHandler(handlerOptions),
  };
}

test("a real task contains the saved evidence, reviewer note and existing UN letter with verified provider metadata", async t => {
  const { options, service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const run = await service.act(session, saveInput(review.id));
  assert.equal(run.reviewId, review.id);
  assert.equal(run.unitId, review.packet.unit.id);
  assert.equal(run.unitNumber, "04");
  assert.equal(run.mode, "ambiguous");
  assert.equal(run.status, "awaiting-approval");
  assert.equal(run.approvedAt, null);
  assert.equal(run.approvalNote, "");
  assert.deepEqual(run.letter, { title: review.packet.draft!.title, body: review.packet.draft!.body });
  assert.deepEqual(run.packet.sources, review.packet.evidence.map(({ id, title, kind, date, body }) => ({ id, title, kind, date, body })));
  assert.equal(run.externalTask.id, workplace.tasks[0].id);
  assert.equal(run.externalTask.url, null, "no invented task URL");
  assert.equal(run.externalTask.workspaceId, "workspace-one");
  assert.equal(run.externalTask.identityName, "Property manager");
  assert.ok(Date.parse(run.externalTask.verifiedAt));
  assert.deepEqual(workplace.reads, [run.externalTask.id]);
  assert.ok(workplace.tasks[0].description.includes(run.letter.body));
  assert.ok(workplace.tasks[0].description.includes(reviewInput.reviewerNote));
  for (const source of run.packet.sources) assert.ok(workplace.tasks[0].description.includes(source.body));
  assert.match(workplace.tasks[0].description, /has not drafted or sent a notice/);
  const restored = (await new UnHandoffService(options).list(session))[0];
  assert.equal(restored.id, run.id);
  assert.equal(restored.externalTask.id, run.externalTask.id);
  assert.equal(workplace.reads.length, 2, "refresh reads the provider's exact task ID");
  assert.equal(workplace.writes, 1);
  assert.deepEqual(await reviews.list(session), [review]);
});

test("handoff fields stay bound to the saved review after seed evidence changes", async t => {
  const { service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const evidence = demoUnits[0].evidence[0];
  const originalBody = evidence.body;
  try {
    evidence.body = `${originalBody}\nLater evidence not in the saved review.`;
    const run = await service.act(session, saveInput(review.id));
    assert.equal(run.packet.sources.find(source => source.id === evidence.id)!.body, originalBody);
    assert.equal(run.letter.body, review.packet.draft!.body);
  } finally { evidence.body = originalBody; }
});

test("external save requires explicit consent before provider access and has no missing-key simulation", async t => {
  const { service, reviews, workplace, options, handlerOptions } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  for (const approved of [undefined, false, "true", 1])
    await assert.rejects(service.act(session, { action: "draft", reviewId: review.id, approved }), /explicitly approve/);
  assert.equal(workplace.identityCalls, 0);
  const disconnected = new UnHandoffService({ ...options, workplace: undefined });
  await assert.rejects(disconnected.act(session, saveInput(review.id)), { status: 503 });
  assert.deepEqual(await disconnected.list(session), []);
  const handler = createUnHandoffsHandler({ ...handlerOptions, isAmbiguousConfigured: () => false, connect: () => undefined });
  assert.deepEqual(await (await handler(new Request("http://localhost:3100/api/un/reviews/handoff"))).json(), { runs: [], ambiguousConfigured: false });
  const headers = { cookie: `un-review-session=${session}`, origin: "http://localhost:3100", "content-type": "application/json" };
  const response = await handler(new Request("http://localhost:3100/api/un/reviews/handoff", { method: "POST", headers, body: JSON.stringify(saveInput(review.id)) }));
  assert.equal(response.status, 503);
  assert.equal(workplace.writes, 0);
});

test("concurrent retries create one provider task and one stable run", async t => {
  const { options, service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => new UnHandoffService(options).act(session, saveInput(review.id))));
  const successful = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  assert.ok(successful.length);
  assert.equal(new Set(successful.map(run => run.id)).size, 1);
  for (const result of results) if (result.status === "rejected") assert.equal(result.reason.status, 409);
  assert.equal(workplace.writes, 1);
  const retry = await service.act(session, saveInput(review.id));
  assert.equal(retry.id, successful[0].id);
  assert.equal(retry.externalTask.id, successful[0].externalTask.id);
  const [folder] = await readdir(options.directory);
  assert.ok((await readdir(join(options.directory, folder))).every(file => !file.endsWith(".tmp")));
});

test("manager approval stays local, preserves the saved task, and rejects conflicting notes", async t => {
  const { options, service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const draft = await service.act(session, saveInput(review.id));
  const local = new UnHandoffService({ ...options, workplace: undefined });
  const input = { action: "approve", runId: draft.id, approvalNote: "Checked the letter and source packet." };
  const approvedRuns = await Promise.all(Array.from({ length: 8 }, () => local.act(session, input)));
  const approved = approvedRuns[0];
  assert.ok(approvedRuns.every(run => JSON.stringify(run) === JSON.stringify(approved)));
  assert.equal(approved.status, "approved");
  assert.ok(approved.approvedAt);
  assert.deepEqual(approved.letter, draft.letter);
  assert.deepEqual(approved.packet, draft.packet);
  assert.equal(approved.externalTask.id, draft.externalTask.id);
  assert.equal("sentAt" in approved, false);
  assert.equal("servedAt" in approved, false);
  assert.equal(workplace.writes, 1);
  assert.equal(workplace.reads.length, 1, "approval does not call Ambiguous");
  assert.deepEqual(await local.act(session, input), approved);
  await assert.rejects(local.act(session, { ...input, approvalNote: "Replace decision" }), /different note/);
  assert.deepEqual(await local.list(session), [approved]);
});

test("lost create response reconciles the exact existing task without another write", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  workplace.failAfter = true;
  await assert.rejects(service.act(session, saveInput(review.id)), /outcome is uncertain/);
  assert.deepEqual(await service.list(session), []);
  workplace.failAfter = false;
  const recovered = await service.act(session, saveInput(review.id));
  assert.equal(recovered.externalTask.id, workplace.tasks[0].id);
  assert.equal(workplace.writes, 1);
});

test("a known provider ID recovers readback even when list results are delayed", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  workplace.failGet = true;
  await assert.rejects(service.act(session, saveInput(review.id)), /outcome is uncertain/);
  assert.deepEqual(await service.list(session), []);
  workplace.failGet = false;
  workplace.omitResults = true;
  const recovered = await service.act(session, saveInput(review.id));
  assert.equal(recovered.externalTask.id, workplace.tasks[0].id);
  assert.equal(workplace.writes, 1);
});

test("an uncertain write without a discoverable task is never sent twice", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  workplace.dropWrite = true;
  await assert.rejects(service.act(session, saveInput(review.id)), /outcome is uncertain/);
  workplace.dropWrite = false;
  await assert.rejects(service.act(session, saveInput(review.id)), /outcome is uncertain/);
  assert.equal(workplace.writes, 1);
  assert.equal(workplace.tasks.length, 0);
});

test("pre-send discovery errors are retryable and workspace changes block the write", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  workplace.failBefore = true;
  await assert.rejects(service.act(session, saveInput(review.id)), /schema discovery/);
  assert.equal(workplace.writes, 0);
  workplace.failBefore = false;
  workplace.changeBeforeWrite = true;
  await assert.rejects(service.act(session, saveInput(review.id)), /identity or workspace changed/);
  assert.equal(workplace.writes, 0);
  workplace.changeBeforeWrite = false;
  workplace.workspaceId = "workspace-one";
  const run = await service.act(session, saveInput(review.id));
  workplace.identityId = "another-manager";
  await assert.rejects(service.act(session, saveInput(review.id)), /identity or workspace changed/);
  assert.match((await service.list(session))[0].verificationError!, /identity or workspace changed/);
  assert.equal(workplace.tasks[0].id, run.externalTask.id);
  assert.equal(workplace.writes, 1);
});

test("duplicate, altered and unsafe provider records are not confirmed or recreated", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  workplace.failAfter = true;
  await assert.rejects(service.act(session, saveInput(review.id)));
  workplace.failAfter = false;
  workplace.tasks.push({ ...workplace.tasks[0], id: randomUUID() });
  await assert.rejects(service.act(session, saveInput(review.id)), /multiple tasks/);
  workplace.tasks.pop();
  const original = workplace.tasks[0].description;
  workplace.tasks[0].description = `Altered\n${original}`;
  await assert.rejects(service.act(session, saveInput(review.id)), /differs from the reviewed packet/);
  workplace.tasks[0].description = original;
  workplace.tasks[0].url = "https://evil.test/task";
  await assert.rejects(service.act(session, saveInput(review.id)), /unsafe task link/);
  workplace.tasks[0].url = "https://app.ambiguous.ai/provider-returned-record";
  const run = await service.act(session, saveInput(review.id));
  assert.equal(run.externalTask.url, workplace.tasks[0].url);
  workplace.tasks[0].title = "Changed after save";
  const [cached] = await service.list(session);
  assert.equal(cached.externalTask.verifiedAt, run.externalTask.verifiedAt);
  assert.match(cached.verificationError!, /differs from the reviewed packet/);
  assert.equal(workplace.writes, 1);
});

test("a failed provider read preserves its cached packet without hiding other verified tasks", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const first = await reviews.save(session, reviewInput);
  const second = await reviews.save(session, { ...reviewInput, reviewerNote: "A separate reviewed packet." });
  const a = await service.act(session, saveInput(first.id));
  const b = await service.act(session, saveInput(second.id));
  workplace.tasks[0].title = "Changed externally";
  const result = await service.list(session);
  assert.equal(result.find(run => run.id === a.id)!.externalTask.verifiedAt, a.externalTask.verifiedAt);
  assert.match(result.find(run => run.id === a.id)!.verificationError!, /differs/);
  assert.equal(result.find(run => run.id === b.id)!.verificationError, undefined);
  assert.equal(result.find(run => run.id === b.id)!.externalTask.id, b.externalTask.id);
});

test("unknown and cross-session review/run IDs reveal no records or writable packets", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const draft = await service.act(session, saveInput(review.id));
  assert.deepEqual(await service.list(otherSession), []);
  await assert.rejects(service.act(otherSession, saveInput(review.id)), /this browser session/);
  await assert.rejects(service.act(otherSession, { action: "approve", runId: draft.id, approvalNote: "Approved" }), /current browser session/);
  await assert.rejects(service.act(session, saveInput(randomUUID())), /this browser session/);
  assert.equal(workplace.writes, 1);
});

test("held, incomplete and upcoming review packets cannot be saved as letter tasks", async t => {
  const { service, reviews, workplace } = await fixture(t);
  for (const unitId of ["un-demo-unit-12", "un-demo-unit-08", "un-demo-unit-09", "un-demo-unit-21"]) {
    const review = await reviews.save(session, { ...reviewInput, unitId });
    await assert.rejects(service.act(session, saveInput(review.id)), /no prepared draft/);
  }
  assert.equal(workplace.identityCalls, 0);
  assert.equal(workplace.writes, 0);
});

test("strict validation rejects client-authored letters, packets, states and action overrides", async t => {
  const { service, reviews, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const base = saveInput(review.id);
  for (const invalid of [
    {}, { ...base, packet: {} }, { ...base, letter: { title: "Injected", body: "Injected" } },
    { ...base, status: "approved" }, { ...base, approvedAt: "2026-09-12T00:00:00Z" },
    { ...base, email: "not-to-send@example.test" }, { ...base, requestedRent: 9999 },
    { ...base, action: "send" }, { ...base, reviewId: "../outside" },
    { action: "approve", runId: randomUUID() },
    { action: "approve", runId: randomUUID(), approvalNote: "x".repeat(4001) },
    { action: "approve", runId: randomUUID(), approvalNote: "", packet: {} },
  ]) await assert.rejects(service.act(session, invalid));
  await assert.rejects(service.act("../outside", base), /session/);
  await assert.rejects(service.list("../outside"), /session/);
  assert.equal(workplace.identityCalls, 0);
  assert.equal(workplace.writes, 0);
});

test("HTTP shares the review cookie, verifies refreshed task IDs and closes provider connections", async t => {
  const { options, handler, workplace, connections, closes } = await fixture(t);
  const reviewsHandler = createUnReviewsHandler({ directory: options.reviewsDirectory });
  const initial = await handler(new Request("http://localhost:3100/api/un/reviews/handoff"));
  assert.deepEqual(await initial.json(), { runs: [], ambiguousConfigured: true });
  assert.equal(initial.headers.get("set-cookie"), null);
  const reviewResponse = await reviewsHandler(new Request("http://localhost:3100/api/un/reviews"));
  const cookie = reviewResponse.headers.get("set-cookie")!.split(";")[0];
  const headers = { cookie, origin: "http://localhost:3100", "content-type": "application/json" };
  const savedResponse = await reviewsHandler(new Request("http://localhost:3100/api/un/reviews", { method: "POST", headers, body: JSON.stringify(reviewInput) }));
  const { record } = await savedResponse.json();
  const post = (input: unknown) => handler(new Request("http://localhost:3100/api/un/reviews/handoff", { method: "POST", headers, body: JSON.stringify(input) }));
  assert.equal((await post({ action: "draft", reviewId: record.id })).status, 403);
  assert.equal(connections(), 0);
  const draftResponse = await post(saveInput(record.id));
  assert.equal(draftResponse.status, 200);
  const { run: draft } = await draftResponse.json();
  assert.equal((await post({ action: "approve", runId: draft.id, approvalNote: "Checked" })).status, 200);
  assert.equal(connections(), 1, "local manager approval opens no connection");
  const restored = await handler(new Request("http://localhost:3100/api/un/reviews/handoff", { headers: { cookie } }));
  assert.equal(restored.headers.get("cache-control"), "no-store");
  const body = await restored.json();
  assert.equal(body.runs[0].externalTask.id, draft.externalTask.id);
  assert.equal(body.runs[0].status, "approved");
  assert.equal(workplace.reads.length, 2);
  assert.equal(closes(), connections());
  const other = await handler(new Request("http://localhost:3100/api/un/reviews/handoff", { headers: { cookie: `un-review-session=${otherSession}` } }));
  assert.deepEqual(await other.json(), { runs: [], ambiguousConfigured: true });
  workplace.failGet = true;
  const failedRefresh = await handler(new Request("http://localhost:3100/api/un/reviews/handoff", { headers: { cookie } }));
  assert.equal(failedRefresh.status, 200);
  const cached = await failedRefresh.json();
  assert.match(cached.runs[0].verificationError, /Unable to verify/);
  assert.equal(cached.runs[0].externalTask.verifiedAt, draft.externalTask.verifiedAt);
  assert.doesNotMatch(JSON.stringify(cached), /private provider error/);
  assert.equal(closes(), connections());
});

test("HTTP enforces origin, session, JSON and byte limits before opening a connection", async t => {
  const { handler, handlerOptions, root, workplace, connections } = await fixture(t);
  const headers = { cookie: `un-review-session=${session}`, origin: "http://localhost:3100", "content-type": "application/json" };
  const post = (body: string, extra: Record<string, string> = {}) => handler(new Request("http://localhost:3100/api/un/reviews/handoff", { method: "POST", headers: { ...headers, ...extra }, body }));
  const input = JSON.stringify(saveInput(randomUUID()));
  const invalidHeaders: Record<string, string>[] = [{ cookie: "" }, { origin: "" }, { origin: "https://evil.test" }, { host: "evil.test" }, { "content-type": "text/plain" }];
  for (const extra of invalidHeaders) assert.equal((await post(input, extra)).status, 403);
  assert.equal((await post("{broken")).status, 400);
  assert.equal((await post(JSON.stringify({ ...saveInput("../path"), packet: {} }))).status, 400);
  assert.equal((await post("x".repeat(16_001))).status, 413);
  assert.equal((await post(JSON.stringify({ action: "approve", runId: randomUUID(), approvalNote: "界".repeat(6000) }))).status, 413);
  assert.equal((await post(input, { "content-length": "16001" })).status, 413);
  assert.equal((await handler(new Request("http://localhost:3100/api/un/reviews/handoff", { method: "PUT" }))).status, 405);
  assert.equal(connections(), 0);
  assert.equal(workplace.writes, 0);
  const unavailable = join(root, "secret-storage-file");
  await writeFile(unavailable, "local-secret-do-not-return");
  const brokenHandler = createUnHandoffsHandler({ ...handlerOptions, directory: unavailable });
  const error = await brokenHandler(new Request("http://localhost:3100/api/un/reviews/handoff", { headers }));
  assert.equal(error.status, 502);
  assert.doesNotMatch(await error.text(), /secret-storage-file|local-secret|ENOENT|ENOTDIR/);
});

test("storage rejects linked session directories before writing any task", async t => {
  const { service, reviews, options, root, workplace } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const outside = join(root, "outside");
  await mkdir(outside);
  await mkdir(options.directory);
  const sessionDirectory = join(options.directory, createHash("sha256").update(session).digest("hex"));
  await symlink(outside, sessionDirectory, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(service.act(session, saveInput(review.id)));
  await assert.rejects(service.list(session));
  assert.deepEqual(await readdir(outside), []);
  assert.equal(workplace.writes, 0);
});

test("storage rejects linked record files without reading the target", async t => {
  const { service, options, root } = await fixture(t);
  const sessionDirectory = join(options.directory, createHash("sha256").update(session).digest("hex"));
  await mkdir(sessionDirectory, { recursive: true });
  const target = join(root, "outside.json");
  await writeFile(target, "private record");
  try { await symlink(target, join(sessionDirectory, `${"c".repeat(64)}.saved.json`), "file"); }
  catch (error) {
    if (process.platform === "win32" && error instanceof Error && "code" in error && error.code === "EPERM") {
      t.skip("Windows file symlinks require developer mode or elevated privileges.");
      return;
    }
    throw error;
  }
  await assert.rejects(service.list(session), /Invalid handoff storage file/);
  assert.equal(await readFile(target, "utf8"), "private record");
});
