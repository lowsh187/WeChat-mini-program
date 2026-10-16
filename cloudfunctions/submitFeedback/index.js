const cloud = require("wx-server-sdk");
const { response, sha256, validateInput } = require("./logic");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const database = cloud.database();

exports.main = async (event) => {
  const validation = validateInput(event);
  if (!validation.ok) {
    return response("error", null, {
      code: validation.code ?? "INVALID_ARGUMENT",
      message: validation.error,
      retryable: false,
    });
  }
  const context = cloud.getWXContext();
  if (!context.APPID || !context.OPENID) {
    return response("error", null, {
      code: "UNKNOWN_ERROR",
      message: "暂时无法提交反馈，请稍后重试。",
      retryable: true,
    });
  }

  try {
    const input = validation.value;
    const ownerKeyHash = sha256(`${context.APPID}:${context.OPENID}`);
    const sessionResult = await database
      .collection("sessions")
      .where({ sessionId: input.sessionId, ownerKeyHash })
      .limit(1)
      .get();
    if (sessionResult.data.length === 0) {
      return response("error", null, {
        code: "SESSION_EXPIRED",
        message: "会话不存在或已失效。",
        retryable: false,
      });
    }

    const now = new Date();
    const existing = await database
      .collection("feedback")
      .where({ sessionId: input.sessionId })
      .limit(1)
      .get();
    const feedbackRecord = { ...input, updatedAt: now };
    if (existing.data.length > 0) {
      await database.collection("feedback").doc(existing.data[0]._id).update({
        data: feedbackRecord,
      });
    } else {
      await database.collection("feedback").add({
        data: { ...feedbackRecord, createdAt: now },
      });
    }
    return response("success", { accepted: true });
  } catch (error) {
    console.error("submitFeedback failed", {
      errorCode:
        error && typeof error === "object" && "errCode" in error
          ? String(error.errCode)
          : "UNKNOWN",
    });
    return response("error", null, {
      code: "UNKNOWN_ERROR",
      message: "暂时无法提交反馈，请稍后重试。",
      retryable: true,
    });
  }
};
