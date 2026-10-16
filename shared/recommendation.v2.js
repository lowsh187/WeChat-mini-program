const crypto = require("node:crypto");

const FULL_WEIGHTS = Object.freeze({ base: 0.4, preference: 0.3, followup: 0.3 });
const DEGRADED_WEIGHTS = Object.freeze({ base: 4 / 7, preference: 3 / 7, followup: 0 });

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function scorePreference(preference, matrix) {
  const row = matrix?.[preference];
  if (
    !row ||
    Object.values(row).some((score) => !Number.isFinite(score) || score < 0 || score > 5)
  ) {
    throw new TypeError("偏好或偏好匹配矩阵不合法。");
  }
  return Object.fromEntries(
    Object.entries(row).map(([roleId, score]) => [roleId, round((score / 5) * 100, 1)]),
  );
}

function combineRoleComponents({ baseByRole, preferenceByRole, followupByRole = null }) {
  const degraded = followupByRole === null;
  const weights = degraded ? DEGRADED_WEIGHTS : FULL_WEIGHTS;
  const roleIds = Object.keys(baseByRole ?? {});
  if (roleIds.length === 0 || roleIds.some((roleId) => !(roleId in (preferenceByRole ?? {})))) {
    throw new TypeError("岗位分数组件不完整。");
  }
  const scores = Object.fromEntries(
    roleIds.map((roleId) => {
      const parts = [baseByRole[roleId], preferenceByRole[roleId]];
      if (!degraded) parts.push(followupByRole[roleId]);
      if (parts.some((score) => !Number.isFinite(score) || score < 0 || score > 100)) {
        throw new TypeError(`岗位 ${roleId} 的组件分数必须在 0～100。`);
      }
      return [
        roleId,
        round(
          baseByRole[roleId] * weights.base +
            preferenceByRole[roleId] * weights.preference +
            (followupByRole?.[roleId] ?? 0) * weights.followup,
          1,
        ),
      ];
    }),
  );
  return {
    status: degraded ? "degraded" : "success",
    scores,
    effectiveWeights: Object.fromEntries(
      Object.entries(weights).map(([name, value]) => [name, round(value)]),
    ),
    missingComponents: degraded ? ["followup"] : [],
    comparableToFullScore: !degraded,
  };
}

function mergeCapabilityObservations(rounds) {
  if (!Array.isArray(rounds)) throw new TypeError("观察轮次必须是数组。");
  const dimensions = new Set(rounds.flat().map(({ dimension }) => dimension));
  return [...dimensions].map((dimension) => {
    const items = rounds.flat().filter((item) => item.dimension === dimension);
    const observed = items.filter((item) => item.status === "observed");
    if (observed.length === 0) {
      const unavailable = items.some((item) => item.status === "unavailable");
      return {
        dimension,
        status: unavailable ? "unavailable" : "not_observed",
        score: null,
        maxScore: 5,
        evidence: [],
        reason: unavailable ? "评分服务不可用，未产生有效观察。" : "回答未提供足够证据。",
      };
    }
    if (observed.some(({ score }) => !Number.isFinite(score) || score < 0 || score > 5)) {
      throw new TypeError(`${dimension} 包含越界观察分数。`);
    }
    return {
      dimension,
      status: "observed",
      score: round(observed.reduce((sum, item) => sum + item.score, 0) / observed.length, 2),
      maxScore: 5,
      evidence: [...new Set(observed.flatMap(({ evidence }) => evidence))],
      improvement: observed.at(-1).improvement,
    };
  });
}

function validateTrialAnswers(request, trial) {
  if (
    !request ||
    request.trialId !== trial?.trialId ||
    typeof request.trialAttemptId !== "string"
  ) {
    return { ok: false, error: "试岗或尝试 ID 不合法。" };
  }
  const answers = request.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { ok: false, error: "answers 必须是逐题回答对象。" };
  }
  const known = new Map(trial.questions.map((question) => [question.questionId, question]));
  if (Object.keys(answers).some((id) => !known.has(id))) {
    return { ok: false, error: "answers 包含未知 questionId。" };
  }
  for (const question of trial.questions) {
    const answer = answers[question.questionId];
    if (question.required && (typeof answer !== "string" || answer.trim().length === 0)) {
      return { ok: false, error: `缺少必答题：${question.questionId}。` };
    }
    if (answer !== undefined && (typeof answer !== "string" || answer.length > 1200)) {
      return { ok: false, error: `${question.questionId} 最多 1200 字。` };
    }
  }
  return { ok: true };
}

function fingerprintTrialAnswers(trialId, answers) {
  const canonical = Object.entries(answers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, answer]) => [id, answer.trim()]);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([trialId, canonical]))
    .digest("hex");
}

function resolveAttemptReplay(existingFingerprint, incomingFingerprint) {
  if (!existingFingerprint) return "new";
  return existingFingerprint === incomingFingerprint ? "replay" : "conflict";
}

module.exports = {
  DEGRADED_WEIGHTS,
  FULL_WEIGHTS,
  combineRoleComponents,
  fingerprintTrialAnswers,
  mergeCapabilityObservations,
  resolveAttemptReplay,
  scorePreference,
  validateTrialAnswers,
};
