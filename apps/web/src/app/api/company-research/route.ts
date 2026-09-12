import { isIP } from "node:net";
import { isSearchConfigured, searchWeb } from "agent-core";
import { z } from "zod";
import { trustedAppOrigin } from "@/lib/server/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  website: z.string().trim().min(1).max(2048),
  confirmed: z.literal(true),
}).strict();

function publicWebsite(value: string): URL | undefined {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      !["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || (url.port && !["80", "443"].includes(url.port)) ||
      isIP(hostname.replace(/^\[|\]$/g, "")) || hostname.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example|lan|home|onion)$/.test(hostname) ||
      /(?:^|\.)example\.(?:com|net|org)$/.test(hostname)
    ) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

/** Search public company evidence only. This endpoint never fetches the supplied URL. */
export async function POST(request: Request) {
  const configured = isSearchConfigured() && Boolean(process.env.EXA_API_KEY?.trim());
  const reply = (message: string, code: number) => Response.json(
    { status: configured ? "ready" : "unconfigured", sources: [], message },
    { status: code, headers: { "Cache-Control": "no-store" } },
  );
  const expectedOrigin = trustedAppOrigin(request);
  if (
    !expectedOrigin ||
    request.headers.get("origin") !== expectedOrigin.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) return reply("Use public company research from this app's own page.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply("Send a confirmed company website as JSON.", 415);
  }
  if (Number(request.headers.get("content-length")) > 4096) {
    return reply("The research request is too large.", 413);
  }

  let parsed: z.infer<typeof input>;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 4096) return reply("The research request is too large.", 413);
    parsed = input.parse(JSON.parse(body));
  } catch {
    return reply("Provide only a website and confirmed: true. Do not include private messages.", 400);
  }
  const website = publicWebsite(parsed.website);
  if (!website) return reply("Confirm a public HTTP or HTTPS company website without credentials or query parameters.", 400);
  if (!configured) return reply("Public company research is unavailable until Exa is configured. You can continue with your own company details.", 200);

  try {
    // Intentionally discard path and all other submitted fields. Never derive this
    // query from the email field, pasted messages, or unconfirmed model output.
    const hits = await searchWeb({
      query: `site:${website.hostname} property management company communities leasing maintenance services`,
      results: 4,
    });
    if (typeof hits === "string") return reply("Public company research is unavailable. Continue with your company details.", 503);
    const sources = hits.flatMap((hit) => {
      const source = publicWebsite(hit.url);
      if (!source || !(source.hostname === website.hostname || source.hostname.endsWith(`.${website.hostname}`))) return [];
      return [{
        title: hit.title.slice(0, 300),
        url: source.toString(),
        ...(hit.highlight ? { highlights: [hit.highlight.slice(0, 1500)] } : {}),
      }];
    });
    return Response.json(
      { status: "ready", sources, ...(sources.length ? {} : { message: "No company sources found. Add or correct your company details manually." }) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Provider error strings can contain request details or credentials.
    return reply("Public company research could not finish. Try again or continue with your own details.", 502);
  }
}
