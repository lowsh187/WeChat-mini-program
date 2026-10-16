const CONTRACT_VERSION = "2.0.0";
const CONFIG_VERSION = "2.0.0";
const DIMENSIONS = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
];
const PREFERENCES = ["facts", "people", "practice", "unsure"];
const PREFERENCE_MATRIX = {
  facts: {
    data_analyst: 5,
    product_operations: 2,
    user_researcher: 4,
    product_manager: 4,
    project_manager: 3,
    content_strategist: 2,
  },
  people: {
    data_analyst: 2,
    product_operations: 5,
    user_researcher: 5,
    product_manager: 4,
    project_manager: 4,
    content_strategist: 4,
  },
  practice: {
    data_analyst: 3,
    product_operations: 5,
    user_researcher: 3,
    product_manager: 4,
    project_manager: 5,
    content_strategist: 3,
  },
  unsure: {
    data_analyst: 3,
    product_operations: 3,
    user_researcher: 3,
    product_manager: 3,
    project_manager: 3,
    content_strategist: 3,
  },
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const containsContact = (value) => /(?:1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/u.test(value);
const round = (value, digits = 2) =>
  Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
function response(status, data, error = null, aiGenerated = false) {
  return {
    status,
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    data,
    error,
    aiGenerated,
  };
}
function errorResponse(code, message, retryable = false) {
  return response("error", null, { code, message, retryable });
}

function validateInput(input, questions) {
  if (
    !isObject(input) ||
    typeof input.sessionId !== "string" ||
    !/^ses_[a-f0-9]{32}$/.test(input.sessionId) ||
    !isObject(input.baseAnswers) ||
    !isObject(input.followupAnswers) ||
    !PREFERENCES.includes(input.preferredApproach)
  )
    return { ok: false, error: "初步推荐请求格式不正确。" };
  const base = questions.filter(({ questionType }) => questionType === "base");
  const followups = new Set(
    questions
      .filter(({ questionType }) => questionType === "followup")
      .map(({ questionId }) => questionId),
  );
  if (
    Object.keys(input.baseAnswers).length !== base.length ||
    Object.keys(input.baseAnswers).some(
      (id) => !base.some((question) => question.questionId === id),
    )
  )
    return { ok: false, error: "基础题答案必须完整且不能包含未知题目。" };
  for (const question of base) {
    if (
      !question.options?.some(({ optionId }) => optionId === input.baseAnswers[question.questionId])
    )
      return { ok: false, error: `基础题 ${question.questionId} 选项无效。` };
  }
  if (Object.keys(input.followupAnswers).some((id) => !followups.has(id)))
    return { ok: false, error: "追问回答包含未知题目。" };
  if (
    Object.values(input.followupAnswers).some(
      (answer) =>
        typeof answer !== "string" ||
        !answer.trim() ||
        answer.length > 1200 ||
        containsContact(answer),
    )
  )
    return { ok: false, error: "追问回答必须为 1～1200 字，且不能包含手机号或邮箱。" };
  return { ok: true, value: input };
}

function baseObservations(answers, questions) {
  const evidence = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, []]));
  for (const question of questions.filter(({ questionType }) => questionType === "base")) {
    const option = question.options.find(
      ({ optionId }) => optionId === answers[question.questionId],
    );
    for (const [dimension, score] of Object.entries(option.capabilityScores))
      evidence[dimension].push({ score, text: `${question.prompt}：${option.label}` });
  }
  return DIMENSIONS.map((dimension) => ({
    dimension,
    status: evidence[dimension].length ? "observed" : "not_observed",
    score: evidence[dimension].length
      ? round(
          evidence[dimension].reduce((sum, item) => sum + item.score, 0) /
            evidence[dimension].length,
        )
      : null,
    maxScore: 5,
    evidence: evidence[dimension].map(({ text }) => text),
    ...(evidence[dimension].length
      ? { improvement: "可通过后续试岗继续补充行为证据。" }
      : { reason: "基础题未覆盖该维度。" }),
  }));
}

function scoreRoles(observations, roles) {
  return Object.fromEntries(
    roles.map((role) => {
      const observed = observations.filter((item) => item.status === "observed");
      const weight = observed.reduce(
        (sum, item) => sum + role.capabilityWeights[item.dimension],
        0,
      );
      const value = weight
        ? (observed.reduce(
            (sum, item) => sum + (item.score / 5) * role.capabilityWeights[item.dimension],
            0,
          ) /
            weight) *
          100
        : 0;
      return [role.roleId, round(value, 1)];
    }),
  );
}

function combineRoleScores(base, preference, followup) {
  const degraded = !followup;
  const weights = degraded
    ? { base: 4 / 7, preference: 3 / 7, followup: 0 }
    : { base: 0.4, preference: 0.3, followup: 0.3 };
  return {
    degraded,
    weights,
    scores: Object.fromEntries(
      Object.keys(base).map((roleId) => [
        roleId,
        round(
          base[roleId] * weights.base +
            preference[roleId] * 20 * weights.preference +
            (followup?.[roleId] || 0) * weights.followup,
          1,
        ),
      ]),
    ),
  };
}

function rankRecommendations(combined, roles) {
  return roles
    .map((role) => ({
      roleId: role.roleId,
      score: combined.scores[role.roleId],
      reasons: [
        "基础题行为选择与岗位能力重点的匹配结果。",
        "偏好仅用于表达愿意尝试的工作方式，不代表能力高低。",
      ],
    }))
    .sort((a, b) => b.score - a.score || a.roleId.localeCompare(b.roleId))
    .slice(0, 3);
}

function buildFollowupPrompt(answers) {
  return {
    system:
      "你是职业探索练习的证据提取器。不得推断人格或就业概率，只根据回答提取六维能力的可观察证据。严格返回 JSON。",
    user: JSON.stringify({
      answers,
      dimensions: DIMENSIONS,
      output: {
        observations:
          "每个维度为 observed 或 not_observed；observed 需 0-5 score、maxScore=5、evidence[]、improvement；未观察 score=null、evidence=[]、reason",
      },
    }),
  };
}

function validateAiObservations(raw) {
  if (!Array.isArray(raw?.observations) || raw.observations.length !== DIMENSIONS.length)
    return { ok: false };
  const seen = new Set();
  for (const item of raw.observations) {
    if (!isObject(item) || !DIMENSIONS.includes(item.dimension) || seen.has(item.dimension))
      return { ok: false };
    seen.add(item.dimension);
    if (item.status === "observed") {
      if (
        !Number.isFinite(item.score) ||
        item.score < 0 ||
        item.score > 5 ||
        item.maxScore !== 5 ||
        !Array.isArray(item.evidence) ||
        !item.evidence.length ||
        item.evidence.some(
          (text) => typeof text !== "string" || !text.trim() || text.length > 500,
        ) ||
        typeof item.improvement !== "string" ||
        !item.improvement.trim()
      )
        return { ok: false };
    } else if (
      item.status !== "not_observed" ||
      item.score !== null ||
      item.maxScore !== 5 ||
      !Array.isArray(item.evidence) ||
      item.evidence.length ||
      typeof item.reason !== "string"
    )
      return { ok: false };
  }
  return { ok: true, value: raw.observations };
}

function mergeObservations(base, followup) {
  return base.map((baseItem) => {
    const next = followup?.find(({ dimension }) => dimension === baseItem.dimension);
    if (baseItem.status !== "observed") return next || baseItem;
    if (!next || next.status !== "observed") return baseItem;
    return {
      ...baseItem,
      score: round((baseItem.score + next.score) / 2),
      evidence: [...new Set([...baseItem.evidence, ...next.evidence])].slice(0, 8),
      improvement: next.improvement,
    };
  });
}

async function runProvider(provider, prompt) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await provider(prompt);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

module.exports = {
  CONFIG_VERSION,
  CONTRACT_VERSION,
  PREFERENCE_MATRIX,
  baseObservations,
  buildFollowupPrompt,
  combineRoleScores,
  errorResponse,
  mergeObservations,
  rankRecommendations,
  response,
  runProvider,
  scoreRoles,
  validateAiObservations,
  validateInput,
};
