import type { UnEvidence, UnPreferences, UnReviewCase, UnUnit } from "./un-types";

const DAY_MS = 86_400_000;
const ORDINARY_CAP = 3;
const RULE: NonNullable<UnReviewCase["rule"]> = {
  title: "LAHD · LA City RSO ordinary annual adjustment, 2026–2027",
  url: "https://housing.lacity.gov/wp-content/uploads/2022/01/Allowable-Rent-Increase-Bulletin-English.pdf",
  effectiveFrom: "2026-07-01",
  effectiveTo: "2027-06-30",
  verifiedAt: "2026-09-12",
};
const TEMPLATE_VERSION = "un-illustrative-internal-v2";

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextDay(date: Date): string {
  return iso(new Date(date.getTime() + DAY_MS));
}

/** Calendar arithmetic, not a 365-day approximation; Feb 29 clamps to Feb 28. */
function calendarAnniversary(date: Date): string {
  const result = new Date(date);
  const month = date.getUTCMonth();
  result.setUTCFullYear(date.getUTCFullYear() + 1);
  if (result.getUTCMonth() !== month) result.setUTCDate(0);
  return iso(result);
}

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validatePreferences(preferences: UnPreferences): void {
  if (!Number.isInteger(preferences.reviewLeadDays) || preferences.reviewLeadDays < 1 || preferences.reviewLeadDays > 180) {
    throw new RangeError("Choose a review window from 1 to 180 whole days.");
  }
  if (!Number.isFinite(preferences.requestedIncreasePercent) || preferences.requestedIncreasePercent < 0 || preferences.requestedIncreasePercent > 10) {
    throw new RangeError("Choose a requested increase from 0% to 10%.");
  }
  if (typeof preferences.reviewer !== "string" || !preferences.reviewer.trim() || preferences.reviewer.trim().length > 120) {
    throw new RangeError("Provide a reviewer name of 1 to 120 characters.");
  }
}

/** Reviews fictional ordinary-adjustment inputs. It never verifies a real property's coverage. */
export function reviewUnit(unit: UnUnit, asOf: string, preferences: UnPreferences): UnReviewCase {
  const today = parseDate(asOf);
  if (!today) throw new RangeError("Choose a valid simulation date in YYYY-MM-DD format.");
  validatePreferences(preferences);

  const reviewer = preferences.reviewer.trim();
  const leaseEnd = parseDate(unit.leaseEnd);
  const effectiveDate = leaseEnd ? nextDay(leaseEnd) : "";
  const daysUntilRenewal = leaseEnd ? Math.round((leaseEnd.getTime() - today.getTime()) / DAY_MS) : 0;
  const missing: string[] = [];
  const blocked: string[] = [];
  const tasks: UnReviewCase["tasks"] = [];
  const addIssue = (kind: "evidence" | "blocked", title: string, details: string) => {
    (kind === "evidence" ? missing : blocked).push(details);
    tasks.push({ title, owner: reviewer, details });
  };

  if (!leaseEnd) addIssue("evidence", "Confirm the lease end date", "The lease end date is missing or invalid; confirm it against the signed lease.");
  if (leaseEnd && effectiveDate <= asOf) {
    addIssue("blocked", "Choose a future effective date", "The candidate effective date has arrived or passed. Reconfirm lease terms and a future date before preparing an increase.");
  }
  if (unit.coverage !== "confirmed") {
    addIssue("evidence", "Confirm unit-specific RSO coverage", "Unit-specific LA City RSO coverage is unresolved. A property-level lookup does not establish this unit's coverage.");
  }
  if (!unit.registrationVerified) {
    addIssue("evidence", "Retrieve current registration evidence", "Current registration evidence has not been verified. Retrieve and review it before preparing the increase draft.");
  }

  const requiredEvidence: UnEvidence["kind"][] = ["lease", "ledger"];
  if (unit.registrationVerified) requiredEvidence.push("registration");
  if (unit.correspondenceIncreaseDate !== null) requiredEvidence.push("email");
  for (const kind of requiredEvidence) {
    const records = unit.evidence.filter((item) => item.kind === kind);
    if (!records.some((item) => parseDate(item.date) && item.date <= asOf && item.body.trim())) {
      addIssue("evidence", `Attach dated ${kind} evidence`, `A dated ${kind} record available on the simulation date is required to support the extracted facts.`);
    }
  }

  const validRent = Number.isFinite(unit.baseRent) && unit.baseRent > 0 && unit.baseRent <= Number.MAX_SAFE_INTEGER / 1000
    && Math.abs(roundCents(unit.baseRent) - unit.baseRent) < 0.000001;
  if (!validRent) addIssue("evidence", "Confirm the lawful base rent", "The base rent must be a positive amount in dollars and cents, supported by the rent ledger.");
  const baseRent = validRent ? unit.baseRent : 0;
  const requestedRent = roundCents(baseRent * (1 + preferences.requestedIncreasePercent / 100));

  const lastIncrease = parseDate(unit.lastIncreaseDate);
  const correspondenceIncrease = parseDate(unit.correspondenceIncreaseDate);
  const conflictingDates = lastIncrease !== null && correspondenceIncrease !== null && unit.lastIncreaseDate !== unit.correspondenceIncreaseDate;
  let nextEligibleDate: string | null = lastIncrease ? calendarAnniversary(lastIncrease) : null;
  if (!lastIncrease) {
    addIssue("evidence", "Find the previous rent-increase record", "The previous increase date is missing or invalid. Reconcile the rent history before evaluating the 12-month interval.");
  } else if (unit.lastIncreaseDate! > asOf) {
    nextEligibleDate = null;
    addIssue("evidence", "Reconcile the ledger date", "The recorded previous increase is after the simulation date. Confirm whether it is a future proposal rather than an applied increase.");
  }
  if (unit.correspondenceIncreaseDate !== null && !correspondenceIncrease) {
    nextEligibleDate = null;
    addIssue("evidence", "Correct the correspondence date", "The correspondence contains an invalid previous-increase date. Check the original supporting record.");
  }
  if (conflictingDates) {
    nextEligibleDate = null;
    addIssue("evidence", "Reconcile conflicting increase dates", `The ledger says ${unit.lastIncreaseDate}; correspondence says ${unit.correspondenceIncreaseDate}. Retrieve the prior notice and applied-rent record before choosing an anniversary.`);
  }
  if (nextEligibleDate && effectiveDate && effectiveDate < nextEligibleDate) {
    addIssue("blocked", "Review the increase anniversary", `The candidate date ${effectiveDate} is before the next 12-month anniversary, ${nextEligibleDate}. Lease renewal alone does not establish eligibility for an increase.`);
  }

  const inRuleWindow = effectiveDate >= RULE.effectiveFrom && effectiveDate <= RULE.effectiveTo;
  const rule = unit.coverage === "confirmed" && inRuleWindow ? { ...RULE } : null;
  const capPercent = rule ? ORDINARY_CAP : null;
  const maximumRent = rule && validRent ? roundCents(baseRent * (1 + ORDINARY_CAP / 100)) : null;
  if (effectiveDate && !inRuleWindow) {
    addIssue("evidence", "Review the rule for the proposed period", `No reviewed rule is loaded for ${effectiveDate}. The demo's 3% rule covers ${RULE.effectiveFrom} through ${RULE.effectiveTo}; do not extend that rate to another period.`);
  }
  if (capPercent !== null && preferences.requestedIncreasePercent > capPercent) {
    addIssue("blocked", "Revise the requested increase", `The manager's requested ${preferences.requestedIncreasePercent}% exceeds the reviewed ${capPercent}% ordinary adjustment ceiling. Confirm a revised instruction; the request has not been silently reduced.`);
  }
  if (preferences.requestedIncreasePercent === 0) {
    addIssue("blocked", "Record the unchanged-rent instruction", "The manager selected 0%. Keep the base rent unchanged; no rent-increase notice draft is needed.");
  } else if (validRent && requestedRent === baseRent) {
    addIssue("blocked", "Confirm the pricing instruction", "The requested percentage rounds to no change in monthly base rent. Confirm the intended amount before drafting an increase.");
  }

  const evidence: UnEvidence[] = unit.evidence.map((item) => ({ ...item }));
  if (rule) {
    evidence.push({
      id: "un-rule-la-city-rso-2026-2027",
      kind: "rule",
      title: rule.title,
      date: rule.verifiedAt,
      body: "Reviewed public source: the ordinary adjustment is 3% for July 1, 2026–June 30, 2027, subject to the 12-month interval and other requirements. No additional utility percentage is added. Separate permitted charges and special adjustments are outside this demo.",
      url: rule.url,
    });
  }

  const outsideReviewWindow = leaseEnd !== null && daysUntilRenewal > preferences.reviewLeadDays;
  const status: UnReviewCase["status"] = outsideReviewWindow ? "upcoming"
    : missing.length ? "needs-evidence"
    : blocked.length ? "blocked"
    : "draft-ready";
  const summary = status === "upcoming"
    ? `Lease ends in ${daysUntilRenewal} days, outside the ${preferences.reviewLeadDays}-day internal review window.`
    : status === "needs-evidence"
      ? "Resolve the missing or conflicting records before preparing an increase draft."
      : status === "blocked"
        ? preferences.requestedIncreasePercent === 0
          ? "Rent stays unchanged under the manager's 0% instruction."
          : "The proposed increase needs a revised amount or date before drafting."
        : `Internal draft prepared: ${money(baseRent)} → ${money(requestedRent)} on ${effectiveDate}, using the manager's ${preferences.requestedIncreasePercent}% instruction.`;

  if (outsideReviewWindow) {
    tasks.unshift({
      title: "Review when the lease enters your window",
      owner: reviewer,
      details: `Start the internal review ${preferences.reviewLeadDays} days before ${unit.leaseEnd}. This operating preference is separate from any required legal notice period.`,
    });
  }
  let draft: UnReviewCase["draft"] = null;
  if (status === "draft-ready" && rule) {
    tasks.push({
      title: "Review the internal draft and service requirements",
      owner: reviewer,
      details: "Validate lease terms, required notice period, service method, current registration and mandatory template wording. Record the review decision; saving a packet does not serve a notice or change ledger rent.",
    });
    draft = {
      title: `Internal rent-increase working draft · Unit ${unit.unitNumber}`,
      templateVersion: TEMPLATE_VERSION,
      body: [
        "INTERNAL SIMULATED NOTICE — PENDING REVIEW",
        "Fictional demo data. This illustrative template is not legally vetted or ready to serve.",
        "",
        `Prepared on: ${asOf}`,
        `Reviewer: ${reviewer}`,
        `Property: ${unit.propertyName}`,
        `Address: ${unit.address}`,
        `Unit: ${unit.unitNumber}`,
        `Resident: ${unit.residentName}`,
        "",
        "PROPOSED NOTICE TEXT",
        `Dear ${unit.residentName},`,
        `We are proposing to increase the monthly base rent for Unit ${unit.unitNumber} at ${unit.propertyName} from ${money(baseRent)} to ${money(requestedRent)}, effective ${effectiveDate}. This is a monthly increase of ${money(roundCents(requestedRent - baseRent))} (${preferences.requestedIncreasePercent}%).`,
        "[Insert reviewed mandatory notice language, issuer details, and applicable attachments before final approval.]",
        "",
        "INTERNAL REVIEW NOTES",
        `Proposed monthly base rent: ${money(requestedRent)}`,
        `Current monthly base rent: ${money(baseRent)}`,
        `Proposed monthly change: ${money(roundCents(requestedRent - baseRent))} (${preferences.requestedIncreasePercent}%)`,
        `Candidate effective date: ${effectiveDate}`,
        `Lease end: ${unit.leaseEnd}; recorded last increase: ${unit.lastIncreaseDate}`,
        "",
        `Manager instruction: ${preferences.requestedIncreasePercent}%. The reviewed ordinary ceiling is ${ORDINARY_CAP}% (${money(maximumRent!)} base rent), a limit rather than a pricing instruction.`,
        "This calculation excludes separate permitted charges and special adjustment approvals. No utility percentage is added.",
        "",
        `Source: ${rule.title}`,
        `Source URL: ${rule.url}`,
        `Rule period: ${rule.effectiveFrom}–${rule.effectiveTo}; source checked: ${rule.verifiedAt}`,
        `Template: ${TEMPLATE_VERSION}`,
        "",
        `PENDING: Reviewer must validate lease terms, applicable notice period, service method and date, current registration, and final mandatory wording using a reviewed local template. The ${preferences.reviewLeadDays}-day review window is an internal preference, not a legal notice period.`,
        "No notice has been sent or served. No ledger rent or tenancy status has been changed.",
      ].join("\n"),
    };
  }

  return {
    id: `un-review-${unit.id}-${unit.leaseEnd}`,
    unit: { ...unit, evidence: unit.evidence.map((item) => ({ ...item })) },
    status,
    summary,
    daysUntilRenewal,
    effectiveDate,
    nextEligibleDate,
    requestedIncreasePercent: preferences.requestedIncreasePercent,
    requestedRent,
    capPercent,
    maximumRent,
    blockers: [...missing, ...blocked],
    evidence,
    tasks,
    draft,
    rule,
  };
}

export function reviewPortfolio(units: UnUnit[], asOf: string, preferences: UnPreferences): UnReviewCase[] {
  return units.map((unit) => reviewUnit(unit, asOf, preferences));
}
