import { navigate, routes } from "../../utils/navigation";
import { sessionStore } from "../../store/session";
import type { TrialResultView } from "../../models/frontend";
import { dimensionLabels, mockComparison } from "../../mocks/next-steps";
import { observationCards } from "../../models/observations";
import { backendContent } from "../../config/backend-content";

const roleName = (roleId: string) =>
  backendContent.roles.find((role) => role.roleId === roleId)?.name || roleId;

Page({
  data: {
    result: null as TrialResultView | null,
    degraded: false,
    message: "",
    warning: "",
    comparison: null as ReturnType<typeof mockComparison> | null,
    practicePriorities: [] as { title: string; reason: string; suggestion: string }[],
    dimensions: [] as {
      label: string;
      performance: string;
      evidence: string;
      improvement: string;
    }[],
  },
  onShow() {
    const { session, warning } = sessionStore.snapshot();
    const trial = session?.trial;
    const result = trial?.completed && trial.result ? trial.result : null;
    this.setData({
      comparison:
        result?.source === "mock"
          ? mockComparison(result, trial?.resultStatus === "degraded")
          : result
            ? {
                before: (result.recommendationsBefore || []).map((id, index) => ({
                  name: roleName(id),
                  rank: index + 1,
                })),
                after: (result.recommendationsAfter || []).map((id, index) => {
                  const previous = (result.recommendationsBefore || []).indexOf(id);
                  return {
                    name: roleName(id),
                    rank: index + 1,
                    change:
                      previous === index
                        ? "顺序未变"
                        : previous > index
                          ? `上升 ${previous - index} 位`
                          : `下降 ${index - previous} 位`,
                  };
                }),
                explanation: (result.changeExplanation || []).join("；"),
                evidence: result.evidence[0]?.exampleEvidence || "本次没有有效评分证据",
              }
            : null,
      practicePriorities: result?.practicePriorities
        ? result.practicePriorities
        : result
          ? result.evidence.slice(0, 2).map((item) => ({
              title: item.dimensionLabel,
              reason: item.exampleEvidence,
              suggestion: item.improvement,
            }))
          : [],
      dimensions: result?.observations
        ? observationCards(result.observations)
        : result
          ? dimensionLabels.map((label) => {
              const example = result.evidence.find((item) => item.dimensionLabel === label);
              return {
                label,
                performance: example?.examplePerformance || "本任务未覆盖，暂无能力表现依据",
                evidence: example?.exampleEvidence || "无示例证据，不作能力判断",
                improvement:
                  example?.improvement || "可通过后续职业实验补充观察，不据此判定能力高低。",
              };
            })
          : [],
    });
    this.setData({
      result,
      degraded: trial?.resultStatus === "degraded",
      message: trial?.message || "",
      warning,
    });
  },
  trial() {
    navigate(`${routes.workTrial}?resume=1`);
  },
  recommendation() {
    navigate(routes.initialResult);
  },
  plan() {
    navigate(routes.actionPlan);
  },
  retrySave() {
    sessionStore.retrySave();
    this.setData({ warning: sessionStore.snapshot().warning });
  },
  home() {
    navigate(routes.home);
  },
});
