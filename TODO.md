# 待修清单 / Known Issues

本文件记录已定位但暂未修复的问题，方便后续排期。动手修时请勾掉对应条目并在代码里落实。

> 状态注（2026-05-27 / v0.34 部署基础设施落地后审计）：
> - **2026-04-21 admin auth 块部分完成**：admin `apiFetch` Authorization 头 ✅（`AUTH_TOKEN_KEY` + `Bearer ${token}` 在 `apps/admin/src/api/_client.ts:18-97`）、admin login 页 + AuthContext ✅、MDC ✅（v0.30+ 改名 `traceId`，pattern `%X{traceId:-}` 已生效）。**剩一项未做**：`DevAutoAuthFilter` 仍 `@Profile("dev")`（未按 `aep.dev-auth.enabled` property 门控）。`SecurityJsonEntryPoint` / `SecurityJsonAccessDeniedHandler` 已于 2026-06-10 落地（401/403 JSON body 带 traceId）。
> - **角色拆分 `SUPER_ADMIN/OPERATOR → PLATFORM_OPERATOR/FINANCE_ADMIN` 已反向决策不做**（v0.31 改在 `aep_users` 加 `operatorRole` 复用现有命名 — 见 `AGENTS.md` v0.31 B 节）。
> - v0.7 ~ v0.34 期间累积的新待办见文末「v0.7 ~ v0.34 累积待办」段。

---

## 2026-04-21 · admin 调 server 全 403 + 缺排错手段

### 现象

- 本地联调时，admin (`http://localhost:3003/admin`) 调 `/api/admin/*` 全部 `403 Forbidden`。
- 浏览器 console 上实际报的是 `PARSE_ERROR: Invalid JSON from ...`，因为 Spring Security 默认的 403 响应 body 是空的。
- 排错困难：前端拿不到 code/message，后端日志没有请求级关联 id。

### 根因（互相叠加，需一起治理）

1. ✅ ~~**admin `apiFetch` 不发 `Authorization` 头**~~（已修，`apps/admin/src/api/_client.ts:18-97` 已带 `AUTH_TOKEN_KEY` + `getAuthToken` + `Bearer ${token}`）

2. ✅ ~~**admin 没有登录页**~~（已修，`apps/admin/src/app/login/page.tsx` + AuthContext 已上线）

3. **`DevAutoAuthFilter` 门控与 `DevAuthController` 不一致**
   - `apps/server/src/main/java/com/aistareco/aep/config/DevAutoAuthFilter.java` 仍是 `@Profile("dev")`。
   - `apps/server/src/main/java/com/aistareco/aep/controller/DevAuthController.java` 已改成 `@ConditionalOnProperty("aep.dev-auth.enabled")`（见 DEPLOYMENT.md §4.4）。
   - 结果：mysql profile + `AEP_DEV_AUTH_ENABLED=true` 时，手动 dev-login 能用，但 admin 前端不带 token 访问时的自动兜底失效 → 403。
   - dev profile 下 DevAutoAuthFilter 应该是能覆盖的，但门控写法不一致本身是个坑。

4. **Spring Security 的 401/403 不走 `GlobalExceptionHandler`**
   - `apps/server/src/main/java/com/aistareco/common/GlobalExceptionHandler.java` 只在 controller 之后生效。
   - Security 链上 `AccessDeniedException` / `AuthenticationException` 由 `AccessDeniedHandler` / `AuthenticationEntryPoint` 处理，当前没自定义 → 默认空 body。
   - 需要补 `SecurityJsonEntryPoint` / `SecurityJsonAccessDeniedHandler`，在 `AepSecurityConfig` 里 wire 上。（✅ 2026-06-10 已落地）

5. ✅ ~~**后端请求没有 logId / requestId**~~（已修，v0.30+ 落地为 `traceId`：`application.yml` pattern `%X{traceId:-}` + `TraceFilter` MDC 注入）

### 修复方案（落实时再做）

#### server（5 处）

- `apps/server/src/main/java/com/aistareco/aep/config/DevAutoAuthFilter.java`
  - 把 `@Profile("dev")` 改成 `@ConditionalOnProperty(prefix = "aep.dev-auth", name = "enabled", havingValue = "true")`。
  - 同步改内层 `Registration` 的 profile 限制。
- 新增 `apps/server/src/main/java/com/aistareco/common/RequestLogFilter.java`
  - `OncePerRequestFilter`，最高优先级。
  - 生成 8~12 位短 id（`UUID.randomUUID().toString().substring(0,8)`），写入 `MDC.put("logId", ...)`，同时写 `response.addHeader("X-Log-Id", ...)`，`finally` 清 MDC。
- `apps/server/src/main/java/com/aistareco/common/GlobalExceptionHandler.java`
  - 错误响应体加 `logId` 字段（从 `MDC.get("logId")` 读）。
  - `ApiErrorBody` 可能需要补 `logId` 字段或改成 `Map`。
- 新增 `apps/server/src/main/java/com/aistareco/aep/config/SecurityJsonEntryPoint.java` + `SecurityJsonAccessDeniedHandler.java`
  - 两个 handler 都输出同样的 JSON 壳：`{error:{code, message, logId}}`，HTTP 401 / 403。
  - 在 `AepSecurityConfig` 里：`.exceptionHandling(eh -> eh.authenticationEntryPoint(...).accessDeniedHandler(...))`。
- `apps/server/src/main/resources/application.yml`
  - `logging.pattern.level: "%5p [%X{logId:-}]"`，方便每行日志都能看到 logId。

#### admin（4 处）

- `apps/admin/src/api/_client.ts`
  - 加 `AUTH_TOKEN_KEY = "aistareco.admin.token"`、`getAuthToken()` / `setAuthToken()`。
  - 在 `apiFetch` 里带 `Authorization: Bearer <token>`（如果有）。
  - 捕获响应的 `X-Log-Id` 或 body 里的 `logId`，塞进 `ApiError`。
  - 在 throw `ApiError` 之前统一走一次全局 error 回调（由 toast 订阅）。
- 新增 `apps/admin/src/components/ui/sonner.tsx`
  - shadcn 风格的 `Toaster` 包装，统一 position / theme。
- `apps/admin/src/app/layout.tsx`
  - `<AppShell>` 内 / 旁挂 `<Toaster />`。
- 新增 `apps/admin/src/lib/toast-on-error.ts`
  - 订阅 apiFetch 的 error 回调，调用 `sonner` 的 `toast.error` 显示 `[code] message · logId=xxx`。

#### 暂不做

- admin 完整登录页 + AuthContext（本轮不在范围内）。`DevAutoAuthFilter` 改成按 property 门控后，本地开发可以直接无 token 走 dev-auto-auth，不阻塞开发。
- web 侧 error toast（web 已有 token 流程，403 不是当前问题）。

### 验证口径

动手修完后：

1. `curl -i http://localhost:8080/api/admin/studios` 应该返回：
   - `X-Log-Id: <8位>`
   - body 是 JSON，包含 `error.code` / `error.message` / `error.logId`（没登录时是 401/403）。
2. 开 `AEP_DEV_AUTH_ENABLED=true` 后，admin 页面刷新不再出 403。
3. 故意构造一次 500（比如访问不存在的 admin 资源），admin 右上应弹 toast，带 logId；后端日志该行前缀能看到同一个 logId。

---

## v0.6 候选（2026-05-09 收集）

> 来源：v0.5.0 ~ v0.5.3 commit message 与 product_spec_ai_celebrity.md 的"已知限制"段。

### 持久化与基础设施

- [x] ~~**engine-pricing 落表**~~（**已完成**，2026-06-17 审计发现实际早已落库）：`CelebrityZoneService.adminReplaceEnginePricing` 已 `platformConfig.upsert(ENGINE_PRICING_CONFIG_KEY, ...)` 落 `PlatformConfig` key=`celebrity.engine-pricing`，内存只是 1min TTL cache（`pricingCache` AtomicReference），重启自动从 config 读回。原 TODO 描述过时。
- [x] ~~**生成任务 JOBS 落表**~~（**v0.80 完成**，2026-06-17）：新增 `GenerationJob` 实体（`generation_jobs` 表，ddl-auto 建）+ `GenerationJobRepository`，替换 `CelebrityZoneService` 的静态 `ConcurrentHashMap`。`startGeneration` 落表、`getJobProgress` 从 repo 读并按 `startedAt + totalSec` 算进度；重启后任务仍可恢复进度 + done 时幂等 commit hold（`committed` 标记守门，不再产生孤儿冻结额度）。`CelebrityZoneServiceTest` 5/5。
- [ ] **真实微信支付**（**非漏洞，可后置** — 2026-06-17 澄清）：`POST /me/wallet/recharge` 并非「mock 直接落账」，而是 `RechargeService.createOrder` 建 **PENDING 订单**，必须运营在 admin「充值订单」`approveOrder` 才经 `CreditService.creditAccount` 落账。即当前已是「线下充值 / 对公转账 + 运营手动核准」过渡方案，无刷余额风险。自动化路径（任选）：① 微信支付 Native/JSAPI `wx.requestPayment` → `notify_url` 验签后自动 approve；② 支付宝；③ 保持运营手动核准（早期足够）。

### LLM provider 拓展

- [ ] **国产 LLM provider 真实调用**：`AiModelInvocationService` 当前只支持 `OPENAI / OPENAI_COMPATIBLE` 走 `/chat/completions`。`ANTHROPIC` 用 `/v1/messages` 不同路径；`BAIDU / ALIYUN / TENCENT` 都是各自鉴权。各自加 adapter。

### 配置中心 / 字典上移（spec §10）

- [ ] **`ConfigItem` 配置中心**：`docs/ADMIN_PRODUCT_SPEC.md` §10 设计已写。需要落实体 + 草稿 / 审核 / 发布状态机 + 灰度（白名单 / AB 桶）。
- [ ] **`apps/web/src/constants/*` 17 个字典上移**：详 `docs/ADMIN_PRODUCT_SPEC.md` §7.5。
- [ ] **`/celebrity/dictionaries`** 当前 hard-coded 默认值；接 ConfigItem 后改为运营可配。

### 通知 / 实时

- [ ] **WebSocket 升级路径**：当前轮询 15s + 5s + 业务关键点 trigger 已"近实时"。如需 < 1s 双向 / 离线提醒，按 `apps/miniprogram/app.js` 末尾 TODO 4 步上：spring-boot-starter-websocket → 按 userId hold session → 业务事件 emit → 30s ping / 60s 重连。
- [ ] **`wx.subscribeMessage` 模板消息**：用户离线推醒（生成完成 / 授权审核结果），需要走小程序模板 ID 申请。

### 模板脚本（spec §3.2.7 video_ref 模式）

- [ ] **video_ref 自动检测**：当前接 URL 并默认 `reviewStatus=approved`。v0.6 加 `VideoReferenceIngestService` 做转码 + 抽帧 + BGM BPM + NSFW + 主色板检测，结果回填到 `referenceClip.autoAnalysis`。
- [ ] **OSS / CDN 文件上传**：当前 admin 表单只接受 URL（明星 photos/videos / 模板预览 / 参考视频）。v0.6 接 OSS multipart 上传，后端代签 STS 临时凭证。
- [ ] **A/B 桶 + 多人审批**：当前 `experiment` / `metrics` 字段保留但不分桶；publish 单 admin 即可。v0.6 加双人复核 + AB 分桶（按 `userId` 哈希）+ 30 天指标回流。

### 角色拆分

- [x] ~~**`SUPER_ADMIN/OPERATOR` → `PLATFORM_OPERATOR/FINANCE_ADMIN`**~~（**v0.31 反向决策不拆**。改在 `aep_users` 加 `operatorRole` 字段，复用现有 `SUPER_ADMIN/OPERATOR` 命名让 celebrity 端用户也能命中 `hasAnyRole` 门禁；admin / aep 两套用户表保持独立。详见 `AGENTS.md` v0.31 B 节。）

### 基础设施收敛

- [ ] **Bot 消息真实事件触发推送**（替代或补充当前拉模式）：业务事件触发器（生成完成 / 审核通过）→ 写 `Notification` → WebSocket 推。当前拉模式是"在线时近实时"，事件触发是"离线也能感知"。

- [ ] **sau-service 验证浏览器进程复用（中期）**：当前 `apps/sau-service/src/sau_service/routes/accounts.py:_verify_real` 每次 verify 都 `async_playwright().start()` → `chromium.launch()` → `new_context()` → 用完关掉。冷启 chromium 一次 ~3-4s，CPU/RAM 峰值高。
  - v0.5.x 已做（2026-05-21）：前端串行 + 10min TTL skip + server `SauServiceClient.verifyMutex` Semaphore(1) 兜底，短期足够。
  - 下一步（v0.7 候选）：sau-service 内常驻一个 `patchright` persistent context worker，每次 verify 只是 `context.new_page()` + 复用 storage_state；用完关 page 不关 context。预计 verify 单次开销从 3-4s 压到 ~0.5s。
  - 实现要点：
    - 在 `sau_service/lifespan.py` 起 verify worker（singleton，跟 FastAPI lifespan 绑）；
    - 引一个 `asyncio.Lock` 保证 worker 单线程（playwright API 不是线程安全的）；
    - storage_state 注入改用 `context.add_cookies()` 而非 `new_context(storage_state=...)`，避免每次重建 context；
    - 验证完用 `context.clear_cookies()` 清场，下一个账号重新注入；
    - context 健康度监控：连续 N 次失败 → 重建 context（防 chromium 内存泄漏）。
  - 触发条件：用户反馈 verify 仍慢、或绑定 / 任务的 chromium 开销也想合并优化（同 worker 共用即可）。

- [ ] **HTTP-only cookie 探测（长期）**：彻底脱离浏览器跑 verify。
  - 思路：每平台找一个登录态保护的轻量 API（如 `/aweme/v1/user/profile/other_basic_info/`），带 cookie 发 HTTP 请求 → 200/有效 vs 401-302/失效。
  - 优势：单次 verify 从 0.5s（复用 context）再压到 ~100ms HTTP RTT；彻底无浏览器进程。
  - 风险（这是它没成为短期方案的原因）：
    - 抖音 / 视频号 / 小红书 / 快手 全部要 **签名头**（`_signature`、`x-s` / `x-t`、`msToken` …），逆向难度高、跟版烦。
    - 平台改一次签名算法这套就失效，工程量大但回报曲线陡（一次 bug 就报废）。
    - 反爬 fingerprint 检测（UA、TLS、JA3）可能直接挡掉裸 httpx。
  - 渐进策略：
    1. 先选一个平台试点（建议视频号，签名相对稳定且没有 msToken 死循环）。
    2. 在 `apps/sau-service/src/sau_service/routes/accounts.py` 加 `_verify_http(driver_cls, storage_state)`，跑成功 + 浏览器路径并行对比一周，看准确率。
    3. 准确率 ≥ 95% 后切为该平台默认 verify，浏览器路径作为 `?force_browser=1` fallback。
    4. 逐平台滚动覆盖；任一平台失败 → 立即 fallback 浏览器，不阻塞用户。
  - 触发条件：日活账号验证次数 > 10k / 天且 sau-service 已成瓶颈；或对验证延迟有 < 200ms SLA 要求。
  - 不做的版本：实现一个通用 anti-bot bypass。这是猫鼠游戏，不在本产品定位内。

### dashboard 待办真实统计

- [ ] **"数据日报" todo count**：`NotificationService.computeTodos` 当前回退常量 1。接 dashboard summary 后改为真实未读统计。

---

## 三子产品 web app 待办（2026-05-15 收集 + 合并自各 README）

> 来源：2026-05-15 backlog 调研 + 已合并 `apps/web-music/README.md` / `apps/web-drama/README.md` / `apps/web-celebrity/README.md` 原"待办（下一轮）"段。各 README 不再独立维护待办，统一以本节为真源。
>
> Phase 4b 已完成；以下条目分为「跨工程通用」(CG-*) + 三个工程专项 (M-* / D-* / C-*)。

### 跨工程通用（CG-*）

- [x] ~~**CG-1** `tsconfig.json` `baseUrl` 弃用警告~~（2026-05-15 完成 — 三个 tsconfig 加 `"ignoreDeprecations": "6.0"`）
- [x] ~~**CG-2** placeholder `test` 脚本 + 决策~~（2026-05-15 完成 — 暂不引入 vitest；三 `package.json` 加 placeholder + 根 `test:all` 别名）
- [x] ~~**CG-3** drama 本地 types 上推~~（2026-05-15 完成 — `Script` + `PublishJob` → `packages/types`；10 处 import 切换为 `@ai-star-eco/types` barrel）
- [ ] **CG-4** `proxy.ts /console` 兼容 308 重定向：三工程 `src/proxy.ts` 当前把旧 `/console[?tab=xxx]` 重定向到新顶层路径。观察期（无残留旧书签）后删除。
- [x] ~~**CG-5** music + celebrity 缺 README~~（2026-05-15 完成）
- [ ] **CG-6** ESLint 实际告警审计：环境装 `node_modules` 后跑 `pnpm -r run lint` 摸底。静态摸底已做（2026-05-15）：3 工程无自定义 ESLint config 走 Next 16 默认；0 处 `@ts-ignore`；7 处 `eslint-disable-next-line` 全部合理（5 × `react-hooks/exhaustive-deps` + 1 × `no-unused-vars` + 1 × `no-explicit-any` drama-query suspend cast）。
- [ ] **types 上推（持续项）**：community / appearance-forge / celebrity-zone 等域随 OpenAPI 接入逐步上推到 `packages/types`，并按 CLAUDE.md 硬规则 1 同步 admin/server *Dto。

### apps/web-music 专项（M-*）

- [ ] **M-1 真 TODO 3 处**（依赖后端或大重构）：
  - `src/translations.ts:2` —— 中文单语化兜底清理（清除组件 `lang: Lang` prop 透传 + `TRANSLATIONS[lang]` 访问，工作量大需逐文件验证）
  - `src/api/community.ts:3` —— OpenAPI 尚未覆盖本域（社区 / 粉丝运营 listFanTiers / getFanGrowth / listActivities 全 mock）
  - `src/api/appearance-forge.ts:87` —— AI 视频生成尚未接入（mock 走 `DEMO_FORGE_VIDEO_POOL`）
  - 备注：原 backlog 6 处中另 3 处（`AgencyOverview.tsx:11` IA 设计注释 / `IncubationWizardV2.tsx:923` 表单校验 UI 文案 / `AppearanceForge.v3.tsx:925` 空态 UI 文案）不是代码 TODO，已修正描述。
- [ ] **M-2 剩 5 处 any**（22 处 → 5 处，已清扫 18 处 / 78%，2026-05-15）：
  - `NFTMintingDialog.tsx:25` `track?: any` + `MusicGenerationDialog.tsx:21+39` + `MusicBusiness.tsx:126` —— mock track shape 用 `style` 字段而 `Song` 类型用 `genre`，且 `duration` 字符串/数字混用。需 schema 对齐（或定义独立 `GeneratedTrack` interface）。
  - `dashboard/charts/TypeDistributionPie.tsx:41` `ActiveSliceShape(props: any)` —— recharts ActiveShape 形参类型由内部 sector 数据 + 用户配置 prop 混合，行业惯例保留 any。
- [ ] **M-3 inline style 渐进迁移**：约 193 处 `style={{}}` → Tailwind v4 token。高 ROI 集中点：`AppearanceForge.v3.tsx` / `IncubationWizardV2.tsx` / `MCNMatrix.tsx`。颜色 / 间距优先；动态计算值（百分比、translate）保留 inline。
- [ ] **M-4 img alt 审计**：约 52 处 `<img>` 未确认 `alt`，跑 `pnpm --filter @ai-star-eco/web-music lint` 借 `jsx-a11y/alt-text` 自动审。

### apps/web-drama 专项（D-*）

- [ ] **D-1 真后端 CRUD**：`apps/server` 落地 Drama / Script / ScriptVersion / DistributionJob / Transaction 实体 + REST。DTO field 名严格 mirror `packages/types/src/script.ts` + `publish-job.ts`（CLAUDE.md 硬规则 1）。
- [ ] **D-2 openapi 同步**：`specs/openapi.yaml` 加 drama / script / distribution / finance paths，跑 `pnpm check:api-contract` 验证。
- [~] **D-3 inline style 渐进迁移**：实测 **~1615 处** `style={{}}`（原估 573 严重低估），drama 是 Figma Make 移植、inline 精确定位是其设计工作流的一部分 —— **机械全量迁移不现实且高风险、零用户可见收益**，结论改为「按重复模式渐进提取到 app.css 工具类」。**v0.67 已做**：提取 `.icon-badge`（accent 渐变图标盒不变部分：grid 居中 + flex none + 白图标）+ 迁移 4 处代表（short-clip / quick-create / outline / ai-chat-panel，各档尺寸；computed-style 验证逐属性等价、零回归）。注意：grep 命中的「图标盒」混杂（圆形 FAB / 金色装饰点 / 布局容器误报），不可机械批替；后续每提取一个模式新增一个 app.css 工具类即可。
- [ ] **D-4 发布任务状态机**：`createPublishJob` mock 用 `setTimeout` 推进 queued → uploading → live。真后端落地后换 SSE 或 polling endpoint。
- [ ] **D-5 admin 镜像**：`apps/admin` 加 drama 管理视图。
- [x] **D-10 分镜一致性优化**（v0.97，2026-06-30，借鉴 [HKUDS/ViMax](https://github.com/HKUDS/ViMax)；真源 [`docs/drama-storyboard-consistency.md`](docs/drama-storyboard-consistency.md)）：P0/P1/P2 全量落地。
  - [x] **P0 镜间承接 + 场景绑定**：`stages/factory.tsx` `prevSceneFrame`/`nextSceneFrame`/`shotRefImages`（角色 + 场景参考图 + 同场上一镜画面，成片真实末帧优先）+「镜间一致性承接」开关 + 「场景参考绑定」面板（`BoardScene.sceneRefId` 显式 + 名称自动匹配兜底）。纯前端、零契约。
  - [x] **P1 文本层 + 机位**：`drama.epscript.md` / `drama.split_scene.md` 补电影语言规则；`BoardShot.camId` + `normalizeShot` 透传 + JSON 模板加字段。
  - [x] **P2 视频层关键帧 i2v**：`MaterialVideoModelClient.PROTOCOL_SEEDANCE`（content 数组 first/last_frame + return_last_frame + `/contents/generations/tasks` 路径）+ GENERIC 补 image/end_image（修复 seedance 落 GENERIC 连首帧都没传）；`MaterialVideoJob.lastFrameUrl` → 任务卡 `last_frame_url` → 前端 `BoardShot.lastFrameUrl` 链式承接闭环；`drama.decompose` 节点（`/me/drama/projects/{id}/shot/decompose` + `drama.credit.decompose` + ff/lf_chars 角色名存在性校验）。门禁：server 35/35 + typecheck:all 10/10 + web-drama build + contract 全绿。
  - [x] **B 收敛（v0.98，2026-06-30）**：短剧工作台 6 阶段 → 5，删「视频工厂」阶段/抽屉/源码，逐镜出片全在剧集脚本分镜表内（`use-shot-render` hook + 分镜表 4 版挑选/AI 拆镜/首帧▷末帧双联+hover 预演）。**P1** epscript 不再 lock（脚本始终可编辑）。**P5** 删左下 AI 浮窗 → 行级 Wand2 就地改写本镜（`/shot/rewrite`）。**P6** 短视频面包屑派生 + beat 改 AI 生成。**P4** 假模型下拉随工厂删除已消失。
  - [ ] **后续可选**：VLM best-of-N 首帧一致性自检。~~`lastFrameUrl` 末帧 CDN 镜像~~ **C-1 完成**（v0.99，2026-07-10）：`MaterialVideoJob.lastFrameCdnKey` 真值列 + worker 末帧下载镜像（失败 best-effort 仅 WARN 不 markFailed）+ `toCard` `signKey` 派生 fallback 旧 URL；同批落 `/render/{frame,clip}` 返回体 `applied_refs` 参考生效回报（`MaterialVideoWorkerTest` + `DramaRenderServiceTest`）。真源 `docs/[Fabel5]drama-consistency-engine-design.md` §2。
- [x] ~~**D-11 出片真·多模型选择**~~ **D-11 完成**（v0.100，2026-07-10）：一致性引擎 D 序列。新表 `ai_app_endpoint_candidate`（purpose×endpoint 交点 + capability + 单价 override，`AiAppBinding` 保持默认端点、`resolveEndpoint(purpose)` 行为零变化）；`AiModelInvocationService.resolveEndpoint(purpose, endpointId)` 重载（白名单未命中 → 503 `ENDPOINT_NOT_ALLOWED` 不回退默认、不扣费，§8.0）+ `listCandidates`；`AiAppCandidateSeeder`（@Order 60）幂等回填现有绑定为置顶候选；`GET /me/drama/render/models`（image+video 候选 + capability + isDefault）；`/render/{frame,clip}` body 加 `endpoint_id`（frame debit / clip item credit_cost，override 覆盖用途默认单价）；视频线 endpoint_id 随 `variant_config` 透传 worker → `MaterialVideoModelClient.pickEndpoint`（celebrity 素材线不传 → 默认端点，回归测试守）；前端 `render-model-select`（分镜表 / 短视频出片模型下拉，替代 v0.98 假下拉）+ admin「候选端点与能力」编辑块。真源 `docs/[Fabel5]drama-consistency-engine-design.md` §3。测试：`AiModelInvocationServiceTest`(+6) / `AiAppCandidateSeederTest`(2) / `DramaRenderServiceTest`(+2) / `MaterialVideoWorkerTest` 回归。
- [x] ~~**C-2 角色/场景实体化 + 多角度参考图集**~~ **C-2 完成**（v0.101，2026-07-10）：一致性引擎 L0 地基。两新表 `drama_character`/`drama_scene`（字段名对齐 `CharacterDef`/`SceneAsset`；`ref_images_json`=多角度参考图集 `[{cdnKey,angle,label}]`，真值 cdnKey，出 wire signer 派生，软删随项目）；新服务 `DramaReferenceAssetService`（懒回填 `ensureBackfilled` + 双写 `syncFromDoc`〔§6.1 只 upsert 实体表、不重写 payloadJson〕+ 出 wire overlay + 三视图 `generateReferenceSheet`）。新端点 `POST /me/drama/projects/{id}/characters/{charId}/reference-sheet`（复用 `IMAGE_GENERATION`+`drama.character_frame_image` 加 `{{angleClause}}` 注角度、锁脸用定妆图；计费 **hold→逐角度 commit**，部分失败剩余 release，全失败 release 全额+抛错；§8.0 preflight 在 hold 前）。前端角色卡「一键三视图」+ 正/侧/全身缩略图墙。测试 `DramaReferenceAssetServiceTest`(8)。真源 `docs/[Fabel5]drama-consistency-engine-design.md` §4。类型沿用 drama 本地约定（不进 packages/types）。
- [x] ~~**C-3 服务端参考装配（Reference Assembler）+ 双线共享 useShotRender**~~ **C-3 完成**（v0.102，2026-07-10）：一致性引擎 L1 收官。新服务 `DramaReferenceAssembler`（`@Service`，**只读文档/实体、绝不回写 payloadJson**，§6.1）把前端 `epscript.tsx:shotRefImages` 优先级链下沉服务端：三级入参 `shot_ref` > `ref_slots` > `ref_images`（老前端数组直通兼容）+ `ref_leading` 置顶锚；角色 `drama_character.refImages`(front 优先，@cast→文本名→全员，实体缺兜底文档 avatarImage)/场景 `drama_scene`(显式 sceneRefId→名称兜底)/同场上一镜真实末帧（文档优先 + `MaterialVideoJob.lastFrameCdnKey` 权威回退，`variant_config` 内存扫）。按 D-11 capability(`maxRefImages` 全 null→保守默认 1) 裁剪，优先级保 identity(character>scene>prev 末位先砍)、超出 `over_max_refs`、本地 `/cdn` `local_unfetchable`（如实回报 §8.0），`applied_refs.role` 精确槽位。`DramaRenderService.renderFrame/renderClip` 接入（删旧 `computeClipAppliedRefs`/`appliedRefsJson`）；前端共享 `lib/use-shot-render.ts`，`epscript` 删 `shotRefImages`/`sceneRefUrlFor`/`prevFrameInScene`/`nextFrameInScene`（体检留 UI 级 `sceneHasRef`）、`shorts/make` 删 `shortRefImages` 改走 `ref_slots`。测试 `DramaReferenceAssemblerTest`(16) + `DramaRenderServiceTest` 精简。真源 `docs/[Fabel5]drama-consistency-engine-design.md` §5。无新 path（复用 `/render/frame,clip`）。
- [ ] **C-4 MaterialVideoJob shotId/sceneId 索引列**（C-3 遗留，DAG 时必做）：C-3 的「同场上一镜真实末帧」权威回退目前用 `MaterialVideoJobRepository.findByOwnerUserIdAndScriptIdOrderByCreatedAtDesc` 拉该项目全部 job 后**内存解析 `variantConfigJson`** 匹配 `scene_id`/`shot_id`（`DramaReferenceAssembler.jobLastFrame`）。大项目 job 多时有内存/扫描成本。C-4（跨镜 DAG 编排）应给 `MaterialVideoJob` 加 `shot_id`/`scene_id` 索引列（ddl-auto=update 自动加）+ Repo `findFirstByOwnerUserIdAndScriptIdAndShotIdAndStatusOrderByCreatedAtDesc`，把内存扫换成索引查询。当前 C-3 内存扫描可接受（架构师裁决），不阻塞。
- [ ] **D-13 渲染扣费形态统一（debit vs hold→commit）**（v0.101 C-2 引入的有意分裂，待未来收敛）：`renderFrame` 单产物用一次性 `CreditService.debit`（SPEND），C-2 三视图批产物用 `hold→逐角度 commit`（FREEZE→SPEND，需部分成功部分退）。两形态并存 → 短剧「首帧类扣费」在账本上出现 SPEND 与 FREEZE→SPEND 两种流水形态。可接受（语义不同：单产物 vs 批产物部分退），但若未来统一渲染扣费口径，应把 `renderFrame` 也改 hold→commit（或反之）以让账本形态一致。定位：`DramaRenderService.renderFrame`(`creditService.debit`) vs `DramaReferenceAssetService.generateReferenceSheet`(`hold/commitHold/releaseHold`)。
- [ ] **D-12 短视频草稿资产 URL 重签**（v0.98 发现）：`DramaShort.payloadJson` 存的是当时签名的 OSS URL（首帧/末帧/成片），`AEP_CDN_SIGNED_URL_TTL_SECONDS`（默认 3600s）过期后 403 图裂——与 `DramaProject` 同类债。`DramaProject` 已在 `toDetail` 递归 `signer.maybeSign` 重签修复（v0.98，见 AGENTS §4.7.7）；`DramaShort` 出 wire 漏斗需照做（注入 `CdnUrlSigner` + 复用 `resignAssetUrls` 范式）。
- [x] **D-6 单元测试**（v0.67）：真后端已落地，建立首个测试基线 —— vitest + jsdom + @testing-library/react；`format.test.ts`（15 例：货币/积分/紧凑/时长/带符号边界）+ `drama-query.test.tsx`（6 例：命中复用 / 精确失效 / 前缀失效 / 乐观写入 / refetch / clearAll）。**测试驱动修了一个真实 bug**：`drama-query` 的 `load` catch 里 re-throw 导致 `useAsync` 丢弃的 promise 变 unhandled rejection（改为错误只落 `entry.error`）。`package.json` test 脚本 placeholder → `vitest run`。状态机过渡在后端 `DramaProjectServiceTest` 11/11 已覆盖；前端无 zod 表单 schema 故略。
- [x] **D-7 a11y dialog**（v0.67）：**不换 shadcn**（那套亮色 token 会破坏 drama 暗色 premium 玻璃视觉），改为强化共享容器 —— 抽 `lib/use-modal-a11y.ts`（ESC + 焦点陷阱 + 初始/还原焦点 + body 锁，单一来源），`common/Dialog.tsx` 接入并补 `aria-labelledby/-describedby`；新增 `common/ModalShell.tsx` 给命令式弹层（`.overlay` + role=dialog + a11y），收编 short-clip / quick-create / preview 三个此前裸 `<div className="overlay">`（全缺 ESC/focus）。
- [x] **D-8 首页脑暴链路**（v0.87，2026-06-28）：按设计稿 `AI短剧工作台.dc.html` 还原 首页→对话→故事大纲→去制作。新实体 `DramaBrainstorm` + `/api/me/drama/brainstorms/**`（chat/outline/promote）+ 前端 `api/brainstorm.ts` + 重建 `/dashboard`（chatOff/chatOn `?b=`）。落库可回溯、§8.0 守门、promote 幂等。门禁全绿 + 真实 server+fake-llm API E2E 24 断言。详见 `AGENTS.md`/各 README v0.87。
- [x] **D-9 设计稿剩余对齐项**（v0.88 完成主体，2026-06-28，CDP headless 浏览器可视验收）：
  - [x] ① 短剧设定单页（合并 选题/大纲/角色场景 + 左轨两步）—— `stages/setup.tsx` + `OutlineStage`/`CastStage` `embedded` + `stage-rail.tsx`；场景升级为后端 `ProjectData.scenes`（promote 预填、可编辑落库），`outlinePrefs` 落库。
  - [x] ② 剧集脚本平铺分镜表 —— 新 `storyboard-table.tsx`（每格结构化可编辑→喂视频生成提示词），`BoardShot` 加 `sfx/bgm/fx`；`ShotFormCard` 保留给短视频。
  - [x] ③ 首帧 AI 改图弹窗 —— `storyboard-table.tsx` 内（左指令对话+右 9:16 预览+版本号），复用 `renderFrame` + `ref_images` 迭代回填落库（**未新增 prompt key，复用 `drama.frame_image` + 指令拼进 desc**）。
  - [x] ④ 短视频 `/shorts/make` 单页化（v0.88）：去掉 脚本/工厂 步骤切换 → 单页（左 AI 口播对话 / 右 短视频大纲[口播种草 + beat 流 痛点开场→卖点演示→强CTA] + 分镜脚本，逐镜内联出片）；`meta.style` 可编辑落库；每镜 beat 语义标签。删退役 `ShortShotCard` 工厂网格 + 步骤态。
  - [x] ⑤ `epscript` 的 本集叙事/作品风格/出场人物 + `outline` scope/dur 落库（`episodeDocs[ep].meta` + `outlinePrefs`，持久化 API E2E 验证）。
- [ ] **D-10 USE_MOCK promote 导航**：mock 下 `BrainstormApi.promote`→`ProjectsApi.createProject` 返回 `dp_mock_*`，但 `getProject` mock 只认静态 `PROJECTS` → `/projects/{新id}` 落「项目不存在」（脑暴自身的 chat→大纲在 mock 下完整可用）。属既有 mock 局限（首页旧立项流程同样存在）；要么给 projects/shorts mock 加可恢复 store，要么文档标注「mock 仅演示前半程，真链路走 USE_MOCK=0 + server」。

### apps/web-celebrity 专项（C-*）

- [ ] **C-1 inline style 收敛**：约 28 文件 `style={{}}`，集中在 `creator/Button.tsx`（微调 fontSize / padding 12.5/13.5/14.5）和 `creator/GradientBlock.tsx`（多层 gradient 叠加，动态值难替）。可缓做。
- [ ] **C-2 真后端落地**：13 个 celebrity-zone 函数 + products CRUD 等需 `apps/server` 配套 Spring 实体 + REST + DTO（field 命名严格 mirror TS interface）。

### Cross-cutting（types / packages）

- [ ] **Script / PublishJob server `*Dto`**：drama 真后端落地时按 `packages/types/src/{script,publish-job}.ts` 字段名严格 mirror（与 D-1 协同）。
- [ ] **community / appearance-forge types 上推**：music 这两域接入真后端时，把本地 `src/types/...`（如有）上推到 `packages/types`，同步 admin/server *Dto。

---

## v0.7 ~ v0.34 累积待办（2026-05-27 整理）

> 来源：`AGENTS.md` v0.7 ~ v0.34 各节末的「注意事项」+ "out-of-scope" + "候选" 字段汇总。按主题归并，避免散落在版本日志里被忘掉。

### 部署 / 生产基础设施（v0.34 之后）

- [x] ~~**deploy-release.sh 部署后清理 /tmp 暂存**~~（**v0.84 完成**，2026-06-22）：`/tmp` 是 tmpfs（3.7G），上传暂存 `aistareco-release-*` 历次不清（尤其中途失败的）会积压撑爆 → `No space left on device` 致 rsync 失败（本次部署实际踩到，残留 49 个共 3.6G）。修复：远程脚本加 `trap cleanup_stage EXIT`（成功/失败都清当前暂存 + 兜底清 >60min 历史残留）。仅 SSH 路径有此问题；`deploy-local.sh` 无 /tmp 暂存。
- [x] ~~**GitHub Actions 生产部署因缺 SSH secrets 每次 dispatch 报错**~~（**v0.84 处理**，2026-06-22）：决策**受控发布**——把 `deploy-production.yml` 改成**只构建 + 上传产物**，移除 Configure SSH / Deploy 两个 step，不再需要 `PROD_SSH_*` secrets，dispatch 不再报错。实际发布人工受控（本机 `deploy.sh` / ECS `update-and-deploy.sh`，私钥不离手）。同步 `infra/README.md` §4.2 + `aliyun-deploy/SKILL.md`。
- [ ] **（可选）若要恢复 Actions 自动部署：用部署专用受限 key，不放主钥**：长期生产私钥交给 GitHub 会扩大爆炸半径。需要时专门生成一把 deploy key（`authorized_keys` 加 `command=`/`from=` 限制，泄露可单独轮换），再补回两个 step + `PROD_SSH_*` secrets。
- [ ] **Phase 3 · 全栈容器化 + CI/CD**（v0.34 显式 v0.35+）：server + sau-service + 5 个 web app 出 Dockerfile + docker-compose；GitHub Actions 跑 build / typecheck / contract / push 镜像 + 部署。
- [ ] **Phase 4 · 用户上传素材 OSS 化**（v0.34 显式 v0.35+）：`MixcutAsset` 上传从本地 fs（`./mixcut-assets`）切换到 OSS（沿用 `AliyunOssCdnUploader`）。当前 v0.14 已做 mixcut **渲染产出** OSS 化；用户**上传**仍落本地。
- [ ] **Phase 5 · 多实例 + Redis + ShedLock**（v0.34 显式）：
  - `PublishJobScheduler` / `MixcutOutputCleanupScheduler` 两个 `@Scheduled` 加 ShedLock（源码注释已挂 TODO）
  - `SmsCodeService` in-memory `ConcurrentHashMap`（验证码 + 失败次数 + 锁定态）→ Redis
  - JWT 黑名单（v0.31 提到的 operatorRole 变更后旧 token 不失效问题）→ Redis 黑名单
  - Cookie SSO 跨子域（`packages/api-client/src/_client.ts` 现有 TODO）
- [ ] **Phase 6 · K8s / ACK**（v0.34 显式）：从 ECS + systemd 迁到 ACK，HPA + 滚动发布。
- [ ] **Flyway V1__baseline.sql 当前是空占位**（v0.34 §B）：切 `ddl-auto=validate` 之前需把生产 schema `mysqldump` 出来填入 V1；当前依赖 Flyway 看到现存 schema 自动 baseline 到 V1 但不执行。
- [ ] **RDS 应用账号 Flyway 接管后降权**（v0.34 §C）：从 `CREATE/ALTER/DROP` 降到 `SELECT/INSERT/UPDATE/DELETE + EXECUTE`。
- [x] ~~**enum 列扩值需手写迁移（`ddl-auto=update` 不会改 enum/CHECK）**~~（**已自动化**，2026-06-26）：原需「生产 MySQL 上线前手跑 `ALTER ... MODIFY COLUMN`」的两列加宽现由启动期幂等 runner `EnumColumnWideningMigration`（`config/`，`@Order(0)`，**先于 `DataInitializer`(@Order 1) 播种 FINANCE_ADMIN**）自动完成 —— 与 C6 用 `LedgerPlaneBackfill.ensurePlaneCheckConstraint()` 自动补 CHECK 同一手法。语义：仅 MySQL/MariaDB 生效（dev H2 按实体重建 schema 天生带全枚举）、读 `information_schema.COLUMNS` 已含全部枚举值即跳过（幂等）、`MODIFY COLUMN` 保留原 nullability、任意失败仅 log 不阻断启动。目标枚举集由 `EnumColumnWideningMigrationTest`（4/4，反射对齐 `AdminUser.AdminRole` / `LedgerEntry.LedgerEntryType` + H2 优雅跳过）守门：日后给任一 enum 加值忘了同步 runner → CI 红。原背景：`MODE=MySQL` 下 Hibernate 6 把 `@Enumerated(STRING)` 生成原生 `enum(...)` 列，`ddl-auto=update` **不会** widen 既有 enum/CHECK → 插入/比较新值报 `Value not permitted`。本轮自动加宽两列：
    - `admin_users.role` → `ENUM('SUPER_ADMIN','OPERATOR','FINANCE_ADMIN')`（C2 FINANCE_ADMIN；不加宽则 boot 播种崩）
    - `aep_ledger_entries.entry_type` → `ENUM('LICENSE_GRANT','RECHARGE','REFUND','REFUND_CASH','INCOME','GIFT','SPEND','WITHDRAW','FREEZE','UNFREEZE','ADJUST')`（C3 REFUND_CASH；不加宽则 D17 首次现金退款写库失败）
    - 同时 `aep_ledger_entries` 加 `plane`(MONEY/CREDIT) + `cash_artifact_id` 两列 + CHECK `plane <> 'CREDIT' OR cash_artifact_id IS NULL`。**ddl-auto 只会加 nullable 列、不会加 CHECK 到既有表** → **C6 已用 `LedgerPlaneBackfill.ensurePlaneCheckConstraint()`（启动期原生 `ALTER TABLE ADD CONSTRAINT ck_ledger_plane`，幂等吞已存在）在 ddl-auto 之后补齐，生产 MySQL 真实成立**（评审 H1）；plane 历史行由同 runner native 按现存 entry_type 回填。Flyway 接管后把此 DDL 收进版本化脚本、移除 runner。
    - 新增任何 enum 列扩值 / 新 CHECK 同理，勿依赖 ddl-auto，纳入 Flyway 版本化脚本（与上方 baseline 专项一并做）。

### 钱包 v2 独立评审遗留（2026-06-26，C6 已修两 HIGH，其余记录）

- [x] ~~**H1 DB CHECK 生产缺失**~~（**C6 完成**，2026-06-26）：`@Check`+`ddl-auto=update` 不给既有表加 CHECK → 生产「调差不碰现金」只剩 app 层。已加启动期 `ensurePlaneCheckConstraint` 原生 ALTER 补齐，真机重启日志确认「ck_ledger_plane 已补齐」。
- [x] ~~**H2 退款并发双退**~~（**C6 完成**，2026-06-26）：`refundOrder` 原缺幂等闸，并发/重复点击可双重现金退款。已加 `markRefunded` 条件 UPDATE 抢占（PAID→REFUNDED，照 `markPaid`），真机验证第二次退款 → 409 ORDER_NOT_PAID、不二次回收。
- [ ] **M1 per-actor 日限额是软护栏非硬不变量**（评审，2026-06-26）：仅约束「单个 maker 发起量」，复核无总量上限；且 check-then-insert 有 TOCTOU（两并发 compensate 同读 `already` 都过）。当前作软护栏可接受；若要硬上限需 per-maker 串行化（短锁 / 唯一约束计数行）。已在 commit message 注明仅「发起量」语义。
- [x] ~~**M2 `INCOME`/`REFUND` 入 rechargeBalance 污染现金背书桶**~~（**已修**，2026-06-26）：选定方案「改入 gift 桶」（write-time 修正，比「对账时排除」更根治）。`CreditService.creditAccount` 的 `INCOME`/`REFUND` 分支从 `setRechargeBalance` 改为 `setGiftBalance` —— **RECHARGE 现成为唯一进 recharge 现金背书桶的入账类型**。审计确认：原 `INCOME`/`REFUND` 两 case 是**死分支**（无任一 caller 经 `creditAccount` 传这两类型；callers 仅 RECHARGE/GIFT/LICENSE_GRANT），故本修正零现网行为影响、纯前瞻护栏。`totalBalance` 不变（gift 同样计入总额）。真正堵的洞：`refundCashReclaim` 把 `rechargeBalance` 当「未消费现金充值额」做 clamp —— 若被非现金积分污染，可能把非现金积分当现金退掉。`WalletBucketAndConcurrencyTest` 守门：INCOME/REFUND→gift+recharge 桶纯净、非现金积分 `refundCashReclaim` 409 拒退、RECHARGE 对照组可退。（M3 逐单 join 仍 open。）
- [x] ~~**评审 #3：钱包写余额无并发集成测试（仅 Mockito + 真机 happy/幂等）**~~（**已补**，2026-06-26）：`WalletBucketAndConcurrencyTest` 真·多线程（8 线程 CountDownLatch 闸门最大化竞态）撞同一钱包：并发 `creditAccount` / `debit` 各验「无 lost update」（终值恰等于串行期望），证明悲观行锁 `findByUserIdForUpdate`(`SELECT … FOR UPDATE`) 真实串行化 read-modify-write（无锁则增量相互覆盖、终值偏小且确定性失败）。H2 `LOCK_TIMEOUT=20000` 容纳串行化等待。
- [ ] **M3 对账是粗粒度聚合勾稽、非逐单 join**（评审，2026-06-26）：`drift=Σ订单 − Σ账本RECHARGE` 只能抓「整体总额不平」，抓不住「单笔金额错配但总额恰好抵消」「RECHARGE 无对应订单」「bonus GIFT 不与 order.bonusCredits 勾稽」。作快速 tripwire 够用；要真 lost-update 检测需 left join orders↔ledger by referenceId 逐单核。
- [ ] **L1/L2 记录**：`releaseHold` 部分 commit 后按比例退桶有整数除法偏置（总额守恒、桶纯度有微偏，非泄漏）；`WITHDRAW` 账本 `referenceId`/`cashArtifactId` 为空（资金面凭证未链，审计可追性弱）。均低优先。

### admin 后台健全（v0.31 / v0.32）

- [x] ~~**`AdminStaffController` self-protect 校验**~~（**v0.80 完成**，2026-06-17）：server 端加自保护守卫 —— `delete` 拒绝删自己；`update` 拒绝改自己的 `role` / `status`（避免锁死或自我提权），但仍允许本人改自己的昵称 / 邮箱 / 密码。均抛 403 `FORBIDDEN`，文案提示「请让其它超管处理」。
- [ ] **admin TS 类型 enum 大小写归一**（v0.32 注意事项）：当前 wire 是小写（`"super_admin"`/`"operator"`）但 admin TS 类型用大写（`"SUPER_ADMIN"`/`"OPERATOR"`），靠 `useAdminRole` + `staff.ts.normalize()` 在 API 边界翻译。可统一为小写跟其它 enum 一致。
- [x] ~~**admin operator self-grant operatorRole 防护**~~（**已完成**，2026-06-17 审计确认）：`AdminAepUsersController.updateOperatorRole`（PATCH `/api/admin/aep-users/{id}/operator-role`）已是 `@PreAuthorize("hasRole('SUPER_ADMIN')")` + v0.37 自保护守卫（`id.equals(principal.getName())` → 403 `OPERATOR_SELF_MODIFY`）。原 TODO 描述过时。
- [ ] **admin `window.confirm` / `alert` 历史欠债迁移**（v0.23 硬规则但仅约束 web-celebrity；admin 仍有 8 文件用）：`apps/admin/src/app/{platform/llm-keys, platform/ai-models, finance/recharge-packages, base/presets, celebrity/{star-authorizations, template-scripts, mixcut-official-clips, products}}/page.tsx` → 改用 shadcn `AlertDialog` + Promise-based `useConfirm()`。

### 安全 / Auth（2026-04-21 块剩余）

- [ ] **`DevAutoAuthFilter` 门控统一**（2026-04-21 §根因 3）：`@Profile("dev")` → `@ConditionalOnProperty("aep.dev-auth.enabled")`，与 `DevAuthController` 对齐。
- [x] **`SecurityJsonEntryPoint` / `SecurityJsonAccessDeniedHandler`**（2026-04-21 §根因 4）✅ 2026-06-10 落地：两个 `@Component` handler（ObjectMapper 序列化 + body 带 MDC `traceId`）替换 `AepSecurityConfig` 内联 lambda，输出 `{error:{code,message,traceId}}` 与 `GlobalExceptionHandler` 同壳。

### sau-service（v0.17 ~ v0.19）

- [ ] **SMS 风控人机交互 — 真实 selector driver**（v0.19 §B）：当前 `_PlaceholderSmsDriver.detect()` 永远返回 `None`；整 stack 已联通但**生产不会触发**。需要在抖音/视频号触发风控时抓 SMS 弹窗 DOM 选择器替换占位实现。
- [ ] **sau-service driver selector 首次绑定后按诊断 WARNING 回填**（v0.17.1 ~ v0.17.3）：XHS / 视频号 / 快手 driver selectors 是基于上游 sau 命名约定**猜的**；首次真实绑定后看 `[<platform>] extract_profile incomplete after retry budget` WARNING dump 取真 class / outerHTML 回填。
- [ ] **XHS 改用 `xhs-toolkit.XhsClient.get_qrcode()` API 替代 DOM scrape**（v0.17.3 注意事项）：上游 `pokocat/social-auto-upload` 的 `xhs_uploader/xhs_login_qrcode.py` 走的就是这条 API；DOM scrape 是临时活路。
- [ ] **sau-service 浏览器进程复用**（旧 v0.6 候选）：当前每次 verify 都 `chromium.launch()`，冷启 3-4s。引常驻 persistent context worker → 0.5s。
- [ ] **HTTP-only cookie 探测（长期）**（旧 v0.6 候选）：彻底脱离浏览器跑 verify。先视频号试点；签名头逆向工程量大。
- [ ] **upstream `social-auto-upload` patch `on_page` callback**（v0.19 §B 注意事项）：当前 `_hook_chromium_for_page_capture` monkey-patch `chromium.launch()` 抓 page，耦合上游用 `launch()` 而非 `launch_persistent_context()`。长期 fork 上游加 callback 参数。

### 混剪 / 分发（v0.15 ~ v0.30）

- [ ] **`PublishJobScheduler` 多实例 ShedLock**（v0.15 注意事项 / 源码注释 v0.16+ 候选 → 实际推到 Phase 5）。
- [ ] **`MixcutOutputCleanupScheduler` 多实例 ShedLock**（v0.21 §C，同上）。
- [ ] **`expandSchedule` jitter 可重放**（v0.20 注意事项）：当前 `ThreadLocalRandom` 不可重放；未来要可复算引 `seed = hash(projectId, i)`。
- [ ] **批次取消 / 重新调度的 campaign 级语义**（v0.23 显式 out-of-scope）：当前只支持 tracking tab 单条 cancel，批次级 cancel-all 还未做（v0.23 仅做了批次聚合显示）。
- [ ] **跨账号错峰 / interval / random_window / weekly 派单策略**（v0.20 out-of-scope）：`ScheduleSpec` discriminator 已预留扩展位。
- [ ] **手动 URL 输入合并进分发工作台**（v0.16 注意事项）：当前 `ManualDistributeDialog` 独立弹窗，字段差异大未 inline 合并。
- [ ] **`mixcut_output.last_published_at` server 落库稳态去重**（v0.16 已废弃 localStorage；v0.19 §A 已加 `publishCount` + `lastPublishedAt`，本条已实质完成 → 可在下次 audit 时勾掉确认）。

### 数据模型 / 配置

- [x] ~~**engine-pricing 落到 `PlatformConfig`**~~（**已完成** — 见上「持久化与基础设施」段，2026-06-17 审计确认实际早已落库）。
- [x] ~~**生成任务 `JOBS` 落表**~~（**v0.80 完成** — `GenerationJob` 实体 + repo，见上段）。
- [ ] **真实微信支付**（**非漏洞，可后置** — 见上段澄清：当前已是「PENDING 订单 + 运营手动核准」过渡方案）。
  - **v0.93 进展（2026-06-29）**：支付驱动基建已就位 —— `aep.payment.driver`（shadow / alipay 直连）+ 网关 + 异步 notify 回调 `settlePaidOrder`（幂等）+ 对账轮询；drama 充值已走真实收银台（v0.91，非手动核准）。
  - **v0.94 进展（2026-06-29）**：删除休眠的 jeepay 聚合网关（从未对接真实实例，§8.0 风险）；微信支付改走直连 V3（`wechat` driver，与 alipay/shadow 并列）。渠道启用 + 机密改为 admin 后台「支付配置」DB 运行时可配（多渠道并存，用户收银台自选支付宝/微信），不再 env 固定 driver。**剩余**：填真实商户凭据（支付宝 + 微信）。
- [ ] **国产 LLM provider 真实调用**（旧 v0.6 候选）：`AiModelInvocationService` 当前只 OpenAI 兼容；`ANTHROPIC` / `BAIDU` / `ALIYUN` / `TENCENT` 各自鉴权。
- [ ] **`ConfigItem` 配置中心 + 17 字典上移**（旧 v0.6 候选，`docs/ADMIN_PRODUCT_SPEC.md` §10 设计已写）：草稿/审核/发布状态机 + 灰度（白名单 / AB 桶）。
- [ ] **`/celebrity/dictionaries`** 当前 hard-coded；接 `ConfigItem` 后改为运营可配。

### 商品 / 模板 / 素材

- [ ] **抖音以外平台 商品链接 handler**（v0.28 显式未实现）：当前只 `DouyinQueryEmbeddedHandler` + `DouyinHtmlScrapeHandler`。
- [ ] **商品图本地化备份**（v0.28 显式未实现）：当前外网 CDN URL 直接登记，不下载本地。
- [ ] **AI 生成带货视频**（v0.28 显式未实现）：当前仅在 `MixcutAsset.subkind` 预留 `"ai-marketing-video"` 占位。
- [ ] **`PublishJob.productId` 冗余列**（v0.28 显式未实现 — 当前依赖 `MixcutRenderJob.productId` + BatchPublishDrawer 反查 Product 来 prefill 抖音商品挂载）。
- [ ] **模板 `video_ref` 自动检测**（旧 v0.6 候选）：转码 / 抽帧 / BGM BPM / NSFW / 主色板检测。
- [ ] **admin 表单 OSS multipart 上传 + STS 临时凭证**（旧 v0.6 候选）：当前只接 URL。
- [ ] **模板 A/B 桶 + 多人审批**（旧 v0.6 候选）：当前 `experiment` / `metrics` 字段保留但不分桶。

### 通知 / 实时（旧 v0.6 候选）

- [ ] **WebSocket 升级路径**：当前轮询 15s + 5s + 业务关键点 trigger 已"近实时"。
- [ ] **`wx.subscribeMessage` 模板消息**：用户离线推醒（生成完成 / 授权审核结果）。
- [ ] **Bot 消息真实事件触发推送**（替代或补充拉模式）：业务事件 → `Notification` → WebSocket 推。
- [ ] **"数据日报" todo count**：`NotificationService.computeTodos` 当前回退常量 1。

### 文档 / 元数据

- [ ] **根 `PRODUCT.md` `## Register` 段补全**：当前只写了一个词 `product`，像未完成的脚手架。其余段（Users / Brand / Design Principles）齐全，是 `/impeccable` skill 的强制上下文，**保留不删**。
- [ ] **`docs/INDEX.md` last-reviewed 滚动**：当前停在 2026-05-23 / v0.5.4 与 2026-05-21 / v0.21 双行；v0.22 ~ v0.34 增量未追加。每次大版本提交时同 commit 更新。

---

## 2026-06-10 · v0.60 数字人收敛 Phase 2 backlog

Phase 1（引入数字人 + 指定展示图）已落地；以下为已确认方向、按需排期的后续：

- [ ] **drama 成片用脸**：短剧生成（/me/drama/episodes/generate）把角色绑定的数字人形象图
      作为 i2i 身份输入（复用 dap imageKey / derivatives 资产），成片角色脸 = 数字人。
- [ ] **音色联动**：`DapAvatar.voiceName` 传导给 drama 配音 / music 演唱。
- [x] **aiavatar 反向「应用于」视图** ✅ v0.61（2026-06-10）：`GET /v1/avatars/{id}/references` + 详情页 MAppliedTo 卡片。
- [ ] **drama 角色实体化**：DramaScript payloadJson 里的角色升级为实体（characterName + artistId + dapAvatarId），
      支持一剧多角色各绑不同数字人。
- [ ] **物理删除已退役源码**：music IncubationWizardV2 / AppearanceForgeV3、drama 孵化器 / 锻造炉组件
      及对应 api/mocks（v0.60 仅下线入口，源码保留一版）。
- [ ] **运营动作**：新发秘钥默认带 aiavatar 平台权限（admin per-账号 platforms 已支持），
      避免 music/drama 用户引入列表为空却进不去 AiAvatar。

---

## 2026-06-11 · web-star 明星商务端 v0.62+ 候选（调研记录，暂不做）

> 来源：v0.60 落地后审计。13+1 模块 UI + `/api/star/**` 38 端点已 E2E 验证；
> 但作为「审批中枢」目前只有 3 条链路有真实上游（入驻→市场可见 / 带货授权审批闭环 /
> 商品报备 6 步入库），其余模块队列均为 seed 演示数据。按优先级：

- [ ] **① 内容审核链路打通（v0.62 主题候选，价值最高）**：`StarContentReview` 当前仅
      `StarWorkbenchDataInitializer` seed 写入，web-celebrity 无任何送审入口。
  - celebrity 侧：混剪产出 / 视频引用已授权明星时，发布前创建 StarContentReview，发布被审批门控；
  - star 侧审批 UI 已有，接真实队列即可；revision 意见回流 celebrity 端可见、可返工重提；
  - 顺带让 `/rules` 绿黄橙红四区规则真正生效（提交时向创作者展示约束 + 审核依据）——
    当前规则启停改了也没有任何消费方。
- [ ] **② admin star 运营镜像（`/api/admin/star/**`）**：报白 5 步推进 / IP 资产 advance
      （火山回执）/ 品牌授权 platformReview / 平台路寄样，当前全由明星 principal 自己经
      `StarWorkbenchController` 的 `/advance` 推进。现实中是平台 / 技术公司动作，应移到
      admin；明星端只留属于明星的决策（批准 / 驳回 / 签收）。亦是 CLAUDE.md SOP Step 4
      admin 镜像欠账（star 域在 admin nav 无入口）。
- [ ] **③ 报白 / 数字人 / AI 形象授权发起端**：web-celebrity 当前 0 处报白相关代码。
      报白可挂在已有社交账号绑定（v0.17 SocialAccount）上发起；数字人 / AI 形象授权申请
      与混剪、数字人生成做用途门控联动。
- [ ] **④ 收益与合同真实化（可后置）**：授权 / 品牌合作批准后自动生成 `StarContract`
      （当前合同中心为静态 seed）；`StarRevenueMonth` 从商品库 salesCount / GMV 派生
      （依赖真实支付链路）；侵权巡查当前亦无监测源。

---

## 2026-06-17 · v0.81 收口与新发现

- [x] ~~**AI 端点外部 API Token / 对外网关移除**~~（**v0.81 完成**）：自用 LLM 场景去掉「生成 Key / sk-aep-* 对外网关」全链路（`EmbeddedLlmProxy*` / `AiModelEndpointKeyService` / mint-revoke 端点 / DTO·实体字段 / openapi 3 path）。保留上游密钥 + `ai_app_binding`（内部调用命脉）+ 用量计数器。详见 `apps/server/README.md` v0.81。
- [ ] **预存在测试失败（与 v0.81 无关，clean main 同样红）**：本机带 `apps/server/.env`（gitignored，`AEP_CDN_DRIVER=oss` 但 endpoint 不可解析）时，所有 `@SpringBootTest` 全 context-load 失败 → 跑全量测试前应临时移走 `.env`（或确保 OSS endpoint 可解析）。即便移走 `.env`，仍有 **4 个预存在失败**需排查：`MaterialOpsE2ETest`（`productLibrary_includesMaterialProducts` / `getScript_returnsFullPayloadWithBlocks` / `listVideos_filterByProduct`）+ `PlatformSupportTest.toCsv_roundTrips`。已确认 stash 我的改动后于 clean main 同样失败 → 属历史欠债，非本次引入。

---

## 2026-06-18 · 大模型调用原始响应可观测

- [x] ~~**失败时记录上游原始响应（止血，全模态）**~~（**v0.84 完成**）：文本 LLM（`AiModelInvocationService`：2xx-不可解析也 WARN raw + 落 `responseBodyJson`）、图像（`DramaRenderService` bad-output 记 raw）、视频（`MaterialVideoModelClient` poll 失败记 raw + `extractFailReason`）、数字人（`DapMultimodalClient` video poll 失败记 raw）四个模态,失败/终态均 WARN 上游原始响应体,便于排查。
- [x] ~~**大模型调用层结构性统一（架构债，建议下一步专做）**~~（**v0.85 完成**，2026-06-19）：抽共享原语 `service/ai/UpstreamModelHttp.sendJson(req, ctx)` + `ModelCallCtx` + `UpstreamCallException`,统一 send + io 记原始请求/响应（独立 logger `aep.ai.upstream.io`）+ 非 2xx WARN raw body + best-effort 落失败 `AiModelUsageRecord.responseBodyJson`/latency/errorCode + IOException 退避重试;非 2xx 不抛、返回 resp 由调用方按自身错误码处理（行为/错误码不变）。四个同步 JSON 客户端全部改走它:文本 `AiModelInvocationService.doChat`、图像 `DramaRenderService.callImageModel`、视频 `MaterialVideoModelClient.submit/poll`、数字人 `DapMultimodalClient.postJson/getJson`（保留 IOException 重试 1 次）。成功路径的 token/计费单位仍由各调用方落库（只有它们能解析）；video poll 与 dap 沿用「失败不在此处落用量」（`recordFailureUsage=false`，仅统一原始日志）。新测试 `UpstreamModelHttpTest` 7/7;`AiModelInvocationServiceTest`/`MaterialVideoModelClientTest`/`AiModelUsageServiceTest` 全绿;全量除 4 个预存在失败外无新增。**遗留**:`ForgeCozeService` 走 Coze Java SDK（流式、HTTP 对我们不透明）暂未纳入,见下条。
- [ ] **Coze 流式调用纳入统一观测**：`ForgeCozeService` 走 Coze Java SDK（流式 chat，HTTP 细节不透明），未走 `UpstreamModelHttp`。待评估:或为流式补一条「调用元信息 + 最终聚合响应」的 best-effort 用量/日志旁路（不强求原始分片），或在 SDK 层加拦截器。优先级低（形象锻造入口 music 线 v0.60 已下线，仅 drama 顾问在用）。
