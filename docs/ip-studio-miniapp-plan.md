# Studio Agentic 多媒体小程序接入方案

> 状态：方案留档，未开始小程序实现，未发布。
> 核对日期：2026-10-22；本地 HEAD：`d20ecc9b`，核对范围包含工作区已有未提交改动。下文“已有”指本地源码可定位，不代表本次完成线上或微信真机验收；实施前须重新核对主线。
> 本轮范围：记录用户流程、架构建议、已有能力及差距。不修改业务代码、接口契约或部署配置。

## 1. 目标与接入结论

将现有 Studio 的 Agentic 多媒体创作做成微信小程序，让用户通过对话、素材选择、镜头卡片与结果审阅完成创作，避免在手机上操作无限画布。

建议首版直接接现有 AIStar Studio 后端，登录接统一账号中心 `aibuzz-id`。不另建独立 BFF，不复制 Agent、任务执行器、钱包或资产业务。按实际页面需要，在原后端补充聚合查询及微信配套能力。

关键工作不仅是接接口：网页仍承担部分项目文档修改、生成结果投影、候选采用与保存逻辑。应把这些能力抽成可脱离 React、DOM 和画布渲染运行的项目操作核心，供网页与小程序复用。这个核心是代码模块，不是新部署的服务；具体包名、目录及小程序工程位置待实施时确定。

```text
网页画布 / 网页分镜                  微信小程序
          │                            │
          └────── 共用项目操作核心 ──────┘
                 文档修改 / 结果恢复
                 版本采用 / 保存冲突
                          │
              现有 AIStar Studio 后端
              Agent / 计划 / 生成任务
              素材 / 开通 / 个人与企业积分

两端身份：统一账号中心 aibuzz-id
```

同一个 uid、项目 ID、任务和存储 key 贯穿两端。小程序改变呈现与操作方式，继续使用现有项目数据。

## 2. 产品与设计基线

- 视觉沿用本轮已选的淡色方向：暖白底、克制的浅灰绿分区、深色正文、浅黄绿主操作、大媒体预览；每个步骤突出当前要做的事。
- 主导航暂按“创作 / 作品 / 我的”；项目内以“对话 / 作品”为核心，镜头列表与单镜头详情承担局部编辑。
- 借鉴快出片的移动端任务闭环、上传进度、生成中退出和返回恢复；业务能力接 Studio，不复制快出片的模板限制及计费链。
- 本轮完整 HTML 原型包含 58 个页面与状态，属于交互设计样稿；金额、任务、身份、通知、分享和保存结果均为演示，不能据此认定后端功能已交付。
- 原型中的完整分镜、媒体分享权限等设计，需要按本文能力矩阵落实或调整后才能成为正式产品承诺。

本机设计交付位置（不属于仓库源码，换机器需另行交付）：

```text
/Users/donis/.codex/visualizations/2026/10/22/01a1629a-ad26-7f02-90fd-94ead50a5020/agentic-miniapp/full-design/
```

其中 `DESIGN.md` 为交互说明，`coverage.json` 为页面清单，`index.html` 可查看流程图、页面总览和交互演示。

## 3. 已核对能力与复用方式

下表中的接口前缀为 `/api/v1/ip-studio`，除身份认证外均由现有 AIStar 后端提供。接口契约仍以 [openapi.yaml](../specs/openapi.yaml) 为准，本文不新增接口定义。

| 能力 | 本地源码事实 | 小程序接入工作 |
|---|---|---|
| 微信登录与令牌刷新 | `aibuzz-id` 已有 `wechat-mini` grant；本仓小程序已有换令牌和刷新实现 | 配置新端客户端与微信 AppID、正确 audience；适配绑手机与开通后继续操作 |
| 项目创建、读取、保存 | `/projects`、`/projects/{id}` 已有；文档整存整取 | 使用同一项目；移动端仍需加载、维护和保存文档 |
| AI 对话与计划确认 | 会话、消息、SSE 事件和会话快照已有；消息含结构化计划与审批内容 | 适配请求与事件传输；保留消息幂等键、确认卡及恢复行为 |
| 计划执行与控制 | `/projects/{id}/plan-executions` 已有创建、查询、暂停、继续、取消、步骤采用 | 直接复用服务端执行器和真实任务状态 |
| 文本、图片、视频、配音 | `studio-runs`、`speech-runs` 等已有；模型、价格和权限由服务端处理 | 将移动端输入映射到既有请求，保持精确参考与费用确认 |
| 成片合成 | `assemble` 已支持按片段顺序或编辑时间线交给服务端 FFmpeg 合成 | 移动端构建清单并预览，不需要另造合成后端；网页 Twick 编辑器不能直接作为原生小程序界面复用 |
| 素材上传与素材库 | `media-import`、`library/uploads`、`library/materials`、对象及版本接口已有 | 适配微信上传、进度、失败处理和选择回填；现有接口不等于已具备断点续传 |
| 历史任务与历史文档 | `/projects/{id}/runs`、`history`、`history/{revisionId}` 已有；文档历史最多保留 50 份 | 历史文档、运行记录与媒体候选分开呈现，不能混成同一种“版本” |
| 保存冲突 | `baseDocVersion` 校验及 `IP_PROJECT_STALE` 已有；网页有取远端、另存副本、显式覆盖处理 | 移植保存状态与冲突选择；所有新端文档写入均携带版本基线 |
| 候选结果采用 | 执行步骤可记录采用的 run/candidate；图片和视频节点有候选与主版本字段 | 同时处理执行采用与文档采用，不把切换历史结果当成重新生成 |
| 对话分享 | 已有可撤销的文字快照分享；从文档中的对话对象提取，排除原媒体、执行请求和凭证 | 不等同于新版全部会话分享，也不等同于媒体交付分享；按目标对象另行适配 |

因此，历史版本、冲突处理、候选采用及对话分享均有基础，不能全部列为“从零新增”。

## 4. 必须处理的架构边界

### 4.1 项目文档仍由客户端维护

当前服务端 Agent 可发送 `node.upsert` 等事件，网页应用到文档后通过普通保存链落库。仅发送成功事件，不等于项目文档已保存。

小程序必须具备不依赖可视画布的文档操作能力：维护节点和引用、应用修改建议、合并生成结果、切换采用版本，以及按版本保存。保留网页所需的文档字段，不能因手机不展示位置或连线而在保存时删掉它们。

服务端已经能持续执行已受理任务；网页也已有通过执行步骤和原生 run 恢复结果的逻辑，不只依赖 SSE 历史事件。应复用这套恢复规则，避免把“关掉小程序后完成的任务”再生成一遍。

后续如要让服务端直接提交项目编辑，需要单独调整文档所有权与并发协议；不能在小程序适配层悄悄增加第二个写入者。

### 4.2 传输与业务状态分开

网页使用带 Authorization 的 fetch 流读取 SSE，失败后可读会话快照。小程序需要独立的网络适配，不能原样复制浏览器流读取代码。首版可先用既有查询接口完成状态恢复，再验证微信端流式体验。

不因断网、切后台或响应丢失就认定任务失败。查询原任务、保留原请求标识；需要重放时严格遵守原接口的同键同正文契约，不生成新键另起任务。暂停后，已经提交给供应商的步骤仍可能完成并结算，界面须准确说明。

### 4.3 身份与产品权益

本仓 `apps/miniprogram` 是明星带货小程序，配置默认 `appCode=celebrity`。Studio 新端应沿用 `aiavatar` 开通归属，客户端注册、audience、请求产品标识及微信配置均需重新核对，不能直接复制旧配置。新客户端身份不等于新增产品码。

未绑手机的写入限制、个人/企业付款选择、原任务付款快照及后端结算继续沿用。适配层不维护独立余额，不自动替换付款主体。

快出片目前业务仍经军师 BFF，身份已接 `aibuzz-id`。这是其现有产品链路；Studio 小程序无需再经过军师 BFF，也不能搬用 Clip Scheme A 的计费语义。

## 5. 需要补齐或进一步验证的能力

| 项目 | 当前差距与处理建议 |
|---|---|
| 完整分镜编辑 | 现有基础可浏览节点和修改部分镜头内容；明确镜头归属、插入、排序及统一 AI 编辑仍见[分镜编辑改造方案](ip-studio-storyboard-editing-plan.md)，该方案当前未实现。小程序与网页共用其序列模型和命令规则，不再定义一套手机专属镜头真值 |
| 作品与交付汇总 | 已有项目、任务、素材数据，但本次未确认满足原型全部页面的单一作品汇总接口。先基于现有数据实现，确有请求量或一致性问题时在原后端增加只读聚合，避免另建作品事实表 |
| 媒体成果分享 | 现有对话分享没有原型中媒体集合、7 天有效期、下载权限等完整语义。需要单独定义分享对象、访问权限、撤销和过期行为 |
| 微信订阅通知 | 本次未找到 Studio 完整的授权记录到任务完成通知链；需补微信配套能力，并验证拒绝授权不阻断创作 |
| 下载与保存 | 已有资产签名和内容读取；微信端的合法域名、文件格式、授权拒绝、临时文件失效、音视频保存差异仍需真机验收 |
| 独立小程序部署配置 | 本次未验证正式 AppID、账号中心注册、业务/上传/下载域名、订阅模板及发布配置；这些不因后端已有能力而自动就绪 |

## 6. 首版用户闭环与实施顺序

主流程：进入创作 → 登录/开通（需要时）→ 输入需求并选参考 → 对话澄清 → 确认计划与预算 → 后台生成 → 审阅结果 → 采用或局部修改 → 保存成片。

参考视频复刻沿用现有“分析授权 → 分析结果 → 制作授权”两阶段；普通创作按技能实际计划进入生成，不强行经过参考分析。局部修改涉及新生成时展示新的费用与目标，已有结果切换不触发付费生成。

建议分三步实施，以下均未开始：

1. **项目操作核心与最小接入**：明确工程位置；抽离请求、文档操作和结果恢复的环境依赖；打通登录、项目加载、素材导入、对话与保存，不搬入画布渲染包。
2. **真实创作闭环**：确认计划、服务端生成、退出恢复、候选采用和成片保存；接通个人/企业付款、失败、待核对、保存冲突等状态。
3. **扩展完整设计**：与分镜改造联动，补齐结构化镜头操作、作品汇总、媒体分享和微信通知，再逐项核销原型页面。

验收至少覆盖：

- 同一账号在网页和小程序打开同一项目，能看到同一已保存内容及采用结果。
- 上传参考后，生成请求绑定精确素材；不依靠自然语言中的“图 1”猜测绑定。
- 确认后的任务在退出小程序后继续；返回能恢复真实结果，不重复提交或扣费。
- 网络未知状态先查原任务；确定失败和仍待核对分别展示。
- 切换已有候选只改变采用关系；局部重新生成明确目标和新费用。
- 两端同时修改触发版本冲突，未保存草稿可保留，不静默覆盖。
- 分析授权不等于制作授权；个人/企业付款及任务价格快照保持一致。
- 手机授权拒绝、保存失败、资产 URL 过期均有恢复路径；成功提示对应实际结果。
- 在可达的测试 API 上完成微信真机验证；静态原型或网页窄屏通过不能替代。

## 7. 核对依据

主要源码入口（后续以实现为准）：

- [项目服务：保存、历史与文档版本](../apps/server/src/main/java/com/aistareco/aep/ipstudio/service/IpProjectService.java)；[历史/运行记录接口](../apps/server/src/main/java/com/aistareco/aep/ipstudio/controller/IpRecoveryController.java)。
- [对话接口](../apps/server/src/main/java/com/aistareco/aep/ipstudio/controller/StudioDialogueController.java)；[计划执行接口](../apps/server/src/main/java/com/aistareco/aep/ipstudio/execution/StudioPlanExecutionController.java)；[执行 DTO](../apps/server/src/main/java/com/aistareco/aep/ipstudio/dto/StudioPlanDtos.java)。
- [生成与合成 worker](../apps/server/src/main/java/com/aistareco/aep/ipstudio/service/StudioWorkflowWorker.java)；[工作流接口](../apps/server/src/main/java/com/aistareco/aep/ipstudio/controller/StudioWorkflowController.java)；[素材库接口](../apps/server/src/main/java/com/aistareco/aep/ipstudio/controller/IpLibraryController.java)。
- [Agent 创建对象事件](../apps/server/src/main/java/com/aistareco/aep/ipstudio/dialogue/tools/CreateNodesTool.java)；[前端结果投影及恢复](../apps/web-aiavatar/src/canvas-bridge/studio-plan-execution.ts)；[事件应用与保存](../apps/web-aiavatar/src/ip/studio-assistant.tsx)。
- [候选版本操作](../apps/web-aiavatar/src/canvas-bridge/studio-nodes.ts)；[文档同步与冲突](../apps/web-aiavatar/src/canvas-bridge/project-sync.ts)；[网页流传输](../apps/web-aiavatar/src/canvas-bridge/studio-dialogue.ts)。
- [现有对话分享服务](../apps/server/src/main/java/com/aistareco/aep/ipstudio/service/StudioConversationShareService.java)。
- [本仓小程序认证](../apps/miniprogram/utils/auth.js)与[配置默认值](../apps/miniprogram/config.js)；[统一身份方案](unified-identity-plan.md)。
- 另核对同级仓库 `../aibuzz-id` 的 `WechatMiniAuthenticationProvider`、`application.yml`，以及 `../ai-quickreel/README.md` 的业务 BFF 边界；正式注册与生产配置尚未验证。

本轮验证限于源码阅读和文档链接检查，未调用付费生成，未运行业务测试，未做生产或微信真机验收。
