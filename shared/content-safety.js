const CONTACT_PATTERN = /(?:1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/u;

function validateOptionalText(value, { field, maxLength, rejectContact = true }) {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    return { ok: false, error: `${field} 必须是 1～${maxLength} 字的字符串。` };
  }
  const normalized = value.trim();
  if (rejectContact && CONTACT_PATTERN.test(normalized)) {
    return { ok: false, error: `${field} 不得包含手机号或邮箱。`, code: "CONTENT_RISK" };
  }
  return { ok: true, value: normalized };
}

module.exports = { CONTACT_PATTERN, validateOptionalText };
