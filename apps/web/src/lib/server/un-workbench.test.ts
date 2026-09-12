import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_TODAY, defaultPreferences } from "../un-demo";
import { evaluateUnScenario, handleUnScenario } from "./un-workbench";
import { UnReviewService } from "./un-reviews";

const input = { unitId: "un-demo-unit-04", asOf: DEMO_TODAY, preferences: defaultPreferences };
const request = (value: unknown) => new Request("http://localhost:3100/api/un/scenario", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });

test("hypothetical 4% stays blocked and leaves baseline and later evaluations unchanged", () => {
  const before = evaluateUnScenario(input);
  const result = evaluateUnScenario({ ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: 4 } });
  assert.equal(result.baseline.status, "draft-ready");
  assert.equal(result.proposed.status, "blocked");
  assert.equal(result.proposed.requestedRent, 2080);
  assert.equal(result.proposed.draft, null);
  assert.ok(result.changes.some(change => change.field === "Review status"));
  assert.deepEqual(evaluateUnScenario(input), before);
  assert.deepEqual(evaluateUnScenario(input).changes, []);
});

test("agent scenarios cannot override facts, rules, calculations or status", async () => {
  for (const extra of [{ coverage: "confirmed" }, { capPercent: 99 }, { proposed: { status: "draft-ready" } }, { evidence: [] }]) {
    assert.equal((await handleUnScenario(request({ ...input, ...extra }))).status, 400);
  }
  assert.equal((await handleUnScenario(request({ ...input, preferences: { ...defaultPreferences, legalCap: 99 } }))).status, 400);
});

test("investigation keeps contradictory evidence and unknown coverage unresolved", () => {
  const conflict = evaluateUnScenario({ ...input, unitId: "un-demo-unit-12" });
  assert.equal(conflict.proposed.status, "needs-evidence");
  assert.equal(conflict.proposed.nextEligibleDate, null);
  assert.equal(conflict.proposed.draft, null);
  assert.match(conflict.proposed.blockers.join(" "), /2026-03-01.*2025-12-01/);
  const unknown = evaluateUnScenario({ ...input, unitId: "un-demo-unit-08" });
  assert.equal(unknown.proposed.capPercent, null);
});

test("planning changes and expired source periods go through the existing rules", () => {
  const shorter = evaluateUnScenario({ ...input, preferences: { ...defaultPreferences, reviewLeadDays: 29 } });
  assert.equal(shorter.baseline.status, "draft-ready");
  assert.equal(shorter.proposed.status, "upcoming");
  const sixtyDays = evaluateUnScenario({ ...input, preferences: { ...defaultPreferences, reviewLeadDays: 60 } });
  assert.equal(sixtyDays.proposed.status, "draft-ready");
  assert.equal(sixtyDays.proposed.daysUntilRenewal, 30);
  assert.equal(sixtyDays.proposed.effectiveDate, "2026-10-13");
  const expired = evaluateUnScenario({ ...input, unitId: "un-demo-unit-21", asOf: "2027-06-02" });
  assert.equal(expired.proposed.rule, null);
  assert.equal(expired.proposed.draft, null);
});

test("HTTP boundary validates dates, IDs, values and limits request bodies", async () => {
  for (const value of [{ ...input, unitId: "unknown" }, { ...input, asOf: "2026-02-30" }, { ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: -1 } }])
    assert.equal((await handleUnScenario(request(value))).status, 400);
  assert.equal((await handleUnScenario(request({ note: "x".repeat(9000) }))).status, 413);
  assert.equal((await handleUnScenario(new Request("http://localhost/api/un/scenario"))).status, 405);
  const response = await handleUnScenario(request(input));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), evaluateUnScenario(input));
});

test("explicit save recomputes the same preview and repeated saves keep one record", async t => {
  const directory = await mkdtemp(join(tmpdir(), "un-workbench-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const service = new UnReviewService(directory);
  const session = "b".repeat(64);
  const scenario = evaluateUnScenario({ ...input, preferences: { ...defaultPreferences, requestedIncreasePercent: 4 } });
  assert.deepEqual(await service.list(session), []);
  await assert.rejects(() => service.save(session, { ...scenario.input, reviewerNote: "Review", approved: false }));
  const value = { ...scenario.input, reviewerNote: "Review the requested amount.", approved: true };
  const saved = await service.save(session, value);
  assert.deepEqual(saved.packet, scenario.proposed);
  assert.equal((await service.save(session, value)).id, saved.id);
  assert.equal((await new UnReviewService(directory).list(session)).length, 1);
});
