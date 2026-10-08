import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

const dimensions = new Set([
  "information_extraction",
  "logical_analysis",
  "user_insight",
  "communication",
  "execution_planning",
  "creative_ideation",
]);

const roleIds = new Set([
  "data_analyst",
  "product_operations",
  "user_researcher",
  "product_manager",
  "project_manager",
  "content_strategist",
]);

const manifest = await readJson("database/manifest.json");
const indexes = await readJson("database/indexes.json");
const roleSeed = await readJson("database/seeds/roles.json");
const questionSeed = await readJson("database/seeds/base_questions.json");

const expectedCollections = [
  "roles",
  "base_questions",
  "work_trials",
  "sessions",
  "assessments",
  "action_plans",
  "feedback",
  "events",
];

assert.deepEqual(
  manifest.collections.map(({ name }) => name),
  expectedCollections,
  "数据库集合必须与企划规定的 8 个对象完全一致",
);

assert.equal(new Set(manifest.collections.map(({ name }) => name)).size, 8, "集合名不得重复");
assert.deepEqual(Object.keys(indexes.indexes), expectedCollections, "每个集合必须有索引清单");

assert.equal(roleSeed.roles.length, 6, "必须配置 6 个首发岗位");
assert.equal(new Set(roleSeed.roles.map(({ roleId }) => roleId)).size, 6, "岗位 ID 不得重复");

for (const role of roleSeed.roles) {
  assert(roleIds.has(role.roleId), `未知岗位 ID：${role.roleId}`);
  assert.deepEqual(
    new Set(Object.keys(role.capabilityWeights)),
    dimensions,
    `${role.roleId} 必须包含完整六维权重`,
  );
  assert.equal(
    Object.values(role.capabilityWeights).reduce((sum, weight) => sum + weight, 0),
    100,
    `${role.roleId} 的岗位权重总和必须为 100`,
  );
  assert.equal(role.mvpHypothesis, true, `${role.roleId} 必须标记为 MVP 假设`);
}

const baseQuestions = questionSeed.questions.filter(({ questionType }) => questionType === "base");
assert(baseQuestions.length >= 6 && baseQuestions.length <= 8, "基础题必须为 6～8 道");
assert.equal(
  new Set(questionSeed.questions.map(({ questionId }) => questionId)).size,
  questionSeed.questions.length,
  "题目 ID 不得重复",
);

for (const question of questionSeed.questions) {
  assert(question.prompt.trim().length > 0, `${question.questionId} 的题干不能为空`);
  assert(
    question.targetDimensions.every((dimension) => dimensions.has(dimension)),
    `${question.questionId} 包含未知维度`,
  );
  assert(
    !/(收入|健康|宗教|家庭资产)/u.test(question.prompt),
    `${question.questionId} 不得询问敏感信息`,
  );

  if (question.questionType === "base") {
    assert(question.options?.length >= 2, `${question.questionId} 至少需要两个选项`);
    for (const option of question.options) {
      for (const [dimension, score] of Object.entries(option.capabilityScores)) {
        assert(dimensions.has(dimension), `${question.questionId}/${option.optionId} 包含未知维度`);
        assert(
          Number.isInteger(score) && score >= 0 && score <= 5,
          `${question.questionId}/${option.optionId} 分数必须为 0～5 整数`,
        );
      }
    }
  }
}

console.log("Database manifest, indexes, role seeds, and base-question seeds are valid.");
