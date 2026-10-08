export const CONTRACT_VERSION = "1.0.0" as const;
export const CONFIG_VERSION = "1.0.0" as const;

export const CAPABILITY_DIMENSIONS = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
] as const;

export type CapabilityDimension = (typeof CAPABILITY_DIMENSIONS)[number];

export const ROLE_IDS = [
  "data_analyst",
  "product_operations",
  "user_researcher",
  "product_manager",
  "project_manager",
  "content_strategist",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

export type ResponseStatus = "success" | "degraded" | "error";

export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "SCHEMA_VALIDATION_FAILED"
  | "AI_TIMEOUT"
  | "AI_UNAVAILABLE"
  | "CONTENT_RISK"
  | "SESSION_EXPIRED"
  | "UNKNOWN_ERROR";

export interface ApiError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export interface ApiResponse<T> {
  status: ResponseStatus;
  contractVersion: typeof CONTRACT_VERSION;
  configVersion: typeof CONFIG_VERSION;
  data: T | null;
  error: ApiError | null;
  aiGenerated: boolean;
}

export interface CapabilityScore {
  dimension: CapabilityDimension;
  score: number;
  maxScore: 5;
  evidence: string;
  improvement: string;
}

export interface RoleRecommendation {
  roleId: RoleId;
  score: number;
  reasons: string[];
}

export interface CreateSessionRequest {
  clientVersion: string;
  anonymousDeviceSessionId?: string;
}

export interface CreateSessionData {
  sessionId: string;
  progress: "created";
}

export interface SelectFollowupRequest {
  sessionId: string;
  round: 1 | 2;
  answeredQuestionIds: string[];
  evidenceByDimension: Partial<Record<CapabilityDimension, string[]>>;
}

export interface SelectFollowupData {
  round: 1 | 2;
  dimension: CapabilityDimension;
  questionId: string;
  questionText: string;
}

export interface GetInitialRecommendationRequest {
  sessionId: string;
  baseAnswers: Record<string, string>;
  preferenceAnswers: Record<string, string>;
  followupAnswers: Record<string, string>;
}

export interface GetInitialRecommendationData {
  capabilityScores: CapabilityScore[];
  recommendations: [RoleRecommendation, RoleRecommendation, RoleRecommendation];
}

export interface ScoreTrialRequest {
  sessionId: string;
  trialId: string;
  answer: string;
}

export interface ScoreTrialData {
  trialId: string;
  capabilityScores: CapabilityScore[];
  before: [RoleRecommendation, RoleRecommendation, RoleRecommendation];
  after: [RoleRecommendation, RoleRecommendation, RoleRecommendation];
  changeExplanation: string[];
}

export interface GetActionPlanRequest {
  sessionId: string;
  roleId: RoleId;
  gaps: CapabilityScore[];
  preferenceNote?: string;
}

export interface ActionPlanItem {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  description: string;
  completed: boolean;
}

export interface GetActionPlanData {
  roleId: RoleId;
  items: [
    ActionPlanItem,
    ActionPlanItem,
    ActionPlanItem,
    ActionPlanItem,
    ActionPlanItem,
    ActionPlanItem,
    ActionPlanItem,
  ];
  personalizedSuggestion: string;
}

export interface SubmitFeedbackRequest {
  sessionId: string;
  helpfulness: 1 | 2 | 3 | 4 | 5;
  interestedRoleId?: RoleId;
  comment?: string;
}

export interface TrackEventRequest {
  sessionId: string;
  eventName: string;
  step: string;
  durationMs?: number;
}

export interface DeleteSessionRequest {
  sessionId: string;
  confirmationToken: string;
}

export interface MutationResult {
  accepted: boolean;
}
