const { createHash, randomUUID } = require("node:crypto");

const SAFE_NAME = /^[a-z][a-z0-9_.-]{0,63}$/u;
function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false, error: "请求体必须是对象。" };
  if (typeof input.sessionId !== "string" || !/^ses_[a-f0-9]{32}$/u.test(input.sessionId)) {
    return { ok: false, error: "sessionId 格式不正确。" };
  }
  if (!SAFE_NAME.test(input.eventName) || !SAFE_NAME.test(input.step)) {
    return { ok: false, error: "eventName 和 step 必须使用安全的短标识符。" };
  }
  if (
    input.eventId !== undefined &&
    (typeof input.eventId !== "string" || !/^evt_[0-9A-Za-z_-]{8,100}$/u.test(input.eventId))
  ) {
    return { ok: false, error: "eventId 格式不正确。" };
  }
  if (input.mode !== undefined && input.mode !== "mock" && input.mode !== "real") {
    return { ok: false, error: "mode 必须是 mock 或 real。" };
  }
  if (
    input.trialAttemptId !== undefined &&
    (typeof input.trialAttemptId !== "string" || input.trialAttemptId.length > 128)
  ) {
    return { ok: false, error: "trialAttemptId 格式不正确。" };
  }
  if (
    input.durationMs !== undefined &&
    (!Number.isInteger(input.durationMs) || input.durationMs < 0 || input.durationMs > 3600000)
  ) {
    return { ok: false, error: "durationMs 必须是 0～3600000 的整数。" };
  }
  return {
    ok: true,
    value: {
      sessionId: input.sessionId,
      eventName: input.eventName,
      step: input.step,
      eventId: input.eventId || `evt_${randomUUID().replaceAll("-", "")}`,
      mode: input.mode || "real",
      trialAttemptId: input.trialAttemptId,
      resultStatus: input.resultStatus,
      durationMs: input.durationMs,
    },
  };
}
function response(status, data, error = null) {
  return {
    status,
    contractVersion: "1.0.0",
    configVersion: "1.0.0",
    data,
    error,
    aiGenerated: false,
  };
}
module.exports = { response, sha256, validateInput };
