const CAPABILITY_DIMENSIONS = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
];
const DIMENSION_LABELS = {
  information_extraction: "信息提炼",
  logical_analysis: "逻辑分析",
  user_insight: "用户洞察",
  communication: "表达沟通",
  execution_planning: "执行规划",
  creative_ideation: "创意发散",
};
const ROLE_IDS = [
  "data_analyst",
  "product_operations",
  "user_researcher",
  "product_manager",
  "project_manager",
  "content_strategist",
];
const ROLE_LABELS = {
  data_analyst: "数据分析",
  product_operations: "产品运营",
  user_researcher: "用户研究",
  product_manager: "产品经理",
  project_manager: "项目管理",
  content_strategist: "内容策划",
};

function validateGaps(gaps) {
  if (!Array.isArray(gaps) || gaps.length === 0 || gaps.length > 6) {
    return { ok: false, error: "gaps 必须包含 1～6 个能力项。" };
  }
  const seen = new Set();
  for (const gap of gaps) {
    if (
      !gap ||
      !CAPABILITY_DIMENSIONS.includes(gap.dimension) ||
      seen.has(gap.dimension) ||
      typeof gap.score !== "number" ||
      gap.score < 0 ||
      gap.score > 5
    ) {
      return { ok: false, error: "gaps 包含未知、重复或越界能力项。" };
    }
    seen.add(gap.dimension);
  }
  return { ok: true, value: [...gaps].sort((left, right) => left.score - right.score) };
}

function buildActionPlan({ roleId, gaps, preferenceNote }) {
  if (!ROLE_IDS.includes(roleId)) throw new TypeError("roleId 不在固定岗位列表中。");
  const validation = validateGaps(gaps);
  if (!validation.ok) throw new TypeError(validation.error);
  const primary = validation.value[0].dimension;
  const secondary = validation.value[1]?.dimension ?? primary;
  const primaryLabel = DIMENSION_LABELS[primary];
  const secondaryLabel = DIMENSION_LABELS[secondary];
  const roleLabel = ROLE_LABELS[roleId];
  const items = [
    ["建立观察基线", `记录一次与${primaryLabel}有关的真实任务，写下目标、过程和结果。`],
    ["拆解优秀案例", `找一个${roleLabel}相关案例，标记其中体现${primaryLabel}的三个细节。`],
    ["完成微型练习", `用 20 分钟完成一个${primaryLabel}小练习，并保留过程证据。`],
    ["获取外部反馈", `请一位同学按“清楚/具体/可执行”评价你的${primaryLabel}练习。`],
    ["补强第二能力", `完成一次同时使用${primaryLabel}和${secondaryLabel}的小任务。`],
    ["模拟岗位交付", `按真实工作格式整理一份与${roleLabel}相关的一页交付物。`],
    ["复盘职业实验", "比较第 1 天与第 6 天的证据，决定是否继续探索该岗位。"],
  ];
  return {
    roleId,
    items: items.map(([title, description], index) => ({
      day: index + 1,
      title,
      description,
      completed: false,
    })),
    personalizedSuggestion: preferenceNote
      ? `结合你的偏好“${preferenceNote}”，优先选择容易获得真实反馈的练习场景。`
      : `优先通过小任务验证${primaryLabel}，不要把推荐结果当作职业定论。`,
  };
}

module.exports = { ROLE_IDS, ROLE_LABELS, buildActionPlan, validateGaps };
