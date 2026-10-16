import assert from "node:assert/strict";
import test from "node:test";

import actionPlan from "../shared/action-plan.js";

const { buildActionPlan, validateGaps } = actionPlan;

const gaps = [
  { dimension: "logical_analysis", score: 2, maxScore: 5, evidence: "e", improvement: "i" },
  { dimension: "communication", score: 3, maxScore: 5, evidence: "e", improvement: "i" },
];

test("builds an exact seven-day deterministic plan", () => {
  const plan = buildActionPlan({ roleId: "data_analyst", gaps });
  assert.equal(plan.items.length, 7);
  assert.deepEqual(
    plan.items.map((item) => item.day),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.ok(plan.items.every((item) => item.completed === false));
});

test("rejects duplicate and out-of-range gaps", () => {
  assert.equal(validateGaps([...gaps, gaps[0]]).ok, false);
  assert.equal(validateGaps([{ ...gaps[0], score: 6 }]).ok, false);
  assert.throws(() => buildActionPlan({ roleId: "unknown", gaps }));
});
