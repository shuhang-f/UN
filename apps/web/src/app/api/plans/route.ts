import { dataDirectory } from "@/lib/server/data-directory";
import { createPropertyPlansHandler } from "@/lib/server/property-plans";
import { configuredWorkplace } from "@/lib/server/workplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createPropertyPlansHandler({
  directory: dataDirectory("property-plans"),
  isAmbiguousConfigured: () => !!process.env.AMBIGUOUS_API_KEY?.trim(),
  connect: () => process.env.AMBIGUOUS_API_KEY?.trim() ? configuredWorkplace() : undefined,
});
export const GET = handler;
export const POST = handler;
