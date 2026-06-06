# AiAvatar · 数字人资产平台（web-aiavatar）

> 移动端 H5 / 微信小程序形态的「数字人资产平台」。真人授权复刻 / 纯 AI 原创两条创建路径，
> 形象 · 声音 · 衍生物（图集 / 表情 / 场景 / 换装 / 3D / 运镜视频）一站式沉淀为可复用资产，
> 并一键接入下游子应用（音乐 / 短剧 / 带货）。
>
> 本 app 是上传的《数字人资产平台 — 数据模型与系统逻辑规格》+ Figma Make 移动端原型
> 《数字人资产平台-移动端-v4》的工程落地。

- **端口**：3013（`pnpm dev:aiavatar` / `next dev -p 3013`）
- **技术栈**：Next 16.2.6 / React 19 / TypeScript（pnpm workspace 成员）
- **形态**：真实全屏 H5 应用 —— 底部 5 Tab + 覆盖页栈的客户端 SPA；铺满视口、真实安全区
  （刘海屏 / home 指示条 `env(safe-area-inset-*)`）；桌面端居中为一列内容（非手机模型）
- **主题**：HeyGen 风「清爽」皮肤 —— 纯白纸面 `#F7F9FB` + 单色青 `#12B3DE` 点睛
- **字体**：Manrope（UI/标题）/ Newsreader（资产身份衬线）/ JetBrains Mono（登记号）/ Noto Sans SC（中文）

---

## 快速开始

```bash
# 仓库根目录
pnpm install                       # 安装依赖
pnpm dev:aiavatar                  # http://localhost:3013

# 或在本目录
pnpm dev                           # 同上
pnpm typecheck                     # tsc --noEmit
pnpm build                         # 生产构建（standalone）
```

无需启动后端：屏幕层直接消费 `src/proto/data.ts` 的样例数据（`NEXT_PUBLIC_USE_MOCK=1`）。

---

## 屏幕地图（18 屏）

底部 5 Tab：`首页 · 数字人 · ＋创建 · 应用 · 我的`（＋为中间凸起，弹路径选择 sheet）。

| 屏 | 入口 | 说明 |
|---|---|---|
| 首页 | Tab | 悬浮轮播 + 「我的数字人资产」横滑 + 空态引导 + 开始创作大卡 |
| 数字人库 | Tab | mine / public · 搜索 / 分类筛选 / 网格切换 |
| 资产详情 | 卡片 | 形象设定 def / 标准图集 / 衍生物 / 版本 / 授权 + 音色 pill |
| 造型档案 / 设计造型 | 详情 | final 造型列表 + AI 设计造型（描述 / 场景库替换） |
| 衍生查看 | 详情 | 某类衍生物多张产出（图集 / 场景 / 3D 可旋转 / 视频可播放） |
| AI 创建 | 创建 sheet | 上传照片 / 文字描述 → 四宫格挑选 → 推荐音色 → 保存 |
| 真人捕获 | 创建 sheet | 录制引导 → 倒计时录制 → 身份核验 → 选音色 → 保存 + 授权 |
| 创建链路（5 步） | 真人 / 继续 | 素材&授权 → 形象生成 → 调整（自然语言 / 几何精调）→ 出图定稿 → 衍生 |
| 选择音色 | 详情音色 pill | 内置 7 款 AI 合成音色（女 4 / 男 3）· 试听 · 设为默认 |
| 声音工作室 / 声音克隆 | 我的 | 内置音色 + 我的声音 + 克隆录制 |
| 授权登记 | 我的 | License 按状态筛 · 下载凭证 / 续签 / 签署 |
| 作业队列 | 首页铃铛 | Job 实时进度 · 重试 / 查看 |
| 我的 / 会员与算力 / 存储用量 / 设置 | Tab | 账户 · 算力 / 存储 · 入口 |
| 应用中心 | Tab | 音乐工作室 / 短剧工坊 / 短视频带货（复用已定稿 Avatar） |

---

## 目录结构

```
src/
├── app/
│   ├── layout.tsx          # html/body + 全局样式 + 字体 link（React 19 自动提升到 <head>）
│   └── page.tsx            # 渲染 <App />（客户端 SPA 入口）
├── styles/
│   └── globals.css         # 设计令牌 + 手机壳/微信 chrome + V4「清爽」皮肤（移植自原型）
└── proto/                  # 原型移植层（屏幕 + 原语 + 数据）
    ├── data.ts             # ★ 领域类型 + Mock 数据（类型契约真源）
    ├── icons.tsx           # 线性图标库
    ├── portrait.tsx        # 数字人占位图
    ├── ui.tsx              # 基础 UI 原语（Button/Badge/Card/Tabs/Modal/Toast…）
    ├── shell.tsx           # 手机壳 PhoneFrame + 微信状态栏/导航/底部 Tab + 共享部件
    ├── toast.ts            # Toast 桥接
    ├── app.tsx             # ★ 根：Tab / 覆盖页栈 / 创建入口 / 屏幕索引
    └── screen-*.tsx        # 各屏（home / library / avatar / voiceapps / lictaskme /
                            #        more / real / chain / aicreate / voicepick）
```

---

## 数据 / 后端

**所有数据都经 `src/proto/api.ts` 这一个出入口**（屏幕层不直接 import `./data`）：

- `api.ts` 是前端契约层，已按规格 §4 补齐全部 REST 端点（`AvatarApi` / `VoiceApi` /
  `JobApi` / `LicenseApi` / `CaptureApi` / `AccountApi` / `AppApi` / `SceneApi` / `TemplateApi`），
  每个函数都带 `USE_MOCK` 分支：
  - `NEXT_PUBLIC_USE_MOCK=1`（默认）→ 返回 `src/proto/data.ts` 的样例（私有 mock「数据库」）。
  - `NEXT_PUBLIC_USE_MOCK=0` → `apiFetch` 打 `/api/v1/*`（经 `next.config.mjs` rewrite 到 :8080），
    自动解包后端响应壳 `{ success, data }` / 分页 `{ data, pagination }`。
- 屏幕用 `useApi(fn, seed.xxx())` 取数据：mock 下 `seed.*` 同步给出完整样例（首帧无闪烁），
  live 下初值为空、异步填充。**从 mock 切到真后端只需改 `USE_MOCK`，屏幕层零改动。**
- UI 字典（状态/路径/标准图/衍生 meta/链路/能力/精调/模板/配色）是展示配置，由 `api.ts`
  同步再导出（`DATA.STATUS` 等），同样只经本文件。
- `src/proto/data.ts` 现在只被 `api.ts` 引用（领域类型 + mock 数据真源）。
- 仓库已有 `apps/server` 的 `com.aistareco.aep.aiavatar.*`（v0.45）后端领域，但其契约与本规格
  是两套不同解释。本前端的契约真源是 `data.ts` 的接口 + `api.ts` 的 REST 面；接后端时以此对齐。
  详见 [`DECISIONS.md`](DECISIONS.md)。

---

## 版本日志

### v0.3（2026-06-06）— 去原型化：真实可投产的全屏 H5 应用

- **移除手机壳 / 微信 chrome 装饰**：删掉 iPhone 外框（`.m-device`/`.m-island`）、伪状态栏
  （「9:41」+ 信号/wifi/电量）、伪微信胶囊、伪 home 指示条、桌面「屏幕索引」侧栏。
- `PhoneFrame` → 真实 `AppShell`（`.app-root`）：`position:fixed` 铺满视口、`flex` 纵向布局；
  顶部预留 `env(safe-area-inset-top)`、底部 Tab 与 Sheet 用 `env(safe-area-inset-bottom)` 适配
  刘海屏 / home 指示条；导航栏去掉胶囊让位，左右等距。
- 桌面端把应用居中为一列（`max-width:480px` + 细描边/投影），不是手机模型。
- `layout.tsx`：`theme-color` 改为应用表面色、补 `appleWebApp` standalone 元信息、禁用电话号识别。
- 行为 / 数据 / 屏幕逻辑不变；`pnpm typecheck` / `build` 全绿，dev 实测渲染已无任何手机壳痕迹。

### v0.2（2026-06-06）— 前端 API 契约层（所有数据走 api.ts）

- 新增 `src/proto/api.ts`：按规格 §4 补齐全部 REST 端点（9 个命名空间），每个带 `USE_MOCK` 分支
  + `apiFetch`（解包响应壳）+ `useApi` hook（mock 首帧无闪烁）+ `seed` 同步种子。
- 把屏幕里原先内联 / 直读 `data.ts` 的实体（公开数字人 / 应用中心 / 场景库 / 账户）统一收口到
  `data.ts`，并全部改走 `*Api`：屏幕层不再 import `./data`，实体数据一律经 `api.ts`。
- server 端不动；从 mock 切真后端只需 `NEXT_PUBLIC_USE_MOCK=0`。`pnpm typecheck` / `build` 全绿，
  dev SSR 实测实体数据（如「林深」「星岚」）经 api 层正常渲染。

### v0.1（2026-06-06）— 首版落地（移动端原型工程化）

- 按上传规格 + Figma Make 移动端原型 v4 落地 `apps/web-aiavatar`（Next 16 / React 19 / pnpm，port 3013）。
- 移植 18 屏 + 全套 UI 原语 + 手机壳/微信 chrome + V4「清爽」单色青皮肤。
- 领域模型（`src/proto/data.ts`）：Avatar / Look / Derivative / License / Job / BuiltinVoice(7) /
  Account / Application + 8 态状态机 + 5 步创建链路 + 6 类衍生 + 5 张标准图集。
- `pnpm typecheck` 全绿；`pnpm build` 通过（`/` 静态预渲染）；dev server `GET / 200` 实测渲染正常。
