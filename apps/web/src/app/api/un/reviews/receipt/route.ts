import { dataDirectory } from "@/lib/server/data-directory";
import { configuredReceiptChain, createUnReceiptHandler, receiptConfig } from "@/lib/server/un-receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createUnReceiptHandler({
  directory: dataDirectory("un-receipts"), reviewsDirectory: dataDirectory("un-reviews"),
  config: receiptConfig, chain: configuredReceiptChain,
});
export const GET = handler;
export const POST = handler;
