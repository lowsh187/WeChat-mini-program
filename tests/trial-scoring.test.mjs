import assert from "node:assert/strict";
import test from "node:test";

import recommendation from "../shared/recommendation.js";
import trialScoring from "../shared/trial-scoring.js";

const { CAPABILITY_DIMENSIONS } = recommendation;
const {
  combinePostTrialScores,
  createDegradedTrialScores,
  runWithTimeoutAndRetry,
  validateTrialScores,
} = trialScoring;

function mapping(score, prefix = "evidence") {
  return Object.fromEntries(
    CAPABILITY_DIMENSIONS.map((dimension) => [
      dimension,
      { score, evidence: [`${prefix}-${dimension}`] },
    ]),
  );
}

test("enforces fixed 45/55 post-trial weighting", () => {
  const result = combinePostTrialScores(mapping(4, "initial"), mapping(2, "trial"));
  for (const dimension of CAPABILITY_DIMENSIONS) assert.equal(result[dimension].score, 2.9);
});

test("rejects rubric scores without real evidence", () => {
  const degraded = createDegradedTrialScores(["logical_analysis"]);
  assert.equal(validateTrialScores(degraded, ["logical_analysis"]).ok, true);
  assert.equal(
    validateTrialScores(
      [
        {
          dimension: "logical_analysis",
          score: 4,
          maxScore: 5,
          evidence: "列出了两个原因并给出区分证据。",
          improvement: "补充反例验证。",
        },
      ],
      ["logical_analysis"],
    ).ok,
    true,
  );
  assert.equal(validateTrialScores([], ["logical_analysis"]).ok, false);
});

test("allows only one retry and returns the second successful result", async () => {
  let calls = 0;
  const result = await runWithTimeoutAndRetry(
    () => {
      calls += 1;
      if (calls === 1) throw new Error("temporary");
      return "ok";
    },
    { timeoutMs: 50, retries: 1 },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 2);
  await assert.rejects(() => runWithTimeoutAndRetry(() => "ok", { retries: 2 }));
});

test("times out safely", async () => {
  await assert.rejects(
    () =>
      runWithTimeoutAndRetry(() => new Promise(() => {}), {
        timeoutMs: 5,
        retries: 0,
      }),
    /AI_TIMEOUT/u,
  );
});
