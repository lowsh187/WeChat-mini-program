# 成员 A 10 月 7 日至 10 日补齐交付

日期：2026-10-10。实现范围是成员 A 的原生 TypeScript Mock 前端。正式 AI、真实评分、后端数据库与共享契约冻结不在本次交付内。

## 分阶段结果

1. 基础画像 Bug 复核：根因是旧版 `wx:if="!ready"` 漏写 `{{ }}`，空会话分支恒真。当前源码已包含上次最小修复，本轮未再次改动这项绑定；开始按钮、store 重置、setData、存储读写异常和草稿恢复回归通过。阶段检查：15 组。
2. 10 月 9 日流程：两个固定预设追问通过服务层读取；支持输入、必填、800 字上限、提交、上轮返回/修改、进度和草稿恢复、加载/空/错误/重试/15 秒模拟超时/降级。移除主流程追问跳过，推荐需画像与两轮完成；首页预览不伪造完成状态。阶段检查：17 组。
3. 10 月 10 日试岗：三岗位选择、材料、三项核心任务、可选预设补充、1200 字输入、必填、4 分钟软倒计时、本地保存、重复提交防护、加载/空结果/错误/重试/15 秒降级/返回/重试岗。结果显示独立示例作答的固定行为证据、表现与改进建议。阶段检查：23 组。
4. 质量与交接：补充旧缓存兼容、追问返回编辑与隐藏响应、存储失败回归；保持原始文档与公共配置；更新 README、交接记录和人工清单。最终检查：26 组。

## 页面输入、输出与状态（10 月 7 日设计补齐）

| 页面 | 输入与主要操作 | 输出及边界 |
|---|---|---|
| 首页 | 开始、继续、重置确认、示例预览、清除确认 | 根据本地步骤恢复；明确全流程 Mock |
| 基础画像 | 状态/目标/偏好单选、8 题、上下题与未答提示 | 本地草稿与进度；不计算分数；进入追问 |
| 动态追问 | 两轮固定题、答案、提交、上轮修改与重试 | 本地完成轮数；不进行 AI 选择或映射；进入推荐 |
| 初步推荐 | 正常主流程或首页预览、异常场景验收、选择岗位 | 固定三个岗位及演示依据/岗位维度；无虚假个性化 |
| 职业试岗 | 选择岗位、开始、读材料、三个必填回答、可选补充、提交/重新试岗 | 单个本地草稿与软计时；不调用 AI、不评分 |
| 试岗结果 | 完成后的固定 Mock 结果 | 固定示例作答、证据、表现与建议；推荐变化未计算；计划入口占位 |
| 七天计划 | 导航入口 | 明确未实现，返回首页；不生成虚假任务或完成状态 |

这些页面模型和 ui-* ID 为前端内部草案，不是冻结 ViewModel/共享业务契约。双方契约冻结尚需完成。

## 三个试岗内容与稳定演示样本

| 岗位 | 材料与核心任务 | 示例证据关注点 |
|---|---|---|
| 数据分析 | 两周访问/开始报名/完成报名数据与两项变更；找异常、提候选原因、说明补充数据 | 引用事实定位报名后段；区分原因假设与验证路径 |
| 产品运营 | 活动曝光/报名/到场情况、三条反馈与 A/B/C 三方案；提主要问题、选优先方案、安排验证 | 反馈与环节对应；行动与到场率观察相连 |
| 用户研究 | 五条自习室访谈；归纳需求、分开事实与假设、提出开放验证问题 | 从访谈归纳可信信息需求；不把预约功能当作已知需求 |

每个试岗配置 240 秒，目标 3～5 分钟。材料为虚构文本、长度检查通过，但真实阅读耗时、材料不超过一屏半和专业代表性仍需人工/专业审阅。内容依据原企划的三个岗位设计，无新岗位或 Rubric。

三组示例作答与固定证据均存于 `miniprogram/mocks/work-trials.ts`，与用户回答无关。所有结果页顶部明确这一点。未制定评分区间、数值表现、权重、Rubric 或推荐变化。结果字段的本地完整性检查只服务于 Mock 展示，不替代 B 的服务端 Schema。

## 本轮实际文件修改

修改 25 个已有文件（相对于本轮开始时的文件内容，不等于 Git 已跟踪状态）：

- README.md
- docs/interface-open-questions.md
- miniprogram/app.wxss
- miniprogram/models/frontend.ts
- miniprogram/store/session.ts
- miniprogram/services/index.ts
- miniprogram/services/mock-provider.ts
- miniprogram/pages/home/home.ts
- miniprogram/pages/home/home.wxml
- miniprogram/pages/profile/profile.ts
- miniprogram/pages/profile/profile.wxml
- miniprogram/pages/followup/followup.ts
- miniprogram/pages/followup/followup.wxml
- miniprogram/pages/followup/followup.json
- miniprogram/pages/initial-result/initial-result.ts
- miniprogram/pages/initial-result/initial-result.wxml
- miniprogram/pages/work-trial/work-trial.ts
- miniprogram/pages/work-trial/work-trial.wxml
- miniprogram/pages/work-trial/work-trial.wxss
- miniprogram/pages/work-trial/work-trial.json
- miniprogram/pages/trial-result/trial-result.ts
- miniprogram/pages/trial-result/trial-result.wxml
- miniprogram/pages/trial-result/trial-result.json
- scripts/check-structure.cjs
- scripts/test-logic.cjs

新增 4 个文件：

- miniprogram/mocks/followup-questions.ts
- miniprogram/mocks/work-trials.ts
- miniprogram/utils/trial-clock.ts
- docs/a-frontend-stage-20261010.md（本文件）

四份原始文档内容与本轮开始时的 SHA-256 相同。project.config.json、package.json、package-lock.json、tsconfig.json、.gitignore 没有改动；保留用户已配置的 AppID。无依赖新增，无 shared/cloudfunctions 变更。

## 自动化检查

最终执行 `npm run check`：TypeScript `tsc --noEmit` 通过；13 个 JSON、七页四文件、路由、事件绑定、条件表达式与基础 WXML 标签嵌套检查通过；26 组逻辑测试通过。`git diff --check` 通过。

新测试覆盖主流程导航、追问两轮上限/跳过与重复提交拒绝、草稿恢复、修改使结果失效、五类场景、三个完整试岗页链路、证据不引用用户回答、倒计时后台恢复/到零、隐藏/旧会话/重试岗后的过期响应、不完整证据拒绝、旧版缓存迁移和存储失败提示/重试。

微信 API、timeout/interval 在 Node 中使用替身；计时器测试检查 15000ms 参数与降级流程，不声称进行了真实 15 秒等待。WXML 静态检查不是微信开发者工具编译。用户此前已完成初步导入/首页编译，本轮新增代码的模拟器、真机与专业审阅未执行。

## 微信开发者工具人工验收

1. 在 feature/a-frontend 上重新编译现有项目，保留已配置的团队 AppID。若仍看到旧“开始新的本地体验”界面，先重新编译；必要时清除工具编译缓存，区分编译缓存与答题数据缓存，不默认删除已有答案。
2. 首页开始探索，填写三个起点选项；未选题时下一题有提示；完成 8 题，上一题回显；返回首页继续，关闭并重进恢复。
3. 直接进入无会话的画像页，点击开始按钮，应进入填写流程；在完整答案下提交应进入追问，不能直接进入推荐。
4. 第一轮追问空答案提交有提示；输入后提交至第二轮，完成后恰好三个 Mock 推荐；回追问修改首轮应重新确认后续轮次。返回但不修改已答内容应能继续保存进度。
5. 在追问/推荐页面选择五种场景，验证空/错重试和降级文案；timeout 实际等待约 15 秒后显示模板。等待中返回，旧响应不能覆盖新页。
6. 从三个推荐分别进入数据分析、产品运营、用户研究。开始后计时 4 分钟，三项任务必填，可选补充可空；阅读与输入体验目标 3～5 分钟。检查材料不超过一屏半，必要时调整布局。
7. 回答后返回首页继续或关闭重进，答案与计时恢复；后台时间计入。到 0:00 仍保留答案、可补充提交，不自动提交。
8. 提交时连续点击只产生一次本地提交；依次试 error/empty 场景，草稿保留且正常重试能完成；degraded/timeout 结果明确模板来源。点击“按场景读取材料”验证材料空/错状态。
9. 结果页显示独立示例作答、固定证据/表现/建议，明确不等于用户评价；没有数值分数或推荐变化。返回试岗，再确认重新试岗，清空试岗答案并重新计时。
10. 试岗切换时确认草稿覆盖提示；只保存一个试岗草稿。首页预览不创建答题会话，未完成画像和追问不可开始试岗。
11. 调试器临时模拟存储不可读/写入失败，确认有可理解的提示与重试保存，内存草稿不会丢失；存储恢复后重试，提示消失。自动故障注入测试已覆盖，此项 UI 需人工看见提示。
12. Android/iOS 真机检查键盘、长文输入、滚动、按钮防重、字体、安全区、返回栈；七天计划入口应继续明确占位。

## 未完成与成员 B 待确认

未完成：真实 AI、正式 Rubric/权重/评分与 Schema、真实动态选题、推荐变化、完整七天计划、云端删除/同步、埋点/反馈、真机回归、从业者审阅与真实用户验证。10 月 7 日契约联合冻结未由本轮替代。

B 需确认正式 ID/枚举、题库与配置版本、所有输入输出及错误/降级、session 同步/过期/删除、重复提交幂等、正式试岗输入与追问时机、验证后评分/证据结构、计时语义、三个试岗内容与 Rubric、实际云函数名称/环境、AI 来源标识。详见 interface-open-questions.md。

## Git 状态

工作分支保持 feature/a-frontend。本轮没有暂存、commit、push、merge 或创建 PR。项目尚未提交，README 为已跟踪修改，其他代码/文档以未跟踪文件存在；最终状态以 git status 为准。没有修改 main、成员 B 分支、后端或未冻结共享契约。
