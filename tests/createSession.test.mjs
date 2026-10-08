import assert from "node:assert/strict";
import test from "node:test";

import createSessionLogic from "../cloudfunctions/createSession/logic.js";

const {
  CONFIG_VERSION,
  CONTRACT_VERSION,
  SESSION_LIFETIME_DAYS,
  createSessionPayload,
  errorResponse,
  sha256,
  successResponse,
  validateCreateSessionInput,
} = createSessionLogic;

test("accepts a valid createSession request", () => {
  const result = validateCreateSessionInput({
    clientVersion: "0.1.0",
    anonymousDeviceSessionId: "anonymous-device-session",
  });

  assert.equal(result.ok, true);
});

test("rejects malformed input without throwing", () => {
  assert.equal(validateCreateSessionInput(null).ok, false);
  assert.equal(validateCreateSessionInput({ clientVersion: "" }).ok, false);
  assert.equal(validateCreateSessionInput({ clientVersion: "0.1.0 invalid" }).ok, false);
  assert.equal(
    validateCreateSessionInput({
      clientVersion: "0.1.0",
      anonymousDeviceSessionId: "short",
    }).ok,
    false,
  );
});

test("creates an anonymous, expiring session without storing raw identifiers", () => {
  const now = new Date("2026-10-08T08:00:00.000Z");
  const input = {
    clientVersion: "0.1.0",
    anonymousDeviceSessionId: "device-session-for-test",
  };

  const { record, publicData } = createSessionPayload({
    input,
    appId: "wx-test-app",
    openId: "openid-for-test",
    now,
  });

  assert.match(record.sessionId, /^ses_[a-f0-9]{32}$/u);
  assert.match(publicData.deletionToken, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(record.ownerKeyHash, sha256("wx-test-app:openid-for-test"));
  assert.equal(record.deletionTokenHash, sha256(publicData.deletionToken));
  assert.equal(record.anonymousDeviceSessionHash, sha256(input.anonymousDeviceSessionId));
  assert.equal(record.openId, undefined);
  assert.equal(record.anonymousDeviceSessionId, undefined);
  assert.equal(record.status, "created");
  assert.equal(record.followupRound, 0);
  assert.equal(record.expiresAt.getTime() - now.getTime(), SESSION_LIFETIME_DAYS * 86400000);
});

test("uses the frozen API response envelope", () => {
  const success = successResponse({ sessionId: "ses_test" });
  assert.deepEqual(success, {
    status: "success",
    contractVersion: CONTRACT_VERSION,
    configVersion: CONFIG_VERSION,
    data: { sessionId: "ses_test" },
    error: null,
    aiGenerated: false,
  });

  const failure = errorResponse("INVALID_ARGUMENT", "invalid");
  assert.equal(failure.status, "error");
  assert.equal(failure.error.code, "INVALID_ARGUMENT");
  assert.equal(failure.error.retryable, false);
  assert.equal(failure.data, null);
});
