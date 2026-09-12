import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProperty } from "./property-analysis";
import { toolCatalog } from "./property-catalog";
import type { AssessmentInput, EvidenceMessage, Profile } from "./property-types";
import { POST } from "../app/api/assessment/route";
import { sampleMessages, sampleProfile } from "./property-samples";

const profile: Profile = {
  name: "Sam", email: "sam@example.com", company: "Example Apartments", website: "",
  role: "Property manager", units: "500", system: "Not sure", focus: "both", context: "",
};
const message = (body: string, overrides: Partial<EvidenceMessage> = {}): EvidenceMessage => ({
  id: "message-1", from: "Colleague", subject: "Update", body, source: "pasted", ...overrides,
});
const assess = (body: string) => analyzeProperty({ profile, messages: [message(body)] });

test("different operational messages change the first workflow and its verbatim evidence", () => {
  const turn = assess("Unit 408 move-in is Friday. Flooring is delayed during the unit turn.");
  const repair = assess("The resident's dishwasher repair needs a new appointment.");
  assert.equal(turn.findings[0].category, "make-ready");
  assert.equal(repair.findings[0].category, "maintenance");
  assert.equal(turn.findings[0].evidence[0].quote, "Flooring is delayed during the unit turn.");
  assert.equal(repair.findings[0].evidence[0].messageId, "message-1");
  assert.equal(repair.findings[0].evidence[0].quote, "The resident's dishwasher repair needs a new appointment.");
});

test("leasing inquiry is distinct from getting a vacant apartment ready", () => {
  const report = assess("A prospective renter asked to book an apartment tour and needs a reply.");
  assert.equal(report.findings[0].category, "leasing");
  assert.equal(report.findings.find((finding) => finding.category === "make-ready")?.evidence.length, 0);
});

test("irrelevant words and identity fields do not become operational evidence", () => {
  const unrelated = analyzeProperty({
    profile: { ...profile, name: "Maintenance Repair", email: "turnover@leasing.example", company: "Vacancy Unit Turn", website: "https://maintenance.example" },
    messages: [message("The marketing team will tour the software. Lead the meeting and follow up with lunch details.")],
  });
  assert.ok(unrelated.findings.every((finding) => !finding.evidence.length));
  assert.ok(unrelated.unknowns.some((unknown) => unknown.includes("not provide enough")));
});

test("no evidence yields explicit candidates without invented operational problems or savings", () => {
  const report = analyzeProperty({ profile: { ...profile, focus: "maintenance" }, messages: [] });
  assert.equal(report.mode, "guided");
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].category, "maintenance");
  assert.match(report.findings[0].summary, /Candidate workflow based on your selected focus/);
  assert.deepEqual(report.findings[0].evidence, []);
  assert.ok(report.unknowns.some((unknown) => /No operational messages/.test(unknown)));
  assert.doesNotMatch(report.summary, /\d+%|\$\d|losing|wasting|missed/);
});

test("explicit context changes ordering but is not represented as message evidence", () => {
  const report = analyzeProperty({ profile: { ...profile, context: "We want better tracking of resident maintenance repairs." }, messages: [] });
  assert.equal(report.findings[0].category, "maintenance");
  assert.match(report.findings[0].summary, /based on your description/);
  assert.deepEqual(report.findings[0].evidence, []);
});

test("existing Entrata and AppFolio stacks lead applicable tool suggestions", () => {
  for (const system of ["Entrata", "AppFolio"]) {
    const report = analyzeProperty({ profile: { ...profile, system }, messages: [] });
    for (const finding of report.findings.filter((finding) => finding.category !== "leasing")) {
      assert.equal(finding.toolIds[0], system.toLowerCase());
      assert.match(finding.summary, /existing property system/);
    }
  }
  const catalogIds = new Set(toolCatalog.map((tool) => tool.id));
  assert.ok(analyzeProperty({ profile, messages: [] }).findings.every((finding) => finding.toolIds.every((id) => catalogIds.has(id))));
});

test("sample evidence is labeled and completed messages are not called unresolved", () => {
  const report = analyzeProperty({ profile, messages: [message("The resident's maintenance repair was completed yesterday.", { source: "sample" })] });
  assert.ok(report.unknowns.some((unknown) => unknown.includes("fictional")));
  assert.doesNotMatch(report.findings[0].summary, /is unresolved|is delayed|has failed/);
  assert.match(report.findings[0].summary, /confirm its current status/);
});

test("long-message evidence includes the actual relevant passage", () => {
  const report = assess(`${"General background. ".repeat(60)}The resident's sink repair needs an appointment.`);
  assert.match(report.findings[0].evidence[0].quote, /sink repair/);
});

test("demo messages produce three distinct findings with the correct evidence", () => {
  const report = analyzeProperty({ profile: sampleProfile, messages: sampleMessages });
  assert.equal(report.findings.length, 3);
  const expected = { "make-ready": "sample-408", maintenance: "sample-211", leasing: "sample-leasing" };
  for (const finding of report.findings) {
    assert.deepEqual(finding.evidence.map((evidence) => evidence.messageId), [expected[finding.category as keyof typeof expected]]);
    assert.equal(finding.steps.length, 3);
    assert.ok(finding.steps.every((step) => step.owner && step.details));
  }
});

test("focus constrains findings even when messages and profile discuss other topics", () => {
  for (const focus of ["vacancy", "maintenance"] as const) {
    const report = analyzeProperty({ profile: { ...sampleProfile, focus }, messages: sampleMessages });
    const expected = focus === "vacancy" ? ["leasing", "make-ready"] : ["maintenance"];
    assert.deepEqual(report.findings.map((finding) => finding.category).sort(), expected);
    assert.ok(report.unknowns.some((unknown) => unknown.includes("outside the selected focus")));
  }
});

test("staff turnover is not evidence of an apartment turn", () => {
  const report = assess("Our staff turnover has increased. We are hiring new team members.");
  assert.ok(report.findings.every((finding) => finding.evidence.length === 0));
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3100/api/assessment", {
    method: "POST",
    headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const input: AssessmentInput = { profile, messages: [] };

test("assessment API returns a report without credentials or external services", async () => {
  const response = await POST(request(input));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).report.mode, "guided");
});

test("API rejects foreign origins, missing origin, and rebinding hosts", async () => {
  assert.equal((await POST(request(input, { origin: "https://untrusted.example" }))).status, 403);
  assert.equal((await POST(request(input, { origin: "" }))).status, 403);
  assert.equal((await POST(request(input, { host: "untrusted.example", origin: "http://untrusted.example" }))).status, 403);
  assert.equal((await POST(request(input, { host: "untrusted.example:invalid" }))).status, 403);
  assert.equal((await POST(request(input, { host: "127.0.0.1:3100/path" }))).status, 403);
  assert.equal((await POST(request(input, { "sec-fetch-site": "cross-site" }))).status, 403);
});

test("API supports local hostname and IPv6 origins", async () => {
  for (const host of ["localhost:3100", "[::1]:3100"]) {
    assert.equal((await POST(request(input, { host, origin: `http://${host}` }))).status, 200);
  }
});

test("API validates shapes, unique evidence IDs, and bounded payloads", async () => {
  assert.equal((await POST(request("not json"))).status, 400);
  assert.equal((await POST(request({ ...input, profile: { ...profile, focus: "everything" } }))).status, 400);
  assert.equal((await POST(request({ ...input, messages: [message("A"), message("B")] }))).status, 400);
  assert.equal((await POST(request({ ...input, messages: [message("a".repeat(8001))] }))).status, 400);
  assert.equal((await POST(request("a".repeat(100_001)))).status, 413);
});

 test("rent control requires jurisdiction verification and uses kit tools", () => {
   const report = analyzeProperty({ profile: { ...profile, focus: "rent-control" }, messages: [message("The rent increase needs review before sending.")] });
   assert.equal(report.findings.length, 1);
   assert.equal(report.findings[0].category, "rent-control");
   assert.equal(report.findings[0].evidence[0].quote, "The rent increase needs review before sending.");
   assert.ok(report.unknowns.some(value => value.includes("City and state are missing")));
   assert.ok(report.findings[0].toolIds.every(id => toolCatalog.some(tool => tool.id === id)));
 });
 test("rent-control intake accepts a jurisdiction without treating it as verified coverage", async () => {
   const response = await POST(request({ profile: { ...profile, focus: "rent-control", jurisdiction: "Oakland, CA" }, messages: [] }));
   assert.equal(response.status, 200);
   assert.ok((await response.json()).report.unknowns.some((value: string) => /still require verification/.test(value)));
 });
