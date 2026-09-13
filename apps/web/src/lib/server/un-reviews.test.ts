import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { DEMO_TODAY, defaultPreferences, demoUnits } from "../un-demo";
import { reviewUnit } from "../un-review";
import { createUnReviewsHandler, UnReviewService } from "./un-reviews";

const session = "a".repeat(64);
const input = {
  unitId: "un-demo-unit-04",
  asOf: DEMO_TODAY,
  preferences: defaultPreferences,
  reviewerNote: "Confirm notice template and service method before release.",
  approved: true as const,
};
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "un-reviews-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, service: new UnReviewService(directory), handler: createUnReviewsHandler({ directory }) };
}
async function browser(handler: ReturnType<typeof createUnReviewsHandler>) {
  const initial = await handler(new Request("http://localhost:3100/api/un/reviews"));
  const cookie = initial.headers.get("set-cookie")!.split(";")[0];
  return {
    initial, cookie,
    list: () => handler(new Request("http://localhost:3100/api/un/reviews", { headers: { cookie } })),
    post: (value: unknown, headers: Record<string, string> = {}) => handler(new Request("http://localhost:3100/api/un/reviews", {
      method: "POST", headers: { cookie, origin: "http://localhost:3100", "content-type": "application/json", ...headers }, body: JSON.stringify(value),
    })),
  };
}

test("saved reviews preserve the complete server packet and survive restart", async (t) => {
  const { directory, service } = await fixture(t);
  const record = await service.save(session, input);
  assert.equal(record.destination, "local");
  assert.equal(record.simulationDate, DEMO_TODAY);
  assert.equal(record.reviewerNote, input.reviewerNote);
  assert.deepEqual(record.preferences, defaultPreferences);
  assert.equal(record.packet.daysUntilRenewal, 30);
  assert.equal(record.packet.unit.leaseEnd, "2026-10-12");
  assert.equal(record.packet.effectiveDate, "2026-10-13");
  assert.equal(record.packet.status, "draft-ready");
  assert.deepEqual(record.packet, reviewUnit(demoUnits.find((unit) => unit.id === input.unitId)!, DEMO_TODAY, defaultPreferences));
  assert.deepEqual(await new UnReviewService(directory).list(session), [record]);
  const [folder] = await readdir(directory);
  const [file] = await readdir(join(directory, folder));
  assert.deepEqual(JSON.parse(await readFile(join(directory, folder, file), "utf8")), record);
});

test("simultaneous identical saves publish one complete record, without orphan temporary files", async (t) => {
  const { directory } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 10 }, () => new UnReviewService(directory).save(session, input)));
  assert.equal(new Set(results.map((record) => record.id)).size, 1);
  assert.ok(results.every((record) => JSON.stringify(record) === JSON.stringify(results[0])));
  assert.equal((await new UnReviewService(directory).save(session, input)).id, results[0].id);
  const folders = await readdir(directory);
  assert.equal(folders.length, 1);
  assert.equal((await readdir(join(directory, folders[0]))).length, 1);
});

test("different full review inputs retain separate snapshots in chronological order", async (t) => {
  const { service } = await fixture(t);
  const variants = [
    input,
    { ...input, asOf: "2026-09-13" },
    { ...input, reviewerNote: "Follow-up assigned to Alex." },
    { ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: 1 } },
  ];
  const records = [];
  for (const variant of variants) records.push(await service.save(session, variant));
  assert.equal(new Set(records.map((record) => record.id)).size, variants.length);
  const listed = await service.list(session);
  assert.equal(listed.length, variants.length);
  assert.deepEqual(listed.map((record) => record.createdAt), records.map((record) => record.createdAt).sort().reverse());
});

test("changed seed evidence creates a new snapshot while preserving the previous reviewed version", async (t) => {
  const { directory, service } = await fixture(t);
  const unit = demoUnits.find((candidate) => candidate.id === input.unitId)!;
  const evidence = unit.evidence[0];
  const originalBody = evidence.body;
  const first = await service.save(session, input);
  try {
    evidence.body = `${originalBody}\nAn additional lease amendment was added to the fictional source file.`;
    const revised = await service.save(session, input);
    assert.notEqual(revised.id, first.id);
    assert.equal(revised.packet.evidence.find((item) => item.id === evidence.id)!.body, evidence.body);
    assert.equal((await service.save(session, input)).id, revised.id);
    const saved = await new UnReviewService(directory).list(session);
    assert.equal(saved.length, 2);
    assert.deepEqual(saved.find((record) => record.id === first.id), first);
    assert.equal(saved.find((record) => record.id === first.id)!.packet.evidence.find((item) => item.id === evidence.id)!.body, originalBody);
  } finally {
    evidence.body = originalBody;
  }
  assert.equal((await service.save(session, input)).id, first.id);
});

test("blocked review packets can be retained as unchanged internal follow-ups", async (t) => {
  const { service } = await fixture(t);
  const unit = demoUnits.find((candidate) => candidate.id === "un-demo-unit-12")!;
  const packet = reviewUnit(unit, DEMO_TODAY, defaultPreferences);
  const record = await service.save(session, { ...input, unitId: unit.id });
  assert.deepEqual(record.packet, packet);
  assert.equal(record.destination, "local");
  assert.equal("sentAt" in record, false);
  assert.equal("servedAt" in record, false);
});

test("strict validation rejects missing approval, unknown units, invalid dates, preferences, and client-authored packets", async (t) => {
  const { directory, service } = await fixture(t);
  const invalid = [
    { ...input, approved: false },
    { ...input, approved: undefined },
    { ...input, unitId: "../outside" },
    { ...input, asOf: "2026-02-30" },
    { ...input, asOf: "2026-9-12" },
    { ...input, asOf: "2026-09-12T00:00:00Z" },
    { ...input, preferences: { ...defaultPreferences, reviewLeadDays: 0 } },
    { ...input, preferences: { ...defaultPreferences, reviewLeadDays: 181 } },
    { ...input, preferences: { ...defaultPreferences, reviewLeadDays: 30.5 } },
    { ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: -1 } },
    { ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: 11 } },
    { ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: Infinity } },
    { ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: "2" } },
    { ...input, preferences: { ...defaultPreferences, reviewer: " " } },
    { ...input, preferences: { ...defaultPreferences, reviewer: "a".repeat(121) } },
    { ...input, preferences: { ...defaultPreferences, legalCap: 99 } },
    { ...input, reviewerNote: "a".repeat(4001) },
    { ...input, packet: { status: "ready", draft: "Injected notice" } },
    { ...input, destination: "ambiguous" },
    { ...input, path: "/tmp/outside.json" },
  ];
  for (const value of invalid) await assert.rejects(service.save(session, value));
  await assert.rejects(service.save("../escape", input), /session/);
  await assert.rejects(service.list("../escape"), /session/);
  assert.deepEqual(await service.list(session), []);
  assert.deepEqual(await readdir(directory), []);
});

test("zero percent and boundary lead times remain valid review inputs", async (t) => {
  const { service } = await fixture(t);
  for (const reviewLeadDays of [1, 180]) {
    const record = await service.save(session, { ...input, preferences: { ...defaultPreferences, reviewLeadDays, requestedIncreasePercent: 0 } });
    assert.equal(record.preferences.requestedIncreasePercent, 0);
    assert.equal(record.preferences.reviewLeadDays, reviewLeadDays);
  }
});

test("browser session cookie isolates saved histories, including same-input saves", async (t) => {
  const { handler } = await fixture(t);
  const first = await browser(handler);
  const second = await browser(handler);
  assert.deepEqual(await first.initial.json(), { records: [] });
  assert.match(first.initial.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict; Path=\/api\/un\/reviews/);
  assert.equal(first.initial.headers.get("cache-control"), "no-store");
  assert.notEqual(first.cookie, second.cookie);
  const response = await first.post(input);
  assert.equal(response.status, 200);
  const { record } = await response.json();
  assert.deepEqual(await (await first.list()).json(), { records: [record] });
  assert.deepEqual(await (await second.list()).json(), { records: [] });
  const other = await (await second.post(input)).json();
  assert.notEqual(other.record.id, record.id);
  const duplicate = await (await first.post(input)).json();
  assert.equal(duplicate.record.id, record.id);
});

test("HTTP loopback, origin, JSON, and explicit internal-save approval gates reject unsafe requests", async (t) => {
  const { handler } = await fixture(t);
  const { post, list } = await browser(handler);
  const rejectedHeaders: Record<string, string>[] = [
    { origin: "https://evil.test" }, { origin: "" }, { cookie: "" },
    { cookie: "un-review-session=../../escape" },
    { host: "evil.test", origin: "http://evil.test" },
    { host: "localhost:3100@evil.test" }, { host: "localhost:99999" },
    { "content-type": "text/plain" },
  ];
  for (const headers of rejectedHeaders) assert.equal((await post(input, headers)).status, 403);
  assert.equal((await handler(new Request("http://evil.test/api/un/reviews", { headers: { host: "localhost:3100" } }))).status, 403);
  assert.equal((await post({ ...input, approved: false })).status, 403);
  assert.equal((await post({ ...input, approved: undefined })).status, 403);
  assert.equal((await post({ ...input, packet: {} })).status, 400);
  assert.equal((await post({ ...input, asOf: "2026-02-30" })).status, 400);
  const put = await handler(new Request("http://localhost:3100/api/un/reviews", { method: "PUT" }));
  assert.equal(put.status, 405);
  assert.equal(put.headers.get("allow"), "GET, POST");
  assert.deepEqual(await (await list()).json(), { records: [] });
});

test("HTTP rejects oversized byte bodies and malformed JSON without saving", async (t) => {
  const { handler } = await fixture(t);
  const { cookie, post, list } = await browser(handler);
  assert.equal((await post({ ...input, reviewerNote: "x".repeat(17_000) })).status, 413);
  assert.equal((await post({ ...input, reviewerNote: "界".repeat(6000) })).status, 413);
  assert.equal((await post(input, { "content-length": "17000" })).status, 413);
  const malformed = await handler(new Request("http://localhost:3100/api/un/reviews", {
    method: "POST", headers: { cookie, origin: "http://localhost:3100", "content-type": "application/json" }, body: "{broken",
  }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(await (await list()).json(), { records: [] });
});

test("storage never follows session or record symlinks outside the provided directory", async (t) => {
  await t.test("rejects a session directory link, including Windows junctions", async (t) => {
    const { directory, service } = await fixture(t);
    const outside = await mkdtemp(join(tmpdir(), "un-outside-"));
    t.after(() => rm(outside, { recursive: true, force: true }));
    const sessionDirectory = join(directory, createHash("sha256").update(session).digest("hex"));
    await symlink(outside, sessionDirectory, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(service.save(session, input));
    await assert.rejects(service.list(session));
    assert.deepEqual(await readdir(outside), []);
  });

  await t.test("rejects a saved record file symlink", async (t) => {
    const { directory, service } = await fixture(t);
    const outside = await mkdtemp(join(tmpdir(), "un-outside-"));
    t.after(() => rm(outside, { recursive: true, force: true }));
    const sessionDirectory = join(directory, createHash("sha256").update(session).digest("hex"));
    await mkdir(sessionDirectory);
    const outsideFile = join(outside, "secret.json");
    await writeFile(outsideFile, "local-secret-do-not-return");
    try {
      await symlink(outsideFile, join(sessionDirectory, `${"b".repeat(64)}.saved.json`), "file");
    } catch (error) {
      if (process.platform === "win32" && error instanceof Error && "code" in error && error.code === "EPERM") {
        t.skip("File symlinks require Windows Developer Mode or elevated privileges; directory junction checks still run.");
        return;
      }
      throw error;
    }
    await assert.rejects(service.list(session));
    assert.equal(await readFile(outsideFile, "utf8"), "local-secret-do-not-return");
  });
});

test("HTTP storage failures expose a safe error without paths or file contents", async (t) => {
  const { directory } = await fixture(t);
  const unavailable = join(directory, "secret-storage-file");
  await writeFile(unavailable, "local-secret-do-not-return");
  const handler = createUnReviewsHandler({ directory: unavailable });
  const response = await handler(new Request("http://localhost:3100/api/un/reviews"));
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.doesNotMatch(text, /secret-storage-file|local-secret|ENOENT|ENOTDIR/);
  assert.match(text, /local storage/);
});
