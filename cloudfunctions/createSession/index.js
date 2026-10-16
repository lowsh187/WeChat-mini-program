const cloud = require("wx-server-sdk");
const {
  createSessionPayload,
  errorResponse,
  successResponse,
  validateCreateSessionInput,
} = require("./logic");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const database = cloud.database();

exports.main = async (event) => {
  const validation = validateCreateSessionInput(event);
  if (!validation.ok) {
    return errorResponse("INVALID_ARGUMENT", validation.error);
  }

  const context = cloud.getWXContext();
  if (!context.APPID || !context.OPENID) {
    console.error("createSession failed: cloud identity is unavailable");
    return errorResponse("UNKNOWN_ERROR", "暂时无法创建匿名会话，请稍后重试。", true);
  }

  try {
    const { record, publicData } = createSessionPayload({
      input: validation.value,
      appId: context.APPID,
      openId: context.OPENID,
    });

    await database.collection("sessions").add({
      data: record,
    });

    return successResponse(publicData);
  } catch (error) {
    console.error("createSession failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode:
        typeof error === "object" && error !== null && "errCode" in error
          ? String(error.errCode)
          : "UNKNOWN",
    });

    return errorResponse("UNKNOWN_ERROR", "暂时无法创建匿名会话，请稍后重试。", true);
  }
};
