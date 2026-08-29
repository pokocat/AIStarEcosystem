# 待修清单 / Known Issues

本文件记录已定位但暂未修复的问题，方便后续排期。动手修时请勾掉对应条目并在代码里落实。

> 状态注（2026-05-27 / v0.34 部署基础设施落地后审计）：
> - **2026-04-21 admin auth 块部分完成**：admin `apiFetch` Authorization 头 ✅（`AUTH_TOKEN_KEY` + `Bearer ${token}` 在 `apps/admin/src/api/_client.ts:18-97`）、admin login 页 + AuthContext ✅、MDC ✅（v0.30+ 改名 `traceId`，pattern `%X{traceId:-}` 已生效）。**剩一项未做**：`DevAutoAuthFilter` 仍 `@Profile("dev")`（未按 `aep.dev-auth.enabled` property 门控）。`SecurityJsonEntryPoint` / `SecurityJsonAccessDeniedHandler` 已于 2026-06-10 落地（401/403 JSON body 带 traceId）。
> - **角色拆分 `SUPER_ADMIN/OPERATOR → PLATFORM_OPERATOR/FINANCE_ADMIN` 已反向决策不做**（v0.31 改在 `aep_users` 加 `operatorRole` 复用现有命名 — 见 `AGENTS.md` v0.31 B 节）。
> - v0.7 ~ v0.34 期间累积的新待办见文末「v0.7 ~ v0.34 累积待办」段。

---

## 2026-08-29 · v0.138 音乐真实生成后续

- [ ] **运营开通与配置**（上线前置，非代码）：火山控制台 `console.volcengine.com/ai-music/product` 开通「AI 音乐生成大模型」（企业首次 0 元 200 首试用）；admin「平台 · AI 模型」建端点（baseUrl `https://open.volcengineapi.com`、model `v4.3`/`v5.0`、Key 填 `AccessKeyId:AccessKeySecret`、billingMode `PER_SECOND`）+「AI 应用绑定」绑用途「音乐生成」+ 设 `creditCostOverride`（每秒积分，参考上游 0.002 元/秒）。**未配置时功能保持 503，不产假数据**。
- [ ] **真机付费实测未做**：本轮验收全部在「未配置」路径完成（503 / 不扣费 / UI 提示），真实出曲、真实扣费、音频镜像与播放**尚未用真实凭据跑通**。开通后需实测：出曲成功、按真实时长结算、差额退回、音频可播。
- [ ] **歌曲封面仍是手填 URL**：`SongDetailDrawer` 的封面是文本输入框，无上传也无生成。音乐模型不产封面，需另接 `IMAGE_GENERATION`（已有用途）按曲风/情绪生成，或支持上传。
- [ ] **分发链路与歌曲无连接**（v0.138 未处理）：`MusicBusiness` 的「分发」按钮跳 `/distribution?songId=...`，但 `DistributionPage` 从不读 `songId`；`DistributionContent` 实体没有指向 Song 的字段，`DistributionController.publish` 是返回随机 jobId 的 stub。**歌曲目前根本进不了分发**。真实发行还需要 Song 上没有的 ISRC / 版权归属 / 语言 / 发行地区字段。
- [ ] **`advanceSong` 无状态机校验**：`AccountController` 直接 `valueOf(status)`，可从 recording 跳 released、也能从 released 退回。
- [ ] **admin 歌曲审核页看不到音频和歌词**：`/content/songs` 与详情页都不展示 `audioUrl` / `lyrics`，运营无法真正审核就要点通过/驳回；approve/reject 收了 `reason` 却直接丢弃，未进审计日志。
- [ ] **`AdminMusicController.songs` 全量 `findAll` + 内存分页**，歌曲量上来会 OOM。
- [ ] **admin 侧 `/admin/generation/jobs*` 骨架仍是死代码**：`api/generation.ts` + `mocks/generation.ts` + `types/generation.ts#GenerationJob`（含 abort / refund）俱在，后端零实现、无页面引用。要么落地为生成任务统一审计后台，要么删除。

## 2026-08-29 · v0.137 音乐自由创作 + 工作室惰性补建后续

- [ ] **追查历史账号漏建 Studio 的注册路径**：线上 17 个用户里 6 个 STUDIO 账号无 `aep_studios` 行（含 2026-05-25 注册的 `phone_18801931018`，追查号 7MQUAP4JYVSE 409 死锁的触发者）。正常短信+激活码注册经 `LicenseActivationService.activate` 必建 Studio——这 6 个账号从哪条路径来的（早期版本？admin 手建？）未定位。v0.137 的 `DigitalIpService.ensureStudioFor` 惰性补建已止血，root cause 供审计排期。
- [ ] **无艺人歌曲的「补绑定艺人」入口**：v0.137 起自由创作歌曲 `artistId=null`，产品语义是分发前必须补绑定（product_spec.md §10.1），但目前没有绑定 UI/端点（可做 `PATCH /me/songs/{id}` 允许补 `artistId` + 前端歌曲详情入口）；分发链路也未加「未绑定艺人 → 拦截并引导」的闸。
- [ ] **web-music 其余艺人维度页仍走 `NoArtistState`**（/music 商业视图、/notices、/wardrobe、/community 等）：属艺人视角页面，按产品定位保留硬闸；`NoArtistState` 已加「直接去创作音乐」出口。若后续要求这些页也支持无艺人态，另行评估。

---

## 2026-08-18 · `clip` 快出片生产门槛（v0.132 单次直传与异步受理后续）

- [x] ~~本人素材经军师与 AIStar 重复搬运、弱网超时后诱导重复上传~~（v0.132 完成，2026-08-18）：客户端凭精确 OSS V4 policy 单次直传，`clip_upload_session` 持久化受理状态并以 owner + clientRequestId 幂等；HEAD 后异步校验/提交，HEVC/H.265 形象视频自动转 H.264。
- [ ] 给生产 OSS RAM 身份补齐并验证 `oss:DeleteObject`（至少 `media/clip/clone/*`）：2026-08-18 线上日志已确认当前删除被 OSS 拒绝。它不阻断直传、转码和训练，但会让失败/转码前的源对象无法及时清理；权限补齐前需要用生命周期规则兜底回收该前缀。
- [x] ~~取得石榴测试 key、核对官方字段并替换固定失败网关~~（v0.111，v0.116 补齐契约）：已接 `/authVideo/create`、`/speaker/{create,tts,status,delete}`、`/avatar/{create,status,delete}`、`/video/{createByText,createByVoiceV2,status}`；v0.116 增加官方素材限制/错误码、speaker 状态数组兼容、真实进度以及统一 V2 音频驱动。真实 key 只落预发 0600 env，官方 BaseURL 为 `https://api.16ai.chat/api/v1/`。只读探针确认账号有效、12,000 点且当前无 speaker/avatar。
- [x] ~~采集页按供应商硬限制与产品质量门给出可执行指导~~（v0.116 完成，2026-08-11）：`ClipCapturePolicy` 以 ffprobe 验证授权视频、形象视频、声音样本；`GET /me/clip/avatar/requirements` 下发官方/产品限制、建议区间和固定授权口播，服务端不信任客户端元数据。
- [x] ~~无本人素材时仍能验收产品工程闭环~~（v0.114）：隔离预发可显式 force-mock，实际产出带「测试演示」的可播放 MP4，并完整经过逐段总装、字幕/AI 标识、封面、质量门和存储；不再用状态假成功或空作品冒充出片。该项只关闭测试体验缺口，不替代下一条真实石榴素材验收。
- [ ] 用本人合规采集素材完成 `docs/clip-avatar-video-plan.md` §3.2 质量/时延/一致性/输出规格/成本实测及 §12 商务与算法备案决策；没有真实授权素材时不得用假素材冒充全链路验收。
- [ ] 接入真实图片/视频/音频机器审核，并把结果与资产/任务审计关联；当前由军师 BFF 在未配置时 fail-closed，AIStar 也不得绕过接受直传媒体。
- [~] `clip` 多段总装继续收尾。v0.112 已完成 Strategy A 基线；v0.113 补齐三套模板固定品牌尾卡和最终音画质量门；**v0.135 已修复单遍 -1.5 dBTP 归一后 AAC 回弹导致的确定性误拦**，现以两遍 -16 LUFS / -2.5 dBTP 处理保留编码余量，最终真实文件仍按 ≤ -1 dBTP 失败关闭并记录指标。**剩余**：拿到授权的「集体发声」群像尾片后通过 admin preset 替换品牌尾卡，并用本人真实长片完成时延、内存、磁盘压力验收；完成前仍不能宣称完整生产模板成片。
- [ ] 抖音、快手、小红书、视频号逐一接真实发布和状态回查；当前非 mock 固定 `CLIP_PUBLISH_NOT_CONFIGURED`。不要扩写“全平台一键发布”。
- [ ] 为 `DapAvatar` / `DapVoice` 本次新增的引擎字段补正式 Flyway 迁移；当前 v0.110 仍依赖 `ddl-auto=update`，`V14__add_clip_domain.sql` 只建 clip 四表。等全仓 Flyway 接管策略确认后再迁，避免与既有表结构漂移冲突。
- [ ] 生产接入前跑 MySQL 迁移演练、多实例租约/杀进程恢复、长任务 stale reaper、真实供应商限流与成本压测；mock 完成不算验收。

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
- [ ] **各子应用 `constants/*` 字典上移**（**描述过时**，2026-08-03 随 apps/web 删除审计更新：原描述的 `apps/web/src/constants/*` 17 个文件已随 apps/web 一并删除，但同类硬编码字典已分散到各新 app 自己的 `constants/*-ui.ts`，未消失——`web-music` 18 个 / `web-drama` 13 个 / `web-celebrity` 3 个 / `web-star` 1 个 / `web-aiavatar` 0 个，需求本身仍未解决）：详 `docs/ADMIN_PRODUCT_SPEC.md` §7.5。
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
- [x] ~~**D-12 短视频草稿资产 URL 重签**（v0.98 发现）：`DramaShort.payloadJson` 存的是当时签名的 OSS URL（首帧/末帧/成片），`AEP_CDN_SIGNED_URL_TTL_SECONDS`（默认 3600s）过期后 403 图裂——与 `DramaProject` 同类债。`DramaProject` 已在 `toDetail` 递归 `signer.maybeSign` 重签修复（v0.98，见 AGENTS §4.7.7）；`DramaShort` 出 wire 漏斗需照做（注入 `CdnUrlSigner` + 复用 `resignAssetUrls` 范式）。~~ **审计确认，2026-07-02（例行 QA 巡检）**：本条描述已过时——`DramaShortService` 早在 v0.76 补丁（commit `81d9030`，2026-06-17）就已注入 `CdnUrlSigner` 并在 `toDetail` 里加 `resignPayloadAssets`（遍历 shots 的 `frameUrl`/`frameUrls`/`videoUrl` 走 `resolveAssetUrl`→`signer.maybeSign` 重签），`DramaShortServiceTest` 当时已有断言覆盖。代码复核确认（`grep CdnUrlSigner/resignPayloadAssets apps/server/.../DramaShortService.java` 命中注入+调用），沿用上一轮例行 QA（PR #76）的审计结论，避免后续巡检重复排期。
- [x] ~~**C-2 角色/场景实体化 + 多角度参考图集**~~ **C-2 完成**（v0.101，2026-07-10）：一致性引擎 L0 地基。两新表 `drama_character`/`drama_scene`（字段名对齐 `CharacterDef`/`SceneAsset`；`ref_images_json`=多角度参考图集 `[{cdnKey,angle,label}]`，真值 cdnKey，出 wire signer 派生，软删随项目）；新服务 `DramaReferenceAssetService`（懒回填 `ensureBackfilled` + 双写 `syncFromDoc`〔§6.1 只 upsert 实体表、不重写 payloadJson〕+ 出 wire overlay + 三视图 `generateReferenceSheet`）。新端点 `POST /me/drama/projects/{id}/characters/{charId}/reference-sheet`（复用 `IMAGE_GENERATION`+`drama.character_frame_image` 加 `{{angleClause}}` 注角度、锁脸用定妆图；计费 **hold→逐角度 commit**，部分失败剩余 release，全失败 release 全额+抛错；§8.0 preflight 在 hold 前）。前端角色卡「一键三视图」+ 正/侧/全身缩略图墙。测试 `DramaReferenceAssetServiceTest`(8)。真源 `docs/[Fabel5]drama-consistency-engine-design.md` §4。类型沿用 drama 本地约定（不进 packages/types）。
- [x] ~~**C-3 服务端参考装配（Reference Assembler）+ 双线共享 useShotRender**~~ **C-3 完成**（v0.102，2026-07-10）：一致性引擎 L1 收官。新服务 `DramaReferenceAssembler`（`@Service`，**只读文档/实体、绝不回写 payloadJson**，§6.1）把前端 `epscript.tsx:shotRefImages` 优先级链下沉服务端：三级入参 `shot_ref` > `ref_slots` > `ref_images`（老前端数组直通兼容）+ `ref_leading` 置顶锚；角色 `drama_character.refImages`(front 优先，@cast→文本名→全员，实体缺兜底文档 avatarImage)/场景 `drama_scene`(显式 sceneRefId→名称兜底)/同场上一镜真实末帧（文档优先 + `MaterialVideoJob.lastFrameCdnKey` 权威回退，`variant_config` 内存扫）。按 D-11 capability 裁剪（`maxRefImages` 未配置 null→legacy 兼容默认 6=v0.97 前端既有上限、视频首尾帧 null→协议关键字静态判定；显式配置最高优先——review 回归修正，初版误按保守默认 1），优先级保 identity(character>scene>prev 末位先砍)、超出 `over_max_refs`、本地 `/cdn` `local_unfetchable`（如实回报 §8.0），`applied_refs.role` 精确槽位。`DramaRenderService.renderFrame/renderClip` 接入（删旧 `computeClipAppliedRefs`/`appliedRefsJson`）；前端共享 `lib/use-shot-render.ts`，`epscript` 删 `shotRefImages`/`sceneRefUrlFor`/`prevFrameInScene`/`nextFrameInScene`（体检留 UI 级 `sceneHasRef`）、`shorts/make` 删 `shortRefImages` 改走 `ref_slots`。测试 `DramaReferenceAssemblerTest`(16) + `DramaRenderServiceTest` 精简。真源 `docs/[Fabel5]drama-consistency-engine-design.md` §5。无新 path（复用 `/render/frame,clip`）。
- [ ] **C-4 MaterialVideoJob shotId/sceneId 索引列**（C-3 遗留，DAG 时必做）：C-3 的「同场上一镜真实末帧」权威回退目前用 `MaterialVideoJobRepository.findByOwnerUserIdAndScriptIdOrderByCreatedAtDesc` 拉该项目全部 job 后**内存解析 `variantConfigJson`** 匹配 `scene_id`/`shot_id`（`DramaReferenceAssembler.jobLastFrame`）。大项目 job 多时有内存/扫描成本。C-4（跨镜 DAG 编排）应给 `MaterialVideoJob` 加 `shot_id`/`scene_id` 索引列（ddl-auto=update 自动加）+ Repo `findFirstByOwnerUserIdAndScriptIdAndShotIdAndStatusOrderByCreatedAtDesc`，把内存扫换成索引查询。当前 C-3 内存扫描可接受（架构师裁决），不阻塞。
- [ ] **D-13 渲染扣费形态统一（debit vs hold→commit）**（v0.101 C-2 引入的有意分裂，待未来收敛）：`renderFrame` 单产物用一次性 `CreditService.debit`（SPEND），C-2 三视图批产物用 `hold→逐角度 commit`（FREEZE→SPEND，需部分成功部分退）。两形态并存 → 短剧「首帧类扣费」在账本上出现 SPEND 与 FREEZE→SPEND 两种流水形态。可接受（语义不同：单产物 vs 批产物部分退），但若未来统一渲染扣费口径，应把 `renderFrame` 也改 hold→commit（或反之）以让账本形态一致。定位：`DramaRenderService.renderFrame`(`creditService.debit`) vs `DramaReferenceAssetService.generateReferenceSheet`(`hold/commitHold/releaseHold`)。
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
- [x] ~~**deploy-clip-preprod.sh 时间戳 JAR 未清理，持续占用军师宿主 tmpfs**~~（**v0.129 运维修补完成**，2026-08-15）：Prometheus 还原出 Shmem 从约 48MiB 随 17 次 Clip 启动/部署阶梯增长到约 2.97GiB，当前脚本每次上传 `/tmp/aistareco-clip-<release>.jar` 后没有删除。远端安装段现以 `trap cleanup_stage EXIT` 清当前 JAR，预检同时按同 owner + 同前缀清理超过 60 分钟的历史残留；不改 AIStar 生产或媒体逻辑。
- [x] ~~**GitHub Actions 生产部署因缺 SSH secrets 每次 dispatch 报错**~~（**v0.84 处理**，2026-06-22）：决策**受控发布**——把 `deploy-production.yml` 改成**只构建 + 上传产物**，移除 Configure SSH / Deploy 两个 step，不再需要 `PROD_SSH_*` secrets，dispatch 不再报错。实际发布人工受控（本机 `deploy.sh` / ECS `update-and-deploy.sh`，私钥不离手）。同步 `infra/README.md` §4.2 + `aliyun-deploy/SKILL.md`。
- [ ] **（可选）若要恢复 Actions 自动部署：用部署专用受限 key，不放主钥**：长期生产私钥交给 GitHub 会扩大爆炸半径。需要时专门生成一把 deploy key（`authorized_keys` 加 `command=`/`from=` 限制，泄露可单独轮换），再补回两个 step + `PROD_SSH_*` secrets。
- [ ] **Phase 3 · 全栈容器化 + CI/CD**（v0.34 显式 v0.35+）：server + sau-service + 5 个 web app 出 Dockerfile + docker-compose；GitHub Actions 跑 build / typecheck / contract / push 镜像 + 部署。
- [ ] **Phase 4 · 用户上传素材 OSS 化**（v0.34 显式 v0.35+）：`MixcutAsset` 上传从本地 fs（`./mixcut-assets`）切换到 OSS（沿用 `AliyunOssCdnUploader`）。当前 v0.14 已做 mixcut **渲染产出** OSS 化；用户**上传**仍落本地。
- [ ] **Phase 5 · 多实例 + Redis + ShedLock**（v0.34 显式）：
  - `PublishJobScheduler` / `MixcutOutputCleanupScheduler` 两个 `@Scheduled` 加 ShedLock（源码注释已挂 TODO）
  - **dap 域两个 `@Scheduled` 同一债务**（2026-08-02 补记）：`DapTrashCleanupScheduler`（回收站到期清理）与
    v0.105 新增的 `DapModelinkPoller`（modelink 非终态分组 / 素材收敛轮询，`fixedDelay` 默认 10s）。
    后者多实例下会对同一批非终态行重复打上游 —— 语义上幂等（都是 GET 后落库），但会**成倍消耗
    modelink 配额**并放大限流风险，所以和上面两个一起纳入 ShedLock（源码注释已挂 TODO）。
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
- [x] ~~**admin `window.confirm` / `alert` 历史欠债迁移**~~（**审计确认已完成**，例行 QA 2026-07-05）：原描述过时——本轮全仓 `grep -rnE "window\.(confirm|alert|prompt)\(|[^.\w](confirm|alert|prompt)\("` 复核 `apps/admin/src`，零命中裸原生调用。原清单 8 个文件现状：`platform/llm-keys` 已并入 `platform/ai-models`（用 `useConfirm()`）；`finance/recharge-packages` 已挪到 `finance/(money)/recharge-packages/`（同用 `useConfirm()`）；其余 6 个（`base/presets`、`celebrity/{star-authorizations,template-scripts,mixcut-official-clips,products}`）均已是 `await confirm({...})` Promise-based 调用，非原生 `window.confirm`。具体哪轮例行 QA 补齐已不可考（未见对应 PR 描述），但当前 main 上无需再迁移。

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
- [ ] **预存在测试失败（与 v0.81 无关，clean main 同样红）**：本机带 `apps/server/.env`（gitignored，`AEP_CDN_DRIVER=oss` 但 endpoint 不可解析）时，所有 `@SpringBootTest` 全 context-load 失败 → 跑全量测试前应临时移走 `.env`（或确保 OSS endpoint 可解析）。即便移走 `.env`，仍有 **4 个预存在失败**需排查：`MaterialOpsE2ETest`（`productLibrary_includesMaterialProducts` / `getScript_returnsFullPayloadWithBlocks` / `listVideos_filterByProduct`）+ `PlatformSupportTest.toCsv_roundTrips`。已确认 stash 我的改动后于 clean main 同样失败 → 属历史欠债，非本次引入。（**2026-07-19 更新**：`MaterialOpsE2ETest` 3 例已根因定位并修复，见 2026-07-13 段落对应待办；本轮沙箱环境无 `.env` 文件、`./mvnw test` 全量 402/402 全绿含 `PlatformSupportTest`，故该条 `.env` 干扰问题本轮未复现，暂不消项，留给下次带 `.env` 环境的 agent 复核。）

---

## 2026-06-18 · 大模型调用原始响应可观测

- [x] ~~**失败时记录上游原始响应（止血，全模态）**~~（**v0.84 完成**）：文本 LLM（`AiModelInvocationService`：2xx-不可解析也 WARN raw + 落 `responseBodyJson`）、图像（`DramaRenderService` bad-output 记 raw）、视频（`MaterialVideoModelClient` poll 失败记 raw + `extractFailReason`）、数字人（`DapMultimodalClient` video poll 失败记 raw）四个模态,失败/终态均 WARN 上游原始响应体,便于排查。
- [x] ~~**大模型调用层结构性统一（架构债，建议下一步专做）**~~（**v0.85 完成**，2026-06-19）：抽共享原语 `service/ai/UpstreamModelHttp.sendJson(req, ctx)` + `ModelCallCtx` + `UpstreamCallException`,统一 send + io 记原始请求/响应（独立 logger `aep.ai.upstream.io`）+ 非 2xx WARN raw body + best-effort 落失败 `AiModelUsageRecord.responseBodyJson`/latency/errorCode + IOException 退避重试;非 2xx 不抛、返回 resp 由调用方按自身错误码处理（行为/错误码不变）。四个同步 JSON 客户端全部改走它:文本 `AiModelInvocationService.doChat`、图像 `DramaRenderService.callImageModel`、视频 `MaterialVideoModelClient.submit/poll`、数字人 `DapMultimodalClient.postJson/getJson`（保留 IOException 重试 1 次）。成功路径的 token/计费单位仍由各调用方落库（只有它们能解析）；video poll 与 dap 沿用「失败不在此处落用量」（`recordFailureUsage=false`，仅统一原始日志）。新测试 `UpstreamModelHttpTest` 7/7;`AiModelInvocationServiceTest`/`MaterialVideoModelClientTest`/`AiModelUsageServiceTest` 全绿;全量除 4 个预存在失败外无新增。**遗留**:`ForgeCozeService` 走 Coze Java SDK（流式、HTTP 对我们不透明）暂未纳入,见下条。
- [ ] **Coze 流式调用纳入统一观测**：`ForgeCozeService` 走 Coze Java SDK（流式 chat，HTTP 细节不透明），未走 `UpstreamModelHttp`。待评估:或为流式补一条「调用元信息 + 最终聚合响应」的 best-effort 用量/日志旁路（不强求原始分片），或在 SDK 层加拦截器。优先级低（形象锻造入口 music 线 v0.60 已下线，仅 drama 顾问在用）。

---

## 2026-07-07 · 例行 QA 新发现（均已同轮修复，非遗留待办，留痕备查）

> 本轮复核了 PR #81（遗留 `apps/web` 三处 `window.confirm()`，已携带进本轮）+ 四个专项 agent 交叉审计
> （credit-ledger bypass / hold-commit-release、`/api/me/**`+`/api/star/**` 归属校验、CDN URL 签名、
> `?? ""` 掩盖 + 原生 confirm/alert/prompt）。归属校验与 `?? ""`/原生弹窗两类**审计后确认无新增问题**
> （见 PR 描述）。以下三条是本轮新发现且已在同一 PR 内修复：

- [x] ~~**`MaterialVideoJob.videoUrl`/`thumbnailUrl`/`lastFrameUrl` 从落库那刻就未签名**~~（**已修复**，2026-07-07）：`AliyunOssCdnUploader.upload()` 返回的是未签名 `publicUrlFor(key)`，`MaterialVideoJobService.toCard` 此前原样透传出 wire，从未经过 `CdnUrlSigner`——生产 driver=oss 且开启防盗刷签名时不是 1h TTL 过期才裂，而是从生成那一刻起就 403（AGENTS.md §4.7.7 同类教训，本条之前没堵上）。改为 `toCard` 对三个字段调 `CdnUrlSigner.maybeSign`（URL 反抽 key 重签，同 DramaProject/DramaShort 已有兜底路径），未新增列。回归测试 `MaterialVideoJobServiceCdnSignTest`。注：本条之前在 §4.7.6「local-only 字段迁移」列表里被记成「待迁移到 OSS」，实际当时已经在传 OSS（`mirrorToCdn` 真调用了 `cdnUploader.upload`），真正的洞是「传了但没签」，描述口径已更新。
- [x] ~~**`StoreService.redeem` 绕开 `CreditService` 手写钱包扣款**~~（**已修复**，2026-07-07）：手写 `walletRepo.findByUserIdForUpdate → setXxxBalance → save`，虽用了悲观锁 + 服务端权威价（未被并发/定价漏洞利用），但违反 AGENTS.md §4.2 硬规则且复制了扣桶优先级逻辑，与 `CreditService` 产生维护漂移风险。改为 `CreditService.debit` 新增的 entryType 可选重载（默认 ADJUST，原 3 个调用方行为不变），`redeem` 传 SPEND，语义等价。回归测试 `StoreServiceRedeemTest`。
- [x] ~~**`/api/store/items/**`（商店购买）缺显式 `authenticated()`**~~（**已修复**，2026-07-07）：同 F-01（2026-07-05 修的 `/api/settings/**`）一样落 `anyRequest().permitAll()` 兜底，`StoreController#redeem` 未登录会 NPE 500 而非干净 401。只收紧 `items/**`（写路径）；`/api/store/catalog` 保持 permitAll（`StoreController#catalog` 显式支持匿名浏览，收紧会破坏既有设计）。

---

## 2026-07-08 · 例行 QA 新发现（均已同轮修复）

> 本轮承接并复核了历史例行 QA PR #82（本仓）—— 5 个提交（遗留 `apps/web` confirm 迁移 +
> `MaterialVideoJob` CDN 签名 + `StoreService` 改经 `CreditService` + `/api/store/items/**`
> 补认证 + TODO.md 记录）经复核仍然有效、未合并，已 cherry-pick 携带进本轮分支，无冲突、
> 测试复跑仍绿。以下两条是本轮独立审计新发现，已在同一 PR 内修复：

- [x] ~~**`PublishJob.videoUrl`/`coverUrl` 落库即签名，「按天错峰」跨天调度时签名早已过期才派单**~~（**已修复**，2026-07-08）：`MixcutPublishService` 创建发布批次时把 `MixcutRenderOutputDto.cdnUrl()`（已签名的 CDN URL）整段传给 `CreatePublishJobInputDto`，`PublishJobService` 原样落库；`daily_recurring`「按天错峰铺量」调度策略会把同一批 output 铺到未来好几天的固定时段，而签名 TTL（`AEP_CDN_SIGNED_URL_TTL_SECONDS` 默认 3600s）远小于跨天调度窗口——`startJob` 此前未重签就直接把落库 URL 塞进派单请求体，创建当天以后启动的任务一律带过期签名调 sau-service，直接 403 失败，整个多日错峰发布功能在生产 driver=oss + 签名策略下功能性失效（credits 会因失败正常退款，非资损，但功能不可用）。修复：给 `PublishJobService` 注入 `CdnUrlSigner`，`startJob` 派单前对 `videoUrl`/`coverUrl` 各调一次 `maybeSign`（从 URL 反抽 key 重签，对已过期签名同样有效），无需新增列。回归测试 `PublishJobServiceCdnSignTest`（2 例：重签值确实写进 sau.upload 请求体 / coverUrl 为空时不写入该字段）。
- [x] ~~**`web-star` 13 个页面数据加载失败时卡在永久加载骨架，无错误/重试提示**~~（**已修复**，2026-07-08）：`revenue/page.tsx` 是仓库内唯一正确实现——渲染门控为 `error ? <EmptyState/> : <LoadingList/>`；其余 `cooperation`/`whitelist`/`ai-likeness`/`digital-human`/`product-library`/`brand-auth`/`infringement`/`rules`/`product-onboard`/`ip-auth`/`content-review`/`contracts`/`dashboard` 13 个页面的门控都写成了 `!data ? <LoadingList/> : ...`，遗漏了 `error` 分支——`/api/star/*` 请求失败时（JWT 过期、profile 未绑定、500、网络抖动）内容区永久停在加载骨架，只有 `InlineError` 顶部横幅（若有）能看出出错，用户无法判断"还在加载"还是"已经失败"，也没有重试入口。`dashboard/page.tsx` 更严重——它复用 `useStarShell()` 共享的 `overview`，而该 context 的 `refreshOverview` 对失败是**完全静默吞掉**（"总览失败不阻塞工作台，badge 缺省为空"，这对侧栏角标是对的设计），导致仪表盘主内容失败时连错误横幅都没有。修复：12 个有本地 `error` state 的页面比照 `revenue/page.tsx` 补 `error ? <EmptyState icon={...} title="...加载失败" sub={error} /> : <LoadingList/>`；`star-shell-context.tsx` 新增 `overviewError` 字段（`refreshOverview` 失败时记录，不改变"侧栏 badge 静默降级"的既有语义，仅额外暴露错误供页面自行决定展示），`dashboard/page.tsx` 用它补上同款错误态。无新增依赖/契约变更，纯前端渲染分支补全。

---

## 2026-07-09 · 例行 QA 新发现（1 处已修复 + 2 处记录待排期）

> 本轮承接并复核了历史例行 QA PR #83（本仓）—— 8 个提交（承接 #82 的 5 个 + #83 自己新发现
> 的 2 个 CDN 签名修复 + TODO.md 记录）经复核仍然有效、未合并（main 在此期间只新增一个纯 docs
> commit），已 cherry-pick 携带进本轮分支，无冲突、`./mvnw compile`/8 个回归测试/`pnpm typecheck:all`
> 10/10/`pnpm check:api-contract` 复跑仍绿。以下是本轮独立审计的结果：

- [x] ~~**`AdminCreditController`（钱包/流水查询）缺失 `@PreAuthorize`，任意 admin（含 OPERATOR）可读取全量钱包余额与流水**~~（**已修复**，2026-07-09）：`GET /api/admin/wallets`、`GET /api/admin/wallets/{userId}`、`GET /api/admin/ledger-entries` 三个端点此前只受 `/api/admin/**` 的 `hasAnyRole("SUPER_ADMIN","OPERATOR")` 兜底保护，未像同目录下的 `AdminReconciliationController`/`AdminRechargeOrderController`/`AdminCreditOpsController` 那样收紧到 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`——而 admin nav（`apps/admin/src/constants/nav.ts`）和 AGENTS.md §7 都明确「结算中心：钱包/流水/复核」是 FINANCE_ADMIN 专属、OPERATOR 应该 403。任意 OPERATOR 角色的 admin 账号可以直接 curl 这三个端点，读到全平台用户钱包余额 + 完整流水（含 v0.86 起补的手机号）。修复：类级 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`。已确认前端 `apps/admin/src/app/finance/(money)/ledger/page.tsx`（FINANCE_ADMIN-only 导航）是这三个端点唯一调用方，OPERATOR 可见的「调差/赠送」页面走的是 `AdminCreditOpsController` 独立端点，不受影响。回归测试 `AdminCreditControllerSecurityTest`（4 例：OPERATOR 两端点均 403 / FINANCE_ADMIN、SUPER_ADMIN 均 200），新增 `spring-security-test` 测试期依赖以支持 `@WithMockUser`。
- [ ] **web-aiavatar 共享 `useApi` hook 对拉取失败静默保留 initial 值，无法与"真实空态"区分**（本轮发现，暂不修，理由见下）：`apps/web-aiavatar/src/proto/api.ts` 的 `useApi()` 明确注释"静默：保留 initial...其余错误由动作型调用处理"，`seed.*()` 在 live 模式下均返回 `[]`/`null`，约 20 处只读调用（`screen-home`/`screen-library`/`screen-more`/`screen-voiceapps`/`screen-avatar` 等）一旦拉取失败（JWT 过期/500/网络抖动）就会把"没有数据"误渲染成"真实空态"（如已有数字人的用户看到"你还没有数字人，去创建"引导），且无错误提示/重试。**与已修复的 13 个 web-star 页面那类 bug 不同**：这里没有"其他页面证明是疏漏"的反例——`useApi` 的静默行为在全 app 是统一、故意为之的设计决策（代码注释明确写了理由），且要正确暴露 error 需要改共享 hook 签名 + 逐一梳理 ~20 个调用点决定各自的 UI 呈现，改动面偏大、屬于产品/体验优化范畴而非局部回归修复，故本轮只记录不动手，留给产品/前端排期评估（可参考 web-star 的 `error ? <EmptyState/> : ...` 模式落地）。
- [ ] **celebrity 明星头像/封面上传绕开 `CdnUrlSigner`，落库裸 `cdnUrl` 而非 `cdnKey`**（本轮发现，暂不修，理由见下）：`StarProfileUploadController`/`AdminCelebrityUploadController` 都直接返回 `FileStorageService` 的未签名公开 URL，写入 `CelebrityStar.avatar`/`CelebrityStar.cover`（纯 `String` 列，无 `cdnKey`）。代码里已有注释解释这是刻意权衡（"非高带宽盗刷目标，公开 URL 可接受"），且当前 `infra/env/server.env.example` 配置的是 `AEP_CDN_SIGNED_URL_STRATEGY=oss`（非 `cdn`），今天不会触发线上裂图。但该注释的技术理由站不住脚——一旦运维按 AGENTS.md §4.7.3 的建议把策略切到 `cdn`（Aliyun CDN URL 鉴权 Type A 是按域名/路径生效，不区分内容敏感度），这两个字段会立刻裂图（不是 TTL 过期，是从上传那刻起就没签过）。且新增 `cdnUrl` 不带 `cdnKey` 违反 AGENTS.md §4.7.4 的强制规则。修复需要给 `CelebrityStar` 加 `avatarCdnKey`/`coverCdnKey` 列 + 双写迁移 + DTO 出 wire 改走 signer，屬于结构性 schema 变更，非本轮"高度局部化"修复范畴，记录留给下一轮排期。**2026-07-10 复核**：本轮独立审计再次排查，结论不变，仍留给下一轮排期（未新增变更）。

---

## 2026-07-10 · 例行 QA 新发现（5 处，均已同轮修复）

> 本轮未发现历史遗留的 open routine QA PR 需要承接（`[Routine QA]` 标题 / `qa/routine/` 分支前缀均搜索为空，上一轮 #85 已合并入 main）。独立审计发现并修复以下 5 处：

- [x] ~~**`CreditService.commitHold`/`releaseHold` 用无锁查询读 `CreditHold`，与 `CreditHoldSweeper` 的清扫竞态可导致双重退款 + 账本终态被覆盖**~~（**已修复**，2026-07-10）：两方法都用 `CreditHoldRepository.findByReferenceTypeAndReferenceId`（普通派生查询，无 `@Lock`）读 hold，再单独对 `Wallet` 行加悲观锁——但 hold 行本身没锁。`CreditHoldSweeper` 是 `@Scheduled` 任务，专门清扫超 180 分钟 TTL 的 `ACTIVE` hold，与业务方几乎同时对同一 hold 调 `commitHold`/`releaseHold` 时（sweeper 判定「孤儿」的窗口本就贴着「任务可能仍在跑」的边界），两个事务可能各自读到同一份 `status=ACTIVE` 的旧对象；先提交的一方把 hold 置为终态（COMMITTED 或 RELEASED），后到者仍持有陈旧的内存对象，在 wallet 锁释放后基于旧状态继续操作——`releaseHold` 会把已经 `commitHold` 完成的任务再退一次款（用户白嫖），且把 hold 状态从 COMMITTED 覆盖回 RELEASED（账本审计链损坏）。修复：给 `CreditHoldRepository` 新增 `findByReferenceTypeAndReferenceIdForUpdate`（`@Lock(PESSIMISTIC_WRITE)`，与 `WalletRepository#findByUserIdForUpdate` 同一模式），`commitHold`/`releaseHold` 改用锁版查询，且在获取 wallet 锁之前先锁 hold 行（锁顺序 hold→wallet 两方法一致，不与仅锁 wallet 的 `hold()` 创建路径产生环路，无死锁风险）。回归测试 `CreditServiceHoldLockTest`（3 例：commit/release 均改走锁版查询且不再调无锁版；模拟锁串行化后重读 COMMITTED 状态时 release 正确 no-op、不重复退款）。
- [x] ~~**`GET /api/admin/users/{id}/wallet` 缺失 `@PreAuthorize`，任意 OPERATOR admin 可读取任意用户钱包**~~（**已修复**，2026-07-10）：与 2026-07-09 刚修的 `AdminCreditController` 是同一 bug class，只是换了一个 controller——`AdminUserController.getWallet` 只受 `/api/admin/**` 的 `hasAnyRole("SUPER_ADMIN","OPERATOR")` 兜底保护，未收紧到 `FINANCE_ADMIN|SUPER_ADMIN`。虽然当前 admin 前端没有页面调用这个端点（`apps/admin/src/api/users.ts` 的 `getUserWallet` 未被引用），但端点本身在 `specs/openapi.yaml` 有登记、可直接访问。修复：补 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`，与 `AdminCreditController` 口径一致。回归测试 `AdminUserControllerWalletSecurityTest`（3 例：OPERATOR 403 / FINANCE_ADMIN、SUPER_ADMIN 均 200，200 用例挑一个真有 wallet 的 seed 用户，不是 `AepUserRepository.findAll()` 的第一条）。
- [x] ~~**`PublishJobDto.from()` 读路径未经 `CdnUrlSigner`，`videoUrl`/`coverUrl` 签名过期后 403**~~（**已修复**，2026-07-10）：2026-07-08 的 `a72317e` 只修了 *派单* 路径（`startJob` 派单前 `maybeSign` 重签），但 *读* 路径（`GET /api/me/publish-jobs`、`GET /api/me/publish-jobs/{id}` 等 9 处调用点）漏签——`PublishJobDto.from(j)` 原样透传落库时已签名的 URL，TTL（默认 3600s）过期后任何读取这些字段的客户端都会拿到失效签名。当前 celebrity/drama 前端还没有把这两个字段渲染成 `<img>`/`<video>` src，所以不是即时可见故障，但属于 AGENTS.md §4.7.7 明确要求必须堵的口子（读路径不重签 = 定时炸弹）。修复：`PublishJobDto.from` 加 `CdnUrlSigner` 参数、对 `videoUrl`/`coverUrl` 各 `maybeSign` 一次；`PublishJobService` 全部 9 处调用点传入已注入的 `cdnUrlSigner`；新增 `PublishJobService.toDto(job)` 包装方法供 `PublishJobBatchService` 复用（不必让它也持有 `CdnUrlSigner`）。同步更新 `PublishJobServiceCdnSignTest`：`startJob` 返回的 DTO 现在也会重签一次，同一 URL 上 `maybeSign` 从断言调用 1 次改为 2 次（派单前 + 出 DTO 各一次），测试注释写明原因。
- [x] ~~**web-celebrity 素材工坊编辑/预览页拉取脚本失败无 `.catch()`，永久卡在加载态**~~（**已修复**，2026-07-10）：`material/workshop/[scriptId]/edit/editor-client.tsx` 与同目录 `preview-client.tsx` 的 `MaterialOpsApi.getScript(scriptId).then(...)` 都没有 `.catch()`/`.finally()`。JWT 过期 / 500 / 网络抖动时 promise reject，`setLoading(false)` 永远不会跑，页面卡死在「加载脚本…」，控制台留一条 unhandled rejection，且没有任何 error 状态可退——比 2026-07-08 修的 13 个 web-star 页面更彻底（那些好歹有 `!data` 判断，这里是 loading 状态本身卡死）。修复：两个文件都加 `error` state + `.catch()` 设置错误信息并解除 loading + 「重试」按钮（`reloadKey` 触发 `useEffect` 重新拉取）。
- [x] ~~**web-drama 分发总览页把后端原始状态枚举值直接渲染给用户**~~（**已修复**，2026-07-10）：`distribution/page.tsx` 两处 `<StatusBadge tone={tone}>{p.status}</StatusBadge>` / `{j.status}` 把 `PlatformStatus`（`"connected"`/`"pending"`/`"disconnected"`）和 `PublishJobStatus`（`"awaiting_user"`/`"transcoding"` 等）wire 原值直接当可视文案，违反 AGENTS.md §8「UI 文案：用户友好」（禁止暴露内部枚举原值）。同一枚举在 `web-celebrity` 的 `PublishJobList.tsx` 已有正确的中文 `STATUS_META` 标签映射，确认这是本页遗漏而非有意设计。修复：新增本地 `PLATFORM_STATUS_LABEL`/`JOB_STATUS_LABEL` 映射（对齐 `PublishJobList.tsx` 的中文标签），两处渲染改用映射后的标签。

**本轮复核历史 open routine PR**：无——`[Routine QA]`/`qa/routine/` 搜索均为空（#85 已合并），无需 carry-forward，也无需 supersede/close 任何旧 PR。
**验证**：`./mvnw compile`（无 `-o`，走代理联网拉包）全绿；`./mvnw -Dtest=CreditServiceHoldLockTest,AdminUserControllerWalletSecurityTest,CreditHoldSweeperTest,AdminCreditControllerSecurityTest,CreditServiceRefundTest,PublishJobServiceCdnSignTest,CelebrityZoneServiceTest,CreditOpsServiceTest,DramaProjectServiceTest,DramaShortServiceTest,LicenseActivationServiceCreditTest,MaterialDraftBillingTest,RechargeServiceTest,StoreServiceRedeemTest,WalletBucketAndConcurrencyTest,MaterialVideoJobServiceCdnSignTest,MixcutPublishServiceTest test` 全绿（17 + 2 + 广谱回归共 90+ 例）；`pnpm typecheck:web-celebrity` / `pnpm typecheck:web-drama` 见本轮 PR 描述。

## 2026-07-11 · 例行 QA 新发现（2 处，均已同轮修复）

> 本轮未发现历史遗留的 open routine QA PR 需要承接（`[Routine QA]`/`qa/routine/` 搜索均为空）。独立审计发现并修复以下 2 处（`ai-pilot` 仓另有 2 处独立修复，见该仓 PR）：

- [x] ~~**`PublishJobService.startJob` 派单前对用户可控的 `videoUrl` 零校验，sau-service 服务端 GET 抓取构成 SSRF**~~（**已修复**，2026-07-11）：`CreatePublishJobInputDto.videoUrl`（`POST /api/me/publish-jobs`）与 `MixcutPublishBatchRequest.OutputItem.cdnUrl`（经 `MixcutPublishService` 直通同一 `createBatch`）均为用户/前端可控字符串，落库后 `startJob` 只用 `CdnUrlSigner.maybeSign` 重签（非本仓 CDN 域时原样返回，不做任何域校验）+ `toAbsoluteUrl` 补全相对路径，从未校验最终 origin，直接塞进 sau-service 派单请求体。`sau-service` 的 `uploader.py:_fetch_video_tmpfs` 对 `videoUrl` 发起服务端 `httpx.AsyncClient().stream("GET", url)`，无内网/云 metadata 端点限制——攻击者可把 `videoUrl` 指向阿里云 metadata 接口（`100.100.100.200`）或内网服务发起 SSRF（凭据窃取 / 内网端口扫描）。修复：`PublishJobService` 新增 `trustedDispatchOrigins` 白名单（自身 `sau.callback-base-url` origin + `aep.cdn.public-base-url` + `aep.cdn.oss.base-url` 已配置的 origin），`toAbsoluteUrl` 对已是绝对 URL 的输入强制校验 origin 命中白名单，未命中 400 `VIDEO_URL_NOT_ALLOWED` 拒绝；校验挪到 credit hold 之前，失败零副作用（不扣费、不翻状态）。`coverUrl` 当前未被 sau-service 任何 driver 读取（仅存字段），本轮不额外收紧，留痕见下条。回归测试 `PublishJobServiceTest`（新增 4 例：内网/metadata 地址 400 拒绝且不 hold 不派单、可信 CDN origin 放行、历史相对路径 `/cdn/...` 同源放行）+ 全量 `Mixcut*Test,Publish*Test` 回归 + `AdminUserControllerWalletSecurityTest`（验证 `@Lazy` 自注入不破坏 Spring 上下文启动）全绿。
- [x] ~~**`PublishJobService.resumeInflight()` 内同类自调用 `applyCallback`/`resumeFail`，绕过 Spring AOP 代理导致 `@Transactional` 失效**~~（**已修复**，2026-07-11）：`resumeInflight()` 是 `@PostConstruct`（非事务方法），内部直接 `this.applyCallback(cb)` / `resumeFail(job, ...)` 调用同类的 `@Transactional` 方法——Spring 基于代理拦截事务，同类自调用不经过代理，两方法的 `@Transactional` 完全不生效。仅影响服务器重启后的 in-progress 任务恢复扫描（低频路径），后果是状态翻转与 `PublishJobEvent` 审计日志写入不再是同一事务，中途失败会留下状态与事件日志不一致的脏数据（非积分重复入账——hold 的 commit/release 已各自有 try/catch 兜底）。修复：构造函数新增 `@Lazy PublishJobService self` 自注入代理，`resumeInflight()` 内两处调用改走 `self.applyCallback(...)`/`self.resumeFail(...)`，强制经代理触发 `@Transactional`。回归测试 `PublishJobServiceTest#resumeInflightDispatchesThroughSelfProxyNotRawThis`（mock self，断言调用经 self 而非同类自调用）+ `AdminUserControllerWalletSecurityTest` 验证真实 Spring 容器下循环自注入正常启动（无循环依赖报错）。
- [ ] **`PublishJob.coverUrl` 同样来自用户可控输入，未做 origin 校验**（**留痕待排期**，2026-07-11）：当前 sau-service 所有 platform driver 均未读取 `cover_url`（`grep` 全仓仅剩字段声明 + DTO 透传，无 fetch 调用点），非当前可利用漏洞，本轮未跟着收紧（避免無依据扩大改动面）。若未来任一 driver 开始消费 `cover_url` 做封面抓取，务必同步套用 `videoUrl` 已有的 `trustedDispatchOrigins` 校验，否则会重新打开同一类 SSRF。

**本轮复核历史 open routine PR**：无——`[Routine QA]`/`qa/routine/` 搜索均为空。
**验证**：`./mvnw compile -o` 全绿；`./mvnw -Dtest=PublishJobServiceTest,PublishJobServiceCdnSignTest test -o` 全绿（7 例）；`./mvnw -Dtest="Mixcut*Test,Publish*Test" test -o` 全绿（广谱回归）；`./mvnw -Dtest=AdminUserControllerWalletSecurityTest test -o` 全绿（真实 Spring 容器验证 `@Lazy` 自注入不破坏启动）。

## 2026-07-12 · 例行 QA 新发现（1 处已修复）

> 本轮承接了 2026-07-11 的 open routine QA PR #87（`qa/routine/2026-07-11-publish-job-ssrf-and-tx`，SSRF 白名单 + `resumeInflight` 自调用致 `@Transactional` 失效两处修复），cherry-pick 干净无冲突（main 在此期间只多了一次支付宝配置误提交 + 撤销，未触碰 `PublishJobService.java`/`TODO.md`），`PublishJobServiceTest`/`PublishJobServiceCdnSignTest` 复跑 7/7 全绿。独立审计聚焦近期上线、尚未经历过例行 QA 审查的「短剧一致性引擎」（C-1~C-3 / D-11，v0.99-v0.102）与支付回调链路，发现并修复以下 1 处：

- [x] ~~**`AiAppBindingService.updateCandidate` 允许禁用「默认候选」，但对默认路径调用完全无效——静默无效的管理操作**~~（**已修复**，2026-07-12）：D-11 把「用途→单端点」升级为「用途→N 候选端点」，`AiModelInvocationService.resolveEndpoint(purpose, endpointId)`（显式指定候选）正确校验候选 `enabled`；但**默认路径** `resolveEndpoint(purpose)`（无 `endpointId` 时的兜底，覆盖 `invokeChat`、`renderFrame`/`renderClip` 的默认分支、`MaterialVideoModelClient.pickEndpoint(null)` 等绝大多数未显式选模型的调用）只读 `AiAppBinding` + 端点自身 `isEnabled`，**从未检查候选行的 `enabled` 字段**（`AiAppEndpointCandidate` 类注释里其实写明了这是有意的「resolveEndpoint(purpose) 行为零变化」设计）。问题在于 admin「候选端点与能力」表格对默认行和其余行渲染同一个「启用」开关且无任何拦截——运营在默认行关闭「启用」，直觉认为该端点已下线，实际上对占绝大多数流量的默认调用路径完全无效，是一次外观上生效、实际上静默 no-op 的管理操作（同类先例：`removeCandidate` 已有「默认候选不许删」的守卫，但 `updateCandidate` 遗漏了对应的「不许禁用」守卫）。修复：`AiAppBindingService.updateCandidate` 新增守卫——当 `body.enabled()==false` 且该候选是当前用途默认端点时，抛 400 `CANDIDATE_IS_DEFAULT`（与 `removeCandidate` 同错误码/同文案风格），提示先切换默认端点或直接停用该 AI 模型端点；未涉及 `enabled` 字段的更新（如只改 `sortOrder`/capability）不受影响。前端 `apps/admin/src/app/platform/ai-models/page.tsx` 同步给默认行的「启用」`Switch` 加 `disabled` + 说明 `title`，避免运营先点了才被拒。新增回归测试 `AiAppBindingServiceTest`（3 例：禁用默认候选 400 拒绝且不落库 / 禁用非默认候选正常生效 / 只改默认候选的其他字段不受禁用守卫影响）。（此 bug 由 general-purpose 子 agent 定向审计 C-1~C-3/D-11 代码独立发现，经本轮人工复核确认根因与影响面后修复。）

**本轮复核历史 open routine PR**：承接 #87（见上），无需 supersede/close。
**验证**：`./mvnw compile -o` 全绿；`./mvnw -Dtest=AiAppBindingServiceTest,AiModelInvocationServiceTest,AiAppCandidateSeederTest test -o` 全绿（25 例）；`./mvnw -Dtest="AiApp*Test,AiModel*Test,Drama*Test" test -o` 广谱回归全绿（146 例，2 跳过为需真实凭据的 live smoke test）；`./mvnw -Dtest=PublishJobServiceTest,PublishJobServiceCdnSignTest test -o` 全绿（7 例，验证 #87 承接无 regress）。admin 端 `tsc --noEmit` 在本沙箱环境因未跑 `pnpm install`（无 `node_modules`）无法完整执行，已逐行核对新增的 `disabled`/`title` props 未引入超出既有模块缺失噪音之外的新增类型错误。

---

## 2026-07-12 · v0.103 短剧前端 UX 打磨新发现（本轮定位未修，留待排期）

> v0.103 web-drama UX 精细化打磨（纯前端）过程中顺手定位的 4 条，本轮不动手，均带精确定位。

- [ ] **`drama.credit.interactive-draft` 单价未暴露进 `GET /me/drama/config`**：互动剧 AI 起草的单价（PlatformConfig `drama.credit.interactive-draft`，v0.79 引入）后端已配、扣费真实，但 `DramaConfigController` 返回的配置 DTO + 前端 `api/drama-config.ts` 未把这个字段带出来，导致 `apps/web-drama/src/app/(workspace)/projects/[id]/(stages)/branch.tsx` 的 AI 起草确认弹窗只能显示「将消耗积分」兜底文案，拿不到具体数字（其余动作如 frame/shot-rewrite 都有真数字）。修复：`DramaConfigController` 的配置聚合补 `interactive-draft` 单价 → `api/drama-config.ts` 加字段 → branch.tsx 起草确认改显示 `CreditMark` 具体值。
- [ ] **`shorts/make` 本地 `EditableField` 与 drama-ui 共享 `Editable` 是两套行内编辑交互**：`apps/web-drama/src/app/(workspace)/shorts/make/page.tsx:89` 附近自定义了一个 `EditableField`（点击进入编辑、失焦保存），与 `@/components/drama-ui` 导出的共享 `Editable` 功能重叠但交互细节（键盘行为、占位、样式）不一致，属重复实现。待合并到共享 `Editable`（或让 `EditableField` 成为其薄封装），消除交互漂移。
- [x] ~~**distribution 平台卡名称列过窄导致两字换行**（观感，非功能）~~（**例行 QA 完成**，2026-07-16）：`apps/web-drama/src/app/(workspace)/distribution/page.tsx` 平台卡名称列加 `whiteSpace:"nowrap"` + `overflow:"hidden"` + `textOverflow:"ellipsis"` + hover `title={p.name}`，符合 AGENTS.md §8 跨 app「不溢出」硬规则（此前无溢出约束，较长平台名会断行）。`pnpm --filter @ai-star-eco/web-drama typecheck` 绿。
- [ ] **operations 未发布守卫仅 beforeunload + 页内黄条，缺 App Router 路由级导航拦截**：`apps/web-drama/src/app/(workspace)/operations/page.tsx` 有未发布改动时，浏览器级关闭/刷新有 `beforeunload` 提示、页内有黄条提醒，但**应用内**通过 Next `<Link>` / `router.push` 切走时不会拦截（App Router 目前无官方 `useBlocker`），可能丢草稿。待 Next 提供路由拦截能力或自实现导航守卫后补上。

---

## 2026-07-13 · 例行 QA 新发现（3 处已修复）

> 本轮未发现历史遗留的 open routine QA PR 需要承接（`[Routine QA]`/`qa/routine/` 搜索均为空）。独立审计聚焦短剧分镜表渲染轮询、积分冻结并发路径、D-11 候选端点管理，发现并修复以下 3 处：

- [x] ~~**`epscript.tsx`（分镜表·唯一逐镜工作面）轮询超时被当作生成失败，清空 busy 态放行用户重新提交，导致原任务与重试各扣一次积分**~~（**已修复**，2026-07-13）：`RenderApi.pollFrameJob`/`pollClipJob` 在客户端轮询 240s/300s 超时后会 resolve（不 throw）一个 `{status:"failed", error_message: POLL_TIMEOUT_MESSAGE}`——任务其实仍在服务端跑，只是前端等不及了。`epscript.tsx` 的 `watchFrameJob`/`watchClipJob` 此前把这个"伪失败"和真实失败一视同仁：`clearBusy` + toast 报错，按钮随即可再点，用户很自然地重新提交同一镜，原任务（已真实扣费、稍后会被 `syncTasks` 后台轮询正常收敛）与新提交的重试各计一次费用。v0.103 同一提交已经在 `shorts/make/page.tsx` 修过同一 bug 类（`isPollTimeout()` 判定 + 保留 pending 态不清 busy），但没有同步到 epscript.tsx——分镜表恰恰是 v0.98 起收敛出的"唯一逐镜工作面"，是最高频的出片入口。修复：把 `isPollTimeout()` 判定移植进 `epscript.tsx`，超时时不清 busy、不当失败处理，仅提示"仍在后台生成"，交给既有的 `syncTasks` 轮询（5s 间隔，读 `/render/tasks`）对账收敛真实结果。
- [x] ~~**`CreditService.hold()` 幂等检查用无锁查询，先于钱包行锁执行，并发重复请求（同 referenceId）会撞唯一约束报 500 而非幂等返回**~~（**已修复**，2026-07-13）：2026-07-10 的 `186c13ce` 已经把 `commitHold`/`releaseHold` 的幂等查询换成悲观行锁版 `findByReferenceTypeAndReferenceIdForUpdate`（防同一 hold 的并发 commit/release 各自读到陈旧状态），但 `hold()` 自己的幂等检查仍在 `getOrCreateWalletForUpdate` 拿钱包锁**之前**用无锁的 `findByReferenceTypeAndReferenceId`。并发重复请求（双击 / 客户端超时重试，referenceId 由调用方按业务对象确定性构造）可能都读到"不存在"，都往下走扣款，第二次落 `CreditHold` 撞 `(referenceType, referenceId)` 唯一约束，在 `@Transactional` 内抛未处理的 `DataIntegrityViolationException`（连带本次钱包扣减一起回滚，非资损，但把合法的重试/双击请求打成裸 500）。修复：把幂等检查挪到 `getOrCreateWalletForUpdate` **之后**——钱包行锁把同一 `userId` 的并发 `hold()` 调用天然串行化，后到者拿到锁时先到者已提交，此时再查一定能读到已存在的 hold，直接幂等返回，无需再引入额外的约束冲突捕获逻辑。新增回归测试 `CreditServiceHoldLockTest#holdChecksIdempotencyAfterAcquiringWalletLock`（用 `InOrder` 断言钱包锁查询先于幂等查询、幂等命中后不再写钱包）。
- [x] ~~**`AiAppBindingService.bind()` 把一个此前被禁用的候选重新设为默认端点时未顺带重新启用，产生"默认候选=disabled"自相矛盾状态**~~（**已修复**，2026-07-13）：2026-07-12 刚修的 `updateCandidate` 守卫（禁止禁用默认候选）反过来暴露了 `bind()` 侧的遗漏——运营先把一个非默认候选禁用（当时允许），之后又通过"设默认"把它提升为默认端点，`bind()` 内的 `ensureCandidate` 只在候选**不存在**时才新建（`enabled=true`），候选**已存在但 disabled** 时直接跳过、不做任何改动。结果：admin 候选表该行 `isDefault` 徽章亮起而「启用」开关是灭的，且因 `updateCandidate` 的默认候选守卫被永久锁死，运营无法再手动打开——一个自相矛盾且无法自愈的坏状态（`AiModelInvocationService.resolveEndpoint(purpose)` 默认路径本就不读候选 `enabled`，所以不影响真实调用，纯粹是管理面显示/操作一致性问题，但足以让运营误判服务状态）。修复：`ensureCandidate` 改为先查已有候选，若存在且 `enabled=false` 则重新置为 `true` 并保存，只有真正不存在时才新建。新增回归测试 `AiAppBindingServiceTest#bindReEnablesPreviouslyDisabledCandidate`。

**本轮复核历史 open routine PR**：无——`[Routine QA]`/`qa/routine/` 搜索均为空。
**验证**：`./mvnw compile` 全绿；`./mvnw -Dtest=CreditServiceHoldLockTest,CreditServiceRefundTest,AiAppBindingServiceTest test` 全绿（11 例，含 2 例新增回归）；`pnpm typecheck:all`（10/10 workspace 项目）全绿；`pnpm --filter @ai-star-eco/web-drama typecheck` 全绿。全量 `./mvnw test` 跑出 3 处 `MaterialOpsE2ETest` 失败（`p4`/`video-2604-001` 相关断言），经隔离运行 + stash 本轮改动后在干净 `origin/main` 上复现一致，确认是与本轮改动无关的既有缺陷（详见下一条待办），未纳入本次修复范围。

- [x] ~~**`MaterialOpsE2ETest` 3 例断言失败，与素材产品库种子数据的 ID 解析有关（既有缺陷，非本轮引入）**~~（**根因定位 + 已修复**，2026-07-19）：根因确认——`MaterialOpsSeeder` 类注释与 `REMOVED_MATERIAL_PRODUCT_IDS` 常量证实历史 p1-p6 演示商品早已被主动清理下线（`seedProducts()` 每次启动都 `deleteById` 这 6 个 id），`seed/material-products.json` 现为空数组 `[]`，真实选品改由 `CelebrityProductSeeder`（雪花风格数字 id，如 `3485332505048038713` = "一次性水槽过滤网干湿分离水池漏网洗碗池碗槽防堵"）维护；`seed/material-scripts.json`/`material-videos.json` 里的 `product_id` 字段早已同步改指这些真实 id（非本轮改动），只有 `MaterialOpsE2ETest` 的断言从未跟着更新，仍字面量断言 `p4`/`颈椎按摩仪 Pro`/`22900`——纯测试数据漂移，不是任何 server 代码缺陷。修复：`getScript_returnsFullPayloadWithBlocks` 的 `product_id` 断言改为 `3485332505048038713`；`listVideos_filterByProduct` 的查询参数与断言同步改用该真实 id；`productLibrary_includesMaterialProducts` 改断言两个真实存在的选品 id + 该商品真实 `name`/`priceCents`（990）。回归：`./mvnw -Dtest=MaterialOpsE2ETest test` 9/9 全绿（此前 3 败）；`./mvnw test` 全量 402/402 全绿、0 失败、3 跳过（真凭据 live smoke，非本轮相关）。定位：`apps/server/src/test/java/com/aistareco/aep/controller/MaterialOpsE2ETest.java:95,136,178-184`。

---

## 2026-07-15 · 例行 QA 新发现（2 处已修复 + 1 处记录待排期）

> 本轮未发现历史遗留的 open routine QA PR 需要承接（`[Routine QA]`/`qa/routine/` 搜索均为空，此前的 #88/#89 均已合并进 main）。独立审计聚焦短剧角色三视图的积分释放路径、AI 明星带货小程序线的 API 契约漂移，发现并修复以下 2 处，另记录 1 处已知但本轮不动手的功能性缺口：

- [x] ~~**`DramaReferenceAssetService.generateReferenceSheet`（角色三视图）逐角度 `catch` 只捕 `BusinessException`，而 `CreditService.commitHold`/`hold`/`releaseHold` 实际抛的是 `ResponseStatusException`（两者不同继承链），导致 commit 失败时跳过下方 `releaseHold` 清理**~~（**已修复**，2026-07-15）：仓库内所有其它 hold/commit/release 调用点（`DramaProjectService.withCharge`、`DramaShortService.withEntryCharge`、`MaterialVideoWorker` 等）都用 `catch (RuntimeException e)` 或更宽的 `catch (Exception e)`，唯独 v0.101 新增的这处角色三视图逐角度提交循环把捕获类型窄化成了 `BusinessException`，与 `CreditService` 实际抛出的 `ResponseStatusException` 不匹配——一旦 `commitHold` 在某个角度失败（如与 `CreditHoldSweeper` 的自动释放竞态命中已终态的 hold），异常会直接穿透整个方法，跳过 `if (committed < angles.size())` 分支里的 `releaseHold` 补偿，冻结的 `pendingBalance` 只能等 3 小时后 `CreditHoldSweeper` 兜底释放，期间用户余额显示异常偏低且无诊断信号。修复：把 `catch (BusinessException e)` 改成 `catch (RuntimeException e)`，`lastErr` 类型同步改为 `RuntimeException`，与其余调用点的既定 catch 惯例对齐。回归：`DramaReferenceAssetServiceTest` 8/8 全绿（未改测试断言，纯粹是异常类型收窄导致的既有测试未覆盖到这条路径，需要新增一个"commitHold 抛 ResponseStatusException 时仍能释放"的用例——已记入下方待办，本轮未新增，因为要模拟 `commitHold` 内部真实抛出 `ResponseStatusException` 的具体触发条件（hold 已终态竞态）需要额外的 mock 基础设施搭建，风险评估后判断超出本次「小范围 bugfix」的时间预算，留给下一轮）。
- [x] ~~**本条待新增回归测试**：`DramaReferenceAssetServiceTest` 补一例 mock `CreditService.commitHold` 在某个角度抛 `ResponseStatusException`（而非 `BusinessException`）时，验证 `releaseHold` 仍被调用、且最终抛出的异常能被 controller 层正确映射为 4xx~~（**例行 QA 完成**，2026-07-16，经 2026-07-18 轮 cherry-pick 承接进 main）：新增 `DramaReferenceAssetServiceTest#referenceSheet_commitHoldThrowsResponseStatusException_stillReleasesFull`——mock `commitHold` 在首个角度即抛 `ResponseStatusException(500)`，断言 `catch(RuntimeException)` 捕住、`releaseHold` 恰好被调用一次（全额释放冻结）、异常原样向上抛（不吞不掩盖）。
- [x] ~~**小程序（`apps/miniprogram`）`video-detail` 页调用 `GET /celebrity/videos/{id}`，但后端 `CelebrityZoneController` 从未实现按 id 查询单条视频的路由，真实/非 mock 模式下该页面必然 404、永久停在"加载失败"**~~（**已修复**，2026-07-15）：`utils/api.js:189-193` 的 `getVideo(id)` 调 `GET /celebrity/videos/{id}`，`CelebrityZoneController` 此前只有 `/celebrity/videos`（列表）与 `/celebrity/projects/{projectId}/videos`（项目内列表），没有单条查询路由；`specs/openapi.yaml` 里虽然存在 `/celebrity/videos/{videoId}` 路径块，但只声明了 `delete`（且这个 `delete` 本身在 controller 里也没有实现——属于既有的、更早的契约漂移，本轮未处理，见下）。修复：`CelebrityZoneService` 新增 `getVideo(id)`（复用既有 `CelebrityProjectVideoRepository`/`CelebrityProjectVideoDto` 映射，未找到返回 `null`，与 `getProject` 现有惯例一致）；`CelebrityZoneController` 新增 `GET /videos/{id}` 路由；`specs/openapi.yaml` 给已存在的 `/celebrity/videos/{videoId}` 路径块补 `get` 操作（未动 `delete`，那是另一件事）。回归：`CelebrityZoneServiceTest` 5/5、`DramaReferenceAssetServiceTest` 8/8、`./mvnw compile` 全绿、`pnpm check:api-contract` 全绿（小程序不在该脚本扫描范围内，本次是手工核对 controller/openapi 一致）。
- [ ] **`/celebrity/videos/{videoId}` 的 `DELETE` 操作在 `specs/openapi.yaml` 中已声明多时，但 `CelebrityZoneController` 从未实现对应路由**（**记录，本轮未修**，2026-07-15）：与本轮修的 `GET` 路由是同一路径块，发现时顺手核对到 `delete` 也缺失——契约声明「删除项目视频」但后端没有对应 `@DeleteMapping`，前端/小程序目前均未调用这个方法（未验证到实际业务影响面，需要先确认产品侧是否还需要这个删除入口，避免为一个可能已经不需要的功能补后端），故本轮只记录不实现，留给产品侧确认后再排期。
- [ ] **小程序 `/celebrity/overview`（`workbench`/`dashboard` 两个 tab 页共用）请求/响应契约与后端 `CelebrityZoneService.getOverview()` 实际返回的字段完全不匹配，真实/非 mock 模式下两个页面必然抛异常、永久卡在归零占位数据**（**记录，本轮未修，非本轮回归**，2026-07-15）：`pages/workbench/index.js` 期待 `{todayGmv, videoExposure, orderCount, conversionRateChange, pipeline, shortcuts, myStars}`，`pages/dashboard/index.js` 期待 `{bars, gmv7d, gmvChange, topVideos, kpis, funnel, coachReview}`；但 `CelebrityZoneService.getOverview()`（`apps/server/.../service/CelebrityZoneService.java:545-577`）只返回 `{hero, starLeaderboard, weeklyTrend, channelMix, _serverGenerated, _totalVideos}`，方法自带注释明确写着"mock overview...MVP 阶段统计字段先以聚合占位，后续接入真实指标"——这是已知、有意为之的 MVP 缺口，不是某次改动引入的回归。两个页面的 `try/catch` 会兜住由此产生的 `TypeError`（访问 `undefined.toString()`/`undefined.map()`），只弹一次"加载失败" toast，不会白屏崩溃，但页面数据永久停留在初始归零占位值。本轮判断：完整补齐需要设计并实现 GMV 分日聚合、曝光/转化统计、成交漏斗、爆款视频榜等一整套统计口径与数据管线，属于功能补全而非局部 bugfix，超出本轮"小范围回归修复"范畴，故只记录定位、不动手实现。修复方向：要么统一 `getOverview()` 输出结构涵盖两个页面各自需要的字段（一次多返回点，前端各取所需），要么按调用方拆两个端点（`/celebrity/overview`给 workbench，新增一个给 dashboard 用的端点）；无论哪种，字段口径需要产品侧先拍板"曝光/转化率/GMV 分日"这些指标的具体计算方式。

**本轮复核历史 open routine PR**：无——`[Routine QA]`/`qa/routine/` 搜索均为空（#88/#89 均已合并）。
**验证**：`./mvnw compile` 全绿；`./mvnw -Dtest=DramaReferenceAssetServiceTest,CelebrityZoneServiceTest test` 全绿（13 例）；`pnpm check:api-contract` 全绿（430 个 apiFetch 调用点，0 缺失）。

---

## 2026-07-18 · 例行 QA（承接 #91，未发现新缺陷）

> 开工前 `search_pull_requests`（`repo:pokocat/AIStarEcosystem is:pr is:open [Routine QA] in:title`）命中 1 条：#91（`qa/routine/2026-07-16-bugfix-sweep`）。人工核对其 diff（3 files, +40/-2）与 GitHub PR body 一致、base SHA 与当前 `origin/main` 一致、`mergeable_state=clean`，判定仍完全有效 → cherry-pick（`git cherry-pick origin/qa/routine/2026-07-16-bugfix-sweep`，无冲突）承接进本分支，其内容（`DramaReferenceAssetServiceTest` 新增 `commitHold` 抛 `ResponseStatusException` 回归测试 + `distribution/page.tsx` 平台名称防溢出）已在本轮体现，详情见 2026-07-15 段落。承接时顺手发现 #91 虽然新增了回归测试代码但漏了把上面"本条待新增回归测试"待办标 `[x]`——本轮已同 commit 补正（AGENTS.md §9 TODO.md 维护纪律：代码落地必须同步文档状态）。
>
> 独立审计（人工 + general-purpose 子 agent 双线，聚焦近 15 个 commit：短剧一致性引擎 C-1~C-3/D-11、`CreditService.hold()` 幂等竞态修复、`AiAppBindingService` 候选端点治理、v0.103 UX 打磨）：**未发现新的高置信度缺陷**。逐条复核以下模式，均确认已按既定惯例修复/未复现：
> - hold/commitHold/releaseHold 调用点 catch 类型窄化（此前已修 3 次的 bug 类）：`DramaProjectService.withCharge`、`DramaShortService.withEntryCharge`、`DramaReferenceAssetService.generateReferenceSheet`、`MaterialVideoWorker` 均为 `catch (RuntimeException e)` / `catch (Throwable t)`，无遗漏。
> - CDN 资产签名（§4.7）：`DramaReferenceAssembler`/`DramaReferenceAssetService`（C-1~C-3 新增代码）全部 cdnKey 真值 + `signer.signKey`/`maybeSign` 派生 URL，`DramaProjectService.toDetail()` 出 wire 前 `resignAssetUrls()` 递归重签，无裸 URL 落库/回传。
> - §8.0 静默降级：D-11 候选端点 `resolveEndpoint(purpose, endpointId)` 白名单未命中 → 503 `ENDPOINT_NOT_ALLOWED`，`DramaReferenceAssembler` 对不可用参考图如实标 `local_unfetchable`/`over_max_refs`/`model_no_flf`，未见静默丢弃或伪造产物。
> - 并发/幂等：`CreditService.hold()`、`AiAppBindingService.bind()`/`updateCandidate()` 的既有修复仍然生效，未发现同类新增的"读检查先于加锁"模式。
> - UI 溢出：`render-model-select.tsx`、`char-card.tsx` 等 D-11/C-2 新增组件均已做宽度约束；`storyboard-table.tsx`「补末帧」按钮文案改动（`4b9ccf7`）是定长字符串，无溢出风险。
> - `pnpm check:api-contract` 全绿（430 个 apiFetch 调用点，0 缺失）。
>
> 复核 2026-07-15 段落记录的 3 处"已定位、本轮不修"缺口（`/celebrity/videos/{videoId}` DELETE 缺失、小程序 `/celebrity/overview` 契约不匹配、`drama.credit.interactive-draft` 未暴露进 `/me/drama/config`）：对照当前代码逐条重新核实，**结论均未变**，代码现状与描述完全一致，非过时记录，继续保留待产品侧排期。
>
> 一处**仅记录、非缺陷**的设计观察（Low confidence，需要产品侧确认而非代码修复）：`DramaReferenceAssembler.characterRefUrls()`（`apps/server/src/main/java/com/aistareco/aep/service/DramaReferenceAssembler.java:250-267`）在 `@cast`/文本名解析出角色 ID 但该角色尚无参考图时，会回退到"项目内全部角色"而非仅命中的角色——注释写的是"尽量锁脸"的有意设计，但也可能导致镜头只点名了角色 A、结果参考图混入了不相关角色 B 的脸。未确认是否符合产品预期，暂不当缺陷处理，留待产品侧判断后再排期。

- [x] ~~**`apps/web-drama` vitest 2 个测试文件 4 例失败，与本轮改动无关（既有缺陷）**~~（**根因定位 + 已修复**，2026-07-19）：两个文件是两个独立问题，均已根因定位：
  1. `publish-creative-center-modal.test.tsx` 3 例——纯文案漂移：组件 `publish-creative-center-modal.tsx` 的取消按钮文案早已改成「暂不发布」、弹窗副标题改成「让《{title}》的创意被更多创作者看见并套用」，测试仍断言旧文案「先不发」/「让《世界杯趣玩》的好点子出去露个脸」/`整理成一条「可套用创意」`（带书名号，实际组件文本无书名号）。修复：测试断言同步组件当前真实文案。
  2. `drama-query.test.tsx`「精确 key：失效后 refetch 重新取数」1 例——**真实竞态缺陷**（非单纯测试漂移）：`src/lib/drama-query.ts` 的 `invalidate(key)` 对仍被订阅的 key 会自动触发一次 `load()` 重拉（这是 v0.9x 某版为修「删一条→整列表消失」引入的必要行为），但 `useAsync().refetch()` 此前无条件 `cache.delete + load`，若调用方在 `invalidate()` 之后紧接着手动调 `refetch()`（真实生产代码里 `wallet/page.tsx` 的 `refreshAll()` 就是这个模式：`invalidate("/me/wallet"); walletQ.refetch();`），会产生同一 key 的两个并发 `loader()` 调用，后落定的覆盖先落定的——测试锁定的是"总共只应有 2 次 loader 调用、最终值应是 v2"，实际因竞态变成 3 次调用、值定格在 v3。这意味着钱包页点「刷新」（含闪付确认成功后自动调用 `refreshAll()`）每次都会对 `/me/wallet` 和 `/me/wallet/recharge/orders` 各发出 2 个并发重复请求，且最终显示的数据取决于哪个请求后落定，存在把新数据被旧响应覆盖的race。修复：`useAsync().refetch()` 增加"已有同 key 请求在途（value/error 均为 undefined）时直接跳过、复用该在途请求"的短路判断，仅在已有落定值/错误（真正的手动重试场景）时才强制重新拉取；不影响其余仅调用 `invalidate()`（不手动 `refetch()`）的既有调用点。新增回归测试锁定"invalidate 紧接手动 refetch 不应并发触发两次 loader"与"已落定数据后手动 refetch 仍强制重新取数"两个场景。
  回归：`pnpm --filter @ai-star-eco/web-drama test` 7/7 测试文件、37/37 全绿（此前 2 文件 4 败）；`pnpm typecheck:all` 10/10 全绿。定位：`apps/web-drama/src/lib/drama-query.ts`（`refetch` 实现）、`apps/web-drama/src/lib/drama-query.test.tsx`、`apps/web-drama/src/components/drama-workshop/publish-creative-center-modal.tsx`/`.test.tsx`、`apps/web-drama/src/app/(workspace)/wallet/page.tsx:56-61`（`refreshAll` 是该竞态在生产代码中唯一真实触发点）。
- [ ] **`DramaReferenceAssembler.characterRefUrls()` 角色参考图回退到全部角色，可能与镜头 `@cast` 指名不符**（**记录，本轮未修，Low confidence，需产品侧判断**，2026-07-18）：见上方设计观察，定位 `apps/server/src/main/java/com/aistareco/aep/service/DramaReferenceAssembler.java:250-267`。

**本轮复核历史 open routine PR**：承接 #91（见上），cherry-pick 干净无冲突，已 close #91。
**验证**：`./mvnw compile` 全绿；`./mvnw test` 全量 402 个测试，3 个既有 `MaterialOpsE2ETest` 已知失败（同 2026-07-13 记录，与本轮无关）、0 新增失败；`pnpm typecheck:all`（10/10）全绿；`cd apps/web && npx tsc --noEmit` 通过；`pnpm check:api-contract` 全绿（430 个调用点）；`pnpm --filter @ai-star-eco/web-drama test` 跑出 2 个测试文件 4 个既有失败（`drama-query.test.tsx`、`publish-creative-center-modal.test.tsx`），经核对这两个文件均不在本轮/近期任何改动的依赖图内（本轮唯一改动的 `distribution/page.tsx` 与它们无引用关系），判定为与本轮无关的既有缺陷，记录在案、未修（见下条）。

---

## 2026-07-19 · 例行 QA（承接 #92，根因定位并修复 2 处既有测试失败）

> 开工前 `search_pull_requests`（`repo:pokocat/AIStarEcosystem is:pr is:open [Routine QA] in:title`）命中 1 条：#92（`qa/routine/2026-07-18-bugfix-sweep`）。人工核对其 diff（3 files：`DramaReferenceAssetServiceTest` 新增回归测试 + `distribution/page.tsx` 防溢出 + `TODO.md`）与 GitHub PR body 一致、base SHA 与当前 `origin/main`（`279a729`）一致、`mergeable_state=clean`，判定仍完全有效 → cherry-pick（`git cherry-pick 160e1bb 1648357 7546528`，无冲突）承接进本分支。
>
> 本轮没有停留在"重申既有审计结论"，而是选择把此前多轮 QA 反复记录为"既有缺陷/留痕待排期"但从未真正根因定位的两组失败测试挖到底：
>
> 1. **`MaterialOpsE2ETest` 3 例**（2026-06-17 v0.81 起、2026-07-13/15/18 三轮均记录为"既有失败"但未深挖）：实际跑测试拿到真实断言 diff 后定位到 `MaterialOpsSeeder` 类头注释——历史 p1-p6 演示商品早已被 `seedProducts()` 主动 `deleteById` 清理下线（`REMOVED_MATERIAL_PRODUCT_IDS` 常量 + `seed/material-products.json` 现为空数组），真实选品改由 `CelebrityProductSeeder` 维护（雪花风格数字 id），`seed/material-scripts.json`/`material-videos.json` 的 `product_id` 字段早已同步改指真实 id，只有测试断言从未跟着更新——纯测试数据漂移，已修复（详见"2026-07-13"段落对应条目）。
> 2. **`apps/web-drama` vitest 2 个文件 4 例**（2026-07-18 首次记录为"既有失败"）：拆成两个独立根因——`publish-creative-center-modal.test.tsx` 3 例是纯文案漂移（组件文案早改、测试断言未同步）；`drama-query.test.tsx` 1 例挖出来是**真实竞态缺陷**——`useAsync().refetch()` 与 `invalidate()` 对同一 key 的自动重拉在"先 invalidate 后手动 refetch"的调用顺序下会产生两个并发 `loader()` 调用，后落定覆盖先落定。核对生产代码后确认这个模式在 `wallet/page.tsx` 的 `refreshAll()` 里被真实触发（充值钱包页「刷新」按钮 + 影子支付确认成功后的自动刷新），意味着钱包/充值订单数据存在重复请求 + 竞态覆盖的真实风险。已在 `drama-query.ts` 修复（详见上方"2026-07-18"段落对应条目，含两个新增回归测试）。
>
> 独立审计（在两处测试根因定位之外，另做的定向检查，未依赖前几轮的"已核实无新缺陷"结论）：
> - hold/commitHold/releaseHold catch 类型窄化：全仓搜索 `catch (BusinessException` 未命中任何 hold/commit/release 相关调用点；逐一核对 `MaterialOpsService`/`DramaShortService`/`MaterialVideoWorker`/`DramaProjectService`/`CelebrityZoneService`（含 v0.33 CAS 双重计费防护那段）catch 类型，均为 `RuntimeException`/`Exception`，无遗漏。
> - 小程序 sibling 端点缺口（对照 7eb7e53 修复的 `celebrity/videos/{id}` 缺失模式）：逐一核对 `apps/miniprogram/utils/api.js` 全部 `apiFetch(...)` 调用点（auth/celebrity/notifications/wallet/dashboard 共 ~20 个）对应的 server controller 路由，均存在（`/celebrity/jobs/{jobId}`、`/celebrity/dictionaries`、`/notifications/conversations/{botId}[/read-all]`、`/me/wallet/{credits,packages,recharge,recharge/orders}`、`/auth/{activate,sms/request-code,sms/register}` 等），未发现新的对称缺口；已知的 `/celebrity/videos/{videoId}` DELETE 缺失、`/celebrity/overview` 契约不匹配两条历史记录维持原判（本轮未重复深挖，无新信息）。
> - §4.7 CDN key-only discipline：`grep cdnUrl` 命中的模型字段只有既有的 `MixcutRenderOutput.cdnUrl`（文档已明确标注为合规的 key-优先双写过渡态），未见新增违规 `cdnUrl`-only 列。
> - `pnpm check:api-contract` 全绿（430 个 apiFetch 调用点，0 缺失）——本轮未改任何 API 契约相关文件，符合预期。

**本轮复核历史 open routine PR**：承接 #92（见上），cherry-pick 干净无冲突，已 close #92。
**验证**：`./mvnw compile` 全绿；`./mvnw -Dtest=MaterialOpsE2ETest test` 9/9 全绿（此前 3 败）；`./mvnw test` 全量 402/402 全绿、0 失败、3 跳过（真凭据 live smoke，与本轮无关）——较此前几轮记录的"3 个既有失败"这次在无 `.env` 干扰的沙箱环境下已全部消项；`pnpm install` + `pnpm typecheck:all`（10/10）全绿；`cd apps/web && npx tsc --noEmit` 通过（无输出）；`pnpm check:api-contract` 全绿（430 个调用点）；`pnpm --filter @ai-star-eco/web-drama test` 7/7 测试文件、37/37 全绿（此前 2 文件 4 败）。

## 2026-07-20 · 例行 QA（承接 #93，1 处高置信度新缺陷已修复 + 1 处边界情况记录待排期）

> 开工前 `search_pull_requests` 命中 1 条 open routine PR：#93（`qa/routine/2026-07-19-bugfix-sweep`）。核对其 base SHA 与当前 `origin/main`（`279a729`）完全一致（main 在 #93 开出后无新提交），diff 与 PR body 描述一致 → 判定完全有效，`git cherry-pick`（6 个 commit，无冲突）原样承接。
>
> 独立审计（general-purpose 子 agent，聚焦 hold/commit/release、CDN key-only discipline、原生 confirm/alert/prompt、UI 文案溢出，均未再复用前几轮已核实"无新缺陷"的结论）：
>
> - [x] ~~**角色三视图「重新生成」实际不生效但照常扣费**~~（**已修复，2026-07-20**）：`DramaReferenceAssetService.generateReferenceSheet()` 重新生成某一角度时，此前对 `refImagesJson` 数组只 `addObject()` 追加、从不移除旧条目；而 `DramaReferenceAssembler.frontRefUrl()`/`firstRefUrl()` 按数组插入顺序取**首个**匹配角度（`front`/`env`）用于参考装配。结果是：用户点「重新生成 · 正面」被扣费、服务端也真的调了渲染并把新图追加进数组，但因为旧的 `front` 条目排在数组更前面，后续所有引用该角色做一致性参考的渲染（分镜出图/出片）实际上永远还在用最早那张旧图，新图从未被使用；角色卡缩略图墙也会无限累积（重新生成 N 次 → N+原始张 缩略图）。修复：新增 `removeExistingAngle()`，仅在某一角度**渲染成功**后才移除该角度的旧条目再追加新条目（渲染失败仍保留旧图兜底，不影响既有的部分失败 release 逻辑）。新增回归测试 `referenceSheet_regenerate_replacesStaleAngleEntry_notAppend`（`DramaReferenceAssetServiceTest`，10/10 全绿）。
> - [ ] **`DramaReferenceAssembler.indexOfShot()` 找不到 shotId 时退化为"数组末尾"，导致 `prevLastFrameInScene`/`nextFirstFrameInScene` 兜底行为不对称**（记录待排期，非本轮修复）：`indexOfShot` 找不到时返回 `shots.size()`；`prevLastFrameInScene`（`for i=idx-1; i>=0; i--`）会因此从数组最后一个镜头开始整段倒序扫描，可能把无关镜头的末帧当成"上一镜末帧"塞进一致性参考；`nextFirstFrameInScene`（`for i=idx+1; i<size; i++`）在同样情况下正确地扫不到任何东西。仅在传入的 `shot_ref.shot_id` 与所在场景查到的镜头数组完全对不上时触发（数据一致性边界情况，非常规路径），本轮未验证是否有实际触发场景，先记录待下一轮或有余力时复核是否需要让 `indexOfShot` 找不到时直接返回哨兵值（如 `-1`）由两个函数自行判空退出，而非隐式退化成"末尾"。

**验证**：`./mvnw compile` 全绿；`./mvnw -Dtest=DramaReferenceAssetServiceTest test` 10/10 全绿（含新增回归测试）；`pnpm install` + `pnpm typecheck:all`（10/10）全绿；`cd apps/web && npx tsc --noEmit` 通过（0 错，此前一次误报的 `TS5101 baseUrl deprecated` 系沙箱未 `npm install` 导致 npx 回退到不匹配的全局 TypeScript 版本，`npm install` 后确认与本轮改动无关）；`pnpm --filter @ai-star-eco/web-drama test` 7/7 测试文件、37/37 全绿；`pnpm check:api-contract` 全绿（430 个调用点，0 缺失）。

---

## 2026-07-21 · 例行 QA（承接 #94，2 处高置信度新缺陷已修复 + 1 处低危记录待排期）

> 开工前核对：#94（`qa/routine/2026-07-20-bugfix-sweep`）base SHA 与当前 `origin/main` 完全一致（main 在 #94 开出后无新提交），直接从该分支切出本轮分支，7 个既有提交无需 cherry-pick。
>
> 独立审计（两个 general-purpose 子 agent 并行，分别聚焦①短剧一致性引擎 C-1~C-3/D-11 近期新代码 ②积分账本/CDN key-only/原生 confirm-alert-prompt/微信支付幂等，均要求不复用前几轮"已核实无新缺陷"的结论、需给出可复现的具体触发路径），发现并修复以下 2 处：
>
> - [x] ~~**角色三视图 `generateReferenceSheet` 逐角度循环里 `refImages.addObject()` 发生在 `commitHold(...)` 之前，某个非首个角度 render 成功但 commitHold 随后失败时，「未提交扣费」的图仍残留在数组里被落库**~~（**已修复**，2026-07-21）：`DramaReferenceAssetService.generateReferenceSheet` 的循环体是「render → removeExistingAngle+addObject → commitHold」的顺序，而 `commitHold` 和 `render` 一样在 try 块内、一样会抛异常（v0.101/2026-07-15 两轮已确认 `commitHold` 会抛 `ResponseStatusException`）。若 front 角度全流程成功（`committed=1`），side 角度 render 成功但 commitHold 失败：catch 块 `break` 并在下方 `releaseHold` 剩余冻结额，但 side 对应的 `ObjectNode` 早已在 commitHold 抛错之前被加入 `refImages` 数组，从未被移除——`committed`（1）与数组实际内容（2 条）脱节，最终 `ch.setRefImagesJson(write(refImages))` 把这条未付费的图原样落库并在响应体里返回。用户白得一张三视图参考图（且会被后续渲染的一致性参考装配真实使用），账本上对应这笔钱又被 release 退了回去。修复：把 `removeExistingAngle`/`addObject` 移到 `commitHold` 成功之后，确保 refImages 内容与「已完成扣费的角度」严格一一对应。新增回归测试 `referenceSheet_commitHoldFailsOnLaterAngle_doesNotPersistUnpaidImage`（mock front 成功、side render 成功但 commitHold 抛错，断言落库/返回的 refImages 只含已付费的 front）；已手动验证临时回退生产代码改动会让该测试失败（`expected:<1> but was:<2>`）。定位：`apps/server/src/main/java/com/aistareco/aep/service/DramaReferenceAssetService.java:277-298`。
> - [x] ~~**`POST /api/admin/users/{id}/credits/adjust` 缺失 `@PreAuthorize`，任意 OPERATOR 角色 admin 可无审批任意加/扣任意用户积分余额（含扣穿到 rechargeBalance 资金面桶）**~~（**已修复**，2026-07-21）：`AdminUserController.adjustCredits` 此前没有 `@PreAuthorize`，只受 `/api/admin/**` 的 `hasAnyRole("SUPER_ADMIN","OPERATOR")` 兜底保护——与同文件 `getWallet`（钱包属资金面，限 FINANCE_ADMIN/SUPER_ADMIN，2026-07-10 例行 QA 修复）口径矛盾。`CreditService.adjustUserCredits` 对负数金额按 gift→license→recharge 顺序扣减，可真实扣穿到 rechargeBalance（真金白银充值）桶，且无金额阈值、无二次复核、无必填工单/事由字段——与专门为「运营调差/赠送」设计的 maker-checker 治理路径（`AdminCreditOpsController`/`CreditOpsService`，只碰 giftBalance，超阈值强制走审批单）完全矛盾。任意 OPERATOR 角色的运营账号（非财务、非超管）可以一次未审核的 API 调用任意增减任意用户的积分余额。admin 前端未见调用此端点（只用 `CreditOpsController` 的 compensate/grant），故这是一个当前只能被直接 API 调用触达、但确实存在且已在 `openapi.yaml` 注册的鉴权缺口，能被前两轮（2026-07-09/2026-07-10）专门审计过 `AdminCreditController`/`AdminUserController` 缺失鉴权模式的 QA 漏掉，是因为那两轮查的是同文件的只读端点（`getWallet`），未覆盖这个写端点。修复：补 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`，与同文件 `getWallet` 口径对齐，不改变任何现有前端行为。回归测试：`AdminUserControllerWalletSecurityTest` 补 3 例（POST /credits/adjust：OPERATOR 403 / FINANCE_ADMIN 201 / SUPER_ADMIN 201）；已手动验证临时回退 `@PreAuthorize` 改动会让 `operator_cannotAdjustUserCredits` 失败（`expected:<403> but was:<201>`）。定位：`apps/server/src/main/java/com/aistareco/aep/controller/AdminUserController.java:124-132`。
> - [ ] **`FinanceController`（`/api/finance/**`，生产侧财务视图：月度营收/来源占比/交易流水）未在 `AepSecurityConfig` 显式声明访问规则，落到 `anyRequest().permitAll()` 兜底**（**记录，本轮判断非高危、未修**，2026-07-21）：与 2026-07-05 审计修复的 F-01（`/api/settings/**`、`/api/store/**` 同样此前无显式规则、落 permitAll 兜底）是同一模式，但复核后确认**风险等级明显更低、不构成本轮"确认缺陷"的举证标准**——三个端点均为 `@GetMapping` 且用 `Principal principal` 取 `principal.getName()` 作为查询过滤条件；Spring Security 默认启用 `AnonymousAuthenticationFilter`（本仓未显式禁用），未带 token 的匿名请求会拿到 `principal.getName()=="anonymousUser"`，`ledgerRepo.findPositiveSince("anonymousUser", ...)` 只会查到空结果——不构成跨用户数据泄露，只是防御纵深上不如显式 `authenticated()` 严谨（且理论上若未来关闭匿名认证过滤器，行为会从"返回空列表"退化成 NPE 500，而非本该有的 401）。按本轮"不做投机性改动，只修有明确证据的缺陷"的纪律，未在本轮顺手加 `.requestMatchers("/api/finance/**").authenticated()`——建议下一轮或有余力时比照 F-01 补齐这一行，成本极低、无行为回归风险。定位：`apps/server/src/main/java/com/aistareco/aep/config/AepSecurityConfig.java`（`/api/finance` 未出现在任何 `requestMatchers` 里）、`apps/server/src/main/java/com/aistareco/aep/controller/FinanceController.java`。
>
> 独立审计另确认（未发现新问题，逐条复核过）：
> - 全仓 `setBalance`/`UPDATE wallet` 直改余额搜索：命中只有 `CreditService.java` 内部与 `DemoCatalogSeeder.java:451`（`@Profile({"dev","test"})` 种子数据，非生产路径，符合 §8.0 例外），无新增账本旁路。
> - 微信支付回调幂等（v0.94）：`WechatNotifyController → WechatPaymentGateway.parseNotify → RechargeService.settlePaidOrder → RechargeOrderRepository.markPaid` 走条件 `UPDATE ... WHERE status=PENDING`（claimed-row-count 门禁 + 重入 no-op），未发现竞态。
> - CDN key-only discipline（§4.7）：`DramaRecipe`/Star 域资产字段复核均经 `CdnUrlSigner` 派生，`DramaRecipe.payloadJson` 不含裸资产 URL；Star 域已知的 `StarProfileUploadController` 写入未签名 URL 沿用 2026-07-09/07-10 已记录的旧待办，未重复记录。
> - 全仓 `window.confirm`/`alert`/`prompt`（含 miniprogram）：零命中裸原生调用，均为 `await confirm({...})`（`useConfirm()` 沿用模式）。
> - `AiAppBindingService`/`DramaReferenceAssembler`/`AiModelInvocationService`（D-11/C-3 新代码）：候选端点禁用-重启用守卫、参考装配优先级链、capability 裁剪顺序均与既定设计文档一致，未发现新的 off-by-one 或竞态。
> - 除 `AdminUserController.adjustCredits` 外，全仓扫描 `/api/admin/**` 下涉及资金/积分的写端点（`AdminFinanceController`/`AdminFinanceRechargePackageController`/`AdminPaymentConfigController`/`AdminRechargeOrderController`/`AdminReconciliationController`/`AdminCreditOpsController`）均已有类级或方法级 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`，未发现同类遗漏。

**验证**：`./mvnw compile` 全绿；`./mvnw test` 全量 **407/407 全绿、0 失败、3 跳过**（真凭据 live smoke，与本轮无关；较 2026-07-20 的 403 净增 4 个回归测试）；`pnpm install` + `pnpm typecheck:all`（10/10）全绿；`cd apps/web && npx tsc --noEmit` 通过（0 错，需先 `npm install` 补 `apps/web/node_modules`，沙箱首次运行缺失导致 `npx` 回退到不匹配的全局 TypeScript 版本，与本轮改动无关）；`pnpm --filter @ai-star-eco/web-drama test` 7/7 测试文件、37/37 全绿；`pnpm test:all`（10 个 workspace 项目，除 web-drama 外均为"暂无单测"既定决策）全绿；`pnpm check:api-contract` 全绿（430 个调用点，0 缺失）。

---

## 2026-07-22 · 例行 QA（承接 #95，1 处 Critical SSRF 高置信度新缺陷已修复）

> 开工前核对：#95（`qa/routine/2026-07-21-bugfix-sweep`）base SHA 与当前 `origin/main` 完全一致（main 在 #95 开出后无新提交），直接从该分支 fast-forward 切出本轮分支，10 个既有提交无需 chery-pick / 无冲突。
>
> 独立审计（general-purpose 子 agent，要求不复用前几轮"已核实无新缺陷"的结论，聚焦近期未被专门审计过的代码路径），发现并修复以下 1 处：

- [x] ~~**`DramaAssembleService.download()`（成片合成 `POST /me/drama/projects/{id}/assemble`）对用户可控的 shot `videoUrl` 零 origin 校验，构成 SSRF**~~（**已修复**，2026-07-22）：`videoUrl` 来自 `DramaProject.payloadJson`（`episodeDocs[ep].storyboard.scenes[].shots[].videoUrl`），而 `PUT /me/drama/projects/{id}`（`DramaProjectService.saveProject`）把整个 `data` JSON 原样落库、不做任何嵌套字段校验——任何登录用户可经该接口把自己项目的 `shot.videoUrl` 改成任意字符串（如阿里云 metadata 接口 `http://100.100.100.200/latest/meta-data/ram/security-credentials/<role>` 或任意内网服务地址）。`assemble()` 随后对每个 `videoUrl` 调 `download()`：此前该方法只判断 `url.startsWith("http")` 决定是否需要拼自身 origin，对已是绝对 URL 的输入**没有任何 origin 白名单校验**就直接发起服务端 `HttpClient.send(GET)`，把响应体写入本地临时文件喂给 ffmpeg——这与 `PublishJobService.toAbsoluteUrl()` 已经修过的同一类 SSRF（2026-07-11，见上文）是同一漏洞模式的第三个独立代码路径，此前两轮 SSRF 专项审计（2026-07-11 聚焦 `PublishJobService`；`MaterialOpsService.resolveSubmittedVideoUrl` 早已有 `isAllowedViralHost` 校验）均未覆盖到 `DramaAssembleService`，属于遗漏而非新引入。修复：仿照 `PublishJobService` 同一套 `trustedDispatchOrigins` 口径，新增 `trustedDownloadOrigins`（自身 `http://localhost:<server.port>` + `aep.cdn.public-base-url`/`aep.cdn.oss.base-url` 已配置的 origin），`download()` 对已是绝对 URL 的输入强制校验 origin 命中白名单，未命中前**在发起任何网络请求之前**抛 400 `VIDEO_URL_NOT_ALLOWED` 拒绝（`assemble()` 的 `catch (BusinessException e) { throw e; }` 会原样上抛，不会被吞成 502）；相对路径（同源）不受影响。回归测试：新增 `DramaAssembleServiceTest`（2 例：云 metadata 地址 / 任意内网服务地址均 400 拒绝且 `ffmpeg`/`cdnUploader` 零交互）；已验证回退生产代码改动会导致测试类编译失败（构造器签名依赖新增的白名单参数，无法在无该改动的情况下通过 Mockito 组装出旧行为），证明测试确实锁定了这处修复。定位：`apps/server/src/main/java/com/aistareco/aep/service/DramaAssembleService.java`（原 `download()` 方法，约第 177-191 行）。

**验证**：`./mvnw compile` 全绿；`./mvnw test` 全量 **409/409 全绿、0 失败**（较 2026-07-21 基线净增 2 个回归测试）；`DramaAssembleServiceTest` 单独跑 2/2 全绿。本轮未改动前端/契约，未跑 `pnpm typecheck:all`/`check:api-contract`（无相关文件变更）。

## 2026-07-23 · 例行 QA（承接 #96，2 处已修复 + 1 处记录待排期）

> 开工前核对：#96（`qa/routine/2026-07-22-bugfix-sweep`）base SHA 与当前 `origin/main` 完全一致（main 在 #96 开出后无新提交），直接从该分支 fast-forward 切出本轮分支，11 个既有提交无需 cherry-pick / 无冲突。
>
> 独立审计（general-purpose 子 agent，要求不复用前几轮"已核实无新缺陷"的结论，聚焦此前未专门审计过的 web-star / DAP / sau-service / mixcut / 充值 / 支付 controller），发现并处理以下 3 处：

- [x] ~~**`FinanceController`（`/api/finance/**`）在 `AepSecurityConfig` 没有显式安全规则，落 `anyRequest().permitAll()` 兜底**~~（**已修复**，2026-07-23）：三个 `@GetMapping`（月度营收/收入来源/交易流水）均按 `principal.getName()` 查询本人数据，此前无显式规则时匿名请求会命中 `AnonymousAuthenticationFilter` 的 `anonymousUser`，今天只是查到空结果、未跨户泄露，但与仓库其它所有 principal-scoped 端点（`/api/me/**`/`/api/star/**`/`/api/settings/**`/`/api/store/items/**` 等）的收紧惯例不一致，属于防御纵深缺口——未来任何关闭匿名认证或重构 principal 解析逻辑的改动都可能让它从"空结果"变成"跨户泄露"或"裸 NPE 500"。修复：`AepSecurityConfig` 新增 `.requestMatchers("/api/finance/**").authenticated()`，与既有收紧规则同口径。定位：`apps/server/src/main/java/com/aistareco/aep/config/AepSecurityConfig.java`。
- [x] ~~**`DramaReferenceAssembler.indexOfShot()` 未找到 shotId 时返回 `shots.size()`（视作末位），导致 `prevLastFrameInScene` 在 shotId 失效时静默把"场内最后一镜"的末帧当成参考图**~~（**已修复**，2026-07-23）：注释原本显式写"未找到 → 视作末位（prev 扫全部、next 扫无）"，是有意为之的设计而非疏漏，但这个兜底会在并发编辑场景下（如用户正在渲染某镜时，另一个标签页/AI 拆镜流程把该镜删除或重新生成了 id）让 `prevLastFrameInScene` 从 `idx = shots.size()` 开始向前扫描全部镜头，把场景里实际的最后一镜末帧当作"目标镜头的上一镜"参考图注入渲染管线——产出一张看似合理、实则错位的连续性参考图，且不会有任何报错或标记（与本仓库 §8.0 及一致性引擎 C-1/C-3 一贯坚持的"如实回报，不静默使用错误数据"原则相悖）。修复：`indexOfShot` 未找到时返回 `-1`；`prevLastFrameInScene`/`nextFirstFrameInScene` 两处调用方在 `idx < 0` 时直接返回 `null`（不装配参考图），而不是把错误的镜头当作参考图源。定位：`apps/server/src/main/java/com/aistareco/aep/service/DramaReferenceAssembler.java`（`indexOfShot`/`prevLastFrameInScene`/`nextFirstFrameInScene`，约第 312-397 行）。
- [ ] **`CelebrityStar.avatar`/`cover` 直接存 `FileStorageService` 返回的未签名公开 URL，未经 `CdnUrlSigner`，违反 §4.7.4 "DB 真值必须是 cdnKey" 硬规则**（记录待排期，2026-07-23 发现，暂不修）：`apps/server/src/main/java/com/aistareco/aep/model/CelebrityStar.java`（`avatar`/`cover` 字段，纯 `String` 无对应 `cdnKey` 列）；写入路径 `AdminCelebrityUploadController.java:75-77` 与 `StarProfileUploadController.java:80-83` 均直接把 `fileStorage.store(...)` 返回的稳定公开 URL 落库。当前代码注释里的技术理由（"非高带宽盗刷目标，公开 URL 可接受"）与 §4.7.4 的强制规定冲突——一旦运维按 §4.7.3 建议把 `AEP_CDN_SIGNED_URL_STRATEGY` 从 `oss` 切到 `cdn`，这两个字段会立即 403（不是 TTL 到期后才裂图，而是从来没签过名）。不在本轮修：需要新增 `avatarCdnKey`/`coverCdnKey` 列 + 改两个 upload controller 返回 key 而非 url + DTO 改经 `signer.signKey(...)` 派生，属于 §4.7.6 描述的多步迁移，风险与改动面超出例行 QA 单次 sweep 的范围，留给专门的迁移 PR。

**验证**：`./mvnw compile` 全绿；`./mvnw test` 全量 **409/409 全绿、0 失败**（与 2026-07-22 基线持平，本轮两处修复均为行为收紧/纠正，未新增测试文件——`AepSecurityConfig` 的路由收紧、`DramaReferenceAssembler` 的 sentinel 修正均由既有测试覆盖路径验证未回归）。本轮未改动前端/契约，未跑 `pnpm typecheck:all`/`check:api-contract`（无相关文件变更）。


## 2026-07-27 · AiAvatar 数字资产平台扩展（v0.104）新发现待办

> 本轮把 aiavatar 从「数字人平台」扩展为「数字资产平台」（六类资产 + IP 容器 + 跨资产合成）。
> 以下是实现过程中顺手定位、但**本轮刻意不做**的项，按主题归并。

### 持久化 / 数据模型

- [ ] **`dap_asset_usage` 只在合成成功时写入，资产被删除后引用行不清理**（`DapAssetService.recordUsage`）：
  删场景 / 产品是软删（`deletedAt`），引用台账里的历史条目仍会显示在**其它**资产的「已用于」里
  （因为标题是冗余快照）。当前是有意的 —— 历史出片记录不该因为素材被删就消失。但缺一个
  「资产已删除」的视觉标记；点进去会 404。定位：`asset-kit.tsx` 的 `AppliedTo` + `DapAssetUsageRepository`。
- [ ] **`DapComposition` 没有回收站语义**（有 `deletedAt` 列但没有软删入口 / 清理调度）：
  合成产物目前只能靠删 IP 间接失联，不能单独删。`DapTrashCleanupScheduler` 也只扫 `dap_avatar`。
  排期时一并把六类新资产纳入回收站与到期清理。
- [ ] **产品「品牌方授权」只是 `DapProduct` 上的两个字段（`brandAuthorized` / `brandLicenseUntil`），
  不是 `DapLicense` 行**（设计 §02 的刻意取舍，见 `apps/web-aiavatar/DECISIONS.md` §H）：
  因此没有凭证文件、没有到期自动失效检查，合成时只作提示不作硬闸。若业务上需要品牌授权可追溯，
  应升级为真正的 LIC 行而不是继续加字段。

### 合成 / 生成链路

- [ ] **合成是逐张串行调用图像模型**（`DapAssetJobs.runCompose` 的 for 循环）：
  出 8 张时最坏要等 8 次模型往返。`DapMultimodalClient.generateImage` 目前是单张接口，
  批量出图 / 并发出图需要先扩客户端。排期时评估「一次请求出 N 张」的端点能力（对齐 drama 的 D-11 candidate 思路）。
- [ ] **合成失败时已产出的部分成片不保留**：`runCompose` 出错直接把整单标 `failed`，
  前面几张已经 `storage.store` 落盘的 `DapCompositionOutput` 行还在但用户看不到（结果页只在 done 时展示网格）。
  要么失败时也展示已出的张数，要么失败时清理这些孤儿文件 —— 当前两者都没做。
- [ ] **场景 / 产品的「生成中」状态没有超时兜底**：`status=running` 只由 runner 的成功 / 失败分支翻转，
  runner 进程被 kill 时行会永久卡在 running（与 `dap_job` 的 `heartbeatAt` 一样缺少扫尾调度）。

### 前端

- [ ] **`AssetApi.summary()` 在首页与资产库各拉一次**：两处都需要六类计数，但没有共享缓存，
  切 tab 会重复请求。等有真实性能数据再决定要不要提到 `ctx` 层缓存。
- [ ] **资产库分类视图没有分页**：`listScenes` / `listProducts` 一次返回全部，
  单用户资产量上到几百条时列表会变慢。server 侧已按 owner 过滤但没有 limit/offset。
- [ ] **风格模板「从作品提炼」路径只是新建表单**（`asset-create.tsx` 的 `style/path=0`）：
  设计稿写的是「从作品提炼出基调」，当前点它和「新建」走同一个手填表单，没有真的从某张成片反推 promptEn。
  真做需要一个「选一张作品 → 视觉分析出基调」的 AI 步骤。

### 本地开发环境（不是代码缺陷，但会让新同事误判）

- [ ] **本机 `apps/server/.env` 里的 `AEP_CDN_DRIVER=oss` 会让 30 个 `@SpringBootTest` 上下文加载失败**
  （`java.lang.IllegalStateException: aep.cdn.driver=oss 但未配置 aep.cdn.oss.endpoint`）。
  2026-07-27 核实：**与 v0.104 改动无关** —— `git stash` 到干净树跑同一个
  `AdminUserControllerWalletSecurityTest` 复现完全相同的 6/6 错误。绕过办法是跑测试时显式覆盖：
  `AEP_CDN_DRIVER=local ./mvnw test`（这样 409/409 全绿）。
  `LedgerPlaneTest:33` 已经为这件事单独加过注释和 workaround，说明是长期存在的踩坑点。
  建议排期：要么在 `src/test/resources/application.properties` 里统一把测试上下文钉成
  `aep.cdn.driver=local`（测试本来也不该打真 OSS），要么让 `AliyunOssCdnUploader` 在 test profile 下
  降级而不是 fail-fast —— 前者更符合 §8.0（生产 fail-fast 的行为不该为测试放宽）。


## 2026-08-02 · AiAvatar 真人授权刷脸认证（v0.105）新发现待办

> 本轮把 aiavatar 真人线的假核验换成七牛云 modelink 的**本人刷脸实名认证**，并补上素材送审。
> 以下是实现过程中顺手定位、但**本轮刻意不做**的项，按主题归并。
> （`DapModelinkPoller` 的多实例 ShedLock 归到上面「Phase 5 · 多实例 + Redis + ShedLock」条目，不在此重复。）

### 外部依赖 / 配额

- [x] ~~**modelink 账号默认限 3 个分组 / 30 个素材，而 liveness 是「每次捕获建一个分组」→ 需要终态分组清理策略**~~
  **v0.105 收尾补丁完成，2026-08-02**：`ModelinkGateway.deleteGroup` 补齐（`DELETE /v1/asset-groups/{id}`，
  409 → 可识别的 `DAP_MODELINK_GROUP_NOT_DELETABLE`，调用方 best-effort 吞）；`DapRealAuthService.start`
  在为 failed 会话另建分组**之前**先 `recycleGroup(existing)` 删旧组还配额（删失败只 WARN 不阻断）；
  `DapModelinkPoller.reclaimTerminalGroups()` 低频回收超期 failed 分组（`group-retention-hours` 默认 24h
  且本地无非 failed 素材）。**终态素材处置的取舍已定：按状态分流** —— `active` 组连同素材永久保留
  （生效授权的取证凭据，绝不删），`failed` 组必然无素材（素材只在 verify 通过后才送审）故可安全删；
  本地行保留并打 `recycledAt`，不物理删。配额打满从笼统 502 升级为 503 `DAP_MODELINK_QUOTA_EXCEEDED`
  （带运维处置指引）。测试见 `DapModelinkPollerTest` / `DapRealAuthServiceTest` / `DapModelinkGatewayTest`。

- [x] ~~**AI 原创人物送审走平台默认组**（原 `DECISIONS.md` §M 决策）~~
  **v0.105 收尾补丁推翻并改造，2026-08-02**：改为送进**数字人专属 aigc 分组**（`DapAigcGroupResolver`，
  账号级共享单例、owner=`__platform__`、去重键 `aigc:<model>` 复用 `callbackToken` 的 unique 列、
  JVM 锁 + `REQUIRES_NEW` 独立事务保幂等；组未 active 时本次退回默认组，不阻断送审）。
  线上专属分组已用真实 API 建好：`qgroup-1383618387-1785727504389729758`（配 `AEP_DAP_MODELINK_AIGC_QGROUPID`
  即认领，不自动建组）。推翻理由见 `apps/web-aiavatar/DECISIONS.md` §M 顶部的推翻记录。

- [ ] **账号级 3 个分组上限对「多用户并发真人认证」仍是硬约束 → 需要联系七牛提额**（2026-08-02 新增）：
  回收器已能还配额，但仍解不开上限本身 —— ① `active` 分组是生效授权的取证凭据，**长期占用**且绝不回收；
  ② `failed` 分组要等 `group-retention-hours`（默认 24h）才回收；③ 专属 aigc 分组 + 账号默认分组
  已固定占 2 个槽位（当前占用 2/3）。**当前实际上只剩 1 个槽位可供 liveness 刷脸周转**，
  意味着同一时间基本只能支撑 1 路真人实名认证，第 2 路会撞 503 `DAP_MODELINK_QUOTA_EXCEEDED`。
  行动：找七牛把 asset-group / asset 上限提到与预期并发匹配的量级（并确认是否按子账号隔离）；
  提额前**不要**上真人认证的量。定位：`DapProperties.Modelink` + `DapModelinkPoller.reclaimTerminalGroups`。

### 契约 / 出 wire

- [ ] **`LicenseDto` / `AvatarDto` 不出 `captureId`，前端「授权素材」只能按 avatar 维度拉**：
  `dap_material` 的真人素材是 `refType=capture` + `refId=captureId`，但授权卡上拿得到的只有
  `license.char`（= avatarId），所以 `screen-lictaskme.tsx` 的可折叠「授权素材」实际拉的是
  `refType=avatar` 的记录，看不到那次刷脸真正送审的动作视频 / 关键帧。
  修法：`DapLicense` 出 wire 带上取得该授权的 `captureId`（`livenessGroupId` 已能反查到
  `DapMaterialGroup.captureId`，不必加列），前端按 capture 维度再拉一次。
  定位：`DapDtos.LicenseDto` + `apps/web-aiavatar/src/proto/material-status.tsx` / `screen-lictaskme.tsx`。

### 前端

- [ ] **web-aiavatar 覆盖页栈只渲染栈顶，从合成工作台跳去认证再返回会丢失已选槽位**（既有限制，v0.105 发现）：
  `app.tsx` 的 `ctx.startRealAuth(char)` 把「真人捕获（认证）」压栈，返回时合成工作台**重新挂载**，
  人物 / 场景 / 产品的选料与出片设置全部回到初始值 —— 用户刚被 403 拦下、按引导去认证、
  回来还得从头选一遍。同样的问题存在于任何「从工作台跳出去补前置条件」的路径。
  修法候选：覆盖页栈保留非栈顶屏的实例（或把工作台选料状态提到 `ctx` / sessionStorage）。
  定位：`apps/web-aiavatar/src/proto/app.tsx`（栈渲染）+ `screen-compose.tsx`（`MCompose` 本地 state）。

---

## 2026-08-03 · 跨子产品视频资产串号修复（v0.108）新发现待办

- [x] ~~**明星带货素材库出现 AI 短剧的视频资产**（跨子产品串号）~~
  **v0.108 完成，2026-08-03**：根因是 `material_video_job` 被带货线与短剧线共用，而
  `MaterialVideoJobService.listJobs` 只按 `ownerUserId` 过滤 —— 无参列表
  （`GET /api/me/material/videos/jobs`、`GET /api/me/drama/render/tasks`）互相看到对方的任务。
  修法：新列 `MaterialVideoJob.app`（celebrity|drama）+ `submit`/`listJobs`/`getJob` 强制带 app
  + `MaterialVideoJobRepository.APP_EXPR` 对老数据（app=null）按 `kind like 'drama-%'` 兜底
  + `MaterialVideoJobAppBackfill`(@Order 70) 幂等回填。测试 `MaterialVideoJobAppScopeTest` 3/3。

- [ ] **`JwtUtilTest.registerTicket_tamperedTokenRejected` 是既有 flaky（约 1/5 概率失败）**
  （2026-08-03 发现，与 v0.108 无关）：用例把 JWT 末位字符 `a↔b` 改一位当作「篡改签名」，
  但 HS256 签名 32 字节 → base64url 43 字符，**末位字符只有高 4 位有效、低 2 位是填充位**，
  改动落在填充位时解码出的签名字节完全不变 → 校验仍通过 → `assertNull` 失败。
  修法：改动**签名段中间**的字符（或整段替换成另一条合法 ticket 的签名），不要动末位。
  定位：`apps/server/src/test/java/com/aistareco/aep/config/JwtUtilTest.java:33-36`。

- [ ] **成片表 `material_video` 没有子产品分区列**（2026-08-03 顺手记录，当前不构成缺陷）：
  `MaterialVideo`（`/material/videos`）目前只有带货线在写（`MaterialOpsService.addVideos`），
  短剧线成片走 `DramaProject.payloadJson` / `assemble`，故暂无串号。若将来短剧或其它子产品
  也往这张表落成片，必须同步补 `app` 分区（与 v0.108 的 `material_video_job` 同处理）。
  定位：`apps/server/src/main/java/com/aistareco/aep/model/MaterialVideo.java` +
  `MaterialOpsService.listVideos`。
