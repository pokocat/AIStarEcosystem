# AiAvatar · 数字人资产平台（web-aiavatar）

> 移动端 H5 / 微信小程序形态的「数字人资产平台」。真人授权复刻 / 纯 AI 原创两条创建路径，
> 形象 · 声音 · 衍生物（图集 / 表情 / 场景 / 换装 / 3D / 运镜视频）一站式沉淀为可复用资产，
> 并一键接入下游子应用（音乐 / 短剧 / 带货）。
>
> 本 app 是上传的《数字人资产平台 — 数据模型与系统逻辑规格》+ Figma Make 移动端原型
> 《数字人资产平台-移动端-v4》的工程落地。

- **端口**：3013（`pnpm dev:aiavatar` / `next dev -p 3013`）
- **技术栈**：Next 16.2.6 / React 19 / TypeScript（pnpm workspace 成员）
- **形态**：手机壳 + 底部 5 Tab + 覆盖页栈的客户端 SPA（沉浸式移动体验，桌面端居中预览 + 屏幕索引）
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

- 当前**纯前端 mock 驱动、自包含**：所有领域数据在 `src/proto/data.ts`（含 8 态状态机、
  6 类衍生、5 张标准图集、7 款内置音色、授权、任务、模板等），与规格 §1–§2、§6 完全对齐。
- 仓库已有 `apps/server` 的 `com.aistareco.aep.aiavatar.*` 后端领域（v0.45），但其契约
  （`packages/types/ai-avatar.ts`）与本规格是两套不同的解释。本前端**暂不**强行对接，
  以保证对上传规格 / HTML 设计的忠实还原。接后端时以 `src/proto/data.ts` 的接口为对齐基准，
  在 `next.config.mjs` 的 `/api/*` rewrite 之上补一层 `src/proto/api.ts`（apiFetch + USE_MOCK 开关）。
  详见 [`DECISIONS.md`](DECISIONS.md)。

---

## 版本日志

### v0.1（2026-06-06）— 首版落地（移动端原型工程化）

- 按上传规格 + Figma Make 移动端原型 v4 落地 `apps/web-aiavatar`（Next 16 / React 19 / pnpm，port 3013）。
- 移植 18 屏 + 全套 UI 原语 + 手机壳/微信 chrome + V4「清爽」单色青皮肤。
- 领域模型（`src/proto/data.ts`）：Avatar / Look / Derivative / License / Job / BuiltinVoice(7) /
  Account / Application + 8 态状态机 + 5 步创建链路 + 6 类衍生 + 5 张标准图集。
- `pnpm typecheck` 全绿；`pnpm build` 通过（`/` 静态预渲染）；dev server `GET / 200` 实测渲染正常。
