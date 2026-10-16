import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import recommendation from "../shared/recommendation.js";

const {
  CAPABILITY_DIMENSIONS,
  calculateBaseDimensionScores,
  combineInitialCapabilityScores,
  rankRoles,
  validateCapabilityMapping,
} = recommendation;

const questionsSeed = JSON.parse(
  await readFile(new URL("../database/seeds/base_questions.json", import.meta.url), "utf8"),
);
const rolesSeed = JSON.parse(
  await readFile(new URL("../database/seeds/roles.json", import.meta.url), "utf8"),
);

function mapping(score, prefix) {
  return Object.fromEntries(
    CAPABILITY_DIMENSIONS.map((dimension) => [
      dimension,
      { score, evidence: [`${prefix}-${dimension}`] },
    ]),
  );
}

test("calculates deterministic six-dimension base scores from known options", () => {
  const answers = Object.fromEntries(
    questionsSeed.questions.map((question) => [question.questionId, "a"]),
  );
  const scores = calculateBaseDimensionScores(answers, questionsSeed.questions);
  assert.deepEqual(Object.keys(scores), CAPABILITY_DIMENSIONS);
  for (const dimension of CAPABILITY_DIMENSIONS) {
    assert.equal(scores[dimension].score, 5);
    assert.ok(scores[dimension].evidence.length >= 1);
  }
});

test("rejects missing or unknown base answers", () => {
  assert.throws(() => calculateBaseDimensionScores({}, questionsSeed.questions), /缺少基础题答案/u);
  const answers = Object.fromEntries(
    questionsSeed.questions.map((question) => [question.questionId, "a"]),
  );
  answers.base_information_01 = "unknown";
  assert.throws(() => calculateBaseDimensionScores(answers, questionsSeed.questions), /未知选项/u);
});

test("enforces the fixed 40/30/30 initial score weights", () => {
  const combined = combineInitialCapabilityScores({
    base: mapping(5, "base"),
    preference: mapping(3, "preference"),
    followup: mapping(1, "followup"),
  });
  for (const dimension of CAPABILITY_DIMENSIONS) assert.equal(combined[dimension].score, 3.2);
});

test("validates AI mapping schema and rejects unknown dimensions", () => {
  assert.equal(validateCapabilityMapping(mapping(4, "evidence")).ok, true);
  assert.equal(validateCapabilityMapping({ ...mapping(4, "evidence"), unknown: {} }).ok, false);
  assert.equal(validateCapabilityMapping(mapping(6, "evidence")).ok, false);
});

test("returns exactly three deterministic role recommendations with evidence", () => {
  const capabilityMapping = mapping(3, "evidence");
  capabilityMapping.logical_analysis.score = 5;
  capabilityMapping.information_extraction.score = 5;
  const recommendations = rankRoles(capabilityMapping, rolesSeed.roles);
  assert.equal(recommendations.length, 3);
  assert.ok(recommendations.every((item) => item.score >= 0 && item.score <= 100));
  assert.ok(recommendations.every((item) => item.reasons.length === 2));
});
