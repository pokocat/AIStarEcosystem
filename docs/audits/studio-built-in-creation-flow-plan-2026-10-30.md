# 全部内置图片与视频生成流程：独立复核与整体方案

日期：2026-10-30 晚（北京时间）。状态：**复核与方案，未改业务代码，未部署，未新增付费生成。**

这份文档是对 Codex 两份审查（[提示词证据](studio-scene-prompt-review-2026-10-30.md)、[全量流程审查](studio-built-in-creation-flow-review-2026-10-30.md)）的独立复核，并给出一份可以直接拆成 PR 的整体方案。前两份里的 21 个视频场景内容矩阵、17 个图片场景交付定义继续有效，这里不重抄；**实施顺序和范围以本文为准。**

## 0. 一句话结论

Codex 的十条判断有八条成立、两条要更正（后端已上线、模板已有步骤执行器）；另外补了六条源码里能看到但两份文档没写的问题。真正的病根只有一个：**场景页把「用户这次要做什么」拆散存在了三处（组件内存、拼好的提示词、画布节点），哪一处都不完整，于是恢复不全、再做叠词、换规格不复核、结果接不上下一步。** 方案的第一批就是把这份「创作状态」收成一份存进草稿，其余批次都建立在它上面。

## 1. 基线更正（先于一切）

| 项 | 简报里的说法 | 复核结果（2026-10-30 22:30 核对） |
|---|---|---|
| 源码基线 | 新版检出 `c095ae31d`，主目录在旧分支 `codex/ai-director` | `codex/ai-director` 的 `39fe31c9c` **已完整并入 main**（相对 origin/main 领先 0、落后 222）；`c095ae31d` 也在 main 里，比 origin/main `ee984dcb3` 少 5 个提交。**实施直接从 origin/main 开分支**，不用再找旧工作区 |
| 后端部署 | 「较新的事实约束源码已有，后端尚未发布」 | **已过时。** 21:34 随 `20261030-studio-wechat-pay`（main `ad1075609`）发了 server / admin / web-aiavatar，`FACT_RULE`、场景目录「恢复内置」缓存修复都已生效。见 `docs/releases/studio-wechat-pay-release-20261030.md` |
| 线上场景目录 | 「可能由后台配置覆盖」 | 生产 `aep_platform_configs` 里 **没有** `studio.scene-catalog` 行，线上用的就是随包 `scenes.json` |
| 线上使用量 | 未提 | 场景页建的草稿共 **5 份**（品牌故事 2、同城团购 1、自由出图 1、口播带货 1），新版还在「体验新版」开关后面。现在改结构**没有存量迁移负担**，这是动草稿数据结构最好的时机 |
| 内置模板 | 「数量不写死，需读取启用目录」 | 已读：随包 3 份（`ip-launch-female` / `ip-launch-male` / `ip-toy-figure`，仅画布无素材）+ 生产库 8 份官方（2 份场景预设、2 份工作流预设、3 份运营发布的配方模板、1 份精选案例）。其中 **6 份有配方版本**（`ip_template_version`），走 M7.2 的分步执行器 |

## 2. 逐条复核 Codex 的判断

| # | 判断 | 结论 | 复核依据（均在 origin/main） |
|---|---|---|---|
| 1 | 场景内容要求不完整 | **成立** | `scenes.json` 视频场景只有 `placeholder / structure / ideas / options`，`structure` 一句话；17 个图片场景好于视频，但 `keep / change` 只写在描述句里 |
| 2 | 缺失信息处理不合理 | **成立，且现在的规则会把目标改掉** | `StudioSceneCatalog.FACT_RULE`：「拍法里要讲但我没给的，就只引导关注或下单」。团购缺价格时，脚本会从「卖套餐」退成「引导关注」，用户不知道为什么 |
| 3 | 场景稿与 H3 保护路径格式不兼容 | **成立** | `scriptBrief` 要求「镜头N（起–止秒）：…；台词：…」；`H3PromptRewrite.SHOT_HEAD` 只认「第N镜（」，`LINE` 只认「某某说：「」。两处都是代码常量，改一处即可对齐，不涉及提示词种子 |
| 4 | 图片草稿恢复不完整 | **成立** | `scene-image-studio.tsx` `openDraft`：恢复场景、比例、参考图位，`setSupplement(""); setCustom(undefined)`；模型、尺寸、张数、选项都不恢复 |
| 5 | 图片「再做」重复叠加 | **成立** | `reuse` 把 `request.prompt`（已含选项句和补充要求）放进 `custom`，`picked` 不动；`imagePrompt` 对 `custom` 仍追加 `optionLines` 和「补充要求：」 |
| 6 | 视频手改稿、切场景缺统一保护 | **成立** | `useScript` / `GenerateEditor` 的编辑只在 `prompt` state；`openDraft` 不恢复 `language / tier / optimize / picked`，`mode` 一律回 `talk`；有草稿切场景走 `reset()` 全清，无草稿走 `pickScene` 带着文字和图 |
| 7 | 成功结果继续操作不足 | **成立** | `VideoRow` 成功只有「下载」；`ImageRow` 有「下载第一张 / 用这段描述再做」，看大图可下载，没有「用这张做参考 / 做视频」 |
| 8 | 模型能力与稿件未联动 | **成立** | `send` 把全部 `images` 编号交给编导；`sceneVideoInputs` 在出片时才按模型裁；换模型 / 时长后只有 `plan.note`，脚本不重核 |
| 9 | 结果验收只看格式 | **成立** | `StudioTextRevision.validateOutput` 只验 `summary / content` 非空与长度 |
| 10 | 更新文件不等于生产生效 | **成立但现在无覆盖** | 见 §1：目录没被后台覆盖；`dap.ip_studio_assistant` 等 `prompt_template` 仍可能被库里的行覆盖，改它们要 bump `SEED_VERSION` |
| G05 | 模板接续成本由用户承担，建议「统一任务摘要与结果回显」 | **要更正范围** | 6 份配方模板已有 `StudioTemplateExecutionService`：依赖、人工采用、上游变化标过期、CAS 重做、同键恢复（v0.204）。缺的不是执行器，是**场景页和模板、场景页和场景页之间**没有接续（见 §3 N05） |

## 3. 补充的遗漏（两份文档没写、源码能确认）

| # | 问题 | 位置 | 后果 |
|---|---|---|---|
| N01 | **视频选项（出镜方式 / 语气 / 拍法 / 反转方式）不进草稿** | `addScriptNode` 的 `sceneDirector` 只存 `ask / revision / duration / ratio / language`；`send` 改稿时用当前 `picked` | 重开草稿后点「改一改」，选项全部静默回默认值，改出来的那版拍法变了，用户以为是模型抽风 |
| N02 | 台词语言存了没恢复 | `sceneDirector.language` 有值，`openDraft` 不 `setLanguage` | 英文稿重开后改稿按中文要求 |
| N03 | **比例、时长静默钳制** | 图片 `usedRatio = ratios.includes(ratio) ? ratio : ratios[0]`；视频 `clampSceneDuration` | 三视图场景默认 16:9，模型不支持时悄悄变成列表第一项；与仓库规约「生成面板不许静默钳制时长或画幅，做不到就阻断并给修正按钮」（AGENTS §Studio 生产问题五项）不一致 |
| N04 | 编导不看图时，拼话仍说「参考素材（已附图片）…先看图」 | `scriptBrief` 不知道文字端点有没有视觉能力；前端只是不传 `imageIds` 并提示用户 | 模型收到「先看图」却没有图，容易编画面内容 |
| N05 | **图片结果到不了任何下一步** | 结果图只能下载 / 看大图；要拿它当参考得下载再上传，或等资产库归集后「从资产库选」 | 设定图 → 写真 → 口播这条最核心的 IP 链在场景页里断着 |
| N06 | 视频草稿在第一次上传时就建项目，图片在第一次生成时建 | `upload` 里 `ensureDraft`；图片 `submitRow` 里建 | 「最近」里会出现只有素材没有结果的视频草稿；两页行为不一致，和 N03 一起属于一致性收口 |

另有两处是产品判断而非缺陷，记下来等决定：
- 爆款复刻和「比模型更长的片子」走画布创作助手，场景页只负责交出去（`handoff`）。回到场景页只能靠项目卡「回到 AI 视频继续」，看不到助手那边做到哪一步。第三批处理。
- `FACT_RULE` 把「可以虚构人物和情节讲故事」和「不许编品牌事实」写在一段话里，品牌故事场景实测曾编年限和测试次数。第二批的场景规则要把「允许虚构什么」按场景写，不靠一段通用话。

## 4. 方案

### 4.0 核心思路：一份「创作状态」，三处派生

现在三处各存一份：组件 state（没提交的输入）、`request.prompt`（拼好的整段话）、画布节点（结果）。改成：

```
草稿文档（客户端拥有，服务端整存整取）
└ sceneState                      ← 唯一的「这次要做什么」
    sceneId, options{},
    image: { supplement, custom?, model, ratio, size, count }
    video: { text, language, model, tier, duration, ratio, optimize,
             activeScriptId, promptEdit?: { baseScriptId, content } }
每一行结果节点
└ metadata.studio.sceneRequest    ← 那一次用的条件快照（不是拼好的话）
    { sceneId, options, filled|materials, supplement|ask, custom?, model, ratio, size, count | duration, tier, language, optimize }
└ metadata.studio.request         ← 已受理的请求（照旧，幂等与恢复真值，不改）
```

- `sceneState` 改动即写（复用 `persist` 队列，文字类 600ms 去抖），打开草稿按它恢复，不再从节点倒推。
- 「再做」从 `sceneRequest` 恢复**条件**，再走一次 `compose`；不再把拼好的话塞回 `custom`。
- 老草稿（线上 5 份）没有这两个字段时沿用现有倒推逻辑，不写迁移。
- 服务端只改 `packages/types` 的 `IpProjectDoc` 类型与 DTO 透传；画布文档仍是客户端拥有，服务端不读这两个字段做业务判断。

这一条做完，Codex 的 4、5、6 和本文 N01、N02、N06 一起解决。

### 4.1 第一批：共用流程（图片、视频一起受益）

| 编号 | 做什么 | 改哪里 | 验收（零成本） |
|---|---|---|---|
| A1 | `sceneState` 与 `sceneRequest`（§4.0） | `packages/types/src/ip-studio.ts`、`scene-drafts.ts`（`addImageRow / addScriptNode / addVideoRow` 写 `sceneRequest`）、两个 studio 页 `openDraft` 改读 `sceneState` | 结构测试：填满所有条件 → 刷新 → 逐字段相等；改稿用的选项与首稿一致（钉死 N01） |
| A2 | 「再做」改为恢复条件 | 图片 `reuse` → `restore(sceneRequest)`；视频成功行加「用这条的设置再做一版」进生成模式 | 再做一次得到的 `compose` 文本与原请求**逐字相同**；改一个选项后文本只多一句 |
| A3 | 「改完整描述」时选项只拼一次 | `imagePrompt`：`custom != null` 时不再追加 `optionLines`，前端把选项按钮改成只读并提示「选项已写进描述」 | `StudioSceneCatalogTest` 新增用例 |
| A4 | 切场景统一规则 | 两页统一：**有没有草稿都一样**，按场景记住未提交输入（图片页已有 `unsent` Map，视频页照搬）；兼容的素材位（同为「人物照片」「商品图」）跟着走，其余清空并提示 | 结构测试：A 场景填好 → 切 B → 回 A 原样；B 只带兼容位 |
| A5 | 不静默钳制（N03） | 图片 `usedRatio`、视频 `clampSceneDuration` 改成：不支持就在按钮旁写「这个模型不支持 16:9，改成 3:4？」给一键修正，不自动换 | 结构测试 + 和 `studio-composer-spec.ts` 同一套文案 |
| A6 | 结果直接继续 | `ImageRow` 每张图：下载 / **用这张做参考**（放进当前场景第一个空位，或弹场景选择） / **用这张做视频**（跳 `/video?scene=…&ref=<storageKey>`，视频页按 key 放进素材位，key 归属由服务端 `requireOwnedAssetKey` 照旧把关）。`VideoRow` 成功行：下载 / 用这条的设置再做一版 / 在画布中继续 | 结构测试钉住按钮存在与跳转参数；真机点一遍 |
| A7 | 视频草稿建立时机与图片一致 | `upload` 不再建项目，素材先留在页面内存，第一次「让编导写」或「生成」时建；刷新丢未提交素材的问题由 A1 的 `sceneState` 兜（素材 key 已上传，重传不花钱） | 「最近」里不再出现无结果草稿 |

第一批全部是前端 + `packages/types` + `imagePrompt` 一处 Java，**不动任务、计费、幂等链路**。

### 4.2 第二批：稿件和模型对齐（视频线）

| 编号 | 做什么 | 改哪里 | 验收 |
|---|---|---|---|
| B1 | **编导按有效素材写**：先用所选视频模型算 `sceneVideoInputs`，只把会用上的图编号给编导；不看图的文字模型不说「已附图片 / 先看图」，改说「按下面的素材名称写」 | `scene-video-studio.tsx` `send`、`scriptBrief` 增加 `visual` 布尔入参 | 单测：首帧模型 + 3 张图 → brief 只编图1；无视觉端点 → 不含「先看图」 |
| B2 | **换规格后复核**：生成模式里换了模型 / 时长 / 画面 / 素材，若与 `sceneDirector` 记的不一致，就地提示「脚本按 15 秒、2 张图写的，现在是 10 秒、1 张图」+「让编导按新规格改一版」（走现有 revision，修改意见由代码生成） | 前端比对 + `send(revision)` | 结构测试：改时长后出现提示，点按钮发出的 revision 文本含新旧规格 |
| B3 | **场景稿接上 H3 既有保护**：`scriptBrief` 的写法改成「第N镜（a–b 秒）：画面…。旁白说：「…」」（有出镜人物时用人物名）；同时让 `shotStarts` / `source()` 兼容「镜头N（」以免老稿失效 | `StudioSceneCatalog.scriptBrief`、`H3PromptRewrite.SHOT_HEAD` | 用 Codex 的零调用 Java 探针：场景格式三镜 → 镜头 3 / 台词 3；`H3StudioPromptTest` 新增用例。**这是代码常量，不涉及 `SEED_VERSION`** |
| B4 | 非 H3 模型的台词 | Seedance 等不走改写，脚本原样交给厂商；在生成模式写明「这个模型不保台词逐字，改稿请直接改脚本」 | 文案测试 |

### 4.3 第三批：场景内容规则（38 个全部，先结构后内容）

**先改结构，再逐条填内容；填内容不要求一次 38 个到位，但结构一次到位。**

目录 `scenes.json` 每个视频场景增加（图片场景只加 `keep / change / checks`）：

```json
"brief": {
  "goal": "让附近顾客买套餐并到店核销",
  "facts": [
    { "key": "where",  "label": "店名和位置",      "need": "required" },
    { "key": "deal",   "label": "套餐内容与团购价", "need": "required" },
    { "key": "buy",    "label": "怎么买、怎么用",   "need": "required" },
    { "key": "was",    "label": "原价",            "need": "optional", "rule": "有才比较" },
    { "key": "until",  "label": "活动截止",         "need": "optional", "rule": "有才催" }
  ],
  "beats": ["位置 + 套餐 + 团购价", "套餐里有什么、为什么值", "怎么买、怎么到店、关键使用条件"],
  "cta": "买套餐 / 到店核销",
  "allowFiction": "none | characters | all",
  "avoid": ["环境空镜占主体", "泛泛夸好吃"]
}
```

- `compose` 用它替代现在那句 `structure`：目标、节拍、CTA 各一行；`FACT_RULE` 拆成通用部分（不编数字和品牌事实）+ 场景的 `allowFiction`。**缺必填事实时不再「引导关注」**，而是要求编导在 `content` 第一行写「还缺：套餐价、位置」且不写成片稿；前端识别这一行，把「用这个脚本生成」换成「补上信息再写」。不做 NLP 抽取、不加大表单：必填事实只在输入框上方显示成**可点的小标签**（点一下插入「位置：」模板句），用户照样一段话写完。
- **确定性核对**（零模型调用）：用户在文字里给了的数字、店名、商品名（简单正则：金额、`「」`里的名字、`facts` 标签后面的内容），出片前检查脚本里有没有原样出现，没有就提示「脚本里没提到 99 元」。只做包含判断，不打分。
- 后台「场景模板」编辑器同步加这几个字段；`validate` 对缺 `brief` 的旧快照宽容（按空处理），避免运营存过的目录打不开。
- 21 个视频场景的具体内容按 Codex 提示词报告 §4 矩阵填；17 个图片场景按流程报告 §3 填 `keep / change`。图片场景另加两件事：换脸 / 精修 / 真人感 / 白底 / 入景结果页提供**原图对比开关**（前端，参考图就在 `rowUploads` 里）；多参考位的 `hint` 写清「图1 负责身份，图2 负责姿势」。
- 不做：不给文字任务换契约。`StudioTextRevision` 的 `summary / content` 照旧，只在 `content` 约定「还缺：」这一行；不新增任务类型、不做评分服务。

### 4.4 第四批：接续与模板

| 编号 | 做什么 | 说明 |
|---|---|---|
| C1 | 图片 → 视频（A6 已做入口） | 视频页收 `ref` 参数放入素材位；来源图的 storageKey 在 `sceneState` 里 |
| C2 | 场景页 ↔ 画布创作助手 | 交出去（复刻 / 长片）后，场景页结果区显示「已交给创作助手 · 进行中 / 已完成 N 段」，读现有 `IpPlanExecution` 状态接口，不新建接口；点开进画布 |
| C3 | 配方模板 | 不建新执行器。对 6 份有版本的官方模板各走一遍：替换输入 → 逐步执行 → 改上游 → 看到「需更新」→ 重做一步 → 已成功步骤不重跑。有坏的修执行器，没坏的记验收 |
| C4 | 两份场景预设模板（剧情带货 / 爆款复刻） | 它们是只有空文字节点的画布，功能已被视频场景 `drama-placement` / `recreation` 覆盖。建议改成跳到对应场景页，或在描述里写清「进阶：在画布上做」。等用户决定，不在本轮默认改 |
| C5 | 随包 3 份 IP 模板（`ip-launch-*`、`ip-toy-figure`） | 只有提示词、没有配方，「做同款」后逐节点手点生成。本轮不改；若要「一键整套」，用现有配方机制重新发布一版，不写新代码 |

### 4.5 第五批：验收（零成本和付费分开）

**零成本（每个 PR 都跑）**
- 结构 / 单测：§4.1–4.3 每条表里的用例。
- 端到端（无头浏览器，演示模式 `NEXT_PUBLIC_USE_MOCK=1` + 测试响应）：38 个场景各走一遍「进入 → 必填拦截文案 → 填满 → 刷新 → 全部恢复 → 再做 → 结果继续」，输出一张 38 行的勾选表放进发布记录；375 / 1032 / 1440 三档各抽 6 个。
- Java 探针：场景格式 → H3 解析 3/3。
- **结果地址时效**（Codex G07、豆包复核点 3）：结果 `<img>` / `<video>` 直接引用签名地址，TTL 1 小时。验收项：页面开着超过 1 小时、离页再回、断网恢复后，图和视频仍能显示；裂了要走 `POST /assets/sign` 换签（画布节点已有这条路，场景页结果行要接上）。这一项归第一批 A6 一起做，不单开 PR。

**付费（需要你批预算，和零成本分开记）**
- 脚本层：8 个代表场景（同城团购、促销转化、品牌故事、对话剧情、数字人口播、口播带货、门店发现、爆款复刻）× 旧 / 新规则各 1 版，同素材同模型。按线上实付看，编导一版约 1–3 积分，合计约 50 积分内。判据：必填事实是否全部出现、没给的事实是否没出现、CTA 是否对（三项都是是 / 否，不打分）。
- 成片层：团购、品牌故事、数字人口播、换脸 各 1 条 / 张，H3 15 秒按线上报价，图片按线上单价。判据：听到 / 看到关键信息；台词与脚本逐字对。
- 不以「提示词变长、页面能打开、接口 200」为通过条件。

## 5. 明确不做（避免过度设计）

- 不做自然语言字段抽取、不做评分服务、不做独立的「场景结果模型」或新任务类型。
- 不给 38 个场景套同一份营销话术，也不把每个场景都做成长表单；必填事实最多 3 项，其余靠拍法。
- 不做确定性字幕 / 价格卡合成；成片里的文字准确性仍靠脚本核对 + 人工看，界面不宣称。
- 不整份恢复内置目录；新字段对旧快照宽容。
- 不动已受理任务的请求快照、幂等、计费和恢复链路。

## 6. 实施切分与顺序

| PR | 内容 | 涉及 | 依赖 |
|---|---|---|---|
| PR-1 | A1 草稿状态 + A2 再做 + A3 选项一次 + A4 切场景 + A5 不钳制 + A7 建稿时机 | web-aiavatar、packages/types、`imagePrompt` 一处 | 无 |
| PR-2 | A6 结果继续 + C1 图→视频 | web-aiavatar | PR-1 |
| PR-3 | B1–B4 稿件与模型对齐、H3 格式 | server（`scriptBrief`、`H3PromptRewrite`）+ web-aiavatar | 无，可与 PR-1 并行 |
| PR-4 | 目录结构 `brief` + compose + 后台编辑器 + 缺项与核对 | server、studio-admin、web-aiavatar | PR-3 |
| PR-5 | 38 场景内容逐条填（可拆 3–4 个小 PR，按分组） | `scenes.json` + `StudioSceneCatalogTest` | PR-4 |
| PR-6 | C2 助手接续 + C3 配方模板验收 | web-aiavatar（+ 可能的执行器修复） | PR-1 |
| 发布 | 先 server（PR-3 / PR-4 兼容旧前端：旧前端不传新字段就按默认），再 web-aiavatar，再 studio-admin；每次记发布记录与重启窗口的 5xx | | |

开工前一件事：本地 `main`（`b985992d7`）和 `codex/ai-director` 都早于场景功能，**先 `git fetch`，从 `origin/main` 开分支**，不要在本地 main 上直接建。

三件事要在发布前核对：
1. `dap.ip_studio_assistant` 等提示词若有改动，`PromptTemplateSeeder.SEED_VERSION` 要升；本方案第二、三批**都没有动** `prompt_template`，`scriptBrief` 是代码常量。
2. 生产目录没被后台覆盖（§1），发布后随包新字段直接生效；一旦运营存过一版，新场景字段要在后台页上补或「恢复内置」。
3. 新版仍在「体验新版」开关后，存量 5 份草稿都是内部验收建的，可以接受「老草稿按倒推逻辑恢复」。

## 6.5 独立复核附记（2026-10-30 二次复核，结论不变）

对本文逐条独立复核（基于 `origin/main ee984dcb3` 源码，非转述）：

- **§1 基线更正全部成立**：`c095ae31d` 在 main 历史内且比 `ee984dcb3` 少 5 个提交（`83f817348` 图片尺寸交付、`6c8c742e8` 第六次前端发布、`ad1075609`/`ee984dcb3` 微信 Native 充值）；`39fe31c9c` 是 `c095ae31d` 的祖先，即已并入 main。本地 `main`（`b985992d7`）与 `codex/ai-director`（`39fe31c9c`）均早于场景功能，**不能在它们上面实现**。
- **§2 逐条**：8 成立项逐一核对通过（含 `scriptBrief`「镜头N」:319、`H3PromptRewrite` `LINE` :92 / `SHOT_HEAD` :280、`openDraft` 清空 supplement/custom、`reuse` + `imagePrompt` custom 分支三重拼接、`StudioTextRevision.validateOutput` :32–37、`FACT_RULE` :255–257）；G05 更正成立（`StudioTemplateExecutionService` + `IpTemplateVersion` + 验证脚本均在 origin/main）。
- **§3 六条补充逐一核对通过**：N01（`selection()` :270 只存四类素材 key，选项不落 doc）、N02（`sceneDirector.language` 存了不恢复）、N03（图片 `usedRatio = ratios.includes(ratio) ? ratio : ratios[0]` :182；视频 `clampSceneDuration` :106）、N04（`scriptBrief` 无视觉入参，前端只不传 `imageIds`）、N05（`ImageRow` :394–425 无继续/转视频动作；`VideoRow` :690–714 成功只有下载）、N06（视频 `upload` :247 `ensureDraft`，首次上传即建草稿）。
- **补充三点（本文已覆盖或可并入）**：
  1. **R02 首页卡片跳错场景已在 main 修复**（`scene-query.ts` 已改 `useSearchParams` + `replaceState` 带 state），实施时不重复做。
  2. **H3 修复即复用保护路径的证据**：场景出片对支持改写的模型一律 `rewrite:"auto"`（scene-video-plan.ts:39–45），`H3PromptRewrite` 由 `StudioWorkflowService`/`StudioWorkflowWorker` 引用——B3 把 `scriptBrief` 输出改成「第N镜（…）旁白说：「…」」后，场景稿自动进入固定镜头 + 台词代码填 + 后验检查，与画布/导演台同一路径；且两处都是代码常量，**不涉 `prompt_template` 与 `SEED_VERSION`**（§6 已写明，复核确认）。
  3. **结果 URL 时效（G07）列入验收**：结果 `<img>/<video>` 直引返回 URL，长开页面超过签名 TTL 会裂；验收矩阵补"长开/离页返回/网络恢复后 URL 重签"。
- **证据边界**：线上目录未被后台覆盖、线上草稿 5 份、生产官方模板 8 份 / 配方 6 份等 DB 与线上数据引自本文 §1 的晚复核记录（本轮匿名 `GET /api/v1/ip-studio/scenes` 被登录态拦截 `UNAUTHORIZED`，未自行复核，实施前在登录态下核对一次即可）。未改业务代码、未部署、未新增付费生成。

## 7. 文件定位（origin/main）

| 位置 | 作用 |
|---|---|
| `apps/server/src/main/resources/ipstudio/scenes.json` | 17 图片 + 21 视频 + 7 首页卡 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java` | `imagePrompt` 233、`FACT_RULE` 255、`videoInput` 261、`videoBrief` 277、`scriptBrief` 302、`validate` 348 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/h3/H3PromptRewrite.java` | `LINE` 92、`linesByShot` 269、`SHOT_HEAD` 280、`shotStarts` 282、`checkSpoken` 601 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/h3/H3StudioPrompt.java` | 36–41 决定走固定镜头 + 代码填台词 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/service/StudioTextRevision.java` | 文字任务契约与输出校验 |
| `apps/web-aiavatar/src/ip/scenes/scene-image-studio.tsx` | `pickScene` 81、`openDraft` 107、`reuse` 278、`ImageRow` 394 |
| `apps/web-aiavatar/src/ip/scenes/scene-video-studio.tsx` | `pickScene` 112、`reset` 126、`openDraft` 134、`send` 322、`handoff` 394、`useScript` 420、`generate` 449、`GenerateEditor` 645、`VideoRow` 690 |
| `apps/web-aiavatar/src/ip/scenes/scene-drafts.ts` | `addImageRow` 59、`addScriptNode` 118、`addVideoRow` 145、`sceneInputsOf` 190 |
| `apps/web-aiavatar/src/ip/scenes/scene-video-plan.ts` | 素材按模型能力裁剪、时长钳制 |
| `packages/types/src/ip-studio.ts` | `StudioSceneInputs` 75、`IpProjectDoc` 77 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/service/StudioTemplateExecutionService.java` | 配方模板分步执行（已有依赖 / 过期 / CAS） |
| `docs/studio-scene-creation.md` | 场景化创作现行设计真源，方案落地后同步 §4、§7、§9 |
