# PathAI · AI 职业试岗舱

成员 A 截至 2026-10-10 的原生微信小程序 Mock 前端。所有推荐与试岗证据均为固定演示数据，非真实 AI 评估；没有实现评分公式、题目维度映射、岗位权重、Rubric 或真实云端调用。

当前主流程：首页 → 状态/目标/偏好与 8 道题 → 两轮 Mock 预设追问 → 固定三个岗位 → 选择数据分析/产品运营/用户研究 → 4 分钟试岗 → 固定示例证据。主流程不再跳过追问；首页的推荐示例预览独立于答题进度，未完成画像与追问只能浏览试岗材料。七天行动计划仍为明确占位。

本次交付记录与人工验收见 `docs/a-frontend-stage-20261010.md`。四份原始项目文档保持不变；10 月 8 日交付文档保留为历史记录。

## 微信开发者工具导入

1. 确认 Git 分支为 `feature/a-frontend`。
2. 在仓库根目录安装开发依赖：`npm ci --ignore-scripts`。本次使用 Node 22.22.2、npm 10.9.7；锁文件锁定 TypeScript 5.9.3 和 miniprogram-api-typings 4.1.3。团队工具版本仍需与 B 确认。
3. 打开微信开发者工具，导入目录 `D:\wx_project\WeChat-mini-program`，不是仅导入 `miniprogram/`。
4. 选择“小程序”，使用你已提供并在工具中配置的团队 AppID。本次保留现有 `project.config.json`，不更改 AppID 或私有设置。用户已报告初步编译和首页成功；新增页面仍需本次人工验收。后续配置变化在交接/提交前与 B 确认，`project.private.config.json` 已忽略。
5. 确认项目读取 `miniprogramRoot: "miniprogram/"` 与 `setting.useCompilerPlugins: ["typescript"]`，然后点击编译。配置参考[微信官方示例项目](https://github.com/wechat-miniprogram/miniprogram-demo/blob/master/project.config.json)。仓库 tsconfig 用于独立类型检查，运行代码由开发者工具编译。
6. 当前没有小程序运行时 npm 包，不需要“构建 npm”，也不需要开通云开发或填写云环境。
7. 从首页答题，完成两轮追问后进入推荐和试岗。追问、推荐、试岗页面提供 normal/empty/error/degraded/timeout 五种 Mock 场景。试岗页面先选择场景，再“按场景读取材料”或提交完整答案。timeout 模拟等待 15 秒后返回模板；错误/空结果不会清空草稿。

## 检查命令与限制

```powershell
npm run check
```

包含 `tsc --noEmit`、JSON/路由/页面四文件/事件绑定/条件表达式/基础 WXML 标签检查，以及 26 组 store、Mock、导航和页面逻辑检查。测试使用内存中的微信 API 与计时器替身，不生成小程序 JS，不调用云端。

本次以上命令通过。本轮没有执行新增代码的微信开发者工具 WXML/WXSS 编译、模拟器 UI 或真机检查。15 秒超时的 Node 检查验证配置与降级逻辑，不代表真实等待体验已验收。人工清单见本次交付记录。

## 模块职责

- `miniprogram/pages/`：七个页面，其中六个实现 Mock 交互，七天计划占位。
- `miniprogram/store/session.ts`：设备内的草稿、答题进度、恢复、结果失效与清除。
- `miniprogram/services/`：页面统一调用入口及 Mock Provider。当前接口仅为前端内部适配，不是冻结 API 契约。
- `miniprogram/mocks/`：8 道题、两轮预设追问、六岗位介绍、三个推荐、三个试岗与独立示例作答；无分数、权重或映射。
- `miniprogram/models/frontend.ts`：前端内部类型，临时 UI ID 不作为后端业务 ID。
- `docs/`：四份完整原始文档、交付记录及 B 待确认事项。原始文档未经改写。
- `scripts/`：本阶段类型检查之外的结构与逻辑验证。

## 本地数据与协作

画像、追问与试岗答案只保存在本设备，缓存键为 `pathai.frontend.session.v1`。旧画像缓存可恢复，旧版推荐步骤会退回追问。修改画像会重置追问及试岗；修改追问会使后续试岗失效。一次只保留一个试岗草稿，开始另一个会替换旧草稿；切换时有提示。倒计时按墙上时钟计算，后台时间计入，到时不清空或自动提交。缓存损坏/保存失败显示提示，可重试保存。首页清除的是本地记录，不是云端删除。

本阶段不创建或修改 `shared/`、`cloudfunctions/`，不添加真实密钥。公共配置、依赖锁文件及待确认接口见 `docs/interface-open-questions.md`。本次未执行提交、push、merge 或创建 PR。
