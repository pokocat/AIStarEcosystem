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

## 热修 `20261021-studio-action-format`（2026-10-21 14:11 CST，只发 server）

### 现象

13:50 CST，一张画布上只有一张图片「生成末日英雄IP设定图」，用户对助手说「做个ip形象三视图」。对话端点「聚算 · Qwen3.8 27B」（`qwen38-27b`，没声明原生工具调用，走 JSON 动作协议、非流式）整条回复只有 `[调用工具 view_images]`（7 个 token，toolCalls=0）。`DialogueActionProtocol` 没认出这是一次想调用工具，当正文显示，回合结束，扣 2 积分，什么都没做。

### 原因

本次发布（v20 提示词）把 `dap.ip_studio_skill_dialogue.md` 第 3 行从「调用前先用一两句话告诉用户你准备看什么、做什么」改成「调用前不用预告…」。模型没有正文可写，提示词里又只有格式描述、没有完整的动作示例，于是自己编了一种写法。解析器只认分隔行、`<tool_call>` / `<studio-actions>` 标签、裸 JSON 和模仿工作记录这几种，不认这一种。

用同一份线上请求（日志里 13:50:25 那条 `[ai-chat-io] REQUEST`，system 与 v20 提示词逐字一致）在本机真调旧提示词 5 次：3 次正常给出 `view_images`，1 次整条回复是 `[用户已确认]`（6 token），1 次只写「画布上有一张「分镜」图，我先看看它的内容。」没有动作。线上那种写法没有复现，但同一类「什么都没做」5 次里出了 2 次。

### 修法（main `6b089c8b`，分支 `fix/studio-action-format-20261021` 快进）

- **解析器**：`DialogueActionProtocol.ProseCallFilter` 按已注册的工具名（`StudioDialogueToolRegistry.names()`）认出写成正文的调用：带括号加「调用工具 / 使用工具 / 工具」的任意位置（`[调用工具 view_images]`、`[调用工具：view_images]`、`[使用工具 read_canvas]`、`[工具 view_images]`，也认 【】），不带括号的整行（`调用工具 view_images`），只有工具名的整条回复（`[view_images]`、`view_images()`）。没有真正的动作时按格式错误走 `DialogueLoop` 的纠正重试；这段文字流式、非流式都不显示（流式与 `parse` 用同一个过滤器，切在哪里结果都一样）。带括号的模仿工作记录也一并不显示（此前会显示）。正文里只是谈到「工具」、或工具名不在注册表里的，照常显示。
- **纠正提示**：`DialogueLoop.correctionText` 在原因后面带一个完整动作示例（分隔行 + `[{"tool":"view_images","args":{"nodeIds":["对象 id"],"question":"想确认什么"}}]`，参数名就是 `view_images` 的真实参数）。
- **提示词**：第 3 行改为「调用工具时，正文可以只写一句在做什么……但动作必须按文末的格式发出，不要在正文里写「[调用工具 xxx]」这类文字」；「动作输出方式」后补一个完整示例（一句正文 + 分隔行 + 一个 `view_images` 动作）。`PromptTemplateSeeder.SEED_VERSION` → `v21-2026-10-21-action-format-example`。
- **测试**：每种写法各有用例（含切成两段的每个位置与逐字流式都等于 `parse` 的结果）、谈到工具的正文不误判、纠正提示里的示例能被解析器认出、提示词里的示例能被解析为 `view_images` 且参数都是它声明过的。

### 真模型验证（本机，没有用生产密钥）

用本机开发库副本里已有的聚算凭据（`.studio-e2e` 开发库的 `studio-live-jusuan-audio` 端点，本地开发密钥加密），直连 `https://api.jusuanhub.com/v1/chat/completions`，`model=qwen38-27b`、`temperature=0.7`、`max_tokens=4096`、非流式；消息就是线上 13:50 那条请求，只换 system。回复用服务端自己的 `DialogueActionProtocol.parse` 解析：

| 场景 | 次数 | 可解析的动作 |
|---|---|---|
| 新提示词（含 1 次探测） | 6 | 6 次都是一句正文 + `view_images`，`nodeIds` 填的是画布里真实的对象 id，不是示例里的「对象 id」 |
| 旧提示词（对照） | 5 | 3 次；另 2 次见上「原因」 |
| 上一条回复是 `[调用工具 view_images]`，接新纠正提示（system 用旧提示词 3 次、新提示词 2 次） | 5 | 5 次 |

每次输入约 6.2k–6.5k token、输出 6–108 token。这里只验到「第一步能不能正确发出看图动作」；之后看图、出方案、发卡在真模型上的效果没有再走。

### 门禁

- `(cd apps/server && ./mvnw compile -q -o)`：退出码 0。
- `./mvnw -o -q -Dtest='DialogueActionProtocol*,DialogueLoop*,StudioDialogue*,PromptTemplate*' test`：13 个测试类 110 条，0 失败（没有名为 `PromptTemplate*` 的测试类）；`com.aistareco.aep.ipstudio.**` 全部 111 个类 748 条，0 失败，5 条跳过。
- `pnpm check:api-contract`：`OK.`。没有新接口、没有迁移。

### 制品与发布

- 发布前核对：`/opt/ai-star-eco/releases` 最新为 `20261021-studio-new-canvas-threads`（GIT_SHA `c6f67b7b…`），线上 `server/app.jar` sha256 `51750131…` 与该制品一致，没有更新的发布。
- 在 `AIStarEcosystem-main-release` 的 `main`（`6b089c8b`）构建 `RELEASE_ID=20261021-studio-action-format ./infra/scripts/build-release.sh server`：`manifest.env` 的 `SERVICES='server'`、`GIT_SHA='6b089c8bce48703cc8bb310b6f4c37bd6544fab7'`，`checksums.sha256` 两项校验通过；`server/app.jar` sha256 `cb9ede3e75fc7623b2954a358a2fcaa063744ab1526f0088d3e60785237a747c`。jar 内 `PromptTemplateSeeder` 的版本串为 `v21-2026-10-21-action-format-example`，`dap.ip_studio_skill_dialogue.md` 含新示例、不含「调用前不用预告」；迁移最高仍是 V63。
- `deploy-release.sh … server`：`[env-check] ALL GREEN`、`[verify] ALL GREEN`。

### 线上验收

- 新进程 PID 1335942 于 **14:11:26 CST** 启动，`Successfully validated 63 migrations`、`Current version of schema aistareco: 63`，`Started AiStarEcoApplication in 15.209 seconds`（14:11:42），`NRestarts=0`；线上 jar sha256 `cb9ede3e…` 与制品一致。
- 启动日志：`PromptTemplateSeeder: 刷新 54 个未改动的 prompt 基线 → v21-2026-10-21-action-format-example`（14:11:43）。
- 库 `prompt_template`（只读查询）：`dap.ip_studio_skill_dialogue` 为 `version=1, updated_by=seed`，更新于 06:11:43Z；含「完整示例（一句正文」与 `[{"tool":"view_images","args":{"nodeIds"` 那一行、含新第 3 行，不含「调用前不用预告」。
- 日志 ERROR：grep `' -ERROR | ERROR [0-9]+ ---'` 对今天 00:00–14:11:00 计数 187 条（旧进程），证明 grep 能命中；14:11:00 之后的 2 条是旧进程 PID 1323856 停机时 14:11:07 打的（`AccessDeniedException … response is already committed`）。按新进程 PID 过滤至 14:12:10：**0 条 ERROR**，2 条 WARN（Hibernate 方言弃用提示、UserDetailsServiceAutoConfiguration，常规启动提示）。
- **没做**：没用生产账号在线上真发一条对话（需要用户登录，且每轮会扣积分）。建议用户在那张画布上再说一次「做个ip形象三视图」，确认第一步是「先看一下……」并真的看了图。

### 回滚

在 `AIStarEcosystem-main-release` 里（本地 `dist/deploy/20261021-studio-new-canvas-threads/server/app.jar` 的 sha256 `51750131…` 与发布前线上一致）：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-new-canvas-threads server
```

无迁移；回滚后提示词按 v20 刷回（只刷没人改过的行），web-aiavatar 不涉及。

## web 热修 `20261021-studio-create-page`（2026-10-21 14:14 CST，只发 web-aiavatar）

### 改了什么

用户改判：「画布·自由创作」（`/create`）在桌面和手机上都是同一个页面，不再一进来就建画布跳走。

- 最上面一张「新建画布」卡片（「一张空白画布，打开就有助手，直接开始。」），点了才调 `useStartNewCanvas` / `startNewCanvas()`（复用规则不变，进 `/projects/{id}?start=assistant`）；建的时候卡片转圈、其它入口不可点，失败在页面上方说原因，卡片可以再点。
- 下面是能力入口（去掉了重复的「空白画布」，其余九项照旧各自建画布并带 `?start=xxx`）和「从模板开始」。
- 没有方式切换框，也没有对话框（`StudioConversationStart` 只在首页）。
- 删掉了只为「桌面进来就建画布」写的逻辑（`router.replace`、「正在打开新画布…」那一屏、重试 / 去项目页）；`use-start-new-canvas.ts` 的通用能力（含 `navigate: "replace"`）保留。项目页「新建创作」、首页新建不变。
- 文件：`apps/web-aiavatar/src/ip/studio-create-home.tsx`、`src/app/create/page.tsx`、`src/ip/studio-create-tools.ts`、`src/styles/studio-page.css`；测试 `studio-create-home.test.tsx`、`studio-dialogue-wiring.test.ts`；文档 `docs/ip-studio-new-canvas-and-threads.md` §2.2、AGENTS.md「新建画布、多段对话与卡片精简」、`apps/web-aiavatar/PRODUCT.md`、`apps/web-aiavatar/README.md`。

### 门禁

- `studio-create-home` / `studio-dialogue-wiring` / 首页 / 项目页 / `studio-entry` / `use-start-new-canvas` / `studio-conversation-start` 七个测试文件 61 条全过；引用 `/create` 的三个 shell 测试 13 条全过。
- `pnpm --filter @ai-star-eco/web-aiavatar typecheck`、`pnpm typecheck:all`、`pnpm check:api-contract`（`OK.`）均通过。没有接口、没有迁移，server 不动。
- 演示模式（`NEXT_PUBLIC_USE_MOCK=1`，`--webpack`，3913 端口）无头 Chrome 1440 与 375 实看：卡片在最上面，能力入口九项（无「空白画布」）与三份模板在下面，没有切换框和对话框，页面无横向滚动；点卡片进 `/projects/{id}?start=assistant`，桌面上助手停靠在右边、中间是空画布引导，手机上先出现原有的「画布在电脑上更好用」提示。

### 制品与发布

- 发布前核对：线上 web-aiavatar 最新发布为 `20261021-studio-new-canvas-threads`（GIT_SHA `c6f67b7b…`，在 main 历史里）；之后只有 server 热修 `20261021-studio-action-format`。等那次热修部署并记录完（main `01c6d576`）后，分支 `fix/studio-create-page-20261021` 变基到 main 再快进。
- 在 `AIStarEcosystem-main-release` 的 `main`（`0222df1a5f79b95dfa680f2f339a6be2f639d069`）构建 `RELEASE_ID=20261021-studio-create-page NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn NEXT_PUBLIC_ENTERPRISE_ENABLED=1 ./infra/scripts/build-release.sh web-aiavatar`：`manifest.env` 为 `SERVICES='web-aiavatar'`、`GIT_SHA='0222df1a…'`、`NEXT_PUBLIC_AUTH_MODE='id'`、`NEXT_PUBLIC_ID_ISSUER='https://id.aibuzz.cn'`、`NEXT_PUBLIC_ENTERPRISE_ENABLED='1'`；包内入口 `./apps/web-aiavatar/server.js`，`BUILD_ID` `KCvBbTZwJ33ujB0yjRJXz`，`.next` 能搜到新文案、搜不到「正在打开新画布」。
- `deploy-release.sh dist/deploy/20261021-studio-create-page web-aiavatar`：`[verify] ALL GREEN`。

### 线上验收

- `aistareco-web-aiavatar` 新进程 PID 1337412 于 **14:14:41 CST** 启动，`Ready`，`NRestarts=0`；`WorkingDirectory=/opt/ai-star-eco/web-aiavatar/apps/web-aiavatar`，`BUILD_ID` 与本地制品一致。
- `https://aiavatar.aibuzz.cn/create` → 200，`/projects` → 200。运行目录 `.next/server/app/create/page.js` 与 `static/chunks/app/create/page-b6d1b51f3c02fc18.js` 含「打开就有助手，直接开始。」，不含「正在打开新画布」；公网取同名 chunk 200 且含新文案。
- **没做**：没用生产账号登录点一次「新建画布」（需要用户自己登录）。

### 回滚

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-new-canvas-threads web-aiavatar
```

只回 web-aiavatar，server 不动；回滚后桌面 `/create` 恢复为进来即建画布。
