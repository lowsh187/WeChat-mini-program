import assert from "node:assert/strict";
import test from "node:test";

import deleteSessionLogic from "../cloudfunctions/deleteSession/logic.js";
import actionPlanLogic from "../cloudfunctions/getActionPlan/logic.js";
import submitFeedbackLogic from "../cloudfunctions/submitFeedback/logic.js";
import trackEventLogic from "../cloudfunctions/trackEvent/logic.js";
import sharedActionPlan from "../shared/action-plan.js";

const sessionId = "ses_0123456789abcdef0123456789abcdef";
const gaps = [
  { dimension: "logical_analysis", score: 2, maxScore: 5, evidence: "e", improvement: "i" },
];

test("validates privacy-safe feedback", () => {
  assert.equal(
    submitFeedbackLogic.validateInput({ sessionId, helpfulness: 5, comment: "结果很有帮助" }).ok,
    true,
  );
  const unsafe = submitFeedbackLogic.validateInput({
    sessionId,
    helpfulness: 5,
    comment: "请联系 13800138000",
  });
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.code, "CONTENT_RISK");
});

test("rejects event payloads that could contain answer text", () => {
  assert.equal(
    trackEventLogic.validateInput({ sessionId, eventName: "trial.completed", step: "trial" }).ok,
    true,
  );
  assert.equal(
    trackEventLogic.validateInput({ sessionId, eventName: "用户的完整回答", step: "trial" }).ok,
    false,
  );
});

test("validates deletion token and compares hashes safely", () => {
  const token = "a".repeat(43);
  assert.equal(deleteSessionLogic.validateInput({ sessionId, confirmationToken: token }).ok, true);
  const digest = deleteSessionLogic.sha256(token);
  assert.equal(deleteSessionLogic.safeHashEqual(digest, digest), true);
  assert.equal(deleteSessionLogic.safeHashEqual(digest, deleteSessionLogic.sha256("b")), false);
});

test("cloud action-plan logic matches the reviewed shared template", () => {
  const input = { sessionId, roleId: "data_analyst", gaps };
  assert.equal(actionPlanLogic.validateInput(input).ok, true);
  assert.deepEqual(actionPlanLogic.buildActionPlan(input), sharedActionPlan.buildActionPlan(input));
  const unsafe = actionPlanLogic.validateInput({
    ...input,
    preferenceNote: "联系 test@example.com",
  });
  assert.equal(unsafe.code, "CONTENT_RISK");
});
