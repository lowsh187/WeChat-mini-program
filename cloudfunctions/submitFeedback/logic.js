const { createHash } = require("node:crypto");

const CONTRACT_VERSION = "1.0.0";
const CONFIG_VERSION = "1.0.0";
const ROLE_IDS = [
  "data_analyst",
  "product_operations",
  "user_researcher",
  "product_manager",
  "project_manager",
  "content_strategist",
];
const CONTACT_PATTERN = /(?:1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/u;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "请求体必须是对象。" };
  }
  if (typeof input.sessionId !== "string" || !/^ses_[a-f0-9]{32}$/u.test(input.sessionId)) {
    return { ok: false, error: "sessionId 格式不正确。" };
  }
  if (!Number.isInteger(input.helpfulness) || input.helpfulness < 1 || input.helpfulness > 5) {
    return { ok: false, error: "helpfulness 必须是 1～5 的整数。" };
  }
  if (input.interestedRoleId !== undefined && !ROLE_IDS.includes(input.interestedRoleId)) {
    return { ok: false, error: "interestedRoleId 不在固定岗位列表中。" };
  }
  if (input.comment !== undefined) {
    if (
      typeof input.comment !== "string" ||
      input.comment.trim().length === 0 ||
      input.comment.length > 500
    ) {
      return { ok: false, error: "comment 必须是 1～500 字的字符串。" };
    }
    if (CONTACT_PATTERN.test(input.comment)) {
      return { ok: false, error: "反馈中不得包含手机号或邮箱。", code: "CONTENT_RISK" };
    }
  }
  return {
    ok: true,
    value: {
      sessionId: input.sessionId,
      helpfulness: input.helpfulness,
      interestedRoleId: input.interestedRoleId,
      comment: input.comment?.trim(),
    },
  };
}

function response(status, data, error = null) {
  return {
    status,
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    data,
    error,
    aiGenerated: false,
  };
}

module.exports = { response, sha256, validateInput };
