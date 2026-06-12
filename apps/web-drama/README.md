# AI 短剧 · Drama Studio

面向 MCN 的演员类 AI 数字人 IP + 短剧工作台。Next 16.2.6 + React 19 + Tailwind v4 + pnpm workspace。

## 启动

```bash
# 在仓库根目录
pnpm install
pnpm dev:drama       # http://localhost:3011
pnpm --filter @ai-star-eco/web-drama typecheck
pnpm --filter @ai-star-eco/web-drama build
```

USE_MOCK 默认开启（无需 `.env.local`）。所有读写都走 `src/api/*.ts` 内存可变缓存，关掉浏览器后重置。

## 路由结构

不带 `/console` 前缀，公开页与工作区共存：

```
/                    ← 公开 landing
/login               ← 公开
/dashboard           ← 首页 · AI 开拍（v0.63:对话框双类型 + 热点 + 创意推荐 + 继续上次）
/projects            ← 短剧工坊（多集连续短剧资产库 + 继续上次 + 套模板/从零开剧）
/projects/new        ← 新建短剧两步流（选类型 → 选模式 + 立项起点）
/projects/[id]       ← 短剧工作台（沉浸态 v4:项目设置走左阶段轨;剧集制作走
                       左分集导航 + 顶部步骤页签【剧集脚本 → 视频工厂 → 成片配方】+
                       右侧角色面板,默认收起）
/projects/[id]/distribute ← 多平台发布（旧）
/shorts              ← 短视频工坊（v0.63:短视频 + 单集宣传片/自传资产库 + 从短剧切片）
/shorts/make         ← 短视频制作（v0.63:左 AI 对话 + 右口播脚本表 → 视频工厂出片）
/templates           ← 模板库（v0.63:多集/单集筛选 + 统一预览 + 运营新建模板）
/review              ← 剧本审阅（v0.63:跨项目待审队列 + Excel 式平铺表格）
/assets              ← 素材库（v0.63:标签化图片/视频 增删改查 + AI 自动打标）
/cast                ← 演员 IP 阵容（跨项目 IP 资产，带主线 banner）
/cast/[id]           ← 演员详情
/cast/[id]/generate  ← 形象生成
/incubator           ← (v0.60 下线 · 提示页)
/forge               ← (v0.60 下线 · 提示页)
/wardrobe            ← 戏服 / 道具
/scripts             ← 脚本工坊（跨项目脚本归档，带主线 banner）
/scripts/[id]        ← 脚本编辑器
/short-drama         ← (废止 · redirect → /projects)
/distribution        ← 分发总览
/insights            ← 数据洞察（窗口 + 维度切换，URL 持久化）
/trends              ← 趋势雷达
/finance             ← 财务中心（充值 / 提现 / 流水）
/settings            ← 工作室设置（账户 + 团队）
```

`/console`、`/console/*` 通过 `src/proxy.ts` 308 重定向到新路径，下一版本删除。

## 共享组件

- `src/components/common/` — `Dialog` / `ConfirmDialog` / `FormDialog` / `Field` / `EmptyState` / `LoadingBlock` / `ErrorBlock` / `StatusBadge` / `ViewHeader` / `SectionHeader`
- `src/components/premium/` — `Button` / `Card` / `Chip` / `KpiCard` / `Meter`（Premium cinematic 主题）
- `src/lib/drama-query.ts` — 极轻量 client cache（`useAsync` / `usePageData` / `invalidate` / `mutate` / `clearAll`），避免引 React Query。
- 全局 Sonner toast 挂在 `app/providers.tsx`。

## Mock 数据写入层

- `api/artists.ts` / `api/film.ts` / `api/scripts.ts` / `api/distribution.ts` / `api/finance.ts` 顶部建立 mutable 副本。
- CRUD（create / patch / archive / delete / commitVersion / publishJob 等）会直接改 cache，前端列表立即反映。
- 发布任务 `createPublishJob` 启动 `setTimeout` 轮询推进，UI 自动从 queued → uploading → live。
- 真后端尚未上线，USE_MOCK=0 分支会保留 `apiFetch` 占位（507/501 后端原因）。

## 版本日志

### v0.63 · 2026-06-12 · 短剧工坊 v4:剧本分镜合并 + 双路径视频工厂 + 短视频工坊

按设计稿「短剧工坊 v4.html」(Claude Design 交付包,配色锁定 `#f97316·#e11d48`)整体重构,
已有功能重构为 v4 逻辑样式,缺失功能补齐。纯前端(mock 数据扩展),无 API / openapi 变更。

**全局导航(信息架构重整为 5 组)**:创作(首页 / 短剧工坊 / 短视频工坊)/ 提效(模板库 /
剧本审阅·带待审角标)/ 素材(素材库 / 演员 / 戏服 / 脚本)/ 分发与洞察 / 账户;sidebar 底部
新增「运营身份」开关(`lib/use-operator.ts`,localStorage + 事件同步)。

**首页 `/dashboard` 重写为 AI 对话式**(替代 KPI 总览):短视频(默认)/ 短剧 分段切换、
近期热点 chips、今日灵感、封面式创意推荐(3/4 紧凑竖版,点卡统一 `PreviewModal` 预览)、
继续上次;背景三层渐变光晕缓慢漂移(`prefers-reduced-motion` 自动静止)。

**短剧工作台 v4**(`/projects/[id]`):
- 阶段重组:`script + board` 合并为 **epscript 剧集脚本**;新增 **factory 视频工厂**;
  `stages-config.ts` StageKey 变更为 `topic/outline/cast/epscript/factory/prompt`。
- 左轨双形态:项目设置阶段 = `StageRail`(三项 + 单一「剧集工作台」入口);剧集制作阶段 =
  `EpisodeRail` 分集导航(≤1180px 自动收窄 72px 图标轨),顶部 `StepTabs` 步骤页签
  (① 剧集脚本 › ② 视频工厂 › ③ 成片配方,下一步带提示);EpisodeStrip 顶部缩略条删除。
- **大纲分集 v4**:操作条置顶高亮(渐变描边 + 光晕),AI 参数内联 —— 设计范围(先开头
  6 集 · 6 分 / 完整铺 · 18 分)+ 每集时长(60/75/90s);试水模式生成后有「补 12 分铺完」衔接卡。
- **剧集脚本(合并视图)**:顶部生成方式(套爆款模板·推荐 / 衍生上一集 / AI 自由起草)+
  场景卡片(默认,卡内下半场承接「本场分镜」MiniShot 纯文字 + 可展开视频提示词 + 一键拆镜)/
  脚本表格(平铺:时间自动累计 / 场景 / 视频脚本 / 语音 / 字幕勾选 / 参考)双视图;
  视频脚本内嵌 `[参考N]` 引用渲染成素材缩略 chip(`script-refs.tsx`:RichScript / RefCell /
  RefPickerModal / SubToggle);右下悬浮 CTA「通过整集 · 进视频工厂」。
- **视频工厂(新阶段)**:每镜双路径 —— 先渲首帧(2 分,稳妥省抽卡)/ 直出视频(9 分,快);
  流水 draft → 选首帧(4 选 1)→ 锁定 → 渲动态 → 验收入片;批量「全部待渲先出首帧」;
  单镜抽屉(slide-in-r,步骤指示 + 大预览 + 出镜角色 + 分步动作);
  `GenSettingsBar` 生成设置(模型 4 选 / 画幅比 7 选 / 分辨率 480p-1080p / 时长·数量滑块 +
  @素材参考面板,打通素材库)。
- 角色面板默认收起(宽度留给剧本正文);项目顶栏窄口隐藏 meta + 标题省略号。

**短视频工坊(新)**:`/shorts` 资产库(我的短视频 + 单集宣传片/自传归此,与短剧工坊同构;
从短剧切片推广弹窗:选剧选集 → AI 扫高光 → 剪竖屏推广片);`/shorts/make` 单屏制作
(左 AI 对话驱动脚本重写 + 右口播脚本表【视频脚本/语音/字幕/参考】→ 视频工厂双路径
逐镜出片 → 合成成片)。

**模板库(新)**:`/templates` 多集短剧 / 单集短视频形态筛选 + 类型筛选 + 搜索;卡片
视频封面 + 一句话描述 + 统一预览(估时大纲);运营身份可「新建模板」入库与爆款链接拆解。
模板数据补 4 个单集模板(t8 企业品牌片 / t9 公益短片 / t10 个人自传 / t11 口播带货)。

**剧本审阅(新)**:`/review` 跨项目待审队列 → Excel 式平铺表格(场/场景/动作/角色/对白/
情绪/审阅/意见,场景信息纵向合并,逐场 通过/改一下 + 一句话意见,其余分集同表平铺),
有待改「发给 AI 重写 N 场」,否则「通过整集」。

**素材库(新)**:`/assets` 统一图片/视频素材,标签区分人物/场景/道具/其他;上传(AI 自动
分析标签)/ 详情(改名改标签 + 关联使用 + 两步删除)/ 搜索筛选;与视频工厂 @ 参考、
脚本 [参考N] 同一数据源(`mocks/drama-workshop/materials.ts`)。

**统一预览组件**:`preview-modal.tsx`(TplPreviewBody + PreviewModal)—— 创意推荐 /
模板库 / 快速开剧右栏三处共用;`quick-create-modal.tsx` 快速开剧弹窗(左挑模板右看
估时大纲)。`video-cover.tsx` 视频封面占位(渐变 + 播放钮)。

**mock 扩展**(`mocks/drama-workshop/`):`materials.ts / shorts.ts / home-ideas.ts /
template-meta.ts / review.ts`;`ProjectCard` 竖屏封面裁 3/4 紧凑版。

**自检**:`pnpm --filter @ai-star-eco/web-drama typecheck` 与 `build` 全绿(28 路由);
无浏览器原生弹窗;UI 全中文、无工程术语(Prompt 包 → 成片配方 / 目标引擎 → 出镜方式)。

- **2026-06-11 · 中文字体回退链**：`-apple-system` → 苹方 → HarmonyOS Sans SC → MiSans → 雅黑 → Noto Sans SC，修复国产 Android ROM（鸿蒙 / 小米等）中文字体断档。

### v0.60 · 2026-06-10 · 数字人收敛：演员形象统一引用 AiAvatar {#v060}

- cast「新增演员」改为 **从 AiAvatar 引入数字人**（两步 picker：选数字人 → 选首要展示图）；
  卡片 / 详情 hero 有展示图时用图（否则保留品质渐变）；详情可「更换展示图」
- 引用不复制：`Artist.dapDisplayImageUrl` 由 server 实时派生签名 URL，AiAvatar 重渲染自动跟随
- sidebar 下线「孵化新演员」「形象锻造炉」；/incubator /forge 保留路由 → RetiredFeatureNotice 提示页
- 新增 `api/dap-avatars.ts` + `mocks/_handlers/dap-avatars.ts`（网络层拦截）+
  import-avatar mock handler；`.env.example` 增 `NEXT_PUBLIC_AIAVATAR_URL`
- **v0.60 补丁（2026-06-10）**：重复引入防护（同数字人同类型 409 `DAP_AVATAR_ALREADY_IMPORTED`，
  picker「已引入」置灰）；展示图候选补全 **形象变体 / 三机位**；修复引入演员无 bio 时
  `deriveRole` 崩溃（bio 空兜底）；mock 层 import/patch 同步派生 `dapDisplayImageUrl`

### v0.44 · 2026-06-01 · 短剧工坊视觉与业务流整体重构（B1-B8.5）

按 Figma Make 原型（短剧工坊·桌面 + 移动端）逐项落地。**全站视觉令牌切到暖白橙红，业务主线从"短剧生成单页"重构为"6 阶段工作台流水线"。** 8 批渐进完成，每批 playwright 截图验收。

**视觉层（B1+B1.5+B2）**：
- `tokens.css` 完全重写：暖白底 `#fafaf9` / 橙红双点缀 `#f97316·#e11d48` / oklch 浅底 / 三级文字灰 / 圆角 22·16·11·8 / 柔和多层阴影。旧名（`--bg-0/--fg-0/--accent-strong/--gradient-gold`）作为别名指向新值，老页面立刻换肤不破裂。字体切到 Noto Sans SC（正文）+ Quicksand（数字）。`.eyebrow` 去 uppercase + Mono → 中文友好常规体。
- `app.css` 追加设计真源全部通用类：`.btn / .chip / .tag / .card / .thumb / .overlay / .cost / .balance-pulse / .scroll / .skel / .fade-up / .pop-in / .slide-in-r / .phone-bezel` + 工具类。
- `components/drama-ui/` 10 个原语：`Thumb / Avatar(数字人色卡) / Cost / useGen + GenSkeleton + GenError(追查号·不静默兜底) / AICollab(核心协作壳) + RewriteTagPill【保留/修改/颠覆/新增】/ ChipGroup / EngineTag(UI 文案"数字人出镜/特效镜·待开通",engine 字段不进 UI) / Editable / DramaConfirmDialog + dramaConfirm() Host(替代浏览器原生 confirm)`。
- 工作台 shell 暗色残余清扫：顶栏 `rgba(10,8,16,0.6)` → 亮白 + accent 渐变按钮；sidebar logo 金色 → 橙红 + 中文 "短剧工坊 / 从灵感到成片配方"；删 "CINEMATIC · v0.6" 徽标。

**业务层（B3-B7）**：
- **我的短剧首页**（替换 `/projects`）：项目卡格栅 + 9:16/16:10 渐变缩略 + 类型/AI 引导/套用模板 chip + 进度条 + dashed 新建卡 + 运营开关。6 个项目按项目隔离样例（`mocks/drama-workshop/projects.ts`）。
- **新建短剧两步流**（`/projects/new`）：① 9 个内容类型卡 + 搜索；② 仪式感双选 ModeCard（AI 引导式 + 爆款模板式）。AI 引导式三步（理解想法 → 五维挖掘卡【内容叙事/视觉风格/镜头语言/动作与节奏/声音设计】→ 选题方向卡）。模板式预填 + "已填"标记。
- **工作台沉浸态**（`/projects/[id]`，跳过通用 sidebar/topbar，自有 shell）：
  - 左 248px **StageRail**：6 阶段（项目级 1-3 跨集共享 / 剧集级 4-6 针对当前集），软锁可跳。
  - 顶部 **ProjectTopbar**：← + 项目封面 + 标题 + 类型 chip + 集数·时长·画幅 + 一键连跑 + 余额（balance-pulse）+ 退出。
  - ④⑤⑥ 顶部 **EpisodeStrip**：全 N 集卡片 + 已锁/当前/wip/todo 四态着色 + 可折叠。
  - 右 296px **CastPanel** 常驻：关键角色锁形象 + 龙套·文字外观，可折叠为 60px 头像列。
- **6 阶段视图**：
  - **选题立项 TopicStage**：已选方向 + logline + 主线 chip 走 + 黄金 3 秒/节奏/受众 Meta。
  - **大纲分集 OutlineStage**：主线 + AICollab 分集梗概（拖拽 + 重写 + 模板预填态左 3px 玫红描边 + "模板已填" chip）。
  - **角色与资产 CastStage**：CharCard（关键角色 16:9 大封面 + 已绑 sparkle 徽标 + 参考图×N / 未绑 dashed + 绑定按钮 + 3 张参考图槽）+ AvatarPicker（沉浸大图 300px + 4×N 库 grid）+ ScenePicker（6 场景库 3 列）。
  - **单集剧本 ScriptStage**：撤销重做 60 步（⌘Z / ⇧⌘Z）+ SceneBlock（场号 chip + 时空标题/情绪 Editable + 重写本场/删本场 + 动作描述 + 台词行：角色头像 + Editable who/emotion/text）。
  - **分镜工作台 BoardStage**（最复杂）：TimelineBar（按时长比例分段 + 已完成渐变实色 + 超限 ! 标记）+ 场景页签 + LayoutToggle 三选一（flow / **timeline 默认** / grid）+ AICollab 包 ShotList + 撤销重做 + 增删移拖 + 空场景 AI 拆镜。**ShotDetail 384px slide-in-r 精修侧栏**：参考帧 + 出镜方式 toggle + 时长 ± + 画面描述 + 景别 9 + 运镜 9 chip 速查 + 出场角色多选 + 台词配音 + 氛围关键词 4 组多选 + EngineLimits 内联校验。
  - **成片配方 PromptStage**（终点高光）：hero "成片配方已就绪" + 导出整集（DramaConfirmDialog 平台自有弹窗 + 扣 32 积分 + 追查号）+ 逐镜 PromptCard 四段式【风格 / 时间轴 / 声音 / 参考】**@图片N → 真实数字人头像缩略图**让一致性可视化。

**收尾与主线整合（B8+B8.5）**：
- **一键连跑 RunAllDialog**：两阶段（confirm 剩余阶段单价表 + 总价 → running 逐阶段动画完成）+ runAllComplete action（锁定除 prompt 外所有阶段 + 跳 prompt + 扣总积分）。
- 删 `/short-drama/page.tsx` → redirect("/projects")（旧单页能力已并入 6 阶段）。
- `scripts/[id]/page.tsx` `window.confirm` → `dramaConfirm({ tone:"danger", ... })`（AGENTS.md §8 护栏：禁用原生 confirm/alert/prompt）。
- sidebar IA 重整为 4 组：**短剧工坊**（我的短剧 + 总览，主战场）/ **创作素材**（演员/孵化/形象/戏服/脚本，跨项目素材）/ **分发与洞察** / **账户**。
- dashboard hero 重写：去 "今天的 片场" italic 装饰，改 "今天的工作台"；顶部新增引导卡 + "进入短剧工坊"橙红 CTA。
- /scripts 与 /cast 顶部加引导 banner，明确"跨项目素材"vs"项目内单集剧本/角色"的职能分工，CTA "去做短剧 →"。
- 文案护栏全程：UI 不出 "视频大模型 / 渲染 / 引擎 / Token / ⌘K / CINEMATIC" 等工程词；`engine` `avatar/seedance` 字段仅内部用。

**自检**：`pnpm typecheck` 全绿；playwright 7 批 30+ 张截图覆盖（含移动端 390px 单列）；`grep 'confirm\|alert\|prompt'` 仅注释命中（无原生调用）；sidebar / topbar 全暖白橙红一致。

### 2026-05-31 · 移动端浏览适配（响应式）

把 web-drama 从「桌面固定 240px 侧栏」改造为可在手机 / 平板浏览的响应式布局。**纯前端，无 API / 数据模型变更；`tsc --noEmit` 绿。**

- ✅ **工作台 shell 响应式**（`(workspace)/layout.tsx`）：`.ws-shell` 栅格在 ≤860 收起侧栏；顶栏新增汉堡按钮唤起浮层抽屉（`.ws-drawer`，点导航 / 遮罩即关 + 锁背景滚动）。
- ✅ **顶栏自适应**：≤860 隐藏全局搜索、缩小留白；≤560 折叠「/ 工作台」副标题与「新建项目」按钮文字（保留图标）。
- ✅ **内容区栅格折叠**：因本应用大量使用内联样式，用「`.ws-content` / `.public-page` 作用域 + `[style*=…]` 属性选择器 + `!important`」在 ≤1024（4 列降 2 列）/ ≤720（多列折单列）统一收口，一处覆盖全部工作台子页的内联 `gridTemplateColumns`；`auto-fill minmax` 栅格保持原生自适应不动。
- ✅ **公开落地页**（`page.tsx`）：hero 字号 / 留白改 `clamp()`，页头页脚 `flex-wrap`，卡片栅格随 `.public-page` 折叠。
- ✅ **视口元信息**（`app/layout.tsx`）：新增 `export const viewport`（`width=device-width` + `viewport-fit=cover` + 主题色）；并加 `100dvh`、`overflow-x:hidden`、`img/video max-width` 等移动端安全兜底。
- 响应式样式集中在 [`src/styles/app.css`](src/styles/app.css) 末尾「移动端适配」段；桌面端表现与改造前一致。

### v0.43 · 2026-05-29 · 短剧生成 + 形象锻造接大模型 + 平台访问隔离

- ✅ **短剧生成**（新 `/short-drama`）：脚本化表达 —— AI 起草分场景脚本（场景/分镜 shot/台词 dialogue）→ 保存 → 生成短剧视频（异步轮询回显）。后端 `/api/me/drama/*`，复用 celebrity 视频任务管线。参考 celebrity 商品视频脚本方案。
- ✅ **形象锻造**（`/forge`）：从 mock 渐变批量生成 重写为 **对话式 AI 形象顾问**（接平台大模型流式生成），与 AI 音乐人同逻辑、影院风 UI 独立；移除原 `window.prompt` 预设命名（违禁原生弹窗）。
- ✅ **登录与平台隔离**：登录页改用共享 `AuthScreen`（手机号登录/注册/体验账号三 tab）；workspace 在「账号未开通 AI 短剧」时拦截。注册透传 `platform=drama`。
- 详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.43。

### v0.6 · 2026-05-14 · 全交互化

- ✅ **路由重构**：废弃 `?tab=` query 模式，按页面切真实路由段；用 Next App Router route group `(workspace)` 共享 sidebar/topbar shell。
- ✅ **17 个 page.tsx 全部接 onClick / dialog / 路由跳转 / loading / toast**：dashboard / cast / cast/[id] / cast/[id]/generate / incubator / forge / wardrobe / scripts / scripts/[id] / projects / projects/[id] / projects/[id]/distribute / distribution / insights / trends / finance / settings。
- ✅ **核心交互流**：
  - 新增 / 归档演员（confirm dialog）；
  - 多步孵化（localStorage 草稿）；
  - 锻造炉批量应用到演员；
  - 戏服上传（FileReader 预览）+ 分配到演员；
  - 脚本工坊：新建 / 克隆 / 归档 / 导出 .fountain / AI 续写 / 提交审稿 / 通过审稿 / 版本树切换；
  - 项目状态机推进（CASTING → FILMING → POST → RELEASED）；
  - 多平台发布（带轮询 1.3s 推进进度）+ 取消 / 重试；
  - 充值 / 提现（钱包 + 流水 mock 联动）；
  - 工作室设置 + 团队邀请 / 移除。
- ✅ **基础设施**：Sonner toast、ConfirmDialog、FormDialog、EmptyState/LoadingBlock/ErrorBlock；Button 加 `loading` 防双提交；`drama-query` 轻量缓存 + invalidate。
- ✅ **/console 兼容**：`src/proxy.ts` 把旧链接 308 到新路径。
- ✅ **测试门**：`pnpm --filter @ai-star-eco/web-drama typecheck` 绿；`pnpm --filter @ai-star-eco/web-drama build` 17 个 page 全 prerender / SSR 通过。

### v0.5 · 2026-05-13 · landing + console shell（前一轮）

- 240px sidebar + topbar + 钱包异步拉取；登录 → console；premium cinematic 设计 token。
- 11 个 view 组件（CastView / IncubatorView / …）— 已在 v0.6 重写为 page.tsx + 删除原 view 文件。

## 待办

完整待办（含 D-1 ~ D-7 + 跨工程 CG-* 状态）见仓库根 [`TODO.md`](../../TODO.md) §「三子产品 web app 待办」。本 README 不再独立维护待办，避免与根 TODO 漂移。
