const { createHash } = require("node:crypto");

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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsContact(value) {
  return /(?:1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/u.test(value);
}

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

function validateInput(input, trial) {
  if (
    !isObject(input) ||
    typeof input.sessionId !== "string" ||
    !/^ses_[a-f0-9]{32}$/.test(input.sessionId) ||
    input.trialId !== trial?.trialId ||
    typeof input.trialAttemptId !== "string" ||
    !/^attempt_[A-Za-z0-9_-]{8,80}$/.test(input.trialAttemptId) ||
    !isObject(input.answers)
  )
    return { ok: false, error: "试岗请求格式不正确。" };
  const known = new Map(trial.questions.map((question) => [question.questionId, question]));
  if (Object.keys(input.answers).some((id) => !known.has(id)))
    return { ok: false, error: "包含未知题目。" };
  for (const question of trial.questions) {
    const answer = input.answers[question.questionId];
    if (question.required && (typeof answer !== "string" || !answer.trim()))
      return { ok: false, error: `缺少必答题：${question.questionId}。` };
    if (
      answer !== undefined &&
      (typeof answer !== "string" || answer.length > 1200 || containsContact(answer))
    )
      return {
        ok: false,
        error: `${question.questionId} 最多 1200 字，且不能包含手机号或邮箱。`,
      };
  }
  return {
    ok: true,
    value: {
      ...input,
      answers: Object.fromEntries(
        Object.entries(input.answers).map(([id, answer]) => [id, answer.trim()]),
      ),
    },
  };
}

function fingerprint(trialId, answers) {
  return createHash("sha256")
    .update(
      JSON.stringify([trialId, Object.entries(answers).sort(([a], [b]) => a.localeCompare(b))]),
    )
    .digest("hex");
}

function validateAiObservations(raw, rubricDimensions) {
  const items = raw?.observations;
  if (!Array.isArray(items) || items.length !== rubricDimensions.length) return { ok: false };
  const seen = new Set();
  for (const item of items) {
    if (!isObject(item) || !rubricDimensions.includes(item.dimension) || seen.has(item.dimension))
      return { ok: false };
    seen.add(item.dimension);
    if (item.status === "observed") {
      if (
        !Number.isFinite(item.score) ||
        item.score < 0 ||
        item.score > 5 ||
        item.maxScore !== 5 ||
        !Array.isArray(item.evidence) ||
        item.evidence.length < 1 ||
        item.evidence.length > 6 ||
        item.evidence.some(
          (text) => typeof text !== "string" || !text.trim() || text.length > 500,
        ) ||
        typeof item.improvement !== "string" ||
        !item.improvement.trim() ||
        item.improvement.length > 500
      )
        return { ok: false };
    } else if (
      !["not_observed", "unavailable"].includes(item.status) ||
      item.score !== null ||
      item.maxScore !== 5 ||
      !Array.isArray(item.evidence) ||
      item.evidence.length !== 0 ||
      typeof item.reason !== "string" ||
      !item.reason.trim()
    )
      return { ok: false };
  }
  return { ok: true, value: items };
}

function buildPrompt(trial, answers) {
  const safeAnswers = trial.questions.map((question) => ({
    questionId: question.questionId,
    required: question.required,
    answer: answers[question.questionId] || "",
  }));
  return {
    system:
      "你是职业探索练习的证据评分器。只根据回答中的可观察证据评分，不推断人格、就业成功率或未提供的信息。严格返回 JSON。",
    user: JSON.stringify({
      task: "按照 rubricDimensions 和 0-5 anchors 返回 observations。技术问题不得用 0 分代替；证据不足用 not_observed。",
      trialId: trial.trialId,
      rubricDimensions: trial.rubricDimensions,
      anchors: trial.anchors,
      answers: safeAnswers,
      output: { observations: "CapabilityObservation[]" },
    }),
  };
}

function unavailableObservations(dimensions, reason = "自动评分暂不可用，本次未产生有效观察。") {
  return dimensions.map((dimension) => ({
    dimension,
    status: "unavailable",
    score: null,
    maxScore: 5,
    evidence: [],
    reason,
  }));
}

function mergeWithInitial(initial, trial) {
  return DIMENSIONS.map((dimension) => {
    const before = initial.find((item) => item.dimension === dimension);
    const after = trial.find((item) => item.dimension === dimension);
    if (!after || after.status !== "observed")
      return (
        before || {
          dimension,
          status: "not_observed",
          score: null,
          maxScore: 5,
          evidence: [],
          reason: "尚无有效观察。",
        }
      );
    if (!before || before.status !== "observed") return after;
    return {
      dimension,
      status: "observed",
      score: Math.round((before.score * 0.45 + after.score * 0.55 + Number.EPSILON) * 100) / 100,
      maxScore: 5,
      evidence: [...new Set([...before.evidence, ...after.evidence])].slice(-8),
      improvement: after.improvement,
    };
  });
}

function rankRoles(observations, roles) {
  return roles
    .map((role) => {
      const observed = observations.filter((item) => item.status === "observed");
      const totalWeight = observed.reduce(
        (sum, item) => sum + role.capabilityWeights[item.dimension],
        0,
      );
      const score = totalWeight
        ? (observed.reduce(
            (sum, item) => sum + (item.score / 5) * role.capabilityWeights[item.dimension],
            0,
          ) /
            totalWeight) *
          100
        : 0;
      return {
        roleId: role.roleId,
        score: Math.round((score + Number.EPSILON) * 10) / 10,
        reasons: ["依据当前有效观察与岗位能力权重计算。", "未观察和不可用维度未作为 0 分参与。"],
      };
    })
    .sort((a, b) => b.score - a.score || a.roleId.localeCompare(b.roleId))
    .slice(0, 3);
}

async function runProvider(provider, prompt, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
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
  DIMENSIONS,
  buildPrompt,
  errorResponse,
  fingerprint,
  mergeWithInitial,
  rankRoles,
  response,
  runProvider,
  unavailableObservations,
  validateAiObservations,
  validateInput,
};
