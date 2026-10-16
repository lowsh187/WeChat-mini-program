import type { CapabilityObservation } from "../../shared/contracts.v2";
import { object } from "../services/cloud-adapter";
export const dimensions = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
] as const;
const labels = ["信息提炼", "逻辑分析", "用户洞察", "表达沟通", "执行规划", "创意发散"];
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
export function validObservations(value: unknown): value is CapabilityObservation[] {
  if (
    !Array.isArray(value) ||
    value.length > 6 ||
    new Set(value.map((item: unknown) => (object(item) ? item.dimension : ""))).size !==
      value.length
  )
    return false;
  return value.every((item: unknown) => {
    if (
      !object(item) ||
      !dimensions.some((dimension) => dimension === item.dimension) ||
      item.maxScore !== 5 ||
      !Array.isArray(item.evidence)
    )
      return false;
    if (item.status === "observed")
      return (
        typeof item.score === "number" &&
        Number.isFinite(item.score) &&
        item.score >= 0 &&
        item.score <= 5 &&
        item.evidence.length > 0 &&
        item.evidence.length <= 8 &&
        item.evidence.every(nonempty) &&
        nonempty(item.improvement)
      );
    return (
      (item.status === "not_observed" || item.status === "unavailable") &&
      item.score === null &&
      item.evidence.length === 0 &&
      nonempty(item.reason)
    );
  });
}
export function observationCards(value: unknown) {
  if (!validObservations(value)) throw new Error("能力观察数据未通过校验");
  return dimensions.map((dimension, index) => {
    const item = value.find((observation) => observation.dimension === dimension);
    return {
      label: labels[index] || dimension,
      performance:
        item?.status === "observed"
          ? `当前任务表现 ${item.score}/5`
          : item?.status === "unavailable"
            ? "暂未获得评价，不计作 0 分"
            : "本任务未观察，不作能力判断",
      evidence:
        item?.status === "observed" ? item.evidence.join("；") : item?.reason || "没有有效行为证据",
      improvement: item?.status === "observed" ? item.improvement : "可通过后续实验补充观察。",
    };
  });
}
