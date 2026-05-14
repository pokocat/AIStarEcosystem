# AI 明星带货 · 设计规范（Creator-Friendly）

> 视觉与组件规范来源：用户上传的 "AI IP Design Directions" 参考图（02 — Creator-Friendly · Tokens / Components / Dashboard · AI Short Drama 三块画板）。
> 实施：`html data-theme="creator"`、令牌在 `src/styles/tokens.css`、本地组件在 `src/components/creator/`。

---

## 1. 设计哲学

> Modern, expressive, vibrant accents · generous whitespace · content teams.

- 受众：内容团队 / 经纪公司运营 / 品牌方。
- 关键词：温暖、表达力、饱和多彩、慷慨留白、Manrope display + Instrument Serif accent。
- 与另外两端区别：drama = 影院级暗紫金，music = 制作人深色，**celebrity = 奶油底 + 多彩调色板 + serif 点睛**。

---

## 2. 设计令牌

### 2.1 表面调色板（Palette · Surface）

| 名 | 值 | 用途 |
|---|---|---|
| cream | `#faf7f2` | 画布主底（`--bg-0`） |
| white | `#ffffff` | 卡片底（`--bg-1`） |
| sand | `#f3efe7` | 次级背景（`--bg-2`，输入框 / 工具栏底） |
| line | `#ebe5d8` → `#e8e1d3` | 边线 / 弱分隔（`--bg-3`、`--line`） |
| line/2 | `#d8cfba` | 强边线 / 输入框 outline（`--line-2`） |
| ink | `#1f1a14` | 主文字 / 黑色 CTA 按钮底色 |

### 2.2 强调调色板（Palette · Accent，6 色）

| 名 | 值 | 用途 |
|---|---|---|
| violet | `#7c5cff` | 主强调（`--accent`） |
| lime | `#c4e34a` | 增长 / 数据点缀 |
| peach | `#ff8a5b` | scripting 状态 / 暖色 |
| rose | `#ff5b8a` | romance tag / danger |
| teal | `#22b59a` | comedy / success |
| amber | `#f0a83a` | slice / filming / warning |

### 2.3 业务 tag 色（参考图 Cards · Persona 多色 chip）

| Tag | tone | color |
|---|---|---|
| Romance | romance | rose `#ff5b8a` |
| Slice-of-life | slice | amber `#f0a83a` |
| Comedy | comedy | teal `#22b59a` |
| Drama | drama | violet `#7c5cff` |

### 2.4 状态 chip 色（参考图 Table · Drama series + scene queue kanban）

| Status | tone | color |
|---|---|---|
| filming | filming | amber |
| rendering | rendering | violet |
| scripting | scripting | peach |
| editing | editing | teal |
| published | published | teal (success) |
| draft | draft | fg-3（灰） |
| archived | archived | fg-3（灰） |

### 2.5 字体

| 令牌 | 值 |
|---|---|
| `--font-sans` | `Inter`（next/font 注入） |
| `--font-display` | `Manrope`（500/600/700/800） |
| `--font-serif` | `Instrument Serif`（正体 + **italic 点睛**） |
| `--font-mono` | `JetBrains Mono` |

### 2.6 圆角 / Radius

| 令牌 | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 6px | chip 内层 / 小标签 |
| `--radius-md` | 10px | 输入框、Avatar 方形、tag、二级卡 |
| `--radius-lg` | 16px | 主卡 / KPI 卡 / GradientBlock |
| `--radius-xl` | 24px | hero 大卡（少用） |
| `--radius-pill` | 999px | **所有按钮 + chip + 搜索框 + tabs** |

### 2.7 阴影 / shadow

| 令牌 | 值 |
|---|---|
| `--shadow-soft` | `0 1px 2px rgba(31, 26, 20, 0.04)` |
| `--shadow-lift` | `0 6px 20px rgba(31, 26, 20, 0.06)` |
| `--shadow-pop` | `0 20px 48px rgba(31, 26, 20, 0.08)` |

### 2.8 渐变（KPI 卡 + 剧集卡 + Avatar 来源）

| 令牌 | 配色 | 用途 |
|---|---|---|
| `--gradient-violet` | 紫罗兰 → 浅紫 | 主品牌 |
| `--gradient-peach` | 桃 → 杏 | 暖色 |
| `--gradient-rose` | 玫红 → 粉 | 高曝光 |
| `--gradient-teal` | 青绿 → 浅青 | 状态正常 |
| `--gradient-lime` | 青柠 → 嫩绿 | 增长 |
| `--gradient-amber` | 琥珀 → 杏 | 警告 |
| `--gradient-sunset` | 玫 → 桃 → 琥珀 | 三色暖渐变 |
| `--gradient-aurora` | 紫 → 玫 → 青 | 三色冷暖渐变 |

---

## 3. 工具类

| Class | 作用 |
|---|---|
| `.eyebrow` | mono 上标：10px、`uppercase`、间距 `0.1em`、`var(--fg-2)` |
| `.serif-italic` | **Instrument Serif italic 400** —— hero 标题点睛、Tip of day |
| `.mono` | 切到 JetBrains Mono |
| `.serif` | 切到 Instrument Serif（正体） |

---

## 4. 组件库 API（src/components/creator/）

### Button — 圆角 pill，4 种 variant

```tsx
<Button variant="dark | accent | secondary | ghost | icon | danger" size="sm | md | lg" />
```

- `dark`：黑色实心（`var(--ink)`） + 白字 —— **主 CTA**
- `accent`：紫色实心（`var(--accent)`） + 白字 —— **次 CTA**（如 "+ New scene"）
- `secondary`：白底 + 1px line + 黑字
- `ghost`：透明 + meta 字
- `icon`：圆形 / 方形小按钮（icon-only）
- `danger`：透明 + 红边
- 所有 size 圆角统一 `--radius-pill`。

### Card

```tsx
<Card />            // bg-1 + 1px line + radius-lg
<Card glass />      // 同（creator 主题下无差别）
```

阴影自己加（一般用 `var(--shadow-soft)`）。

### Chip — sans 字体、pill 圆角、浅色填充

```tsx
<Chip tone="romance | slice | comedy | drama | filming | rendering | scripting | editing | published | draft | archived | accent | success | warning | danger | info | neutral" size="sm | md" />
```

填充色公式：`color-mix(in srgb, ${color} 14%, transparent)`，前景字直接用 tone color。

### KpiCard

```tsx
<KpiCard
  label="..."
  value="..."
  delta="..."
  spark={[...]}
  tone="..."
  gradient="violet | peach | rose | teal | lime | amber | sunset | aurora"   // 可选：渐变背景
/>
```

不传 `gradient` 时是白底 + 数据；传时是渐变背景 + 白色数据（参考图右上 4 个炫色 KPI 卡）。

### Avatar — 多色渐变方块/圆形

```tsx
<Avatar seed="演员名 / ID" size={32} shape="circle | square" />
```

颜色用 `hash(seed) % 8` 选 8 种渐变之一，**同一 ID 永远同色**。无图片场景下作头像 / 卡片缩略。

### GradientBlock — 剧集卡 hero 装饰

```tsx
<GradientBlock seed="..." height={140} topLeft={...} topRight={...} bottom={...} />
```

渐变背景 + 高光叠层 + 4 个槽位（topLeft / topRight / bottom / children）。Active series 卡片、明星 showcase 卡都用它。

### Tabs

```tsx
<Tabs items={[{ id, label, count? }]} active="..." onSelect={...} size="sm | md" />
```

pill 圆角分段按钮组（参考图 Board / Timeline / List）。

### Meter / Input / DataTable / Sidebar / Topbar

形态与 scaffold 一致；细节见组件文件。**Sidebar item 支持 `badge`**（红圆数字角标，参考图 Scenes [4]）。

---

## 5. 页面布局

### 5.1 Landing（`src/app/page.tsx`）

```
+------------------------------------------+
| header   [logo] [hash nav]  [secondary][accent]
+------------------------------------------+
| hero 两栏                                  |
|   左：eyebrow + 56px 大标题（serif 高亮）  |
|        + 副标 + 双按钮（dark + secondary）  |
|   右：实时看板 Card（GradientBlock hero +   |
|        4 PreviewStat + 4 tag chips）       |
+------------------------------------------+
| Showcase 4 列 GradientBlock 卡片            |
+------------------------------------------+
| Features 3 张 Card                         |
+------------------------------------------+
| CTA 大卡（sand bg + accent 按钮）           |
+------------------------------------------+
| footer mono                                |
+------------------------------------------+
```

### 5.2 Login（`src/app/login/page.tsx`）

居中 440px：
- Brand mark + 28px 大标题（serif 高亮"经纪公司"）
- 主 Card：账号列表（Avatar + 名 + chip）+ dark 主按钮 + 手动输入子区
- 激活入口 Card（紫色 icon + 文字 + 箭头）

### 5.3 Console layout（`src/app/console/layout.tsx`）

220px sidebar + topbar 64px：
- **Sidebar**：紫色 iP mark + WORKSPACE 分组（今日 / 明星市场）+ DRAMA 分组（明星阵容 / 切片队列[4] / 项目流水线 / 商品库 / 数据中心）+ 底部 **Tip of the day**（sand bg 小贴士）+ 用户档案
- **Topbar**：mono breadcrumb（"Studio / 明星带货 / 今日"）+ flex spacer + pill 搜索框（含 ⌘K）+ 紫色积分 chip + Export + accent "+ New scene" + Avatar + LogOut icon

### 5.4 Console Overview（`/console`，仿参考图 Dashboard · AI Short Drama）

```
+-----------------------------------------+
| WEDNESDAY · MAY 14  (mono)                |
| 34px Good morning, Ami. _let's shoot...   |
|                              [import] [▶ open studio]
+-----------------------------------------+
| 4 KPI 渐变卡（violet / peach / rose / teal）
+-----------------------------------------+
| Active drama series (2/3)      Your cast (1/3)
|   6 GradientBlock 剧集卡        Avatar list × 6
+-----------------------------------------+
| Today's scene queue · what we're shooting
|   4 列 kanban：Scripting / Filming / Editing / Published
|   每张卡：Avatar + 标题 + meta + "+ Add scene"
+-----------------------------------------+
```

### 5.5 Console 子 tab（`?tab=*`）

渲染原 celebrity-zone 业务组件（33 个）。组件已经过批量染色（cyan/purple → violet，white → zinc，black → bg-1）；继续在 light 主题下展示。

---

## 6. 排版尺度

| 层级 | 字号 / 字重 / 字距 | 字体 | 用途 |
|---|---|---|---|
| Display | 40+px / 700 / -0.025em | Manrope | landing hero 大标 |
| H1 | 28-34px / 600 / -0.025em | Manrope | 页面主标题（含 console hero） |
| H2 | 22px / 600 | Manrope | 章节标题 / 卡片标题 |
| H3 | 16px / 600 | Manrope | 子卡片 |
| Body | 14px / 400 | Inter | 段落 / 描述 |
| Meta | 11-12.5px / 500 / 0.3em | JetBrains Mono | 时间戳、ID、状态、breadcrumb |
| Eyebrow | 10px / 500 / 0.1em | JetBrains Mono | uppercase 小标签 / kicker |
| Italic accent | 与上下文同号 / 400 | Instrument Serif | **hero 标题强调段（"let's shoot something today."）** |

---

## 7. 交互态

| 状态 | 视觉规则 |
|---|---|
| hover (按钮) | `opacity: 0.92` |
| hover (卡片可点) | `boxShadow: var(--shadow-lift)` |
| active / selected (sidebar) | bg `var(--accent-soft)` + 字 `var(--accent-strong)` + icon `var(--accent)` |
| active (chip 选中) | 同上 |
| focus | 2px outline `color-mix(in srgb, var(--accent) 30%, transparent)` |
| disabled | `opacity: 0.5` + `cursor: not-allowed` |

---

## 8. 三 sub-app 视觉风格对照

| sub-app | 风格方向 | 主色 | 主底 | 字体 | data-theme |
|---|---|---|---|---|---|
| web-music | 制作人深色 | 紫罗兰 / 粉 | 黑 | Inter + Space Grotesk | （默认） |
| web-drama | cinematic premium | 金 `#d4af6a` | 暗紫近黑 `#0a0810` | Plus Jakarta + Instrument Serif + JetBrains Mono | `premium` |
| **web-celebrity** | **Creator-Friendly · 参考图风** | **violet `#7c5cff` + 6 色调色板** | **奶油 `#faf7f2`** | **Inter + Manrope + Instrument Serif + JetBrains Mono** | **`creator`** |

---

## 9. 添加新页面 checklist

1. 路由放 `src/app/console/<name>/page.tsx`（或 `?tab=`）
2. import `@/components/creator` 的组件 —— **不要**用 shadcn 或 `@ai-star-eco/ui` 的 dark 版组件
3. 标题用 Manrope（`var(--font-display)`），眉标用 `.eyebrow`，斜体高亮用 `.serif-italic`
4. 主按钮 `<Button variant="dark">`，紫色 CTA `<Button variant="accent">`
5. 状态 chip 走 `<Chip tone="filming | scripting | published | ..." />`
6. 头像 / 缩略图用 `<Avatar seed={id} />`（不要硬编码渐变）
7. 颜色一律 `var(--...)` 变量，禁止硬编码 hex
8. 圆角用 `var(--radius-*)`；按钮全部 `pill`，卡片 `lg`，chip `pill`
9. 数据类 KPI 用 `<KpiCard gradient="violet | peach | rose | teal">` 上色

---

## 10. anti-pattern + 改法

| 反例 | 改 |
|---|---|
| `<button style={{ background: '#000' }}>` | `<Button variant="dark">` |
| 用 shadcn `<Button>` | 改用 `@/components/creator` 的 |
| `<h1 className="text-4xl font-bold">` | `<h1 style={{ fontSize: 34, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: 'var(--tracking-tight)' }}>` |
| 硬编码 `#7c5cff` | `var(--accent)` |
| Chip 用 `bg-amber-500/[0.1] text-amber-700` | `<Chip tone="filming">` |
| Hero 标题全部用一个字体 | 用 Manrope，部分用 `.serif-italic` 点睛 |
| 头像用单一灰色方块 | `<Avatar seed={id} />` 多色渐变 |
| sidebar 选中用浅灰 | 选中用 `var(--accent-soft)` 紫底 |

---

## 11. 版本

- **v0.2**（2026-05-14）：按用户上传参考图重做。组件库新增 Avatar / Tabs / GradientBlock；KpiCard 加 gradient 属性；Sidebar 加 badge；Button 改 pill + dark/accent 双主按钮；Chip 扩 11 种业务 tone。Landing / login / console layout / overview 全部用新组件重写。
- v0.1（2026-05-13）：首版 Creator-Friendly，被用户判定不好看（太营销页化）。

后续若要改主题，更新 `tokens.css` 即可；组件代码不应硬编码颜色。
