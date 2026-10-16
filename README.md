# PathAI 职业试岗舱

## 2026-10-16 前端集成状态

当前本地分支 `feature/a-integration-20261016` 基于最新 `origin/backend@f34b9a3`，保留 B 的入口与公共配置基础，接入 A 的七页前端。首页仍为 `pages/home/index`，没有第二套首页路径。

七页可运行固定 Mock 演示。B 的 v2 契约和配置仍为 `draft_for_joint_review`，推荐/评分云函数没有入口实现，真实 AI 尚未接通。逐题请求、可空能力状态、计划标识、正式事件与公开授权的前端消费逻辑已增加；未部署接口会明确阻止调用，不向 v1 静默发送不兼容字段。

执行 `npm run check` 会保留 B 的数据库、测试、严格类型、Lint、格式检查，并追加 A 的前端检查。配置来源更新后执行 `npm run sync:frontend`，生成的展示数据不包含评分映射或权重。

实际变更、检查结果与人工验收见 [10 月 16 日交付记录](docs/a-integration-20261016.md)。以下保留 B 原有工程与环境说明。

微信小程序原生 TypeScript + 微信云开发的比赛 MVP。核心流程：

```text
基础画像 → 最多两轮动态追问 → 三个初步岗位
→ 3～5 分钟模拟试岗 → 固定 Rubric 行为证据
→ 推荐变化 → 能力差距 → 七天职业实验
```

## 当前状态

- 工程骨架、TypeScript、ESLint、Prettier 已初始化。
- API 契约版本：`1.0.0`。
- `project.config.json` 已配置团队小程序 AppID：`wx4a941c83f95c10f2`。
- 当前开发云环境：`cloud1-d9g4vq6r057873c75`。
- 生产云环境已创建但尚未接入客户端自动切换；AI API 密钥尚未配置，且密钥不得提交到 Git。

## 环境要求

- Node.js 24 LTS
- npm 11
- 微信开发者工具稳定版
- Git 与 VS Code

## 开始开发

```powershell
npm install
npm run check
```

然后在微信开发者工具中选择本目录导入项目：

1. 使用拥有该 AppID 开发权限的微信账号登录；
2. 在微信开发者工具中开通/选择云环境；
3. 不要把 AppSecret 或 AI 密钥写入小程序代码、配置文件或 Git；
4. 云函数实现必须遵守 [接口契约](docs/API_CONTRACT.md)。

队友首次配置、微信权限、云环境、数据库、云函数和生产环境的手动步骤见 [配置指南](docs/SETUP_GUIDE.md)。

## 目录

```text
miniprogram/       小程序客户端
cloudfunctions/    微信云函数（每个函数独立安装生产依赖）
database/          集合清单、索引与可校验种子配置
shared/            稳定枚举与接口契约
docs/              企划、契约和协作文档
```

## 质量检查

```powershell
npm run typecheck
npm run lint
npm run format:check
```

## 安全规则

- 仅使用匿名 `sessionId`，不采集非必要个人信息。
- AI 评分必须通过固定 Schema，分数范围为 0～5，行为证据不能为空。
- AI 调用 15 秒超时，失败返回明确的模板化降级结果。
- 埋点禁止包含完整回答、联系方式或敏感画像。
- 用户删除记录时，应删除该会话关联的数据。
