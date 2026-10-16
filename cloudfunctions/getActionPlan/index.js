const cloud = require("wx-server-sdk");
const { buildActionPlan, response, sha256, validateInput } = require("./logic");

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
      message: "暂时无法生成行动计划。",
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

    const plan = buildActionPlan(input);
    const now = new Date();
    const existing = await database
      .collection("action_plans")
      .where({ sessionId: input.sessionId })
      .limit(1)
      .get();
    const planId = `plan_${sha256(input.sessionId).slice(0, 32)}`;
    const record = {
      planId,
      sessionId: input.sessionId,
      roleId: input.roleId,
      tasks: plan.items,
      configVersion: "1.0.0",
      updatedAt: now,
    };
    if (existing.data.length > 0) {
      await database.collection("action_plans").doc(existing.data[0]._id).update({ data: record });
    } else {
      await database.collection("action_plans").add({ data: { ...record, createdAt: now } });
    }
    await database
      .collection("sessions")
      .doc(sessionResult.data[0]._id)
      .update({
        data: { status: "plan_created", currentStep: "action_plan", updatedAt: now },
      });
    return response("success", { ...plan, planId });
  } catch (error) {
    console.error("getActionPlan failed", {
      errorCode:
        error && typeof error === "object" && "errCode" in error
          ? String(error.errCode)
          : "UNKNOWN",
    });
    return response("error", null, {
      code: "UNKNOWN_ERROR",
      message: "暂时无法生成行动计划。",
      retryable: true,
    });
  }
};
