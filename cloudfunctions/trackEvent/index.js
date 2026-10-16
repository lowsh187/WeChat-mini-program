const cloud = require("wx-server-sdk");
const { response, sha256, validateInput } = require("./logic");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const database = cloud.database();

exports.main = async (event) => {
  const validation = validateInput(event);
  if (!validation.ok) {
    return response("error", null, {
      code: "INVALID_ARGUMENT",
      message: validation.error,
      retryable: false,
    });
  }
  const context = cloud.getWXContext();
  if (!context.APPID || !context.OPENID) {
    return response("error", null, {
      code: "UNKNOWN_ERROR",
      message: "暂时无法记录事件。",
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
      .collection("events")
      .where({ sessionId: input.sessionId, eventId: input.eventId })
      .limit(1)
      .get();
    if (existing.data.length > 0) return response("success", { accepted: true });
    await database.collection("events").add({
      data: {
        ...input,
        clientVersion: sessionResult.data[0].clientVersion,
        createdAt: now,
        updatedAt: now,
      },
    });
    return response("success", { accepted: true });
  } catch (error) {
    console.error("trackEvent failed", {
      errorCode:
        error && typeof error === "object" && "errCode" in error
          ? String(error.errCode)
          : "UNKNOWN",
    });
    return response("error", null, {
      code: "UNKNOWN_ERROR",
      message: "暂时无法记录事件。",
      retryable: true,
    });
  }
};
