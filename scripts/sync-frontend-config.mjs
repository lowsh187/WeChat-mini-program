import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const { FOLLOWUP_QUESTIONS } = createRequire(import.meta.url)(
  "../cloudfunctions/selectFollowup/logic.js",
);
const questions = read("database/seeds/base_questions.json").questions.map((question) => ({
  id: question.questionId,
  title: question.prompt,
  context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
  options: question.options.map((option) => ({ id: option.optionId, label: option.label })),
}));
const roles = read("database/seeds/roles.json").roles.map(({ roleId, name, description }) => ({
  roleId,
  name,
  description,
}));
const trials = read("database/seeds/work_trials.v2.json").trials.map(
  ({ trialId, roleId, questions: items, rubricDimensions }) => ({
    trialId,
    roleId,
    questions: items,
    rubricDimensions,
  }),
);
const snapshot = {
  reviewStatus: "draft_for_joint_review",
  configVersion: "2.0.0",
  questions,
  roles,
  trials,
  followups: FOLLOWUP_QUESTIONS,
};
const content = await prettier.format(
  `// Generated from B's current configs. Display-only; no weights, scores or client scoring.\nexport const backendContent = ${JSON.stringify(snapshot, null, 2)} as const;\n`,
  {
    ...(await prettier.resolveConfig(path.join(root, "miniprogram/config/backend-content.ts"))),
    parser: "typescript",
  },
);
const target = path.join(root, "miniprogram/config/backend-content.ts");
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") !== content)
    throw new Error("Frontend config snapshot is stale. Run npm run sync:frontend.");
} else fs.writeFileSync(target, content);
