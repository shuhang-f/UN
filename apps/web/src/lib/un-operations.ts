/** All private records in this operational fixture are fictional. No account is connected. */
export type UnOperationalEvidence = {
  id: string;
  kind: "database" | "email" | "inspection" | "lease" | "possession";
  title: string;
  date: string;
  body: string;
};

export type UnOperationalUnit = {
  id: string;
  unitNumber: string;
  propertyName: string;
  category: "leasing" | "rent";
  leaseEnd: string;
  possession?: { confirmedOn: string; evidenceId: string };
  inspections?: { date: string; ready: boolean; evidenceId: string; outstandingWork: string[] }[];
  rent?: {
    period: string;
    dueDate: string;
    amount: number;
    evidenceId: string;
    payments: { id: string; amount: number; initiatedOn: string; settledOn: string; initiatedEvidenceId: string; settledEvidenceId: string }[];
  };
  evidence: UnOperationalEvidence[];
};

export type UnOperationalReview = {
  id: string;
  unitId: string;
  unitNumber: string;
  propertyName: string;
  category: "leasing" | "rent";
  status: "ready-to-list" | "turnover-needed" | "late-rent" | "payment-pending" | "needs-evidence" | "upcoming" | "settled";
  title: string;
  summary: string;
  vacancyConfirmed: boolean;
  daysVacant: number | null;
  daysLate: number;
  rentPeriod: string | null;
  dueDate: string | null;
  charged: number;
  settled: number;
  pending: number;
  balance: number;
  tasks: { title: string; owner: string; detail: string }[];
  evidence: UnOperationalEvidence[];
};

const PROPERTY = "Juniper Court · fictional portfolio";
const record = (unit: string, id: string, kind: UnOperationalEvidence["kind"], date: string, title: string, body: string): UnOperationalEvidence => ({
  id: `un-ops-${unit}-${id}`, kind, date, title, body: `FICTIONAL DEMO RECORD. ${body}`,
});

export const operationalUnits: UnOperationalUnit[] = [
  {
    id: "un-demo-unit-05", unitNumber: "05", propertyName: PROPERTY, category: "leasing", leaseEnd: "2026-08-31",
    possession: { confirmedOn: "2026-09-07", evidenceId: "un-ops-05-possession" },
    inspections: [{ date: "2026-09-09", ready: true, evidenceId: "un-ops-05-inspection", outstandingWork: [] }],
    evidence: [
      record("05", "lease", "lease", "2026-08-01", "Lease file · end date", "The previous sample lease ends August 31. A lease end date alone does not establish vacancy or possession."),
      record("05", "possession", "possession", "2026-09-07", "Signed possession and key receipt", "The prior demo resident surrendered possession and all keys on September 7. The manager countersigned the possession record."),
      record("05", "inspection", "inspection", "2026-09-09", "Turnover inspection · work complete", "Cleaning and the recorded repair work are complete. The unit passed the sample physical-readiness inspection. Rental terms and listing release still require review."),
      record("05", "database", "database", "2026-09-10", "Mock unit database · leasing queue", "Unit 05 has confirmed vacant possession and completed turnover. No listing has been published and no new lease is recorded."),
      record("05", "email", "email", "2026-09-11", "Manager email · prepare leasing materials", "Please assemble a listing draft and photo pack for Unit 05. Confirm the owner-approved asking rent and applicable reletting requirements before publication."),
    ],
  },
  {
    id: "un-demo-unit-17", unitNumber: "17", propertyName: PROPERTY, category: "leasing", leaseEnd: "2026-08-31",
    possession: { confirmedOn: "2026-09-10", evidenceId: "un-ops-17-possession" },
    inspections: [
      { date: "2026-09-11", ready: false, evidenceId: "un-ops-17-inspection", outstandingWork: ["Repair the bedroom window latch", "Complete the final clean", "Record a follow-up readiness inspection"] },
      { date: "2026-09-15", ready: true, evidenceId: "un-ops-17-completion", outstandingWork: [] },
    ],
    evidence: [
      record("17", "lease", "lease", "2026-08-01", "Lease file · previous tenancy", "The sample lease ends August 31. Occupancy must be confirmed separately from the lease end."),
      record("17", "possession", "possession", "2026-09-10", "Signed possession and key receipt", "The former demo resident returned all keys and surrendered possession on September 10. The manager confirmed receipt."),
      record("17", "inspection", "inspection", "2026-09-11", "Turnover inspection · repairs outstanding", "The bedroom window latch needs repair and the final clean is incomplete. The unit is not ready for listing photography or showings."),
      record("17", "database", "database", "2026-09-11", "Mock work-order database · open items", "Window-latch repair and final clean remain open. Maya Chen owns turnover coordination. A follow-up inspection is required."),
      record("17", "email", "email", "2026-09-11", "Turnover email · hold leasing handoff", "Please finish the repair and cleaning work, then attach inspection photos before handing Unit 17 to leasing."),
      record("17", "completion", "inspection", "2026-09-15", "Follow-up inspection · work verified complete", "The window latch repair and final clean were verified complete on September 15. This future record must not clear the September 12 review."),
    ],
  },
  {
    id: "un-demo-unit-12", unitNumber: "12", propertyName: PROPERTY, category: "rent", leaseEnd: "2026-11-30",
    rent: {
      period: "September 2026", dueDate: "2026-09-01", amount: 2350, evidenceId: "un-ops-12-charge",
      payments: [
        { id: "payment-12-partial", amount: 1000, initiatedOn: "2026-09-05", settledOn: "2026-09-05", initiatedEvidenceId: "un-ops-12-partial", settledEvidenceId: "un-ops-12-partial" },
        { id: "payment-12-remainder", amount: 1350, initiatedOn: "2026-09-18", settledOn: "2026-09-18", initiatedEvidenceId: "un-ops-12-settlement", settledEvidenceId: "un-ops-12-settlement" },
      ],
    },
    evidence: [
      record("12", "lease", "lease", "2026-08-01", "Signed sample lease · rent schedule", "Monthly base rent is $2,350, due on the first. The tenancy remains occupied; no possession surrender is recorded."),
      record("12", "charge", "database", "2026-09-01", "Mock rent ledger · September charge", "A $2,350 September base-rent charge was posted, due September 1. The sample balance excludes fees and other charges."),
      record("12", "partial", "database", "2026-09-05", "Mock payment ledger · partial payment settled", "A $1,000 payment settled against September rent on September 5. Remaining recorded September rent is $1,350."),
      record("12", "email", "email", "2026-09-11", "Resident email · check the remaining balance", "The demo resident says they expect to pay the remainder on September 18. This email is a plan, not a settled payment."),
      record("12", "settlement", "database", "2026-09-18", "Mock payment ledger · remainder settled", "A further $1,350 settled on September 18. This future transaction does not reduce the September 12 balance."),
    ],
  },
  {
    id: "un-demo-unit-21", unitNumber: "21", propertyName: PROPERTY, category: "rent", leaseEnd: "2027-08-31",
    rent: {
      period: "September 2026", dueDate: "2026-09-01", amount: 2600, evidenceId: "un-ops-21-charge",
      payments: [{ id: "payment-21-transfer", amount: 2600, initiatedOn: "2026-09-10", settledOn: "2026-09-14", initiatedEvidenceId: "un-ops-21-pending", settledEvidenceId: "un-ops-21-settlement" }],
    },
    evidence: [
      record("21", "lease", "lease", "2026-08-01", "Signed sample lease · rent schedule", "Monthly base rent is $2,600, due on the first. There is no recorded move-out or surrender of possession."),
      record("21", "charge", "database", "2026-09-01", "Mock rent ledger · September charge", "A $2,600 September base-rent charge was posted, due September 1. No separate fees are included."),
      record("21", "pending", "database", "2026-09-10", "Mock payment database · transfer pending", "A $2,600 bank transfer was initiated September 10. Processing is pending; funds are not yet recorded as settled."),
      record("21", "email", "email", "2026-09-10", "Resident email · payment receipt", "The demo resident supplied a transfer initiation receipt. Reconcile the processor record before requesting another payment."),
      record("21", "settlement", "database", "2026-09-14", "Mock payment database · transfer settled", "The same $2,600 transfer settled on September 14. It must not count as both pending and settled."),
    ],
  },
];

function day(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Choose a valid operations date in YYYY-MM-DD format.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError("Choose a valid operations date in YYYY-MM-DD format.");
  return date.getTime();
}
const cents = (amount: number) => Math.round(amount * 100);
const money = (amount: number) => amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Computes only records visible by asOf. Lease expiry never establishes vacancy. */
export function reviewOperations(asOf: string, units: UnOperationalUnit[] = operationalUnits): UnOperationalReview[] {
  const today = day(asOf);
  return units.map((unit) => {
    const evidence = unit.evidence.filter((item) => day(item.date) <= today).map((item) => ({ ...item }));
    const hasEvidence = (id: string) => evidence.some((item) => item.id === id);
    const review: UnOperationalReview = {
      id: `un-operation-${unit.id}`, unitId: unit.id, unitNumber: unit.unitNumber, propertyName: unit.propertyName,
      category: unit.category, status: "needs-evidence", title: "Confirm the supporting records", summary: "",
      vacancyConfirmed: false, daysVacant: null, daysLate: 0, rentPeriod: null, dueDate: null,
      charged: 0, settled: 0, pending: 0, balance: 0, tasks: [], evidence,
    };
    if (unit.category === "leasing") {
      review.vacancyConfirmed = !!unit.possession && day(unit.possession.confirmedOn) <= today
        && evidence.some((item) => item.id === unit.possession!.evidenceId && item.kind === "possession");
      if (!review.vacancyConfirmed) {
        review.title = "Confirm possession before leasing";
        review.summary = "No dated possession confirmation is available for this review. A lease ending does not establish vacancy.";
        review.tasks.push({ title: "Retrieve the possession record", owner: "Alex Morgan", detail: "Check the signed surrender or other verified possession evidence and key receipt. Keep occupancy unresolved until the record is confirmed." });
        return review;
      }
      review.daysVacant = Math.floor((today - day(unit.possession!.confirmedOn)) / 86_400_000);
      const inspection = unit.inspections?.filter((item) => day(item.date) <= today && day(item.date) >= day(unit.possession!.confirmedOn)
        && evidence.some((source) => source.id === item.evidenceId && source.kind === "inspection"))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!inspection) {
        review.title = "Inspect before the leasing handoff";
        review.summary = "Possession is confirmed, but no completed readiness inspection is available yet.";
        review.tasks.push({ title: "Complete the readiness inspection", owner: "Maya Chen", detail: "Inspect the vacant unit, identify work needed and attach dated photos before preparing its leasing handoff." });
      } else if (!inspection.ready) {
        review.status = "turnover-needed";
        review.title = "Finish turnover before leasing";
        review.summary = "The unit is confirmed vacant. The latest inspection still has work outstanding; keep the leasing handoff on hold.";
        review.tasks = inspection.outstandingWork.map((title) => ({ title, owner: "Maya Chen", detail: "Attach completion evidence to the mock work-order record. A dated follow-up inspection must confirm physical readiness before leasing preparation." }));
      } else {
        review.status = "ready-to-list";
        review.title = "Prepare the listing for review";
        review.summary = "Possession and physical readiness are confirmed in the sample records. Assemble the leasing materials for the manager’s review.";
        review.tasks = [
          { title: "Confirm reletting terms and the proposed asking rent", owner: "Alex Morgan", detail: "Review the unit's applicable restrictions, prior tenancy records and owner-approved rent. Physical readiness is separate from the rental-terms review." },
          { title: "Prepare the listing draft and photo pack", owner: "Alex Morgan", detail: "Assemble an accurate description, current photos and a proposed showing plan. Keep publication pending the manager's review." },
        ];
      }
      return review;
    }

    const rent = unit.rent;
    if (!rent || !hasEvidence(rent.evidenceId)) {
      review.title = "Confirm the rent account";
      review.summary = "No dated rent charge is available for this review. Do not infer an unpaid balance from an email.";
      review.tasks.push({ title: "Retrieve the lease and posted ledger", owner: "Alex Morgan", detail: "Confirm the rental period, due date, posted charge and actual payment status before preparing any balance follow-up." });
      return review;
    }
    review.rentPeriod = rent.period;
    review.dueDate = rent.dueDate;
    review.charged = rent.amount;
    let settled = 0;
    let pending = 0;
    for (const payment of rent.payments) {
      if (day(payment.initiatedOn) > today || !hasEvidence(payment.initiatedEvidenceId)) continue;
      if (day(payment.settledOn) <= today && hasEvidence(payment.settledEvidenceId)) settled += cents(payment.amount);
      else pending += cents(payment.amount);
    }
    review.settled = settled / 100;
    review.pending = pending / 100;
    review.balance = Math.max(0, cents(rent.amount) - settled) / 100;
    review.daysLate = review.balance > 0 ? Math.max(0, Math.floor((today - day(rent.dueDate)) / 86_400_000)) : 0;
    if (review.balance === 0) {
      review.status = "settled";
      review.title = "September rent reconciled";
      review.summary = `${money(review.settled)} is recorded as settled against the ${rent.period} charge. No remaining sample rent balance is recorded.`;
      review.tasks.push({ title: "Retain the reconciliation evidence", owner: "Alex Morgan", detail: "Keep the settlement record with this account review. This fixture contains only the stated rental period, not a live account history." });
    } else if (pending > 0) {
      review.status = "payment-pending";
      review.title = "Verify the pending payment";
      review.summary = `${money(review.pending)} is processing. The posted balance remains ${money(review.balance)} until settlement is confirmed; avoid requesting a duplicate payment.`;
      review.tasks = [
        { title: "Reconcile the transfer with the processor record", owner: "Alex Morgan", detail: "Compare the initiation receipt with the settled-payment ledger. Keep pending funds separate; an email receipt does not establish settlement." },
        { title: "Prepare an account-status follow-up if needed", owner: "Alex Morgan", detail: "After checking the transfer, draft a neutral update for review if the processing status remains unresolved. No message is sent by this demo." },
      ];
    } else if (review.daysLate > 0) {
      review.status = "late-rent";
      review.title = "Reconcile the remaining rent";
      review.summary = `${money(review.settled)} has settled; ${money(review.balance)} of ${rent.period} rent remains on the sample ledger, ${review.daysLate} days after its due date.`;
      review.tasks = [
        { title: "Confirm the remaining ledger balance", owner: "Alex Morgan", detail: "Check for unposted payments, credits or an agreed adjustment. Compare the ledger with the resident's correspondence before making a balance claim." },
        { title: "Prepare a neutral balance inquiry for review", owner: "Alex Morgan", detail: "Reference the rental period, settled amount and unresolved balance. Do not add fees or create an enforcement notice from this demonstration." },
      ];
    } else {
      review.status = "upcoming";
      review.title = "Rent charge is not past due";
      review.summary = `${rent.period} rent has a sample due date of ${rent.dueDate}. No late balance is identified on this review date.`;
      review.tasks.push({ title: "Check the account after the due date", owner: "Alex Morgan", detail: "Use the posted charge and dated settlement evidence for the next review; do not treat the due date itself as proof of lateness." });
    }
    return review;
  });
}
