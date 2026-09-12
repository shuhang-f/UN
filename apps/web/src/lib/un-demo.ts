import type { UnEvidence, UnPreferences, UnUnit } from "./un-types";

/** Every person, property, unit, and private record in this seed is fictional. */
export const DEMO_TODAY = "2026-09-12";

export const defaultPreferences: UnPreferences = {
  reviewLeadDays: 90,
  requestedIncreasePercent: 2,
  reviewer: "Alex Morgan",
};

function fictionalUnit(
  unitNumber: string,
  leaseEnd: string,
  baseRent: number,
  lastIncreaseDate: string,
  options: { correspondenceIncreaseDate?: string; coverage?: "confirmed" | "unknown" } = {},
): UnUnit {
  const id = `un-demo-unit-${unitNumber}`;
  const correspondenceIncreaseDate = options.correspondenceIncreaseDate ?? lastIncreaseDate;
  const coverage = options.coverage ?? "confirmed";
  const evidence: UnEvidence[] = [
    {
      id: `${id}-lease`,
      kind: "lease",
      title: `Unit ${unitNumber} · sample signed lease`,
      date: "2026-09-01",
      body: `FICTIONAL DEMO RECORD. Demo Resident ${unitNumber}'s lease ends ${leaseEnd}. The sample file has no renewal amendment or special adjustment approval. Lease terms and required notice wording still need review before any real notice.`,
    },
    {
      id: `${id}-ledger`,
      kind: "ledger",
      title: `Unit ${unitNumber} · sample rent ledger`,
      date: "2026-09-10",
      body: `FICTIONAL DEMO RECORD. Lawful monthly base rent in this sample is $${baseRent.toFixed(2)}. The ledger records the last ordinary increase on ${lastIncreaseDate}. No separate surcharges are included in the base rent.`,
    },
    {
      id: `${id}-email`,
      kind: "email",
      title: `Unit ${unitNumber} · manager correspondence`,
      date: "2026-09-11",
      body: `FICTIONAL DEMO MESSAGE. Please prepare the approaching lease review using our confirmed pricing preference. My notes show the last rent increase was ${correspondenceIncreaseDate}. Compare this with the ledger before preparing the draft.`,
    },
    {
      id: `${id}-registration`,
      kind: "registration",
      title: `Unit ${unitNumber} · sample registration and coverage record`,
      date: "2026-01-15",
      body: coverage === "confirmed"
        ? `FICTIONAL DEMO RECORD. Current registration evidence and unit-specific LA City RSO coverage are treated as verified for Unit ${unitNumber} in this simulation. No actual property lookup has been performed.`
        : `FICTIONAL DEMO RECORD. Registration is present, but the property-level record does not establish whether Unit ${unitNumber} is covered by LA City RSO. Obtain unit-specific coverage evidence.`,
    },
  ];
  return {
    id,
    unitNumber,
    propertyName: "Juniper Court · fictional portfolio",
    address: "100 Example Lane, Los Angeles, CA · fictional address",
    residentName: `Demo Resident ${unitNumber}`,
    leaseEnd,
    baseRent,
    lastIncreaseDate,
    correspondenceIncreaseDate,
    coverage,
    registrationVerified: true,
    evidence,
  };
}

export const demoUnits: UnUnit[] = [
  fictionalUnit("04", "2026-10-12", 2000, "2025-10-13"),
  fictionalUnit("12", "2026-11-30", 2350, "2026-03-01", {
    correspondenceIncreaseDate: "2025-12-01",
  }),
  fictionalUnit("08", "2026-12-10", 1875, "2025-12-01", { coverage: "unknown" }),
  fictionalUnit("09", "2026-10-31", 2200, "2026-03-01"),
  fictionalUnit("21", "2027-08-31", 2600, "2026-08-01"),
];
