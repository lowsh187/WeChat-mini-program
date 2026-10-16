import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import v2 from "../shared/recommendation.v2.js";

const preferences = JSON.parse(
  await readFile(new URL("../database/config/preferences.v2.json", import.meta.url), "utf8"),
);
const trials = JSON.parse(
  await readFile(new URL("../database/seeds/work_trials.v2.json", import.meta.url), "utf8"),
);

test("preference produces role affinity without a capability mapping", () => {
  const scores = v2.scorePreference("people", preferences.matrix);
  assert.equal(scores.user_researcher, 100);
  assert.equal(scores.data_analyst, 40);
  assert.equal("logical_analysis" in scores, false);
});

test("missing followup returns explicit 4/7 and 3/7 degraded metadata", () => {
  const result = v2.combineRoleComponents({
    baseByRole: { data_analyst: 70 },
    preferenceByRole: { data_analyst: 50 },
  });
  assert.equal(result.status, "degraded");
  assert.deepEqual(result.missingComponents, ["followup"]);
  assert.equal(result.comparableToFullScore, false);
  assert.equal(result.scores.data_analyst, 61.4);
});

test("merges only observed values and never turns unavailable into zero", () => {
  const merged = v2.mergeCapabilityObservations([
    [
      {
        dimension: "logical_analysis",
        status: "observed",
        score: 4,
        evidence: ["r1/q1"],
        improvement: "补充反例",
      },
      {
        dimension: "communication",
        status: "unavailable",
        score: null,
        evidence: [],
        reason: "timeout",
      },
    ],
    [
      {
        dimension: "logical_analysis",
        status: "observed",
        score: 2,
        evidence: ["r2/q1", "r1/q1"],
        improvement: "说明取舍",
      },
      {
        dimension: "communication",
        status: "not_observed",
        score: null,
        evidence: [],
        reason: "no evidence",
      },
    ],
  ]);
  assert.deepEqual(
    merged.find(({ dimension }) => dimension === "logical_analysis"),
    {
      dimension: "logical_analysis",
      status: "observed",
      score: 3,
      maxScore: 5,
      evidence: ["r1/q1", "r2/q1"],
      improvement: "说明取舍",
    },
  );
  assert.equal(merged.find(({ dimension }) => dimension === "communication").score, null);
});

test("validates three required trial answers, optional omission and unknown keys", () => {
  const trial = trials.trials[0];
  const request = {
    trialId: trial.trialId,
    trialAttemptId: "attempt-001",
    answers: Object.fromEntries(
      trial.questions
        .filter(({ required }) => required)
        .map(({ questionId }) => [questionId, "回答"]),
    ),
  };
  assert.equal(v2.validateTrialAnswers(request, trial).ok, true);
  request.answers.unknown = "回答";
  assert.equal(v2.validateTrialAnswers(request, trial).ok, false);
});

test("same attempt payload replays while changed answers conflict", () => {
  const first = v2.fingerprintTrialAnswers("trial", { q2: "B", q1: "A" });
  const reordered = v2.fingerprintTrialAnswers("trial", { q1: "A", q2: "B" });
  const changed = v2.fingerprintTrialAnswers("trial", { q1: "A2", q2: "B" });
  assert.equal(v2.resolveAttemptReplay(first, reordered), "replay");
  assert.equal(v2.resolveAttemptReplay(first, changed), "conflict");
});
