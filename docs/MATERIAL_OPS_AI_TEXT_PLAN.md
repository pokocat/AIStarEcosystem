# 素材运营 · 文本类 AI 接入技术方案（Tier 1）

> 状态：**已落地（v0.40，2026-05-29）** —— M1–M4 + 管理页（M1.5）+ 脚本起稿计费（后端可配置，默认 0）已实现；不静默兜底（配置问题明确报错）；违禁词 server lint / Langfuse 仍为可选未做
> 范围：脚本 AI 生成 · 卖点提取 · 变量抽取（「文本三件」）+ 顺带的违禁词真扫描
> last-reviewed：2026-05-29
> 关联：[`AGENTS.md`](../AGENTS.md) §AI、[`docs/INDEX.md`](INDEX.md)

---

## 0. 背景与目标

素材运营（`apps/web-celebrity` material-ops）现有多处「AI 交互」是**前端表演**或**后端 stub**：

| 触点 | 现状 |
|---|---|
| 脚本 AI 生成（起稿中心 AI tab） | 前端 `DraftingHub.aiCandidates()` 硬编候选池；server `TemplateScript /draft-with-ai` 返回 `【AI 草稿 stub】` |
| 卖点提取（商品表单「AI 提取卖点」） | `ProductService.extractSellingPoints()` 返回固定模板串 |
| 变量抽取（派生变体） | 前端 `lib.ts.extractVariablesFromScript()` 纯正则启发式 |

系统**已具备一套真 LLM 网关** `AiModelInvocationService.invokeChat()`（OpenAI 兼容、11 家 provider、AES-GCM 加密、按 `purpose` 选 provider + priority fallback）。本方案把上述三件**接到这套现成网关**，不引入任何 agent / 编排 / RAG 框架。

**目标**：三件文本能力由真 LLM 产出，且 prompt 可控、输出结构化可靠、provider 未配/失败时优雅降级（不影响演示与可用性）。

---

## 1. 范围

**In scope（本方案）**
- 卖点提取、脚本 AI 生成、变量抽取 → 真 LLM（`invokeChat`）。
- 违禁词扫描 → 纯规则真实化（顺带，无需模型）。
- 结构化输出可靠性、降级、计费、测试、可观测接入点。

**Out of scope（明确不做，列在 §13）**
- 真·视频生成引擎、RAG/向量去重、多轮对话式 agent、爆款雷达真实抓取。

---

## 2. 设计原则

1. **不引 agent 系统**：三件均为单轮「prompt 进 → 结构化 JSON 出」，无工具/多步/记忆需求。引 Dify/FastGPT/LangChain 会与现有 `AiModelProvider` 网关重复造轮子、双份运维。
2. **复用现成网关**：所有 LLM 调用唯一入口 = `AiModelInvocationService.invokeChat(purpose, messages)`；provider 选择/fallback/加密/计费全部沿用。
3. **prompt 真源在 DB**：每个能力的 **system + user 模板都存 `prompt_template` 表**（见 §6），运营可在 admin 改 / 灰度 / 回滚，无需改代码或重启；server 代码只负责把业务参数填进 `{{占位符}}`。前端只传业务参数，不传 prompt/模型。
4. **不静默兜底，配置问题要可见**（按用户要求，v0.40 修订）：provider 未配 / prompt 未配 / 调用失败（含 token 无效 401/403）/ JSON 解析失败 → 抛带 code 的明确错误（`AI_NOT_CONFIGURED` / `PROMPT_NOT_CONFIGURED` / `AI_CALL_FAILED` / `AI_BAD_OUTPUT`），前端展示出来，便于定位「token / prompt 未配」等配置问题。脚本起稿 / 卖点提取为阻塞式报错（不再自动用占位池/模板）；变量抽取保留正则结果可继续用，但显式警示 AI 未生效。`USE_MOCK` 前端模式不打后端、自有本地占位池/正则，与此无关。
5. **加性变更**：新增 purpose 与端点，不动现有 `invokeChat`、不动其他 purpose 的调用方。

---

## 3. 总体架构

```
前端 (USE_MOCK=0)                    server                                  provider
─────────────────                   ────────────────────────────────         ─────────
DraftingHub AIPicker  ── POST ─▶  MaterialAiController
ProductForm「AI 提取」 ── POST ─▶    │  /api/material/scripts/ai-draft
DeriveVariablesPanel  ── POST ─▶    │  /api/material/scripts/{id}/variables
                                    │  (/admin/products/extract-selling-points 换实现)
                                    ▼
                              MaterialAiService（新增·薄层）
                              ① 取业务上下文（商品卖点/平台规则/违禁词/脚本）
                              ② PromptService.resolve(key) 取 system+user 模板（DB，见 §6）→ 填业务参数
                              ③ invokeChat(purpose, messages) ───────────────▶ /chat/completions
                              ④ 解析 JSON → 校验(Jackson→record)              ◀──────────────
                              ⑤ 不合法 → 带错误重试 1 次；再失败 → 抛 AI_BAD_OUTPUT（不静默兜底）
                              ⑥ (可选) Langfuse 记录 in/out/token/耗时
                                    │
                              复用：AiModelProvider(purpose路由) · AepCryptoUtil · CreditService
```

`MaterialAiService` 是唯一新增的「编排」单元，且只是**线性流水线**，不是 agent。

---

## 4. 复用 / 新增清单

| 项 | 动作 | 位置 |
|---|---|---|
| `AiModelPurpose` | **复用 `SCRIPT_DRAFT`**；**新增 `SELLING_POINTS`、`VARIABLE_EXTRACT`**（可选 `SCRIPT_SCORE`） | `aep/model/AiModelPurpose.java` |
| `AiModelInvocationService.invokeChat()` | 复用，不改 | `aep/service/` |
| `MaterialAiService` | **新增**：3 个方法（draftScripts / extractSellingPoints / extractVariables）+ 解析兜底 helper | `aep/service/MaterialAiService.java` |
| `MaterialOpsController` | **加 2 个端点**（ai-draft / variables）；注入 `MaterialAiService` | `aep/controller/MaterialOpsController.java` |
| `ProductService.extractSellingPoints()` | **换实现**：stub → 调 `MaterialAiService`（端点不变） | `aep/service/ProductService.java` |
| `PromptTemplate` 实体 + repo | **新增**：`prompt_template` 表（promptKey / systemPrompt / userTemplate / paramsJson / version / enabled，见 §6） | `aep/model/PromptTemplate.java` + `aep/repository/` |
| `PromptService` | **新增**：`resolve(promptKey)` 取模板（1min 缓存 + admin 改后失效）；DB 缺 → resource 默认 → 代码内兜底 | `aep/service/PromptService.java` |
| `PromptTemplateSeeder` | **新增**：`SEED_VERSION` 守门，把 `resources/prompts/material/*.md` 默认灌库（缺行才插，不覆盖运营改过的行） | `aep/config/PromptTemplateSeeder.java` |
| admin prompt 管理 | **新增**：`/api/admin/prompts` CRUD + 试运行；admin 页 `/platform/prompts` | controller + `apps/admin` |
| prompt 默认文案 | **新增**：`resources/prompts/material/*.md`（仅作 seeder 基线 / git 留底，运行时读 DB 而非直接读文件） | `apps/server/src/main/resources/prompts/material/` |
| 前端 api/组件 | 接新端点，`USE_MOCK` 兜底保留 | 见 §5 各节 |

---

## 5. 三个能力详细规格

> 通用：每个能力的 system + user 模板取自 `prompt_template` 表（`PromptService.resolve`，见 §6），server 仅把业务参数填进 `{{占位符}}`；`messages = [{role:system,…},{role:user,…}]`；provider 支持时开 `response_format=json_object`；输出 JSON 一律走 §7 的解析+校验+兜底。下文各能力的「prompt 骨架」即 `.md` 默认模板的来源（存表后可改）。

### 5.1 卖点提取 `SELLING_POINTS`
- **端点**（已存在，换实现）：`POST /api/admin/products/extract-selling-points`，body `{ name, link }`（仅运营角色，沿用现门禁）。
- **输入上下文**：商品名 + 链接（+ 若已抓到页面信息则带上）。
- **prompt 骨架**：
  - system：「你是抖音选品文案专家。根据商品信息提炼 3–5 条可用于带货脚本的卖点，口语化、突出差异点与场景，禁用绝对化/医疗违禁词。只输出 JSON。」
  - user：`商品名：{name}\n链接：{link}\n输出：{"selling_points": string[]}`
- **输出 schema**：`{ selling_points: string[] }` → 拼成现有返回的 `sellingPoints` 串（`/` 连接，兼容前端 chip 拆分）。
- **兜底**：解析失败 / 无 provider → 现有 stub 模板串。
- **前端**：`CelebrityProductForm`「AI 提取卖点」无改动（端点不变）；`USE_MOCK` 仍走本地占位。
- **量**：S。

### 5.2 脚本 AI 生成 `SCRIPT_DRAFT`（复用现有枚举）
- **端点**（新增）：`POST /api/material/scripts/ai-draft`，body `{ product_id, tone, audience, duration_sec, count }`（authenticated）。
- **输入上下文**（server 取）：`Product`（名/类目/价/卖点）+ `PLATFORM_RULES`（甜区时长/钩子窗口/话题）+ 违禁词黑名单。
- **prompt 骨架**：
  - system：「你是短视频带货编剧。基于商品与平台规则，产出 {count} 个**风格各异**的脚本，每个 5 镜头（hook/scene·emotion/product/effect/cta），钩子前置 3s，规避违禁词。严格只输出 JSON 数组，符合给定 schema。」
  - user：注入商品卖点、目标受众 `{audience}`、风格 `{tone}`、目标时长 `{duration_sec}`、违禁词列表、**输出 JSON Schema** + 1 个 few-shot 样例。
- **输出 schema**（对齐前端 `ScriptAsset`）：
  ```jsonc
  [{ "name","tier","hook_type","tags":[],
     "blocks":[{"kind","label","dur","text","shot"}],   // 5 条
     "duration_sec" }]
  ```
  server 补 `id`（nanoid）、`kind:"ai_seed"`、`product_id`、`source:{type:"ai",author:"智能体生成"}`、`cover_color`、`metrics` 初值，返回 `ScriptAsset[]`。
- **不落库**：仅返回候选；用户在编辑器选用并「保存」时才走既有 `saveScript`（落库 + 归属当前用户，见归属方案）。
- **兜底**：失败 → 现有 `aiCandidates()` 同款 pool（移到 server 或前端保留）。
- **前端**：`DraftingHub` 的 `AIPicker.run()` 由调用 `aiCandidates()` 改为 `MaterialOpsApi.aiDraft({…})`；`USE_MOCK` 保留本地 pool。
- **量**：M。

### 5.3 变量抽取 `VARIABLE_EXTRACT`（新增枚举）
- **端点**（新增）：`POST /api/material/scripts/{id}/variables`（authenticated；私有脚本沿用 owner 校验）。
- **输入上下文**：该脚本 blocks 文本。
- **prompt 骨架**：
  - system：「你从带货脚本中找出**可替换的变量**（如人物身份/亲属关系/场景/反应台词/商品出场/CTA），给出变量名、原值、若干候选替换值、出现在第几镜。只输出 JSON。」
  - user：脚本 blocks（带镜次）+ 输出 schema。
- **输出 schema**（对齐前端 `ScriptVariable`）：
  ```jsonc
  [{ "id","name","values":[string],
     "appearances":[{"shot":number,"phrase":string}],
     "suggestions":[string] }]
  ```
  （`toneVar` 由前端按序补色，不让模型管样式。）
- **兜底**：失败 → 现有 `extractVariablesFromScript()` 正则结果。
- **前端**：`DeriveVariablesPanel` 由本地 `extractVariablesFromScript` 改为先 `await MaterialOpsApi.extractVariables(scriptId)`；`USE_MOCK` 用正则兜底。
- **量**：M（需保证变量值能在脚本里精确替换 → 模型须回原值原文，必要时 server 做一次「原值确实出现在脚本中」校验，过滤幻觉变量）。

### 5.4 违禁词扫描（顺带，规则即真）
- 现有 `BANNED_WORDS` 词表已在 server（`material-ops-ui` 前端 + 可在 server 建同源词表）；`AgentPanel`/`ShotBlock` 的命中扫描改为 server 端点 `POST /api/material/lint`（输入文本 → 命中词 + 分级 + 建议替换），或保持前端纯规则（已够用）。**无需 LLM**。量：S。

---

## 6. Prompt 存储与管理（`prompt_template` 表）

> 决策：**system 与 user 模板都建表存**，不放 `.txt`、不塞 `PlatformConfig` blob。运营可在后台改 prompt / 灰度 / 回滚，无需改代码或重启；代码只负责把业务参数填进占位符。

### 6.1 表结构

`prompt_template`（JPA `ddl-auto=update` 自动建表，H2/MySQL 双兼容，沿用 v0.30/v0.21 加列惯例）：

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | varchar(64) PK | nanoid |
| `prompt_key` | varchar(64) unique | 与 `AiModelPurpose` 对齐：`material.script_draft` / `material.selling_points` / `material.variable_extract` |
| `system_prompt` | `@Lob` LONGTEXT | system 角色内容（空 → 取 resource 默认） |
| `user_template` | `@Lob` LONGTEXT | user 角色模板，含 `{{placeholder}}`（如 `{{name}}` / `{{audience}}` / `{{banned_words}}` / `{{schema}}`） |
| `params_json` | `@Lob` TEXT | `{ temperature, maxTokens, jsonMode }`，注入 `invokeChat` |
| `version` | int | 每次保存 +1，便于回滚 / 审计 / 判断运营是否改过 |
| `enabled` | boolean | false → `PromptService` 跳过 DB，直接走 resource 默认 |
| `updated_at` / `updated_by` | timestamp / varchar | 审计 |

> **只有「把业务参数填进 `{{占位符}}`」留在代码**（`MaterialAiService`）；模板文本（system + user）全部来自表。占位符是契约：seeder 默认模板里的 key 与代码填充的 key 必须一致（§6.4）。

### 6.2 `PromptService.resolve(promptKey)`

```
resolve(promptKey) →
  ① 读 1min 缓存（AtomicReference<Map>，admin PUT 后立即 invalidate）——沿用 CelebrityActionPricingService 模式
  ② 缓存未命中 → 查 prompt_template（enabled=true）
  ③ DB 命中 → { system, userTemplate, params }
  ④ DB 无 / disabled → 读 resource 默认（resources/prompts/material/<key>.md，按 "---" 分隔 system / user）
  ⑤ resource 也缺 → 代码内常量兜底（保证永不 NPE / 永远可降级）
```

`MaterialAiService` 拿到 `{system, userTemplate, params}` 后：`userPrompt = fill(userTemplate, 业务参数)` → `messages=[{system},{user}]` → 按 `params` 调 `invokeChat`。`fill` 是纯字符串替换（不引模板引擎，避免新依赖）。

### 6.3 admin 管理页 `/platform/prompts`

- **列表**：promptKey / version / enabled / updatedAt / updatedBy。
- **编辑**：system + userTemplate 双 textarea（占位符高亮 + 「可用变量」提示）、params（temperature / maxTokens / jsonMode）、enable 开关。
- **试运行**：填一组样例参数 → `POST /api/admin/prompts/{key}/dry-run` → 展示 fill 后的最终 messages（可选真调一次看输出），让运营改 prompt 不动代码即可验证。
- **端点**：`GET/PUT /api/admin/prompts[/{key}]`、`POST /api/admin/prompts/{key}/dry-run`（仅 SUPER_ADMIN / OPERATOR；沿用 `/api/admin/**` 门禁）。

### 6.4 默认值与 seeder

- 默认 prompt 文案以 `resources/prompts/material/<key>.md` 入 git（评审友好 + 留底）；**运行时不直接读文件**，由 `PromptTemplateSeeder` 首启灌库。
- seeder 策略：**缺行才插**（按 `prompt_key`），已存在的行不覆盖 —— 避免 clobber 运营在后台改过的 prompt。需要推新基线时 bump `SEED_VERSION`，仅回填运营未改过的行（`version == 1`）。
- §5 各能力的「prompt 骨架」就是这些 `.md` 默认文案的来源；落地时把 §5 文字转成默认模板，system / user 用 `---` 分隔。

---

## 7. 结构化输出可靠性（横切，最关键）

这三件的真正工程风险不是「编排」，是「LLM 稳定出合法 JSON」。统一策略：

1. **JSON 模式**：provider 支持就在请求里开 `response_format={type:"json_object"}`；不支持则靠 prompt 强约束。
2. **Schema 注入 + few-shot**：prompt 内贴目标 JSON Schema 与 1 个示例，降低跑偏。
3. **解析→校验**：Jackson 反序列化到目标 record（`MaterialScriptDraft[]` / `ScriptVariableDto[]`），字段缺失/类型错即视为不合法。
4. **自修复重试 1 次**：不合法时追加一条 `assistant`(上次输出) + `user`(「上次不符合 schema，错误：X，请只返回合法 JSON」) 再调一次。
5. **失败显性化**：仍失败 → 抛 `AI_BAD_OUTPUT` / `AI_CALL_FAILED` 等明确错误，不回退占位；占位池仅限 `USE_MOCK=1` 的纯前端模式。
6. **业务后校验**：变量抽取额外校验「原值确实出现在脚本」；脚本生成校验「恰好 5 镜头、dur 合理」，不满足则丢弃该候选。

---

## 8. 错误与容错矩阵（v0.40：不静默兜底，配置问题可见）

| 情况 | 行为 | 错误码 / HTTP |
|---|---|---|
| 无对应 purpose 的启用 provider | `MaterialAiService.ensureConfigured` 先判 `invocation.hasProviderFor` → 抛明确错误（提示去 `/platform/ai-models` 配该用途 + 有效 Key） | `AI_NOT_CONFIGURED` / 503 |
| prompt 模板缺失（DB 无 + resource 无 → 仅代码兜底） | `ensureConfigured` 判 `resolved.origin()=="code"` → 抛（提示去 Prompt 管理） | `PROMPT_NOT_CONFIGURED` / 503 |
| provider 调用失败（含 token 无效 401/403、网络、5xx fallback 用尽） | `invokeChat` 抛 → `MaterialAiService` 包成明确错误（401/403 附「API Key 可能无效」提示） | `AI_CALL_FAILED` / 502 |
| JSON 解析失败 | 自修复重试 1 次 → 仍失败抛 | `AI_BAD_OUTPUT` / 502 |
| 校验后无有效结果（脚本镜头/字段、卖点为空） | 抛 | `AI_BAD_OUTPUT` / 502 |
| 变量抽取失败 | 后端抛上述错误；**前端 catch 后保留正则结果可继续用 + 显式警示** AI 未生效 | （前端非阻塞） |
| 变量抽取返回空（模型确实没找到） | 合法，返回 `[]`，不报错 | 200 |
| `USE_MOCK=1`（前端无后端） | 前端走本地占位（aiCandidates/正则），不打后端，与此无关 | — |

**原则（v0.40 按用户要求修订）：配置/调用/解析失败不静默吞掉**——把带 code 的明确报错透传到前端，便于一眼看出「token 未配 / prompt 未配 / 模型不行」。脚本起稿 / 卖点提取为阻塞式报错（不再自动用占位池）；变量抽取保留正则兜底但显式提示 AI 未生效。前端 `apiFetch` 把错误包成 `ApiError`（`.code` / `.message`）。

---

## 9. 安全与计费

- **门禁**：卖点提取留在 `/api/admin/products/**`（仅运营）；脚本/变量在 `/api/material/**`（authenticated），私有脚本沿用 owner 校验。
- **凭据**：provider apiKey 走 `AepCryptoUtil`（已有），不在前端/日志出现。
- **计费（已落地，后端可配置）**：AI 起稿按 `CelebrityActionPricingService` action `material.script-draft` 取单价（admin → 平台与配置 → 引擎价格 → 动作单价表；**默认 0 = 不计费**，运营设单价即开启）。`MaterialOpsService.draftScripts` 走 `CreditService.hold(单价 × 稿数) → 成功 commitHold / 失败 releaseHold` 三段式（不可变账本约束，CLAUDE.md §4.2）；余额不足 → `CreditService` 抛 402，明确报错；`anonymous` 用户不计费。方法标 `@Transactional(NOT_SUPPORTED)`，让 hold/commit 各自独立落账且 LLM HTTP 调用不占 DB 连接。卖点/变量量小，暂不计费。

---

## 10. 可观测（可选但推荐）

- 接 **Langfuse**（开源，自托管）：在 `MaterialAiService` 调 `invokeChat` 处埋点，记录 purpose / prompt / 输出 / token / 耗时 / 是否兜底。
- 价值：prompt 迭代时能看真实样本、做 A/B 与回归；与 provider 选择解耦。
- 落地最小化：一个 `AiTrace` 切面或 service 内手动上报；无 Langfuse 时降级为 slf4j INFO。

---

## 11. 测试方案

- **单测/集成**（`@SpringBootTest`，注入 fake `AiModelInvocationService`）：
  - 正常：fake 返回合法 JSON → 端点返回结构化结果。
  - 脏输出：fake 返回带 ```json 包裹 / 多余文本 → 解析+重试通过或兜底。
  - 无 provider：fake 抛异常 → 返回占位、HTTP 200。
  - 变量后校验：模型给出脚本中不存在的原值 → 被过滤。
- **E2E**（沿用 `MaterialOpsE2ETest` dev profile + 内存 H2 + MockMvc）：3 个端点 200 + 壳 `{success:true}` + 兜底路径。
- 不接真 provider（需密钥）——用 fake/桩。

---

## 12. 工作量与里程碑

| 里程碑 | 内容 | 量 |
|---|---|---|
| M1 | `AiModelPurpose` 加值 + `prompt_template` 表/`PromptService`/seeder（§6）+ `MaterialAiService` 骨架 + §7 解析/兜底 helper + 单测 | M |
| M1.5 | admin `/platform/prompts` 管理页（CRUD + 试运行） | S |
| M2 | 卖点提取换实现（端点不变） | S |
| M3 | 脚本 AI 生成端点 + 前端接入 + 计费(可选) | M |
| M4 | 变量抽取端点 + 前端接入 + 原值后校验 | M |
| M5 | 违禁词真扫描（规则） + Langfuse 埋点(可选) | S |

一个迭代可覆盖 M1–M5（视频引擎/RAG 不在内）。

---

## 13. 明确 Out of scope

- **真·视频生成引擎**（文生视频/数字人 adapter、celebrity 引擎、VideoGenDialog 真生成）——另立方案，需先选型 provider。
- **RAG / 向量去重**（历史相似度、智能体「喂语料」检索）——需向量库，后置。
- **多轮对话式创作 agent**——需要时优先复用已接入的 **Coze**（`AgentScenes` 加 scene），而非新引框架。
- **爆款雷达真实抓取**——平台 API/合规单独评估。

---

## 14. 文档同步清单（落地时按 CLAUDE.md §9 同 commit 更新）

- `specs/openapi.yaml`：新增 `/material/scripts/ai-draft`、`/material/scripts/{id}/variables`、`/admin/prompts*`（+ 复核 `extract-selling-points`）。
- `apps/server/README.md`：AI 数据流 / 新 purpose / `MaterialAiService` + `prompt_template` 表 / `PromptService` 段。
- `apps/admin/README.md`：sidebar 加「Prompt 管理」入口（`/platform/prompts`）。
- `apps/web-celebrity/README.md` + `PRODUCT.md`：AI 起稿/变量「接真」版本日志。
- `docs/INDEX.md`：补本文件行（已加）。
- `AGENTS.md`：v 增量节记录「文本三件接真 + prompt 配置化」。

---

## 15. 风险 / 待决

- **provider 未配 → 明确报错（不降级）**：上线前需在 `/platform/ai-models` 配好带 `SCRIPT_DRAFT/SELLING_POINTS/VARIABLE_EXTRACT` purpose 的 provider + 真 apiKey（模型 id 用「获取模型列表」选真实 id）。未配时前端会直接显示 `AI_NOT_CONFIGURED` 报错（这正是 v0.40 想要的：配置问题可见，不被占位掩盖）。
- **JSON 稳定性**：弱模型可能频繁触发重试/报错 → 建议这几件用稍强的模型（如 DeepSeek-V3 / 豆包 pro 级）。
- **成本/并发**：脚本生成 N 稿 = N 段长输出；批量与配额需观察（`invokeChat` 已有 fallback，但无限流，必要时加节流）。
- **prompt 多实例缓存**：`PromptService` 1min 内存缓存单实例 OK；多实例部署时 admin 改 prompt 后其他实例最多 1min 后才生效（可接受；强一致需 Redis pub/sub，后置）。
- **prompt seeder 不回填运营改过的行**：bump `SEED_VERSION` 只覆盖 `version==1` 的行；运营手改后想回默认基线需在 admin 手动操作（无自动 diff/merge）。
- **已决**：prompt（system + user）建 `prompt_template` 表存储、admin 可改（见 §6）。
- **已决**：脚本起稿计费已接 `CreditService` 三段式，单价走 `material.script-draft` action（admin 可配，默认 0=不计费，见 §9）。
- **待决**：违禁词扫描放前端还是 server、是否现在就接 Langfuse。
