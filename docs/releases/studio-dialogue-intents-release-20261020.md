# Studio 对话意图直达 · 生产发布（2026-10-21 10:14 CST，release `20261020-studio-dialogue-intents`）

> 设计真源 [`docs/ip-studio-dialogue-intents.md`](../ip-studio-dialogue-intents.md)；本地真模型评测 [`studio-dialogue-intents-validation-20261020.md`](studio-dialogue-intents-validation-20261020.md)。

## 制品

- 构建所用提交：`main` **`eea08f72`**（`Merge dialogue intents…`），在干净工作区 `AIStarEcosystem-main-release` 构建；本地 main 未推远端。
  - 功能提交 `d968d71e`（分支 `dev/h3-video-dialogue-frames-20261020`），合 main 的提交 `23a52ba0`（分支 `dev/dialogue-intents-merge`）。
- 服务：**server + web-aiavatar**（先 server 10:14，后 web-aiavatar）。构建参数 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，已核对 `manifest.env`。
- 发布前基线：server = `20261021-production-model-compat`（`76ef8ee8`），web-aiavatar = `20261021-studio-prod-fixes`（`14260eea`），两者都在 main 历史里。
- 无新迁移；提示词 `PromptTemplateSeeder.SEED_VERSION` = `v19-2026-10-20-dialogue-intent-direct-merged`。

## 合并 main 时的取舍

- main 同日的「原创创作」`original-creation` 与「出图」触发词重叠（画一张 / 海报 / 出图 / 设定图），改为 `status: withdrawn`，文件保留。
- 直达判定统一为 `StudioSkill.firstStage()`（main），`direct()` 委托给它；删除本分支的 `startingStage()`。
- `DialogueActionProtocol` 以 main 的重写为底，补回评测里的三种宽松写法与单测。
- 对话提示词以本分支为底，并入 main 的「看图要真看 / 规格写到对象上 / 不模仿工作记录 / 标记写法」。
- 没有活跃执行时新方案从技能的第一阶段起（main 规则）；直达技能的制作方案没有 approaches 时不要求 approachId。

## 门禁（合并结果，main 上）

- `./mvnw -o -Dtest='*Studio*,*Dialogue*,*Skill*,PromptTemplate*,EntityIdentifierTest' test`：`Tests run: 641, Failures: 0, Errors: 0, Skipped: 5`。
- `pnpm typecheck:all && pnpm typecheck:admin && pnpm check:api-contract`：通过（`OK.`）。
- `pnpm --filter @ai-star-eco/web-aiavatar test`：`Test Files 137 passed (137)`，`Tests 1000 passed (1000)`。
- 合入 main 后再跑 `./mvnw compile -q -o` 与 `pnpm typecheck:all`：通过。

## 线上验收

- `deploy-release.sh` 两次均 `[verify] ALL GREEN`。
- 新进程（10:14:13 启动）之后 `journalctl -u aistareco-server | grep -E ' -ERROR | ERROR [0-9]+ ---'`：**0 条**（之前 10:07–10:08 的 7 条来自旧进程）。
- 启动日志：`[studio-skill] repository file key=` 五条，`image-generation / script-writing / video-generation` 为 `seeded … v1`，`original-creation version=1 status=withdrawn` → `re-seeded original-creation as v2`，`reference-video-recreation` re-seeded v2；`PromptTemplateSeeder: 刷新 54 个未改动的 prompt 基线 → v19-2026-10-20-dialogue-intent-…`。
- 库 `ip_skill`：image-generation / reference-video-recreation / script-writing / video-generation 为 `active`，original-creation 为 `withdrawn`（全部 `updated_by=seed`）。`prompt_template` 的 `dap.ip_studio_skill_dialogue` / `dap.ip_studio_skill_plan` 均 `version=1, updated_by=seed`，更新于 02:14:14Z，对话提示词含新意图表与「看图要真看」。
- `GET /api/v1/ip-studio/studio/skills` 未带令牌 → 401（接口在；带令牌的列表**没查**）。`https://aiavatar.aibuzz.cn/projects` → 200。
- **没做**：用生产账号发「画一张国风少女海报，9:16」验证一轮出方案 + 确认卡。本机 Chrome 扩展未连接，又不能替用户登录，这一条需要用户自己在浏览器里发一次（别点确认）。

## 回滚

在 `AIStarEcosystem-main-release` 里：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-prod-fixes web-aiavatar
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-production-model-compat server
```

server 回滚后，旧文件的摘要与库里最新种子不同，`original-creation` 会被重新种成 active，提示词按旧 SEED_VERSION 刷回（只刷没人改过的行）。

## 评测记录里仍未解决 / 未复测的项

- 复刻第一轮先问问题、不发卡（#4 #5）：评测后已改复刻技能正文与对话提示词（「第一轮直接出分析方案和卡，问题放 questions」），**未在真模型上复测**。
- 「画布上的这段剧本，出成视频」路由到写稿（#11）、「这个视频配个音」绑到出视频（#12）：评测后触发词改成动词短语（不再有裸「剧本 / 视频 / 文案」），**未复测**。
- 回复正文同一句重复两遍（Qwen #3 #9）：未定位。
- 确认卡 → 建执行 → 出图 → 节点出现的完整闭环：本地与线上都没跑。
- Agnes 2.5 Flash 格式稳定性差（宣布动作不发动作、退化成成串 `<tool_call>`）：不适合作对话默认模型，未处理。
- 配音 / 口型技能接入对话：未做（TODO.md）。
