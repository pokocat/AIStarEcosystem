# Studio 对话：意图直达（agent + 技能体系）

> 现行设计真源（2026-10-20）。背景：用户反馈「AI 对话里问太多」。本文定义对话助手如何识别意图、分到哪个技能、什么时候问、什么时候直接生成，以及为此改动的服务端规则。配套：提示词 `resources/prompts/material/dap.ip_studio_skill_dialogue.md` / `dap.ip_studio_skill_plan.md`，技能文件 `resources/studio/skills/*.md`。对话机制本身（线程、流式、工具、执行器）仍以 [`ip-studio-conversational-video-recreation-plan.md`](ip-studio-conversational-video-recreation-plan.md) 为真源，本文只覆盖「意图 → 技能 → 一轮确认」这一层。

## 1. 问题

改版前的对话链是为「参考视频复刻」一种任务设计的：

- 技能只有一个（复刻），消息没命中它就落进「全能创作」，模型只能聊天或建草稿，任何收费生成都做不了，于是反复追问。
- 执行必须先「分析阶段确认」再「制作阶段确认」：哪怕只生成一张图也要两张确认卡。
- 线程一旦绑定技能就不能换：画完图再想写文案，只能「从某条消息重新开始」。
- 路由平手时服务端回 400 让界面问用户「用哪种方法」，又多一次打扰。
- 提示词写的是「缺关键事实先问，一轮最多问 1–2 个」，没有说清什么算关键、什么该用默认值。

## 2. 目标行为

1. **意图精准落到技能**：出图 / 写剧本与文案 / 出视频 / 参考视频复刻 / 纯聊天。切换对用户无感，不问「要用哪种方法」。
2. **简单意图一轮确认**：「画一张国风少女海报」→ 这一轮里同时给出方案和确认卡，用户点一下（或回「可以」）就开始出图。
3. **信息丰富直接进生成**：用户贴来完整需求（主体 / 风格 / 用途 / 尺寸 / 台词 / 商品资料）时不复述、不确认理解，补几个默认值就出卡。
4. **短文字当轮写好**：剧本、口播、标题、文案 1500 字以内由对话模型自己写，`create_nodes` 放进画布，没有确认卡。
5. **问题预算**：必填缺失且推不出来才问，一轮一个，带候选和默认；可选项（画幅、张数、时长、风格、模型）一律用默认，不问也不编。

## 3. 技能目录

| 技能 | key | 阶段 | 允许操作 | 触发（关键词 ×2 / 素材 ×1） |
|---|---|---|---|---|
| 出图 | `image-generation` | 直达制作 | text, image | 出图 / 生图 / 画一 / 画张 / 海报 / 封面 / 设定图 / 换背景 / 再来一张…；素材 image |
| 写剧本与文案 | `script-writing` | 直达制作 | text | 剧本 / 脚本 / 文案 / 口播 / 台词 / 分镜 / 标题 / 改写 / 润色…；素材 text |
| 出视频 | `video-generation` | 直达制作 | text, image, video, check, assemble | 视频 / 出片 / 动起来 / 做一条 / 短片 / 运镜…；素材 image |
| 参考视频复刻 | `reference-video-recreation` | 分析 → 制作 | analysis: recreation, text；production: text, image, video, check, assemble | 复刻 / 拉片 / 参考视频 / 照着这条 / 做同款 / 翻拍…；素材 video |

- 技能文件格式不变（YAML 头 = 服务端边界，正文 = 方法）。**直达技能 = `operations.analysis: []`**：`StudioSkill.direct()` / `StudioSkillRules.Rules.direct()`，起始阶段 `firstStage()` 为 production（与 main 上原创创作引入的 `StudioSkill.firstStage()` 是同一条规则，`direct()` 委托给它）。
- main 上同日的 `original-creation`（原创创作）与「出图」触发词重叠（画一张 / 海报 / 出图 / 设定图），合并时改为 `status: withdrawn`（文件保留，目录按文件状态把库里那一行下架；删文件不会下架），由出图 / 写剧本与文案 / 出视频替代。
- 不允许 `check` 操作的技能 `checks` 可以为空（目录校验按「是否有阶段允许 check」判断）。
- 每个技能正文固定有「必填与可选」一节：这是模型「要不要问」的唯一判据（Cursor 参数规则：必填缺且推不出 → 问；可选 → 用默认，不问不编；用户引号 / 数字原样用）。
- 关键词不用单字（「画」会命中「画布」），最短两字；目录测试钉死。
- 我们自己给的完成后建议（`StudioExecutionSummary.suggestions`）每一条都要路由到它说的那件事，或者明确不切换：`StudioSuggestionRoutingTest` 用仓库里的技能文件逐条钉住，新加一条建议就得在那里写上预期。
- 配音 / 口型 / 声音克隆 / 局部重绘不在对话里做：提示词要求说明在画布对应节点的工具里做，不冒充。

## 4. 路由（`StudioSkillRouter` + `StudioDialogueService.startTurn`）

1. 关键词命中 +2、素材类型命中 +1（**词优先于素材**：附商品图说「写一段文案」是写稿，不是出图）。
2. 唯一最高分胜出。
3. 一个都没命中 → 沿用线程当前技能（「再来一张」接着出图）；线程没有技能就不绑（全能创作，模型可用 `read_skill` 自己选）。
4. 平手 → 当前技能在平手里就沿用；否则不绑，由模型在回合内按意图表决定并 `read_skill`。**不再抛 400 `STUDIO_SKILL_REQUIRED`**；`triggers.default` 只作为给模型的提示，不再做平手裁决。
5. **技能按任务绑定而不是按线程绑定**：线程没有活跃执行时每条消息都重新路由，命中别的技能就换（`thread.skillKey` 改写、`stage` 改为新技能起始阶段）；有活跃执行（running / paused / needs_user）时方法不变，显式换技能 400 `STUDIO_INPUT_INVALID`。执行结束解绑时清掉线程 `stage`。
6. `read_skill` 在没有活跃执行时可以换方法（`Effects.bindSkill` 改为可覆盖）。

## 5. 一轮确认（直达技能）

- `propose_plan` 的 `stage` 对直达技能填 `production`（省略则按技能起始阶段），不要求先有执行；填 `analysis` 被拒。
- 校验：直达技能的制作计划可以没有 `approaches`（一张图、一段视频不需要「保留什么 / 改变什么」）；非直达仍要求。
- 执行：`StudioPlanExecutionService.create` 接受 `stage=production` 且无 `executionId` 的请求，前提是计划所属技能 direct（先 `locatePlan` 查技能，不是直达 → 400 `STUDIO_INPUT_INVALID`，与原行为一致）；执行直接以 production 阶段创建，步骤、预算、授权快照与分析阶段同一套代码。`confirmFromDialogue`（文字确认）同样放行。改方案（`replanStage`）只在计划有 `recommendedApproachId` 时核对 approachId。
- 前端确认卡：`stage=production` 的卡只在卡上带 `executionId` 时才作为阶段确认，否则是新执行的开始；去掉了「回退到面板上最近一次执行 id」的旧逻辑（它会把直达技能的开始当成已结束执行的确认）。
- 规划提示词与 `skillPlanConstraints.stageGuide` 对直达技能说明「没有分析阶段，不写 plan-compile」，并只列本技能允许的操作。

## 6. 提示词要点（抄谁的）

- 意图表 + 「纯聊天是兜底，只有非常确定用户不要产物才走」：LangChain Open Canvas 路由提示词的写法。
- 「方法切换对用户无感，不要提」：OpenAI Agents SDK handoff 前缀。
- 「说出假设就往下做；说要做就同一轮做」「必填缺且推不出才问，可选不编不问」：Cursor CLI / Agent 2.0。
- 「一轮最多一个问题」：Claude.ai 系统提示；「猜错也比留空好」：tldraw make-real。
- 技能 `summary` / 正文「什么时候用」写得 pushy、列出用户不点名也该触发的场景：anthropics/skills skill-creator。
- 出图指令：腾讯混元 PromptEnhancer（意图不变 / 总分总 / 由主到次 / 结尾点题）；视频指令：Kling 公式（主体 + 动作 + 场景 + 运镜 / 光线）+ Runway「只写变化、写清什么不动、主体与相机分开、运镜只用一种」。
- 调研原文与 URL 见本次会话调研报告（未入库）；要点已落进技能文件与两份提示词。

## 7. 触发评测集（近似难例，上线前用真模型过一遍）

| 消息 | 附件 | 期望 |
|---|---|---|
| 画一张国风少女海报，9:16 | — | 出图，一轮出卡，不问 |
| 把这张图动起来，5 秒 | image | 出视频（动起来 ×2 + image ×1） |
| 用这张商品图写三条卖点文案 | image | 写剧本与文案（词优先于素材），当轮写好 |
| 复刻这条，换成我的保温杯 | video + image | 参考视频复刻 |
| 照着参考视频做一条 | video | 复刻与出视频平手 → 模型按意图表选复刻 |
| 再来一张，背景亮一点 | — | 沿用上一技能（出图） |
| 这段文案怎么样，能更有力一点吗 | text | 写剧本与文案（要产物），`propose_text` |
| 你好 / 谢谢 | — | 不绑技能，直接回答 |
| 做张图 | — | 出图，问一个问题（画什么）附候选 |
| 帮我做个封面，内容是「夏日特饮上新」 | — | 出图，不问，文字入提示词 |
| 画布上的这段剧本，出成视频 | text | 出视频（剧本 → 分段） |
| 这个视频配个音 | video | 不选方法，说明在节点工具里做 |
| 用这张图做一段视频（完成后建议，点击发出时不带引用） | —，或 image | 出视频（「做一段视频」×2；2026-10-21 前与出图平手，线程留在出图） |
| 换个风格再出一张（完成后建议） | — | 出图 |
| 写一段视频脚本，30 秒 | — | 写剧本与文案（出视频不收「一段视频」这个裸词，就是为了不抢这一句） |

## 8. 验证与边界

- 服务端：`StudioSkillRouterTest`、`StudioDialogueRoutingTest`（换技能 / 沿用 / 活跃执行不换 / 直达起始阶段）、`StudioSkillCatalogTest`（三份直达种子、checks 规则）、`StudioPlanValidatorSkillTest`（直达无 approaches、指南只列本技能操作）、`ProposePlanToolTest`（直达 production）、`StudioPlanExecutionServiceTest`（直达制作卡直接建执行）、`StudioDialoguePromptWiringTest`（提示词里的工具名 / 技能名 / 变量都真实存在）。
- 改了提示词文件：`PromptTemplateSeeder.SEED_VERSION` 已升到 `v19-2026-10-20-dialogue-intent-direct-merged`，否则线上不生效。
- 未做：真模型端到端（§8.0.1 ⑦ 要求上线前至少真调一次，按 §7 评测集走）；前端演示 mock 的技能目录与路由镜像；配音 / 口型技能（待对话工具开放这些操作）。
