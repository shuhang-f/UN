import type { UnEvidence } from "./un-types";

/** A reviewed packet saved as an Ambiguous task; manager approval stays local. */
export interface UnHandoffRun {
  id: string;
  reviewId: string;
  unitId: string;
  unitNumber: string;
  mode: "ambiguous";
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
  /** Present only on a refresh response when this cached task could not be verified. */
  verificationError?: string;
  externalTask: {
    id: string;
    url: string | null;
    workspaceId: string;
    identityName: string;
    verifiedAt: string;
  };
}

export type UnHandoffInput =
  | { action: "draft"; reviewId: string; approved: true }
  | { action: "approve"; runId: string; approvalNote: string };

export interface UnHandoffsResponse { runs: UnHandoffRun[]; ambiguousConfigured: boolean }
export interface UnHandoffResponse { run: UnHandoffRun }
