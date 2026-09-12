import type { UnPreferences, UnReviewCase } from "./un-types";

export type UnScenarioInput = { unitId: string; asOf: string; preferences: UnPreferences };
export type UnScenarioResult = {
  mode: "preview";
  input: UnScenarioInput;
  baseline: UnReviewCase;
  proposed: UnReviewCase;
  changes: { field: string; before: string; after: string }[];
};
