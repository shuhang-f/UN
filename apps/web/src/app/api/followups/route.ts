import { resolve } from "node:path";
import { dataDirectory } from "@/lib/server/data-directory";
import { createFollowupHandler } from "@/lib/server/followup-http";
import { configuredWorkplace } from "@/lib/server/workplace";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createFollowupHandler({
  connect: () =>
    process.env.AMBIGUOUS_API_KEY?.trim() ? configuredWorkplace() : undefined,
  directory: process.env.WEB_APPROVAL_DIR ? resolve(process.env.WEB_APPROVAL_DIR) : dataDirectory("web-approvals"),
});
export const GET = handler;
export const POST = handler;
