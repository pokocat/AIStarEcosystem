# 素材运营 · 文本类 AI 接入技术方案（Tier 1）

> 状态：**提案 / 草案（仅设计，未落地）**
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

**Out of scope（明确不做，列在 §12）**
- 真·视频生成引擎、RAG/向量去重、多轮对话式 agent、爆款雷达真实抓取。

---

## 2. 设计原则

1. **不引 agent 系统**：三件均为单轮「prompt 进 → 结构化 JSON 出」，无工具/多步/记忆需求。引 Dify/FastGPT/LangChain 会与现有 `AiModelProvider` 网关重复造轮子、双份运维。
2. **复用现成网关**：所有 LLM 调用唯一入口 = `AiModelInvocationService.invokeChat(purpose, messages)`；provider 选择/fallback/加密/计费全部沿用。
3. **prompt 在 server 组装**：延续「prompt 真值源在后端」（参考 `ScriptPreview` PromptView 的字段→模板思路）。前端只传业务参数，不传 prompt/模型。
4. **永远可降级**：provider 未配 / 调用失败 / JSON 解析失败 → 回退到现有占位（mock 文案 / 正则），HTTP 仍 200，前端无感。
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
                              ② 组装 system+user prompt（注入 JSON Schema + few-shot）
                              ③ invokeChat(purpose, messages) ───────────────▶ /chat/completions
                              ④ 解析 JSON → 校验(Jackson→record)              ◀──────────────
                              ⑤ 不合法 → 带错误重试 1 次；再失败 → 占位兜底
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
| prompt 模板 | **新增**：`resources/prompts/material/*.txt`（可版本化/灰度） | `apps/server/src/main/resources/prompts/` |
| 前端 api/组件 | 接新端点，`USE_MOCK` 兜底保留 | 见 §5 各节 |

---

## 5. 三个能力详细规格

> 通用：`messages = [{role:system,…},{role:user,…}]`；要求 provider 支持时开 `response_format=json_object`；输出 JSON 一律走 §6 的解析+校验+兜底。

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

## 6. 结构化输出可靠性（横切，最关键）

这三件的真正工程风险不是「编排」，是「LLM 稳定出合法 JSON」。统一策略：

1. **JSON 模式**：provider 支持就在请求里开 `response_format={type:"json_object"}`；不支持则靠 prompt 强约束。
2. **Schema 注入 + few-shot**：prompt 内贴目标 JSON Schema 与 1 个示例，降低跑偏。
3. **解析→校验**：Jackson 反序列化到目标 record（`MaterialScriptDraft[]` / `ScriptVariableDto[]`），字段缺失/类型错即视为不合法。
4. **自修复重试 1 次**：不合法时追加一条 `assistant`(上次输出) + `user`(「上次不符合 schema，错误：X，请只返回合法 JSON」) 再调一次。
5. **失败降级**：仍失败 → 回退占位（§5 各节兜底），并记 WARN（含 provider、purpose、body 前 240 字）。
6. **业务后校验**：变量抽取额外校验「原值确实出现在脚本」；脚本生成校验「恰好 5 镜头、dur 合理」，不满足则丢弃该候选。

---

## 7. 降级与容错矩阵

| 情况 | 行为 |
|---|---|
| 无对应 purpose 的启用 provider | `invokeChat` 抛「没有可用 provider」→ `MaterialAiService` catch → 返回占位 + WARN（提示去 `/platform/ai-models` 配） |
| provider 5xx | `invokeChat` 已自动 fallback 到次高 priority |
| 调用超时 / 网络错 | catch → 占位兜底 |
| JSON 解析/校验失败 | 重试 1 次 → 仍失败则占位兜底 |
| `USE_MOCK=1`（前端无后端） | 前端走本地占位（aiCandidates/正则/模板），与今天一致 |

**原则：AI 失败绝不让用户流程中断**——降级到占位即可，体验退化但不报错。

---

## 8. 安全与计费

- **门禁**：卖点提取留在 `/api/admin/products/**`（仅运营）；脚本/变量在 `/api/material/**`（authenticated），私有脚本沿用 owner 校验。
- **凭据**：provider apiKey 走 `AepCryptoUtil`（已有），不在前端/日志出现。
- **计费（可选，建议脚本生成做）**：AI 起稿按 `CelebrityActionPricingService` 取单价（新增 action `material.script-draft`）→ `CreditService.hold → commit/release` 三段式（不可变账本约束，CLAUDE.md §4.2）。卖点/变量量小，可暂不计费。

---

## 9. 可观测（可选但推荐）

- 接 **Langfuse**（开源，自托管）：在 `MaterialAiService` 调 `invokeChat` 处埋点，记录 purpose / prompt / 输出 / token / 耗时 / 是否兜底。
- 价值：prompt 迭代时能看真实样本、做 A/B 与回归；与 provider 选择解耦。
- 落地最小化：一个 `AiTrace` 切面或 service 内手动上报；无 Langfuse 时降级为 slf4j INFO。

---

## 10. 测试方案

- **单测/集成**（`@SpringBootTest`，注入 fake `AiModelInvocationService`）：
  - 正常：fake 返回合法 JSON → 端点返回结构化结果。
  - 脏输出：fake 返回带 ```json 包裹 / 多余文本 → 解析+重试通过或兜底。
  - 无 provider：fake 抛异常 → 返回占位、HTTP 200。
  - 变量后校验：模型给出脚本中不存在的原值 → 被过滤。
- **E2E**（沿用 `MaterialOpsE2ETest` dev profile + 内存 H2 + MockMvc）：3 个端点 200 + 壳 `{success:true}` + 兜底路径。
- 不接真 provider（需密钥）——用 fake/桩。

---

## 11. 工作量与里程碑

| 里程碑 | 内容 | 量 |
|---|---|---|
| M1 | `AiModelPurpose` 加值 + `MaterialAiService` 骨架 + §6 解析/兜底 helper + 单测 | S |
| M2 | 卖点提取换实现（端点不变） | S |
| M3 | 脚本 AI 生成端点 + 前端接入 + 计费(可选) | M |
| M4 | 变量抽取端点 + 前端接入 + 原值后校验 | M |
| M5 | 违禁词真扫描（规则） + Langfuse 埋点(可选) | S |

一个迭代可覆盖 M1–M5（视频引擎/RAG 不在内）。

---

## 12. 明确 Out of scope

- **真·视频生成引擎**（文生视频/数字人 adapter、celebrity 引擎、VideoGenDialog 真生成）——另立方案，需先选型 provider。
- **RAG / 向量去重**（历史相似度、智能体「喂语料」检索）——需向量库，后置。
- **多轮对话式创作 agent**——需要时优先复用已接入的 **Coze**（`AgentScenes` 加 scene），而非新引框架。
- **爆款雷达真实抓取**——平台 API/合规单独评估。

---

## 13. 文档同步清单（落地时按 CLAUDE.md §9 同 commit 更新）

- `specs/openapi.yaml`：新增 `/material/scripts/ai-draft`、`/material/scripts/{id}/variables`（+ 复核 `extract-selling-points`）。
- `apps/server/README.md`：AI 数据流 / 新 purpose / `MaterialAiService` 段。
- `apps/web-celebrity/README.md` + `PRODUCT.md`：AI 起稿/变量「接真」版本日志。
- `docs/INDEX.md`：补本文件行（已加）。
- `AGENTS.md`：v 增量节记录「文本三件接真」。

---

## 14. 风险 / 待决

- **provider 未配则全降级**：上线前需在 `/platform/ai-models` 配好带 `SCRIPT_DRAFT/SELLING_POINTS/VARIABLE_EXTRACT` purpose 的 provider + 真 apiKey（模型 id 用「获取模型列表」选真实 id）。
- **JSON 稳定性**：弱模型可能频繁触发重试/兜底 → 建议这几件用稍强的模型（如 DeepSeek-V3 / 豆包 pro 级）。
- **成本/并发**：脚本生成 N 稿 = N 段长输出；批量与配额需观察（`invokeChat` 已有 fallback，但无限流，必要时加节流）。
- **待决**：脚本生成是否计费、违禁词扫描放前端还是 server、是否现在就接 Langfuse。
