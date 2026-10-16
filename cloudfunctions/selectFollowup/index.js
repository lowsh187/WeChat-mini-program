const cloud = require("wx-server-sdk");
const {
  errorResponse,
  findFollowupQuestion,
  selectFollowupQuestion,
  sha256,
  successResponse,
  validateSelectFollowupInput,
} = require("./logic");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const database = cloud.database();
const command = database.command;

exports.main = async (event) => {
  const validation = validateSelectFollowupInput(event);
  if (!validation.ok) return errorResponse("INVALID_ARGUMENT", validation.error);

  const context = cloud.getWXContext();
  if (!context.APPID || !context.OPENID) {
    return errorResponse("UNKNOWN_ERROR", "暂时无法选择追问题，请稍后重试。", true);
  }

  const input = validation.value;
  const now = new Date();
  const ownerKeyHash = sha256(`${context.APPID}:${context.OPENID}`);

  try {
    const result = await database
      .collection("sessions")
      .where({
        sessionId: input.sessionId,
        ownerKeyHash,
        expiresAt: command.gt(now),
      })
      .limit(1)
      .get();

    if (result.data.length === 0) {
      return errorResponse("SESSION_EXPIRED", "会话不存在或已过期，请重新开始。", false);
    }

    const session = result.data[0];
    const selectedQuestionIds = Array.isArray(session.selectedFollowupQuestionIds)
      ? session.selectedFollowupQuestionIds
      : [];

    if (input.round <= session.followupRound) {
      const previousQuestion = findFollowupQuestion(
        selectedQuestionIds[input.round - 1],
        input.round,
      );
      return previousQuestion
        ? successResponse(previousQuestion)
        : errorResponse("INVALID_ARGUMENT", "该轮追问已经完成。", false);
    }
    if (input.round !== session.followupRound + 1) {
      return errorResponse("INVALID_ARGUMENT", "追问轮次必须按顺序进行。", false);
    }

    const question = selectFollowupQuestion({
      ...input,
      answeredQuestionIds: [...new Set([...input.answeredQuestionIds, ...selectedQuestionIds])],
    });
    if (!question) {
      return errorResponse("INVALID_ARGUMENT", "固定追问题库中没有可用题目。", false);
    }

    await database
      .collection("sessions")
      .doc(session._id)
      .update({
        data: {
          status: "profiling",
          currentStep: `followup_round_${input.round}`,
          followupRound: input.round,
          selectedFollowupQuestionIds: command.push([question.questionId]),
          updatedAt: now,
        },
      });

    return successResponse(question);
  } catch (error) {
    console.error("selectFollowup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode:
        typeof error === "object" && error !== null && "errCode" in error
          ? String(error.errCode)
          : "UNKNOWN",
    });
    return errorResponse("UNKNOWN_ERROR", "暂时无法选择追问题，请稍后重试。", true);
  }
};
