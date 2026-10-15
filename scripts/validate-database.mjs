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
const preferenceConfig = await readJson("database/config/preferences.v2.json");
const rubricConfig = await readJson("database/config/rubrics.v2.json");
const trialSeed = await readJson("database/seeds/work_trials.v2.json");

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

assert.equal(preferenceConfig.reviewStatus, "draft_for_joint_review");
assert.deepEqual(
  new Set(Object.keys(preferenceConfig.matrix)),
  new Set(["facts", "people", "practice", "unsure"]),
);
for (const [preference, scores] of Object.entries(preferenceConfig.matrix)) {
  assert.deepEqual(new Set(Object.keys(scores)), roleIds, `${preference} 必须覆盖六岗位`);
  for (const score of Object.values(scores))
    assert(score >= 0 && score <= 5, "偏好匹配分必须为 0～5");
}
assert.equal(
  new Set(Object.values(preferenceConfig.matrix.unsure)).size,
  1,
  "unsure 必须对六岗位等贡献",
);

assert.equal(rubricConfig.reviewedByProfessional, false, "未审阅 Rubric 不得标记为专业复核");
assert.deepEqual(new Set(Object.keys(rubricConfig.anchors)), dimensions, "Rubric 必须覆盖六维");
for (const [dimension, anchors] of Object.entries(rubricConfig.anchors)) {
  assert.equal(anchors.length, 6, `${dimension} 必须包含 0～5 共六级锚点`);
  assert(
    anchors.every((anchor) => typeof anchor === "string" && anchor.trim()),
    `${dimension} 锚点不能为空`,
  );
}

assert.equal(trialSeed.trials.length, 3, "比赛版只开放三个正式试岗");
assert.equal(
  new Set(trialSeed.trials.map(({ trialId }) => trialId)).size,
  3,
  "正式 trialId 不得重复",
);
for (const trial of trialSeed.trials) {
  assert(roleIds.has(trial.roleId), `${trial.trialId} 岗位不存在`);
  assert.equal(
    trial.questions.filter(({ required }) => required).length,
    3,
    `${trial.trialId} 必须有三道必答题`,
  );
  assert.equal(
    trial.questions.filter(({ required }) => !required).length,
    1,
    `${trial.trialId} 必须有一道选答题`,
  );
  assert.equal(
    new Set(trial.questions.map(({ questionId }) => questionId)).size,
    4,
    `${trial.trialId} questionId 不得重复`,
  );
  assert(
    trial.rubricDimensions.every((dimension) => dimensions.has(dimension)),
    `${trial.trialId} Rubric 维度未知`,
  );
}

console.log("Database v1 skeleton and v2 draft configurations are valid.");
