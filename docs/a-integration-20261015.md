# 成员 A 集成审查与 P0 交付记录（2026-10-15）

## 交付结论

七页 Mock 主流程已形成闭环：画像 → 两轮追问 → 三个推荐 → 三岗位任选其一试岗 → 固定示例证据 → 推荐顺序变化 → 六维卡片 → 七天计划勾选与恢复。

真实 AI 试岗仍被后端缺失阻塞。本次没有调用真实云环境，没有宣称真实 AI 或真机已验收。没有提交、推送或创建 PR；等待人工检查。

## Git 实际审查

- 起始分支 feature/a-frontend，HEAD 为 3dc0282738a3b769f88c6cd9e1976eb0fac2c3b0，工作区干净。
- 已执行 status、branch -avv、remote -v、fetch origin、log --all --oneline --decorate -30。
- origin 指向 https://github.com/lowsh187/WeChat-mini-program.git。
- fetch 发现 origin/backend（e5a360c），origin/main 更新至 3b31fda；origin/feature/a-frontend 仍为 3dc0282。未发现 develop。
- 在原 A 提交上创建本地 feature/a-integration-20261015；没有更改原 A、main 或 B 分支。
- gh 未安装；GitHub 连接器 PR 查询返回 422（无权搜索该仓库），不能断言没有开放 PR，需仓库所有者在 GitHub 核实。
- 使用只读 merge-tree 预览确认公共文件冲突，停止整分支合并；未进入 MERGING 状态，也未复制 B 的后端或 shared。
- 冲突文件：.gitignore、README.md、miniprogram/app.json、app.ts、app.wxss、sitemap.json、package.json、package-lock.json、project.config.json、tsconfig.json。
- 双方基础题、偏好及试岗输入模型未对齐；不能只通过改 ID 将 A 的演示答案作为 B 的正式评分输入。

## B 的新增提交与文件

| 提交 | 日期 | 实际内容 |
|---|---|---|
| 9771346 | 10-08 | 数据库 manifest、indexes、roles/base_questions 种子 |
| ab23df3 | 10-08 | createSession 云函数、匿名凭据、过期时间与测试 |
| 9479583 | 10-09 | TypeScript 编译插件配置 |
| 9a6ffde | 10-09 | selectFollowup 固定题库与选择逻辑 |
| 38607eb | 10-09 | shared/recommendation.js 初步推荐纯函数与测试 |
| d4837f6 | 10-12 | 试岗评分纯函数；计划、删除、反馈、事件云函数及测试 |
| e5a360c | 10-15 | shared/observability.js、指标汇总脚本与监控回滚手册 |

主要文件组：

- cloudfunctions/createSession、selectFollowup、getActionPlan、deleteSession、submitFeedback、trackEvent 各有 index.js、logic.js 和依赖清单；计划另有 plan.js。
- cloudfunctions/getInitialRecommendation/.gitkeep、cloudfunctions/scoreTrial/.gitkeep：只有占位，没有可部署的入口实现。
- shared/contracts.ts、database.ts、recommendation.js、trial-scoring.js、action-plan.js、content-safety.js、observability.js。
- database/manifest.json、indexes.json、seeds/roles.json、seeds/base_questions.json 及 README。
- tests 下的会话、追问、推荐、评分、计划、内容安全、支持接口、指标测试及 fixtures。
- docs/API_CONTRACT.md、SETUP_GUIDE.md、SECURITY_NOTES.md、MONITORING_AND_ROLLBACK.md；另外包含旧企划/其他项目文档，不直接并入 A。
- 根目录配置、依赖、lint/format 配置、开发云环境配置，以及一套不同的首页骨架。

B 文档声明契约/配置版本均为 1.0.0，权威类型在其 shared/contracts.ts。云端有评分/推荐纯逻辑及模板，不等于已有真实 AI Provider 或完整评分接口。未发现可调用的真实 AI 实现，也没有部署与真机证据。

## 七页状态

| 页面 | 当前程度 |
|---|---|
| 首页 | 原开始/恢复/预览；新增隐私说明、反馈、云端会话/删除联调、显式同意匿名事件；有计划时继续到计划 |
| 基础画像 | 保留状态/目标/偏好、8 题、校验、前后题、恢复与重开；原按钮条件绑定回归继续通过 |
| 动态追问 | 保留两轮固定 Mock 问答、草稿、进度及异常状态；真实追问只有适配测试，未切换页面 |
| 初步推荐 | 保留三个固定推荐、依据与维度，不添加虚假的个性化分数 |
| 职业试岗 | 数据分析/产品运营/用户研究，均有材料、3 个必填任务、可选补充回答、4 分钟软倒计时、提交/防重复/异常处理 |
| 试岗结果 | 新增三个岗位的前后顺序、变化解释与固定证据；六维文字卡片，未覆盖维度明确不评价；无数值评分 |
| 七天计划 | 完整有序模板、说明展开、勾选/取消、进度、本地恢复、返回；会话/试岗修订关联；重开/改答使旧计划失效；Mock 验收场景与重试/降级 |

三个试岗继续使用原有内容，未扩展新岗位、评分公式或 Rubric。前后顺序为按岗位预置的固定脚本，不从回答计算。

## 服务边界与真实模式状态

| 接口 | 前端完成度 | 真实联调 |
|---|---|---|
| createSession | 显式同意后调用，保存本地会话关联与删除凭据；超时结果不明时阻止重复创建，迟到成功仍保存凭据 | 未执行 |
| 会话恢复 | 仅恢复已有本地凭据；无云端状态恢复接口 | B 阻塞 |
| selectFollowup | 按 B 轮次/请求及固定题目 ID、维度检查返回；不上传 Mock 证据 | 仅适配测试，未接页面 |
| getInitialRecommendation | 云函数为空，未编造替代接口 | B 阻塞，页面 Mock |
| scoreTrial/推荐变化 | 云函数为空，未接收 AI 原始评分 | B 阻塞，页面 Mock |
| getActionPlan | 支持 B 请求/响应结构检查；缺少真实评分差距时拒绝调用 | B 阻塞，页面 Mock |
| submitFeedback | 主动提交帮助度及可选文本；带 Mock 演示标识；拒绝明显联系方式；防重复点击，未确认时不显示成功 | 未执行 |
| trackEvent | 主动同意后串行发送 mock_progress 步骤；不含回答、偏好、身份；换会话/关闭后停止 | 未执行 |
| deleteSession | 只在 success 且 accepted=true 后反馈成功；失败保留凭据；云端与本地删除分开 | 未执行 |

所有 wx.cloud 调用集中在 services/cloud-adapter.ts。开发环境 ID 来自 B 的 API_CONTRACT，不是生产配置；仅用户主动联调时初始化。响应必须版本匹配且结构有效；这些已实现的支持函数要求 aiGenerated=false，不将其包装为 AI 评分。

云调用设 15 秒客户端等待上限，不自动重发有副作用请求；超时后保留在途防重复限制直到原请求结束。真实会话创建缺少服务端幂等/恢复，结果不明时需 B 核实。当前匿名事件不是正式漏斗计数，反馈也明确注明 Mock 体验。

## 实际变更文件

修改：README.md、docs/interface-open-questions.md、miniprogram/models/frontend.ts、store/session.ts、services/index.ts；home、trial-result、action-plan 页各自的 TS/WXML；scripts/check-structure.cjs、test-logic.cjs。

新增：本报告；miniprogram/mocks/next-steps.ts；services/cloud-adapter.ts、cloud-session.ts、telemetry.ts。

根目录配置 package.json、package-lock.json、tsconfig.json、.gitignore、project.config.json 及 AppID 未变。没有修改 cloudfunctions/、shared/、四份原始 Markdown。四份 SHA-256 再次与用户提供值一致。

## 自动化验证

- npm run check：通过，包含 TypeScript、13 个 JSON、七页四文件、路由、绑定/事件与基础标签检查，以及 37 组逻辑回归。
- 新回归覆盖：三岗位固定变化/六维、七天顺序/保存/恢复/失效、空/错/超时/降级、存储失败、隐藏与旧响应丢弃、重复点击、云响应版本/Schema、删除未确认、匿名事件权限、七页完整主流程。
- 原有画像按钮 WXML 条件绑定回归持续通过，没有重新引入裸字符串条件。
- 在临时隔离快照运行 origin/backend@e5a360c 的 node --test tests/*.test.mjs：29/29 通过；数据库种子/manifest/index 校验通过。没有安装或执行 B 的整套 lint/format/TS 门禁，没有修改其代码。
- git diff --check 通过；新增文件单独空白检查通过。原始文档不需要格式化。
- TypeScript 和静态 WXML 检查不能替代微信开发者工具编译。没有模拟器、Android/iOS 真机、真实云函数或真实 AI 验收结论。

## 微信开发者工具人工验收

1. 保持 feature/a-integration-20261015，导入仓库根目录。依赖已存在时直接运行 npm run check；缺依赖时按锁文件安装。不要替换公共配置或导入 B 的另一套首页。
2. 编译，确认没有 WXML/WXSS 报错。首页开始探索；在画像空状态点击“开始新的本地体验”应立即出现状态/目标/偏好和第一题。未答时下一题/提交须提示。
3. 填完整 8 题，验证上一题、退出重进与本地恢复；完成两轮追问，不能跳到第三轮或绕过必填。
4. 推荐必须恰好三个岗位。分别完成数据分析、产品运营、用户研究的试岗；验证必填、重复提交、返回、软倒计时、后台重进。
5. 结果查看三岗位前后顺序、变化说明与证据。确认每处为固定演示标识，六维未覆盖项没有虚构评价。
6. 打开七天计划，展开说明、勾选第 1/4 天，返回首页继续、重新编译后恢复。开始新会话、修改基础答案、追问或重新试岗后旧计划不可混用。
7. 追问/推荐/试岗现有场景工具及计划页“按场景重新读取”：分别验收正常、空、错误、15 秒超时、降级。计划成功替换会重置勾选，失败保留原计划；等待时按钮防重入；切页后旧响应不写入。
8. 测试存储失败（开发工具调试环境模拟 API 失败），确认提示、内存进度、重试保存；本地删除须清除画像/回答/试岗/计划，不能显示云端已删除。
9. B 确认开发环境部署与账号权限后，首页主动同意创建匿名联调会话。验证取消不调用、成功保存凭据、重进不重复创建、超时不重复创建；不要清空删除凭据。
10. 主动提交反馈，验证帮助度必选、联系方式拒绝、等待禁用、成功须服务端确认、超时不重复发送。检查开发环境反馈注明 Mock，不计作真实 AI 用户证据。
11. 开启匿名步骤事件，走流程后在云端检查只有 mock_progress 和步骤/匿名会话；无完整回答/身份。关闭、换会话不再发送后续事件。正式漏斗事件需与 B 单独对齐。
12. 删除云端记录，验证取消、成功、断网、超时、失败重试，并由 B 查询关联集合确认实际删除。只有 B 的 success+accepted 才显示成功。云端计划按钮当前必须提示缺少真实评分，不能拿 Mock 能力凑参数。
13. Android/iOS 各走完整流程，覆盖小屏、键盘遮挡、后台返回、弱网、重进、删除。上述结果均需人工记录，不能由本报告代签。

## B 需要立即处理的事项

1. 完成可部署的 getInitialRecommendation 和 scoreTrial，以及真实 AI Provider、密钥安全配置、服务端 Schema、Rubric 与对应稳定 fixtures。先交付一个岗位的真实闭环。
2. 共同确认 8 题/选项/偏好和试岗 ID、试岗文本与请求 answer 的映射，确认六维和岗位分数单位、排序/变化解释来源。不能仅改 A 的演示 ID 后上传。
3. 提供会话恢复、过期和删除令牌恢复、创建/评分/反馈幂等语义；创建超时后仅靠客户端无法安全判定是否已创建。
4. getActionPlan 要求真实 gaps，需提供真实评分输出；当前不能联调计划生成，不能传空数组或伪造差距。
5. 确认开发/生产环境、团队权限、云函数部署版本及接口冒烟记录；只看到代码不能证明部署成功。
6. 验证删除覆盖所有关联记录，含超过数据库单次删除上限的数据；明确删除与事件/反馈并发写入、部分成功、二次删除的语义。
7. 对齐 Mock/真实数据隔离、默认正式漏斗事件名、耗时口径与隐私保留期限。当前 mock_progress 不进入默认正式漏斗。
8. 双方人工解决公共配置冲突：保留 A 七页，合入 B 云目录配置/测试入口；统一 Node/npm/依赖，不覆盖整个配置文件。B 声明 Node 24/npm 11，A 旧环境记录为 Node 22/npm 10。

## 封版前仍未完成

真实 AI 评分及真实推荐闭环、云端状态恢复、真实计划生成、正式漏斗统计、生产环境与删除链路验证、开放 PR 核实、Android/iOS 验收与微信审核。还需真实用户/访谈记录、20 人完成证据、PDF、90 秒视频、截图、小程序码、授权及 AI/第三方说明。没有生成或伪造任何用户指标、访谈或审核结果。

最终状态：本地 feature/a-integration-20261015，HEAD 仍为 3dc0282；改动全部未暂存、未提交。没有自动推送、合并或创建 PR。
