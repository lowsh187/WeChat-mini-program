const { createHash } = require("node:crypto");
const cloud = require("wx-server-sdk");
const { requestStructuredCompletion } = require("./ai-provider");
const {
  PREFERENCE_MATRIX,
  baseObservations,
  buildFollowupPrompt,
  combineRoleScores,
  errorResponse,
  mergeObservations,
  rankRecommendations,
  response,
  runProvider,
  scoreRoles,
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
    const [questionResult, roleResult] = await Promise.all([
      database.collection("base_questions").where({ configVersion: "1.0.0" }).get(),
      database.collection("roles").where({ configVersion: "1.0.0" }).get(),
    ]);
    const questions = questionResult.data;
    const roles = roleResult.data;
    const validation = validateInput(event, questions);
    if (!validation.ok) return errorResponse("INVALID_ARGUMENT", validation.error);
    if (roles.length !== 6) return errorResponse("NOT_FOUND", "岗位配置不完整。", true);

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

    const base = baseObservations(validation.value.baseAnswers, questions);
    let followup = null;
    let status = "success";
    let aiGenerated = false;
    let degradedError = null;
    if (Object.keys(validation.value.followupAnswers).length) {
      try {
        const raw = await runProvider(
          (prompt) => requestStructuredCompletion(prompt),
          buildFollowupPrompt(validation.value.followupAnswers),
        );
        const checked = validateAiObservations(raw);
        if (!checked.ok) throw new Error("AI_SCHEMA_INVALID");
        followup = checked.value;
        aiGenerated = true;
      } catch {
        status = "degraded";
        degradedError = {
          code: "AI_UNAVAILABLE",
          message: "追问暂未获得有效分析，已使用明确的降级权重。",
          retryable: true,
        };
      }
    } else {
      status = "degraded";
      degradedError = {
        code: "AI_UNAVAILABLE",
        message: "缺少有效追问证据，已使用明确的降级权重。",
        retryable: false,
      };
    }

    const baseByRole = scoreRoles(base, roles);
    const followupByRole = followup ? scoreRoles(followup, roles) : null;
    const combined = combineRoleScores(
      baseByRole,
      PREFERENCE_MATRIX[validation.value.preferredApproach],
      followupByRole,
    );
    const recommendations = rankRecommendations(combined, roles);
    const topRoleId = recommendations[0].roleId;
    const capabilityObservations = mergeObservations(base, followup);
    const publicResult = {
      capabilityObservations,
      recommendations,
      scoreComponents: [
        { name: "base", score: baseByRole[topRoleId], weight: combined.weights.base },
        {
          name: "preference",
          score: PREFERENCE_MATRIX[validation.value.preferredApproach][topRoleId] * 20,
          weight: combined.weights.preference,
        },
        {
          name: "followup",
          score: followup ? followupByRole[topRoleId] : null,
          weight: combined.weights.followup,
        },
      ],
      effectiveWeights: combined.weights,
      missingComponents: followup ? [] : ["followup"],
      comparableToFullScore: !combined.degraded,
    };
    const assessmentRecord = {
      sessionId: validation.value.sessionId,
      assessmentType: "initial",
      capabilityObservations,
      recommendations,
      resultStatus: status,
      aiGenerated,
      configVersion: "2.0.0",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const previousInitial = await database
      .collection("assessments")
      .where({
        sessionId: validation.value.sessionId,
        assessmentType: "initial",
        configVersion: "2.0.0",
      })
      .limit(1)
      .get();
    if (previousInitial.data[0]) {
      const updatedRecord = { ...assessmentRecord };
      delete updatedRecord.createdAt;
      await database
        .collection("assessments")
        .doc(previousInitial.data[0]._id)
        .update({ data: updatedRecord });
    } else {
      await database.collection("assessments").add({ data: assessmentRecord });
    }
    return response(status, publicResult, degradedError, aiGenerated);
  } catch (error) {
    console.error("getInitialRecommendation failed", {
      name: error instanceof Error ? error.name : "Unknown",
      code: error?.errCode || "UNKNOWN",
    });
    return errorResponse("UNKNOWN_ERROR", "暂时无法生成初步推荐，请稍后重试。", true);
  }
};
