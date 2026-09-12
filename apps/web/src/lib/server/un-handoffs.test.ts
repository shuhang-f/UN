import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { defaultPreferences, DEMO_TODAY, demoUnits } from "../un-demo";
import { createUnReviewsHandler, UnReviewService } from "./un-reviews";
import { createUnHandoffsHandler, UnHandoffService } from "./un-handoffs";

const session = "a".repeat(64);
const otherSession = "b".repeat(64);
const reviewInput = {
  unitId: "un-demo-unit-04", asOf: DEMO_TODAY, preferences: defaultPreferences,
  reviewerNote: "Prepare an internal simulated handoff.", approved: true as const,
};
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "un-handoffs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { directory: join(root, "handoffs"), reviewsDirectory: join(root, "reviews") };
  return {
    root, options, service: new UnHandoffService(options), reviews: new UnReviewService(options.reviewsDirectory),
    handler: createUnHandoffsHandler(options),
  };
}

test("draft handoff derives its complete snapshot from the saved review and survives restart", async (t) => {
  const { options, service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const run = await service.act(session, { action: "draft", reviewId: review.id });
  assert.equal(run.reviewId, review.id);
  assert.equal(run.unitId, review.packet.unit.id);
  assert.equal(run.unitNumber, "04");
  assert.equal(run.mode, "simulated");
  assert.equal(run.status, "awaiting-approval");
  assert.equal(run.approvedAt, null);
  assert.equal(run.approvalNote, "");
  assert.equal(run.reviewer, review.preferences.reviewer);
  assert.equal(run.simulationDate, review.simulationDate);
  assert.deepEqual(run.letter, { title: review.packet.draft!.title, body: review.packet.draft!.body });
  assert.deepEqual(run.packet, {
    role: "property-manager", summary: review.packet.summary,
    sources: review.packet.evidence.map(({ id, title, kind, date, body }) => ({ id, title, kind, date, body })),
    requestedRent: 2040, effectiveDate: "2026-10-13",
  });
  assert.match(run.letter.body, /INTERNAL SIMULATED NOTICE/);
  assert.match(run.letter.body, /No notice has been sent or served/);
  assert.deepEqual(await new UnHandoffService(options).list(session), [run]);
  assert.deepEqual(await reviews.list(session), [review]);
});

test("a handoff uses the reviewed snapshot even after seed evidence changes", async (t) => {
  const { service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const evidence = demoUnits[0].evidence[0];
  const originalBody = evidence.body;
  try {
    evidence.body = `${originalBody}\nLater fictional evidence not in the saved review.`;
    const run = await service.act(session, { action: "draft", reviewId: review.id });
    assert.equal(run.packet.sources.find(source => source.id === evidence.id)!.body, originalBody);
    assert.equal(run.letter.body, review.packet.draft!.body);
  } finally { evidence.body = originalBody; }
});

test("concurrent draft retries create one run per saved review without leftover temporary files", async (t) => {
  const { options, service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const runs = await Promise.all(Array.from({ length: 8 }, () => new UnHandoffService(options).act(session, { action: "draft", reviewId: review.id })));
  assert.equal(new Set(runs.map(run => run.id)).size, 1);
  assert.ok(runs.every(run => JSON.stringify(run) === JSON.stringify(runs[0])));
  assert.equal((await service.act(session, { action: "draft", reviewId: review.id })).id, runs[0].id);
  const [folder] = await readdir(options.directory);
  assert.equal((await readdir(join(options.directory, folder))).length, 1);
});

test("explicit approval preserves the snapshot and same-note retries retain the original approval", async (t) => {
  const { options, service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const draft = await service.act(session, { action: "draft", reviewId: review.id });
  assert.equal((await service.list(session))[0].status, "awaiting-approval");
  const input = { action: "approve", runId: draft.id, approvalNote: "Reviewed the internal mock letter." };
  const approvedRuns = await Promise.all(Array.from({ length: 8 }, () => new UnHandoffService(options).act(session, input)));
  const approved = approvedRuns[0];
  assert.ok(approvedRuns.every(run => JSON.stringify(run) === JSON.stringify(approved)));
  assert.equal(approved.status, "approved");
  assert.ok(approved.approvedAt);
  assert.deepEqual(approved, { ...draft, status: "approved", approvedAt: approved.approvedAt, approvalNote: input.approvalNote });
  assert.equal("sentAt" in approved, false);
  assert.equal("servedAt" in approved, false);
  assert.equal("externalTask" in approved, false);
  assert.deepEqual(await new UnHandoffService(options).list(session), [approved]);
  assert.deepEqual(await service.act(session, input), approved);
  assert.deepEqual(await service.act(session, { action: "draft", reviewId: review.id }), approved);
  await assert.rejects(service.act(session, { ...input, approvalNote: "Replace the previous decision." }), /different note/);
  assert.deepEqual(await service.list(session), [approved]);
  assert.deepEqual(await reviews.list(session), [review]);
});

test("different concurrent approval notes produce one recorded decision and one conflict", async (t) => {
  const { service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const draft = await service.act(session, { action: "draft", reviewId: review.id });
  const results = await Promise.allSettled(["First note", "Second note"].map(approvalNote => service.act(session, { action: "approve", runId: draft.id, approvalNote })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  const [run] = await service.list(session);
  assert.equal(run.status, "approved");
  assert.ok(["First note", "Second note"].includes(run.approvalNote));
});

test("unknown and cross-session review/run IDs reveal no records and cannot be approved", async (t) => {
  const { service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const draft = await service.act(session, { action: "draft", reviewId: review.id });
  assert.deepEqual(await service.list(otherSession), []);
  await assert.rejects(service.act(otherSession, { action: "draft", reviewId: review.id }), /this browser session/);
  await assert.rejects(service.act(otherSession, { action: "approve", runId: draft.id, approvalNote: "Approved" }), /current browser session/);
  await assert.rejects(service.act(session, { action: "draft", reviewId: randomUUID() }), /this browser session/);
  const otherReview = await reviews.save(otherSession, reviewInput);
  const otherRun = await service.act(otherSession, { action: "draft", reviewId: otherReview.id });
  assert.notEqual(otherRun.id, draft.id);
  assert.deepEqual(await service.list(session), [draft]);
});

test("held, evidence-incomplete and upcoming packets cannot produce a handoff letter", async (t) => {
  const { service, reviews } = await fixture(t);
  for (const unitId of ["un-demo-unit-12", "un-demo-unit-08", "un-demo-unit-09", "un-demo-unit-21"]) {
    const review = await reviews.save(session, { ...reviewInput, unitId });
    await assert.rejects(service.act(session, { action: "draft", reviewId: review.id }), /no prepared draft/);
  }
  assert.deepEqual(await service.list(session), []);
});

test("strict input validation rejects client-authored packets, states, letters and action overrides", async (t) => {
  const { service, reviews } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const base = { action: "draft", reviewId: review.id };
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
  assert.deepEqual(await service.list(session), []);
});

test("HTTP reuses the review cookie and restores drafts and approvals without a second session", async (t) => {
  const { options, handler } = await fixture(t);
  const reviewsHandler = createUnReviewsHandler({ directory: options.reviewsDirectory });
  const initialHandoff = await handler(new Request("http://localhost:3100/api/un/reviews/handoff"));
  assert.deepEqual(await initialHandoff.json(), { runs: [] });
  assert.equal(initialHandoff.headers.get("set-cookie"), null);
  const initialReview = await reviewsHandler(new Request("http://localhost:3100/api/un/reviews"));
  const cookie = initialReview.headers.get("set-cookie")!.split(";")[0];
  const headers = { cookie, origin: "http://localhost:3100", "content-type": "application/json" };
  const savedResponse = await reviewsHandler(new Request("http://localhost:3100/api/un/reviews", { method: "POST", headers, body: JSON.stringify(reviewInput) }));
  const { record } = await savedResponse.json();
  const post = (input: unknown) => handler(new Request("http://localhost:3100/api/un/reviews/handoff", { method: "POST", headers, body: JSON.stringify(input) }));
  const draftResponse = await post({ action: "draft", reviewId: record.id });
  assert.equal(draftResponse.status, 200);
  assert.equal(draftResponse.headers.get("set-cookie"), null);
  const { run: draft } = await draftResponse.json();
  const approvedResponse = await post({ action: "approve", runId: draft.id, approvalNote: "Internal demo approved." });
  assert.equal(approvedResponse.status, 200);
  const { run: approved } = await approvedResponse.json();
  const restored = await createUnHandoffsHandler(options)(new Request("http://localhost:3100/api/un/reviews/handoff", { headers: { cookie } }));
  assert.equal(restored.headers.get("cache-control"), "no-store");
  assert.deepEqual(await restored.json(), { runs: [approved] });
  assert.equal((await post({ action: "approve", runId: draft.id, approvalNote: "Different" })).status, 409);
  const other = await handler(new Request("http://localhost:3100/api/un/reviews/handoff", { headers: { cookie: `un-review-session=${otherSession}` } }));
  assert.deepEqual(await other.json(), { runs: [] });
});

test("HTTP enforces trusted origin, existing session, JSON, body limits and safe errors", async (t) => {
  const { handler, service, options, root } = await fixture(t);
  const headers = { cookie: `un-review-session=${session}`, origin: "http://localhost:3100", "content-type": "application/json" };
  const post = (body: string, extra: Record<string, string> = {}) => handler(new Request("http://localhost:3100/api/un/reviews/handoff", { method: "POST", headers: { ...headers, ...extra }, body }));
  const input = JSON.stringify({ action: "draft", reviewId: randomUUID() });
  const invalidHeaders: Record<string, string>[] = [{ cookie: "" }, { origin: "" }, { origin: "https://evil.test" }, { host: "evil.test" }, { "content-type": "text/plain" }];
  for (const extra of invalidHeaders) assert.equal((await post(input, extra)).status, 403);
  assert.equal((await post("{broken")).status, 400);
  assert.equal((await post(JSON.stringify({ action: "draft", reviewId: "../path", packet: {} }))).status, 400);
  assert.equal((await post(input)).status, 404);
  assert.equal((await post("x".repeat(16_001))).status, 413);
  assert.equal((await post(JSON.stringify({ action: "approve", runId: randomUUID(), approvalNote: "界".repeat(6000) }))).status, 413);
  assert.equal((await post(input, { "content-length": "16001" })).status, 413);
  assert.equal((await handler(new Request("http://localhost:3100/api/un/reviews/handoff", { method: "PUT" }))).status, 405);
  assert.deepEqual(await service.list(session), []);
  const unavailable = join(root, "secret-storage-file");
  await writeFile(unavailable, "local-secret-do-not-return");
  const brokenHandler = createUnHandoffsHandler({ ...options, directory: unavailable });
  const error = await brokenHandler(new Request("http://localhost:3100/api/un/reviews/handoff", { headers }));
  assert.equal(error.status, 502);
  assert.doesNotMatch(await error.text(), /secret-storage-file|local-secret|ENOENT|ENOTDIR/);
});

test("storage rejects symlinked session directories and record files", async (t) => {
  const { service, reviews, options, root } = await fixture(t);
  const review = await reviews.save(session, reviewInput);
  const outside = join(root, "outside");
  await mkdir(outside);
  await mkdir(options.directory);
  const sessionDirectory = join(options.directory, createHash("sha256").update(session).digest("hex"));
  await symlink(outside, sessionDirectory);
  await assert.rejects(service.act(session, { action: "draft", reviewId: review.id }));
  await assert.rejects(service.list(session));
  assert.deepEqual(await readdir(outside), []);
  await rm(sessionDirectory);
  await mkdir(sessionDirectory);
  const secret = join(outside, "secret.json");
  await writeFile(secret, "local-secret");
  await symlink(secret, join(sessionDirectory, `${"c".repeat(64)}.draft.json`));
  await assert.rejects(service.list(session));
  assert.equal(await readFile(secret, "utf8"), "local-secret");
});
