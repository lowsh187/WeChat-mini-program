const { createHash, randomBytes, randomUUID } = require("node:crypto");

const CONTRACT_VERSION = "1.0.0";
const CONFIG_VERSION = "1.0.0";
const SESSION_LIFETIME_DAYS = 8;
const SESSION_LIFETIME_MS = SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateCreateSessionInput(input) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: "请求体必须是对象。",
    };
  }

  const { clientVersion, anonymousDeviceSessionId } = input;

  if (
    typeof clientVersion !== "string" ||
    clientVersion.length < 1 ||
    clientVersion.length > 32 ||
    !/^[0-9A-Za-z][0-9A-Za-z._-]*$/u.test(clientVersion)
  ) {
    return {
      ok: false,
      error: "clientVersion 必须是 1～32 位字母、数字、点、下划线或连字符。",
    };
  }

  if (
    anonymousDeviceSessionId !== undefined &&
    (typeof anonymousDeviceSessionId !== "string" ||
      anonymousDeviceSessionId.length < 8 ||
      anonymousDeviceSessionId.length > 128)
  ) {
    return {
      ok: false,
      error: "anonymousDeviceSessionId 必须是 8～128 位字符串。",
    };
  }

  return {
    ok: true,
    value: {
      clientVersion,
      anonymousDeviceSessionId,
    },
  };
}

function createSessionPayload({ input, appId, openId, now = new Date() }) {
  if (!appId || !openId) {
    throw new Error("MISSING_CLOUD_IDENTITY");
  }

  const sessionId = `ses_${randomUUID().replaceAll("-", "")}`;
  const deletionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);

  const record = {
    sessionId,
    status: "created",
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    clientVersion: input.clientVersion,
    currentStep: "session_created",
    followupRound: 0,
    ownerKeyHash: sha256(`${appId}:${openId}`),
    deletionTokenHash: sha256(deletionToken),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  if (input.anonymousDeviceSessionId) {
    record.anonymousDeviceSessionHash = sha256(input.anonymousDeviceSessionId);
  }

  return {
    record,
    publicData: {
      sessionId,
      deletionToken,
      progress: "created",
      expiresAt: expiresAt.toISOString(),
    },
  };
}

function successResponse(data) {
  return {
    status: "success",
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    data,
    error: null,
    aiGenerated: false,
  };
}

function errorResponse(code, message, retryable = false) {
  return {
    status: "error",
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    data: null,
    error: {
      code,
      message,
      retryable,
    },
    aiGenerated: false,
  };
}

module.exports = {
  CONFIG_VERSION,
  CONTRACT_VERSION,
  SESSION_LIFETIME_DAYS,
  createSessionPayload,
  errorResponse,
  sha256,
  successResponse,
  validateCreateSessionInput,
};
