const { createHash } = require("node:crypto");
const cloud = require("wx-server-sdk");
const { requestStructuredCompletion } = require("./ai-provider");
const {
  buildPrompt,
  errorResponse,
  fingerprint,
  mergeWithInitial,
  rankRoles,
  response,
  runProvider,
  unavailableObservations,
  validateAiObservations,
  validateInput,
} = require("./logic");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const database = cloud.database();
const command = database.command;
const ownerHash = (appId, openId) =>
  createHash("sha256").update(`${appId}:${openId}`).digest("hex");

exports.main = async (event) => {
  const context = cloud.getWXContext();
  if (!context.APPID || !context.OPENID)
    return errorResponse("UNKNOWN_ERROR", "云端身份不可用。", true);
  try {
    const trialResult = await database
      .collection("work_trials")
      .where({ trialId: event?.trialId, configVersion: "2.0.0" })
      .limit(1)
      .get();
    const trial = trialResult.data[0];
    if (!trial) return errorResponse("NOT_FOUND", "试岗配置不存在。");
    const validation = validateInput(event, trial);
    if (!validation.ok) return errorResponse("INVALID_ARGUMENT", validation.error);

    const sessionResult = await database
      .collection("sessions")
      .where({
        sessionId: validation.value.sessionId,
        ownerKeyHash: ownerHash(context.APPID, context.OPENID),
        expiresAt: command.gt(new Date()),
      })
      .limit(1)
      .get();
    if (!sessionResult.data[0]) return errorResponse("SESSION_EXPIRED", "会话不存在或已过期。");

    const answerFingerprint = fingerprint(validation.value.trialId, validation.value.answers);
    const previous = await database
      .collection("assessments")
      .where({
        sessionId: validation.value.sessionId,
        trialAttemptId: validation.value.trialAttemptId,
      })
      .limit(1)
      .get();
    if (previous.data[0]) {
      if (previous.data[0].answerFingerprint !== answerFingerprint)
        return errorResponse("CONFLICT", "同一试岗尝试不能提交不同答案，请开始新的尝试。");
      return response(
        previous.data[0].resultStatus,
        { ...previous.data[0].publicResult, replayed: true },
        null,
        previous.data[0].aiGenerated === true,
      );
    }

    let observations;
    let status = "success";
    let aiGenerated = true;
    let degradedError = null;
    try {
      const raw = await runProvider(
        (prompt) => requestStructuredCompletion(prompt),
        buildPrompt(trial, validation.value.answers),
      );
      const checked = validateAiObservations(raw, trial.rubricDimensions);
      if (!checked.ok) throw new Error("AI_SCHEMA_INVALID");
      observations = checked.value;
    } catch (error) {
      status = "degraded";
      aiGenerated = false;
      observations = unavailableObservations(trial.rubricDimensions);
      degradedError = {
        code:
          error instanceof Error && error.message === "AI_TIMEOUT"
            ? "AI_TIMEOUT"
            : "AI_UNAVAILABLE",
        message: "本次暂未获得有效评分，推荐顺序尚未更新。",
        retryable: true,
      };
    }

    const [initialResult, roleResult] = await Promise.all([
      database
        .collection("assessments")
        .where({
          sessionId: validation.value.sessionId,
          assessmentType: "initial",
          configVersion: "2.0.0",
        })
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),
      database.collection("roles").where({ configVersion: "1.0.0" }).get(),
    ]);
    const initial = initialResult.data[0];
    if (!initial || roleResult.data.length !== 6)
      return errorResponse("NOT_FOUND", "缺少有效初步推荐或岗位配置。");
    const before = initial.recommendations;
    const merged =
      status === "success"
        ? mergeWithInitial(initial.capabilityObservations, observations)
        : initial.capabilityObservations;
    const after = status === "success" ? rankRoles(merged, roleResult.data) : before;
    const publicResult = {
      trialId: validation.value.trialId,
      trialAttemptId: validation.value.trialAttemptId,
      capabilityObservations: observations,
      recommendationsBefore: before,
      recommendationsAfter: after,
      changeExplanation:
        status === "degraded"
          ? ["评分不可用，已保留初步推荐顺序。"]
          : ["仅使用有效试岗观察更新能力结果，并重新计算岗位顺序。"],
      practicePriorities: observations
        .filter((item) => item.status === "observed")
        .slice(0, 2)
        .map((item) => ({
          dimension: item.dimension,
          title: "优先练习方向",
          reason: item.evidence[0],
          suggestion: item.improvement,
        })),
      replayed: false,
    };
    await database.collection("assessments").add({
      data: {
        sessionId: validation.value.sessionId,
        assessmentType: "trial",
        trialId: validation.value.trialId,
        trialAttemptId: validation.value.trialAttemptId,
        answerFingerprint,
        capabilityObservations: observations,
        publicResult,
        resultStatus: status,
        aiGenerated,
        configVersion: "2.0.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return response(status, publicResult, degradedError, aiGenerated);
  } catch (error) {
    console.error("scoreTrial failed", {
      name: error instanceof Error ? error.name : "Unknown",
      code: error?.errCode || "UNKNOWN",
    });
    return errorResponse("UNKNOWN_ERROR", "暂时无法完成试岗评分，请稍后重试。", true);
  }
};
