const { createHash, timingSafeEqual } = require("node:crypto");

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function safeHashEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false, error: "请求体必须是对象。" };
  if (typeof input.sessionId !== "string" || !/^ses_[a-f0-9]{32}$/u.test(input.sessionId)) {
    return { ok: false, error: "sessionId 格式不正确。" };
  }
  if (
    typeof input.confirmationToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(input.confirmationToken)
  ) {
    return { ok: false, error: "confirmationToken 格式不正确。" };
  }
  return {
    ok: true,
    value: { sessionId: input.sessionId, confirmationToken: input.confirmationToken },
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
module.exports = { response, safeHashEqual, sha256, validateInput };
