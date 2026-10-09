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

const INITIAL_WEIGHTS = Object.freeze({ base: 0.4, preference: 0.3, followup: 0.3 });

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function assertScore(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 5) {
    throw new TypeError(`${label} 必须是 0～5 的有限数字。`);
  }
}

function calculateBaseDimensionScores(baseAnswers, questions) {
  if (!isPlainObject(baseAnswers) || !Array.isArray(questions)) {
    throw new TypeError("基础题答案和题库格式不正确。");
  }

  const totals = Object.fromEntries(
    CAPABILITY_DIMENSIONS.map((dimension) => [dimension, { total: 0, count: 0, evidence: [] }]),
  );

  for (const question of questions) {
    const selectedOptionId = baseAnswers[question.questionId];
    if (typeof selectedOptionId !== "string") {
      throw new TypeError(`缺少基础题答案：${question.questionId}。`);
    }
    const option = question.options?.find((candidate) => candidate.optionId === selectedOptionId);
    if (!option) throw new TypeError(`基础题 ${question.questionId} 包含未知选项。`);

    for (const [dimension, score] of Object.entries(option.capabilityScores ?? {})) {
      if (!CAPABILITY_DIMENSIONS.includes(dimension)) {
        throw new TypeError(`基础题配置包含未知能力维度：${dimension}。`);
      }
      assertScore(score, `${question.questionId}.${dimension}`);
      totals[dimension].total += score;
      totals[dimension].count += 1;
      totals[dimension].evidence.push(`${question.prompt}：${option.label}`);
    }
  }

  return Object.fromEntries(
    CAPABILITY_DIMENSIONS.map((dimension) => {
      const entry = totals[dimension];
      return [
        dimension,
        {
          score: entry.count === 0 ? 0 : round(entry.total / entry.count),
          evidence: entry.evidence,
        },
      ];
    }),
  );
}

function validateCapabilityMapping(mapping) {
  if (!isPlainObject(mapping)) return { ok: false, error: "能力映射必须是对象。" };
  const normalized = {};

  for (const dimension of CAPABILITY_DIMENSIONS) {
    const item = mapping[dimension];
    if (!isPlainObject(item)) return { ok: false, error: `缺少能力维度：${dimension}。` };
    try {
      assertScore(item.score, `${dimension}.score`);
    } catch (error) {
      return { ok: false, error: error.message };
    }
    if (
      !Array.isArray(item.evidence) ||
      item.evidence.length === 0 ||
      item.evidence.length > 8 ||
      item.evidence.some(
        (evidence) =>
          typeof evidence !== "string" || evidence.trim().length === 0 || evidence.length > 500,
      )
    ) {
      return { ok: false, error: `${dimension}.evidence 必须包含 1～8 条非空证据。` };
    }
    normalized[dimension] = {
      score: round(item.score),
      evidence: item.evidence.map((evidence) => evidence.trim()),
    };
  }

  if (Object.keys(mapping).some((dimension) => !CAPABILITY_DIMENSIONS.includes(dimension))) {
    return { ok: false, error: "能力映射包含未知维度。" };
  }
  return { ok: true, value: normalized };
}

function combineInitialCapabilityScores({ base, preference, followup }) {
  const validated = {};
  for (const [name, mapping] of Object.entries({ base, preference, followup })) {
    const result = validateCapabilityMapping(mapping);
    if (!result.ok) throw new TypeError(`${name}: ${result.error}`);
    validated[name] = result.value;
  }

  return Object.fromEntries(
    CAPABILITY_DIMENSIONS.map((dimension) => [
      dimension,
      {
        score: round(
          validated.base[dimension].score * INITIAL_WEIGHTS.base +
            validated.preference[dimension].score * INITIAL_WEIGHTS.preference +
            validated.followup[dimension].score * INITIAL_WEIGHTS.followup,
        ),
        evidence: [
          ...validated.base[dimension].evidence,
          ...validated.preference[dimension].evidence,
          ...validated.followup[dimension].evidence,
        ].slice(0, 8),
      },
    ]),
  );
}

function rankRoles(capabilityMapping, roles, limit = 3) {
  const validation = validateCapabilityMapping(capabilityMapping);
  if (!validation.ok) throw new TypeError(validation.error);
  if (!Array.isArray(roles) || roles.length < limit || limit < 1) {
    throw new TypeError("岗位配置数量不足。");
  }

  return roles
    .map((role) => {
      const entries = Object.entries(role.capabilityWeights ?? {});
      const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (
        entries.length !== CAPABILITY_DIMENSIONS.length ||
        entries.some(
          ([dimension, weight]) =>
            !CAPABILITY_DIMENSIONS.includes(dimension) || typeof weight !== "number" || weight < 0,
        ) ||
        totalWeight !== 100
      ) {
        throw new TypeError(`岗位 ${role.roleId} 的能力权重必须覆盖六维且合计 100。`);
      }

      const contributions = entries.map(([dimension, weight]) => ({
        dimension,
        contribution: (validation.value[dimension].score / 5) * weight,
      }));
      return {
        roleId: role.roleId,
        score: round(
          contributions.reduce((sum, item) => sum + item.contribution, 0),
          1,
        ),
        reasons: contributions
          .sort((left, right) => right.contribution - left.contribution)
          .slice(0, 2)
          .map(
            ({ dimension }) =>
              `${DIMENSION_LABELS[dimension]} ${validation.value[dimension].score.toFixed(1)}/5，与该岗位重点能力匹配。`,
          ),
      };
    })
    .sort((left, right) => right.score - left.score || left.roleId.localeCompare(right.roleId))
    .slice(0, limit);
}

module.exports = {
  CAPABILITY_DIMENSIONS,
  DIMENSION_LABELS,
  INITIAL_WEIGHTS,
  calculateBaseDimensionScores,
  combineInitialCapabilityScores,
  rankRoles,
  validateCapabilityMapping,
};
