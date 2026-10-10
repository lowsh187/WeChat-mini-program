/** Frontend-only draft models. These are NOT frozen shared/API contracts. */
export interface Choice { id: string; label: string }
export interface BaseQuestion { id: string; title: string; context: string; options: Choice[] }
export interface ProfileDraft { currentState: string; goal: string; preference: string }
export interface FollowupProgress { drafts: string[]; round: number; submittedCount: number }
export interface FollowupQuestion { localId: string; title: string; prompt: string; dimensionLabel: string }
export interface LocalSession {
  localId: string;
  profile: ProfileDraft;
  answers: Record<string, string>;
  questionIndex: number;
  stage: 'profile' | 'followup' | 'initial-result' | 'work-trial' | 'trial-result';
  followup?: FollowupProgress;
  trial?: TrialProgress;
  revision: number;
  updatedAt: number;
}
export interface RolePreview { localId: string; name: string; introduction: string }
export interface RecommendationCard extends RolePreview {
  exampleReason: string;
  focusDimensions: string[];
}
export interface InitialRecommendationView {
  source: 'mock';
  notice: string;
  cards: RecommendationCard[];
}
export type MockScenario = 'normal' | 'empty' | 'error' | 'timeout' | 'degraded';
export type FrontendResult<T> =
  | { status: 'success' | 'degraded'; data: T; message: string }
  | { status: 'error'; data: null; message: string };

/** Draft content and presentation types only. No Rubric, score or business IDs. */
export interface TrialField { localId: string; label: string; placeholder: string }
export interface TrialDefinition {
  source: 'mock'; localId: string; localRoleId: string; roleName: string;
  scenario: string; materials: { label: string; content: string }[];
  fields: TrialField[]; supplementaryPrompt: string; durationSeconds: number;
}
export interface TrialEvidenceExample {
  dimensionLabel: string; exampleEvidence: string; examplePerformance: string; improvement: string;
}
export interface TrialResultView {
  source: 'mock'; localTrialId: string; roleName: string; notice: string;
  exampleAnswer: string; evidence: TrialEvidenceExample[];
}
export interface TrialProgress {
  localTrialId: string; answers: Record<string, string>; supplementaryAnswer: string;
  startedAt: number; revision: number; completed: boolean;
  result: TrialResultView | null; resultStatus: 'success' | 'degraded' | null; message: string;
}
