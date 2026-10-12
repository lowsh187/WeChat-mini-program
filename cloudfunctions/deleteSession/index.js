const cloud = require("wx-server-sdk");
const { response, safeHashEqual, sha256, validateInput } = require("./logic");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const database = cloud.database();
const RELATED_COLLECTIONS = ["assessments", "action_plans", "feedback", "events"];

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
      message: "暂时无法删除会话。",
      retryable: true,
    });
  }
  try {
    const input = validation.value;
    const ownerKeyHash = sha256(`${context.APPID}:${context.OPENID}`);
    const result = await database
      .collection("sessions")
      .where({ sessionId: input.sessionId, ownerKeyHash })
      .limit(1)
      .get();
    const session = result.data[0];
    if (!session || !safeHashEqual(session.deletionTokenHash, sha256(input.confirmationToken))) {
      return response("error", null, {
        code: "INVALID_ARGUMENT",
        message: "删除凭据无效。",
        retryable: false,
      });
    }

    for (const collection of RELATED_COLLECTIONS) {
      await database.collection(collection).where({ sessionId: input.sessionId }).remove();
    }
    await database.collection("sessions").doc(session._id).remove();
    return response("success", { accepted: true });
  } catch (error) {
    console.error("deleteSession failed", {
      errorCode:
        error && typeof error === "object" && "errCode" in error
          ? String(error.errCode)
          : "UNKNOWN",
    });
    return response("error", null, {
      code: "UNKNOWN_ERROR",
      message: "暂时无法删除会话。",
      retryable: true,
    });
  }
};
