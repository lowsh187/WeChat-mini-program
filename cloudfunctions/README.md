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
- `selectFollowup`：已实现固定题库选择、最多两轮、会话所有权/过期校验和防重复选题。追问题文案属于建议配置，需成员 A 复核。
- 其余函数：目录骨架，尚未实现。
