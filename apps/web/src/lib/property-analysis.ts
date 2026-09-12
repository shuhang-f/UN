import { proposeUnitWorkflows } from "./unit-workflows";
import type { AssessmentInput, EvidenceMessage, Finding, Report } from "./property-types";

type Category = Finding["category"];
const categories: Category[] = ["make-ready", "leasing", "maintenance", "rent-control"];

/** Transparent topic rules select candidate workflows; they do not diagnose a company. */
function topicScore(text: string, category: Category): number {
  if (category === "rent-control") return /\b(rent control|rent stabili[sz]ation|rent increase|rent board|housing inventory|notice of increase)\b/i.test(text) ? 4 : 0;
  const turn = /\b(make[ -]?ready|unit turns?|turn board|(unit|apartment|rental) turnover)\b/i.test(text);
  const move = /\b(move[ -]?(in|out)|vacan(t|cy|cies)|rent[ -]?ready)\b/i.test(text);
  const readiness = /\b(inspect(ion)?s?|floor(ing)?|paint(ing)?|clean(ing)?|repair(s)?|ready|readiness|keys?|contractor|vendor)\b/i.test(text);
  const rental = /\b(rent(al|er|ers)?|leas(e|es|ing)|apartment|prospect(s)?|applicant(s)?|resident|tenant)\b/i.test(text);
  const leasing = /\b(inquir(y|ies)|prospect(s)?|applicant(s)?|application(s)?|tour(s)?|viewing(s)?|follow[ -]?up)\b/i.test(text);
  const repair = /\b(maintenance|work[ -]?order(s)?|plumb(er|ing)?|leak(ing)?|sink|dishwasher|hvac|repair(s)?|technician(s)?)\b/i.test(text);
  const property = /\b(resident|tenant|apartment|unit|maintenance|work[ -]?order)\b/i.test(text);
  if (category === "make-ready") return turn ? 4 : move && readiness ? 3 : 0;
  if (category === "leasing") return rental && leasing ? 3 : 0;
  // A flooring task in a vacant turn is not automatically a separate resident-repair problem.
  if (turn || (move && readiness)) {
    return category === "maintenance" && /\b(resident|tenant)\b/i.test(text) && repair ? 2 : 0;
  }
  return repair && property ? 3 : 0;
}

function supportingEvidence(messages: EvidenceMessage[], category: Category) {
  return messages.flatMap((message) => {
    // Quote a complete matching passage, keeping it verbatim for traceability.
    const passages = [message.subject, ...message.body.split(/\n+|(?<=[.!?])\s+/)].filter(Boolean);
    const passage = passages.find((text) => topicScore(text, category) > 0);
    if (passage && passage.length <= 500) return [{ messageId: message.id, quote: passage }];
    if (passage) {
      for (let start = 0; start < passage.length; start += 200) {
        const quote = passage.slice(start, start + 500);
        if (topicScore(quote, category) > 0) return [{ messageId: message.id, quote }];
      }
    }
    // Subject and body can provide context together; quote both explicitly.
    const combined = `${message.subject}\n${message.body}`;
    if (topicScore(combined, category) === 0) return [];
    // Do not cite a truncated prefix that lacks the signal we matched.
    if (combined.length > 500) return [];
    return [{ messageId: message.id, quote: combined }];
  }).slice(0, 3);
}

const workflows: Record<Category, Omit<Finding, "id" | "category" | "summary" | "evidence" | "toolIds">> = {
  "rent-control": {
    title: "Build a reviewable rent-change packet before setting a date",
    steps: [
      { title: "Resolve coverage for each unit", owner: "Property manager", details: "Record city/state, unit address, building and tenancy facts, claimed exemptions, and supporting documents. Link the applicable official authority and record who reviewed coverage and when. Keep unknown coverage in a review queue." },
      { title: "Prepare the rent-change review", owner: "Compliance reviewer", details: "Collect the lease, base-rent ledger, prior increases, proposed effective date, and applicable official rule for that date. Verify local registration or licensing requirements. Have the reviewer confirm the calculation and notice requirements before approving a draft; do not infer a legal percentage from an email." },
      { title: "Track approval, service, and follow-through", owner: "Operations coordinator", details: "Keep the approved version, reviewer, verified deadlines, service method and evidence, and resident questions on one record. Create reminders only after dates are verified. Release any ledger change or resident communication through a separate authorized action." },
    ],
    question: "Which city and state is the property in, and can you provide one unit’s lease, rent history, and proposed increase date?",
  },
  "make-ready": {
    title: "Connect apartment readiness to the move-in promise",
    steps: [
      { title: "Capture the turn scope", owner: "Maintenance supervisor", details: "Record inspection findings, required work, responsible people, and the expected move-in date on one unit record." },
      { title: "Check task dependencies", owner: "Maintenance supervisor", details: "Sequence repairs, painting, cleaning, and final inspection. Confirm vendor dates and flag any task whose timing could affect the handoff." },
      { title: "Verify and hand off to leasing", owner: "Community manager", details: "Have the responsible person verify readiness with a completed checklist and supporting notes or photos, then update leasing with the confirmed status." },
    ],
    question: "Show one recent unit turn: where did a changed completion date reach leasing, and who verified the apartment was ready?",
  },
  leasing: {
    title: "Give every rental inquiry a clear next step",
    steps: [
      { title: "Keep one inquiry history", owner: "Leasing coordinator", details: "Keep the prospect's messages, stated needs, available units, and previous responses together so another teammate can continue the conversation." },
      { title: "Assign the next action", owner: "Leasing specialist", details: "Set an owner and follow-up date for the next reply or tour confirmation. Review the current conversation before assuming a response is overdue." },
      { title: "Confirm availability before replying", owner: "Leasing specialist", details: "Check the unit's verified readiness and approved availability, then review a proposed reply or tour invitation before sending it." },
    ],
    question: "For one recent rental inquiry, who owned the next reply and how did they confirm that the unit could actually be shown?",
  },
  maintenance: {
    title: "Track a repair from request to verified completion",
    steps: [
      { title: "Create a usable repair record", owner: "Maintenance coordinator", details: "Capture the reported issue, unit, relevant prior work, photos if available, and access arrangements. Use the property's existing urgent-issue procedure when applicable." },
      { title: "Confirm the person and appointment", owner: "Maintenance supervisor", details: "Assign the technician or vendor, confirm scope and scheduling, and record any required spending authorization and blocker in the same record." },
      { title: "Close the communication loop", owner: "Maintenance coordinator", details: "Review completion notes, record remaining work, and prepare a resident update. Check that the reported issue is resolved before treating a completed visit as a completed repair." },
    ],
    question: "Open one recent repair request: where can a teammate see the appointment, current blocker, and evidence that the issue was resolved?",
  },
};

function toolsFor(category: Category, system: string): string[] {
  if (category === "rent-control") return ["copilotkit", "exa", "ambiguous"];
  if (category === "leasing") return ["funnel"];
  const existing = /\bentrata\b/i.test(system) ? "entrata" : /\bapp\s?folio\b/i.test(system) ? "appfolio" : undefined;
  const alternatives = category === "make-ready" ? ["happyco", "entrata", "appfolio"] : ["property-meld", "happyco", "appfolio"];
  return [...new Set([...(existing ? [existing] : []), ...alternatives])].slice(0, 3);
}

export function analyzeProperty(input: AssessmentInput): Report {
  const { profile, messages } = input;
  const preferred: Category[] = profile.focus === "rent-control" ? ["rent-control"] : profile.focus === "maintenance" ? ["maintenance"] : profile.focus === "vacancy" ? ["make-ready", "leasing"] : ["make-ready", "leasing", "maintenance"];
  const evidence = Object.fromEntries(categories.map((category) => [category, supportingEvidence(messages, category)])) as Record<Category, Finding["evidence"]>;
  // The user's explicit focus is a scope boundary, even when the input contains other topics.
  const selected = [...preferred];
  selected.sort((a, b) => (evidence[b].length * 10 + topicScore(profile.context, b)) - (evidence[a].length * 10 + topicScore(profile.context, a)));
  const findings = selected.map((category): Finding => {
    const supported = evidence[category].length > 0;
    const fromDescription = topicScore(profile.context, category) > 0;
    const origin = supported
      ? "The supplied messages contain a relevant example. Review the quoted context and confirm its current status before acting."
      : fromDescription
        ? "Candidate workflow based on your description; no matching message evidence was supplied."
        : "Candidate workflow based on your selected focus; no matching message evidence was supplied.";
    const existing = category !== "leasing" && /\b(entrata|app\s?folio)\b/i.test(profile.system);
    return {
      id: `workflow-${category}`,
      category,
      ...workflows[category],
      question: category === "rent-control" && profile.jurisdiction?.trim()
        ? `For a unit in ${profile.jurisdiction.trim()}, can you provide the lease, rent history, proposed increase date, and any coverage review?`
        : workflows[category].question,
      summary: `${origin}${existing ? " Start by checking the relevant module in your existing property system before adding another product." : " Compare this workflow with the process your team already uses."}`,
      evidence: evidence[category],
      toolIds: toolsFor(category, profile.system),
    };
  });
  if (profile.focus === "rent-control") findings.unshift(...proposeUnitWorkflows(input));
  const supportedCount = findings.filter((finding) => finding.evidence.length > 0).length;
  const unknowns = [
    "Current task status, responsible people, and deadlines must be confirmed with the team; a message excerpt is not a live property record.",
    "Existing product entitlements, integrations, implementation effort, and vendor pricing have not been verified for this company.",
    "No savings, vacancy reduction, or repair-speed improvement has been measured.",
  ];
  if (profile.focus === "rent-control") {
    unknowns.unshift(profile.jurisdiction?.trim() ? `Jurisdiction supplied: ${profile.jurisdiction.trim()}. Unit coverage, current rules, calculations, and notice dates still require verification with the applicable authority.` : "City and state are missing. Identify the jurisdiction before choosing rules, calculating an increase, or setting notice dates.");
  }
  if (!messages.length) unknowns.unshift("No operational messages were supplied. These are candidates from the selected focus and explicit description, not findings about the company.");
  else if (!supportedCount) unknowns.unshift("The supplied messages do not provide enough relevant operational evidence to support a workflow finding.");
  if (profile.focus !== "rent-control" && categories.some((category) => !preferred.includes(category) && evidence[category].length > 0)) {
    unknowns.push("Some messages discuss workflows outside the selected focus. Choose both areas to include those suggestions.");
  }
  if (messages.some((message) => message.source === "sample")) unknowns.unshift("Sample messages are fictional demonstration data, not evidence about your company.");
  if (!profile.system.trim() || /^(unknown|not sure|none|other)$/i.test(profile.system.trim())) unknowns.push("The current property system and available modules need clarification before selecting a tool.");
  return {
    summary: supportedCount
      ? `Guided assessment: ${supportedCount} workflow ${supportedCount === 1 ? "candidate has" : "candidates have"} supporting message context. Suggestions use fixed topic rules and a curated product catalog; they are not a diagnosis of operational problems.`
      : "Guided assessment: explore these candidate workflows from your selected focus and description. There is not enough message evidence to identify an operational problem.",
    findings,
    unknowns,
    mode: "guided",
    generatedAt: new Date().toISOString(),
  };
}
