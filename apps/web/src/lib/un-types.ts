export type UnPreferences = {
  reviewLeadDays: number;
  requestedIncreasePercent: number;
  reviewer: string;
};

export type UnEvidence = {
  id: string;
  kind: "lease" | "ledger" | "email" | "registration" | "rule";
  title: string;
  date: string;
  body: string;
  url?: string;
};

export type UnUnit = {
  id: string;
  unitNumber: string;
  propertyName: string;
  address: string;
  residentName: string;
  leaseEnd: string;
  baseRent: number;
  lastIncreaseDate: string | null;
  correspondenceIncreaseDate: string | null;
  coverage: "confirmed" | "unknown";
  registrationVerified: boolean;
  evidence: UnEvidence[];
};

export type UnReviewCase = {
  id: string;
  unit: UnUnit;
  status: "draft-ready" | "needs-evidence" | "blocked" | "upcoming";
  summary: string;
  daysUntilRenewal: number;
  effectiveDate: string;
  nextEligibleDate: string | null;
  requestedIncreasePercent: number;
  requestedRent: number;
  capPercent: number | null;
  maximumRent: number | null;
  blockers: string[];
  evidence: UnEvidence[];
  tasks: { title: string; owner: string; details: string }[];
  draft: { title: string; body: string; templateVersion: string } | null;
  rule: {
    title: string;
    url: string;
    effectiveFrom: string;
    effectiveTo: string;
    verifiedAt: string;
  } | null;
};
