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
npm run db:validate
npm run check
```

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

1. 将 `roles.json` 中的 `roles` 数组导入 `roles`；
2. 将 `base_questions.json` 中的 `questions` 数组导入 `base_questions`；
3. 为每条文档补充云数据库时间字段 `createdAt`、`updatedAt`；
4. 将已审核文档状态从 `draft` 改为 `active`；
5. 保留 `configVersion: 1.0.0`。

不要把草案直接导入生产环境。生产环境只接受通过联调和内容审核的配置。

## 尚未包含

- 三个优先试岗与 Rubric 种子，等待成员 A 的内容输入；
- 自动导入脚本，等待云端身份与权限方案确认；
- 数据库实际集合、权限和索引，需在控制台操作并截图留档；
- 生产环境初始化，候选版验收前不执行。
