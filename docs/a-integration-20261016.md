# PathAI 成员 A 最新后端基线集成交付记录

日期：2026-10-16

## 1. 远程同步与分支

已成功执行 git fetch origin，origin/backend 从 e5a360c 更新至 f34b9a3af251032790d544b3eb8b12b30249039e（feat(backend): add v2 contract review package）。没有基于旧的远程跟踪状态开发。

从该最新提交新建本地 feature/a-integration-20261016，取消自动继承的 origin/backend 上游，避免误推 B 分支。没有合并其他分支，没有提交或推送。原 feature/a-integration-20261015@00fe595 和 feature/a-frontend@3dc0282 保留。

A 的既有前端从 00fe595 按目录移植，再依据 B 最新配置适配。没有整包恢复旧 app、project.config、package 或 tsconfig。

## 2. B 最新更新的八个文件

- database/config/preferences.v2.json：偏好仅影响岗位匹配的六岗位矩阵。
- database/config/rubrics.v2.json：六维 0～5 锚点，reviewedByProfessional=false。
- database/seeds/work_trials.v2.json：三个正式 trialId、每岗三道必答和一道选答。
- shared/contracts.v2.ts：可空能力状态、逐题请求、练习方向、planId、事件幂等与公开授权类型。
- shared/recommendation.v2.js：偏好岗位组件、追问缺失降级、有效观察合并、试岗答案校验及指纹逻辑。
- tests/recommendation-v2.test.mjs：v2 核心逻辑测试。
- scripts/validate-database.mjs：追加 v2 配置校验。
- docs/CONTRACT_V2_PROPOSAL.md：联审范围、降级权重、幂等和迁移顺序。

这些新增配置均是待共同审阅的提案，不是已冻结或已部署接口。B 的 getInitialRecommendation 与 scoreTrial 目录仍只有 .gitkeep，不能宣称真实 AI 已接通。

## 3. 公共文件以 B 为基线的处理

完全保留 B 版本：miniprogram/app.ts、app.wxss、sitemap.json、config/environment.ts、miniprogram/shared/contracts.ts、project.config.json、package-lock.json、tsconfig.json、eslint.config.js、格式化配置，以及全部 cloudfunctions/shared/database/tests 和 B 的 scripts 文件。

最小必要调整：

| 文件 | 调整 |
|---|---|
| miniprogram/app.json | 保留原 home/index 和全部窗口配置，仅注册六个 A 页面 |
| package.json | 保留 B 名称、引擎、依赖及检查链；追加前端测试/结构/配置同步脚本，原后端测试继续执行 |
| .gitignore | 在 B 原规则后追加 DevTools 编译 JS、map、前端构建缓存及本地私有配置忽略 |
| README.md | 保留 B 原说明，新增当前集成状态与报告入口 |
| pages/home/index.* | 在 B 原首页路径接入 A 的开始/恢复/隐私/反馈功能，保留 B title/subtitle；没有增加 home/home |

A 视觉样式放入 styles/frontend.wxss，由各页 WXSS 引用；没有覆盖 B 的全局 app.wxss。TypeScript 严格选项（包括 noUncheckedIndexedAccess、exactOptionalPropertyTypes）未放宽，A 代码已适配。

## 4. 十项修改要求落地对照

| 要求 | 实际代码与边界 |
|---|---|
| 1 偏好只参与岗位匹配 | services/v2-contract.ts 将单选转成 preferredApproach；不生成六维分数。数值矩阵保留 B 配置，不在前端另写算法；初步推荐 v2 请求完整类型仍待 B |
| 2 B 八题与六岗位 | scripts/sync-frontend-config.mjs 从 B 当前种子生成 config/backend-content.ts；题目 ID/选项/文案与 B 一致，岗位简介来自 B；不导出分数/权重到展示快照；页面明确 MVP 假设、非专业测评 |
| 3 逐题提交 | buildTrialRequest 生成三个必答与可选题的 questionId→answer，稳定 trialAttemptId，拒绝未知字段和空必答；试岗页通过 services 提交 Mock 请求，不上传或分析答案 |
| 4 三个正式试岗 | 显式映射实际 ui-trial-data/operations/research 到 B 三个正式 trialId，题目与输入提示来自 B；保留 A 原工作材料。Rubric 锚点不在客户端实现，不擅自标记专业复核或双方冻结 |
| 5 可空能力观察 | 直接消费 shared/contracts.v2 的联合类型；运行时校验 observed 证据/分数，not_observed/unavailable 必须为 null；结果页支持这些状态，不能把技术失败当 0 |
| 6 有效观察与降级 | 有效分平均由 B shared/recommendation.v2.js 负责；前端不复制评分。模拟评分降级保留初步顺序，不把失败作为 0 产生下降；服务端未覆盖维度保留与权威评分链仍需 B 完成 |
| 7 优先练习方向 | 结果页最多两项固定示例方向，显示证据与建议，不宣称岗位目标差距；共享字段 PracticePriorityV2 保留 B 语义 |
| 8 本地计划状态 | 增加 planId；同会话同试岗同 planId 重读保留勾选，用户确认重新生成使用新 ID 并重置；重开/改答使后续计划失效，不新增云端写接口 |
| 9 事件幂等与隔离 | formal-events.ts 持久化 eventId、mode 与 trialAttemptId；相同事件重试复用 ID，重新试岗新 ID，页面返回不重复。六个事件接在实际里程碑；当前 mode 固定 mock，v2 未部署时仅本地草稿，不向 v1 降级发送 |
| 10 公开使用同意 | 首页独立自愿选择，默认 false，带 textVersion；只涵盖文字反馈、不包含截图。选择公开时生成 v2 请求但明确阻止未部署调用；取消后可走 v1 普通反馈，不把普通反馈当公开授权 |

旧画像缓存保留在 pathai.frontend.session.v1，新题库使用独立的 v2 缓存键。不能将旧题答案按序转换后评分；页面提示重新作答。删除本地体验会清除新旧画像及本地事件草稿，云端删除凭据仍保留供单独删除。

## 5. 七页与真实接入状态

首页 → B 八题展示/状态目标偏好 → 两轮 B 预设题固定演示 → 三个固定推荐 → 三岗任选试岗 → 固定证据、顺序变化、六维状态/练习方向 → 七天任务和本地进度。

三个岗位均保留场景、材料、三个必填与可选回答、4 分钟软计时、草稿、必填校验、防重提交、15 秒 Mock 超时、错误/空/重试/降级。正式题目 ID 与前端字段已对齐，序列化请求可通过 B 的 v2 答案校验器。

真实评分结果没有展示。当前推荐、证据、顺序变化、计划均明确为固定 Mock；只有用户主动使用联调入口才尝试 v1 支持接口。B 的 app.ts 会按原实现初始化其开发云环境，此行为未删除。

## 6. 实际检查

- 使用 B package-lock 执行 npm ci --ignore-scripts，成功安装依赖，没有更新锁文件或引入新依赖。
- 最终完整 npm run check 全部通过：B 数据库 v1/v2 校验、34 个后端测试、47 组前端逻辑、严格 TypeScript、七页 JSON/结构、ESLint、Prettier。
- 前端新增检查含：配置快照一致性、逐题请求与 B 校验器交叉测试、attempt 幂等、可空能力、降级不改推荐、planId 保留/重置、事件 ID 持久化与模式隔离、授权默认值和未部署阻断、旧缓存保护及六事件完整流程。
- 首轮完整检查仅格式检查发现一个 A 文件需调整，已格式化后复查；没有降低 B 检查规则或改动 B 测试。
- Node 24.19.0；执行 npm CLI 为本机 10.9.7，B packageManager 中 npm 11 声明保持不变，未修改系统 Node/npm 或全局 Git 配置。
- 没有微信开发者工具、模拟器、真机或真实 AI 验收结论。静态 WXML 检查不能替代开发者工具编译。

## 7. 仍由 B 阻塞的项目

1. v2 明确尚未部署；没有 getInitialRecommendation/scoreTrial 的云入口或真实 AI Provider。需要完成部署与权威 Schema 后才可真实联调。
2. shared/contracts.v2.ts 尚缺完整初步推荐请求/响应、评分响应及统一 v2 外壳；GetActionPlanDataV2 只有 planId/roleId/practicePriorities/progressStorage，没有七天 items，不能据此渲染真实计划。
3. v1 feedback/events 不能记录 publicationConsent/eventId/mode/attempt；不能把新字段发给旧接口后宣称授权、隔离或幂等已实现。
4. B 的 legacyUiId 值与 A 实际旧 ID 不符；前端已显式映射，需 B 修正文档提案，不修改其文件。
5. 偏好矩阵、Rubric 样本及降级规则仍待共同联审；前端没有擅自将 draft 标记为 frozen，也没有专业审阅证据。
6. 会话恢复、创建超时幂等、删除令牌恢复、全量/并发删除和服务端事件唯一约束仍需 B 实现与验证。
7. 公开授权撤回渠道及版本规则需要正式上线文案，未提供渠道前不能依赖当前文案开展公开材料采集；截图需要独立同意。

## 8. 人工验收步骤

1. 切到当前本地分支，导入 D:\wx_project\WeChat-mini-program 根目录。保留 B 的 AppID、云目录与 TypeScript 插件；首页应为 pages/home/index，app.json 恰好七页。
2. 在开发者工具编译，检查 WXML/WXSS 和 console。完整走八题与两轮追问；旧缓存应提示重新作答，不能静默套用。
3. 三个岗位分别检查材料、B 最新问题、必填、可选、软倒计时、重进、保存失败、重复提交和返回。没有真实 AI 评分标签。
4. 正常与降级场景分别看结果：正常是明确的固定变化脚本；降级保持初步顺序。能力未观察/不可用不能显示 0 分；练习方向最多两项。
5. 七天计划展开说明、勾选后重进，原 planId 保留进度；确认重新生成后新 planId 清零；切换会话或重开试岗不混用。
6. 首页反馈公开选择默认关闭。选择同意时明确显示 v2 未部署且不发送；取消后普通反馈经服务器确认才显示接收，不能视为公开授权。不要输入联系方式。
7. 用户主动同意事件记录后完成流程，本地事件含六个正式名称、mode=mock、eventId 和尝试 ID；不含正文。返回不重复、重试复用 ID、重新试岗新 ID。v2 未部署时无正式事件云调用。
8. v1 开发会话与删除需 B 确认部署/权限后测试：创建超时结果不明时阻止重复创建，失败不丢凭据，只有服务器确认才报告删除成功。
9. Android/iOS 各回归完整七页、键盘、小屏、弱网、后台、返回和清除。记录真实结果，不用自动化逻辑测试代替真机签署。

## 9. 交付边界

本轮已完成基于 B 最新代码的 A 前端移植、兼容及可独立实现的 v2 消费能力。受缺失/未部署接口阻塞的真实 AI、真实推荐、真实计划和服务端幂等不能宣布完成。

最终文件审查及空白检查通过，四份原始文档 SHA-256 与此前提供值一致。相对 B 基线共 7 个已跟踪文件修改、58 个新增/移植文件；均未暂存、未提交。HEAD 仍为 f34b9a3。

没有改动 B 核心后端、共享契约或配置数值，没有密钥、生产导出或伪造用户指标。没有自动提交、推送或创建 PR。完整文件清单见本目录的 a-integration-20261016-files.md。
