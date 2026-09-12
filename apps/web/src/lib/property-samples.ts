import type { EvidenceMessage, Profile } from "./property-types";

export const sampleProfile: Profile = {
  name: "Elena Martinez", email: "elena@example.com", company: "Juniper Residential",
  website: "", role: "Community manager", units: "1,200", system: "Spreadsheets / email",
  focus: "both", context: "We manage 6 apartment communities. I want to reduce delays between maintenance and leasing, and spend less time chasing repair updates.",
};
export const sampleMessages: EvidenceMessage[] = [
  { id: "sample-408", source: "sample", from: "Marcus · Maintenance supervisor", subject: "Unit 408 — flooring delayed, Friday move-in", body: "Unit 408 has a Friday move-in. The flooring contractor says materials are delayed until Thursday afternoon. Cleaning depends on flooring finishing, and we still need a final inspection. Leasing's availability sheet still shows ready for Friday. We need to confirm the timeline and update leasing." },
  { id: "sample-211", source: "sample", from: "Nina · Resident services", subject: "Unit 211 — repair still waiting for an appointment", body: "The resident in unit 211 reports the dishwasher repair is still unresolved. The vendor tried calling, but the resident did not recognize the number. They are available Tuesday or Thursday afternoon. No appointment has been confirmed. Can someone coordinate scheduling and give the resident an update?" },
  { id: "sample-leasing", source: "sample", from: "Leah · Leasing coordinator", subject: "Rental inquiry — another community may fit", body: "A renter asked about a vacant two-bedroom, with a maximum base rent of $2,600 and an October 1 move-in. The first apartment will not be available until October 15. A sister property may have availability, but we have not confirmed it or followed up with the renter. Their Saturday tour request is unanswered." },
];
