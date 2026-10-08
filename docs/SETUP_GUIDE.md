# PathAI 本地开发与云环境配置指南

> 面向首次克隆仓库的团队成员。带 **【手动配置】** 的步骤无法通过 Git 自动完成，必须由开发者本人在本机或微信后台操作。

## 1. 已随仓库配置

- 微信小程序原生 TypeScript 工程；
- AppID：`wx4a941c83f95c10f2`；
- 开发云环境 ID：`cloud1-d9g4vq6r057873c75`；
- `miniprogram/`、`cloudfunctions/` 与共享契约目录；
- TypeScript、ESLint、Prettier、EditorConfig 和依赖锁文件；
- API 契约及 8 个云函数目录骨架；
- Git 忽略规则，已排除依赖、本机配置和密钥文件。

已创建但尚未接入客户端的生产环境：

```text
名称：pathai-prod
环境 ID：pathai-prod-d6gh4i6u3bfbbdcea
```

## 2. 本地软件

必需：Node.js 24 LTS、npm 11、Git、微信开发者工具稳定版、VS Code 或其他 TypeScript 编辑器。

推荐 VS Code 扩展：ESLint、Prettier、EditorConfig、GitLens。

### 【手动配置】Node.js

每位成员在本机确认：

```powershell
node -v
npm -v
```

Node 应为 `v24.x`，本项目限定为 `>=24 <25`。如果使用 Vite+，应确保新 PowerShell 会加载：

```powershell
. "$env:APPDATA\vite-plus\env.ps1"
```

如果 PowerShell 阻止脚本，先检查组织安全策略，再为当前用户使用 `RemoteSigned`；不要设置全局 `Unrestricted`。

## 3. 克隆和安装

```powershell
git clone https://github.com/lowsh187/WeChat-mini-program.git
cd WeChat-mini-program
npm ci
npm run check
```

`npm run check` 必须通过 TypeScript、ESLint 和 Prettier。不要提交 `node_modules/`。

## 4. 【手动配置】GitHub 权限与分支

仓库管理员需要把队友加入 GitHub 仓库协作者。微信权限不等于 GitHub 推送权限。

建议从 `main` 创建个人功能分支：

```powershell
git switch main
git pull
git switch -c feature/a-profile-flow
```

后端可使用 `feature/b-cloud-functions`。共享契约变更必须双方确认。

## 5. 【手动配置】导入微信开发者工具

1. 打开微信开发者工具并选择“导入项目”；
2. 目录选择仓库根目录；
3. 确认 AppID 为 `wx4a941c83f95c10f2`；
4. 使用有该小程序开发权限的微信账号登录；
5. 等待工具生成本机 `project.private.config.json`。

`project.private.config.json` 是每台电脑独立的设置，已被 Git 忽略，不要强制提交。

## 6. 【手动配置】微信项目权限

管理员需要在微信公众平台把队友添加为该小程序的开发成员。若无法预览、上传或访问云环境，检查：

- 是否已加入小程序项目成员；
- 是否具有开发者权限；
- 登录微信是否与授权账号一致；
- AppID 是否正确。

AppSecret 不需要写入客户端，也禁止提交到 Git。

## 7. 【手动配置】选择开发云环境

代码默认云环境已经设置为：

```text
cloud1-d9g4vq6r057873c75
```

开发者工具仍需单独选择云函数部署环境：

1. 右键资源管理器中的 `cloudfunctions`；
2. 展开“当前环境（无）”；
3. 选择 `cloud1` / `cloud1-d9g4vq6r057873c75`；
4. 确认标题不再显示“未选择环境”。

日常开发只部署到 `cloud1`，不要把未验收代码部署到 `pathai-prod`。

若环境列表为空，先在云开发控制台确认能看到环境，再对 `cloudfunctions` 执行“同步云函数列表”，必要时重新登录或重启工具。

## 8. 【手动配置】云开发成员权限

能访问小程序不一定能管理云环境。环境管理员需要为队友授予所需权限：

- 前端成员：查看开发环境、调用开发云函数和预览小程序；
- 后端成员：开发环境数据库、云函数、日志与部署权限；
- 生产部署权限：仅授予发布负责人。

## 9. 【手动配置】开发数据库

在开发环境 `cloud1` 创建：

```text
roles
base_questions
work_trials
sessions
assessments
action_plans
feedback
events
```

当前约定所有数据库读写通过云函数完成，客户端暂不直接访问集合。初始权限设置为仅云端/管理员可读写，再按接口最小化开放。

集合、权限和索引不会通过普通 Git 推送自动创建；在数据库初始化脚本完成前，由后端负责人手动核对。

## 10. 云函数开发与部署

目录骨架：

```text
createSession
selectFollowup
getInitialRecommendation
scoreTrial
getActionPlan
submitFeedback
trackEvent
deleteSession
```

实现必须遵守 `docs/API_CONTRACT.md`。

### 【手动配置】部署

1. 确认 `cloudfunctions` 当前选择开发环境；
2. 右键具体云函数；
3. 选择“创建并部署：云端安装依赖”；
4. 在云开发控制台检查版本、日志和调用结果。

部署不会因 Git 推送自动执行。

## 11. 【手动配置】AI 服务

AI 供应商、模型和密钥尚未确定。接入时必须：

- 密钥只放在云函数安全配置或环境变量；
- 不写入 `miniprogram/`、`project.config.json` 或 Git；
- 不输出密钥到日志；
- 配置 15 秒超时、最多一次安全重试和模板化降级。

团队需单独确认模型、配额、余额、内容安全和结构化输出能力。

## 12. 【手动配置】生产环境

生产环境 ID：

```text
pathai-prod-d6gh4i6u3bfbbdcea
```

进入候选版阶段后：

1. 创建同名集合、权限和索引；
2. 导入已审核的岗位、题目、试岗与 Rubric；
3. 单独配置生产 AI 密钥和额度；
4. 部署通过测试的云函数；
5. 配置客户端按 `develop / trial / release` 选择环境；
6. 对体验版和正式版做真机回归。

生产与开发数据相互隔离，不会自动同步。部署前必须再次确认目标环境。

## 13. 提交前检查

```powershell
npm run check
git status
```

不得提交：

- `node_modules/`；
- `project.private.config.json`；
- `.env`；
- AppSecret、AI API Key、Access Token；
- 真实用户完整回答或联系方式。

## 14. 当前未完成项

- 8 个云函数尚未实现；
- 8 个数据库集合尚未通过代码初始化；
- AI 供应商和密钥尚未确定；
- 生产环境尚未接入客户端自动切换；
- 开发/生产权限和索引仍需人工核对；
- 微信、云开发与 GitHub 的队友权限需管理员手动添加。

这些事项不阻塞前端和后端按照契约并行开发，但在真实联调和发布前必须完成。
