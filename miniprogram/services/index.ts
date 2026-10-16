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

// Page-facing adapter, not a backend request contract. No answers leave the device.
export const frontendService = {
  async getActionPlan(roleName: string, scenario: MockScenario = "normal") {
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
    // Mock fixture provider never uploads or evaluates request.answers.
    return submitMockTrial(localTrialId, scenario);
  },
  getFollowup(round: number, scenario: MockScenario = "normal") {
    return getMockFollowup(round, scenario);
  },
  getInitialRecommendation(scenario: MockScenario = "normal") {
    return getMockInitialRecommendation(scenario);
  },
};
