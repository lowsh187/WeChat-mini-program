import type { ActionPlanView, TrialResultView } from "../models/frontend";
import { createMockRecommendation } from "./initial-recommendation";

export const dimensionLabels = [
  "信息提炼",
  "逻辑分析",
  "用户洞察",
  "表达沟通",
  "执行规划",
  "创意发散",
];

// Explicit scripts, not calculated recommendations, scores or weights.
const scripts: Record<string, string[]> = {
  数据分析: ["ui-data", "ui-operations", "ui-research"],
  产品运营: ["ui-operations", "ui-data", "ui-research"],
  用户研究: ["ui-research", "ui-data", "ui-operations"],
};
export function mockComparison(result: TrialResultView, unavailable = false) {
  const cards = createMockRecommendation().cards;
  const order = unavailable
    ? cards.map((card) => card.localId)
    : scripts[result.roleName] || cards.map((card) => card.localId);
  return {
    before: cards.map((card, index) => ({ name: card.name, rank: index + 1 })),
    after: order.map((id, index) => {
      const previous = cards.findIndex((card) => card.localId === id);
      const card = cards[previous];
      if (!card) throw new Error("Unknown fixed role");
      return {
        name: card.name,
        rank: index + 1,
        change:
          previous === index
            ? "顺序未变"
            : previous > index
              ? `上升 ${previous - index} 位`
              : `下降 ${index - previous} 位`,
      };
    }),
    explanation: unavailable
      ? "模拟评分不可用：保留初步推荐，不把技术失败作为 0 分，不生成推荐下降。以下证据仅为固定示例。"
      : `固定演示脚本：${result.roleName}试岗使用预设顺序，展示“试岗后重新探索”的表达方式。没有分析你的回答，也没有计算分数或权重。`,
    evidence: result.evidence[0]?.exampleEvidence || "暂无示例证据",
  };
}

export function createMockPlan(roleName: string): ActionPlanView {
  const task =
    roleName === "数据分析"
      ? "用公开示例表格找出一个异常，写出两个可能原因和需补充的数据"
      : roleName === "产品运营"
        ? "为一个校园活动选择一个改进方案，写出验证指标与行动顺序"
        : "阅读五条虚构访谈记录，归纳共同需求并区分事实与假设";
  const tasks: [string, string][] = [
    ["观察岗位的一天", `了解${roleName}工作流程，记录三项日常任务与一个疑问。约 15 分钟。`],
    ["完成一个微任务", `${task}。约 20 分钟，不使用他人隐私数据。`],
    [
      "了解真实工作",
      "经对方同意，与一位从业者或学长聊三件事：日常任务、难点、入门建议。不记录身份与联系方式；无人可访时阅读公开访谈。",
    ],
    [
      "补充一项技能",
      `针对昨天发现的困难，学习一项${roleName}基础技能，用一个小例子练习。约 20 分钟。`,
    ],
    [
      "留下一个作品片段",
      "整理一页作品：问题、材料、判断、下一步。标注数据来源，不上传个人信息。约 20 分钟。",
    ],
    ["复盘真实感受", "记录喜欢与不喜欢的工作环节、一个困难和一个待验证假设。约 10 分钟。"],
    [
      "选择下一步实验",
      "比较第一天的想象和实际体验，选择继续探索或换一个方向，并写出下一步行动。约 10 分钟。",
    ],
  ];
  return {
    planId: `mock-plan-${roleName}-v2`,
    source: "mock",
    roleName,
    notice: "固定计划模板 · 非 AI 个性化计划；完成状态仅保存在本设备、当前会话中。",
    items: tasks.map(([title, description], index) => ({
      day: index + 1,
      title,
      description,
      completed: false,
    })),
  };
}
