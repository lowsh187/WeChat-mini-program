/** Consumer adapter for B's draft v2. No endpoint is enabled until deployment is confirmed. */
import type {
  ScoreTrialRequestV2,
  TrackEventRequestV2,
  SubmitFeedbackRequestV2,
  FeedbackPublicationConsentV2,
} from "../../shared/contracts.v2";
import type { LocalSession, FrontendResult } from "../models/frontend";
import { workTrials } from "../mocks/work-trials";

export const v2Availability = {
  deployed: true,
  message: "v2 推荐与逐题评分已经接入云函数；公开授权随反馈保存，正式事件使用唯一 eventId。",
};
export const PUBLICATION_TEXT_VERSION = "pathai-publication-feedback-20261016-v1";
export const publicationConsentText =
  "我同意团队将本次反馈经匿名处理后，用于本项目参赛材料和项目展示。不同意不影响提交反馈或使用功能。本同意不包含截图、完整画像或完整试岗回答；撤回方式需上线前由团队提供。";
export function preferenceAnswers(session: LocalSession) {
  const options: Record<string, "facts" | "people" | "practice" | "unsure"> = {
    "ui-facts": "facts",
    "ui-people": "people",
    "ui-practice": "practice",
    "ui-unsure": "unsure",
  };
  const value = options[session.profile.preference];
  if (!value) throw new Error("请选择探索偏好");
  return { preferredApproach: value };
}
export function buildTrialRequest(sessionId: string, session: LocalSession): ScoreTrialRequestV2 {
  const draft = session.trial;
  const definition = workTrials.find((item) => item.localId === draft?.localTrialId);
  if (!draft || !definition?.trialId || !definition.questionIds) throw new Error("试岗配置未对齐");
  const answers: Record<string, string> = {};
  if (
    Object.keys(draft.answers).some(
      (id) => !definition.fields.some((field) => field.localId === id),
    )
  )
    throw new Error("存在未知题目");
  for (const field of definition.fields) {
    const answer = draft.answers[field.localId]?.trim();
    if (!answer || answer.length > 1200) throw new Error("请完成三道必答题，每题最多 1200 字");
    answers[field.localId] = answer;
  }
  const optionalId = definition.questionIds[3];
  if (draft.supplementaryAnswer.trim()) {
    if (!optionalId || draft.supplementaryAnswer.length > 1200) throw new Error("补充回答无效");
    answers[optionalId] = draft.supplementaryAnswer.trim();
  }
  return { sessionId, trialId: definition.trialId, trialAttemptId: draft.trialAttemptId, answers };
}
export function buildFeedbackRequest(
  sessionId: string,
  helpfulness: 1 | 2 | 3 | 4 | 5,
  comment: string,
  publicationConsent: FeedbackPublicationConsentV2,
): SubmitFeedbackRequestV2 {
  if (comment.length > 500 || /(?:1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/.test(comment))
    throw new Error("反馈不可包含联系方式，且最多 500 字");
  return {
    sessionId,
    helpfulness,
    ...(comment.trim() ? { comment: comment.trim() } : {}),
    publicationConsent: { ...publicationConsent },
  };
}
export function blockUnreleasedV2<T>(
  _request: ScoreTrialRequestV2 | TrackEventRequestV2 | SubmitFeedbackRequestV2,
): Promise<FrontendResult<T>> {
  return Promise.resolve({ status: "error", data: null, message: v2Availability.message });
}
