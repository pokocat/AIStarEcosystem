# 待修清单 / Known Issues

本文件记录已定位但暂未修复的问题，方便后续排期。动手修时请勾掉对应条目并在代码里落实。

> 状态注（2026-05-09 / v0.5.4 文档审计）：本文 2026-04-21 记录的 admin auth / error-handler / logId 问题截至 v0.5.3 **未处理**；v0.5.0 ~ v0.5.3 的工作集中在 admin 页面 / 模板脚本系统 / AI 模型配置 / miniprogram 拉模式同步，没碰这条 auth 链。本节内容**仍然有效**，留待 v0.6+。
>
> v0.5.x 期间发现的新待办见文末「v0.6 候选」段。

---

## 2026-04-21 · admin 调 server 全 403 + 缺排错手段

### 现象

- 本地联调时，admin (`http://localhost:3003/admin`) 调 `/api/admin/*` 全部 `403 Forbidden`。
- 浏览器 console 上实际报的是 `PARSE_ERROR: Invalid JSON from ...`，因为 Spring Security 默认的 403 响应 body 是空的。
- 排错困难：前端拿不到 code/message，后端日志没有请求级关联 id。

### 根因（互相叠加，需一起治理）

1. **admin `apiFetch` 不发 `Authorization` 头**
   - 位置：`apps/admin/src/api/_client.ts:61-70`
   - 对比 web 实现 `apps/web/src/api/_client.ts:90-96`（会读 `localStorage` token 并带 `Bearer`）。
   - admin 侧完全没有 `getAuthToken` / 头注入逻辑。

2. **admin 没有登录页**
   - `apps/admin/src/app/` 下没有 `login/` 目录，也没有 `AuthContext`。
   - `apps/admin/src/api/auth.ts` 里的 `login()` / `getMe()` 没有任何调用方。
   - 即使修好第 1 点，也没有 token 来源。

3. **`DevAutoAuthFilter` 门控与 `DevAuthController` 不一致**
   - `apps/server/src/main/java/com/aistareco/aep/config/DevAutoAuthFilter.java` 仍是 `@Profile("dev")`。
   - `apps/server/src/main/java/com/aistareco/aep/controller/DevAuthController.java` 已改成 `@ConditionalOnProperty("aep.dev-auth.enabled")`（见 DEPLOYMENT.md §4.4）。
   - 结果：mysql profile + `AEP_DEV_AUTH_ENABLED=true` 时，手动 dev-login 能用，但 admin 前端不带 token 访问时的自动兜底失效 → 403。
   - dev profile 下 DevAutoAuthFilter 应该是能覆盖的，但门控写法不一致本身是个坑。

4. **Spring Security 的 401/403 不走 `GlobalExceptionHandler`**
   - `apps/server/src/main/java/com/aistareco/common/GlobalExceptionHandler.java` 只在 controller 之后生效。
   - Security 链上 `AccessDeniedException` / `AuthenticationException` 由 `AccessDeniedHandler` / `AuthenticationEntryPoint` 处理，当前没自定义 → 默认空 body。
   - 需要补 `SecurityJsonEntryPoint` / `SecurityJsonAccessDeniedHandler`，在 `AepSecurityConfig` 里 wire 上。

5. **后端请求没有 logId / requestId**
   - 现有 `application.yml` 日志 pattern 没有 MDC 字段。
   - 错误响应体里也没有可与日志对照的关联 id。

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

- [ ] **`SUPER_ADMIN/OPERATOR` → `PLATFORM_OPERATOR/FINANCE_ADMIN`**：`docs/ADMIN_PRODUCT_SPEC.md` §2.1 / §10.2 规划中。届时同步改 4 处：`AdminUser.AdminRole` / `AepSecurityConfig.hasAnyRole` / `DataInitializer` seed / `apps/admin/src/types/account.ts`。

### 基础设施收敛

- [ ] **Bot 消息真实事件触发推送**（替代或补充当前拉模式）：业务事件触发器（生成完成 / 审核通过）→ 写 `Notification` → WebSocket 推。当前拉模式是"在线时近实时"，事件触发是"离线也能感知"。

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
- [ ] **D-2 openapi 同步**：`specs/openapi.yaml` 加 drama / script / distribution / finance paths，跑 `(cd apps/web && npm run check:api-contract)` 验证。
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
