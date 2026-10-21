# Studio 对话「意图直达」真模型验收（2026-10-20，本地，未发布）

> 真源：[`docs/ip-studio-dialogue-intents.md`](../ip-studio-dialogue-intents.md) §7 触发评测集。本记录只覆盖本地真模型对话回合；**没有**确认任何一张卡、没有出图（见文末「没验证」）。用户中途要求尽快收尾，评测按现状截止。

## 环境

- 代码：分支 `dev/h3-video-dialogue-frames-20261020` 工作区（含未提交的意图直达改动 + 本次修复），本地 `./mvnw spring-boot:run`，port 18091，dev profile，`aep.dev-auth.enabled=true`，**未开** `aep.ipstudio.fixture-enabled`（全部是真模型调用）。
- 库：`.studio-e2e/takeover-20261021/local-db/accept.mv.db` 的副本（scratchpad），不碰原文件。
- 启动日志：`[studio-skill] repository file key=image-generation / reference-video-recreation / script-writing / video-generation` 四条；`PromptTemplateSeeder: 刷新 58 个未改动的 prompt 基线 → v18-2026-10-20-dialogue-intent-direct`。库里 `dap.ip_studio_skill_dialogue` / `dap.ip_studio_skill_plan` 原本就是 version=1，不需要手工改 version。
- 对库副本做的改动（只在副本里）：
  1. 库里有一份 main 分支种进来的技能 `original-creation` v2（本分支没有这个文件，库里仍是 active）。它和「出图」共用「画一张 / 海报 / 出图 / 设定图」等触发词，第一次跑「画一张国风少女海报，9:16」就是平手 → 不绑技能（见下「发现 1」）。为按本分支设计评测，用后台接口把它改成 `withdrawn`。
  2. 生产对话模型是聚算 `qwen38-27b`（`ai-studio-jusuan-qwen38`，见 `studio-recreation-release-20261018.md`），库副本里没有。照生产声明（看图、无流式、无工具调用、无 response_format）在副本里加了端点 `eval-jusuan-qwen38`（复用副本里聚算端点的加密密钥，未接触明文）、DAP_PERSONA 候选和按量售价（0.18 / 1.08 积分每千 token，maxCost 21，只是本地积分）。
- 模型：主跑 **聚算 Qwen3.8 27B**（`eval-jusuan-qwen38`，生产同款）；另有一轮默认端点 **Agnes 2.5 Flash**（`studio-live-agnes-text`）作对照，其中一半回合撞上 Agnes 免费额度 429。
- 时间：2026-10-20 17:52–18:40（本机时间）。

## 结果（Qwen3.8 27B）

| # | 消息 | 附件 | 期望 | 实际（技能 / 阶段 / 关键块） | 积分 | 结论 |
|---|---|---|---|---|---|---|
| 1 | 画一张国风少女海报，9:16 | — | 出图，一轮出卡，不问 | image-generation / production；`propose_plan` 1 步 + `approval`（stage=production，无 executionId，报价 8）；无问题 | 3 | 通过（需本次修复，见下） |
| 2 | 把这张图动起来，5 秒 | image | 出视频 | 路由 video-generation / production；回合因上游连接 `EOF reached while reading` 失败（AI_PROVIDER_ERROR，未扣费） | 0 | 路由通过；出卡未验证（环境） |
| 3 | 用这张商品图写三条卖点文案 | image | 写剧本与文案，当轮写好 | script-writing / production；`read_canvas` → `create_nodes` 1 个文字对象；无卡 | 8 | 通过（正文同一句重复两遍，见发现 5） |
| 4 | 复刻这条，换成我的保温杯 | video + image | 参考视频复刻 | reference-video-recreation / analysis；`propose_plan` 2 步（拉片 + 编排），**随后问了一个问题，没有发确认卡** | 6 | 路由通过；一轮出卡**不通过** |
| 5 | 照着参考视频做一条 | video | 复刻（平手由模型选） | 路由直接命中复刻（「参考视频」+ 视频素材 3 分 > 出视频「做一条」2 分，并非平手）；`read_skill` 后问了一个问题，无方案无卡；没问「用哪种方法」 | 3 | 路由通过；问了可选项（保留哪部分有默认值）**不通过** |
| 6 | 再来一张，背景亮一点 | — | 沿用上一技能 | 未跑（Qwen）。Agnes 对照：沿用 image-generation 通过，但上一轮没出图，回复编造「我刚生成的小猫头像」 | — | 未跑 |
| 7 | 这段文案怎么样，能更有力一点吗 | text | 写剧本与文案，`propose_text` | script-writing / production；`read_canvas` → `propose_text`；无卡 | 3 | 通过 |
| 8 | 你好 / 谢谢 | — | 不绑技能，直接回答 | 两轮 skillKey 均为空，无工具调用 | 1 + 1 | 通过 |
| 9 | 做张图 | — | 出图，问一个问题附候选 | image-generation / production；一个 `question`（「这张图想画什么？（主体 + 场景或用途）」+ 4 个候选）；候选没标默认 | 2 | 通过（正文同一句重复两遍） |
| 10 | 帮我做个封面，内容是「夏日特饮上新」 | — | 出图，不问，文字入提示词 | Qwen 未跑完（收尾时中断）。Agnes 对照：image-generation，一轮 `propose_plan` + `approval`（production，无 executionId，报价 8），不问 | Agnes 3 | Qwen 未跑；Agnes 通过 |
| 11 | 画布上的这段剧本，出成视频 | text | 出视频 | Qwen 未跑。Agnes 对照：**路由到 script-writing**（「剧本」2 + 文字素材 1 = 3 > 「视频」2），正文用文字写了一份「制作方案」并问「要开始吗」，没有工具、没有卡 | Agnes 1 | **不通过**（路由设计问题，见发现 2） |
| 12 | 这个视频配个音 | video | 不选方法，说明去节点工具 | Qwen 未跑。Agnes 对照：正文正确（让用户在视频对象的配音工具里做），但线程**被绑到 video-generation**（「视频」关键词） | Agnes 1 | 正文通过；「不选方法」**不通过** |

Qwen 合计已扣 30 积分（本地积分）。完整闭环（确认 → 执行 → 出图）**没有做**：用户要求收尾时停在 #1 出卡这一步。

## Agnes 2.5 Flash 对照（摘要）

格式稳定性远差于 Qwen，不建议作为对话默认模型：#1 跑 4 次只在修复后 0 次出卡（宣布「我先看看画布」后不发动作就结束、把问题当成必填追问风格）；#4 直接调用收费的 `analyze_video`（服务端以 `STUDIO_PRODUCTION_NOT_AUTHORIZED` 正确拒绝），之后输出退化成成串的 `<tool_call>` 垃圾直到预算耗尽；#2 本地视频模型只有 t2v，规划两次失败后问用户换模型；#8 自称「我是 Agnes」。

## 发现

1. **合并阻断：main 上的 `original-creation` 技能与「出图」触发词重叠。** main（`39ca92185`）新增了只做制作的 `original-creation`，关键词含 出图 / 生图 / 画一张 / 海报 / 设定图 / 三视图；本分支的 `image-generation` 也有这些词。「画一张国风少女海报」两边都是 4 分 → 平手 → 不绑技能，Agnes 回复「准备选图像生成方法…」后不调 `read_skill` 就结束。合并到 main 时必须决定：删掉 `original-creation`（并在已种过它的库里撤下），或者把两者的触发词分开。另外，已经种进库的技能在分支切换后仍是 active，库里的技能目录不等于仓库文件。
2. **路由把「素材词」当成「要做的东西」**（#11）。「画布上的这段剧本，出成视频」里「剧本」是素材、「出成视频」才是产物，但关键词打分不分主次，写剧本 3 分胜出。技能触发词在技能文件里，按约定未改，交主模型定夺（例如给「出成视频 / 做成视频 / 生成视频」这类目标短语更高权重，或把「剧本」从写稿技能的触发词里拿掉、只保留「写剧本」）。
3. **「不选方法」的配音意图仍会绑技能**（#12）。「视频」一词让线程绑到 video-generation；回复本身是对的，但不符合 §7「不选方法」。同属触发词设计，交主模型。
4. **模型把可选项当必填问**（a 类，交主模型）：#5「最想保留参考视频的哪一部分」有默认值仍单独问；#4 发完方案后没有 `request_approval`，改为问「原片人物怎么处理」（同样有默认值）；Agnes 在 #1、#6 追问风格。提示词里「一轮出卡」写在技能与对话提示词里，但复刻技能第一轮仍倾向于先问。
5. **回复正文重复**（Qwen，#3 #9）：同一句话出现两次，疑为多次模型调用的正文都被拼进回复。未定位，记为待查。
6. **宣布动作但不发动作**（Agnes，a 类）：对话提示词「调用前先用一两句话告诉用户你准备看什么、做什么」，弱模型常常只写这一两句就结束回合。

## 本次修复（b 类，`apps/server/**`）

1. **`StudioPlanValidator` 图片步骤的画幅**（真模型实测触发）。规划模型对「9:16 海报」三次都写 `settings.size: "9:16"`，而校验只接受像素尺寸 `宽x高`，于是「第 1 步的图片尺寸不正确」连拒三次、本轮额度耗尽、出不了卡；即使不写 size，`StudioPlanSteps` 也不把画幅传给出图请求，`imageSize` 落回默认 3:4 —— 技能里说的「海报 9:16」从规划到执行都无法表达。改为：
   - 图片步骤新增可选 `aspectRatio`（`W:H`），写进 size 的比例按 aspectRatio 读；size 仍只收像素尺寸；两者冲突、或格式不对仍拒绝（`AI_BAD_OUTPUT`）。
   - `StudioPlanSteps` 把图片步骤的 `aspectRatio` 交给出图请求（原来固定传 null）。
   - `StudioWorkflowService.skillPlanConstraints` 的 settings 契约写明 `image{count, aspectRatio?, size?, referenceBindings[]}`（这是代码里的唯一契约来源，不是提示词文件）。
   - 视频步骤：`aspectRatio` 被写进 `video{}` 里时按步骤画幅读取（Agnes 规划实测这样写）。
   - `notes` 写成单个字符串时视为一条备注（Qwen / Agnes 每次图片规划都这样写，原来整份方案被判「不完整」）。
2. **`DialogueActionProtocol` 回退动作的常见写法**：分隔行后只写了一个对象（不是数组）、整条回复只是一段动作 JSON（原来原样显示给用户）、参数写在 `tool` 旁边而不是 `args` 里（`ask_question` 实测）。仍然只认 `tool` 字段，散文里出现大括号不当动作。注意：main 已重写这个文件，合并会冲突，同样的三种写法 main 也没接受。
3. 单测：`StudioPlanValidatorSkillTest#anImageStepKeepsItsAspectRatioAlsoWhenThePlannerWritesItIntoSize`（含视频嵌套画幅、notes 字符串、契约文本）、`StudioPlanStepsTest#anImageStepSubmitsItsAspectRatio`、`DialogueActionProtocolTest#aSingleObjectAfterTheMarkerAndABareActionReplyAreActionsNotProse`；三个类全部通过。
4. 未改：`packages/types/src/ip-studio-workflow.ts` 的图片步骤类型还没有 `aspectRatio?: string`（本次授权范围外），需要同步。

## 没验证

- 确认卡 → `plan-executions` 以 production 建执行 → 图片步骤完成 → 产物节点出现（#1 闭环）：**没跑**。
- Qwen 的 #6、#10、#11、#12：没跑（#10–#12 只有 Agnes 对照）；#2 因上游连接中断没拿到结果。
- 每条只跑一次，模型输出有随机性，通过的条目也不代表稳定通过。
- 浏览器端界面（确认卡显示、点按钮）未验证；SSE 直连后端读取，没有经 Next 代理。
