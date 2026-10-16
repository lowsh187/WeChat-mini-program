import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const databaseRoot = join(projectRoot, "database");
const outputRoot = join(databaseRoot, "imports");
const bootstrapOutput = join(projectRoot, "cloudfunctions", "createSession", "bootstrap-data.json");

const readJson = async (relativePath) =>
  JSON.parse(await readFile(join(databaseRoot, relativePath), "utf8"));

const toNdjson = (documents) => `${documents.map((item) => JSON.stringify(item)).join("\n")}\n`;

const rolesSource = await readJson("seeds/roles.json");
const questionsSource = await readJson("seeds/base_questions.json");
const trialsSource = await readJson("seeds/work_trials.v2.json");
const rubricsSource = await readJson("config/rubrics.v2.json");

const roles = rolesSource.roles.map((role) => ({
  ...role,
  status: "active",
  configVersion: rolesSource.configVersion,
}));

const questions = questionsSource.questions.map((question) => ({
  ...question,
  status: "active",
  configVersion: questionsSource.configVersion,
}));

const trials = trialsSource.trials.map((trial) => ({
  ...trial,
  status: "active",
  configVersion: trialsSource.configVersion,
  reviewedByProfessional: rubricsSource.reviewedByProfessional,
  anchors: Object.fromEntries(
    trial.rubricDimensions.map((dimension) => {
      const anchors = rubricsSource.anchors[dimension];
      if (!Array.isArray(anchors) || anchors.length !== 6) {
        throw new Error(`Rubric ${dimension} 必须包含 0-5 共 6 个锚点`);
      }
      return [dimension, anchors];
    }),
  ),
}));

if (roles.length !== 6) throw new Error("roles 导入数据必须恰好包含 6 条");
if (questions.length !== 8) throw new Error("base_questions 导入数据必须恰好包含 8 条");
if (trials.length !== 3) throw new Error("work_trials 导入数据必须恰好包含 3 条");

await mkdir(outputRoot, { recursive: true });
await Promise.all([
  writeFile(join(outputRoot, "roles.ndjson"), toNdjson(roles), "utf8"),
  writeFile(join(outputRoot, "base_questions.ndjson"), toNdjson(questions), "utf8"),
  writeFile(join(outputRoot, "work_trials.ndjson"), toNdjson(trials), "utf8"),
  writeFile(
    bootstrapOutput,
    `${JSON.stringify({ roles, baseQuestions: questions, workTrials: trials }, null, 2)}\n`,
    "utf8",
  ),
]);

console.log(`已生成云数据库导入文件：${outputRoot}`);
console.log(
  `roles=${roles.length}, base_questions=${questions.length}, work_trials=${trials.length}`,
);
