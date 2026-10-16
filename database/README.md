# 数据库骨架

## 已定义内容

- `manifest.json`：8 个企划规定的集合及用途；
- `indexes.json`：需在云开发控制台建立的索引；
- `seeds/roles.json`：6 个岗位及六维权重；
- `seeds/base_questions.json`：8 道基础情境题草案；
- `shared/database.ts`：数据库文档 TypeScript 类型；
- `scripts/validate-database.mjs`：配置完整性校验。

岗位权重和题目内容均标记为 MVP 假设/草案，不是企划原文给出的精确数值。成员 A 需要审核产品文案，成员 B 负责保证结构、范围与计算约束稳定。

## 验证

```powershell
npm run db:build-imports
npm run db:validate
npm run check
```

`npm run db:build-imports` 会在 `database/imports/` 生成微信云数据库可直接导入的
NDJSON 文件（每行一个 JSON 文档）。其中 `work_trials.ndjson` 已将
`config/rubrics.v2.json` 的 0～5 Rubric 锚点合并到每条正式试岗配置。

## 【手动配置】在开发环境创建集合

在微信开发者工具云开发控制台中切换到：

```text
cloud1-d9g4vq6r057873c75
```

创建以下集合：

```text
roles
base_questions
work_trials
sessions
assessments
action_plans
feedback
events
```

初始权限全部设置为“仅管理员可读写”或等价的禁止客户端直接访问策略。当前架构只允许云函数访问数据库。

## 【手动配置】建立索引

逐项按照 `indexes.json` 在控制台建立索引。唯一索引优先建立：

- `roles.roleId`；
- `base_questions.questionId`；
- `work_trials.trialId`；
- `sessions.sessionId`；
- `action_plans.sessionId`。

其余组合索引用于会话查询、漏斗统计和按状态加载配置。

## 【手动配置】导入种子

在成员 A 审核文案、双方确认权重后：

1. 运行 `npm run db:build-imports`；
2. 将 `database/imports/roles.ndjson` 导入 `roles`；
3. 将 `database/imports/base_questions.ndjson` 导入 `base_questions`；
4. 将 `database/imports/work_trials.ndjson` 导入 `work_trials`；
5. 导入后核对数量分别为 6、8、3，并保留对应 `configVersion`。

不要把草案直接导入生产环境。生产环境只接受通过联调和内容审核的配置。

## 生产初始化说明

三个优先试岗、Rubric、NDJSON 导入文件和空环境自初始化已经包含。生产环境首次调用 `createSession` 时会创建 8 个集合，并仅在配置集合为空时写入 6/8/3 条配置，不覆盖已有数据。

集合权限和 `indexes.json` 中的索引仍需管理员在控制台核验；尤其是 `sessions.sessionId`、`assessments(sessionId, trialAttemptId)`、`events(sessionId, eventId)` 和 `action_plans.sessionId` 的唯一约束。当前内容仍为 MVP 探索假设，`reviewedByProfessional=false`。
