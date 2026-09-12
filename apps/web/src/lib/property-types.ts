export type Profile = {
  name: string;
  email: string;
  company: string;
  website: string;
  role: string;
  units: string;
  system: string;
  focus: "vacancy" | "maintenance" | "both" | "rent-control";
  jurisdiction?: string;
  property?: string;
  context: string;
};

export type EvidenceMessage = {
  id: string;
  from: string;
  subject: string;
  body: string;
  source: "sample" | "pasted";
};

export type AssessmentInput = {
  profile: Profile;
  messages: EvidenceMessage[];
};

export type Finding = {
  id: string;
  category: "make-ready" | "leasing" | "maintenance" | "rent-control";
  title: string;
  summary: string;
  evidence: { messageId: string; quote: string }[];
  steps: { title: string; owner: string; details: string }[];
  toolIds: string[];
  question: string;
};

export type Report = {
  summary: string;
  findings: Finding[];
  unknowns: string[];
  mode: "guided";
  generatedAt: string;
};

export type ToolCatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  tourUrl: string;
  fit: string;
  setup: string;
};
