# AI IP 工作台（web-ipstudio）设计真源 · v0.151

> last-reviewed: 2026-09-06 · 状态：**P1 已落地（v0.151，未上线；infra 部署登记见 TODO.md）**。实现与本文的差异见 §10。
> 目标：给个人 / 品牌一个「上传一张照片 → 挑一套内置工作流 → 稳定产出一组同一人物、同一风格的 AI IP 形象」的桌面工作台，
> 形象最终落成 AiAvatar 数字资产（`DapAvatar` + `DapLook`），供音乐 / 短剧 / 带货各线引用。

---

## 0. 结论先行（主模型判断）

| 议题 | 决定 | 理由 |
|---|---|---|
| 放哪 | **新子应用 `apps/web-ipstudio`（port 3015）**，桌面端 | 无限画布是桌面重交互；`web-aiavatar` 是移动 H5、零 UI 依赖、手写 CSS，塞进去两边都别扭 |
| 产品归属 | **共用 aiavatar 开通**（`requiredPlatform="aiavatar"`，`X-App-Code: aiavatar`），后端路由全部挂 `/api/v1/ip-studio/**` | 已被 `ProductRouteTable` 的 `any("/api/v1/**", AIAVATAR)` 兜底，不新增产品码、不改 enrollment；产出物本来就是 AiAvatar 资产。独立成产品码留作后续选项 |
| 画布 | **React Flow（`@xyflow/react` 12，MIT）**，借鉴 [`basketikun/infinite-canvas`](https://github.com/basketikun/infinite-canvas) 的交互形态（节点/连线/小地图/撤销重做/围绕选中节点对话），**不搬其代码** | 该仓是 Vite 独立应用，模型 API Key 放浏览器 IndexedDB 直连上游 —— 与本仓「模型只走服务端绑定、积分服务端 hold/commit、资产只落 OSS」三条红线正面冲突；React 19 + Next 16 下它也无法作为库引入 |
| 生成链路 | **全部复用 dap 域**：`DapMultimodalClient.generateImage`（i2i）、`DapImageInput`、`FileStorageService`、`PromptService`、`CreditService` hold→commit、`DapPricingService` 后台可配单价 | 不再造第二条图像生成链；生产门禁（§8.0 无引擎 503 不扣费）天然继承 |
| 「效果稳定」怎么保 | 五层锁定，见 §3 | 这是本工作台的核心卖点，不是画布本身 |
| 分工 | 主模型设计 + 收口文档；Opus 子 agent A（server）/ B（web）并行开发并各自自测；`/codex` 独立评审 | 省 token；文件所有权见 §9 |

---

## 1. 用户看到的东西

1. **项目列表页** `/projects`：我的 IP 项目卡（封面 = 主形象）+「从模板新建」（内置工作流卡片）+「空白画布」。
2. **画布页** `/projects/{id}`：
   - 左侧：节点面板（照片 / 特征卡 / 风格 / 形象卡 / 生成 / 参考图 / 发布）+ 模板说明；
   - 中央：React Flow 无限画布，节点是「档案卡」样式（沿用 aiavatar 的 Atelier Ledger 视觉：衬线资产名 / 等宽编号 / 单一青色）；
   - 右侧：选中节点的属性面板（表单 + 该节点最近一次运行的实际提示词、参考图生效情况、花费）；
   - 顶栏：项目名、保存状态（防抖自动保存）、积分余额、「运行全部生成」、「发布到资产库」。
3. **典型模板「个人照片 → 潮玩 IP 三连」**（即用户截图那张图）：
   `照片` → `人物特征卡`（AI 从照片抽取，可改） → `风格：3D BJD 潮玩` → `主形象生成 ×4 → 选定主图` → 三张 `形象卡`（服装 / 姿势 / 表情 / 细节四栏，如「穿针织衫拿着手机」）各自接一个 `生成` 节点，生成时**同时带主图 + 原照片作参考** → `发布`。
4. 发布后在 `web-aiavatar` 的资产库里能看到这个数字人（`DH-` 编号）和它的三个造型（`LK-`）。

---

## 2. 节点模型（前端类型即契约真源）

文件：`packages/types/src/ip-studio.ts`（**B 建；A 的 `*Dto.java` 字段名与之 1:1**）。

```ts
export type IpNodeType =
  | "source"      // 用户照片（身份来源）
  | "identity"    // 人物特征卡（AI 抽取 / 手写，中文可读 + 英文提示词）
  | "style"       // 风格预设（内置 6 套或自定义）
  | "look"        // 形象卡（服装 / 姿势 / 表情 / 细节 / 道具）
  | "generate"    // 生成节点（出 N 张候选，选一张；可标记为主形象）
  | "reference"   // 局部参考图（如「帽子款式参考图 2」）
  | "publish";    // 发布到资产库

export interface IpPosition { x: number; y: number }

export interface IpSourceData   { assetKey?: string; imageUrl?: string; fileName?: string; width?: number; height?: number }
export interface IpIdentityData { text: string; promptEn: string; locked: boolean; fromRunId?: string }
export interface IpStyleData    { presetId?: string; name: string; promptEn: string; negativeEn?: string; custom: boolean }
export interface IpLookData     { title: string; outfit: string; pose: string; expression: string; details: string; props?: string }
export interface IpGenerateData {
  count: 1 | 2 | 4;
  size: "768x1024" | "1024x1024" | "768x1365";
  isMaster: boolean;              // 主形象：其选中图成为下游所有 generate 的身份锁参考
  selectedRunId?: string;         // 用户选定的候选来自哪次运行
  selectedIndex?: number;         // 选定候选下标
}
export interface IpReferenceData { assetKey?: string; imageUrl?: string; note: string }
export interface IpPublishData   { avatarName: string; avatarId?: string; publishedAt?: string }

export type IpNodeData =
  | { type: "source"; data: IpSourceData }
  | { type: "identity"; data: IpIdentityData }
  | { type: "style"; data: IpStyleData }
  | { type: "look"; data: IpLookData }
  | { type: "generate"; data: IpGenerateData }
  | { type: "reference"; data: IpReferenceData }
  | { type: "publish"; data: IpPublishData };

export type IpNode = IpNodeData & { id: string; position: IpPosition; label?: string };
export interface IpEdge { id: string; source: string; target: string }
export interface IpViewport { x: number; y: number; zoom: number }

/** 画布文档 —— 客户端拥有；服务端整存整取、不改内容（运行结果另存 IpRun，避免并发覆盖）。 */
export interface IpProjectDoc { nodes: IpNode[]; edges: IpEdge[]; viewport: IpViewport }

export type IpRunStatus = "running" | "done" | "failed";
export type IpRunKind = "identity" | "generate";

export interface IpCandidate { key: string; url: string }
export interface IpRunOutput {
  text?: string;                  // identity：中文特征卡
  promptEn?: string;              // identity：英文身份提示词
  candidates?: IpCandidate[];     // generate：候选图（签名 URL，短期）
}
export interface IpRunInputs {
  prompt?: string;                // generate：实际送入模型的完整英文提示词（透明可查）
  refs?: { role: "master" | "source" | "reference"; applied: boolean; reason?: string }[];
  size?: string; count?: number;
}
export interface IpRun {
  id: string; projectId: string; nodeId: string; kind: IpRunKind;
  status: IpRunStatus; stage: string; pct: number;
  cost: number;                   // 实际提交（commit）的积分；running 时为冻结额
  errorCode?: string; errorMessage?: string;
  inputs: IpRunInputs; output: IpRunOutput;
  createdAt: string; finishedAt?: string;
}

export type IpProjectStatus = "draft" | "published";
export interface IpProjectSummary {
  id: string; name: string; templateId?: string; status: IpProjectStatus;
  coverUrl?: string; publishedAvatarId?: string; createdAt: string; updatedAt: string;
}
export interface IpProject extends IpProjectSummary {
  doc: IpProjectDoc;
  runs: Record<string, IpRun>;    // nodeId → 该节点最近一次运行（服务端投影）
  runsById: Record<string, IpRun>; // runId → 运行；包含 runs 里的全部 + 被 generate 节点 selectedRunId 指向但已非最新的运行
}

export interface IpTemplate {
  id: string; name: string; summary: string; coverUrl?: string;
  stylePresetId?: string; lookCount: number; estimatedCredits: number;
  doc: IpProjectDoc;              // 预排好的节点图（照片 / 参考图为空待填）
}
export interface IpStylePreset { id: string; name: string; summary: string; promptEn: string; negativeEn?: string; coverUrl?: string }

export interface IpPricing { identityCredits: number; imageCredits: number }  // 后台可配，前端展示预估用
```

请求体：

```ts
export interface IpCreateProjectRequest { name?: string; templateId?: string }
export interface IpUpdateProjectRequest { name?: string; doc?: IpProjectDoc }
export interface IpRunNodeRequest { doc?: IpProjectDoc }   // 运行前顺手保存最新文档（可选，避免「先 PUT 再 POST」竟态）
export interface IpPublishRequest { avatarName: string; masterNodeId: string; lookNodeIds: string[] }
export interface IpPublishResult { avatarId: string; lookIds: string[] }
export interface IpUploadResult { key: string; url: string; width?: number; height?: number; fileName: string }
```

---

## 3. 「效果稳定」的五层锁定（服务端强制，前端只是展示）

| 层 | 做法 | 落点 |
|---|---|---|
| ① 身份文本固定 | `identity` 节点由带图 chat 从照片抽出**结构化中文特征卡 + 英文身份提示词**，一次生成、之后全部 look 复用同一段；用户可改，改了要「锁定」 | 新 prompt key `dap.ip_identity`；`DapMultimodalClient.chatWithImages(...)`（新增，OpenAI content-parts `image_url`） |
| ② 主图作 i2i 锚 | 标记 `isMaster` 的 generate 节点选中图，成为下游每个 generate 的第一张参考；无主图时退到原照片 | `IpRunService.compileGenerate` 参考顺序：master → source → reference…，超上限按此优先级砍尾、如实回报 `applied=false, reason=over_max_refs` |
| ③ 风格文本原样拼接 | 内置风格 `promptEn`/`negativeEn` 逐字进模板，不让模型自由发挥 | `resources/ipstudio/styles.json` |
| ④ 服务端模板 + 一致性从句 | 提示词由服务端 `dap.ip_look_image` 模板拼装：`{{style}} / {{identity}} / {{outfit}} / {{pose}} / {{expression}} / {{details}} / {{refNotes}}` + 固定从句「same person, same face…, exactly one character, no multi-view grid, no text」 | `resources/prompts/material/dap.ip_look_image.md`；用户看得到本次实际提示词（`IpRun.inputs.prompt`） |
| ⑤ 多候选择优 | 每个 generate 出 1/2/4 张，用户选一张；主形象默认 ×4 | 计费按张 |

后续（不在 P1）：⑥ 一致性打分（视觉模型对比主图与各 look 的脸部一致性，低分自动重跑）——记 TODO。

---

## 4. 服务端设计（agent A）

包：`com.aistareco.aep.ipstudio.{model,repository,dto,service,controller}`。

### 4.1 表（新增，**SQL 迁移 `V27__ip_studio.sql`**；编号规则见 `resources/db/migration/README.md`，V26 为 v0.150 未上线的 clip_tts_preview，本迁移排其后）

```sql
CREATE TABLE ip_project (
  id VARCHAR(32) PRIMARY KEY,                 -- IPP-xxxxxxxx
  owner_user_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  template_id VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  doc_json LONGTEXT NOT NULL,                 -- IpProjectDoc 整存整取
  cover_key VARCHAR(512),                     -- 主形象选中图 key（派生 coverUrl）
  published_avatar_id VARCHAR(32),
  created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, deleted_at TIMESTAMP NULL
);
CREATE INDEX idx_ip_project_owner ON ip_project(owner_user_id, deleted_at);

CREATE TABLE ip_run (
  id VARCHAR(32) PRIMARY KEY,                 -- IPR-xxxxxxxx
  project_id VARCHAR(32) NOT NULL,
  owner_user_id VARCHAR(64) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  kind VARCHAR(16) NOT NULL,                  -- identity | generate
  status VARCHAR(16) NOT NULL,                -- running | done | failed
  stage VARCHAR(64), pct INT NOT NULL DEFAULT 0,
  cost BIGINT NOT NULL DEFAULT 0,
  error_code VARCHAR(64), error_message TEXT,
  input_json LONGTEXT, output_json LONGTEXT,
  created_at TIMESTAMP NOT NULL, started_at TIMESTAMP NULL, finished_at TIMESTAMP NULL, heartbeat_at TIMESTAMP NULL
);
CREATE INDEX idx_ip_run_project_node ON ip_run(project_id, node_id, created_at);
CREATE INDEX idx_ip_run_status ON ip_run(status, heartbeat_at);
```

H2 dev 下 `ddl-auto=update` 也会建表，迁移需与 H2 方言兼容（LONGTEXT 在 H2 MySQL 模式可用；参考 `V26__clip_tts_preview.sql` 的写法）。

### 4.2 端点（全部 `authenticated`，`/api/v1/ip-studio/**`，`ApiResponse` 壳，owner 校验 `ownerUserId == principal`）

| Method | Path | 说明 |
|---|---|---|
| GET | `/v1/ip-studio/templates` | 内置工作流模板（`resources/ipstudio/templates/*.json`） |
| GET | `/v1/ip-studio/styles` | 内置风格预设 |
| GET | `/v1/ip-studio/pricing` | `{identityCredits, imageCredits}` |
| POST | `/v1/ip-studio/uploads` | multipart 照片/参考图 → `FileStorageService.store(category="ipstudio/source")` → `IpUploadResult`；只收 jpg/png/webp ≤ 15MB |
| GET / POST | `/v1/ip-studio/projects` | 列表（summary，含 coverUrl 签名）/ 新建（可按模板预填 doc） |
| GET / PUT / DELETE | `/v1/ip-studio/projects/{id}` | 详情（doc + runs 投影）/ 保存 name+doc / 软删 |
| POST | `/v1/ip-studio/projects/{id}/nodes/{nodeId}/run` | 运行 identity 或 generate 节点，返回 `IpRun`（running） |
| GET | `/v1/ip-studio/runs/{id}` | 轮询 |
| POST | `/v1/ip-studio/runs/{id}/cancel` | 置 cancelRequested，runner 收尾并释放冻结 |
| POST | `/v1/ip-studio/projects/{id}/publish` | 发布：建 `DapAvatar`（path=ai）+ `DapLook`×N，零积分 |

### 4.3 运行语义（`IpRunService` + `IpRunWorker` @Async）

- **编译输入**：从 `doc` 沿入边向上找上游节点（≤8 跳；`generate` 的上游可有：`style`、`identity`、`look`、`source`、另一个 `generate`（主图）、若干 `reference`）。缺 `identity`/`style` → 400 `IP_NODE_INPUT_MISSING`，`details.missing=[...]`；`look` 只对**非主形象**节点必填（模板里主形象直接挂在 style 之后，没有形象卡）；`generate` 若无任何图片参考（无主图且无照片）**允许**，但 `inputs.refs=[]`。
- **preflight 在 hold 之前**（§8.0）：`DapMultimodalClient.isConfigured()` 为假 → 503 `DAP_ENGINE_NOT_CONFIGURED`（复用 `DapJobService.requireEngineOrPlaceholderAllowed` 语义）；prompt 模板未配 → 503 `PROMPT_NOT_CONFIGURED`。
- **计费**（复制 `DramaReferenceAssetService.generateReferenceSheet` 范式）：`hold(总额 = 单价×count, referenceType="ip-run", referenceId=runId)`；每张成功 → `commitHold(单价)` → **然后**才把候选写入 `output.candidates`；首张失败即停，剩余 `releaseHold`；零成功 → `failed` + 原错误码。`catch RuntimeException`（不是只抓 BusinessException）。identity 同理，单笔。
- **参考图装配**：顺序 master（上游 `generate` 的 `selectedRunId/selectedIndex` 指向的候选 key）→ source → reference…；上限 `aep.ipstudio.max-ref-images`（默认 4）；被砍的记 `applied=false, reason="over_max_refs"`；本地 `/cdn` 不可被云端抓取时由 `DapImageInput.of` 自动转 dataURI（已有逻辑）。`reference` 节点的 `note` 拼进 `{{refNotes}}`（形如 "Reference image 3: hat style only"）。
- **派发**：`run` 是 `@Transactional`，worker 必须在 **`afterCommit`** 派发（提交前 worker 查不到行会直接返回，任务永远 `queued`；真联调踩过，已加回归测试）。
- **进度**：`stage` 走 `queued → prompt.compile → image.generate.{n} → storage.persist → done|failed`，每 tick 写 `heartbeat_at`；`IpRunReaper` @Scheduled 把 running 且 heartbeat 超 15 分钟的置 failed + release。
- **产物**：`FileStorageService.store(bytes, "ipstudio/gen", ownerId, "png", "image/png")`，库里只存 key，DTO 出 wire `storage.signedUrl(key)`。
- **同节点重跑**：新建一条 run，旧 run 保留（用户可能选旧候选）；`GET project` 的 `runs` 投影取每节点**最新**一条；`selectedRunId` 指向的旧 run 若非最新，放进 `runsById`（runId 键，含 runs 全部 + 被选中的旧 run），前端按 runId 取缩略图。
- **cost 恒为真实账本值**：running 时 = 冻结额，done = 已 commit 之和，failed = 0 或已 commit 部分。

### 4.4 发布（`IpPublishService`）

- 校验 `masterNodeId` 为 `generate` 且有选中候选；每个 `lookNodeIds` 同理，否则 400 `IP_PUBLISH_SELECTION_REQUIRED`。
- 建 `DapAvatar`：`path="ai"`, `status="finalized"`, `imageKey=主图 key`, `basePrompt=identity.promptEn`, `descPrompt=identity.text`, `def{核心气质/脸部特征/...}` 尽量从特征卡解析，`engine=multimodal 引擎名`，`variantKeys=主 generate 该 run 全部候选`，版本 `addVersionAt(1, "IP 工作台发布", "init", key)`（照 `DapAvatarService.pick` 的写法，A 读源码对齐）。
- 每个 look → `DapLook{source="design", label=look.title, prompt=该 run 的 inputs.prompt, status="done", imageKey}`。
- 项目 `status=published`, `publishedAvatarId`, `coverKey`。重复发布 → 409 `IP_PROJECT_ALREADY_PUBLISHED`（P1 不做增量发布，记 TODO）。
- 复制的图片不重复上传：直接复用 key（同一 storage）。

### 4.5 需要动到的既有文件（**只做追加**）

- `DapMultimodalClient`：新增 `chatJsonWithImages(system, user, List<String> imageInputs)`；上游不支持视觉 → 原样抛 `DAP_MODEL_HTTP_4xx`，服务端翻成 502 `IP_IDENTITY_EXTRACT_FAILED`（文案：「当前形象引擎不支持看图，请在后台给「数字人 · 人设」用途绑定支持图片输入的模型，或手动填写特征卡」）。
- `PromptService`：新增 `KEY_DAP_IP_IDENTITY = "dap.ip_identity"`、`KEY_DAP_IP_LOOK_IMAGE = "dap.ip_look_image"`，加入 `KNOWN_KEYS`；两份 `.md` 资源文件。
- `DapPricingService` + `DapProperties.Pricing`：新增 `dap.ip-identity`（默认 2）/ `dap.ip-image`（默认 8）；`apps/admin/src/app/celebrity/engine-pricing/page.tsx` 追加两行。
- `specs/openapi.yaml`：dap 段落之后新开注释块「AI IP 工作台（apps/web-ipstudio）」，一行流式 YAML、`tags: [ipstudio]`、`operationId: ipStudio*`。
- `ProductRouteTableCoverageTest` 若要求逐 controller 登记，则按其规则登记；不要放宽测试。
- `BUSINESS_RULES.md`：新增 §6.x「AI IP 工作台」：输入缺失 / 计费 / 参考图顺序 / 发布约束 / 错误码表。

### 4.6 测试（A 自测，必须全绿）

- `IpRunServiceTest`：输入编译（缺 identity → 400；参考顺序与砍尾回报）、preflight 503 不冻结、hold→逐张 commit→中途失败 release 剩余、零成功 failed。
- `IpPublishServiceTest`：发布建 DapAvatar/DapLook、重复发布 409、无选中 400。
- `IpProjectServiceTest`：owner 隔离、软删、runs 投影（最新 + 被选中）。
- `ProductRouteTableCoverageTest` / 全量 `AEP_CDN_DRIVER=local ./mvnw -o test` 不掉绿。
- 手工：`scripts/dev-fake-llm-server.mjs` 起 8091，dev profile 自动 devSeed 绑 DAP 三用途，走通 upload → identity → generate → publish（curl 或 B 的前端）。

---

## 5. 前端设计（agent B）

`apps/web-ipstudio`：Next 16.2.6 / React 19 / Tailwind v4 / `@ai-star-eco/{types,ui,api-client,landing}` / `@xyflow/react@^12` / `lucide-react`，**照 `apps/web-star` 复制脚手架**（package.json、next.config.mjs rewrites、layout、providers、login、auth/callback、`(workspace)` route group）。端口 **3015**。

- `providers.tsx`：`<AuthProvider requiredPlatform="aiavatar" publicPathPrefixes={["/", "/login"]} loginPath="/login">`（appCode 自动回退到 aiavatar）；`EnrollmentGate product="aiavatar"` 在 401/403 `PRODUCT_NOT_ENROLLED` 时接管（照 web-star / landing 既有做法）。
- 路由：`/` → 产品 landing 或直接 redirect `/projects`；`/login`；`/auth/callback`；`(workspace)/projects`；`(workspace)/projects/[id]`。
- `src/api/ip-studio.ts`：`IpStudioApi` namespace，`apiFetch("/v1/ip-studio/...")`（路径与 openapi 一致，无需 prefix）；上传用 `apiFetch` 的 FormData 支持；`awaitRun(runId, onTick)` 轮询 1.5s、上限 10 分钟。`USE_MOCK=1` 时 `src/mocks/ip-studio.ts` 提供模板 / 风格 / 项目样本 + 本地 run 模拟器（假进度、占位图用 `/generated/*.svg` 或 picsum），**mock 产物打 MOCK 角标**。
- 画布：`ReactFlow` + 自定义 7 种节点组件（`src/components/canvas/nodes/*`），节点外观走「档案卡」：衬线标题（Newsreader）/ 等宽编号（JetBrains Mono）/ 单一青色 `#12B3DE` 只用于主操作与运行中状态；连线 handle 按类型着色但克制。MiniMap + Controls + 撤销重做（`zustand` 或 React Flow 自带 history 方案，选一个最省事的）。
- 属性面板：按节点类型渲染表单；`generate` 面板显示候选网格（点选=选定，「设为主形象」）、本次实际提示词（可折叠）、参考图生效列表（未生效的给中文原因）、花费；`identity` 面板「用照片重新抽取」/「锁定」；`look` 四栏文案与截图一致（服装 / 姿势 / 表情 / 细节 + 道具）。
- 运行：单节点「运行」；顶栏「运行全部生成」= 按拓扑序依次运行所有 generate（主形象先跑并等用户选图？——**P1 简化：主形象若已有选中图则连跑其余，否则只跑主形象并提示先选图**）。运行前把最新 doc 一起 PUT（`IpRunNodeRequest.doc`）。
- 保存：doc 变化防抖 1.2s PUT；顶栏「已自动保存 / 保存中 / 保存失败重试」；离开前 beforeunload 兜底。
- 发布对话框：选主形象节点（默认 isMaster）+ 勾选 look 节点 + 资产名 → 成功后展示 `DH-` 编号与「去 AiAvatar 查看」链接（`NEXT_PUBLIC_AIAVATAR_URL`，dev 默认 `http://localhost:3013`）。
- 文案红线：全部中文；不暴露 `runId`/`errorCode` 原文给主可视文案（放 hover）；可变长文字做省略。禁止原生 `confirm/alert`，用 `@ai-star-eco/ui` 的 AlertDialog。
- 工程登记（B 负责）：`pnpm-workspace.yaml` 加 `apps/web-ipstudio`；根 `package.json` 加 `dev:ipstudio` / `typecheck:web-ipstudio`；`.claude/launch.json` 加 `ipstudio` 3015；`scripts/check-api-contract.mjs` `SCAN_TARGETS` 加 `{ dir: "apps/web-ipstudio/src" }`；`packages/types/src/index.ts` 导出 ip-studio。
- 门禁：`pnpm --filter @ai-star-eco/web-ipstudio typecheck && build`、`pnpm typecheck:all`、`pnpm check:api-contract`（需 A 的 openapi 先落，B 先按 §4.2 路径表写代码）。

---

## 6. 内置工作流模板（P1 两套，`resources/ipstudio/templates/`）

| id | 名称 | 节点 | 预估积分（默认单价） |
|---|---|---|---|
| `portrait-bjd-trio` | 个人照片 → 潮玩 IP 三连 | source → identity → style(bjd) → generate(master ×4) → look×3 → generate×3(×2) → publish | 2 + 8×4 + 8×2×3 = 82 |
| `portrait-sticker-six` | 个人照片 → Q 版表情包六连 | source → identity → style(chibi) → generate(master ×4) → look×6（六种表情）→ generate×6(×1) → publish | 2 + 32 + 48 = 82 |

风格预设（`styles.json`）：`bjd`（3D BJD 潮玩娃娃，用户截图那种）、`chibi`（Q 版厚涂）、`pixar3d`、`flat-vector`、`guochao-ink`、`clay`。每套含 `promptEn` + `negativeEn` + 一句中文 summary。

---

## 7. 错误码

| code | HTTP | 场景 |
|---|---|---|
| `IP_PROJECT_NOT_FOUND` | 404 | 非本人 / 已删 |
| `IP_NODE_NOT_FOUND` | 404 | doc 里无该节点 |
| `IP_NODE_NOT_RUNNABLE` | 400 | 非 identity/generate 节点 |
| `IP_NODE_INPUT_MISSING` | 400 | `details.missing` 列出缺的上游类型 / 字段 |
| `IP_IDENTITY_EXTRACT_FAILED` | 502 | 视觉抽取失败（含引擎不支持看图） |
| `IP_RUN_NOT_FOUND` | 404 | |
| `IP_RUN_ALREADY_RUNNING` | 409 | 同节点已有 running run |
| `IP_PUBLISH_SELECTION_REQUIRED` | 400 | 主图 / look 未选候选 |
| `IP_PROJECT_ALREADY_PUBLISHED` | 409 | |
| `IP_UPLOAD_INVALID` | 400 | 类型 / 大小 |
| 复用 | 503 `DAP_ENGINE_NOT_CONFIGURED`、503 `PROMPT_NOT_CONFIGURED`、402 积分不足（CreditService 既有） |

---

## 8. 不做 / 后置（进 TODO.md）

- 独立产品码 `ipstudio` 与独立开通（当前共用 aiavatar）。
- 一致性打分与自动重跑（§3 ⑥）。
- 增量发布（已发布项目新增 look 追加到同一 DapAvatar）。
- 画布协作 / 多人。
- 视频节点（口播 / 转身）——接 clip 域或 DAP_VIDEO。
- `DapMultimodalClient` 读 `AiAppEndpointCandidate.maxRefImages` 能力（现用固定配置 4）。

---

## 9. 分工与文件所有权（并行开发硬约束）

| 角色 | 只能改这些 |
|---|---|
| **A · server**（Opus） | `apps/server/**/ipstudio/**`（新建）、`V27__ip_studio.sql`、`resources/ipstudio/**`、`resources/prompts/material/dap.ip_*.md`、`PromptService.java`（追加常量 + KNOWN_KEYS）、`DapMultimodalClient.java`（追加方法）、`DapPricingService.java` + `DapProperties.java`（追加）、`apps/admin/src/app/celebrity/engine-pricing/page.tsx`（追加两行）、`specs/openapi.yaml`（追加块）、`specs/BUSINESS_RULES.md`（追加节）、`apps/server/src/test/**/ipstudio/**`、`apps/server/README.md`（数据模型段追加） |
| **B · web**（Opus） | `apps/web-ipstudio/**`（新建）、`packages/types/src/ip-studio.ts` + `index.ts` 导出、`pnpm-workspace.yaml`、根 `package.json`、`.claude/launch.json`、`scripts/check-api-contract.mjs` |
| **主模型** | 本文档、`AGENTS.md`、`docs/INDEX.md`、`docs/VERSION_HISTORY.md`、`TODO.md`、`infra/README.md`（如需） |
| **Codex** | 只读评审 A/B 产出的 diff |

两边都**不得**碰工作区里已有的未提交改动（v0.150 clip 相关文件）。契约以本文 §2 类型为准；A 若发现契约必须改，先改本文 §2 再改代码，并在最终报告里标出。

---

## 10. 实现与设计的差异（v0.151 落地记录）

| 项 | 设计 | 实现 | 原因 |
|---|---|---|---|
| `look` 必填 | identity / style / look 全必填 | `look` 只对非主形象 generate 必填 | 模板里主形象直接挂 style 之后，没有形象卡 |
| 上游查找 | 直接入边 | 沿入边向上 ≤8 跳（`IpDocs.ancestorsOfType`） | style / identity 挂在主形象上游，不挂在每个 look 的 generate 上 |
| runs 投影 | 「最新 + 被选中」塞一个 map | `runs`（nodeId → 最新）+ `runsById`（runId → 含被选中的旧运行） | B 指出一个 map 装不下两种键，§2 已修订 |
| 执行参数 | 未定义 | `inputs._exec` 存 storage key 等，出 wire 剥掉 | 不给浏览器发 key，也不加第三列 |
| 新增错误码 | §7 | 另有 `IP_DOC_INVALID` / `IP_DOC_TOO_LARGE` / `IP_TEMPLATE_NOT_FOUND` / `IP_IMAGE_FAILED` / `IP_RUN_CANCELLED` / `IP_RUN_TIMEOUT` | 见 BUSINESS_RULES §6.6 |
| 线程池 | 复用 `dapJobExecutor` 或自建 | 自建 `ipRunExecutor` | 一次主形象串行 4 张，别堵数字人线 |
| 派发时机 | 未写 | `afterCommit` | 真联调发现事务内派发任务永远 queued |
| 月度赠额 | 未写 | hold 前 `DapAccountService.ensureMonthlyGrant`（同 `DapJobService.submit`） | 同一钱包，否则未领赠额的用户误报 402 |
| 前端 | — | `count===1` 自动定稿；「运行全部」首个失败即停；「设为主形象」可取消；积分余额 best-effort | 见 `apps/web-ipstudio/README.md` |
