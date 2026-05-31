# AiAvatar 形象资产管理中心 — 决策记录（DECISIONS）

> 任务书 §0.2 要求：「发现不合理就自动修正，并在 DECISIONS.md 记录『原状 → 改动 → 理由』」。
> §0.3 / §9：mock 取舍必须标注原因，且 mock 与真实走相同接口契约、可一键切换。

## A. 架构层面的自动决策

### A1. 独立领域包，复用账户 —— 不新建账户体系
- **原状**：任务书要求「单独实现，承接当前系统所有AiAvatar管理能力；DB 新建统一单独开头的数据表，必要账户等数据表复用」。
- **改动**：后端新建独立领域包 `com.aistareco.aep.aiavatar.*`（model/dto/repository/service/provider/controller/config），所有新表统一 `aiavatar_` 前缀（`aiavatar_avatar` / `aiavatar_avatar_version` / `aiavatar_asset` / `aiavatar_source_material` / `aiavatar_license_grant` / `aiavatar_template` / `aiavatar_job` / `aiavatar_refine_edit`）。账户复用现有 `aep_users`（owner 仅存 `ownerUserId` 字符串，不复制账户/钱包/License 表）。积分扣费复用 `CreditService`（hold/commit/release 三段式、不可变账本约束）。
- **理由**：满足「单独实现 + aiavatar_ 前缀 + 账户复用」三条硬约束，且不污染现有 mixcut/celebrity 领域。

### A2. 前端新建独立 app `apps/web-aiavatar`（port 3013）
- **原状**：要求「技术栈统一采用现在 3 端 + 后端的技术栈」。
- **改动**：新建 Next 16.2.6 + React 19 + Tailwind v4 + pnpm 的独立 app，与 web-celebrity 同栈同脚手架；纳入 pnpm workspace + 根 `dev:aiavatar` / `typecheck:web-aiavatar` 脚本。
- **理由**：与现有三端（music/drama/celebrity）完全一致的技术栈与工程形态，独立部署。

### A3. 平台访问隔离：不接入 music/drama/celebrity 的 `requiredPlatform`
- **原状**：v0.43 的平台隔离 `SubProduct` 仅 `music|drama|celebrity` 三值，`AuthProvider.requiredPlatform` 只认这三者。
- **改动**：ai-avatar app **不设** `requiredPlatform` —— 任何已登录账号均可访问（复用统一账户，但不参与三端平台门禁）。
- **理由**：扩展后端 `SubProduct` 枚举会牵动 server / 三端类型 / 数据迁移，违反「单独实现、最小侵入」。当前实现为独立产品入口；若未来要纳入隔离，再扩 `SubProduct = "...|aiavatar"` 并同步后端 `PlatformSupport`。

## B. 能力 → 实现映射（真实 vs mock，§4/§5/§9）

Provider 抽象层 `CapabilityProvider` + `AiAvatarProviderRegistry`：每能力一个 Mock + 一或多个 Real（Backend/SelfHost），按 `aep.aiavatar.app-mode`（mock/live/prod）+ 每能力 `aep.aiavatar.providers.<cap>` 覆盖选择，运行时热切换。真实模式不回退 mock；`GET /api/aiavatar/health/providers` 可观测每能力当前 `mode + engine`。

| 能力 | 当前实现 | 真实方案 | 取舍理由 |
|---|---|---|---|
| **faceWarp 几何形变（眼睛/脸型/鼻梁/嘴）** | **真实**：MediaPipe FaceLandmarker 478 关键点（`@mediapipe/tasks-vision`，Apache-2.0，浏览器 WASM/CPU）→ 确定性径向液化（`face-warp.ts` 前端 canvas + `AiAvatarGeometryWarp` 后端同族） | MediaPipe FaceMesh 478 点 + 液化形变 | 任务书 §4 明确「必须接的真实算法，不要 mock」。**v0.45.1 已真实集成 MediaPipe SDK**：`face-landmarks.ts` 加载官方 WASM+模型，检测真实眼睛/脸轮廓/鼻/嘴关键点 → `landmarksToAnchors` 算出锚点 → 形变定位到真实位置（任意构图都准），不再是固定居中估计。检测不可用（无网络/无脸）回退启发式锚点，仍可用。**真浏览器验证**（`scripts/verify-mediapipe-browser.mjs`，Chromium 实跑）确认检测出 478 点；前端 19 vitest（含锚点驱动 + landmark→anchor 换算）守门。 |
| txt2img / faceClone | **Backend**（`BackendImageProvider` → `AiModelInvocationService` prompt rewrite + image endpoint） | OpenAI 兼容图像端点 / 自研网关 | admin 绑定 `AIAVATAR_PROMPT_REWRITE` + `AIAVATAR_IMAGE_GENERATION` 后走真实调用；mock 仅在 `AEP_AIAVATAR_APP_MODE=mock` 或显式 provider=mock 时启用。InstantID 依赖的 InsightFace **非商用授权**，商用须换可商用人脸编码（见 §C）。 |
| img2img / inpaint / makeup / hair / restore | **Backend**（图像编辑 / 标准 6 镜头） | OpenAI 兼容图像编辑端点 / 自研网关 | admin 绑定 `AIAVATAR_IMAGE_EDIT` / `AIAVATAR_IMAGE_GENERATION` / `AIAVATAR_STANDARD_SHOTS`；未绑定时任务显性失败，不混入 mock。 |
| nlu 人设解析 | **Backend**（`BackendNluProvider` → `AiModelInvocationService` LLM 网关） | 平台已有 LLM 网关 | 任务书 §0/§4「后端已有 LLM 网关」。绑定 `AIAVATAR_PERSONA_PARSE` 即走真实大模型；未绑定时显性报 `AI_NOT_CONFIGURED`。 |
| img23d | Mock（产出**真实有效** GLB 立方体网格，可被 three.js/model-viewer 加载旋转） | TripoSR | TripoSR 需 GPU；mock 产出真 .glb 满足「3D 可交互/下载」验收，接口契约一致。 |
| img2video | Mock（海报帧 + 前端 CSS ken-burns 运镜） | SVD-XT / AnimateDiff | 本环境无 ffmpeg + 无 GPU；mock 用 CSS 运镜满足「缓慢运镜可播放」语义，接 SVD 后 fileUrl 换真 mp4，前端组件走 `<video>`。 |
| faceDetect 合规 | Mock（返回结构化合规判定 JSON） | InsightFace RetinaFace | 同 InsightFace 非商用问题；mock 走相同的「上传→检测→合规标记」管线。 |
| segment | Mock（产出黑底白区 inpaint mask PNG） | SAM / BiSeNet | GPU 依赖；mask 产出契约一致。 |

> **一键切换**：`AEP_AIAVATAR_APP_MODE=mock` 明确使用 mock；`live/prod/real/backend` 真实模式下缺端点直接报配置错误。逐能力仍可用 `AEP_AIAVATAR_PROVIDERS_<CAP>=backend|selfhost|mock` 覆盖。Mock 与 Real 通过同一组 `AiAvatarProviderContractTest` 契约测试，保证可无缝替换。

## C. 合规 / 安全

- **InsightFace 非商用**：InstantID（faceClone）与 RetinaFace（faceDetect）依赖的 InsightFace 人脸模型仅限非商用研究。**生产商用前必须**换可商用的人脸编码 / 检测，或获得授权。已在能力健康页与本文件标注。
- **真人原始照片加密存储**（§3/§4.2）：`AiAvatarCryptoStore` 用 AES-GCM（密钥 `AEP_SECRET_KEY`）把原图密文落 `aiavatar-assets/secure/<owner>/*.enc`（不经静态映射）；UI 仅展示降采样脱敏预览；解密下载 `GET /api/me/aiavatar/assets/{id}/raw` 经 owner 校验。
  - **简化点**：任务书提「信封加密（KMS 包裹 DEK）」，当前为单层 AES-GCM。完整信封加密（KMS/本地 keystore 包裹 per-asset DEK）留作生产化，接口不变。

## D. 状态机 / 业务

### D1. 7 步链路的状态推进
- **原状**：任务书 §3 给出严格 8 态线性链，但 §7 各步又允许「重新打样 / 退回精调」等回跳。
- **改动**：实现为显式 `allowedNext()` 邻接表（`AiAvatarStatus`），允许同态自环 + 合理回跳（如 sampling↔draft_iterating↔refining、pending_finalize→refining），定稿后冻结草稿链路（finalized_2d 只能 →deriving/archived）。非法跃迁 409 `AIAVATAR_ILLEGAL_TRANSITION`。
- **理由**：纯线性会让「不满意重做」无路可走；邻接表既守住「定稿冻结」核心约束，又支持真实创作回路。

### D2. 几何微调在前端完成、后端登记版本
- **原状**：几何形变是确定性实时算法，适合前端 canvas；但版本/资产需落库。
- **改动**：前端 `face-warp.ts` 实时液化 → 用户满意后把结果图 dataURL 提交，后端 `recordGeometryRefine` 登记 `AiAvatarAsset` + `AiAvatarVersion` + `AiAvatarRefineEdit`（同步，无异步 Job）。后端 `RealFaceWarpProvider`（同算法）作为契约测试样本 + selfhost 等价实现。
- **理由**：实时滑块体验必须在前端；后端保留同算法保证「可服务化 + 可契约测试」，二者参数语义一致。

## E. 监控线程（用户附加硬要求）

> 「如果遇到模型错误执行中断等，另起一个监控线程，每一小时判断下当前任务是否完成，异常中断则继续执行下去。」

- **实现**：`AiAvatarJobWatchdog`（`com.aistareco.aep.aiavatar.service`），由 `AiAvatarAsyncConfig` 用独立单线程调度器每 `aep.aiavatar.watchdog-interval-ms`（默认 **3600000 = 1 小时**）触发 `sweep()`。
- **判定 + 处置**：
  1. RUNNING 但心跳（`heartbeatAt`）超过 `aep.aiavatar.job-stale-ms`（默认 10min）无更新 / 进程重启内存进度丢失 → 视为异常中断；attempts < maxAttempts 则退回 QUEUED 重新派发（**续跑**），否则置 FAILED。
  2. FAILED 且有剩余重试额度 → 自动续跑。
  3. QUEUED 长期未启动（积压 / 重启丢失）→ 重新派发。
- **保护**：重试有 `maxAttempts`（默认 3）上限，避免坏任务无限烧算力/积分；`sweep()` 全程 try/catch，监控线程绝不因单次异常而死。
- **可观测**：admin `POST /api/admin/aiavatar/watchdog/sweep` 可手动触发巡检。
- **测试**：`AiAvatarJobWatchdogTest`（8 例）覆盖全部分支。
- **多实例注意**：内存进度 + 单实例调度。多实例生产部署需 ShedLock（沿用本仓 PublishJobScheduler 同样的待办）+ Redis 共享进度。

## F. 测试与验证（§8）

- **后端 JUnit（37 例全绿）**：`AiAvatarStatusTest`（状态机）、`AiAvatarProviderContractTest`（Provider 契约 + GLB 有效性 + 真实形变确定性）、`AiAvatarJobWatchdogTest`（监控线程恢复）。
- **前端 vitest（7 例全绿）**：`face-warp.test.ts`（几何形变数学：中性恒等 / 各滑块生效 / 确定性 / 叠加不清零 / 尺寸一致）。
- **E2E（H2 + dev-auth 真链路冒烟全过）**：见 `docs/AIAVATAR_PROGRESS.md` M7。
- **测试中发现并修复的真实 bug**：`AiAvatarGeometryWarp` 眼睛 `radial()` 在 `eye==0` 时清掉了 slimFace 累积位移 —— 契约测试捕获后修复。
