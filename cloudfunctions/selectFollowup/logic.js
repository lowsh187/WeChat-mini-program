const { createHash } = require("node:crypto");

const CONTRACT_VERSION = "1.0.0";
const CONFIG_VERSION = "1.0.0";

const DIMENSIONS = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
];

// 建议配置：题目来自固定题库，不允许模型临时生成。文案仍需成员 A 复核。
const FOLLOWUP_QUESTIONS = [
  {
    questionId: "followup_information_01",
    dimension: "information_extraction",
    questionText: "请举例说明：面对信息较多的任务时，你会怎样找出最重要的三条信息？",
  },
  {
    questionId: "followup_information_02",
    dimension: "information_extraction",
    questionText: "如果材料里同时存在事实、观点和猜测，你会怎样区分并使用它们？",
  },
  {
    questionId: "followup_logic_01",
    dimension: "logical_analysis",
    questionText: "当两个可能原因都说得通时，你会用什么证据判断哪一个更可信？",
  },
  {
    questionId: "followup_logic_02",
    dimension: "logical_analysis",
    questionText: "请描述一次你发现原先判断有误，并据此调整方案的经历。",
  },
  {
    questionId: "followup_user_01",
    dimension: "user_insight",
    questionText: "当用户表达得很模糊时，你通常如何确认他真正想解决的问题？",
  },
  {
    questionId: "followup_user_02",
    dimension: "user_insight",
    questionText: "如果不同用户提出相反需求，你会怎样决定先验证哪一类需求？",
  },
  {
    questionId: "followup_communication_01",
    dimension: "communication",
    questionText: "请举例说明你会怎样向不了解背景的人解释一个复杂问题。",
  },
  {
    questionId: "followup_communication_02",
    dimension: "communication",
    questionText: "当团队成员不同意你的结论时，你会如何组织下一次沟通？",
  },
  {
    questionId: "followup_execution_01",
    dimension: "execution_planning",
    questionText: "任务时间缩短一半时，你会保留什么、放弃什么，并如何安排顺序？",
  },
  {
    questionId: "followup_execution_02",
    dimension: "execution_planning",
    questionText: "面对一个目标明确但路径未知的任务，你会怎样拆出第一天的行动？",
  },
  {
    questionId: "followup_creative_01",
    dimension: "creative_ideation",
    questionText: "请举例说明你如何在常规方案之外提出一个不同方向。",
  },
  {
    questionId: "followup_creative_02",
    dimension: "creative_ideation",
    questionText: "当第一个创意不可行时，你会用什么方法产生新的备选方案？",
  },
];

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSelectFollowupInput(input) {
  if (!isPlainObject(input)) return { ok: false, error: "请求体必须是对象。" };

  const { sessionId, round, answeredQuestionIds, evidenceByDimension } = input;
  if (typeof sessionId !== "string" || !/^ses_[a-f0-9]{32}$/u.test(sessionId)) {
    return { ok: false, error: "sessionId 格式不正确。" };
  }
  if (round !== 1 && round !== 2) {
    return { ok: false, error: "round 只能是 1 或 2。" };
  }
  if (
    !Array.isArray(answeredQuestionIds) ||
    answeredQuestionIds.length > 32 ||
    answeredQuestionIds.some((id) => typeof id !== "string" || id.length < 1 || id.length > 64)
  ) {
    return { ok: false, error: "answeredQuestionIds 格式不正确。" };
  }
  if (!isPlainObject(evidenceByDimension)) {
    return { ok: false, error: "evidenceByDimension 必须是对象。" };
  }

  for (const [dimension, evidence] of Object.entries(evidenceByDimension)) {
    if (!DIMENSIONS.includes(dimension)) {
      return { ok: false, error: "evidenceByDimension 包含未知能力维度。" };
    }
    if (
      !Array.isArray(evidence) ||
      evidence.length > 8 ||
      evidence.some((item) => typeof item !== "string" || item.length > 500)
    ) {
      return { ok: false, error: "维度证据必须是最多 8 条、每条不超过 500 字的字符串。" };
    }
  }

  return {
    ok: true,
    value: { sessionId, round, answeredQuestionIds, evidenceByDimension },
  };
}

function selectFollowupQuestion(input) {
  const answered = new Set(input.answeredQuestionIds);
  const rankedDimensions = DIMENSIONS.map((dimension, order) => ({
    dimension,
    evidenceCount: input.evidenceByDimension[dimension]?.filter(Boolean).length ?? 0,
    order,
  })).sort((left, right) => left.evidenceCount - right.evidenceCount || left.order - right.order);

  for (const { dimension } of rankedDimensions) {
    const question = FOLLOWUP_QUESTIONS.find(
      (candidate) => candidate.dimension === dimension && !answered.has(candidate.questionId),
    );
    if (question) {
      return {
        round: input.round,
        dimension: question.dimension,
        questionId: question.questionId,
        questionText: question.questionText,
      };
    }
  }

  return null;
}

function findFollowupQuestion(questionId, round) {
  const question = FOLLOWUP_QUESTIONS.find((candidate) => candidate.questionId === questionId);
  if (!question) return null;
  return {
    round,
    dimension: question.dimension,
    questionId: question.questionId,
    questionText: question.questionText,
  };
}

function successResponse(data) {
  return {
    status: "success",
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    data,
    error: null,
    aiGenerated: false,
  };
}

function errorResponse(code, message, retryable = false) {
  return {
    status: "error",
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    data: null,
    error: { code, message, retryable },
    aiGenerated: false,
  };
}

module.exports = {
  DIMENSIONS,
  FOLLOWUP_QUESTIONS,
  errorResponse,
  findFollowupQuestion,
  selectFollowupQuestion,
  sha256,
  successResponse,
  validateSelectFollowupInput,
};
