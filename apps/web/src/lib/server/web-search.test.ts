import assert from "node:assert/strict";
import test from "node:test";
import { createWebSearchHandler } from "./web-search";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3100/api/search", {
    method: "POST", headers: { origin: "http://localhost:3100", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("search sends only submitted query and preserves safe source evidence", async () => {
  const handler = createWebSearchHandler({ configured: () => true, search: async input => {
    assert.deepEqual(input, { query: "apartment turnover checklist", results: 5 });
    return [
      { title: "Checklist", url: "https://example.org/checklist", highlight: "Inspect smoke alarms.", published: "2026-09-01" },
      { title: "Unsafe", url: "javascript:alert(1)" },
      { title: "Credentials", url: "https://user:secret@example.org" },
    ];
  } });
  const response = await handler(request({ query: " apartment turnover checklist " }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.equal(result.provider, "exa");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].highlight, "Inspect smoke alarms.");
  assert.ok(result.searchedAt);
});

test("missing keys and failures cannot return simulated results or leak errors", async () => {
  let called = false;
  const missing = createWebSearchHandler({ configured: () => false, search: async () => { called = true; return []; } });
  assert.equal((await missing(request({ query: "turnover" }))).status, 503);
  assert.equal(called, false);
  const failing = createWebSearchHandler({ configured: () => true, search: async () => { throw new Error("secret-api-key"); } });
  const response = await failing(request({ query: "turnover" }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret-api-key/);
});

test("rejects cross-origin, invalid, oversized, and extra private fields before Exa", async () => {
  let calls = 0;
  const handler = createWebSearchHandler({ configured: () => true, search: async () => { calls++; return []; } });
  for (const body of [{ query: "hi" }, { query: "x".repeat(501) }, { query: "valid query", results: 100 }, { query: "valid query", messages: ["private"] }])
    assert.equal((await handler(request(body))).status, 400);
  assert.equal((await handler(request({ query: "valid query" }, { origin: "https://evil.test" }))).status, 403);
  assert.equal((await handler(request({ query: "valid query" }, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await handler(request({ query: "x".repeat(5000) }))).status, 413);
  assert.equal((await handler(new Request("http://localhost:3100/api/search", { method: "POST", headers: { origin: "http://localhost:3100", "content-type": "application/json" }, body: "{" }))).status, 400);
  assert.equal(calls, 0);
});

test("an empty real search stays empty", async () => {
  const handler = createWebSearchHandler({ configured: () => true, search: async () => [] });
  const response = await handler(request({ query: "unlikely query" }));
  assert.deepEqual((await response.json()).results, []);
});
