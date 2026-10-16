const { CAPABILITY_DIMENSIONS, rankRoles, validateCapabilityMapping } = require("./recommendation");

const POST_TRIAL_WEIGHTS = Object.freeze({ initial: 0.45, trial: 0.55 });

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validateTrialScores(scores, rubricDimensions) {
  if (
    !Array.isArray(scores) ||
    !Array.isArray(rubricDimensions) ||
    rubricDimensions.length === 0 ||
    rubricDimensions.some((dimension) => !CAPABILITY_DIMENSIONS.includes(dimension))
  ) {
    return { ok: false, error: "Rubric 必须包含至少一个已知能力维度。" };
  }
  const expected = new Set(rubricDimensions);
  if (expected.size !== rubricDimensions.length || scores.length !== expected.size) {
    return { ok: false, error: "AI 评分必须与 Rubric 维度一一对应。" };
  }
  const seen = new Set();
  for (const item of scores) {
    if (
      !item ||
      !expected.has(item.dimension) ||
      seen.has(item.dimension) ||
      typeof item.score !== "number" ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 5 ||
      item.maxScore !== 5 ||
      typeof item.evidence !== "string" ||
      item.evidence.trim().length === 0 ||
      item.evidence.length > 500 ||
      typeof item.improvement !== "string" ||
      item.improvement.trim().length === 0 ||
      item.improvement.length > 500
    ) {
      return { ok: false, error: "AI 评分包含未知维度、越界分数或空证据。" };
    }
    seen.add(item.dimension);
  }
  return { ok: true, value: scores };
}

function combinePostTrialScores(initial, trial) {
  const initialValidation = validateCapabilityMapping(initial);
  const trialValidation = validateCapabilityMapping(trial);
  if (!initialValidation.ok) throw new TypeError(`initial: ${initialValidation.error}`);
  if (!trialValidation.ok) throw new TypeError(`trial: ${trialValidation.error}`);

  return Object.fromEntries(
    CAPABILITY_DIMENSIONS.map((dimension) => [
      dimension,
      {
        score: round(
          initialValidation.value[dimension].score * POST_TRIAL_WEIGHTS.initial +
            trialValidation.value[dimension].score * POST_TRIAL_WEIGHTS.trial,
        ),
        evidence: [
          ...initialValidation.value[dimension].evidence,
          ...trialValidation.value[dimension].evidence,
        ].slice(-8),
      },
    ]),
  );
}

function recomputeRecommendations({ initial, trial, roles }) {
  const combined = combinePostTrialScores(initial, trial);
  return { combined, recommendations: rankRoles(combined, roles) };
}

function createDegradedTrialScores(rubricDimensions) {
  return rubricDimensions.map((dimension) => ({
    dimension,
    score: 0,
    maxScore: 5,
    evidence: "未评分：自动评分暂不可用，本项没有生成有效行为证据。",
    improvement: "请稍后重试，或先保留回答等待重新评分。",
  }));
}

async function runWithTimeoutAndRetry(operation, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const retries = options.retries ?? 1;
  if (typeof operation !== "function" || timeoutMs <= 0 || retries < 0 || retries > 1) {
    throw new TypeError("超时或重试配置不合法。只能安全重试一次。");
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => operation(attempt)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("AI_TIMEOUT")), timeoutMs);
        }),
      ]);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

module.exports = {
  POST_TRIAL_WEIGHTS,
  combinePostTrialScores,
  createDegradedTrialScores,
  recomputeRecommendations,
  runWithTimeoutAndRetry,
  validateTrialScores,
};
