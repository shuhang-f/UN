import { configuredReceiptChain, createReceiptVerifierHandler, receiptConfig } from "@/lib/server/un-receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createReceiptVerifierHandler({ config: receiptConfig, chain: configuredReceiptChain });
