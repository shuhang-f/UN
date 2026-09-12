import { dataDirectory } from "@/lib/server/data-directory";
import { createUnHandoffsHandler } from "@/lib/server/un-handoffs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createUnHandoffsHandler({
  directory: dataDirectory("un-handoffs"),
  reviewsDirectory: dataDirectory("un-reviews"),
});
export const GET = handler;
export const POST = handler;
