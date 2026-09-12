export interface PropertyPlanStep {
  title: string;
  owner: string;
  details: string;
}

export interface PropertyPlanInput {
  title: string;
  category: string;
  steps: PropertyPlanStep[];
  toolIds: string[];
  destination: "local" | "ambiguous";
  approved: true;
}

export interface PropertyPlan extends Omit<PropertyPlanInput, "approved"> {
  id: string;
  createdAt: string;
  externalTask?: { id: string; url: string | null };
}

export interface PropertyPlansResponse {
  plans: PropertyPlan[];
  ambiguousConfigured: boolean;
}
