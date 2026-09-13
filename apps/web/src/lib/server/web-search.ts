import { z } from "zod";
import type { SearchHit, SearchWebArgs } from "agent-core/shared";
import { trustedAppOrigin } from "./deployment";

const inputSchema = z.object({
  query: z.string().trim().min(3).max(500),
  results: z.number().int().min(1).max(10).default(5),
}).strict();
const bodyLimit = 4096;

export function createWebSearchHandler(options: {
  configured(): boolean;
  search(input: SearchWebArgs): Promise<SearchHit[] | string>;
}) {
  return async (request: Request): Promise<Response> => {
    const reply = (body: unknown, status = 200) => Response.json(body, {
      status, headers: { "Cache-Control": "no-store" },
    });
    const origin = trustedAppOrigin(request);
    if (!origin || request.headers.get("origin") !== origin.origin || request.headers.get("sec-fetch-site") === "cross-site")
      return reply({ error: "Search from the UN app." }, 403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return reply({ error: "Send a search query as JSON." }, 415);
    if (Number(request.headers.get("content-length")) > bodyLimit)
      return reply({ error: "The search request is too large." }, 413);

    let input: z.infer<typeof inputSchema>;
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: "Enter a search query." }, 400);
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > bodyLimit) {
            await reader.cancel();
            return reply({ error: "The search request is too large." }, 413);
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      input = inputSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      return reply({ error: "Enter a query of 3–500 characters and request 1–10 results." }, 400);
    }
    if (!options.configured())
      return reply({ error: "Exa needs an API key. Add EXA_API_KEY on the server, then restart UN." }, 503);

    try {
      const hits = await options.search(input);
      if (typeof hits === "string") throw new Error("Search unavailable");
      const results = hits.slice(0, input.results).flatMap(hit => {
        try {
          const url = new URL(hit.url);
          if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return [];
          return [{
            title: hit.title.slice(0, 300), url: url.toString(),
            ...(hit.highlight ? { highlight: hit.highlight.slice(0, 2000) } : {}),
            ...(hit.published ? { published: hit.published.slice(0, 100) } : {}),
          }];
        } catch { return []; }
      });
      return reply({ results, query: input.query, searchedAt: new Date().toISOString(), provider: "exa" });
    } catch {
      return reply({ error: "Exa could not complete this search. Check your key and credit balance, then try again." }, 502);
    }
  };
}
