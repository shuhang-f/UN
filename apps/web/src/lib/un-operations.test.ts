import assert from "node:assert/strict";
import test from "node:test";
import { operationalUnits, reviewOperations } from "./un-operations";

const find = (asOf: string, unitNumber: string) => reviewOperations(asOf).find((item) => item.unitNumber === unitNumber)!;

test("September 12 operations separate leasing, late balance and payment processing", () => {
  const reviews = reviewOperations("2026-09-12");
  assert.deepEqual(reviews.map((item) => [item.unitNumber, item.status]), [
    ["05", "ready-to-list"], ["17", "turnover-needed"], ["12", "late-rent"], ["21", "payment-pending"],
  ]);
  assert.equal(reviews.filter((item) => item.vacancyConfirmed).length, 2);
  assert.equal(reviews.filter((item) => item.status === "late-rent").length, 1);
  assert.equal(reviews.filter((item) => item.status === "payment-pending").length, 1);
});

test("lease expiry does not establish vacancy without available possession proof", () => {
  const early = find("2026-09-05", "05");
  assert.equal(early.status, "needs-evidence");
  assert.equal(early.vacancyConfirmed, false);
  assert.equal(early.daysVacant, null);
  assert.match(early.summary, /lease ending does not establish vacancy/i);
  const noProof = operationalUnits.map((unit) => unit.unitNumber === "05" ? {
    ...unit, evidence: unit.evidence.filter((evidence) => evidence.kind !== "possession"),
  } : unit);
  assert.equal(reviewOperations("2026-09-12", noProof)[0].vacancyConfirmed, false);
  assert.equal(find("2028-01-01", "12").vacancyConfirmed, false);
});

test("physical readiness needs an inspection after possession, not just a vacant status", () => {
  const possessionDay = find("2026-09-07", "05");
  assert.equal(possessionDay.vacancyConfirmed, true);
  assert.equal(possessionDay.daysVacant, 0);
  assert.equal(possessionDay.status, "needs-evidence");
  assert.match(possessionDay.title, /Inspect/);
  const inspected = find("2026-09-09", "05");
  assert.equal(inspected.status, "ready-to-list");
  assert.equal(inspected.daysVacant, 2);
});

test("future turnover completion does not clear current outstanding work", () => {
  const current = find("2026-09-12", "17");
  assert.equal(current.status, "turnover-needed");
  assert.equal(current.daysVacant, 2);
  assert.ok(current.tasks.some((task) => /window latch/.test(task.title)));
  assert.ok(current.evidence.every((item) => item.date <= "2026-09-12"));
  const completed = find("2026-09-15", "17");
  assert.equal(completed.status, "ready-to-list");
  assert.ok(completed.evidence.some((item) => item.id === "un-ops-17-completion"));
  assert.ok(completed.tasks.some((task) => /asking rent/.test(task.title)));
});

test("only settled partial payments reduce the recorded September balance", () => {
  const review = find("2026-09-12", "12");
  assert.equal(review.charged, 2350);
  assert.equal(review.settled, 1000);
  assert.equal(review.pending, 0);
  assert.equal(review.balance, 1350);
  assert.equal(review.daysLate, 11);
  assert.equal(review.evidence.some((item) => item.id === "un-ops-12-settlement"), false);
  assert.ok(review.evidence.some((item) => item.kind === "email"));
});

test("future-dated payments do not count early and final settlement resolves the balance", () => {
  const beforePartial = find("2026-09-04", "12");
  assert.equal(beforePartial.settled, 0);
  assert.equal(beforePartial.balance, 2350);
  assert.equal(beforePartial.daysLate, 3);
  const paid = find("2026-09-18", "12");
  assert.equal(paid.settled, 2350);
  assert.equal(paid.balance, 0);
  assert.equal(paid.pending, 0);
  assert.equal(paid.daysLate, 0);
  assert.equal(paid.status, "settled");
});

test("a pending payment is never counted as settled or double-counted after settlement", () => {
  const beforeTransfer = find("2026-09-09", "21");
  assert.equal(beforeTransfer.pending, 0);
  assert.equal(beforeTransfer.status, "late-rent");
  const pending = find("2026-09-12", "21");
  assert.equal(pending.status, "payment-pending");
  assert.equal(pending.pending, 2600);
  assert.equal(pending.settled, 0);
  assert.equal(pending.balance, 2600);
  assert.match(pending.summary, /avoid requesting a duplicate payment/);
  const paid = find("2026-09-14", "21");
  assert.equal(paid.status, "settled");
  assert.equal(paid.pending, 0);
  assert.equal(paid.settled, 2600);
  assert.equal(paid.balance, 0);
});

test("a due date is inclusive and unavailable charges do not become inferred late balances", () => {
  const beforeCharge = find("2026-08-31", "12");
  assert.equal(beforeCharge.status, "needs-evidence");
  assert.equal(beforeCharge.balance, 0);
  const due = find("2026-09-01", "12");
  assert.equal(due.status, "upcoming");
  assert.equal(due.daysLate, 0);
  assert.equal(find("2026-09-02", "12").daysLate, 1);
});

test("payment metadata cannot settle a transfer without dated database evidence", () => {
  const noSettlement = operationalUnits.map((unit) => unit.unitNumber === "21" ? {
    ...unit, evidence: unit.evidence.filter((evidence) => evidence.id !== "un-ops-21-settlement"),
  } : unit);
  const review = reviewOperations("2026-09-15", noSettlement).find((item) => item.unitNumber === "21")!;
  assert.equal(review.status, "payment-pending");
  assert.equal(review.pending, 2600);
  assert.equal(review.settled, 0);
  assert.equal(review.balance, 2600);
});

test("simulation dates are strict and repeated reviews leave mock records untouched", () => {
  for (const date of ["2026-02-29", "2026-9-12", "invalid", "2026-09-12T00:00:00Z"]) {
    assert.throws(() => reviewOperations(date), RangeError);
  }
  const first = reviewOperations("2026-09-12");
  const repeated = reviewOperations("2026-09-12");
  assert.deepEqual(first, repeated);
  first[0].evidence[0].body = "Changed in a review only";
  assert.notEqual(operationalUnits[0].evidence[0].body, first[0].evidence[0].body);
  assert.notEqual(repeated[0].evidence[0].body, first[0].evidence[0].body);
});
