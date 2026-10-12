const { createHash } = require("node:crypto");
const { buildActionPlan, ROLE_IDS, validateGaps } = require("./plan");
const CONTACT_PATTERN = /(?:1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/u;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false, error: "请求体必须是对象。" };
  if (typeof input.sessionId !== "string" || !/^ses_[a-f0-9]{32}$/u.test(input.sessionId)) {
    return { ok: false, error: "sessionId 格式不正确。" };
  }
  if (!ROLE_IDS.includes(input.roleId)) return { ok: false, error: "roleId 不在固定岗位列表中。" };
  const gaps = validateGaps(input.gaps);
  if (!gaps.ok) return gaps;
  if (
    input.preferenceNote !== undefined &&
    (typeof input.preferenceNote !== "string" ||
      input.preferenceNote.trim().length === 0 ||
      input.preferenceNote.length > 200)
  ) {
    return { ok: false, error: "preferenceNote 必须是 1～200 字的字符串。" };
  }
  if (input.preferenceNote !== undefined && CONTACT_PATTERN.test(input.preferenceNote)) {
    return {
      ok: false,
      error: "preferenceNote 不得包含手机号或邮箱。",
      code: "CONTENT_RISK",
    };
  }
  return {
    ok: true,
    value: {
      sessionId: input.sessionId,
      roleId: input.roleId,
      gaps: input.gaps,
      preferenceNote: input.preferenceNote?.trim(),
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
module.exports = { buildActionPlan, response, sha256, validateInput };
