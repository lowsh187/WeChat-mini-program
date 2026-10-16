const { createHash } = require("node:crypto");

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
