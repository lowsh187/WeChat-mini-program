import { baseQuestions, currentStates, goals, preferences } from '../mocks/base-questions';
import { FollowupProgress, LocalSession, ProfileDraft, TrialProgress, TrialResultView } from '../models/frontend';
import { workTrials } from '../mocks/work-trials';
import { localStorage, StorageAdapter } from '../utils/storage';

const STORAGE_KEY = 'pathai.frontend.session.v1';
const STORAGE_VERSION = 1; // Local cache format only, not contractVersion/configVersion.
const inChoices = (value: unknown, choices: { id: string }[]) =>
  typeof value === 'string' && (value === '' || choices.some((choice) => choice.id === value));
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isFollowup(value: unknown): value is FollowupProgress {
  return isObject(value) && Array.isArray(value.drafts) && value.drafts.length === 2 &&
    value.drafts.every((draft) => typeof draft === 'string' && draft.length <= 800) &&
    (value.round === 0 || value.round === 1) && typeof value.submittedCount === 'number' &&
    Number.isInteger(value.submittedCount) && value.submittedCount >= 0 && value.submittedCount <= 2 &&
    value.drafts.slice(0, value.submittedCount).every((draft) => draft.trim().length > 0);
}
function emptyFollowup(): FollowupProgress { return { drafts: ['', ''], round: 0, submittedCount: 0 }; }

function isTrialResult(value: unknown, localTrialId: string): value is TrialResultView {
  const dimensions = ['信息提炼', '逻辑分析', '用户洞察', '表达沟通', '执行规划', '创意发散'];
  return isObject(value) && value.source === 'mock' && value.localTrialId === localTrialId &&
    typeof value.roleName === 'string' && typeof value.notice === 'string' &&
    typeof value.exampleAnswer === 'string' && value.exampleAnswer.trim().length > 0 &&
    Array.isArray(value.evidence) && value.evidence.length > 0 && value.evidence.every((item) =>
      isObject(item) && typeof item.dimensionLabel === 'string' && dimensions.includes(item.dimensionLabel) &&
      ['exampleEvidence', 'examplePerformance', 'improvement'].every((key) => typeof item[key] === 'string' && (item[key] as string).trim().length > 0));
}

function isTrial(value: unknown): value is TrialProgress {
  if (!isObject(value) || !isObject(value.answers)) return false;
  const definition = workTrials.find((trial) => trial.localId === value.localTrialId);
  if (!definition) return false;
  const answers = value.answers;
  return Object.keys(answers).every((key) => definition.fields.some((field) => field.localId === key) && typeof answers[key] === 'string' && (answers[key] as string).length <= 1200) &&
    typeof value.supplementaryAnswer === 'string' && value.supplementaryAnswer.length <= 1200 &&
    typeof value.startedAt === 'number' && Number.isFinite(value.startedAt) && value.startedAt > 0 &&
    typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 &&
    typeof value.message === 'string' && typeof value.completed === 'boolean' &&
    (value.completed ? isTrialResult(value.result, definition.localId) && (value.resultStatus === 'success' || value.resultStatus === 'degraded') && definition.fields.every((field) => typeof answers[field.localId] === 'string' && (answers[field.localId] as string).trim()) : value.result === null && value.resultStatus === null);
}

function copyResult(result: TrialResultView): TrialResultView {
  return { ...result, evidence: result.evidence.map((item) => ({ ...item })) };
}

function isSession(value: unknown): value is LocalSession {
  if (!isObject(value) || !isObject(value.profile) || !isObject(value.answers)) return false;
  if (!inChoices(value.profile.currentState, currentStates) || !inChoices(value.profile.goal, goals) || !inChoices(value.profile.preference, preferences)) return false;
  const answers = value.answers;
  if (!Object.keys(answers).every((id) => baseQuestions.some((question) => question.id === id && question.options.some((option) => option.id === answers[id])))) return false;
  return typeof value.localId === 'string' && value.localId.startsWith('local-') &&
    typeof value.questionIndex === 'number' && Number.isInteger(value.questionIndex) && value.questionIndex >= 0 && value.questionIndex < baseQuestions.length &&
    ['profile', 'followup', 'initial-result', 'work-trial', 'trial-result'].includes(value.stage as string) &&
    (value.followup === undefined || isFollowup(value.followup)) &&
    (value.trial === undefined || isTrial(value.trial)) &&
    typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 &&
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0;
}

function copy(session: LocalSession): LocalSession {
  return { ...session, profile: { ...session.profile }, answers: { ...session.answers },
    followup: session.followup ? { ...session.followup, drafts: [...session.followup.drafts] } : emptyFollowup(),
    trial: session.trial ? { ...session.trial, answers: { ...session.trial.answers }, result: session.trial.result ? copyResult(session.trial.result) : null } : undefined };
}

export function isProfileComplete(session: LocalSession | null): boolean {
  return !!session && !!session.profile.currentState && !!session.profile.goal && !!session.profile.preference &&
    baseQuestions.every((question) => question.options.some((option) => option.id === session.answers[question.id]));
}

export function isFollowupComplete(session: LocalSession | null): boolean {
  return isProfileComplete(session) && session?.followup?.submittedCount === 2;
}

/** Injected storage allows resume/corruption/failure checks without a WeChat runtime. */
export function createSessionStore(storage: StorageAdapter) {
  let loaded = false;
  let cached: LocalSession | null = null;
  let warning = '';

  function snapshot() {
    if (!loaded) {
      loaded = true;
      try {
        const raw = storage.read(STORAGE_KEY);
        if (raw !== '' && raw !== undefined && raw !== null) {
          if (isObject(raw) && raw.version === STORAGE_VERSION && isSession(raw.session)) {
            cached = copy(raw.session);
            if (cached.stage !== 'profile' && !isFollowupComplete(cached)) {
              cached.stage = isProfileComplete(cached) ? 'followup' : 'profile'; cached.trial = undefined;
            }
          }
          else warning = '本地记录格式异常或版本不兼容，请重新开始。';
        }
      } catch {
        warning = '无法读取本地记录。可以重新开始，当前进度仅在本次运行中保留。';
      }
    }
    return { session: cached ? copy(cached) : null, warning };
  }

  function persist(session: LocalSession): LocalSession {
    cached = copy(session);
    loaded = true;
    try {
      storage.write(STORAGE_KEY, { version: STORAGE_VERSION, session: copy(session) });
      warning = '';
    } catch {
      warning = '本地保存失败，当前进度仅在本次运行中保留。请重试保存后再退出。';
    }
    return copy(session);
  }

  function start(): LocalSession {
    const now = Date.now();
    return persist({
      localId: `local-${now}-${Math.random().toString(36).slice(2, 8)}`,
      profile: { currentState: '', goal: '', preference: '' }, answers: {},
      questionIndex: 0, stage: 'profile', followup: emptyFollowup(), revision: 0, updatedAt: now,
    });
  }

  function requireSession(): LocalSession {
    return snapshot().session || start();
  }

  return {
    snapshot,
    start,
    updateProfile(field: keyof ProfileDraft, value: string): LocalSession {
      const choiceSets = { currentState: currentStates, goal: goals, preference: preferences };
      if (!inChoices(value, choiceSets[field])) throw new Error('未知画像选项');
      const session = requireSession();
      if (session.profile[field] !== value) {
        session.profile[field] = value;
        session.revision += 1;
        session.stage = 'profile';
        session.followup = emptyFollowup();
        session.trial = undefined;
      }
      session.updatedAt = Date.now();
      return persist(session);
    },
    answer(questionId: string, optionId: string): LocalSession {
      const question = baseQuestions.find((item) => item.id === questionId);
      if (!question || !question.options.some((option) => option.id === optionId)) throw new Error('未知题目或选项');
      const session = requireSession();
      if (session.answers[questionId] !== optionId) {
        session.answers[questionId] = optionId;
        session.revision += 1;
        session.stage = 'profile';
        session.followup = emptyFollowup();
        session.trial = undefined;
      }
      session.updatedAt = Date.now();
      return persist(session);
    },
    moveTo(index: number): LocalSession {
      if (!Number.isInteger(index) || index < 0 || index >= baseQuestions.length) throw new Error('题目进度越界');
      const session = requireSession();
      session.questionIndex = index;
      session.updatedAt = Date.now();
      return persist(session);
    },
    markRecommendation(revision: number): boolean {
      const session = snapshot().session;
      if (!isFollowupComplete(session) || !session || session.revision !== revision) return false;
      session.stage = 'initial-result';
      session.updatedAt = Date.now();
      persist(session);
      return true;
    },
    enterFollowup(): boolean {
      const session = snapshot().session;
      if (!isProfileComplete(session) || !session) return false;
      session.stage = 'followup'; persist(session); return true;
    },
    editFollowup(round: number): void {
      if (round !== 0 && round !== 1) throw new Error('追问轮次错误');
      const session = requireSession();
      const progress = session.followup || emptyFollowup();
      if (round > progress.submittedCount) throw new Error('请先完成上一轮');
      progress.round = round; session.followup = progress; session.stage = 'followup'; persist(session);
    },
    setFollowupDraft(round: number, text: string): void {
      if ((round !== 0 && round !== 1) || text.length > 800) throw new Error('追问输入无效');
      const session = requireSession();
      const progress = session.followup || emptyFollowup();
      if (round > progress.submittedCount) throw new Error('请先完成上一轮');
      if (progress.drafts[round] !== text) {
        progress.drafts[round] = text; progress.submittedCount = Math.min(progress.submittedCount, round);
        session.revision += 1; session.stage = 'followup';
        session.trial = undefined;
      }
      progress.round = round; session.followup = progress; session.updatedAt = Date.now(); persist(session);
    },
    submitFollowupRound(round: number, revision: number): boolean {
      const session = snapshot().session;
      const progress = session?.followup;
      if (!session || !isProfileComplete(session) || session.revision !== revision || !progress ||
        round !== progress.submittedCount || round >= 2 || !progress.drafts[round].trim()) return false;
      progress.submittedCount += 1; progress.round = Math.min(progress.submittedCount, 1);
      session.revision += 1; session.stage = progress.submittedCount === 2 ? 'initial-result' : 'followup';
      session.updatedAt = Date.now(); persist(session); return true;
    },
    startTrial(localTrialId: string, restart = false): boolean {
      const session = snapshot().session;
      if (!session || !isFollowupComplete(session) || !workTrials.some((trial) => trial.localId === localTrialId)) return false;
      if (restart || session.trial?.localTrialId !== localTrialId) {
        session.trial = { localTrialId, answers: {}, supplementaryAnswer: '', startedAt: Date.now(), revision: 0,
          completed: false, result: null, resultStatus: null, message: '' };
        session.revision += 1;
      }
      session.stage = session.trial?.completed ? 'trial-result' : 'work-trial';
      session.updatedAt = Date.now(); persist(session); return true;
    },
    updateTrialAnswer(fieldId: string, text: string): void {
      const session = snapshot().session;
      const trial = session?.trial;
      const definition = workTrials.find((item) => item.localId === trial?.localTrialId);
      if (!session || !trial || !definition || text.length > 1200 || (fieldId !== 'ui-supplement' && !definition.fields.some((field) => field.localId === fieldId))) throw new Error('试岗回答无效');
      const current = fieldId === 'ui-supplement' ? trial.supplementaryAnswer : trial.answers[fieldId] || '';
      if (current === text) return;
      if (fieldId === 'ui-supplement') trial.supplementaryAnswer = text;
      else trial.answers[fieldId] = text;
      trial.revision += 1; session.revision += 1;
      trial.completed = false; trial.result = null; trial.resultStatus = null; trial.message = '';
      session.stage = 'work-trial'; session.updatedAt = Date.now(); persist(session);
    },
    saveTrialResult(localId: string, trialRevision: number, sessionId: string, sessionRevision: number, result: TrialResultView, status: 'success' | 'degraded', message: string): boolean {
      const session = snapshot().session;
      const trial = session?.trial;
      const definition = workTrials.find((item) => item.localId === localId);
      if (!session || session.localId !== sessionId || session.revision !== sessionRevision || !isFollowupComplete(session) || !trial || trial.completed ||
        trial.localTrialId !== localId || trial.revision !== trialRevision || !definition ||
        !definition.fields.every((field) => trial.answers[field.localId]?.trim()) || !isTrialResult(result, localId)) return false;
      trial.completed = true; trial.result = copyResult(result); trial.resultStatus = status; trial.message = message;
      session.stage = 'trial-result'; session.updatedAt = Date.now(); persist(session); return true;
    },
    retrySave(): void {
      const session = snapshot().session;
      if (session) persist(session);
    },
    clear(): boolean {
      try {
        storage.remove(STORAGE_KEY);
        cached = null;
        loaded = true;
        warning = '';
        return true;
      } catch {
        warning = '清除本地记录失败，请重试。';
        return false;
      }
    },
  };
}

export const sessionStore = createSessionStore(localStorage);
