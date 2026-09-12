import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "un-deployment-"));
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = "https://un-smoke.example";
const password = "offline-smoke-test-password-12345";
const env = { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port),
  WEB_APP_ORIGIN: origin, WEB_DEMO_PASSWORD: password, WEB_DEMO_USERNAME: "un", UN_DATA_DIR: directory };
for (const key of Object.keys(env)) if (key.endsWith("API_KEY") || key.startsWith("RAILWAY_")) delete env[key];
let child;
async function stop() {
  if (child && child.exitCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
}
async function start(values = env) {
  child = spawn(process.execPath, ["apps/web/.next/standalone/apps/web/server.js"], { cwd: root, env: values, stdio: ["ignore", "pipe", "pipe"] });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(`http://127.0.0.1:${port}/api/health`); return; } catch { /* Wait for the listening socket. */ }
    if (child.exitCode !== null) throw new Error("Standalone server exited before listening.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Standalone server did not start.");
}
const call = (path, headers = {}, method = "GET", body) => fetch(`http://127.0.0.1:${port}${path}`, {
  method, headers: { host: new URL(origin).host, ...headers }, body,
});
const auth = { authorization: `Basic ${btoa(`un:${password}`)}` };
try {
  await start();
  assert.equal((await call("/api/health")).status, 200);
  assert.equal((await call("/")).status, 401);
  assert.equal((await call("/", auth)).status, 200);
  assert.equal((await call("/api/integrations", auth)).status, 200);
  assert.equal((await call("/api/un/scenario", { ...auth, origin: "https://evil.test" }, "POST", "{}")).status, 403);
  const initial = await call("/api/un/reviews", auth);
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get("set-cookie"), /Secure/);
  const cookie = initial.headers.get("set-cookie").split(";", 1)[0];
  assert.deepEqual((await initial.json()).records, []);
  const saved = await call("/api/un/reviews", { ...auth, cookie, origin, "content-type": "application/json" }, "POST", JSON.stringify({
    unitId: "un-demo-unit-04", asOf: "2026-09-12",
    preferences: { reviewLeadDays: 90, requestedIncreasePercent: 2, reviewer: "Deployment check" },
    reviewerNote: "Offline deployment persistence check", approved: true,
  }));
  assert.equal(saved.status, 200);
  const record = (await saved.json()).record;
  assert.ok(record.id);
  await stop();
  await start();
  const restored = await call("/api/un/reviews", { ...auth, cookie });
  assert.equal(restored.status, 200);
  assert.deepEqual((await restored.json()).records, [record]);
  await stop();
  await start({ ...env, WEB_DEMO_PASSWORD: "" });
  assert.equal((await call("/")).status, 503);
  assert.equal((await call("/api/health")).status, 503);
  console.log("Standalone deployment checks passed: health, authentication, CSRF, secure sessions, restart, and fail-closed configuration.");
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
