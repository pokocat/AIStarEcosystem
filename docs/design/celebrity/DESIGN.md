---
name: AI 明星带货 · Celebrity Design System
description: Creator-Friendly 风向标在 AI 明星带货线的 codify —— 暖奶油 + 紫罗兰 + 衬线斜体情感重音
register: product
scope:
  - apps/web-celebrity/**
source: Figma Make · "02 — Creator-Friendly" direction + "Creator-Friendly Components" extension
colors:
  cream: "#faf7f2"
  surface: "#ffffff"
  sand: "#f3efe7"
  line: "#e8e1d3"
  line-strong: "#d8cfba"
  ink: "#1f1a14"
  ink-1: "#3a3329"
  ink-2: "#7a6f5d"
  ink-3: "#a89e88"
  violet: "#7c5cff"
  violet-deep: "#5b3fe0"
  lime: "#c4e34a"
  peach: "#ff8a5b"
  rose: "#ff5b8a"
  teal: "#22b59a"
  amber: "#f0a83a"
typography:
  display:
    fontFamily: "Manrope, 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Manrope, 'PingFang SC', system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, 'PingFang SC', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Inter, 'PingFang SC', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
  serif-accent:
    fontFamily: "'Instrument Serif', 'Songti SC', Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-accent:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  button-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.rose}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  chip-tag:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.violet-deep}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  card-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px 22px"
  card-kpi:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "18px 20px"
  nav-item-selected:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.violet-deep}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  table-header:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink-2}"
    padding: "14px 18px"
  tabs-track:
    backgroundColor: "{colors.sand}"
    rounded: "{rounded.md}"
    padding: "4px"
---

# Design System: AI 明星带货 · Celebrity

> **Scope**：本设计系统**对 `apps/web-celebrity/` 子应用全域生效** —— 整个 web-celebrity 子应用（页面、组件、布局、登录、空状态、错误页、营销落地、内嵌 dashboard 等）都遵循本规范。
> 兄弟子应用 `apps/web`（数字人主站）、`apps/admin`（运营后台）、`apps/miniprogram`（带货方小程序）、`apps/server`（共用后端）**不受本规范约束**，保留各自既有视觉。

## 1. Overview

**Creative North Star：「The Studio Notebook · 一本能让明星合作变温柔的工作手册」**

Celebrity 业务线是带货方（CRM 客户）的高客单价、低频次决策动作 —— 选明星、谈授权、上预算、做内容。它不是仪表盘，也不是促销页，而是一台**让普通运营也敢决定一条 ¥2,800/条投放**的工具。所以视觉语言走"Creator-Friendly"暖奶油 + 紫罗兰路线：界面像翻开的工作室笔记本而不是 SaaS 后台，KPI 数字大、装饰圆角光晕轻，关键决策点（明星卡、引擎选择、生成按钮）由紫罗兰**承担情感重音**，而衬线斜体（Instrument Serif）专门用于"软话"—— 提示语、问候、tip-of-the-day —— 像在表格旁边随手写的注释。

这套系统**显式拒绝**以下范式：① MCN 那种深色 + 数据墙的"指挥中心"美学（属于 Tech-Professional，给 musician 线用）；② 名人 / 奢侈品那种暗金 + 玻璃渐变的"红毯"美学（属于 Entertainment-Premium，不是本项目当前定位）；③ 通用 SaaS 模板的纯白 + 蓝色 CTA + 圆角 8px。Celebrity 是"工作室"，不是"指挥室"也不是"礼宾台"。

**Key Characteristics：**
- 表面色是奶油（cream `#faf7f2`），不是纯白；纯白只用在卡片堆叠里
- 主强调色是紫罗兰 `#7c5cff`（One Voice，覆盖 ≤10% 屏幕面积）
- 字体三件套：Manrope（display／带数字宽度）+ Inter（body） + Instrument Serif italic（情感重音，仅短句）
- 圆角节奏：`sm 8` 标签/小控件 · `md 14` 按钮/卡片 · `lg 20` 主要面板 · `pill 999` 状态徽章
- 阴影克制：默认无阴影，hover/active 才出现"soft / lift / pop"三档
- 头像、KPI 装饰圆、进度条用**双色 linear-gradient**（如 violet → peach）作为身份标识，而不是上传的明星头像（隐私 + 授权稳定性）
- 中文单语；技术 token 名保留英文（呼应 CLAUDE.md「Chinese monolingual」铁律）

## 2. Colors: The Cream-Ink-Violet Palette

调色板分三层 —— **表面 cream + ink 文字** 是地基（占屏 ≥85%），**violet 单一强调**承担转化点（占屏 ≤10%），**lime / peach / rose / teal / amber** 是身份色（仅用于头像渐变、状态徽章和品类标签，从不互相组合在同一控件上）。

### Primary

- **Studio Violet**（`#7c5cff` · oklch(61% 0.22 290)）：The One Voice. 主 CTA（"生成视频"、"提交授权"）、选中态导航条、紫罗兰光晕装饰圆。任何一屏 violet 总面积不得超过视口 10%。
- **Violet Deep**（`#5b3fe0` · oklch(48% 0.24 285)）：紫罗兰文字态、`bg-violet/12` 选中态的前景字色，与浅紫底配对达 AA。

### Secondary（身份色集 · Identity Hues）

身份色专门用在"明星卡片头像渐变"、"品类徽章"、"看板列分类点"，**不允许**用作按钮 fill 或大面积背景。

- **Lime**（`#c4e34a` · oklch(87% 0.18 115)）：teal / amber 的搭档色；进度条尾端、轻喜剧品类。
- **Peach**（`#ff8a5b` · oklch(73% 0.16 40)）：violet 的最常见搭档；浪漫 / 时尚品类。
- **Rose**（`#ff5b8a` · oklch(68% 0.20 5)）：女性情感系；爱心 icon 按钮专色。
- **Teal**（`#22b59a` · oklch(66% 0.12 175)）：成功状态、"ready / published" 徽章字色。
- **Amber**（`#f0a83a` · oklch(76% 0.14 70)）：警示但非危险；"training / scripting / pending" 中间态。

### Neutral · 暖灰阶（warm-tinted neutrals）

所有中性色都向暖棕（hue ≈ 60）轻微偏色 —— 没有任何一个值是纯灰。

- **Cream**（`#faf7f2`）：所有 page 背景。**禁止用纯白做 page 背景。**
- **Surface**（`#ffffff`）：卡片、modal、悬浮层 fill。它是 cream 上方的第一层堆叠。
- **Sand**（`#f3efe7`）：表头条带、tabs 容器、看板列容器、进度条轨道。
- **Line**（`#e8e1d3`）：默认描边（卡片、表格行分隔）。
- **Line Strong**（`#d8cfba`）：输入框 idle 描边、虚线占位、二级分隔。
- **Ink**（`#1f1a14`）：正文。
- **Ink 1**（`#3a3329`）：导航项默认色、副标题。
- **Ink 2**（`#7a6f5d`）：辅助文字、占位符、KPI 描述行。
- **Ink 3**（`#a89e88`）：禁用、面包屑斜杠、"+ Add" 虚框文字。

### Named Rules

**The One Voice Rule.** Studio Violet 是这套系统里唯一的"强调"色 —— 一屏可见 violet 总面积 ≤ 10%。两个紫色按钮同屏出现是错的，把次级动作改成 `button-secondary`。

**The Identity-Through-Gradient Rule.** 明星头像、KPI 装饰圆、品类 chip 不用单色，用**双色 linear-gradient 135°** 承担身份。配色字典（按品类）：
- 演员（剧情）：violet → peach
- 歌手：teal → lime
- 主持人 / 综艺：amber → peach
- 运动员：teal → lime（同歌手，但用直角圆）
- 网红：rose → violet
- 默认：ink → rose

**The Warm-White Rule.** 项目里**禁止出现 `#fff` 作为页面背景**或 `#000` 作为正文色。所有中性色按上面 `cream / surface / ink-*` 取词。

## 3. Typography

**Display Font**：Manrope 700 / 800（数字与中文字宽配合好，比 Inter 更"工作室")
**Body Font**：Inter 400 / 500（中文 fallback：PingFang SC / Hiragino Sans GB）
**Accent Font**：Instrument Serif **italic only**（用于"软话"重音）
**Mono Font**：JetBrains Mono 500（仅版本号、id、定价单价）

**Character**：Manrope 的数字宽度 + Instrument Serif 斜体 = "数据 + 人情味"的双声部 —— 数据该硬的硬，提示该软的软。中文不参与 Instrument Serif（因为缺中文斜体匹配字形），中文软话用 `font-weight 400 · letter-spacing 0` 的 PingFang Light 表达同等"小声说"语气。

### Hierarchy

- **Display**（Manrope 700, `clamp(2rem, 4vw, 2.5rem)`, line-height 1.1, letter-spacing -0.03em）：每页 dashboard 的欢迎语（"Good morning, X. let's shoot something today."）。**一页限一次**。
- **Headline**（Manrope 700, 26px, 1.2, -0.02em）：分区标题（"Active drama series"、"今日明星精选"）。
- **Title**（Manrope 700, 18px, 1.3, -0.01em）：卡片头、modal 标题。
- **Body**（Inter 400, 14px, 1.6）：正文。中文长段最大宽度 65 个汉字（约 ch 不直接适用，按 `max-width: 36em`）。
- **Label**（Inter 700, 11px, letter-spacing 0.12em, **UPPERCASE / 中文不变形**）：分区 eyebrow、KPI 说明、表头。**英文 ALL CAPS，中文不强制大写**（中文没有 case 概念，强行 letter-spacing 0.12em 即可营造同等"小标"效果）。
- **Serif Accent**（Instrument Serif italic 400, 22px）：tip-of-the-day、welcome 句尾、"v2.4" 这类版本号后缀的人情味注释、empty state 的"软话"。
- **Mono**（JetBrains Mono 500, 12px）：`persona.v2.4 · ready`、订单号、明星 id。

### Named Rules

**The Italic-Serif Whisper Rule.** Instrument Serif italic **只用于英文短句或符号衔接**，最长 8 个单词。中文不用 Instrument Serif（字形不支持），代之以"PingFang 400 + 紫色文字"。例：
- ✅ `Hana <em>· v2.4</em>` （斜体衔接版本号）
- ✅ `let's shoot something today.`（句尾轻语）
- ❌ `<em>明星合作完整流程</em>`（中文不要 italic 衬线）

**The Numeric Stability Rule.** 所有数字字段必须用 `font-variant-numeric: tabular-nums`（KPI、积分单价、销量、播放量），保证翻页 / hover 不抖动。前端格式化在 `apps/web/src/lib/format.ts` 的 `formatCompactNumber / formatCredits / formatCurrency / formatDuration`，**禁止在源数据里写 "128K"** —— 源数据永远是 raw integer。

**The Eyebrow Above Headline Rule.** 每个 dashboard 大区头部都是「label eyebrow（11px UPPERCASE 0.12em ink-2）→ 24px 间距 → display / headline」三层结构；eyebrow 是必备的"哪一区"提示。

## 4. Elevation

系统**默认无阴影**（flat by default）。阴影是状态语言而非装饰 —— 它出现意味着"正在被操作 / 正在被强调"。深度优先用 **tonal layering**（cream → sand → surface 的色温堆叠）来表达，阴影是最后手段。

### Shadow Vocabulary

- **soft**（`box-shadow: 0 1px 2px rgba(40,30,20,.06), 0 4px 14px rgba(40,30,20,.05)`）：卡片 hover；表格行 hover；KPI 卡 idle。
- **lift**（`box-shadow: 0 6px 16px rgba(40,30,20,.08), 0 16px 40px rgba(40,30,20,.06)`）：modal、popover、悬浮 menu。
- **pop**（`box-shadow: 0 12px 36px rgba(124,92,255,.18), 0 4px 12px rgba(40,30,20,.05)`）：accent 按钮 hover、"生成视频" 的主 CTA。**唯一带紫色光晕的阴影**，用来回应 One Voice。

### Named Rules

**The Flat-At-Rest Rule.** 静止态卡片**不要**有阴影，靠 `1px solid line` 和 `cream → surface` 的色温差表达层级。只有 hover / active / focus 时才用 soft；只有主 CTA（accent button）hover 时才用 pop。

**The Single-Pop Rule.** 一屏只允许一个 `shadow-pop`（紫色光晕阴影），就是当前最主要的转化按钮 —— "生成视频"、"立即授权"、"提交订单"。多于一个，说明转化路径设计错了。

## 5. Components

### Buttons

按钮 6 变体，按"转化层级"排列：

- **Shape**：`rounded.md` (14px)；icon 按钮和"全部 ▾" 这种过滤气泡用 `rounded.pill` (999px)。
- **Primary**（`button-primary`）：ink 黑 fill + 白字。最高优先级动作但**不**是 accent —— 用于"打开工作室"、"保存草稿提交"等不可逆 / 全局动作。
- **Accent**（`button-accent`）：violet fill + 白字 + 阴影 pop on hover。**专留给当前页主转化点**（一屏一个）—— 通常是"✦ 生成视频 / ✦ 新建场景"。
- **Secondary**（`button-secondary`）：白底 + `line-strong` 1.5px 描边 + ink 字。次要动作（"预览 / 导出 / 取消"）。
- **Ghost**（`button-ghost`）：透明 + ink-1 字。链接式动作（"查看全部 →"、"放弃"）。
- **Pill**（`button-pill`）：`rounded.pill` 白底 + `line-strong` 描边。过滤气泡（"全部明星 ▾"）、segment 切换。
- **Icon**（`button-icon`）：`rounded.pill` 38×38 白底 + rose 字。专给"心 / 收藏 / 关注"这类情绪图标用，rose 是它的固定色。

**Hover / Focus**：
- primary → 背景 `#0f0c08`（ink 加深），shadow soft
- accent → shadow pop（紫光晕）；transform 不要平移，violet 阴影自带"鼓起"感
- secondary / pill → 描边 `line-strong → ink-1`，背景 sand
- 所有按钮 focus-visible：`outline: 2px solid violet; outline-offset: 2px`

**Sizes**：`md` 14px 字 11px padding；`sm` 12.5px 字 8px padding；不做 `lg`（dashboard 不需要营销级大按钮）。

### Chips（标签 / 状态徽章）

- **Style**：`padding: 4px 10px`；`rounded.pill`；`font-size 11px / weight 700`。
- **Tinted-on-Tinted Pattern**：背景是**强调色 12-18% 透明度**，文字是强调色实色。例：`background: rgba(124,92,255,0.18); color: #5b3fe0`。**禁止**用强调色实色做背景（会和 accent button 抢戏）。
- **状态字典**：
  - `ready / published / authorized` → teal
  - `filming / in-progress` → violet
  - `editing / rendering` → peach
  - `scripting / training / pending` → amber
  - `draft / archived / expired` → ink-3
- **品类标签**：用对应身份色按 Identity-Through-Gradient Rule 的字典（演员=violet, 歌手=teal, …）。

### Cards / Containers

- **Corner**：默认 `rounded.lg` (20px) 主面板；`rounded.md` (14px) 内嵌卡 / KPI / 表格行。
- **Background**：surface 白；`1px solid line` 描边；**不要**叠 shadow（参见 Flat-At-Rest Rule）。
- **Internal Padding**：主面板 `20-22px`；KPI 卡 `18-20px`；看板列 `14px 12px`；表格行 `14px 18px`。
- **装饰光晕（KPI 专属）**：卡片右上角负偏移的 `radial-gradient` 圆，参数：`width: 80px; height: 80px; top: -20px; right: -20px; background: radial-gradient(circle, {identity-color}24, transparent 65%)`。这是 Creator-Friendly 的标志性装饰，**只用于 KPI 卡**，其他卡片不许加。
- **嵌套禁令**：卡片里再套带描边的卡片是错的；表格放在卡片里只用 `border-bottom: 1px solid line` 分隔行。

### Inputs / Fields

- **Style**：白底 + `1.5px solid line-strong` 描边 + `rounded.md` (14px) + `padding: 12px 14px` + `font-size 14px`。
- **Label**：11.5px ink-2 weight 600，下面 6px 间距接 input。**Label 是标准位**，不要 floating-label。
- **Focus**：描边 `line-strong → violet`，`outline: none`，**不**加 box-shadow（focus 用纯描边色变化）。
- **Error**：描边 rose；错误文字 12px rose weight 600，距 input 4px。
- **Disabled**：bg sand，文字 ink-3，cursor not-allowed。
- **Prefix / Suffix**：装在 input 内部右侧的小图标 / 单位（"¥"、"分钟"），不要把它做成 input 外的小标签。

### Navigation

- **Sidebar**：宽 240px；cream 背景；`1px solid line` 右边界。
- **Section Header**：11px UPPERCASE 0.14em ink-3，`padding: 18px 12px 8px`。
- **Nav Item**：`padding: 10px 12px; rounded.md; gap 12px`（icon 18×18 + label 13.5px）。
  - 默认：transparent + ink-1 字
  - hover：`background: sand; color: ink`
  - **selected：`background: rgba(124,92,255,0.12); color: violet-deep; weight 600`** —— 不用左侧色条（参见 Do's and Don'ts），整个 item 染色。
- **Badge**：选中项右侧小红点 / 数字，10px 700 violet bg 白字 `padding: 1px 7px; rounded: 6px`。
- **Sidebar 底部**：粘 tip-of-the-day 卡片 —— `linear-gradient(135deg, violet10%, peach10%)` 底 + `Instrument Serif italic` 标题 + 12px ink-2 副本。这是 Creator-Friendly 的"工作室手感"地标，**保留**。

### Signature Component · Persona Card（明星卡）

Celebrity 业务的核心控件 —— 出现在市场列表、订单详情、生成器选择步骤。

- **Shape**：`rounded.lg` 主卡 + 64×64 `rounded` 14px 头像槽位
- **Avatar**：双色 linear-gradient 135°（按 Identity-Through-Gradient Rule），左上 30%/25% 处叠加 `radial-gradient(circle, {identity-second}80, transparent 55%)` 营造光斑。**不用真人照片**（隐私 + 授权稳定性 + 视觉一致性）。
- **Name + Version**：Manrope 18 / 700 主名 + Instrument Serif italic ink-2 衔接版本号（如 "Hana *· v2.4*"）。
- **Status Strip**：卡底两个 chip —— 状态（ready/training/expired …）+ 数量（"3 series" / "8 模板"）。
- **Hot 标识**：右上角 `rose → violet` 渐变 `🔥 热门` 徽章（仅当 `isHot=true`）。
- **限免**：左上角 amber chip `限免中` —— 不重叠 hot 徽章（互斥）。

### Signature Component · Engine Picker（引擎选择 · KeLing / HiGen / MiniMax）

Celebrity 业务的生成器关键决策点。三档引擎用 **BigRadioCard 大单选卡** 横排：

- **Shape**：`rounded.lg` + `padding: 18px 20px` + `1.5px solid` 描边
- **Idle**：描边 `line-strong`；标题 Manrope 16 / 700；副文 12 ink-2
- **Hover**：描边 ink-1；shadow soft
- **Selected**：描边 violet；左上角浮一个 6×6 violet 实心方块；右下角 24×24 violet circle 内置 ✓
- **每档专属信息**（来自 `apps/web/src/constants/celebrity-zone-ui.ts`）：
  - 左侧 32×32 渐变方块（KeLing teal→lime · HiGen violet→peach · MiniMax amber→peach）
  - 标题 "标准 · HiGen" — 等级前置 Manrope 700
  - quality 用 5 颗星，amber 实心 + ink-3 空心
  - speed 12px ink-2 mono "~3 分钟"
  - creditPrice 右上角 mono 大字 + "积分/条" label

引擎价目动态来自 `GET /celebrity/engine-pricing`；mock 时回退到 `ENGINE_META`。

### Tables

- **Header**：sand 背景 + `1px solid line` 下边 + label 样式（11px 700 0.12em ink-2 UPPERCASE）。
- **Row**：14px 18px padding；`border-bottom: 1px solid line` （最后一行无）；`hover: background: sand`。
- **First Column**：通常是 36×36 渐变缩略图 + Manrope 600 标题。
- **Empty Cell**：用全角短横线 `—` 而不是 `N/A` / `-` / `null`。
- **Action Column**：宽 70px 右对齐，单个 `⋯` 图标（cursor pointer）打开 menu popover。

### Progress（进度条）

- **Track**：`height: 8px` sand + `rounded: 4px`
- **Fill**：`linear-gradient(90deg, {primary-identity}, {secondary-identity})` 双色渐变，与控件所属对象的身份色一致（明星卡的进度用其头像渐变同款）。**不要**用纯 violet 填进度条（会让 violet 失去 One Voice 地位）。

### Tabs

- **Track**：sand 容器 + `padding: 4px` + `rounded.md`。
- **Item**：`padding: 8px 16px; rounded: 10px; weight 600`。
- **Active**：白 fill + ink 字 + `shadow: 0 1px 2px rgba(40,30,20,.06)`（极轻 soft 阴影来"浮起"）。
- **Inactive**：transparent + ink-2 字。

### Status Pill（看板列 head dot）

看板列顶部小圆点 + 列名 + 数量。点的颜色按状态字典；点 8×8 圆，列名 13/700 ink，数量 11 ink-2 weight 600 靠右。

## 6. Do's and Don'ts

### Do:

- **Do** 用 `cream #faf7f2` 做所有 page 背景；卡片才用 surface 白。
- **Do** 把 violet 限制在主 CTA 和选中态导航，一屏 violet 总面积 ≤ 10%。
- **Do** 让明星头像、KPI 装饰圆、品类 chip **用双色 linear-gradient 135°**（参 Identity-Through-Gradient Rule 字典）。
- **Do** 给 KPI 卡右上加 `radial-gradient` 80×80 负偏移装饰圆，承担"工作室"手感。
- **Do** 用 `Instrument Serif italic` 衔接版本号、tip-of-the-day、welcome 句尾的英文短句（≤8 词）。
- **Do** 主 CTA hover 用 `shadow-pop`（紫光晕），一屏只许出现一次。
- **Do** 所有按钮 focus-visible 显示 `2px solid violet outline` + `2px offset`。
- **Do** 中文数据字段在源数据里保留 raw integer（如 `fans: 128000`），格式化在 `apps/web/src/lib/format.ts`。
- **Do** 把所有 status pill 做成 `tinted-on-tinted`（强调色 12–18% 底 + 强调色实色字）。
- **Do** 静止态用 `1px solid line` 表达卡片层级，**默认无阴影**。
- **Do** 中文字 fallback 用 PingFang SC / Hiragino Sans GB；不用 Microsoft YaHei。

### Don't:

- **Don't** 用纯 `#fff` 做页面背景；也别用 `#000` 做正文。神色都是暖灰阶（参 Colors §Neutral）。
- **Don't** 在 nav item 上加左侧色条（如 `border-left: 3px solid violet`）。**整项染色** `background: rgba(124,92,255,0.12)` 才是对的写法。
- **Don't** 把 violet 当 fill 色用在状态徽章背景、进度条主色、品类标签底色 —— 那是 One Voice 的滥用；用 violet @ 12-18% alpha 作底，violet-deep 作字。
- **Don't** 同一屏同时出现两个 `button-accent`（紫罗兰填充按钮）。次要动作改 secondary 或 ghost。
- **Don't** 用真人照片做明星头像（隐私 + 授权稳定性）；用 Identity-Through-Gradient Rule 的双色渐变方块替代。
- **Don't** 给 `Instrument Serif italic` 喂中文段落（字形不匹配，会变成楷体回退，破坏视觉）。中文软话用 PingFang 400 + violet 文字。
- **Don't** 给静止态卡片加阴影；阴影是状态语言，仅 hover / active / focus 用 soft，仅主 CTA hover 用 pop。
- **Don't** 在卡片里嵌带描边的卡片。表格放在卡片里只用 `border-bottom: 1px solid line` 分隔行。
- **Don't** 用 floating-label 输入框；明确的 label-above-input 才符合工作笔记本气质。
- **Don't** 用 Material-style ripple / elevation lift 过渡；Creator-Friendly 的运动是"渐隐渐显"+ shadow swap，不是物理拟态。
- **Don't** 把 KPI 数字格式化进源数据（如 `"128K"`）—— 源永远 raw integer。
- **Don't** 引入 Microsoft YaHei；中文回退用 PingFang SC / Hiragino Sans GB 与 macOS / iOS 出厂字保持一致。
- **Don't** 沿用 Tech-Professional 的深色 / 数据墙美学（属于 musician 线）；也别用 Entertainment-Premium 的暗金 / 玻璃渐变（不属于当前定位）。

---

> **应用边界**（再次强调）：本文档**对 `apps/web-celebrity/` 子应用全域生效**，覆盖该子应用下所有页面 / 组件 / 布局 / 主题。其他兄弟子应用（`apps/web` 数字人主站、`apps/admin` 运营后台、`apps/miniprogram` 小程序）不在本规范覆盖范围 —— 它们保留各自既有视觉系统。
>
> **新建 `apps/web-celebrity/` 时的落地顺序**：
> ① 项目骨架（Next.js 14 + App Router；端口待定，建议 3004 与 web(3002)/admin(3003) 错开）
> ② 全局 `app/layout.tsx` 注入字体 `<link>`（Manrope / Inter / Instrument Serif / JetBrains Mono），`<body>` 默认 `background: #faf7f2; color: #1f1a14; font-family: Inter, …`
> ③ Tailwind / CSS 变量层：把 frontmatter 的 colors / rounded / spacing 落成 `theme.extend` 或 `:root` 变量
> ④ Persona Card / Engine Picker 两大签名组件先落（带货核心入口）
> ⑤ 通用组件库（buttons 6 变体 / inputs / status pills / KPI cards / nav / tabs / progress / tables）
> ⑥ 业务页面铺开（市场首页 / 明星详情 / 模板挑选 / 引擎与参数 / 生成中 / 我的项目 / 积分钱包 / 订单 / 消息中心 等）
>
> 接口层与三端数据模型对齐仍走仓库既有铁律：`apps/web/src/types/celebrity-zone.ts` 是真源，`apps/web-celebrity` 复制保持一致；接口走 `apiFetch` → `specs/openapi.yaml` → `npm run check:api-contract`。
