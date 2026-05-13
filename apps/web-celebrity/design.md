# AI 明星带货 · 设计规范（Creator-Friendly）

> 本文件是 `apps/web-celebrity` 子应用的视觉与组件规范，所有页面与子组件须遵循。
> 来源：用户上传的 `AI IP Design Directions.html` 中 **02 — Creator-Friendly** 方向。
> 实施：`html data-theme="creator"` 注入主题；令牌定义在 `src/styles/tokens.css`；本地 4 件套组件库在 `src/components/creator/`。

---

## 1. 设计哲学

| 维度 | 说明 |
|---|---|
| 受众 | 内容团队 / 品牌方 / 经纪公司运营。需要快速浏览数据、找到下一步动作。 |
| 风格关键词 | 现代、表达力强、暖色奶油底、紫罗兰强调、大圆角、柔阴影、留白慷慨 |
| 与另外两个子应用对比 | drama = 影院级暗紫 + 金（cinematic），music = 制作人深色（cyberpunk-ish），celebrity = light mode 奶油 + 紫罗兰 |
| 字体气质 | Manrope 做 display 标题（轻微圆润）+ Inter 做 sans 正文 + Instrument Serif 做斜体点缀（杂志感） |

---

## 2. 设计令牌（src/styles/tokens.css）

> `:root, [data-theme="creator"]` 同时定义，便于无 data-theme 时也能 fallback。

### 2.1 颜色

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg-0` | `#faf7f2` | 画布主底（奶油） |
| `--bg-1` | `#ffffff` | 卡片白底 |
| `--bg-2` | `#f3efe7` | 次级背景 / 分隔区 |
| `--bg-3` | `#ebe5d8` | 三级背景 / hover surface |
| `--line` | `#e8e1d3` | 默认边线 |
| `--line-2` | `#d8cfba` | 强边线（输入框、selected） |
| `--fg-0` | `#1f1a14` | 主文字（墨黑） |
| `--fg-1` | `#3a3329` | 次级文字 |
| `--fg-2` | `#7a6f5d` | meta / label |
| `--fg-3` | `#a89e88` | hint / disabled |
| `--accent` | `#7c5cff` | 主强调色（紫罗兰） |
| `--accent-strong` | `#5b3fe0` | hover / 按下态 |
| `--accent-soft` | `rgba(124, 92, 255, 0.12)` | 浅紫底 / chip 背景 |
| `--info` | `#22b59a` | 信息态（青绿） |
| `--success` | `#22b59a` | 成功态 |
| `--warning` | `#f0a83a` | 警告态（琥珀） |
| `--danger` | `#ff5b8a` | 错误态（粉红） |
| `--extra-lime` | `#c4e34a` | 暖色点缀（青柠） |
| `--extra-peach` | `#ff8a5b` | 暖色点缀（蜜桃） |

### 2.2 字体

| 令牌 | 值 |
|---|---|
| `--font-sans` | `Inter`（next/font 注入） |
| `--font-display` | `Manrope`（次重 5/6/7/8） |
| `--font-serif` | `Instrument Serif`（正体 + 斜体） |
| `--font-mono` | `JetBrains Mono` |

### 2.3 圆角

| 令牌 | 值 | 用途 |
|---|---|---|
| `--radius-sm` | `6px` | 内嵌缩略图、小 chip |
| `--radius-md` | `10px` | 输入框、按钮（非 pill 时）、二级卡片 |
| `--radius-lg` | `16px` | 主卡片 |
| `--radius-xl` | `24px` | hero 大卡、CTA 大卡 |
| `--radius-pill` | `999px` | 按钮、chip、积分徽章 |

### 2.4 阴影

| 令牌 | 值 |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(31, 26, 20, 0.04)` |
| `--shadow-md` | `0 6px 20px rgba(31, 26, 20, 0.06)` |
| `--shadow-lg` | `0 20px 48px rgba(31, 26, 20, 0.08)` |

### 2.5 渐变

| 令牌 | 值 | 用途 |
|---|---|---|
| `--gradient-violet` | `linear-gradient(135deg, #7c5cff 0%, #b4a4ff 100%)` | 品牌 mark、主按钮、明星卡封面 |
| `--gradient-peach` | `linear-gradient(135deg, #ff8a5b 0%, #ffc8a4 100%)` | 暖色 hero、综艺型明星 |
| `--gradient-lime` | `linear-gradient(135deg, #c4e34a 0%, #e3f29a 100%)` | 增长 / 数据 KPI |
| `--gradient-hero` | `linear-gradient(135deg, #7c5cff 0%, #ff5b8a 50%, #ff8a5b 100%)` | 标题渐变文字 / 高级 hero |

### 2.6 字距

| 令牌 | 值 |
|---|---|
| `--tracking-tight` | `-0.025em`（大标题用） |
| `--tracking-wide` | `0.1em`（eyebrow / mono 标签用） |

---

## 3. 全局工具类

| Class | 作用 |
|---|---|
| `.creator-eyebrow` | mono 小标签：`font-mono`、`uppercase`、间距 `0.1em`、11px、`var(--fg-2)` |
| `.creator-serif` | 切到 Instrument Serif（斜体点缀场景） |
| `.creator-mono` | 切到 JetBrains Mono（数据 / 时间戳） |
| `.creator-text-gradient` | 标题渐变文字（紫→粉→桃） |
| `.creator-bg-violet` | 紫罗兰渐变背景 |
| `.creator-bg-peach` | 蜜桃渐变背景 |

---

## 4. 本地组件库（src/components/creator/）

### Button

```tsx
<Button variant="primary | secondary | ghost | outline | danger" size="sm | md | lg">
  按钮文字
</Button>
```

- 所有 variant 圆角都是 `--radius-pill`
- `primary`：紫色实心 `var(--accent)` + 白字
- `secondary`：白底 + 1px line + 主文字
- `ghost`：透明 + meta 文字
- `outline`：透明 + 紫色边 + 紫色字
- `danger`：透明 + 红色边

### Card

```tsx
<Card elevated xl>...</Card>
```

- `elevated`：加 `--shadow-md` 突出主卡；不加时只有 `--shadow-sm` 极柔
- `xl`：圆角换 `--radius-xl`（24px）用于 hero / CTA
- 默认 `--radius-lg`（16px）+ `--bg-1` 白底 + 1px line

### Chip

```tsx
<Chip tone="accent | success | warning | danger | info | peach | lime | neutral" solid>
  ...
</Chip>
```

- 默认空心：浅色底（`color-mix 10%`）+ 边框（`28%`）+ 主文字色
- `solid`：实心 + 白字（强 CTA 场景）

### KpiCard

```tsx
<KpiCard label="..." value="..." delta="..." spark={[...]} tone="..." />
```

- elevated 主卡，圆角 lg
- 大值 32px Manrope，delta mono + tone 着色
- spark 80×32 SVG 折线，颜色绑 tone

---

## 5. 页面布局规范

### 5.1 Landing（`src/app/page.tsx`）

```
+------------------------------------------------+
| header (奶油底)                                  |
|   [Logo + 品牌字]    [胶囊 nav]    [紫色 CTA]    |
+------------------------------------------------+
| hero 两栏                                        |
|   左：Chip + 76px 大标题（斜体 serif 高亮中段）   |
|        + 副标 + 双 CTA                           |
|   右：3 张倾斜叠层卡（紫桃渐变明星预览）          |
+------------------------------------------------+
| stats 大卡：4 列数据矩阵                         |
+------------------------------------------------+
| features：3 张能力卡（紫 / 桃 / 青柠 icon bg）   |
+------------------------------------------------+
| CTA 大卡：紫色实心 + 白色按钮                    |
+------------------------------------------------+
| footer：mono 小品牌字 + 4 个外链                 |
+------------------------------------------------+
```

### 5.2 Login（`src/app/login/page.tsx`）

```
+----------------------------------+
|  双光斑背景（紫 + 桃 radial）       |
|                                  |
|    Brand 头部（mark + 副标）       |
|    32px 大标题（斜体高亮"经纪公司"）|
|                                  |
|    480px elevated xl 卡片：        |
|      账号选择 list（active 紫边）  |
|      紫色实心 pill 主按钮           |
|      分割 + 手动输入用户名           |
|                                  |
|    激活入口 row 卡片                |
|    底部 mono dev hint              |
+----------------------------------+
```

### 5.3 Console Shell（`src/app/console/layout.tsx`）

- **侧栏（260px，白底）**：品牌 mark + Workspace 分组 + 6 个 sidebar 项 + 底部"返回首页"link
  - active 态：`var(--accent-soft)` 紫底 + `var(--accent)` 紫字 + 加粗
  - hover 态：透明 → `var(--bg-2)`
- **顶栏（64px，白底，1px 底边）**：mono 路径 + flex spacer + 胶囊搜索（含 ⌘K）+ 紫色积分胶囊 + 通知圆按钮 + 用户头像胶囊 + 退出圆按钮
- **main**：奶油底 + 28/32px padding

### 5.4 Console Overview（`/console`，无 tab）

- hero：eyebrow + 38px 大标题（斜体逗号高亮）+ meta 行 + 双 CTA
- 4 KPI 网格（带 sparkline）
- 主体两列：
  - 左 2/3：头部 4 明星卡（紫/桃渐变封面 + TOP chip + 详情链接）
  - 右 1/3：近期项目 list + 快捷动作 list
- 底部 4 个模块卡（明星市场 / 我的项目 / 视频中心 / 商品库）

### 5.5 Console 子 tab（`/console?tab=*`）

- 渲染原 celebrity-zone 业务组件（33 个）
- 业务组件已批量染色到 Creator 风（详见 §6）
- 主背景沿用 main 区奶油底，无额外 surface 包裹

---

## 6. 业务组件染色规则（celebrity-zone 33 个 Tailwind 组件）

为统一全站视觉，业务组件经 sed 批量替换：

### 6.1 中性色（深色 glass → light mode）

| 原 | 改 |
|---|---|
| `text-white` | `text-zinc-900` |
| `text-white/95` ~ `text-white/80` | `text-zinc-700` ~ `text-zinc-800` |
| `text-white/75` ~ `text-white/50` | `text-zinc-500` ~ `text-zinc-600` |
| `text-white/45` ~ `text-white/30` | `text-zinc-300` ~ `text-zinc-400` |
| `text-white/25` ~ `text-white/10` | `text-zinc-200` ~ `text-zinc-300` |
| `border-white/30` ~ `border-white/10` | `border-zinc-200` ~ `border-zinc-300` |
| `border-white/5` | `border-zinc-100` |
| `bg-white/[0.02..0.08]` | `bg-zinc-50` / `bg-zinc-100` / `bg-zinc-200` |
| `bg-black` / `bg-zinc-9XX` | `bg-white` |
| `bg-black/60..80` | `bg-white/90 backdrop-blur-md` |

### 6.2 强调色映射

| 原（深色霓虹） | 改（Creator 主题） |
|---|---|
| `cyan-XX` 全系列 | `violet-XX` |
| `purple-XX` 全系列 | `violet-XX` |
| `fuchsia-XX` 全系列 | `violet-XX` |
| `rose-XX` 全系列 | `pink-XX` |
| `amber-XX` | 保留（作 warning / hot 标识） |
| `emerald-XX` | 保留（作 success） |
| `pink-XX` | 保留（作 emphasis / 配 peach） |
| `orange-XX` | 保留（作 peach 暖色） |

### 6.3 阴影

`shadow-black/30..50` → `shadow-zinc-200/50`（柔和浅阴影）

---

## 7. 间距与栅格

| 维度 | 推荐值 |
|---|---|
| 页面外 padding | desktop 32px / mobile 16px |
| 卡片内 padding | 主卡 `20px 22px` ~ `26px 28px` ；hero / CTA 大卡 `32px 36px` ~ `48px 52px` |
| 卡片之间 gap | 16–18px |
| KPI 网格 gap | 16–18px |
| 模块/feature 卡之间 gap | 18px |
| 标题与副标之间 | 8–10px |
| 章节之间 | 24–32px |

---

## 8. 排版尺度

| 层级 | 字号 / 字重 / 字距 | 字体 | 用途 |
|---|---|---|---|
| hero 巨标 | 64–88px / 800 / -0.025em | Manrope display | landing hero 标题 |
| h1 页面标题 | 36–38px / 700 / -0.025em | Manrope display | 各页主标题（含 console overview） |
| h2 章节 | 28–32px / 700 / -0.025em | Manrope display | CTA / section 内标题 |
| h3 卡片标题 | 17–19px / 600 / -0.2em | Manrope display | KPI、模块卡 |
| 段落 | 14–17px / 400 / 默认 | Inter | description / 段落 |
| eyebrow | 11px / 500 / 0.1em | JetBrains Mono | 小标签 / kicker，uppercase |
| meta / hint | 11–12.5px / 400 / 0.3em | JetBrains Mono | 时间戳、ID、状态文字 |
| 标题斜体点缀 | 与上下文同号 / 400 / italic | Instrument Serif | landing 标题强调段、登录大字"经纪公司" |

---

## 9. 交互态

| 状态 | 视觉规则 |
|---|---|
| hover | 加深 1 档（如 `bg-zinc-50` → `bg-zinc-100`）；按钮加 `opacity 0.9` |
| active / selected | `border` 换 `var(--accent)`；`bg` 换 `var(--accent-soft)`；文字换 `var(--accent)`，字重 +100 |
| focus | 加 2px outline `color-mix(in srgb, var(--accent) 30%, transparent)`，offset 2px |
| disabled | `opacity 0.5` + `cursor: not-allowed` |

---

## 10. 主题切换流程

1. 在 `apps/web-celebrity/src/app/layout.tsx` 中：
   - 字体：用 `next/font/google` 注入 Inter / Manrope / Instrument Serif / JetBrains Mono → 4 个 CSS 变量绑 `--font-*`
   - html 标签上挂 `data-theme="creator"`
2. `src/styles/app.css` 末尾 `@import './tokens.css'`，让 `:root, [data-theme="creator"]` 内的 CSS 变量被注入；并在 `@layer base` 内用 `html[data-theme="creator"] body` 覆盖 `@ai-star-eco/ui/styles/globals.css` 的 `bg-background`
3. 所有页面 / 组件 **优先用 CSS 变量** 而非硬编码颜色；Tailwind 类只用于 layout / spacing
4. 切换主题（未来）只需改 `data-theme` 值并提供对应令牌段，无需改组件代码

---

## 11. 三 sub-app 视觉风格对照

| sub-app | 风格方向 | 主色 | 主底 | 字体 | data-theme |
|---|---|---|---|---|---|
| web-music | 制作人深色（cyberpunk-ish） | 紫罗兰 / 粉 | 黑 | Inter + Space Grotesk | （无 / 默认 dark） |
| web-drama | cinematic premium | 金色 `#d4af6a` | 暗紫近黑 `#0a0810` | Plus Jakarta Sans + Instrument Serif + JetBrains Mono | `premium` |
| **web-celebrity** | **Creator-Friendly** | **紫罗兰 `#7c5cff`** | **奶油 `#faf7f2`** | **Inter + Manrope + Instrument Serif + JetBrains Mono** | **`creator`** |

---

## 12. 添加新页面的清单

1. 路由文件放 `src/app/console/<name>/page.tsx`（或子 tab 用 `?tab=<name>`）
2. 引入：`import { Button, Card, Chip, KpiCard } from "@/components/creator";`
3. 标题用 Manrope `var(--font-display)`，meta 用 `creator-eyebrow`
4. 颜色一律走 CSS 变量（`var(--accent)` / `var(--fg-0)` 等），禁止硬编码颜色
5. 主要内容卡用 `<Card elevated>`，hero 用 `<Card xl elevated>`
6. 按钮一律用本地 `<Button>`，**不要**用 `@ai-star-eco/ui/ui/button`（那是 shadcn dark 风）

---

## 13. 不规范的常见 anti-pattern

| 反例 | 改 |
|---|---|
| `<div className="bg-black text-white">` | `<div style={{ background: 'var(--bg-1)', color: 'var(--fg-0)' }}>` |
| 硬编码 `#7c5cff` | 用 `var(--accent)` |
| 直接 import shadcn `<Button>` 在新页面 | 用 `@/components/creator` 的 `<Button>` |
| 用 `text-white/45` 一类深色透明 | 用 `text-zinc-400` 或 `var(--fg-2)` |
| 用 `bg-amber-500/[0.08]` 做强调底 | 用 `var(--accent-soft)` |
| `<h1 className="text-4xl font-bold">` | `<h1 style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: 'var(--tracking-tight)' }}>` |

---

## 14. 版本

- **v0.1**（2026-05-13）：初版。重构 landing / login / console shell / console overview 全部到 Creator-Friendly；批量染色 celebrity-zone 33 个业务组件（cyan/purple → violet，white → zinc，black → cream）。

后续若要改主题，更新 `tokens.css` 即可；组件代码不应硬编码颜色。
