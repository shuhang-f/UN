import { z } from "zod";
import { defaultPreferences, demoUnits } from "../un-demo";
import { reviewUnit } from "../un-review";
import type { UnScenarioResult } from "../un-workbench-types";

const inputSchema = z.object({
  unitId: z.string().min(1).max(100),
  asOf: z.iso.date(),
  preferences: z.object({
    reviewLeadDays: z.number().int().min(1).max(180),
    requestedIncreasePercent: z.number().min(0).max(10),
    reviewer: z.string().trim().min(1).max(120),
  }).strict(),
}).strict();

/** Read-only simulation. Facts, rules, blockers and draft text belong to the server. */
export function evaluateUnScenario(value: unknown): UnScenarioResult {
  const input = inputSchema.parse(value);
  const unit = demoUnits.find(item => item.id === input.unitId);
  if (!unit) throw new RangeError("Choose a unit from the fictional portfolio.");
  const baseline = reviewUnit(unit, input.asOf, defaultPreferences);
  const proposed = reviewUnit(unit, input.asOf, input.preferences);
  const rows = [
    ["Requested increase", `${baseline.requestedIncreasePercent}%`, `${proposed.requestedIncreasePercent}%`],
    ["Proposed monthly rent", baseline.requestedRent.toFixed(2), proposed.requestedRent.toFixed(2)],
    ["Review status", baseline.status, proposed.status],
    ["Planning window", `${defaultPreferences.reviewLeadDays} days`, `${input.preferences.reviewLeadDays} days`],
    ["Reviewer", defaultPreferences.reviewer, input.preferences.reviewer],
    ["Blockers", baseline.blockers.join("; ") || "None", proposed.blockers.join("; ") || "None"],
  ];
  return { mode: "preview", input, baseline, proposed, changes: rows.filter(([, before, after]) => before !== after).map(([field, before, after]) => ({ field, before, after })) };
}

export async function handleUnScenario(request: Request): Promise<Response> {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply({ error: "Use POST to preview a scenario." }, 405);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return reply({ error: "Send a JSON scenario." }, 415);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Provide a scenario." }, 400);
  try {
    let size = 0;
    let body = "";
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return reply({ error: "Scenario exceeds 8 KB." }, 413); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return reply(evaluateUnScenario(JSON.parse(body)));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof RangeError)
      return reply({ error: "Invalid scenario. Use a known unit, valid date and review preferences; facts and rules cannot be overridden." }, 400);
    return reply({ error: "The scenario could not be evaluated." }, 500);
  } finally { reader.releaseLock(); }
}
