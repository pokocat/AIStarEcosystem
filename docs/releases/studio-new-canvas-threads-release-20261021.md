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

## 热修 `20261021-studio-action-marker`（2026-10-21 14:36 CST，只发 server）

### 现象

14:10 CST（旧进程 PID 1323856，还是 v20 提示词；14:11 的 `20261021-studio-action-format` 不覆盖这一次），一张画布上有两张图（「生成末日英雄IP设定图」「生成末日英雄三视图」），上一轮出图刚做完，用户说「用这张图做一段视频」。对话端点「聚算 · Qwen3.8 27B」（`qwen38-27b`，JSON 动作协议、非流式）三次都回了同样内容：一句「我先把两张图都看一下，确认用哪张、画面里有什么。」+ 分隔行 + 正确的 `view_images` 动作（两个真实对象 id），但数组后面又写了一行 `<<<studio-actions>>>`。`DialogueActionProtocol` 要求分隔行后只有一个 JSON 值，三次都判格式错误，`DialogueLoop` 重试两次后停下，界面上同一句正文显示了三遍，最后一行「这一轮整理出的操作格式不对，没有执行任何操作。回复「继续」我重新整理。」，扣 5 积分。三次原始回复已从线上日志 `[upstream-io] RESPONSE`（requestId `aic-dd2ed2a1…` / `aic-1f50e7bb…` / `aic-5a39d8c7…`）核对，两次紧凑写法、一次带空格。

另：线程技能一直是「出图」。`video-generation.md` 的关键词没有「做一段视频」这类说法，消息里没有词命中，画布上的图片让出图和出视频各得 1 分，平手沿用当前技能「出图」；而「用这张图做一段视频」正是 `StudioExecutionSummary` 在出图完成后自己给的建议。

### 原因

- 解析器对分隔行后的内容严格到「只能有一个 JSON 值」，没有容忍模型把分隔行当成成对标记、在数组后面再写一遍。
- `DialogueModels.Real` 对非流式端点在解析之前就把每次回复的正文发给用户，格式错误重试时每次的正文都会追加一遍。
- 自己给的完成后建议没有路由测试，出视频的关键词覆盖不到建议里的说法。

### 修法（main `1ebcaea6`，分支 `fix/studio-action-marker-20261021` 快进）

- **解析器**：`DialogueActionProtocol.stripClosing` 只看动作块的末尾，去掉最多两行明显的收尾：分隔行再写一次、`<<</studio-actions>>>`、`<<<end>>>`、`<<<end-studio-actions>>>`（`-` / `_` 都认）、`</studio-actions>`、代码围栏收尾，大小写不敏感；之后仍按原来的严格规则解析。数组后面还有正文、第二个数组、收尾后又跟了文字，都照旧判格式错误、一个都不执行。分隔行之后的内容流式时本来就不显示，结束标记不会出现在正文里。
- **正文只显示一次**（`DialogueModels.Real` + `DialogueLoop.Model.endTurn`）：被判格式错误的那次回复先不显示；重试那次不再流式，解析完再决定显示什么。重试成功显示成功那次的正文；成功那次没写正文（纠正提示里说了「正文不必重复」）就显示之前压着的那句；全部失败在回合结束时只显示最后一次的正文一次，再加失败说明。流式端点第一次被判错的正文已经实时出去了，重试只显示比已显示内容多出来的部分（开头相同的去掉）。选「重试不流式」而不是「每次都流再去重」：已经发出去的 `message.delta` 收不回来。
- **失败说明**：`limitNote("protocol")` 改为「这一轮没能执行，请再说一次。」
- **纠正提示**（`DialogueLoop.correctionText`）与**对话提示词**「动作输出方式」各补一句「分隔行 `<<<studio-actions>>>` 只写一次，数组后面不要再写」，其余不动；`PromptTemplateSeeder.SEED_VERSION` → `v22-2026-10-21-single-action-marker`。
- **路由**：`video-generation.md` 的 `triggers.keywords` 补「做一段视频 / 做段视频 / 做个视频 / 做一个视频 / 生成一段视频 / 做成一段视频」。没有单独加「一段视频」「生成一段」「做成一段」：路由按命中词数计分，这三个裸词会让「写一段视频脚本」「生成一段口播文案」与写稿平手或抢走，「照这条做一段视频」（附参考视频）落到出视频而不是复刻。技能文件内容变了，启动时按文件摘要追加为新的种子版本（库里这一行没被后台改过才会追加），不需要另外升版本。
- **测试**：线上这条回复的三种空格写法（紧凑、带空格、换行缩进）都解析为 `view_images` 且正文只剩那一句，每一种收尾 × 数组 / 单个对象 × 有无换行，逐字流式和任意切两段都等于 `parse` 的结果、不含 `<<`；数组后面还有正文、第二个数组、收尾后又有文字、三行收尾、`<<<stop>>>` 都仍判错。`DialogueRetryDisplayTest` 用真的 `DialogueModels.Real` 跑真的循环（模拟供应商），流式和非流式各验：重试 1 次后成功正文只出现一次、重试没写正文时显示原来那句、三次都失败只显示一次、流式重试只补多出来的部分、没有格式错误时显示与之前一致、线上原样回复第一次就执行。`StudioSuggestionRoutingTest` 用仓库里的技能文件，把 `StudioExecutionSummary.suggestions` 能产出的 13 条建议逐条钉住：「用这张图 / 这些图做一段视频」在任何当前技能、有无图片引用时都去出视频，「换个风格再出一张 / 一组」去出图，其余（合成成片、存为模板、换横竖屏再出一版、重做第 N 段、接着做、改精炼、再试一次）都不切换；另验新词不抢写稿、复刻和意图文档 §7 的几条。`StudioDialoguePromptWiringTest` 钉住提示词与纠正提示里的这句、示例里只有一行分隔行且数组后面没东西。本地确认过：换回旧的 `DialogueModels` 时 `DialogueRetryDisplayTest` 6 条里 3 条失败（正文出现两次），去掉新关键词时 `StudioSuggestionRoutingTest` 2 条失败。

### 真模型验证（本机，没有用生产密钥）

用本机开发库副本里的聚算凭据（`studio-live-jusuan-audio` 端点，本地开发密钥加密），直连 `https://api.jusuanhub.com/v1/chat/completions`，`model=qwen38-27b`、`temperature=0.7`、`max_tokens=4096`、非流式。消息取线上 14:09:59 那条 `[ai-chat-io] REQUEST`（requestId `aic-dd2ed2a1…`，system 与 v20 逐字一致，user 里技能是「出图」），只换 system；第二组再把技能段换成修复后路由会选的「出视频」（按 `skillText` / `stageText` 的写法拼出）。回复用服务端自己的 `DialogueActionProtocol.parse` 解析：

| 场景 | 次数 | 可解析 | 分隔行写了几次 | 动作 |
|---|---|---|---|---|
| v22 提示词 + 线上原请求（出图） | 5 | 5 | 每次 1 次 | `read_skill`（换到 video-generation）2 次、`view_images` 2 次（真实对象 id）、`read_canvas` 1 次 |
| v22 提示词 + 技能段换成出视频 | 5 | 4 | 可解析的每次 1 次 | `view_images` 2、`create_nodes`（9:16、5 秒、以三视图为首帧）2；另 1 次整条回复是「[调用工具 view_images]」（上一个热修认的写法，按格式错误重试） |
| 上一行那条「[调用工具 view_images]」+ 新纠正提示 | 3 | 3 | 每次 1 次 | `view_images` 3 次，各带一句正文 |
| 线上当前的 v21 提示词 + 线上原请求（对照） | 3 | 3 | 每次 1 次 | `read_skill`（video-generation）3 次 |

16 次里没有一次在数组后面再写分隔行（线上 v20 那次是 3/3），所以「v22 那句话本身有没有用」没有直接证据；有直接作用的是解析器容忍和测试。每次输入约 7.5k–7.8k token、输出 7–293 token。只验到第一步能不能正确发出动作，之后看图、出方案、发卡在真模型上没有再走。

### 门禁

- `(cd apps/server && ./mvnw compile -q -o)`：退出码 0。
- `./mvnw -o -Dtest='DialogueActionProtocol*,DialogueLoop*,DialogueRetry*,StudioDialogue*,StudioSkill*,StudioExecutionSummary*,StudioSuggestion*,PromptTemplate*' test`：164 条，0 失败（没有名为 `PromptTemplate*` 的测试类）。`com.aistareco.aep.ipstudio.**` 全部 113 个类 762 条，0 失败，5 条跳过。
- `pnpm check:api-contract`：`OK.`。没有新接口、没有迁移。

### 制品与发布

- 发布前核对：`/opt/ai-star-eco/releases` 最新为 `20261021-studio-create-page`（web-aiavatar，`0222df1a`）与 `20261021-studio-action-format`（server，`6b089c8b…`），两个提交都在 main 历史里；线上 `server/app.jar` sha256 `cb9ede3e…` 与 `20261021-studio-action-format` 制品一致。`AIStarEcosystem-main-release` 工作区干净、没有构建 / 发布进程在跑，main `34f71485` 快进到 `1ebcaea6`。
- 在 `AIStarEcosystem-main-release` 的 `main`（`1ebcaea6f8e208578cc8c0220c473852d3f2d27f`）构建 `RELEASE_ID=20261021-studio-action-marker ./infra/scripts/build-release.sh server`：`manifest.env` 为 `SERVICES='server'`、`GIT_SHA='1ebcaea6…'`，`checksums.sha256` 两项校验通过；`server/app.jar` sha256 `f580d29464b9c689dea4bec6904a6c4964b8c6dfb32d1a40a49f3dee87511dc6`。jar 内 `PromptTemplateSeeder` 版本串为 `v22-2026-10-21-single-action-marker`，`dap.ip_studio_skill_dialogue.md` 含新句，`studio/skills/video-generation.md` 与仓库文件逐字节一致（含六个新词），`StudioDialogueTurnWorker` 含新失败说明；迁移最高仍是 V63。
- `deploy-release.sh … server`：`[env-check] ALL GREEN`、`[verify] ALL GREEN`。

### 线上验收

- 新进程 PID 1342495 于 **14:36:42 CST** 启动，`Successfully validated 63 migrations`、`Current version of schema aistareco: 63`，`Started AiStarEcoApplication in 15.827 seconds`（14:36:59），`NRestarts=0`；线上 jar sha256 `f580d294…` 与制品一致。
- 启动日志：`[studio-skill] repository file key=video-generation version=1 status=active digest=4fb7e32efe7e`（原来 `6a201f6650cb`），紧接着 `[studio-skill] re-seeded video-generation as v2 from changed file video-generation.md (digest 4fb7e32efe7e)`；其余四个技能文件摘要不变。`PromptTemplateSeeder: 刷新 54 个未改动的 prompt 基线 → v22-2026-10-21-single-action-marker`（14:36:59）。
- 库（只读查询）：`prompt_template` 的 `dap.ip_studio_skill_dialogue` 为 `version=1, updated_by=seed`，更新于 06:36:59Z，含新句「只写一次，数组后面不要再写」，仍含 v21 的完整示例；`ip_skill` 的 `video-generation` 为 `current_version=2, updated_by=seed`，`ip_skill_version` v2（`source=seed`、`published`、摘要 `4fb7e32efe7e`）的 front matter 含「做一段视频」「做成一段视频」，v1 仍在。
- 日志 ERROR：grep `' -ERROR | ERROR [0-9]+ ---'` 对今天 00:00–14:36:00 计数 189 条（旧进程），证明 grep 能命中；14:36:00 之后 **0 条 ERROR**（含旧进程停机，至 14:37:20）。新进程 2 条 WARN（Hibernate 方言弃用提示、UserDetailsServiceAutoConfiguration，常规启动提示）。
- `https://aiavatar.aibuzz.cn/projects` → 200。
- **没做**：没用生产账号在线上真发一条对话（需要用户登录，且每轮会扣积分）。建议用户在那张画布上再说一次「用这张图做一段视频」，确认线程换到「出视频」、正文只出现一次、第一步真的看了图。

### 回滚

在 `AIStarEcosystem-main-release` 里（本地 `dist/deploy/20261021-studio-action-format/server/app.jar` 的 sha256 `cb9ede3e…` 与发布前线上一致）：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-action-format server
```

无迁移。回滚后提示词按 v21 刷回（只刷没人改过的行）；`video-generation` 的文件摘要又变了，库里没被后台改过，会把旧文件追加为 v3（旧关键词），v2 留在历史里。web-aiavatar 不涉及。

## web 发布 `20261021-studio-starters`（2026-10-21 14:55 CST，只发 web-aiavatar）

### 改了什么

用户反馈：新对话里的快捷选项不够好用，换成「制作个人 IP、写剧本、做个短视频、复刻视频」。设计与实现说明见 `docs/ip-studio-new-canvas-and-threads.md` §5。

- 空对话、没有引用节点时，开场是四张卡（2×2，窄于约 360px 单列）：图标、标题、会得到什么、「需要：…」。有引用节点时的那组卡不变。
- 点一张变成填空卡：素材位（「从画布选」走输入框的 @，「上传」走输入框的附件；画布上正好一个合适素材时只给必填位自动选上；选中的可以 × 去掉）、默认已选好的选项按钮、一两行文字位；按这些实时拼一句话写进输入框。发送仍是输入框那一个按钮，缺必填项不能发，原因写在按钮旁，必填文字位为空时卡上也标「还缺」；发送显式带技能（`image-generation` / `script-writing` / `video-generation` / `reference-video-recreation`）。
- 用户改过输入框后选项不再覆盖，出现「按选项重写」；点开卡片时输入框已有的字不覆盖；「← 换一个」撤掉这张卡写的话、技能和它选的素材，回到四张卡。
- 原复刻清单 `studio-assistant-checklist.tsx` 并入「复刻视频」卡并删除。首页需要参考视频的原话照旧打开这张卡、保留原话、不自动发（素材被自动选齐也不发）。
- 演示数据的复刻技能改成与服务端同名的 `reference-video-recreation`；写剧本回分场示例，短视频按所选秒数报价。
- 只改前端：没有接口、没有迁移，服务端报价、确认卡与计费不变。
- 文件：新增 `apps/web-aiavatar/src/ip/studio-assistant-starters.tsx`（卡片配置、填空卡、拼句纯函数 `composeStarter`）及其测试；改 `src/ip/studio-assistant.tsx`、`src/styles/ip-studio-workflow.css`、`src/ip/mocks/studio-dialogue.ts`、`src/ip/studio-attachment-picker.tsx`（注释）；测试 `studio-assistant.test.tsx`、`studio-dialogue-wiring.test.ts`、`mocks/studio-dialogue.test.ts`；文档 §5、AGENTS.md、`docs/INDEX.md`、`apps/web-aiavatar/PRODUCT.md`、`apps/web-aiavatar/README.md`。

### 门禁

- `studio-assistant-starters.test.ts`（7）、`studio-assistant.test.tsx`（64）、`studio-dialogue-wiring.test.ts`、`studio-dialogue-threads.test.tsx`、`mocks/studio-dialogue.test.ts`（9）五个文件 95 条全过；另跑 `canvas-bridge/studio-dialogue.test.ts`、`studio-workspace.test.tsx` 79 条全过。「素材被自动选齐也不自动发」那条用例，去掉对应代码后会变红（确认它测得到）。
- `pnpm --filter @ai-star-eco/web-aiavatar typecheck`、`pnpm typecheck:all`、`pnpm check:api-contract`（`OK.`）均通过。
- 演示模式（`NEXT_PUBLIC_USE_MOCK=1`，`--webpack`，3917 端口，`AEP_NEXT_DIST_DIR=.next-starters`，验完还原 `tsconfig.json`、删除临时目录）无头 Chrome 1440 与 375 逐步走：四张卡 → 各自的填空卡（缺照片 / 缺梗概 / 缺参考视频时发送键不可点、原因正确）→ 从画布选 / 改选项 / 手改输入框后「按选项重写」→ 发送。四张卡都拿到对应的演示回复（出图确认卡 8 积分、剧本放进画布、10 秒横屏视频确认卡 80 积分、复刻的分析确认卡），每一步页面和助手面板都没有横向溢出。截图在会话临时目录 `starters/`（`1440-01…13`、`375-01…08`）。演示模式下上传要走后端，本机没起后端，复刻的参考视频是用左栏「＋添加 → 视频」放的空视频节点。

### 制品与发布

- 发布前核对：线上 web-aiavatar 最新发布为 `20261021-studio-create-page`（GIT_SHA `0222df1a…`，在 main 历史里）；之后只有 server 热修 `20261021-studio-action-marker`（main `1ebcaea6`，记录 `0a890d0d`）。`AIStarEcosystem-main-release` 工作区干净、没有构建 / 发布进程在跑；分支 `feat/studio-starters-20261021` 变基到 main 后快进。
- 在 `AIStarEcosystem-main-release` 的 `main`（`658c38ccf96e68aace630fd2e2aaa2f5b515598c`）构建 `RELEASE_ID=20261021-studio-starters NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn NEXT_PUBLIC_ENTERPRISE_ENABLED=1 ./infra/scripts/build-release.sh web-aiavatar`：`manifest.env` 为 `SERVICES='web-aiavatar'`、`GIT_SHA='658c38cc…'`、`NEXT_PUBLIC_AUTH_MODE='id'`、`NEXT_PUBLIC_ID_ISSUER='https://id.aibuzz.cn'`、`NEXT_PUBLIC_ENTERPRISE_ENABLED='1'`；`checksums.sha256` 两项校验通过；包内入口 `./apps/web-aiavatar/server.js`，`BUILD_ID` `JRQEOd39WIzPrBzrZsCWL`；包里能搜到四张卡的标题与说明和「按选项重写」，搜不到旧清单的「不用清单，直接说」。
- `deploy-release.sh dist/deploy/20261021-studio-starters web-aiavatar`：`[verify] ALL GREEN`。

### 线上验收

- `aistareco-web-aiavatar` 新进程 PID 1346941 于 **14:55:05 CST** 启动，`Ready`，`NRestarts=0`；`WorkingDirectory=/opt/ai-star-eco/web-aiavatar/apps/web-aiavatar`，线上 `BUILD_ID` 与本地制品一致；`/opt/ai-star-eco/releases` 最新为 `20261021-studio-starters`（`GIT_SHA='658c38cc…'`）。
- `https://aiavatar.aibuzz.cn/projects` → 200。运行目录 `.next/static/chunks/6333.3720a2ef61d8e02f.js` 含「制作个人 IP」与四张卡的说明（「真人照片变成数字形象，出多角度设定图」「一句梗概写成能拍的分场剧本」「一句描述出视频，也可以从一张图动起来」「照爆款的节奏和镜头，换成你的商品或人物」）和「需要：」「按选项重写」；公网取同名 chunk 200 且含新文案。
- **没做**：没用生产账号登录点一次卡片发消息（需要用户自己登录，发出后真模型回复会扣积分）。建议用户在新画布上各点一张卡发一次，确认技能胶囊对得上、回复走的是对应做法。

### 回滚

在 `AIStarEcosystem-main-release` 里（本地 `dist/deploy/20261021-studio-create-page` 仍在）：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-create-page web-aiavatar
```

只回 web-aiavatar，server 不动；回滚后新对话开场恢复为原来的四张卡和复刻清单。

## 发布 `20261021-studio-exec-node`（2026-10-21 17:28 CST server、17:30 CST web-aiavatar）

### 现象与取证

线上画布 `IPP-655ea55a`，用户原话：对话生成视频后不是附到之前的节点上，而是新增了一个分离的节点，且这个节点没有提示词；视频比例看着有问题。

- 助手先用 `create_nodes` 建了视频节点 `dlg-924c749ca1f7`（提示词、9:16 / 5 秒、首帧连线都在），确认执行后执行器按 `<执行>-p-<步骤>` 另建 `PEX-79c7…-p-s1` 放结果，没有提示词也没有连线；前面两张图片的结果节点同样没有提示词。
- 成片 768×1344（9:16），首帧 1024×1024（1:1）：太阳、高楼的相对位置与首帧相同，厂商把正方形首帧非等比拉伸成竖屏，纵向拉长约 1.78 倍。9:16 是助手按技能默认写的，没看首帧比例；画布结果节点是 320×240 的 4:3 框。

### 修法（main `d3a55b7d`，分支 `fix/studio-exec-node-aspect-20261021` 快进；设计真源 `docs/ip-studio-new-canvas-and-threads.md` §6，实现说明 §6.3）

- **服务端**：计划步骤可带 `targetNodeId`（规划提示词规则 8 与 JSON 形状、`skillPlanConstraints` 的 `targets`）；规划时只做形状检查，确认时（建执行 / 确认制作阶段 / 确认改过的方案）由 `StudioPlanValidator.bindTargets` 按已保存画布绑定：在画布上、类型对应、还空着、没被占用；模型没填时只在「本对话 `create_nodes` 建的同类空对象唯一、同类步骤唯一」时自动绑定，有歧义不绑，不合格丢弃并写日志。读步骤节点统一经 `StudioPlanExecutionIds.stepNodeId`：任务 `node_id`、`node.upsert`（绑定对象用 `op=update`）、依赖连线、检查节点来源、`StudioPlanOutputs` 的输出与引用解析（画布还没保存时从 run 读产物）、`StudioWorkflowService` 步骤校验、执行接口 `steps[].nodeId`。每个结果节点带这一步实际发出的提示词和 `studio.mediaFit`（任务画幅）。
- **首帧**：`StudioVideoService.alignFrame`——首帧 / 尾帧与请求画幅相差超过 2%，先验本人归属，再居中等比裁剪成本人派生图交给厂商（WebP 先 ffmpeg 转 PNG），记 `_exec.firstFrameAdjusted {from,to,mode:"crop",sourceKey,croppedKey,sourceSize,croppedSize}`，日志 `[studio-video] frame cropped`；读不了就 400 `STUDIO_VIDEO_FRAME_CROP_FAILED`，不拉伸。对话执行、手动面板（原生模式与单首帧旧协议）都经它。
- **规划模型看得到的**：素材清单写出画布记录的真实尺寸「1024×1024（1:1）」和草稿上的「设定 9:16、5 秒」；同一轮刚建、画布还没保存的对象另列；`view_images` 结果带每张图的 `size` / `aspectRatio`。
- **提示词**：`video-generation.md`（有首帧图时画幅跟首帧、准备好的对象填 `targetNodeId`）与对话提示词规则 11 补句；`PromptTemplateSeeder.SEED_VERSION` → `v23-2026-10-21-exec-target-node`。
- **web-aiavatar**：绑定步骤的结果合并进那个对象（保留标题、尺寸、规格、连线；空提示词填上，已有的照 keepText 作为可采纳建议），恢复不补重复节点；`canvas-bridge/studio-media-fit.ts` 让结果节点宽度不变、高度按产物比例（先任务画幅，媒体加载后按真实尺寸，媒体区上限 640），卡片记下所显示媒体的真实尺寸；出视频面板「首帧图是 1:1，会按 9:16 居中裁剪」+「改成 1:1」（模型支持时），不挡发送。演示 mock 照服务端补（先建对象、步骤带 `targetNodeId`、结果 `op=update` 落进同一个对象）。
- 文档：`specs/openapi.yaml`（`targetNodeId`、`steps[].nodeId` 说明）、`specs/BUSINESS_RULES.md` Studio 执行 27 / 28 条、AGENTS.md（「新建画布、多段对话与卡片精简」末尾一条、§8.0.1 ⑦ 一句事故）、TODO.md、`docs/INDEX.md`、`apps/web-aiavatar/README.md`。无迁移、无新接口。

### 真模型验证（本机，没有用生产密钥）

本机开发库副本里的聚算凭据（`studio-live-jusuan-audio` 端点，本地开发密钥加密），直连 `https://api.jusuanhub.com/v1/chat/completions`，`model=qwen38-27b`、`temperature=0.4`、`max_tokens=8192`、非流式、不带 `response_format`（该端点拒绝 `json_object`，生产按端点声明也不带）。请求按 `ProposePlanTool` 的拼法用服务端自己的类生成（技能正文、`skillPlanConstraints`、`DialogueCanvasDigest`、H3 合同），画布：一张 1024×1024 的「末日英雄设定图」+ 助手建好的空视频对象 `dlg-924c749ca1f7`（首帧连线、设定 5 秒），用户目标「用这张图做一段视频，没说画幅和时长」。回复用 `StudioPlanValidator.validateSkillPlan` 校验：

| 场景 | 调用 | 有回复 | `targetNodeId` | 画幅 |
|---|---|---|---|---|
| v23 提示词 + 新素材清单 | 7 | 5（2 次厂商 503） | 5 次都指向 `dlg-924c749ca1f7` | 5 次都是 1:1，i2v，首帧绑那张图 |
| main 上的旧提示词 + 旧素材清单（对照） | 5 | 3（2 次 503） | 3 次都没填 | 3 次都是 9:16（即线上那次） |

旧提示词下服务端的自动绑定仍会把结果放进那个对象（单测覆盖）。每次输入约 3.2k–3.6k token、输出 438–538 token。只验了规划这一步；对话模型在 `create_nodes` 里是否按首帧写画幅没有真调（TODO.md）。

### 门禁与测试

- 功能分支：`com.aistareco.aep.ipstudio.**` 116 个测试类 783 条，0 失败，5 跳过（新增 `StudioPlanTargetBindingTest`、`StudioFrameCropTest`、`PlannerAssetCatalogTest`，`StudioPlanExecutorTest` / `StudioPlanExecutionServiceTest` / `StudioVideoBatchBindingTest` / `StudioDialoguePromptWiringTest` 加用例）；web-aiavatar vitest 145 个文件 1103 条全过（新增 `studio-media-fit.test.ts`、`studio-frame-crop-hint.test.tsx`，`studio-plan-execution.test.ts`、`studio-composer-spec.test.ts`、`mocks/studio-dialogue.test.ts`、`studio-dialogue-wiring.test.ts` 加用例）；`pnpm typecheck:all`、`pnpm typecheck:admin`、`pnpm check:api-contract`（`OK.`）、`./mvnw compile -q -o` 通过。
- main（快进后，代码相同）：`pnpm typecheck:all`、`pnpm check:api-contract`、`./mvnw compile -q -o` 通过。
- 演示模式浏览器走查（`NEXT_PUBLIC_USE_MOCK=1`，`--webpack`，3921 端口，`AEP_NEXT_DIST_DIR=.next-execnode`，验完还原 `tsconfig.json`、删目录）：新画布对助手说「做一段 5 秒的视频…」→ 助手先建视频对象（360×240）再出确认卡 → 开始制作 → 结果落进同一个对象（画布上仍只有它一个节点），高度变成 678（9:16），面板里提示词还在；`IPP-0001mock` 引用「你的照片」说「用这张图做一段 5 秒的视频」→ 草稿带首帧连线、按首帧画幅 → 确认后同一对象、连线在、变成正方形；手动出视频面板选那张图作首帧、画幅 9:16 时出现「首帧图是 3:4，会按 9:16 居中裁剪」（尺寸是卡片加载图片时记下的真实 384×512），模拟 1:1 时出现「改成 1:1」，点了画幅变 1:1、提示消失。截图在会话临时目录 `exec-node/`（`1440-01…08`）。控制台只有演示模式没起后端的 500。

### 制品与发布

- 发布前核对：线上 server 最新为 `20261021-studio-action-marker`（`1ebcaea6…`，`server/app.jar` sha256 `f580d294…` 与制品一致），web-aiavatar 最新为 `20261021-studio-starters`（`658c38cc…`，`BUILD_ID` `JRQEOd39WIzPrBzrZsCWL` 与制品一致），都在 main 历史里；`AIStarEcosystem-main-release` 工作区干净、没有构建 / 发布进程，main `ae74c7a4` 快进到 `d3a55b7d`。
- 构建 `RELEASE_ID=20261021-studio-exec-node NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn NEXT_PUBLIC_ENTERPRISE_ENABLED=1 ./infra/scripts/build-release.sh server,web-aiavatar`：`manifest.env` 为 `SERVICES='server web-aiavatar'`、`GIT_SHA='d3a55b7d65bdf232cc2d7c56c377898466346ddb'`、`NEXT_PUBLIC_USE_MOCK='0'`、`NEXT_PUBLIC_ENABLE_DEV_LOGIN='0'`、`NEXT_PUBLIC_AUTH_MODE='id'`、`NEXT_PUBLIC_ID_ISSUER='https://id.aibuzz.cn'`、`NEXT_PUBLIC_ENTERPRISE_ENABLED='1'`；`checksums.sha256` 三项通过。`server/app.jar` sha256 `f8fa8b28a57bb20ab087df75c40f5eb5f3bcaa96d710a0495da152469ce0093f`，jar 内 `PromptTemplateSeeder` 版本串 `v23-2026-10-21-exec-target-node`，规划提示词含 `targetNodeId`，对话提示词含「视频画幅跟首帧图一致」，`studio/skills/video-generation.md` 与仓库逐字节一致，有 `StudioFrameCrop`，迁移最高仍 V63（与线上 jar 一致）。`web-aiavatar.tar.gz` sha256 `96f89012c48cac66f9af2f22da49c7141c0b7b3581bebe80a3e33f9bf0d8475d`，包内入口 `./apps/web-aiavatar/server.js`，`BUILD_ID` `06hvybdGyqt0ZNIWn8i0t`，chunk 能搜到「居中裁剪」与 `mediaFit`。
- `deploy-release.sh … server`：`[env-check] ALL GREEN`、`[verify] ALL GREEN`；之后 `deploy-release.sh … web-aiavatar`：`[verify] ALL GREEN`。

### 线上验收

- server 新进程 PID 1378623 于 **17:28:34 CST** 启动，`Successfully validated 63 migrations`、`Current version of schema aistareco: 63`，`Started AiStarEcoApplication in 15.619 seconds`（17:28:50），`NRestarts=0`；线上 jar sha256 `f8fa8b28…` 与制品一致。
- 启动日志：`[studio-skill] repository file key=video-generation version=1 status=active digest=302102a4fb4d`，紧接着 `[studio-skill] re-seeded video-generation as v3 from changed file video-generation.md`；其余四个技能文件摘要不变。`PromptTemplateSeeder: 刷新 54 个未改动的 prompt 基线 → v23-2026-10-21-exec-target-node`（17:28:50）。
- 库（只读查询，客户端 utf8mb4）：`prompt_template` 的 `dap.ip_studio_skill_plan` / `dap.ip_studio_skill_dialogue` 均 `version=1, updated_by=seed`，更新于 09:28:50Z；规划提示词含「在这一步填 targetNodeId」「targetNodeId?}」「aspectRatio 跟首帧图一致」，对话提示词含「视频画幅跟首帧图一致」。`ip_skill` 的 `video-generation` 为 `current_version=3, updated_by=seed`；`ip_skill_version` v3（`seed`、`published`、摘要 `302102a4fb4d`）正文含「有首帧图时跟首帧图一致」与 `targetNodeId`，v1 / v2 仍在。
- 日志 ERROR：grep `' -ERROR | ERROR [0-9]+ ---'` 对今天 00:00–17:28:00 计数 218 条（旧进程），证明 grep 能命中；17:28 之后的 3 条是旧进程 PID 1342495 停机时 17:28:33 打的（`Cannot render error page … response has already been committed`）。按新进程 PID 过滤至 17:31：**0 条 ERROR**，2 条 WARN（Hibernate 方言弃用提示、UserDetailsServiceAutoConfiguration，常规启动提示）。
- web-aiavatar 新进程 PID 1380192 于 **17:30:50 CST** 启动，`Ready`，`NRestarts=0`；`WorkingDirectory=/opt/ai-star-eco/web-aiavatar/apps/web-aiavatar`，`BUILD_ID` 与制品一致；`/opt/ai-star-eco/releases` 最新为 `20261021-studio-exec-node`（`GIT_SHA='d3a55b7d…'`）。
- `https://aiavatar.aibuzz.cn/projects` → 200，`/create` → 200；公网取 `_next/static/chunks/9526.5199feb6bdbbd663.js` 含「居中裁剪」。
- **没做**：没用生产账号在线上真跑一次对话出视频（需要用户登录，且图生视频要花积分）。建议用户在 `IPP-655ea55a` 那张画布上说「用这张图做一段视频」：确认后结果应落进助手建的那个视频对象、提示词和首帧连线都在、对象是首帧的比例；日志里能看到 `[plan-exec] step bound … node=dlg-…`。已经生成的那条变形视频不会被改，重新生成即可。

### 回滚

在 `AIStarEcosystem-main-release` 里（本地 `dist/deploy/20261021-studio-action-marker` 的 jar 与 `dist/deploy/20261021-studio-starters` 的 `BUILD_ID` 与发布前线上一致）：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-starters web-aiavatar
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-action-marker server
```

无迁移。server 回滚后提示词按 v22 刷回（只刷没人改过的行）；`video-generation` 文件摘要又变，库里没被后台改过，会把旧文件追加为 v4，v3 留在历史里。已绑定的执行状态里多了 `steps[].nodeId`，旧版本读不到它，正在跑的绑定步骤在旧版本下会按旧规则另建节点（回包里的 `node_id` 仍是绑定对象），刚发布无存量。web 回滚后结果节点不再按产物比例、面板没有裁剪提示，已写进画布的 `mediaFit` / `naturalWidth` 字段旧版本忽略。

## web 发布 `20261021-studio-queue-icons`（2026-10-21 18:23 CST，只发 web-aiavatar）

### 改了什么

用户反馈：「消息上的『已收到』和『排队中』的文字标识，改成 icon 吧，没必要这么显眼。」

- 你的消息气泡底部靠右，送达状态从一行文字改成 13px 的浅灰小图标（`--ink-3`）：发送中 `LoaderCircle`（转圈，减少动态时不转）、已收到 `Check`、排队中 `Clock`、已应用 `CheckCheck`。图标的读屏名称和悬停提示就是原来的完整文字（「排队中，下一步应用」等），外层仍是 `role="status"`。「已收到」照旧在回复开始后消失。
- 发送失败（「没有确认送达：…」+「重新发送」，`.is-failed`）要用户处理，保持文字不变。
- 实现：`messageQueueLabel` 改为 `messageQueueState`，只返回状态码（`accepted` / `queued` / `applied`，即服务端 `queueState` 的取值）；文字只在 `studio-dialogue-message.tsx` 的 `StudioDialogueQueueMark` 一处映射，`studio-dialogue-timeline.tsx` 的「发送中」也用它。样式 `studio-dialogue.css` 加 `.studio-dialogue-queue.is-mark`。只改前端：没有接口、没有迁移。
- 文件：`src/canvas-bridge/studio-dialogue-store.ts`、`src/ip/studio-dialogue-message.tsx`、`src/ip/studio-dialogue-timeline.tsx`、`src/styles/studio-dialogue.css`；测试 `studio-dialogue-store.test.ts`、`studio-dialogue-message.test.tsx`（新增两条：三种状态是带名称的图标、气泡里没有这些字；发送中是转圈图标）、`studio-assistant.test.tsx`（排队中按图标断言、页面上没有可视文字；发送失败仍是文字）；AGENTS.md「画布页改版」第三遍补一句。

### 门禁

- web-aiavatar vitest 全量 145 个文件 1105 条全过。第一次全量与构建同时跑，`studio-template-source.test.tsx` 一条（与本改动无关）超时失败，单独跑与构建结束后重跑全量都通过。
- `pnpm --filter @ai-star-eco/web-aiavatar typecheck`、`pnpm typecheck:all`（exit 0）、`pnpm check:api-contract`（`OK.`）通过。
- 演示模式（`NEXT_PUBLIC_USE_MOCK=1`，`--webpack`，3113 端口，worktree 里起，验完关掉）1440 宽：演示回复是即时的，看不到过渡状态，于是往停靠助手的用户气泡里插入同结构的标记核对样式：图标在气泡最底一行靠右、13×13、颜色 `rgb(98,109,130)`、`align-self:flex-end`。控制台只有演示模式没起后端的 500。

### 制品与发布

- 发布前核对：线上 web-aiavatar 最新为 `20261021-studio-exec-node`（`GIT_SHA='d3a55b7d…'`，`BUILD_ID` `06hvybdGyqt0ZNIWn8i0t`，在 main 历史里）；`AIStarEcosystem-main-release` 工作区干净、没有构建 / 发布进程；main `190b3085` 快进到 `87089561`（分支 `fix/studio-queue-icons-20261021`）。
- 构建 `RELEASE_ID=20261021-studio-queue-icons NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn NEXT_PUBLIC_ENTERPRISE_ENABLED=1 ./infra/scripts/build-release.sh web-aiavatar`：`manifest.env` 为 `SERVICES='web-aiavatar'`、`GIT_SHA='870895618cabe6a8eb173444145ed3f678e285fe'`、`NEXT_PUBLIC_USE_MOCK='0'`、`NEXT_PUBLIC_ENABLE_DEV_LOGIN='0'`、`NEXT_PUBLIC_AUTH_MODE='id'`、`NEXT_PUBLIC_ID_ISSUER='https://id.aibuzz.cn'`、`NEXT_PUBLIC_ENTERPRISE_ENABLED='1'`；`checksums.sha256` 两项通过。`web-aiavatar.tar.gz` sha256 `dc6bdfbb40cc3e2b07c4e072945be73725c41bbaaf06dcf7a7fa0ae722a01993`，包内入口 `./apps/web-aiavatar/server.js`，`BUILD_ID` `ld7hjNUOQXnDSHncYm06e`；CSS 含 `is-mark`，`chunks/5780.a4452bf3653b1742.js` 含「排队中，下一步应用」。
- `deploy-release.sh dist/deploy/20261021-studio-queue-icons web-aiavatar`：`[env-check] ALL GREEN`、`[verify] ALL GREEN`。

### 线上验收

- `aistareco-web-aiavatar` 新进程 PID 1391532 于 **18:23:42 CST** 启动，`Ready`，`NRestarts=0`；`WorkingDirectory=/opt/ai-star-eco/web-aiavatar/apps/web-aiavatar`，线上 `BUILD_ID` `ld7hjNUOQXnDSHncYm06e` 与制品一致；`/opt/ai-star-eco/releases` 最新为 `20261021-studio-queue-icons`（`GIT_SHA='87089561…'`）。
- `https://aiavatar.aibuzz.cn/projects` → 200，`/create` → 200；公网取 `_next/static/chunks/5780.a4452bf3653b1742.js` 含「排队中，下一步应用」。
- **没做**：没用生产账号登录发一条消息看图标（需要用户自己登录，真模型回复会扣积分）。

### 回滚

在 `AIStarEcosystem-main-release` 里（本地 `dist/deploy/20261021-studio-exec-node` 的 `BUILD_ID` 与发布前线上一致）：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-exec-node web-aiavatar
```

只回 web-aiavatar，server 不动；回滚后气泡里的送达状态恢复为文字。
