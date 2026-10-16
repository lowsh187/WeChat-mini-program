/** Frontend consumer of origin/backend e5a360c API_CONTRACT v1.0.0.
 * B owns the contract. No scoring or raw AI output is accepted here.
 * These endpoints exist in source; deployment and device tests remain required.
 */
import type { FrontendResult } from "../models/frontend";
import { CLOUD_ENV_ID } from "../config/environment";
import type {
  GetInitialRecommendationDataV2,
  GetInitialRecommendationRequestV2,
  ScoreTrialDataV2,
  ScoreTrialRequestV2,
  TrackEventRequestV2,
} from "../../shared/contracts.v2";

export const cloudRoleIds = [
  "data_analyst",
  "product_operations",
  "user_researcher",
  "product_manager",
  "project_manager",
  "content_strategist",
];
const dimensions = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
];
export interface CloudSession {
  sessionId: string;
  deletionToken: string;
  progress: "created";
  expiresAt: string;
}
export interface CloudQuestion {
  round: 1 | 2;
  dimension: string;
  questionId: string;
  questionText: string;
}
export interface CloudPlan {
  planId?: string;
  roleId: string;
  items: { day: number; title: string; description: string; completed: boolean }[];
  personalizedSuggestion: string;
}
export interface Mutation {
  accepted: boolean;
}
export interface CloudCapability {
  dimension: string;
  score: number;
  maxScore: 5;
  evidence: string;
  improvement: string;
}
export type Transport = (name: string, data: Record<string, unknown>) => Promise<unknown>;
type Guard<T> = (data: unknown) => data is T;
export const object = (data: unknown): data is Record<string, unknown> =>
  typeof data === "object" && data !== null && !Array.isArray(data);
const text = (data: unknown): data is string => typeof data === "string" && data.trim().length > 0;
export const isCloudSession: Guard<CloudSession> = (data): data is CloudSession =>
  object(data) &&
  typeof data.sessionId === "string" &&
  /^ses_[a-f0-9]{32}$/.test(data.sessionId) &&
  typeof data.deletionToken === "string" &&
  /^[A-Za-z0-9_-]{43}$/.test(data.deletionToken) &&
  data.progress === "created" &&
  typeof data.expiresAt === "string" &&
  Number.isFinite(Date.parse(data.expiresAt));
const isQuestion: Guard<CloudQuestion> = (data): data is CloudQuestion =>
  object(data) &&
  (data.round === 1 || data.round === 2) &&
  dimensions.includes(data.dimension as string) &&
  text(data.questionText) &&
  typeof data.questionId === "string" &&
  (
    {
      information_extraction: ["followup_information_01", "followup_information_02"],
      logical_analysis: ["followup_logic_01", "followup_logic_02"],
      user_insight: ["followup_user_01", "followup_user_02"],
      communication: ["followup_communication_01", "followup_communication_02"],
      execution_planning: ["followup_execution_01", "followup_execution_02"],
      creative_ideation: ["followup_creative_01", "followup_creative_02"],
    } as Record<string, string[]>
  )[data.dimension as string]?.includes(data.questionId) === true;
const isPlan: Guard<CloudPlan> = (data): data is CloudPlan =>
  object(data) &&
  cloudRoleIds.includes(data.roleId as string) &&
  text(data.personalizedSuggestion) &&
  Array.isArray(data.items) &&
  data.items.length === 7 &&
  data.items.every(
    (item, index) =>
      object(item) &&
      item.day === index + 1 &&
      text(item.title) &&
      text(item.description) &&
      typeof item.completed === "boolean",
  );
const isMutation: Guard<Mutation> = (data): data is Mutation =>
  object(data) && data.accepted === true;
const failure = (message: string): FrontendResult<never> => ({
  status: "error",
  data: null,
  message,
});

const isObservationArray = (data: unknown): boolean =>
  Array.isArray(data) &&
  data.length <= 6 &&
  data.every(
    (item) =>
      object(item) &&
      dimensions.includes(item.dimension as string) &&
      item.maxScore === 5 &&
      Array.isArray(item.evidence) &&
      ((item.status === "observed" &&
        typeof item.score === "number" &&
        item.score >= 0 &&
        item.score <= 5 &&
        item.evidence.length > 0 &&
        item.evidence.every(text) &&
        text(item.improvement)) ||
        ((item.status === "not_observed" || item.status === "unavailable") &&
          item.score === null &&
          item.evidence.length === 0 &&
          text(item.reason))),
  );

const isRecommendationArray = (data: unknown): boolean =>
  Array.isArray(data) &&
  data.length === 3 &&
  new Set(data.map((item) => (object(item) ? item.roleId : ""))).size === 3 &&
  data.every(
    (item) =>
      object(item) &&
      cloudRoleIds.includes(item.roleId as string) &&
      typeof item.score === "number" &&
      Number.isFinite(item.score) &&
      Array.isArray(item.reasons) &&
      item.reasons.length > 0 &&
      item.reasons.every(text),
  );

const isInitialRecommendationV2: Guard<GetInitialRecommendationDataV2> = (
  data,
): data is GetInitialRecommendationDataV2 =>
  object(data) &&
  isObservationArray(data.capabilityObservations) &&
  isRecommendationArray(data.recommendations) &&
  Array.isArray(data.scoreComponents) &&
  object(data.effectiveWeights) &&
  Array.isArray(data.missingComponents) &&
  typeof data.comparableToFullScore === "boolean";

const isScoreTrialV2: Guard<ScoreTrialDataV2> = (data): data is ScoreTrialDataV2 =>
  object(data) &&
  text(data.trialId) &&
  text(data.trialAttemptId) &&
  isObservationArray(data.capabilityObservations) &&
  isRecommendationArray(data.recommendationsBefore) &&
  isRecommendationArray(data.recommendationsAfter) &&
  Array.isArray(data.changeExplanation) &&
  data.changeExplanation.every(text) &&
  Array.isArray(data.practicePriorities) &&
  data.practicePriorities.length <= 2 &&
  typeof data.replayed === "boolean";

export function createCloudAdapter(transport: Transport, timeoutMs = 15000) {
  const pending = new Set<string>();
  async function call<T>(
    name: string,
    data: Record<string, unknown>,
    valid: Guard<T>,
    onValidated?: (value: T) => void,
  ): Promise<FrontendResult<T>> {
    if (pending.has(name)) return failure("请求仍在处理中，请勿重复提交。超时后需确认云端状态。");
    pending.add(name);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = Promise.resolve()
      .then(() => transport(name, data))
      .then((raw): FrontendResult<T> => {
        if (
          !object(raw) ||
          raw.contractVersion !== "1.0.0" ||
          raw.configVersion !== "1.0.0" ||
          !["success", "degraded", "error"].includes(raw.status as string) ||
          typeof raw.aiGenerated !== "boolean"
        ) {
          return failure("云端响应版本或结构不兼容，已阻止展示。");
        }
        if (raw.status === "error")
          return failure("云端未能完成请求，请检查网络、会话有效期或联系团队。");
        // Implemented B endpoints are rule/template functions, not AI scoring.
        if (
          raw.aiGenerated !== false ||
          !valid(raw.data) ||
          (raw.status === "success" && raw.error !== null)
        ) {
          return failure("云端数据未通过前端契约检查，已阻止展示。");
        }
        if (
          raw.status === "degraded" &&
          (!object(raw.error) || !text(raw.error.code) || !text(raw.error.message))
        ) {
          return failure("降级数据缺少状态说明，已阻止展示。");
        }
        onValidated?.(raw.data);
        return {
          status: raw.status as "success" | "degraded",
          data: raw.data,
          message: raw.status === "degraded" ? "云端返回模板降级结果，未进行 AI 评分。" : "",
        };
      })
      .catch(() => failure("云服务或本地保存异常，请检查网络和云环境配置。"))
      .then((result) => {
        pending.delete(name);
        return result;
      });
    try {
      return await Promise.race([
        operation,
        new Promise<FrontendResult<T>>((resolve) => {
          timer = setTimeout(
            () =>
              resolve(
                failure("已等待 15 秒，结果尚未确认。不要重复提交；可使用明确标识的 Mock 演示。"),
              ),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  async function callV2<T>(
    name: string,
    data: Record<string, unknown>,
    valid: Guard<T>,
  ): Promise<FrontendResult<T>> {
    if (pending.has(name)) return failure("请求仍在处理中，请勿重复提交。");
    pending.add(name);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = Promise.resolve()
      .then(() => transport(name, data))
      .then((raw): FrontendResult<T> => {
        if (
          !object(raw) ||
          raw.contractVersion !== "2.0.0" ||
          raw.configVersion !== "2.0.0" ||
          !["success", "degraded", "error"].includes(raw.status as string) ||
          typeof raw.aiGenerated !== "boolean"
        )
          return failure("云端 v2 响应版本或结构不兼容，已阻止展示。");
        if (raw.status === "error")
          return failure(
            object(raw.error) && text(raw.error.message)
              ? raw.error.message
              : "云端未能完成请求，请稍后重试。",
          );
        if (!valid(raw.data)) return failure("云端结果未通过安全校验，已阻止展示。");
        return {
          status: raw.status as "success" | "degraded",
          data: raw.data,
          message:
            raw.status === "degraded" && object(raw.error) && text(raw.error.message)
              ? raw.error.message
              : "",
        };
      })
      .catch(() => failure("云服务或本地保存异常，请检查网络和云环境配置。"))
      .then((result) => {
        pending.delete(name);
        return result;
      });
    try {
      return await Promise.race([
        operation,
        new Promise<FrontendResult<T>>((resolve) => {
          timer = setTimeout(
            () => resolve(failure("AI 请求超时，结果尚未确认，请勿重复提交。")),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  return {
    createSession(onValidated?: (session: CloudSession) => void) {
      return call("createSession", { clientVersion: "0.1.0" }, isCloudSession, onValidated);
    },
    selectFollowup(sessionId: string, round: 1 | 2, answeredQuestionIds: string[]) {
      return call(
        "selectFollowup",
        { sessionId, round, answeredQuestionIds, evidenceByDimension: {} },
        (data): data is CloudQuestion => isQuestion(data) && data.round === round,
      );
    },
    getInitialRecommendation(request: GetInitialRecommendationRequestV2) {
      return callV2(
        "getInitialRecommendation",
        request as unknown as Record<string, unknown>,
        isInitialRecommendationV2,
      );
    },
    scoreTrial(request: ScoreTrialRequestV2) {
      return callV2(
        "scoreTrial",
        request as unknown as Record<string, unknown>,
        (data): data is ScoreTrialDataV2 =>
          isScoreTrialV2(data) &&
          data.trialId === request.trialId &&
          data.trialAttemptId === request.trialAttemptId,
      );
    },
    getActionPlan(sessionId: string, roleId: string, gaps: CloudCapability[]) {
      // Caller must supply B-validated real scoring data. No UI Mock conversion exists.
      if (
        !cloudRoleIds.includes(roleId) ||
        !Array.isArray(gaps) ||
        gaps.length < 1 ||
        gaps.length > 6 ||
        new Set(gaps.map((gap) => gap.dimension)).size !== gaps.length ||
        !gaps.every(
          (gap) =>
            dimensions.includes(gap.dimension) &&
            Number.isFinite(gap.score) &&
            gap.score >= 0 &&
            gap.score <= 5 &&
            gap.maxScore === 5 &&
            text(gap.evidence) &&
            text(gap.improvement),
        )
      ) {
        return Promise.resolve(
          failure("缺少经服务端校验的真实能力差距，未调用云端。不能用 Mock 证据替代。"),
        );
      }
      return call(
        "getActionPlan",
        { sessionId, roleId, gaps },
        (data): data is CloudPlan => isPlan(data) && data.roleId === roleId,
      );
    },
    submitFeedback(
      sessionId: string,
      helpfulness: number,
      comment: string,
      publicationConsent = {
        granted: false,
        textVersion: "pathai-publication-feedback-20261016-v1",
      },
    ) {
      if (
        !Number.isInteger(helpfulness) ||
        helpfulness < 1 ||
        helpfulness > 5 ||
        comment.length > 500 ||
        /(?:1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/.test(comment)
      )
        return Promise.resolve(
          failure("请选择 1～5 的帮助度；反馈不超过 500 字，且不要填写手机号或邮箱。"),
        );
      return call(
        "submitFeedback",
        {
          sessionId,
          helpfulness,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          publicationConsent,
        },
        isMutation,
      );
    },
    trackEvent(sessionId: string, eventName: string, step: string) {
      if (![eventName, step].every((value) => /^[a-z][a-z0-9_.-]{0,63}$/.test(value)))
        return Promise.resolve(failure("事件参数无效。"));
      return call("trackEvent", { sessionId, eventName, step }, isMutation);
    },
    trackFormalEvent(event: TrackEventRequestV2) {
      return call("trackEvent", event as unknown as Record<string, unknown>, isMutation);
    },
    deleteSession(sessionId: string, confirmationToken: string) {
      return call("deleteSession", { sessionId, confirmationToken }, isMutation);
    },
  };
}

let initialized = false;
export const cloudAdapter = createCloudAdapter(async (name, data) => {
  if (!wx.cloud) throw new Error("CLOUD_UNAVAILABLE");
  if (!initialized) {
    // Development environment ID from B's API_CONTRACT; not a production configuration.
    wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: false });
    initialized = true;
  }
  const response = await wx.cloud.callFunction({ name, data });
  return response.result;
});
