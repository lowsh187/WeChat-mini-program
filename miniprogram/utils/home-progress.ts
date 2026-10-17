import type { LocalSession } from "../models/frontend";

/** Presentation only: reuse persisted milestones, never infer a score or result. */
export function homeProgress(session: LocalSession | null, total: number) {
  let step = 0;
  let status = "从认识自己开始";
  let detail = `${total} 道情境题，接着试做一份工作，收获探索方向与行动建议。`;
  let action = "继续探索";
  if (session) {
    status = "正在填写基础画像";
    detail = `情境题已答 ${Object.keys(session.answers).length} / ${total}，按自己的想法选择即可。`;
    if (session.stage !== "profile") {
      step = 1;
      status = "补充你的做法";
      detail = `追问已完成 ${session.followup?.submittedCount || 0} / 2 轮，简短回答即可。`;
    }
    if (session.stage === "initial-result" || session.stage === "work-trial") {
      step = session.stage === "work-trial" ? 3 : 2;
      status = session.stage === "work-trial" ? "试做一份真实工作" : "了解你的探索方向";
      detail = "查看三个岗位方向，选择一个完成 3～5 分钟职业实验。";
    }
    if (session.trial && !session.trial.completed && session.stage === "work-trial") {
      detail = "试岗回答已保留，继续完成小任务，再查看行为反馈。";
    }
    if (session.trial?.completed && session.trial.result) {
      step = 3;
      status = "试岗已完成";
      detail = "查看行为证据、推荐变化和接下来的练习建议。";
      action = "查看探索结果";
      if (session.actionPlan) {
        step = 4;
        const count = session.actionPlan.view.items.filter((item) => item.completed).length;
        status = "把探索变成行动";
        detail = `七天计划已完成 ${count} / ${session.actionPlan.view.items.length} 项，进度保存在本设备。`;
        action = "查看七天计划";
      }
    }
  }
  return {
    progressTitle: status,
    progressDetail: detail,
    continueLabel: action,
    progressSteps: ["画像", "追问", "推荐", "试岗", "行动"].map((label, index) => ({
      label,
      current: !!session && index === step,
      complete: !!session && index < step,
    })),
  };
}
