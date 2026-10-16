import type { CapabilityDimension, RoleId } from "./contracts";

export type ConfigStatus = "draft" | "active" | "archived";
export type SessionStatus =
  | "created"
  | "profiling"
  | "recommended"
  | "trial_in_progress"
  | "trial_completed"
  | "plan_created"
  | "deleted";

export interface DatabaseDocument {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleDocument extends DatabaseDocument {
  roleId: RoleId;
  name: string;
  description: string;
  capabilityWeights: Record<CapabilityDimension, number>;
  configVersion: string;
  status: ConfigStatus;
  mvpHypothesis: true;
}

export interface QuestionOption {
  optionId: string;
  label: string;
  capabilityScores: Partial<Record<CapabilityDimension, number>>;
}

export interface BaseQuestionDocument extends DatabaseDocument {
  questionId: string;
  questionType: "base" | "followup";
  prompt: string;
  order: number;
  targetDimensions: CapabilityDimension[];
  options?: QuestionOption[];
  configVersion: string;
  status: ConfigStatus;
}

export interface RubricItem {
  dimension: CapabilityDimension;
  maxScore: 5;
  criteria: string;
}

export interface WorkTrialDocument extends DatabaseDocument {
  trialId: string;
  roleId: RoleId;
  title: string;
  scenario: string;
  material: string;
  task: string;
  rubric: RubricItem[];
  configVersion: string;
  status: ConfigStatus;
  reviewedByProfessional: boolean;
}

export interface SessionDocument extends DatabaseDocument {
  sessionId: string;
  status: SessionStatus;
  contractVersion: string;
  configVersion: string;
  currentStep: string;
  followupRound: 0 | 1 | 2;
  selectedFollowupQuestionIds?: string[];
  clientVersion: string;
  ownerKeyHash: string;
  deletionTokenHash: string;
  anonymousDeviceSessionHash?: string;
  expiresAt: Date;
}

export interface AssessmentDocument extends DatabaseDocument {
  sessionId: string;
  assessmentType: "initial" | "trial";
  roleId?: RoleId;
  capabilityScores: Partial<Record<CapabilityDimension, number>>;
  evidence: Array<{
    dimension: CapabilityDimension;
    text: string;
  }>;
  configVersion: string;
}

export interface ActionPlanTask {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
}

export interface ActionPlanDocument extends DatabaseDocument {
  sessionId: string;
  roleId: RoleId;
  tasks: [
    ActionPlanTask,
    ActionPlanTask,
    ActionPlanTask,
    ActionPlanTask,
    ActionPlanTask,
    ActionPlanTask,
    ActionPlanTask,
  ];
  configVersion: string;
}

export interface FeedbackDocument extends DatabaseDocument {
  sessionId: string;
  helpfulness: 1 | 2 | 3 | 4 | 5;
  interestedRoleId?: RoleId;
  comment?: string;
}

export interface EventDocument extends DatabaseDocument {
  sessionId: string;
  eventName: string;
  step: string;
  durationMs?: number;
  clientVersion: string;
}
