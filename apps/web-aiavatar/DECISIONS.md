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
- 数据真源：`src/proto/data.ts`（`NEXT_PUBLIC_USE_MOCK=1`）。
- `next.config.mjs` 已配 `/api/*` → `:8080` rewrite，接后端时在其上补 `src/proto/api.ts`
  （apiFetch + USE_MOCK 开关，参照 REST 面规格 §4）。
- 若未来要与 v0.45 server 领域合流，需要一次契约对齐（字段命名 / 状态机 / 标准图集张数 /
  能力枚举），属独立工作项，不在本次范围。

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

## 未做 / 后续候选

- `src/proto/api.ts`（apiFetch + USE_MOCK）+ 与 server 契约对齐。
- Look / Scene 场景库、声音克隆、3D 可旋转查看器的真实后端落地。
- 平台访问隔离（v0.43 的 `SubProduct` 仅含 music/drama/celebrity；纳入 aiavatar 需扩 `PlatformSupport`）。
- 真·URL 路由 / 历史栈同步；i18n（当前中文单语，符合仓库约定）。
