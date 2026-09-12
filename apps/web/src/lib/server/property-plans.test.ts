import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPropertyPlansHandler, PropertyPlanService } from "./property-plans";
import type { Workplace, WorkplaceTask } from "./workplace";

const session = "a".repeat(64);
const input = {
  title: "Confirm repair completion", category: "maintenance",
  steps: [{ title: "Review completion", owner: "Maintenance coordinator", details: "Compare vendor notes with resident confirmation." }],
  toolIds: ["property-meld"], destination: "local" as const, approved: true as const,
};
class FakeWorkplace implements Workplace {
  id = "operator-a";
  workspaceId = "workspace-a";
  creates = 0;
  reads = 0;
  failure: "before" | "after" | undefined;
  tasks: WorkplaceTask[] = [];
  async identity() { return { id: this.id, workspaceId: this.workspaceId, name: "Demo operator" }; }
  async list(marker: string) { return this.tasks.filter((task) => task.description.includes(marker)); }
  async get(id: string) {
    this.reads++;
    const task = this.tasks.find((task) => task.id === id);
    if (!task) throw new Error("Missing task");
    return task;
  }
  async create(title: string, description: string, beforeWrite: () => Promise<void>) {
    await beforeWrite();
    this.creates++;
    if (this.failure === "before") throw new Error("Transport lost");
    const task = { id: "11111111-1111-4111-8111-111111111111", title, description, url: null };
    this.tasks.push(task);
    if (this.failure === "after") throw new Error("Reply lost");
    return task;
  }
}
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "property-plans-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, service: new PropertyPlanService(directory), provider: new FakeWorkplace() };
}

test("local plans survive restart, deduplicate concurrent saves, and stay isolated by session", async (t) => {
  const { directory, service } = await fixture(t);
  const [first, second] = await Promise.all([service.save(session, input), service.save(session, input)]);
  assert.equal(first.id, second.id);
  assert.equal(first.destination, "local");
  assert.equal(first.externalTask, undefined);
  const restarted = new PropertyPlanService(directory);
  assert.deepEqual(await restarted.list(session), [first]);
  assert.equal((await restarted.save(session, input)).id, first.id);
  assert.deepEqual(await restarted.list("b".repeat(64)), []);
  assert.notEqual((await restarted.save("b".repeat(64), input)).id, first.id);
});

test("missing approval, invalid fields, and absent provider never produce a saved plan", async (t) => {
  const { directory, service } = await fixture(t);
  await assert.rejects(service.save(session, { ...input, approved: false }), /approve/);
  await assert.rejects(service.save(session, { ...input, email: "not-to-store@example.test" }));
  await assert.rejects(service.save(session, { ...input, steps: [] }));
  await assert.rejects(service.save("../escape", input), /session/);
  await assert.rejects(service.save(session, { ...input, destination: "ambiguous" }), /not configured/);
  assert.deepEqual(await service.list(session), []);
  for (const folder of await readdir(directory)) assert.deepEqual(await readdir(join(directory, folder)), []);
});

test("Ambiguous writes only approved plan data, reads it back, preserves null URLs and deduplicates", async (t) => {
  const { directory, provider } = await fixture(t);
  const service = new PropertyPlanService(directory, provider);
  const remote = { ...input, destination: "ambiguous" };
  const results = await Promise.allSettled([service.save(session, remote), service.save(session, remote)]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  assert.equal(provider.creates, 1);
  assert.ok(provider.reads > 0);
  const restored = await new PropertyPlanService(directory, provider).save(session, remote);
  assert.deepEqual(restored.externalTask, { id: provider.tasks[0].id, url: null });
  assert.equal(provider.creates, 1);
  assert.equal((await service.list(session)).length, 1);
  assert.match(provider.tasks[0].description, /no resident messages/);
});

test("an uncertain external attempt cannot be blindly retried after restart", async (t) => {
  const { directory, provider } = await fixture(t);
  provider.failure = "before";
  const remote = { ...input, destination: "ambiguous" };
  await assert.rejects(new PropertyPlanService(directory, provider).save(session, remote), /uncertain/);
  provider.failure = undefined;
  await assert.rejects(new PropertyPlanService(directory, provider).save(session, remote), /uncertain/);
  assert.equal(provider.creates, 1);
  assert.deepEqual(await new PropertyPlanService(directory).list(session), []);
});

test("lost provider response is reconciled without duplicate; changed identity is rejected", async (t) => {
  const { directory, provider } = await fixture(t);
  provider.failure = "after";
  const remote = { ...input, destination: "ambiguous" };
  await assert.rejects(new PropertyPlanService(directory, provider).save(session, remote), /uncertain/);
  provider.failure = undefined;
  const service = new PropertyPlanService(directory, provider);
  const recovered = await service.save(session, remote);
  assert.equal(recovered.externalTask?.id, provider.tasks[0].id);
  assert.equal(provider.creates, 1);
  provider.workspaceId = "another-workspace";
  await assert.rejects(service.save(session, remote), /workspace changed/);
  assert.equal(provider.creates, 1);
});

test("pre-send schema failures remain retryable and unexpected readback is never saved", async (t) => {
  const { directory, provider } = await fixture(t);
  const create = provider.create.bind(provider);
  provider.create = async () => { throw new Error("Schema unavailable"); };
  const remote = { ...input, destination: "ambiguous" };
  const service = new PropertyPlanService(directory, provider);
  await assert.rejects(service.save(session, remote), /Schema/);
  assert.equal(provider.creates, 0);
  provider.create = create;
  const get = provider.get.bind(provider);
  provider.get = async (id) => ({ ...(await get(id)), title: "Different title" });
  await assert.rejects(service.save(session, remote), /differs/);
  assert.deepEqual(await service.list(session), []);
  assert.equal(provider.creates, 1);
});

test("HTTP session, loopback, same-origin, JSON and approval gates run before provider access", async (t) => {
  const { directory } = await fixture(t);
  let connects = 0;
  const handler = createPropertyPlansHandler({ directory, isAmbiguousConfigured: () => false,
    connect: () => { connects++; return undefined; } });
  const initial = await handler(new Request("http://localhost:3100/api/plans"));
  assert.deepEqual(await initial.json(), { plans: [], ambiguousConfigured: false });
  assert.match(initial.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict/);
  const cookie = initial.headers.get("set-cookie")!.split(";")[0];
  const post = (body: unknown, headers: Record<string, string> = {}) => handler(new Request("http://localhost:3100/api/plans", {
    method: "POST", headers: { cookie, origin: "http://localhost:3100", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  }));
  assert.equal((await post(input, { origin: "https://evil.test" })).status, 403);
  assert.equal((await post(input, { cookie: "" })).status, 403);
  assert.equal((await post(input, { host: "evil.test", origin: "http://evil.test" })).status, 403);
  assert.equal((await post(input, { "content-type": "text/plain" })).status, 403);
  assert.equal((await post({ ...input, destination: "ambiguous", approved: false })).status, 403);
  assert.equal(connects, 0);
  assert.equal((await post(input)).status, 200);
  assert.equal(connects, 0);
  assert.equal((await post({ ...input, destination: "ambiguous" })).status, 503);
  assert.equal(connects, 1);
  const listed = await handler(new Request("http://localhost:3100/api/plans", { headers: { cookie } }));
  assert.equal((await listed.json()).plans.length, 1);
});

test("HTTP provider failures are sanitized and never reported as local saves", async (t) => {
  const { directory } = await fixture(t);
  const handler = createPropertyPlansHandler({ directory, isAmbiguousConfigured: () => true,
    connect: () => { throw new Error("Authorization: secret-provider-key"); } });
  const initial = await handler(new Request("http://127.0.0.1:3100/api/plans"));
  const cookie = initial.headers.get("set-cookie")!.split(";")[0];
  const response = await handler(new Request("http://127.0.0.1:3100/api/plans", {
    method: "POST", headers: { cookie, origin: "http://127.0.0.1:3100", "content-type": "application/json" },
    body: JSON.stringify({ ...input, destination: "ambiguous" }),
  }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret-provider-key/);
  const listed = await handler(new Request("http://127.0.0.1:3100/api/plans", { headers: { cookie } }));
  assert.deepEqual((await listed.json()).plans, []);
});
