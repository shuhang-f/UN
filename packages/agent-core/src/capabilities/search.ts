/**
 * Grounded web search, surface-agnostic.
 *
 * Each surface wraps this in its own tool mechanism — `defineChannelTool` for
 * Channels, a server tool for the web app — so the implementation lives in one
 * place and the binding lives at the edge.
 */
import { z } from "zod";
import type { SearchHit, SearchWebArgs } from "../schemas";

/**
 * Exa search profiles are a latency dial, and the choice is not cosmetic:
 * `instant` ~250ms and `fast` ~450ms are the only sane options inside a chat
 * thread. `deep-reasoning` can take 40 seconds, which reads as a hung bot.
 */
const searchType = z.enum(["instant", "fast", "auto", "deep-lite", "deep", "deep-reasoning"]);
const responseSchema = z.object({ results: z.array(z.object({
  title: z.string().nullable().optional(), url: z.url(),
  publishedDate: z.string().nullable().optional(), highlights: z.array(z.string()).optional(),
})) });

export function isSearchConfigured(): boolean {
  return Boolean(process.env.EXA_API_KEY?.trim());
}

export async function searchWeb({ query, results }: SearchWebArgs): Promise<SearchHit[] | string> {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    return "Web search is not configured on this deployment (no EXA_API_KEY). Say so rather than guessing.";
  }

  // The installed SDK does not accept an AbortSignal. Use the documented REST
  // endpoint so stalled requests release the tool instead of hanging the UI.
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      query, type: searchType.parse(process.env.EXA_SEARCH_TYPE ?? "fast"), numResults: results,
      contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
    }),
  });
  if (!response.ok) throw new Error(`Exa search failed (HTTP ${response.status}).`);
  const data = responseSchema.parse(await response.json());
  return data.results.map((hit) => ({
    title: hit.title ?? hit.url,
    url: hit.url,
    published: hit.publishedDate ?? undefined,
    highlight: hit.highlights?.[0],
  }));
}
