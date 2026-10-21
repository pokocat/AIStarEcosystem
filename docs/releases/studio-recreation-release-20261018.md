# Studio 全能创作 · 对话驱动视频复刻（S1/S2/S3）生产发布记录 · 2026-10-18

- 发布：`20261018-studio-recreation-s1s3`，`GIT_SHA=c6f4080899792e63434ac693811a238f1535ef4c`（分支 `release/studio-recreation-20261018` = `dev/ai-video-replacement-skill-27b923` + 合入生产基线 `2f67939a`），服务 `server web-aiavatar admin`，构建参数与前一版相同（`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`）。
- 基线核对：线上此前为 `20261018-studio-demos-layout`（`2f67939a`，在 `codex/studio-demos-layout`），其相对 `codex/unified-ip-studio` 7649dd42 多出画布分组描述与模板复制 groupId 修复；本次先把 `2f67939a` 合进发布分支（唯一代码冲突 `IpDemoTemplateService` 白名单，合并为同时保留 `groupId` 与 `videoMode/vquality/videoCount`），文档冲突取发布分支版本。
- 迁移：Flyway 一次应用 4 个（V60 端点能力开关、V61 对话线程 / 消息 / 事件 / 转向、V62 计划执行、V63 技能表），启动日志 `Successfully applied 4 migrations`；技能 `reference-video-recreation` 由仓内文件 seed 为 v1。重启后 15 分钟内 `-ERROR` 0 条。
- `verify.sh` ALL GREEN；`/api/v1/ip-studio/studio/skills`、`/api/admin/studio/skills` 匿名 401（按预期）；`aiavatar.aibuzz.cn/projects`、`/create` 200。
- 方案与实现：`docs/ip-studio-conversational-video-recreation-plan.md`；实现说明 `apps/server/README.md`「Studio 对话 agent、技能与计划执行」、`apps/web-aiavatar/PRODUCT.md`「2026-10-18 · 全能创作」、`specs/BUSINESS_RULES.md` 同名节。本地 Codex 七轮验收报告与脚本在工作树 `.studio-e2e/`（gitignored）。
- **上线后要做的配置**（后台「AI 模型与 Key」）：给 Studio 文本端点按实际能力勾「支持工具调用 / 支持流式」（默认都按不支持：对话走 JSON 动作协议、整段一次给出，不假流式）；确认 Studio 文本端点有按量售价（否则对话 503 `AI_TOKEN_PRICE_NOT_CONFIGURED`）。
- **未验证**：S0 付费实测（真实供应商换主体 / 创意重写效果、检查可靠性）尚未做，`autoFixChecks` 保持为空；真实供应商流式延迟、企业付款、跨节点租约竞争未在生产验证。

## 上线后第一次真对话暴露的问题与热修（2026-10-18 晚，仅 server）

线上对话模型是聚算 `ai-studio-jusuan-qwen38`（Qwen3.8 27B）：已声明看图，**未**声明流式、工具调用和 `response_format`。S1–S3 此前只用确定性假响应验收，真模型第一次对话连撞三处格式问题，每一处都发生在「要求模型按我们的格式输出」的地方：

| 现象 | 根因 | 热修 |
|---|---|---|
| 助手回复里直接露出 `<tool_call>{...}</tool_call>`，没有执行任何动作 | 解析器只认 `<<<studio-actions>>>` 分隔行，Qwen 习惯写标签形式 | 发布 `20261018-studio-toolcall-tag`（`adb30018`）：同一套回退协议也接受 `<tool_call>` 块（`tool`/`name`、`args`/`arguments`），流式过滤器同样在标签处截断，写不完整的块整批不执行 |
| 「整理制作方案」连续失败，助手最终如实说明方案工具没通过 | 对话里的 `propose_plan` 另写了一份规划输入，只列操作名，漏了各操作 `settings` 字段契约，模型给 recreation 步骤编了 `videoId`/`analysisType`；回复还裹着 ```json 围栏；`questions` 写成 `{question, default}` 对象，校验器只收字符串 | 发布 `20261018-studio-plan-contract`（`237c1134`）：规划输入与执行侧、后台试跑共用 `StudioWorkflowService.skillPlanStageText/skillPlanConstraints/planCapabilities`；新增 `ModelJson` 去围栏解析（执行侧文字任务与后台试跑同样使用）；`questions` 两种写法都收。校验仍然严格，猜错键名照旧被拒并带可操作的原因 |

- 提示词文件**没有改**。`prompt_template` 行首次启动入库后，只有 `PromptTemplateSeeder.SEED_VERSION` 变更才会刷新「没人改过」的行；生产库里 Studio 的 8 条提示词与文件长度一致，`dap.ip_canvas_image` 是运营改过的版本 3，刷新也不会碰它。
- 测试：`ProposePlanToolTest`（用真实回复形状：围栏 + 问题对象 + 正确/猜错的 settings）、`ModelJsonTest`、`StudioPlanValidatorSkillTest` 新增 2 项、`DialogueActionProtocolTest` 新增 4 项。整个 `ipstudio` 包 623 项里只有 3 项失败（`IpVideoModelChoiceWiringTest` 2 项、`StudioAssetCatalogPricingTest` 1 项），在未改动的开发分支上同样失败，与本次无关。
- 两次发布都只动 server，`verify.sh` ALL GREEN，重启后 `-ERROR` 0 条（该 grep 先在近三天日志里验证能命中 13 条）。

### 继续走到制作阶段时的后续热修（同晚）

| 现象 | 根因 | 热修 |
|---|---|---|
| 分析方案被接受后，第三次规划仍可能把「编排制作计划」放在拉片之前、把步骤编号写进素材引用、把 `videoModel` 写成模型别名 | 规划输入没说明分析阶段的固定顺序、referenceNodeIds 能放什么、videoModel 是端点 id | `20261018-studio-plan-structure`：契约补阶段结构、引用规则与端点 id；校验器拒绝 plan-compile 之后的拉片、丢掉 plan-compile 上多余的 editTarget；propose_plan 拒绝不在可用列表里的视频模型并列出可选 id |
| 拉片第一次调用被聚算 Qwen 400 `unsupported_geometry`（visual activation/HBM headroom budget） | 总览图最长边 2800 像素，超出该视觉端点预算 | `20261018-studio-vision-budget`：同一批画面按 1600 → 1024 → 640 缩小重试，不丢帧、不换帧；实测 640 通过，分段分析的 960 帧原样通过 |
| 拉片失败后进度条只有「停止」，原因里却写「可以继续重试这一步」 | 前端只在「已暂停」时显示继续按钮 | web `20261018-studio-retry-step`：失败步骤显示「重试这一步」，待确认步骤显示「继续制作」，调用既有 resume |
| 「编排制作计划」被拒：引用了不存在的素材（用户的婴儿图） | 分析方案在一轮没有附件的对话里确认，执行记录的画布素材为空 | `20261018-studio-plan-context`：确认的步骤里引用过的画布素材（拉片原片、referenceNodeIds、绑定、改稿对象）一并作为后续规划的可用素材；契约列出校验器接受的参考用途；同一次拉片记住端点接受的图片尺寸 |
| 「编排制作计划」再被拒：只能引用更早步骤的产物 | 模型把画布素材 id 写在绑定的 `stepId` 里 | `20261018-studio-binding-ids`：该值恰好是可用画布素材且不是更早步骤时，按 `nodeId` 绑定；其余照旧拒绝；契约说明素材一律写 nodeId |
| 合成成片做出来了，但画布里拿不到签名地址（日志「文档里出现非本人资产 key，不重签」） | 合成成片按上传结果落库，key 带 OSS 前缀 `media/`，归属检查只认不带前缀的 `ipstudio_gen/<用户>/`；资产库收录对同类旧 key 每 5 秒无限重试也是这个原因 | `20261018-studio-owned-prefix`：归属检查接受恰好一段前缀，属主段仍须是本人（与视频 key 的既有规则一致）；`IpDemoAssetGateTest` |

- 结果：整条流程在线上走通。分析阶段实际 10 积分（上限 63）；制作方案 7 步（三段 H3 全能参考视频各接一次检查，最后合成），报价 663、实际 604；三段检查都判通过，合成 16 秒成片在画布上正常加载播放，主角已换成婴儿。本次会话账本：冻结 915、结算 649（视频 600、对话 / 拉片 / 规划 / 检查 49）、释放 266，无残留冻结。
- 实测还发现：步骤失败不会在对话线程里发消息；`IpLibraryCollector` 对两条旧合成任务每 5 秒无限重试刷 WARN；对话端点未声明工具 / 流式。均已记入 `TODO.md`。

## 追加发布 · 2026-10-19 · 创作助手改版（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261018-studio-assistant-redesign` |
| GIT_SHA | `e9bbca2d`（`release/studio-recreation-20261018`，与 `dev/ai-video-replacement-skill-27b923` 的 `ea3ff018` 同树） |
| 服务 | web-aiavatar（server / admin 不动，无迁移、无 API 变化） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id` `NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn` `NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（与上一版 web-aiavatar `20261018-studio-retry-step` 一致） |
| 发布前基线 | web-aiavatar = `8124cc89`（`20261018-studio-retry-step`）；release 分支在它之后只有 server / 文档改动 |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；`aistareco-web-aiavatar` 14:19:26 CST 重启，5 分钟内 0 条错误；线上 chunk `7203.*.js` 含「想做点什么」「复刻需要的素材」等新界面字符串 |

内容：助手默认右侧停靠、占满高度、可拖宽；开场任务卡与「画布上现在有」；「复刻一条短视频」素材清单；确认卡报价大数字 + 折叠上限；固定在顶部的进度条与「在画布上看」。详见 `AGENTS.md`「创作助手改版」与 `docs/VERSION_HISTORY.md`。

**未验证**：真实后端下的完整对话流程（本地只在 mock 模式实测界面）；用户自行走一遍。回滚：按 `8124cc89` 重建 web-aiavatar（`deploy-release.sh dist/deploy/20261018-studio-retry-step web-aiavatar`）。

## 追加发布 · 2026-10-19 · 对话优先的创作入口（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-dialogue-first` |
| GIT_SHA | `44c7fa22`（`release/studio-recreation-20261018`，与 dev 的 `ee0b1a5a`、main 的 `432b1637` 同树） |
| 服务 | web-aiavatar（server / admin 不动，无迁移、无 API 变化） |
| 构建参数 | 与上一版 web-aiavatar 相同（`AUTH_MODE=id`、`ID_ISSUER=https://id.aibuzz.cn`、`ENTERPRISE_ENABLED=1`） |
| 发布前基线 | web-aiavatar = `e9bbca2d`（`20261018-studio-assistant-redesign`） |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；服务 15:30:52 CST 重启，5 分钟内 0 条错误；`/dashboard`、`/create` 200；线上 chunk 含「想做什么，直接说」等新入口字符串与 `studio-conversation-start` 样式 |

内容：首页英雄区 / 手机首页 / 创作页的对话框入口，进画布自动发出第一句；新节点自动进视野与一次性提示；节点操作条「问助手」；空画布「和助手开始」。详见 `AGENTS.md`「对话优先的创作入口」。

**未验证**：真模型下首页一句话 → 自动发送 → 方案的完整链（本地只在演示模式实测），由用户走一遍。回滚：`deploy-release.sh dist/deploy/20261018-studio-assistant-redesign web-aiavatar`。

## 追加发布 · 2026-10-19 午后 · 画布页改版 + 助手默认打开 / 通高（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-canvas-redesign` |
| GIT_SHA | `f7b414b9`（`release/studio-recreation-20261018`，与 dev 的 `17813e42` 同树；三个提交：默认打开 + 通高、画布页改版、测试修正） |
| 服务 | web-aiavatar（server / admin 不动，无迁移、无 API 变化） |
| 构建参数 | 与上一版相同（`AUTH_MODE=id`、`ID_ISSUER=https://id.aibuzz.cn`、`ENTERPRISE_ENABLED=1`） |
| 发布前基线 | web-aiavatar = `44c7fa22`（`20261019-studio-dialogue-first`） |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；服务 16:20:45 CST 重启，5 分钟内 0 条错误；`/projects`、`/dashboard` 200；线上包含 `studio-ai-orb`、`studio-flow-ai-badge`、`studio-host-more-button` 与 `--ai-gradient` |

内容：助手在桌面画布默认打开（记住关闭）、停靠通高且工具条让位；顶栏低频项进「⋯」；第二排工具条取消，视图切换居中，素材库 / 模板 / 专项创作进左栏（13 → 7），任务左下角带角标，关掉助手后右上角 AI 圆钮；AI 群青紫记号、生成中呼吸、新节点光晕。详见 `AGENTS.md`「画布页改版」。

**未验证**：真模型下的完整链（本地只在演示模式实测），由用户走一遍。回滚：`deploy-release.sh dist/deploy/20261019-studio-dialogue-first web-aiavatar`。


## 追加发布 · 2026-10-19 晚 · 画布页照设计稿补齐 + 对话交互修复 + 打字确认（server + web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-canvas-dialogue` |
| GIT_SHA | `8ee73439`（`release/studio-recreation-20261018`，四个提交 `a42736ed` `fa120469` `6881ee02` `8ee73439`，与 dev 分支 `dev/canvas-page-optimization-b16f3d` 的 `0c49fccf` `68ca2a36` `5abaf10e` `b85b916f` 内容一致；main 上 Codex 未上线的改动不带） |
| 服务 | server + web-aiavatar（admin 不动；无迁移、无 API 路径变化） |
| 构建参数 | 与上一版 web-aiavatar 相同（`AUTH_MODE=id`、`ID_ISSUER=https://id.aibuzz.cn`、`ENTERPRISE_ENABLED=1`） |
| 发布前基线 | web-aiavatar = `f7b414b9`（`20261019-studio-canvas-redesign`）；server = `403e856d`（`20261018-studio-owned-prefix`） |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；两个服务 21:19:35 / 21:19:36 CST 重启，server 15.7 秒起来，重启后 0 条 ERROR（同一 grep 近 7 天命中 103 条，确认能命中），2 条 WARN 为启动时的 Hibernate 方言 / Spring Security 默认提示；`PromptTemplateSeeder` 刷新 54 个未改动的提示词 → `v14-2026-10-19-dialogue-short-approvals`；web-aiavatar 0 条错误；`/projects`、`/dashboard`、`/scenes` 200；运行目录的包里含 `studio-dialogue-steps`、`studio-context-more-button`、`studio-flow-origin`、`studio-dialogue-approval-done`、`studio-host-publish` |

内容：
- 画布页照设计稿 Main 画板补齐（第二、三遍）：顶栏顺序与「已保存」、左栏 56px 七个图标、节点下方操作条（问助手 + 两个主操作 + ⋯）、AI 记号 /「你上传的」/ 生成中圆环、虚线连线、助手头部技能胶囊、三行进度条、对话里的逐步清单、确认后收成一行的确认卡、输入框与按钮区逐像素对齐。
- 对话交互（端到端走查找到的五处）：Enter 发送、「问助手」把节点带进对话、输入框和画布上的 Esc 不再误关助手、「在画布上看」真的移动画布（不再卡在 `useNodesInitialized`）、按可见区域适配。
- server：`StudioNaturalApprovals` 接受「可以 / 好 / 行 / 嗯，可以」这类整句短肯定回复（疑问、犹豫、改动照旧拒绝），对话提示词同步举例并 bump `SEED_VERSION`。
- 按钮配色统一：画布页不再有麦黄，AI 动作用紫色渐变，其它主按钮用墨色（发布、开始制作、发布弹窗、出错重载）。

**未验证**：真模型下的完整对话链（本地在演示模式按真实路径走过，1440 与 375 宽），由用户走一遍；「可以」确认在线上真对话里由用户试一次。回滚：
`deploy-release.sh dist/deploy/20261019-studio-canvas-redesign web-aiavatar`、`deploy-release.sh dist/deploy/20261018-studio-owned-prefix server`（server 回滚后提示词行停在 v14，只多了短回复示例，不影响旧版行为）。

## 追加发布 · 2026-10-19 晚 · 首页对话框聚焦样式热修（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-home-dialog-focus` |
| GIT_SHA | `94d9ad09`（在 `8ee73439` 上只改 `studio-conversation-start.css`；本分支 cherry-pick 为 `940b541a`，内容相同） |
| 服务 | web-aiavatar（server / admin 不动） |
| 构建参数 | 同上一版（`AUTH_MODE=id`、`ID_ISSUER=https://id.aibuzz.cn`、`ENTERPRISE_ENABLED=1`） |
| 结果 | `verify.sh` ALL GREEN；线上 CSS 已含 `textarea:is(:focus,:focus-visible){outline:none}` 与卡片 `:focus-within` 光圈 |

内容：首页「想做什么」对话框点进输入框时，首页 / 外壳的通用焦点规则给内部 textarea 画了一圈直角描边，浮在圆角卡片里很怪。改为 textarea 不画描边，焦点显示在卡片圆角边缘（浅边 + 3px 淡色光圈）；按钮的键盘焦点描边保留。本地 1440 宽实测。回滚：`deploy-release.sh dist/deploy/20261019-studio-canvas-dialogue web-aiavatar`（在本工作区的 dist 下）。

## 追加发布 · 2026-10-19 晚 · 首页对话框文案（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-home-dialog-copy` |
| GIT_SHA | `ebb62e3c`（在上一版焦点热修之上只改文案：`studio-conversation-start.tsx`、`studio-home.tsx`、`studio-assistant.tsx`） |
| 结果 | `verify.sh` ALL GREEN；线上 chunk 已含新说明句 |

改动（去掉 AI 腔）：
- 说明句「建画布免费。回复按实际用量扣积分，做图、做视频前会先报价，你确认了才开始。」→「画布免费建，聊天按用量计积分；出图、出视频前先报价，你确认后才开工。」
- 输入框提示「想做什么，直接说。比如：……」→「说说你的想法，比如：……」；手机首页标题「想做什么，直接说」→「今天想做点什么？」
- 两个示例开头（首页与助手开场卡同步）：「设计一个有辨识度的原创 IP 形象，先给出可生成图片的方案。」→「帮我设计一个原创 IP 形象，要让人一眼记住。先聊思路，再出图。」；「帮我搭建从角色描述……到场景视频的创作流程。」→「帮我把整套流程串起来：先写人物设定，再出三视图和细节图，最后做成场景视频。」
- 无障碍名「想做什么」与按钮「开始对话」未改。回滚：焦点热修那一版的本地 dist 没保留（只在 ECS 的 `/opt/ai-star-eco/releases/20261019-studio-home-dialog-focus`），本地可直接用 `deploy-release.sh dist/deploy/20261019-studio-canvas-dialogue web-aiavatar` 退回热修之前。

## 追加发布 · 2026-10-19 晚 · 首页对话框去掉说明句、改指向灵感与专项（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-home-dialog-links` |
| GIT_SHA | `e75f5659`（只改 `studio-conversation-start.tsx` / `.css` / `.test.tsx`） |
| 结果 | `verify.sh` ALL GREEN；线上 chunk 含「还没想好？逛逛」，不再含「画布免费建」 |

用户反馈说明句多余、「先进画布看看」进的是空画布对没想法的人没用：删掉计费说明句；底部改为「还没想好？逛逛 灵感（`/templates`）或 专项创作（`/scenes`）」。首页、手机首页、「画布·自由创作」页三处共用此组件，同时生效；空白画布仍可从各页已有的「新建空白画布」入口进。回滚：`deploy-release.sh dist/deploy/20261019-studio-home-dialog-copy web-aiavatar`。

## 追加发布 · 2026-10-19 晚 · 画布页三处细节（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-canvas-polish` |
| GIT_SHA | `0b1803be` |
| 结果 | `verify.sh` ALL GREEN；线上 CSS 含 `.studio-host-more-item` 与左栏 `:hover` 展开规则；本地 `src/ip` 62 个测试文件 435 条全过、tsc 干净 |

用户反馈的三处：
- 助手「使用说明」一字一行：每步是「序号 24px + 正文」两列网格，`<strong>` 后面的裸文字成了第三个网格项、掉进 24px 序号列。标题和正文包进同一个 `<span>`；测试钉住每个 `li` 只有一个元素子节点（旧代码上确认会红）。
- 顶栏「⋯」菜单四项样子各异（沿用当初顶栏胶囊的样式，有的居中有的靠左、有的带图标有的不带）：统一成 `.studio-host-more-item`，整宽、左对齐、图标 + 文字；删掉手机端藏「上次发给模型」文字的旧规则。
- 左栏只有图标认不出：恢复改版前的悬停 / 键盘聚焦展开（56px → 168px，浮在画布上不挤画布），七个工具都带名字；结构测试钉住标签。

回滚：`deploy-release.sh dist/deploy/20261019-studio-home-dialog-links web-aiavatar`。

## 追加发布 · 2026-10-19 晚 · 成片编辑器改版 + 成片高级编辑（server + web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-advanced-editor` |
| GIT_SHA | `7dbf8028`（release 分支上 cherry-pick 的 `eb5a3d8e` 成片编辑器改版 + `a05f2ea1` 高级编辑与拼接前预检） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1` |
| 结果 | `verify.sh` ALL GREEN；server 重启后 0 条 ERROR（同一 grep 近两天能匹配到 119 条，确认能命中）；线上 web-aiavatar 运行目录的 chunk 含「导出成片」 |

内容：
- 成片编辑器改版：整片预览、原片素材默认不进成片、合成前就地拦下配音过长 / 字幕超时 / 空字幕。
- 成片高级编辑（Twick 0.15.31 + 两个 pnpm 补丁，仅电脑端）：切开、掐头去尾、删段补位、文字、字幕、两条音轨音量；导出走普通 assemble 任务带 `edit`，服务端 `StudioEditGraph` 用 FFmpeg 合成，不扣积分。
- 服务端在拼接之前先判配音过长 / 字幕超时（`StudioPackagingService.precheck`）。

发布前核对：用新代码生成的 FFmpeg 命令在生产主机的 `/usr/local/bin/ffmpeg`（2018 静态版）上用测试素材跑通（5.5 秒、720×1280、有声、空隙为黑），临时目录已删。release 树上 web-aiavatar 全量 124 个测试文件 938 条通过；server 的 Studio / 合成测试里 `IpVideoModelChoiceWiringTest`（2 条）与 `StudioAssetCatalogPricingTest`（1 条）在未加本次提交的 `343105e0` 上同样失败，属既有问题，与本次无关。本地真服务端 + 浏览器验收：切开、删段、加文字、导出、刷新后继续编辑、改回一键成片均通过，产物逐帧与编辑器一致。生产上没有用真账号点一遍导出。

回滚：`deploy-release.sh dist/deploy/20261019-studio-canvas-polish web-aiavatar` 与 `deploy-release.sh dist/deploy/20261019-studio-canvas-dialogue server`（server 那个包同时含 web-aiavatar，只传 `server`）。无数据库迁移；已存的 `workDraft.advanced` 在旧前端里会被忽略，不影响一键成片。

## 追加发布 · 2026-10-20 · 两份 Codex 验收报告的修复（server + web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261019-studio-acceptance-fixes` |
| GIT_SHA | `8b0774e2`（release 分支上 cherry-pick 的 `bbcbf329` ← main `74987f67`、`cf19aed0` ← main `f47bf68a`，加一个只改测试的 `8b0774e2`；main 上 Codex 的看图记忆回退 `c6a0f71ea`、对话 / 执行六项修复 `b7861a4b` 等不带） |
| 服务 | server + web-aiavatar（admin 等不动；无迁移、无 API 路径变化、无新 FFmpeg 滤镜） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1` |
| 发布前基线 | server 与 web-aiavatar 都是 `7dbf8028`（`20261019-studio-advanced-editor`；jar sha256 与 web BUILD_ID 对上发布目录） |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；14:32:19 / 14:32:20 CST 重启，server 16.4 秒起来，新进程 0 条 ERROR（同一 grep 在旧进程 11 小时里命中 93 条，确认能命中；重启时那 2 条来自旧进程退出）；`PromptTemplateSeeder` 刷新 54 个未改动的提示词 → `v16-2026-10-19-text-to-canvas-and-check-targets`，`dap.ip_studio_skill_dialogue / plan / check` 三行内容已更新；线上 BUILD_ID `qJuR_AhltgsS8gK8JSxRr`，`/dashboard`、`/projects`、`/create`、`/scenes` 200，公网 chunk 含「助手每轮回复按实际用量扣少量积分」 |

内容：
- 首页的一句话重新会发出去：默认打开的助手不再把空草稿盖掉首页那句话；没有回合的想法记录不再算「之前的对话」，线程是否为空按它自己的消息判断；发出后去掉 `send=1`。复刻类的一句话改为打开素材清单，不自动发送；首页对话框写明每轮回复会扣少量积分。
- 技能路由：没有匹配到任何技能的消息不绑定技能（全能创作），只上架一个技能时也一样。
- 方案：`questions` 接受 `{id,text,defaultAnswer}`；方案需要视频而没有可用视频模型时报 `VIDEO_NOT_CONFIGURED`；检查目标带上被检查的那一步和确认方案里的「改什么 / 保留什么」；执行器把参考视频连到它的分析结果。
- 对话 SSE 带 `Cache-Control: no-cache, no-transform` 与 `X-Accel-Buffering: no`（Next 代理会把事件流 gzip 住，回合结束了按钮还停在「停止」）。
- 画布：「你上传的」只给真正上传的文件（`metadata.origin`）；回复上有「放进画布」；旧的 `<tool_call>` 原文折叠；画布按首页那句话或第一条消息命名（用户自己起过名的不动）；助手草稿与所选模型按画布记在本浏览器。
- 成片：拉片切出来的片段（`sourceRange`）和被分析的参考视频默认不进成片。
- 关掉画布期间跑完的视频 / 音频只带存储 key，现在直接按 key 签名播放，不用刷新。
- 提示词 seed 到 v16（对话提示词要求可直接用的文字初稿放进画布，检查提示词按替换对象判定）。

冲突处理：`studio-assistant.tsx` 保留 release 线的模型选择框，只把 `onChange` 换成 `chooseModel`（main 上「固定模型也显示」的那段来自未上线的提交，不带）；`docs/INDEX.md` 保留 release 线的结构，加两行；两份验收报告按 release 线的目录放在 `docs/` 根下（`studio-local-full-e2e-20261019.md`、`studio-user-journey-acceptance-20261019.md`）；`docs/runbooks/studio-e2e-cases.md` 只在 main 上有，不带。新测试「所选模型刷新后还在」最后一句断言发送体里带 `model`，这个字段是 main 的 `b7861a4b` 加的，release 线没有：`8b0774e2` 改为断言本轮上限按记住的那个模型算（8，不是模型一的 21），没有把 `b7861a4b` 的代码带进来。也就是说，release 线上选模型仍然只决定每轮上限的报价，发消息时不带模型，和发布前一样。

门禁（release 树）：`./mvnw compile -q -o` 通过；指定的 13 个 Studio 对话 / 方案 / 执行测试类 101 条全过；`com/aistareco/aep/ipstudio/**` 共 646 条，3 条失败均为既有问题（`IpVideoModelChoiceWiringTest` 2 条、`StudioAssetCatalogPricingTest` 1 条，自 `343105e0` 起就红），5 条跳过；web-aiavatar `typecheck` 通过；`pnpm check:api-contract` OK；web-aiavatar 全量 vitest 127 个文件 962 条：第一遍 2 条失败（模型那条是真失败，已由 `8b0774e2` 修；`studio-attachment-picker` 单独重跑通过），修后第二遍在机器负载约 43 时 `studio-create-home`（4 条）与 `studio-material-library`（1 条）超时失败，两个文件单独重跑 16/16 通过，`studio-assistant` 与 `studio-attachment-picker` 单独重跑 56/56 通过。

**未验证**：真模型下的对话（首页一句话自动发出、「放进画布」、检查口径）没有在线上用真账号走过，生产上没有发起任何付费调用、没有建测试数据；SSE 响应头只能从外部确认接口在线（未登录 401，路由前就鉴权，不能区分路径），头本身由 `StudioDialogueControllerTest` 覆盖，并确认线上 jar 的 `StudioDialogueController` 里有这两个头。回滚：
`deploy-release.sh dist/deploy/20261019-studio-advanced-editor server,web-aiavatar`（两个服务都回到 `7dbf8028`；旧 jar 启动时看到 seed 版本 v16 ≠ 自己的 v14，会把没人改过的提示词行刷回 v14 文本，不用手动处理；无迁移，无数据要回退）。

## 追加发布 · 2026-10-20 · 对话 / 执行六项修复 + 复测 R2/R3/R5（server + web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261020-studio-dialogue-fixes` |
| GIT_SHA | `eb2f5259`（release 分支上 `c95aaf6d` ← main `b7861a4b`、`cac90f06` 撤回只改测试的 `8b0774e2`、`eb2f5259` ← main `bde5956c` 去掉 R4；main 上 Codex 的看图记忆回退 `c6a0f71ea`、三选一冲突框 `6e9e7b3a` 等不带） |
| 服务 | server + web-aiavatar（admin 等不动；无迁移、无 API 路径变化、无 FFmpeg 改动） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1` |
| 发布前基线 | server 与 web-aiavatar 都是 `8b0774e2`（`20261019-studio-acceptance-fixes`；jar sha256 与 web BUILD_ID `qJuR_AhltgsS8gK8JSxRr` 对上发布目录） |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；15:40:26 / 15:40:27 CST 重启，server 15.7 秒起来，`NRestarts=0`；新进程 0 条 ERROR（同一 grep 在此前两天命中 235 条，确认能命中）；WARN 只有启动时的 Hibernate 方言 / Spring Security 默认提示，以及旧进程退出时视频线程池等待超时（见下）；`PromptTemplateSeeder` 刷新 54 个未改动的提示词 → `v17-2026-10-19-dialogue-charging-words`（`aep_platform_configs` 行已是 v17，`dap.ip_studio_skill_dialogue` 行 version=1、含「不要说「不确认不会花钱」「聊天免费」」）；线上 BUILD_ID `j6QIOIHEs87flqHQETVsR`，`/dashboard`、`/projects`、`/create`、`/scenes` 200，公网 chunk 含「没看到追加卡就点进度条上的「继续制作」」 |

内容：
- 制作中途改方案：确认当前阶段的修订方案会替换同一个执行里剩下的步骤（`replanStage`）；没改的已完成步骤保留结果，改了的和下游重做，旧运行记进 `previousRunIds`；还在生成的那一步要等它结束才能改。
- 画布游标：节点只有保存成功后才算放进画布、游标才往后移（`canvasUnsavedFrom`）；游标 0 也持久化，重开时按正常命令重放（R2：新线程第一个没存上的助手节点重开后丢失）。
- 付款方固定：绑定了进行中执行的对话轮次由执行的付款方付，换付款方报 `BILLING_SELECTION_CONFLICT`。
- 预算：执行器因预算停下的步骤标 `budgetBlocked`，确认追加卡后自动继续（用户自己的暂停不动）；分析阶段的追加卡带上执行 id；恢复不再直接回 402，交给执行器发追加卡；等用户时进度条一律给「继续制作」；聊天被预算拦下时提示去哪儿追加（R3）。
- 只写「停 / 暂停」的消息（`StudioStopIntent`）走优先控制，不进插话队列；演示模式同一规则。
- 助手发消息时带上所选模型和它的上限（`cac90f06` 恢复了 main 上「刷新后记住所选模型」那条断言：发送体带 `model: 'two'` 和 `maxCost: 8`）。
- 对话提示词把「聊天每轮按用量扣少量积分」和「制作要确认报价才开始」分开说，不许先报数再改口、不许说「不确认不会花钱」（R5，seed v17）。

**R4 未上线**（冲突态下点「发布」改为打开三选一）：这一处（`canvas-host.tsx` 发布按钮的 `onClick`）和它在 `canvas-conflict-wiring.test.ts` 里的测试依赖 main 上未发布的三选一冲突框 `6e9e7b3a`（`setConflictOpen`、`CanvasConflictDialog`、project-sync 的冲突处理），release 线没有这些代码。线上冲突态点「发布」仍先打开发布弹窗，随后 `publish-gate` 拒绝并提示「这张画布在别处被改过了。刷新页面看到最新内容之后再发布。」，不会把旧内容发出去。**等 `6e9e7b3a` 上线时要连同 R4 一起发。** 本分支 `TODO.md` 里 R4 一行照 main 原样写「已修」，在 release 线上以本节为准。

冲突处理：
- `b7861a4b`：`studio-assistant.test.tsx` 只取这个提交新增的两条模型测试（main 上紧挨着的「固定模型也显示」测试来自未上线的 `c6a0f71ea`，不带）；`docs/runbooks/studio-e2e-cases.md` 只在 main 上有，不带。
- `bde5956c`：去掉 R4（见上）；`docs/INDEX.md` 保留 release 线结构，只更新那份验收报告的一行（报告在 `docs/` 根下）；runbook 不带。

剩余代码块核对（release 树对 main，限四个提交 `b7861a4b` `74987f67` `f47bf68a` `bde5956c` 动过的代码文件，共 64 个）：58 个文件与 main 一致，剩下 6 个文件的差异都能归到不发的提交：
- `canvas-host.tsx`、`canvas-conflict-wiring.test.ts`：三选一冲突框 `6e9e7b3a` 加 R4，预期留下。
- `studio-assistant.tsx` / `studio-assistant.test.tsx`：「固定模型也显示」的模型胶囊和测试，来自 Codex 的 `c6a0f71ea`（经 `8ee5badf` 挪位）。
- `studio-workspace.tsx`：`chosenTextModel` / 剧本模型选择框，来自 Codex 快照 `a164482b`。
- `PromptTemplateSeeder.java`：一行注释里的文档路径，来自 main 的文档分目录 `2b6c3e63a`。
- 没有归不了属的代码块。

门禁（release 树）：`./mvnw compile -q -o` 通过；指定的 16 个 Studio 对话 / 方案 / 执行测试类 125 条全过；`com/aistareco/aep/ipstudio/**` 共 661 条，3 条失败均为既有问题（`IpVideoModelChoiceWiringTest` 2 条、`StudioAssetCatalogPricingTest` 1 条），5 条跳过；web-aiavatar `typecheck` 通过；`pnpm check:api-contract` OK；web-aiavatar 全量 vitest 127 个文件 971 条一次全过（机器负载约 7）。

旧进程退出时有一个用户的 H3 视频任务（`mvj_…734773`，已有供应商任务号）正在轮询，`ThreadPoolTaskExecutor` 等待超时后退出；新进程在派发租约到期后（15:43:21）按原任务号接着轮询（`recoverQueuedGeneration`，没有重新提交），15:43:30 成片镜像到 OSS、截好封面、任务 `succeeded`，队列票据 `finished`。

**未验证**：真模型下的对话（中途改方案、追加卡自动继续、打字停止、所选模型生效、v17 提示词的说法）没有在线上用真账号走过；生产上没有发起任何付费调用、没有发布、没有建测试数据。回滚：
`deploy-release.sh dist/deploy/20261019-studio-acceptance-fixes server,web-aiavatar`（两个服务都回到 `8b0774e2`；旧 jar 启动时看到 seed 版本 v17 ≠ 自己的 v16，会把没人改过的提示词行刷回 v16 文本，不用手动处理；无迁移，无数据要回退）。

## 追加发布 · 2026-10-20 · 像素超限的图片上传前先缩图（仅 web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261020-studio-image-pixel-limit` |
| GIT_SHA | `5bcfbc1f`（release 分支上 cherry-pick 的 main `b8e3c3a4`；三个代码文件在 main 父提交与 release 头上逐字节相同，无冲突；`TODO.md` 自动合并，只带这个提交自己的改动） |
| 服务 | **仅 web-aiavatar**（server 不动，仍是 `eb2f5259` / `20261020-studio-dialogue-fixes`；无迁移、无 API 路径变化） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（manifest 里 `SERVICES='web-aiavatar'`） |
| 发布前基线 | server 与 web-aiavatar 都是 `eb2f5259`（`20261020-studio-dialogue-fixes`；web BUILD_ID `j6QIOIHEs87flqHQETVsR`） |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；web-aiavatar 15:58:21 CST 重启（旧进程收到 SIGTERM 退出码 143，与上次发布相同），`NRestarts=0`；线上 BUILD_ID `zVt3VAXlZ5wrhGil6oY-k`（旧 build 的 `_buildManifest.js` 已 404）；`/dashboard`、`/projects`、`/create`、`/scenes` 200；公网 chunk `7350-cf02f8d623bf1684.js` 与 `app/enterprise/page-4d42d1e2d8127700.js` 都含 `t.width<=8e3&&t.height<=8e3&&t.width*t.height<=24e6`。**server 没有重启**：`aistareco-server` 的 `ActiveEnterTimestamp` 仍是 15:40:26 CST，MainPID 1046164 未变，`NRestarts=0` |

内容：
- 上传前的图片处理 `prepareStudioImageUpload` 原来只在文件超过 8 MB 时缩图，8 MB 以内但像素超限的图（长截图、高像素照片）原样上传，被服务端以「图片最长边不能超过 8000 像素，总像素不能超过 2400 万」拒掉（2026-10-20 线上报错）。现在每张图都先解码，在字节和像素两条上限之内才原样上传，否则沿用已有的缩图（最长边 4096）；浏览器解不了的小文件仍原样上传，交给服务端判断。
- 上传到节点失败时，`studio-flow-canvas.tsx` 的两处 `message.error` 把原错误对象交给提示，服务端的错误码和日志号不再显示成 `CLIENT_ERROR`。

门禁（release 树）：web-aiavatar `typecheck` 通过；`pnpm check:api-contract` OK；指定的 3 个文件（`studio-image-file`、`studio-media-upload-api`、`studio-flow-card`）15 条全过；web-aiavatar 全量 vitest 127 个文件 974 条一次全过（机器负载约 6）。server 未改动，未跑 Maven。

**未验证**：线上没有用真账号实传一张超像素的图（本地浏览器实测 9000×2000、168 KB 的 JPEG 传出去是 4096×910，见 main 的提交说明）；生产上没有发起任何付费调用、没有建测试数据。回滚：
`deploy-release.sh dist/deploy/20261020-studio-dialogue-fixes web-aiavatar`（web-aiavatar 回到 `eb2f5259`；server 不动；无迁移，无数据要回退）。

## 追加发布 · 2026-10-20 · H3 视频台词保护、厂商实际描述与首尾帧确认（server + web-aiavatar）

| 项 | 值 |
|---|---|
| 发布号 | `20261020-h3-video-dialogue` |
| GIT_SHA | `1376a4e0`（release 分支：先把线上已发布的 Codex 三个提交 `7d4ffcaa` `61c3dcc3` `348656c7` 原样 cherry-pick 为 `65b95523` `a7bfea72` `f7a3f040`，代码与 `348656c7` 逐字节一致、只多本文件里早先的发布记录；再 cherry-pick `dev/h3-video-dialogue-frames-20261020` 的 `47c057ea` → `7980dfba`、`1ba9d344` → `1376a4e0`，都自动合并、无冲突） |
| 服务 | server、web-aiavatar（无迁移；接口只新增可空字段 `StudioVideoSettings.optimizePrompt`、视频候选 `promptRewrite`） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（manifest `SERVICES='server web-aiavatar'`、`USE_MOCK=0`、`ENABLE_DEV_LOGIN=0`） |
| 发布前基线 | server `61c3dcc3`（`20261020-studio-gpt-image-size-gate`），web-aiavatar `7d4ffcaa`（`20261020-studio-gpt-image-native`）；发布前线上没有排队或生成中的视频任务、没有运行中的创作任务 |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；server 18:52:12 CST、web-aiavatar 18:52:13 CST 重启，`NRestarts=0`；Flyway「Schema is up to date」，15 秒启动，重启后 0 条 ERROR；线上 BUILD_ID `Qz1J754h81OaAHTyliuHf`（`_buildManifest.js` 200），公网 chunk `6212.017365a3c3261c7a.js` 含「按原文生成」与 `optimizePrompt`；`/dashboard` `/projects` `/create` `/scenes` 200 |

内容（详见 `docs/ip-studio-video-modes.md` 末节）：
- Studio 视频参数「按原文生成」→ 请求带 H3 公开契约的 `optimizePrompt:false`，默认不勾、价格不变；视频生成区用了智能优化的生成也发 `false`。
- worker 把厂商查询响应里的 `promptOptimization`（实际用的描述、状态）存进任务 `payload_json.vendor_prompt`：锁行后只更新这一列，不整行保存。画布候选投影 `promptRewrite`，面板 / 任务列表 / 「本次创作输入」说明哪些台词没保留（成片后的解释，不是生成前拦截）。
- 描述写了图1 / 首帧 / 尾帧而请求没带图时，提交前问一次；推荐的模式按首尾帧语义和容量选，不替用户挑图。

门禁（release 树）：`pnpm typecheck:all`、`typecheck:admin`、`./mvnw compile -q -o`、`pnpm check:api-contract` 通过；server `materialvideo` / `videostudio` / `ipstudio` 共 980 条，3 条失败均为既有问题（`IpVideoModelChoiceWiringTest` 2 条、`StudioAssetCatalogPricingTest` 1 条，在 cherry-pick 前的 `f7a3f040` 上复跑同样失败）；web-aiavatar 受影响的 20 个测试文件 307 条全过。

**未验证**：线上没有用真账号生成视频，「按原文生成」的出片效果（台词是否完整、画面是否变差）仍待付费对比验收；没有发起任何付费调用、没有建测试数据。默认行为不变：不勾选时请求与发布前逐字段相同。回滚（发布包在 Codex 工作区 `/Users/donis/.codex/worktrees/studio-gpt-image-native/AIStarEcosystem/dist/deploy/`）：
`deploy-release.sh <上述目录>/20261020-studio-gpt-image-size-gate server` 与 `deploy-release.sh <上述目录>/20261020-studio-gpt-image-native web-aiavatar`（无迁移；回滚后旧代码不再读 `vendor_prompt`，留在 payload 里无害）。

## 追加发布 · 2026-10-20 · 第一次从 main 发 web-aiavatar：补回 H3 前端，带上保存冲突三选一

| 项 | 值 |
|---|---|
| 发布号 | `20261020-studio-main-h3-conflict` |
| GIT_SHA | `790d85a3`（本地 main，未推远端；在仓库同级的干净工作区 `AIStarEcosystem-main-release` 里构建）。main 已合齐 release 线（到 `77d35b82`，含线上 server `1376a4e0`）、Codex 分支 `codex/studio-gpt-image-native`（到 `183106af`，含线上 web `190ccd03`）和 H3 两个提交 |
| 服务 | **仅 web-aiavatar**（server 不动，仍是 `1376a4e0` / `20261020-h3-video-dialogue`；main 的前端没有新增或改动接口，`specs/openapi.yaml` 与线上 server 相同） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（manifest `SERVICES='web-aiavatar'`、`USE_MOCK=0`、`ENABLE_DEV_LOGIN=0`） |
| 发布前基线 | web-aiavatar `190ccd03`（Codex 从自己分支发的 `20261020-studio-video-settings-compact`，没有 H3 前端）；server `1376a4e0` |
| 结果 | `env-check` 与 `verify.sh` ALL GREEN；web-aiavatar 20:14:24 CST 重启（旧进程 SIGTERM 退出码 143，与以往相同），`NRestarts=0`；线上 BUILD_ID `ZwgrcsEQExwCRWnFOzV6V`；公网 chunk `1760.89d9f1a2ba09d104.js` 含「按原文生成」、`1183.7f66b99e029e7f15.js` 含「另存一份，再换成最新内容」；**server 没有重启**（`ActiveEnterTimestamp` 仍是 18:52:12 CST），近 10 分钟 0 条 ERROR |

比线上多出的前端内容：
- H3 前端回到线上：「创作参数」里的「按原文生成」、素材区下方的台词提醒、描述写了图1 / 首帧 / 尾帧但没带图时的确认（这三处在 `20261020-h3-video-dialogue` 上过线，随后被 Codex 从自己分支发的三版前端覆盖掉）。
- 保存冲突三选一（`6e9e7b3a`，此前从未上线）与「冲突时点发布先打开三选一」（`bde5956c` 的 R4，release 线当时去掉了，等的就是这一项）：同一张画布在别处存过之后，不再连串报错，顶栏出现能点的「处理冲突」，弹窗给「另存一份，再换成最新内容 / 换成最新内容 / 以这里为准」；同一浏览器里没改过的标签页悄悄换成最新内容。

发布前验证：
- 门禁（main 干净工作区）：`pnpm typecheck:all`、`typecheck:admin`、`pnpm check:api-contract` 通过；web-aiavatar 全量 vitest 135 个文件 1049 条全过。server 本次不发；合并 main 时跑过的 server 全量 992 条 0 失败。
- 保存冲突按真实路径走了一遍（本地 main 后端 + main 前端，无头浏览器两个标签页 + 用接口模拟另一台设备）：① A 加文字，B 没改过 → B 自动换成最新并提示一句；② 另一台设备存过、A 再改 → 409 后只弹一个三选一、不刷错误；选「另存一份」→ 新画布含 A 的改动、A 换成服务端版本、提示里的链接指向新画布；③ 关掉弹窗 → 顶栏「处理冲突」，点「发布」先打开三选一；选「以这里为准」→ 服务端等于 A、另一台设备那次被覆盖；④ 处理完继续编辑正常自动保存；⑤ 两个标签页都有没存的改动 → 后改的那页直接弹窗、没发出注定 409 的保存，选「换成最新内容」不新建画布、画面与服务端一致。

**未验证**：线上没有用真账号操作画布或生成视频；「按原文生成」的出片效果仍待付费对比验收。回滚：
`deploy-release.sh /Users/donis/.codex/worktrees/studio-gpt-image-native/AIStarEcosystem/dist/deploy/20261020-studio-video-settings-compact web-aiavatar`（回到 `190ccd03`；无迁移，无数据要回退；server 不动）。

以后 Studio 从 main 起版本：main 同时包含 release 线和 Codex 分支的线上内容，从它发不会回退任何一方；但 Codex 若继续从 `codex/studio-gpt-image-native` 直接发，会把这次的 H3 前端和冲突弹窗再次覆盖掉。
