const sessionNames = new Set(["un-review-session", "property-plan-session", "web-followup-session"]);
const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const errorResponse = (message, status) => new Response(message, {
  status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
});

/** Sites controls visitor access. This Worker never sends its backend secret to a browser. */
export async function proxy(request, env, upstreamFetch = fetch) {
  let backend;
  try {
    backend = new URL(env.BACKEND_ORIGIN);
    if (backend.protocol !== "https:" || backend.username || backend.password || backend.pathname !== "/" ||
      backend.search || backend.hash || !/^[a-zA-Z0-9._-]{1,64}$/.test(env.BACKEND_USERNAME || "un") ||
      !/^[\x21-\x7e]{24,256}$/.test(env.BACKEND_PASSWORD || "")) throw new Error("Invalid backend");
  } catch { return errorResponse("UN is not connected to its backend yet.", 503); }
  const incoming = new URL(request.url);
  if (incoming.origin === backend.origin) return errorResponse("Invalid backend configuration.", 503);
  if (!methods.has(request.method)) return errorResponse("Method not allowed.", 405);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    (request.headers.get("origin") !== incoming.origin || request.headers.get("sec-fetch-site") === "cross-site"))
    return errorResponse("Use UN's own page to submit changes.", 403);

  // Set pathname independently so a path beginning // cannot change the upstream host.
  const target = new URL(backend);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  // Forward only application headers, not Sites login cookies or visitor credentials.
  for (const name of ["accept", "accept-language", "content-type", "origin", "range", "if-none-match", "if-modified-since", "rsc", "next-router-state-tree", "next-router-prefetch", "next-url", "next-action"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set("authorization", `Basic ${btoa(`${env.BACKEND_USERNAME || "un"}:${env.BACKEND_PASSWORD}`)}`);
  if (headers.has("origin")) headers.set("origin", backend.origin);
  const cookies = (request.headers.get("cookie") || "").split(";").map(value => value.trim())
    .filter(value => sessionNames.has(value.split("=", 1)[0]));
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  try {
    const upstream = await upstreamFetch(target, {
      method: request.method, headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
      // Streams remain streams in Workers; no buffering of CopilotKit/SSE responses.
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("www-authenticate");
    responseHeaders.delete("server");
    // Prevent shared caches from exposing authenticated pages or saved review data.
    responseHeaders.set("cache-control", "private, no-store");
    const location = responseHeaders.get("location");
    if (location) {
      const redirect = new URL(location, backend);
      if (redirect.origin !== backend.origin) return errorResponse("Unexpected backend redirect.", 502);
      responseHeaders.set("location", `${incoming.origin}${redirect.pathname}${redirect.search}${redirect.hash}`);
    }
    if (upstream.status === 401) return errorResponse("UN's backend connection needs attention.", 502);
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch { return errorResponse("UN's backend is temporarily unavailable. Please try again.", 502); }
}

export default { fetch: (request, env) => proxy(request, env) };
