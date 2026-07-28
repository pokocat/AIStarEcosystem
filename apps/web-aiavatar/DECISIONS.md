# web-aiavatar 架构决策记录（DECISIONS）

记录 `apps/web-aiavatar` 落地时的关键取舍，供后续 agent 续接。

---

## A. 忠实移植 Figma Make 移动端原型，自包含、不强绑共享层

**背景**：本 app 来源是上传的《数字人资产平台 — 数据模型与系统逻辑规格》+ Figma Make
导出的移动端原型《数字人资产平台-移动端-v4》（一个完整的 React `createElement` 单页，
自带一套 HeyGen 风设计系统、图标库、UI 原语、占位图与全部屏幕）。

**决策**：
1. **不接 `@ai-star-eco/ui` / `@ai-star-eco/landing` 共享 shadcn 设计系统** —— 原型的视觉语言
   （纯白纸面 + 单色青 `#12B3DE` + 手机壳 + 微信 chrome + 衬线资产身份）与共享 shadcn 体系
   完全不同，强行套用会摧毁设计。本 app 自带 `src/proto/*` 设计层，依赖只有 next/react。
2. **屏幕层保留原型的 `React.createElement` + 内联样式写法**（见 `src/proto/screen-*.tsx`）。
   把 9000+ 行原型逐行改写成 JSX 收益极低、回归风险极高；移植脚本只做「`window.X` 全局模式
   → ES module import/export」的机械转换，最大化设计还原度与可靠性。
3. **设计令牌 / 手机壳 CSS 原样移植**到 `src/styles/globals.css`（V3 令牌 + 移动壳 + V4「清爽」
   覆盖三段级联，与原型渲染顺序一致）。

**取舍**：`src/proto/*` 是松类型的（见决策 B）；它是「设计 + 交互」层，不是「类型契约」层。
类型契约集中在 `src/proto/data.ts`。

---

## B. tsconfig 关闭 strict

原型屏幕层全部是松类型 createElement 调用。对上千个调用补全严格类型收益极低，因此
`tsconfig.json` 设 `"strict": false`。`createElement` 别名（`const hXX: any = React.createElement`）
被显式标注为 `any`，使「组件 props 必填推断」不再误报。

**安全网仍在**：`src/proto/data.ts` 用完整 interface 定义全部领域实体（这是接后端时的对齐基准）；
`pnpm typecheck` 仍是提交门（仅放宽 strict，未关闭类型检查本身）。新写的非原型代码（如未来的
`src/proto/api.ts`）应尽量保持良好类型。

---

## C. 当前 mock 驱动，与既有 server aiavatar 领域解耦

仓库 `apps/server` 已有 `com.aistareco.aep.aiavatar.*`（v0.45）后端领域，且 `packages/types/ai-avatar.ts`
有一套契约。但那是面向「形象资产管理中心（桌面、深色琥珀、`/library`、`real_clone/ai_original`、
4 张标准图、13 能力）」的**另一种解释**；本 app 是按用户上传的**移动端规格**实现的「数字人资产平台」
（`real/ai`、8 态中文状态机、5 张标准图、6 类衍生、7 款内置音色、Look/Application/Account）。

**决策**：首版**不强行对接**那套 server 契约，以保证对上传规格 / HTML 的忠实还原。
- `next.config.mjs` 已配 `/api/*` → `:8080` rewrite。
- 若未来要与 v0.45 server 领域合流，需要一次契约对齐（字段命名 / 状态机 / 标准图集张数 /
  能力枚举），属独立工作项，不在本次范围。

### C2. 前端 API 契约层 `src/proto/api.ts`（v0.2，所有数据走它）

补齐前端契约：`api.ts` 是**唯一数据出入口**，屏幕层不再 import `./data`。

- **实体走异步 `*Api`**：`AvatarApi / VoiceApi / JobApi / LicenseApi / CaptureApi / AccountApi /
  AppApi / SceneApi / TemplateApi`，对齐规格 §4 全部端点。每个函数 `USE_MOCK` 分支：mock 返回
  `data.ts` 样例，live 走 `apiFetch('/api/v1/...')`（解包 `{success,data}` / 分页壳，失败抛 `ApiError`）。
- **`useApi(fn, seed.xxx())` hook**：mock 下 `seed.*` 同步给出完整样例 → 首帧无闪烁；live 下初值空、
  `useEffect` 异步填充。切后端 = 改 `NEXT_PUBLIC_USE_MOCK=0`，屏幕零改动。
- **UI 字典是配置不是数据**：状态/路径/标准图/衍生 meta/链路/能力/精调/模板/配色由 `api.ts` 同步
  再导出（`DATA.STATUS` 等）。它们不是「服务端拉取的数据」，但也只经 `api.ts` 这一个文件，screens
  不直接碰 `data.ts`。
- **纯展示文案保留在屏幕内**：首页轮播 `SLIDES`、真人录制提示 `TIPS`、AI 描述范例 `EXAMPLES`、
  会员定价目录 `PLANS/PACKS` 是营销 / 配置文案（非用户数据），留在各自屏幕，不进 api。
- `data.ts` 现在只被 `api.ts` 引用 —— 它是私有 mock「数据库」+ 领域类型真源。

---

## D. 字体走浏览器侧 Google Fonts（不依赖 next/font 构建期拉取）

`layout.tsx` 用 React 19 自动提升的 `<link rel="stylesheet">` 引 Manrope / Newsreader /
JetBrains Mono / Noto Sans SC。**不使用 `next/font/google`**，避免构建期字体拉取在受限网络下
导致 `next build` 失败。浏览器无法访问 Google Fonts 时，`globals.css` 的 `--font-*` 已带
system-ui / Georgia / monospace 回退，优雅降级。

---

## E. 导航：内存覆盖页栈，而非 Next 路由

原型用「Tab + 覆盖页栈（in-memory stack）」做导航（`src/proto/app.tsx`）。整套体验是单页沉浸式，
覆盖页（创建向导 / 详情 / 选音色…）天然是栈式，硬拆成 Next App Router 多路由会很别扭。
因此 `app/page.tsx` 只渲染一个客户端 `<App />`，由它管理 tab + stack。深链通过 `#hash`
在挂载后（`useEffect`，SSR 安全）解析，支持 `#library / #apps / #me / #voice / #licenses /
#tasks / #detail / #create-ai / #create-real`。

**待办**：若需要真·可分享 URL / 浏览器前进后退，可把 stack 同步到 `history`/`searchParams`。

---

## F. 去原型化：真实全屏 H5，而非手机壳预览（v0.3）

原型把内容套在一个居中的 iPhone 外壳里（`.m-device` + 伪「9:41」状态栏 + 伪微信胶囊 +
伪 home 指示条 + 桌面「屏幕索引」侧栏）——那是**演示预览**，不是能投产给用户用的产品。

**决策**：彻底移除手机壳与所有 chrome 装饰，做成真实 H5：
- `AppShell`(`.app-root`) `position:fixed; inset:0` 铺满视口；顶部 `padding-top:env(safe-area-inset-top)`，
  底部 Tab / Sheet 用 `env(safe-area-inset-bottom)` 适配刘海屏 / home 指示条（真机真实安全区，不再画假的）。
- 设备的真实系统状态栏 / 手势条由系统呈现；应用不再绘制假状态栏、假胶囊、假指示条。
- 导航栏去掉为微信胶囊预留的右侧 padding（`--wx-cap` 收为 12px），右上操作槽变为真实可用。
- 桌面端（≥481px）把应用居中为一列（`max-width:480px` + 细描边/投影）——这是「内容列」不是「手机模型」。
- `viewport-fit=cover` + `appleWebApp` standalone 元信息，加入主屏后接近原生 app 外观。

布局变量统一定义在 `:root`（`--navbar-h / --tabbar-h / --statusbar-h=safe-top / --home-ind=safe-bottom`），
原 `.m-screen` 上的那套已废弃。

---

## 未做 / 后续候选

- `src/proto/api.ts`（apiFetch + USE_MOCK）+ 与 server 契约对齐。
- Look / Scene 场景库、声音克隆、3D 可旋转查看器的真实后端落地。
- 平台访问隔离（v0.43 的 `SubProduct` 仅含 music/drama/celebrity；纳入 aiavatar 需扩 `PlatformSupport`）。
- 真·URL 路由 / 历史栈同步；i18n（当前中文单语，符合仓库约定）。


---

## v0.4 追加（2026-06-06）— 全栈打通后的边界决策

- **server 对齐方式**：新建 `com.aistareco.aep.dap.*`（表 `dap_*`），REST 面 `/api/v1/**` 与
  `src/proto/api.ts` 逐字段对齐（wire 含 `char` 等 TS 命名，Java 侧用 toWire Map 适配）；
  v0.45 旧 `aiavatar_*` 领域经用户确认整体删除（V6 迁移幂等清表）。
- **生成引擎**：多模态单一出口 `DapMultimodalClient`（OpenAI 兼容 chat / images / 异步 videos）。
  v0.54 起接入点统一经后台「AI 模型与 Key + AI 应用绑定」管理（purpose=DAP_PERSONA/DAP_IMAGE/
  DAP_VIDEO），运行时只读 admin 端点、**无 `AGNES_API_KEY` env 兜底**——与「大模型统一 server 端
  admin 管理」原则对齐。dev/联调用 `aep.dap.dev-seed.*`（`DapDevEndpointSeeder`）开机把端点种进
  admin 表（幂等、不覆盖运营已配）。
- **诚实降级三处**：未绑端点 → 占位产物 + `mock=true` 角标（生产 mysql profile 默认严格 503）；
  3D → 多角度预览图（GLB 排期中）；
  声音克隆 → 采样存档/回放（TTS 排期中）。UI 文案均明示，不伪装能力。
- **mock 模式仍是一等公民**：`USE_MOCK=1` 内置任务模拟器（pct 推进 / deriv 状态翻转），
  所有新流程离线可演示；live 切换零屏幕层改动的承诺保持成立。


---

## v0.104 追加（2026-07-27）— 六类资产扩展的边界决策

### G. 「数字人」降格为六类资产之一，但产品骨架不动

设计稿（claude.ai/design「数字资产平台」）唯一的根本变化是：**资产种类从一种变成六种**。
Atelier Ledger（工坊台账）骨架完全保留 —— 每个资产仍是被登记、编号、版本化的档案。

因此扩展方式是**加类型，不是重做**：

1. **共用登记语言，不共用实体**。六类各自建表（`dap_asset_ip` / `dap_scene` / `dap_product` /
   `dap_style` + 既有 `dap_avatar` / `dap_voice`），不做「万能资产表 + type 列」。理由：
   六类的字段差异很大（场景有分辨率 / 光线，产品有多角度 / 品牌授权，风格只有 prompt），
   塞进一张表会得到一堆互相为 null 的列，而它们真正共享的只是**展示层的登记语言**
   —— 那个共享点放在前端 `asset-kit.tsx` + `ASSET_TYPES` 字典里，成本更低。

2. **IP 的成员关系用外键方向而非中间表**。成员实体各自持 `ipId` 指向容器，
   删 IP 只把成员的 `ipId` 置空、不删成员。理由：一个资产同一时间只归属一个 IP
   （这是业务约束，不是技术妥协），多对多中间表会引入「同一场景属于两个 IP 时授权算谁的」
   这种没人能回答的问题。

3. **声音不单独绑 IP**。`VO-` 跟着它绑定的人物一起进 IP —— 试图直接把声音关联到 IP 会
   被后端显式拒绝（`DAP_VOICE_FOLLOWS_CHARACTER`），而不是静默无效。

### H. 授权只发给「真人肖像人物」与 IP

设计 §02 的判断被完整落地：场景 / 产品 / 风格是轻资产，只记 `source`（实拍上传 / AI 生成），
**不进 LIC 授权登记**。产品的「品牌方授权」是 `DapProduct` 上的两个字段
（`brandAuthorized` / `brandLicenseUntil`），是一条**备注**，不生成凭证。

收益是设计稿点明的那句：授权徽标因此仍然稀有，一眼可信。

代价与取舍：品牌授权没有凭证文件、没有到期自动失效检查 —— 合成时只把它作为
「请确认商用范围」的提示，不作为硬闸。硬闸只对真人肖像生效（缺生效 LIC → 403，
不建单不扣费）。若将来品牌方授权需要可追溯凭证，应升级成真正的 `DapLicense` 行而不是加字段。

### I. 资产作业复用 DapJobRunner，但执行体拆出去

场景 / 产品 / 合成的五类作业没有另起一套任务系统，而是复用既有 `dap_job` 表与
`DapJobService`（三段式扣费 / 重试 / 取消完全一致）。但**执行体**拆到 `DapAssetJobs`：
`DapJobRunner` 已经 900 行，再塞五个分支会失控。

边界：进度回写、取消判定、终态、计费统一留在 `DapJobRunner`（通过注入
`DapAssetJobs.Progress` 钩子），`DapAssetJobs` 只管产物本身。这样「任务怎么算钱、
怎么取消」仍然只有一处实现。

`DapJob` 新增 `assetId` 列承载非人物资产（SC- / PD- / CP-），人物作业仍用 `avatarId`
—— 没有把 `avatarId` 改成泛化的 `subjectId`，避免动既有查询与索引。

### J. mock 产物回填必须与 awaitJob 的解析时机对齐

首版用 `setInterval` 轮询 mock 任务、结束后再回填产物，结果是
「`awaitJob` 已 resolve、但产物还没写进去」的竞态 —— 合成完成后跳结果页会看到空的「合成中」。

改为在 `tickMockJob` 把任务翻 `done` 的**同一次调用里**同步执行回填（与既有
`derivApply` 同机制）。规则：**mock 里任何「任务完成后才有的数据」都必须在翻 done 的那一刻
写好**，不能靠另一个定时器追。
