# AI IP 工作台 · 视觉系统（web-ipstudio）

> **本文件是 `apps/web-ipstudio` 配色与视觉的文档真源；色值的代码真源只有一处 ——
> `src/styles/tokens.css`。**
> `src/styles/app.css` 用 **`@theme inline` + `var()` 别名**把 Tailwind 调色板指向那些
> 运行时变量（`--color-ink: var(--ink)` 之类），**不复制任何 hex**，所以改色只需动
> `tokens.css` + 本文件两处。
> 唯一例外是**字体**：`--font-sans/serif/mono` 在 `@theme` 里必须是字面量（同名变量写
> `var()` 会自引用），且不能只留 `@theme` 一处 —— `@ai-star-eco/ui` 的 `globals.css` 在
> `:root` 把 `--font-sans` 定成了 Inter，只有最后导入的 `tokens.css` 盖得住它。字体两处同改。
> 改了 hex 不改本文件，或在 `app.css` 里重新写死 hex，都算 drift，review reject。
>
> 产品与界面约束见 [`PRODUCT.md`](PRODUCT.md)；技术 onboarding 见 [`README.md`](README.md)。
> 历史沿革：v0.151 首版沿用 AiAvatar 的「单一青色 `#12B3DE`」；**本版（2026-09-06）整体
> 换成低饱和群青 + 麦黄双主色**，青色已从本子应用全部退役（仓内不再有该色值）。

---

## 1. 一句话

**低饱和群青托底，麦黄只给主动作，纸白与墨做内容。**
群青负责「这是谁」（品牌、顶栏、选中、进行中），麦黄负责「点这里」（进入工作台 / 运行 /
发布 / 提交），纸白与墨负责「看内容」。两条主色分工固定，谁也不越界 —— 这是本系统唯一的
硬约束，其余都是量的问题。

## 2. 色值（hex 就是真源）

### 主色

| Token | Hex | 角色 |
|---|---|---|
| `--blue-900` | `#26334F` | 最深群青：footer |
| `--blue-800` | `#2E3F60` | 深群青：工作台品牌顶栏、landing 收尾 CTA 区 |
| `--blue-700` | `#344B70` | 深群青：landing 头部与英雄区底、画布工作栏、`themeColor` |
| `--blue-600` | `#3D5482` | 群青 hover / `--info` |
| `--blue` | `#495B91` | **主群青** = `--primary` |
| `--blue-500` | `#5A6C9F` | 群青浅阶（描边、图示） |
| `--action` | `#E7D58D` | **麦黄** = 主动作底、商业化强调块 |
| `--action-600` | `#DCC671` | 麦黄 hover |
| `--action-700` | `#8A6F1B` | 浅底上的麦黄系文字（4.8:1 on white） |
| `--action-line` | `#D8C274` | 麦黄块的描边 |

### 面与线

| Token | Hex | 用在哪 |
|---|---|---|
| `--paper` | `#F5F4EF` | **纸白**：landing 区块底、纸标签、深底上的正文色 |
| `--paper-2` | `#EFECE2` | 纸白次层：landing 场景区底 |
| `--paper-line` | `#DED9C9` | 纸标签的纸边 |
| `--canvas` | `#F3F4F8` | 工作台画布底（偏冷，与白节点卡拉开层次） |
| `--canvas-2` | `#E9ECF3` | 画布底次层 |
| `--surface` | `#FFFFFF` | 节点卡、面板、对话框 |
| `--surface-2` | `#F1F3F7` | 输入框、次级块 |
| `--surface-3` | `#E5E9F1` | 进度槽、图片占位 |
| `--line` / `--line-2` / `--line-3` | `#E4E7EF` / `#D3D9E5` / `#B7C0D2` | 细分隔 / 卡边 / 画布点阵与强边 |
| `--canvas-mask` | `rgba(243,244,248,.72)` | 画布 MiniMap 遮罩（= `--canvas` 的半透明版） |
| `--img-chip` | `rgba(245,244,239,.92)` | 压在图片上的信息条 / 序号角标底，字一律 `--ink` |

### 墨（文字）

| Token | Hex | on `--paper` | 允许承载 |
|---|---|---|---|
| `--ink` | `#202C42` | 12.7:1 | 标题、正文、麦黄块上的文字 |
| `--ink-2` | `#55607A` | 5.7:1 | 次要正文、说明 —— **凡是落在浅色块上的文字都用它** |
| `--ink-3` | `#626D82` | 4.7:1 | 小字提示、编号、`.field-label` |
| `--ink-4` | `#97A0B2` | 2.9:1 | **只做装饰**：分隔线、禁用图标、空态图形 |

`--ink-3` 在各浅色底上的**实测值**（Codex 复测，取代本文件早前那组偏低的估算）：

| 底 | `--ink-3` 实测 | 结论 |
|---|---|---|
| `--paper` `#F5F4EF` | 4.7:1 | 过 |
| `--surface` `#FFFFFF` | 5.2:1 | 过 |
| `--surface-2` `#F1F3F7` | **4.69:1** | 过（早前记的 3.8 是错的） |
| `--canvas` `#F3F4F8` | 约 **4.7:1** | 过（早前记的 3.8 是错的） |
| `--surface-3` `#E5E9F1` | **4.28:1** | 差一点 → 用 `--ink-2` |
| `--primary-soft` `#E3E7F1` | **4.21:1** | 差一点 → 用 `--ink-2` |

现有代码里那几处已经改深成 `--ink-2` 的说明文字**保持不动**（余量更足，读起来也更稳）；
新代码遵循同一条：**落在 `--surface-3` / `--primary-soft` 上的文字用 `--ink-2`**。
组件注释里不再重复具体数字 —— 数字只在这张表里维护，避免两处漂移。

### 深群青底上的前景（`.on-blue` 区域）

| Token | Hex | on `--blue-700` |
|---|---|---|
| `--on-blue` | `#F5F4EF` | 8.0:1 |
| `--on-blue-2` | `#C6CDDF` | 5.5:1 |
| `--on-blue-ok` | `#A8DCC4` | 5.7:1 |
| `--on-blue-err` | `#F0A8B2` | 4.6:1 |
| `--on-blue-line` / `--on-blue-hover` / `--on-blue-fill` | `rgba(245,244,239,.18/.12/.10)` | 描边 / hover / 填充 |

### 状态色（同族低饱和；每个前景在白面与自己的 `*-soft` 底上都 ≥4.5:1）

| Token | Hex | soft 底 |
|---|---|---|
| `--ok` | `#24705A` | `--ok-soft` `#E1EFE9` |
| `--warn` | `#8A5F0E` | `--warn-soft` `#F7EED9` |
| `--err` | `#B03A4D` | `--err-soft` `#F8E4E7` |
| `--info` | `#3D5482` | `--info-soft` `#E7EBF4` |

### 节点端口（按数据流辨识，不靠形状）

| Token | Hex | 数据流 |
|---|---|---|
| `--port-image` | `#495B91` | 图片流（照片 / 参考图 / 候选图） |
| `--port-text` | `#A98A34` | 文本流（特征卡 / 风格 / 形象卡） |

## 3. 语义映射（谁用哪个）

| 语义 | Token | 出现在 |
|---|---|---|
| 主动作 | `--action` / `--on-action` | 进入工作台、创作我的 IP、运行、确认发布、去数字资产平台查看、重新加载、登录提交 |
| 次动作 | 纸白/墨描边 + 透明底 | 运行全部生成、取消、留在画布、逛逛灵感画廊 |
| 品牌 / 顶栏 | `--blue-700` / `--blue-800` | landing 头部与英雄区、工作台品牌栏、画布工作栏、footer |
| 选中 / 当前项 | `--primary` 边 + `--primary-soft` 底 + `--primary-700` 字 | 候选图定稿框、主形象、风格预设选中、特征卡锁定、连线 hover、节点 selected |
| 进行中 | `--primary` | 节点运行进度条、spinner、上传 dragOver |
| 焦点环 | `--primary`（深底上换 `--action`） | 全局 `:focus-visible` |
| 成功 / 提醒 / 失败 | `--ok` / `--warn` / `--err` | toast、发布成功块、示例角标、保存失败 |
| 示例产物 | `--warn` + `MockBadge` | mock 模式的占位图与样例数据（AGENTS.md §8.0） |

**共享组件对接**：`packages/landing` 的 `EnrollmentGate` / `IdCenterLoginScreen` /
`AuthCallbackScreen` 与 `api-client` 的登录壳都走 `var(--accent, var(--brand, var(--primary)))`
回退链。本 app 把 `--accent` 指向麦黄、`--accent-fg` 指向墨，因此这些页面的主按钮自动是
麦黄；调用处一律传 `accent: "var(--accent)"` / `accentFg: "var(--accent-fg)"`，**不要再传
`var(--primary)`**（那会让开通页的主按钮变蓝，跟别处的主动作对不上）。

## 4. 字体

| 族 | Token | 只给谁 |
|---|---|---|
| Manrope + 中文系统黑体 | `--font-sans` | 界面全部；**landing 的中文大标题也走 sans 800**（中文没有可靠的可变衬线，衬线大字会掉进宋体） |
| — | — | ⚠️ 这三个 token 是全系统唯一需要在 `tokens.css` 与 `app.css` 的 `@theme` **两处**并存的值，原因见文件开头 |
| Newsreader + 宋体 | `--font-serif`（`.asset-name`） | **只给**项目名、资产名、节点标题 |
| JetBrains Mono | `--font-mono`（`.reg` / `.field-label`） | **只给**编号（`DH-` / `LK-` / `REG`）、字段小标签、英文提示词、`IP STUDIO` 标识 |

**字号**

| 面 | 规格 |
|---|---|
| landing 主标题 | `clamp(64px, 6.5vw, 104px)`，行高 1.06，**三行**（`一个你，` / `不止一种` / `想象。`） |
| landing 区块标题 | `28–42px`；正文 `14.5–16px` 行高 `1.9` |
| **属性面板（右侧 Inspector）** | **可编辑输入 / 主按钮 / 属性说明 ≥ `14px`**；辅助字段标签（`.field-label`）`12px`；等宽提示词 `13px`；编号（`.reg`）`11px`。面板宽度保持 300px，长文**靠换行**解决，不许缩小字号 |
| 画布节点卡 | `10–12px`（节点靠画布缩放放大，不跟随面板下限） |
| 项目名 / 资产名 | `17px` 衬线 |

## 5. 间距 / 圆角 / 阴影 / 交互

- **间距**：landing 容器 **`max-w-[1440px]`** + `px-5 sm:px-8`；英雄区纵向收紧到
  `pt-8 pb-12`（lg `pt-10 pb-14`），其余区块 `py-14 sm:py-20`，栅格间隙 `20–24px`；
  场景 2×2 栅格另限 `max-w-[1040px]`（1:1 的图在 1440 容器里两列会被拉成巨幅）；
  工作台沿用 `2 / 2.5 / 3.5` 的紧凑刻度。
- **圆角**：`--r-xs 7` / `--r-sm 9` / `--r-md 12` / `--r-lg 15` / `--r-xl 19` / `--r-2xl 26`。
  纸卡与作品图用更小的 `6–10px`（相纸感），节点卡 `13px`，按钮 `8–12px`。
- **阴影**（一律墨蓝调 `rgba(32,44,66,…)`，禁止黑色）：
  `--shadow-hair`（发丝）/ `--shadow-card`（卡）/ `--shadow-lift`（浮起、主按钮）/
  `--shadow-paper`（landing 纸卡，投影更长）/ `--shadow-ring`（选中光环）。
- **交互**：主动作 hover 用 `brightness-95`（麦黄压暗比降透明度干净）；次动作 hover 用
  底色变化；禁用 `opacity-.55~.6`（麦黄底不许降到看不出是按钮）。
- **可访问性硬线**：
  - 正文对比度 ≥ **4.5:1**（上表每个文字色都标了实测值）；`--ink-4` 与 `--action` 本身不承载正文。
  - `:focus-visible` 全局 2px 实线 + 2px offset；`.on-blue` 区域内换麦黄环（群青上蓝环看不见）。
  - `prefers-reduced-motion: reduce` 下（`app.css` 末尾）动画/过渡降到 0.001ms、
    `scroll-behavior` 回 `auto`；**旋转是静态排版不是动效，不在此列**。
  - 图集裁切用 `div` + `background`，因此每格必须自带 `role="img"` + `aria-label`（见 §8）。
  - 锚点：`html { scroll-padding-top: 72px }` + 目标区 `scroll-mt-20`，避免标题被粘顶栏压住。

## 6. landing 与画布的应用边界

**同一套 token，两种密度。谁也不许借对方的手法。**

| | landing（`/`） | 工作台（`/projects`、`/projects/{id}`） |
|---|---|---|
| 底 | 群青深底（英雄 / 收尾） + 纸白区块 | **浅色工作面**：`--canvas` 画布 + 白卡 |
| 顶栏 | `--blue-700` 粘顶 | `--blue-800` 品牌栏 + `--blue-700` 画布工作栏（两条深群青连成一块 app chrome） |
| 主色出场 | 大面积群青 + 麦黄大标题 | 群青**只**在顶栏、选中态、进行中；麦黄**只**在主动作 |
| 排版手法 | 麦黄纸标签、错落重叠纸卡（`tilt-a…c`，三档、只给作品卡）、大字 | 规则栅格、等宽编号、无旋转 |
| 图 | 真实作品图集（§8） | 用户自己的照片与候选产物 |

**禁止**（review reject）：
1. 把 landing 的**拼贴 / 旋转 / 纸标签**用到工作台控件上 —— 工作台是重交互面，歪的卡片会
   干扰命中与对齐。
2. 把麦黄用作装饰底色或大面积背景（除 landing 的商业化展望横幅这一处强调块）。
3. 把群青用作主动作按钮底（那是选中/进行中的语言，会和「点这里」抢意思）。
4. 在 `app.css` 里重新写死 hex（`@theme` 必须是 `@theme inline` + `var()` 别名，字体除外）。
5. 只改 `tokens.css` 的一组根变量就宣称换肤完成 —— 组件里凡是写死过颜色的地方必须一并改。
   **画布组件里不留写死色值**：React Flow 的 `Background color` / `MiniMap nodeColor` /
   `maskColor` 都直接传 `var(--line-3)` / `var(--line-2)` / `var(--canvas-mask)`
   （SVG 的 `fill` / `stroke` 按 CSS 属性解析，`var()` 有效 —— 不要以「presentation attribute
   解析不了 var()」为由复制硬编码，那个说法是错的）。全仓仅 `app/layout.tsx` 的
   `viewport.themeColor` 必须是字面量（Next 的 metadata 不经 CSS）。

## 7. 画布必须一致且可读的清单

改画布配色时逐项过一遍（本版已全部落地）：

| 面 | 现状 |
|---|---|
| 工作栏 | `--blue-700` 底；返回/撤销/重做/项目名走 `--on-blue`；积分 chip `--on-blue-fill`；保存状态四态分别 `--on-blue-2`（编辑中/保存中）/`--on-blue-ok`（已自动保存）/`--on-blue-err`（没保存上，可点重试）；「运行全部生成」纸白描边；「发布」麦黄 |
| 节点面板 | 白底；节点条白卡细边；图标取端口色；底部模板说明 `--primary-tint` + `--primary-700` |
| 节点卡 | 白底 + `--line-2` 边；运行中边框转 `--primary`、失败转 `--err`；进度条 `--primary`；chip 五档（neutral / primary / ok / warn / err）都配 `*-soft` 底 |
| 端口与连线 | 端口按数据流取 `--port-image` / `--port-text`；连线 `--line-3`，selected / hover 转 `--primary`；节点 selected 加 `--shadow-ring` |
| 画布底 | `--canvas` + `#B7C0D2` 点阵（= `--line-3`）；MiniMap `#D3D9E5` 节点 + `rgba(243,244,248,.72)` 遮罩 |
| 属性输入 | `--surface-2` 底 + `--line-2` 边 + `--ink` 字；focus 边转 `--primary`；输入与主按钮 `h-10 / 14px`，标签 `.field-label` 12px |
| 图上信息条 | 序号角标、文件名条一律 `--img-chip` 底 + `--ink` 字（不再用裸 `rgba(255,255,255,…)`） |
| 选中 / 定稿 | 候选图 2px `--primary` 边 + 角标圆点；主形象 / 锁定 / 风格选中一律 `--primary-soft` 底 + `--primary` 边 + `--primary-700` 字 |
| 禁用 / 加载 / 错误 | 禁用 `opacity`；spinner `--primary`；错误块 `--err-soft` + `--err`；失败原因中文化（`node-meta.ts`） |
| 弹窗 / 提示 | `Dialog` / `AlertDialog`（`@ai-star-eco/ui`）走同一 token；toast 三档 `*-soft` 底；删除确认用 `--err` 底 + 白字（5.9:1） |

节点种类仍是 **7 种**，`doc` / `runs` 结构、运行 / 取消 / 保存 / 撤销 / 发布逻辑本次
**一行没动** —— 这是一次纯视觉换肤。

## 8. 素材与示例规则

**图集契约**：landing 全部人物 / 场景图来自**单张图集** —— **4 列 × 3 行、等格无间距、每格 1:1**。
代码不做任何图像处理，只用 `background-size: 400% 300%` +
`background-position: (列/3×100%) (行/2×100%)` 选格（实现见
`src/components/landing/atlas.tsx`）。

**存放位置（AGENTS.md §4.7）**：

| | 地址 | 说明 |
|---|---|---|
| **生产真源** | `https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/ipstudio/landing/character-atlas-v1.png` | 已上传 OSS，代码里的 `ATLAS_SRC` 直接引用这个绝对地址。**fresh clone 不需要任何本地图片就能完整跑起来** |
| 本地 `public/landing/` | 可选 | 只作开发回退副本与设计留档，**已 gitignore、不入库**，且**不会被自动使用** —— 没有实现任何自动 fallback。想在本地用那份，临时把 `ATLAS_SRC` 改成 `/landing/character-atlas.png` |

换图：按同样的 4×3 网格重新导出 → 发一份新版本号的 OSS 对象（`-v2` …）→ 改 `ATLAS_SRC` 一行。

**两种裁切**（都在 `atlas.tsx`，都保证「一格一图、不跨格」）：

- `AtlasFrame` —— 外框 1:1，整格原样铺满。表情格与场景格用它。
- `AtlasPortrait` —— **竖幅**。外框按 `ratio` 立起来并 `overflow:hidden`，里面那一格
  **仍然 1:1**、按外框高度铺满、水平居中；被裁掉的只有人物左右两侧空白，**头脚完整、
  比例不拉伸、不会露出邻格**。英雄区三张人物卡用它（主卡 `3/4.4`，两张侧卡 `3/4`）。
  ⚠️ 绝不能改成把 `background-size` 拉成竖幅 —— 那会把整张图集撑变形并露出相邻格。

格位（0 起，行优先）：

| # | 内容 | 用在哪 |
|---|---|---|
| 0 | 主造型（全身） | 英雄区**大竖主卡** · 标签「创作示例」「随性出场」 |
| 1 | 户外造型 | 英雄区右上小竖卡 · 标签「去野一下」 |
| 2 | 白西装造型 | 英雄区右下小竖卡 · 标签「自有风格」 |
| 3 / 4 / 5 / 6 | 微笑 / 大笑 / 惊讶 / 认真 | 灵感画廊四表情（大笑那格用麦黄托底） |
| 7 / 8 / 9 / 10 | 名片 / 短剧 / 带货 / 联名 | 未来应用方向 2×2 |
| 11 | 挥手 | **备用，当前未使用**（原「关于」段已删，见 §10） |

**英雄区拼贴布局**（`.hero-collage`，CSS 在 `app.css`）：移动端是「主卡满宽 + 两张侧卡并排」
的两列栅格；≥768px 改成**绝对定位的重叠拼贴** —— 主卡 `left:0 top:4% width:56%`、
侧卡 A `right:0 top:0 width:46%`、侧卡 B `right:2% top:50% width:36%`，容器用
`aspect-ratio: 1/1.06` 撑高度（纯 CSS，不量高）。**纸标签定位在各自那张卡的纸框上**，
不挂在栅格单元格上 —— 否则单元格被同排更高的元素拉长，标签会悬空在很远的下方（首版踩过）。

**红线**：
1. **禁止用 SVG / 色块 / 渐变冒充作品图**（AGENTS.md §8.0）。图不在位时应当露出
   `--surface-3` 灰底，而不是伪造一张「示意图」。
2. **禁止整页截图当网页** —— landing 是真实 HTML/CSS，图只在该出图的格子里。
3. **场景图是「未来应用方向」**，区块必须显式标注「以下为场景示意，相关能力将分阶段推出」，
   不得写成已支持的能力，也不得由此引申出照片上传流程之外的承诺（尤其视频 / 音频）。
4. **mock 产物必须打标**：`USE_MOCK=1` 的占位图与样例数据一律带 `MockBadge`（「示例」），
   不与真产物混淆。
5. **资产不入库**：图集走 OSS（上表），`public/landing/` 已在 `.gitignore` 里、只是可选的
   本地副本，**不要把图提交进仓库**。生成源已本地持久化，**不要重新生成、也不要用脚本二次改图**。

## 9. landing 区块清单（改结构前先看这张表）

| 区块 | 锚 | 底 | 内容 |
|---|---|---|---|
| 顶栏 | — | `--blue-700` 粘顶 | `IP STUDIO`（麦黄）+ 分隔 + `AI IP 工作台`；右侧 灵感画廊 / 关于 IP Studio / **进入工作台**（麦黄） |
| 英雄区 | — | `--blue-700` | 麦黄纸标签 kicker + **三行麦黄大标题** + 两行描述 + 麦黄 CTA + 「逛逛灵感画廊 ↓」；右侧三张竖幅纸卡拼贴 |
| 灵感画廊 | `#gallery` | `--paper` | 左标题「今天，想做哪一种你？」+ 右四表情 |
| 未来应用方向 | `#scenes` | `--paper-2` | 麦黄纸标签「未来应用方向」+ 居中标题与「场景示意」免责句 + 2×2 场景卡 |
| 商业化展望 | `#about` | `--action` 麦黄块 | 纸白纸标签「商业化展望」+「从被记住，到被选择。」+ 一句描述 |
| 收尾 CTA | — | `--blue-800` | 麦黄「创作我的 IP ↗」 |
| footer | — | `--blue-900` | `IP STUDIO · AI IP 工作台` |

顶栏「关于 IP Studio」锚到**商业化展望块**（`#about`）—— 这是刻意的：landing 上**不放**
产品工作流说明段。

## 10. 文案纪律（AGENTS.md §8 的本 app 落点）

- **landing 上不讲工作流、不讲照片上传、不讲模型**。评审已明确删掉过一版「四步链路 +
  『难的从来不是生成一张好图』+『模型不自由发挥』」的技术说明段，**不要再加回来**，也不要
  以「介绍产品」为名新写同类内容。工作流说明属于 `PRODUCT.md` 与工作台内的提示，不属于 landing。
  同一条也约束 `app/layout.tsx` 的 `metadata.description`（对外描述与 slogan 同口吻）。
- landing 的 slogan / kicker / CTA / 标签 / 场景四条与商业化两句是**逐字审定过的定稿**，
  改动需重新走产品确认，不要顺手润色。
- 全中文；不把 `runId` / `stage` / 错误码原文当主可视文案，翻译表在 `src/lib/node-meta.ts`，
  原始码只进 `title`。
- 所有可变长文字（项目名、造型字段、风格描述、文件名、场景标题）一律
  `min-w-0` + `truncate` / `line-clamp`，完整内容进 `title`。**例外**：属性面板里的说明文字
  不许再用 `line-clamp` 压行（评审：靠换行而不是缩小字号/截断）。
