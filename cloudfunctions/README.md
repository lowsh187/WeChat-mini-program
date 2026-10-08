# 云函数目录

计划中的云函数：

- `createSession`
- `selectFollowup`
- `getInitialRecommendation`
- `scoreTrial`
- `getActionPlan`
- `submitFeedback`
- `trackEvent`
- `deleteSession`

实现前必须遵守 `docs/API_CONTRACT.md`。每个函数独立维护生产依赖，不得把 AI 密钥提交到仓库。

## 当前实现状态

- `createSession`：已实现匿名会话、输入校验、所有者哈希、删除令牌和 8 天过期时间。
- 其余函数：目录骨架，尚未实现。
