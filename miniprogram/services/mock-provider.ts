import { runtime } from "../config/runtime";
import { createMockRecommendation } from "../mocks/initial-recommendation";
import type {
  FollowupQuestion,
  FrontendResult,
  InitialRecommendationView,
  MockScenario,
} from "../models/frontend";
import { followupQuestions } from "../mocks/followup-questions";
import type { TrialDefinition, TrialResultView } from "../models/frontend";
import { createTrialResult, workTrials } from "../mocks/work-trials";

export async function getMockTrial(
  localRoleId: string,
  scenario: MockScenario,
): Promise<FrontendResult<TrialDefinition | null>> {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, scenario === "timeout" ? 15000 : runtime.mockDelayMs),
  );
  if (scenario === "error")
    return { status: "error", data: null, message: "模拟试岗材料读取失败，请重试。" };
  const trial = workTrials.find((item) => item.localRoleId === localRoleId);
  if (!trial)
    return {
      status: "error",
      data: null,
      message: "当前只提供数据分析、产品运营和用户研究三个 Mock 试岗。",
    };
  const data =
    scenario === "empty"
      ? null
      : {
          ...trial,
          materials: trial.materials.map((item) => ({ ...item })),
          fields: trial.fields.map((item) => ({ ...item })),
        };
  return {
    status: scenario === "timeout" || scenario === "degraded" ? "degraded" : "success",
    data,
    message:
      scenario === "timeout" || scenario === "degraded"
        ? "模拟降级：使用固定试岗材料，不调用 AI。"
        : "",
  };
}

export async function submitMockTrial(
  localTrialId: string,
  scenario: MockScenario,
): Promise<FrontendResult<TrialResultView | null>> {
  // Only a local template ID is consumed. User answers are not sent to this fixture provider.
  await new Promise<void>((resolve) =>
    setTimeout(resolve, scenario === "timeout" ? 15000 : runtime.mockDelayMs),
  );
  if (scenario === "error")
    return { status: "error", data: null, message: "模拟提交失败，答案已在本地保留，可以重试。" };
  const data = createTrialResult(localTrialId);
  if (!data) return { status: "error", data: null, message: "没有对应的试岗示例。" };
  return {
    status: scenario === "timeout" || scenario === "degraded" ? "degraded" : "success",
    data: scenario === "empty" ? null : data,
    message:
      scenario === "timeout"
        ? "模拟提交等待 15 秒后返回固定示例模板，非真实 AI 评价。"
        : scenario === "degraded"
          ? "模拟降级：展示固定示例，未分析你的回答。"
          : "",
  };
}

export async function getMockFollowup(
  round: number,
  scenario: MockScenario,
): Promise<FrontendResult<FollowupQuestion | null>> {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, scenario === "timeout" ? 15000 : runtime.mockDelayMs),
  );
  if (!Number.isInteger(round) || round < 0 || round >= 2)
    return { status: "error", data: null, message: "追问最多两轮，请返回检查进度。" };
  if (scenario === "error")
    return { status: "error", data: null, message: "模拟追问读取失败，请重试。" };
  if (scenario === "empty")
    return { status: "success", data: null, message: "模拟题库暂时为空，请重试。" };
  const question = followupQuestions[round];
  if (!question) return { status: "error", data: null, message: "预设追问配置缺失。" };
  const data = { ...question };
  return {
    status: scenario === "timeout" || scenario === "degraded" ? "degraded" : "success",
    data,
    message:
      scenario === "timeout"
        ? "模拟等待 15 秒后使用预设追问模板，未调用 AI。"
        : scenario === "degraded"
          ? "模拟降级：使用预设追问模板，未调用 AI。"
          : "",
  };
}

export async function getMockInitialRecommendation(
  scenario: MockScenario,
): Promise<FrontendResult<InitialRecommendationView>> {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, scenario === "timeout" ? 15000 : runtime.mockDelayMs),
  );
  if (scenario === "error")
    return { status: "error", data: null, message: "模拟读取失败，请重试。未调用真实服务。" };
  const data = createMockRecommendation();
  if (scenario === "empty") data.cards = [];
  if (scenario === "timeout" || scenario === "degraded") {
    return {
      status: "degraded",
      data,
      message:
        scenario === "timeout"
          ? "模拟等待 15 秒后展示固定模板，非真实 AI 结果。"
          : "当前为模拟降级状态，展示固定模板。",
    };
  }
  return { status: "success", data, message: "" };
}
