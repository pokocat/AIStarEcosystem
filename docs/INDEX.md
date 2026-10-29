# 文档索引 · INDEX

> 单页地图。任何 agent / 新人进仓库先开本文，按「想做什么」找到对应真源。
> last-reviewed：**2026-10-18**（文档整理：`docs/` 分出 `runbooks/` / `audits/` / `archive/` 三个子目录，去掉 `[Fabel5]` 前缀，
> 根目录 `DEPLOYED.md` 并入 clip 方案；上一次内容性更新是 2026-10-07 / v0.201）。
> 同日合入 Studio 统一画布主线（`codex/unified-ip-studio`，v0.202–v0.231），新增 `docs/releases/` 放发布与验收记录；Studio 设计真源见 [§1.4](#14-studio-统一画布2026-10-主线)，记录见 [§7](#7-发布与验收记录docsreleases)。

**目录约定**（新文档按这个放，细则见 [`AGENTS.md` §9](../AGENTS.md)）：

| 位置 | 放什么 | 文件名 |
|---|---|---|
| `docs/*.md` | **现行设计真源**（还在指导代码的方案）+ 本索引 + 版本历史 | kebab-case，不加 `[xxx]` 前缀 |
| `docs/runbooks/` | 运维 / 联调**操作手册**（照着做就行的） | kebab-case |
| `docs/audits/` | 带日期的**一次性审计 / 调研**，写完不再改 | `xxx-YYYY-MM.md` |
| `docs/archive/` | **已落地或已被取代**的方案、关闭的 TODO 段；顶部一行写明现行真源在哪 | 原名 |
| `docs/releases/` | **发布与验收记录**：上线制品与线上验收、本地实施验收的证据；配图放同名子目录 | 原名，新文件带日期 `-YYYYMMDD` |
| `docs/design/` | 子应用视觉系统与设计稿：`celebrity/`、`studio/`（Studio 设计图）；其他 app 的 `DESIGN*.md` 在各自目录 | — |
| `docs/prototypes/` · `docs/prompts/` · `docs/training/` | 设计原型说明、可复用的提示词、带截图的操作培训 | kebab-case |

新人 agent 顺序：**[`AGENTS.md`](../AGENTS.md)** → 对应 `apps/<sub-app>/PRODUCT.md` → `apps/<sub-app>/README.md`。
不动产品方向时，§1 的设计真源按需翻，不必通读。

---

## 1. 产品 / 业务规格（"产品要什么"）

### 1.1 跨子产品规格（仓库根）

| 文档 | 范围 | 状态 |
|---|---|---|
| [`product_spec.md`](../product_spec.md) | **AiAvatar / 数字 IP 主线**：数字艺人、音乐工坊、内容、社群、版权、分发、变现 | v2.7 canonical（2026-05-06） |
| [`product_spec_ai_celebrity.md`](../product_spec_ai_celebrity.md) | **AI 明星带货主线**：明星市场、授权、模板 / 脚本、AI 模型、生成器、积分钱包、消息、社交账号绑定 | v0.5.x 滚动 |
| [`docs/ADMIN_PRODUCT_SPEC.md`](ADMIN_PRODUCT_SPEC.md) | **运营后台规划**（全配置化终态）；当前 admin 是其 P0 子集。正文里的 `apps/web/...` 路径是遗留前端，按头注换算 | v1.0 大目标稿（2026-05-07） |

### 1.2 子应用产品 + 设计约束（每 app 一份，★ = 必读）

| 子产品 | 产品 / 路由 / 模块 | 启动 / 版本日志 | 视觉与决策 |
|---|---|---|---|
| AI 音乐人（3010） | [`apps/web-music/PRODUCT.md`](../apps/web-music/PRODUCT.md) ★ | [`README.md`](../apps/web-music/README.md) | 同 PRODUCT.md |
| AI 短剧（3011） | [`apps/web-drama/PRODUCT.md`](../apps/web-drama/PRODUCT.md) ★ | [`README.md`](../apps/web-drama/README.md) | 术语表 [`docs/drama-ux-copy-pass.md`](drama-ux-copy-pass.md) ★ |
| AI 明星带货（3012） | [`apps/web-celebrity/PRODUCT.md`](../apps/web-celebrity/PRODUCT.md) ★（含混剪专区） | [`README.md`](../apps/web-celebrity/README.md) | [`docs/design/celebrity/DESIGN.md`](design/celebrity/DESIGN.md) · [`apps/web-celebrity/DESIGN.md`](../apps/web-celebrity/DESIGN.md) |
| AiAvatar 数字资产平台 + AI IP 工作台（3013，一个应用两套形态） | [`apps/web-aiavatar/PRODUCT.md`](../apps/web-aiavatar/PRODUCT.md) ★ | [`README.md`](../apps/web-aiavatar/README.md) | 桌面面 [`DESIGN-desktop.md`](../apps/web-aiavatar/DESIGN-desktop.md) ★ · 手机面 [`DESIGN.md`](../apps/web-aiavatar/DESIGN.md) · [`DECISIONS.md`](../apps/web-aiavatar/DECISIONS.md) · 画布胶水 [`src/canvas-bridge/README.md`](../apps/web-aiavatar/src/canvas-bridge/README.md) |
| 明星商务工作台（3014） | [`apps/web-star/PRODUCT.md`](../apps/web-star/PRODUCT.md) ★ | [`README.md`](../apps/web-star/README.md) | 同 PRODUCT.md §4 |
| 运营后台（3003） | [`apps/admin/PRODUCT.md`](../apps/admin/PRODUCT.md)（impeccable 用的 personality 文档） | [`README.md`](../apps/admin/README.md)（sidebar 真值） | [`apps/admin/DESIGN.md`](../apps/admin/DESIGN.md) |
| 微信小程序（带货方） | — | [`apps/miniprogram/README.md`](../apps/miniprogram/README.md) | 平台坑 [`agent.md`](../apps/miniprogram/agent.md) ★ |

> 仓库**根** [`PRODUCT.md`](../PRODUCT.md)（44 行）是 `/impeccable` skill 的全局 personality 文档（Users / Brand / Tone），**不是**业务规格；业务规格在 `product_spec*.md`。

### 1.3 现行设计真源（`docs/` 根）

- [模型接入点赠款与折扣](model-billing-design.md)：接入点唯一范围、沿用原价、企业折扣、文本/媒体分账及本地核验；本地完成，未发布，last-reviewed 2026-10-25。
- [模型计费后台本地验收](releases/model-scoped-credits-admin-validation-20261025.md)：价格/折扣/活动/发放的真实页面、接口与余额证据；局部验收，未发布，last-reviewed 2026-10-25。
- [模型赠款与折扣生产发布](releases/model-scoped-credits-production-release-20261025.md)：`20261025-model-grants`，合并处理、发布前检查、线上验收与回滚，last-reviewed 2026-10-25。
- [通用积分转模型赠款生产发布](releases/model-grant-conversion-production-release-20261026.md)：`20261026-model-grant-conversion`，后台积分转赠款上线、线上验收与运营执行步骤，last-reviewed 2026-10-26。
- [通用视频模型计费本地验证](releases/model-scoped-credits-video-validation-20261025.md)：精确范围/快照、资源与失败恢复的数据库和服务回归；部分接入，未发布，last-reviewed 2026-10-25。

按产品线分组。每行只写「它定了什么」，状态以文档头注为准。

**AI IP 工作台 · 数字资产 · 数字名片**（都在 `apps/web-aiavatar`）

| 文档 | 定了什么 | 状态 |
|---|---|---|
| [`ip-studio-plan.md`](ip-studio-plan.md) ★ | AI IP 工作台：节点 / 运行契约、五层一致性锁定、服务端生成链、并行分工；§0 两条决策已被 v0.157 / v0.190 推翻（头注有说明），§10 是实现差异 | 已上线，last-reviewed 2026-10-07 |
| [`ip-ecosystem-integration.md`](ip-ecosystem-integration.md) | 造形象 → 登记资产 → 对外发布一条链：只靠 `dapDisplayRef` + `DapAssetUsage` 打通，内置「IP 打造」模板，三条红线 | v0.153–v0.156 落地，2026-09-07 |
| [`digital-business-card-plan.md`](digital-business-card-plan.md) | AI 数字名片（`/card` 域）：不发新产品码、形象走引用不拷贝、与 dap / IP 工作台边界 | 一期落地，2026-09-06 |
| [`aiavatar-asset-hub-redesign.md`](aiavatar-asset-hub-redesign.md) | 数字资产升格为生态资产中枢：四动词模型、档案卡、新 IA、P1–P4 分期 | P1 已落地，2026-08-29 立项 |

**AI 短剧**（`apps/web-drama`）

| 文档 | 定了什么 | 状态 |
|---|---|---|
| [`drama-ux-copy-pass.md`](drama-ux-copy-pass.md) ★ | 全站**术语表**（每个东西一种叫法、旧词不许回来）+ 用户路径 + 响应式规范 + 文风 | v0.197 / v0.198，2026-09-30 |
| [`drama-canvas-plan.md`](drama-canvas-plan.md) | 短剧画布 `/canvas`：四屏流水、`drama_canvas` 独立表、只存 key、版本防覆盖；§11 线上实测修复 | v0.198 / v0.198.1，2026-10-03 |
| [`drama-consistency-engine-design.md`](drama-consistency-engine-design.md) | 一致性引擎实现级设计 C-1 / D-11 / C-2 / C-3：末帧镜像、多候选端点、角色场景实体化、服务端参考装配 | 全部落地（v0.99–v0.102） |
| [`drama-storyboard-consistency.md`](drama-storyboard-consistency.md) | 分镜一致性 P0–P2（镜间承接 / 机位 prompt / 首尾帧）；前端拼参考图的那部分已过时，以引擎设计 §5 为准 | v0.97–v0.102，2026-07-10 |
| [`drama-short-vimax-lite-plan.md`](drama-short-vimax-lite-plan.md) | 风格短片 ViMax-lite 一致性：提示词去污染、关键帧依赖 DAG、确定性声音总装；明确不做多 Agent Review | P0–P5 已实现，2026-08-18 |

**AI 明星带货 / 口播视频**

| 文档 | 定了什么 | 状态 |
|---|---|---|
| [`video-studio-plan.md`](video-studio-plan.md) ★ | 视频生成区 `/studio/video`：MiniMax H3 四种原生模式原样开放、价格我们自己定、`VideoGenSpec` 一处解析、智能优化、模板 / 做同款 | v0.199 + v0.199.1 真厂商实测，2026-10-04 |
| [`clip-avatar-video-plan.md`](clip-avatar-video-plan.md) | `clip` 口播视频线（军师小程序分包）：本人素材直传、多数字人、逐句字幕总装、音频质量门；文末附线上运营面与账号绑定 | v0.135 / v0.150，2026-08-19 |

**全生态**

| 文档 | 定了什么 | 状态 |
|---|---|---|
| [`unified-identity-plan.md`](unified-identity-plan.md) ★ | 统一账号中心 `id.aibuzz.cn`：OIDC + RS256、身份 / 建档 / 开通五层模型、小程序 grant、§12 本仓接入契约；服务在独立仓库 [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id) | P1+P2 已于 2026-09-05 上线；P3–P5 见 §9 |

### 1.4 Studio 统一画布（2026-10 主线）

AI IP 工作台新版（`apps/web-aiavatar` 的 Studio）的方案与设计。发布与验收记录见 [§7](#7-发布与验收记录docsreleases)，审计与评审见 §6；状态以各文档头注为准。

**方案与设计**

| 文档 | 主题 | 内容与状态 |
|---|---|---|
| [`docs/unified-operations-console-plan.md`](unified-operations-console-plan.md) | **统一运营后台建议** —— Platform 统一入口、复用原业务服务、模型定价/任务排查/模板运营三条首期流程，以及沿用原 admin 风格的紧凑视觉建议 | 建议留档，待确定实施范围（2026-10-10）；非已交付状态 |
| [统一账号邀请关系方案](unified-account-referral-plan.md) | 账号中心邀请码、一张原始邀请关系表、注册时记录与直接查询；§9 复核后期本体/整体链路视图，不增加当前数据结构 | v0.5；ID/Studio 首版已发布，品牌邀请入口与完整线上验收待完成（last-reviewed 2026-10-17） |
| [统一账号邀请 · 前端设计](unified-account-referral-frontend.md) | Studio 内邀请视图/链接管理、账号中心落地页与注册提示，含手机和失败状态 | v0.4；首版已发布，Studio 品牌邀请页先行设计（last-reviewed 2026-10-17） |
| [Studio 品牌邀请页设计](prototypes/studio-invitation-design.md) | 品牌、创作能力、朋友邀请、认证后返回 Studio；独立交互原型及桌面/手机截图 | 设计审阅稿，尚未替换线上（2026-10-17） |
| [Studio 企业主子账号与积分管理方案](ip-studio-team-accounts-plan.md) | **v0.4 已生产发布** | 单企业归属、固定 RBAC、人工充值和积分批量分配/回收；分配积分归企业，开通沿用现有逻辑、不做企业席位（last-reviewed 2026-10-15） |
| [后台测试账号](test-accounts-plan.md) | **已生产发布** | 超管创建独立测试身份、两分钟一次性正常 OIDC 登录、停用及业务边界（last-reviewed 2026-10-17） |
| [企业积分第一批验收](ip-studio-enterprise-foundation-validation.md) | **E01–E04 测试与边界** | 企业权限、V56、钱包兼容的 H2/MySQL 验收、编译契约门及后续边界（last-reviewed 2026-10-15） |
| [企业积分前端规划](ip-studio-enterprise-ui-plan.md) | **完整管理/付款/财务界面** | Studio及财务页沿用平台组件的设计、预览确认与权限动线（last-reviewed 2026-10-15） |
| [`docs/ip-studio-libtv-alignment.md`](ip-studio-libtv-alignment.md) | **IPStudio 对标 LibTV 的原始提案与实时差距矩阵** | 首页与统一画布、助手/剧本/图片/原生视频/模板核心动线，v0.229 补回拖线引用、v0.231 模板直接复制为普通画布；多模态助手、长视频、专属声音等差距明确（last-reviewed 2026-10-10） |
| [`docs/ip-studio-assistant-context.md`](ip-studio-assistant-context.md) | **Studio 助手与画布引用** | @ / 感知画布、文档正文/本地媒体多选导入、同源素材库、图片/短视频四帧读取、对话恢复及文字快照分享/复制继续；v0.217 本地，未发布，音轨及完整视频未接 |
| [`docs/ip-studio-unified-canvas-plan.md`](ip-studio-unified-canvas-plan.md) | **AI IP Studio 统一画布产品与实施方案** | M0–M4 真实 Agnes 本地验收、M6 双集与连续制作；M5 商品/配音/同音频口型短样片通过，人物固定声音版本绑定已接，专属声音未接，M7 有限图片模板、版本/采用/归档/部分资产包本地通过；逐项验收、权限计费、兼容和 Sol 指令，未发布（last-reviewed 2026-10-09） |
| [AI 导演台完整方案](ai-director-plan.md) ★ | **v1.1 定稿；独立功能分支首版、未发布。测试响应全流程跑通；Agnes 真实出图已验，视频受厂商队列阻塞** | 三工作区、独立服务端导演作品、既有资产／声音复用、精确引用、后台连跑、分级检查、企业付款与并发边界、整集导出；§14 实现状态；末三节：出图布光、默认让位明确意图、布光传到视频、编剧与分镜规则（2026-10-28，这两节已随 `20261028-director-delete` 上线）；第二轮 review 的布光改成一段默认指导、重写台词例外写一致、出图模板第 3 版（本地未发布）（last-reviewed 2026-10-28） |
| [AI 导演台全能创作助手](ai-director-assistant.md) ★ | **本地实现，未发布；测试响应全流程跑通，本地接 qwen38-27b 实测通过（写分镜起始句与看图未实测）** | 写剧本前的有限创意对话（最多 3 轮、可跳过）；剧本 / 分镜 / 提示词 / 资产图的伴随式修改：对象绑定、按位置的局部建议、预览对比、采用前核对、撤销、分镜页剧本预览、围绕当前图生成新版本（last-reviewed 2026-10-28） |
| [AI 导演台 Claude 联合评审记录](audits/ai-director-claude-review-2026-10.md) | **方案评审记录** | Claude App 首轮意见、Codex 反驳与修正、第二轮共识、最终复核及效果验证边界（last-reviewed 2026-10-22） |
| [AI 导演台工作流详细稿](ai-director-workflow-plan.md) | **v0.2 详细附件；首版按总方案实现** | 配套总方案：后台连跑、分步写作、资产基准派生、真正首帧与宫格代表图区分、候选预算和局部恢复（last-reviewed 2026-10-22） |
| [AI 导演台 Agent 提示词](prompts/ai-director-agents-v1.md) | **提示词 v0.2；A1–A4 已改写进代码，Agnes 小样已验** | 八类职责的完整正文、输入输出；吸收 AID／ViMax 的分步创作、参考筛选和首尾帧方法（last-reviewed 2026-10-22） |
| [AI 导演台视觉与声音提示词实操稿](prompts/ai-director-visual-production.md) | **模板已用于本地首版；Agnes 出图已验，视频与声音待验** | 参考现成项目，角色／场景／道具、宫格、原生音画模板及完整例子；角色声音基准与跨片段检查（last-reviewed 2026-10-22） |
| [AI 导演台 AID／ViMax 源码对照](audits/ai-director-reference-comparison-2026-10.md) | **源码对照完成，效果未实测** | 固定提交的优点、适配边界、第一版缺口、v0.2 修订与评测要求（last-reviewed 2026-10-22） |
| [Studio 分镜编辑改造方案](ip-studio-storyboard-editing-plan.md) | **设计与实施计划，未实现** | 明确序列归属、节点内容真值、画布／分镜／AI 统一编辑、操作回执与冲突恢复、成片快照、旧项目迁移、修改文件、S0–S6 阶段与 22 项验收（last-reviewed 2026-10-22） |
| [Studio Agentic 多媒体小程序接入方案](ip-studio-miniapp-plan.md) | **方案留档，未实现** | 复用现有后端与统一身份、抽离共用项目操作核心、已有能力与设计差距、分镜联动、微信适配和首版闭环；本地源码核对，不代表线上或真机验收（last-reviewed 2026-10-22） |
| [`docs/ip-studio-conversational-video-recreation-plan.md`](ip-studio-conversational-video-recreation-plan.md) ★ | **全能创作对话驱动视频复刻 · 唯一方案真源（v4）** | 技能（仓内 `reference-video-recreation.md`）+ 连续线程 / 真流式 / 工作记录 / 转向 + 两阶段计划 + 服务端执行器（`ip_plan_execution`，提交前预算、租约、暂停只查）+ 原生 `check` 三态；S1/S2/S3 已本地实现（2026-10-18，未发布；S3 = 技能表 V63 / 后台技能页 / 多技能路由 / 蒸馏草稿），S0 付费实测待批预算；接入前两项产品问题已修（之后的追加发布到 2026-10-20 `20261020-h3-video-dialogue`；last-reviewed 2026-10-20） |
| [`docs/ip-studio-dialogue-no-continue.md`](ip-studio-dialogue-no-continue.md) | **Studio 对话去掉「继续」 · 现行设计真源** | 一句话做完：只有付费生成停下确认；删掉单轮的步数 / 调用 / 工具 / 时间 / Token 分配上限；一条消息一个 run，首笔冻结普通文本那档、不够时同一 run 追加冻结，钱包没钱才停并给充值入口；对话费用不计入制作预算；死循环先纠正再结束；单轮上下文裁剪、长文分段读、子任务最多等 10 分钟、冻结回收跳过活着的对话任务；单 run 300 次 / 2 小时隐形保险。本地实现，未发布、未用真模型验证（last-reviewed 2026-10-23） |
| [`docs/ip-studio-dialogue-intents.md`](ip-studio-dialogue-intents.md) | **Studio 对话意图直达 · 现行设计真源** | 意图 → 技能 → 一轮确认：出图 / 写剧本与文案 / 出视频三个直达技能 + 参考视频复刻；写作意图先判、路由关键词 ×2 / 素材 ×1、只有素材不选方法、平手一律不绑交给模型、按任务绑定技能；问题预算；触发评测集（§7）。已生产发布，平手句子真模型验过；2026-10-23 起不锁方法：有活跃制作时也按意图换方法，旧制作停止收尾或暂停解绑（last-reviewed 2026-10-23） |
| [`docs/ip-studio-new-canvas-and-threads.md`](ip-studio-new-canvas-and-threads.md) | **Studio 新建画布、多段对话与卡片精简 · 现行设计真源** | 新建统一走 `startNewCanvas()` 直进画布并复用没动过的空白画布、空画布引导卡；助手「新对话 / 历史对话」三个接口（无迁移）；方案与确认卡合成一张、完成总结一句话、提示词 seed v20；§5 新对话的四张填空卡（制作个人 IP / 写剧本 / 做个短视频 / 复刻视频，复刻清单并入）；§6 执行结果落到助手准备的节点（`targetNodeId` + 确认时绑定）、首帧比例不同时居中裁剪不拉伸、节点按产物比例（seed v23）。取代复刻方案 §对话形态「每张画布一段对话」那一句。2026-10-21 已生产发布 `20261021-studio-new-canvas-threads`（last-reviewed 2026-10-21） |
| [`docs/ip-studio-workflow-template-plan.md`](ip-studio-workflow-template-plan.md) | **标准画布模板与人物设定图方案** | 用户新增核心方向；含 LibTV 公开/复制画布实测、默认一次人物设定图与反推提示词，进阶独立资产/拼板；模板输入/依赖/输出/版本/套用和有限执行（last-reviewed 2026-10-08） |
| [Studio 创作首页](ip-studio-home.md) | AI IP 工作台 | 首页主要功能、近期画布与模板、同一 Studio 落点与品牌保留（last-reviewed 2026-10-08） |
| [Studio 视频模式](ip-studio-video-modes.md) | 产品 / 实施 | 原生首尾帧、全能参考、模型合同与费用校验；本地验证边界 |
| [Studio 运镜标签](ip-studio-camera-motion.md) | 产品 / 实施 | 原生面板、展开编辑器与抽屉共用命名指令、光标插入、编辑/移除及正文保存；v0.211 本地 |
| [Studio 视频特效库](ip-studio-video-effects.md) | 产品 / 实施 | 共用官方描述、本人收藏/最近/个人发布、模型筛选、点选与替换；v0.213 本地，原生供应商效果及完整社区未接 |
| [`docs/ip-studio-character-library.md`](ip-studio-character-library.md) | **Studio IP 人物库与小云雀对标** | 人物成组浏览、主图/设定图/视角/声音、免费归类、精确版本引用和浏览器验收；V45，本地未发布（last-reviewed 2026-10-08） |
| [个人资产库与快速编辑方案](ip-studio-personal-asset-library-plan.md) | **实际产品方案，已生产发布** | 贴合现有 `/assets`、画布、人物详情及剧本素材面板；提取/快速完善不进一级导航；自动归集与跨画布引用（last-reviewed 2026-10-11） |
| [个人资产库可交互原型](../prototypes/asset-library/README.md) | **停止迭代，不作为正式产品设计依据** | 独立本地演示，未接生产；用户改为评审实际产品方案；[演示边界](prototypes/asset-library-validation.md)（2026-10-11） |
| [`docs/prompts/ip-character-sheet.md`](prompts/ip-character-sheet.md) | **人物设定图一次出图提示词** | 用户附图版式拆解、可换人物的提示词与整图参考出单独镜头；反推词，不称作者原词（last-reviewed 2026-10-08） |
| [平台后台模型管理接入](platform-model-management.md) | 模型管理 | 视频模型目录的智能优化开关、`endpointProbe` 读厂商目录、Studio 选模型走端点合同 |
| [模型类型与应用开放范围](model-access-policy.md) | 模型管理 | 端点多类型标签 + 全部 / 指定应用开放，存于 `platform_config` 的 `ai.model-access.<endpointId>` |
| [Studio 聚算模型配置](ip-studio-jusuan-models.md) | 模型管理 | Studio 文本 / 图片 / 视频只走聚算，端点与可选范围由后端管，浏览器不持密钥（2026-10-10） |
| [Studio 平台配音定价接入](studio-platform-pricing.md) | 计价 | 配音发布价读取、任务价格快照与采用回执；动作 `studio.speech`，按秒 |
| [Studio 邀请页：既有设计系统核对](prototypes/studio-invitation-design-system-check.md) | 设计 | 邀请页设计稿对照 Studio DESIGN.md / PRODUCT.md 的核对；只是设计稿，不代表线上（2026-10-17） |

**其他设计与参考**

- [资产库独立设计原型](../prototypes/asset-library/README.md)：[设计方向](prototypes/asset-library-direction.md)、[设计检查](prototypes/asset-library-design-check.md)与[原型验证](prototypes/asset-library-validation.md)；静态原型，与业务代码分离（last-reviewed: 2026-10-17）。
- [导航与内容组织定稿](studio-information-architecture.md)、[设计图片](studio-v3-design-review.md)、[UI规格](studio-commerce-ui-design.md)、[开发任务](studio-commerce-development-tasks.md)、[现状审计](audits/studio-commerce-current-page-audit-2026-10.md)：设计与剩余任务（last-reviewed: 2026-10-16）。
- Studio 对话快照分享 v0.217：见 [助手范围](ip-studio-assistant-context.md) 与统一验证§28；last-reviewed: 2026-10-08，本地未发布。
- [模型接入端点并发与排队](ai-endpoint-generation-queue.md) · v0.220；last-reviewed: 2026-10-09，本地未发布。
- [AiAvatar 账号与旧 Studio 界面统一](aiavatar-account-unification.md) · v0.230 桌面外壳、旧深链兼容与验收边界；last-reviewed: 2026-10-10。
- [复刻创作：全片创作拆解与视频拉片](ip-studio-recreation.md)：视频入口、报告契约、分段裁切、逐段Markdown及恐龙视频验收。last-reviewed: 2026-10-15。
- [视频拉片操作手册](training/studio-film-study.md)：6步实操截图，覆盖开始、进度、播放、文档编辑与导出。last-reviewed: 2026-10-15。
- [企业生成入口与扣费引用](ip-studio-enterprise-generation-entry-map.md)

**账号中心对接**：接入 SOP 见 [`aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md`](../../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md)， §7.9 / §10.6 包含资料来源、手机号读取、后台搜索、分页、换绑、存量补齐与本地重启验收（last-reviewed 2026-10-10）。

## 2. 工程协议（"代码该怎么写"）

| 文档 | 给谁看 | 一句话 |
|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | **统一 agent 入口** | 项目概览 + 三端架构 + 硬规则 + 新增领域 SOP + 排障纪律 + 文档同步纪律 |
| [`CLAUDE.md`](../CLAUDE.md) | Claude Code（自动注入） | **symlink → AGENTS.md**，不要单独改 |
| [`docs/VERSION_HISTORY.md`](VERSION_HISTORY.md) | 查某一版改了什么 | v0.5 → v0.201 连续增量日志；`grep '^### v0.XXX'` 直达 |
| [`apps/miniprogram/agent.md`](../apps/miniprogram/agent.md) | 在小程序目录工作的 agent | 微信平台坑 |
| [`apps/server/src/main/resources/db/migration/README.md`](../apps/server/src/main/resources/db/migration/README.md) | 要加 Flyway 迁移的人 | **编号横跨 SQL 与 Java 两个目录**，必须一起数 |
| [`apps/web-aiavatar/src/canvas-bridge/README.md`](../apps/web-aiavatar/src/canvas-bridge/README.md) | 改画布的人 | vendored 画布与本仓之间的胶水；搬来的文件少改、改了留注释 |
| [`data/drama-recipes/README.md`](../data/drama-recipes/README.md) | 改短剧官方配方的人 | bundle 是真值，seed 与封面是派生物，改完跑 `build-seed` |
| [`apps/design.md`](../apps/design.md) + `apps/design/` | 前端设计 token 契约 | 三套主题的设计稿 reference app |
| [`.claude/skills/figma-migrate/SKILL.md`](../.claude/skills/figma-migrate/SKILL.md) | 触发 figma-migrate 时 | ⚠️ 全篇以已删除的 `apps/web` 为目标，重新启用前要先 retarget |

## 3. 接口契约（"前后端怎么对齐"）

| 文档 | 用途 |
|---|---|
| [`specs/README.md`](../specs/README.md) ★ | 契约索引：openapi 与 BUSINESS_RULES 的分工、path 分组、CI 守门、wire 命名规范 |
| [`specs/openapi.yaml`](../specs/openapi.yaml) | **唯一接口契约**（约 650 paths）。CI：`pnpm check:api-contract` |
| [`specs/BUSINESS_RULES.md`](../specs/BUSINESS_RULES.md) | openapi 表达不了的：字段校验 / 计算公式 / 状态机 / 错误码 |
| [`specs/impersonation.openapi.yaml`](../specs/impersonation.openapi.yaml) | 附身登录的机器可读补充契约 |

新增 / 修改接口：先改 `packages/types`（真源）→ 后端 `*Dto` → `specs/openapi.yaml` → CI 自动验。`/api/mixcut/*` 用 snake_case wire 是唯一例外，见 web-celebrity PRODUCT.md「混剪专区」。

## 4. 服务端与共享层

| 文档 | 一句话 |
|---|---|
| [`apps/server/README.md`](../apps/server/README.md) | Spring Boot 8080：profile / 角色体系 / 数据模型（含 dap、clip、ipstudio 各域）/ 环境变量 / 版本日志 |
| [`apps/server/src/main/resources/fonts/README.md`](../apps/server/src/main/resources/fonts/README.md) | picgen 中文字体目录，为空也能跑 |
| [`apps/sau-service/README.md`](../apps/sau-service/README.md) · [`REAL_MODE.md`](../apps/sau-service/REAL_MODE.md) | 社交代发 worker：默认 mock；真 Playwright 路径怎么开 |
| `packages/types` · `packages/ui` · `packages/api-client` · `packages/landing` | 共享层，暂无独立 README；用法见各 PRODUCT.md「组件分层」段 |

## 5. 部署 / 运维 / 联调手册

| 文档 | 用途 |
|---|---|
| [Studio JSON 的 JVM-Sandbox 临时热修复](runbooks/studio-json-jvm-sandbox.md) | 不重启的单方法异常恢复、隔离验证、冻结 / 激活 / 卸载与回退；官方 1.4.0、环回管理、无模型或账本调用（last-reviewed 2026-10-24） |
| [`docs/runbooks/cost-pricing-feishu.md`](runbooks/cost-pricing-feishu.md) | 飞书供应商/模型/规格成本核算、积分自动计算、AI 维护与系统配置映射；「快速定价」页输入报价直接出积分价；未知报价留空，表格更新不等于生产发布（2026-10-25） |
| [`docs/runbooks/credit-reconciliation-agent.md`](runbooks/credit-reconciliation-agent.md) | 定时 agent 盯线上积分消耗与账本对账：只读脚本 `scripts/ops/credit-reconcile.sh`、九项硬性对账口径、报告格式与红线（2026-10-26） |
| [`infra/README.md`](../infra/README.md) ★ | 阿里云 ECS + RDS + OSS 部署**单一真值源**：拓扑、环境拉起 SOP、env / nginx / systemd 索引、§5 vhost 与证书硬规则 |
| [`.claude/skills/aliyun-deploy/SKILL.md`](../.claude/skills/aliyun-deploy/SKILL.md) | agent 部署技能：本地 artifact / 按应用 / GitHub Actions 三条链路 + 验证排障 |
| [`infra/rds/README.md`](../infra/rds/README.md) · [`infra/oss/README.md`](../infra/oss/README.md) | RDS 创建 / 白名单 / Flyway baseline；OSS Bucket / CDN / RAM / 生命周期 |
| `infra/scripts/update-and-deploy.sh` · `install-host-deps.sh` · `check-runtime-env.sh` · `install-cjk-fonts.sh` | ECS 一键更新、宿主依赖、runtime env 预检、中文字体 |
| [`docs/runbooks/alipay-sandbox.md`](runbooks/alipay-sandbox.md) | 支付宝直连沙箱本地联调：拿凭证 → 配置 → 查单兜底 / 公网回调 → 上生产换 4 项 |
| [`docs/runbooks/impersonation.md`](runbooks/impersonation.md) | 附身登录：管理员以用户身份进五个产品的工作台 |
| [`docs/runbooks/studio-e2e-cases.md`](runbooks/studio-e2e-cases.md) | Studio 端到端测试用例：发布前按真实路径逐步读 DOM 状态；含待随下次发布一起测的场景（last-reviewed 2026-10-19） |
| [`infra/vendor/platform-sdk/README.md`](../infra/vendor/platform-sdk/README.md) | Java SDK 固定 release 的制品来源、SHA256 和 CI/部署安装路径；新 runner 无需跨私有仓认证（last-reviewed 2026-10-10） |

## 6. 审计 / 调研（带日期的一次性报告，写完不再改）

| 文档 | 结论一句话 |
|---|---|
| [`docs/audits/drama-audit-2026-07.md`](audits/drama-audit-2026-07.md) | web-drama 产品 × 架构审计：一致性引擎五层架构 + C 序列路线图；后续全部由 [`drama-consistency-engine-design.md`](drama-consistency-engine-design.md) 落地 |
| [导演台剧本文件导入验收](audits/director-script-file-import-validation-20261025.md) | Word/PPT/PDF/文本提取、两个入口、预览确认、保存刷新与扫描件失败；本地未发布（2026-10-25） |
| [`docs/audits/payment-billing-audit-2026-07.md`](audits/payment-billing-audit-2026-07.md) | 支付 / 计费 / 积分账本全栈审计：33 项 Findings、决策台账 D1–D8、T1–T17 任务卡 |
| [`docs/audits/admin-alignment-audit-2026-06.md`](audits/admin-alignment-audit-2026-06.md) | admin ↔ server ↔ 子应用三端对齐审计：10 项全部处置；文末「长期防 drift 约定」仍有效 |
| [`docs/audits/face-beauty-research-2026-06.md`](audits/face-beauty-research-2026-06.md) | 形象精调 / 美颜方案调研：浏览器端确定性美颜（已采纳）vs 云 API vs i2i |
| [`docs/audits/form-control-focus-audit-2026-10.md`](audits/form-control-focus-audit-2026-10.md) | 全仓输入、下拉、文本域与组合控件的重复聚焦框检查：焦点归属修复、74 项组件回归；代码已发布（2026-10-17） |
| [`docs/audits/ip-studio-ui-audit-2026-10.md`](audits/ip-studio-ui-audit-2026-10.md) | Studio 画布界面与交互审查：区域分离、人物选择统一、三档宽度响应式（2026-10-08，v0.206） |
| [`docs/audits/studio-commerce-current-page-audit-2026-10.md`](audits/studio-commerce-current-page-audit-2026-10.md) | 线上 Studio 页面与带货分发现状核对，是导航定稿和剧情带货开发任务的依据（2026-10-16） |
| [`docs/audits/unified-account-referral-astra-review-2026-10.md`](audits/unified-account-referral-astra-review-2026-10.md) | `gpt-6-astra` 对统一账号邀请链 v0.2 方案的独立评审与风险记录；v0.3 未复审（2026-10-17） |
| [`docs/audits/unified-identity-sop-audit-2026-10.md`](audits/unified-identity-sop-audit-2026-10.md) | 统一认证发布与跨应用 SOP 复核：资料、后台、竞态修复与既有缺口（2026-10-10） |
| [`docs/audits/studio-film-study-technical-sharing-2026-10.md`](audits/studio-film-study-technical-sharing-2026-10.md) | 视频拉片技术分享：媒体工程、模型理解、成本与音频补全，程序和大模型各管什么（2026-10-17） |
| [`docs/audits/studio-local-full-e2e-20261019.md`](audits/studio-local-full-e2e-20261019.md) | 本地全站验收与逐项复测：Agnes真实拉片/流式、受控制作与企业账本；10-20补过本机上传、双浏览器三种冲突恢复及任务回写，保留其余失败/待复测和真实视频队列阻塞 |
| [`docs/audits/studio-user-journey-acceptance-20261019.md`](audits/studio-user-journey-acceptance-20261019.md) | 线上只读的用户视角验收：文字落画布、复刻检查口径、成片默认片段等待办（2026-10-19，后续见 TODO） |
| [`docs/audits/web-aiavatar-test-suite-audit-2026-10.md`](audits/web-aiavatar-test-suite-audit-2026-10.md) | web-aiavatar vitest 审计：耗时来自 jsdom 并发争用而非条数；限并发 + 假计时器 + 1056→963 条（2026-10-20，已实施） |

## 7. 发布与验收记录（`docs/releases/`）

- [导演台作品删除生产发布](releases/director-delete-production-release-20261028.md)：main `cb9190489`，server + web-aiavatar；146 条后端、65 条前端及一次性 MySQL 删除并发 11 条通过，线上确认/取消与不存在状态验收，未删除生产作品（last-reviewed 2026-10-28）。

- [Studio JSON 的 JVM-Sandbox 无重启热修复](releases/studio-json-jvm-sandbox-release-20261025.md) — 干净 main 制品、Java 17 / Dragonwell 隔离验证、原生产 PID 内激活、44 次健康采样与卸载回退；last-reviewed: 2026-10-25。

- [Studio 图片系列与分辨率路由发布](releases/studio-image-resolution-release-20261025.md)：干净 main `feb6e4e0`，server / web-aiavatar 制品与线上指纹核对；当前仅 GPT Image 2 的 1K/2K 已配置，其他系列、4K 及真实出图待验（last-reviewed 2026-10-25）。
- [积分切换到 1 元 = 100 积分](releases/credit-ratio-switch-20261026.md)：有成本数据的售价按新比率上线（图片、视频、配音、口型、短剧分镜），停月赠送，服务端 `20261026-credit-ratio`；套餐与文本 Token 价待后台修改（last-reviewed 2026-10-26）。
- [AI 导演台操作失败弹窗与资产解除关联](releases/director-error-dialog-unlink-validation-20261027.md)：操作失败统一弹错误弹窗（操作、原因、下一步、错误详情），删除被引用资产列出片段并能前往，片段「关联资产」加「解除关联」，台词说话人算引用；第二轮统一 Studio 其他页面的错误出口（主动操作弹窗、后台提示），慢供应商验收出视频时解除被拒，修 main 上两条红测试（last-reviewed 2026-10-27）。
- [Studio 错误弹窗与资产解除关联发布](releases/director-error-dialog-unlink-production-release-20261027.md)：`20261027-studio-error-dialogs`（server / web-aiavatar，main `4a9b5f18`）；线上用测试数据验了真实冲突与真实 404 的弹窗（桌面 / 手机），重启窗口 API 502 约 20 秒（last-reviewed 2026-10-27）。
- [Studio 桌面页面布局与交互审计修复发布](releases/studio-layout-audit-production-release-20261027.md)：`20261027-studio-layout-audit`（server / web-aiavatar，main `7feed0ab`）：画布浮层让位、导演台标题栏与提示浮层、首页入口去重与「制作个人 IP」直达、「敬请期待」、V69.1 本地 H2 兼容（last-reviewed 2026-10-27）。
- [AI 导演台分镜页重写入口发布](releases/director-storyboard-rewrite-production-release-20261027.md)：`20261027-director-storyboard-rewrite`（server / web-aiavatar，main `e6e5a2ea`）+ `20261027-director-rewrite-credit-copy`（只发 web-aiavatar，`a0481b1c`，弹窗去掉文字任务积分上限）；线上只读验收，真的重写待用户首次使用（last-reviewed 2026-10-27）。
- [AI 导演台分镜页重写入口与一键制作无反应](releases/director-storyboard-rewrite-validation-20261027.md)：分镜页整集「重写分镜脚本」（默认保留片段逐段重写）与片段「重写」，一键制作没有可做的步骤时说明原因，本集摘要改多行；测试模式真实页面 13 步、真模型重写与失败退款、摘要与窄屏验收，本地未发布（last-reviewed 2026-10-27）。
- [AI 导演台文字积分展示修复](releases/director-text-credit-display-release-20261026.md)：文字按钮不展示不确定积分数字，按任务输出上限冻结、按真实 Token 结算；图片和视频确定报价不变（last-reviewed 2026-10-26）。
- [Studio H3 视频提示词智能优化发布](releases/studio-h3-prompt-optimize-production-release-20261027.md)：`20261027-studio-h3-optimize`（server / web-aiavatar，main `384dfe31`），画布卡片「智能优化」按钮（H3 默认开）与创作助手出 H3 视频先按官方写法优化，检查只提示不拦人、导演台同步不拦人；Codex 两轮评审 + 两轮浏览器端到端，线上只读验收，整条付费链路待首次出片确认（last-reviewed 2026-10-27）。
- [AI 导演台 H3 视频提示词改写发布](releases/director-h3-video-prompt-production-release-20261027.md)：`20261027-director-h3-prompt`（server / web-aiavatar，main `4c1db522`），H3 片段提交前按 MiniMax 官方 skill 改写成英文、台词由代码填；Codex 两轮评审阻塞项已修，线上只读验收，整条付费链路待用户首次出片确认（last-reviewed 2026-10-27）。
- [AI 导演台资产关联与上传](releases/director-asset-link-production-release-20261026.md)：`20261026-director-asset-link`（server / web-aiavatar，main `27356289`），资产从剧本提取后可「关联已有资产」（`asset.link`）或「上传图片」，角色也上传即用；去掉批量导入，添加资产选集；Codex 评审 4 项 P2 已修，本地走查与线上只读验收（last-reviewed 2026-10-26）。
- [AI 导演台文本模型选择与剧名同步](releases/director-text-model-production-release-20261026.md)：`20261026-director-text-model`（server / web-aiavatar，main `16a1b61d`），作品可选文本模型（不展示文字积分数字、按任务输出上限冻结）、新剧本采用后同步作品名、重写剧本整块加载态；线上只读验收（last-reviewed 2026-10-26）。
- [AI 导演台图片模型比例过滤与大图缩放](releases/director-image-viewer-production-release-20261026.md)：`20261026-director-image-viewer`（server / web-aiavatar，main `faee1ac3`），只开放三种比例都能出的图片模型、旧选择照存原价，大图可缩放拖动并给 `@rc-component/image` 打补丁；本地走查 27 项与线上只读验收（last-reviewed 2026-10-26）。
- [Studio 图片分档配置](releases/studio-image-tiers-config-20261025.md)：GPT Image 2 / 2.5（flare）的 1K/2K/4K 端点、规格与分档售价已上生产配置，前台模型接口回读一致；未做付费出图实测，界面名待下次发版（last-reviewed 2026-10-25）。

- [Studio 普通文字文档编辑发布](releases/studio-text-document-release-20261022.md)：画布／故事板展开使用统一富文本文档；main `bd3a9df2`、105 项回归及线上保存／刷新验收（2026-10-22，last-reviewed）。

- [Studio 节点操作合并发布](releases/studio-node-editor-actions-release-20261022.md)：移除独立小操作条，编辑按钮单行排列，左键编辑、右键菜单；main `cf91ae0e`、121 项回归及线上 UI 验收（2026-10-22）。

- [模型用量归属与多模态统计生产发布](releases/model-usage-attribution-production-release-20261021.md)：main `3782da88`、server/admin 制品、142 项后端测试、线上未归属筛选与模态汇总验收及历史数据边界（2026-10-21）。

上线制品、线上验收与本地实施验收的证据，写完基本不再改。现行设计以 §1 的真源为准。

| 文档 | 主题 | 内容与状态 |
|---|---|---|
| [`docs/releases/studio-recreation-release-20261018.md`](releases/studio-recreation-release-20261018.md) | 全能创作复刻 S1/S2/S3 生产发布记录 | 发布 `20261018-studio-recreation-s1s3`（c6f40808）：基线核对与合并、V60–V63 迁移、技能 seed、verify 全绿、上线后配置项与未验证范围；之后每次追加发布记在同一份，最近一次是 2026-10-20 第一次从 main 发的 `20261020-studio-main-h3-conflict`（last-reviewed 2026-10-20） |
| [`docs/releases/studio-gpt-image-native-20261020.md`](releases/studio-gpt-image-native-20261020.md) | Studio GPT Image 2 原生接入与验收 | 2K、参考图 multipart、尺寸选择与 30 积分定价；尺寸不符在扣费前拒绝（last-reviewed 2026-10-20） |
| [`docs/releases/studio-node-settings-20261020.md`](releases/studio-node-settings-20261020.md) | Studio 节点配置交互统一 | 底栏摘要、分组浮层、可视比例与各创作节点统一；已发布 web-aiavatar（last-reviewed 2026-10-20） |
| [统一账号邀请 · 本地验收](releases/unified-account-referral-validation-20261017.md) | 两仓范围、ID/Studio 闭环、账号与共享 SDK/前端回归、MySQL、浏览器截图及发布边界 | 发布前本地证据；首版已发布、线上闭环待完成（last-reviewed 2026-10-17） |
| [统一账号邀请 · 首版发布](releases/unified-account-referral-production-release-20261017.md) | 两仓 SHA、CI、制品、V12、备份、账号释放及已验/待验范围 | 首版上线，完整线上验收待品牌入口修正（2026-10-17） |
| [统一认证手机号与后台搜索发布验收](releases/identity-phone-release-20261010.md) | `/userinfo` 完整手机号副本、服务端跨分页搜索、指定存量账号补齐、权益不变及账号中心 SOP 更新 | server/admin 已上线；46 项专项测试与真实线上 UI 通过（last-reviewed 2026-10-10） |
| [`docs/releases/ip-studio-ui-release-20261010.md`](releases/ip-studio-ui-release-20261010.md) | Studio 生产发布 | 统一界面与独立品牌更新的代码 SHA、发布包、备份、线上资源校验与视觉验收；当前前端 `fb4502a2`（last-reviewed 2026-10-10） |
| [Studio 节点交互发布](releases/ip-studio-node-release-20261011.md) | 素材上传、故事板、文本 AI 改稿与视频错误映射的发布/验收 | 2026-10-11 |
| [企业积分生产发布](releases/ip-studio-enterprise-production-release.md) | **f068b51d · 已开启** | 三服务发布、V56–V58、线上页面与存量钱包/账本/开通核对、备份及回退边界（last-reviewed 2026-10-15） |
| [企业积分第一批验收](releases/ip-studio-enterprise-foundation-validation.md) | **E01–E04 测试与边界** | 企业权限、V56、钱包兼容的 H2/MySQL 验收、编译契约门及后续边界（last-reviewed 2026-10-15） |
| [企业群发邀请实现与验收](releases/ip-studio-enterprise-invitation-validation.md) | **已生产发布** | 90 天/一年可多人分享链接、品牌短信注册加入、V59 旧邀请清理与权限边界（last-reviewed 2026-10-17） |
| [企业邀请与测试账号生产验收](releases/ip-studio-enterprise-invitation-production-release-20261017.md) | **d8195896 · 已上线** | 同链接双成员入企、后台测试账号创建/入口/停用、V59、制品与清理；无需真实短信（last-reviewed 2026-10-17） |
| [企业积分完整交付验收](releases/ip-studio-enterprise-complete-validation.md) | **E07–E12 本地结果** | 18个产品场景、真实页面资金核对、任务恢复、测试与发布边界（last-reviewed 2026-10-15） |
| [企业积分第二批验收](releases/ip-studio-enterprise-points-validation.md) | **E05–E06 测试与边界** | 划拨、人工财务、原充值来源、H2/MySQL及真实浏览器交易验收（last-reviewed 2026-10-15） |
| [全能创作生产验收](releases/ip-studio-assistant-production-acceptance.md) | **生产发布与真实生成验收** | 简化面板、文字采用、跨步骤节点依赖、六个旧测试修复；真实文字→图片→5秒视频，231积分，刷新与原节点复用通过（last-reviewed 2026-10-13） |
| [`docs/releases/ip-studio-unified-canvas-validation.md`](releases/ip-studio-unified-canvas-validation.md) | **统一 Studio 真实 Agnes 与确定性验证记录** | 样例与真实证据分开；三镜/双集/商品包装媒体、平台积分、恢复与下载、测试/构建/手机检查，以及声音和生产未验收边界（last-reviewed 2026-10-09） |
| [管理明细与 Prompt 保存后续修复](releases/admin-pagination-prompt-cas.md) | 运营后台 | 用量明细库内分页与固定 asOf、Prompt 保存并发保护（2026-10-13） |

- [项目卡片生产发布](releases/studio-project-cards-release-20261017.md)：真实内容预览、固定／自动封面、上线制品及真实浏览器验收；已发布（last-reviewed: 2026-10-17）。
- [生产发布记录](releases/studio-workspace-production-release-20261017.md)：全部改动提交、server/web-aiavatar 制品与线上验收及浏览器限制；已发布（last-reviewed: 2026-10-17）。
- [实施与验收](releases/studio-workspace-refactor-validation.md)：七项导航、独立项目、模板画布、IP资产合并、存量账号/记录复用及【待建设】边界；代码已发布（last-reviewed: 2026-10-17）。
- [Studio 生产发布与计价](releases/ip-studio-production-release.md) · v0.228 定价快照、V48 迁移及上线记录；last-reviewed: 2026-10-10。
- [个人资产库闭环验收](releases/ip-studio-asset-library-validation.md) · 剧本内提取、快速完善与新画布引用；本地与生产验收通过，含 V52 和发布制品记录；last-reviewed: 2026-10-11。
- [Studio原声提取发布](releases/studio-source-audio-release-20261017.md)：本次提交与制品、用户视频的已有媒体结果、直接发布及未追加业务验收边界。last-reviewed: 2026-10-17。
- [企业产品场景端到端验收](releases/ip-studio-enterprise-scenario-acceptance.md)
- [企业发布准备与回退](releases/ip-studio-enterprise-release-readiness.md)
- [企业完整界面验收](releases/ip-studio-enterprise-ui-validation.md)
- [视频解析与拉片生产发布](releases/studio-film-study-production-release.md)：版本、独立媒体运行时、验收范围与备份。
- [项目与灵感统一封面验收](releases/studio-shared-covers-validation-20261017.md)：共用优先级、独立上传、恢复自动、权限与本地检查；已发布 a4092626（last-reviewed: 2026-10-17）。
- [统一画布封面生产发布](releases/studio-shared-covers-production-20261017.md)：a4092626 两服务上线、真实封面验收与回退；已发布（last-reviewed: 2026-10-17）。
- [画布分组说明与复刻模板精简](releases/studio-group-description-validation-20261017.md)：Group 说明的编辑/预览/只读查看、模板与副本保留说明、官方复刻模板 v3；已发布 ccbff781（last-reviewed: 2026-10-17）。
- [视觉显存错误受控降级验收](releases/studio-vision-memory-fallback-validation-20261017.md)：只在聚算 Qwen 返回 400 `unsupported_geometry`（HBM 预算）时，原尺寸两帧一批读取并完成原任务；2026-10-19 合入 main，排在线上缩图降档之后，未发布（last-reviewed: 2026-10-19）。
- [Seedance 2.0 接入与生产发布](releases/studio-seedance-2026-10-14-release.md)：初次端点视频协议、仅对 studio 开放、H3 仍为默认（2026-10-14）；旧供应商模型下架后的 [OneToken Seedance 2.0 / 2.5 生产配置](releases/onetoken-seedance-models-production-config-20261026.md) 已恢复两条可选模型，并按采购成本加价 60% 把 720p 售价设为 94 / 146 积分/秒，H3 继续默认（2026-10-26）。
- [视频模型按开放范围生效](releases/studio-model-scope-2026-10-14-release.md)：录入模型并配置开放范围即可在 Studio 选择，取消二次候选（2026-10-14）。
- [图片上传与模型 404 修复](releases/studio-upload-chat-repair-20261016.md)：相机原图自动压缩、模型 404 修复；已发布（2026-10-16）。
- [创作输入框修复](releases/studio-prompt-ime-release-20261017.md)：中文输入法组词时占位提示重叠；已发布 dd228379（2026-10-17）。
- [生成付款默认设置](releases/studio-billing-default-release-20261017.md)：未加入企业的账号直接用个人积分；已发布 a2221b9a（2026-10-17）。
- [图片压缩与全仓输入控件修复](releases/studio-images-and-controls-release-20261017.md)：16 张界面配图压缩 96.95%、输入控件热修；已发布（2026-10-17）。
- [视频节点暖白配色发布](releases/studio-video-node-warm-production-20261017.md)：2011deda 上线记录（2026-10-17）。
- [助手正文字体统一](releases/studio-body-font-release-20261017.md)：助手面板改用共享正文字体；已发布（2026-10-17）。
- [官方内容管理页展示修复](releases/studio-demos-layout-release-20261018.md)：`/projects/demos` 手机布局修复，仅发布 web-aiavatar（2026-10-18）。
- [正式模型与旧入口兼容修复](releases/production-model-compat-20261020.md)：数字资产与短剧统一 GPT、正式文本与真实视频采样分析、旧计费保留及发布验收（2026-10-20）。
- [Studio 生产问题五项修复](releases/studio-prod-fixes-20261020.md)：原创创作技能、节点规格贯通、`<studio-actions>` 协议、真实看图、失败节点恢复；含 Agnes 下架后六个用途的兼容性检查（2026-10-20）。
- [创作助手对话动静与快捷答复](releases/studio-assistant-dialogue-ux-validation-20261020.md)：进行中提示、快捷答复直接发送、图标化回复操作、工作记录改为过程行；本地验收记录（2026-10-20）。
- [创作助手对话动静发布](releases/studio-assistant-activity-release-20261020.md)：`20261020-studio-assistant-activity`（8b408533）上线记录，仅 web-aiavatar（2026-10-20）。

## 8. 待办与归档

| 文档 | 用途 |
|---|---|
| [`TODO.md`](../TODO.md) ★ | 已定位未修的问题 + 候选排期，**只留还有未勾项的段**；维护纪律见 AGENTS.md §9 |
| [模型额度初始设计](archive/model-scoped-credits-initial-design.md) | 已被接入点赠款与折扣设计取代；旧分场景、第二套标准价和供应商资源方案仅供历史追溯（last-reviewed 2026-10-25） |
| [`docs/archive/todo-closed.md`](archive/todo-closed.md) | 从 TODO.md 整段移出的已关闭段（条目原样保留） |
| [TODO 历史记录 · 2026-10-13](archive/todo-2026-10-13.md) | 整理前完整快照、已完成记录、过时状态核对与重复条目去向；当前排期以根目录 TODO 为准（last-reviewed 2026-10-13） |
| [`docs/archive/ip-studio-generalize-proposal.md`](archive/ip-studio-generalize-proposal.md) | IP 工作台「一个提示词框 + 模板库」提案，v0.153 已落地；留「为什么改」 |
| [`docs/archive/aiavatar-asset-platform-plan-2026-07.md`](archive/aiavatar-asset-platform-plan-2026-07.md) | 2026-07 数字资产平台定位分析，被 asset-hub-redesign 取代 |
| [`docs/archive/material-ops-ai-text-plan.md`](archive/material-ops-ai-text-plan.md) | 素材运营文本三件接真 LLM，v0.40 已落地 |
| [`docs/archive/aiavatar-progress-2026-05.md`](archive/aiavatar-progress-2026-05.md) | 首版 AiAvatar 实施台账；文中 `aiavatar_*` 表已删（V8），只作历史 |
| [`docs/archive/ip-studio-enterprise-development-tasks.md`](archive/ip-studio-enterprise-development-tasks.md) | Studio 企业积分 E01–E12 开发任务与验收标准，已全部上线；现行真源 [`ip-studio-team-accounts-plan.md`](ip-studio-team-accounts-plan.md) |

---

## 常见问答路径

| 我要做的事 | 入口 |
|---|---|
| 给 admin 加新页面 | [`apps/admin/README.md`](../apps/admin/README.md) → [`ADMIN_PRODUCT_SPEC.md`](ADMIN_PRODUCT_SPEC.md) → `apps/admin/src/constants/nav.ts` |
| 修小程序 bug | [`apps/miniprogram/agent.md`](../apps/miniprogram/agent.md)（必读平台坑）→ [`README.md`](../apps/miniprogram/README.md) |
| 给某子应用加页面 / 模块 | 对应 `apps/<sub>/PRODUCT.md` → 改路由 sidebar → 写组件 → 改业务规格 |
| 加新接口 | `packages/types` 改字段 → server `*Dto` → `specs/openapi.yaml` → `pnpm check:api-contract`；详见 [`AGENTS.md` §5](../AGENTS.md) |
| 加 Flyway 迁移 | [`db/migration/README.md`](../apps/server/src/main/resources/db/migration/README.md)：两个目录一起数，已执行的一律不改 |
| 改 drama 界面文字 | 先查 [`drama-ux-copy-pass.md` §2](drama-ux-copy-pass.md) 术语表；要新叫法先改表再改代码 |
| 改画布（web-aiavatar / web-drama） | [`ip-studio-plan.md`](ip-studio-plan.md) / [`drama-canvas-plan.md`](drama-canvas-plan.md) → `src/canvas-bridge/README.md` |
| 看 AI 明星带货某功能怎么实现 | [`product_spec_ai_celebrity.md`](../product_spec_ai_celebrity.md) → `apps/server/.../aep/service/` |
| 看混剪专区怎么实现 | [`apps/web-celebrity/PRODUCT.md` §5](../apps/web-celebrity/PRODUCT.md) → `apps/server/.../service/mixcut/` |
| 部署到生产 | [`aliyun-deploy/SKILL.md`](../.claude/skills/aliyun-deploy/SKILL.md) → [`infra/README.md`](../infra/README.md) |
| 接统一账号中心 / 查 403 开通问题 | [`unified-identity-plan.md` §12](unified-identity-plan.md) → `EnrollmentGuard` / `PhoneVerificationGuard` |
| 本地联调支付 | [`runbooks/alipay-sandbox.md`](runbooks/alipay-sandbox.md) |
| 查某一版改了什么 | `grep '^### v0.XXX' docs/VERSION_HISTORY.md` |

## 维护规则

- **加新文档**：按顶部「目录约定」选位置，同 commit 在本 INDEX 加一行。
- **删 / 归档旧文档**：先 `git grep -n '<filename>'`（**代码注释也会引文档路径**，不要只扫 `*.md`）改指真源；归档的在文件顶部加「已归档 + 现行真源」一行。
- **大版本迭代**：同 commit 更新 `product_spec*.md` 版本节、受影响 `apps/*/README.md` + `PRODUCT.md`、`docs/VERSION_HISTORY.md`（`AGENTS.md` §7 只留最近 5 版速览）、本 INDEX 的 last-reviewed。详 [`AGENTS.md` §9](../AGENTS.md)。
- **CLAUDE.md ↔ AGENTS.md**：CLAUDE.md 是 symlink，改 AGENTS.md 即同步两者。

- [Studio 对话意图直达真模型验收](releases/studio-dialogue-intents-validation-20261020.md) — §7 评测集用聚算 Qwen3.8 27B / Agnes 2.5 Flash 真跑，图片画幅契约修复，未确认出图；last-reviewed: 2026-10-20。
- [Studio 对话意图直达生产发布](releases/studio-dialogue-intents-release-20261020.md) — release `20261020-studio-dialogue-intents`（main `eea08f72`，server + web-aiavatar）、合并取舍、门禁、线上验收与回滚；last-reviewed: 2026-10-21。
- [Studio 新建画布、多段对话与卡片精简生产发布](releases/studio-new-canvas-threads-release-20261021.md) — release `20261021-studio-new-canvas-threads`（main `c6f67b7b`，server + web-aiavatar）、门禁、线上验收与回滚；热修 `20261021-studio-action-format`（main `6b089c8b`，只发 server：工具调用写成正文）；web 热修 `20261021-studio-create-page`（main `0222df1a`，只发 web-aiavatar：`/create` 改回页面，最上面「新建画布」卡片）；last-reviewed: 2026-10-21。
- [Studio 视频节点铺满与抽帧发布](releases/studio-video-fit-frames-release-20261021.md) — release `20261021-studio-video-fit-frames`（main `13553ee7`，只发 web-aiavatar）：视频节点按视频比例铺满、抽帧、右键「素材拆解」报错修复；门禁、验收边界与回滚；last-reviewed: 2026-10-21。

- [图片受理未知与执行名额修复](releases/studio-image-review-release-20261022.md) — 未知图片状态提示、并发准入与存量冻结保护；last-reviewed: 2026-10-22。

- [超管直接发放积分](releases/super-admin-credit-grant-release-20261022.md) — 超管直接发放与本人历史待审单批准、其他角色独立复核、原单防重复入账；last-reviewed: 2026-10-22。

- [Studio 对话用量中断与继续回放](audits/studio-dialogue-continuation-replay-2026-10.md) — 线上原始记录、精确用量回放、确认继续和格式兼容；2026-10-23 已生产发布，见[线上验收](releases/studio-dialogue-recovery-release-20261023.md)。

- [Studio 消息发送恢复上线验收](releases/studio-message-delivery-release-20261023.md) — 请求/回执丢失自动核对、同编号重试、真实诊断与草稿恢复；两种真实网络故障注入验收通过（2026-10-23）。

- [企业邀请链接复制上线验收](releases/enterprise-invitation-copy-release-20261023.md) — 纯文本复制、弹窗内备用复制与真实失败提示；原生/接口缺失/拒绝场景系统粘贴通过，2026-10-23 已发布。

- [Studio 出图后接视频续接修复与验收](releases/studio-stage-continuation-release-20261023.md)（last-reviewed: 2026-10-23）
- [Studio 对话去掉「继续」、不锁方法、单击弹浮层发布记录](releases/studio-dialogue-no-continue-release-20261023.md)（last-reviewed: 2026-10-24）
- [Studio 方案素材范围跨轮发布记录](releases/studio-plan-material-scope-release-20261024.md)（last-reviewed: 2026-10-24）
- [AI 导演台首发发布记录](releases/ai-director-release-20261024.md)（last-reviewed: 2026-10-24）
- [模型告警北京时间与服务方响应发布](releases/model-alert-bjt-response-release-20261024.md) — 仅 server；按用户要求跳过部署后验证（last-reviewed: 2026-10-24）。
- [Studio 同步出图读 URL 结果与告警措辞修复](releases/studio-image-url-result-alerts-20261029.md) — 仅 server；4 条飞书告警根因、改读 `data[0].url`、告警写最终结果；真实出图路径待下一次生成核对（last-reviewed: 2026-10-29）。

- [Studio 聚算资源配额拒绝与结算核对](audits/studio-upstream-quota-2026-10.md)（last-reviewed: 2026-10-23）

- [Studio 读取、进度、保存恢复与 Agent 运行时评估](audits/studio-agent-runtime-assessment-2026-10.md) — 本地修复，未发布；AgentScope Java / LangGraph 替换边界与验收标准（last-reviewed: 2026-10-23）。

- [AI 导演台本地验收记录](audits/ai-director-local-acceptance-20261022.md) — 独立 UI 实测真值：测试响应全流程、Agnes 真实剧本／分集／资产／分镜首帧、局部重试修复；真实视频受厂商队列阻塞；实现状态见[总方案 §14](ai-director-plan.md)；last-reviewed: 2026-10-23。
- [导演台视频提示词对比实测（H3）](audits/director-h3-video-prompt-ab-2026-10.md) — 《敦煌飞仙》两段共 9 条对比：旧写法穿模 / 宫格上屏；台词多时中文正文吞台词、念出提示词，官方 skill 英文版完整；据此提交前按官方 skill 改写，真模型试跑 7/7 合格；2026-10-27 推到 Studio 画布与创作助手、检查改为只提示不拦人（§8）；last-reviewed: 2026-10-27。

- [Studio 下午至晚间线上使用复盘](audits/studio-production-afternoon-evening-review-20261023.md) — 2026-10-23 北京时间生产查询快照；记录用户旅程、任务／账本、排队与发布窗口及待核证据，不代表本轮已修复或重测；last-reviewed: 2026-10-23。
