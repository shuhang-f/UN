import assert from "node:assert/strict";
import test from "node:test";
import { searchWeb } from "./capabilities/search";

test("Exa transport uses the documented endpoint, bounded request, and content fields", async t => {
  const previous = process.env.EXA_API_KEY;
  process.env.EXA_API_KEY = "test-key";
  t.after(() => { if (previous === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.exa.ai/search");
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>)["x-api-key"], "test-key");
    assert.ok(init.signal instanceof AbortSignal);
    const body = JSON.parse(init.body as string);
    assert.equal(body.query, "inspection checklist");
    assert.equal(body.numResults, 3);
    assert.deepEqual(body.contents, { highlights: { numSentences: 2, highlightsPerUrl: 1 } });
    return Response.json({ results: [{ title: "Inspection", url: "https://example.org/inspection", highlights: ["Check smoke alarms."], publishedDate: "2026-09-01" }] });
  });
  assert.deepEqual(await searchWeb({ query: "inspection checklist", results: 3 }), [{ title: "Inspection", url: "https://example.org/inspection", highlight: "Check smoke alarms.", published: "2026-09-01" }]);
});

test("Exa transport hides error bodies and propagates request cancellation", async t => {
  const previous = process.env.EXA_API_KEY;
  process.env.EXA_API_KEY = "test-key";
  t.after(() => { if (previous === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = previous; });
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("secret-provider-error", { status: 401 }));
  await assert.rejects(searchWeb({ query: "checklist", results: 3 }), { message: "Exa search failed (HTTP 401)." });
  mock.mock.mockImplementation(async () => { throw new DOMException("Timed out", "TimeoutError"); });
  await assert.rejects(searchWeb({ query: "checklist", results: 3 }), { name: "TimeoutError" });
});
