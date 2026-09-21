import { isSearchConfigured, searchWeb } from "agent-core";
import { createWebSearchHandler } from "@/lib/server/web-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createWebSearchHandler({
  configured: () => isSearchConfigured() && Boolean(process.env.EXA_API_KEY?.trim()),
  search: searchWeb,
});
