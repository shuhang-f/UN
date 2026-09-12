import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProperty } from "./property-analysis";
import { sampleProfile } from "./property-samples";
const run = (bodies: string[]) => analyzeProperty({ profile: { ...sampleProfile, focus: "rent-control", property: "Demo property", jurisdiction: "Oakland, CA" }, messages: bodies.map((body, i) => ({ id: `m${i}`, from: "Demo", subject: "Update", body, source: "pasted" })) });
test("a named unit yields an evidence-linked vacancy verification proposal", () => {
  const finding = run(["Unit 408 is vacant. Inspection is pending."]).findings[0];
  assert.equal(finding.id, "unit-review-408");
  assert.deepEqual(finding.evidence, [{ messageId: "m0", quote: "Unit 408 is vacant." }]);
  assert.match(finding.summary, /not a confirmed vacancy/);
  assert.match(finding.steps[2].details, /vacancy alone does not establish/);
});
test("conflicting and negative occupancy evidence is retained without declaring vacancy", () => {
  const finding = run(["Unit 408 is vacant.", "Unit 408 is not vacant; it is occupied."]).findings[0];
  assert.equal(finding.evidence.length, 2);
  assert.match(finding.evidence[1].quote, /not vacant/);
  assert.match(finding.summary, /conflicting/);
  assert.match(finding.question, /still occupied/);
});
test("ambiguous multi-unit passages and messages without unit numbers are not attributed", () => {
  assert.ok(run(["Unit 408 and unit 409 may be vacant.", "An apartment is vacant."]).findings.every(f => !f.id.startsWith("unit-review")));
});
test("future move-outs are review candidates, not confirmed vacancies", () => {
  const finding = run(["Unit 12B has a move-out planned for next month."]).findings[0];
  assert.equal(finding.id, "unit-review-12b");
  assert.match(finding.steps[0].details, /planned departure.*not a completed vacancy/);
});
