# PathAI v2 共享契约与配置提案

日期：2026-10-15  
状态：`draft_for_joint_review`，**尚未冻结、尚未部署**

本提案落实成员 A 已确认的接口方向，并给出成员 B 负责提供的具体版本。由于包含不兼容变化，当前 v1 文件与已部署云函数保持不变；A/B 共同复核后再迁移云函数。

## 已落实的确认项

- 偏好仅参与岗位匹配，不写入六维能力观察。
- 正式试岗逐题提交：三道必答、一道选答；单题最多 1200 字；拒绝未知 `questionId`。
- 能力结果区分 `observed`、`not_observed`、`unavailable`；后两者为 `score: null`。
- 两轮均有效时取算术平均；仅一轮有效时保留该轮；证据合并去重。
- AI 失败不再用技术占位 0 分，也不改变初步推荐。
- 行动建议统一为 `practicePriorities`，最多两项；计划完成状态仅保存在本机。
- 正式埋点包含 `eventId`、`mode` 和可选 `trialAttemptId`，并限定六个正式漏斗事件。
- 反馈公开授权独立记录 `granted` 与 `textVersion`，默认应由客户端传 `false`。

## B 侧具体提案（等待 A 最终复核）

### 1. 偏好匹配矩阵

量纲为 0～5，转换为岗位组件分时乘以 20。`unsure` 对六岗位均为 3，不产生人为排序。具体数值见 `database/config/preferences.v2.json`。

此矩阵是 MVP 探索假设，不是职业测评常模。

### 2. 初步推荐降级算法

正常模式的岗位组件权重为：基础题 40%、偏好 30%、追问 30%。缺少有效追问时，不把缺失项当 0，而是在已有组件内按原比例归一化：

- 基础题：`4/7`（约 57.14%）
- 偏好：`3/7`（约 42.86%）
- 追问：0

响应必须同时返回 `status: degraded`、实际权重、`missingComponents: ["followup"]` 和 `comparableToFullScore: false`。

### 3. 正式试岗 ID

| 岗位 | 正式 trialId | A 侧旧 Mock ID |
|---|---|---|
| 数据分析 | `trial_data_signup_drop_v1` | `ui-trial-data-analyst` |
| 产品运营 | `trial_operations_reading_event_v1` | `ui-trial-product-operations` |
| 用户研究 | `trial_research_study_room_v1` | `ui-trial-user-researcher` |

正式题目 ID、必答规则及观察维度见 `database/seeds/work_trials.v2.json`。旧 Mock ID 不自动成为业务 ID。

### 4. Rubric

六维均提供 0～5 的可观察锚点，见 `database/config/rubrics.v2.json`。当前明确标记 `reviewedByProfessional: false`。A 需要确认试岗材料是否足以产生相应证据，双方还需共同审阅低、中、高样本后才能冻结。

### 5. 幂等与稳定标识

- `trialAttemptId + 回答指纹` 相同：返回原结果，不重复评分。
- 同一 `trialAttemptId` 的回答指纹不同：返回冲突，不静默覆盖；重新作答必须生成新 attempt ID。
- `eventId` 在会话内唯一，重试必须复用，服务端以唯一索引/事务去重。
- `planId` 由服务端生成。普通读取复用原 ID；只有用户确认 `regenerate: true` 时创建新 ID。
- 客户端的 `mode: real` 不能证明 AI 实际成功；真实 AI 使用量应以服务端评分成功记录为准。

## 本次未执行的手动事项

- 未上传或部署 v2 云函数。
- 未在 `cloud1` 新建/修改索引、权限和数据。
- 未改动微信开发者工具中的环境设置。
- 未将本提案标记为双方已冻结。

## 联审通过后的迁移顺序

1. A 审阅偏好矩阵、正式题目与 Rubric 样本。
2. 双方确认 v2 字段名、降级算法与冲突响应码。
3. B 将云函数改为 v2，实现数据库唯一约束与稳定 `planId`。
4. A 将前端由 Mock ID 切换到正式 ID，并实现本地计划进度。
5. 在开发环境部署、联调和回归；通过后再安排生产环境。
