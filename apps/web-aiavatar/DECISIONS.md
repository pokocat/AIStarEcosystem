# AiAvatar 形象资产管理中心 — 决策记录（DECISIONS）

> 任务书 §0.2：「发现不合理就自动修正，并在 DECISIONS.md 记录『原状 → 改动 → 理由』」。
> §0.3 / §9：mock 取舍必须标注原因，且 mock 与真实走相同接口契约、可一键切换。
>
> 本轮（v0.45.1）按用户上传的 design 原型 + 任务说明书**重建前端**（先前 `apps/web-aiavatar` 已删除，
> 后端 `com.aistareco.aep.aiavatar.*` 领域保留）。下文 A2 / B(beauty) / D2 / F 为本轮前端决策；
> 其余（A1/A3/B 大模型/C/D1/E）描述既有后端，保持有效。

## A. 架构

### A1. 独立后端领域包，复用账户（既有，未改）
后端独立领域 `com.aistareco.aep.aiavatar.*`，新表统一 `aiavatar_` 前缀（avatar / avatar_version / asset /
source_material / license_grant / template / job / refine_edit）。账户复用 `aep_users`（仅存 `ownerUserId`）；
积分扣费复用 `CreditService` 三段式。前端按既有 35+ 端点对接。

### A2. 前端：纯 CSS 令牌 + 内联样式，**不引 Tailwind / shadcn**
- **原状**：先前删除的版本与三端一致用 Tailwind v4 + shadcn + `@ai-star-eco/{ui,landing}`。
- **改动**：本轮按原型 1:1 重建，**直接移植 `tokens.css`（token 不改）+ 内联样式的类型化基元**
  （`src/components/ui/primitives.tsx`：Btn / Portrait / StatusPill / Seg / Panel …）。仅消费 TS-only 的
  `@ai-star-eco/types` + `@ai-star-eco/api-client`；不引 `@ai-star-eco/ui`（Tailwind 化）。登录页自建主题化版本。
- **理由**：原型视觉高度定制（深色琥珀 + 等宽元数据 + `.ph` 占位 + hue 着色），整套是 CSS 变量 + 内联
  动态样式（oklch hue 渐变）。强行套 shadcn/Tailwind 会与原型打架、降低 1:1 保真度并引入 v4 配置摩擦。
  任务书 §2 明确允许「全局样式 + CSS Modules / Tailwind 任选，token 不改」。自洽且更忠实。

### A3. 平台访问隔离：不接入 `requiredPlatform`（既有，未改）
ai-avatar app 不设 `requiredPlatform`（v0.43 的 `SubProduct` 仅 music/drama/celebrity）。任何已登录账号可访问。
要纳入隔离需扩 `SubProduct = "...|aiavatar"` 并同步后端 `PlatformSupport`。

## B. 能力 → 实现映射（真实 vs mock，§4/§5/§9）

`/health` 页镜像 `GET /api/aiavatar/health/providers`，逐能力可观测 `mode + 引擎`。mock 路径产出占位资产但
**契约与真实完全一致**，可热切换（`AEP_AIAVATAR_PROVIDERS_<CAP>=selfhost` + base url）。

| 能力 | 当前实现 | 真实方案 | 取舍理由 |
|---|---|---|---|
| **faceWarp 几何形变（瘦脸/眼睛/鼻梁/脸型/嘴）** | **真实**（前端）：`@mediapipe/tasks-vision` FaceLandmarker 478 点（Apache-2.0，WASM/CPU）→ `landmarksToAnchors` → `face-warp.ts` 确定性径向液化（逐像素反向映射 + 双线性采样）。检测不可用回退启发式锚点 | MediaPipe FaceMesh + 液化 | 任务书 §4「必须接的真实算法，不要 mock」。实时滑块、确定性、无需 GPU。13 vitest（含锚点驱动 + landmark→anchor 换算）守门。后端 `AiAvatarGeometryWarp` 同族实现作契约样本 |
| **restore 美颜 / 质感** | **真实**（前端）：`beauty.ts` 客户端磨皮（保边 box-blur + YCbCr 肤色权重）/ 美白（肤色提亮）/ 暖色 / 亮度，确定性 | GFPGAN/CodeFormer（重型修复，服务端）+ 经典美白磨皮 | 任务书 §4 美颜=「修复模型 + 经典美白磨皮」。**评估过开源 Banuba/beauty-web**：其 Web SDK 需 client token（商用授权），无 token 无法运行 → 采用「经典美白磨皮」那一半的**可离线、可商用**真实 canvas 算法；重型 GFPGAN 修复走后端 restore Provider（异步任务）。6 vitest 守门 |
| nlu 人设解析 | Backend 优先（`BackendNluProvider` → LLM 网关），dev 回退 mock | 平台 LLM 网关 | 任务书「后端已有 LLM 网关」。绑定端点即走真实大模型 |
| txt2img / faceClone / img2img / inpaint / makeup / hair / img23d / img2video / faceDetect / segment | Mock（真实进度/延迟，产出占位资产；img23d 产真 GLB / img2video 产 CSS 运镜预览） | SDXL/FLUX / InstantID / InstructPix2Pix / SD-inpaint / EleGANt / HairCLIP / TripoSR / SVD / InsightFace / SAM | 均需 GPU + 模型权重，本环境不可得；`SelfHostHttpProvider` 已就绪，配 base url 即接真实微服务。**InstantID/RetinaFace 依赖的 InsightFace 仅限非商用**（见 §C） |

### B1. MediaPipe 资产同源自托管 + 检测/形变像素空间对齐（修「调整不准」）
- **原状**：`face-landmarks.ts` 默认从外网 jsDelivr CDN 加载 WASM、从 Google Storage 加载模型。生产网络策略一挡，
  检测失败 → 静默回退**启发式锚点**（按「脸居中、上半部」估计）→ 瘦脸/眼睛落在假设位置 → **形变不准**。
  另：studio 检测尺寸按「宽」缩放，而 `warpImageToDataUrl` 按「长边」缩放，竖图两者不一致 → 锚点像素空间错位。
- **改动**：(1) WASM 改**同源自托管** `/mediapipe/wasm`（`scripts/setup-mediapipe.mjs` 于 predev/prebuild 从
  node_modules 拷入，版本永远与 npm 包一致、无网可用，wasm 不入库由脚本生成）；模型 `face_landmarker.task`
  直接提交在 `public/mediapipe/`（无网构建也可用）。(2) studio 检测尺寸改为与 warp 完全一致的「长边缩放」，
  锚点与形变同一像素空间。
- **理由**：外网 CDN 是「不准」的常见根因（回退启发式）；同源自托管让真实 478 关键点检测稳定命中。
  浏览器实测确认画布提示「MediaPipe · 478 关键点已对齐」。**评估过 Banuba/beauty-web 做更高质量实时美颜/微调**——
  其 `@banuba/webar` 需 client token（商用授权，trial 需申请），无 token 不可运行；若后续提供 token 可接为
  token-gated provider（有 token 走 Banuba，无则回退本方案）。当前先用免授权的自托管 MediaPipe 把准确度修好。
- **覆盖**：`NEXT_PUBLIC_MEDIAPIPE_WASM_BASE` / `NEXT_PUBLIC_MEDIAPIPE_MODEL_URL` 可改内网/自定义 CDN。

### B2. 几何形变局部化（修「调脸型把整张图都拉变形」）
- **原状**：`face-warp.ts` 的瘦脸/脸型/嘴位移**只有纵向高斯衰减、无横向局部化、也无全局人脸区域遮罩** →
  同一行的背景 / 肩膀 / 画面边缘被一起拉；脸型尤甚（整下半幅变形）。
- **改动**：(1) 引入**全局人脸椭圆遮罩** `faceMask=exp(-((x-cx)/(faceW·0.8))² - ((y-cy)/(faceR·1.35))²)`，
  所有加性位移乘以它；`faceMask<0.02` 的像素直接原样拷贝（背景零形变、零重采样模糊）。
  (2) 瘦脸/脸型/嘴各自补**横向高斯**，把作用域收到脸/下颌/嘴的局部；眼睛仍用 `radial`（本就限制在 eyeRadius）。
  (3) 局部化后适度提高强度（slim 0.18→0.30、face 0.14→0.24、mouth 0.14→0.22、nose 0.12→0.16）。
- **理由**：真实美型工具（Meitu/美狐/Banuba）都把形变限制在人脸网格内。本修复让「调脸型只动脸、不动背景肩膀」。
  新增单测「形变限制在人脸区域内：四角背景零改动」守门（14 个 warp 测全绿）；浏览器实测下颌轮廓 +84 时背景/肩膀稳定。
- **关于美狐(Meihu) SDK**：是 **Android/iOS 原生商用** 实时相机美颜/美型 SDK（OpenGL/Metal，license 绑包名），
  **无 web/WASM 版本**，无法在本 Next.js web 应用中运行。web 端能跑的同类只有 Banuba（仍需商用 token，见 B1）。

### B3. 编辑能力归并到「精调」+ 出图步纯化 + 草稿迭代 AI 对话左置（IA 调整）
- **原状**：(1) 草稿迭代的 AI 指令面板在右侧；(2)「模板美化 · 出图」步既做美颜模板、又做标准出图（编辑与出图混在一步）。
- **改动**：
  1. **草稿迭代 AI 对话框移到左侧**，改 Figma-AI 风格（渐变头像头部 + 用户/AI 消息气泡 + 快捷指令 chip +
     Enter 发送 composer），右侧为草稿画廊；每轮指令/生成以对话往返呈现。
  2. **精调（STEP 05）= 两种模式**：`五官微调`（原几何形变+外观编辑+自然语言+局部重绘，真实 MediaPipe 液化）/
     `模版套用`（美颜美化模板=真实 canvas beauty 实时套用；风格妆造模板=职业妆/古风等样片→img2img 图生图）。
     美颜模板从原出图步迁入此处。
  3. **出图（STEP 06）纯化为「标准分视角出图」**：只按标准构图（正面半身/全身/左右侧脸/表情）分视角批量出图，
     **不做任何编辑**；左侧仅视角勾选 + 「去精调改妆容/美颜」引导。wizard label 改「分视角出图」。
- **理由**：用户反馈——编辑功能应集中在「精调」（直接五官微调 + 模版套用两条路），出图只负责分视角产图。
  职责单一、心智清晰；美颜/妆造在精调即可所见即所得，出图阶段不再有「为什么这里还能改妆」的困惑。
- **落地**：`BEAUTY_TEMPLATES` / `STYLE_LOOK_TEMPLATES` / `combineBeauty` 入 `constants/aiavatar-ui.ts`；
  store 加 `commitBeauty`、api 加 `commitBeautyRefine`（mock 落 dataURL 版本；live multipart 上传 + RefineEdit）。
  风格妆造走既有 `refineAppearance(img2img, {prompt})` 异步任务。26 vitest + 3 E2E 全绿。

### B4. 风格/妆造模板样片改用真实开源人像（替换 hue 占位）
- **原状**：精调「模版套用」里 6 个风格妆造模板的样片是 hue 色卡占位，看不出风格。
- **改动**：下载 6 张开源人像样片落 `public/seed/looks/look-*.jpg`，`STYLE_LOOK_TEMPLATES` 加 `sampleUrl`，
  模板卡 + 画布右上角「样片参考」缩略均渲染真实图。选中某模板时画布浮该样片，直观呈现「样片 → 当前 → 图生图结果」。
- **样片来源与配对**：Unsplash（免费可用）。职业妆容=商务女性 / 二次元=粉底大眼 / 轻奢氛围=影棚高级感 /
  港风复古=红唇浓颜 / 校园清新=短发清新 / 国风古韵=东方面孔盘发侧颜（Unsplash 缺传统古装，取最贴近东方感者；
  真实风格由 img2img prompt 决定，样片仅作风格参考展示）。首批下载有几张不贴切（国风出男性、清新偏暗调）已人工换掉。
- **验证**：Playwright 程序化断言 6 张样片 `<img>` 全部 `naturalWidth>0` 真实加载；选中国风时面板卡 + 画布参考共 2 张加载。

## C. 合规 / 安全（既有，未改）

- **InsightFace 非商用**：InstantID（faceClone）/ RetinaFace（faceDetect）依赖的 InsightFace 仅限非商用研究。
  生产商用前必须换可商用人脸编码 / 检测或获授权。已在 `/health` 页与本文件标注。
- **真人原始照片加密存储**：后端 `AiAvatarCryptoStore` AES-GCM 落 `aiavatar-assets/secure/`，UI 仅脱敏预览；
  前端详情页对原始素材渲染加锁遮罩。mock 模式上传的照片以 dataURL 标 `encrypted:true` 模拟。

## D. 状态机 / 业务

### D1. 8 态状态机 + 合理回跳（既有；前端 mock 对齐）
前端 `mocks/store.ts` 的 `TRANSITIONS` 邻接表与后端 `AiAvatarStatus.allowedNext()` 对齐：允许同态自环 +
回跳（sampling↔draft_iterating↔refining、pending_finalize→refining），定稿后冻结（finalized_2d→deriving/archived）。
非法跃迁拒绝（mock 抛 `ILLEGAL_TRANSITION` / 后端 409）。

### D2. 几何微调在前端完成，提交后落版本（本轮前端实现）
- **原状**：几何形变是确定性实时算法，适合前端 canvas；版本/资产需落库。
- **改动**：`studio` 页 `face-warp` 实时液化 → 用户「保存为新版本快照」时把结果 dataURL 提交：
  mock → `store.commitGeometry`（落 after 资产 engine=`MediaPipe FaceMesh (client)` + 版本 + RefineEdit + 置封面）；
  live → multipart 上传 after 图为 asset → `POST /refine/geometry` 记录。形变参数 + `landmarkEngine`/`landmarkCount`
  随 RefineEdit 落库（审计：真实关键点 vs 启发式回退）。
- **理由**：实时滑块体验必须在前端；后端保留同算法保证可服务化 + 可契约测试。

### D3. 创建流程 avatar 作用域化（本轮前端 IA 决策）
- **原状**：原型是 SPA，7 步向导用 `nav(name, ctx)` 传上下文，avatar 在流程后段才有 id。
- **改动**：`/create` 选模式即建草稿 avatar（draft），后续步骤全部 avatar 作用域路由
  `/avatars/[id]/{material,sampling,drafting,studio,output,finalize,derive}`，向导条按 id 链接。
- **理由**：Next App Router 下用真实 URL 承载流程状态，可深链 / 刷新不丢；草稿 avatar 即出现在总库（与原型「星野·草稿」一致）；
  详情页「继续编辑」按状态深链到对应步骤（`STATUS_NEXT_STEP`）。

### D4. 打样/草稿「选中即置封面」（本轮 mock 视觉连续性）
mock 下选中某候选图调 `store.setCover` 把该图设为封面 + 当前版本（AI 原创打样用 12 张开源照片做差异化候选，
选中后贯穿后续步骤）；live 下退化为 `markVersion(preferred)`（后端按自身语义处理变体选择）。

## E. 监控线程（用户附加硬要求，既有后端）
`AiAvatarJobWatchdog` 每 `aep.aiavatar.watchdog-interval-ms`（默认 1h）巡检：RUNNING 心跳超时 / FAILED 有额度 /
QUEUED 积压 → 在重试上限内自动续跑。`POST /api/admin/aiavatar/watchdog/sweep` 可手动触发。多实例需 ShedLock。

## F. 测试与验证（§8）

- **前端单元（vitest，25 例全绿）**：`face-warp.test.ts`（13：中性恒等 / 各滑块生效 / 确定性 / 叠加不清零 /
  尺寸一致 / 关键点驱动定位 / 启发式回退一致）+ `beauty.test.ts`（6：磨皮降方差 / 美白提亮 / 确定性 / 中性恒等）+
  `face-landmarks.test.ts`（6：478 点 → 锚点换算）。
- **前端 E2E（Playwright，3 例全绿）**：`e2e/creation-flow.spec.ts` 在 `NEXT_PUBLIC_USE_MOCK=1`（离线）下：
  ① 总库展示种子真人形象；② **AI 原创：从新建到入库归档**（8 步全过，断言每步产出 + 状态机 + 归档）；
  ③ **真人复刻：从新建（上传+授权）到入库归档**。
- **构建**：typecheck 0 error；`next build` 17 路由编译；mock / live 两种 baked 模式均通过。
- **后端**：既有 40 例（`AiAvatarStatusTest` / `AiAvatarProviderContractTest` / `AiAvatarJobWatchdogTest` /
  `AiAvatarJobIntegrationTest`）—— 本轮未改后端。

### F1. E2E 过程中发现并修复的真实 UI bug
- **原状**：右下角数据源指示 `DataSourceBanner` 是可点击的浮层（fixed），其按钮覆盖了底部固定操作条（定稿/打样）
  右侧的主 CTA（「锁定定稿」「进入草稿迭代」），命中测试拦截点击。
- **改动**：把 banner 改为 `pointer-events:none` 的纯静态指示药丸（不再可点）；详细说明改由侧栏「能力健康」承载。
- **理由**：信息指示器不应拦截任何 UI 操作；E2E `document.elementFromPoint` 定位到该 banner 按钮后修复。

## G. 显式 out-of-scope / 简化点
- 重型生成能力（txt2img/inpaint/3D/video 等）为 mock（GPU 缺失），接口契约一致、可热切换（见 §B）。
- 信封加密（KMS 包裹 DEK）当前为单层 AES-GCM（后端），接口不变。
- 多实例 watchdog 需 ShedLock。
- 任务书 §8 的 Testcontainers 集成 / 真实 provider 冒烟需 GPU + 模型服务环境，本环境以 mock E2E + 后端 H2 集成测覆盖。
