import assert from "node:assert/strict";
import test from "node:test";
import { proxy } from "./worker.mjs";

const env = { BACKEND_ORIGIN: "https://un.up.railway.app", BACKEND_PASSWORD: "offline-test-password-long-enough" };
test("missing backend returns an honest unavailable response", async () => {
  assert.equal((await proxy(new Request("https://un.chatgpt.site/"), {})).status, 503);
});
test("same-origin proxy hides credentials and preserves streams and cookies", async () => {
  const request = new Request("https://un.chatgpt.site/api/un/reviews", { method: "POST", headers: {
    origin: "https://un.chatgpt.site", "content-type": "application/json", cookie: "sites-login=private; un-review-session=abc",
  }, body: "{}" });
  const result = await proxy(request, env, async (url, init) => {
    assert.equal(url.origin, env.BACKEND_ORIGIN);
    assert.equal(init.headers.get("cookie"), "un-review-session=abc");
    assert.equal(init.headers.get("origin"), env.BACKEND_ORIGIN);
    assert.match(init.headers.get("authorization"), /^Basic /);
    return new Response("saved", { headers: { "set-cookie": "un-review-session=abc; Secure; HttpOnly; SameSite=Strict; Path=/api/un/reviews" } });
  });
  assert.equal(await result.text(), "saved");
  assert.equal(result.headers.get("authorization"), null);
  assert.match(result.headers.get("set-cookie"), /Secure/);
});
test("cross-origin writes never reach Railway", async () => {
  const response = await proxy(new Request("https://un.chatgpt.site/api/un/reviews", {
    method: "POST", headers: { origin: "https://evil.test" }, body: "{}",
  }), env, () => { throw new Error("must not be called"); });
  assert.equal(response.status, 403);
});
test("double-slash paths cannot change the upstream destination", async () => {
  await proxy(new Request("https://un.chatgpt.site//evil.test/path"), env, async (url) => {
    assert.equal(url.origin, env.BACKEND_ORIGIN);
    return new Response("ok");
  });
});
