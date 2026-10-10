# IP Studio · 声量引擎旗下 · 桌面界面与作用域

本应用已合并原 AI IP 工作台。当前首页和 IP 管理按用户提供的两张设计图重构，主视觉真源为 [DESIGN.md](DESIGN.md)，实现为 `src/styles/ip-brand.css`；画布内部继续使用 `src/styles/ip-desktop.css` 的群青与麦黄。本文件说明各页面如何应用这些系统，不把首页组成推广为全应用规则。

## 页面与代码真源

| 界面 | 当前路由 | 实现 | 视觉作用域 |
|---|---|---|---|
| 公开首页 | `/` | `src/components/landing/ip-home.tsx`，`ip-landing.tsx` 仅转出同一组件 | `.ip-brand-surface` |
| 登录后桌面首页 | `/dashboard` | `src/app/dashboard/page.tsx` → `IpHome` | `.ip-brand-surface` |
| 登录后移动首页 | `/dashboard` | 同一路由 → `HubHome` | 原移动 H5，见 `DESIGN-mobile.md` |
| IP 管理 | `/ips` | `src/ip/ip-management.tsx`、`ip-management-data.ts` | `.ip-brand-surface`；编辑 Modal 为 `.ip-management-editor` |
| 共享桌面顶栏 | 应用页；公开首页自带一份 | `src/shell/desktop-top-bar.tsx` | `.ip-brand-surface` |
| 创作与个人画布列表 | `/create`；`/projects` 重定向到此 | `src/ip/studio-create-home.tsx`、`studio-gallery.tsx` | `.ip-brand-surface` |
| 模板市场 | `/templates` | `src/ip/studio-template-market.tsx`、`studio-gallery.tsx` | `.ip-brand-surface` |
| 个人画布与模板预览 | `/projects/{id}` 及模板预览路由 | `src/ip/`、`src/canvas-bridge/`、`src/canvas/` | 共享浅色 `.ip-brand-surface`，旧组件由局部令牌适配 |
| 账号与旧 Studio 工具 | `/me`、`/studio` | `src/shell/account-*`、`src/styles/account-workspace.css` | 共享浅色 `.ip-brand-surface`，旧组件由局部令牌适配 |

原 `apps/web-ipstudio` 已删除；不再引用它的 `tokens.css`、`app.css` 或旧三行麦黄 landing。画布 vendor 留在 `src/canvas/`，业务胶水留在 `src/canvas-bridge/`；这次设计不重写它们。

## 形态、导航与布局

形态真值为 `html[data-layout]`，由 `src/shell/layout-mode.ts` 统一控制：用户显式选择优先，未选择时按 `matchMedia(min-width: 960px)`。桌面样式接属性；现有 1250px 媒体查询只调整真实空间约束。不要用另一个断点改变用户选定的桌面/手机形态。

桌面共享顶栏为白色，固定在顶部 12px、左右 12px，内部高 60px、圆角 13px；内容让位高度为 `--desktop-bar-h: 84px`。品牌为「IP Studio · 声量引擎旗下」，使用原数字人多面体侧脸 icon 的低饱和蓝灰配色版本（`public/brand/ip-studio-logo.png`）；主名称与归属标识分级，窄桌面两行排列。主导航依次为「首页 / 创作 / IP 管理 / 模板管理 / 素材库」。创作落在 `/create`，模板管理落在 `/templates` 模板市场；原官方内容管理仍为 `/projects/demos`。

创作页与模板市场的组成、行为和验证范围分别见 [.impeccable/ip-create.md](.impeccable/ip-create.md) 与 [.impeccable/ip-template-market.md](.impeccable/ip-template-market.md)。

搜索图标打开 `/ips?focus=search`。登录后右侧保留真实 `WalletBadge` 的余额、读取和失败重试；圆形账号入口显示当前账号名称首字，菜单保留「我的账号 / 授权管理 / 名片 / 发现 / 切换到手机版 / 退出登录」。菜单在选中入口、切页（含旧 Studio 的 hash）、点击外部或按 Esc 时关闭；Esc 将焦点送回头像。设备切换位于账号菜单，不再描述成独立手机图标；没有伪通知入口。未登录时显示「登录 / 注册」。公开名片、共享会话、登录与回调页继续使用原外壳边界。

## 首页：人物、入口与真实近期画布

公开 `/` 与登录后的桌面 `/dashboard` 使用同一个 `IpHome` 组成。主图铺满英雄区，人物留在右侧，左侧为两行中文衬线标题「让灵感成形 / 让 IP 出圈」、说明与深墨「开始创作」按钮。英雄区最小高度 610px，左侧内容宽 60%，标题沿用 `DESIGN.md` 的 display 规格；主 CTA 最小高 60px、最小宽 235px。

英雄区之后为四张创作方向图卡：「数字人形象 / AI 图片创作 / AI 视频生成 / 短剧创作」。更下方为三张灵感示意卡：「角色的日常 / 角色 × 世界观 / 从形象到短剧」。图区有文字说明和清楚的入口，不使用整张截图充当网页。

登录后增加「继续创作」：调用真实个人画布接口，按更新时间排序，最多展示三张；有加载、失败重试与首次创作空态。没有虚构客户数据、用户照片、销量或作品数。公共主图与场景图均是创作示意，不是用户实际生成的 IP 产物。

所有创作入口先免费打开个人画布，具体生成在节点内确认模型、参考与积分；匿名入口先去登录。首页的近期画布读取失败与创建失败分别呈现，创建中锁定重复提交。根路由原有旧 hash 与 `real-auth` 回调转发保留，不得因更换 landing 移除授权恢复路径。

详细设计意图见 [.impeccable/ip-home.md](.impeccable/ip-home.md)。

## IP 管理：现有人物资产的相邻档案

`/ips` 管理现有个人 Avatar、形象版本与声音，不新增业务 IP 容器模型。人物按既有 API 汇总；官方形象不混入个人统计。「创建 IP」链接到 `/create` 创作入口。

导航统一使用共享顶栏，不重复设置左侧导航。默认主列表铺满内容区；选中后以 12px 间隔增加右侧 `clamp(360px,36vw,560px)` 档案列，列表保留原位。主内容白面内边距 25px。详情固定在顶栏下方，正文独立纵向滚动，底部操作不随正文消失。这个相邻档案只用于 IP 管理，不能变成覆盖画布的通用抽屉。

顶部统计为真实「IP 总数 / 进行中 / 形象素材 / 已绑定声音」；接口尚未确定或局部失败时对应统计为「—」。搜索覆盖人物名、简介、设定与标签；状态包含全部、进行中、已定稿、草稿、已归档。标签、最近更新/名称/素材数量排序、网格/列表切换与刷新均作用于相同列表。筛选无结果可以清除，空人物库给出创作入口，素材与声音失败可分别重试。

人物卡片使用主形象、中文衬线姓名、简介、标签与现有 API 的素材/视频/版本数量；`finalized` 对应「已定稿」，不对应发布、审核或授权。缺少图片直接说明「尚未设置主形象」。选中状态为深墨描边，同时打开同一人物档案。

详情分「概览 / 角色设定 / 形象视图 / 内容资产」四个 tab，支持方向键、Home、End 切换；当前实现默认打开「形象视图」。角色视图、表情、设定图、造型细节和历史主形象都来自真实归档版本；空分类显示未归档，不补造表情或作品。「内容资产」展示已有素材版本，并可跳到完整数字资产页。人物声音展示已绑定版本与真实试听；尚无声音时说明在画布配音后保存为人物声音。

可编辑姓名、简介与核心设定、年龄、气质、用途、性格、服饰。保存更新同一个 Avatar，列表、详情和字段即时联动；失败保留输入草稿。具体素材类别沿用现有分类 API，不另建分类真值。导出为该人物设定与素材版本的 Markdown。

「生成形象」先免费创建画布，并把当前选中的 `storageKey / avatarId / version / lookId` 写入参考节点；历史版本不会被静默替换成最新主形象。引用保存失败时保留已创建的 pending project，重试复用它，并提供打开该画布继续的入口；不再创建一份重复项目。模型调用与收费在进入画布后由节点确认。

详细设计意图见 [.impeccable/ip-management.md](.impeccable/ip-management.md)。

## 画布内部：继续使用群青与麦黄

`src/styles/ip-desktop.css` 将令牌限定在 `.ip-surface`，Tailwind 只引入 theme 与 utilities，没有全局 preflight。与旧移动 H5 共名的令牌不能移到 `:root`。共享浅色顶栏在其自身作用域覆盖外观，不改变画布工具栏和节点的内部语言。

个人画布 `/projects/{id}` 使用完整浏览器视口（`100dvh`），不叠加网站顶栏或为其扣除高度；路由切换在绘制前清除 `body.has-desktop-bar` 的让位。原生画布栏保留返回 `/create`、名称与操作，桌面积分沿用 `WalletBadge` 的余额、加载与失败重试，样式限定在画布栏内。模板预览仍使用现有全视口只读弹窗；`/projects/demos`（含末尾斜杠）保留网站导航。形态继续读 `html[data-layout]`，不新增设备判定。

| 用途 | 画布现有令牌 | 规则 |
|---|---|---|
| 品牌、选中、进行中 | `--primary: #495b91`，深群青 `--blue-700: #344b70` | 工作栏、选中描边、连线与任务进度 |
| 主操作 | `--action: #e7d58d`，文字 `--on-action: #202c42` | 运行、明确采用、发布或提交 |
| 工作面 | `--canvas: #f3f4f8`、`--surface: #ffffff` | 浅画布与白节点分层 |
| 正文 | `--ink: #202c42`、`--ink-2: #55607a` | 正文与辅助说明 |
| 次要小字 | `--ink-3: #626d82` | 只在足够浅的底使用；`--surface-3`、`--primary-soft` 上改用 `--ink-2` |
| 装饰与禁用 | `--ink-4: #97a0b2` | 不承载正文 |
| 端口 | `--port-image: #495b91`、`--port-text: #a98a34` | 区分图片流与文字流 |

画布以规则栅格、稳定工具栏、可读输入与轻边线组织交互；人物和节点内容不能套首页图卡的局部遮罩与营销排版。颜色由作用域变量读取，React Flow 的底图、MiniMap 与连线继续使用对应变量。

画布正文和操作用 `--ip-font-sans`，资产名用 `--ip-font-serif`，编号和字段标签用 `--ip-font-mono`。内部输入、提示与按钮维持各自现有可读规格，不用缩小字号解决长文；长文换行或滚动。颜色、选中、失败、运行与保存反馈同时有文字，深群青面上的焦点保持可见。这里不把旧文档的节点数量或旧 Inspector 尺寸当作新工作台的不变业务契约。

## 模板：只读预览，再显式存副本

模板点击先打开只读画布。浏览、缩放和查看节点提示词不创建个人项目，也不挂载项目同步与生成工作台；不能拖动、增删、改写节点或连线。只点击「存为个人副本」才免费创建普通可编辑画布，保存中禁用重复操作，失败保留预览并允许重试。

首页模板入口、画布列表与画布内模板库沿用同一路径；个人发布模板按不可变来源预览。个人副本在普通节点内替换输入、编辑和确认费用，原模板保持不变，旧锁定实例继续兼容。不得恢复「点击模板就创建项目」或另加套用报价表单。

## 账号工具：保留现有工作面

`/me` 与旧 Studio 账号工具的桌面内容统一使用 `.ip-brand-surface`：总宽最多 1600px、左右留白 32px、导航 192px、列间距 24px，暖灰背景、白色内容面、深墨主动作与浅灰选中态。旧组件通过页面内的兼容令牌继承同一配色与字体，画布和移动旧流程保留原作用域。旧 SPA 内容定位于独立的层叠上下文内，避免内部 `m-overlay` 的层级遮住共享顶栏的账号菜单；桌面不恢复 480px 手机取景框。

## 素材库

桌面 `/assets` 沿用真实画布素材、人物、声音和资产统计接口，外观统一到浅色产品系统：暖灰页面、中文衬线标题、深墨创建按钮、白色内容面及轻边线。加载、错误、空库、下载和试听沿用既有组件；底部的资产分类只展示统计，查看画布素材跳到本页对应区块，不再跳回同一个资产库入口。手机端继续使用原 H5 导航与布局。

## 图片与字体

首页实际图片真源为 OSS：

- `media/ipstudio/landing/ip-canvas-hero-v3.png`：暖色摄影风格人物主图及人物示意裁切，保留自然皮肤、五官和发丝细节；右侧人物、左侧低对比留白，不使用插画或塑料皮肤质感。
- `media/ipstudio/landing/ip-canvas-scenes-v2.png`：2×2 场景图集，CSS `background-size: 200% 200%` 按格定位；一格一图，人物与场景都不拉伸。

旧 `character-atlas-v1.png` 与原三张重叠人物纸卡不再是新首页规范。新图片来自用户设计方向的创作示意，带相应 alt/aria-label 或区块说明；IP 管理只展示本人真实素材，并使用既有签名图片/音频组件处理短期地址。

新增展示字体为 Noto Serif SC 官方可变 Unicode 分片（101 个 WOFF2、200–900）。字体对象、OFL 与清单位于 OSS `media/ipstudio/fonts/noto-serif-sc-v36/`；`src/styles/ip-display-font.css` 通过固定同源 `src/app/ip-fonts/noto-serif-sc/[file]/route.ts` 读取，保留 immutable 缓存与 basename 校验。字体失败及官方 Web 范围以外字符回退系统衬线，原有四种字体加载未重做。

## 本轮验证范围

首页与 IP 管理已完成桌面截图及源代码/交互验证。最终首页截图来自隔离生产构建的匿名访问；人物列表与详情截图来自带明确演示说明的隔离数据环境。聚焦测试 29 项、应用 typecheck、API 契约检查与隔离生产构建通过；API 契约仍报告原有 handler 警告。新增字体同源路由已验证有效 WOFF2 响应、缓存与无效 basename 的 404。

未调用产品内付费生成，未部署或提交；不宣称手机、1280px、严密像素测量或全设备验收完成。首页主图按后续要求换为摄影风格 v3，隔离生产构建通过，页面截图为 `.impeccable/review/ip-home-photo-final.jpg`。独立最终审查为 ship，具体证据与最终截图索引见仓库 `.impeccable/review/ip-brand-direction.md`、`ip-brand-review-final.md`。
