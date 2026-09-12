import type { UnPreferences, UnReviewCase } from "./un-types";

/** Approval here records an internal review, not notice service or a rent change. */
export interface UnSaveReviewInput {
  unitId: string;
  asOf: string;
  preferences: UnPreferences;
  reviewerNote: string;
  approved: true;
}

export interface UnSavedReview {
  id: string;
  createdAt: string;
  simulationDate: string;
  preferences: UnPreferences;
  reviewerNote: string;
  packet: UnReviewCase;
  destination: "local";
}

export interface UnReviewsResponse {
  records: UnSavedReview[];
}

export interface UnSaveReviewResponse {
  record: UnSavedReview;
}
