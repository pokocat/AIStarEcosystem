# 待办与已知问题

- [x] ~~项目列表画布卡片只有小地图，无法识别内容~~ **已生产发布（4ed3ecf9），2026-10-17**：真实内容预览、正文摘要、去重数量、固定／自动封面、二级流程预览；封面归属与失败重试测试、桌面／手机布局验证见 `docs/releases/studio-workspace-refactor-validation.md`。

## Studio 工作台重构与发行（2026-10-16）

- [x] ~~Studio 静态配图体积过大~~ **2026-10-17 本地完成，未发布**：13 张卡片转 960×640 WebP，首页两张大图转本地 WebP、首图按视口加载，logo 缩至 256px；16 张合计 33.58 MB → 1.02 MB，验收见 `docs/studio-workspace-refactor-validation.md`「配图压缩」。

- [x] ~~全仓输入与选择控件重复聚焦框检查~~ **2026-10-17 已生产发布（81778bef）**：检查所有前端应用与共享表单；修复 AiAvatar 各外壳下的 Ant/Radix 内层轮廓、原生字段与画布组合字段焦点归属，74 项组件聚焦回归与真实页面验证见 `docs/form-control-focus-audit.md`。
- [x] ~~项目、IP 与发行筛选的原生菜单风格割裂~~ **2026-10-17 已生产发布（81778bef）**：八处共用 `StudioSelect`，菜单在字段下方展开；21 项测试、类型检查及桌面/375px 手机浏览器验证见同一检查记录。
- [ ] **后台模型审计页原生选择框回归**（2026-10-22 发现）：`apps/admin/src/app/ai/audit/page.tsx` 使用原生 `<select>`，使 `apps/web-aiavatar/src/ip/select-field-wiring.test.ts` 的全仓控件守门失败；未修改 main `57be2582` 已复现。需改用共享选择控件并验证后台筛选。本次图片受理未知修复不修改或部署 admin。

- [x] ~~七项导航、独立项目、场景工坊、IP 并入资产与灵感整理~~ **2026-10-17 已生产发布（81778bef）**：原画布路径保留，剧情带货/爆款复刻引用普通模板，IP完整详情、旧入口参数兼容；验收见 `docs/releases/studio-workspace-refactor-validation.md`。
- [x] ~~发行复用存量账号与发布记录~~ **2026-10-17 已生产发布（81778bef）**：`StudioDistribution` 读本人账号/批次/任务，接原扫码绑定、验证与解绑；仅精确共享账号域和发布 GET 路由，未进行真实平台扫码发布。
- [ ] **画布商品选品与剧本融合【待建设】**：`StudioSceneWorkshop` 已可创建剧情带货模板；商品库/抖音链接选择、商品事实进入剧本编辑器改稿请求及局部采纳，按 C01-C06 后续完成，不新增业务项目域。
- [ ] **画布成片投递和发布草稿【待建设】**：`StudioDistribution` 仅显示状态；需要验证本人精确输出来源、可持久化非执行草稿与显式发布受理，不能用现有 PublishJob.createBatch 冒充草稿。
- [ ] **短剧/音乐模板接入与音乐发行【待建设】**：`studio-scenes.ts` 未绑定可用模板，入口禁用；音频渠道另行适配。
- [ ] **发行任务验证与调度操作【待建设】**：原发布任务读接口已复用；此入口的待验证处理、重试/取消和批量定时写操作仍未开放，不扩现有发布写权限。


本文件是未完成问题与候选计划的真源。完成或澄清后，按 [AGENTS.md 的维护纪律](AGENTS.md#todomd-维护纪律strict) 勾选、注明日期和证据；定期整理时保留到历史记录。

2026-10-13 整理：已完成记录、合并前的重复条目与排障教训见 [历史记录](docs/archive/todo-2026-10-13.md)。历史候选保留原分期，不代表已承诺排期；本次只更正有证据的过时状态，其余问题没有逐项重新验收。

> **已全部完成的段**（段内没有任何 `[ ]`）定期整段移到 [`docs/archive/todo-closed.md`](docs/archive/todo-closed.md)，条目原样保留、不改写；本文件只留还有未勾项的段。2026-10-18 第一次按这条规则整理的 8 段已在那里。

- [Studio 当前待办](#studio-当前待办)
- [已定位问题与后续限制](#已定位问题与后续限制)
- [早期候选计划](#早期候选计划)

## Studio 当前待办

- [ ] **发布模板时区域颜色丢失**（2026-10-25 发现，圈选分组）：画布分组新增 `metadata.groupTone`（`apps/web-aiavatar/src/canvas-bridge/studio-areas.ts`），但服务端 `IpDemoTemplateService` 剥素材时对 group 节点只白名单了 `groupDescription`（约 121 行），存为模板 / 官方内容后区域回到默认色。名字、说明、成员不受影响；要保留颜色需在同处加 `groupTone`（只接受 `slate|blue|teal|green|amber|rose`）。

- [x] ~~视频优化提示文案与控件简化~~ **2026-10-23 完成**：统一「智能优化」开关，沿用已存请求选项与提交映射，输入详情保留结果与缺失状态；定向交互测试随提交记录。

统一 Studio 的后续事项。旧画布适配层的历史限制另按原主题保留，不能据此推断当前 Studio 也缺少同一功能。

### 2026-10-23 · AI 导演台（独立功能分支，未发布）

总方案：[AI 导演台完整方案](docs/ai-director-plan.md)；实测边界见[本地验收](docs/audits/ai-director-local-acceptance-20261022.md)。

- [x] ~~**实现导演作品及生成宿主适配**~~ **2026-10-23 完成**：V65 独立作品、原生任务宿主、个人／企业付款接入、采用版本与修订保护。
- [x] ~~**接通剧本到分镜及后台连跑**~~ **2026-10-23 完成**：剧本／资产／分镜三工作区、一键推进、人工确认、暂停与局部续跑；Agnes 真实剧本、资产图和单镜头首帧已验。
- [ ] **真实视频与整集导出验收**：Agnes 多次明确队列满拒绝，无真实视频产物；用户已要求停止重试，自动跟进已删除。测试响应模式下已走通播放、采用和导出，不代表真实出片通过。
- [ ] **视觉与声音连续性效果验收**：全能参考的宫格、关键动作及跨片段声音仍待实测；首帧路径不支持声音参考。自动视觉验收、有限自动修复和长剧本分块后续处理。
- [ ] **导演台选择控件统一**：`director-workbench.tsx`、`director-storyboard.tsx` 的原生选择框仍待与 Studio 控件统一，不影响本次功能归档提交。

### 2026-10-22 · 分镜编辑改造（方案已整理，功能未实现）

完整设计与阶段门槛见 [分镜编辑改造方案](docs/ip-studio-storyboard-editing-plan.md)，代码核对基线 `7caf56a4`；本轮只写计划，不代表以下能力已实现。

- [ ] **S0–S1：序列关系与统一编辑命令**：`studio-script.ts:studioShotNodes`／`studio-workspace.tsx:allShots` 现有镜头信息上补明确序列成员与顺序；贯穿 `project-sync.ts` 的加载、保存、脏检查、冲突另存及复制导入；统一画布、表格修改与撤销，保守适配旧项目，防两个剧本同为第 1 集时串组。
- [ ] **S2–S3：分镜工作区与生成闭环**：现 `StudioStoryboard` 是按节点类型分栏；新增每镜一行的编辑器、范围与详情，保留全部节点浏览；统一描述／自定义提示词／表单草稿解析、采用版本、逐镜真实请求与异步结果保护。
- [ ] **S4：AI 分镜读写与保存确认**：新增结构化分镜上下文及读写工具，复用 `StudioDialogueTurnWorker` 事件投递；持久命令、原子投影、doc 回执、同字段冲突、跨浏览器恢复及真模型评测，避免事件发出就报已完成或旧命令重放覆盖手改。
- [ ] **S5–S6：成片隔离、兼容与验收发布**：`studio-packaging.ts:studioWorkDraft` 从单 episodeNo 定位扩展到 sequenceId；保存成片来源快照、差异采纳并保护 Twick 工程；完成方案 A01–A22、旧客户端写保护和回退演练，再按干净 main 发布纪律执行。

### 2026-10-21 · 结果落到助手准备的节点、首帧比例（`20261021-studio-exec-node`；真源 `docs/ip-studio-new-canvas-and-threads.md` §6）

- [x] ~~**对话出视频后结果另起一个没有提示词的节点，助手准备的节点成了空壳；1:1 首帧被拉成 9:16**~~ **2026-10-21 已修**（线上 IPP-655ea55a）：计划步骤 `targetNodeId` + 确认时 `StudioPlanValidator.bindTargets` 绑定，读步骤节点统一经 `StudioPlanExecutionIds.stepNodeId`；结果节点带实际发出的提示词；`StudioVideoService.alignFrame` 居中裁剪首帧 / 尾帧并记 `_exec.firstFrameAdjusted`；生成面板裁剪提示；节点按产物比例（`studio-media-fit.ts`）；提示词 seed v23。测试：`StudioPlanTargetBindingTest`、`StudioPlanExecutorTest`（绑定步骤）、`StudioPlanExecutionServiceTest`（确认时绑定）、`StudioFrameCropTest`、`PlannerAssetCatalogTest`、`studio-plan-execution.test.ts`、`studio-media-fit.test.ts`、`studio-frame-crop-hint.test.tsx`。
- [x] ~~**制作中关页、换设备打开，结果补不进助手准备的空节点**（Codex 只读复现 P1）~~ **2026-10-21 已修**（仅 web-aiavatar）：恢复只看「节点在不在」，绑定的准备对象在却是空的，执行恢复与历史回放都跳过它，任务成功、积分已结算、画布仍空。改为按是否已回填判断（`studio-plan-execution.ts` 的 `nodeHoldsResult` / `missingExecutionNodes` / `executionOutputMissing` / `restoreFills`），补进去的对象可接依赖连线；删掉的照旧不重建。测试：`studio-plan-execution.test.ts`「restore fills an object prepared for a step…」、`studio-assistant.test.tsx`「closed during the execution, opened on another device…」。
- [x] ~~**打字「可以」确认后、执行详情返回前可以新建 / 切换对话**（Codex 只读复现 P2）~~ **2026-10-21 已修**（仅 web-aiavatar）：确认卡变成已确认（事件或快照）到读到执行之前保持切换锁（`DialogueStore.awaitingExecutionId`，`dialogueThreadBusy`），读失败按确认重发的退避重读，400 / 403 / 404 放开。测试：`studio-dialogue-session.test.tsx`「a card confirmed in words…」等四条、`studio-dialogue-threads.test.tsx`「after a card is confirmed in words…」。
- [ ] **绑定的对象在步骤生成期间不显示「生成中」**（2026-10-21 发现）：执行器只在步骤完成时发 `node.upsert`，生成中那个对象仍是空的上传卡；原生 run 的 `node_id` 已是它，可以在 `StudioPlanExecutor` 受理后发一次 `status=loading` 的投影（或前端按执行步骤状态画进行中），要注意失败与取消时还原。
- [ ] **对话模型是否真的按首帧写画幅只验了规划一步**：真调只覆盖 `propose_plan`（5/5 跟首帧 1:1、填了 `targetNodeId`）；对话模型在 `create_nodes` 里写 `aspectRatio`（规则 11 新句）、以及先 `view_images` 拿到尺寸的路径没有真调（§8.0.1 ⑦）。
- [ ] **裁剪在真厂商上没出过片**：`alignFrame` 只有单测和真实图片字节测试，没有提交过一次收费的图生视频看厂商对裁剪图的输出；线上首次用 1:1 首帧出 9:16 时看一眼 `[studio-video] frame cropped` 日志与成片。

### 2026-10-21 · 热修 `20261021-studio-action-marker`（数组后面多写了一个结束标记）

- [x] ~~**动作对了却被判格式错误，同一句正文显示三遍还扣了积分**（线上 2026-10-21 14:10，聚算 Qwen3.8 27B，JSON 动作协议，v20 提示词）~~ **2026-10-21 已修**：模型三次都在数组后面又写了一行 `<<<studio-actions>>>`。`DialogueActionProtocol.stripClosing` 把结尾处的一行收尾（分隔行再写一次、`<<</studio-actions>>>`、`<<<end>>>`、`<<<end-studio-actions>>>`、`</studio-actions>`、代码围栏收尾，大小写不敏感，最多两行）当合法收尾去掉，其它多余内容仍判错；格式错误重试时被判错那次的正文先不显示，重试不再流式，解析完再显示，正文只出现一次（`DialogueModels.Real` + `DialogueLoop.Model.endTurn`）；失败说明改为「这一轮没能执行，请再说一次。」；纠正提示和对话提示词补「分隔行只写一次，数组后面不要再写」（`SEED_VERSION` → `v22-2026-10-21-single-action-marker`）。
- [x] ~~**「用这张图做一段视频」（我们自己给的完成后建议）留在出图上**~~ **2026-10-21 已修**：`video-generation.md` 关键词补「做一段视频 / 做段视频 / 做个视频 / 做一个视频 / 生成一段视频 / 做成一段视频」；`StudioSuggestionRoutingTest` 钉住 `StudioExecutionSummary.suggestions` 能产出的每一条建议去对的技能或不切换。用户原话里的「一段视频」「生成一段」「做成一段」没有单独加：会让「写一段视频脚本」「生成一段口播文案」「照这条做一段视频」落到出视频。
- [x] ~~**「用这几张图做一段视频」「用一张图生成一段视频」仍与出图平手**~~ **2026-10-21 已修（server `20261021-studio-skill-routing`）**：出图的裸词「一张图 / 几张图」改成「出一张图 / 生成一张图 / 出几张图…」（「用这几张图」是素材不是要出图），这两句直接归出视频；平手规则改为一律不绑、交给模型 `read_skill`（当前技能在平手里也不沿用）；「做个视频脚本」由写作意图归回写剧本与文案。用例 `StudioSkillRouterTest#theRoutingTableHoldsFromEveryThreadState`。原记录：出图的「几张图 / 一张图」与出视频的新词同分，再加一张图片素材两边各 +1，平手时线程在出图上就沿用出图（模型仍可用 `read_skill` 换方法）。要彻底解决得改路由规则（例如同一技能互相重叠的命中只算一次、或区分「拿图当素材」和「要出图」），不是加词能解决的。另：「做个视频脚本」现在会落到出视频（出视频允许 text 操作，模型可 `read_skill` 换成写剧本与文案）。
- [x] ~~**意图文档 §7 评测集「用这张商品图写三条卖点文案 + 图片」实际路由到出图**~~ **2026-10-21 已修（server `20261021-studio-skill-routing`）**：路由先判写作意图（写作动词直接带文案 / 卖点 / 标题等文字产物 → 写剧本与文案，带图带视频也一样），评测集预期不变。原记录：出图「商品图」+2、图片 +1 = 3，写稿「写三条」+2 = 2，与 `docs/ip-studio-dialogue-intents.md` §7 写的「写剧本与文案（词优先于素材）」不符。与本次改动无关（不含新词），待定是改评测集预期还是调关键词。
- [ ] **web-aiavatar 演示 mock 的技能路由落后于服务端**（2026-10-21 发现，未修）：`apps/web-aiavatar/src/ip/mocks/studio-dialogue.ts` 的 `MOCK_STUDIO_SKILLS` 关键词与仓库技能文件已不一致（如出视频仍是裸词「视频」「成片」），`mockRouteSkill` 也没有写作意图、「只有素材不选方法」与「平手一律不绑」三条（服务端 `StudioSkillRouter.decide`）。只影响演示模式；下次发 web-aiavatar 时照服务端同步并补 `mocks/studio-dialogue.test.ts` 用例。

### 2026-10-21 · 热修 `20261021-studio-action-format`（工具调用写成了正文）

- [x] ~~**整条回复只写「[调用工具 view_images]」，什么都没做还扣了积分**（线上 2026-10-21 13:50，聚算 Qwen3.8 27B，JSON 动作协议）~~ **2026-10-21 已修**：`DialogueActionProtocol.ProseCallFilter` 按已注册工具名认出写成正文的调用（带括号的「调用工具 / 使用工具 / 工具 + 工具名」任意位置、不带括号的整行、只有工具名的整条回复），流式和非流式都不显示，按格式错误重试；纠正提示带一个完整动作示例（`DialogueLoop.correctionText`）；对话提示词恢复「调用时可以写一句在做什么」并补完整示例（`SEED_VERSION` → `v21-2026-10-21-action-format-example`）。真调：新提示词 6/6、带纠正的重试 5/5 都给出可解析的 `view_images`。
- [ ] **旧提示词真调时另外两种「什么都没做」**（判定：先观察，2026-10-21）：同一份请求用旧提示词真调 5 次，除 3 次正常外，1 次整条回复是「[用户已确认]」（6 token），1 次只写「画布上有一张「分镜」图，我先看看它的内容。」没有动作、回合就此结束。解析器不认这两种（不是工具名，也不是工作记录的写法）。新提示词 6 次都没出现；线上再出现时再定是否把「说了要看 / 要做却没给动作」当格式错误重试一次。

### 2026-10-20 · 新建画布、多段对话与卡片精简（2026-10-21 已生产发布 `20261021-studio-new-canvas-threads`；真源 `docs/ip-studio-new-canvas-and-threads.md`）

- [x] ~~**两个标签页各开一段对话时，断线补拉会改掉「最近打开」**~~ **审计确认**，2026-10-20：`6a836dc0` 已把读和切换分开（`GET …/conversations/{threadId}` 只读、不 `markOpened`，主动切换才走 `POST …/open`），事件流补拉 `getSnapshot` 改走只读接口，Codex 复审确认已修。原描述：`apps/web-aiavatar/src/ip/studio-dialogue-session.tsx` 事件流订阅的 `getSnapshot` 先读 `GET …/conversation`，发现最近打开的不是本标签页那段，就按 id 调 `GET …/conversations/{threadId}`，而这个接口会 `markOpened`，等于本标签页一断线重连就把「当前对话」抢回来，另一个标签页刷新后会落到这段。时间线本身不会错（`onSnapshot` 只收本线程）。彻底避免需要服务端加一个不改 `last_opened_at` 的只读快照接口，补拉改走它。
- [ ] **切到别的对话后，上一段里没发出去的失败消息不再显示**：`apps/web-aiavatar/src/canvas-bridge/studio-dialogue-store.ts` 快照换线程时 outbox 置空（`sameThread ? store.outbox : []`），失败消息的文字和重试入口随之消失，切回去也找不回来。前端在有发送中的消息时已拦住切换（`dialogueThreadBusy`），但「失败」状态不拦。待定：有失败消息时是否也拦住新建 / 切换，或者把 outbox 按 threadId 分开保存。
- [ ] **复用空线程的请求编号边界**：`StudioDialogueService.createThread` 复用空闲空对话时不改它原来的 `client_request_id`，重放按「同人同键 → 否则复用最新空闲空对话」再判一次。若被复用的那段在两次请求之间有了消息，同一个 `clientRequestId` 重放会复用到另一段空对话或新建一段，而不是回到第一次那段。前端正常流程每次点「新对话」都换新键、成功后不重放，不会触发；要严格幂等需把复用关系记下来（例如单独的请求键表）。
- [ ] **真模型验证卡片文案**：`dap.ip_studio_skill_plan.md` / `dap.ip_studio_skill_dialogue.md` 与 `RequestApprovalTool` 的 `scope` 说明改成「只写要做出什么」（`SEED_VERSION` → `v20-2026-10-20-concise-cards`）后，只有确定性测试和演示 mock。需用线上同款对话端点至少真调一次出图 / 出视频 / 复刻，看 `plan.summary`、`step.title`、`approval.scope` 是否还带判断过程（「用户需求完整且无真实取舍…」）、积分或流程说明，正文是否在发卡时只有一句（§8.0.1 ⑦）。
- [ ] **刷新或切回某段对话后，回复正文排到工作记录前面**：`apps/web-aiavatar/src/ip/studio-dialogue-message.tsx` 的 `messageBody` 只有在 `layout`（`studio-dialogue-store.ts` 的 `layouts[messageId]`，只在实时收到事件时生成）存在时才按到达顺序交错排正文与工作记录；快照来的消息没有 `layout`，走 `!layout` 分支先整段放 `message.text`、再放全部 `blocks`，于是「我先看一下画布」→ 工作记录 → 「画布上有…」在刷新后变成两段正文挤在一起、工作记录全在后面。需要服务端在消息上留下正文分段与块的先后（或事件序号），快照也能还原顺序。
- [ ] **手机画布顶栏标题截断没有省略号，保存状态显示成「已…」**：`apps/web-aiavatar/src/ip/studio-flow-canvas.tsx` 顶栏 `<Input aria-label="画布名称" variant="borderless">` 在 375 宽被挤窄时直接截断、没有 `text-overflow: ellipsis`；`.studio-host-save`（`src/styles/studio-flow.css`「画布页改版 · 第二遍」那段，`max-width:240px` + ellipsis）在手机上被压到只剩一个字加省略号。待定：手机上保存状态改成图标 / 只留错误态，标题输入框给出省略号与 `title`。
- [ ] **确认结果核对没有上限**（判定：先观察，2026-10-20）：`apps/web-aiavatar/src/ip/studio-dialogue-session.tsx` 的 `settle` 在「开始制作」结果不明时用同一个 `clientRequestId` 重发（2s、4s… 封顶 30s），直到服务端给出执行或明确拒绝；服务端若持续 500 / 502 / 504，这段对话会一直显示「正在核对确认结果，请稍等」、不能新建或切换，只能刷新页面（刷新后由快照与执行恢复）。卡上有「现在再查一次」；是否在若干次后改说法（如「暂时查不到结果，可以刷新页面」），等线上出现再定；不能改成「查不到就放行」（Codex 复审 P1）。
- [ ] **antd 6 `maskClosable` 废弃警告**：`apps/web-aiavatar/src/ip/studio-conversation-share.tsx`（`maskClosable={!busy}`）、`src/ip/canvas-conflict-dialog.tsx`（`maskClosable={false}`）、`src/ip/studio-effect-library.tsx`（`maskClosable={!busy}`）在控制台报 deprecated；改成 `mask={{ closable: … }}`，范式见 `src/ip/publish/publish-dialog.tsx`。

### 2026-10-20 · 对话意图直达（本地实现，未发布；真源 `docs/ip-studio-dialogue-intents.md`）

- [ ] **真模型端到端跑触发评测集**：按 `docs/ip-studio-dialogue-intents.md` §7 的 12 条消息（带附件的照表里放），用线上同款对话端点逐条跑，记下实际选中的技能、是否问了问题、是否一轮出卡、短稿是否当轮放进画布；与期望不符的逐条记原话再改提示词或技能触发词（§8.0.1 ⑦：要求模型按我们格式输出的地方上线前至少真调一次）。目前只有确定性测试和演示 mock。
- [ ] **配音 / 口型技能接入对话**：对话工具（`propose_plan` 允许的操作、执行器步骤）还没开放配音 / 口型 / 声音克隆，提示词只能让模型说明「去画布对应节点的工具里做」。要接入需先在执行器与计划校验里开放这些操作（含计费与幂等），再加技能文件与触发词，并同步演示 mock。
### 2026-10-20 · 线上五项（原创方法、规格贯通、动作协议、看图、失败态）

- [x] ~~原创三视图被「参考视频复刻」流程卡死（IPP-51a92043，IPR-ad518c2e09c64c759182：8 次模型调用、12 积分，没有可执行方案）~~ **2026-10-20 已修**：新技能「原创创作」只有制作阶段，执行可从 production 开始（`StudioSkill.firstStage`）；无进行中执行时 `read_skill` 可换技能并作废旧卡；预算与确认保护不变。
- [x] ~~助手意图没落到节点规格与素材（IPP-45bead91，IPR-fde32da6c2cc4664974f 发了 9:16 / 8 秒、只带男主）~~ **2026-10-20 已修**：`create_nodes` / `update_nodes` 写 `studio.spec` 并连参考边；面板按 spec 打开；时长超出模型范围不再静默改，给阻断提示与「改成 N 秒」；描述与设置不一致付费前询问。
- [x] ~~`<studio-actions>…</studio-actions>` 漏成正文、方案没提出（IPT-2f13c2ed42994624907d seq 10）；模型模仿工作记录（seq 12）~~ **2026-10-20 已修**：解析 + 流式过滤认这种写法，闭合后正文继续推送；残缺 / 无效整批不执行；模仿记录按格式错误；连续 2 次纠正失败停在 `protocol`。
- [x] ~~助手没看图却说读到三视图、按文件名猜男女主、编名字~~ **2026-10-20 已修**：新工具 `view_images`（本人 key、内联字节、对话端点须声明看图、计入本轮预算）；素材清单注明不含画面；提示词规则 11。
- [x] ~~失败节点仍显示初始空态，生成按钮重复；已下架模型能反复重投~~ **2026-10-20 已修**：失败面板 + 单一恢复动作；`VIDEO_MODEL_RETIRED` 映射与冻结前拒绝。
- [ ] 下架模型的拒绝是进程内记忆（24h，单机）：服务重启后第一次提交会再向供应商发一次（400、积分释放）。要跨重启 / 多节点就落库，或者让运营在后台停用端点（根治在配置）。
- [ ] `view_images` 只用当前对话端点看图；对话模型没有看图能力时如实拒绝，没有自动换一个看图模型（需要单独定价与授权，未做）。
- [ ] 图片上游 503「生图队列已满」（Agnes，logId PSQ8YXAAJLVD）仍显示通用「模型服务暂时不可用（上游 503）」，没有像视频那样映射成队列已满；Agnes 已不用于生产用户，换模型后再看是否需要。
- [ ] **Agnes 下架后的默认绑定（待运营决定）**：`DAP_IMAGE` / `DAP_PERSONA` / `IMAGE_GENERATION` / `VIDEO_REF_ANALYSIS` 没有默认绑定，数字资产 `/studio` 资产任务、数字名片人设、短剧定妆照 / 场景图 / 三视图、带货爆款雷达现在都报「未配置」（冻结前拒绝）。只能绑定用同一 JSON `images/generations` / chat 协议验证过的端点，不恢复 Agnes，未适配旧协议前不能直接指向 GPT Image 2。核对表见 `docs/releases/studio-prod-fixes-20261020.md` §2.1。
- [ ] `DapWorkflowService` 无事务：`generate` / 衍生 / 造型 / 待机循环在 `DapJobService.submit` 拒绝（如 `DAP_ENGINE_NOT_CONFIGURED`）前已保存「生成中」状态，拒绝后不回滚（代码推断，未在线上复现）。
- [ ] 对话事件流 `/conversations/{id}/events` 客户端断开（`IOException: Broken pipe`）记成 `INTERNAL_ERROR`，近 3 天 157 条，淹没真错误；应识别为正常断开不记错误日志。
- [ ] `studio-conversation-share.test.tsx`「failed save does not preview or publish…」全量跑时偶发失败、单独跑通过（2026-10-20 观察，与本次改动无关），待查时序。

### 2026-10-20 · web-aiavatar 测试集精简时顺手发现（见 `docs/audits/web-aiavatar-test-suite-audit-2026-10.md`）

- [ ] **剧本面板的模型选择器显示值不看 fixed 模式**：`studio-workspace.tsx` 剧本设置里 `<Select value=…>` 自己又写了一遍「用户选的 ?? 默认 ?? 第一个」，不经 `studioChosenTextModel`（`canvas-bridge/studio-text-model.ts`，这次已把另外两份收成它），fixed 模式下可能显示用户旧选的模型、提交却用默认模型（§8.0.1 ④）。改成调用 `studioChosenTextModel` 会改变显示，需要单独确认后再改。
- [ ] **`studioComposerTake` 与对话框写在同一个 .tsx 里**：node 测试引用它会连带加载 antd（多约 6 秒），现在测试里 mock 了 antd 顶着；把这个纯函数挪到 `canvas-bridge/` 就能去掉 mock。
- [ ] **`studio-video-prompt-wiring.test.ts` 第 3 条只读 `canvas/pages/canvas/project.tsx`**：那个页面全仓无人引用，Studio 打不开；随页面一起处置（删页面时删这条）。

### 2026-10-20 · H3 视频台词被厂商改写删掉、首尾帧只写在文字里（本地实现，未发布；说明见 `docs/ip-studio-video-modes.md` 末节）

- [x] ~~**看不到厂商实际用的描述**~~ **2026-10-20 本地完成**：worker 把查询响应的 `promptOptimization` 存进任务 `payload_json.vendor_prompt`，画布候选投影 `promptRewrite`，创作面板 / 任务列表 / 「本次创作输入」三处显示实际描述和没保留的台词（`VideoPromptRewrite`、`studio-video-prompt.ts`）。只是成片后的解释。
- [x] ~~**台词没有办法要求原样交给模型**~~ **2026-10-20 本地完成**：Studio 视频参数加「按原文生成」→ 请求体 `optimizePrompt:false`（厂商公开契约字段），仅聚算 H3 显示，价格不变。
- [x] ~~**视频生成区优化过的提示词又被厂商改写一遍**~~ **2026-10-20 本地完成**：带 optimizationId 且模型会改写时发 `optimizePrompt:false`（契约：已手动优化的 prompt 应传 false），省一次厂商优化费。
- [x] ~~**描述写了图1 / 尾帧但请求里没有图**~~ **2026-10-20 本地完成**：提交前确认一次（仍按文字生成 / 改用首尾帧选图片 / 关闭），不替用户挑图、不悄悄改模式。
- [ ] **付费验收：按原文生成的效果**：同一段带中文对白的描述，H3 `optimizePrompt=true/false` 各出一条，逐句听台词是否完整、口型与画面是否明显变差；再试把台词放进引号能否让厂商改写器保留整句。结论决定要不要改默认值，以及面板提示怎么写。需要用户授权付费调用。
- [ ] **反馈给聚算**：自动改写把整句中文对白改成只剩开头两个字（线上 2026-10-20 15:39 `job_bbfdab24e8b4427219a1c734`，`optimizationVersion=v8`），表情说明里引用的同一个词疑似被当成了全部台词。这是厂商侧行为，我们只能事后核对或选择不改写。
- [ ] **助手制作计划里的视频步骤还不能选「按原文生成」**：`StudioPlanSteps` 组出的视频请求走厂商默认改写；要支持需在计划步骤的 video 设置里加这个开关并让确认卡显示。
- [ ] **视频生成区（带货）界面没展示厂商实际用的描述**：数据已存在任务 `payload_json.vendor_prompt`，`VideoStudioJob` 还没投影。
- [x] ~~**Codex 复审 47c057ea 三项**~~ **2026-10-20 本地完成**：共用视频胶水（含旧画布页生成 / 重试）沿用按原文生成并先问首尾帧；记录改写结果改为锁行后只更新 payload_json 一列（真 H2 交错测试）；推荐模式按首尾帧语义与容量选。说明见 `docs/ip-studio-video-modes.md` 末节。
- [ ] **搬来的旧画布页 `canvas/pages/canvas/project.tsx` 没挂到任何路由**：Studio 画布走 `StudioFlowCanvas`。它的视频生成 / 重试已接上同一套按原文生成与首尾帧确认，但页面本身是否保留、何时删，需要单独决定（删前确认没有隐藏入口）。
- [ ] **提交前整体检查只看「视频生成」默认端点有没有 Key**（`MaterialVideoJobService.submit` → `ensureConfigured(app)`）：选了别的已配好模型、默认端点没 Key 时也 503 `VIDEO_NOT_CONFIGURED`，前端还会把这个 503 当成「待确认原任务」。2026-10-20 本地库副本验证时遇到；线上默认端点是 H3，暂不受影响。

### 2026-10-19 · Codex 本地全量验收（`docs/audits/studio-local-full-e2e-20261019.md`）复核与修复（本地，未发布）

- [x] ~~首页带话进画布不自动发送~~ **2026-10-19 已修**：助手默认打开后，首页那句话晚一步到达，`studio-assistant.tsx` 把空输入框当草稿存下又立刻恢复，盖掉了它。改为线程读完且为空时再填入（`briefApplied`），发出后去掉地址里的 `send=1`。用例 `the homepage brief still goes out when it reaches a panel that was already open`；演示模式实测首页 → 画布只发一次。
- [x] ~~普通创作被绑成「参考视频复刻」~~ **2026-10-19 已修（含 server）**：`StudioSkillRouter` 去掉「只有一个技能就用它」，无命中不绑技能（全能创作），`default` 只用于平手；`BUSINESS_RULES` §19 同步。用例 `StudioSkillRouterTest` / `StudioDialogueRoutingTest`。
- [x] ~~复刻分析方案因 questions 写法被整份拒绝~~ **2026-10-19 已修（含 server + 提示词）**：`StudioPlanValidator.questions` 认 `{id,text,defaultAnswer}` 等常见写法；没有可用视频模型时 `ProposePlanTool` 回 `VIDEO_NOT_CONFIGURED` 并让模型如实告诉用户（此前编出 `sora-2`）；方案提示词把 questions 写成字符串，对话提示词不在正文写素材编号、不把没说过的金额说成用户说的（示例里的「上限 300 积分」曾被当成用户原话）；`SEED_VERSION` → v15。
- [x] ~~回复已结算、页面一直停在「停止」~~ **2026-10-19 已修（server）**：Next 的代理对 `text/event-stream` 做 gzip，压缩缓冲把事件攒到连接结束（30 分钟）才吐出。事件流响应改带 `Cache-Control: no-cache, no-transform` 与 `X-Accel-Buffering: no`（`StudioDialogueController#events`）。经真实 Next 代理实测事件即时到达；生产 nginx 直连后端，也加了禁止缓冲。
- [x] ~~素材库里的 AI 生成素材、裁剪图标成「你上传的」~~ **2026-10-19 已修**：上传入口写 `metadata.origin='upload'`，裁剪 / 拆图写 `'derived'`，判断收在 `canvas-bridge/studio-node-origin.ts`；老节点没有记号时只认存储在上传区（`ipstudio_source/`）且不属于任何 Studio 来源的。
- [x] ~~未发送草稿刷新丢失 / 选的对话模型刷新回默认~~ **2026-10-19 已修**：`canvas-bridge/studio-assistant-memory.ts`，按画布存在本浏览器（只是便利，不是真值）。第一版在卸载时写草稿，开发模式 StrictMode 双跑时把刚恢复的草稿抹掉了，改为初始化读取、改动即写回；补了 StrictMode 用例。
- [ ] **两个模型都显示「未命名模型」**（判定：配置问题，不改代码）：`PRODUCT.md` 规定未配 `modelAlias` 就显示「未命名模型」，本地验收库的端点都没配别名。可做的防呆：后台在「用户可选」的场景候选缺别名时提示；上线前核对生产各候选端点的别名是否齐全。
- [ ] **复刻端到端仍未验收**：本地 Agnes 视频候选没有制作合同，视频生成显示「尚未配置模型」；修完上面几条后需要配好视频模型，从首页一句复刻请求重跑「分析报价 → 确认 → 生成 / 检查 → 成片 → 刷新恢复 → 账本」。
- [x] ~~**同日另一份用户视角验收**（`docs/audits/studio-user-journey-acceptance-20261019.md`）的剩余条目~~ **2026-10-19 已修（本地，含 server + 提示词 v16）**：
  - 「写一段文字」只回在对话里：对话提示词要求可直接用的文字用 `create_nodes` 放进画布；回复下面加「放进画布」（不依赖模型调用工具，同内容不重复建）。
  - 复刻检查把与方案冲突的画面判通过：执行器把「被检查那一步的指令 + 已确认方案的改变 / 保留」写进检查目标（`StudioPlanSteps.checkTarget`），检查提示词要求以替换对象为准、依据与结论不许矛盾。**真模型未重测**。
  - 成片默认勾上原片：拉片片段（`studio.sourceRange`）与拉片分析的参考原片（执行器出拉片节点时连过去；手动解析靠 `recreation.sourceNodeId`）默认不勾。已有画布上执行器早先建的拉片节点没有那条连线，参考原片仍会勾上，片段不会。
  - 首页「复刻一条短视频」直接发出收费首轮：复刻类想法（`studioBriefNeedsReference`）不自动发，进画布打开素材清单、保留原话；首页对话框说明回复按用量扣少量积分。
  - 历史回复裸露 `<tool_call>`：显示时折叠成「这一轮没有执行的操作原文」（`studio-reply-actions.ts`，2026-10-20 起也折叠 `<studio-actions>`），原文保留。
  - 画布同名：首页想法直接当画布名；没起过名的画布在第一条消息时按消息起名，用户改过的不动。
- [ ] **上面两轮修复都要真模型复验**：Agnes / 线上对话端点上看一次「写一段文字」是否自己建了文字节点、复刻检查遇到旧主体是否判 fail；配好视频模型后从首页一句复刻请求走完整链。
- [ ] `ForgeController` 的两个 SSE 接口（形象锻造，v0.60 已下线入口）没有加 `no-transform`；若重新启用，照对话事件流补上。

### 2026-10-20 · 线上报错

- [x] ~~上传 8 MB 以内但像素超限的图片（长截图、高像素照片）报「图片最长边不能超过 8000 像素，总像素不能超过 2400 万」~~ **2026-10-20 已修（本地）**：`prepareStudioImageUpload` 原来只在超过 8 MB 时缩图，现在也按服务端的像素上限（最长边 8000、总像素 2400 万）判断，超了就缩到最长边 4096 再传；在上限内的照旧原样上传。上传到节点失败时把原错误对象交给提示，不再显示成 `CLIENT_ERROR`。浏览器实测 9000×2000、168 KB 的 JPEG 传出去是 4096×910。

### 2026-10-19 · Codex 补齐环境后的复测（同一份报告末节）复核与修复

- [x] ~~首页首句在真实环境仍不发送~~ **2026-10-19 已修（`f47bf68a`，含 server）**：服务端不再把没有轮次的首页想法记录导入成旧对话；前端「空线程」只看本线程消息。
- [x] ~~R1 后台做完首次打开视频是空卡~~ **2026-10-19 已修（`f47bf68a`）**：`SignedVideo` / `SignedAudio` 按存储 key 签名，卡片 / 故事板 / 成片结果按 key 渲染。
- [x] ~~R2 保存 500 后关页重开，助手建的节点丢失~~ **2026-10-19 已修（`bde5956c`，2026-10-20 已上线 `20261020-studio-dialogue-fixes`）**：画布游标 0 也持久化（`persistableCanvasCursor`），重开按正常命令重放，不再落入只重建执行产物的恢复回放。
- [x] ~~R3 插话用掉预算后「继续」返回 402、没有追加卡~~ **2026-10-19 已修（`bde5956c`，含 server，2026-10-20 已上线）**：恢复不再预检预算，交给执行器发追加卡；等用户时一律给「继续制作」。
- [x] ~~R4 冲突态下点发布进了发布弹窗~~ **2026-10-19 已修（`bde5956c`）**：改为打开三选一冲突框。**未上线**：依赖还没发布的三选一冲突框 `6e9e7b3a`，线上冲突时由 publish-gate 拒绝发布；`6e9e7b3a` 上线时一起发。
- [x] ~~R5 Agnes 先报假价、说「不确认不会花钱」~~ **2026-10-19 提示词已改（种子 v17，2026-10-20 已上线）**，需真模型复验。
- [ ] **发布重启期间用户看到红色「服务器处理请求失败（HTTP 502）」**（2026-10-20 15:40 实测）：后端停约 46 秒（旧进程等视频线程约 30 秒才退出），这段时间的保存、积分查询全部 502。前端应把网关 502/503/504 当临时故障自动退避重试并提示「服务正在更新」，不弹错误框；2026-10-23 本地已补画布保存有界退避恢复（未发布），保存中不立即弹错误；积分等其他读取与无停机发布仍未完成。
- [ ] **恢复回放仍不重建助手自己建的节点**（另一台浏览器 / 清过存储时）：为了不把用户删掉的节点又建回来，恢复只重建执行产物。要彻底解决，需要把「用户删掉过的助手节点」记进画布文档，再让恢复回放带上助手节点。
- [ ] **聊天被阶段预算拦下时，服务端不会自己发追加卡**：现在提示用户点「继续制作」拿到追加卡；更顺的做法是对话受理被预算拒时直接发同一张追加卡。

### 2026-10-19 · 成片编辑器改版后续（前端已改，本地未发布）

- [x] ~~**服务端把「配音过长 / 字幕超时」挪到拼接之前判**~~ **2026-10-19 完成**：`DramaAssembleService.assembleKeys` 在下载完各段、拼接之前调 `StudioPackagingService.precheck`（各段时长之和 + 拼接容差），与 `decorate` 共用 `checkCaptions` / `checkSpeech`，配音只下载一次；测试 `DramaAssembleStudioPrecheckTest`。原描述：`DramaAssembleService.assembleKeys` 先下载、拼接（可能整段重编码）完，`StudioPackagingService.decorate` 才判 `STUDIO_SPEECH_TOO_LONG` / 「字幕时间超过成片时长」，用户白等一次。各段 `probeMedia` 的时长之和在拼接前就有了，可以先判再拼。前端（`studio-work-clips.ts` 的 `studioCaptionProblem` 与 `StudioWorkEditor` 的配音判定）已按同一规则提前拦，服务端仍是最终裁判。
- [x] ~~**成片编辑器只支持整段拼接**~~ **2026-10-19 完成（高级编辑）**：成片页加「高级编辑」（Twick），可掐头去尾、切开、删段自动补位、加文字和字幕、两条音轨各调音量；导出交服务端 `StudioEditGraph` 用 FFmpeg 合成。转场、变速、画中画不做。
- [ ] **高级编辑的成片不做响度归一**：一键成片的包装链也没有统一响度，高级编辑按素材原音量混音（多路相加不压低）。真用户反馈「忽大忽小」再加两遍 loudnorm（`ClipLoudnessNormalizer` 的做法）。
- [ ] **Twick 是打了补丁的固定版本 0.15.31**：`patches/@twick__media-utils@0.15.31.patch`、`patches/@twick__timeline@0.15.31.patch` 修「清空 video.src 触发 onerror 后无限重试」（原版 2 秒内建出 3 万个 video）。升级前先看上游是否已修；升级后重跑 `node apps/web-aiavatar/scripts/scope-twick-css.mjs` 重新生成 `twick-scoped.css`，并在浏览器里开关一次高级编辑，确认 `<body>` 下没有遗留的屏幕外 `<video>`。
- [ ] **整片预览是前端连放**：画面比例按成片画幅加黑边、文字按服务端位置近似叠加，和成片可能有细微差别（字体、换行）；界面已注明「合成后以成片为准」。

### 2026-10-18 · 全能创作对话驱动视频复刻（S1/S2 本地实现，未发布）

- [x] ~~上线后第一次真对话卡在动作协议与整理方案~~ **2026-10-18 已修并上线**（`20261018-studio-toolcall-tag` / `-plan-contract` / `-plan-structure`）：`<tool_call>` 写法、规划输入共用 `StudioWorkflowService.skillPlanConstraints`、`ModelJson` 去围栏、questions 两种写法、分析阶段顺序与 `videoModel` 端点 id 校验；测试 `DialogueActionProtocolTest`、`ProposePlanToolTest`、`StudioPlanValidatorSkillTest`。
- [x] ~~拉片被聚算 Qwen 视觉模型 400 `unsupported_geometry` 拒绝~~ **2026-10-18 已修并上线**（`20261018-studio-vision-budget`）：总览图（最长边 2800）超出该端点视觉预算，同一批画面按 1600 → 1024 → 640 缩小重试，实测 640 通过、分段分析的 960 帧原样通过；`StudioVisualBudgetTest`。
- [x] ~~分析步骤失败后进度条只有「停止」~~ **2026-10-18 已修并上线**（web `20261018-studio-retry-step`）：`needs_user` 下失败步骤显示「重试这一步」、待确认步骤显示「继续制作」，调用既有 resume；`studio-dialogue-execution.test.tsx`。
- [ ] 步骤失败只改执行状态、不往对话线程发消息（`StudioPlanExecutor.needsUser`）：用户只能在进度条看到原因，助手也不会主动说明；考虑在失败 / 待确认时发一条执行消息（沿用 `postExecutionMessage`，按原因去重）。
- [x] ~~`[asset-library] retry indexing` 无限重试刷 WARN~~ **2026-10-18 已修并上线**（`20261018-studio-owned-prefix`）：根因是合成成片 key 带 `media/` 前缀、归属检查不认；重启后归属类警告与重试均为 0。遗留建议：确定性失败应标记跳过，不要永远重试。
- [ ] 线上对话端点 `ai-studio-jusuan-qwen38` 未声明流式 / 工具调用 / response_format：当前走 JSON 动作协议与整段回复。若供应商实际支持原生工具调用，在后台勾选后可省掉标签解析这一层（需先用真实请求核实）。

- [x] ~~接入前产品问题：全画布模板复制后视频模式回退首尾帧~~ **2026-10-18 已修**：`IpDemoTemplateService.snapshotForTemplate` 保留 `videoMode/vquality/videoCount`，并从剥掉的 request 派生 `studio.videoPreset`；测试 `IpDemoTemplateStripTest.fullCanvasSnapshotKeepsNativeVideoModeAsPreset`。
- [x] ~~接入前产品问题：合成成片保存触发 IP_ASSET_KEY_INVALID~~ **2026-10-18 已修**：`DramaAssembleService.studioAssemblyPrefix` 改用 `FileStorageService.ownedKeyPrefix(CATEGORY_GEN, uid)`，与 `ownsAssetKey` 同源；存量按旧规则生成、uid 含特殊字符的成片 key 仍不被识别（需要时按 storage_asset 回查补归属）。
- [ ] **S0 付费实测未做**（方案 §S0实测矩阵）：remap-subject（H3 / Seedance 2.0 各半）、creative-rewrite、长段比例、音频默认、检查可靠性、完整费用，需要用户单独批预算后在线上手工跑；结论回填方案与技能正文，决定哪些检查项进 `autoFixChecks`。
- [x] ~~S3 未做~~ **2026-10-18 完成**：`ip_skill` / `ip_skill_version`（V63）、后台「Studio 技能」页（查看 / 编辑 / 发版 / 回滚 / 停用 / 试跑 / 审阅发布草稿）、多技能路由（`StudioSkillRouter`）、运营蒸馏草稿（`StudioSkillDraftService`，prompt `dap.ip_studio_skill_distill`）；测试 `StudioSkillRegistryTest` 等 38 项。仍只有一份技能内容；第二份技能要等 S0 结论再写，不凭空编。
- [ ] **自动修正白名单为空**：检查只建议；`autoFixChecks` 要等对应检查项的 S0 可靠性结论（后台技能页已能改这一字段，但没有实测依据前不要改）。
- [ ] **多节点部署**：对话实时广播是进程内（`StudioDialogueEventHub`），多实例需换跨节点发布订阅；单节点下断线靠 SSE 续播 / 轮询回落。
- [ ] **前端 docVersion 未从工作台传入助手**：`node.upsert` 带 `expectedDocVersion` 时被跳过并提示「画布已变化，稍后重试」；需 `project-sync.ts` 暴露当前基线并经 `studio-workspace` 传给 `StudioAssistant`（prop 已存在）。
- [ ] **对话循环不直接向模型发图**：附件以对象 id 进上下文，看图依赖拉片 / 解析工具；端点开流式但不回用量会以 `AI_USAGE_MISSING` 失败（后台开关旁已提示）。
- [ ] **openapi / 前端未覆盖的事件**：提问卡与改稿卡没有专门事件，前端在 `turn.done` 后重拉快照；410 过期期间漏掉的画布命令不重放。
- [ ] **Codex 本地验收明确无法验证、需上线前另做**（2026-10-18，`.studio-e2e/report*.md`）：真实供应商端点的流式与首字延迟、真实原片的语义理解与成片质量、视觉 check 准确率、真实企业付款与撤销、生产 MySQL 全量 Flyway 升级（本地隔离 H2 关闭了 Flyway 由 Hibernate 建表；V60–V62 的专项测试通过）、跨实例租约竞争与 90 分钟超时实跑。
- [x] ~~**执行期间不能换新的计划修订**~~ **2026-10-19 完成**（本地，未发布）：同阶段新计划在原执行上替换剩余工作，未变且已完成的步骤保留结果，改动及其下游重做（`previousRunIds` 计费）、在途步骤不改写；`StudioPlanExecutionService.replanStage`，测试 `StudioPlanExecutionServiceTest` 三项、`StudioPlanExecutorTest.earlierAttemptsAReplanReplacedStayInTheStageBudget`。同批修 Codex 2026-10-19 的另五项：节点保存成功才记「已投影」与画布游标、对话轮次用执行的固定付款人、追加预算确认后自动继续、打字「先停 / 暂停」走优先控制（`StudioStopIntent`）、助手所选模型随请求发出。端到端用例见 `docs/runbooks/studio-e2e-cases.md` §1.4。
- [ ] **后台转向只到「停下并开一轮回复」**：执行器读到新指令时停在 `needs_user` 并开对话轮次，由模型重新编排与发新确认卡靠提示词引导，没有自动重编译（Codex D03 的最低方案）。2026-10-19：新卡确认后已能在原执行上换掉剩余工作（见上一条），但「由模型重新整理计划」仍靠提示词，没有服务端按转向内容自动重编译。

### 2026-10-17 · 企业群发邀请

- [x] **群发分享与注册加入闭环**：90 天/一年、多人可用链接、企业宣传片新头图；本地短信流程与 MySQL 通过，已生产发布。见 [本地记录](docs/releases/ip-studio-enterprise-invitation-validation.md)。
- [x] **企业邀请及后台测试账号发布、线上验收**：ID `0dc48cb9` + 产品 `d8195896`（server V59、Studio、admin）；同一链接两位独立测试身份正常 OIDC 后加入企业，后台创建/复制/停用通过；临时企业已关闭、邀请撤销、4 个验收身份停用，账本 810 条未变。按用户要求无需短信；真实短信首次注册本次未重测，见 [生产记录](docs/releases/ip-studio-enterprise-invitation-production-release-20261017.md)。

统一 Studio 的后续事项。旧画布适配层的历史限制另按原主题保留，不能据此推断当前 Studio 也缺少同一功能。

### 2026-10-17 · 拉片原声与音频节点后续

- [x] ~~拉片提取完整原声~~ **2026-10-17 已生产发布（f8d8cf1b）**：`StudioSourceAudio.extract`为解析/拉片提取本人WAV，`output.sourceAudio`持久检查点与签名，普通音频节点稳定落地、跨同源任务复用；可用现有成片音轨选择替换音轨，无ASR或新增模型调用；用户要求直接发布，未追加页面验收。已有证据见[技术分享第7节](docs/audits/studio-film-study-technical-sharing-2026-10.md#7-按产品边界收简拉片只提取原声)。
- [ ] **音频节点高阶工具（后续独立能力）**：字幕提取/ASR、编辑与SRT/VTT导出、音频翻译、人声/背景音分离留在音频节点显式触发，不纳入拉片必经流程。当前`audioAnalyzed=false`不变，供应商与报价尚未确认；既有原生视频全能参考链可传音频，具体开放以模型合同为准；音频节点高级操作仍未接入。

### 2026-10-15 · 主子账号与算力管理（已生产发布）

- [x] **评审并工程化主子账号方案**：方案、功能、本地产品场景验收与发布准备已完成。见 [v0.4 精简方案](docs/ip-studio-team-accounts-plan.md) 和 [开发任务清单](docs/archive/ip-studio-enterprise-development-tasks.md)。用户已确认分配积分仍归企业、可以回收，产品开通沿用现有逻辑、不做企业席位；采用单企业归属、固定 RBAC、人工充值与批量分配/回收，不做月配额或多团队。任务进度以以下条目为准；2026-10-15 已部署 `f068b51d` 并开启企业功能，见 [生产发布记录](docs/releases/ip-studio-enterprise-production-release.md)；本地完整场景结果见 [交付验收](docs/releases/ip-studio-enterprise-complete-validation.md)。
- [x] ~~E01 契约与规则~~ **企业方案 v0.4 完成，2026-10-15（批次验收）**：类型/API调用层、28项schema和基础/计划路径、权限/幂等业务规则；现有开通逻辑保留。见 [验收记录](docs/releases/ip-studio-enterprise-foundation-validation.md)。
- [x] ~~E02 数据迁移~~ **企业方案 v0.4 完成，2026-10-15（批次验收）**：V56企业与账户结构、当前归属唯一约束、个人钱包元数据回填；H2/MySQL历史金额与账本保留验证。见 [验收记录](docs/releases/ip-studio-enterprise-foundation-validation.md)。
- [x] ~~E03 企业 RBAC~~ **企业方案 v0.4 完成，2026-10-15（批次验收）**：13个基础操作覆盖邀请/撤销/角色/策略/双方移交/审计；唯一归属和竞争移交并发验证。停用/退出资金处理仍属E08。见 [验收记录](docs/releases/ip-studio-enterprise-foundation-validation.md)。
- [x] ~~E04 钱包核心兼容~~ **企业方案 v0.4 完成，2026-10-15（批次验收）**：按walletId共用核心、原userId包装、wallet→hold锁序、引用核对、划拨类型及统计排除、个人和财务回归。见 [验收记录](docs/releases/ip-studio-enterprise-foundation-validation.md)。
- [x] ~~E05 分配/回收~~ **2026-10-15 本地完成**：1–100人原子划拨、预览重验、正文幂等、原来源/桶保留，H2/MySQL各17项通过；真实页面完成2人分配回收。见 [第二批验收](docs/releases/ip-studio-enterprise-points-validation.md)。
- [x] ~~E06 财务充值与退款~~ **2026-10-15 本地完成**：V57原充值来源、固定企业钱包、凭据去重、人工核准/退款和汇总；H2/MySQL各15项通过、迁移两库通过；浏览器充值→分配/回收→人工退款通过。见 [第二批验收](docs/releases/ip-studio-enterprise-points-validation.md)。
- [x] **E07 生成准入**：全部 Studio/原生入口显式付款、最终模型/在途准入、原任务授权与冻结、原生视频重试绑定完成；旧个人兼容。见 [入口映射](docs/ip-studio-enterprise-generation-entry-map.md)。
- [x] **E08 结算与生命周期**：V58持久授权/回执、同事务部分结算与原任务恢复、停用/退出/重入旧退款归原企业；MySQL生命周期17/17。见 [完整验收](docs/releases/ip-studio-enterprise-complete-validation.md)。
- [x] **E09 企业/成员前端**：完整成员/邀请/授权/策略/移交、生命周期预览、两份余额、每次付款与记录；企业专项36项，桌面/390px实页验收。见 [界面验收](docs/releases/ip-studio-enterprise-ui-validation.md)。
- [x] **E10 财务前端**：企业搜索、资金/成员/划拨/消费查询及人工财务闭环完成，后台交互13项；原任务恢复仅平台运营，财务403。见 [界面验收](docs/releases/ip-studio-enterprise-ui-validation.md)。
- [x] **E11 集成验收**：18个产品场景按真实JPA/MySQL、本地HTTP/TLS与浏览器分别验证，迁移/个人兼容通过；三条未知任务实际核对并释放46，最终企业992/冻结0/消费8。见 [完整验收](docs/releases/ip-studio-enterprise-complete-validation.md)。
- [x] **E12 发布准备**：默认关闭/指定企业试点、原任务对账与兼容回退准备完成；真实关闭后端企业开关仍可个人生成（1992→1984），企业992不变，平台财务对账保留。已按本次授权发布 `f068b51d`，三服务/开关/V56–V58及线上只读验收通过，20钱包/781账本/132开通逐条未变；生产未登记模拟资金或调用收费模型。见 [生产记录](docs/releases/ip-studio-enterprise-production-release.md)。见 [发布准备](docs/releases/ip-studio-enterprise-release-readiness.md)。

### 2026-10-08 · 统一 Studio 首版（v0.202 后续）

- [ ] M5 专属声音克隆：当前 Qwen3 TTS 只开放官方固定音色。未发现现有 Account API Key 可调用的克隆写接口，不能将预设声音冒充克隆。

- [ ] 后续增量：实例输入原地重绑、自动拼板裁取、全平台指标。现有6/8包按实际采用数量标为部分输出；模型画质不作为本轮功能验收门槛。

- [ ] Studio 公开画布与复制（暂缓）：2026-10-09 用户明确本轮不做，仅保留个人画布发布为模板。已有对话分享保留，不代表整画布能力。

- [ ] **未知视频受理的人工容量核对入口**（2026-10-09）：`MaterialVideoModelClient.SubmissionUnknown` 且没有 externalTaskId 时保留容量票据，禁止重发；运营目前须核对供应商原请求。后续管理入口必须保存核对依据并仅在确定无上游在途任务时解除容量，不能做一键批量强制释放。

- [ ] Studio LibTV 剩余 P1：导演配置/长剧分段改稿、Skill 协议与调用范围；完整音视频理解、30–300 秒原生长视频、声音克隆分别等待真实模型合同。P2：社区特效动态媒体、原生效果及 AutoLink/额外图片参数。整画布分享仍暂缓，个人发布模板保留；清单见对齐文档顶部。

### v0.225 · 剧本富文本专项后续（2026-10-09）

- [ ] 后续独立规划：复杂表格、选区差异合并与长文分段改稿；当前未承诺协作文档。

### v0.228 · 生产发布收尾（2026-10-10）

- [ ] **Studio 新用户 OIDC 登录闭环验收证据**（2026-10-13 澄清）：[生产发布记录](docs/releases/ip-studio-production-release.md) 已确认真实认证配置、匿名跳转账号中心和生产业务验收，但业务验收使用临时登录交接，未记录完整新用户 OIDC 登录闭环。先核对后续验收记录；若仍缺，补账号中心登录 → 回到 Studio → 读取本人画布的验收，无需重复付费生成。

- [ ] 核实 x-dub 聚算每秒积分成本后开放口型生成。

- [ ] 后续统一供应商积分、平台积分与人民币换算。

### v0.230 · 账号与旧 Studio 统一（2026-10-10）

- [ ] `proto/screen-more.tsx:MSettings` 的通知/水印/归档开关仍为旧本地状态；本轮只统一外壳，持久化业务需后续单独接通。

- [ ] `DapAccountService.account` 的 `planLabel=PRO` 为旧固定值；后续会员权益展示需按真实产品开通/权益建模，本轮不改后台政策。

## 已定位问题与后续限制

- [ ] **存量 clip DTO/TS 镜像漂移**（2026-10-15 附加检查发现）：`ClipDtos.java` 的 TemplateDto.sourceProjectId/createdBy、JobDto.segments、AvatarDto.demoVideoUrl/demoAudioUrl、VoiceDto.demoAudioUrl 未在 `packages/types/src/clip.ts` 对应接口声明，导致全局 `pnpm check:wire-mirror` 报4组字段不一致。此项与企业开发分开处理；新增 enterprise 的15组镜像检查已通过。
- [ ] **存量 OpenAPI 重复键**（2026-10-15 严格语法检查发现）：`AsyncJobStarted` schema 与 `/me/wallet/withdraw` path 在原 HEAD 中均重复声明；普通解析和现有API检查通过，但重复键检查失败。与本批企业实现分开整理，新增企业契约无重复键。
- [ ] **素材视频客户端不带应用码的重载默认按 `celebrity` 解析端点**（2026-10-18 修 PR #131 的 CI 时发现）：`MaterialVideoModelClient` 的 `effectiveDurationBounds` / `resolveCreditCostOverride` / `validateRequest` / `firstFrameNeedsStorageKey` / `resumeExistingTask` / `pickEndpoint` / `requireEndpoint` 少传 appCode 时一律按 `celebrity` 的开放范围找端点。短剧出片（`DramaRenderService` 时长校验与模型下拉）、短剧画布（`DramaCanvasRunService` 片段时长上限）、Studio 模型下拉（`IpStudioController.capabilityWithDuration`）已改为显式传应用码；`MaterialVideoWorker:192` 结算时的 `resolveCreditCostOverride(endpointId, durationSec)` 仍按 `celebrity`，只对 Studio / 短剧开放的端点取不到候选价，会退回按冻结价结算。建议删掉不带 appCode 的重载（AGENTS.md §8.0.1 ④），让编译器把剩余调用方都找出来。

按原产品与巡检主题保留定位、触发条件和已知边界。历史线上状态需在处理时重新核对；涉及本地数据库的条目不代表生产故障。

- [x] ~~**异步模型调用丢用户，未归属筛选无效，多模态消耗被 Token 界面隐藏**~~ **2026-10-21 已发布**：六类 worker 执行入口建立可恢复的 `AiModelUsageContext`；显式归属优先，成功/失败/恢复路径共用。用户与租户 `IS NULL` 筛选覆盖普通/分页接口与后台；模态聚合、独立次数/秒数/Token/成本、趋势和导出可见，兼容图片返回 Token，补音乐供应商完成用量。历史流水保留原样。真实异步 Studio 对话集成验证两次模型调用归属，发布验收见 `docs/releases/model-usage-attribution-production-release-20261021.md`；业务规则见 `specs/BUSINESS_RULES.md`「模型用量归属与多模态统计」。

### 2026-09-30 · 视频生成区 v0.199 后续（真源 `docs/video-studio-plan.md` §8）

- [ ] **视频生成区表单：`update` 用旧选择拼新选择**（2026-10-03 线上实测发现）：`VideoStudioForm.tsx` 的 `update = (patch) => setSelection({ ...sel, ...patch })` 读的是上一次渲染的 `sel`，同一拍里连调两次（脚本连点、或以后某处一次改多项）后一次会盖掉前一次。人手点两次中间必有一次渲染，用户碰不到；改成函数式 `setSelection(prev => …)` 即可。

- [ ] **视频生成区：补封面（`MaterialVideoCoverBackfill`）的两个限度**（v0.199.1 Codex 评审提出，现在不改）：① 每次启动都从最新的 50 条没封面的视频生成区任务看起，补不上的行（成片不在我方存储 / 文件坏了）不会被跳过，积到 50 条以上就会挡住更早的；线上新任务出片时就截好封面，积压只会是截帧失败的个例，真积起来再加游标或失败标记。② 本机 `aep.cdn.driver=local` 时 `FileStorageService.openForRead` 读不到 `LocalFakeCdnUploader` 写在 cdn-mock 里的成片，所以 dev 里关掉了（`aep.material.video.cover-backfill.enabled=false`）；要在本机验补封面，得配 OSS 或让 `openForRead` 认得 cdn-mock。

- [ ] **视频生成区：智能优化回的是英文**（2026-10-03 真厂商实测；厂商没有「输出中文」的选项，`dialogueLanguage` 管的是片中台词）：v0.199.1 先在面板上加了一句说明（`OptimizePanel` + `isMostlyEnglish`）。候选：如果用户常常改用原提示词、或者把英文删了重写，再考虑给优化结果配一段中文对照（每次多一次 AI 调用，要定价）。

- [x] ~~**视频生成区：智能优化调用没进用量统计**~~ **2026-10-21 已发布**：`recordPromptOptimization` 单独按 `VIDEO_PROMPT_OPTIMIZATION` 记录一次成功调用，原幂等键按端点锁去重，重试不增加计费次数；失败记录独立保留。没有独立供应商成本价时不套用视频每秒价，成本未估价；`MaterialVideoModelClientOptimizeTest`、`AiModelUsageAttributionTest` 覆盖重试与价格口径。

- [ ] **视频生成区：模板直接引用原作素材的 key，不复制文件**（docs/video-studio-plan.md §10）。今天本区没有删除素材的入口、存储也不自动清理，所以不会断；哪天加了「删除素材」或存储清理任务，要先查 `video_studio_template.recipe_json` 里的引用，否则别人做同款时素材 404。

- [ ] **本机 `aep.cdn.driver=local` 时，非聚算协议（seedance / agnes / 通用）带首帧 key 会在 worker 里 502 `VIDEO_REF_UNREADABLE`**（2026-10-01 短剧画布会话告知）：`FileStorageService.upstreamFetchUrl` 给的是本机 `/cdn` 地址，厂商拿不到；生产走 OSS 签名地址不受影响。本地联调这几个协议的首帧要配一个公网能访问的 CDN，或者只用聚算协议测。

- [ ] **出片的创建请求没带 `Idempotency-Key`**（智能优化已经带了）：厂商强烈建议创建请求带稳定幂等键。今天 worker 不重发创建，所以不加也不会重复出片；哪天要做「提交超时后按原键恢复」时再加（键用任务 id）。

- [ ] **带平台标识的成片**（`deliveryMode=marked`）没接：默认镜像的是无可见水印的原片。需要时在 worker 下载受保护产物那一步追加参数并处理 202 重试。

- [ ] **带货脚本视频的模型下拉：停用的默认候选显示价与冻结价对不上**（v0.199 评审时顺带确认的老问题）：`MaterialVideoJobService.listModels` 在列表为空时合成默认项（`candidate=null` → 显示每条 30），而提交时 `resolveCreditCostOverride(null, …)` → `AiModelInvocationService.resolveEndpoint(purpose, null)` 取候选行**不看 enabled**，照样按候选 override × 秒数冻结（15 秒 600）。视频生成区已改成「候选在但停用 → 不合成」（`VideoStudioService.listModels`），带货脚本线要不要跟着改是产品决定：改了之后运营停用默认候选，脚本视频工坊会显示「未开通」。

- [ ] **提交要求有默认绑定**：`MaterialVideoJobService.submit` 开头的 `modelClient.ensureConfigured()` 只看默认绑定，即使请求显式选了一个可用的候选，默认绑定缺失也会 503 `VIDEO_NOT_CONFIGURED`。目前生产一直有默认绑定，不影响；哪天要支持「只有候选没有默认」再改成按所选端点判。

- [ ] **`DapImageInput` 交给厂商的参考图是公开地址优先**（v0.172 的取舍）：`FileStorageService.publicUrl` 只拼域名、不管桶能不能匿名读，桶是私有的话就是 403。视频链 v0.199 已改为签名优先（短剧交给 seedance 一直用签名地址、生产跑通过）。dap 这条要先在生产核实桶的读权限再决定，别照搬。

- [ ] **视频生成区的生成记录是内存截断 100 条**：`MaterialVideoJobRepository.findScoped` 把该用户该分区的行全捞出来，服务层再截。量大之后加一个带分页的查询（`Pageable`），前端加「加载更多」。

- [ ] **`specs/openapi.yaml` 用严格 YAML 解析器读不过**（主干上就这样，v0.199 没有新增）：契约门禁是按行扫的，所以一直没暴露。2026-10-01 用 PyYAML 逐个扫出来的：
  - 流式映射里的值没加引号、内容含 `?` / `:` / `[...]`：`creditCost`（「override ?? 带货线默认价」）、`lyrics`（「[verse]/[chorus]」）、ip-studio 两处 `"200": { description: …status=running… }` 与 `…status=rendering…`；
  - 重复的键：`components.schemas.AsyncJobStarted` 定义了两次、`paths./me/wallet/withdraw` 出现两次（后一份会静默覆盖前一份）。
  哪天要用 openapi 生成客户端或文档时先修；修完可以把「严格解析能过」加进 `pnpm check:api-contract`。

  2026-10-13 复核：严格 YAML 解析仍在 `description: 积分单价（override ?? 带货线默认价）` 处失败；原行号已漂移，处理时以解析器实际报错为准。重复记录已归并。

### 2026-09-10 · 例行 QA 巡检（SSRF sweep）

- [ ] **Medium：短剧成片下载跟随重定向不逐跳复核 origin（SSRF via open-redirect）**
  `DramaAssembleService.java`（共享 `HTTP` 客户端 `followRedirects(NORMAL)` at ~L57；`download()`
  at L207-229 只校验首跳 origin）与 `DramaShortAssembleService.java`（同形，客户端 ~L55、
  `download()` L439-460）。`videoUrl`/`clipUrl` 来自 `DramaProject.payloadJson`（用户可经
  `PUT /me/drama/projects/{id}` 写入）。首跳 origin 命中 `trustedDownloadOrigins`（自身 +
  CDN/OSS）后，若该可信 origin 存在 open-redirect，`NORMAL` 会自动跟到内网/metadata 地址，
  不再复核。**修复口径**（与 `MaterialOpsService.resolveSubmittedVideoUrl` L471-509 已有的正确
  范式一致）：客户端改 `Redirect.NEVER`，手动逐跳跟随并对每个 `Location` 复核 origin 在
  白名单内（或按 `AssetDownloader` 新范式解析→IP 段黑名单）。**本轮未修的原因**：改动落在生产
  短剧合成下载链，其对平台自身 CDN/OSS 的合法重定向行为无法在沙箱内集成验证，收益（Medium，
  且需二级 open-redirect 才可利用）不抵在无人值守巡检里改产线下载路径的回归风险；建议专门排期
  （最好抽一个可单测的共享 `TrustedRedirectDownloader` 收敛三处，避免 §8.0.1 ④ 一处规则多份写）。

- [ ] **Low：`DapMultimodalClient.download()` 完全无 SSRF 防护**
  `DapMultimodalClient.java`（`download()` ~L457-485，客户端 `followRedirects(NORMAL)` ~L74-77）。
  仓库其余下载点均已加防护，仅此一处零校验。**非终端用户直接可控**——URL 来自 AI provider
  响应体（`data0.path("url")` ~L321，源自 admin 配置的端点），真要利用需上游 provider 被攻陷。
  与其余下载点保持一致性建议后补；但 provider 下载可能合法重定向到无法枚举的任意 CDN，加严格
  白名单反而有破坏正常下载的风险，需评估后再定口径。

### 2026-09-19 · 例行 QA 巡检（成片/音频/分镜下载：非 2xx 分支漏关 HttpClient 连接）

- [ ] **Low/待产品定：明星带货 `listProjectVideos` / `getVideo` 不按 owner 过滤（疑似 IDOR）**
      （本轮复核发现）：`CelebrityZoneService.listProjectVideos(projectId)`（L266）与 `getVideo(id)`
      （L283）不按 `ownerUserId` 过滤，任一认证用户可读他人 projectId 的视频列表 / 按 id 取任意视频
      （`GET /api/celebrity/projects/{projectId}/videos`、`/api/celebrity/videos/{id}`，controller 不传
      principal）。但 `listAllVideos`（L288）注释明说是「跨项目公共库」，强烈暗示视频库本就是共享展示位
      ——故**判定为需产品拍板，不武断当缺陷改**。`getProject`（L229）自身归属校验正确。

### 2026-09-14 · 例行 QA 巡检（充值存储交付 + 前端时间字段存量）

- [ ] **Low：`creditAccount`(RECHARGE) 无 `(source, referenceId)` 幂等闸**（`CreditService.java:259`）。
      当前 `settlePaidOrder` 的重复/并发靠 `markPaid` 条件占位挡住，够用；但这意味着「结算整单回滚后重试」
      不安全（会二次入账），也是上面那条只能走「告警补授」而非「回滚重试」的根因。真要让存储交付走
      自动重试/对账队列，需先给充值入账加订单级幂等键（参照 enrollment 的 `entitlement_grant`
      `UNIQUE(source, source_reference)`）。非漏洞，排期择机。

- [ ] **Low：`AlipayNotifyController.java:80` `Double.parseDouble(total_amount)` 只 catch
      `NumberFormatException`，漏 `total_amount` 缺失时 `parseDouble(null)` 抛 NPE → 500
      而非预期的 FAIL**（本轮复核发现，未修）。仅在**验签通过**的支付宝回调上可达
      （合法通知必带 `total_amount`），实际不可达，故降级记录；真要修把 catch 放宽到
      `Exception` 或先判 null 返 FAIL 即可。

### 2026-09-12 · 例行 QA 巡检（用户端 controller 健壮性）

- [ ] **Low：`formatCompactNumber` 负数丢符号**（`packages/api-client/src/format.ts` 约 L37，
      `apps/web-music/src/lib/format.ts` 同一份副本）：量级分支返回 `trimZero(abs/…)` 用的是绝对值，
      负数会渲染成正数（`-2300000 → "2.3M"`），而兜底分支保留符号。现有调用点均为非负量
      （粉丝 / 播放 / 销量 / 营收），实际不可达，故本轮未改；真要修需两份副本同改（§8.0.1 ④）。

### 2026-09-11 · 例行 QA 巡检

- [ ] **⚠️ `aiartist` OSS 桶曾公开可读（历史观察，当前权限待复核）**（v0.172 排障时发现，未修，需产品决策）：
      不带签名直接 GET 任意对象返回 200（实测 `media/ipstudio_source/...png` → 200 / 1.5MB）。
      这让 §4.7 那整套「签名 URL + TTL 防盗刷」形同虚设 —— 任何泄露出去的 key 都是**永久**可读，
      TTL 一点作用没有。两条路二选一：① 把桶改私有（v0.172 修好的签名是前提，否则改私有会让全站图片挂掉）；
      ② 承认这些资产就是公开的，停掉签名那套、也别在文档里再说它防盗刷。
      现在这个状态是最糟的：既有签名的复杂度与故障面，又没有它的保护。

- [ ] **每个模型支持的画幅不一样，而画布不知道**（v0.166/v0.167 连撞两次）：
      `flux2-klein-4b` 拒 `768x1024`；火山 `seedream 4.5` 要求 **≥3686400 像素**
      （只有 2k 1:1 与 4k 全系达标，2k 3:4 差 54 万像素）。现在只能靠 4xx 原话事后告知，
      用户得自己换档位重试。要做对得给 `ai_app_endpoint_candidate` 的 capability
      补尺寸约束（最小像素 / 允许列表 / 步长），`GET /models` 带出来，画布据此只列可用画幅、
      并在切模型时把不合法的当前画幅顶掉。

- [ ] **节点上的 `size` 会盖过画布全局档位**（`buildGenerationConfig`：
      `node.metadata.size || config.size`）。模板节点写死了 `768x1024`，所以用户在工具栏把档位
      切到 4k 之后，模板节点仍然发 768×1024 —— 只能逐个节点在设置里改。改精度取决于上一条：
      有了 capability 才好判断「这是用户特意设的」还是「模板给的默认值」。

- [ ] **两套 base_url 约定仍未统一**（v0.167 只是让 `joinUrl` 能容错）：
      `AiModelInvocationService` 拼 `{base}/chat/completions`（base 含版本段），
      `DapMultimodalClient` 拼 `{base}/v1/...`（base 是主机根）。统一成一套要动短剧与带货的
      端点配置，风险不在代码在数据，需要一次带迁移的收敛。

- [ ] **搬画布漏掉的「运行环境」还有没有第三处**：v0.161 补了 `QueryClientProvider`
      （少了它双击节点直接崩）。上游入口里可能还有别的 provider / 全局初始化没搬过来 ——
      对着上游的 `main.tsx` / `App.tsx` 通读一遍比等用户撞上强。

- [ ] **`metadata.url` 这个字段现在没人用了**：节点级图片地址统一走 `content`（v0.161）。
      老文档里可能还留着 `url`，读的时候无害。要清的话在一次写入时顺手删。

- [ ] **提示词库的自定义源机制还在**（v0.161 只清空了默认源）：用户仍可在配置页加远程源，
      拉回来的是 JSON 数据不是代码，但内容不经审核就进产品界面。要么去掉这个入口，要么加白名单。

- [ ] **接口建好但 UI 没接上，这一类要有守法**（v0.159 / v0.160 各栽一次）：发布按钮、模型下拉
      两次都是「服务端做完了、组件也写好了、typecheck 全绿，但没有任何地方引用」——
      死代码不报错，编译器查不出「组件没人挂」。现在靠 `publish-wiring.test.ts` /
      `models.test.ts` 两条结构测试各钉一处，属于事后补漏。要根治得有个通用检查：
      比如扫 `src/api` 与 `src/components` 的导出，找出「定义了但全仓无人引用」的。

- [ ] **模板能预设模型，但没预设**：`metadata.model` 现在真的会生效（v0.160 接通后
      `endpointIdFor` 会把它翻成 endpointId）。三套内置模板都没写 —— 留空即用后台默认端点，
      这样模板在不同部署间可移植。要给某套模板钉死模型，写端点名（不是 endpointId）更稳。

- [ ] **两套 UI 库共存**（antd 6 在画布目录内，shadcn 在其余）：**v0.159 重新量过，规模比原先描述的小得多** ——
      shadcn 在这个 app 里只剩 `projects/page.tsx` 一个 `AlertDialog`（列表页，周围没有 antd，无层级风险）；
      画布外的其余界面用的是 Tailwind + 我们自己的 `var(--*)` token，本来就不是 shadcn 组件。
      v0.159 已把 `publish-dialog` 从 shadcn `Dialog` 换成 antd `Modal` —— 它是**从画布里**调起的，
      而画布的 Modal 是 z-1000、气泡 z-1200，shadcn 的 Dialog 是 z-50，同屏会被压在下面。
      **结论：不要「全改 antd」**，那要重写 6 个 app + admin 共 48 个共享组件，换不来任何用户可见的好处。
      要守的是反方向：定期确认 `grep -rl "from \"antd\"" src | grep -v "^src/canvas"` 只剩 `publish-dialog.tsx`。

- [ ] **`canvas-bridge/api.ts` 没有 mock 分支**（v0.159 发现，dev-only）：`NEXT_PUBLIC_USE_MOCK=1` 时
      `src/api/ip-studio.ts` 走 mock，但画布自己的调用（models / uploads / **sign** / generate / video）
      一律直连真服务端 —— 没起后端时控制台刷 501，且**图的重签在 mock 下必然失败**，
      表现就是 dev 里「有的图好的有的裂」。生产不受影响（mock 关着）。
      至少让 `fetchModels` / `signKeys` 在 mock 下返回空结果而不是报错。

- [ ] **画布的看图对话（`requestImageQuestion`）还没接**：现在明确报错。要接就在
      `canvas-bridge/generation.ts` 调服务端的多模态 chat。

- [ ] **音频生成没接**：同上，`canvas-bridge/audio.ts` 现在明确报错，不产静音占位（§8.0）。

- [ ] **视频只吃首帧图**：画布还会传视频 / 音频参考（它支持多模态参考），
      `VideoMediaOptions` 收下但没用。服务端支持了在 `canvas-bridge/video.ts` 接上。

- [ ] **`MaterialVideoJob.videoUrl` 仍是 URL 不是 key**（§4.7.6 欠债）：v0.158 用
      `CdnUrlSigner.keyOf` 从 URL 反抽出 key 给画布用，是权宜之计 —— 换 CDN 域名或
      key-prefix 时会抽不出来。彻底修是加 `videoCdnKey` 列并双写，属于视频线的迁移。

- [ ] **画布的并发只到「拒绝覆盖」**：冲突时让用户刷新重来，改动没有合并。
      真要多人协同得上 CRDT 或按节点粒度的 patch，那是另一个量级的工程。

### 2026-09-07 · 三产品整合 v0.153 后续（真源 `docs/ip-ecosystem-integration.md`）

- [ ] **名片长内容还不能编辑**：作品（`works`）、公司（`company`）、媒体（`media`）、履历（`resume`）四段在公开页会渲染，但 `/cards/{id}/edit` 一期只做了首屏字段与联系方式，这四段只能从 `from-avatar` 的空结构起步、改不了。要么补编辑面，要么在公开页对空段落做隐藏（目前空数组不渲染，暂不刺眼）。

- [ ] **衣柜顺序与取舍不能调**：`figure.looks[]` 由 `from-avatar` 按造型创建时间倒序全量带入，用户不能挑哪几套上名片、也不能排序。造型多了之后右侧条会很长（已加滚动，但不是好体验）。

- [ ] **发布后自动排队跑短动作**：`IpRunService` 只认 `identity` / `generate`，`DapWorkflowService.createDerivative(avatarId, "video", …)` 又要求先有 `avatarId` —— 短动作只能在 ipstudio 发布**之后**跑，画布里排不了。v0.153 的做法是把三条短动作提示词放进 `prompt-presets` 的 `motion` 组，用户自己去 dap 里生成。要做成一条链需要新写「发布 → 排队跑短动作」的编排。

- [ ] **形象失效时通知名片主人**：`DapAvatarRefResolver` 已有静默回退（形象被删/授权撤销时回落到已缓存的图），但主人不知道自己的名片降级了。`CardService.affectedByAvatar(avatarId)` 反查已就位，缺的是接到 dap 删除 / 授权撤销事件上并发站内信。

### 2026-09-06 · AI IP 工作台 v0.151 后续（真源 `docs/ip-studio-plan.md` §8）

- [ ] **一致性打分 + 自动重跑**（§3 ⑥）：用视觉模型比对主图与各 look 的脸部一致性，低于阈值自动重跑一次；打分结果进 `IpRun.output`，前端在候选卡上显示。

- [ ] **增量发布**：已发布项目再加 look 时追加到同一 `DapAvatar`（现 409 `IP_PROJECT_ALREADY_PUBLISHED`，`IpPublishService`）。

- [ ] **独立产品码 `ipstudio`**（**v0.190 改判：前提变了，优先级下调**）：原描述仍然准确 —— 若要单独售卖 / 单独开通，需加 `PlatformSupport.ALL`、`SubProduct`、`ProductRouteTable` 路由（把 `/api/v1/ip-studio/**` 从 aiavatar 兜底里拆出）与 BUSINESS_RULES 表。但 v0.190 已把前端并进 `web-aiavatar`（一个应用两套设备形态），**「同一个应用里的两块功能」比「两个应用」更难单独售卖** —— 真要拆得先想清楚开通闸怎么在同一个前端里表达（哪些路由属于哪个产品码），不只是后端加一行路由表。

- [ ] **`DapMultimodalClient` 不读 `AiAppEndpointCandidate.maxRefImages`**：ipstudio 参考图上限现用固定 `aep.ipstudio.max-ref-images=4`（`IpRunService.compile*`），换成按绑定端点能力裁剪。

- [ ] **识别「引擎不支持看图」只能事后**：`DAP_PERSONA` 绑的模型若不接图片，`dap.ip_identity` 首次调用才失败为 502 `IP_IDENTITY_EXTRACT_FAILED`（冻结已释放）；admin 端点能力若加 `supportsVision` 可前置到 preflight。

- [ ] **视频节点**：接 clip 域（口播）或 `DAP_VIDEO`（转身 / 运镜），产出挂 `DapDerivative`。

- [ ] **本地 dev H2（`apps/server/data/aistareco.mv.db`）里 V25 校验和与仓内文件不一致**：是 v0.149 开发期改过已执行迁移留下的本地状态，`server-8085` 起不来；要么 `flyway repair`，要么删本地库重建。联调临时用了 `server-8085-dap-fake`（独立 `data/aistareco-e2e`）。

  本项合并两次本地 H2 记录。历史数据库当前是否仍有校验和漂移未重新验证；修复前确认该本地库是否可弃，不操作生产库。

- [ ] `IpRunWorker.isCancelRequested` 每张图重查一次行（同 `DapJobRunner.checkCancel`），主形象 4 张多 4 次 select，可忽略；若改批量出图再优化。

- [ ] mock 模式上传用 `URL.createObjectURL`，刷新即丢；仅影响演示。

- [ ] **Codex 评审后置的 P2（2026-09-06，均已确认存在）**：① `ip_run` 无 `@Version`，reaper 与 worker 都能写终态（reaper 把 cost 置 0 可能误报已 commit 的图）→ 终态改 CAS `UPDATE … WHERE status='running'` 或加乐观锁，reaper 的 cost 从账本推导；② 同节点 409 是先查后插、发布是先查后建，双击会双冻结 / 双建 `DapAvatar` → `run()` / `publish()` 开头对 `ip_project` 行加悲观锁；③ 软删项目不取消其 running 运行 → `remove` 时给该项目的运行置 `cancelRequested`；④ commit-then-persist 的崩溃窗口（付了一张、候选没落库；文件仍在 `ipstudio_gen/<owner>` 可人工对账）—— 仓内既有范式，接受。

- [ ] 画布页在 <1100px 宽时左右侧栏把画布挤成一条（`canvas-shell.tsx`），需要可折叠侧栏或按宽度自动收起；桌面 ≥1280 正常。

- [ ] **dev-login 返回体 `user.enrollments=[]`，共享 `AuthProvider` 据此把 `hasPlatformAccess` 判成 false → 登录后闪一屏「未开通」门禁，等 `/api/me` 回来才恢复**（web-star / web-ipstudio 同样受影响，`DevAuthController` 或 `AuthProvider.loginAs` 二选一修：要么 dev-login 也带 enrollments，要么 `loginAs` 后立即拉 `/me` 再判）。ipstudio 真联调 2026-09-06 复现。

### 2026-09-04 · 统一账号中心（服务在独立仓库 [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id)，设计真源 `docs/unified-identity-plan.md`）

- [x] **统一账号注册邀请关系 · 首版已发布，2026-10-17**：ID V12、首建事务记录、本体定义与查询权限；Studio `/invitations` 提供真实邀请视图、链接生成/复制/预览及分页刷新，桌面/手机账号入口已接通。共用 ID 真值，分佣奖励后续实现。账号原全量543项、此次ID专项15项，前端778项及共享SDK77项通过，见[验收记录](docs/releases/unified-account-referral-validation-20261017.md)。首版已发布；Studio 品牌邀请页当前先设计，首次注册线上闭环与真微信验收尚待完成，见[发布记录](docs/releases/unified-account-referral-production-release-20261017.md)。

- [ ] **identity · 无 `typ` 的历史后台令牌过渡兼容需按期删除**（v0.149）：`JwtAuthenticationFilter.LEGACY_ADMIN_ROLES` 让 v0.149 之前签的后台令牌（`role` 是 `SUPER_ADMIN`/`OPERATOR`/`FINANCE_ADMIN`、无 `typ`）继续拿后台权限，每次打 WARN。JWT TTL 7 天，**上线满 7 天后**删掉该字段与它的两处分支，否则「消费者令牌不得提权」这条闸只是半开。

- [ ] **P2 · 本仓接入 · 其余部分**（`docs/unified-identity-plan.md` §7）：`ensureStudioFor` 「先查再插」并发双插风险（`DigitalIpService.java:232`，`EnrollmentService.ensureStudio` 同形）改原子 upsert；`JwtAuthenticationFilter` 过渡期双验 HS256 + RS256；`AepUser.operatorRole` 直通 `/api/admin/**` 的消费者令牌提权面 → 后台独立 audience；五个 web app 共用 `AuthProvider` 改 PKCE；小程序补 `wx.login`、删短信 + 激活码注册页；导入老用户手机号建 uid。

- [ ] **后台前端接统一登录（`web-admin`）**（2026-09-09 拆出）：账号中心已注册公开客户端 `web-admin`（`require-password-login: true`，回调 `https://admin.aibuzz.cn/admin/auth/callback` —— 后台 `basePath: "/admin"`，裸 `/auth/callback` 是 404），目前**就位待用**：`apps/admin` 还没有 OIDC 回调路由，运营仍走 server 的 `operator-login`。要接需要两件事：① `apps/admin` 实现授权码 + PKCE 回调；② **server 决定「RS256 用户令牌怎么换成后台会话」** —— 按 `docs/unified-identity-plan.md` §285，RS256 令牌**永不**映射后台角色，所以是拿令牌里的 uid 去查 `AdminUser`，不是信令牌里的 role。这一步没做之前别把 `operator-login` 关掉。

- [ ] **P3 · 军师接入**：Fastify 公钥验证（jose）；wx 登录改走账号中心；`externalOwnerId` → uid；`User.identity_uid` 唯一映射，默认个人 Tenant 只建一次（owner 唯一）。

- [ ] **P4 · 公社会员端接入**：`member` 绑 uid；`app_user` 员工与企微留本地；同一自然人跨员工 / 会员只建显式 `person_link` 供审计，不自动授权。

- [ ] **P5 · 收尾**：关旧登录端点；统一登出；自助页（改手机 / 绑微信 / 注销）；注销 30 天 reaper 释放手机号；outbox 投递监控；验证码存储从内存换 Redis（多实例前）。

- [ ] **账号中心侧（`pokocat/aibuzz-id`）· MP（公众号）扫码分支无测试**（v0.149）：`WechatWebLoginTest` 只覆盖 OPEN_WEB；配一个 kind=MP 的测试应用补一条微信内 UA 的用例。`HttpWechatGateway.oauthAccessToken` 未对真 appid 打过。

- [ ] **账号中心侧（`pokocat/aibuzz-id`）· 未配 Redis 时 Boot 仍自动创建 localhost Lettuce 连接工厂**（v0.149 观察）：惰性连接、不会外呼，但若想干净可在非 Redis 路径 `spring.autoconfigure.exclude` 掉 `RedisAutoConfiguration`。

- [ ] **identity · 并发首登的 Hibernate ERROR 日志噪音**（v0.149 本地 E2E 观察；**2026-10-02 20:40 线上实际出现一次**：新账号 `id_akgh222kf1sg` 首屏 5 个并发请求，4 条 `Duplicate entry … aep_users` ERROR）：仪表盘首屏并发十几个请求 → 十几个线程同时 JIT 建档，只有一个赢，其余撞 `aep_users.username` 唯一键后回读赢家（**业务结果正确**，`/api/me` 200），但 Hibernate `SqlExceptionHelper` 每次都打一条 ERROR 栈。可选修法：JIT 前对同一 uid 做进程内 `computeIfAbsent` 单飞，或把 `org.hibernate.engine.jdbc.spi.SqlExceptionHelper` 对该路径降级。不影响功能。

- [ ] **server dev · `recharge_order.grant_storage_mb` 列缺失**（2026-09-04 本地 E2E 观察，与账号中心无关）：`PaymentReconcileService` 定时任务在 H2 dev 库报 `Column "RO1_0.GRANT_STORAGE_MB" not found`（每轮吞掉重试）。疑似实体加了字段但 ddl-auto=update 没有补列（或本地 H2 文件库陈旧）。需核对 `RechargeOrder` 与迁移。

- [ ] **P5 · Web 令牌存储改 BFF + HttpOnly cookie**（Codex P2 评审 P1-6，2026-09-04）：当前 access / refresh 令牌在各子站 localStorage，五个 web 客户端共用 `aistar-api` audience → 任一子站 XSS 可窃取 30 天刷新能力并访问本仓其他已开通产品。目标：每子域 Next 路由处理器做 BFF，refresh 放 HttpOnly + SameSite cookie，access 只驻内存；过渡期至少补 CSP / Trusted Types。规划 D9 已加注。

- [ ] **server · 匿名 `/api/config` 前缀白名单需随新公开配置维护**（v0.149）：`ConfigController.PUBLIC_KEY_PREFIXES` 只放行 `incubation.` / `forge.` / `drama.credit.`；将来前端要匿名读新配置键，必须加前缀，否则 404。管理端 `/api/admin/platform-configs` 不受影响。

- [ ] **enrollment · 有效期 / 冻结 / 撤权尚无运营入口**（v0.149 遗留）：`ProductEnrollment` 已有 `PENDING` / `SUSPENDED` / `REVOKED` 与 `validUntil`，但目前只有激活码与回填会写 `ACTIVE`。admin 侧「给某账号开通 / 停用某子产品 / 设有效期」的端点与页面待做。

- [ ] **enrollment · `/api/me` 下的账号级端点未进白名单**（v0.149 有意收紧）：`/api/me/password`、`/api/me/tenants`、`/api/me/messages-overview` 等严格来说与子产品无关，但按 §12.2 白名单原文未列入，因此仍要求 `X-App-Code`。前端统一发头后无感；若后续发现有产品无关的调用方（如小程序设置页）被拦，再按需补白名单。

### 2026-10-05 · 测试环境：本机 Node 25 与 CI Node 22 的 localStorage 不一样（AGENTS.md §8.0.1 ⑬）

- [ ] **产品侧小毛病（不急）**：单集「生成分镜脚本」在价格 / 视频模型还没读到时，确认框照常弹（`confirmSpend` 的 `priceKnown:false`），
      用户点确定后 `storyboardBody`（`apps/web-drama/src/canvas/episodes/actions.tsx`）按缺省上下限发（上限 10、不带下限）。
      平时确认框点完价格早就读到了，只有 `render/models` 一直读不到时才会发生；要收就在点确定之后再看一次 `ready`，没读到就不发。

### 2026-10-03 · web-drama 画布线上实测 v0.198.1 后续（真源 `docs/drama-canvas-plan.md` §11）

- [ ] **运维 · 端点显示名是内部名**：画布模型下拉里是 `image-jusuanhub` / `agnes-image` / `jusuanhub- MiniMax H3`，后台「AI 模型」里改成用户看得懂的名字；
      另外 `image-jusuanhub` 的 `model_alias` 填的是 `minimax-h3`，像是从视频端点抄过来的，核对后改掉
      （2026-10-05 看后台：`jusuanhub-通用参考图生图`、`Qwen34B-jusuanhub` 的别名也是 `minimax-h3`，三条一起核对）。

- [ ] **聚算 Key 并发上限 2 是全站共享的**（`api_key_concurrency_limited`，`limit:2`）：画布 worker 有并发闸（`aep.drama.canvas.text-concurrency`），
      但老短剧 `DramaScriptService` 等其它文字调用不在闸里，多用户同时写会互相挤成 429。要么和厂商谈额度，要么把闸提到 `AiModelInvocationService` 按端点统一管。
      2026-10-09 v0.220 已本地接通同一端点的 Studio/通用视频及共享同步 chat/images 限流；用户选择按模型接入端点配置。多个端点共用同一 Key 的厂商总额度尚未合并，本条保持未完成。

- [ ] **桌面上改不了已有角色的分级**（2026-10-05 复核发现）：唯一的控件在列表视图的角色抽屉里，而桌面上点角色卡会跳到画布视图，
      抽屉只在刚从列表加完角色时出现；画布分组头上只显示「主要角色」标签、不能改。在画布分组头（`apps/web-drama/src/canvas/board/nodes.tsx` 角色分组）加一个分级切换。

- [ ] **列表视图加角色不拦重名**（2026-10-05 复核发现）：画布里的加角色弹窗拦重名，列表视图的不拦（`asset-list-view.tsx` 的 `NameDialog`），两处应该一样。

- [ ] **列表点角色卡会跳到画布视图并定位**，不是小云雀那样就地打开详情弹窗；确认这是想要的交互，否则列表里直接开 `LookDetailDialog`。

### 2026-09-30 · web-drama 画布 v0.198 第二期候选（真源 `docs/drama-canvas-plan.md` §9）

- [ ] **自由画布 + 右侧 AI 对话**（小云雀「创建画布」/ 创作 Agent）：先把计划摆出来、用户确认后才花积分，运行中可中止。

- [ ] **故事板助手**（单集编辑器右栏对话）、剧本页**选中一段「引用 → 改写」**。

- [ ] **音色 / 配音**（文本音色、上传音频、石榴 V2 配音）、**绑定数字人**（要跨产品校验 DapAvatar 归属）、**角色库**（预设角色大库）。

- [ ] **智能预演**（一组片段统一出关键帧）、**三视图**、**片段拖动排序**、**ffmpeg 截末帧**（「用上一片段最后一帧」目前只在视频有真实末帧时可用）、**.docx 导入**、**修改记录对比视图**。

- [ ] **视频多参考图 / 尾帧**（聚算尾帧、多参考未接，见 AGENTS.md 视频生成段）。

- [ ] **画布和「我的短剧」互通**（存成短剧 / 从短剧生成画布）：第一期跑一段再定要不要做。

- [ ] **片段「用到的造型换过图了」目前是近似判断**（按「引用的挑中图出图时间晚于片段视频」推，上传图 / 挑回旧图判断不出来）：服务端在视频 / 首帧运行结果里回传实际送给模型的 key（`refKeys`），前端按 key 比对。

- [ ] **openapi 画布接口的参数校验类错误码没逐个列**（`DRAMA_CANVAS_TARGET_NOT_FOUND` / `DRAMA_CANVAS_SEGMENT_TOO_LONG` / `DRAMA_CANVAS_VIDEO_SUBMIT_FAILED` 502 等只写在 BUSINESS_RULES §6.7 与代码里）：补进各接口的 400 / 404 / 502 说明。

- [ ] **AGENTS.md §8.0 审计表写 dev-fake-llm「默认 false，显式开」，但 `application-dev.yml` 里 dev profile 默认开**（Codex 2026-09-30 评审顺带指出，存量）：二选一对齐（改表述或改默认值），不要让表和配置对不上。

- [ ] 两套画布引擎并存（aiavatar 的 vendored infinite-canvas 与 drama 的 React Flow）：以后要合一，先评估把 aiavatar 迁到 React Flow。

### 2026-09-28 · web-drama 文案 / 用户路径 / 响应式收口 v0.197 后续（真源 `docs/drama-ux-copy-pass.md`）

- [ ] **短剧合成下载的是库里存的 videoUrl，下载前不重签**（`DramaAssembleService` 约 181–205 行）：最后一次保存超过签名 TTL（默认 1h）
      后合成，下载可能 403（未实测）。修：按 key 重签后再下载，或文档改存 cdnKey。

- [ ] **短视频合成要求每一镜都点过「就用这版」，短剧只要有视频就能合成**：两条线口径不一。服务端
      `DramaShortAssembleService.buildPlan`（`approved = "done".equals(flow)`，测试
      `buildPlanRejectsAnyUnacceptedOrMissingClip` 钉着）与 `DramaShortContinuityService.preflight`
      的 `completedShotCount / assemblyReady` 都只认 `flow==='done'`。v0.197 前端没改判定，改成把
      「还没视频」和「有视频、还没点就用这版」分开说，并加了批量「有视频的镜头全部就用这版」。
      要放宽：服务端这两处 + 前端 `shorts/make/page.tsx` 的 `readyToAssemble / missingAssemblyMedia`
      + mock `api/shorts.ts` 的 `assembleDraft / preflightDraft` 一起改，那条测试要同步改语义。

- [ ] **多平台发布仍是服务端模拟**：`DramaDistributionService` 的 `@Scheduled` tick 把任务自动推进到
      「已发布」、`externalUrl` 写 `https://v.example.com/...`，「连接」不绑定任何真账号。v0.197 前端已如实
      标注并收进侧栏「即将上线」。**接真实平台之前不要把它挪回主菜单。**同文件 `Platform.lastSync`
      仍是 `relativeTime()` 相对时间串（§4.8），接真平台时改发 ISO `lastSyncAt`。

- [ ] **数据分析 `/insights` 已改成如实空态**（原页面的完播率、曲线、分布全是写死的数）。接真实数据时
      **不要复用 `FilmApi.listDramas`**：`FilmController` 返回 `dramaRepo.findAll()`，没有按用户过滤 ——
      先核实这张旧 film 表里是不是有用户数据，有的话这是一个跨账号读取面，单独排期。

- [ ] **分集剧情没有「从第 N 集接着写」**：服务端 `outlineAiDraft` 只能从第 1 集写、一次最多 12 集；前端「补齐」
      是只追加新集号的折中，续写的集不知道用户改过的前几集。「每集时长」也不传给大纲生成的提示词，目前只是显示值。

- [ ] **钱包与「收入与提现」合并成一页**（§7，本轮只修链接、命名、重复展示）。另：`FinanceController.txType`
      把 `GIFT / UNFREEZE / ADJUST / REFUND_CASH` 都映射成 `income`，任何读 `/finance/transactions`
      的页面都会把退款、赠送标成「收入」（drama `/finance` 已改读 `AccountApi.getMyLedger`，不受影响）。

- [ ] **脚本库没有后端软删与版本表**：前端已把「归档」如实改成「删除」、去掉永远只有一版的版本树；要恢复版本功能
      需要后端 `script_version` 表 + 软删。脚本库目前也没法把脚本带进某部短剧（所以在「即将上线」）。

- [ ] **素材库与角色卡上传不打通**：`DramaAssetUploadController` 上传的角色照不建素材库记录，真实模式下 `/assets`
      看不到它们（前端已删掉「角色区上传会存进素材库」这类说法）。

- [ ] **admin 侧的旧叫法**（给运营看的，§7 不在本轮范围）：`DramaConfigSeeder` 的配置说明（拆镜 / 出片 / 直出 /
      创意市场）、`DramaRecipeService.respondInvite → notifyAdmins` 的站内通知（「…进入创意市场」）、admin
      `drama/config` 与 `drama/prompts` 页的标签（「分镜视频（直出 / 动态渲染）」）。

- [ ] **生成视频的提交没有按镜头去重**（v0.197 Codex 评审）：`MaterialVideoJobService`（约 186 行）每次提交都新建任务并
      独立 `hold`，没有「这一镜已有在途任务」的判断，也不收幂等键。v0.197 在前端挡住了已知的两条重复提交路径
      （轮询超时后再点、批量生成里的在途镜头），但服务端仍然接受重复请求。应给 `/render/clip` 加
      `clientRequestId` 或按 `(owner, script_id, shot_id)` 拒绝在途重复。

- [ ] **镜头的「当前任务」只由前端报告**：恢复回填靠前端存下的 `jobId` 与镜头坐标判断哪个任务属于这一镜，任务号
      还没存下来就刷新时只能靠时间推断。彻底的做法是服务端受理时原子记录镜头当前任务 / 生成代次（与 §8.0.1 相关的
      「产物由服务端回写」同一条路）。

- [ ] **两处外部调用失败时不留响应体**（§8.0.1 ①，存量）：`DramaAssembleService`（约 222 行）下载分镜非 2xx 只抛
      `下载分镜失败 HTTP <status>`，没读响应体、4xx 也笼统；`DramaHotspotService`（约 135 行）非 2xx 直接抛
      `BusinessException`，不经过下面的 `log.warn`。

- [ ] **两处 503 的运维指引不完整**（§8.0，存量）：`DramaShortAudioService` 配音未配置、`DramaHotspotService`
      只有 promptKey 没有配置入口。v0.197 只改了口吻，没补真实的配置位置。

- [ ] **后台任务的默认名「首帧渲染」「短剧分镜」**（`DramaFrameJobService` / `DramaRenderService`）是
      `render-task-dock.tsx` 的 `GENERIC_NAMES` 认的占位值，改名要两端一起改。

- [ ] **分集剧情生成没有服务端幂等键**：`DramaProjectService#outlineAiDraft` 每次自己生成 UUID 冻结扣费。v0.197 前端加了
      跨组件实例的在途锁（`drama-ui/action-lock.ts`，卸载不释放），同一页面会话里连点 / 重挂载都只扣一次；**两个标签页同时点仍会扣两次**。
      服务端应照 promote 的做法收 `clientRequestId`。

- [ ] **聊天「去制作」成多集短剧没有防重**：两个标签页同时点，都读到 `status=draft`，`createProject` 无幂等 → 建出两部（免费，不扣积分）。
      修法：对 brainstorm 行做条件更新占位（`UPDATE … SET status='promoting' WHERE status='draft'`）或给项目也派生幂等键。

- [ ] **积分流水的「冻结转扣除」靠一条约定识别**：web-drama `_shared/ledger.ts` 的 `isHoldSettlement` 认定「写 SPEND 的只有
      `commitHold` 与 `store_*` 两处」。服务端以后每加一处 `debit(…, SPEND, …)` 都要同步改它；根治是 `LedgerEntryDto` 带显式标记
      （如 `settlesHold`）或 `commitHold` 改写独立类型。另：`/me/ledger` 不支持按 `type` 过滤，「收入与提现」只能一页页往前翻找。

- [ ] **删除有在途任务的镜头**：结果晚到时会被判为过期丢掉，积分照扣。给在途镜头的删除加确认（写明「正在生成，删了积分不退」）。

- [ ] **角色区的场景图 / AI 画参考照 / 场景 AI 改图仍按全局图片单价报价**（`cfg.prices.frame`），没接 `renderCreditCost`；默认图片端点
      有单价覆盖时显示的数和实扣不一致。

- [ ] **「发布成模板」对短视频的说法**写「风格、节奏和分镜结构」，但套用单条模板只用 summary + mainline（`DramaRecipeService#buildStyleRef`），
      提炼出的分镜节拍从没用上 —— 要么接上，要么改说法（产品决定）。

- [ ] 「随机来一个」的取点规则在 `short-create-console.tsx`（`pickSparkIdea`）与 `new-project/create-dialog.tsx` 各写一份，
      先挪进 `lib/` 再让两处共用（§8.0.1 ④）。

- [ ] 后台生成面板没有任务时每 15 秒才轮询一次，刚提交的任务最多 15 秒后才出现；可以在提交后发一个「立即刷新」事件（同 `notifyWalletChanged`）。

**纯前端，可以单独做的**

- [ ] `/review` 剧本审阅没有后端队列（`useState([])` 恒空）、也没有任何页面把剧本送审：入口保持隐藏。
      等后端审阅队列做了，再在「我的短剧」页头加「待审剧本 (N)」。

- [ ] 「我发布的模板」有运营邀请（`status==='invited'`）时侧栏没有提示，只能点进子页才发现；加一个计数角标。

- [ ] 全局搜索只搜数字人演员（跳 `/cast?q=`），已如实改名；要么扩成全站搜索，要么去掉。

- [ ] 后台生成面板的任务行不能点击跳到对应那一镜（工作台没有 `?ep=` 深链）。

- [ ] 分支图节点是 `div + onClick`，键盘选不中。

- [ ] 分镜「AI 改图」没有版本历史 / 「用这一版」：每次改图直接替换首帧（文案已如实说明）。

- [ ] `/shorts` 已完成的短视频没有「接着改」回制作页的入口。

- [ ] `/shorts/new` 的近期热点用的是短剧钩子（「闪婚老公有马甲」），不适合短视频；需要 catalog 字段区分适用形态。

- [ ] 工作台左轨「逐集制作」入口不写 `stage:4 / progress:50`，只有设定页浮动按钮会写 —— 「上次做到」的进度只有走浮动按钮才更新。

- [ ] 旧 drama-ui 死代码（`AICollab` / `GenError` / `EngineTag` / `RewriteTagPill` / `useGen`、`quick-create-modal.tsx`、
      `short-clip-modal.tsx`、`shot-form.tsx` 的 `ShotFormCard`、`script-refs.tsx`）本轮只改了文案没删，
      因为并行改动时删导出风险大；下一轮确认无引用后整块删。

- [ ] 演示数据里的 `projectInfo.ratio` 写的是「竖屏 9:16」，服务端写「9:16」（mock 与服务端不同形，§8.0.1 ⑦）。

**本轮没有实测到的（下次上线前补一遍）**

- [ ] **真实模式（`USE_MOCK=0` + server）没有端到端走过**：充值收银台（弹窗被拦 →「重新打开支付页」、二维码路径、
      `?order=` 重新支付）、短视频配音 → 合成、工作台余额在扣费后刷新、运营页 strict 读目录失败时禁止发布。

- [ ] 长脚本「剩下的部分另开一页拆」只读代码验证过（mock 解析器不返回 `truncatedAfterTimecode`），
      要用超过 40 镜的真实脚本实测一次。

- [ ] 运营页在 mock 下看不到（`MOCK_USER` 没有 `operatorRole`），本轮是注入同样的样式和结构验证的布局。

### 2026-08-31 · v0.143 短视频「提示词直出」后续

- [ ] **openapi 只登记路径不登记 schema**（Codex 评审提出，2026-08-31）：`parse-prompt` 与带 `seed` 的创建接口都只有 prose summary，没有 `requestBody` / 响应 schema / 错误响应。这是**全仓 drama 段的既有约定**（`check:api-contract` 只比对 URL + method），本次沿用；若要治理应整段 drama 一起 schema 化，不宜只给一个新端点加。

### 2026-08-31 · v0.143 短视频「提示词直出」后续 / Codex 评审发现的**既有**漏洞

- [ ] **系统性遗留：§4.7.7 的「递归重签 payload 里的资产 URL」本身会重签客户端写入的 URL**（2026-08-31 由上一条牵出，**不只 shorts，`DramaProject` 同源**）：裸 key 已堵，但攻击者若构造 `https://<我方 OSS/CDN 域>/media/<别人的key>` 这种**完整 URL**，`maybeSign` 仍会抽出 key 重签。彻底解法两条选一：① 产物由渲染管线在服务端直接回写草稿（客户端不再是产物的报告者）；② 签名时做归属校验（key → 所属账号，签之前比对 principal）。②更通用但要给 key 建归属索引。**在此之前不要再对外声称「客户端伪造只影响自己」。**

- [ ] **（原始定位，供追溯）** —— PUT 保存可伪造逐镜产物（2026-08-31 由 v0.143 评审顺带发现，v0.76/v0.133 起就存在）：`DramaShortService.saveShort` 整份接收客户端 `data`，只剥 `assembled` 与客户端音频，**不清 `flow` / `videoUrl` / `frameUrl` / `jobId`**；`DramaShortAssembleService.buildPlan` 又只凭 `flow=done` + 非空 `videoUrl` 就接受镜头，不校验该 URL 是否来自本用户本草稿的成功渲染任务（`MaterialVideoJob`）。伪造 `{"flow":"done","videoUrl":"/cdn/<已知平台视频>.mp4"}` 即可跳过逐镜出片扣费直接总装成片（外部域名被白名单挡住，平台 CDN / 相对路径可利用）。修法：产物字段一律以服务端为真值（保存时按 shot id 保留库内旧值、忽略客户端传入），总装前按 `MaterialVideoJob`（owner + 本草稿 + 成功态）核验每镜视频出处。注意 `DramaShortServiceTest` 现有用例把「保存后 doneCount=1」当正确结果断言，修时要同步改。

### 2026-09-09 · AGENTS.md 精简后续

- [ ] **§1「核心信息」里 clip 与 ipstudio 两个 bullet 各 4000 / 3600 字符**（合计占全文 5%），
      内容是版本日志级的红线细节，而两者都有 真源 doc
      （`docs/clip-avatar-video-plan.md` 54KB、`docs/ip-studio-plan.md` 29KB）。
      **不能直接删** —— 要先逐条核对红线是否都在 真源 里，缺的补过去，再把 bullet 压成
      「这条线是什么 + 三五条最容易踩的 + 指向真源」。这活儿要真读那两个 doc，没做。

### 2026-09-09 · 时间显示与文案统一（v0.194 立规，存量待清）

- [ ] **服务端还有 6 处相对时间**（`FanActivityDto` / `PlatformDto` / `NotificationService` /
      `DramaBrainstormService` / `DramaDistributionService` / `DramaProjectService` /
      `DramaShortService`）—— 都是「N 分钟前 / N 小时前 / N 天前」直接发到 wire 上，
      前端改不了格式（§4.8 明令新字段不许这么加，这批是存量）。dap 域那一处已在 v0.194
      改成 `dateTimeZh`，改法照抄即可：一个方法改完，它的全部调用点跟着好。
      牵动 music / drama / celebrity 三条线的列表页，**要连前端一起验**，故单独排期。
      **v0.197 进展**：drama 前端已不再展示这几个字段（改读 `updatedAt` + `formatDateTime`，分发页不再显示
      `lastSync`），剩下的是服务端把字段删掉或改 ISO，drama 这边改了不会再影响界面。

- [ ] **`web-music` / `web-drama` 的 `src/translations.ts`** 里还有整段营销腔
      （「打造专属 IP 形象」「智能推荐算法助力内容引爆」「一站式完成」）。它是 §4.6 已
      tombstone 的遗留中英字典，**理论上没有活引用** —— 清理时先确认真没人读，
      能整个删掉就别改文案（改了等于给要退役的文件返工）。

- [ ] **`/studio` 老 SPA（约 11k 行）的文案没过一遍**。它按既有双轨逐屏迁出，
      现在整体重写等于给要退役的代码返工；**迁一屏就顺手按 §8 清一屏**。

### 2026-09-09 · 生产事故复盘（v0.192，@Id 被挤到常量上）

- [ ] **30 个 `@SpringBootTest` 仍然红着，等于没有「上下文能起来」这道网**（既有，见下一节）。
      今天的事故本该被它挡住 —— 它是唯一会真的建 EntityManagerFactory 的一批测试。
      `EntityIdentifierTest` 只补了「缺 @Id」这一个洞，**其它映射错误（列名、类型、关联）
      依旧没有任何测试会发现，只有部署时才炸**。优先级应当提高。

- [ ] **用脚本改 Java 源码的纪律**：锚点不要选紧跟注解的那一行 —— 在注解与被注解元素
      之间插入内容是合法 Java、编译得过，但语义已经变了。改实体 / 注解密集的文件时，
      要么锚点带上注解本身，要么改完 diff 一眼。

### 2026-09-09 · 全局示例（v0.192）

- [ ] **30 个 `@SpringBootTest` 起不来（既有，非本轮引入）**：`drama_character` 有一列叫
      `cast` —— H2 的保留字，ddl-auto 建表直接语法错，整个上下文加载失败。
      受影响：`MaterialOpsE2ETest`(9) / `MaterialAiE2ETest`(8) / `AdminUserControllerWalletSecurityTest`(6) /
      `AdminCreditControllerSecurityTest`(4) / `MaterialDraftBillingTest`(3)。
      **已验证是既有问题**：把本轮改动 stash 掉、在已上线的 HEAD 上跑同样报错。
      MySQL 下 `cast` 不是保留字所以生产没事，只有 H2 测试环境炸。
      修法：给该列加 `@Column(name = "\`cast\`")` 或改名（改名要配迁移）。
      在此之前 `./mvnw test` 全量必红 —— 别把它当成自己改坏了。

- [ ] **`ip_demo_template` 没有 `@Version`，只有一条写路径做了防护**（Codex 复核 v0.192 提出）。
      实体没有乐观锁列，Hibernate 默认整行 UPDATE —— 两个写路径并发时后提交的会把
      前一个刚写进去的列盖回旧值。v0.192 只把「改展示信息」改成了定向 JPQL UPDATE
      （只更 name/summary/sortOrder），`setEnabled` 与 `publishFromProject` 仍走整行 save。
      这两条各自读的都是事务内的新行、窗口很窄，暂不改；真要治就加 `@Version`（要迁移）。
      在此之前**不要**再给这张表加「读-改-写」的新写路径。

### 2026-09-08 · AI IP 工作台并入 aiavatar（v0.190）新发现待办

- [ ] **老 SPA `/studio` 在桌面上仍是 480px 窄列**：26 个 overlay / 16 个 screen 文件 / 约 11k 行
      （`proto/*.tsx` 7953 + `api.ts` 2048 + `data.ts` 1296），包括声音工作室 / 授权登记 / 真人素材库 /
      任务中心 / 合成工作台 / 设置 / 会员算力 / 存储 / 回收站 / 创建链路 / IP·场景·产品·风格详情。
      按 `docs/aiavatar-asset-hub-redesign.md` §3.1 既有双轨逐屏迁成响应式 App Router 路由。
      **刷脸认证、拍摄采集这类天生要手机摄像头的永远留移动端**，桌面给「这一步请在手机上完成」+ 二维码
      （正好是画布那条规则的镜像）。不阻塞主链路：桌面用户走「建形象 → 出图 → 发布 → 资产 → 名片」已全程宽屏。

- [ ] **人设只作用于名片文案，还没接到数字人开口**：`CardPersona.voice`（tone + avoid）目前只被
      `POST /v1/card/{id}/persona/rewrite` 用来重写名片上那几句。设计意图是它同时作为数字人的
      说话规格 —— 接 clip / dap 的 TTS 与脚本生成时应当读它，否则「名片上的他」和「开口的他」
      会是两个人。

- [ ] **人设对话未落库**：`persona/chat` 的历史只在前端 state 里，刷新即丢（服务端刻意不存 ——
      名片文档是客户端拥有的）。聊到一半离开页面，得从头再聊。要留的话应当存进名片文档的
      一个 `personaChatLog` 字段，或者显式提示「离开会丢」。

- [ ] **宣传页原桌面版式的图集依赖 OSS 绝对地址**：`components/landing/atlas.tsx` 指向
      `media/ipstudio/landing/character-atlas-v1.png`。换图要按 4×3 等格重新导出并发新版本号。

- [ ] **移动端支持画布**（用户明确推迟）：目前 `<1024px` 进 `/projects/{id}` 给「请到电脑上打开」占位。
      要做需要重排节点面板（现在固定 600 宽）、把 Ctrl+滚轮缩放换成捏合、以及触摸拖拽连线。

- [ ] **`canvas-bridge/api.ts` 不认 `USE_MOCK`**（既有，随搬迁暴露）：`fetchModels()` / `signAssets()` 等
      直接走 `apiFetch`，mock 模式下照样打网络 → 无后端时画布模型下拉为空并在控制台刷 404。
      在 ipstudio 时期行为相同，不是本次回归；要修得给这一层补 mock 分支。

- [ ] **`packages/types` 缺名片域类型**（§4.1 规定 `packages/types/src/*` 是类型真源）：`CardProfile` /
      `CardSummary` / `CardFigure` / `CardContact` / `CardMedia` 目前只在 `apps/web-aiavatar/src/proto/card.ts`。
      并入后 `src/ip/asset-types.ts` 那份重复已随删除消失，只剩一份，但仍未上移到 packages。

- [ ] **账号中心与 DNS 的退役收尾**（跨仓，观察期后做）—— **前半已于 2026-09-09 完成**：
      `ipstudio.aibuzz.cn` 两个 vhost 已换成 308 跳 aiavatar（原配置备份在线上
      `/etc/nginx/conf.d/.backup/*.20260909104454`），`aistareco-web-ipstudio` 已
      `disable --now`。实测路径原样保留（`/projects/IPP-abc123` → 同路径）、
      `/auth/callback` 不跳并返回迁移说明。**剩下的**：≥90 天无真实流量后，到
      `pokocat/aibuzz-id` 删 client `web-ipstudio` 与 CORS origin，再删 vhost、
      DNS A 记录、systemd 单元文件与 `/opt/ai-star-eco/web-ipstudio`。顺序不能反。：`ipstudio.aibuzz.cn` 已改 308 跳 aiavatar；
      ≥90 天无真实流量后，到 `pokocat/aibuzz-id` 删 client `web-ipstudio` 与 `ID_CORS_ALLOWED_ORIGINS`
      里的该 origin，再删两个 vhost、DNS A 记录、systemd 单元与 `/opt/ai-star-eco/web-ipstudio`。
      **顺序不能反** —— 先删 client 会让跳转期内的登录 400。

### 2026-08-29 · aiavatar 资产中枢重构（P1 已落地，后续分期见 docs/aiavatar-asset-hub-redesign.md §4）

- [ ] **P2 下游选择器 + 回流**（**P2a 已完成部分**，v0.141 / 2026-08-29：明星授权只读投影 `GET /v1/assets/star-grants` + 货架明星形象卡 + `/stars/[id]` 名片 + 授权中心双向）。剩余：music 出 MV 选数字人；`dap_asset_usage` 泛化为跨 app 使用边——**前置依赖：带货明星形象出片真链路上线**（v0.139 现拦截为建设中，无生产者不建假账），上线时在成片落点 best-effort 写 usage；名片页"导出设定卡"。

- [ ] **P3 /studio 逐屏迁出**：创建向导 / 真人授权 / 合成工作台 JSX 化迁入新路由；`src/proto/api.ts`（1800 行）按域拆文件；strict 渐进开启；根路由旧 hash 转发器随 /studio 退役一并移除（在此之前**不得删**——七牛刷脸回调依赖）。

- [ ] 待机循环成本观察：若量起来后平台侧视频生成成本偏高，可置 `AEP_DAP_AUTO_IDLE_LOOP=false` 关闭（设定卡首图退回定妆图静态展示），或改为用户在设定卡上手动触发（届时按 30 积分正常计费）。

- [ ] M2 授权链路：目前官方资产只做到「看得见」——复用既有数字人广场（scope=public）展示，`/market/[id]` 的「立即授权」只提示建设中。待做：资产加 official/listingStatus/三档价格字段 + 管理员上架 + 授权订单与支付回调 + 授权记录。

- [ ] P2a Codex review 后置项（2026-08-29，medium 已同轮修复）：`CelebrityStar.avatar` 出 wire 未经 CdnUrlSigner——celebrity 域自身 `CelebrityStarDto` 也如此（非本次回归）；若明星头像迁 OSS 签名 key，两处按 §4.7.5 一起改。`/stars/[id]` 的「去带货创作」目前只跳 celebrity 首页，待带货侧提供明星详情/出片深链路径后带 starId 直达。

- [ ] P1 Codex review 后置项（2026-08-29，阻塞项已同轮修复）：hub 页面少量硬编码色值（`#D6EEF7`/`#F2E2BE` 证书/警示卡边框）未进 globals.css 令牌；LoadingBlock 用 spinner 与老版 skeleton 语言不一致；既有行为——`#/voiceclone` 深链冷启动回落首页（proto 同时列在 SIMPLE_OVERLAYS 与 FLOW_SCREENS，非本次回归）。

### 2026-08-29 · v0.138 音乐真实生成后续

- [ ] **运营开通与配置**（上线前置，非代码）：火山控制台 `console.volcengine.com/ai-music/product` 开通「AI 音乐生成大模型」（企业首次 0 元 200 首试用）；admin「平台 · AI 模型」建端点（baseUrl `https://open.volcengineapi.com`、model `v4.3`/`v5.0`、Key 填 `AccessKeyId:AccessKeySecret`、billingMode `PER_SECOND`）+「AI 应用绑定」绑用途「音乐生成」+ 设 `creditCostOverride`（每秒积分，参考上游 0.002 元/秒）。**未配置时功能保持 503，不产假数据**。

- [ ] **真机付费实测未做**：本轮验收全部在「未配置」路径完成（503 / 不扣费 / UI 提示），真实出曲、真实扣费、音频镜像与播放**尚未用真实凭据跑通**。开通后需实测：出曲成功、按真实时长结算、差额退回、音频可播。

- [ ] **歌曲封面仍是手填 URL**：`SongDetailDrawer` 的封面是文本输入框，无上传也无生成。音乐模型不产封面，需另接 `IMAGE_GENERATION`（已有用途）按曲风/情绪生成，或支持上传。

- [ ] **分发链路与歌曲无连接**（暂不做，已在 UI 标「建设中」）：`DistributionPage` 从不读 `songId`；`DistributionContent` 实体没有指向 Song 的字段，`DistributionController.publish` 是返回随机 jobId 的 stub；页面的平台与内容全是 `mocks/distribution.ts` 的编造数据。**歌曲目前根本进不了分发**。真实发行还需要 Song 上没有的 ISRC / 版权归属 / 语言 / 发行地区字段。
  - 已做的止血（v0.138）：侧栏「全网分发」挂 `建设中` 徽标；歌曲卡「分发」按钮禁用并标注；分发页顶部加醒目横幅说明"本页为效果预览、非真实数据"，「一键分发」与「平台接入」两个只弹 toast 的假操作已禁用。**口子保留**，接后端时把标记摘掉即可。

- [ ] **`advanceSong` 无状态机校验**：`AccountController` 直接 `valueOf(status)`，可从 recording 跳 released、也能从 released 退回。

- [ ] **admin 歌曲审核页看不到音频和歌词**：`/content/songs` 与详情页都不展示 `audioUrl` / `lyrics`，运营无法真正审核就要点通过/驳回；approve/reject 收了 `reason` 却直接丢弃，未进审计日志。

- [ ] **`AdminMusicController.songs` 全量 `findAll` + 内存分页**，歌曲量上来会 OOM。

- [ ] **admin 侧 `/admin/generation/jobs*` 骨架仍是死代码**：`api/generation.ts` + `mocks/generation.ts` + `types/generation.ts#GenerationJob`（含 abort / refund）俱在，后端零实现、无页面引用。要么落地为生成任务统一审计后台，要么删除。

### 2026-08-29 · v0.137 音乐自由创作 + 工作室惰性补建后续

- [ ] **追查历史账号漏建 Studio 的注册路径**：线上 17 个用户里 6 个 STUDIO 账号无 `aep_studios` 行（含 2026-05-25 注册的 `phone_18801931018`，追查号 7MQUAP4JYVSE 409 死锁的触发者）。正常短信+激活码注册经 `LicenseActivationService.activate` 必建 Studio——这 6 个账号从哪条路径来的（早期版本？admin 手建？）未定位。v0.137 的 `DigitalIpService.ensureStudioFor` 惰性补建已止血，root cause 供审计排期。

- [ ] **无艺人歌曲的「补绑定艺人」入口**：v0.137 起自由创作歌曲 `artistId=null`，产品语义是分发前必须补绑定（product_spec.md §10.1），但目前没有绑定 UI/端点（可做 `PATCH /me/songs/{id}` 允许补 `artistId` + 前端歌曲详情入口）；分发链路也未加「未绑定艺人 → 拦截并引导」的闸。

- [ ] **web-music 其余艺人维度页仍走 `NoArtistState`**（/music 商业视图、/notices、/wardrobe、/community 等）：属艺人视角页面，按产品定位保留硬闸；`NoArtistState` 已加「直接去创作音乐」出口。若后续要求这些页也支持无艺人态，另行评估。

### 2026-08-18 · `clip` 快出片生产门槛（v0.132 单次直传与异步受理后续）

- [ ] 给生产 OSS RAM 身份补齐并验证 `oss:DeleteObject`（至少 `media/clip/clone/*`）：2026-08-18 线上日志已确认当前删除被 OSS 拒绝。它不阻断直传、转码和训练，但会让失败/转码前的源对象无法及时清理；权限补齐前需要用生命周期规则兜底回收该前缀。

- [ ] 用本人合规采集素材完成 `docs/clip-avatar-video-plan.md` §3.2 质量/时延/一致性/输出规格/成本实测及 §12 商务与算法备案决策；没有真实授权素材时不得用假素材冒充全链路验收。

- [ ] 接入真实图片/视频/音频机器审核，并把结果与资产/任务审计关联；当前由军师 BFF 在未配置时 fail-closed，AIStar 也不得绕过接受直传媒体。
- [ ] **部分完成**：`clip` 多段总装继续收尾。v0.112 已完成 Strategy A 基线；v0.113 补齐三套模板固定品牌尾卡和最终音画质量门；**v0.135 已修复单遍 -1.5 dBTP 归一后 AAC 回弹导致的确定性误拦**，现以两遍 -16 LUFS / -2.5 dBTP 处理保留编码余量，最终真实文件仍按 ≤ -1 dBTP 失败关闭并记录指标。**剩余**：拿到授权的「集体发声」群像尾片后通过 admin preset 替换品牌尾卡，并用本人真实长片完成时延、内存、磁盘压力验收；完成前仍不能宣称完整生产模板成片。

- [ ] 抖音、快手、小红书、视频号逐一接真实发布和状态回查；当前非 mock 固定 `CLIP_PUBLISH_NOT_CONFIGURED`。不要扩写“全平台一键发布”。

- [ ] 为 `DapAvatar` / `DapVoice` 本次新增的引擎字段补正式 Flyway 迁移；当前 v0.110 仍依赖 `ddl-auto=update`，`V14__add_clip_domain.sql` 只建 clip 四表。等全仓 Flyway 接管策略确认后再迁，避免与既有表结构漂移冲突。

- [ ] 生产接入前跑 MySQL 迁移演练、多实例租约/杀进程恢复、长任务 stale reaper、真实供应商限流与成本压测；mock 完成不算验收。

### 2026-09-06 · 线上域名串站排查与收口（客户反馈「链接打开不太对」）

- [ ] **续期跑在个人 Mac 上，长期关机 / 换机会失效**：要挪到 ECS 需要一对带 `AliyunDNSFullAccess`
  的 RAM AK/SK（ECS 上没配 aliyun CLI 凭据），配好后三个脚本原样搬过去即可。**2026-12-05 前必须落实。**

- [ ] **`api.aibuzz.cn:80` 仍不跳 HTTPS**：其余七个子域已统一 308 跳转，api 的 80 保留明文直通 8080，
  因为不确定有无老集成在用。确认无 http 调用方后改成 308 —— 否则 JWT 会明文过网。

- [ ] **`aistareco.conf` 的 `listen 80 default_server`（`server_name 47.98.162.120`）未登记 host 仍回带货站首页**：
  比落到后台好，但仍是串站。要收口需同时确认 `verify.sh` 的 `PUBLIC_BASE=http://47.98.162.120`
  与 `/liuyue` 静态演示不受影响。

- [ ] **web-music 制作工坊四个模块后端从未实现**（2026-09-06 定位）：`/me/{assets,clip-tasks,person-models,
  digital-person/gen-tasks,batch-tasks,mix-templates}` 在 `specs/openapi.yaml` 里有登记（所以 contract 门过得去），
  但 server 无对应 controller，`ProductRouteTableCoverageTest` 枚举真实 handler 也就照不到它们，
  运行时被 `EnrollmentGuard` fail-closed 成 403 `PRODUCT_ROUTE_UNMAPPED`（生产日志 2026-09-06 15:11–15:14 实测 6 次）。
  前端已改为「不拿 mock 冒充」（见下条），但**模块本身仍是空壳**：要么补后端，要么把这四个入口从
  `apps/web-music/src/constants/nav.ts` 隐藏。

### 2026-06-17 · v0.81 收口与新发现

- [ ] **预存在测试失败（与 v0.81 无关，clean main 同样红）**：本机带 `apps/server/.env`（gitignored，`AEP_CDN_DRIVER=oss` 但 endpoint 不可解析）时，所有 `@SpringBootTest` 全 context-load 失败 → 跑全量测试前应临时移走 `.env`（或确保 OSS endpoint 可解析）。即便移走 `.env`，仍有 **4 个预存在失败**需排查：`MaterialOpsE2ETest`（`productLibrary_includesMaterialProducts` / `getScript_returnsFullPayloadWithBlocks` / `listVideos_filterByProduct`）+ `PlatformSupportTest.toCsv_roundTrips`。已确认 stash 我的改动后于 clean main 同样失败 → 属历史欠债，非本次引入。（**2026-07-19 更新**：`MaterialOpsE2ETest` 3 例已根因定位并修复，见 2026-07-13 段落对应待办；本轮沙箱环境无 `.env` 文件、`./mvnw test` 全量 402/402 全绿含 `PlatformSupportTest`，故该条 `.env` 干扰问题本轮未复现，暂不消项，留给下次带 `.env` 环境的 agent 复核。）

### 2026-06-18 · 大模型调用原始响应可观测

- [ ] **Coze 流式调用纳入统一观测**：`ForgeCozeService` 走 Coze Java SDK（流式 chat，HTTP 细节不透明），未走 `UpstreamModelHttp`。待评估:或为流式补一条「调用元信息 + 最终聚合响应」的 best-effort 用量/日志旁路（不强求原始分片），或在 SDK 层加拦截器。优先级低（形象锻造入口 music 线 v0.60 已下线，仅 drama 顾问在用）。

### 2026-07-09 · 例行 QA 新发现（1 处已修复 + 2 处记录待排期）

- [ ] **web-aiavatar 共享 `useApi` hook 对拉取失败静默保留 initial 值，无法与"真实空态"区分**（本轮发现，暂不修，理由见下）：`apps/web-aiavatar/src/proto/api.ts` 的 `useApi()` 明确注释"静默：保留 initial...其余错误由动作型调用处理"，`seed.*()` 在 live 模式下均返回 `[]`/`null`，约 20 处只读调用（`screen-home`/`screen-library`/`screen-more`/`screen-voiceapps`/`screen-avatar` 等）一旦拉取失败（JWT 过期/500/网络抖动）就会把"没有数据"误渲染成"真实空态"（如已有数字人的用户看到"你还没有数字人，去创建"引导），且无错误提示/重试。**与已修复的 13 个 web-star 页面那类 bug 不同**：这里没有"其他页面证明是疏漏"的反例——`useApi` 的静默行为在全 app 是统一、故意为之的设计决策（代码注释明确写了理由），且要正确暴露 error 需要改共享 hook 签名 + 逐一梳理 ~20 个调用点决定各自的 UI 呈现，改动面偏大、屬于产品/体验优化范畴而非局部回归修复，故本轮只记录不动手，留给产品/前端排期评估（可参考 web-star 的 `error ? <EmptyState/> : ...` 模式落地）。

- [ ] **celebrity 明星头像/封面上传绕开 `CdnUrlSigner`，落库裸 `cdnUrl` 而非 `cdnKey`**（本轮发现，暂不修，理由见下）：`StarProfileUploadController`/`AdminCelebrityUploadController` 都直接返回 `FileStorageService` 的未签名公开 URL，写入 `CelebrityStar.avatar`/`CelebrityStar.cover`（纯 `String` 列，无 `cdnKey`）。代码里已有注释解释这是刻意权衡（"非高带宽盗刷目标，公开 URL 可接受"），且当前 `infra/env/server.env.example` 配置的是 `AEP_CDN_SIGNED_URL_STRATEGY=oss`（非 `cdn`），今天不会触发线上裂图。但该注释的技术理由站不住脚——一旦运维按 AGENTS.md §4.7.3 的建议把策略切到 `cdn`（Aliyun CDN URL 鉴权 Type A 是按域名/路径生效，不区分内容敏感度），这两个字段会立刻裂图（不是 TTL 过期，是从上传那刻起就没签过）。且新增 `cdnUrl` 不带 `cdnKey` 违反 AGENTS.md §4.7.4 的强制规则。修复需要给 `CelebrityStar` 加 `avatarCdnKey`/`coverCdnKey` 列 + 双写迁移 + DTO 出 wire 改走 signer，屬于结构性 schema 变更，非本轮"高度局部化"修复范畴，记录留给下一轮排期。**2026-07-10 复核**：本轮独立审计再次排查，结论不变，仍留给下一轮排期（未新增变更）。

  2026-07-23 的同一字段/上传路径诊断已合并，所需 `avatarCdnKey` / `coverCdnKey` 迁移仍保留为一个待办。

### 2026-07-11 · 例行 QA 新发现（遗留候选）

- [ ] **`PublishJob.coverUrl` 同样来自用户可控输入，未做 origin 校验**（**留痕待排期**，2026-07-11）：当前 sau-service 所有 platform driver 均未读取 `cover_url`（`grep` 全仓仅剩字段声明 + DTO 透传，无 fetch 调用点），非当前可利用漏洞，本轮未跟着收紧（避免無依据扩大改动面）。若未来任一 driver 开始消费 `cover_url` 做封面抓取，务必同步套用 `videoUrl` 已有的 `trustedDispatchOrigins` 校验，否则会重新打开同一类 SSRF。

**本轮复核历史 open routine PR**：无——`[Routine QA]`/`qa/routine/` 搜索均为空。
**验证**：`./mvnw compile -o` 全绿；`./mvnw -Dtest=PublishJobServiceTest,PublishJobServiceCdnSignTest test -o` 全绿（7 例）；`./mvnw -Dtest="Mixcut*Test,Publish*Test" test -o` 全绿（广谱回归）；`./mvnw -Dtest=AdminUserControllerWalletSecurityTest test -o` 全绿（真实 Spring 容器验证 `@Lazy` 自注入不破坏启动）。

### 2026-07-12 · v0.103 短剧前端 UX 打磨新发现（本轮定位未修，留待排期）

- [ ] **`drama.credit.interactive-draft` 单价未暴露进 `GET /me/drama/config`**：互动剧 AI 起草的单价（PlatformConfig `drama.credit.interactive-draft`，v0.79 引入）后端已配、扣费真实，但 `DramaConfigController` 返回的配置 DTO + 前端 `api/drama-config.ts` 未把这个字段带出来，导致 `apps/web-drama/src/app/(workspace)/projects/[id]/(stages)/branch.tsx` 的 AI 起草确认弹窗只能显示「将消耗积分」兜底文案，拿不到具体数字（其余动作如 frame/shot-rewrite 都有真数字）。修复：`DramaConfigController` 的配置聚合补 `interactive-draft` 单价 → `api/drama-config.ts` 加字段 → branch.tsx 起草确认改显示 `CreditMark` 具体值。

- [ ] **`shorts/make` 本地 `EditableField` 与 drama-ui 共享 `Editable` 是两套行内编辑交互**：`apps/web-drama/src/app/(workspace)/shorts/make/page.tsx:89` 附近自定义了一个 `EditableField`（点击进入编辑、失焦保存），与 `@/components/drama-ui` 导出的共享 `Editable` 功能重叠但交互细节（键盘行为、占位、样式）不一致，属重复实现。待合并到共享 `Editable`（或让 `EditableField` 成为其薄封装），消除交互漂移。

- [ ] **operations 未发布守卫仅 beforeunload + 页内黄条，缺 App Router 路由级导航拦截**：`apps/web-drama/src/app/(workspace)/operations/page.tsx` 有未发布改动时，浏览器级关闭/刷新有 `beforeunload` 提示、页内有黄条提醒，但**应用内**通过 Next `<Link>` / `router.push` 切走时不会拦截（App Router 目前无官方 `useBlocker`），可能丢草稿。待 Next 提供路由拦截能力或自实现导航守卫后补上。

### 2026-07-15 · 例行 QA 新发现（2 处已修复 + 1 处记录待排期）

- [ ] **`/celebrity/videos/{videoId}` 的 `DELETE` 操作在 `specs/openapi.yaml` 中已声明多时，但 `CelebrityZoneController` 从未实现对应路由**（**记录，本轮未修**，2026-07-15）：与本轮修的 `GET` 路由是同一路径块，发现时顺手核对到 `delete` 也缺失——契约声明「删除项目视频」但后端没有对应 `@DeleteMapping`，前端/小程序目前均未调用这个方法（未验证到实际业务影响面，需要先确认产品侧是否还需要这个删除入口，避免为一个可能已经不需要的功能补后端），故本轮只记录不实现，留给产品侧确认后再排期。

- [ ] **小程序 `/celebrity/overview`（`workbench`/`dashboard` 两个 tab 页共用）请求/响应契约与后端 `CelebrityZoneService.getOverview()` 实际返回的字段完全不匹配，真实/非 mock 模式下两个页面必然抛异常、永久卡在归零占位数据**（**记录，本轮未修，非本轮回归**，2026-07-15）：`pages/workbench/index.js` 期待 `{todayGmv, videoExposure, orderCount, conversionRateChange, pipeline, shortcuts, myStars}`，`pages/dashboard/index.js` 期待 `{bars, gmv7d, gmvChange, topVideos, kpis, funnel, coachReview}`；但 `CelebrityZoneService.getOverview()`（`apps/server/.../service/CelebrityZoneService.java:545-577`）只返回 `{hero, starLeaderboard, weeklyTrend, channelMix, _serverGenerated, _totalVideos}`，方法自带注释明确写着"mock overview...MVP 阶段统计字段先以聚合占位，后续接入真实指标"——这是已知、有意为之的 MVP 缺口，不是某次改动引入的回归。两个页面的 `try/catch` 会兜住由此产生的 `TypeError`（访问 `undefined.toString()`/`undefined.map()`），只弹一次"加载失败" toast，不会白屏崩溃，但页面数据永久停留在初始归零占位值。本轮判断：完整补齐需要设计并实现 GMV 分日聚合、曝光/转化统计、成交漏斗、爆款视频榜等一整套统计口径与数据管线，属于功能补全而非局部 bugfix，超出本轮"小范围回归修复"范畴，故只记录定位、不动手实现。修复方向：要么统一 `getOverview()` 输出结构涵盖两个页面各自需要的字段（一次多返回点，前端各取所需），要么按调用方拆两个端点（`/celebrity/overview`给 workbench，新增一个给 dashboard 用的端点）；无论哪种，字段口径需要产品侧先拍板"曝光/转化率/GMV 分日"这些指标的具体计算方式。

**本轮复核历史 open routine PR**：无——`[Routine QA]`/`qa/routine/` 搜索均为空（#88/#89 均已合并）。
**验证**：`./mvnw compile` 全绿；`./mvnw -Dtest=DramaReferenceAssetServiceTest,CelebrityZoneServiceTest test` 全绿（13 例）；`pnpm check:api-contract` 全绿（430 个 apiFetch 调用点，0 缺失）。

### 2026-07-18 · 例行 QA（承接 #91，未发现新缺陷）

- [ ] **`DramaReferenceAssembler.characterRefUrls()` 角色参考图回退到全部角色，可能与镜头 `@cast` 指名不符**（**记录，本轮未修，Low confidence，需产品侧判断**，2026-07-18）：见上方设计观察，定位 `apps/server/src/main/java/com/aistareco/aep/service/DramaReferenceAssembler.java:250-267`。

**本轮复核历史 open routine PR**：承接 #91（见上），cherry-pick 干净无冲突，已 close #91。
**验证**：`./mvnw compile` 全绿；`./mvnw test` 全量 402 个测试，3 个既有 `MaterialOpsE2ETest` 已知失败（同 2026-07-13 记录，与本轮无关）、0 新增失败；`pnpm typecheck:all`（10/10）全绿；`cd apps/web && npx tsc --noEmit` 通过；`pnpm check:api-contract` 全绿（430 个调用点）；`pnpm --filter @ai-star-eco/web-drama test` 跑出 2 个测试文件 4 个既有失败（`drama-query.test.tsx`、`publish-creative-center-modal.test.tsx`），经核对这两个文件均不在本轮/近期任何改动的依赖图内（本轮唯一改动的 `distribution/page.tsx` 与它们无引用关系），判定为与本轮无关的既有缺陷，记录在案、未修（见下条）。

### 2026-07-20 · 例行 QA（承接 #93，1 处高置信度新缺陷已修复 + 1 处边界情况记录待排期）

- [ ] **`DramaReferenceAssembler.indexOfShot()` 找不到 shotId 时退化为"数组末尾"，导致 `prevLastFrameInScene`/`nextFirstFrameInScene` 兜底行为不对称**（记录待排期，非本轮修复）：`indexOfShot` 找不到时返回 `shots.size()`；`prevLastFrameInScene`（`for i=idx-1; i>=0; i--`）会因此从数组最后一个镜头开始整段倒序扫描，可能把无关镜头的末帧当成"上一镜末帧"塞进一致性参考；`nextFirstFrameInScene`（`for i=idx+1; i<size; i++`）在同样情况下正确地扫不到任何东西。仅在传入的 `shot_ref.shot_id` 与所在场景查到的镜头数组完全对不上时触发（数据一致性边界情况，非常规路径），本轮未验证是否有实际触发场景，先记录待下一轮或有余力时复核是否需要让 `indexOfShot` 找不到时直接返回哨兵值（如 `-1`）由两个函数自行判空退出，而非隐式退化成"末尾"。

**验证**：`./mvnw compile` 全绿；`./mvnw -Dtest=DramaReferenceAssetServiceTest test` 10/10 全绿（含新增回归测试）；`pnpm install` + `pnpm typecheck:all`（10/10）全绿；`cd apps/web && npx tsc --noEmit` 通过（0 错，此前一次误报的 `TS5101 baseUrl deprecated` 系沙箱未 `npm install` 导致 npx 回退到不匹配的全局 TypeScript 版本，`npm install` 后确认与本轮改动无关）；`pnpm --filter @ai-star-eco/web-drama test` 7/7 测试文件、37/37 全绿；`pnpm check:api-contract` 全绿（430 个调用点，0 缺失）。

### 2026-07-21 · 例行 QA（承接 #94，2 处高置信度新缺陷已修复 + 1 处低危记录待排期）

- [ ] **`FinanceController`（`/api/finance/**`，生产侧财务视图：月度营收/来源占比/交易流水）未在 `AepSecurityConfig` 显式声明访问规则，落到 `anyRequest().permitAll()` 兜底**（**记录，本轮判断非高危、未修**，2026-07-21）：与 2026-07-05 审计修复的 F-01（`/api/settings/**`、`/api/store/**` 同样此前无显式规则、落 permitAll 兜底）是同一模式，但复核后确认**风险等级明显更低、不构成本轮"确认缺陷"的举证标准**——三个端点均为 `@GetMapping` 且用 `Principal principal` 取 `principal.getName()` 作为查询过滤条件；Spring Security 默认启用 `AnonymousAuthenticationFilter`（本仓未显式禁用），未带 token 的匿名请求会拿到 `principal.getName()=="anonymousUser"`，`ledgerRepo.findPositiveSince("anonymousUser", ...)` 只会查到空结果——不构成跨用户数据泄露，只是防御纵深上不如显式 `authenticated()` 严谨（且理论上若未来关闭匿名认证过滤器，行为会从"返回空列表"退化成 NPE 500，而非本该有的 401）。按本轮"不做投机性改动，只修有明确证据的缺陷"的纪律，未在本轮顺手加 `.requestMatchers("/api/finance/**").authenticated()`——建议下一轮或有余力时比照 F-01 补齐这一行，成本极低、无行为回归风险。定位：`apps/server/src/main/java/com/aistareco/aep/config/AepSecurityConfig.java`（`/api/finance` 未出现在任何 `requestMatchers` 里）、`apps/server/src/main/java/com/aistareco/aep/controller/FinanceController.java`。

独立审计另确认（未发现新问题，逐条复核过）：
- 全仓 `setBalance`/`UPDATE wallet` 直改余额搜索：命中只有 `CreditService.java` 内部与 `DemoCatalogSeeder.java:451`（`@Profile({"dev","test"})` 种子数据，非生产路径，符合 §8.0 例外），无新增账本旁路。
- 微信支付回调幂等（v0.94）：`WechatNotifyController → WechatPaymentGateway.parseNotify → RechargeService.settlePaidOrder → RechargeOrderRepository.markPaid` 走条件 `UPDATE ... WHERE status=PENDING`（claimed-row-count 门禁 + 重入 no-op），未发现竞态。
- CDN key-only discipline（§4.7）：`DramaRecipe`/Star 域资产字段复核均经 `CdnUrlSigner` 派生，`DramaRecipe.payloadJson` 不含裸资产 URL；Star 域已知的 `StarProfileUploadController` 写入未签名 URL 沿用 2026-07-09/07-10 已记录的旧待办，未重复记录。
- 全仓 `window.confirm`/`alert`/`prompt`（含 miniprogram）：零命中裸原生调用，均为 `await confirm({...})`（`useConfirm()` 沿用模式）。
- `AiAppBindingService`/`DramaReferenceAssembler`/`AiModelInvocationService`（D-11/C-3 新代码）：候选端点禁用-重启用守卫、参考装配优先级链、capability 裁剪顺序均与既定设计文档一致，未发现新的 off-by-one 或竞态。
- 除 `AdminUserController.adjustCredits` 外，全仓扫描 `/api/admin/**` 下涉及资金/积分的写端点（`AdminFinanceController`/`AdminFinanceRechargePackageController`/`AdminPaymentConfigController`/`AdminRechargeOrderController`/`AdminReconciliationController`/`AdminCreditOpsController`）均已有类级或方法级 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`，未发现同类遗漏。

**验证**：`./mvnw compile` 全绿；`./mvnw test` 全量 **407/407 全绿、0 失败、3 跳过**（真凭据 live smoke，与本轮无关；较 2026-07-20 的 403 净增 4 个回归测试）；`pnpm install` + `pnpm typecheck:all`（10/10）全绿；`cd apps/web && npx tsc --noEmit` 通过（0 错，需先 `npm install` 补 `apps/web/node_modules`，沙箱首次运行缺失导致 `npx` 回退到不匹配的全局 TypeScript 版本，与本轮改动无关）；`pnpm --filter @ai-star-eco/web-drama test` 7/7 测试文件、37/37 全绿；`pnpm test:all`（10 个 workspace 项目，除 web-drama 外均为"暂无单测"既定决策）全绿；`pnpm check:api-contract` 全绿（430 个调用点，0 缺失）。

### 2026-07-27 · AiAvatar 数字资产平台扩展（v0.104）新发现待办 / 持久化 / 数据模型

- [ ] **`dap_asset_usage` 只在合成成功时写入，资产被删除后引用行不清理**（`DapAssetService.recordUsage`）：
  删场景 / 产品是软删（`deletedAt`），引用台账里的历史条目仍会显示在**其它**资产的「已用于」里
  （因为标题是冗余快照）。当前是有意的 —— 历史出片记录不该因为素材被删就消失。但缺一个
  「资产已删除」的视觉标记；点进去会 404。定位：`asset-kit.tsx` 的 `AppliedTo` + `DapAssetUsageRepository`。

- [ ] **`DapComposition` 没有回收站语义**（有 `deletedAt` 列但没有软删入口 / 清理调度）：
  合成产物目前只能靠删 IP 间接失联，不能单独删。`DapTrashCleanupScheduler` 也只扫 `dap_avatar`。
  排期时一并把六类新资产纳入回收站与到期清理。

- [ ] **产品「品牌方授权」只是 `DapProduct` 上的两个字段（`brandAuthorized` / `brandLicenseUntil`），
  不是 `DapLicense` 行**（设计 §02 的刻意取舍，见 `apps/web-aiavatar/DECISIONS.md` §H）：
  因此没有凭证文件、没有到期自动失效检查，合成时只作提示不作硬闸。若业务上需要品牌授权可追溯，
  应升级为真正的 LIC 行而不是继续加字段。

### 2026-07-27 · AiAvatar 数字资产平台扩展（v0.104）新发现待办 / 合成 / 生成链路

- [ ] **合成是逐张串行调用图像模型**（`DapAssetJobs.runCompose` 的 for 循环）：
  出 8 张时最坏要等 8 次模型往返。`DapMultimodalClient.generateImage` 目前是单张接口，
  批量出图 / 并发出图需要先扩客户端。排期时评估「一次请求出 N 张」的端点能力（对齐 drama 的 D-11 candidate 思路）。

- [ ] **合成失败时已产出的部分成片不保留**：`runCompose` 出错直接把整单标 `failed`，
  前面几张已经 `storage.store` 落盘的 `DapCompositionOutput` 行还在但用户看不到（结果页只在 done 时展示网格）。
  要么失败时也展示已出的张数，要么失败时清理这些孤儿文件 —— 当前两者都没做。

- [ ] **场景 / 产品的「生成中」状态没有超时兜底**：`status=running` 只由 runner 的成功 / 失败分支翻转，
  runner 进程被 kill 时行会永久卡在 running（与 `dap_job` 的 `heartbeatAt` 一样缺少扫尾调度）。

### 2026-07-27 · AiAvatar 数字资产平台扩展（v0.104）新发现待办 / 前端

- [ ] **`AssetApi.summary()` 在首页与资产库各拉一次**：两处都需要六类计数，但没有共享缓存，
  切 tab 会重复请求。等有真实性能数据再决定要不要提到 `ctx` 层缓存。

- [ ] **资产库分类视图没有分页**：`listScenes` / `listProducts` 一次返回全部，
  单用户资产量上到几百条时列表会变慢。server 侧已按 owner 过滤但没有 limit/offset。

- [ ] **风格模板「从作品提炼」路径只是新建表单**（`asset-create.tsx` 的 `style/path=0`）：
  设计稿写的是「从作品提炼出基调」，当前点它和「新建」走同一个手填表单，没有真的从某张成片反推 promptEn。
  真做需要一个「选一张作品 → 视觉分析出基调」的 AI 步骤。

### 2026-07-27 · AiAvatar 数字资产平台扩展（v0.104）新发现待办 / 本地开发环境（不是代码缺陷，但会让新同事误判）

- [ ] **全新 H2 库启动的 schema 初始化顺序**（2026-10-10 核实）：`db/migration/V48__endpoint_generation_queue.java` 在 Hibernate 首次建模前访问 `ai_model_providers`，全新库会因表不存在拒启；隔离身份链路验收用显式关闭 Flyway 的临时 H2/create-drop，已有产品库和生产本次不改变迁移。另有 `DramaCharacter.cast` 在 H2 建表时命中保留字。需独立补首次建库验收和兼容处理，不修改已经执行的迁移。**2026-10-10 测试补充**：test-only ContextCustomizer 已在 Flyway 前设置 H2 的 MySQL 模式并建立旧表骨架，真实迁移继续执行；不进入生产 JAR。正常 dev 首次启动及 `cast` 保留字兼容仍待处理。

- [ ] **本机 `apps/server/.env` 里的 `AEP_CDN_DRIVER=oss` 会让 30 个 `@SpringBootTest` 上下文加载失败**
  （`java.lang.IllegalStateException: aep.cdn.driver=oss 但未配置 aep.cdn.oss.endpoint`）。
  2026-07-27 核实：**与 v0.104 改动无关** —— `git stash` 到干净树跑同一个
  `AdminUserControllerWalletSecurityTest` 复现完全相同的 6/6 错误。绕过办法是跑测试时显式覆盖：
  `AEP_CDN_DRIVER=local ./mvnw test`（这样 409/409 全绿）。
  `LedgerPlaneTest:33` 已经为这件事单独加过注释和 workaround，说明是长期存在的踩坑点。
  建议排期：要么在 `src/test/resources/application.properties` 里统一把测试上下文钉成
  `aep.cdn.driver=local`（测试本来也不该打真 OSS），要么让 `AliyunOssCdnUploader` 在 test profile 下
  降级而不是 fail-fast —— 前者更符合 §8.0（生产 fail-fast 的行为不该为测试放宽）。

### 2026-08-02 · AiAvatar 真人授权刷脸认证（v0.105）新发现待办 / 外部依赖 / 配额

- [ ] **账号级 3 个分组上限对「多用户并发真人认证」仍是硬约束 → 需要联系七牛提额**（2026-08-02 新增）：
  回收器已能还配额，但仍解不开上限本身 —— ① `active` 分组是生效授权的取证凭据，**长期占用**且绝不回收；
  ② `failed` 分组要等 `group-retention-hours`（默认 24h）才回收；③ 专属 aigc 分组 + 账号默认分组
  已固定占 2 个槽位（当前占用 2/3）。**当前实际上只剩 1 个槽位可供 liveness 刷脸周转**，
  意味着同一时间基本只能支撑 1 路真人实名认证，第 2 路会撞 503 `DAP_MODELINK_QUOTA_EXCEEDED`。
  行动：找七牛把 asset-group / asset 上限提到与预期并发匹配的量级（并确认是否按子账号隔离）；
  提额前**不要**上真人认证的量。定位：`DapProperties.Modelink` + `DapModelinkPoller.reclaimTerminalGroups`。

### 2026-08-02 · AiAvatar 真人授权刷脸认证（v0.105）新发现待办 / 契约 / 出 wire

- [ ] **`LicenseDto` / `AvatarDto` 不出 `captureId`，前端「授权素材」只能按 avatar 维度拉**：
  `dap_material` 的真人素材是 `refType=capture` + `refId=captureId`，但授权卡上拿得到的只有
  `license.char`（= avatarId），所以 `screen-lictaskme.tsx` 的可折叠「授权素材」实际拉的是
  `refType=avatar` 的记录，看不到那次刷脸真正送审的动作视频 / 关键帧。
  修法：`DapLicense` 出 wire 带上取得该授权的 `captureId`（`livenessGroupId` 已能反查到
  `DapMaterialGroup.captureId`，不必加列），前端按 capture 维度再拉一次。
  定位：`DapDtos.LicenseDto` + `apps/web-aiavatar/src/proto/material-status.tsx` / `screen-lictaskme.tsx`。

### 2026-08-02 · AiAvatar 真人授权刷脸认证（v0.105）新发现待办 / 前端

- [ ] **web-aiavatar 覆盖页栈只渲染栈顶，从合成工作台跳去认证再返回会丢失已选槽位**（既有限制，v0.105 发现）：
  `app.tsx` 的 `ctx.startRealAuth(char)` 把「真人捕获（认证）」压栈，返回时合成工作台**重新挂载**，
  人物 / 场景 / 产品的选料与出片设置全部回到初始值 —— 用户刚被 403 拦下、按引导去认证、
  回来还得从头选一遍。同样的问题存在于任何「从工作台跳出去补前置条件」的路径。
  修法候选：覆盖页栈保留非栈顶屏的实例（或把工作台选料状态提到 `ctx` / sessionStorage）。
  定位：`apps/web-aiavatar/src/proto/app.tsx`（栈渲染）+ `screen-compose.tsx`（`MCompose` 本地 state）。

### 2026-08-03 · 跨子产品视频资产串号修复（v0.108）新发现待办

- [ ] **`JwtUtilTest.registerTicket_tamperedTokenRejected` 是既有 flaky（约 1/5 概率失败）**
  （2026-08-03 发现，与 v0.108 无关）：用例把 JWT 末位字符 `a↔b` 改一位当作「篡改签名」，
  但 HS256 签名 32 字节 → base64url 43 字符，**末位字符只有高 4 位有效、低 2 位是填充位**，
  改动落在填充位时解码出的签名字节完全不变 → 校验仍通过 → `assertNull` 失败。
  修法：改动**签名段中间**的字符（或整段替换成另一条合法 ticket 的签名），不要动末位。
  定位：`apps/server/src/test/java/com/aistareco/aep/config/JwtUtilTest.java:33-36`。

- [ ] **成片表 `material_video` 没有子产品分区列**（2026-08-03 顺手记录，当前不构成缺陷）：
  `MaterialVideo`（`/material/videos`）目前只有带货线在写（`MaterialOpsService.addVideos`），
  短剧线成片走 `DramaProject.payloadJson` / `assemble`，故暂无串号。若将来短剧或其它子产品
  也往这张表落成片，必须同步补 `app` 分区（与 v0.108 的 `material_video_job` 同处理）。
  定位：`apps/server/src/main/java/com/aistareco/aep/model/MaterialVideo.java` +
  `MaterialOpsService.listVideos`。

### 2026-09-08 · 画布出视频

- [ ] **`canvas-bridge` 与搬来的画布之间没有契约测试**。这一类 bug 已经出了三次
  （v0.163 / v0.175 / v0.176），共同点是「胶水层按自己想的形状读，调用方按上游的形状传，
  中间全是可选字段」。值得给每个 bridge 函数补一条「按画布真实调用形状调一次」的测试
  （v0.176 的 `video.test.ts` 就是这个形态），或者把 config → 请求参数的映射收进一处纯函数。

- [ ] 视频链支持「全能参考」（参考图不作为首帧，而是主体 / 风格参考）。
  聚算媒体协议侧是否支持需先核对；支持了再把面板那个选项打开。

- [ ] **`check:api-contract` 的「无 handler」告警要清到 0，然后做成硬门**。v0.177 给脚本加了
  Spring 路由扫描，当前列出 24 条前端调得到、服务端接不住的 URL：
  web-music 的 `/me/assets`、`/me/batch-tasks`、`/me/clip-tasks`、`/me/copies`、
  `/me/person-models`、`/me/digital-person/*`（多半是只在 mock 下用的页面），
  `/film/dramas` 的 GET-by-id / POST / PATCH / DELETE，以及 `DELETE /celebrity/videos/{id}`。
  逐条判定「补实现」还是「删前端调用」，清完把告警改成 fail。

- [ ] **两个同名 `apiFetch` 语义相反，迟早还会抄混**。共享包那个收 `body: unknown`（自己序列化），
  `web-aiavatar/src/proto/api.ts` 那个收 `RequestInit`（调用方序列化）。
  aiavatar 迁到共享 client（连带 `authFetch` / `apiUpload`）之前，至少把 proto 那个改名
  （如 `rawApiFetch`），让抄错时编译期就炸。

### 2026-09-08 · 画布出视频 / 2026-09-08 · IP 画布复核（v0.179）

- [x] ~~Studio 固定模型隐藏、剧本与助手模型入口难发现~~ **2026-10-17 本地完成，未发布**：图片、文字、剧本/分镜及助手在创作区显示当前模型；单候选或后台固定时不可切换，多候选使用后台开放列表。回归覆盖单候选可见、固定模式、多模型切换与请求端点/报价。

- [ ] **给出图 / 出视频加幂等请求键**，把上面那个「不可恢复窗口」关掉：客户端生成 key、
  服务端按 `(owner, key)` 去重并把已有运行原样返回（短剧线 `clientRequestId` 已有范式，
  见 v0.145 的 `drama_shorts` 唯一索引）。这是服务端改动，本轮没做。

- [x] ~~模型单价没有任何界面在显示~~ **审计确认，2026-10-17**：原描述过时，`StudioWorkspace` 已按所选图片端点 `creditCost × count` 显示费用并提交 `maxCost`，视频另按计量单位/时长与数量报价；文本完成后显示实际消耗。本轮回归验证切换图片模型同步改变请求端点和报价。

- [ ] `IpStudioController.modelOptions` 对所有视频候选写死 `billingUnit="per_video"`，
  而端点可能是 `PER_SECOND`（按秒计价，见 `MaterialVideoModelClient.itemUnitCost`）。
  **当前不误导用户**（前端没有任何地方读 `billingUnit`），但字段本身是错的：
  接价格展示之前必须先按 `endpoint.billingMode` 给出真值，否则一接就是错的。

- [ ] **画布出图不带 `nodeId`**（服务端因此把它记成 `adhoc`）。带上就能用服务端那道
  「同节点已在生成中」409 闸，也让 `ip_run.node_id` 对得上画布；但画布出 N 张是 N 次
  `count=1` 的并发请求，带同一个 nodeId 会让第 2..N 张直接 409 —— 要带就得先把图片分支
  改成「一次请求 count=N」（服务端本来就支持多候选）。恢复不依赖它（按 runId 就够），故本轮不动。

- [ ] **前端等超时（出图 8 分钟）之后那张图仍接不回来**。v0.179 已保住 runId，
  但候选被标成 error 且**当前一轮不会自动重连**（下一次进画布会）。要做到「就地接着等」，
  得让 UI 区分「还在跑但我们暂时不看了」这一态。

- [ ] `canvas-bridge/api.ts` 的 `runNode` 仍无调用者（画布出图走 `/generate`），
  `src/api/ip-studio.ts` 的 `getRun` / `awaitRun` / `cancelRun` 同理。要么接上、要么退役。

- [ ] **画布视频还没有封面帧**（v0.181 起动态名片已可用，这条只影响首帧观感）。`IpPublishService.registerVideos` 的 `thumbKey` 目前留空
  （宁可没有，也不塞一个指向 MP4 的假封面）。结果是名片视频的 `poster` 回落到静态主图 ——
  能用，但首帧和静态图对不上时会有一次跳变。补法：视频链成片后抽一帧存 CDN
  （`ClipAssetThumbnailExtractor` 已有现成范式），写进 `MaterialVideoJob.thumbnailUrl` /
  发布时带进 `DapDerivative.thumbKey`。

- [ ] **名片首页视频没有「声音」这一档**。`CardFigureTier` 还有个 `voice`（口播成片）。
  自动播必须静音，所以带声音的口播需要用户点一下才能出声 —— 要做得给一个明确的
  「点击播放（有声）」入口，而不是让人以为坏了。

- [ ] **聚算 H3 的尾帧 / 多参考图还没接**（v0.183 只接了首帧 i2v）。文档里还有
  `end_image_asset_id`（`first_last_frame_video` 模式）与 `referenceInputs`
  （`universal_reference_video`，最多 9 图 / 8 图 + 1 视频 / 3 段音频，合计 12 项）。
  接了之后候选的 `supportsFirstLastFrame` 才能打开 —— 短剧线的链式承接（上一镜末帧
  接下一镜首帧）正等着它。

- [ ] **示例素材没有清理路径**。`ipstudio/demo/<demoId>/…` 只增不减：更新一个示例会再复制
  一份，旧的留在 OSS 上（有意为之，回滚只要把 doc 换回去）。攒多了需要一个按 demoId
  对账、删掉没有任何 doc 引用的那些的清理任务。

### 2026-09-08 · 图片类型按字节判（v0.184）

- [ ] **存量图片的类型标签仍然是错的**。`FileStorageService.store` 从 v0.184 起按字节存，
  但**此前存下的**文件（`ipstudio_gen/**`、`dap/**` 等大量 `.png` 其实是 JPEG）没有回填。
  今天不影响任何功能（浏览器自己嗅探；转交厂商那条路已在 `uploadInputImage` 兜住），
  真要清的话是一个「按 key 抽头 32 字节、类型不符就改 OSS Content-Type + 改 DB key」的
  一次性任务 —— 改 key 会牵动所有引用它的文档，收益不抵风险，先记着不做。

### 2026-09-08 · 出片画幅只摆真能出的（v0.185）

- [ ] **带货线的出片模型列表还没带画幅能力**。`MaterialVideoJobService.listModels`
  用的是 `EndpointCapabilityDto.from(candidate)`（不带 geometry），
  `GET /material/videos/models` 因此不报画幅。带货 UI 目前不给用户选比例，
  所以今天不出错；哪天给了就会重演 v0.185。接法：跟 ip-studio 一样传
  `videoModels.videoGeometry(endpoint)` 进去。

- [ ] **画幅只按协议判，没有按端点配置**。`videoGeometry` 现在是「jusuan-media → 768p 横/竖，
  其余不受限」这一条硬编码。将来同一协议下出现画幅不同的模型（或聚算加了新档），
  需要在 `ai_app_endpoint_candidate` 上加列由后台配，或者从成功响应的
  `effectiveMediaSpec` 里学（同 v0.174 记 `minImagePixels` 的做法）。

### 2026-09-08 · 节点操作条（v0.186）

- [ ] **图片节点的「显示按钮文字」偏好与自动收起是两套**。`showImageToolLabels` 是用户在
  「自定义工具栏」里存的偏好（默认关），`compact` 是按缩放自动收 —— 现在是 `!compact && 偏好`，
  语义上没问题，但用户如果打开了偏好、再缩小画布，会以为设置失效了。要么在那个设置面板里
  说明「缩小后自动只留图标」，要么给偏好一个「始终显示」的强制档。

### 2026-09-08 · 操作浮层停靠（v0.187）

- [ ] **底部创建工具条的 `left: 300` 是个偏移，不是侧栏宽度**（`canvas-toolbar.tsx:91`）。
  它的包含块已经是画布区，那 300 让它在画布区里整体右移 300px —— 窗口窄到画布区不足
  316px 时会被算成 0 宽、整条消失（实测 535px 窗口下确实没了）。上游代码，改动要小心；
  合理的写法是 `inset-x-0` + 居中，靠 `padding-left` 让开左下角的缩放控件。

- [ ] **停靠面板与底部创建工具条竖直方向靠得近**（面板 `bottom-[88px]`，工具条 `bottom-5`）。
  面板内容长时 `max-h-[58vh]` 会滚动，不会压到工具条；但窗口很矮时两者仍显拥挤，
  可以考虑面板展开时把创建工具条淡出。

## 早期候选计划

保留 v0.6–v0.62 的未完成候选及分期依赖。重复事项已归并；旧日期下的环境、凭据和能力观察需先复核再排期。

### v0.6 候选（2026-05-09 收集） / 持久化与基础设施

- [ ] **微信支付真实商户配置与业务验收**（历史候选，当前配置需复核）：v0.93/v0.94 已接支付驱动、网关、幂等回调和对账轮询，微信 V3 与支付宝/人工核准并存，渠道及凭据由 admin 后台管理。原“只能手动核准”的描述过时；后续先核对真实渠道启用状态与商户配置，再验收支付、回调和对账，不能把已有支付驱动重复当成待开发。

### v0.6 候选（2026-05-09 收集） / LLM provider 拓展

- [ ] **国产 LLM provider 真实调用**：`AiModelInvocationService` 当前只支持 `OPENAI / OPENAI_COMPATIBLE` 走 `/chat/completions`。`ANTHROPIC` 用 `/v1/messages` 不同路径；`BAIDU / ALIYUN / TENCENT` 都是各自鉴权。各自加 adapter。

### v0.6 候选（2026-05-09 收集） / 配置中心 / 字典上移（spec §10）

- [ ] **`ConfigItem` 配置中心**：`docs/ADMIN_PRODUCT_SPEC.md` §10 设计已写。需要落实体 + 草稿 / 审核 / 发布状态机 + 灰度（白名单 / AB 桶）。

  原“ConfigItem + 17 字典上移”重复项已合并；各子应用字典与 `/celebrity/dictionaries` 仍分别保留，避免把配置中心实现当成所有字典已迁移。

- [ ] **各子应用 `constants/*` 字典上移**（**描述过时**，2026-08-03 随 apps/web 删除审计更新：原描述的 `apps/web/src/constants/*` 17 个文件已随 apps/web 一并删除，但同类硬编码字典已分散到各新 app 自己的 `constants/*-ui.ts`，未消失——`web-music` 18 个 / `web-drama` 13 个 / `web-celebrity` 3 个 / `web-star` 1 个 / `web-aiavatar` 0 个，需求本身仍未解决）：详 `docs/ADMIN_PRODUCT_SPEC.md` §7.5。

- [ ] **`/celebrity/dictionaries`** 当前 hard-coded 默认值；接 ConfigItem 后改为运营可配。

### v0.6 候选（2026-05-09 收集） / 通知 / 实时

- [ ] **WebSocket 升级路径**：当前轮询 15s + 5s + 业务关键点 trigger 已"近实时"。如需 < 1s 双向 / 离线提醒，按 `apps/miniprogram/app.js` 末尾 TODO 4 步上：spring-boot-starter-websocket → 按 userId hold session → 业务事件 emit → 30s ping / 60s 重连。

- [ ] **`wx.subscribeMessage` 模板消息**：用户离线推醒（生成完成 / 授权审核结果），需要走小程序模板 ID 申请。

### v0.6 候选（2026-05-09 收集） / 模板脚本（spec §3.2.7 video_ref 模式）

- [ ] **video_ref 自动检测**：当前接 URL 并默认 `reviewStatus=approved`。v0.6 加 `VideoReferenceIngestService` 做转码 + 抽帧 + BGM BPM + NSFW + 主色板检测，结果回填到 `referenceClip.autoAnalysis`。

- [ ] **OSS / CDN 文件上传**：当前 admin 表单只接受 URL（明星 photos/videos / 模板预览 / 参考视频）。v0.6 接 OSS multipart 上传，后端代签 STS 临时凭证。

- [ ] **A/B 桶 + 多人审批**：当前 `experiment` / `metrics` 字段保留但不分桶；publish 单 admin 即可。v0.6 加双人复核 + AB 分桶（按 `userId` 哈希）+ 30 天指标回流。

### v0.6 候选（2026-05-09 收集） / 基础设施收敛

- [ ] **Bot 消息真实事件触发推送**（替代或补充当前拉模式）：业务事件触发器（生成完成 / 审核通过）→ 写 `Notification` → WebSocket 推。当前拉模式是"在线时近实时"，事件触发是"离线也能感知"。

- [ ] **sau-service 验证浏览器进程复用（中期）**：当前 `apps/sau-service/src/sau_service/routes/accounts.py:_verify_real` 每次 verify 都 `async_playwright().start()` → `chromium.launch()` → `new_context()` → 用完关掉。冷启 chromium 一次 ~3-4s，CPU/RAM 峰值高。
  - v0.5.x 已做（2026-05-21）：前端串行 + 10min TTL skip + server `SauServiceClient.verifyMutex` Semaphore(1) 兜底，短期足够。
  - 下一步（v0.7 候选）：sau-service 内常驻一个 `patchright` persistent context worker，每次 verify 只是 `context.new_page()` + 复用 storage_state；用完关 page 不关 context。预计 verify 单次开销从 3-4s 压到 ~0.5s。
  - 实现要点：
    - 在 `sau_service/lifespan.py` 起 verify worker（singleton，跟 FastAPI lifespan 绑）；
    - 引一个 `asyncio.Lock` 保证 worker 单线程（playwright API 不是线程安全的）；
    - storage_state 注入改用 `context.add_cookies()` 而非 `new_context(storage_state=...)`，避免每次重建 context；
    - 验证完用 `context.clear_cookies()` 清场，下一个账号重新注入；
    - context 健康度监控：连续 N 次失败 → 重建 context（防 chromium 内存泄漏）。
  - 触发条件：用户反馈 verify 仍慢、或绑定 / 任务的 chromium 开销也想合并优化（同 worker 共用即可）。

  合并记录中的候选方向：常驻 persistent context worker；原“0.5s”仅为目标，未经本轮性能验证。

- [ ] **HTTP-only cookie 探测（长期）**：彻底脱离浏览器跑 verify。
  - 思路：每平台找一个登录态保护的轻量 API（如 `/aweme/v1/user/profile/other_basic_info/`），带 cookie 发 HTTP 请求 → 200/有效 vs 401-302/失效。
  - 优势：单次 verify 从 0.5s（复用 context）再压到 ~100ms HTTP RTT；彻底无浏览器进程。
  - 风险（这是它没成为短期方案的原因）：
    - 抖音 / 视频号 / 小红书 / 快手 全部要 **签名头**（`_signature`、`x-s` / `x-t`、`msToken` …），逆向难度高、跟版烦。
    - 平台改一次签名算法这套就失效，工程量大但回报曲线陡（一次 bug 就报废）。
    - 反爬 fingerprint 检测（UA、TLS、JA3）可能直接挡掉裸 httpx。
  - 渐进策略：
    1. 先选一个平台试点（建议视频号，签名相对稳定且没有 msToken 死循环）。
    2. 在 `apps/sau-service/src/sau_service/routes/accounts.py` 加 `_verify_http(driver_cls, storage_state)`，跑成功 + 浏览器路径并行对比一周，看准确率。
    3. 准确率 ≥ 95% 后切为该平台默认 verify，浏览器路径作为 `?force_browser=1` fallback。
    4. 逐平台滚动覆盖；任一平台失败 → 立即 fallback 浏览器，不阻塞用户。
  - 触发条件：日活账号验证次数 > 10k / 天且 sau-service 已成瓶颈；或对验证延迟有 < 200ms SLA 要求。
  - 不做的版本：实现一个通用 anti-bot bypass。这是猫鼠游戏，不在本产品定位内。

  合并记录补充：先以视频号试点，签名头逆向工作量需单独评估。

### v0.6 候选（2026-05-09 收集） / dashboard 待办真实统计

- [ ] **"数据日报" todo count**：`NotificationService.computeTodos` 当前回退常量 1。接 dashboard summary 后改为真实未读统计。

### 三子产品 web app 待办（2026-05-15 收集 + 合并自各 README） / 跨工程通用（CG-*）

- [ ] **CG-4** `proxy.ts /console` 兼容 308 重定向：三工程 `src/proxy.ts` 当前把旧 `/console[?tab=xxx]` 重定向到新顶层路径。观察期（无残留旧书签）后删除。

- [ ] **CG-6** ESLint 实际告警审计：环境装 `node_modules` 后跑 `pnpm -r run lint` 摸底。静态摸底已做（2026-05-15）：3 工程无自定义 ESLint config 走 Next 16 默认；0 处 `@ts-ignore`；7 处 `eslint-disable-next-line` 全部合理（5 × `react-hooks/exhaustive-deps` + 1 × `no-unused-vars` + 1 × `no-explicit-any` drama-query suspend cast）。

- [ ] **types 上推（持续项）**：community / appearance-forge / celebrity-zone 等域随 OpenAPI 接入逐步上推到 `packages/types`，并按 CLAUDE.md 硬规则 1 同步 admin/server *Dto。

### 三子产品 web app 待办（2026-05-15 收集 + 合并自各 README） / apps/web-music 专项（M-*）

- [ ] **M-1 真 TODO 3 处**（依赖后端或大重构）：
  - `src/translations.ts:2` —— 中文单语化兜底清理（清除组件 `lang: Lang` prop 透传 + `TRANSLATIONS[lang]` 访问，工作量大需逐文件验证）
  - `src/api/community.ts:3` —— OpenAPI 尚未覆盖本域（社区 / 粉丝运营 listFanTiers / getFanGrowth / listActivities 全 mock）
  - `src/api/appearance-forge.ts:87` —— AI 视频生成尚未接入（mock 走 `DEMO_FORGE_VIDEO_POOL`）
  - 备注：原 backlog 6 处中另 3 处（`AgencyOverview.tsx:11` IA 设计注释 / `IncubationWizardV2.tsx:923` 表单校验 UI 文案 / `AppearanceForge.v3.tsx:925` 空态 UI 文案）不是代码 TODO，已修正描述。

- [ ] **M-2 剩 5 处 any**（22 处 → 5 处，已清扫 18 处 / 78%，2026-05-15）：
  - `NFTMintingDialog.tsx:25` `track?: any` + `MusicGenerationDialog.tsx:21+39` + `MusicBusiness.tsx:126` —— mock track shape 用 `style` 字段而 `Song` 类型用 `genre`，且 `duration` 字符串/数字混用。需 schema 对齐（或定义独立 `GeneratedTrack` interface）。
  - `dashboard/charts/TypeDistributionPie.tsx:41` `ActiveSliceShape(props: any)` —— recharts ActiveShape 形参类型由内部 sector 数据 + 用户配置 prop 混合，行业惯例保留 any。

- [ ] **M-3 inline style 渐进迁移**：约 193 处 `style={{}}` → Tailwind v4 token。高 ROI 集中点：`AppearanceForge.v3.tsx` / `IncubationWizardV2.tsx` / `MCNMatrix.tsx`。颜色 / 间距优先；动态计算值（百分比、translate）保留 inline。

- [ ] **M-4 img alt 审计**：约 52 处 `<img>` 未确认 `alt`，跑 `pnpm --filter @ai-star-eco/web-music lint` 借 `jsx-a11y/alt-text` 自动审。

### 三子产品 web app 待办（2026-05-15 收集 + 合并自各 README） / apps/web-drama 专项（D-*）

- [ ] **D-1 真后端 CRUD**：`apps/server` 落地 Drama / Script / ScriptVersion / DistributionJob / Transaction 实体 + REST。DTO field 名严格 mirror `packages/types/src/script.ts` + `publish-job.ts`（CLAUDE.md 硬规则 1）。

- [ ] **D-2 openapi 同步**：`specs/openapi.yaml` 加 drama / script / distribution / finance paths，跑 `pnpm check:api-contract` 验证。
- [ ] **部分完成**：**D-3 inline style 渐进迁移**：实测 **~1615 处** `style={{}}`（原估 573 严重低估），drama 是 Figma Make 移植、inline 精确定位是其设计工作流的一部分 —— **机械全量迁移不现实且高风险、零用户可见收益**，结论改为「按重复模式渐进提取到 app.css 工具类」。**v0.67 已做**：提取 `.icon-badge`（accent 渐变图标盒不变部分：grid 居中 + flex none + 白图标）+ 迁移 4 处代表（short-clip / quick-create / outline / ai-chat-panel，各档尺寸；computed-style 验证逐属性等价、零回归）。注意：grep 命中的「图标盒」混杂（圆形 FAB / 金色装饰点 / 布局容器误报），不可机械批替；后续每提取一个模式新增一个 app.css 工具类即可。

- [ ] **D-4 发布任务状态机**：`createPublishJob` mock 用 `setTimeout` 推进 queued → uploading → live。真后端落地后换 SSE 或 polling endpoint。

- [ ] **D-5 admin 镜像**：`apps/admin` 加 drama 管理视图。

- [ ] **后续可选**：VLM best-of-N 首帧一致性自检。~~`lastFrameUrl` 末帧 CDN 镜像~~ **C-1 完成**（v0.99，2026-07-10）：`MaterialVideoJob.lastFrameCdnKey` 真值列 + worker 末帧下载镜像（失败 best-effort 仅 WARN 不 markFailed）+ `toCard` `signKey` 派生 fallback 旧 URL；同批落 `/render/{frame,clip}` 返回体 `applied_refs` 参考生效回报（`MaterialVideoWorkerTest` + `DramaRenderServiceTest`）。真源 `docs/drama-consistency-engine-design.md` §2。

- [ ] **C-4 MaterialVideoJob shotId/sceneId 索引列**（C-3 遗留，DAG 时必做）：C-3 的「同场上一镜真实末帧」权威回退目前用 `MaterialVideoJobRepository.findByOwnerUserIdAndScriptIdOrderByCreatedAtDesc` 拉该项目全部 job 后**内存解析 `variantConfigJson`** 匹配 `scene_id`/`shot_id`（`DramaReferenceAssembler.jobLastFrame`）。大项目 job 多时有内存/扫描成本。C-4（跨镜 DAG 编排）应给 `MaterialVideoJob` 加 `shot_id`/`scene_id` 索引列（ddl-auto=update 自动加）+ Repo `findFirstByOwnerUserIdAndScriptIdAndShotIdAndStatusOrderByCreatedAtDesc`，把内存扫换成索引查询。当前 C-3 内存扫描可接受（架构师裁决），不阻塞。

- [ ] **部署后核对线上聚算 H3 候选的「最多参考图」**（2026-09-30 热修附带）：v0.131 接 H3 时候选按当时能力标了 `maxRefImages=0`（见 `docs/VERSION_HISTORY.md` v0.131 段），v0.183 接通 i2v 后没人改回来。若线上仍是 0，热修后 H3 照旧不收首帧（界面如实报「当前模型仅开放文生视频」）；要让首帧生效需在后台「AI 应用绑定 → 候选端点与能力」把 H3 改成 1。尾帧仍未接，`supportsFirstLastFrame` 保持 false。

- [ ] **web-drama 没有 `not_in_storage` 的文案**（2026-09-30 热修引入的新原因码）：`components/drama-workshop/storyboard-table.tsx` 的 `REF_REASON_LABEL` 与 `api/render.ts` 的 `AppliedRefReason` 各加一条（建议「这张首帧不是本站存的图片，这个模型收不到」）。未加之前 hover 显示「首帧：未生效」，如实但不具体。

- [ ] **v0.92 之前生成的短剧首帧没有存储台账行**（2026-09-30 热修时核实，低优先级）：`storage_assets` 是 v0.92（2026-06-29）才加的、没有回填，`StorageQuotaService.record` 也是 best-effort。这类老首帧拿去聚算 H3 出视频会被 `DRAMA_FRAME_NOT_OWNED` 拒（提示语让用户重新生成这一镜首帧，重新生成即可）；走 URL 的协议（seedance 等）不受影响。真有人碰到再按 `drama_projects.payload_json` 里的 `drama/frames/…` key 给项目 owner 回填台账，不要为此放宽归属判定。

- [ ] **D-13 渲染扣费形态统一（debit vs hold→commit）**（v0.101 C-2 引入的有意分裂，待未来收敛）：`renderFrame` 单产物用一次性 `CreditService.debit`（SPEND），C-2 三视图批产物用 `hold→逐角度 commit`（FREEZE→SPEND，需部分成功部分退）。两形态并存 → 短剧「首帧类扣费」在账本上出现 SPEND 与 FREEZE→SPEND 两种流水形态。可接受（语义不同：单产物 vs 批产物部分退），但若未来统一渲染扣费口径，应把 `renderFrame` 也改 hold→commit（或反之）以让账本形态一致。定位：`DramaRenderService.renderFrame`(`creditService.debit`) vs `DramaReferenceAssetService.generateReferenceSheet`(`hold/commitHold/releaseHold`)。

### 三子产品 web app 待办（2026-05-15 收集 + 合并自各 README） / apps/web-celebrity 专项（C-*）

- [ ] **C-1 inline style 收敛**：约 28 文件 `style={{}}`，集中在 `creator/Button.tsx`（微调 fontSize / padding 12.5/13.5/14.5）和 `creator/GradientBlock.tsx`（多层 gradient 叠加，动态值难替）。可缓做。

- [ ] **C-2 真后端落地**：13 个 celebrity-zone 函数 + products CRUD 等需 `apps/server` 配套 Spring 实体 + REST + DTO（field 命名严格 mirror TS interface）。

**v0.132 明星带货短视频重构 · 出圈登记（2026-08-17，方案经 codex-cli 两轮评审）**：

- [ ] **链路 A（明星形象生成）真实化**：v0.132 起 live 模式在 `/star/{id}/generate` 页面层拦截为「能力建设中」（老逻辑 `startGeneration` 真扣积分但无真实引擎 + 前端 BigBuckBunny 假成片，违 §8.0）；演示流程仅 USE_MOCK。真实引擎接入时移除拦截并把 `CelebrityGenerationWorkspace.handleProgressComplete` 改读任务真实产物。

- [ ] **ENGINE_META 假价体系退役**（随链路 A）：`constants/celebrity-zone-ui.ts` 的 KeLing/HiGen/MiniMax 50/120/300 纯前端常量，不映射任何真实 endpoint；真实化时改走 `/celebrity/engine-pricing` 或统一到 candidate 报价。

- [ ] **两套 ProductPickerDialog 合并**：`celebrity-zone/`（拷文本丢 productId）与 `material-ops/`（绑 id + v0.132 免商品路径）重复实现、行为不一致。

- [ ] **material-ops 存量类型上移 packages/types**：v0.132 只把新 wire 契约（`VideoModelOption` 等）放进 `packages/types/src/material-ops.ts`；`ScriptAsset`/`MaterialVideo` 等仍在 `apps/web-celebrity/src/components/material-ops/types.ts`（违 §4.1 的历史欠债，随 openapi schema 化一并上移）。

- [ ] **`ai_app_endpoint_candidate.minDurationSec` 列**：v0.132 有效下限只来自协议适配器（jusuan=5），未知协议下限=null；admin 若需对 generic 端点配置下限需加列（加列后 `MaterialVideoModelClient.intersect` 取 max(协议, candidate)）。

- [ ] **/library 三 tab 数据融合**：明星视频/脚本视频/混剪成片仍各读各的 API（`library/page.tsx` 注释自承）。

### 三子产品 web app 待办（2026-05-15 收集 + 合并自各 README） / Cross-cutting（types / packages）

- [ ] **Script / PublishJob server `*Dto`**：drama 真后端落地时按 `packages/types/src/{script,publish-job}.ts` 字段名严格 mirror（与 D-1 协同）。

- [ ] **community / appearance-forge types 上推**：music 这两域接入真后端时，把本地 `src/types/...`（如有）上推到 `packages/types`，同步 admin/server *Dto。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / 部署 / 生产基础设施（v0.34 之后）

- [ ] **同一服务的并行发布缺少互斥与版本核验**（2026-10-13）：`infra/scripts/deploy-release.sh:extract_app` 的目标目录及 `.__previous__` 被并发部署共用，健康检查可全绿但最终运行较早包。本次 AiAvatar 重应用后以 BUILD_ID 和浏览器确认恢复；后续在服务切换区增加远端锁，并在验收中核对实际 BUILD_ID/包哈希，不能只检查 HTTP 200。

- [ ] **（可选）若要恢复 Actions 自动部署：用部署专用受限 key，不放主钥**：长期生产私钥交给 GitHub 会扩大爆炸半径。需要时专门生成一把 deploy key（`authorized_keys` 加 `command=`/`from=` 限制，泄露可单独轮换），再补回两个 step + `PROD_SSH_*` secrets。

- [ ] **Phase 3 · 全栈容器化 + CI/CD**（v0.34 显式 v0.35+）：server + sau-service + 5 个 web app 出 Dockerfile + docker-compose；GitHub Actions 跑 build / typecheck / contract / push 镜像 + 部署。

- [ ] **Phase 4 · 用户上传素材 OSS 化**（v0.34 显式 v0.35+）：`MixcutAsset` 上传从本地 fs（`./mixcut-assets`）切换到 OSS（沿用 `AliyunOssCdnUploader`）。当前 v0.14 已做 mixcut **渲染产出** OSS 化；用户**上传**仍落本地。

- [ ] **Phase 5 · 多实例 + Redis + ShedLock**（v0.34 显式）：
  - `PublishJobScheduler` / `MixcutOutputCleanupScheduler` 两个 `@Scheduled` 加 ShedLock（源码注释已挂 TODO）
  - **dap 域两个 `@Scheduled` 同一债务**（2026-08-02 补记）：`DapTrashCleanupScheduler`（回收站到期清理）与
    v0.105 新增的 `DapModelinkPoller`（modelink 非终态分组 / 素材收敛轮询，`fixedDelay` 默认 10s）。
    后者多实例下会对同一批非终态行重复打上游 —— 语义上幂等（都是 GET 后落库），但会**成倍消耗
    modelink 配额**并放大限流风险，所以和上面两个一起纳入 ShedLock（源码注释已挂 TODO）。
  - `SmsCodeService` in-memory `ConcurrentHashMap`（验证码 + 失败次数 + 锁定态）→ Redis
  - JWT 黑名单（v0.31 提到的 operatorRole 变更后旧 token 不失效问题）→ Redis 黑名单
  - ~~Cookie SSO 跨子域（`packages/api-client/src/_client.ts` 现有 TODO）~~ **改判不做**（2026-09-04）：由统一账号中心取代，见文首「2026-09-04 · 统一账号中心」段

- [ ] **Phase 6 · K8s / ACK**（v0.34 显式）：从 ECS + systemd 迁到 ACK，HPA + 滚动发布。

- [ ] **Flyway V1__baseline.sql 当前是空占位**（v0.34 §B）：切 `ddl-auto=validate` 之前需把生产 schema `mysqldump` 出来填入 V1；当前依赖 Flyway 看到现存 schema 自动 baseline 到 V1 但不执行。

- [ ] **RDS 应用账号 Flyway 接管后降权**（v0.34 §C）：从 `CREATE/ALTER/DROP` 降到 `SELECT/INSERT/UPDATE/DELETE + EXECUTE`。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / 钱包 v2 独立评审遗留（2026-06-26，C6 已修两 HIGH，其余记录）

- [ ] **M1 per-actor 日限额是软护栏非硬不变量**（评审，2026-06-26）：仅约束「单个 maker 发起量」，复核无总量上限；且 check-then-insert 有 TOCTOU（两并发 compensate 同读 `already` 都过）。当前作软护栏可接受；若要硬上限需 per-maker 串行化（短锁 / 唯一约束计数行）。已在 commit message 注明仅「发起量」语义。

- [ ] **M3 对账是粗粒度聚合勾稽、非逐单 join**（评审，2026-06-26）：`drift=Σ订单 − Σ账本RECHARGE` 只能抓「整体总额不平」，抓不住「单笔金额错配但总额恰好抵消」「RECHARGE 无对应订单」「bonus GIFT 不与 order.bonusCredits 勾稽」。作快速 tripwire 够用；要真 lost-update 检测需 left join orders↔ledger by referenceId 逐单核。

- [ ] **L1/L2 记录**：`releaseHold` 部分 commit 后按比例退桶有整数除法偏置（总额守恒、桶纯度有微偏，非泄漏）；`WITHDRAW` 账本 `referenceId`/`cashArtifactId` 为空（资金面凭证未链，审计可追性弱）。均低优先。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / admin 后台健全（v0.31 / v0.32）

- [ ] **admin TS 类型 enum 大小写归一**（v0.32 注意事项）：当前 wire 是小写（`"super_admin"`/`"operator"`）但 admin TS 类型用大写（`"SUPER_ADMIN"`/`"OPERATOR"`），靠 `useAdminRole` + `staff.ts.normalize()` 在 API 边界翻译。可统一为小写跟其它 enum 一致。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / 安全 / Auth（2026-04-21 块剩余）

- [ ] **`DevAutoAuthFilter` 门控统一**（2026-04-21 §根因 3）：`@Profile("dev")` → `@ConditionalOnProperty("aep.dev-auth.enabled")`，与 `DevAuthController` 对齐。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / sau-service（v0.17 ~ v0.19）

- [ ] **SMS 风控人机交互 — 真实 selector driver**（v0.19 §B）：当前 `_PlaceholderSmsDriver.detect()` 永远返回 `None`；整 stack 已联通但**生产不会触发**。需要在抖音/视频号触发风控时抓 SMS 弹窗 DOM 选择器替换占位实现。

- [ ] **sau-service driver selector 首次绑定后按诊断 WARNING 回填**（v0.17.1 ~ v0.17.3）：XHS / 视频号 / 快手 driver selectors 是基于上游 sau 命名约定**猜的**；首次真实绑定后看 `[<platform>] extract_profile incomplete after retry budget` WARNING dump 取真 class / outerHTML 回填。

- [ ] **XHS 改用 `xhs-toolkit.XhsClient.get_qrcode()` API 替代 DOM scrape**（v0.17.3 注意事项）：上游 `pokocat/social-auto-upload` 的 `xhs_uploader/xhs_login_qrcode.py` 走的就是这条 API；DOM scrape 是临时活路。

- [ ] **upstream `social-auto-upload` patch `on_page` callback**（v0.19 §B 注意事项）：当前 `_hook_chromium_for_page_capture` monkey-patch `chromium.launch()` 抓 page，耦合上游用 `launch()` 而非 `launch_persistent_context()`。长期 fork 上游加 callback 参数。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / 混剪 / 分发（v0.15 ~ v0.30）

- [ ] **`PublishJobScheduler` 多实例 ShedLock**（v0.15 注意事项 / 源码注释 v0.16+ 候选 → 实际推到 Phase 5）。

- [ ] **`MixcutOutputCleanupScheduler` 多实例 ShedLock**（v0.21 §C，同上）。

- [ ] **`expandSchedule` jitter 可重放**（v0.20 注意事项）：当前 `ThreadLocalRandom` 不可重放；未来要可复算引 `seed = hash(projectId, i)`。

- [ ] **批次取消 / 重新调度的 campaign 级语义**（v0.23 显式 out-of-scope）：当前只支持 tracking tab 单条 cancel，批次级 cancel-all 还未做（v0.23 仅做了批次聚合显示）。

- [ ] **跨账号错峰 / interval / random_window / weekly 派单策略**（v0.20 out-of-scope）：`ScheduleSpec` discriminator 已预留扩展位。

- [ ] **手动 URL 输入合并进分发工作台**（v0.16 注意事项）：当前 `ManualDistributeDialog` 独立弹窗，字段差异大未 inline 合并。

- [ ] **`mixcut_output.last_published_at` server 落库稳态去重**（v0.16 已废弃 localStorage；v0.19 §A 已加 `publishCount` + `lastPublishedAt`，本条已实质完成 → 可在下次 audit 时勾掉确认）。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / 商品 / 模板 / 素材

- [ ] **抖音以外平台 商品链接 handler**（v0.28 显式未实现）：当前只 `DouyinQueryEmbeddedHandler` + `DouyinHtmlScrapeHandler`。

- [ ] **商品图本地化备份**（v0.28 显式未实现）：当前外网 CDN URL 直接登记，不下载本地。

- [ ] **AI 生成带货视频**（v0.28 显式未实现）：当前仅在 `MixcutAsset.subkind` 预留 `"ai-marketing-video"` 占位。

- [ ] **`PublishJob.productId` 冗余列**（v0.28 显式未实现 — 当前依赖 `MixcutRenderJob.productId` + BatchPublishDrawer 反查 Product 来 prefill 抖音商品挂载）。

### v0.7 ~ v0.34 累积待办（2026-05-27 整理） / 文档 / 元数据

- [ ] **根 `PRODUCT.md` `## Register` 段补全**：当前只写了一个词 `product`，像未完成的脚手架。其余段（Users / Brand / Design Principles）齐全，是 `/impeccable` skill 的强制上下文，**保留不删**。

### 2026-06-10 · v0.60 数字人收敛 Phase 2 backlog

- [ ] **drama 成片用脸**：短剧生成（/me/drama/episodes/generate）把角色绑定的数字人形象图
      作为 i2i 身份输入（复用 dap imageKey / derivatives 资产），成片角色脸 = 数字人。

- [ ] **音色联动**：`DapAvatar.voiceName` 传导给 drama 配音 / music 演唱。

- [ ] **drama 角色实体化**：DramaScript payloadJson 里的角色升级为实体（characterName + artistId + dapAvatarId），
      支持一剧多角色各绑不同数字人。

- [ ] **物理删除已退役源码**：music IncubationWizardV2 / AppearanceForgeV3、drama 孵化器 / 锻造炉组件
      及对应 api/mocks（v0.60 仅下线入口，源码保留一版）。

- [ ] **运营动作**：新发秘钥默认带 aiavatar 平台权限（admin per-账号 platforms 已支持），
      避免 music/drama 用户引入列表为空却进不去 AiAvatar。

### 2026-06-11 · web-star 明星商务端 v0.62+ 候选（调研记录，暂不做）

- [ ] **① 内容审核链路打通（v0.62 主题候选，价值最高）**：`StarContentReview` 当前仅
      `StarWorkbenchDataInitializer` seed 写入，web-celebrity 无任何送审入口。
  - celebrity 侧：混剪产出 / 视频引用已授权明星时，发布前创建 StarContentReview，发布被审批门控；
  - star 侧审批 UI 已有，接真实队列即可；revision 意见回流 celebrity 端可见、可返工重提；
  - 顺带让 `/rules` 绿黄橙红四区规则真正生效（提交时向创作者展示约束 + 审核依据）——
    当前规则启停改了也没有任何消费方。

- [ ] **② admin star 运营镜像（`/api/admin/star/**`）**：报白 5 步推进 / IP 资产 advance
      （火山回执）/ 品牌授权 platformReview / 平台路寄样，当前全由明星 principal 自己经
      `StarWorkbenchController` 的 `/advance` 推进。现实中是平台 / 技术公司动作，应移到
      admin；明星端只留属于明星的决策（批准 / 驳回 / 签收）。亦是 CLAUDE.md SOP Step 4
      admin 镜像欠账（star 域在 admin nav 无入口）。

- [ ] **③ 报白 / 数字人 / AI 形象授权发起端**：web-celebrity 当前 0 处报白相关代码。
      报白可挂在已有社交账号绑定（v0.17 SocialAccount）上发起；数字人 / AI 形象授权申请
      与混剪、数字人生成做用途门控联动。

- [ ] **④ 收益与合同真实化（可后置）**：授权 / 品牌合作批准后自动生成 `StarContract`
      （当前合同中心为静态 seed）；`StarRevenueMonth` 从商品库 salesCount / GMV 派生
      （依赖真实支付链路）；侵权巡查当前亦无监测源。

- [x] ~~视频节点缺少上传入口、MP4内部编码被硬拒~~ **2026-10-17 完成**：空视频节点直接上传/原位替换；media-import自动将可读非H.264/AAC素材转为兼容MP4，转后质检并保留音轨/时长，失败不写存储；真实多编码样本及节点/拉片定向回归。
- [x] **视频节点局部暖白配色（2026-10-17，已生产发布 2011deda）**：媒体面暖白，标题/状态栏白色，深墨文字与米灰边线，与外围蓝灰画布区分；18项相关回归及应用类型检查通过。
- [ ] **用户反馈视频卡片中间拖不动（2026-10-17）**：本地正常/失败空视频卡片、手形/选择工具及55%缩放均可从中间图标、说明或空白拖动；暂未复现用户现场，不标为已修复。线上制品也没有仅限标题拖动的配置，仍需定位发生问题的具体页面状态。

### Studio 统一画布封面（2026-10-17）

- [x] 项目/灵感共用人工封面 → 自动图片 → 画布缩略图，独立上传/选择/恢复/失败重试，21 项前端 + 91 项服务端测试及类型/契约检查通过，包含内置官方模板上传。
- [x] 已提交部署 a4092626，线上上传/刷新/恢复自动与灵感封面已验收，记录见 docs/releases/studio-shared-covers-production-20261017.md。

### 2026-10-23 · Studio 单轮对话额度独立（已生产发布）

- [x] 对话累计额度从普通文本调用分离：默认输入 1048576 / 输出 65536 Token，后台独立配置，可按端点覆盖；capabilities、发送报价、冻结 / 实际结算与制作阶段预留同步，受理快照及普通文本额度保留。暂停提示说明已完成内容与继续计费。
- [x] ~~发布后观察真实多步任务的累计 Token 与暂停原因，确认正常任务不再频繁遇到用量保护~~ **已取代，2026-10-23**：用量保护整体删除，由「Studio 对话去掉「继续」」的任务链取代（见本文件同名一节）；真模型长任务验收挪到那一节。

验证（本轮）：68 项后端定向回归（含本机模拟厂商、H2 持久化与真实积分账本的对话集成）和 77 项助手 / 对话交互测试通过；`pnpm typecheck:all`、`pnpm typecheck:admin`、后端离线编译、`pnpm check:api-contract` 通过。后端使用独立临时构建目录避开其他开发进程重编译同一 target；未调用付费厂商，未发布。


### 2026-10-23 · 原任务回放与确认继续（已生产发布）

- [x] 只读定位 `IPR-3caf6046c68d40dea34b` 的 58621 / 1254 Token 中断与继续后的属性式动作不执行，加入真实用量回放。
- [x] 确认继续以已批准金额为约束，取消内部 Token 分配 / 步数 / 工具次数 / 用时暂停；保存来源与原目标，保留真实预算、停止和制作授权，兼容并过滤属性式动作。
- [x] 20261023-studio-dialogue-recovery 已发布，真实 Qwen 短剧与旧失败对话续接、保存刷新通过；46 步越过原阈值采用确定性集成验证。未重投线上已有图片或视频任务。

本轮续接验证完成：133 项后端回归、80 项前端回归通过，全仓 / 后台类型与 API 契约检查通过；隔离编译通过，被测核心源文件与工作区一致。46 步续接集成没有中间限额消息，幂等重发不增加调用或扣费。真实线上记录仅只读查询，未重投或发布。

### 2026-10-23 · Studio 发送状态与错误诊断（已生产发布）

- [x] 未知送达先核对后同键重试，结构化错误与真实消息编号保留，明确拒绝恢复草稿，报价变化就地刷新。
- [x] 160 项前端回归与编译门通过；main 构建发布仅 Studio 前端，两种线上故障注入均自动恢复且每条只有一次受理/实际扣费。见 `docs/releases/studio-message-delivery-release-20261023.md`。

### 2026-10-23 · 企业邀请复制（已生产发布）

- [x] 原生纯文本与弹窗可见字段备用复制、真实写入判断、弹窗内失败提示和完整链接选中，防止失败后仍保留旧图片却误认为复制成功。
- [x] 22 项回归及编译门通过；三条浏览器路径实际系统粘贴验证，干净 main 构建仅发布 Studio 前端，线上脚本哈希一致。见 `docs/releases/enterprise-invitation-copy-release-20261023.md`。


### 2026-10-23 · 对话出图后接着出视频

- [x] ~~「第1步的操作不在当前阶段允许的范围内」阻断下一步~~ **2026-10-23 完成**：视频产物优先于设定图等参考素材关键词；规划时按具体目标再选方法；失败不发旧计划确认卡，本轮可纠正后继续。保留活跃执行、报价与本人制作授权。


### 2026-10-23 · 后端发布连续可用

- [ ] **单实例重启导致用户约 50 秒 502**：当前发布只保护在途生成，仍直接替换 JAR 并 restart。需实施新实例预热、就绪检查后切流、旧实例排空与回滚，并验证多实例期间任务/队列/账本不重复。发布后健康检查通过不等于发布期间无中断。此次证据见 `docs/releases/studio-stage-continuation-release-20261023.md` 末节。


### 2026-10-23 · 聚算个人资源配额阻断视频/配音

- [ ] **供应商账号 `personal_asset_quota_exceeded`**：聚算 HTTP 409 明确拒绝 MiniMax H3 视频与 Qwen3 TTS 配音。已查 5 笔视频、4 笔配音均释放全部冻结、无 SPEND，视频无供应商任务 ID。**2026-10-23 用户确认已清理聚算配额**；本轮未发付费请求复验，尚待真实新任务确认恢复。未删除供应商资产、未购买扩容、未自动重提。用户侧不应被引导清理本平台回收站。证据见 `docs/audits/studio-upstream-quota-2026-10.md`。


### 2026-10-23 · Studio 当日下午到晚间行为复盘后的修复

- [x] ~~旧页面对话连续 18 次 `STUDIO_PRICE_CHANGED`~~ **2026-10-23 本地修复，未发布**：`Rate.withinBudget` 在旧授权内缩减本轮额度，冻结、执行与结算不超过原金额；同消息幂等保持。
- [x] ~~长剧本读不完整且重复读取后要求用户继续~~ **2026-10-23 本地修复，未发布**：`read_canvas` 正文与目录游标分页，一次只读重复纠正；Unicode 长文及 120 节点以外目录测试覆盖。
- [x] ~~助手缺乏真实制作状态查询~~ **2026-10-23 本地修复，未发布**：`read_production_status` 共用 `toRunDto` 原生视频投影，旧采用内容与最新重做结果分开；真模型是否遵循仍待验收。
- [x] ~~画布保存临时网关故障不恢复、丢回执后虚假冲突~~ **2026-10-23 本地修复，未发布**：同快照退避、内容相同的旧基线保存幂等、真正冲突继续保护。前端覆盖恢复期间继续编辑、离开项目停止重试；服务端覆盖重放成功与不同内容拒绝。
- [ ] **CATech 图片尺寸合同不稳定**：`gpt-image-2-1k-pic` 正确 size 请求仍返回不匹配原图；继续严格校验，待供应商修复或可用替代端点验证，不能拉伸/裁剪冒充合同满足。
- [ ] **Agent 运行时替换对照**：优先验证 AgentScope Java，保留业务工具、账本、授权与幂等；补任务状态、来源版本、配音工具和断点恢复。同模型/工具/预算回放今日故障，指标与边界见 `docs/audits/studio-agent-runtime-assessment-2026-10.md`；尚未引入框架。
- [ ] **本轮生产发布与真实模型验收**：当前仅本地修复；需从干净 main 发布，验证旧预算、长文末尾、原生视频状态和保存恢复；单实例重启 502 尚未根治，不把客户端恢复算作发布无中断。

### 2026-10-23 · Studio 对话去掉「继续」（本地，未发布）

设计真源 `docs/ip-studio-dialogue-no-continue.md`。

- [x] ~~对话中途停下要用户说「继续」、报错（线上 2026-10-23 下午）~~ **2026-10-23 本地完成**：单轮的步数 / 调用 / 工具 / 时间 / Token 分配上限删除；一条消息一个 run、一条回复，首笔冻结普通文本那一档，不够时在同一 run 上追加冻结（`runId#n`，企业成员走 `reserveExtension`），钱包没钱才停并给充值入口；相同动作先纠正一次再结束；单 run 300 次调用 / 2 小时隐形保险。测试：`DialogueLoopTest`（追加 / 拒绝 / 工具内部调用追加）、`StudioDialogueSettlementTest`（多笔依次结算 / 超额不扣 / 失败停止过期全部释放 / 追加金额与余额 / 402 回滚 / 停止不追加 / 文案）、`StudioDialogueHoldsIntegrationTest`（个人与企业成员钱包的多笔冻结、余额中途用完）、`StudioDialogueIntegrationTest.aLongJobIsDoneFromOneMessageWithoutAnyContinue`。
- [x] ~~对话因客户端 `maxCost` 与新额度不一致回 409 `STUDIO_PRICE_CHANGED`（线上下午 18 次）~~ **2026-10-23 本地完成**：对话不再据 `maxCost` 拒绝或限额；付费生成校验不变（`StudioDialogueServiceTest.paidGenerationsKeepTheirApprovedCostCheck`）。
- [x] ~~对话费用计入制作阶段预算、确认卡上限含对话预留~~ **2026-10-23 本地完成**：`attributeTurn` / `dialogueReserve` / 执行器 `dialogueRuns` 统计删除，卡片上限 = 报价 + 重做额度（`StudioDialogueApprovalToolsTest.theDefaultCardCapCoversThePaidStepsOnly`、`StudioPlanExecutorTest.dialogueTurnsNoLongerCountInTheStageBudget`、`StudioDialogueServiceTest.aBoundTurnIsNotCountedInTheStageBudget`）。
- [x] ~~长剧本截断在 4000 字、模型反复读开头被判死循环（IPP-6e051b9d 15:13）~~ **2026-10-23 本地完成**：素材概要写明全文字数与 `read_canvas` 分段参数，返回 `total / nextOffset`（`StudioReadToolsTest.an8000CharacterScriptIsReadToTheEndInSegmentsWithoutALoop`）。
- [x] ~~`ChildRuns.follow` 去掉时间上限后会无限等~~ **2026-10-23 本地完成**：最多 10 分钟（`ChildRunsFollowTest`）。
- [x] ~~`CreditHoldSweeper` 可能释放运行中对话任务的冻结~~ **2026-10-23 本地完成**：跳过心跳 3 分钟内的对话 run 及其 `runId#n`（`CreditHoldSweeperTest.aLiveDialogueTaskKeepsItsHoldWhileAnAbandonedOneIsReleased`）。
- [ ] **真模型长任务验收**（§8.0.1 ⑦）：用线上同款聚算 Qwen 至少真调一次「写三集剧本并拆镜」这类长任务，确认一条回复做完、追加冻结与结算正确、窗口裁剪后模型仍按 nextOffset 读完长文。本轮只有本机模拟厂商。
- [ ] **企业在途任务上限按引用里的 `#` 识别追加冻结**：`EnterpriseBillingService` 统计在途任务时排除引用含 `#` 的授权。其它业务的引用目前都不含 `#`；以后若有业务的引用带 `#`，会被少算，届时应改成授权上记父引用（需要迁移）。
- [ ] **`apps/admin/src/app/ai/audit/page.tsx` 用了原生 select**（与本改动无关，`src/ip/select-field-wiring.test.ts` 在本分支基线上就是红的）：按 select-field 规约换成 `SelectField`。
- [ ] **`EnterpriseStudioBillingIntegrationTest` 两项在基线 070334d0 上就红**（2026-10-23 发现，与本改动无关，已在干净基线上复现）：`operatorCanBindMissingOriginalImageIdWithAuditAndNoSecondSubmission`（期望 200 实得 409）与 `supplierConfirmedUnknownRefundsOriginalEnterpriseAfterRemovalAndPreservesPartialSuccess`（期望 8 实得 0）。多半是「图片受理未知在同一结算事务内结束为 failed」之后测试没跟上，需核对后改测试或改实现。
- [ ] **`EnterpriseVideoBillingIntegrationTest` 8 项在基线 070334d0 上就红**（2026-10-24 发布前对照发现，与对话改动无关）：受理结果不确定 / 人工补绑原任务号 / 确认未受理退款那一组（`genericCreateGatewayFailure…`、`operatorEvidenceBindsOriginalUnknownTask…`、`noAcceptanceConfirmationRejects…`、`lateNoAcceptanceEvidence…`、`operatorConfirmationOfNoAcceptedTask…`、`uncertainSupplierAcceptanceRetains…`、`evidenceCannotBind…`、`zeroCostUncertainConfirmation…`）。与上一条同源，多半是「受理未知」流程改过后测试没跟上，需一起核对。

### 2026-10-23 · Studio 对话不锁方法（本地，未发布）

- [x] ~~有活跃制作时方法被锁死，「把第一段做成视频」得到「第 1 步的操作不在当前阶段允许的范围内」~~ **2026-10-23 本地完成**：`switchMethod` 一处切换（同方法不动 / 没在生成就停止收尾 / 在生成就暂停解绑不取消），四处锁删除，`propose_plan` 先换到能覆盖操作的方法，内部原因不进用户界面。测试：`StudioDialogueRoutingTest`（线上原形、同方法、显式切换、复刻分析中直接出视频）、`ProposePlanToolTest`（执行中换方法、按操作换方法、无方法可用时的用户文案）、`StudioOriginalCreationDialogueTest.readSkillSwitchesTheMethodAlsoDuringAProduction`、`StudioPlanExecutionServiceTest.aMethodSwitchEndsAnIdleExecutionAndDetachesOneThatStillGenerates`、`StudioPlanExecutorTest.aDetachedExecutionFinishesWhatGeneratesOnTheCanvasAndEndsQuietly`、前端 `studio-dialogue-message.test.tsx` 与 mock 路由测试。
- [ ] **真模型验收**：线上同款模型下复测「出图制作等确认时说把第一段做成视频」，确认模型会 read_skill / propose_plan 到出视频、旧卡作废、不再出现内部原因。本轮只有单元测试。
- [ ] **线上原话路径未用生产日志核对**：本地能到达用户的路径都已改；当时具体是哪一条（多半是 `propose_plan` 失败的工作记录，或模型转述了模型侧结果里的原文）没有用线上数据确认。
