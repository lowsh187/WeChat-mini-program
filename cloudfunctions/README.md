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
- `selectFollowup`：已实现固定题库选择、最多两轮、会话所有权/过期校验、服务端防重复选题和同轮幂等返回。追问题文案属于建议配置，需成员 A 复核。
- `shared/recommendation.js`：已实现基础题六维计分、AI 映射 Schema 校验、固定 40/30/30 合成和岗位权重 Top 3 排序纯函数；偏好答案与追问答案如何转换为六维输入仍待契约确认。
- `shared/trial-scoring.js`：已实现 Rubric 输出校验、15 秒超时、一次安全重试、明确降级和固定 45/55 试岗后重算核心；真实 AI Provider 与试岗内容仍待配置。
- `getActionPlan`：已实现会话校验、能力差距排序、确定性七天计划和数据库幂等写入。
- `submitFeedback`：已实现会话校验、固定岗位校验、联系方式拦截和匿名反馈写入。
- `trackEvent`：已实现安全事件标识符、耗时范围校验和不接受完整回答正文的匿名埋点。
- `deleteSession`：已实现所有权与删除令牌校验，并清理会话关联的评分、计划、反馈和事件。
- `getInitialRecommendation`、`scoreTrial`：云函数入口尚未完成；前者等待输入契约确认，后者等待试岗配置及 AI Provider。
