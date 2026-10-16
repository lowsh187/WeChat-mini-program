import {
  getMockFollowup,
  getMockInitialRecommendation,
  getMockTrial,
  submitMockTrial,
} from "./mock-provider";
import type { MockScenario } from "../models/frontend";
import { workTrials } from "../mocks/work-trials";
import { createMockPlan } from "../mocks/next-steps";
import { runtime } from "../config/runtime";
import type { ScoreTrialRequestV2 } from "../../shared/contracts.v2";
import { CLOUD_NOTICE } from "../config/runtime";
import { cloudAdapter } from "./cloud-adapter";
import { cloudSession } from "./cloud-session";
import { sessionStore } from "../store/session";
import { preferenceAnswers } from "./v2-contract";
import { backendContent } from "../config/backend-content";
import { roles } from "../mocks/roles";
import type {
  ActionPlanView,
  FollowupQuestion,
  FrontendResult,
  InitialRecommendationView,
  TrialResultView,
} from "../models/frontend";

const dimensionLabels: Record<string, string> = {
  information_extraction: "信息提炼",
  logical_analysis: "逻辑分析",
  user_insight: "用户洞察",
  communication: "表达沟通",
  execution_planning: "执行规划",
  creative_ideation: "创意发散",
};
const cloudEnabled = (scenario: MockScenario) =>
  runtime.mode === "cloud" && scenario === "normal" && typeof wx !== "undefined" && !!wx.cloud;
const cloudUnavailable = <T>(): FrontendResult<T> => ({
  status: "error",
  data: null,
  message: "尚未建立有效云端会话，请返回首页创建匿名会话后重试。",
});

// Page-facing adapter, not a backend request contract. No answers leave the device.
export const frontendService = {
  async getActionPlan(roleName: string, scenario: MockScenario = "normal") {
    if (cloudEnabled(scenario)) {
      const credentials = cloudSession.current();
      const session = sessionStore.snapshot().session;
      const result = session?.trial?.result;
      const definition = workTrials.find((trial) => trial.roleName === roleName);
      if (!credentials || !session || !result || !definition?.roleId)
        return cloudUnavailable<ActionPlanView>();
      const gaps = (result.observations || [])
        .filter((item) => item.status === "observed")
        .map((item) => ({
          dimension: item.dimension,
          score: item.score,
          maxScore: item.maxScore,
          evidence: item.evidence.join("；"),
          improvement: item.improvement,
        }));
      if (!gaps.length)
        return {
          status: "error" as const,
          data: null,
          message: "本次没有有效能力观察，暂不能生成个性化计划，请先重新完成试岗评分。",
        };
      const response = await cloudAdapter.getActionPlan(
        credentials.sessionId,
        definition.roleId,
        gaps,
      );
      if (response.status === "error" || !response.data) return response;
      const view: ActionPlanView = {
        planId: response.data.planId || `cloud-plan-${credentials.sessionId}-${definition.roleId}`,
        source: "cloud",
        roleName,
        notice: CLOUD_NOTICE,
        items: response.data.items.map((item) => ({ ...item })),
      };
      return { status: response.status, data: view, message: response.message };
    }
    await new Promise<void>((resolve) =>
      setTimeout(resolve, scenario === "timeout" ? 15000 : runtime.mockDelayMs),
    );
    if (scenario === "error")
      return {
        status: "error" as const,
        data: null,
        message: "计划读取失败，请重试。已有勾选不会丢失。",
      };
    return {
      status:
        scenario === "timeout" || scenario === "degraded"
          ? ("degraded" as const)
          : ("success" as const),
      data: scenario === "empty" ? null : createMockPlan(roleName),
      message:
        scenario === "timeout" || scenario === "degraded"
          ? "已降级为固定计划模板，未调用 AI。"
          : "",
    };
  },
  getTrialOptions() {
    return workTrials.map((trial) => ({
      localRoleId: trial.localRoleId,
      localTrialId: trial.localId,
      roleName: trial.roleName,
    }));
  },
  getTrial(localRoleId: string, scenario: MockScenario = "normal") {
    return getMockTrial(localRoleId, scenario);
  },
  submitTrial(
    localTrialId: string,
    scenario: MockScenario = "normal",
    request?: ScoreTrialRequestV2,
  ) {
    const definition = workTrials.find((trial) => trial.localId === localTrialId);
    if (
      request &&
      (!definition || definition.trialId !== request.trialId || !request.trialAttemptId)
    ) {
      return Promise.resolve({
        status: "error" as const,
        data: null,
        message: "逐题请求与试岗配置不匹配，未提交。",
      });
    }
    if (request && cloudEnabled(scenario)) {
      const credentials = cloudSession.current();
      if (!credentials || request.sessionId !== credentials.sessionId)
        return cloudUnavailable<TrialResultView>();
      if (!definition) return cloudUnavailable<TrialResultView>();
      return cloudAdapter.scoreTrial(request).then((response): FrontendResult<TrialResultView> => {
        if (response.status === "error" || !response.data) return response;
        const data = response.data;
        const evidence = data.capabilityObservations
          .filter((item) => item.status === "observed")
          .map((item) => ({
            dimensionLabel: dimensionLabels[item.dimension] || item.dimension,
            exampleEvidence: item.evidence.join("；"),
            examplePerformance: `本次任务观察 ${item.score}/5`,
            improvement: item.improvement,
          }));
        return {
          status: response.status,
          message: response.message,
          data: {
            source: "cloud",
            localTrialId,
            roleName: definition.roleName,
            roleId: definition.roleId,
            notice: CLOUD_NOTICE,
            exampleAnswer: "以下结果基于你本次提交的回答生成；技术失败不会被记作 0 分。",
            evidence,
            observations: data.capabilityObservations,
            recommendationsBefore: data.recommendationsBefore.map((item) => item.roleId),
            recommendationsAfter: data.recommendationsAfter.map((item) => item.roleId),
            changeExplanation: [...data.changeExplanation],
            practicePriorities: data.practicePriorities.map((item) => ({ ...item })),
          },
        };
      });
    }
    // Mock fixture provider never uploads or evaluates request.answers.
    return submitMockTrial(localTrialId, scenario);
  },
  async getFollowup(round: number, scenario: MockScenario = "normal") {
    if (cloudEnabled(scenario)) {
      const credentials = cloudSession.current();
      const session = sessionStore.snapshot().session;
      if (!credentials || !session) return cloudUnavailable<FollowupQuestion>();
      const answeredQuestionIds = (session.followup?.questionIds || []).slice(0, round);
      const response = await cloudAdapter.selectFollowup(
        credentials.sessionId,
        (round + 1) as 1 | 2,
        answeredQuestionIds,
      );
      if (response.status === "error" || !response.data) return response;
      sessionStore.saveFollowupQuestion(round, response.data.questionId);
      return {
        status: response.status,
        message: response.message,
        data: {
          localId: response.data.questionId,
          title: `第 ${round + 1} 轮追问`,
          prompt: response.data.questionText,
          dimensionLabel: dimensionLabels[response.data.dimension] || response.data.dimension,
        },
      };
    }
    return getMockFollowup(round, scenario);
  },
  async getInitialRecommendation(scenario: MockScenario = "normal", forceMock = false) {
    if (!forceMock && cloudEnabled(scenario)) {
      const credentials = cloudSession.current();
      const session = sessionStore.snapshot().session;
      if (!credentials || !session) return cloudUnavailable<InitialRecommendationView>();
      const progress = session.followup;
      if (!progress || progress.submittedCount !== 2 || (progress.questionIds || []).length !== 2)
        return {
          status: "error" as const,
          data: null,
          message: "追问题目标识不完整，请返回追问页重新加载后再试。",
        };
      const followupAnswers: Record<string, string> = {};
      for (let index = 0; index < 2; index += 1) {
        const questionId = progress.questionIds?.[index];
        const answer = progress.drafts[index]?.trim();
        if (questionId && answer) followupAnswers[questionId] = answer;
      }
      const response = await cloudAdapter.getInitialRecommendation({
        sessionId: credentials.sessionId,
        baseAnswers: { ...session.answers },
        ...preferenceAnswers(session),
        followupAnswers,
      });
      if (response.status === "error" || !response.data) return response;
      const cards = response.data.recommendations.map((recommendation) => {
        const role = backendContent.roles.find((item) => item.roleId === recommendation.roleId);
        const preview = roles.find((item) => item.name === role?.name);
        if (!role || !preview) throw new Error("岗位展示配置缺失");
        return {
          ...preview,
          exampleReason: recommendation.reasons.join("；"),
          focusDimensions: response.data.capabilityObservations
            .filter((item) => item.status === "observed")
            .slice(0, 3)
            .map((item) => dimensionLabels[item.dimension] || item.dimension),
        };
      });
      return {
        status: response.status,
        message: response.message,
        data: { source: "cloud", notice: CLOUD_NOTICE, cards },
      };
    }
    return getMockInitialRecommendation(scenario);
  },
};
