import { keccak256, toBytes } from "viem";
import { z } from "zod";
import type { UnSavedReview } from "./un-storage-types";

export const MONAD_CHAIN_ID = 10143 as const;
export const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";
export const MONAD_EXPLORER_URL = "https://testnet.monadexplorer.com";

export const receiptAbi = [
  { type: "function", name: "record", stateMutability: "nonpayable", inputs: [{ name: "commitment", type: "bytes32" }], outputs: [] },
  { type: "function", name: "recordedAt", stateMutability: "view", inputs: [{ name: "reviewer", type: "address" }, { name: "commitment", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "event", name: "ReviewRecorded", anonymous: false, inputs: [{ name: "reviewer", type: "address", indexed: true }, { name: "commitment", type: "bytes32", indexed: true }, { name: "recordedAt", type: "uint256", indexed: false }] },
  { type: "error", name: "AlreadyRecorded", inputs: [] },
  { type: "error", name: "EmptyCommitment", inputs: [] },
] as const;

const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const evidenceSchema = z.object({
  id: z.string(), kind: z.enum(["lease", "ledger", "email", "registration", "rule"]),
  title: z.string(), date: z.iso.date(), body: z.string(), url: z.url().optional(),
}).strict();

// This is the versioned portable artifact's schema, independent of provider metadata.
const reviewSchema: z.ZodType<UnSavedReview> = z.object({
  id: z.uuid(), createdAt: z.iso.datetime(), simulationDate: z.iso.date(), destination: z.literal("local"),
  preferences: z.object({ reviewLeadDays: z.number().int().min(1).max(180), requestedIncreasePercent: z.number().min(0).max(10), reviewer: z.string().min(1).max(120) }).strict(),
  reviewerNote: z.string().max(4000),
  packet: z.object({
    id: z.string(),
    unit: z.object({
      id: z.string(), unitNumber: z.string(), propertyName: z.string(), address: z.string(), residentName: z.string(),
      leaseEnd: z.iso.date(), baseRent: z.number(), lastIncreaseDate: z.iso.date().nullable(),
      correspondenceIncreaseDate: z.iso.date().nullable(), coverage: z.enum(["confirmed", "unknown"]),
      registrationVerified: z.boolean(), evidence: z.array(evidenceSchema),
    }).strict(),
    status: z.enum(["draft-ready", "needs-evidence", "blocked", "upcoming"]),
    summary: z.string(), daysUntilRenewal: z.number().int(), effectiveDate: z.iso.date(),
    nextEligibleDate: z.iso.date().nullable(), requestedIncreasePercent: z.number(), requestedRent: z.number(),
    capPercent: z.number().nullable(), maximumRent: z.number().nullable(), blockers: z.array(z.string()),
    evidence: z.array(evidenceSchema),
    tasks: z.array(z.object({ title: z.string(), owner: z.string(), details: z.string() }).strict()),
    draft: z.object({ title: z.string(), body: z.string(), templateVersion: z.string() }).strict().nullable(),
    rule: z.object({ title: z.string(), url: z.url(), effectiveFrom: z.iso.date(), effectiveTo: z.iso.date(), verifiedAt: z.iso.date() }).strict().nullable(),
  }).strict(),
}).strict();

export const receiptEnvelopeSchema = z.object({
  schema: z.literal("un-review-receipt/v1"), decision: z.literal("reviewed"), nonce: hashSchema, review: reviewSchema,
}).strict();
export const receiptProofSchema = z.object({
  chainId: z.literal(MONAD_CHAIN_ID), contractAddress: addressSchema,
  transactionHash: hashSchema, reviewer: addressSchema,
  blockNumber: z.string().regex(/^[0-9]+$/), recordedAt: z.iso.datetime(),
}).strict();

export type UnReceiptEnvelope = z.infer<typeof receiptEnvelopeSchema>;
export type UnReceiptProof = z.infer<typeof receiptProofSchema>;
export interface UnReceiptResponse { envelope: UnReceiptEnvelope; commitment: `0x${string}`; receipt: UnReceiptProof | null }
export interface UnReceiptConfig {
  chainId: typeof MONAD_CHAIN_ID; chainName: "Monad Testnet"; contractAddress: `0x${string}` | null;
  rpcUrl: string; explorerUrl: string; configured: boolean;
}

/** UTF-8 JSON, object keys sorted lexically, array order retained, JSON number encoding. */
export function canonicalizeReceipt(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeReceipt).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeReceipt(entry)}`).join(",")}}`;
  }
  throw new Error("A receipt must contain only JSON values.");
}

export function hashReceiptEnvelope(envelope: UnReceiptEnvelope): `0x${string}` {
  return keccak256(toBytes(canonicalizeReceipt(receiptEnvelopeSchema.parse(envelope))));
}
