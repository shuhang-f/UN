import type { AssessmentInput, Finding } from "./property-types";

/** Conservative, local candidate extraction. No inferred live occupancy or legal eligibility. */
export function proposeUnitWorkflows({ profile, messages }: AssessmentInput): Finding[] {
  const units = new Map<string, Finding["evidence"]>();
  for (const message of messages) {
    for (const passage of [message.subject, ...message.body.split(/\n+|(?<=[.!?])\s+/)]) {
      if (!/\b(vacan(t|cy)|unoccupied|occupied|move[ -]?out|moved out|notice to vacate|keys? returned|turnover|make[ -]?ready)\b/i.test(passage)) continue;
      const matches = [...passage.matchAll(/\b(?:unit|apartment|apt\.?)\s*#?\s*([a-z]?\d{1,5}[a-z]?(?:-\d{1,4})?)\b/gi)];
      // A passage about several units needs manual attribution, not guessed relationships.
      if (matches.length !== 1 || passage.length > 1000) continue;
      const unit = matches[0][1].toUpperCase();
      const evidence = units.get(unit) || [];
      evidence.push({ messageId: message.id, quote: passage });
      units.set(unit, evidence);
    }
  }
  return [...units].slice(0, 12).map(([unit, evidence]): Finding => ({
    id: `unit-review-${unit.toLowerCase()}`,
    category: "rent-control",
    title: `Unit ${unit}: verify occupancy and prepare the next handoff`,
    summary: `Selected correspondence mentions occupancy or turnover for Unit ${unit}. This is a review candidate, not a confirmed vacancy. Check dates, negations, and conflicting updates against the unit record before acting.`,
    evidence,
    steps: [
      { title: `Confirm Unit ${unit}'s current status`, owner: "Property manager", details: `Match each message to the correct property and unit. Check the current lease, move-out record, and latest property-system status; a planned departure or old email is not a completed vacancy. Record the confirmed status, source, date, and unresolved conflicts${profile.property ? ` for ${profile.property}` : ""}.` },
      { title: "If vacant, create the make-ready handoff", owner: "Maintenance coordinator", details: "After occupancy is confirmed, propose an inspection, itemized work orders, responsible people, and estimated completion dates in the existing property system. Confirm access and approvals; keep readiness separate from vacancy." },
      { title: "Review regulated reletting before publishing availability", owner: "Compliance reviewer and leasing coordinator", details: "Verify the unit’s applicable jurisdiction and coverage, tenancy history, and any restrictions relevant to the proposed reletting or rent. Attach the official sources and reviewer decision. Only release approved rent and verified readiness to leasing; vacancy alone does not establish that a rent reset is permitted." },
    ],
    toolIds: [...(/app\s?folio/i.test(profile.system) ? ["appfolio"] : /entrata/i.test(profile.system) ? ["entrata"] : []), "ambiguous", "exa"],
    question: `Does the current property record confirm Unit ${unit} is vacant, scheduled to become vacant, or still occupied?`,
  }));
}
