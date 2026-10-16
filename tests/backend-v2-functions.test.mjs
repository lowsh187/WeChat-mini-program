import assert from "node:assert/strict";
import test from "node:test";

import initial from "../cloudfunctions/getInitialRecommendation/logic.js";
import initialProvider from "../cloudfunctions/getInitialRecommendation/ai-provider.js";
import trial from "../cloudfunctions/scoreTrial/logic.js";

const dimensions = [
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
];

test("AI provider requires secret, HTTPS endpoint and model without embedding credentials", () => {
  assert.throws(() => initialProvider.readProviderConfig({}), /NOT_CONFIGURED/u);
  assert.throws(
    () =>
      initialProvider.readProviderConfig({
        AI_API_KEY: "secret",
        AI_BASE_URL: "http://example.com",
        AI_MODEL: "model",
      }),
    /HTTPS_REQUIRED/u,
  );
  const config = initialProvider.readProviderConfig({
    AI_API_KEY: "secret",
    AI_BASE_URL: "https://example.com/v1/chat/completions",
    AI_MODEL: "model",
  });
  assert.equal(config.apiKey, "secret");
  assert.equal(config.endpoint.protocol, "https:");
});

test("initial recommendation validates answers and keeps preference out of capabilities", () => {
  const questions = [
    {
      questionId: "q1",
      questionType: "base",
      prompt: "题目",
      options: [{ optionId: "a", label: "选项", capabilityScores: { logical_analysis: 5 } }],
    },
  ];
  const request = {
    sessionId: `ses_${"a".repeat(32)}`,
    baseAnswers: { q1: "a" },
    preferredApproach: "people",
    followupAnswers: {},
  };
  assert.equal(initial.validateInput(request, questions).ok, true);
  assert.equal(
    initial.validateInput({ ...request, followupAnswers: { followup: "test@example.com" } }, [
      ...questions,
      { questionId: "followup", questionType: "followup" },
    ]).ok,
    false,
  );
  const observations = initial.baseObservations(request.baseAnswers, questions);
  assert.equal(observations.find(({ dimension }) => dimension === "logical_analysis").score, 5);
  assert.equal(
    observations.some(({ dimension }) => dimension === "people"),
    false,
  );
});

test("initial recommendation exposes explicit degraded weights without followup", () => {
  const result = initial.combineRoleScores(
    { data_analyst: 70, product_operations: 60 },
    { data_analyst: 5, product_operations: 2 },
    null,
  );
  assert.equal(result.degraded, true);
  assert.equal(result.weights.followup, 0);
  assert.equal(Math.round(result.weights.base * 7), 4);
  assert.equal(Math.round(result.weights.preference * 7), 3);
});

test("trial validation rejects unknown questions and changed payloads change fingerprint", () => {
  const trialConfig = {
    trialId: "trial_data_signup_drop_v1",
    questions: [
      { questionId: "q1", required: true },
      { questionId: "q2", required: true },
      { questionId: "q3", required: true },
      { questionId: "q4", required: false },
    ],
  };
  const request = {
    sessionId: `ses_${"b".repeat(32)}`,
    trialId: trialConfig.trialId,
    trialAttemptId: "attempt_12345678",
    answers: { q1: "A", q2: "B", q3: "C" },
  };
  assert.equal(trial.validateInput(request, trialConfig).ok, true);
  assert.notEqual(
    trial.fingerprint(request.trialId, request.answers),
    trial.fingerprint(request.trialId, { ...request.answers, q1: "changed" }),
  );
  assert.equal(
    trial.validateInput({ ...request, answers: { ...request.answers, unknown: "x" } }, trialConfig)
      .ok,
    false,
  );
  assert.equal(
    trial.validateInput(
      { ...request, answers: { q1: "13800138000", q2: "B", q3: "C" } },
      trialConfig,
    ).ok,
    false,
  );
});

test("trial merge applies 45/55 only to observed values", () => {
  const initialObservations = dimensions.map((dimension) => ({
    dimension,
    status: "observed",
    score: 4,
    maxScore: 5,
    evidence: [`initial-${dimension}`],
    improvement: "继续练习",
  }));
  const trialObservations = [
    {
      dimension: "logical_analysis",
      status: "observed",
      score: 2,
      maxScore: 5,
      evidence: ["trial"],
      improvement: "补充反例",
    },
    {
      dimension: "communication",
      status: "unavailable",
      score: null,
      maxScore: 5,
      evidence: [],
      reason: "timeout",
    },
  ];
  const merged = trial.mergeWithInitial(initialObservations, trialObservations);
  assert.equal(merged.find(({ dimension }) => dimension === "logical_analysis").score, 2.9);
  assert.equal(merged.find(({ dimension }) => dimension === "communication").score, 4);
  assert.ok(trial.unavailableObservations(["communication"]).every(({ score }) => score === null));
});
