# Studio 新建画布、多段对话与卡片精简 · 生产发布（2026-10-21 13:19 CST，release `20261021-studio-new-canvas-threads`）

> 设计真源 [`docs/ip-studio-new-canvas-and-threads.md`](../ip-studio-new-canvas-and-threads.md)。

## 制品

- 构建所用提交：`main` **`c6f67b7b`**（`c6f67b7bbed816e0ff8c59b5e584a5cc7bdc99d5`），在干净工作区 `AIStarEcosystem-main-release` 构建；本地 main 未推远端。
  - 功能分支 `dev/studio-new-canvas-threads-20261020` 的三个提交 `8aa24fbf` / `6a836dc0` / `c6f67b7b`，基于 main `9c37ade8`，`git merge --ff-only` 快进，无冲突。
- 服务：**server + web-aiavatar**（先 server，`[verify] ALL GREEN` 且新进程起来后再发 web-aiavatar）。
- 构建参数 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（`USE_MOCK` / `ENABLE_DEV_LOGIN` 为 `0`），已核对 `manifest.env`；`checksums.sha256` 三项校验通过。
  - `server/app.jar` sha256 `51750131a54d4fc33d26eb2b2c73f9917ec8478485b1d49095c2f57e6a54c840`。
  - `web-aiavatar.tar.gz` sha256 `a64499ecb18e7b96eb24111b55897346307d682c93b81398b9dd51dadc41c7bc`，Next `BUILD_ID` `ZJBDN4tJgztRsuTRpq0NU`，包内 `./apps/web-aiavatar/server.js`。
- 无新迁移：jar 内迁移清单与线上旧 jar 逐条一致，最高 V63。提示词 `PromptTemplateSeeder.SEED_VERSION` = `v20-2026-10-20-concise-cards`（已从 class 文件核对），jar 内 `dap.ip_studio_skill_plan.md` 含「rationale 必填但不显示给用户」。

## 发布前基线

- `/opt/ai-star-eco/releases` 最新为 `20261020-studio-dialogue-intents`（server + web-aiavatar，`eea08f72`），其后无别的发布；再往前 `20261021-production-model-compat`（`76ef8ee8`）、`20261021-studio-prod-fixes`（`14260eea`）、`20261020-studio-assistant-activity`（`8b408533`），四个提交都在 `c6f67b7b` 的历史里。
- 线上 `server/app.jar` 的 sha256（`463682e8…`）与 `20261020-studio-dialogue-intents` 制品一致。
- 注意：`/opt/ai-star-eco/server/release-id.txt` / `release-sha.txt` 仍写 `20261021-production-model-compat` / `76ef8ee8`（09:40），`deploy-release.sh` 不更新这两个文件，**判断线上版本以 jar 校验和与 `releases/*/manifest.env` 为准**。

## 门禁（合并结果，main 上）

- `pnpm typecheck:all`、`pnpm typecheck:admin`：退出码 0。
- `pnpm check:api-contract`：`OK.`，退出码 0。
- `(cd apps/server && ./mvnw compile -q -o)`：退出码 0，无输出。
- 全量测试在功能分支上跑过（web 1076 / server 2621 全绿），合并为快进、代码相同，main 上未重跑。

## 线上验收

- `deploy-release.sh … server`：`[env-check] ALL GREEN`、`[verify] ALL GREEN`；新进程 PID 1323856 于 **13:18:56 CST** 启动，`Started AiStarEcoApplication in 15.91 seconds`（13:19:13），`Successfully validated 63 migrations`、`Current version of schema aistareco: 63`，`NRestarts=0`。
- `deploy-release.sh … web-aiavatar`：`[verify] ALL GREEN`；**13:20:00 CST** 启动，`Ready`，`NRestarts=0`。
- 日志 ERROR：先用 grep `' -ERROR | ERROR [0-9]+ ---'` 对今天 00:00–13:18:56 计数，命中 186 条（旧进程），证明 grep 能命中；`--since 13:18:56` 命中的 1 条是旧进程 PID 1285561 停机时打的（`Cannot render error page … response has already been committed`）。按新进程 PID 过滤：至 13:21:40 **0 条 ERROR**，2 条 WARN（Hibernate 方言弃用提示、UserDetailsServiceAutoConfiguration，均为常规启动提示）。
- 启动日志：`PromptTemplateSeeder: 刷新 54 个未改动的 prompt 基线 → v20-2026-10-20-concise-cards`；`[studio-skill]` 五个技能文件按原状态加载（`original-creation` 仍 withdrawn）。
- 库 `prompt_template`：`dap.ip_studio_skill_plan` 与 `dap.ip_studio_skill_dialogue` 均 `version=1, updated_by=seed`，更新于 05:19:13Z（13:19:13 CST）；规划提示词含新规则 7（「7. summary…」与「rationale 必填但不显示给用户」均命中），对话提示词含本次新增句（「不复述、不确认理解」「像一个熟练的同事说话」均命中）。
- 未带令牌访问 `GET /api/v1/ip-studio/projects/x/conversations`、`POST /api/v1/ip-studio/projects/x/conversations/x/open` → **401**（`UNAUTHORIZED`）。但同前缀下不存在的路径也是 401（鉴权在路由之前），所以 401 只说明请求过了网关和鉴权；另从线上同一份 jar 的 `StudioDialogueController.class` 核对到 `/conversations`、`/conversations/{threadId}`、`/conversations/{threadId}/open` 三条映射。
- `https://aiavatar.aibuzz.cn/projects` → 200，`/create` → 200。
- `systemctl show aistareco-web-aiavatar -p WorkingDirectory` = `/opt/ai-star-eco/web-aiavatar/apps/web-aiavatar`，目录内 `BUILD_ID` 为 `ZJBDN4tJgztRsuTRpq0NU`（与本地制品一致），`.next` 里能搜到新文案「开始一段新的对话，这一段留在历史里」和空画布引导「这张画布还是空的」。

## 回滚

在 `AIStarEcosystem-main-release` 里（本地有 `dist/deploy/20261020-studio-dialogue-intents`，其 jar 与发布前线上 jar 校验和一致）：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261020-studio-dialogue-intents web-aiavatar
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261020-studio-dialogue-intents server
```

无迁移，回滚不涉及库结构。server 回滚后提示词按旧 `SEED_VERSION`（v19）刷回（只刷没人改过的行）；已经建出的多段对话数据仍在原表里（V61 的 `ip_dialogue_thread` 本来就按画布存多段），旧版本没有「新对话 / 历史对话」入口，回滚后用户看不到对话列表（旧版本具体落到哪一段未核对）。

## 没做的验收

- **没用生产账号走一遍**：新建画布（从「新建创作」直进画布、复用空白画布）、空画布引导的五个入口、助手「新对话 / 历史对话」新建与切换、方案与确认卡合成一张后的样子。本机不能替用户登录，需要用户在浏览器里自己点一次（确认卡**别点确认**，除非愿意花积分）。
- 卡片文案在真模型上的效果（`plan.summary` / `step.title` / `approval.scope` 是否还带判断过程、积分或流程说明）：只有确定性测试和演示 mock，见 TODO.md「真模型验证卡片文案」。
- 带令牌调用 `GET …/conversations` 列表：没查。

## 已知的非阻塞问题（第三轮只读评审，用户决定不再安排修复）

都只在「确认制作的回包丢失」或上游断连这类异常网络下出现，正常流程不受影响：

- 确认结果核对中关掉助手再打开，可再点一次「开始制作」，出现两个核对循环（服务端同键幂等，不会多建制作）。`studio-dialogue-session.tsx` 核对逻辑。
- 核对中如果事件流快照已经显示该卡已确认、制作已结束，核对锁仍要等下一次重发成功才释放。
- 确认请求明确返回 401 时仍按「结果不明」重试（登录跳转会卸载页面兜底）。
- `GlobalExceptionHandler.isClientDisconnect` 在响应已开始写出时，把消息含 `Connection reset by peer` 的上游断连也当成客户端断开，只记 DEBUG（已下线的 Forge 流可触发）。
