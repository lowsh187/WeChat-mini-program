# 2026-10-16 A 前端实际文件清单

基线：origin/backend@f34b9a3。新增包含从 A 已提交版本移植的文件，不代表全部是本日新功能。B 后端、契约及配置数值未改。

## 修改（在 B 最新版本基础上）

- .gitignore
- README.md
- miniprogram/app.json
- miniprogram/pages/home/index.ts
- miniprogram/pages/home/index.wxml
- miniprogram/pages/home/index.wxss
- package.json

## 新增或从 A 分支移植

- docs/01-开发环境与依赖.md
- docs/02-双人并行开发计划.md
- docs/03-角色职责与个人任务.md
- docs/a-frontend-stage-20261008.md
- docs/a-frontend-stage-20261010.md
- docs/a-integration-20261015.md
- docs/a-integration-20261016-files.md
- docs/a-integration-20261016.md
- docs/interface-open-questions.md
- miniprogram/config/backend-content.ts
- miniprogram/config/runtime.ts
- miniprogram/mocks/base-questions.ts
- miniprogram/mocks/followup-questions.ts
- miniprogram/mocks/initial-recommendation.ts
- miniprogram/mocks/next-steps.ts
- miniprogram/mocks/roles.ts
- miniprogram/mocks/work-trials.ts
- miniprogram/models/frontend.ts
- miniprogram/models/observations.ts
- miniprogram/pages/action-plan/action-plan.json
- miniprogram/pages/action-plan/action-plan.ts
- miniprogram/pages/action-plan/action-plan.wxml
- miniprogram/pages/action-plan/action-plan.wxss
- miniprogram/pages/followup/followup.json
- miniprogram/pages/followup/followup.ts
- miniprogram/pages/followup/followup.wxml
- miniprogram/pages/followup/followup.wxss
- miniprogram/pages/initial-result/initial-result.json
- miniprogram/pages/initial-result/initial-result.ts
- miniprogram/pages/initial-result/initial-result.wxml
- miniprogram/pages/initial-result/initial-result.wxss
- miniprogram/pages/profile/profile.json
- miniprogram/pages/profile/profile.ts
- miniprogram/pages/profile/profile.wxml
- miniprogram/pages/profile/profile.wxss
- miniprogram/pages/trial-result/trial-result.json
- miniprogram/pages/trial-result/trial-result.ts
- miniprogram/pages/trial-result/trial-result.wxml
- miniprogram/pages/trial-result/trial-result.wxss
- miniprogram/pages/work-trial/work-trial.json
- miniprogram/pages/work-trial/work-trial.ts
- miniprogram/pages/work-trial/work-trial.wxml
- miniprogram/pages/work-trial/work-trial.wxss
- miniprogram/services/cloud-adapter.ts
- miniprogram/services/cloud-session.ts
- miniprogram/services/formal-events.ts
- miniprogram/services/index.ts
- miniprogram/services/mock-provider.ts
- miniprogram/services/telemetry.ts
- miniprogram/services/v2-contract.ts
- miniprogram/store/session.ts
- miniprogram/styles/frontend.wxss
- miniprogram/utils/navigation.ts
- miniprogram/utils/storage.ts
- miniprogram/utils/trial-clock.ts
- scripts/check-structure.cjs
- scripts/sync-frontend-config.mjs
- scripts/test-logic.cjs
