# 版本增量历史（v0.5 → v0.57）

> 从 `AGENTS.md`（`CLAUDE.md`）拆分出的连续多版本增量日志（明星带货线 + 混剪专区 + dap 数字人 + 三端拆分 + sau-service 等）。本文件按版本号分节，包含新实体 / 路由 / 决策 / 注意事项。新人 agent 不必翻 commit history。
>
> 索引参考 `docs/INDEX.md`；操作规则（硬规则 / SOP / 约定 / 文档同步纪律）仍在 [`AGENTS.md`](../AGENTS.md) / `CLAUDE.md`。

### v0.5（2026-05-08 ~ 05-09）— AI 明星带货线落地

**新增 server 实体**（详见 [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md)）：

| 实体 | 用途 |
|---|---|
| `CelebrityStarAuthorization` | 用户×明星授权关系（unique(user_id, star_id) + 4 态状态机） |
| `RechargePackage` | 充值套餐（admin CRUD，软删 active=false） |
| `TemplateScript` | 模板脚本（双模 text/video_ref + 6 类 ChatMessage 块；JSON 列） |
| `AiModelProvider` | 大模型 provider（OpenAI 兼容；apiKey 用 AES-GCM 加密） |
| `UserBotReadState` | per-user-per-bot lastReadAt（驱动 Bot 红点） |

**新增 server 端点**（节选；详见 [`specs/openapi.yaml`](specs/openapi.yaml)）：

```
GET  /me/messages-overview                        # 待办 + Bot 会话预览（按需合成）
GET  /celebrity/dictionaries                      # UI 字典
GET  /celebrity/jobs/{jobId}                      # 视频生成异步任务进度
POST /me/wallet/recharge                          # 充值落账（走 LedgerEntry）
POST/PUT/DELETE /admin/celebrity/stars[/{id}]
POST/PUT/DELETE /admin/celebrity/templates[/{id}]
POST /admin/template-scripts/{id}/{submit-review|publish|rollback|dry-run|draft-with-ai|upload-clip}
GET/POST/PUT/DELETE /admin/ai-models[/{id}]
```

**关键决策**：

- **Bot 消息走拉模式**：5 个 composer 按需查询业务态合成 `BotConversationDto`；零事件总线
- **小程序近实时同步**：app-level 15s 兜底轮询 + chat 页 5s 子轮询 + 关键点立即触发
- **AES-GCM 加密**：`AepCryptoUtil` 读 `AEP_SECRET_KEY` 环境变量；**生产必须配**，否则 admin 改 apiKey 后重启无法解密
- **engine-pricing / JOBS 当前 in-memory**：admin PUT 立即生效但重启丢失。v0.6 落 `PlatformConfig` / `generation_jobs` 表

### v0.7（2026-05-17）— 混剪专区内嵌 web-celebrity

把独立项目 `/Users/donis/dev/mixcut/frontend`（Next 14 + Tailwind 3 + Zustand + 13 页）裁到核心 7 页，作为 `(workspace)/mixcut/*` 子树挂入 web-celebrity。详见 [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) 「混剪专区」一节。

### v0.9（2026-05-17）— 混剪用户素材上传 + 真实素材消费

`apps/server` 新增完整的用户上传素材管线 + 渲染 worker 真消费这些素材。

**新增**：

```
server  : MixcutAsset entity + MixcutAssetRepository（表：mixcut_asset）
        : MixcutAssetService（multipart 上传 + 本地 fs + ffprobe 探时长）
        : MixcutAssetController (/api/mixcut/assets POST/GET/GET[id]/DELETE)
        : MixcutAsyncConfig 加 /static/mixcut-assets/** 资源映射
        : MixcutRenderingService.resolveBindings() — 真实解析 binding.asset_id / file_url
        : MixcutRenderingService.renderOneVariant() — 真叠加用户上传的 image/sticker
        : application.yml 加 spring.servlet.multipart.* + aep.mixcut.asset-dir / asset-public-url-base

web-celebrity:
        : api/mixcut.ts 增 listAssets / uploadAsset / deleteAsset
        : components/mixcut-zone/types.ts 增 MixcutAsset / MixcutAssetKind
        : SlotInput 重写 user_upload + library_select 走真后端
        : /mixcut/library 重写为真后端 CRUD（4 tab + 上传 dialog + 删除 confirm）
```

**注意**：

- 上传 wire 例外：multipart 表单 + snake_case 字段（`user_id` / `kind` / `file` / `name` / `tags`）
- 安全模型仍 permitAll —— 生产化必须 `.authenticated()` + 校验 `ownerUserId == principal.id`
- 详见 [`apps/web-celebrity/PRODUCT.md` §5.7](apps/web-celebrity/PRODUCT.md)

### v0.8（2026-05-17）— 混剪专区真后端（ffmpeg 渲染）

`apps/server` 新增完整 mixcut 渲染管线（不再 mock）。每个任务变体真做三件事：

- **视频拼接** — concat 2 个明星片段
- **图片贴图** — overlay 半透明色卡 + drawbox 装饰条带
- **随机剪切** — 每段 `-ss` 随机 offset；变体间 perturbation 参数（速度/亮度/饱和度/镜像）随机

**新增**：

```
server  : MixcutRenderJob + MixcutRenderOutput 两张表（JPA auto-update）
        : FfmpegRunner + AssetDownloader + MixcutJobService + MixcutRenderingService (@Async)
        : MixcutController (/api/mixcut/jobs[/{id}{/progress}])
        : MixcutAsyncConfig (静态资源 /static/mixcut/** → 外部目录)
        : application.yml 加 aep.mixcut.* 配置

web-celebrity: api/mixcut.ts 加 NEXT_PUBLIC_MIXCUT_USE_REAL=1 独立开关
             : next.config.mjs 加 /static/:path* rewrite
```

**注意事项**：

- ffmpeg CLI 必须在 server 运行环境可用（`brew install ffmpeg`）
- `drawtext` filter 需 libfreetype（brew 默认不带），当前用 drawbox 色条替代
- 输出文件存本地 `mixcut-output/<jobId>/v<N>.mp4`；OSS 集成是 v0.9+
- 生产环境 `/api/mixcut/**` 应改为 `.authenticated()`，当前 MVP 是 permitAll

详见 [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) 「混剪专区」一节。

### v0.13（2026-05-19）— 扰动贴图池 + 安全前置

`apps/server` + `apps/web-celebrity` 在 mixcut 链路上加扰动贴图池。每变体按 (jobId+variantIndex) 随机抽样 GIF overlay，叠在已有 image overlay 之上。

**新增 / 修改**：

```
server  : MixcutAsset +isPreset/+presetGroup/+previewUrl 列；MixcutAssetRepository 加 findByIsPreset* 查询
        : MixcutAssetService listVisibleTo / getVisibleTo / deleteOwned (preset 公共可见，user 私有受 principal 校验)
        : MixcutAssetService uploadPreset + registerPresetRow (admin / DataInitializer 路径)
        : MixcutPresetSeeder (@Order(10))：扫 classpath:preset-stickers/*.gif → fs+DB；空池时 ffmpeg lavfi 程序化生成 5 张 demo
        : MixcutRenderJob +stickerPoolJson TEXT 列（结构 Map<slotId, {pool_ids, coverage, opacity, scale_pct, pick_count}>）
        : MixcutRenderingService.buildVariantStickers + renderOneVariant 整合 GIF overlay (-stream_loop -1, format=yuva420p, colorchannelmixer=aa)
        : MixcutController + MixcutAssetController 全部方法接 Principal（v0.13.0 安全前置：之前裸调 service，无 ownerUserId 校验）

web-celebrity: types.ts +StickerPoolBinding，MixcutAsset +is_preset/+preset_group/+preview_url
             : sticker-pool-picker.tsx 新组件（4 group tab，多选 + 时间覆盖/不透明度/大小/抽样数）
             : api/mixcut.ts +listPresetStickers，AssetFilter 加 preset/presetGroup
             : create/[id]/create-client.tsx 加扰动贴图池 Card（写到 sticker_pool["_global"]）
```

### v0.14（2026-05-19）— CDN 上传抽象

新增 CDN 抽象层。dev 用 `LocalFakeCdnUploader`（复制到 `./cdn-mock`，公开为 `/cdn/<key>`），生产换 `AliyunOssCdnUploader`（stub，v0.16 候选）。Render 完每个变体串行上传 mp4 + jpg。

**新增 / 修改**：

```
server  : service/cdn/CdnUploader 接口 + CdnUploadResult record
        : LocalFakeCdnUploader @ConditionalOnProperty(aep.cdn.driver=local 默认)：路径穿越校验 + publicUrlFor
        : AliyunOssCdnUploader stub（v0.16+）
        : config/CdnWebConfig @ConditionalOnBean(LocalFakeCdnUploader)：注册 /cdn/** → ./cdn-mock
        : MixcutRenderOutput +cdnUrl/+cdnKey/+cdnThumbnailUrl/+cdnUploadedAt 列
        : MixcutRenderingService 注入 CdnUploader（required=false），renderOneVariant 末尾 uploadWithRetry
        : markFailed 增 CDN 孤儿清理（按 cdnKey 调 uploader.delete）
        : application.yml 加 aep.cdn.driver/local-root/public-base-url + oss.*
```

### v0.15（2026-05-19）— 混剪 → 发布 桥接 + 定时

`AiStarEcoApplication` 加 `@EnableScheduling`。新调度器 `PublishJobScheduler` 每 60s 扫 `status=QUEUED AND scheduledAt<=now` 自动 startJob。新增 `/api/me/mixcut/publish-batch` 一次性把 N 变体 × M 账号派单。前端三入口 + 定时 UI。

**新增**：

```
server  : @EnableScheduling on AiStarEcoApplication
        : PublishJobScheduler (@Scheduled fixedDelay=60_000, initialDelay=30_000)
        : PublishJobRepository.findByStatusAndScheduledAtLessThanEqual
        : MixcutPublishService.batchPublish (逐 output 独立 try/catch，部分成功)
        : MixcutPublishController POST /api/me/mixcut/publish-batch
        : DTO MixcutPublishBatchRequest / MixcutPublishBatchResultDto
        : 复用现有 QUEUED 状态（不新增 SCHEDULED）

web-celebrity: api/mixcut.ts +publishBatch
             : mixcut-zone/BatchPublishDrawer.tsx（变体多选 + 账号多选 + 文案 + datetime-local 定时）
             : mixcut/jobs/[id] 加「批量发布」按钮 → 开 drawer
             : /mixcut/publish 新页：跨任务挑选所有 cdn 变体 → 同一 drawer
             : distribution 顶部加「从混剪库选视频发布 →」入口 → /mixcut/publish
             : datetime-local 提交时 new Date(local).toISOString() 显式转 UTC
```

**注意事项**：

- 定时调度 @Scheduled 默认串行同 bean；多实例部署需 ShedLock（v0.17 候选）
- BatchPublishDrawer 双模：`job` prop（单任务）或 `items[]` prop（跨任务），后者优先级高
- 部分成功语义：响应 200 + `failed_items[]` 数组，按 `MISSING_CDN_URL` / `BUSINESS_ERROR` / `INTERNAL_ERROR` 三类原因
- v0.13.0 安全前置发现 MixcutController 之前根本没接 Principal —— 同 commit 顺手补上，service 全加 userId 过滤

### v0.16（2026-05-19）— 分发工作台迁入分发中心

把 v0.15 落在 `/mixcut/publish` 的「分发工作台」迁入 `/distribution`。混剪只负责制作；分发中心统一收口「批量制作 → 绑账号 → 派单」的用户路径。**仅 web-celebrity 改动，server / api 契约零变化**。

**新增 / 修改（web-celebrity）**：

```
components/distribution/DistributeWorkbench.tsx  (新)
  · 双视图 grid / group；跨任务搜索 + 已发布过滤（localStorage 去重）
  · Sticky right rail：已选缩略图九宫格 + 「继续配置发布 (N)」
  · 复用 BatchPublishDrawer (items[] 模式) 完成账号 / 文案 / 定时 / 派单
  · 深链入参 fromJobId — 预选 + 滚动定位

components/distribution/DistributionPage.tsx     (重写 IA)
  · header 状态条 StatChip ×3：已绑账号 / 可发变体 / 进行中任务（点切 tab）
  · Tabs：分发工作台（默认）/ 账号管理 / 任务追踪
  · 「手动分发」上移 header 右上，跨 tab 常驻
  · useSearchParams 包 <Suspense> （Next 16 build 警告）
  · URL 同步 ?tab=workbench|accounts|tracking + ?from_job=<id>

app/(workspace)/mixcut/publish/page.tsx          (改 redirect)
  · 删除 publish-workbench-client.tsx
  · 改为 redirect("/distribution?tab=workbench") 兼容旧链

app/(workspace)/layout.tsx
  · 移除 mixcut 二级菜单的「发布工作台」+ 面包屑映射

app/(workspace)/mixcut/jobs/[id]/job-detail-client.tsx
  · 保留单任务「批量发布」drawer（行为不变）
  · 新增 ghost 按钮「去分发中心 →」深链 /distribution?from_job=<id>
```

**注意事项**：

- 已派发去重是纯前端 localStorage（key `aep:distribute:published-output-ids`），跨浏览器 / 清缓存失效。稳态去重需 server 加 `mixcut_output.last_published_at` 列
- 手动 URL 输入暂未 inline 合并进工作台（保留 `ManualDistributeDialog` 独立弹窗）—— 手动场景字段差异大（封面 / 商品挂载 / 视频号 category 等专属字段），强行合并会复杂
- 三个新 web app 中只 celebrity 做了改动；drama / music 暂未涉及发布流程

### v0.17（2026-05-20）— 社交账号 profile 增强

绑定社交账号成功后，sau-service 从已登录的创作者中心页面 best-effort 提取账号辨识信息并随 `/login/poll` 的 `profile` 返回；server 加密 storage_state 的同时落库这些清洁字段，前端在账号管理 / 发布选账号 UI 中展示。

**新增 / 修改**：

```
packages/types: SocialAccount +platformAccountId
server        : SocialAccount +platformAccountId 列；SocialAccountDto / SocialAccountService 同步
sau-service   : PlatformDriver.extract_profile 统一返回 {displayName, platformAccountId, avatarUrl}
              : DouyinDriver 从创作者中心 header 抓昵称 / 抖音号 / 头像，body 文本兜底解析「抖音号：...」
web-celebrity : 账号列表、手动分发、项目分发、BatchPublishDrawer 展示平台账号号
admin         : 社交账号审计页展示 platformAccountId
openapi       : SocialAccount schema 增 platformAccountId
```

**注意事项**：

- 这是 best-effort profile：平台 DOM 或权限不同会导致字段为空；禁止用 `accountName` 伪装平台昵称。
- 各平台 driver 各自实现选择器和文本解析。抖音字段叫「抖音号」，小红书 / 视频号等平台可继续映射到统一 `platformAccountId`。

### v0.17.1（2026-05-21）— sau-service 视频号 / 快手 / 小红书 profile 拉齐 + 诊断回填

v0.17 落地时只有 DouyinDriver 走完了「retry-poll + selector 多兜底 + body 文本反向抽 ID」全链路；ShipinhaoDriver / KuaishouDriver / XiaohongshuDriver 还是单次 read，遇到 SPA 慢挂或哈希 class 漂移就拿不到 `platformAccountId`。本次把 Douyin 的 pattern 抽成模块级共享 helper，并加 selector miss 时的 DOM 诊断 dump，避免靠人肉重做 QR 绑定才能拿到现网 class：

```
sau-service : login_pool.py +_poll_extract_profile（time-bounded 重试，任意标识字段非空即返回）
            : login_pool.py +_dump_profile_dom_hints —— 重试耗尽仍空时，按 label_hints
            :   ("视频号 ID" / "快手号" / "小红书号" / "抖音号") 在 body DOM 里反向搜
            :   text 包含该 label 的节点，WARNING 吐 URL + body[:500] + 命中节点的
            :   tag / class / outerHTML[:800]。运维拿到这条日志即可在不重做绑定的前
            :   提下把真实 class / 真 label 回填到 driver 的 *_SELECTORS / body label。
            : DouyinDriver.extract_profile 改用共享 helper（无行为变化）+ 接 label_hints
            : ShipinhaoDriver 加 PROFILE_READY_TIMEOUT_S / DISPLAY/ACCOUNT_ID/AVATAR_SELECTORS
            :   selectors 覆盖 [class*='finder-nickname'] / [class*='finder-uniq-id']
            :   body 兜底解析「视频号 ID: …」/「原始 ID: …」
            : KuaishouDriver 扩 selectors（[class*='kwaiId'] / [class*='userInfo']…）+ body 兜底 "快手号"
            : XiaohongshuDriver 扩 selectors（[class*='redId'] / [class*='red-book-id']…）+ body 兜底 "小红书号"
tests       : test_smoke.py +test_non_douyin_profile_text_helpers_parse_creator_headers
```

**注意事项**：

- 当前 selectors 是基于上游 sau / 常见 emotion class 命名套路猜的，**首次真实绑定后必须按诊断 WARNING 回填一次**。日志样式：
  ```
  [shipinhao] extract_profile empty after retry budget; url=https://channels... body[:500]='...' label_hits=3
    [shipinhao][0] tag=SPAN cls='nickname-xxx' text='视频号 ID: shipinhao_demo_001' parentTag=DIV parentCls='header-yyy' outerHTML='<span class="nickname-xxx">视频号 ID: shipinhao_demo_001</span>'
  ```
  操作员/agent 取 cls 改 driver 的 `ACCOUNT_ID_SELECTORS`，取 parentCls / text 形态改 body 兜底 label。
- 重试上限 10s + 0.5s 间隔 = 最多 20 次 poll；不会卡住 `/login/poll` 整体超时（外层 30s+）。
- 诊断 dump 不读 cookie / storage_state；仅 DOM。封顶 5 个 hit + 单节点 outerHTML 800 字，日志总量可控。
- 没有 schema 变更：server / openapi / 前端契约不动；仅 driver 内部成功率提升 + 自诊断。

### v0.17.2（2026-05-21）— sau-service 小红书 profile 主动导航 + 部分命中诊断

v0.17.1 给 XHS 加了 selector + label 兜底，但实际 QR 绑定后发现 platform_account_id 仍然空：原因是 创作者中心 post-login landing（`/creator-center/post-creation` 之类）顶部 chrome 只有 avatar，没有 nickname / 小红书号 在 DOM 触手可及 —— selector 再多也没用。

引入 `PlatformDriver.prepare_profile_view(page)` 钩子：在 `_poll_real` 拿 storage_state 之前给 driver 一次主动 navigate / 点 UI 的机会。`XiaohongshuDriver` 实现按 `[/creator/home, /setting/profile, /account/personal-data, /creator-center/profile]` 顺序探，命中标志是 body 含「小红书号」且未被反弹回 /login。

同时升级 `_poll_extract_profile` 的成功判定 + 诊断 dump：

```
sau-service : login_pool.py +PlatformDriver.prepare_profile_view (默认 noop)
            : login_pool.py XiaohongshuDriver +PROFILE_VIEW_URL_CANDIDATES (4 条) +prepare_profile_view
            : login_pool._poll_real 在 storage_state() 之前调 prepare_profile_view(page)
            :   —— 多吃一次 cookie 刷新；XHS 必须导航否则 小红书号 不在 DOM
            : routes/accounts.py verify path 同步加 prepare_profile_view 调用
            : login_pool._poll_extract_profile 成功判定从「displayName OR platformAccountId」
            :   收紧为「displayName AND platformAccountId」—— 部分命中也会跑满 deadline
            :   → 触发诊断 dump（之前 displayName 命中后立刻 return，platformAccountId 永远空也不报）
            : login_pool._dump_profile_dom_hints +missing_fields=(...) 入参 + header chrome 第二 pass
            :   pass-1: 含 label 文本的节点；pass-2: header / userInfo / avatar 容器 outerHTML
            :   日志 line 改 "incomplete after retry budget; missing=displayName,platformAccountId"
tests       : test_smoke.py +test_xiaohongshu_overrides_prepare_profile_view
            :   断言 XHS 重写了 hook、其它 driver 仍为 noop（避免无谓导航开销）
```

**注意事项**：

- 候选 URL 是基于公开经验猜的；首次真实绑定后看日志「[xiaohongshu] prepare_profile_view ok via <url>」就知道哪条命中。若全部失败 → log "all candidates failed" + extract 仍跑（fallback 是 landing 页 best-effort）。
- 收紧成功判定后，**已知 selector 错的平台首次绑定会跑满 10s** 才退（之前 displayName 一命中就 return）。这是诊断 dump 的必要前提；selector 修对后两项一起来 → fast-bail。
- `prepare_profile_view` 失败一律不抛（外层有 try/except wrapping），不影响 storage_state 捕获 + 业务返回 success。
- verify path 同步加了 prepare_profile_view 调用，老 cookie 再 verify 时也会刷新 profile —— 用户重新点「验证账号」按钮即可让 profile 字段回填，不用重新扫码。

### v0.17.3（2026-05-21）— sau-service QR 提取失败时落盘 snapshot

XHS（也可能将来视频号 / 快手）`/login` 页 DOM 经常漂 —— class hash 改、tab 布局换、整页换 modal 之类的。`extract_qr_data_url` 抛 `RuntimeError("QR src not found ...")` 时之前是干抛，运维只能瞎猜 selector。这次：

```
sau-service : login_pool.py +_dump_qr_extraction_failure(page, platform, msg)
            :   - 落盘 ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.png  (full_page screenshot)
            :   - 落盘 ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.html  (page.content())
            :   - WARNING log 含 URL + body[:500] + 所有 data:image/<img> 的 size/class/parent
            :   - 落盘目录可用 SAU_DEBUG_SNAPSHOT_DIR 覆盖（docker mount 用）
            : XiaohongshuDriver.extract_qr_data_url 在 raise 前调 helper，把 snapshot 路径塞 msg
            : login_pool._start_real 兜底：任何 driver 的 QR 提取异常都触发 snapshot
            :   （XHS 自己已经塞过路径 → 跳过；其它 driver 飘了也能拿到现网快照）
```

**注意事项**：

- snapshot 文件包含 cookie 之前的 /login 页面 —— 没有任何用户敏感数据（页面是未登录态的 QR 卡片）。
- 默认目录 `./sau-debug-snapshots/` 是相对启动 CWD；docker 部署务必设 `SAU_DEBUG_SNAPSHOT_DIR=/data/sau-debug` 并挂卷，否则容器重启就丢。
- WARNING log 里的 `data:image candidates=N` 列表是诊断关键 —— 真 QR 一般 180-220px 见方，列表里能直接看出来哪个 img 是 QR、它的 class 是什么。
- XHS 长期还是建议改用 `xhs-toolkit.XhsClient.get_qrcode()` API 路径替代 DOM scrape —— 上游 `pokocat/social-auto-upload` 的 `xhs_uploader/xhs_login_qrcode.py` 走的就是这条 API；DOM scrape 是临时活路。

### v0.18（2026-05-20）— sau-service 上传超时保护

`pokocat/social-auto-upload` 上游的 `DouYinVideo.upload()` / `TencentVideo.upload()` 内部"点击发布按钮"是 `while True` 无限循环，平台 selector 失效或视频审核久挂时会一直输出 `🏃 小人正在冲刺发布视频` 卡死。sau-service 包一层 timeout + cancel-aware race + publishing watchdog。

**新增 / 修改**：

```
sau-service : uploader.py +_run_upstream_upload helper (asyncio.wait race + sliced loop)
            : publishing watchdog（60s 后 push status=publishing/80）
            : cancel_event race（用户取消能真打断进行中的 upstream upload）
            : SAU_UPLOAD_TIMEOUT_S / SAU_UPLOAD_PUBLISHING_AFTER_S 两 env
```

### v0.19（2026-05-20）— 视频库允许再次分发 + 发布短信验证码人机交互

两块独立子改动归到同一 v 节（README.md / 部署日志已经合并）：

**A. 视频库允许再次分发 · 派发计数落库**

废止 v0.16 的 localStorage 去重（`aep:distribute:published-output-ids` 已彻底删除）。视频库默认显示全部可发变体（含已派发过的），同一变体可再次分发到新账号 / 新时间窗。派发记忆改走 server。

```
server        : MixcutRenderOutput +publishCount (@ColumnDefault("0")) / +lastPublishedAt 列
              : MixcutRenderOutputDto 同步 publish_count / last_published_at
              : MixcutPublishService 注入 MixcutRenderOutputRepository
              :   每条 output 派单成功后按 target 数累加 publishCount + setLastPublishedAt(now)
              :   tracker 写库失败只 log（不阻塞派单结果）
web-celebrity : mixcut-zone/types.ts#RenderOutput +publish_count? / +last_published_at?
              : distribution/DistributeWorkbench.tsx 删除 PUBLISHED_KEY / publishedIds / loadPublished / persistPublished
              :   工具条按钮翻为「显示全部 / 仅未发布」二态（默认 OFF = 显示全部）
              :   GridView / GroupView 用 output.publish_count 渲染「已发 ×N」徽标 + hover tooltip 相对时间
              :   handlePublished 改为 load() 重新拉 jobs，徽标实时升级
```

**B. 发布短信验证码人机交互**

平台风控触发"输入短信验证码"弹窗时，sau-service 检测后推 `awaiting_user` 状态到 server，前端弹起输入框让用户提交；提交回 sau-service 把 code 填进 page、关闭弹窗，上游 upload retry 循环自然继续。MVP 整 stack 通；selector 占位待真实 DOM 抓取后接入。

```
packages/types : PublishJobStatus +awaiting_user；InteractionRequired；SubmitPublishJobInteractionInput
                : PublishJob.interactionRequired?，PublishJobCallback.interactionRequired?
server          : PublishJobStatus +AWAITING_USER（状态机双向：UPLOADING/TRANSCODING/PUBLISHING ↔ AWAITING_USER ↔ UPLOADING/PUBLISHING/LIVE）
                : PublishJob +interaction_required（TEXT JSON 列）
                : POST /api/me/publish-jobs/{id}/interact { code }
                : SauServiceClient.submitInteraction
sau-service     : interaction.py（SmsInteractionDriver Protocol + _PlaceholderSmsDriver）
                : uploader.py 加 SMS watcher coroutine（detect → request_sms → await user code → submit_code → is_cleared）
                : _hook_chromium_for_page_capture context manager（monkey-patch playwright.chromium.launch 抓取上游 page）
                : POST /tasks/{id}/interaction { code }
                : SAU_INTERACTION_USER_TIMEOUT_S / SAU_INTERACTION_POLL_INTERVAL_S 两 env
                : awaiting_user 期间 UPLOAD_TIMEOUT_S 暂停计时
web-celebrity   : SmsInteractionDialog 弹窗（脱敏手机号、6 位输入、5min 倒计时、Enter 提交、auto-complete one-time-code）
                : PublishJobList awaiting_user STATUS_META、行内「输入验证码」按钮、自动弹窗
admin           : PublishJobStatus +awaiting_user、PUBLISH_JOB_STATUS 表加 "待输入验证码"、tab + inflight 计数同步
openapi         : PublishJobStatus enum 加 awaiting_user；InteractionRequired schema；/me/publish-jobs/{id}/interact path
```

**注意事项**：

- 入库默认值靠 Hibernate `@ColumnDefault("0")`；ddl-auto=update 时 H2/MySQL 都能为现存行补 0。
- `bumpPublishTracker` 单条 try/catch；output 不存在或保存失败只 log，业务结果不回滚。
- BatchPublishDrawer 接口不变；唯一行为变化是它的 onPublished 回调里上游会 refetch jobs。
- 「显示全部」是默认 / 推荐状态。「仅未发布」仅在用户主动收窄时启用，按 `publish_count === 0` 过滤。
- **MVP selector 占位**：`_PlaceholderSmsDriver.detect()` 永远返回 None，所以 awaiting_user 路径在生产**还不会触发**。整 stack 已联通；要真启用需要在抖音/视频号触发风控、抓 SMS 弹窗 DOM、替换 placeholder 为真实 selector driver。
- **upstream 不暴露 page**：`DouYinVideo.upload(playwright)` 把 browser/context/page 全留在局部变量。我们靠 `_hook_chromium_for_page_capture` monkey-patch `chromium.launch` 捕获 Browser 引用，poll `browser.contexts → pages` 拿 page。per-task scope（finally 复原），不影响并发，但耦合 upstream 当前用 `launch()` 而非 `launch_persistent_context()`。如果上游改了，需要更新 helper。长期方案是 fork upstream patch `upload()` 接受 `on_page` callback。
- **超时倒计时双源**：前端 `SmsInteractionDialog.USER_INPUT_TIMEOUT_S=300` 必须与 sau-service `SAU_INTERACTION_USER_TIMEOUT_S=300` 同步；否则会出现一端认为已超时而另一端还在等待的撕裂。

### v0.20（2026-05-20）— 分发定时策略升级（每日铺开 + 随机抖动）

v0.15 的「定时发布」只支持一个 `datetime-local` —— N×M 派单同一时刻起飞。v0.20 引入完整 cadence 策略：把 N 条 mixcut 变体按「每天 K 次 × D 天」铺到未来时间槽，可选随机抖动。`PublishJob` / `PublishJobScheduler` 零改动，错峰 `scheduledAt` 直接走现有调度。

**新增 / 修改**：

```
server  : MixcutPublishBatchRequest +schedule: ScheduleSpec 顶层字段（sealed interface +
        :   Immediate / Single(at) / DailyRecurring(startDate, timeSlots, timezone, maxDays, jitterMinutes)）
        : MixcutPublishBatchRequest.TargetItem -scheduledAt （时间不再 per-account）
        : MixcutPublishService.expandSchedule —— 把 spec 算成 outputs.size 长的 Instant[]
        :   (timeSlots 排序去重、ZoneId 解析、LocalDate.parse、jitter 范围 0..30、容量校验)
        :   过去 slot clamp 到 now；jitter 用 ThreadLocalRandom（不可重放）
        : MixcutPublishService.batchPublish 改用 perOutputAt[i] 注入到 per-output targets
        : projectId 兜底拼 "mixcut-batch-<source>-<yyyyMMddHHmmss>" 防撞
web-celebrity:
        : api/mixcut.ts +ScheduleSpec discriminator union, -MixcutPublishTarget.scheduled_at
        : BatchPublishDrawer.tsx 状态层换成 strategy/singleAt/startDate/timeSlots/capMode/maxDays/jitter*
        :   抽 ScheduleEditor 子组件 + StrategyPill + sortDedupSlots / expandDailyRecurringPreview / slotToDate
        :   4 套预设 chip (每天 3 次 / 每天 2 次 / 每天 1 次 / 晚间高峰) + 自定义 HH:MM 编辑
        :   实时预览行 + 容量超限红字阻拦 + auto-suggest maxDays
        : distribution/DistributeWorkbench.tsx 右栏帮助文案加一行 cadence 提示
```

**注意事项**：

- API 是破坏性变更（drop `targets[].scheduled_at`，要求顶层 `schedule`）—— 无线上外部消费方，干净切换，不做向后兼容 shim。
- 前后端铺开算法（`expandSchedule` vs `expandDailyRecurringPreview`）必须严格对齐：前端只算「理论 slot 时间」用作预览，**不**模拟抖动；后端是真值源。`slotToDate` 在浏览器本机 tz 与 schedule.timezone 不同时做一次反向偏移修正，DST 边界可能差 1 小时（服务端不受影响）。
- `outputs[]` 顺序变成业务语义：i 决定 day_offset 与 slot 索引。前端勾选顺序即铺开顺序，PRODUCT.md / 抽屉提示均说明「按勾选顺序铺开」。
- jitter 用 `ThreadLocalRandom`：不可重放。未来若要可复算，引 `seed = hash(projectId, i)`。
- 显式 out-of-scope：campaign 级别取消（`/distribution?tab=tracking` 单条 cancel 仍可用）、ShedLock、跨账号错峰、interval / random_window / weekly 等扩展策略（discriminator 预留扩展位）。

### v0.28（2026-05-23）— 商品主线贯穿（素材统一 + 链接解析 + 生成-分发桥接）

把过去四块独立的「商品库 / 素材库 / 混剪 / 分发」按「商品」为主线连起来：从抖音商城链接解析 → 落 Product + 关联素材到 MixcutAsset → 混剪以商品为入口自动填 slot → 抖音分发自动带商品链接。仅 celebrity 子产品改动。

**核心设计原则**：

- **MixcutAsset 是唯一素材表**：用 `relatedProductId` 标记商品归属（沿用 v0.21 `relatedStarId` 同模式，不发明新表）。`Product.images` 字段渐进废止，新代码读取走 `listAssets({ relatedProductId })`。
- **productId 是生成-分发的贯穿键**：MixcutRenderJob 加 `productId`；BatchPublishDrawer 打开时反查 Product 自动 prefill 抖音商品挂载字段。PublishJob 不加冗余列。
- **前端不区分 URL 形态**：单一调用 `POST /api/me/products/parse-link`；server 内部 handler chain 按 `@Order` 决定路径，新平台只加 handler。
- **外网 CDN URL 直接登记**：抖音商品图直接作为 MixcutAsset.fileUrl，不下载本地。

**新增 / 修改**：

```
types          : Product +priceCents +commissionRate; +product-link.ts(ProductLinkInfo);
                 MixcutAsset +related_product_id +subkind; RenderJob +product_id
server         : Product / MixcutAsset / MixcutRenderJob 三张表加新列
               : aep/service/productlink/* —— Handler 接口 + DouyinQueryEmbeddedHandler(@Order(10),
                 query 内嵌 goods_detail) + DouyinHtmlScrapeHandler(@Order(20), HTML 抓 og tags +
                 window.__INITIAL_STATE__；host 白名单防 SSRF)
               : ProductLinkService 编排 chain; ProductLinkPersistService 衔接 ProductService +
                 MixcutAssetService.registerExternalUrl(...)
               : POST /api/me/products/parse-link（仅解析）+ /api/me/products/from-link（解析+落库）
               : MixcutAssetController list 加 related_product_id 过滤
               : CelebrityProductSeeder @Order(30) —— 首次启动 product 表为空时种 6 行抖音选品样例
web-celebrity  : ProductFormDialog +「📋 从抖音链接解析」+ 价格 / 佣金 输入
               : CelebrityProductLibrary +「从抖音链接快速建档」入口 + 行「生成视频」按钮 + 价格 / 佣金 列
               : ProductGenerateDialog（新）—— 选模板跳 /mixcut/create/{tplId}?product_id=X
               : ProductBatchImportDialog 识别 商品价格 / 佣金 列；占位符改抖音选品库 TSV 格式
               : create-client.tsx 读 useSearchParams.product_id；并发拉 product + listAssets;
                 applyProductHeuristics 自动绑 image/picgen_text/text slot; 顶部 chip + 提交透传 product_id
               : BatchPublishDrawer 自动 prefill productLink/productTitle，显示「已从商品库带入」chip
               : mocks/products.ts 替换为 6 行抖音选品样例（与 server seed 同源）
openapi        : Product/ProductInput +priceCents/commissionRate; 新 ProductLinkInfo schema;
                 新 /me/products/parse-link + /me/products/from-link path
tests          : DouyinQueryEmbeddedHandlerTest + ProductLinkServiceTest — 11 测全绿
```

**注意事项**：

- 启发式 slot 绑定按 `slot_id / label / fill_strategy` 子串命中（product|商品|图 → 商品图槽，title|标题 → 标题槽，point|卖点|desc → 卖点槽）；只覆盖 prev 中未绑或绑 `fixed` 的 slot，用户已改不动。模板命名越规范命中率越高。
- DouyinHtmlScrapeHandler 在 host 白名单外直接返回 empty（防 SSRF）；URL scheme 仅允许 http/https。
- CelebrityProductSeeder 仅 Product 行，**不**触发外网图片抓取；运营首次访问 UI 后手动点「📋 从抖音链接解析」回填。
- ProductLinkPersistService 单事务，图片登记单条失败 log + 继续，整体不回滚。
- BatchPublishDrawer prefill 仅在 `sourceJob.productId` 非空时触发；用户清空 chip 后可手动覆盖，不影响业务。
- 「商品ID」列在批量导入时识别但**不持久化**（server 自己生成 id）；保留是为兼容抖音表格直接粘贴。
- **未实现**：AI 生成带货视频（仅在 MixcutAsset.subkind 预留 `"ai-marketing-video"` 占位）；抖音以外平台的 handler；商品图本地化备份；PublishJob.productId 冗余列。

### v0.25（2026-05-22）— 混剪按场景渲染（多段落 bug 修复）

模板里 `scenes[]` 数据完整（每场景独立 duration + slots[]），但渲染器无视场景结构，硬编 `segCount = Math.min(2, sources.size())` + `segDuration = maxOutputDurationSec / segCount`，导致**无论模板配几个场景，最终视频永远只有 2 段**（每段 7.5s）。前端 `flatSlotsAbsolute()` 把场景拍平时丢了边界信息，渲染器收到的 `slots_snapshot` 完全没有场景概念。本次把"场景"作为一等公民贯穿整链路。

**新增 / 修改**：

```
types.ts          : +SceneSnapshot {id, label?, duration_sec, slot_ids[]}
                  : RenderJob +scenes_snapshot?: SceneSnapshot[]
                  : SlotSnapshot +time_range?: [number, number]（之前漏掉 → 这是 bug 根因之一）
create-client.tsx : 提交 job 时直接从 template.scenes 构造 scenes_snapshot（按顺序）
server model      : MixcutRenderJob +scenesSnapshotJson TEXT 列（@Lob）
server dto        : MixcutCreateJobRequest +scenes_snapshot；MixcutRenderJobDto +scenes_snapshot 回包
server service    : MixcutJobService.create 透传 scenes_snapshot
MixcutRenderingService :
  - RenderContext +scenes: List<SceneSpec>; SceneSpec { id, durationSec, slotIds }
  - buildContext 解 scenesSnapshotJson；单场景 clamp [1, maxOutputDurationSec]，总和 > max 按比例缩放
  - renderOneVariant +useSceneSchedule 分支：segCount = scenes.size()（不再硬编 2），
    segDurations[i] = scene.durationSec，每段独立 -ss/-t，totalDuration = 段长之和
  - +slotToWindow: Map<slotId, [start,end]>，给 overlay filter 追加 :enable='between(t,a,b)'
    把 overlay 限制在所属场景时段（v0.24 之前 overlay 整片可见）
  - applied_transforms +scene_schedule + total_duration_sec；每段 detail +scene_id/output_start/output_end
  - 缺省（scenes_snapshot 空 / 旧任务）→ 回退 v0.24 路径（最多 2 段）
```

**注意事项**：

- 字段全部加性兼容：scenes_snapshot 为空时渲染器行为与 v0.24 完全一致，历史任务不受影响。
- 总和超出 `aep.mixcut.max-output-duration-sec`（默认 60s）按比例缩放后再渲染；想要更长视频需调高上限。
- 源视频 round-robin：scene[i] → `sources[(variantIndex + i) % sources.size()]`；5 场景 + 2 视频会循环复用，5 视频 + 2 场景每变体只用 2 个。
- overlay enable 用单引号包 `between(...)`，防止表达式里的逗号被 ffmpeg 当成 filter-chain 分隔符。
- 一个 slot_id 不属于任何场景的 `slot_ids[]`（前端漏发？模板异常？）→ 该 overlay 整片可见（旧行为），不会丢失内容。
- openapi.yaml `/mixcut/jobs` 当前只有 path 骨架（无 request/response schema），contract gate 只校验 path 存在 → 不需要改 openapi。

### v0.23（2026-05-21）— 任务追踪按批次聚合 + 批量操作

celebrity 子产品的「分发中心 → 任务追踪」从平铺 PublishJob 列表升级为按 `project_id` 聚合的批次卡片 + 服务端分页 + 批次级批量操作（取消整批 / 重试失败 / 重新调度未开始）。N×M 派单后列表不再爆炸，运营一键搞定整批。

**新增 / 修改**：

```
server  : service/publish/ScheduleExpander.java（抽自 MixcutPublishService.expandSchedule，公共 util）
        : service/PublishJobBatchService.java（listBatches / cancelBatch / retryFailedBatch / rescheduleBatch）
        : controller/PublishJobBatchController.java → /api/me/publish-jobs/batches/*
        : dto/PublishBatchSummaryDto.java + dto/RescheduleBatchInputDto.java
        : repository/PublishJobRepository 加 findBatchProjectIdsByUserId(Pageable) + findByUserIdAndProjectIdInOrderByCreatedAtAsc
        : service/PublishJobService.createBatch projectId fallback：null/blank/"manual" → "manual-batch-<userId>-<yyyyMMddHHmmss>"

shared  : packages/types/src/publish-job.ts +PublishBatchSource/+PublishBatchSummary/+RescheduleBatchInput；ScheduleSpec 提升为共享类型
        : packages/api-client +apiFetchPaginated<T>（保留 PageEnvelope 的 pagination 元数据）
        : PublishJobApi +listBatches/+getBatch/+cancelBatch/+retryFailedBatch/+rescheduleBatch

web-celebrity:
        : components/distribution/ScheduleEditor.tsx（抽自 BatchPublishDrawer，行为零变化）
        : components/distribution/BatchTrackingTab.tsx + BatchSummaryCard.tsx + BatchDetailDrawer.tsx + RescheduleBatchDialog.tsx
        : DistributionPage tracking tab 由 <PublishJobList /> 换成 <BatchTrackingTab />
        : ManualDistributeDialog 删 MANUAL_PROJECT_SENTINEL，让服务端兜底
        : mixcut-zone/BatchPublishDrawer.tsx 改 import 抽出的 ScheduleEditor，删本地重复 420 行
openapi : 新增 5 paths（/me/publish-jobs/batches*）+ 2 schemas（PublishBatchSummary / PublishBatchSource）
        : ScheduleSpec / ScheduleSpecImmediate / ScheduleSpecSingle / ScheduleSpecDailyRecurring 正式入 schema
        : CreatePublishJobInput.projectId 改 optional + 注释手动分发自动生成
```

**注意事项**：

- 服务端 listBatches 走两步查询（GROUP BY → IN）+ Java 层 fold；不在 DB 落实体表，纯派生汇总。
- ScheduleSpec 持久化策略：**不存**。reschedule 让用户重新填一份新 spec 作用于 QUEUED 子集，不读老 spec。
- 历史 `project_id="manual"` 行聚合成单张「历史散件」徽章卡，不做回填迁移；新数据自然分流到不同 `manual-batch-*` 桶。
- 轮询：列表 5s（仅当有 hasInflight 时）；Drawer 内 PublishJobList 仍跑 2.5s（行级）。Drawer 关闭即 unmount，effect cleanup 自动停轮询。
- 重新调度只对 status=queued 生效；已开始 / 终态行原样保留。

### v0.21（2026-05-21）— 混剪 / 分发用户视角文案 + 视频库 + 官方明星片段

Celebrity 子产品的混剪与分发交互整改一次性合并：术语全面 review、清理无效按钮、引入「视频库 + 软删」与「官方明星片段」两个新模块、配额条下线、模板新建不再有副作用。

**A. 文案与术语全面 review（仅 web-celebrity）**

| 旧术语 | 新术语 |
|---|---|
| 变体 / variant / output | 视频 / 第 N 条 |
| 派单 / 发布 / 分发 | 统一对外「分发」；后台执行说「发布到 XX 平台」 |
| 任务 / job | 「生成任务」（混剪侧）/「分发任务」（分发侧） |
| 手动分发 | 上传链接分发 |
| CDN 已就绪 | 已生成 · 可立即分发 |
| cookie 加密存储 | 账号凭据已加密存储 |
| 立即派单 / 定时派单 / 铺开派单 | 立即分发 / 定时分发 / 分期分发 |
| 渲染节点 / sau-service / 轮询 2.5 秒 | 不暴露 |

涉及文件：`DistributionPage` / `DistributeWorkbench` / `BatchPublishDrawer` / `PublishJobList` / `SocialAccountList` / `ManualDistributeDialog` / `BindAccountDialog` / `mixcut/jobs/[id]/job-detail-client`。

**B. 混剪本月配额下线**

- 删 `MixcutHomePage` 的 `QuotaIndicator`，换为纯统计 `MonthlyStats`（本月已生成 N 条视频 + 累计 M 个任务）。
- 积分余额由 app 顶部钱包入口统一承载，不再混进混剪工作台。

**C. 混剪视频库 + 已生成视频软删（30 天硬删）**

- server: `MixcutRenderOutput` +`deletedAt`；新 `DELETE /api/me/mixcut/outputs/{outputId}`；DTO 转换层过滤 `deletedAt != null` 的 output。
- 新文件 `apps/server/.../service/mixcut/MixcutOutputCleanupScheduler.java`：`@Scheduled(cron="0 30 3 * * *")` 每日 03:30 扫 30 天前软删行 → 删本地 mp4 / 缩略图 → 调 `CdnUploader.delete(cdnKey)` → 删 DB 行（best-effort）。
- web-celebrity: `/mixcut/library` 改造顶层 tab「我的素材 / 我的视频 / 官方明星片段」；新 `MyVideosTab` 列已生成视频卡片网格 + 单条删除（confirm 文案明示「30 天可恢复」）。
- `DistributeWorkbench` 右栏 help 加超链 `/mixcut/library?tab=videos`。

**D. 官方明星片段专区（运营上传 / 用户只读）**

- server: 复用 `MixcutAsset` +`isOfficial` / `officialCategory` / `relatedStarId`。新 admin endpoints `/api/admin/mixcut/official-clips`（POST multipart / GET / PUT / DELETE）+ 公开 `GET /api/mixcut/assets/official-clips?category=&star_id=`。文件落 `./mixcut-assets/official/<category>/`。
- admin: 新页 `apps/admin/src/app/celebrity/mixcut-official-clips/page.tsx`（列表 + 上传 dialog + 行级编辑 + 删除）；`apps/admin/src/constants/nav.ts` 在「明星带货」组追加菜单。
- web-celebrity: `OfficialClipsTab` 真后端拉取 + 分类 chip 筛选 + 只读卡片网格。

**E. 新建模板不再自动落库**

- 模板列表「新建」按钮改为 `router.push("/mixcut/templates/new")`，不再调 `saveTemplate`。
- 新文件 `apps/web-celebrity/src/app/(workspace)/mixcut/templates/new/page.tsx` 渲染 `<TemplateDetailClient mode="new" />`。
- `template-detail-client.tsx` 加 `mode?: "view" | "new"` prop：new 模式用 `useMemo` 生成内存默认模板、跳过 server fetch、自动进编辑态、顶部草稿横幅、保存按钮 → `router.replace("/mixcut/templates/{id}/edit")`、取消按钮 → 返回列表无残留。
- 隐藏「另存为」「删除」按钮（草稿不适用）。

**F. 任务详情页清理无效按钮**

`apps/web-celebrity/src/app/(workspace)/mixcut/jobs/[id]/job-detail-client.tsx`：
- 删「全部打包下载」/「再生成一批」/顶部 Trash2 三个空 onClick 按钮。
- 复制按钮 onClick 接 `navigator.clipboard.writeText(job.id)`。
- 「渲染节点」row 删除（内部信息），「本次消耗 X 条额度」改「X 积分」。

**G. 分发工作台默认按任务视图**

`DistributeWorkbench.tsx` L78：`useState<ViewMode>("grid")` → `"group"`。

**H. 分发工作台 → 视频库超链入口** （已在 C 中覆盖）

**API 契约同步**：

- `DELETE /me/mixcut/outputs/{outputId}` — 已生成视频软删
- `GET /mixcut/assets/official-clips?category=&star_id=` — 公开列表
- `GET/POST /admin/mixcut/official-clips` + `PUT/DELETE /admin/mixcut/official-clips/{id}` — 运营管理
- `MixcutAsset` schema 加 `is_official / official_category / related_star_id`
- `MixcutRenderOutput` schema 加 `deleted_at`

**注意事项**：

- 软删 30 天保留期靠 `@Scheduled` cron。多实例部署需 ShedLock（沿用 PublishJobScheduler 同样的待办）。
- `MixcutOutputCleanupScheduler` 单条 IO 失败 log + 继续，DB 行保留下次重试。
- 「我的视频」tab 直接 `MixcutApi.listJobs()` 拍平所有 outputs（DTO 已过滤软删），不新增专门 endpoint。
- 官方明星片段与 v0.13 的 `isPreset`（扰动贴图池）是两套互斥标记：`isPreset=true` → GIF overlay；`isOfficial=true` → 用户可用作混剪源的明星视频片段。
- 模板新建走 `/mixcut/templates/new` 路由，详情页 `mode="new"` 时 template_id 是前端 nanoid 生成的，第一次 saveTemplate 时 server 以该 id upsert。取消则前端 state 丢弃，**完全不落库**。

### v0.22（2026-05-21）— 混剪批量发布支持抖音商品挂载

v0.15 起 `/api/me/mixcut/publish-batch` 派单时硬编 `productLink=null, productTitle=null`（v0.16 注释明示「暂不携带商品挂载；操作员后续手工编辑或走手动分发补登」）。这次把两字段拉到 `MixcutPublishBatchRequest` 顶层，沿着既有单条 PublishJob path 透传给 sau-service → `DouYinVideo(productLink=..., productTitle=...)`，触发抖音视频画面下方「立即购买」挂件。

批量场景的本质是「同一商品挂到 N 条混剪变体上」，所以字段是顶层 string 而非 per-output。非 douyin 平台目标 sau-service 静默忽略。

**新增 / 修改**：

```
server  : MixcutPublishBatchRequest +productLink / +productTitle 两顶层字段
        : MixcutPublishService.batchPublish 改透传（删 "暂不携带商品挂载" hardcode null,null）
        :   CreatePublishJobInputDto 第 7/8 参拿 req.productLink() / req.productTitle()
        :   PublishJob 落库 → PublishJobService.startJob 已有的 sau-service 透传逻辑生效

web-celebrity:
        : api/mixcut.ts MixcutPublishBatchRequest +product_link? / +product_title? 可选
        : BatchPublishDrawer.tsx
        :   + productLink / productTitle state（drawer open 时复位为空）
        :   + douyinSelected memo（accounts × selectedAccountIds 任一 douyin 即真）
        :   + 「抖音商品挂载」<section> 仅当 douyinSelected 时渲染（mirror ManualDistributeDialog）
        :   + submit 时 carryProduct = douyinSelected && link && title; 半残则整组 undefined
```

**注意事项**：

- 字段语义对齐单条 path：两项都非空才透传，半残（只有 link 没有 title 或反之）整组丢弃 —— 上游 sau 挂件需要两项齐全。
- `MixcutPublishBatchRequest` 是破坏性扩展但向后兼容：旧客户端不传两字段 → record 字段为 null → service 透传 null → 行为与 v0.21 相同。
- openapi.yaml `/me/mixcut/publish-batch` 当前只声明了 path 骨架（无 request schema）；contract gate 只校验 path 存在，所以这次不需要改 openapi。后续 schema 化时再补 `product_link / product_title` 字段。
- 非 douyin 平台填了也无效但不报错（sau-service _upload_shipinhao/_upload_kuaishou 不消费这两字段）。
- UI 隐藏逻辑只看 `accounts.platform === "douyin"`；若未来扩 tiktok 也有商品挂载，要重做这个 visibility predicate。

### admin sidebar 启用状态

启用：Platform / Artists / **Celebrity**（含 stars / templates / template-scripts / star-authorizations / engine-pricing / projects / videos）/ Distribution / Finance（含 recharge-packages）/ Notifications / Audit / 平台 > AI 模型。

隐藏（源码保留，URL 直访仍可用）：music / film / nft / forge / digital-ip / community / coach / fan / membership / store / monetization。

切换：[`apps/admin/src/constants/nav.ts`](apps/admin/src/constants/nav.ts) 改 `enabled` 字段。

- **未涉及**：小程序的 wx.subscribeMessage / WebSocket（v0.6+）、Cookie SSO 跨子域（Phase 5）、
  K8s ACK（Phase 6）、MixcutAsset 上传 OSS 化（Phase 4）。

### v0.37a（2026-05-27）— Operator 双端登录（Plan B：admin 独立登录通道）

> celebrity 子产品迭代第四批。

**背景**：用户希望 celebrity operator（aep_users.operatorRole=OPERATOR）既能在
web-celebrity 内嵌写权限，又能登 admin 后台做运营工作。但 `AdminAuthController`
严格只查 `admin_users` 表 —— 这是双账号体系核心约束（AepUser.java L53-58 注释明示），
强行让 AepUser 走 AdminAuth 会污染该约束。

**采用 Plan B**：admin 后台新增独立登录通道 `POST /api/admin/auth/operator-login`，
admin 登录页加 Tab「管理员账号 / 平台运营账号」二选一。两套账号、两套表、共享 JWT
role claim、共享 `AepSecurityConfig.hasAnyRole` 门禁，互不污染。

```
server : 新 AepOperatorAuthController (/api/admin/auth/operator-login)
       :   - 校验：aepUserRepo.findByUsername + passwordEncoder.matches
       :   - 必须 operatorRole != null（否则 403 「该账号无平台运营权限」）
       :   - 必须 passwordHash 非空（否则 403，提示「请联系超管设置密码」）
       :   - JWT.role = operatorRole.name() (OPERATOR / SUPER_ADMIN)
       :   - 成功 / 失败均落 slf4j 日志 (event_type=admin.operator_login.{success|fail})
       : AepSecurityConfig +/api/admin/auth/operator-login permitAll

       : DataInitializer.ensureCelebrityOperatorSeed:
       :   - 新建 seed 行时给 celebrity_operator 落 passwordHash = bcrypt("operator123")
       :   - 老 seed 行无 passwordHash 时自动补一次（幂等升级老 dev 数据）

       : AdminAepUsersController:
       :   - +PATCH /{id}/operator-role 加 self-protect (Principal == id → 403)
       :     防 OPERATOR 误操作把自己降级 / null 锁死
       :   - +POST /{id}/set-password (@PreAuthorize hasRole('SUPER_ADMIN'))
       :     SUPER_ADMIN 给 AepUser 重置密码 / 设密码

admin  : api/auth.ts +operatorLogin（POST /admin/auth/operator-login）
       : /login/page.tsx 加 shadcn Tabs「管理员账号 / 平台运营账号」
       :   - 切 tab 清错 + 重置默认 username (admin / celebrity_operator)
       :   - handleSubmit 按 mode 路由到 login / operatorLogin
       :   - 文案明确区分两个体系

openapi: +/admin/auth/operator-login + /admin/aep-users/{id}/set-password paths
```

**注意事项**：

- **AdminAuthController 不动**：admin_users 体系与 aep_users.operatorRole 体系完全独立，
  共享 JWT role claim（OPERATOR / SUPER_ADMIN 字符串对齐），共享 AepSecurityConfig
  hasAnyRole 门禁规则。
- **passwordHash 兼容升级**：v0.37 起首启自动给老的 celebrity_operator seed 行补密码；
  老 dev 数据无需手动 reset DB。
- **self-protect**：v0.32 注释指出 admin 自删 / 自降级保护缺失。v0.37 顺手在 operator-role
  PATCH 加 self-modify 防护（principal == id → 403）。
- **未做**：(a) rate-limit；(b) admin 失败计数锁定；(c) operator 登入审计的 error_log 表写入
  （仅 slf4j，v0.38+ 候选）；(d) SSO / OAuth 集成；(e) admin 登录页里给 OPERATOR 设密码的 UI
  （SUPER_ADMIN 走 set-password endpoint，UI 是 platform/staff 页面已有的 reset 风格，留待后续）。

### v0.36a（2026-05-27）— SellingChannel 解耦 + LicenseBatch 重构（批次 = 销售渠道 + 售卖主体）

> celebrity 子产品迭代第三批。

**背景**：用户反馈「激活码批次的逻辑不对 —— 批次本质是销售渠道，与 MCN 机构无关」。
审计发现：(a) `LicenseBatch.issuerTenantId` 指向 `Tenant` 实体，激活时强制建 Membership，
与 MCN 体系隐式耦合；(b) admin types `tier` 字段后端模型 + DTO 完全缺失（前后端 drift）。

本版引入 `SellingChannel` 实体，把批次的归属从 Tenant 解耦到独立的「销售渠道 / 售卖主体」。
新批次走纯 SellingChannel 路径，老批次保留 issuerTenantId 向后兼容。

```
server : 新 SellingChannel entity（aep_selling_channels 表）
       :   id / code(unique) / name(内部) / sellingEntity(对账主体) /
       :   type(direct/agent/online_store/event/partner) / contact* / remark /
       :   status(active/inactive) / createdAt / updatedAt
       : 新 SellingChannelRepository / SellingChannelService(CRUD + requireActive)
       : 新 AdminSellingChannelController /api/admin/selling-channels (GET/POST/PUT/DELETE)
       :   DELETE = 软删（status → inactive，保留历史 batch 引用一致性）
       : 新 SellingChannelDto（enum wire 全小写）

       : LicenseBatch +sellingChannelId(varchar 64) / +tier(varchar 32)
       :   issuerTenantId 改 nullable（向后兼容）
       : LicenseBatchDto 同步新字段（修复前后端 drift —— 之前 tier 只在 admin types 有）
       : LicenseService.createBatch 改签名：
       :   - 必须有 sellingChannelId 或 issuerTenantId 之一
       :   - sellingChannelId 非空时校验 SellingChannelService.requireActive
       :   - 透传 tier 字段
       : LicenseActivationService L141：Membership 只在 issuerTenantId 非空时建
       :   - 新批次走纯 SellingChannel 路径 → 不再自动加 Membership（彻底脱离 MCN 耦合）
       :   - 老批次行为不变

       : 新 SellingChannelMigrationSeeder（@Order 50, CommandLineRunner）
       :   - 首启 seed 默认渠道 "platform-self"（平台直营）
       :   - 扫所有 sellingChannelId=null 且 issuerTenantId 非空的老批次
       :     → 为每个 distinct tenantId 建 legacy-tenant-<前8> channel
       :     → 回填 batch.sellingChannelId
       :   - 幂等（按 code 查重）；JPA ddl-auto=update 自动建表 + 加列

types  : packages/types/src/selling-channel.ts 新建（SellingChannel / SellingChannelType /
       :   SellingChannelStatus / SellingChannelUpsertInput）
       : apps/admin/src/types/selling-channel.ts 镜像 + SELLING_CHANNEL_TYPE_LABEL 字典
       : apps/admin/src/types/license.ts LicenseBatch +sellingChannelId / +tier，
       :   issuerTenantId 改 optional
       : apps/web 遗留 license.ts 同样改 optional（apps/web Phase 5 待删）

admin  : 新 api/selling-channels.ts (list/get/create/update/delete) + api/index 注册
       : 新 /celebrity/selling-channels 页 CRUD（含「停用」二次确认 dialog，不裸 confirm）
       : nav.ts「平台账户」组追加「销售渠道」入口
       : /platform/licenses 改造：
       :   - load 并维护 channels 状态
       :   - CreateBatchDialog 把 tenant 下拉换成 sellingChannel 下拉（默认 platform-self）
       :   - 表格「发放方」列优先显示 sellingChannel.name + type 标签；
       :     老批次落到 issuerTenantId.name + "(legacy)" tag
       : api/licenses.ts CreateBatchInput +sellingChannelId / +tier，issuerTenantId 改 optional

openapi: +SellingChannel / SellingChannelType / SellingChannelStatus schemas
       : +/admin/selling-channels (GET/POST) + /admin/selling-channels/{id} (GET/PUT/DELETE) paths
       : +ActionPricing schema（v0.35 顺手补）
```

**数据迁移策略（重要）**：

- **不删除 `issuerTenantId` 列**：保留至少 2 个版本以便回滚 + 历史 ledger 追溯（v0.38+ 候选删除）。
- **现有 Membership 行保留**：v0.35+ 新激活不再 insert，但已有的不删除。Admin 「成员」页仍能查到老用户。
- **现有 LicenseBatch 自动迁移**：`SellingChannelMigrationSeeder` 首启把每个 distinct issuerTenantId 转成
  legacy-tenant-XXX channel，并回填 sellingChannelId。零手写 SQL。

**注意事项**：

- **破坏性变更等级最高**：涉及核心激活流程。但新老路径并存，老 dev 数据无破坏（迁移 seeder 自动 backfill）。
- 前端 tier drift 修复：admin types 早期已有 LicenseTier，后端模型现在补齐，DTO `tier` 字段终于流通。
- SellingChannel 与 Tenant 完全独立：Tenant 表保留用于 MCN / 合作伙伴关系等其它业务，不再绑批次。
- enum wire 全小写：`selling_channel.type/status` 都走小写串（direct / agent / active / inactive）。
- **未做**：(a) admin 「成员」页对 LICENSE_ACTIVATION 来源行的 UI 标记；(b) 按渠道维度的销售统计报表（v0.37+）；
  (c) 删除 issuerTenantId 列；(d) SellingChannel 与发票/对账系统打通。

### v0.35a（2026-05-27）— 动作级权益扣减配置（混剪生成 / 分发上传 / 视频生成）

> celebrity 子产品迭代第二批。

**背景**：v0.34 之前，celebrity 子产品权益扣减单价分散在两处：
- 混剪生成走 PlatformConfig key `mixcut.credit-per-variant`（default 30）；
- 分发上传走 application.yml `sau.default-upload-cost`（default 20）；
- 视频生成走 EnginePricing 表（KeLing/HiGen/MiniMax 三引擎统一）。

运营无法按业务动作细粒度配置。本版引入统一的「动作单价配置」入口。

```
server : 新 CelebrityActionPricingService（注 PlatformConfigService）
       :   key = celebrity.action-pricing，JSON 结构：
       :     { "mixcut.generate": { creditPrice: 30 },
       :       "publish.upload":  { creditPrice: 20 },
       :       "celebrity.video": { useEnginePricing: true } }
       :   @PostConstruct seedIfAbsent → 首启灌默认；admin PUT 立即失效缓存
       :   creditPriceOf(action) 返回 Long 或 null（null 表示「让调用方走自己的 fallback」）
       : 新 ActionPricingDto record { Long creditPrice, Boolean useEnginePricing }
       : MixcutJobService.currentPerVariantCost 优先 actionPricing("mixcut.generate")
       :   缺失 → 回退到老 PlatformConfig key `mixcut.credit-per-variant`
       :   再缺失 → MIXCUT_PER_VARIANT_COST_DEFAULT
       : PublishJobService 新增 currentUploadCost() 同 pattern：
       :   优先 actionPricing("publish.upload")，缺失回退到 sau.default-upload-cost
       : AdminCelebrityController +GET/PUT /api/admin/celebrity/action-pricing

admin  : api/celebrity-zone.ts +getActionPricing / +replaceActionPricing + ActionPricing 类型
       : /celebrity/engine-pricing 改造为双 Tab：
       :   - 「动作单价（v0.35）」：3 行 mixcut.generate / publish.upload / celebrity.video，
       :     可输入 creditPrice 或勾选「沿用引擎价」（仅 celebrity.video 允许）
       :   - 「引擎单价」：原 v0.5 KeLing / HiGen / MiniMax 表，行为不变

openapi: +/admin/celebrity/action-pricing (GET/PUT) path 骨架
```

**注意事项**：

- **积分账本不可变约束**（CLAUDE.md §4.2）：扣点链路完全沿用既有 `CreditService.hold/commitHold/releaseHold` 三段式；本版只改「单价从哪里读」，不动 LedgerEntry 写入路径。
- **向后兼容三层 fallback**：CelebrityActionPricingService 缺值 → 老 PlatformConfig key → 代码内 default。运营不动配置时行为与 v0.34 完全一致；老 dev/H2 lite 数据无破坏。
- **缓存一致性**：`AtomicReference<Cache>` 1min TTL；admin PUT 后立即失效。沿用 EnginePricing 的 v0.33 pattern。
- **action 命名约定**：`<domain>.<verb>`（如 `mixcut.generate` / `publish.upload`）。后续扩展按需追加 `celebrity.template-purchase` 等动作。
- **未做**：(a) 按用户 / 工作室 / 明星粒度差异化定价（v0.37+ 候选）；(b) `celebrity.video` 的真扣费链路（v0.34 没接 hold/commit，本版只把单价入口准备好）；(c) 分发 perTargetPrice 累乘（接口预留但 service 未消费）。

### v0.34a（2026-05-26）— Stars 写入闭环 + Celebrity 工厂模板（运营初始化能力补齐）

> 与同期上游 v0.34（部署架构）并行的 celebrity 子产品迭代。

主线背景：celebrity 子产品**初始化生产部署**时，运营需要先添加明星档案 / 配置工厂模板，用户才能在 web-celebrity 看到。审计发现：(a) `AdminCelebrityController` 的 stars POST/PUT/DELETE 端点完整，但 admin 前端 `/celebrity/stars` 只有列表展示，**没有创建/编辑表单 UI**；(b) `CelebrityTemplate` 模型**完全没有 owner 概念**（所有模板由 seeder 写死），无法区分「工厂模板（所有用户可见）」与「用户私有模板」；(c) nav.ts L100 注册了 `/celebrity/templates` 路由但**页面文件不存在**。

```
server : CelebrityTemplate.java +isFactory(boolean, ColumnDefault "true") / +ownerScope(varchar 64,
       :   ColumnDefault "'factory'") / +ownerUserId(varchar 64, nullable) —— 镜像 MixcutTemplate
       :   pattern；JPA ddl-auto=update 自动加列；老行默认全部视为 factory。
       : CelebrityTemplateDto +isFactory/+ownerScope/+ownerUserId 三字段；from() 同步落值
       : AdminCelebrityTemplateUpsertDto +isFactory(Boolean, nullable)/+ownerScope/+ownerUserId
       : CelebrityZoneService.applyTemplateUpsert() 处理新字段；空值兜底为 factory + "factory"
       : CelebrityZoneService 新增 listTemplatesForUser(userId) —— factory + 自己私有；老
       :   listTemplates() 保留（admin / 无身份调用走全表）
       : CelebrityZoneController.GET /templates 改走 listTemplatesForUser(principal)

types  : packages/types/src/celebrity-zone.ts CelebrityTemplate +isFactory: boolean / +ownerScope:
       :   string / +ownerUserId?: ID | null（required，无默认）
       : apps/admin/src/types/celebrity-zone.ts 镜像
       : apps/web/src/types/celebrity-zone.ts 遗留：用 optional 字段（避免改老 mocks，apps/web
       :   Phase 5 即将删）

admin  : src/app/celebrity/stars/page.tsx 加 CRUD：「新增明星」按钮 → StarFormDialog；
       :   行级 Pencil/Trash2 按钮；删除走 shadcn Dialog 二次确认（不裸 confirm()）
       :   表单字段：name / category / avatar / cover / description / pricingTier / startingPrice /
       :   isHot / quotaTotal（基础字段够用，复杂 JSON 嵌套留给 photos / videos 子端点）
       : src/app/celebrity/templates/page.tsx 新建：模板 CRUD 全功能页 + 「工厂模板 / 用户私有」
       :   筛选 chip + 「新增工厂模板」按钮 + 行级编辑/删除；归属字段在表单里用 Switch 切换
       :   factory / private
       : src/mocks/celebrity-zone.ts ADMIN_CELEBRITY_TEMPLATES 补 isFactory + ownerScope

web-celebrity:
       : src/mocks/celebrity-zone.ts CELEBRITY_TEMPLATES 6 条预设模板均补 isFactory:true + ownerScope:"factory"
openapi: CelebrityTemplate schema +isFactory + ownerScope + ownerUserId；required 列表追加
       :   isFactory + ownerScope（ownerUserId 仍 nullable）
```

**注意事项**：

- 老 `CelebrityTemplate` 行：依赖 `@ColumnDefault("true")` + JPA ddl-auto=update 自动补 isFactory=true / ownerScope="factory"，无需手写 migration。MySQL prod 部署同样兼容（不再走 H2）。
- `listTemplates()` 老方法**保留**：admin 端 (`/api/admin/celebrity/templates`) 不需要 userId 过滤，直接看全部；用户端走新的 `listTemplatesForUser(principal)`。
- admin 「新增工厂模板」默认 `isFactory=true / ownerScope="factory"`；用户私有模板入口暂未在 UI 上暴露（v0.34a 范围仅工厂模板初始化能力），用户私有模板由 web-celebrity 端用户「保存」时由后端 service 写入。
- mocks 三处同步保证 USE_MOCK 模式下 typecheck 全绿（packages/types 字段 required → 编译器强校验）。

### v0.32（2026-05-25）— admin 后台「秘钥铸码 UI」+「管理员账号 CRUD UI」补全 + DataInitializer 明文激活码日志

之前 server 端 `/api/admin/license-batches/{id}/mint-keys`（v0.31 落地）和 `/api/admin/staff/**`
endpoints 都可用，但前端没接入：批次新建按钮无 onClick；铸码只能 curl；管理员账号管理无入口。
DataInitializer.seedSampleKeys 在 dev 首启时生成 10 把测试激活码但未打印明文，DB 只存 sha256
→ 想拿明文必须重置 H2 重新种码。

```
server : DataInitializer.seedSampleKeys 改返回 List<String> rawCodes（之前 void）；
       :   两处调用点收集后调 logSeedRawCodes(batch, rawCodes) 用 WARN level 横幅打印
       :   ("⚠️  DEV-SEED LICENSE CODES — DO NOT USE IN PRODUCTION" + 批次名 + 单包点数 + 每码)
       : AepSecurityConfig 新增 .requestMatchers("/api/admin/staff/**").hasRole("SUPER_ADMIN")
       :   排在通用 /api/admin/** hasAnyRole 之前；之前 OPERATOR 也能 CRUD admin 账号（漏洞）

admin  : api/licenses.ts +mintKeys(batchId, count): MintKeysResult；createBatch 入参收紧为
       :   CreateBatchInput record（name / issuerTenantId / initialCreditGrant / totalCount /
       :   validFrom? / validTo?）
       : app/platform/licenses/page.tsx 新建批次按钮接入 CreateBatchDialog（4 字段 + 等级 →
       :   单包点数派生）；批次行追加「铸码」按钮 → MintKeysDialog → 提交后弹 RawCodesDialog
       :   一次性展示明文 + 「复制全部」按钮（用户点「我已保存」关闭后不可恢复）
       :   撤回按钮的 onConfirm 真正接通 revokeKey（之前只弹框无落库）
       : api/staff.ts 新文件 — listStaff / createStaff / updateStaff / deleteStaff；
       :   API 边界把 server 返回的小写 role ("super_admin"/"operator") 归一化为前端约定
       :   大写 ("SUPER_ADMIN"/"OPERATOR")
       : api/index.ts +export * as StaffApi
       : mocks/staff.ts 新文件 — 2 条样本（与 DataInitializer 种子账号对齐）
       : app/platform/staff/page.tsx 新页 — admin_users 列表（搜索 + 角色筛选）+ 新建 +
       :   编辑（含重置密码 / 角色切换 / 状态切换）+ 删除（ActionDialog requireReason）
       : constants/nav.ts 「平台账户」组追加「后台管理员」入口（roles: ["SUPER_ADMIN"]）
       : lib/useAdminRole.ts 顺手修复 — cachedRole = u.role.toUpperCase()（之前 AdminUserDto
       :   返回小写 / 前端约定大写 → role-gated 菜单对真实超管也是隐藏的；v0.30 的
       :   /platform/error-logs gate 之前只在 USE_MOCK=1 时生效）

apps/admin/README.md  : 版本日志 + sidebar 段同步
```

**注意事项**：

- 「明文一次性返回」是核心安全约定：server 只存 sha256_hex；调用方拿到 raw 后负责安全分发（线下 / IM / 邮件 / 工单等）。`RawCodesDialog` 关闭即丢；用户必须主动「复制全部」才能保存。
- `CreateBatchDialog` 提交时**不**自动调 mint-keys —— 批次本身创建时 server 已经预铸 `totalCount` 把 key（沿用 LicenseService.createBatch 既有行为）但这批 key 的明文没暴露。如果新建后想拿明文，要单独点行内「铸码」按钮再多铸 N 把（这是 v0.31 mint-keys endpoint 的设计意图）。
- 单批一次最多 100 把：server `mintKeysAndReturnRawCodes` 已有 1..100 校验；前端 dialog 也加了同样上界，避免请求被 400。
- `/api/admin/staff/**` 安全收紧是破坏性变更：之前 OPERATOR 能调（hasAnyRole），现在只 SUPER_ADMIN（hasRole）。线上没有外部消费方，干净切换。
- DataInitializer 用 WARN level + 横幅故意「在生产意外触发时也极其显眼」：admin_users 表为空 → 误以为是首启 → 跑 seed → 日志里 5 行 WARN「DEV-SEED」立刻让运维发现。
- AdminUserDto.from() 把 role / status enum 转小写 —— 这是当前仓库的 wire 约定（AGENTS.md §4.1「enum 出 wire 时全小写」）。admin 前端约定的 AdminRole = "SUPER_ADMIN" | "OPERATOR" 是历史遗留，v0.32 不动 TS 类型，而是在 API 边界 normalize（`useAdminRole` + `staff.ts.normalize()`）。后续可以 v0.33+ 把 admin TS 类型也改成小写跟其它 enum 一致。
- 当前 admin 自己也能删/降级**自己**的账号（server 无 self-protect 校验）。前端 `handleEdit` 用了 loose `isSelf` 判断禁用删除按钮，但 username == role 这种 hack 判断仅当 username 字段碰巧等于角色名时触发 —— 等同于「无防护」。真正的 self-protect 在 server `AdminStaffController` 里加 `if (id.equals(principal.getName())) throw ...` 才合适，v0.33+ 候选。

### v0.31（2026-05-24）— celebrity 账户体系收口：商品库公共池 / 内嵌运营角色 / 手机号 SMS 登录

一次性把 celebrity 子产品的「数据隔离 + 登录注册 + 运营管理」三件事补齐。背景：审计
发现 `/api/products/**` 完全无认证，匿名能 CRUD；同时只有 dev-login 入口，prod 无
真实登录路径。本节按四块改动组织（独立、可分别理解），最后给统一的配置 / 注意事项。

---

**📋 改动总览**

| 子模块 | 关键改动 |
|---|---|
| **A. 商品库公共池化** | 写动作收归 admin；普通用户只读；按 productId 自动 bump usageCount |
| **B. 内嵌运营角色** | `AepUser.operatorRole` 字段；JWT 透传；web-celebrity 按角色条件渲染写按钮 |
| **C. admin 操作员管理页** | `/admin/celebrity/operators`：list aep_users + 切角色按钮 |
| **D. 手机号 + SMS 登录 / 注册** | LogSmsSender（默认）/ AliyunSmsSender（阿里云官方 SDK）；双因素注册（SMS + License） |

---

#### A. 商品库公共池化（写归 admin）

**审计漏洞**：

1. `/api/products/**` 落在 `AepSecurityConfig` 的 `anyRequest().permitAll()` 兜底
   规则下，匿名用户即可 CRUD 全部商品；
2. `Product` 表无 `ownerUserId` 列，任意登录用户能改 / 删他人引用的商品；
3. `/api/me/products/from-link` / `/api/me/products/{id}/refresh-images` 虽已认证，
   但任意登录用户均可往公共池写入；
4. 商品库前端入口（「新建商品」/「📋 从抖音链接快速建档」/「编辑」/「删除」/
   「刷新图片」）让普通用户自由 CRUD。

**决策**：商品库保持「公共商品池」语义；写动作（CRUD + from-link + refresh-images +
extract-selling-points）全部收归 `/api/admin/products/**`，仅 SUPER_ADMIN / OPERATOR
可调（用户的 operatorRole 也满足，见 B 节）。普通用户只读 + 调
`/me/products/parse-link` 预览（不写库）。

```
server  : ProductsController 精简为只读（GET /api/products + GET /api/products/{id}）
        : AdminProductsController 承载 POST/PATCH/DELETE + extract-selling-points +
          from-link + refresh-images（hasAnyRole 自动继承）
        : ProductLinkController 精简为仅 POST /api/me/products/parse-link
        : AepSecurityConfig +.requestMatchers("/api/products/**").authenticated()
        : ProductService +bumpUsageCountByProductId(productId)
                        +bumpUsageCountByLinkOrName(link, name) — 找不到返回 null
        : MixcutJobService.createInternal 创建任务时按 productId 内部 bump（取代
          v0.28 前端 fire-and-forget /products/upsert-from-generation）
admin   : api/products.ts 全 URL 改 /admin/products；+parseLink / fromLink /
          refreshImages / extractSellingPoints
        : types/product.ts +priceCents / commissionRate / ProductLinkInfo
        : celebrity/products/page.tsx 顶部「从抖音链接建档」+「新建商品」+ 行内
          「编辑」「刷新图片」「删除」+ 两个 dialog
openapi : drop /products POST / PATCH / DELETE / upsert-from-generation /
                extract-selling-points / /me/products/from-link / refresh-images
        : add /admin/products/* 完整 schema
```

**行为变化**：以前用户在生成视频时随手填的商品名会自动沉淀到公共池；v0.31 起
不会。usageCount 仍会 +1，但只覆盖**已存在**的商品（按 productId 精确匹配）。

---

#### B. 内嵌运营角色（AepUser.operatorRole）

**问题**：A 节把商品库写动作锁死在 hasAnyRole(SUPER_ADMIN, OPERATOR) 后，celebrity
端用户即使是平台运营人员，登 web-celebrity 也看不到写按钮 —— 因为他们的 JWT.role
是 STUDIO，且 admin_users 是另一套表。

**决策**：给 `aep_users` 加 `operatorRole` 字段（独立于 admin_users），让 celebrity
体系内部能识别「我是平台运营」。JWT 在 operatorRole 非空时优先用它作 role claim
（命名故意与 AdminUser.AdminRole 对齐 → 同一 role 字符串能复用 hasAnyRole 门禁）。

```
server  : AepUser +operatorRole 列（enum OPERATOR / SUPER_ADMIN, nullable）
        : AepUserDto / MeDto +operatorRole 字段（"operator" / "super_admin" / null）
        : DevAuthController.dev-login + LicenseActivationService.activate +
          SmsAuthController.verify —— operatorRole 非空时作 JWT.role 优先值
        : DataInitializer.ensureCelebrityOperatorSeed 幂等 seed 一个
          celebrity_operator（kind=studio, operatorRole=OPERATOR），dev-login
          下拉可见；老 H2 文件落库环境第一次启动 v0.31 也会自动补这条
shared  : packages/types/src/account.ts AepUser +operatorRole?: OperatorRole | null
        : packages/api-client useAuth() 返回的 user 自带 operatorRole
web-celebrity:
        : api/products.ts 写入 helper（createProduct / updateProduct / deleteProduct /
          parseAndCreateProduct / refreshProductImages / extractSellingPoints）URL 全
          走 /admin/products/**
        : CelebrityProductLibrary / Detail / Form 用 useAuth().user.operatorRole
          条件渲染所有写按钮 + Empty state 文案双态切换
        : 重新挂载 ProductFormDialog / ProductBatchImportDialog（仅 canManage 时）
```

**两套体系对照**：

| 维度 | admin 后台 | celebrity / 用户子产品 |
|---|---|---|
| 用户表 | `admin_users` | `aep_users` |
| 登录端点 | `POST /api/admin/auth/login`（密码） | SMS / dev-login / license 激活 |
| 接入前端 | apps/admin | apps/web-celebrity（及历史 apps/web） |
| 角色字段 | `AdminUser.role` enum | `AepUser.kind` + `AepUser.operatorRole` |
| JWT.role claim | `admin.role.name()` | `operatorRole.name()` 优先；否则 `STUDIO`/`USER` |

**升级粒度**：v0.31 的 operatorRole 是**全局角色**（不分租户）。`Tenant` /
`Membership` 表存在但只做 License 核销归属统计，不做运行时权限切片。

---

#### C. admin 操作员管理页

**问题**：B 节 operatorRole 落库后无 UI 维护，初期靠 H2 console SQL 或重启
DataInitializer 才能给真实用户授权。

```
server  : AdminAepUsersController
            GET  /api/admin/aep-users?q=&hasOperator=
            PATCH /api/admin/aep-users/{id}/operator-role { operatorRole }
admin   : /admin/celebrity/operators 新页面：list + 「运营 / 超管 / 移除」按钮组
        : sidebar「明星带货」组新增「平台运营」入口
        : api/aep-users.ts + types/account.ts +operatorRole
```

⚠️ 当前**允许 OPERATOR 自己改自己 / 改他人**的 operatorRole（继承 hasAnyRole 门禁）。
如要严格「只 SUPER_ADMIN 能授权」，在 PATCH 端点加 `@PreAuthorize("hasRole('SUPER_ADMIN')")`。

---

#### D. 手机号 + SMS 验证码 登录 / 注册（celebrity 主入口）

**问题**：dev-login 仅 dev profile 可用；prod 无任何真实登录入口。

**抽象层**：`SmsSender` 接口 + 两个实现（@ConditionalOnProperty 互斥）：

| Driver | 实现 | 用途 |
|---|---|---|
| `log`（默认） | `LogSmsSender` | 验证码打到 server log（dev / 联调 / 阿里云未备案时占位） |
| `aliyun` | `AliyunSmsSender` | 调阿里云 SMS 官方 SDK（`alibabacloud-dysmsapi20170525`） |

`aliyun` 驱动走官方 SDK。凭据优先读 `ALIYUN_SMS_ACCESS_KEY_ID` /
`ALIYUN_SMS_ACCESS_KEY_SECRET`；两者都不配时走 Alibaba Cloud 默认凭据链（如
`ALIBABA_CLOUD_ACCESS_KEY_ID` / ECS RAM Role）。

**端点**（全部 permitAll）：

| 端点 | 用途 |
|---|---|
| `POST /api/auth/sms/request-code { phone, purpose?: "login" \| "register" }` | 发码；返回 `{ sent: true }`；登录 / 注册模板分离 |
| `POST /api/auth/sms/verify { phone, code }` | 登录；用户必须已注册；404 USER_NOT_FOUND 引导走 register |
| `POST /api/auth/sms/register { phone, code, licenseKey, studioName, displayName? }` | **双因素注册**：SMS 验证码 + License 激活码同时通过；复用 LicenseActivationService.activate；username 自动 `phone_<手机号>`；phoneVerified=true |
| `POST /api/admin/license-batches/{id}/mint-keys?count=N` | （配套）admin 一次性铸 N 把 key 并**返回 raw codes**（write-once；DB 只存 sha256） |

**SmsCodeService**（in-memory + 节流）：

- ConcurrentHashMap 存 `phone → { purpose, code, sentAt, failures, lockedUntil }`
- 60s 速率限制（单 phone）
- 5 次错误自动锁定 30 分钟
- 验证码 5 分钟 TTL；成功后**立即删除** entry（防重放）
- @Scheduled 60s 清理过期 entry

**web-celebrity `/login` 三 tab**：

| tab | 用途 |
|---|---|
| **手机号登录** | phone + 验证码 + 60s 倒计时发码按钮；失败 USER_NOT_FOUND 自动切到注册 |
| **注册** | phone + 验证码 + 激活码 + studioName + displayName? |
| **dev** | 保留原 dev-login 下拉（dev profile only） |

**`packages/api-client/src/api/auth.ts`** 新增 `smsRequestCode` / `smsLogin` / `smsRegister`。

**openapi.yaml**: `/auth/sms/*` 与 `/admin/aep-users/*` 路径全部入 schema。

---

#### 配置（application.yml）

```yaml
aep:
  sms:
    driver: ${AEP_SMS_DRIVER:log}        # log（默认）或 aliyun
    code:
      length: 6
      ttl-seconds: 300                   # 验证码 5 分钟有效
      rate-limit-seconds: 60             # 同 phone 60s 不能重发
      max-failures: 5                    # 错 5 次锁
      lock-seconds: 1800                 # 锁 30 分钟
      # dev 联调专用：driver=log + 非空 才生效；driver=aliyun 时忽略并 WARN
      dev-fixed: ${AEP_SMS_DEV_FIXED_CODE:}
    aliyun:
      access-key-id: ${ALIYUN_SMS_ACCESS_KEY_ID:}
      access-key-secret: ${ALIYUN_SMS_ACCESS_KEY_SECRET:}
      sign-name: ${ALIYUN_SMS_SIGN_NAME:}
      # 模板变量固定只有 code；sender 始终发送 {"code":"123456"} 形态
      login-template-code: SMS_507065062
      register-template-code: ${ALIYUN_SMS_REGISTER_TEMPLATE_CODE:}
      region: ${ALIYUN_SMS_REGION:cn-hangzhou}
      endpoint: ${ALIYUN_SMS_ENDPOINT:dysmsapi.aliyuncs.com}
      connect-timeout-seconds: ${ALIYUN_SMS_CONNECT_TIMEOUT_SECONDS:10}
      response-timeout-seconds: ${ALIYUN_SMS_RESPONSE_TIMEOUT_SECONDS:20}
      call-timeout-seconds: ${ALIYUN_SMS_CALL_TIMEOUT_SECONDS:30}
```

**dev-fixed 双门禁**：必须 `driver=log` + 非空才生效；启动 banner 会 WARN
「DEV-FIXED CODE ENABLED — all phones will receive code=xxxxxx」。配错（非纯数字 /
长度不匹配 code.length）直接 fail-fast。`driver=aliyun` 时 dev-fixed 即使配了也
被忽略并 WARN，防 prod 误开。

**生产切换路径**：
1. 阿里云控制台备案签名 + 创建登录/注册模板（都只带 `${code}` 变量）+ RAM 给 SMS FullAccess
2. `export AEP_SMS_DRIVER=aliyun ALIYUN_SMS_SIGN_NAME=... ALIYUN_SMS_REGISTER_TEMPLATE_CODE=...`
   并配置 AK，或让运行环境提供 Alibaba Cloud 默认凭据链
3. 重启 server，`AliyunSmsSender` bean 注入，`LogSmsSender` 自动停用

---

#### 当前 dev 账号清单

| 账号 | 表 | 登录方式 | JWT.role | 用途 |
|---|---|---|---|---|
| `admin` / `admin123` | admin_users | `/api/admin/auth/login` | SUPER_ADMIN | admin 后台超管 |
| `operator` / `operator123` | admin_users | `/api/admin/auth/login` | OPERATOR | admin 后台运营 |
| `celebrity_operator` | aep_users | `/api/auth/dev-login`（dev免密） | **OPERATOR** | web-celebrity 内嵌运营（管商品库） |
| `creator_luna` | aep_users | dev-login | STUDIO | 普通工作室 |
| `studio_starlight` | aep_users | dev-login | STUDIO | 普通工作室 |
| `agency_moonrise` | aep_users | dev-login | STUDIO | 普通工作室 |

prod 部署时 `dev-login` 关闭（`@ConditionalOnProperty aep.dev-auth.enabled=false`），
DataInitializer 不跑，真实运营账号通过 admin `/celebrity/operators` 页升级。

---

#### 跨节注意事项

- **AepUser.operatorRole 与 admin_users 独立**：两套表不互通，但 JWT.role 字符串
  对齐（OPERATOR / SUPER_ADMIN）→ 同 hasAnyRole 门禁均可通过。
- **operatorRole 变更不会主动 invalidate 旧 JWT**：用户被升级后，旧 JWT 里 role
  还是 STUDIO，要等 JWT 过期（1h）或重新登录才生效。当前是「告知用户重登」；
  改进路径：admin layout 加 setInterval 60s refresh /api/me 检测变化弹 toast；
  长期：Redis token 黑名单（v0.32+ 候选）。
- **SMS 验证码 in-memory**：单实例 ok；多实例 prod 部署前必须换 Redis（验证码 +
  失败次数 + 锁定状态都要共享）。
- **`/auth/sms/verify` 404 时验证码已消费**（防爆破）—— 用户切到注册需重新发码。
- **`/auth/sms/register` username 自动 `phone_<手机号>`**，用户不能自选。
- **`AliyunSmsSender` SDK 配置**：签名、模板、region、endpoint、超时都走
  `aep.sms.aliyun.*`；凭据可显式配 AK 或使用 Alibaba Cloud 默认凭据链。
- **`AdminProductsController.from-link` 的 userId 语义**：parseAndPersist 内部
  用 userId 给商品图作为 MixcutAsset 注册时打 owner 标记。admin 调用时素材归到
  admin 自己名下；用户从混剪消费走 isOfficial / public 路径，不按 owner 过滤。
- **DataInitializer.ensureCelebrityOperatorSeed 幂等**：按 username 检查，已存在
  跳过。老 H2 文件落库环境第一次启动 v0.31 也能自动补 celebrity_operator。
- **`CelebrityProductSeeder` 保持现状**：seed 6 行商品到公共池无 owner，合理。
- **前端角色门只是 UX 防御**：普通用户绕过 UI 直接 curl /api/admin/products →
  server 端 hasAnyRole 仍会 403。
- **本节不动其他端点**：mixcut / 发布 / 钱包 / 社交账号 等 user 私有数据已按
  ownerUserId 严格隔离（pre-v0.31），无需改动。

### v0.30（2026-05-23）— 混剪任务「重跑」入口（fork 新 job + 缺素材严格阻拦）

用户反馈「生成任务重跑时应该可以用当时的元素和配置重新生成」。诊断：任务态实际**已基本快照化**（v0.25+ 累积），缺的是「重跑入口」+「缺素材保护」。前端原「重新生成」按钮只跳 `/mixcut/create/<template_id>`，丢弃所有 binding 等于从零做。

**设计决策**（用户已确认）：
- 重跑 → **fork 新 job**（带 `forked_from_job_id` 指回原任务，保留 lineage）
- 缺素材 → **严格阻拦**（409 + missing_assets，不让 demo 沉默串进用户预期）
- 可调字段 → **仅 variants + profile**（其它快照原样复用；要换素材请走 create 页）

```
server : MixcutRenderJob +forked_from_job_id (length=64, nullable, 无外键约束)
       : MixcutRenderJobDto +forked_from_job_id
       : 新 MixcutRerunJobRequest(outputVariants?, perturbationProfile?) record
       : 新 MissingAssetItem(slotId, assetId, source, kind) record
       : 新 MissingAssetsException extends RuntimeException, carries List<MissingAssetItem>
       : MixcutJobService 注入 MixcutAssetRepository；create() 抽出 createInternal/createForked
       : 新 MixcutJobService.rerun(originalJobId, principalUserId, overrides):
           - findById + owner 校验（不属于则 404 MIXCUT_JOB_NOT_FOUND，不暴露存在性）
           - collectMissingAssets(slotBindingsJson): 遍历 binding，source∈{upload,library} 且
             带 asset_id 的条目 → assetRepo.findAllById 比对 → 缺失 throw MissingAssetsException
           - 通过 → 构造 MixcutCreateJobRequest（所有快照原样，仅 variants/profile 用 overrides）→ createForked
       : MixcutController +POST /api/mixcut/jobs/{jobId}/rerun（body 可空）
       : GlobalExceptionHandler +@ExceptionHandler(MissingAssetsException.class) → 409，
         body = { error: { code: "MISSING_ASSETS", message, details: { missing_assets: [...] } } }

specs  : openapi.yaml /mixcut/jobs/{jobId}/rerun (POST, tag mixcut, operationId rerunMixcutJob)

web-celebrity:
       : types.ts RenderJob +forked_from_job_id?: string；
         +MixcutRerunJobRequest / +MissingAssetItem 类型
       : api/mixcut.ts +rerunJob(jobId, overrides?): Promise<RenderJob>（USE_LOCAL 克隆 mock job）
       : 新组件 components/mixcut-zone/RerunJobDialog.tsx
           - shadcn Dialog + RadioGroup（来自 @ai-star-eco/ui/ui/*）
           - 两表单字段：output_variants (1-10) + perturbation_profile (light/moderate/aggressive)
           - 提交成功 → router.push(/mixcut/jobs/<new-id>)
           - 错误 409 MISSING_ASSETS → 切错误态视图，列出缺失 slot/asset，
             给「去素材库重传」(/mixcut/library?tab=assets) / 「用模板从头做」
             (/mixcut/create/<templateId>) 两按钮
       : jobs/[id]/job-detail-client.tsx:
           - 顶部 action 区加「重跑」按钮（completed/failed 都显示）
           - 现有「重新生成」按钮改名「换素材重做」→ 跳 create 页（与重跑互补）
           - 头部 status chip 区加「由 #xxxxxx 重跑」徽章（仅当 forked_from_job_id 非空）
```

**注意事项**：

- **不重算** `source_phash`：fork 新 job → 渲染流水线自然算（首段视频 aHash）。
- **不允许覆盖**其它快照字段：rerun 只接 variants + profile；要改 binding 请走 create 页。
- 缺素材检测**只覆盖 source ∈ {upload, library} 且 asset_id 非空**的条目；picgen/input/fixed 不涉及素材表，跳过。
- ApiError.details 字段是 unknown：前端 `(e.details as { missing_assets?: MissingAssetItem[] })?.missing_assets ?? []` 解结构。
- USE_LOCAL（mock）路径**跳过缺素材校验** —— mock 模式没真实 asset 表，直接克隆 mock job + 改 id + 标 forked_from_job_id 返回。要测缺素材态需 NEXT_PUBLIC_MIXCUT_USE_REAL=1。
- 老任务 fork：原 job 的 `slotBindingsJson` 缺 `asset_id`（v0.16 之前 binding 结构）→ collectMissingAssets 跳过 → 不阻拦。会用 file_url / picgen 等 fallback 路径继续渲。
- JPA `ddl-auto=update` 自动加列；H2 dev / MySQL prod 双兼容；不写 flyway/liquibase migration（与 v0.19 加 publishCount / v0.21 加 deletedAt 同惯例）。

**显式 out-of-scope**：sticker_pool 可视化重编、基于 job 预填 create 页 deep link、追加同 job 语义、多实例 ShedLock（rerun 是同步派单，不涉及 @Scheduled）。

### v0.29（2026-05-23）— 混剪主视频按 scene 严格匹配（fix v0.25 盲点）+ 模板预览中性化 + 段时长联动素材

三块独立小改动合并到一节，全部仅 web-celebrity + server，无契约 / DB schema 变更。

**A. 致命 bug 修复：混剪主视频跨段串色（v0.25 漏修）**

v0.25 把场景切分（segCount = scenes.size + per-scene durationSec）和 overlay 时段限制（enable=between(t,a,b)）做了，但 `MixcutRenderingService.renderOneVariant` 的主视频取源仍是平铺 round-robin：

```java
File src = sources.get((variantIndex + i) % sources.size()); // ❌ 跨段串色
```

`resolveBindings` 把所有 user-bound video slot 文件拍平进 `List<File> videos`，丢失了「哪条视频绑给哪个 scene」的归属。结果：

- 用户给 scene 1 绑 A，scene 2 没绑 → `videos=[A]` → 两段都拿 A 不同随机片段 → 视觉上 A 贯穿全片
- 用户 scene 1 绑 A、scene 2 绑 B → variantIndex=1 时取序变成 `[B, A]`

**修复（server 内部重构，无 API 变化）**：

```
server : ResolvedBindings +videoBySlotId: Map<String, File> +demoPool: List<File>
       : resolveBindings 在 VIDEO_LAYERS 分支同时写入 videoBySlotId.put(slotId, local)
       : resolveBindings 始终预填 demoPool（不只是 videos.isEmpty 时），useSceneSchedule
         scene 没绑 video 不能再回退到用户其它 video（会串色），改走 demoPool
       : renderOneVariant 签名 +Map<String, File> videoBySlotId / +List<File> demoPool
       : renderOneVariant 在 segment loop 之前算 perSegSrc[segCount] —— 按 scene.slotIds
         反查 video layer slot → videoBySlotId 取文件；未命中 → demoPool round-robin；
         demoPool 也空 → 最最兜底退回旧 sources round-robin
       : segments_detail 加 video_match 诊断字段：user_slot / demo_fallback / legacy_roundrobin
```

**注意事项**：

- 兜底链严格：未命中的 scene 走 demoPool（与用户视频隔离），永远不回填到用户其它 scene 的 video。这是修复的核心 —— scene 隔离不再被破坏。
- legacy 路径（useSceneSchedule=false，老任务 scenes_snapshot 为空）保持原 round-robin 行为，零回归风险。
- `apps/web/public/videos/showreel-*.mp4` 缺失（极少）→ demoPool 为空 → 退回 sources round-robin（与 v0.25 行为相同，不会比 v0.25 更糟）。
- 无 schema / API / openapi 改动；纯 server 内部逻辑修复。

**B. 模板预览统一中性配色（去除工厂 mock 色噪声）**

模板缩略图（列表 / 首页推荐）+ 模板详情/编辑器 + 创建页四处的 `TemplatePreview`，原本都吃 `template.canvas.background_color`（mock seed 各色不同 → 黄/绿/蓝灰拼盘）+ `BLUEPRINT_LAYER_STYLES` 按 layer_type 上色（sky/emerald/rose/violet），视觉极杂乱。用户无法在创建模板时指定 canvas 色 → 这套染色既无产品意义又拉低视觉一致性。

```
web-celebrity:
  template-preview.tsx
    - 删 canvas style 的 backgroundColor: template.canvas.background_color
      (className 已有 bg-black 兜底；数据真值保留，server ffmpeg 渲 mp4 仍按各模板自身 background_color 走)
    - BLUEPRINT_LAYER_STYLES 抽出 NEUTRAL_BLUEPRINT_FRAME = { bg: white/4%, border: white/30%,
      text: white/80% }，4 个 layer_type 共用同一套描线，仅 icon 字段按类型区分
```

效果：所有预览统一黑底 + 灰白虚线框 + 类型 icon；编辑器内 violet ring 选中态成为唯一彩色高亮，注意力不被无产品语义的颜色干扰。

**C. 模板编辑器：场景时长改动联动 slot.time_range**

`updateScene` 原本是机械合 patch，改场景时长（SceneFlowEditor 输入框 → onChange(idx, { duration: v })）后 slot.time_range 不动，导致：
1. 视觉脱钩（slot 还在老时间格上）
2. 触发 validateTimeRanges 的「结束时间超本场景时长」保存校验失败

```
web-celebrity:
  template-detail-client.tsx
    + rescaleSceneSlots(scene, newDuration) helper —— ratio = new/old 等比例缩放
      所有 slot.time_range，clamp 到 [0, newDuration]；旧时长 ≤ 0 兜底拍平到 [0, new]
    : updateScene 检测 patch.duration !== sc.duration 时先 rescale 再合 patch
  scene-flow-editor.tsx
    + 时长输入框下加一行 hint「改时长后，本段内的素材时长会按比例同步缩放」
```

策略选择：**等比例缩放**而非仅 clamp —— 用户改时长一般是整体节奏调整（"这段做短"），而非"保留前 N 秒砍后面"。要精修单 slot 端点可单独编辑 time_range。

### v0.38（2026-05-28）— 大模型配置化 + 内置预设 + 模型发现

把大模型 provider 从「seed 占位 + dev/prod 区分」彻底改成「纯 admin 配置 + 内置预设 + 接口拉模型」。
配套 v0.37 起的集成测试发现：`AiModelInvocationService` 只认 OPENAI/OPENAI_COMPATIBLE，
而 seed 把火山/阿里标为 VOLCENGINE/ALIYUN，启用后必 501（同期已放宽兼容集，见 server README）。

```
server : 删除 AiModelProviderDataInitializer（不再 seed 占位 provider；dev/prod 一视同仁走配置）
       : AiModelProviderDto / AdminAiModelProviderUpsertDto +models（落 ai_model_providers.models_json）
       : 新 dto AiModelEntryDto / AiModelProviderPresetDto / AiModelDiscoveryRequestDto / AiModelDiscoveryResultDto
       : AiModelProviderAdminService +listPresets（5 个内置：火山方舟/Kimi/DeepSeek/千问/OpenAI）
         +discoverModels(baseUrl,apiKey)（新建前拉）+fetchModels(id)（已存用落库密钥拉）；create/update 序列化 models→modelsJson
       : AiModelInvocationService +listModels(type,baseUrl,apiKey)：GET /models 解析 data[].id，
         过滤 status=Shutdown/Retiring（火山方舟会带 status）
       : AdminAiModelProviderController +GET /presets +POST /discover-models +POST /{id}/fetch-models
admin  : api/ai-models.ts +AiModelEntry/+AiModelProviderPreset/+ModelDiscoveryResult +listPresets/discoverModels/fetchModels；
         AiModelProvider/upsert +models
       : /platform/ai-models 页：顶部「快速添加」预设 chip；表单「可用模型」区（获取模型列表→点选默认）；
         列表 +模型数列 + 搜索框
openapi: +/admin/ai-models/presets +/discover-models +/{id}/fetch-models（骨架，沿用既有 admin 风格）
specs  : 契约 gate 不扫 apps/admin，故不阻断；openapi 仍补齐 path 以免 drift
```

**注意事项**：

- 模型发现 / fetch 都**不落库**，仅返回列表；持久化统一走 create/update 的 `models`，避免「拉一下就改库」。
- discover（新建）用表单里现填的明文 AK；fetch（已存）用解密后的落库 AK——所以已存 provider 不必重填密钥。
- providerType 兼容集放宽是同期 server 改动（除 ANTHROPIC/AZURE_OPENAI 外都走 OpenAI wire），预设里火山/阿里/Kimi/DeepSeek 因此可直接发起 chat 与 /models。
- 老部署若已有 seed 占位行（`REPLACE_WITH_*`）不会被自动清理——在 admin 列表里删掉即可。
- 模型 id 必须是服务商真实 id（如火山方舟 `doubao-1-5-lite-32k-250115`，非展示名）；「获取模型列表」就是为了避免手填错 id。

### v0.39（2026-05-28）— Agent 平台（Coze）配置化

把「形象锻造」这类挂在 agent 平台（Coze）上的会话能力从 env 写死改为后台可配。
与 v0.38 的 AiModelProvider（裸大模型 /chat/completions）互补：本表是「agent 平台托管的 bot」
（带知识库 / 工作流 / 工具编排），按 sceneKey 绑定到具体业务功能。

```
server : 新实体 AgentBotProvider（agent_bot_providers 表，sceneKey 唯一）+ AgentPlatform 枚举（COZE/DIFY/CUSTOM）
       : 新 repo AgentBotProviderRepository（findBySceneKeyAndEnabledTrue / findBySceneKey）
       : 新 dto AgentBotProviderDto（token 脱敏）/ AgentBotProviderUpsertDto（token 明文进，加密落库）/ AgentSceneDto
       : 新 service AgentScenes（场景目录单一真源：appearance-forge）+ AgentBotProviderAdminService（CRUD + listScenes）
       : 新 controller AdminAgentBotController → /api/admin/agent-bots（CRUD + /scenes）
       : ForgeCozeService 改造：按 sceneKey=appearance-forge 从 DB 解析 bot（token/botId/apiBase/userIdPrefix），
         env 兜底（envEnabled/envToken/...）保持老部署不破；client 按 (apiBase, token) 缓存
admin  : 新 api/agent-bots.ts（list/get/create/update/remove/listScenes）+ api/index 注册 AgentBotsApi
       : 新页 /platform/agent-bots（CRUD + 平台/场景下拉 + token 加密输入 + 高级项）；nav「平台与配置」加「Agent 平台」
       : Bot ID 列 / 表单渲染「在 Coze 打开 bot 配置页」深链（{console}/space/{spaceId}/bot/{botId}，
         console 由 apiBase 推断 coze.cn/coze.com）；AgentBotProvider +可选 spaceId（仅拼链，不参与调用）
       : 表单加「粘贴 Coze bot 链接」快速填充（parseCozeBotUrl 拆 apiBase/spaceId/botId 回填，纯前端）
web-music : 形象锻造前端 USE_MOCK 开关本就齐全（mock 本地回放 / live 走 /appearance-forge/coze/stream），本期未改
openapi: +/admin/agent-bots（GET/POST）+/scenes（GET）+/{id}（GET/PUT/DELETE）骨架
```

**注意事项**：

- **一个 sceneKey 唯一对应一个 bot**（DB unique + service 双校验）；要换 bot 是「编辑」而非新增第二行。
- **env 兜底**：未在后台为某 scene 配置 bot 时，回退到原 `aep.coze.*` env（老部署 / 现网不破）。两者都没有 → `/coze/status` 报未配置、stream 抛 503。
- **mock/live 切换在前端**（`NEXT_PUBLIC_USE_MOCK`）：mock 不碰后端;live 才用后台 bot。所以本地开发不配 Coze 也能跑形象锻造。
- **本期只接 Coze**；DIFY/CUSTOM 是枚举占位，invoke 路径未实现（admin 可建档但不生效）。
- 新增一个 agent 功能 = AgentScenes 加 scene + 写薄 handler（鉴权 + 拼 prompt，按 sceneKey 取配置）+ admin 配一行 bot。流式/解析核心（ForgeCozeService 的 Coze 事件解析）待第二个场景出现时再抽公共件（现在抽属于过早）。

### v0.40（2026-05-29）— 素材运营「文本三件」接真 LLM + prompt_template 表配置化

把素材运营之前是「前端表演 / 后端 stub」的三处文本 AI 接到现成的 `AiModelInvocationService.invokeChat`
网关（不引 agent / 编排框架）：脚本 AI 起稿、商品卖点提取、脚本变量抽取。prompt（system + user 模板）
建专用 `prompt_template` 表存储，运营可在 admin 后台改 / 灰度 / 回滚。方案见
[`docs/MATERIAL_OPS_AI_TEXT_PLAN.md`](docs/MATERIAL_OPS_AI_TEXT_PLAN.md)。

```
server : AiModelPurpose +SELLING_POINTS / +VARIABLE_EXTRACT（SCRIPT_DRAFT 复用）
       : AiModelInvocationService.doChat +response_format 透传（json_object 模式）
       : 新 PromptTemplate 实体（prompt_template 表：promptKey 唯一 / systemPrompt / userTemplate /
         paramsJson / version / enabled）+ PromptTemplateRepository
       : 新 PromptService —— resolve(key) 解析顺序 DB→resource(.md)→代码兜底；1min 缓存（PUT 立即失效）；
         占位符 fill；admin CRUD + dry-run；seedIfAbsent / reseedBaselineIfUntouched
       : 新 PromptTemplateSeeder（@Order 38）—— resources/prompts/material/*.md「缺行才插」，
         SEED_VERSION 推新基线仅刷 version==1 的行（绝不 clobber 运营改过的 prompt）
       : 新 MaterialAiService —— 文本三件薄流水线：resolve+fill → invokeChat → 解析/校验/
         自修复重试 1 次 → 仍失败抛带 code 的明确错误（不静默兜底）；脚本校验 blocks 3-8、变量过滤幻觉（原值须在脚本里出现）；ensureConfigured 先判 provider/prompt 是否配置
       : ProductService.extractSellingPoints 换实现（stub → MaterialAiService，失败回退原 stub）
       : 脚本起稿计费（后端可配置）：CelebrityActionPricingService +action material.script-draft（默认 0=不计费）；
         MaterialOpsService.draftScripts 走 CreditService hold(单价×稿数)→commit/release 三段式，余额不足抛 402，
         anonymous 不计费；方法标 @Transactional(NOT_SUPPORTED) 让 hold/commit 独立落账 + LLM HTTP 不占 DB 连接
       : MaterialOpsService +draftScripts / +extractVariables；MaterialOpsController
         +POST /material/scripts/ai-draft + POST /material/scripts/{id}/variables
       : 新 AdminPromptController /api/admin/prompts（GET list / GET {key} / PUT {key} / POST {key}/dry-run）
       : 新 dto PromptTemplateDto / PromptTemplateUpsertDto / PromptParamsDto
web-celebrity:
       : api/material-ops.ts +aiDraftScripts / +extractScriptVariables（USE_MOCK → []；live 失败抛 ApiError）
       : DraftingHub AIPicker.run 接 ai-draft（失败显示后端明确报错 + 重试；不静默兜底）
       : DeriveVariablesPanel 挂载时拉 extractScriptVariables（即时正则占位；AI 非空则升级，失败显式警示保留正则）
       : CelebrityProductForm「AI 提取卖点」失败 inline 报错
admin  : api/prompts.ts + 新页 /platform/prompts（system/user 双 textarea + params + 启用开关 + 试运行）
       : nav「平台与配置」加「Prompt 管理」；ai-models 页 PURPOSES +卖点提取/变量抽取（可路由 provider）
       : /celebrity/engine-pricing 动作单价表 +行 material.script-draft（AI 脚本起稿，0=不计费）
test   : MaterialAiE2ETest（@MockBean）—— 正常 JSON / 脏输出自修复 / 无 provider → AI_NOT_CONFIGURED 503 /
         调用失败 → AI_CALL_FAILED 502 / 卖点 join / 变量过滤幻觉（8 测）
       : MaterialDraftBillingTest（独立 datasource）—— 单价×稿数扣减 / 余额不足 402 / 单价 0 不计费（3 测）
```

**注意事项**：

- **不静默兜底，配置问题可见**（按用户要求）：provider 未配 / prompt 未配 / 调用失败（含 token 无效 401/403）/
  JSON 解析失败 → 抛带 code 的明确错误（`AI_NOT_CONFIGURED` 503 / `PROMPT_NOT_CONFIGURED` 503 /
  `AI_CALL_FAILED` 502 / `AI_BAD_OUTPUT` 502），前端展示。脚本起稿 / 卖点提取阻塞式报错（不再用占位池）；
  变量抽取保留正则兜底但显式警示 AI 未生效。`USE_MOCK` 前端模式不打后端、自有本地占位，与此无关。
  上线前需在 `/platform/ai-models` 配带 `SCRIPT_DRAFT/SELLING_POINTS/VARIABLE_EXTRACT` purpose 的
  provider + 真 apiKey（模型 id 用「获取模型列表」选真实 id），否则前端直接显示 `AI_NOT_CONFIGURED`。
- **prompt 真源在 DB**：system 与 user 模板都在 `prompt_template` 表，代码只填 `{{占位符}}`。
  `.md` 默认仅作 seeder 基线 + git 留底，运行时读表不读文件。
- **JSON 模式**：provider 支持时开 `response_format=json_object`；为兼容 array 用对象包裹
  （`{"scripts":[]}` / `{"variables":[]}` / `{"selling_points":[]}`）。弱模型建议用稍强模型降低重试/兜底率。
- **多实例缓存**：PromptService 1min 内存缓存单实例 OK；多实例时 admin 改 prompt 后其他实例最多 1min 生效。
- **脚本起稿计费**：已接 `CreditService` hold→commit/release 三段式，单价走 `material.script-draft` action
  （admin → 平台与配置 → 引擎价格 → 动作单价表；默认 0 = 不计费，运营设单价即开启）。卖点/变量量小暂不计费。
- **未做**：违禁词 server lint 端点（前端纯规则已够用）、Langfuse 埋点、视频生成引擎 / RAG。

**v0.40 修订（用户反馈 6 项）**：

1. **起稿 500 / JSON 截断**：起稿默认只生成 1 稿（之前 3 稿，输出过长在 maxTokens 处被截断 → JSON 不完整 →
   解析失败 → 偶发代理超时返回 500）；`PromptParamsDto.DEFAULT_MAX_TOKENS` 2048→4096；`extractJson` 加 markdown
   围栏剥离；`buildScriptAsset` 逐候选 try/catch（坏候选跳过不 500）；解析失败日志 body 截断阈值 240→1000。
2. **只起 1 稿**：`DraftingHub` AIPicker 去掉「起稿数量」选择器，固定 1 稿，不满意可重新生成。
3. **应用按钮去重**：起稿预览只保留「应用到编辑器」一个按钮（删「应用并预览」）。
4. **脚本/字幕语义**（最终口径，用户拍板，覆盖 goods_to_video 的相反方向）：`shot`＝脚本/画面/分镜
   （这一镜拍什么、怎么拍，描述视频内容，主），`text`＝字幕/口播语音（要念出来、显示为字幕的台词，会配音）。
   material.script_draft prompt、编辑器 ShotBlock 标签、前端 mock SCRIPT_ASSETS（对齐 server seed 的画面 shot）、
   DraftingHub 占位池均按此口径；ScriptBlock +`genVoice?`（字幕生成开关，取消则该镜纯画面）；
   编辑器去掉同期声/花字旧 chip，给「脚本·画面/分镜」加画面快捷填入。
   注：rebase 到 goods_to_video 时曾短暂反向（text=脚本/口播），随后按用户截图反馈翻回本口径。
   PromptTemplateSeeder SEED_VERSION 多次 bump 刷新 version==1 基线。
5. **商品详情提卖点入口**：素材库 `VideoLibraryView` 商品 hero 加「AI 提取卖点」（运营角色可见）→ 提取 + 落库 + 即时展示。
6. **错误可见 + 日志**：新增统一错误组件 `components/common/ai-error-notice.tsx`（展示报错 + 可复制「追查号」logId）；
   `MaterialAiService` 全链路 INFO/WARN 日志（promptKey / provider / model / finish_reason / tokens / 解析结果；
   finish=length 警告截断）；错误消息均带 `promptKey`（issue 5：方便定位调的哪个 prompt）。DraftingHub /
   DeriveVariablesPanel / CelebrityProductForm / 商品 hero 统一用该组件展示。

### v0.42（2026-05-29）— 素材运营带货视频生成接真后端（异步 submit + 轮询）+ 脚本预览修复

把素材运营「派生视频」从纯前端 mock 改成真实视频大模型生成 + 服务端轮询；同时修了脚本预览关联商品错配、简化了基线生成入口。**仅 celebrity 线 + server 改动**。

**1. 脚本预览关联商品修复（bug）**

`/material/workshop/{id}` 预览页（及编辑页）之前用 `MATERIAL_PRODUCTS.find(...) ?? MATERIAL_PRODUCTS[0]` 兜底解析商品 —— 商品选择器拉的是**全量商品库**，选了非这 6 个内置 mock 商品时落到 `MATERIAL_PRODUCTS[0]`（德绒高领打底衫），显示成完全无关的商品。修复：`material-ops.ts` 新增 `resolveProductForScript` / `resolveProductById`，按 `product_id` 查全量商品库（live `/api/products/{id}` / mock SEED_PRODUCTS）→ `toMaterialProduct`；查不到也只给中性占位，绝不张冠李戴。`getScript` 落库时即用它挂 `product`；preview-client / editor-client / ProductMaterial（派生入口）都改走它。

**2. 基线生成直给（去冗余选项）**

脚本预览「生成视频」之前弹出 6 轴画面维度 + 18 项结构化参数，对一键生成无用。`VideoGenDialog` baseline 模式重写为**直接生成**（脚本+商品摘要 + 一句话可选「补充要求」+ 生成按钮）；6 轴画面维度选项移到**派生**时才出现（`DeriveVariablesPanel` 新增折叠「画面维度」区）。

**3. 派生视频接真后端 + 轮询 + 每任务独立回显**

- 派生面板进入**不再自动跑 AI**：变量先用正则占位，用户点「AI 识别变量」才调真 LLM（可反复重新识别）。
- 点「生成 N 条」= 真实提交（不再 mock 进度动画）；进入 generating 阶段轮询每个任务、出片后内嵌 `<video>` 播放；支持「重新生成」。
- 任务持久化 + 独立查询：每个任务可单独轮询回显；任务也出现在素材库（库自带 3s 轮询），关弹窗不影响。

```
server : 新实体 MaterialVideoJob（material_video_job 表）+ MaterialVideoJobRepository
       : MaterialVideoModelClient —— 视频大模型「提交 + 轮询」HTTP 客户端（单一可替换点）。
       :   provider（baseUrl/apiKey/model）取自后台「AI 模型」配置（用途 = VIDEO_GENERATION）；
       :   submit/poll 协议细节取自 aep.material.video.*；响应解析对常见字段多形态兜底
       :   （默认对齐异步任务约定，如 智谱 CogVideoX：POST /videos/generations → GET /async-result/{id}）。
       :   未配 provider/apiKey → 抛 VIDEO_NOT_CONFIGURED（503，明确提示去 AI 模型页配）。
       : MaterialVideoJobService（submit 扣费+派发 / getJob / listJobs / →MaterialVideo 形状 wire 映射）
       : MaterialVideoWorker（@Async("materialVideoExecutor") 提交后服务端轮询直到出片/超时；
       :   成功 commitHold / 失败 release）；MaterialVideoAsyncConfig 线程池
       : AiModelPurpose +VIDEO_GENERATION；CelebrityActionPricingService +action material.video-generate（默认 30/条）
       : MaterialOpsController +POST /material/videos/generate + GET /material/videos/jobs[/{id}]
       : application.yml +aep.material.video.*（submit/poll 路径、轮询间隔、最大等待、并发、默认 model）
       : 测试 MaterialVideoModelClientTest（normalizeStatus / extractVideoUrl 多形态解析，4 测）

web-celebrity:
       : types.ts MaterialVideo +video_url/thumbnail_url/error_message/external_task_id；+VideoGenJobRequest
       : api/material-ops.ts +resolveProductForScript/resolveProductById +submitVideoJobs/getVideoJob/listVideoJobs；
       :   listVideos（live）合并真实任务卡；mock 沿用 localStorage 模拟
       : lib.ts +buildVideoPrompt（脚本+商品+画面维度→中文提示词）+buildJobRequests
       : VideoGenDialog 重写（baseline 直给 / variant 派生 + 真实提交轮询 + 重新生成 + 内嵌播放）
       : DeriveVariablesPanel（去自动跑 AI → 按钮触发 + 重新识别；+折叠画面维度；单一「生成」按钮）
admin  : ai-models 页 PURPOSES + PURPOSE_LABEL +「视频生成」(VIDEO_GENERATION)
openapi: +/material/videos/generate + /material/videos/jobs[/{id}]
```

**注意事项**：

- **token 在后台配，不在 env 配 token**：到 管理后台 → 平台与配置 → AI 模型 加一个服务商，勾「视频生成」用途，填 baseUrl + 有效 API Key、默认 model 用真实模型 id。未配前端发起生成会显示「未配置」明确错误（不静默兜底，对齐 v0.40 文本三件）。
- **换厂商**：多数只改 baseUrl（provider 里）+ `aep.material.video.submit-path/poll-path-template`；wire 差异大就替换 `MaterialVideoModelClient` 这一个文件，不影响调度/积分/前端。默认值对齐 智谱 CogVideoX 异步任务约定。
- **服务端轮询占线程**：worker 提交后在该线程上轮询直到出片/超时（视频生成慢，单任务可达数分钟），并发上限 = `aep.material.video.max-concurrent`（默认 3）。多实例 / 高并发需改 @Scheduled 轮询 + ShedLock（沿用 PublishJobScheduler 待办）。
- **积分**：单价走 `material.video-generate`（admin 可配，默认 30/条）；hold→commit/release 三段式（不可变账本约束）。失败 / 超时自动退款。
- **MaterialVideoJob 即视频源**：成功任务直接作为素材库的 ready 卡（带 video_url），不再额外写 MaterialVideo 行；旧的 `/material/videos/batch` + mock localStorage 模拟保留（USE_MOCK / seed 演示）。

### v0.41（2026-05-29）— 合并「AI 模型」+「LLM 网关 Key」为「模型接入端点 + Key」+ AI 应用绑定 + 大模型用量统计

把 admin 两个割裂入口（`/platform/ai-models` 服务商 / `/platform/llm-keys` 网关 Key）合并为**一个**「AI 模型与 Key」入口（双 Tab）。模型配置从「服务商（一对多模型/用途 + priority 兜底）」改成「**固定模型接入端点** = {上游密钥 + 单模型 + 地址}，端点自带网关 Key」；每个 **AI 应用（用途）固定绑一个端点**，前端用 AI 时经绑定路由到对应模型。

**核心设计决策**（用户确认）：
- **两层，端点自带 Key**：折叠旧 `LlmApiKey` 进端点（`sk-aep-*` 的 prefix/hash/usage/ownerUserId 落到 `ai_model_providers`）。
- **一用途一端点，无兜底**：废弃 `purposes` 过滤 + `priority` + 5xx fallback。
- **统一 Key 概念**：同一 Key 既供内部 AI 应用路由（经绑定），又供外部 llm-gateway 计费（`ownerUserId` 非空才扣钱包，空=平台级仅累计）。
- **范围仅 LLM 文本类用途**（`AiModelPurpose`）；Coze / `AgentBotProvider` / 形象锻造不动。

```
server : 实体 AiModelProvider → AiModelEndpoint（@Table 仍 ai_model_providers；@Column 复用 api_key_encrypted /
       :   default_model；+key_prefix/key_hash/owner_user_id/total_tokens/total_calls/last_used_at/key_revoked_at；
       :   删 purposes/priority 字段——物理列残留无害，迁移 seeder 在弃用前 native 读一次）
       : 新 AiAppBinding（ai_app_binding 表，AiModelPurpose 作 @Id → endpoint_id）+ AiAppBindingService（list/bind/unbind）
       : AiModelInvocationService：pickProviders → resolveEndpoint(purpose)（binding→endpoint，filter enabled，无兜底）；
       :   hasProviderFor → hasEndpointFor；doChat 用 upstreamApiKeyEncrypted + endpoint.model；AiModelResponse.providerUsed → endpointUsed
       : 新 AiModelEndpointKeyService（mint/revoke/validate/reportUsage；validate/usage 未命中端点→回退旧 LlmApiKeyService）
       : AiModelProviderAdminService → AiModelEndpointAdminService（+mintKey/revokeKey；删端点前 countByEndpointId 守卫）
       : AiModelProviderInternalService → AiModelEndpointInternalService（/upstreams 的 modelPrefixes=[endpoint.model]）
       : InternalLlmApiKeyController 改注入 AiModelEndpointKeyService（URL /api/internal/llm-keys/{validate,usage} 不变）
       : 控制器 AdminAiModelProviderController → AdminAiModelEndpointController（路由仍 /api/admin/ai-models；+mint-key/revoke-key）
       : 新 AdminAiAppBindingController（/api/admin/ai-app-bindings GET + /{purpose} PUT/DELETE）；删 AdminLlmApiKeyController
       : 迁移 AiModelEndpointBindingSeeder（@Order 55）：model 回填 + 旧 purposes/priority 升序回填绑定（首个最低 priority 胜）；
       :   全新 DB 无旧列 → native 读失败静默跳过。LlmApiKey 表/Service 保留作兼容回退（下一版删）
admin  : nav.ts 两条合并为「AI 模型与 Key」一条（删 /platform/llm-keys）
       : api/ai-models.ts 重写（AiModelEndpoint 删 purposes/priority、defaultModel→model、+key/usage/ownerUserId；
       :   +mintKey/revokeKey/listBindings/bind/unbind）；删 api/llm-keys.ts + index 的 LlmKeysApi 导出
       : /platform/ai-models 重写为双 Tab：模型接入端点（CRUD + 固定模型 + 生成/撤销网关 Key + 明文一次横幅 + ownerUserId）
       :   / AI 应用绑定（7 用途各一个端点下拉）；删 /platform/llm-keys 页
openapi: +/admin/ai-models/{id}/mint-key + /revoke-key；+/admin/ai-app-bindings (get) + /{purpose} (put/delete)
       : 既有 /admin/ai-models* 路径保留；/admin/llm-keys* 本就不在 openapi（无可删）
```

**注意事项**：
- **网关零改（Option A）**：`InternalUpstreamDto` 形状不变（`modelPrefixes=[endpoint.model]`，精确模型即自身前缀，`Upstream.matches` 仍生效）。`validate` 返回 `userId` 可空（平台级），gateway `path("userId").asText()`→"" 不 NPE。
- **破坏性 + 兼容**：表名 / 物理列 / 内部 URL / admin 路由全部保留；旧 provider 行经 seeder 自动迁为端点 + 绑定；旧 `sk-aep-*` 经 validate 回退继续可验。`ddl-auto=update` 加新列（`@ColumnDefault` 兜底），不删旧列（`purposes`/`priority` 残留，下一版清理）。
- **风险 R1**：`admin-sync` 开启后 gateway 按精确 model 键控 registry；两个启用端点 model 串相同时 `findForModel` 命中不确定 —— 约定启用端点 model 唯一。
- **未做**：Option B（key 完全决定 gateway 路由，需改 ApiKeyAuthFilter/ChatProxyService）；删 `llm_api_keys` 表；端点级多 Key。

**大模型用量统计（自建 token 流水，同期合并自 goods_to_video）**：把每次 `/chat/completions` 响应里的 `usage`（prompt/completion/total tokens）落库聚合，admin 端新增「用量统计」Tab。各厂商无统一用量查询协议，但响应 usage 字段对所有 OpenAI 兼容端点通用 → 自建流水最稳，也符合本仓「账本式只追加」哲学。

```
server : 新实体 AiModelUsageRecord（ai_model_usage_record：providerId(=端点 id)/providerName/model/purpose/
       :   prompt|completion|total Tokens/success/createdAt）+ AiModelUsageRecordRepository（Object[] 聚合）
       : 新 AiModelUsageService.record(...)（@Transactional REQUIRES_NEW + try/catch，best-effort）
       :   + report(days)/reportForProvider(id,days)（days 缺省 30 封顶 365）
       : AiModelInvocationService.doChat 解析 prompt/completion tokens + 末尾 usage.record(...)（透传 purpose）
       : AdminAiModelEndpointController +GET /usage +GET /{id}/usage
admin  : api/ai-models.ts +AiModelUsageStat/Report + getUsage/getProviderUsage；/platform/ai-models +「用量统计」Tab
       :   （时间窗 1/7/30/90/365 天 + 4 汇总数 + 按端点/按模型占比表）
openapi: +/admin/ai-models/usage + /{id}/usage
```

- **只记成功调用 + best-effort**：失败在 parse 前抛出不落流水；record 独立事务写库失败只 WARN，不阻断 chat。
- **provider 维度即端点维度**：usage 的 providerId/providerName 传 endpoint.id/name（端点已取代 provider）。

### v0.43（2026-05-29）— 三子产品平台访问隔离 + 音乐形象锻造接大模型 + 短剧脚本化生成

一次性补齐三件事：(1) music/drama/celebrity 账户登录的**平台访问隔离**；(2) **音乐形象锻造**从 Coze-only
升级为**优先走平台大模型**的流式对话，drama 形象锻造对齐同一逻辑（UI 独立）；(3) **短剧生成**（脚本化：
AI 起草分场景脚本 → 生成短剧视频），复用 celebrity 的视频任务管线。配套本地 fake 大模型，全链路在无真实
key 时也能端到端跑通。

**A. 平台访问隔离（access isolation）**

```
server : AepUser +platforms 列（CSV，如 "music,drama,celebrity"；空=全部可访问，老账号不被锁）
       : PlatformSupport（纯函数：parse/effective/canAccess/toCsv）+ PlatformAccessService（注册授予策略）
       : AepUserDto / MeDto +platforms（/api/me 透出 effective 列表）
       : LicenseActivationService.activate / SmsAuthController.register 按 PlatformAccessService 授予
       : application.yml aep.platform.dev-grant-all（默认 true）：true=一处注册三端可用；false=按注册来源 platform 授予
       : DataInitializer 种子账号补 platforms = 全平台
types  : account.ts +SubProduct（music/drama/celebrity）+ ALL_SUB_PRODUCTS + SUB_PRODUCT_LABEL_ZH；AepUser +platforms
shared : AuthProvider +requiredPlatform → 计算 hasPlatformAccess；packages/landing +AuthScreen（主题化三 tab
         手机号登录/注册/体验账号）+ PlatformAccessDenied（拦截屏）
web-*  : 三端 providers 注入 requiredPlatform；workspace 布局在「已登录但未开通本子产品」时渲染 PlatformAccessDenied
       : music/drama 登录页改用共享 AuthScreen（与 celebrity 对齐；注册透传 platform）
test   : PlatformSupportTest（5 测：canAccess 对未授予平台返回 false 即隔离成立；空配置宽松放行）
```

> 隔离拦截在前端（按 /api/me.platforms 判断），后端不做逐接口平台门禁 —— 用户私有数据本就按 ownerUserId 隔离。
> JWT 不带 platform；改 platforms 后需重新登录 / 刷新 /api/me 才生效。

**B. 形象锻造接平台大模型（music + drama 共用后端）**

```
server : AiModelPurpose +APPEARANCE_FORGE；PromptService +KEY_APPEARANCE_FORGE("appearance.forge") 入 KNOWN_KEYS
       : resources/prompts/material/appearance.forge.md（系统设定 + {{input}}）
       : ForgeChatService（混合通道）：APPEARANCE_FORGE 绑定端点 → invokeChat 取整段方案后服务端切流成 SSE delta；
         否则 Coze 已配 → 回退 Coze；都没有 → 503 明确文案。artist 归属校验（在 DigitalIp 表则校验，不在则放行）
       : ForgeController +/appearance-forge/chat/status + /chat/stream（/coze/* 保留为同行为别名）；安全放行 /chat/**
web-music : api/appearance-forge 改打 /chat/*；AppearanceForge.v3 聊天框接真流式回复（实时回写气泡）；去技术化文案
web-drama : api/appearance-forge 改打 /chat/*；/forge 页从 mock 渐变批量 重写为 对话式形象顾问（影院风独立 UI），
            移除 window.prompt 预设命名（违禁原生弹窗）
```

**C. 短剧生成（脚本化，参考 celebrity 商品视频脚本方案）**

```
server : DramaScript 实体（drama_scripts 表：ownerUserId/title/genre/durationSec/status/payloadJson 软删）+ repo
       : DramaScriptService（CRUD + aiDraft 大模型 + generateEpisodes 委派 MaterialVideoJobService）
       : DramaController /api/me/drama/{scripts*,scripts/ai-draft,episodes/generate,episodes/jobs*}
       : AiModelPurpose +DRAMA_SCRIPT_DRAFT；prompts/material/drama.script_draft.md（输出 scenes JSON：
         heading/summary/shot(画面)/dialogue(台词)/duration_sec）
       : 视频生成复用 MaterialVideoModelClient/Worker/Job —— 短剧任务以 kind="drama-episode" + scriptId 区分带货视频
web-drama : api/short-drama.ts + /short-drama 页（起草→预览→保存→生成→轮询回显视频）+ 侧栏「短剧生成」入口
```

**D. 本地 fake 大模型联调链路**

```
server : DevFakeAiSeeder（@ConditionalOnProperty aep.dev-fake-llm.enabled，dev 默认开）：接入 fake 端点 +
         为 APPEARANCE_FORGE/DRAMA_SCRIPT_DRAFT/SCRIPT_DRAFT/.../VIDEO_GENERATION 绑定（已被运营绑过的不动）
       : application.yml aep.dev-fake-llm.{enabled,base-url,model}
scripts: dev-fake-llm-server.mjs（零依赖 OpenAI 兼容 /chat/completions + 视频 submit/poll；按 prompt 关键词
         返回中文方案 / 短剧 scenes JSON / 视频任务）
```

**注意事项**：

- **不静默兜底**：短剧脚本起草 未配端点 → AI_NOT_CONFIGURED 503；未配 prompt → PROMPT_NOT_CONFIGURED 503；
  调用失败 → AI_CALL_FAILED 502；输出无法解析 → AI_BAD_OUTPUT 502。形象锻造同理（FORGE_NOT_CONFIGURED 等）。
- **生产接入**：管理后台 → 平台与配置 → AI 模型与 Key，为「形象锻造对话」「短剧脚本起草」「视频生成」用途各绑一个
  真实端点（模型 id 用「获取模型列表」选真实 id）。dev 不配也能用 fake 端点跑通。
- **drama 视频任务**与 celebrity 带货视频共用 material_video_job 表，靠 kind + scriptId 区分；listJobs 按 scriptId 过滤。
- **E2E 已验证**（dev + fake LLM/video）：/api/me 返回 platforms；形象锻造 SSE 经 Next dev proxy 流式回写；
  短剧 起草(4 场景)→保存(ready)→生成→轮询至 ready 带 video_url。
- ffmpeg 在本环境缺失，但形象锻造 / 短剧脚本 / 视频任务（fake）均不依赖本地 ffmpeg；混剪渲染仍需 ffmpeg。

### v0.44（2026-05-30）— celebrity 三类成片视频聚合进一级「视频库」(/library)

celebrity 子产品「看成片视频」的入口原本散在三处、数据模型各异，用户找视频要在多个菜单间跳。本版把三类**成片**聚合进现有左侧一级入口「视频库」(`/library`)，用顶层「来源 Tab」区分，全部只读浏览。**纯前端信息架构重组，不动 server / api 调用层 / `packages/types` / openapi。** 仅 web-celebrity 改动。

| 来源 Tab | `?source=` | 数据类型 | 来源 API | body 组件 |
|---|---|---|---|---|
| 明星视频 | `project`（默认） | `CelebrityProjectVideo` | `listAllVideos`+`listProjects`+`listStars` | `CelebrityVideoLibrary`（零改动，数据加载移入壳内 `ProjectVideosTab`） |
| 脚本视频 | `material` | `MaterialVideo` | `MaterialOpsApi.listVideos` | 新 `ScriptVideosTab`（只读，渲染中 3s 轮询，卡片跳 `/material/assets`） |
| 混剪成片 | `mixcut` | `RenderOutput` | `MixcutApi.listJobs` | 新 `MixcutOutputsTab`（从 `MyVideosTab` 抽只读版） |

```
web-celebrity:
  app/(workspace)/library/page.tsx              重写为壳：<Suspense> + 来源 Tab + ?source= 软同步 +
                                                条件渲染 active body（避免首屏同打三套接口）+ ?product= 透传脚本视频
  components/celebrity-zone/ScriptVideosTab.tsx  新：只读聚合 MaterialVideo，9:16 卡片，
                                                顶部说明「派生/详情/提卖点请前往商品素材库」，卡片点击跳 /material/assets?product=
  components/mixcut-zone/MixcutOutputsTab.tsx    新：从原 MyVideosTab 抽只读版，保留「第 N 条」「已分发 ×N」徽标 + 搜索，
                                                删软删按钮 + useConfirm + deleteOutput（删除迁回混剪任务详情页）
  app/(workspace)/mixcut/library/page.tsx       瘦身：删 videos tab（TopTab/MyVideosTab/VideoCard/EligibleOutput/VideoItem），
                                                标题「我的混剪库」→「混剪素材库」+「前往视频库 →」链接；
                                                ?tab=videos 旧深链 router.replace("/library?source=mixcut")
  app/(workspace)/layout.tsx                    侧栏「制作」组「视频中心」→「视频库」、去 badge:4；面包屑同步
  components/distribution/DistributeWorkbench.tsx  右栏「视频库」超链 /mixcut/library?tab=videos → /library?source=mixcut
```

**注意事项**：

- **全只读浏览**：脚本视频 = 只读聚合（生产动作在 `/material/assets` 商品素材库，含派生/详情/AI 提卖点，**保留不动**）；混剪成片 = 只读（保留「已分发 ×N」徽标，软删 UI 下线 —— 后端 `DELETE /mixcut/outputs/{id}` 端点仍在，删除迁回 `/mixcut/jobs/{id}` 任务详情页）。
- **生产功能与原始素材保留在原菜单**：素材运营→脚本工坊 / 商品素材库 / 混剪专区→素材库（瘦身后剩三素材 tab）各归各位，零改动。
- **三类数据不融合**：状态枚举（中文 `已发布|待审核…` vs `ready|rendering…` vs success output）、操作各异，用来源 Tab 隔离 + 各自复用现有卡片，不强行融成单一网格。
- **未做**：混剪成片软删的新入口（暂下线）；脚本视频在视频库内直接派生（仍引导回商品素材库）；三来源跨 Tab 统一搜索/排序。

### v0.45（2026-05-30）— AiAvatar 形象资产管理中心（第 4 个 web 子产品 + 独立 aiavatar 后端领域）

> ⚠️ **该领域已于 v0.51 整体删除**（从未被前端消费；web-aiavatar 由全新 dap 领域承接，见 v0.51 节）。本节仅作历史记录。

新增独立子产品「AiAvatar 形象资产管理中心」：真人授权复刻 / 纯 AI 原创两种创建模式，7 步标准链路
（打样 → 草稿迭代 → 精调 → 模板美化出图 → 定稿 → 衍生 3D/视频 → 入库）+ 资产版本管理 / 素材管理 /
真人授权管理 / AI 模板中心 / 异步任务中心。**独立实现**：新 server 领域包 `com.aistareco.aep.aiavatar.*`，
所有新表统一 `aiavatar_` 前缀；账户复用 `aep_users`，积分复用 `CreditService`。新前端 app `apps/web-aiavatar`
（Next 16 / React 19 / Tailwind v4 / pnpm，port **3013**，深色琥珀主题）。详见
[`apps/web-aiavatar/README.md`](apps/web-aiavatar/README.md) + [`apps/web-aiavatar/DECISIONS.md`](apps/web-aiavatar/DECISIONS.md) +
[`docs/AIAVATAR_PROGRESS.md`](docs/AIAVATAR_PROGRESS.md)。

```
server : 8 实体（aiavatar_avatar / aiavatar_avatar_version / aiavatar_asset / aiavatar_source_material / aiavatar_license_grant /
         aiavatar_template / aiavatar_job / aiavatar_refine_edit）+ 10 枚举（8 态状态机 AiAvatarStatus / 13 能力 AiAvatarCapability …）
       : Provider 抽象层 CapabilityProvider + AiAvatarProviderRegistry（按 aep.aiavatar.app-mode + 每能力
         aep.aiavatar.providers.<cap> 选 mock/backend/selfhost，热切换）；13 能力实现：
         faceWarp=真实确定性液化(AiAvatarGeometryWarp，任务书§4硬要求不许mock)；nlu=BackendNluProvider 接
         AiModelInvocationService LLM 网关；其余 Mock（产出真 PNG/真 GLB，模拟真实进度）+ SelfHostHttpProvider 通用编排
       : AiAvatarJobRunner(@Async aiAvatarJobExecutor + 进度心跳 + 落资产/建版本快照/推状态机/积分 hold-commit-release)
       : AiAvatarJobWatchdog —— 监控线程（用户硬要求）：AiAvatarAsyncConfig 编程式调度每 aep.aiavatar.watchdog-interval-ms
         （默认 1h）巡检；RUNNING 心跳超 aep.aiavatar.job-stale-ms / FAILED 有额度 / 卡死 QUEUED → 自动续跑（重试上限）
       : AiAvatarCryptoStore（真人原始照片 AES-GCM 加密落 aiavatar-assets/secure/，UI 仅脱敏预览）
       : 6 控制器：AiAvatarController(/api/me/aiavatar/avatars，7步动作) / AiAvatarJobController(/jobs + SSE 进度流) /
         AiAvatarAssetController(上传/加密下载) / AiAvatarTemplateController / AiAvatarHealthController(/api/aiavatar/health/providers，公开可观测) /
         AiAvatarAdminController(/api/admin/aiavatar，工厂模板 CRUD + 手动 sweep)
       : AiAvatarTemplateSeeder（6 工厂模板，@Order 60）；AepSecurityConfig +/api/aiavatar/health permitAll + /api/aiavatar/** authenticated
       : application.yml +aep.aiavatar.*；测试 40 例（AiAvatarStatusTest 7 + AiAvatarProviderContractTest 22 +
         AiAvatarJobWatchdogTest 8 + AiAvatarJobIntegrationTest 3，真实 Bean+H2）
types  : packages/types/src/ai-avatar.ts（唯一契约：13 能力 / 8 态 / 全实体 / 请求体，camelCase）
web    : apps/web-aiavatar —— 10 页面（landing/login/资产总库三视图/创建/资产详情7Tab+工作流动作区/
         精调工作台/模板中心/授权管理/任务中心/能力健康）+ mock 引擎(store.ts，离线整跑) + apiFetch 双路径 +
         真实几何形变 lib(face-warp.ts，7 vitest) + ModelViewer(CSS3D 可旋转) + SourceBadge(MOCK 角标)
openapi: +33 aiavatar path 骨架（/aiavatar/health + /me/aiavatar/* + /admin/aiavatar/*）
```

**注意事项**：

- **三种运行路径均验证**：dev mock（USE_MOCK=1 离线）/ server+H2（dev profile）/ server+MySQL（mysql profile，
  docker mysql:8.0 验证 aiavatar_* 8 表自动建表 + 7 步链路 + 持久化 + 监控线程活体续跑）。
- **平台隔离**：ai-avatar 不接入 v0.43 的 `SubProduct`(music/drama/celebrity) 平台门禁（`requiredPlatform`
  仅那三者）；任何已登录账号可访问。要纳入隔离需扩 `SubProduct` 并同步后端 `PlatformSupport`（见 DECISIONS §A3）。
- **InsightFace 非商用**：InstantID(faceClone) / RetinaFace(faceDetect) 依赖的 InsightFace 仅限非商用研究；
  生产商用前必须换可商用人脸编码 / 检测或获授权（DECISIONS §C）。
- **能力切真实**：`AEP_AIAVATAR_APP_MODE=prod` 或 `AEP_AIAVATAR_PROVIDERS_<CAP>=selfhost` + `AEP_AIAVATAR_SELFHOST_BASE_URLS_<CAP>=...`；
  Mock 与 Real 走同一组契约测试，可无缝替换。
- **监控线程多实例**：内存进度 + 单实例调度；多实例需 ShedLock（沿用 PublishJobScheduler 同样待办）+ Redis 共享进度。
- **api-contract gate**：检查器（scripts/check-api-contract.mjs）已扫描 web-aiavatar；当前剩余 20 missing path
  + 1 missing method 来自 web-drama / web-celebrity 历史 drift，非 AiAvatar 引入。

### v0.46（2026-06-01）— web-drama 短剧工坊视觉与业务流整体重构（B1-B8.5）

按 Figma Make 原型「短剧工坊·桌面 + 移动端」逐项落地。**全站视觉令牌切到暖白橙红（`#fafaf9` 底 + `#f97316/#e11d48` 双点缀），业务主线从"短剧生成单页"重构为"6 阶段工作台流水线"。仅 web-drama 改动，后端契约不变。**

```
apps/web-drama:
  styles/tokens.css                    完全重写:暖白橙红 + Noto Sans SC/Quicksand,旧名(--bg-0/--fg-0/--accent-strong/--gradient-gold)作别名指向新值
  styles/app.css                       追加设计真源全部通用类(.btn/.chip/.tag/.card/.thumb/.overlay/.cost/.scroll/.skel/.fade-up/.pop-in/.slide-in-r/.phone-bezel)
  app/layout.tsx                       字体 Noto Sans SC + Quicksand,去 dark/data-theme="premium"
  app/providers.tsx                    Toaster light + 胶囊;挂 DramaConfirmHost
  app/(workspace)/layout.tsx           暗色残余清扫 + sidebar IA 重整 4 组(短剧工坊/创作素材/分发与洞察/账户) + 工作台沉浸态(isWorkshop 路径跳过通用 sidebar/topbar)
  app/(workspace)/projects/page.tsx    替换为「我的短剧」首页(项目卡格栅 + dashed 新建卡 + 6 项目按隔离 mock)
  app/(workspace)/projects/new/...     新建短剧两步流(选类型 9 卡 + 选模式仪式感双选 + 五维挖掘/模板预填)
  app/(workspace)/projects/[id]/...    短剧工作台沉浸态(StageRail + ProjectTopbar + EpisodeStrip + CastPanel + 6 阶段视图)
  app/(workspace)/short-drama/...      → redirect("/projects")(老单页能力并入 6 阶段)
  app/(workspace)/scripts/page.tsx     顶部主线引导 banner(跨项目脚本归档 vs 项目内单集剧本分工)
  app/(workspace)/cast/page.tsx        同 banner(跨项目 IP vs 项目内角色)
  app/(workspace)/dashboard/page.tsx   hero 重写 + "进入短剧工坊"主线 CTA;eyebrow 文案护栏
  app/(workspace)/scripts/[id]/page.tsx window.confirm → dramaConfirm(tone:"danger")

  components/drama-ui/                 10 个原语(Thumb/Avatar/Cost/useGen+GenSkeleton+GenError/AICollab+RewriteTagPill/ChipGroup/EngineTag/Editable/Meta/Field/DramaConfirmDialog+Host)
  components/drama-workshop/
    stages-config.ts                   6 阶段定义 + STAGE_BY_KEY + cost 预算
    project-card.tsx                   首页项目卡(9:16/16:10 渐变缩略 + 进度条)
    new-project/                       step-dot/pick-type/mode-card/guided-start/template-start/pick-mode
    workbench/                         stage-rail/episode-strip/cast-panel/project-topbar/stage-header/workshop-shell/run-all-dialog
    stages/                            topic/outline/cast/(char-card+avatar-picker+scene-picker)/script/board/(timeline-bar/layout-toggle/shot-bits/shot-cards/shot-detail/engine-limits/shot-prompt-peek)/prompt

  mocks/drama-workshop/                5 文件(types/avatar-themes/meta/projects/index):
                                       6 个项目全套样例数据(每项目独立
                                       projectInfo/topicCards/episodes/characters/script/storyboard/promptPack),
                                       严格按设计真源 data.js 一比一移植 — 切项目=切整套。
```

**核心交互保真度**(对照设计源):
- 视觉令牌、6 阶段轨、双模式(AI 引导 + 模板)、数字人沉浸大图选择器、剧集切换器、撤销重做(⌘Z/⇧⌘Z 60 步)、分镜三布局(timeline 默认 + flow + grid)、单镜精修侧栏(slide-in-r 384px)、ShotPromptPeek 弹层、成片配方@图片N → 真实头像缩略图、一键连跑两阶段弹层、平台自有 ConfirmDialog 替原生 confirm、骨架屏(.skel)、追查号失败态、移动响应式 ≤860/≤720/≤560 三档断点。

**注意事项**:
- 后端契约不动:仍走 `POST /api/me/drama/scripts*` + `/episodes/generate`(v0.43)。6 阶段富数据先以 mock 演示;持久化由 `DramaScript.scenes[]` 承接(结构化扩展见 v0.47+ 规划)。
- 文案护栏:UI 不出 "视频大模型 / 渲染 / 引擎 / Token / Prompt 包 / ⌘K / CINEMATIC" 等工程词;`engine` `avatar/seedance` 字段仅内部用,UI 一律说"数字人出镜 / 特效镜·待开通"。
- 老路由(/cast、/scripts、/forge、/wardrobe、/incubator、/distribution、/finance、/settings)未改造,通过别名让其暖白化;`/cast` `/scripts` 顶部主线 banner 明确"跨项目素材"vs"项目内角色/剧本"分工,引导回 /projects。
- 验收:`pnpm typecheck` 全绿;playwright 7 批 30+ 张截图覆盖(含移动 390px 单列);`grep 'confirm\|alert\|prompt'` 仅注释命中;主线动线 dashboard→/projects→/projects/new→/projects/<id> 一气呵成。

### v0.47（2026-06-03）— admin 秘钥批次「核销 / 总量」对齐 + 全链路账号登录注册审计日志

修两件事：(1) admin「秘钥批次」页面 `b.activatedCount` 长期 denormalized 列与真实 keys 表 drift，
出现「秘钥数量 20 / 核销总量 110」类违反不变量的展示；(2) 五条登录 / 注册 / 改密链路未落 audit_log，
排查暴力枚举 / 多端入口 / 失败原因只能靠 slf4j 日志 grep。

**A. License batch 核销 / 总量 真实派生 + 自愈**

```
server : LicenseKeyRepository +countByBatchIdAndStatus(batchId, status)
       : LicenseBatchDto +fromDerived(batch, totalCount, activatedCount) —— int 安全截断
       : LicenseService.listBatches / findBatchById 全改走 toDtoWithDerivedCounts(b)：
       :   - long derivedTotal = keyRepo.countByBatchId(b.id);
       :   - long derivedActivated = keyRepo.countByBatchIdAndStatus(b.id, ACTIVATED);
       :   - drift 时 WARN 日志 + 回写存储列 + ACTIVE↔EXHAUSTED 状态机自愈
       :     （REVOKED / EXPIRED 是人工决策，保留不动）
       : LicenseService.revokeKey +@Transactional + 反向递减：key 状态 ACTIVATED 时
       :   batch.activatedCount -1，并 EXHAUSTED→ACTIVE 状态机回拨
admin  : 前端 page.tsx 无需改 —— UI 仍读 b.activatedCount / b.totalCount，但这两个值
       :   由 server toDtoWithDerivedCounts 用 keys 表派生，stat 顶部「累计发放点数」
       :   reduce(b.initialCreditGrant * b.activatedCount) 自然修正
```

**B. 账号登录 / 注册 / 改密 全链路审计日志（含 IP / UA / 错因）**

```
shared model :
  AuditLog +username(VARCHAR 128) / +errorCode(VARCHAR 64) 两列；+4 个索引
  （createdAt / action / userId / username）；JPA ddl-auto=update 自动加列；
  老 H2 / MySQL 双兼容。

server :
  AuditService +Actions 常量表（9 个动作）+ Actions.AUTH_ALL List
    动作命名 ：admin.login / admin.operator_login / admin.change_password /
              auth.sms.request_code / auth.sms.login / auth.sms.register /
              auth.password.login / auth.dev_login / auth.license.activate
  AuditService +recordAuth(action, result, userId, username, errorCode, detail, req)
    - 从 HttpServletRequest 抽 IP（X-Forwarded-For → X-Real-IP → remoteAddr）+ UA
    - 永不抛：写库失败 ERROR 日志后吞掉，不影响业务 401/403 真错返回
  AuditService +recordAuthSuccess / +recordAuthFailure 便捷封装
  AuditService +search(actions, userId, username, ipAddress, result, errorCode, since, until, pageable)
  AuditLogRepository +search 自定义 JPQL（IN + LIKE 前缀 + 时间窗）

  AuditLogDto +username / +errorCode 字段

  AdminAuditController GET /api/admin/audit-logs：
    +actions(CSV) / +scope(=auth-all 便捷预设) / +username / +ipAddress /
    +errorCode / +since / +until 参数；老 (userId/action/result) 三维度兼容保留

  下列控制器全部注入 AuditService 并落审计：
  - AdminAuthController.login + changePassword（多失败分支 + 成功）
  - AepOperatorAuthController.operatorLogin（5 失败分支 + 1 成功）
  - SmsAuthController.requestCode / verify / register（多 try/catch 包裹 + 成功）
  - PasswordAuthController.login（4 失败分支 + 1 成功）
  - DevAuthController.devLogin（2 失败分支 + 1 成功）
  - LicenseActivationController.activate（失败 try/catch 包裹 + 成功用 AepUserDto
    取 userId/username）

admin :
  types/audit.ts AuditLog +username / +errorCode；+AUTH_ACTION_LABEL / +AUTH_ACTION_KEYS 字典
  api/audit.ts +listAuthLogs(params) —— scope=auth-all 默认 + actions/username/ipAddress 等过滤
  /platform/auth-logs/page.tsx 新页：StatCard ×4（总数/成功/失败/独立IP）+ 多维过滤栏
    （搜索/动作Select/结果Select/账号前缀/IP前缀）+ 行表（时间/动作icon/账号/IP/结果/错因/详情/设备）
    + 行点开详情 Dialog
  nav.ts「消息与日志」组追加「账号登录日志」入口
  mocks/audit.ts 补 username/errorCode 字段 + 9 条登录注册类样本
```

**C. ECS 本机直接部署脚本（不走 SSH）**

之前体系是「开发机 build → ssh 推 ECS」（`deploy.sh` = `build-release.sh` + `deploy-release.sh`），
开发机网络抖 / GitHub Actions 不可用时没有快速兜底。新增 `infra/scripts/deploy-local.sh`：
ssh 进 ECS 后一行命令完成 build + 翻新 + restart + verify，与 `deploy-release.sh` **完全一致**
的落位规则 + 备份约定，但全程本机操作。

```
新文件 : infra/scripts/deploy-local.sh（约 220 行）
  · all / 单服务 / 多服务（逗号或空格分隔）
  · 复用 build-release.sh 产物 → 复用 deploy-release.sh 的 cp/install/tar -x/systemctl restart 逻辑
  · 备份保留：.__previous__-<RELEASE_ID> 目录按 mtime 排序，默认保留 2 份（--keep-previous=N 可调）
  · 选项：--no-build / --no-restart / --no-verify / --no-fonts / --release-id=<ID>
  · systemd 单元不存在时 WARN 并跳过 restart，便于首次部署落位文件后人工建 unit
  · 完成后自动调 verify.sh LOCAL_MODE=1

改动 : infra/scripts/verify.sh +LOCAL_MODE=1 分支
  · LOCAL_MODE=1 时跳过 DEPLOY_HOST 校验、HOST_REMOTE 默认 127.0.0.1
  · 新 remote_exec() 函数：LOCAL_MODE=1 直接 bash -s，否则走 ssh
  · 远端 check 脚本（systemd 状态 / API /healthz / nginx -t / 中文字体）零改动 1:1 复用

文档 : infra/README.md +§4.1.1「ECS 本机直接部署（无 SSH，v0.47+）」+ 目录速览补 deploy-local.sh
       .claude/skills/aliyun-deploy/SKILL.md +「ECS 本机直接部署」一节
```

**注意事项**：

- **与 ssh 推送路径并存**：`deploy.sh` / `deploy-release.sh` 行为不动；GitHub Actions
  工作流不动。`deploy-local.sh` 是新增的第三条路径，不替换任何东西。
- **落位规则一致**：jar 经 `install -m 0644`；web/admin tar 解到 `${target}.__next__${RELEASE_ID}` 后 mv，
  失败可保留旧目录便于排查。sau-service Docker build 用 `--build-arg INSTALL_REAL=1` 同 deploy-release.sh。
- **首次部署 systemd 不存在时 WARN 不抛**：脚本检 `systemctl list-unit-files` 命中再 restart，
  否则只翻文件 + 提示参考 `infra/systemd/*.example` 建 unit。
- **备份策略改进**：`deploy-release.sh` 老路径只保留 `.__previous__`（一份），新落位会立刻覆盖；
  `deploy-local.sh` 改用带 RELEASE_ID 后缀的目录，默认保留 2 份，回滚时可指定具体 release。
- **verify 失败只 WARN**：文件已落位 + systemctl restart 已执行，verify 失败常为公网 path
  暂未起来 / 中文字体未就绪等次要问题，不阻断部署完成态。运维仍可手动重跑 `LOCAL_MODE=1 ./verify.sh`。
- **未做**：(a) `deploy-local.sh` 集成到 GitHub Actions（actions runner 仍是开发机模式 + ssh 推）；
  (b) 自动检测 deploy.sh 误在 ECS 本机执行并友好提示走 deploy-local.sh；
  (c) 多 ECS 节点的本机并行部署（当前是单机假设）。

**D. OSS / CDN URL 签名（防流量盗刷）**

背景：v0.46 之前 `AliyunOssCdnUploader.publicUrlFor(key)` 只是裸拼 CDN URL
（`https://cdn.aibuzz.cn/<key>`），URL 永不过期 + 无鉴权 + 落 DB 后随 DTO 出 wire。
任一泄漏（爬虫 / 浏览器缓存 / CDN 域名扫描）→ 持续被 hot-link 刷流量，
**夜单 CDN/OSS 几千 RMB 流量账单不是危言耸听**。

```
server : CdnUploader.signedUrlFor(key, ttlSeconds) 默认方法（v0.47+；回退到 publicUrlFor）
       : AliyunOssCdnUploader 构造器 +signStrategy / +defaultTtlSeconds / +cdnAuthKey 三个新字段
       :   strategy=none：明文 URL（dev / 调试）
       :   strategy=oss ：OSS SDK generatePresignedUrl（HttpMethod.GET + expires），
       :                  URL host 自动从 -internal endpoint 修正为公网 endpoint
       :   strategy=cdn ：阿里云 CDN URL 鉴权 Type A
       :                  auth_key = expires + "-" + rand + "-" + uid + "-" + md5(URI-expires-rand-uid-PrivateKey)
       :                  签名串走 SecureRandom + lowercase MD5 hex
       :   启动时 strategy=cdn 但 cdn-auth-key 空 → fail-fast；strategy=none → 启动 WARN
       : 新 CdnUrlSigner service（@Service，注入 ObjectProvider<CdnUploader> 让 dev 无 OSS bean 时不挂）
       :   maybeSign(url) / maybeSign(url, ttl) —— 自动识别 URL 前缀是否属 OSS/CDN base，
       :   是 → 抽 key 调 uploader.signedUrlFor；否 → 原样返回（local / 第三方外链 / null 透传）
       :   http ↔ https 双 scheme 前缀都支持（防配 https base 后请求换 http 跳过签名）
       :   uploader 抛错 → 不抛只 WARN，原样返回（不影响业务 wire）
       :   NOOP 单例 = 老 test / seeder 不便注入 Spring bean 时回退
       : MixcutRenderJobDto.from(job, mapper, signer) 新重载 —— outputs[*].cdnUrl + cdnThumbnailUrl
       :   出 wire 前过 signer.maybeSign(...) 加时效签名；老 from(job, mapper) 委派到带 NOOP 的入口
       : MixcutJobService 构造器 +cdnUrlSigner；listForUser / getForUser / create / rerun /
       :   updateProgressForUser 4 处 from() 调用统一带签名

config : application.yml aep.cdn.signed-url.{strategy, ttl-seconds, cdn-auth-key}
       : infra/env/server.env.example +AEP_CDN_SIGNED_URL_STRATEGY=cdn / TTL=3600 / CDN_AUTH_KEY=...

docs   : infra/oss/README.md +§3.1「URL 鉴权 / 签名」详细配置 + 验证 + 注意事项
       : .claude/skills/aliyun-deploy/SKILL.md 同步签名配置项

tests  : CdnUrlSignerTest（8 测）：noop / passthrough / 抽 key / 老 URL 已带 query / http-https
       : 互换 scheme / uploader 异常不抛 / 自定义 TTL / Type A 签名串格式 regex
```

**注意事项**：

- **当前签名范围**：v0.47 先覆盖 `MixcutRenderOutput.cdnUrl / cdnThumbnailUrl`（高带宽视频成片）。
  后续待补：`MaterialVideoJob.videoUrl`（素材运营生成视频）、`AiAvatarAsset` 资产 URL、
  ForgeResult 视频 URL —— 注入 `CdnUrlSigner` 到对应 service + DTO from() 加 signer 参数即可。
- **DB 落的是原始 CDN URL，不带签名**：`AliyunOssCdnUploader.upload(...)` 仍调
  `publicUrlFor(key)` 写库；签名只在 DTO 出 wire 一刻生成，每次请求都是一个新签名。
  这样老前端缓存的 URL 过期前可继续访问，过期后用户刷新页面自然换新 URL。
- **生产首选 strategy=cdn**：节省一半带宽费（CDN 0.24 元/GB vs OSS 外网 0.5 元/GB），
  且流量经 CDN 加速节点 + HTTPS。需先在阿里云 CDN 控制台「访问控制 → URL 鉴权 → Type A」
  生成 PrivateKey 并填到 `AEP_CDN_SIGNED_URL_CDN_AUTH_KEY`。
- **strategy=oss 的 host 修正**：OSS SDK 用构造器传入的 endpoint（可能是 `-internal` 内网）
  做签名 URL 的 host —— 我们在 `rewritePublicEndpoint` 替换为公网 endpoint，保证浏览器可访问。
- **TTL 建议 3600 ~ 14400**：太短（< 600）H5 视频播放进度过半就 403；
  太长（> 86400）URL 泄漏窗口大，hot-link 攻击仍能持续刷一天流量。
- **未做**：(a) `oss / cdn` 两种策略可热切（重启 server 即可换，但运行时不能切；
  v0.48+ 候选）；(b) Aliyun CDN 鉴权的 KEY 轮换流程（主备 KEY 切换）；
  (c) 上传路径的 STS 临时签名（让浏览器直传 OSS，本仓暂保留 server-mediated 上传，
  无浏览器 PUT，server 自身 AK 不外暴）；
  (d) 按用户的上传速率 / 配额限制 —— 与盗刷不同，是另一类安全问题，v0.48+ 候选。

**注意事项**：

- **DTO 派生为权威**：admin UI 直读 `b.activatedCount / b.totalCount`，但这两个值在
  listBatches / findBatchById 入口已被 server 用 keys 表实时派生覆盖，
  **denormalized 列保留以兼容老下游逻辑**（如 EXHAUSTED 状态机），但 DTO 永远返回派生值，
  不再依赖列值正确。
- **状态机自愈范围有限**：自愈只在 ACTIVE ↔ EXHAUSTED 之间，REVOKED / EXPIRED 是运营
  人工决策必须保留。
- **revokeKey 反向递减**：v0.46 之前缺失，导致只增不减是 drift 主源之一；本期补齐，
  配合 DTO 派生形成双保险。
- **审计日志永不抛**：try/catch 吞 persistence 异常，登录失败的 401/403 业务返回不会
  被「记日志失败」二次覆盖（与 ErrorLogService 同款防御）。
- **IP 抽取链**：X-Forwarded-For (取首段) → X-Real-IP → remoteAddr，按反代部署环境
  兼容。**生产 Nginx / 阿里云 SLB 必须开 forward-ip header**，否则只能记到 LB 内网 IP。
- **失败时 userId 可能为空**：用户名 / 手机号未命中 user 表的失败仍要落 username，
  便于排查暴力枚举（同一手机号在多 IP 高频出现 → 风控告警）。
- **AdminAuditController 新参数兼容老调用**：旧 `?userId=&action=&result=` 三参不变；
  新维度任一非空时走 search 入口。
- **/api/admin/audit-logs 安全**：沿用 `/api/admin/**` 通用门禁（hasAnyRole
  SUPER_ADMIN, OPERATOR）。OPERATOR 也能看登录日志（属于运营职责）；如需收口为仅
  SUPER_ADMIN，加 `.requestMatchers("/api/admin/audit-logs/**").hasRole("SUPER_ADMIN")`
  排在通用 matcher 之前。
- **未做**：(a) 多 IP / 高频失败的自动锁定 + 风控告警（v0.48+）；(b) 审计日志按用户
  聚合的 dashboard（如「过去 24h 登录失败 Top10 账号」）；(c) 日志归档 / 冷热分层；
  (d) `/api/admin/audit-logs` 加 openapi schema（管理后台路径不进 contract gate）。

### v0.48（2026-06-04）— 混剪「实例 / 草稿」层（模版 → 实例 → 生成任务）

用户反馈：celebrity 混剪里选模版、填素材后，想改模版就把填的内容全丢了；且没有可反复
复用的配置落点。本版在**模版**与**生成任务**之间补一层持久化的「实例 / 草稿」（`MixcutDraft`）——
一份「针对某模版配好的素材绑定 + 扰动设置」，可保存、可继续编辑、可多次生成；从实例生成的
每个任务都带 `draft_id` 指回，实现「生成任务回溯到当时配置的实例」。仅 celebrity 子产品改动。

**核心设计**：

- **实例字段 = 任务快照子集**：`MixcutDraft` 刻意与 `MixcutRenderJob` 的快照列对齐
  （slot_bindings / canvas / slots / scenes / perturbation_overrides / sticker_pool /
  profile / variants / product_id），本质是「还没提交渲染的任务配置」。生成时原样灌进
  `MixcutJobService` 标准创建链路（扣费 / 派发），不另起渲染逻辑。
- **血缘单向**：`MixcutRenderJob +draftId`；`MixcutDraftService → MixcutJobService`（无环，
  job service 只注入 `MixcutDraftRepository` 做 best-effort 计数 bump）。重跑（rerun）出的
  任务也保留同一 `draftId`。
- **改模版不丢内容**：create 页「改模板（先存草稿）」按钮先 PUT 草稿再跳模板编辑；
  重开实例时按 `slot_id` reconcile —— 仍存在的 slot 恢复绑定，模板已删的 slot 收集成提示，
  `template_version` 变化给「模板已更新」横幅。
- **缺素材严格阻拦**：从实例生成复用 rerun 的 `collectMissingAssets` —— 引用的
  upload/library 素材已删 → 409 MISSING_ASSETS（`error.details.missing_assets[]`）。

```
server : 新实体 MixcutDraft（mixcut_draft 表，userId 隔离 + 快照列）+ MixcutDraftRepository
       : 新 MixcutDraftDto / MixcutDraftUpsertRequest；新 MixcutDraftService（CRUD + generate）
       : 新 MixcutDraftController → /api/mixcut/drafts（GET/POST + /{id} GET/PUT/DELETE + /{id}/generate POST）
       : MixcutRenderJob +draftId 列；MixcutRenderJobDto +draft_id；MixcutCreateJobRequest +draft_id
       : MixcutJobService 注入 MixcutDraftRepository；createInternal 落 draftId + bump generatedJobCount/lastGeneratedAt；
         +public collectMissingAssets(JsonNode)；rerun 透传原 job 的 draftId
       : MixcutJobSchemaMigration +mixcut_render_job.draft_id（老库兜底加列）
web-celebrity:
       : types.ts +MixcutDraft / +MixcutDraftUpsert；RenderJob +draft_id
       : api/mixcut.ts +listDrafts/getDraft/saveDraft/deleteDraft/generateFromDraft（USE_LOCAL 走 localStorage）
       : mocks/mixcut.ts +mockDrafts（2 条演示实例）
       : create/[id]/create-client.tsx —— ?draft_id 恢复填充态 + reconcile 提示；「保存草稿 / 更新草稿」+
         「改模板（先存草稿）」+ 未保存指示；生成时透传 draft_id（active 草稿有改动先自动存回）
       : 新页 /mixcut/drafts —— 草稿箱（继续编辑 / 直接生成 / 删除）
       : jobs/[id] 加「来自实例」徽章（深链回 create?draft_id 继续编辑）；layout 侧栏 +「草稿箱」+ 面包屑；
         mixcut 首页 +「草稿箱」入口
openapi: +/mixcut/drafts（get/post）+/mixcut/drafts/{draftId}（get/put/delete）+/mixcut/drafts/{draftId}/generate（post）
```

**注意事项**：

- **实例是 opt-in**：用户不点「保存草稿」就不产生实例，生成任务无 `draft_id`（与 v0.47 行为
  一致）。点了「保存草稿」/「改模板（先存草稿）」/ 从草稿箱生成才进入三层模型。
- **生成与实例一致**：create 页生成时若 active 草稿有未保存改动，先自动 PUT 回实例再建 job，
  保证「任务 → 实例」回溯到的就是这次生成所用的配置。
- **reconcile 是冻结快照 + 名称对齐**：实例存自己的快照，不随模版改动自动同步；重开时按
  `slot_id` 恢复兼容绑定，模板删掉的 slot 内容丢弃（提示），新增必填项显示为未填。
- **USE_LOCAL 直接生成不跑模拟器**：纯 mock 下草稿箱「直接生成」产出 queued 任务不会自动推进
  （模拟器只在 create 页 handleSubmit 里）；真后端由 worker 正常处理。
- **未做**：(a) 草稿箱的批量操作 / 归档（status 预留 archived）；(b) 实例命名编辑 UI（当前自动
  命名「{模版名} · 草稿」，可在保存载荷里带 name）；(c) 实例级权限分享；(d) admin 侧实例审计
  （实例是用户私有工作态，不进 admin）；(e) 自动草稿（每次编辑静默落库）—— 当前显式保存，避免
  污染草稿箱。

### v0.49（2026-06-04）— 统一文件存储门面 FileStorageService（上传/生成/大模型产出收口）

把全系统「上传 / 生成 / 大模型返回」的图片、视频、音频、模型等**文件存储收口到一个服务**。
背景：底层早有 `CdnUploader`（local/oss driver）+ `CdnUrlSigner`（签名）抽象，但只有 mixcut 成片 /
aiavatar / material video 走了它；**用户上传素材（MixcutAssetService）、celebrity 档案图
（AdminCelebrityUploadController）还是各自 `Files.copy` 裸写本地、各自拼 URL**，既不统一也是本地
盘无界增长源。本版加一个高层门面 `FileStorageService`，把这些「真·绕过」的写入收编进来。

```
server : 新 service/storage/FileStorageService（门面）：
       :   store(MultipartFile/byte[]) / storeExisting(Path) → StoredFile{key,url,signedUrl,localPath,bytes,mime}
       :   signedUrl(key) / delete(key) / openForRead(key)（本地有则用,否则下载到 read-cache 给 ffmpeg/python）
       :   统一 key 约定 <category>/<owner?>/<uuid>.<ext>；底层委托 CdnUploader + CdnUrlSigner（不重复造）
       : 新 config/FileStorageProperties（aep.storage.local-dir / public-url-base / signed-ttl / keep-local-copy）
       : 新 config/FileStorageWebConfig（无 CDN driver 时把 local-dir 挂 /static/files 兜底）
       : [收口] MixcutAssetService.upload —— 落本地的同时经门面推 OSS + 记 cdnKey（best-effort,失败保留本地）
       :   MixcutAsset +cdnKey 列 + schema 迁移；MixcutAssetDto +cdn_url(签名)/+cdn_key；Controller 注入 signer
       :   渲染仍读 localPath（不受影响）；素材库展示从此走 OSS/CDN（省 ECS 带宽 + 防盗刷）
       : [收口] AdminCelebrityUploadController（avatar/cover/...）—— 裸写本地 → 门面 store → OSS；
       :   返回**未签名稳定公开 URL**（会被持久化进档案字段长期复用,签名会过期）
web-celebrity : MixcutAsset +cdn_url/cdn_key；素材库视频缩略图优先 cdn_url（图片经 thumbnail_url 已自动走 CDN）
```

**注意事项**：

- **已在 CdnUploader 层的域不强迁门面**：material video / aiavatar / mixcut 成片本来就走共享
  `CdnUploader`+`CdnUrlSigner`（prod 已落 OSS），各有自己的 key 方案。把它们折进新门面属**纯
  cosmetic dedup + 会改 URL/key 方案**，无运行时验证不盲改；要做应在 dev 验证后逐个迁。
- **Forge 当前是 fake**（随机派 showreel 占位 URL,无真文件写入）；接真 AI 视频生成时直接用门面。
- **本地副本仍保留**（`keep-local-copy=true`）：渲染读 localPath、file_url 兜底需要。**磁盘真正释放**
  是后续步骤 —— 渲染输入改走 `openForRead(cdnKey)` 从 OSS 拉 + `keep-local-copy=false`（需 dev 验证
  签名 URL 在异步渲染时不过期：渲染时按 asset_id→cdnKey 现签,不存快照签名 URL）。
- **DB 真值统一存 key**（§4.7.4）：MixcutAsset.cdnKey 是真值,URL 出 wire 由 signer 派生;celebrity
  档案字段当前仍存 URL（未签名公开),要防盗刷需改存 cdnKey + 出 wire 派生（留作后续）。
- **无新 endpoint / openapi 变更**：门面是内部服务;MixcutAssetDto 仅加 wire 字段(加性,契约门不受影响)。
- **未做**：(a) material video / aiavatar / mixcut 成片折进门面（cosmetic,待 dev 验证）；
  (b) MixcutAsset preset/official 上传 + 商品外链登记的门面化（admin/seed/外链,低频）；
  (c) keep-local-copy=false 的纯 OSS-read 终态 + 渲染 openForRead 切换；(d) celebrity 档案改 key-only；
  (e) 按 owner 配额 / sha256 去重 / 图片转码 —— 门面已留扩展位,未实现。

### v0.50（2026-06-06）— web-aiavatar 落地为移动端「数字人资产平台」SPA（前端）

按上传的《数字人资产平台 — 数据模型与系统逻辑规格》+ Figma Make 移动端原型
《数字人资产平台-移动端-v4》落地 `apps/web-aiavatar`（此前 workspace / 根脚本已预留位置，
但 app 目录一直不存在）。**纯前端、mock 驱动、自包含**；不改 server / openapi / 契约门。

```
apps/web-aiavatar (Next 16.2.6 / React 19 / TypeScript / pnpm, port 3013):
  app/layout.tsx + app/page.tsx              # 渲染客户端 <App />；字体走 React19 提升的 <link>（不用 next/font）
  src/styles/globals.css                     # 设计令牌 + 真实 H5 应用外层(app-root,安全区) + V4「清爽」单色青皮肤
  src/proto/data.ts                          # ★ 类型契约真源：Avatar/Look/Derivative/License/Job/BuiltinVoice(7)/
                                             #   Account/Application + 8 态状态机 + 5 步创建链路 + 6 类衍生 + 5 张标准图集
  src/proto/api.ts                           # ★ 前端 API 契约层(唯一数据出入口)：9 命名空间 + USE_MOCK 分支 + useApi + seed
  src/proto/{icons,portrait,ui,shell,toast}  # 图标库 / 占位图 / UI 原语 / AppShell+导航+底部Tab / Toast 桥接
  src/proto/app.tsx                          # ★ 根：Tab(home/library/apps/me) + 覆盖页栈 + 创建 sheet + #hash 深链
  src/proto/screen-*.tsx                     # 18 屏（home/library/avatar/voiceapps/lictaskme/more/real/chain/aicreate/voicepick）
```

**关键决策**（详见 [`apps/web-aiavatar/DECISIONS.md`](apps/web-aiavatar/DECISIONS.md)）：

- **忠实移植、不绑共享层**：原型自带 HeyGen 风设计系统（纯白 + 单色青 `#12B3DE`），与 `@ai-star-eco/ui`
  的 shadcn 体系完全不同，故 app 自包含（依赖仅 next/react），屏幕层保留原型的
  `React.createElement` + 内联样式写法（脚本仅做 `window.X` 全局 → ES module 的机械转换）。
- **去原型化 = 真实 H5（非手机壳预览）**：移除 iPhone 外框 / 伪「9:41」状态栏 / 伪微信胶囊 / 伪 home 指示条 /
  桌面屏幕索引侧栏；`AppShell`(`.app-root`) `position:fixed` 铺满视口 + `env(safe-area-inset-*)` 真实安全区，
  桌面端居中为一列内容。系统状态栏/手势条交给系统呈现。
- **所有数据走 `src/proto/api.ts`**：9 个命名空间（Avatar/Voice/Job/License/Capture/Account/App/Scene/Template）
  对齐规格 §4，每个带 `USE_MOCK` 分支（mock 读 data.ts / live `apiFetch('/api/v1/*')` 解包响应壳）+ `useApi` hook
  + 同步 `seed`（mock 首帧无闪烁）。屏幕层不再 import `./data`；切真后端只需 `NEXT_PUBLIC_USE_MOCK=0`，屏幕零改动。
- **tsconfig 关闭 strict**：屏幕层是松类型 createElement；类型安全集中在 `src/proto/data.ts` 的 interface。
  `pnpm typecheck` / `pnpm build` 仍是门（已实测全绿，`/` 静态预渲染，dev `GET / 200` 渲染正常）。
- **与既有 server `aiavatar_*` 领域（v0.45）解耦**：那是「形象资产管理中心（桌面 / `/library` / 深色琥珀 /
  `real_clone`,`ai_original` / 4 张标准图 / 13 能力）」的另一种解释；本 app 是上传规格的「数字人资产平台
  （移动 / `real`,`ai` / 8 态中文状态机 / 5 张标准图 / 6 类衍生 / 7 款内置音色）」。首版不强行对接，
  接后端时以 `src/proto/data.ts` + `api.ts` 的 REST 面为对齐基准。

**注意**：v0.45 章节描述的 server-backed 桌面 AiAvatar 中心从未在本仓库副本落地为前端（仅 server 领域存在）；
本节是 web-aiavatar 的**首个**实际前端落地，主入口为 `/`（真实全屏 H5 移动应用），非 `/library`。

### v0.51（2026-06-06）— 数字人资产平台全栈打通（dap 领域 + Agnes 多模态 + 删除 v0.45 旧域）

web-aiavatar 从「纯前端 mock 原型」升级为完整产品：新 server 领域 `com.aistareco.aep.dap.*`
（表前缀 **`dap_`**，REST 面 **`/api/v1/**`** 精确对齐 `src/proto/api.ts` 契约），账户复用
`aep_users` + 钱包/不可变账本；大模型走 **Agnes AI**（apihub.agnes-ai.com，文本/图片/视频全免费 API）。
经用户确认，**v0.45 旧 aiavatar 领域整体删除**（77 文件 + 4 测试 + openapi 33 路径 +
`packages/types/src/ai-avatar.ts`；`V6__drop_legacy_aiavatar_tables` 幂等清表）。

```
server : com.aistareco.aep.dap.* —— 9 实体（dap_avatar / dap_avatar_version / dap_look /
       :   dap_derivative / dap_license / dap_job / dap_voice / dap_capture / dap_photo）
       : AgnesClient（chat=agnes-2.0-flash / images=agnes-image-2.1-flash，i2i 走 extra_body.image，
       :   本地文件转 dataURI、OSS 走签名 URL / videos=agnes-video-v2.0 异步 submit+poll）
       : DapJobRunner @Async("dapJobExecutor")：形象生成（chat 人设 JSON + 4 变体图）/ 真人复刻
       :   （照片或捕获帧 i2i）/ 自然语言迭代 / 几何精调（参数→英文编辑指令）/ 造型（场景库 promptEn）
       :   / 六类衍生（atlas 5 机位回填 shotKeys、expr 4、scene 2、ward 2、d3 4 角度诚实占位、
       :   video=Agnes 异步出 mp4 落库）；未配 AGNES_API_KEY 全链路降级本地占位产物 + avatar.mock 标记
       : 扣费：CreditService hold→commit/release 三段式（referenceId=jobId:rN，重试独立冻结）；
       :   月度赠送 1500 点幂等发放（LedgerEntry referenceId=userId:yyyyMM）；价格表 aep.dap.pricing.*
       : 文件一律走 FileStorageService（§4.7：DB 存 key，URL 出 wire 派生）；存储统计按 bytes 列分类汇总
       : 真人捕获：footage 上传 → ffmpeg 抽帧（best-effort）→ verify 自动登记 DapLicense + HTML 凭证下载
       : AepSecurityConfig：/api/v1/** authenticated（删 /api/aiavatar/* 两条）；principal=userId
web    : api.ts 重写：auth（token/localStorage + 401 全局事件）+ AuthApi（sms/dev-login）+ apiUpload
       :   + awaitJob 轮询 + mock 任务模拟器（USE_MOCK=1 全流程可观察推进）
       : 新 screen-login（手机验证码 / 注册（验证码+激活码）/ dev 体验账号三 tab）；app.tsx 登录门
       : 创建链路全接真：AI 四变体挑选 / 上传照片复刻（真实文件选择）/ 真人捕获（真实 getUserMedia
       :   + MediaRecorder 录制，失败引导上传）/ 5 步向导（人设→生成→迭代/精调→图集定稿→衍生）
       : 详情四 tab 真数据（图集 / 衍生生成+重生成 / 版本时间线 / 授权凭证下载）；造型档案轮询；
       :   声音克隆真麦克风 + 采样回放试听；任务中心真轮询 + 重试/取消；Portrait 支持真实图片
       : next.config +/cdn /static rewrites；data.ts Avatar +imageUrl/variantImages/shotImages/voiceName
工具   : scripts/dev-fake-agnes-server.mjs（零依赖 fake Agnes：chat 人设 JSON / 真 PNG 程序化生成 /
       :   异步视频任务内嵌微型真 mp4 —— 无外网/无 key 全链路联调）
       : scripts/dap-verify.sh + scripts/dap-e2e.py（一键：编译→起 server（H2/mysql）→ 30+ 步 API
       :   E2E（登录/创建/生成/迭代/图集/授权/声音/任务/越权负例/扣费对账，真实下载产物字节）→
       :   前端 typecheck；日志落 .dap-verify/，PROFILE=mysql / AGNES=real|fake|none / VIDEO=1 开关）
```

**注意事项**：

- **Agnes key 不入库不入 git**：`AGNES_API_KEY` 环境变量注入（dap-verify.sh 会自动从 ~/dev/Agnes.md 提取）；
  未配置时生成链路降级为占位产物（mock=true，前端 MOCK 角标），不阻断。
- **i2i 身份输入**：公网 URL（OSS/CDN 签名地址）直接给 Agnes；相对路径或 localhost/127.0.0.1
  地址（本地 fake-CDN）对 Agnes 云端不可达 → 自动转 base64 dataURI。多照片复刻取前 3 张。
  真实 Agnes 全链路在生产以 OSS 公网 URL 为正路；本地联调靠 dataURI 兜底即可跑通。
- **mysql profile 本地联调必须 `AEP_CDN_DRIVER=local`**（application-mysql.yml 默认 oss，无密钥会启动失败）；
  dap-verify.sh 已内置。`createDatabaseIfNotExist=true` 兜底建库。
- **取消语义**：cancel 置 cancelRequested，runner 在阶段检查点感知后落 failed+「已取消」+释放冻结；
  wire 状态保持 running|done|failed 三态。
- **诚实降级**：3D 模型 = 4 角度预览图（GLB 导出排期中，UI 明示）；声音克隆 = 原始采样存档/回放
  （TTS 合成上线后启用，UI 明示）；内置音色试听返回说明文案。
- **未做**：(a) Agnes 多图视频/关键帧模式；(b) 充值在线支付（UI 引导联系平台）；(c) 公开数字人
  复制到我的名录；(d) 注册自助开通（沿用平台激活码双因素）；(e) 多实例 job 恢复 watchdog（单实例假设）。

**v0.51 修订（创建链路简化 + prompt/端点后台可配 + Agnes 可观测）**：

1. **创建向导 5→3 步**：`CHAIN` 砍掉「出图定稿 / 衍生」两步（source → proof → adjust）。挑选 +
   调整后底部直接「完成创建」→ `POST /avatars/{id}/finalize {archive:true}`（templateId /
   confirmedShots 不再随向导传，server 本就 null-safe）。标准图集与六类衍生收口到资产详情
   tab（原有入口保留）。续作落位：pending/finalized/deriving → adjust。
2. **图集 tab 不再伪装 5 角度**：`MAtlas` 只有定妆主图（无 shotImages）时展示单张「定妆形象」+
   引导生成按钮；5 机位网格仅在真实 shotKeys 存在时渲染。配套 dap.image_* prompt 全部加
   「one single view / no character sheet」约束，防止模型出多视图拼图。
3. **dap prompt 全点位后台可配**：10 个 promptKey（dap.persona / dap.translate_edit /
   dap.image_{generate,clone,iterate,warp,look,atlas,deriv} / dap.video_orbit）入
   `PromptService.KNOWN_KEYS` + `resources/prompts/material/dap.*.md` 基线（seeder 缺行才插）；
   `DapJobRunner` 全部硬编 prompt 改 `prompts.resolve(key)` + `fill(vars)`；admin
   「Prompt 管理」页自动列出可改。
4. **dap 模型接入点后台可配**：`AiModelPurpose` +DAP_PERSONA/DAP_IMAGE/DAP_VIDEO；`AgnesClient`
   每类调用先 `resolveEndpoint(purpose)`（admin「AI 模型与 Key + AI 应用绑定」），用端点
   baseUrl+apiKey+model 覆盖，未绑定回退 env AGNES_API_KEY；`joinUrl` 兼容端点 baseUrl 带 /
   不带 `/v1`。
5. **Agnes 调用全量可 debug**：`[agnes] call start/ok/http-error/exception` 行带 request=
   （prompt 截 400、dataURI 只打 `data:image/png;base64 len=N`、不打 api key）+ response=
   （截 600）+ source=endpoint:xx|env + attempt；IOException 自动重试 1 次（1.2s backoff，
   对 `EOF reached while reading` 类瞬断有效）。
6. **dataURI 上行压缩**：身份图 >300KB 时缩到宽 768 JPEG q0.82（PNG alpha 铺白底）再 base64，
   显著缓解大请求体导致的 EOF/超时；压缩失败回退原图。
7. **数字人回收站（软删 + 30 天自动清理）**：`DELETE /v1/avatars/{id}` 软删（deletedAt，
   顺带 cancelRequested 该资产 queued/running 任务）→ `GET /v1/avatars/trash`（含 daysLeft/purgeAt）
   → `POST /{id}/restore` 恢复 / `DELETE /{id}/purge` 立即彻底删除（仅回收站内资产，防误触）。
   `DapTrashCleanupScheduler` 每日 03:50 物理清理超期行（`aep.dap.trash-retention-days` 默认 30）：
   删全部关联行（versions/looks/derivatives/photos/captures/licenses/jobs）+ best-effort 删存储文件；
   LedgerEntry 账本不动（审计真值）。前端：详情 header 删除入口（Confirm 二次确认）+
   「我的 → 回收站」覆盖页（恢复 / 彻底删除 / 剩余天数）；ui.tsx 新增共享 `Confirm` 原语。
   注意：账户页 creditsUsed=sumCost(dap_job)，彻底删除会连带删 job 行 → 当月「已用」统计随之减少（账本余额不受影响）。
8. **prompt 真值在 DB**（重申，与 v0.40 机制一致）：`prompt_template` 表是运行时真源
   （resolve 顺序 DB → resources/.md → 代码兜底）；`.md` 只是首启 seed 基线 + git 留底。
   admin「Prompt 管理」改的就是 DB 行（version+1，seeder 永不覆盖）。
9. **生产禁占位生成**：`aep.dap.allow-placeholder`（dev 默认 true / mysql 生产默认 false）。
   未配置生成引擎（AGNES_API_KEY / admin DAP_* 端点绑定）且不允许占位时，
   `DapJobService.submit/retry` 在扣费前直接 503 `DAP_ENGINE_NOT_CONFIGURED`——
   不建任务、不扣费、不产出灰底剪影占位图。dap-verify.sh `AGNES=none` 联调路径
   显式 export `AEP_DAP_ALLOW_PLACEHOLDER=true` 保持可用。

### v0.52（2026-06-07）— web-aiavatar 精调美颜端上化（确定性真实生效）

几何精调从「参数→英文指令→Agnes i2i 整图重绘」（不可控/漂移身份/无预览）改为**端上确定性美颜**：
浏览器内 MediaPipe Face Landmarker（478 关键点，WASM，Apache-2.0）+ WebGL 位移场液化 + 磨皮美白 +
滤镜，拖动滑杆实时生效，「应用」时全分辨率导出回传落库。方案调研见 `docs/FACE_BEAUTY_RESEARCH.md`
（阿里云 viapi 人脸美型已下架；Face++ 0.1 元/次可作备选；选定端上方案：零成本/实时/保身份）。

```
web-aiavatar : 新 src/proto/beauty/{landmarks,engine,presets}.ts + studio.tsx（精调工作台：
             :   精调 5 滑杆 / 一键美颜三档+磨皮美白 / 7 滤镜 / 按住对比 / 应用上传）
             : screen-chain step3：「精确精调」→ BeautyStudio；「自然语言迭代」更名「AI 重绘迭代」
             : api.ts +AvatarApi.imageBlob（同源取图）+applyRefine（multipart 成品回传）；mock 全程可演示
             : public/mediapipe/（~25MB 自托管 wasm+模型，离线/国内可用）+ scripts/fetch-mediapipe-assets.sh
server       : DapAvatarController +GET /api/v1/avatars/{id}/image（定妆图同源流式输出，解 CDN 跨域
             :   canvas 污染）+POST /api/v1/avatars/{id}/refine-apply（multipart file+params+note）
             : DapWorkflowService.refineApply：FileStorageService 落图 → 切定妆图 → addVersion("refine")
             : DapJobService.recordLocalDone：登记 done 作业（type=refine_local, mode=local, cost=0——
             :   端上处理无引擎成本，不扣积分，不要求 Agnes 已配置）
             : /avatars/{id}/warp（Agnes i2i）保留 legacy，前端不再调用
openapi      : +/v1/avatars/{id}/image (get) +/v1/avatars/{id}/refine-apply (post)
```

**注意事项**：

- **不是生成式**：精调结果像素级保身份、同参数可复算；§8.0 静默降级规则不涉及（无降级占位概念，
  WebGL 不可用时 UI 明示「不支持」，不产假图）。
- **关键点资产加载链**：`/mediapipe`（自托管）→ jsDelivr CDN（`NEXT_PUBLIC_MP_ASSETS_BASE` 可覆盖）；
  检测失败 → 标准构图近似锚点（UI 角标「近似调整」），流程不断。
- **取图必须走 `/avatars/{id}/image` 同源端点**，不要让画布直接 `<img src=签名CDN URL>` 再导出
  （canvas 跨域污染）。生产 CDN 无需为此配 CORS。
- **未做**：资产详情页独立精调入口（详情「调整形象」本就跳 chain adjust，已覆盖）；美颜参数
  服务端复算（beauty-service，研究文档 P1）；视频帧美颜；Agnes「AI 精修」独立按钮（迭代已覆盖语义编辑）。

**v0.52 修订（衍生生成可自定义 + 视频任务真实状态回显）**：

1. **衍生不再一键抽卡**：详情「标准图集 / 衍生资产」的生成入口先弹**生成配置 sheet**
   （`DerivConfigSheet`）：expr/scene/ward 预设条目多选（≤6，每项一张图）、video 运镜方式
   单选（环绕/推近/拉远/摇移）、d3 渲染风格单选、atlas 美化模板单选；全类型「补充描述」
   textarea（中文自动经 dap.translate_edit 翻译）+「查看将使用的提示词」透出实际 prompt。
   预设数据在 `data.ts`（DERIV_PRESETS / D3_STYLES / VIDEO_MOTIONS / DERIV_DEFAULT_PICKS）。
2. **契约**：`POST /v1/avatars/{id}/derivatives` 请求体 +`options{items[{label,prompt}]≤6,
   extraPrompt, motion}` + `templateId`（atlas）；server `DapJobRunner.runDerive` 消费
   （items 替换默认配方；extraPrompt 追加到每张图/视频；中文 prompt 自动翻译，含 CJK 检测）。
3. **视频任务云端状态回显**：`AgnesClient.VideoTask +progress(0-100，兼容 0-1 形态)`；
   awaitVideo 回调改收完整 VideoTask；runner 把云端真实态写进 job —— queued →
   「云端排队中…」/ in_progress → 「云端渲染中 · N%」（pct 18+0.65×真实进度），
   前端任务卡 / 衍生行直接显示 eta 文本。轮询日志带 progress；`operation=null` 修为
   video-status。
4. 走查：walk2 +3 断言（配置 sheet / prompt 透出 / 配置后生成）；walk3 精调断言适配
   v0.52 端上美颜改名（jsdom 无 canvas 实现 → 断言工作台挂载）。合计 82 断言全绿。

### v0.53（2026-06-07）— 秘钥按子应用拆分（批次 platforms + 追加激活）+ aiavatar 纳入平台门禁

秘钥从「全站统一」拆为「全站可用 / 指定子应用可用」：批次新增 platforms 维度（如「仅 aiavatar · 发 1000 积分」），
激活按批次授权平台；aiavatar 正式加入平台全集（PlatformSupport.ALL 3 → 4）并给 web-aiavatar 上平台门禁；
新增「已登录账号追加激活」端点 —— 老账号买新子应用秘钥不用换号。积分仍是**单一钱包**（批次只决定发放额度，
不分桶；扣费链路零改动）。

```
server : LicenseBatch +platforms（CSV，null/空 = 全站可用）；LicenseBatchDto +platforms（List 出 wire）
       : PlatformSupport +AIAVATAR；ALL = music/drama/celebrity/aiavatar
       : LicenseService.createBatch 接收 platforms（数组或 CSV，仅保留已知平台）
       : LicenseActivationService 抽 requireActivatableKey（注册/追加共用校验）；
       :   resolveGrantedPlatforms：批次 platforms 非空 → 按批次授权（优先于 dev-grant-all）；
       :   空（全站秘钥）→ 沿用注册来源策略
       : +activateForExistingUser(userId, code)：合并平台（全站秘钥→升全平台；指定→并集）+
       :   追加发放积分（wallet.licenseBalance + LedgerEntry LICENSE_GRANT，遵守 §4.2）+
       :   key 核销 + 老批次幂等补 Membership
       : 新 MeLicenseController POST /api/me/license/activate（authenticated；复用
       :   auth.license.activate 审计动作，detail 标「追加激活」，admin 日志字典零新增）
       : 新 PlatformsAiavatarMigrationSeeder(@Order 52)：platforms='music,drama,celebrity'
       :   （v0.43 时代 dev-grant-all 写的「老全集」）→ NULL（= 新全集含 aiavatar），防误锁；
       :   显式单/双平台收窄授权的行不动
types  : SubProduct +"aiavatar"；ALL_SUB_PRODUCTS/SUB_PRODUCT_LABEL_ZH 同步；
       : packages/types/license.ts LicenseBatch 补 tier/sellingChannelId/platforms（修审计 P1 drift）
api-client : AuthApi +activateAdditionalLicense(code) → POST /me/license/activate
landing: PlatformAccessDenied 内置「输入激活码开通」表单（成功后 refresh() 拦截屏自动消失）；
       :   music/drama/celebrity 三端 workspace 布局零改动自动获得该入口
admin  : types/account.ts +SubProduct/ALL_SUB_PRODUCTS/SUB_PRODUCT_LABEL_ZH + AepUser.platforms；
       : types/license.ts LicenseBatch +platforms；api/licenses.ts CreateBatchInput +platforms
       : /platform/licenses：批次表 +「适用范围」列（全站/子应用徽章）；CreateBatchDialog
       :   +子应用多选 chip + 自定义单包点数（覆盖等级默认，支持「仅 aiavatar 发 1000」类批次）
web-aiavatar : AuthApi.smsRegister 默认透传 platform=aiavatar；+me()/+activateLicense(code)
       : app.tsx 登录后拉 /api/me 校验 platforms 含 aiavatar；未开通 → MPlatformGate 拦截屏
       :   （激活码追加开通 / 退出换号）；me 拉取失败宽松放行（防网络抖动误锁）
openapi: +/me/license/activate (post)
```

**注意事项**：

- **积分模型不变**：仍是单一钱包 + 不可变账本；「按 app 区分发放」= 不同批次（绑定不同子应用）配
  不同 initialCreditGrant，不是按 app 分桶。要做分桶钱包需另立大版本（动 Wallet/LedgerEntry/CreditService）。
- **优先级**：批次 platforms 非空 > dev-grant-all > 注册来源。开发态建「仅 aiavatar」批次后，
  用它注册的账号即使 dev-grant-all=true 也只开 aiavatar —— 这是预期行为（便于本地验证门禁）。
- **历史账号迁移**：恰好等于老全集 "music,drama,celebrity" 的行被视为「全平台」语义升级为 NULL；
  该串是 v0.43~v0.52 dev-grant-all 唯一产出形态（toCsv 保 ALL 顺序），不会误伤真实收窄授权。
- **追加激活语义**：全站秘钥 → user.platforms 置 NULL（全平台）；指定子应用秘钥 → 并集；
  用户原本已是全平台（空配置）→ 保持。每把 key 仍一次性核销（ACTIVATED 后不可复用）。
- **审计**：追加激活复用 `auth.license.activate` 动作（detail 前缀「追加激活」），按 userId 可查。
- **未做**：(a) 按 app 分桶的积分账户；(c) 批次 platforms 的事后编辑（建批后不可改，防已售秘钥语义漂移）。

**v0.53 第二批（同日）— 三端对齐审计遗留全量治理**（详见 [`docs/ADMIN_ALIGNMENT_AUDIT.md`](docs/ADMIN_ALIGNMENT_AUDIT.md)，10 项发现全部处置）：

```
server : AdminAepUsersController +PATCH /{id}/platforms（SUPER_ADMIN；空/null = 全平台）
       : LicenseService +KNOWN_TIERS 白名单（trial/basic/standard/premium/annual_pro/city_agent；
       :   createBatch 入参校验，之前自由 string）—— tier 契约的唯一真源
       : 新 dap/service/DapPricingService —— dap 动作单价后台化：admin 动作单价表 dap.* 12 行
       :   （>0 覆盖）优先，aep.dap.pricing.* env 默认价 fallback；读失败回默认价不阻断业务。
       :   刻意不把 dap.* 写进 CelebrityActionPricingService 默认表（否则常量压过 env 自定义）
       : DapJobService.priceOf / DapVoiceService.clone / DapAccountService.account 三处接线
admin  : /celebrity/operators +「平台访问」列 + PlatformsDialog（chip 多选；不勾选 = 全平台）
       : api/aep-users.ts +updatePlatforms
       : /celebrity/engine-pricing 动作单价表分两组：明星带货/素材运营 5 行 + 数字人平台 dap 12 行
       :   （dap 行 0 = 走部署默认价；修改约 1min 内生效 —— action-pricing 缓存 TTL）
       : /platform/prompts KEY_LABEL 补全 16 keys（dap.*/appearance.forge/drama.script_draft 等）
       : types/selling-channel.ts +SellingChannelUpsertInput 镜像；api 入参改用（弃 Partial<SellingChannel>）
openapi: +/admin/aep-users/{id}/platforms；+/admin/license-batches*（7 paths）+ LicenseBatch/
       :   LicenseBatchStatus schema
核实   : RechargePackage 三方字段一致（admin 多 active? 为软删专属字段），无需改动
```

### v0.54（2026-06-07）— dap 大模型统一 server 端 admin 管理（删 Agnes env 兜底 + 改名 DapMultimodalClient）

数字人资产平台（dap）的多模态出口此前叫 `AgnesClient` 且保留 `AGNES_API_KEY` / `aep.dap.agnes.*`
env 作为「admin 端点未绑定时的运行时兜底」。这与「大模型统一 server 端 admin 管理」原则冲突
（配置散落 env + 品牌耦合）。本版彻底收口：运行时只读后台「AI 应用绑定」端点，无 env 兜底；
类改名 `DapMultimodalClient`；dev/联调用一个 dev-only 种子器把端点种进 admin 表，脚本不再注入 AGNES env。

```
server : AgnesClient → DapMultimodalClient（AgnesException → DapModelException，
       :   错误码 AGNES_* → DAP_MODEL_*，日志 [agnes] → [dap-ai]）；删 resolveTarget 的 env 兜底分支
       :   —— 端点缺失/key 空/model 空一律 return null（不再回退 props.getAgnes()）
       : DapProperties 删 Agnes 内部类；加 Http{timeoutSeconds} / Video{poll,maxWait} / DevSeed{enabled,
       :   baseUrl,apiKey,chat/image/videoModel}（client 改读 props.getHttp()/getVideo()）
       : 新 DapDevEndpointSeeder（@ConditionalOnProperty aep.dap.dev-seed.enabled，@Order 57）：
       :   开机 upsert dev-dap-{chat,image,video} 端点 + 绑定 DAP_PERSONA/DAP_IMAGE/DAP_VIDEO；
       :   端点用 dev 自有 id（每次刷新 baseUrl/key/model，便于 fake↔real 切换），绑定仅在缺失时新增
       :   （绝不覆盖运营已配）；生产默认 enabled=false（不跑），运行时仍只读 admin 端点
       : DapJobRunner/DapJobService/DapWorkflowService 注入改名 + 引擎标签去品牌
       :   （「Agnes Image 2.1」→「云端图像引擎」/「Agnes Video 2.0」→「云端视频引擎」）
       : application.yml aep.dap.agnes.* → aep.dap.http.* / aep.dap.video.* / aep.dap.dev-seed.*
config : infra/env/server.env.example 删 AGNES_*（改为「后台为 DAP_* 绑定端点」说明）
scripts: dev-fake-agnes-server.mjs → dev-fake-multimodal-server.mjs（去品牌，FAKE_MULTIMODAL_PORT）；
       :   dap-dev.sh / dap-verify.sh 改设 aep.dap.dev-seed.* env（fake→本地多模态；real→Agnes+真 key），
       :   不再 export AGNES_BASE_URL/AGNES_API_KEY 给 server；dap-e2e.py 不变（AGNES 仅作超时档位）
```

**注意事项**：

- **运行时零 env 依赖**：`DapMultimodalClient.isConfigured()` 只看 `hasEndpointFor(DAP_IMAGE/DAP_PERSONA)`；
  生产必须在后台「AI 模型与 Key + AI 应用绑定」为 DAP_PERSONA/DAP_IMAGE/DAP_VIDEO 三个用途各绑一个端点。
  未绑定 + `allow-placeholder=false`（mysql 默认）→ 提交直接 503 `DAP_ENGINE_NOT_CONFIGURED`（不扣费），
  符合 §8.0「生产禁静默降级」。
- **dev-seed 不是 env 兜底**：它在开机时把配置**写进 admin 表**（与运营在 UI 配端点等价），运行时路径仍统一只读
  admin 端点。仅 `aep.dap.dev-seed.enabled=true` 时跑（dev/脚本显式开），生产默认关。
- **fake↔real 切换**：dev-dap-* 端点每次开机 upsert（刷 baseUrl/key/model），同一持久库切换即时生效；
  绑定仅缺失时新增，不会抢运营已绑的用途。
- **持久库联调注意**：`AGNES=none`（测占位）需 isConfigured()=false，但持久库上若前次已绑过 DAP 端点则仍 true →
  测占位路径建议用 H2（dev profile 每次可控）或先清绑定。
- **未做**：(a) admin UI 给 dap-dev/verify 一键写端点（当前靠 dev-seed env）；(b) dev-seed 多端点共享一个
  baseUrl 时合并为单端点（现 3 端点便于 real 三类不同 model id）；(c) DapMultimodalClient 接 AiModelInvocationService
  统一网关（dap 走自有多模态协议含 image/video，与通用 chat 网关形态不同，暂保持独立出口）。

### v0.55（2026-06-07）— web-celebrity 运营内嵌管理「明星」+「混剪工厂模板」

把 v0.31 的「运营内嵌管理」模式（`operatorRole` 解锁写入口，写操作走 `/api/admin/**`，server
`hasAnyRole(SUPER_ADMIN, OPERATOR)` 兜底）从**商品库**扩展到 web-celebrity 的**明星**与**混剪工厂模板**。
角色判定统一抽到 `apps/web-celebrity/src/lib/operator-role.ts` 的 `canUseOperatorTools(role)`，
并回填到既有所有 `!!user?.operatorRole` 判断点（商品库 / 商品详情 / 素材提卖点 / 视频库删除等）。

```
server : MixcutTemplateService +deleteFactory(templateId)（factory scope 物理删除）
       : 新 AdminMixcutTemplateController → /api/admin/mixcut/templates/{templateId}
       :   PUT → upsertFactory（就地写工厂模板，全员可见）/ DELETE → deleteFactory
       :   落 /api/admin/** → AepSecurityConfig hasAnyRole(SUPER_ADMIN, OPERATOR) 自动保护（不改安全配置）
       :   明星 CRUD 复用既有 AdminCelebrityController（/api/admin/celebrity/stars[/{id}] + /uploads，无后端改动）
web-celebrity:
       : lib/operator-role.ts 新建 canUseOperatorTools（"operator" | "super_admin" → true）；全仓 gating 改走它
       : api/celebrity-zone.ts +createStar/updateStar/deleteStar/uploadCelebrityImage（URL → /admin/celebrity/*）
       : components/celebrity-zone/StarFormDialog.tsx（移植自 admin，@ai-star-eco/ui 原语 + 图片上传）
       : CelebrityMarket（运营「新增明星」+ 删除确认）/ CelebrityStarCard（封面左上「编辑/删除」覆盖按钮，
       :   阻断 Link 跳转）/ CelebrityStarDetail（header「编辑/删除」）；market & star 详情页传 onChanged 重载
       : api/mixcut.ts +saveFactoryTemplate/deleteFactoryTemplate（→ /admin/mixcut/templates）；
       :   USE_LOCAL 用 DELETED_FACTORY_TEMPLATES_KEY（localStorage 已删 id 集合）模拟「删了全员看不到」，
       :   listTemplates/getTemplate/mergeWithMockFallback 过滤之（含 REAL_BACKEND 删除后回写，防 mock fallback 复活）
       : mixcut/templates 列表页 + template-detail-client：运营写=工厂写（saveFactoryTemplate）、可删工厂模板；
       :   模板新建/编辑/删除入口统一 canManageTemplates 门控（普通用户只浏览 + 用模板创建任务）
openapi: +/admin/mixcut/templates/{templateId}（put/delete 骨架）+/admin/celebrity/uploads（post，补登既有端点）
```

**注意事项**：

- **明星无需改后端**：`/api/admin/celebrity/stars[/{id}]` + `/uploads` 早已存在且对 OPERATOR 开放（admin 后台在用）。
  web-celebrity 只是新增前端写入口 + API client；越权用户绕 UI 直接调仍被 server 403。
- **运营写 = 工厂写**：运营在 web-celebrity 管理的是「共享池」—— 编辑/删除工厂模板对全员生效（不再 fork 个人副本）。
  普通用户（STUDIO）的模板写入口关闭（`wantEdit && canManageTemplates`），仅浏览模板 + 用模板创建任务。
- **contract gate 不扫 web-celebrity**：`apps/web/scripts/check-api-contract.mjs` 仅扫 `apps/web/src/api`，
  新增的 web-celebrity admin URL 不被该 gate 校验；openapi 仍按 §9 补登路径。
- **USE_LOCAL 工厂删除是 localStorage 演示态**：清缓存/换浏览器会复现工厂模板；真后端 factory 删除才是稳态。
- **未做**：(a) 明星 photos/videos 子资源在 web-celebrity 的管理（admin 已有）；(b) 明星带货 `CelebrityTemplate`
  （非混剪）的 web-celebrity 编辑；(c) 明星授权状态机的运营改动；(d) 运营在 web-celebrity 建**个人**混剪模板。

### v0.56（2026-06-07）— 充值改为「下单 → 运营核准入账」+ aiavatar 密码登录 + celebrity 生产化整改

三块并到一节（celebrity 生产化 review + aiavatar 登录对齐）：

**A. 充值订单化（废止「点套餐直接加积分」）**

旧 MVP（`POST /me/wallet/recharge` → `RechargeService.recharge()` 直接入账）= 未付款即发积分的生产事故级漏洞。
改为：用户下单生成 `RechargeOrder`（PENDING，不入账）→ 平台运营在 admin 后台「线下收款后 approve」→
才经 `CreditService`（不可变账本，§4.2）入账（PAID）；或 reject（REJECTED）；用户可 cancel 自己的待确认单。

```
server : 新实体 RechargeOrder（recharge_order 表，PENDING/PAID/REJECTED/CANCELLED 状态机，套餐字段下单时快照）
       : RechargeOrderRepository / RechargeOrderDto（status 出 wire 小写）
       : RechargeService 重构：createOrder / listMyOrders / cancelOrder / listForAdmin / approveOrder / rejectOrder
       :   —— 删除旧 recharge() 直充；入账逻辑（main RECHARGE + 可选 GIFT bonus）移入 approveOrder
       : AccountController：POST /me/wallet/recharge 改为「下单」返回 RechargeOrderDto（不再入账）；
       :   +GET /me/wallet/recharge/orders +POST /me/wallet/recharge/orders/{id}/cancel
       : 新 AdminRechargeOrderController → /api/admin/finance/recharge-orders（GET list?status= / {id}/approve / {id}/reject）
types  : packages/types/src/wallet.ts +RechargeOrder / RechargeOrderStatus；RechargeRequest +note
api-client : account.ts rechargeWallet → createRechargeOrder（返回 RechargeOrder）+listMyRechargeOrders +cancelRechargeOrder
           : _bootstrap-mocks 加 /me/wallet/recharge（返回 pending 订单）+ /orders（[]）
admin  : types/recharge-order.ts + api/recharge-orders.ts + /finance/recharge-orders 页（待确认/全部/已到账/已驳回/已取消
       :   过滤 + 入账(useConfirm) / 驳回(requireReason)）；nav「财务」组 +「充值订单」
web-celebrity : wallet/page.tsx 重写 —— 点套餐 → 确认面板（可填付款备注）→ 提交充值申请（pending）；
       :   新增「我的充值订单」区（状态徽章 + 取消待确认单）；删「体验版直接到账」文案
miniprogram : recharge() 改下单语义（mock 返回 pending 订单，不改钱包）；recharge 页 submit/wxml 文案改「提交充值申请」
openapi: /me/wallet/recharge 改返回 RechargeOrder；+/me/wallet/recharge/orders[/{id}/cancel]；
       : +/admin/finance/recharge-orders[/{id}/approve|reject]；+RechargeOrder schema；RechargeRequest +note
```

**B. aiavatar 登录对齐（补密码登录 + 设密码）**

web-aiavatar 自包含登录（screen-login + proto/api.ts）此前只有 验证码登录 / 注册激活 / dev；后端
`POST /api/auth/password/login` + `POST /api/me/password` + `/api/me.hasPassword` 早就齐全，仅前端没接。

```
web-aiavatar : proto/api.ts AuthApi +passwordLogin（/auth/password/login）+setPassword（/api/me/password，带 Bearer）
             : screen-login 登录 tab 加「验证码 / 密码」切换；密码模式校验 + PASSWORD_NOT_SET → 切回验证码
             : screen-more 新增 MSecurity（账号与安全：读 /api/me.hasPassword，设置/修改密码）；MSettings「账户」组入口
             : app.tsx 注册 security 覆盖页 + go label
```

> 真实阿里云短信：后端 `AEP_SMS_DRIVER=aliyun` 即生效（aiavatar 调的就是同一套 `/api/auth/sms/*`，无需前端改动）。
> 保持 v0.50「自包含、不绑共享层」决策，不引 packages/landing。

**C. celebrity 假数据/固化项整改（用户视角 + 运营视角 review）**

- **仪表盘**：删硬编 GMV `¥8.42M` + mock 累计播放/转化；4 张 KPI 改为按真实资产派生（授权明星 / 在产项目 /
  已生成视频 / 待审切片）；「渠道流量」「本周热推 +32%」改诚实空态 / 去掉编造百分比。
- **数据中心**（`/data` + CelebrityDataCenter）：从纯 mock ZONE_OVERVIEW 改为按真实 stars/videos 派生
  （明星榜按真实生成视频数聚合）；播放/转化/GMV/周趋势/渠道占比无真实埋点来源 → 一律「暂无数据」诚实空态 + 顶部说明条。
- **账户页**：补「编辑资料」卡（昵称/头像/手机号/邮箱/简介，走后端 `PATCH /me`，此前只有改密码）。

**注意事项**：

- **不破坏其他消费方**：`api-client.rechargeWallet` 仅 celebrity 用（已改）；web-drama 的 recharge 走自家
  `finance.ts`（`{amount,method}` 形态，仅 USE_MOCK 生效，不打真后端）→ 不受影响；miniprogram 是 celebrity 消费方，已同步改为下单语义。
- **§4.2 账本不可变**：审批入账仍走 `CreditService.creditAccount`（main + bonus 双分录），不绕账本。
- **§8.0 不静默降级**：未付款不再发积分；审批是显式人工动作。生产支付网关（微信支付 / 对公）后续接入，
  当前为「线下收款 + 后台核准」轻量闭环（用户确认的方案）。
- **未做**：(a) 在线支付网关（wx.requestPayment / 对公自动对账）与回调端点；(b) 订单超时自动过期；
  (c) 充值发票；(d) celebrity 真实经营埋点（播放/转化/GMV 回传）—— 数据中心已留诚实空态位；
  (e) 明星档案 stats（粉丝/播放/GMV）仍是 mock 字段，未接真实来源（展示层未编造新假值，沿用既有 mock 卡片）。

---

### v0.57（2026-06-09）— 审计日志记录登录来源子应用（appCode）

admin「账号登录日志」(`/platform/auth-logs`，表 `aep_audit_logs`) 此前覆盖所有子应用的登录，但**无法
区分来自哪个子应用** —— `AuditLog` 无结构化来源列，只有 register/activate 把 `platform` 拼进自由文本
`detail`。本版加一个**结构化 `appCode` 维度** + admin 列表「来源应用」列 + 筛选。

**机制（一句话）**：每个客户端带 `X-App-Code` 请求头；server 在唯一审计入口
`AuditService.recordAuth(...)`（本就持 `HttpServletRequest`）统一读取并落库 → **零改动 auth controller**，
自动覆盖所有 登录/注册/激活/改密 事件。取值与 `PlatformSupport.ALL` 对齐 + 两个扩展：
`music` / `drama` / `celebrity` / `aiavatar` / `celebrity-mp`（微信小程序）/ `admin`（后台）。
server 端「清洗后原样存」（trim + 小写 + 截断 32），不做白名单硬校验（审计宁留未知来源也不静默丢）。

```
server : AuditLog +appCode 列（VARCHAR(32)，可空）+ idx_audit_app 索引
       : AuditService.recordAuth 读 X-App-Code（新 helper appCode(req)）→ 落库；search(...) +appCode 维度
       : AuditLogDto +appCode 字段；AuditLogRepository.search JPQL +appCode 精确匹配
       : AdminAuditController GET /admin/audit-logs +appCode query 参数
api-client : _client.ts +setAppCode() + apiFetch/apiFetchPaginated 注入 X-App-Code 头；index.ts 导出
           : AuthProvider +appCode prop（默认回退 requiredPlatform）→ music/drama/celebrity 零改动自动生效
web-aiavatar : proto/api.ts 自带 fetch 层 +APP_CODE="aiavatar"（authHeaders + 登录 authFetch 注入头）
miniprogram : utils/api.js apiFetch 头加 X-App-Code=celebrity-mp
admin  : api/_client.ts 头加 X-App-Code=admin；types/audit.ts +appCode + APP_CODE_LABEL/KEYS + appCodeLabel()
       : api/audit.ts 两入参 +appCode（query + mock 过滤）；/platform/auth-logs 页 +「来源应用」列 + 筛选下拉 + 详情字段
       : mocks/audit.ts 9 条登录样本补 appCode（老行留空 → 显示 "—"，演示老数据兼容）
```

**注意事项**：

- **覆盖范围（本次确认）**：四个 web 创作端 + 微信小程序 + admin 后台；遗留 `apps/web`（Phase 5 即将删）不投入，
  其登录该列为 NULL → 显示 "—"。
- **DB 迁移**：纯增量可空列，**无需 Flyway 文件**。本仓 schema 演进靠
  `spring.jpa.hibernate.ddl-auto=update`（application.yml，dev H2 + mysql 共用；提交的迁移仅 `V1__baseline.sql`），
  实体加字段即自动建列。已在内存库 + ddl-auto 实跑验证：app_code 自动建列、X-App-Code 落库、
  `?appCode=` 过滤精确生效、无头请求落 null。
- **与 register/activate 的 body `platform` 区分**：那是 license 授权语义（决定授予哪些平台），appCode 是
  「请求来自哪个 app」的审计归因，两者独立共存，不互相替代。
- **openapi 已补**：`specs/openapi.yaml` 增加 `/admin/audit-logs` path（含 `appCode` query）与 `AuditLog.appCode`。
  扫描暴露的其余历史缺口已在本版 Part B 一并补完（见下）。
- **未做**：(a) admin 列表「来源分布」统计卡片（仅做列 + 筛选）；(b) 历史老行回填 appCode（无来源信息可回填）。

**B. check:api-contract 改扫四个活跃子应用 + openapi 补全历史欠债**

契约守门从扫即将废弃的 `apps/web` 改为扫四个活跃子应用（`web-{music,drama,celebrity,aiavatar}` + `packages/api-client`），
方法级匹配。根 `scripts/check-api-contract.mjs` 早已是该形态（prior work），本版收尾：

```
scripts/check-api-contract.mjs : SCAN_DIRS → SCAN_TARGETS（每根可带 prefix）；web-aiavatar proto/api.ts 走 /api/v1，
                               :   补 prefix="/v1" 修 ~37 个前缀误报；normalizeUrl 兜底砍嵌套模板残留 "${…"
退役旧门 : 删 apps/web/scripts/check-api-contract.mjs + apps/web/package.json 的 check:api-contract 脚本；
        :   根 `pnpm check:api-contract` 为唯一门。文档全量改引用（AGENTS.md ×4 / specs/README / docs/INDEX /
        :   figma-migrate SKILL / BUSINESS_RULES / admin & web-celebrity README / TODO / product_spec）
openapi : 补全扫描暴露的 ~25 个真实未文档化端点（path × method 入契约止血，schema 后续细化）：
        :   drama /me/scripts*（10）+ /me/script-versions/{id}；film /film/dramas/{id}* + POST /film/dramas；
        :   celebrity /material/videos*（3）+ /celebrity/videos/{videoId} + /mixcut/outputs/{outputId}/download-url；
        :   distribution /distribution/jobs/{id}/{cancel,retry}；wallet /me/wallet/withdraw；
        :   dap /v1/avatars/{id}/versions/{version}/{fork,switch}；顺手修 1 处既有 YAML 语法（time_slots description 未引号）
```

**注意事项**：

- **门现态**：`pnpm check:api-contract` 全绿（308 call sites / 361 paths，0 missing path、0 missing method）。
- **新增 path 为极简 stub**（path+method+tags+operationId+200，无完整 request/response schema）—— 与文件内 `/fan/*` 等
  既有极简条目同风格，先把「端点存在」入契约止血；body schema 后续按域补。
- **遗留 `apps/web` 自有文档**（README / FIGMA_MIGRATION_GUIDE）仍引用已删的本地门 —— 随 apps/web Phase 5 整体删除，未单独改。
- **本仓 schema 演进靠 `ddl-auto=update`**（非每改一版写 Flyway 文件）；dev 文件库 `apps/server/data` 曾有 Flyway 历史漂移
  导致 `spring-boot:run` 失败 —— 本版 `清掉 ./data` 后重建干净（V1 baseline + ddl-auto 自动建 app_code 列 + 重 seed，实跑确认）。

---

### v0.58（2026-06-10）— admin 消息中心真实化（业务事件站内消息）+ 结算中心流水补全（账号/精确余额/秒级时间）

两个互相独立的 admin 真实性修复，合并为一版：

**A. 消息中心真实化**。此前 `aep_notifications` 只有 dev seeder 写的演示数据；admin 消息中心
`repo.findAll` 把**所有用户的个人通知**混进运营视图（运营标已读会改写用户自己的未读状态），且没有任何
真实业务事件产生站内消息。本版引入**运营收件箱**模型：

```
server : Notification +ADMIN_INBOX_USER_ID="__admin__" 常量 + audience 三列
         （audience_scope/audience_target_id/audience_target_name，可空，老行回退 scope=all）
       : NotificationPublisher（新 service）—— 业务事件 → 站内消息唯一写入口：
         notifyAdmins(...)（运营收件箱，audience 指向触发账号）/ notifyUser(...)（用户个人收件箱）。
         旁路写入：发布失败仅 WARN，不阻塞业务主链路（§8.0 观测类例外）
       : 事件接线（4 处）：
         RechargeService.createOrder  → admin「新充值订单待核准」（REVENUE，含登录名/套餐/金额）
         RechargeService.cancelOrder  → admin「充值订单已取消」
         RechargeService.approve/reject → 用户「充值已到账」/「充值订单被驳回」
         LicenseActivationService.activate → admin「新用户激活」（FAN，含登录名/工作室/初始积分）
       : AdminNotificationController 改为只读写 __admin__ 行（findByUserId 分页；
         markAsRead 对非收件箱行 403）+ 新增 POST /admin/notifications/read-all（批量落 viewedAt）
       : NotificationDto.audience 从实体落库字段读取（不再硬编码 "all"）
admin  : api/notifications.ts +markAllNotificationsRead()；消息中心页接通后端 read-all、
         删除假的「标为未读」切换（已读不可逆，已读行显示已读时间）、文案改为运营收件箱定位
```

**B. 结算中心（/finance/ledger）流水补全**。三个数据真实性问题：① 流水/钱包/交易只有 userId，
前端靠 `listUsers(0,500)` 客户端 join（>500 用户即丢失，且只显示昵称无登录名）；② 余额列用
`formatCompactNumber` 显示近似值（"433.1K"）；③ 时间只到日期。修复：

```
server : LedgerEntryDto/WalletDto +username/displayName（overload from(e, owner)；
         用户自查接口不填 → jackson non_null 下 wire 省略，零破坏）
       : CreditService.listWallets/listLedgerEntries、AdminFinanceService.listTransactions
         批量 findAllById join 账号（无 N+1）
       : TransactionDto +createdAt(Instant 秒级)/username/displayName；
         FREEZE 分录 status 跟随 CreditHold（ACTIVE → processing，终态 → completed），
         不再恒为 completed
types  : packages/types + apps/admin 两份 Wallet/LedgerEntry/Transaction 同步加可选字段
admin  : 结算中心页 —— 账号列显示 昵称+登录名+用户ID 前缀（AccountCell，老数据回退 userId）；
         余额/统计卡全部 formatCredits 精确值；全部时间 formatDateTimeCN 到秒；
         删除 listUsers 客户端 join；「导出对账单」真实现（CSV，UTF-8 BOM，原始整数 + ISO 时间）；
         删除假的「复核通过/驳回」按钮 + 无 onConfirm 的 ActionDialog（账本不可变，无复核后端；
         充值核准在「财务 · 充值订单」页）；业务交易视图改只读，「处理中」= hold 冻结中
specs  : openapi.yaml —— Wallet/LedgerEntry/Transaction schema 补字段；backfill
         /admin/wallets、/admin/ledger-entries、/admin/finance/transactions、
         /admin/finance/revenue/*、/admin/notifications{,/{id}/read,/read-all} 路径
```

**注意事项**：

- **DB 迁移**：纯增量可空列（notification audience 三列），与 v0.57 同理走 `ddl-auto=update`
  自动建列，无需 Flyway 文件。
- **admin 收件箱起点为空**：不 seed 假消息，真实事件（充值下单/取消、新用户激活）发生才入箱。
- **wire 兼容**：`viewedAt`/`username`/`displayName` 为 null 时 jackson non_null 序列化直接省略 key，
  前端按 `== null`（undefined 同样命中）判断，老消费方零影响。
- **端到端已验证**（dev H2 + dev-login）：下单 → admin 收件箱实时入箱（audience 溯源）→ 核准 →
  用户收「充值已到账」；取消 / 激活注册同样入箱；read-all 批量已读；admin 标用户个人通知 → 403。
- **未做**：(a) 更多事件源（混剪任务完成、发布失败告警等）后续按需接 NotificationPublisher；
  (b) admin 侧边栏未读红点 badge；(c) 结算中心服务端分页（仍取前 200 条窗口）。

---

### v0.59（2026-06-10）— 账号停用 / 恢复完整链路 + 消息中心未读角标 + 砍掉重复的积分包页

v0.58 全面 review 的三项落地（同日第二批）：

**A. /platform/accounts 账号停用 / 恢复真链路**。此前页面的「停用 / 恢复」按钮弹 ActionDialog
但没有 `onConfirm`（纯装饰），且前后端整条链路缺失。本版补全：

```
server : AepUserService +suspend()/reactivate()（状态机：仅 ACTIVE→SUSPENDED / SUSPENDED→ACTIVE，
         否则 409；DELETED 不可恢复）
       : AdminUserController +POST /admin/users/{id}/suspend（reason 必填，400 SUSPEND_REASON_REQUIRED）
         +POST /admin/users/{id}/reactivate（reason 选填）
       : AuditService +recordAdminAction()（运营管理操作审计通用入口：actor 从 SecurityContext、
         IP/UA/appCode 从 request，永不抛）+ Actions.ADMIN_USER_SUSPEND / ADMIN_USER_REACTIVATE
       : SmsAuthController /verify 补停用闸（此前短信登录漏查 status —— 停用账号仍可登录；
         现与密码登录一致返回 403 ACCOUNT_DISABLED）
admin  : api/users.ts +suspendUser/reactivateUser；accounts 页改 useConfirm + toast 模式
         （对齐 v0.56 充值订单页惯例），busy 态防重复点击；已注销账号显示「已注销」
         （删掉无 onClick 的「查看」死按钮）
```

**已知边界**：JWT 无状态 —— 已签发 token 在到期前（默认 7 天）仍可调 /api/me/**；
登录闸（密码 / 短信 / dev-login）即时生效。per-request 状态校验需要每请求查库，暂不做。

**B. 消息中心侧栏未读角标**。nav「消息中心」+`badgeKey: notif_unread`；`useSidebarBadges`
接 `listNotifications()` 数 `viewedAt == null`（与页面同一份 API + 同一过滤条件，遵循
badge-页面一致性原则）。

**C. 砍掉 /base/credit-packs（积分包）页**。与「财务 · 充值套餐」（真 CRUD）功能重复，
且自身「新建 / 编辑 / 归档」全是无后端死按钮。删除页面 + nav 项 + 独占的
api/settings.ts、mocks/settings.ts、types/settings.ts（git grep 确认无其他消费方）；
「基础数据」组因此整组隐藏（其余子项本就 enabled=false）。server 侧
SettingsController / AdminSettingsController 保留（遗留 apps/web 仍在调）。

**端到端已验证**（dev H2）：无原因停用 400 → 带原因停用 → dev-login 403 → 重复停用 409 →
恢复 → 登录恢复 200；审计日志两行落库（actor=admin、resource=aep_user、detail 含原因、IP）。
openapi backfill /admin/users 全组路径 + suspend/reactivate。

**未做（distribution 两页维持现状）**：分发渠道 / 发行队列的写操作（批准 / 驳回 / 断开 /
立即同步）仍是无后端假按钮，按决策暂不动，后续可能整页砍掉。

---
