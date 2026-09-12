import type { UnEvidence } from "./un-types";

/** A persisted simulation: approval never sends a notice or calls a provider. */
export interface UnHandoffRun {
  id: string;
  reviewId: string;
  unitId: string;
  unitNumber: string;
  mode: "simulated";
  status: "awaiting-approval" | "approved";
  createdAt: string;
  reviewer: string;
  simulationDate: string;
  packet: {
    role: "property-manager";
    summary: string;
    sources: Pick<UnEvidence, "id" | "title" | "kind" | "date" | "body">[];
    requestedRent: number;
    effectiveDate: string;
  };
  letter: { title: string; body: string };
  approvedAt: string | null;
  approvalNote: string;
}

export type UnHandoffInput =
  | { action: "draft"; reviewId: string }
  | { action: "approve"; runId: string; approvalNote: string };

export interface UnHandoffsResponse { runs: UnHandoffRun[] }
export interface UnHandoffResponse { run: UnHandoffRun }
