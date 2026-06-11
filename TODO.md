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

- [ ] **engine-pricing 落表**：当前 `CelebrityZoneService.mutablePricing` 是 in-memory ConcurrentHashMap，admin PUT 立即生效但**重启失效**。落到 `PlatformConfig` key=`celebrity.engine-pricing`，启动时读取覆盖默认值。详 `product_spec_ai_celebrity.md` v0.5.x §D5。
- [ ] **生成任务 JOBS 落表**：`CelebrityZoneService.JOBS` 同样 in-memory，重启丢失轮询进度。建表 `generation_jobs(id, started_at, total_sec, engine, status, created_at)`，progress 在 service 层从 `started_at + total_sec` 计算。
- [ ] **真实微信支付**：`POST /me/wallet/recharge` 当前 mock 直接落账。线上需先 `wx.requestPayment` 走支付，回调 `notify_url` 验签后再调 server `/me/wallet/recharge`。

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
- [ ] **D-3 inline style 渐进迁移**：约 573 处 `style={{}}`（三工程最多）。切入口"自建 Dialog → `@ai-star-eco/ui/ui/dialog`"，再批量 ROI 替换 `premium/` 系列。
- [ ] **D-4 发布任务状态机**：`createPublishJob` mock 用 `setTimeout` 推进 queued → uploading → live。真后端落地后换 SSE 或 polling endpoint。
- [ ] **D-5 admin 镜像**：`apps/admin` 加 drama 管理视图。
- [ ] **D-6 单元测试**：`drama-query.ts` cache 失效、表单 schema、状态机过渡（与 CG-2 决策一致 — 真后端落地后再补）。
- [ ] **D-7 a11y dialog**：所有自建 Dialog → `@ai-star-eco/ui/ui/dialog`（focus trap 已交 Radix 实现）。

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

### admin 后台健全（v0.31 / v0.32）

- [ ] **`AdminStaffController` self-protect 校验**（v0.32 注意事项）：当前 admin 能删/降级**自己**账号；前端 loose `isSelf` 判断形同无防护。server 端加 `if (id.equals(principal.getName())) throw ...`。
- [ ] **admin TS 类型 enum 大小写归一**（v0.32 注意事项）：当前 wire 是小写（`"super_admin"`/`"operator"`）但 admin TS 类型用大写（`"SUPER_ADMIN"`/`"OPERATOR"`），靠 `useAdminRole` + `staff.ts.normalize()` 在 API 边界翻译。可统一为小写跟其它 enum 一致。
- [ ] **admin operator self-grant operatorRole 防护**（v0.31 §C）：`/api/admin/aep-users/{id}/operator-role` 当前 hasAnyRole（OPERATOR 也能调，能给自己/他人发 SUPER_ADMIN）。改为 `@PreAuthorize("hasRole('SUPER_ADMIN')")`。
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

- [ ] **engine-pricing 落到 `PlatformConfig`**（旧 v0.6 候选）：`CelebrityZoneService.mutablePricing` in-memory ConcurrentHashMap，admin PUT 即时生效但重启失效。`PlatformConfig` 实体已存在，接进去即可。
- [ ] **生成任务 `JOBS` 落表**（旧 v0.6 候选）：`CelebrityZoneService.JOBS` 同样 in-memory。建 `generation_jobs(id, started_at, total_sec, engine, status, created_at)`。
- [ ] **真实微信支付**：`POST /me/wallet/recharge` 当前 mock 直接落账；线上需 `wx.requestPayment` → `notify_url` 验签后再调 server。
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
