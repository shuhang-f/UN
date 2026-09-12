import type { ToolCatalogItem } from "./property-types";

// Curated from the linked vendors' product pages, checked September 12, 2026.
// These are documented capabilities, not measured customer outcomes or integrations in this app.
export const toolCatalog: ToolCatalogItem[] = [
  { id: "copilotkit", name: "CopilotKit", category: "Review workspace", description: "Show evidence, a proposed workflow, and a human review step in the app.", url: "https://github.com/CopilotKit/agents-everywhere-starter-kit", tourUrl: "https://github.com/CopilotKit/agents-everywhere-starter-kit", fit: "Turn selected rent-change correspondence into a reviewable checklist with owners.", setup: "Used by this app’s assistant when a model is configured. It does not determine legal compliance." },
  { id: "exa", name: "Exa", category: "Official-source research", description: "Search public web sources to support a reviewer’s jurisdiction research.", url: "https://exa.ai/docs/reference/search-api-guide", tourUrl: "https://exa.ai/docs/reference/search-api-guide", fit: "Find the local authority’s coverage, notice, and registration guidance and verify effective dates.", setup: "The starter includes search support; requires EXA_API_KEY. This guided assessment does not perform a live legal lookup or read email." },
  { id: "ambiguous", name: "Ambiguous AI", category: "Workflow tracking", description: "Save an approved planning task with owners and review steps.", url: "https://www.ambiguous.ai/agents/mcp", tourUrl: "https://www.ambiguous.ai/agents/mcp", fit: "Keep the rent-change review packet and follow-through checklist in a persistent workspace.", setup: "Available through the app’s reviewed save flow when configured. Saving a task does not schedule reminders or send a notice." },
  {
    id: "happyco",
    name: "HappyCo",
    category: "Make-ready & inspections",
    description: "Connect inspections, work orders, vendors, and unit-turn progress in a shared maintenance workspace.",
    url: "https://happy.co/platform/maintenance-operations",
    tourUrl: "https://app.arcade.software/share/W48XVaPKB5BM7nHPSdk8",
    fit: "Explore when maintenance and leasing need a shared view of apartment readiness.",
    setup: "Public scripted make-ready tour; production access requires sales and onboarding. The vendor lists a 500-unit minimum. Confirm PMS integration and package with the vendor.",
  },
  {
    id: "entrata",
    name: "Entrata Facilities Pro",
    category: "Make-ready & maintenance",
    description: "A shared make-ready board, work-order assignment, staff communication, and photo annotations within Entrata.",
    url: "https://www.entrata.com/products/facilities-pro",
    tourUrl: "https://www.entrata.com/demo",
    fit: "Check the existing Facilities workflow first if your company already uses Entrata.",
    setup: "The demo requires a business-details form. Facilities Pro extends Entrata's maintenance product; confirm current entitlement, configuration, and cost with your administrator.",
  },
  {
    id: "funnel",
    name: "Funnel Leasing",
    category: "Leasing follow-up",
    description: "A renter-centered CRM combining communication history, tour scheduling, follow-up workflows, and leasing-team handoffs.",
    url: "https://funnelleasing.com/products/next-generation-crm",
    tourUrl: "https://funnelleasing.com/tour",
    fit: "Explore when prospects contact multiple communities or several people share inquiry follow-up.",
    setup: "Public guided tours cover the renter record, team queue, and cross-selling. Production use requires sales and onboarding; confirm how availability and renter records connect to your PMS.",
  },
  {
    id: "property-meld",
    name: "Property Meld",
    category: "Maintenance coordination",
    description: "Coordinate work-order assignment, resident and vendor communication, scheduling, and progress tracking.",
    url: "https://propertymeld.com/",
    tourUrl: "https://help.propertymeld.com/hc/en-us/articles/45762117134867-The-Vendor-Meld-Experience-English",
    fit: "Explore when repair scheduling and vendor follow-up require repeated coordination.",
    setup: "Public scripted vendor tutorial covers accepting work, scheduling, messages, completion notes, and invoices. Production use requires a configured account; confirm PMS integration, portfolio fit, and team setup.",
  },
  {
    id: "appfolio",
    name: "AppFolio Maintenance & Unit Turn Board",
    category: "Make-ready & maintenance",
    description: "Manage unit-turn work orders centrally and share progress with leasing; residents can submit and track maintenance requests.",
    url: "https://www.appfolio.com/services/maintenance-efficiency/demo",
    tourUrl: "https://www.appfolio.com/services/maintenance-efficiency/demo",
    fit: "Start with the existing maintenance and Unit Turn Board workflows if your company already uses AppFolio.",
    setup: "Requires AppFolio account access and configuration. Ask your administrator which maintenance capabilities are enabled; this app is not connected to AppFolio.",
  },
];
