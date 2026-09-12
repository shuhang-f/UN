import { dataDirectory } from "@/lib/server/data-directory";
import { createUnReviewsHandler } from "@/lib/server/un-reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createUnReviewsHandler({ directory: dataDirectory("un-reviews") });
export const GET = handler;
export const POST = handler;
