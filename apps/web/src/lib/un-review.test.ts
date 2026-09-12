import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_TODAY, defaultPreferences, demoUnits } from "./un-demo";
import { reviewPortfolio, reviewUnit } from "./un-review";
import type { UnPreferences, UnUnit } from "./un-types";

function unit(number = "04", changes: Partial<UnUnit> = {}): UnUnit {
  const seed = demoUnits.find((item) => item.unitNumber === number)!;
  return { ...seed, evidence: seed.evidence.map((item) => ({ ...item })), ...changes };
}

function review(changes: Partial<UnUnit> = {}, preferences: Partial<UnPreferences> = {}) {
  return reviewUnit(unit("04", changes), DEMO_TODAY, { ...defaultPreferences, ...preferences });
}

test("demo review prepares one draft and keeps exceptions distinct", () => {
  const cases = reviewPortfolio(demoUnits, DEMO_TODAY, defaultPreferences);
  assert.deepEqual(cases.map((item) => [item.unit.unitNumber, item.status]), [
    ["04", "draft-ready"],
    ["12", "needs-evidence"],
    ["08", "needs-evidence"],
    ["09", "blocked"],
    ["21", "upcoming"],
  ]);
  assert.equal(cases.filter((item) => item.draft).length, 1);
});

test("manager instruction, ordinary ceiling and internal draft remain separate", () => {
  const result = review();
  assert.equal(result.daysUntilRenewal, 30);
  assert.equal(result.unit.leaseEnd, "2026-10-12");
  assert.equal(result.effectiveDate, "2026-10-13");
  assert.equal(result.nextEligibleDate, "2026-10-13");
  assert.equal(result.requestedIncreasePercent, 2);
  assert.equal(result.requestedRent, 2040);
  assert.equal(result.capPercent, 3);
  assert.equal(result.maximumRent, 2060);
  assert.deepEqual(result.blockers, []);
  assert.match(result.draft!.body, /INTERNAL SIMULATED NOTICE/);
  assert.match(result.draft!.body, /not legally vetted or ready to serve/);
  assert.match(result.draft!.body, /Reviewer: Alex Morgan/);
  assert.match(result.draft!.body, /PENDING: Reviewer must validate/);
  assert.match(result.draft!.body, /No notice has been sent or served/);
  assert.equal(result.rule!.verifiedAt, "2026-09-12");
  assert.ok(result.evidence.some((item) => item.kind === "rule" && item.url === result.rule!.url));
});

test("a conflicting ledger and email cannot establish an increase anniversary", () => {
  const result = reviewUnit(unit("12"), DEMO_TODAY, defaultPreferences);
  assert.equal(result.status, "needs-evidence");
  assert.equal(result.nextEligibleDate, null);
  assert.equal(result.draft, null);
  assert.match(result.blockers.join(" "), /2026-03-01.*2025-12-01/);
  assert.ok(result.tasks.some((item) => item.title === "Reconcile conflicting increase dates"));
});

test("unknown unit coverage never gets an applicable cap or maximum rent", () => {
  const result = review({ coverage: "unknown" });
  assert.equal(result.status, "needs-evidence");
  assert.equal(result.rule, null);
  assert.equal(result.capPercent, null);
  assert.equal(result.maximumRent, null);
  assert.equal(result.draft, null);
  assert.match(result.blockers.join(" "), /property-level lookup/);
});

test("missing registration or lease proof holds a draft", () => {
  for (const changes of [
    { registrationVerified: false },
    { evidence: unit().evidence.filter((item) => item.kind !== "registration") },
    { evidence: unit().evidence.filter((item) => item.kind !== "lease") },
  ]) {
    const result = review(changes);
    assert.equal(result.status, "needs-evidence");
    assert.equal(result.draft, null);
  }
});

test("future-dated or malformed evidence is not treated as available proof", () => {
  for (const date of ["2027-01-01", "2026-02-30", ""] ) {
    const result = review({ evidence: unit().evidence.map((item) => item.kind === "ledger" ? { ...item, date } : item) });
    assert.equal(result.status, "needs-evidence");
    assert.equal(result.draft, null);
    assert.match(result.blockers.join(" "), /dated ledger record/);
  }
});

test("lease renewal before the 12-month anniversary blocks an increase", () => {
  const result = reviewUnit(unit("09"), DEMO_TODAY, defaultPreferences);
  assert.equal(result.status, "blocked");
  assert.equal(result.nextEligibleDate, "2027-03-01");
  assert.equal(result.effectiveDate, "2026-11-01");
  assert.equal(result.draft, null);
  assert.match(result.blockers.join(" "), /Lease renewal alone/);
});

test("calendar eligibility includes the anniversary and excludes the preceding day", () => {
  const previousIncrease = { lastIncreaseDate: "2025-12-01", correspondenceIncreaseDate: "2025-12-01" };
  const before = review({ ...previousIncrease, leaseEnd: "2026-11-29" });
  const anniversary = review({ ...previousIncrease, leaseEnd: "2026-11-30" });
  assert.equal(before.effectiveDate, "2026-11-30");
  assert.equal(before.status, "blocked");
  assert.equal(anniversary.status, "draft-ready");
});

test("calendar arithmetic handles leap-day and year-end dates", () => {
  const leap = review({ lastIncreaseDate: "2024-02-29", correspondenceIncreaseDate: "2024-02-29" });
  assert.equal(leap.nextEligibleDate, "2025-02-28");
  const endOfYear = review({ leaseEnd: "2026-12-31" }, { reviewLeadDays: 180 });
  assert.equal(endOfYear.effectiveDate, "2027-01-01");
  assert.equal(endOfYear.status, "draft-ready");
});

test("invalid calendar dates and absent increase history request evidence", () => {
  for (const changes of [
    { leaseEnd: "2026-02-29" },
    { lastIncreaseDate: "2025-02-30" },
    { lastIncreaseDate: null },
    { correspondenceIncreaseDate: "2025-13-01" },
    { lastIncreaseDate: "2026-12-01", correspondenceIncreaseDate: "2026-12-01" },
  ]) {
    const result = review(changes);
    assert.equal(result.status, "needs-evidence");
    assert.equal(result.draft, null);
  }
});

test("the review trigger includes exactly the chosen internal lead time", () => {
  const inclusive = review({}, { reviewLeadDays: 30 });
  const notYet = review({}, { reviewLeadDays: 29 });
  assert.equal(inclusive.status, "draft-ready");
  assert.equal(notYet.status, "upcoming");
  assert.equal(notYet.draft, null);
  assert.match(notYet.tasks[0].details, /separate from any required legal notice/);
});

test("a 60-day planning window retains the two October leases", () => {
  const cases = reviewPortfolio(demoUnits, DEMO_TODAY, { ...defaultPreferences, reviewLeadDays: 60 });
  assert.deepEqual(cases.filter((item) => item.status !== "upcoming").map((item) => item.unit.unitNumber), ["04", "09"]);
  assert.equal(cases.find((item) => item.unit.unitNumber === "04")!.status, "draft-ready");
});

test("upcoming renewal does not extrapolate an expired rule", () => {
  const result = reviewUnit(unit("21"), DEMO_TODAY, defaultPreferences);
  assert.equal(result.status, "upcoming");
  assert.equal(result.rule, null);
  assert.equal(result.capPercent, null);
  assert.equal(result.maximumRent, null);
  assert.equal(result.draft, null);
  assert.match(result.blockers.join(" "), /do not extend that rate/);
  const due = reviewUnit(unit("21"), "2027-06-15", defaultPreferences);
  assert.equal(due.status, "needs-evidence");
});

test("the reviewed source applies only within its inclusive effective window", () => {
  assert.equal(review({ leaseEnd: "2026-06-30" }).capPercent, 3);
  assert.equal(review({ leaseEnd: "2027-06-29" }).capPercent, 3);
  assert.equal(review({ leaseEnd: "2026-06-29" }).rule, null);
  assert.equal(review({ leaseEnd: "2027-06-30" }).rule, null);
});

test("a past or same-day candidate effective date never creates a draft", () => {
  for (const leaseEnd of ["2026-09-10", "2026-09-11"]) {
    const result = review({ leaseEnd, lastIncreaseDate: "2025-01-01", correspondenceIncreaseDate: "2025-01-01" });
    assert.equal(result.status, "blocked");
    assert.equal(result.draft, null);
    assert.match(result.blockers.join(" "), /arrived or passed/);
  }
});

test("above-cap requests are preserved and blocked rather than silently reduced", () => {
  const result = review({}, { requestedIncreasePercent: 8 });
  assert.equal(result.requestedRent, 2160);
  assert.equal(result.maximumRent, 2060);
  assert.equal(result.status, "blocked");
  assert.equal(result.draft, null);
  assert.match(result.blockers.join(" "), /not been silently reduced/);
  assert.equal(review({}, { requestedIncreasePercent: 3 }).status, "draft-ready");
});

test("zero-percent instruction leaves rent unchanged without an increase notice", () => {
  const result = review({}, { requestedIncreasePercent: 0 });
  assert.equal(result.requestedRent, 2000);
  assert.equal(result.status, "blocked");
  assert.equal(result.draft, null);
  assert.match(result.summary, /Rent stays unchanged/);
});

test("amounts are rounded to cents and invalid base rents cannot produce drafts", () => {
  assert.equal(review({ baseRent: 1999.99 }).requestedRent, 2039.99);
  for (const baseRent of [0, -100, Number.NaN, Number.POSITIVE_INFINITY, 2000.001]) {
    const result = review({ baseRent });
    assert.equal(result.status, "needs-evidence");
    assert.equal(result.draft, null);
    assert.equal(result.maximumRent, null);
    assert.ok(Number.isFinite(result.requestedRent));
  }
});

test("missing or invalid preference values reject the review instead of inventing a policy", () => {
  for (const requestedIncreasePercent of [Number.NaN, Number.POSITIVE_INFINITY, -1, 10.01, undefined]) {
    assert.throws(() => review({}, { requestedIncreasePercent }), RangeError);
  }
  for (const reviewLeadDays of [0, 181, 2.5, Number.NaN]) {
    assert.throws(() => review({}, { reviewLeadDays }), RangeError);
  }
  assert.throws(() => review({}, { reviewer: "   " }), RangeError);
  assert.throws(() => review({}, { reviewer: "x".repeat(121) }), RangeError);
  assert.throws(() => reviewUnit(unit(), "2026-02-30", defaultPreferences), RangeError);
});

test("reruns are deterministic and review packets do not mutate the seed records", () => {
  const first = review();
  const second = review();
  assert.deepEqual(first, second);
  assert.equal(first.id, `un-review-${unit().id}-2026-10-12`);
  first.unit.evidence[0].body = "Edited packet";
  first.evidence[0].body = "Edited evidence";
  assert.notEqual(demoUnits[0].evidence[0].body, "Edited packet");
  assert.notEqual(second.evidence[0].body, "Edited evidence");
});
