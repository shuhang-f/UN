import assert from "node:assert/strict";
import test from "node:test";
import { checkWebAccess, deployment, trustedAppOrigin } from "./deployment";

const origin = "https://un-demo.up.railway.app";
const password = "offline-test-password-long-enough";
const env = { NODE_ENV: "production", WEB_APP_ORIGIN: origin, WEB_DEMO_PASSWORD: password };
const config = deployment(env);
const auth = `Basic ${btoa(`un:${password}`)}`;
const request = (headers: Record<string, string> = {}, method = "GET") => new Request("http://localhost:3000/api/un/reviews", {
  method, headers: { host: new URL(origin).host, ...headers },
});

test("production fails closed without a valid HTTPS origin and strong credential", async () => {
  for (const values of [
    { NODE_ENV: "production" }, { ...env, WEB_DEMO_PASSWORD: "short" },
    { ...env, WEB_APP_ORIGIN: "http://un.example" },
    { ...env, WEB_APP_ORIGIN: "https://user:pass@un.example" },
    { ...env, WEB_APP_ORIGIN: `${origin}/unexpected` },
  ]) assert.equal((await checkWebAccess(request(), deployment(values)))?.status, 503);
});

test("proxy HTTPS uses the configured origin and rejects spoofed host headers", () => {
  assert.equal(trustedAppOrigin(request(), config)?.origin, origin);
  for (const host of ["attacker.example", "localhost:3000", `${new URL(origin).host}@evil.test`, `${new URL(origin).host}:444`])
    assert.equal(trustedAppOrigin(request({ host, "x-forwarded-host": new URL(origin).host }), config), undefined);
});

test("hosted pages and APIs require the shared credential and same-origin writes", async () => {
  for (const authorization of ["", "Basic !!!", `Basic ${btoa("un:wrong")}`])
    assert.equal((await checkWebAccess(request({ authorization }), config))?.status, 401);
  assert.equal(await checkWebAccess(request({ authorization: auth }), config), undefined);
  assert.equal(await checkWebAccess(request({ authorization: auth, origin }, "POST"), config), undefined);
  for (const value of ["", "https://evil.test", "http://un-demo.up.railway.app"])
    assert.equal((await checkWebAccess(request({ authorization: auth, origin: value }, "POST"), config))?.status, 403);
  assert.equal((await checkWebAccess(request({ authorization: auth, origin, "sec-fetch-site": "cross-site" }, "POST"), config))?.status, 403);
});

test("unconfigured development retains loopback access and blocks DNS rebinding", async () => {
  const local = deployment({ NODE_ENV: "development" });
  assert.equal(await checkWebAccess(new Request("http://127.0.0.1:3100/"), local), undefined);
  assert.equal((await checkWebAccess(new Request("http://evil.test/"), local))?.status, 403);
  assert.equal(trustedAppOrigin(new Request("http://evil.test/", { headers: { host: "localhost:3100" } }), local), undefined);
});
