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
/templates           ← 创意市场（v0.75，原模板库:官方内置+用户发布统一 + 源标 + 套用开拍;运营新建内置/精选授权）
/templates/published ← 我发布的创意（v0.75:本人创意按状态分档 + 运营邀请授权/谢绝）
/review              ← 剧本审阅（v0.63:跨项目待审队列 + Excel 式平铺表格）
/assets              ← 素材库（v0.63:标签化图片/视频 增删改查 + AI 自动打标）
/interactive         ← 互动短剧（剧情互动 · 互动剧列表，v0.74）
/interactive/[id]    ← 互动剧编辑器（剧集分支地图 + 生成 + 导出互动配置）
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

### v0.78 · 2026-06-14 · 统一 TipTap 输入组件 + 短视频新建流程重做（去重 + 引用 chip + 进工作台真扣费）

- **TipTap 输入组件 `DramaComposer`**（`components/drama-workshop/composer.tsx` + `composer-ref.ts`）：全站点子 / 提示词输入复用同一套「引用 chip 托盘 + 富文本正文」。首个编辑器依赖 `@tiptap/*@2.27`（`immediatelyRender:false` 适配 Next 16 SSR）；命令式 `setText/focus/clear`（给我灵感 / 回填）；回车提交、Shift+回车换行、输入法合成中不拦截。引用类型经 `COMPOSER_REF_META` 注册表扩展（kind→图标/中文名，加类型只动一处）。本版先接入短视频新建，其余 20+ 输入后续分批迁。
- **短视频新建去重 + 引用 chip**：新建 `ShortCreateConsole`（`variant=home|standalone`）为短视频创建唯一真源（创意市场单集创意 + `DramaComposer` 对话框 + 给我灵感 + 开始制作）。首页短视频 tab 与 `/shorts/new` 都复用它；**删 `short-create-dialog.tsx`**（写死 `SHORT_FORMATS`、非创意中心的重复实现）。点创意卡 → 预览弹窗下方只一个「试试同款」→ 以引用 chip 进对话框（可再补主题）→ 开始制作进工厂；自由主题经 `sessionStorage` 注入创意草稿，工厂据「创意风格 + 你的主题」起草。
- **进工作台真扣费（可配）**：原首页那个「10」只是确认弹窗展示数字、进工作台并不真扣。现「新建短视频草稿 = 进工作台」走后端真扣一笔 `drama.credit.short-entry`（默认 10，admin「短剧专区」可配；重开已有草稿不计费）。`CreditButton` 单价改读 `cfg.prices.shortEntry`。
- 验收：web-drama `typecheck` + `vitest` 28/28 + `build`（含 TipTap SSR）全绿；server drama 测试 48/48（`DramaShortServiceTest` 8）。

### v0.76 · 2026-06-13 · 短剧 / 短视频制作支持「草稿」（刷新 / 返回不再丢进度）

- **短视频制作可恢复**：`/shorts/make` 此前整页纯内存态，刷新 / 返回即丢。改为进页即「建/读」后端草稿（`ShortsApi`，`/api/me/drama/shorts`），草稿 id 写进 URL（`?draft=`）；脚本 / 分镜 / 出片产物 / AI 对话 / 步骤等整页状态防抖自动保存；「合成成片」标 `done`。`/shorts` 工坊列表改读真后端草稿卡（草稿 / 已完成 + 进度），点开接着做。
- **短剧大纲漏存补齐**：`outline` 阶段的拖拽调序 / 加一集 / 钩子 + 梗概行内编辑此前都不落库（只「AI 生成」「锁定」才存）→ 现全部即时落库（删掉假的「重写梗概」按钮，改为行内可编辑）。
- **统一保存反馈**：新增 `useSaveStatus` + `SaveStatus` 指示器（「保存中 / 已自动保存 / 保存失败」）+ 离开页面前「有未保存改动」浏览器提醒兜底；短剧工作台与短视频制作页共用。
- 验收：`DramaShortServiceTest` 4/4 + 全链路真机浏览器（短视频建→编辑→刷新恢复；短剧加一集→刷新仍在）。

### v0.74 · 2026-06-14 · 互动短剧（剧情互动）—— 创作端落地（配置/生成/AI 起草/试玩走查 + 真后端）

新业务模式「剧情互动」：把「一部剧 = 线性 1→2→3 集」升级成「一部剧 = 剧集有向图」——
某集播完插入「互动」（一个问题 + 几个选项），观众的选择决定下一集播哪条分支。**互动发生在
剧集之间，不在单集内。** 只做创作端：配置剧集分支图 → 生成每集视频 → 导出互动配置；
播放 / 渲染 / 分发后续对接抖音 / TikTok（消费侧播放器不在本期）。mock 与真后端双通。

**前端（`apps/web-drama`）**

```
api/interactive-drama.ts        类型契约（EpisodeNode / EpisodeInteraction / EpisodeChoice /
                                InteractiveSeries / 导出 manifest）+ mock-first API；
                                aiDraftSeries（AI 起草）+ generateEpisode（live 提交后轮询既有
                                /episodes/jobs/{id} 到终态，异步封装在 api 层）
lib/interactive-graph.ts        纯逻辑：派生摘要 / 校验（可达性·选项指向·结局·断点）/
                                导出 manifest / 新建骨架 / draftSeriesFromTheme（mock AI）/ 节点增删改
mocks/interactive-drama.ts      内存 store + 2 个样例（落地窗后·互动版 / 霸总的选择）
app/(workspace)/interactive/page.tsx              列表（KPI + 卡片 + AI 起草 + 新建 + 删除）
app/(workspace)/interactive/[seriesId]/page.tsx   编辑器：剧集分支地图 + 批量生成 + 校验 +
                                                  试玩走查 + 成片抽查 + 导出（live draft + 页面保存）
interactive/_components/        NewSeriesDialog / AiDraftDialog（一句话灵感 → 整张图）/
                                EpisodeEditorDialog（三种流转：互动分支 / 线性下一集 / 结局集 +
                                选项→目标集，可新建分支集）/ EpisodeCard（分支可视化 + 预览）/
                                ManifestPreviewDialog（预览 + 下载 JSON）/ PlaythroughDialog（试玩走查）
```

- **AI 起草**：给一句话灵感 + 互动点/结局数，AI 直接搭好一张可玩的剧集分支图（与短剧/短视频
  工坊的「AI 起草」一致）。复用 `MediaLightbox` 抽查成片、`aiErrorMessage` 脱敏报错。
- **试玩走查**：创作端验证工具，从起始集像观众一样走一遍、在互动点做选择，确认分支接得对不对、
  能走到哪个结局（不是面向观众的播放器，仅结构走查）。

**后端（`apps/server`，真持久化 + AI 起草 + 按集生成）**

```
model/DramaInteractiveSeries.java        专用实体（表 drama_interactive_series），整张剧集图内嵌
                                         payloadJson；按 ownerUserId 隔离 + 软删（与 DramaScript 同惯例）
repository/DramaInteractiveSeriesRepository.java
service/DramaInteractiveService.java     CRUD + aiDraft（大模型，prompt=drama.interactive_draft，
                                         复用 DRAMA_SCRIPT_DRAFT 端点）+ generateEpisode（复用
                                         MaterialVideoJobService，kind="drama-interactive-node"，回写 node.video_job_id）
controller/DramaInteractiveController.java   /api/me/drama/interactive/**（series CRUD + ai-draft + 按集 generate）
resources/prompts/material/drama.interactive_draft.md   起草整张剧集图的提示词
PromptService                            +KEY_DRAMA_INTERACTIVE_DRAFT（注册进 KNOWN_KEYS）
specs/openapi.yaml                       +/me/drama/interactive/* 五条路径（契约门已过）
```

- **数据模型**：整部剧集图内嵌一行 payloadJson —— 用**专用表** `drama_interactive_series`（而非塞进
  `drama_scripts`），与线性短剧脚本干净隔离；满足「单文档内嵌整张图」决策，零跨表负担。
- **生成**复用 `MaterialVideoJobService`（kind="drama-interactive-node"）：generate 提交任务 + 回写
  `node.video_job_id`，前端轮询既有 `/episodes/jobs/{id}` 到终态再把 video_url 落回图并保存。
- **不静默兜底**：AI 未配端点 → 503 `AI_NOT_CONFIGURED`；提示词未配 → 503 `PROMPT_NOT_CONFIGURED`；
  调用失败 → 502 `AI_CALL_FAILED`；输出无法解析 → 502 `AI_BAD_OUTPUT`。
- **导出 manifest**（`schema=ai-star-eco.interactive-drama/v1`）：解析后带视频地址的剧集图，交给社媒
  平台的规范产物；平台适配器（→ 抖音 / TikTok 互动视频格式）走 sau-service per-platform driver 同款套路。
- **未做（下一步）**：平台适配器落地、可视化画布编辑器（当前为结构化列表）、每集分镜细化（接
  「单集剧本」阶段）、状态化分支（变量/条件累积）、消费侧播放（交平台）。

> 本版基于合入 `loving-maxwell`（drama v0.59→v0.73：全站接真后端 / 配方退役成片合成 / 提示词服务端化 /
> skill 飞轮 Recipe）后的工程架构续做，互动短剧已与「真后端 + AI 起草」的整体形态对齐。
### v0.71 · 2026-06-13 · 套模版先预览后确认 + 短视频模版提示词喂进 AI 对话流

- **预览 → 确认**：短剧 / 短视频「套模版浮层」里点模版卡不再直接套用，而是弹 `PreviewModal`（封面 + 估时大纲 / 分镜节拍 + 钩子标签），点「用这个模版」确认后才回填对话框、进入使用流程。
- **模版即上下文**：短视频工坊套模版进 `/shorts/make` 后，把模版的分镜节拍 / 口播结构（`ShortFormat.beats`）作为 `reference` 一并喂给大模型（`aiDraftScripts` 新增 `reference` → 后端 `DramaScriptService.aiDraft` 织进生成提示词），并在对话开场就「装进」对话流（开场 AI 消息显示已套用哪个模版、按什么节拍来），让后续生成贴合爆款结构。

### v0.70 · 2026-06-13 · 短视频新建对话框 + 短视频模版浮层（与短剧新建一致）

- **对话框新建**：短视频工坊「新建短视频 / 新建一条」由直进纯对话改为先经 `/shorts/new` —— 与短剧一致的居中 AI 对话框 + 上方「短视频模版」浮层（口播带货 / 知识科普 / 剧情钩子 / 数字人播报 / 热点二创…，运营 `cat.formats` 可维护）。选模版以「已选模版」pill 回填对话框，提交 → `/shorts/make?fmt=…&idea=…` 进工厂逐镜出片。新组件 `short-create-dialog.tsx`、新路由 `shorts/new/page.tsx`。

### v0.69 · 2026-06-13 · 短剧新建对话框 + 套爆款模板浮层（与短视频一致 · 退役旧向导）

- **对话框新建**：`/projects/new` 由「两步向导（选类型 → 选模式）」改为与短视频一致的**居中 AI 对话框**：一句话点子 → 真实 `createProject` 立项 → 进六阶段工作台补大纲。新组件 `new-project/create-dialog.tsx`。
- **套爆款模板浮层**：对话框「上方」悬浮一层模板选择浮层（可展开 / 收起）—— 内容类型 chips + 横向模板卡（封面 / 集数 / 钩子），选中以「已选模板」pill 回填对话框、并作主线喂大纲 AI；运营清空目录时浮层整体不渲染（退回纯对话框）。
- **入口统一 + 去 mock**：首页「套爆款模板」、工坊「套模板开剧 / 开一部新的」、模板库「一键开剧 / 衍生改编」全部走真实 `createProject`（不再 `/projects/p1`），并经 `aiErrorMessage` 脱敏报错（首页 `ideaCreate` 同步补齐）。删除旧向导 7 文件（pick-type / pick-mode / guided-start / template-start / step-dot / mode-card / index，其中残留的 mock `p1` id 一并清除）。

### v0.68 · 2026-06-13 · AI 报错脱敏 + 短剧图像/视频可配 + 整体短视频说明 + 首页打磨

- **AI 报错脱敏封装**：所有「AI 生成 / 渲染」catch 分支统一经 `lib/ai-error.ts` 的 `aiErrorMessage()`，不再把后台技术细节（上游响应体 JSON、HTTP 状态、端点名、异常类）直出给用户；命中泄漏特征即换友好兜底文案，并保留「追查号」。后端同步在源头封装（`AiModelInvocationService` / `MaterialVideoModelClient` / `DramaRenderService` / `DapMultimodalClient` 改返回友好文案，技术细节经新增 `BusinessException.internalDetail` 落 ErrorLog 供追查号排障）。覆盖 outline / cast / epscript / factory / assemble / shorts-make 共 11 处。
- **整体短视频说明（meta）**：`/shorts/make` 生成脚本时 AI 先给出 `meta`（标题 / 风格 / 主场景 / 主角），渲染为可编辑卡片置于分镜上方，并注入每镜首帧/视频提示词（`metaPromptPrefix`）以统一全片风格与人物、提升出片一致性。`DramaScript` 增 `meta?: ScriptMeta`，后端 `aiDraft` 保证返回（缺则从 title/genre/logline 兜底合成）。
- **首页打磨**：「开做」改「开始制作」；空输入时主 CTA 置灰且不可提交（聚焦提示）；`ws-topbar` 改透明 + `--line-soft` 细线分隔（消除左栏 + 顶栏两块实色相邻的厚重感）。
- **运营开关露出入口**：侧栏「运营身份」开关开启后即显示「运营 · 内容目录」入口（此前仅真实 `operatorRole` 可见）；真实写入仍由后端按角色校验。

### v0.67 · 2026-06-13 · 工程债收口（D-7 a11y / D-6 测试基线 / D-3 重复样式提取）

- **D-7 弹层 a11y 统一**：抽 `lib/use-modal-a11y.ts`（ESC + 焦点陷阱 + 初始/还原焦点 + body 锁，单一来源）。`common/Dialog.tsx` 接入 + 补 `aria-labelledby/-describedby`；新增 `common/ModalShell.tsx` 给命令式弹层提供 `.overlay` + `role=dialog` + a11y，收编 short-clip / quick-create / preview 三个此前裸 `<div className="overlay">`（全缺 ESC / focus trap）。**不换 packages/ui 的 shadcn dialog** —— 那套亮色 token 会破坏 drama 暗色 premium 玻璃视觉；强化共享容器即让所有调用方一处受益。
- **D-6 单元测试基线**：真后端落地后建立首个 vitest（+ jsdom + @testing-library/react）。`format.test.ts`（15 例边界）+ `drama-query.test.tsx`（6 例缓存语义）。测试驱动**修了一个真实 bug**：`drama-query` 取数失败时 re-throw 让 `useAsync` 丢弃的 promise 变 unhandled rejection（改为错误只落 `entry.error`，两个消费者从那里读）。`pnpm test` 21/21。
- **D-3 重复样式提取（非全量迁移）**：实测 inline `style={{}}` ~1615 处（原 TODO 估 573 严重低估），drama 为 Figma Make 移植、inline 精确定位是设计工作流的一部分，机械全迁移不可取。改为按重复模式提取：新增 `.icon-badge` 工具类（accent 渐变图标盒不变部分），迁移 4 处代表（computed-style 验证逐属性等价、零回归）。详见 `TODO.md` §D-3。

### v0.66 · 2026-06-12 · 扣费体验 + 按集隔离 + 成片合成

- **小额免打扰**：`CreditButton` 消耗 < 阈值（默认 10，admin「短剧专区」可配）直接执行不弹确认；≥ 阈值才弹。各 AI 动作单价从硬编码切到 `GET /me/drama/config`（`api/drama-config.ts` 缓存 + `useDramaConfig()`），server 端四个 LLM 动作真扣积分（hold→commit / 失败 release）。
- **按集存档**：`ProjectData.episodeDocs`（key=集号）取代单份 script/storyboard；epscript / factory / 成片合成经 `getEpisodeDoc`/`withEpisodeDoc` 读写，**切集不再互相覆盖**（老项目回读 legacy 字段）。
- **成片合成**（替代「成片配方」）：新 `AssembleStage` —— 本集已出片镜头按序一键拼接（server ffmpeg concat → CDN），含成片播放/下载/重拼与空态引导；`stages/prompt.tsx` 删除（stage key 沿用 `prompt`）。
- **删冗余**：一键连跑（RunAllDialog）与顶栏「新建短剧」按钮下线。

### v0.65 · 2026-06-12 · 全站接真后端（server 模式所有接口真连，与 mock 完全隔离）

- **剧集脚本 / 分镜 AI 真连**：`EpScriptStage` 的「重写分场分镜」「衍生上一集 / 给我惊喜」「单场拆镜」走 `ProjectsApi.epscriptAiDraft / splitSceneShots`（真大模型），结果合并入 `ProjectData.script + storyboard` 并 `PUT` 落库。
- **选角 AI**：`CastStage`「从大纲重抽角色」走 `ProjectsApi.castAiDraft`，写回 `state.chars` + `ProjectData.characters`（新 `setChars` reducer action）。
- **分镜首帧 / 视频渲染真连**：`FactoryStage` + `EpScriptStage` + `/shorts/make` 的 首帧/直出/动态 走 `RenderApi.renderFrame`（图像→CDN）/`renderClip`（视频任务 + `pollClipJob` 轮询）；`Thumb` 加 `src` 支持真图，成片用 `<video>` 渲染。镜头渲染态（frameUrls/frameUrl/videoUrl/jobId/flow）落 `BoardShot` 持久化。
- **短视频工坊真连**：`/shorts/make` 的 AI 脚本走 `ShortDramaApi.aiDraftScripts`，逐镜首帧/视频走 `RenderApi`。
- **分发真后端**：`distribution.ts` 全部重指向 `/me/distribution/**`（平台连接 + 发布任务，后端 `@Scheduled` 推进）；删无人消费的 content/platform-views/connections 旧函数。
- **财务真连**：`finance.ts` 充值改走真实「下单→运营核准」流程（`/me/wallet/packages` + `/me/wallet/recharge`），提现走 `/me/wallet/withdraw`。
- **清债**：删死代码 `api/generation.ts` + `mocks/_handlers/generation.ts`（无人引用）。
- 详见 `docs/VERSION_HISTORY.md` §v0.65（含真模型实测记录与「仍待办」）。

### v0.64 · 2026-06-12 · 六阶段项目工作台接真后端（mock → 真实 API）

- **真后端落地**：`/projects` 列表、`/projects/new`（从零 + 套模板）、`/projects/[id]` 工作台从 mock 静态数据切到真实接口 `ProjectsApi`（→ `/api/me/drama/projects*`，后端 `DramaProjectController` + `DramaProject` JSON-document 实体）。
- **整套 ProjectData 持久化**：工作台加载真实文档；阶段内编辑 → 乐观更新 + `PUT` 落库（`saveData` 注入各阶段的 `StageContext`）。
- **大纲 AI 真连大模型**：`OutlineStage` 的「AI 生成大纲」调 `POST /me/drama/projects/{id}/outline/ai-draft` → 真实大模型起草分集大纲 → 合并入文档 + 落库；空项目展示 idle 引导态，失败 toast 报错（带后端错误码文案）。
- **状态闭环**：列表/详情加载态（spinner/skeleton）、空状态（无项目→建卡 + 工作台 idle）、错误态（加载失败重试 / 生成失败提示）、鉴权（`/api/me/**` 按 JWT principal 隔离归属）。
- **CRUD 全链路**：新建（guided/template/衍生）→ seed 空文档 → 工作台 → 大纲 AI → 保存 → 列表「继续上次」。dev 用 `scripts/dev-fake-llm-server.mjs`（:8091）联调大模型链路。
- 注:视频工厂（分镜出片）走真实 agnes 视频端点有额度，本期保持联调态；详见 `docs/VERSION_HISTORY.md` §v0.64 的「仍待办」。

### v0.63 补丁 2 · 2026-06-12 · 剧集脚本:本集剧情 + 出场人物管理 + 加对白简化

- **本集剧情置顶**:剧集脚本顶部新增可编辑「本集剧情」卡(给人看的速览,不直接喂给生成);
  对下面分场分镜不满意时,点「基于剧情重新生成分场分镜」(约 10 积分)让 AI 按最新剧情整集重写。
- **出场人物可管理**(整集设置内):支持从素材库人物一键加为出场人物、或输入添加临时演员
  (快捷:路人甲/路人乙/群演),后加的人物可移除;下面每场对白与分镜人声的说话人选项
  统一来自整集出场人物列表。
- **加对白简化**:场景草稿里改为单个「+ 加一句对白」按钮,先加行(默认旁白),行内下拉再换人。

### v0.63 补丁 · 2026-06-12 · 交互完善:结构化分镜表单 + @引用 + 成片预览

按用户反馈八条逐项落地(参照「短剧分镜V2 · 结构化版-适配Web表单」字段结构):

- **结构化分镜表单**(`components/drama-workshop/shot-form.tsx`,短剧剧集脚本与短视频制作页共用):
  场景卡片 / 脚本表格双 tab 合并为单一表单流 —— 基础通用信息(作品风格/核心人物/拍摄场景/
  整体时长)+ 逐镜表单卡(镜号 / 时间线自动累计 + 单镜时长可调 / 画面内容(纯视觉) /
  音频内容【人声(说话人下拉)+ 音效 + BGM】/ 镜头参数(景别/运镜) / 特效氛围 / 参考素材 / 字幕);
  左列保留 首帧(2 分)→ 成片(7/9 分)→ 验收 渐进渲染。
- **@ 引用**:脚本编辑态输入 `@xxx` 唤出素材库联想,选中自动加入参考列表并插入 `[参考N]`
  (`RichScript` 增 onRefsChange + mention 下拉)。
- **台词说话人可选**:加台词先选 旁白/角色(分镜内人声同样下拉切换;短视频为 口播/旁白)。
- **生成方式改 AI 对话**:剧集脚本去掉「套爆款模板/衍生/自由起草」chips(模板在立项时已套全量),
  改为左下悬浮 AI 对话框(`ai-chat-panel.tsx`),内置模板化提示词【衍生上一集】【给我惊喜】。
- **成片预览**(`work-preview-modal.tsx`):点已完成的短剧/短视频先弹成片预览(可播放占位),
  再选「切到脚本视图」或「衍生新剧/新片」。
- **剧本审阅降级**:移出一级菜单,收进短剧工坊页内入口卡(带待审角标),路由 /review 保留。
- **首页短视频推荐纠正**:短视频模式下推荐区改为 5 个短视频模板卡(成片预览 + 分镜节拍),
  点「用这个模板开做」直达 /shorts/make;短视频脚本步同样采用结构化分镜表单(带时间线)。
- **高度控制**:sidebar 压缩(分组/条目留白收紧 + 底部运营身份/账户区固定不再被挤出视口),
  首页 hero 留白收紧,关键操作不再需要下滑寻找。

`typecheck` + `build` 全绿;dev 冒烟 6 路由 200。

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
