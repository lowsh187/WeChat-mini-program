import assert from "node:assert/strict";
import test from "node:test";

import selectFollowupLogic from "../cloudfunctions/selectFollowup/logic.js";

const {
  FOLLOWUP_QUESTIONS,
  findFollowupQuestion,
  selectFollowupQuestion,
  validateSelectFollowupInput,
} = selectFollowupLogic;

const validInput = {
  sessionId: "ses_0123456789abcdef0123456789abcdef",
  round: 1,
  answeredQuestionIds: [],
  evidenceByDimension: {},
};

test("validates the frozen selectFollowup request", () => {
  assert.equal(validateSelectFollowupInput(validInput).ok, true);
  assert.equal(validateSelectFollowupInput({ ...validInput, round: 3 }).ok, false);
  assert.equal(
    validateSelectFollowupInput({
      ...validInput,
      evidenceByDimension: { unknown_dimension: ["evidence"] },
    }).ok,
    false,
  );
});

test("selects a preset question for the dimension with least evidence", () => {
  const selected = selectFollowupQuestion({
    ...validInput,
    evidenceByDimension: {
      information_extraction: ["a"],
      logical_analysis: ["a"],
      user_insight: [],
      communication: ["a"],
      execution_planning: ["a"],
      creative_ideation: ["a"],
    },
  });

  assert.equal(selected.dimension, "user_insight");
  assert.ok(FOLLOWUP_QUESTIONS.some((question) => question.questionId === selected.questionId));
});

test("never repeats an answered preset question", () => {
  const first = selectFollowupQuestion(validInput);
  const second = selectFollowupQuestion({
    ...validInput,
    round: 2,
    answeredQuestionIds: [first.questionId],
  });

  assert.notEqual(second.questionId, first.questionId);
  assert.equal(second.round, 2);
});

test("reconstructs an idempotent response from a stored preset question", () => {
  const restored = findFollowupQuestion("followup_logic_01", 2);
  assert.equal(restored.round, 2);
  assert.equal(restored.dimension, "logical_analysis");
  assert.equal(findFollowupQuestion("unknown", 1), null);
});
