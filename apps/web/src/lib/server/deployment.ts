/** Shared by Edge middleware and Node routes. Never trust forwarded host/origin headers. */
type Environment = Record<string, string | undefined>;
export type Deployment =
  | { mode: "local" }
  | { mode: "invalid" }
  | { mode: "hosted"; origin: URL; username: string; password: string };

export function deployment(env: Environment = process.env): Deployment {
  if (env.NODE_ENV !== "production" && !env.WEB_APP_ORIGIN) return { mode: "local" };
  try {
    const origin = new URL(env.WEB_APP_ORIGIN || "");
    const username = env.WEB_DEMO_USERNAME || "un";
    const password = env.WEB_DEMO_PASSWORD || "";
    if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash ||
      !/^[a-zA-Z0-9._-]{1,64}$/.test(username) || password.length < 24 ||
      password.length > 256 || !/^[\x21-\x7e]+$/.test(password)) return { mode: "invalid" };
    return { mode: "hosted", origin, username, password };
  } catch { return { mode: "invalid" }; }
}

export function trustedAppOrigin(request: Request, config = deployment()): URL | undefined {
  if (config.mode === "invalid") return undefined;
  try {
    const url = new URL(request.url);
    const host = request.headers.get("host") || url.host;
    if (config.mode === "hosted") {
      // Railway terminates TLS. Its internal request URL may use HTTP/localhost;
      // the configured public origin is the sole authority for scheme and CSRF.
      return host.toLowerCase() === config.origin.host ? config.origin : undefined;
    }
    if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)) return undefined;
    const expected = new URL(`${url.protocol}//${host}`);
    if (![url.hostname, expected.hostname].every(value => ["localhost", "127.0.0.1", "[::1]"].includes(value))) return undefined;
    return expected;
  } catch { return undefined; }
}

async function equalCredentials(actual: string, expected: string) {
  const encode = new TextEncoder();
  const [left, right] = await Promise.all([actual, expected].map(value =>
    crypto.subtle.digest("SHA-256", encode.encode(value)).then(value => new Uint8Array(value))));
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

/** One shared demo password protects all pages, provider calls, and saved records. */
export async function checkWebAccess(request: Request, config = deployment()): Promise<Response | undefined> {
  const reply = (message: string, status: number, headers: Record<string, string> = {}) =>
    new Response(message, { status, headers: { "Cache-Control": "no-store", ...headers } });
  if (config.mode === "invalid") return reply("Hosted demo configuration is incomplete.", 503);
  const origin = trustedAppOrigin(request, config);
  if (!origin) return reply("Untrusted app host.", 403);
  if (config.mode === "hosted") {
    let credentials = "";
    const authorization = request.headers.get("authorization") || "";
    if (/^Basic /i.test(authorization) && authorization.length < 1024) {
      try { credentials = atob(authorization.slice(6)); } catch { /* Invalid Basic credentials. */ }
    }
    if (!await equalCredentials(credentials, `${config.username}:${config.password}`))
      return reply("Sign in to the UN demo.", 401, { "WWW-Authenticate": 'Basic realm="UN demo", charset="UTF-8"' });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    (request.headers.get("origin") !== origin.origin || request.headers.get("sec-fetch-site") === "cross-site"))
    return reply("Use this app's own page to submit changes.", 403);
}
