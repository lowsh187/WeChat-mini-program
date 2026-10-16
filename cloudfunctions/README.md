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
- `getInitialRecommendation`：已实现并部署 v2 请求校验、基础题能力观察、偏好岗位组件、追问 AI 证据提取、明确降级权重、Top 3 推荐和评估持久化。
- `scoreTrial`：已实现并部署 v2 逐题校验、回答指纹、尝试幂等/冲突拒绝、AI Rubric 输出校验、15 秒超时、一次重试、不可用状态、45/55 有效观察合并、推荐重算和评估持久化。

`createSession` 会在空环境首次调用时创建 8 个集合并写入 6 条岗位、8 道基础题和 3 个试岗配置。索引、集合权限、AI 环境变量和函数超时仍必须由管理员在控制台核验。

## AI Provider 配置

两个 v2 AI 云函数仅从服务端环境变量读取配置：

- `AI_API_KEY`：服务端密钥；不得写入仓库、客户端或日志。
- `AI_BASE_URL`：OpenAI-compatible HTTPS Chat Completions 完整地址。
- `AI_MODEL`：服务端模型名称。

仓库不提供真实值。密钥设置、Provider 地址/模型确认、云函数依赖安装与上传均属于部署步骤。未配置时函数返回明确降级，不会把技术失败记作 0 分。
