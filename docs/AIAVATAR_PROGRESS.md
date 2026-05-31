# AiAvatar 形象资产管理中心 — 实施进度 & 自恢复台账

> 本文件是**断点续传**台账。任何 agent（含监控线程）重新接手时，先读本文件确认「已完成 / 进行中 / 待办」，
> 再继续推进，避免重复劳动。每完成一个里程碑就更新这里并 commit。
>
> 任务书：用户上传的《实现任务书 · AiAvatar 形象资产管理中心》。
> 设计决策与「原状→改动→理由」记录在 [`DECISIONS.md`](../DECISIONS.md)。

## 总体架构（已定）

- **后端**：复用现有 `apps/server`（Spring Boot 3.3.5 / Java 17 / port 8080）。新建独立领域包
  `com.aistareco.aep.aiavatar.*`（model/dto/repository/service/service/provider/controller/config）。
  所有新表统一 `aiavatar_` 前缀；账户 / 钱包 / License 等复用现有 `aep_*` 表（AepUser / Wallet / CreditService）。
- **前端**：新建 `apps/web-aiavatar`（Next 16 + React 19 + Tailwind v4 + pnpm，port **3013**），
  与 web-celebrity 同栈。深色 + 琥珀主色 + 等宽元数据 + `.ph` 占位图主题。
- **共享类型**：`packages/types/src/ai-avatar.ts`（唯一事实源，camelCase）。
- **Provider 抽象层**：`CapabilityProvider` 接口 + `ProviderRegistry`，每能力 Mock / Backend / SelfHost 可热切换。
  `APP_MODE`（dev/prod）+ 按能力 `aep.aiavatar.providers.<cap>` 覆盖。
- **异步任务**：`@Async("aiAvatarJobExecutor")` worker + 进度事件（内存 registry + SSE，轮询兜底）。
- **监控线程（任务书硬要求）**：`AiAvatarJobWatchdog` `@Scheduled(fixedDelay=1h)`，扫描卡死 / 异常中断的 Job，
  自动续跑（resume / retry），并回写状态。

## 状态机（8 态，严格按任务书 §3）

`draft → sampling → draft_iterating → refining → pending_finalize → finalized_2d → deriving → archived`

## 里程碑清单

| # | 里程碑 | 状态 | 备注 |
|---|---|---|---|
| M0 | 探索现有代码 / 确认模式 | ✅ | 后端 + 前端 pattern 已摸清 |
| M1 | 后端：枚举 + 实体（aiavatar_ 表） | ✅ | 10 枚举 + 8 实体 |
| M2 | 后端：Repository + DTO | ✅ | 8 仓储 + 10 DTO |
| M3 | 后端：Provider 抽象 + Mock/Backend 实现 + Registry | ✅ | 13 能力，faceWarp 真实算法 |
| M4 | 后端：Service（状态机 / Job 编排 / 模板 / 授权 / 素材加密） | ✅ | AiAvatar/Job/Template/License/Asset Service |
| M5 | 后端：监控线程 AiAvatarJobWatchdog（每小时） | ✅ | 编程式调度，可配间隔 |
| M6 | 后端：Controller + SSE + /providers 健康 + 安全 + 配置 + seeder | ✅ | 6 控制器 + SSE + 工厂模板 seeder |
| M7 | 后端：编译通过 + H2 启动 + 冒烟 | ✅ | mvn compile 绿；server 9.2s 启动；E2E 冒烟全过 |
| M8 | 共享类型 ai-avatar.ts | ✅ | 13 能力/8 态/全实体/请求体 |
| M9 | 前端：脚手架（app 配置 / 主题 / workspace 接线） | ✅ | port 3013，深色琥珀主题 |
| M10 | 前端：API 层（mock/live + MOCK 角标） | ✅ | mock 引擎 + apiFetch 双路径 |
| M11 | 前端：10 页面 + 6 模块 | ✅ | 11 路由 build 通过 |
| M12 | 前端：真实几何形变（canvas liquify，faceWarp 真实） | ✅ | face-warp.ts + 7 vitest |
| M13 | 前端：typecheck + build 通过 | ✅ | tsc 0 err；next build 11 路由 |
| M14 | 测试：JUnit（状态机/契约/监控/集成）+ Vitest（几何） | ✅ | 后端 40 + 前端 7 全绿 |
| M15 | E2E：dev mock + server(H2/MySQL) 真链路 | ✅ | H2 + MySQL + Next 代理三路全通 |
| M16 | 文档：DECISIONS/README/.env/openapi/AGENTS | ✅ | 全部同步 |

### M15 MySQL 真链路验证（docker mysql:8.0 + mysql profile，2026-05-30）

```
aiavatar_* 8 张表自动建表（Hibernate ddl-auto=update，MySQLDialect）✅
7 步全链路：create→sampling(3稿)→beautify(标准5图)→finalize→derive(3D+视频) ✅
MySQL 持久化：aiavatar_avatar=1 / aiavatar_avatar_version=4 / aiavatar_asset=10 / aiavatar_job=4(全SUCCEEDED) / aiavatar_template=6 ✅
监控线程活体续跑：SQL 注入 stale RUNNING(心跳30min前) → admin sweep → watchdog resume
  → 真实 runner 续跑 → SUCCEEDED(progress=100, attempts=2) ✅
前端(3013,USE_MOCK=0)→Next rewrites→Spring Boot→全链路 + SSR 200 + 静态资产代理 ✅
```

## ✅ 全部里程碑完成（M0–M16）。三种运行路径均验证可用：
1. **dev mock**（前端独立可离线）— USE_MOCK=1
2. **server + H2**（dev profile）— 冒烟全过
3. **server + MySQL**（mysql profile）— 7 步 + 持久化 + 监控线程续跑全过

### M7 冒烟验证结果（H2 + dev-auth，2026-05-30）

```
GET  /api/aiavatar/health/providers        → 13 能力，faceWarp=selfhost(真实液化)，其余 mock ✅
POST /api/auth/dev-login             → creator_luna 拿 JWT ✅
POST /api/me/aiavatar/avatars              → 建 avatar，status=draft ✅
POST /avatars/{id}/sampling          → 异步 txt2img×3，1s 内 succeeded；3 draft_image + version#1；status draft→sampling ✅
GET  /static/aiavatar-assets/...png        → 真实 PNG 768×1024 66KB ✅
POST /avatars/{id}/template-beautify → 标准 5 图集(front_bust/full/left/right/expression) ✅
transition sampling→refining→pending_finalize → finalize → finalized_2d + finalizedVersionId ✅
非法跃迁 finalized_2d→sampling        → 409 AIAVATAR_ILLEGAL_TRANSITION ✅
POST /avatars/{id}/derive [3d,video] → 真实 GLB(glTF2.0 932B) + 视频；has3d/hasVideo=true ✅
admin /api/admin/aiavatar/templates        → 6 工厂模板 ✅
admin /api/admin/aiavatar/watchdog/sweep   → 手动触发巡检 ✅
```

## 续传指引（监控线程 / 新 agent）

1. `git log --oneline -20` 看最近进度；本表 ✅ 行已完成。
2. 后端是否可编译：`cd apps/server && mvn -q -o compile`（或修复 mvnw）。
3. 前端是否 typecheck：`pnpm --filter @ai-star-eco/web-aiavatar typecheck`。
4. 从第一个 ⬜ / ⏳ 里程碑继续，完成即更新本表 + commit。

---

## v0.45.1（2026-05-31）— 前端按上传原型 1:1 重建

> 背景：`apps/web-aiavatar` 曾被整体删除（commit 3aba153）。本轮按用户上传的高保真 design 原型
> （`数字人资产平台.html` + `app/*.jsx` + `styles/tokens.css`）+ 任务说明书**重建前端**。后端
> `com.aistareco.aep.aiavatar.*` 领域 / `packages/types/src/ai-avatar.ts` / openapi 均**未改**。

| 里程碑 | 状态 |
|---|---|
| 脚手架（Next 16 / pnpm workspace / port 3013 / tokens.css 移植 / 内联样式基元 + 图标） | ✅ |
| 数据层（api mock↔live 双路径 + mocks/store.ts 8 态状态机 ticker + 12 张开源真人照片种子） | ✅ |
| 登录接入（@ai-star-eco/api-client：SMS / 注册 / dev-login；mock 离线可登） | ✅ |
| 10 页面 + 6 模块（总库三视图 / 创建 / 素材授权 / 打样三对比 / 草稿迭代 / 精调工作台三布局 / 模板出图 / 定稿 / 衍生 / 详情 / 模板中心 / 任务中心 / 授权管理 / 能力健康） | ✅ |
| 真实算法（MediaPipe 478 关键点 + 液化形变 face-warp.ts；canvas 美颜 beauty.ts） | ✅ |
| 可观测（/health 镜像 providers + SourceBadge + 常驻 DEV MOCK/LIVE 指示） | ✅ |
| 单元测试 vitest 25 例（warp 13 + beauty 6 + landmark 6） | ✅ |
| E2E Playwright 3 例（总库种子 + AI 原创/真人复刻 两条路径从新建到归档，离线 mock） | ✅ |
| typecheck 0 error / build 17 路由（mock & live 两种 baked） | ✅ |

**E2E 验证记录**（`NEXT_PUBLIC_USE_MOCK=1`，Chromium）：
```
资产总库展示种子真人形象                         ✅ (876ms)
AI 原创：从新建到入库归档（8 步全过 + 状态机 + 归档断言）   ✅ (19.3s)
真人复刻：从新建（上传示例照片 + 签署授权）到入库归档       ✅ (20.2s)
```

过程中修复真实 UI bug：数据源指示浮层（fixed button）遮挡底部操作条主 CTA → 改为 `pointer-events:none`
静态指示药丸（DECISIONS §F1）。
