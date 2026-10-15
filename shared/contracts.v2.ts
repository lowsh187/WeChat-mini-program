export const CONTRACT_VERSION_V2 = "2.0.0" as const;
export const CONFIG_VERSION_V2 = "2.0.0" as const;

export const CAPABILITY_DIMENSIONS_V2 = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
] as const;

export type CapabilityDimensionV2 = (typeof CAPABILITY_DIMENSIONS_V2)[number];
export type RoleIdV2 =
  | "data_analyst"
  | "product_operations"
  | "user_researcher"
  | "product_manager"
  | "project_manager"
  | "content_strategist";

export type CapabilityObservation =
  | {
      dimension: CapabilityDimensionV2;
      status: "observed";
      score: number;
      maxScore: 5;
      evidence: string[];
      improvement: string;
    }
  | {
      dimension: CapabilityDimensionV2;
      status: "not_observed" | "unavailable";
      score: null;
      maxScore: 5;
      evidence: [];
      reason: string;
    };

export interface ScoreTrialRequestV2 {
  sessionId: string;
  trialId: string;
  trialAttemptId: string;
  answers: Record<string, string>;
}

export interface ScoreComponentV2 {
  name: "base" | "preference" | "followup";
  score: number | null;
  weight: number;
}

export interface InitialRecommendationMetadataV2 {
  scoreComponents: ScoreComponentV2[];
  effectiveWeights: { base: number; preference: number; followup: number };
  missingComponents: Array<"followup">;
  comparableToFullScore: boolean;
}

export interface PracticePriorityV2 {
  dimension: CapabilityDimensionV2;
  title: string;
  reason: string;
  suggestion: string;
}

export interface GetActionPlanRequestV2 {
  sessionId: string;
  roleId: RoleIdV2;
  practicePriorities: PracticePriorityV2[];
  regenerate?: boolean;
}

export interface GetActionPlanDataV2 {
  planId: string;
  roleId: RoleIdV2;
  practicePriorities: PracticePriorityV2[];
  progressStorage: "local_device_only";
}

export type FormalEventNameV2 =
  | "session.created"
  | "profile.completed"
  | "recommendation.viewed"
  | "trial.started"
  | "trial.completed"
  | "plan.viewed";

export interface TrackEventRequestV2 {
  sessionId: string;
  eventId: string;
  mode: "mock" | "real";
  eventName: FormalEventNameV2;
  step: string;
  trialAttemptId?: string;
  durationMs?: number;
  resultStatus?: "success" | "degraded" | "error";
}

export interface FeedbackPublicationConsentV2 {
  granted: boolean;
  textVersion: string;
}

export interface SubmitFeedbackRequestV2 {
  sessionId: string;
  helpfulness: 1 | 2 | 3 | 4 | 5;
  interestedRoleId?: RoleIdV2;
  comment?: string;
  publicationConsent: FeedbackPublicationConsentV2;
}
