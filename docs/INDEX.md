# 文档索引 · INDEX

> 单页地图。任何 agent / 新人进仓库时先开本文。
> 按"想做什么"组织：先选场景，再跳到对应的真源文档。
> last-reviewed：2026-10-10 / v0.230 账号与旧 Studio 外壳统一；验收与发布见账号统一文档及生产发布记录
> last-reviewed：2026-10-08 / v0.202 统一 Studio 首版本地实现与样例端到端验收完成、V40 请求幂等、V41 配音与 V42 口型用途；未发布（见 VERSION_HISTORY.md）
> last-reviewed：2026-05-29 / v0.41 合并「AI 模型」+「外部 API Token」为「模型接入端点 + Token」+ AI 应用绑定
> last-reviewed：2026-05-23 / v0.5.4
> last-reviewed：2026-05-21 / v0.21 混剪 / 分发用户视角文案 + 视频库（软删 30 天）+ 官方明星片段

> monorepo 拆分已完成 Phase 5：五个新 web app（`apps/web-{music,drama,celebrity,aiavatar,star}` + `packages/*`）走 Next 16 + React 19 + pnpm；遗留 `apps/web` 已于 2026-08-03 删除。`apps/admin`、`apps/server` 不动。详见 [`AGENTS.md`](../AGENTS.md) §1 顶部进度表。

---

## Studio 工作台界面重构

- [资产库独立设计原型](../prototypes/asset-library/README.md)：[设计方向](prototypes/asset-library-direction.md)、[设计检查](prototypes/asset-library-design-check.md)与[原型验证](prototypes/asset-library-validation.md)；静态原型，与业务代码分离（last-reviewed: 2026-10-17）。

- [项目卡片生产发布](studio-project-cards-release-20261017.md)：真实内容预览、固定／自动封面、上线制品及真实浏览器验收；已发布（last-reviewed: 2026-10-17）。
- [生产发布记录](studio-workspace-production-release-20261017.md)：全部改动提交、server/web-aiavatar 制品与线上验收及浏览器限制；已发布（last-reviewed: 2026-10-17）。

- [全仓表单聚焦样式检查](form-control-focus-audit.md)：输入、下拉、文本域及组合控件的焦点归属修复、74 项组件回归与真实本地页面验证；代码已生产发布（last-reviewed: 2026-10-17）。

- [导航与内容组织定稿](studio-information-architecture.md)、[设计图片](studio-v3-design-review.md)、[UI规格](studio-commerce-ui-design.md)、[开发任务](studio-commerce-development-tasks.md)、[现状审计](studio-commerce-current-page-audit.md)：设计与剩余任务（last-reviewed: 2026-10-16）。
- [实施与验收](studio-workspace-refactor-validation.md)：七项导航、独立项目、模板画布、IP资产合并、存量账号/记录复用及【待建设】边界；代码已发布（last-reviewed: 2026-10-17）。

## 1. 产品 / 业务规格（"产品要什么"）

### 1.1 跨子产品规格（仓库根）

| 文档 | 范围 | 当前状态 |
|---|---|---|
| [`product_spec.md`](../product_spec.md) | **AiAvatar / 数字 IP 主线** —— 数字艺人孵化、音乐工坊、内容（影视/综艺/广告/配音）、社群、版权、分发、变现 | v2.7 canonical（2026-05-06） |
| [`product_spec_ai_celebrity.md`](../product_spec_ai_celebrity.md) | **AI 明星带货主线** —— 明星市场、授权、模板/脚本、AI 模型、生成器、积分钱包、消息中心、社交账号绑定 profile | v0.17 rolling（2026-05-20） |
| [`docs/ADMIN_PRODUCT_SPEC.md`](ADMIN_PRODUCT_SPEC.md) | **运营后台规划** —— 全配置化终态（ConfigItem / 灰度 / AB 桶 / 17 个字典上移） | 大目标稿；当前 admin 是其 P0 子集 |
| [`docs/unified-operations-console-plan.md`](unified-operations-console-plan.md) | **统一运营后台建议** —— Platform 统一入口、复用原业务服务、模型定价/任务排查/模板运营三条首期流程，以及沿用原 admin 风格的紧凑视觉建议 | 建议留档，待确定实施范围（2026-10-10）；非已交付状态 |
| [`docs/unified-identity-plan.md`](unified-identity-plan.md) | **统一账号中心（id.aibuzz.cn）** —— 全生态（本仓 5 web app + 小程序 / 军师 / 公社）统一身份：OIDC + RS256、手机号 + unionid 身份键、五层模型（身份 / 建档 / 开通 / 角色 / 资源）、小程序自定义 grant、合并规则、§8.0 门禁、P0–P5 分期；服务落在独立仓库 [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id)（含其 `deploy/`），本仓只留消费方接入 | P1 服务 + P2 本仓接入完成，**已于 2026-09-05 上线**（last-reviewed 2026-09-06，v0.149） |
| [统一账号邀请关系方案](unified-account-referral-plan.md) | 账号中心邀请码、一张原始邀请关系表、注册时记录与直接查询；§9 复核后期本体/整体链路视图，不增加当前数据结构 | v0.5；ID/Studio 首版已发布，品牌邀请入口与完整线上验收待完成（last-reviewed 2026-10-17） |
| [统一账号邀请 · 前端设计](unified-account-referral-frontend.md) | Studio 内邀请视图/链接管理、账号中心落地页与注册提示，含手机和失败状态 | v0.4；首版已发布，Studio 品牌邀请页先行设计（last-reviewed 2026-10-17） |
| [统一账号邀请 · 本地验收](unified-account-referral-validation-20261017.md) | 两仓范围、ID/Studio 闭环、账号与共享 SDK/前端回归、MySQL、浏览器截图及发布边界 | 发布前本地证据；首版已发布、线上闭环待完成（last-reviewed 2026-10-17） |
| [统一账号邀请 · 首版发布](unified-account-referral-production-release-20261017.md) | 两仓 SHA、CI、制品、V12、备份、账号释放及已验/待验范围 | 首版上线，完整线上验收待品牌入口修正（2026-10-17） |
| [Studio 品牌邀请页设计](prototypes/studio-invitation-design.md) | 品牌、创作能力、朋友邀请、认证后返回 Studio；独立交互原型及桌面/手机截图 | 设计审阅稿，尚未替换线上（2026-10-17） |
| [统一账号邀请链 · Astra 独立评审](unified-account-referral-astra-review-20261017.md) | `gpt-6-astra` 对 v0.2 完整方案的独立核对及风险记录 | 历史参考，未重新评审 v0.3；投影与事件设施不再属本期（last-reviewed 2026-10-17） |
| [统一认证手机号与后台搜索发布验收](identity-phone-release-20261010.md) | `/userinfo` 完整手机号副本、服务端跨分页搜索、指定存量账号补齐、权益不变及账号中心 SOP 更新 | server/admin 已上线；46 项专项测试与真实线上 UI 通过（last-reviewed 2026-10-10） |
| [统一认证跨应用 SOP 复核](unified-identity-sop-audit-20261010.md) | 全生态在用客户端、资料/后台/竞态/事件消费复核；各仓修复与既有缺口 | 本轮本地完成、未发布；ClassVibe 生产停服及两项既有脚本门禁失败，Slides/Quickreel 完整接入未通过 |

### 1.2 子应用产品 + 设计约束（每 app 一份）

| 文档 | 子产品 | 真源覆盖 |
|---|---|---|
| [`apps/web-music/PRODUCT.md`](../apps/web-music/PRODUCT.md) ★ | AI 音乐人（3010） | 产品定位 / 路由 / 业务领域 / 视觉系统（Restrained dark + Inter） |
| [`apps/web-drama/PRODUCT.md`](../apps/web-drama/PRODUCT.md) ★ | AI 短剧（3011） | 产品定位 / 路由 / 业务领域 / 视觉系统（Premium Cinematic + 金色 accent + serif） |
| [`apps/web-celebrity/PRODUCT.md`](../apps/web-celebrity/PRODUCT.md) ★ | AI 明星带货（3012） | 产品定位 / 路由 / 业务领域 / 视觉系统（Creator-Friendly + 紫罗兰）+ **混剪专区完整设计** |
| [`apps/web-aiavatar/README.md`](../apps/web-aiavatar/README.md) ★ | AiAvatar 数字资产平台（3013） | 移动端 H5/小程序形态 SPA · **六类资产**（DH- 人物 / IP- 品牌 / SC- 场景 / PD- 产品 / VO- 声音 / ST- 风格）+ IP 容器 + 跨资产合成工作台 · 真人复刻（**v0.105 起本人刷脸实名认证**）/ AI 原创 · 素材平台审核 · 单色青「清爽」皮肤（last-reviewed 2026-08-02，v0.105 真人授权刷脸认证 + 素材送审） |
| [`apps/web-star/PRODUCT.md`](../apps/web-star/PRODUCT.md) ★ | 明星商务工作台（3014） | 明星/经纪团队审核中枢 · 14+1 模块（IP 资产/带货授权/报白/数字人/AI 形象/内容/商品入库/品牌/收益/规则/侵权/合同/档案设置）· 浅色主题 · celebrity↔star 打通规格（last-reviewed 2026-06-11，v0.62 档案编辑移入） |
| [`apps/web-star/README.md`](../apps/web-star/README.md) | 明星商务工作台（3014） | 启动 / 路由 / 种子账号（star_shenteng）/ 与 web-celebrity 打通表 / 版本日志 |
| [`apps/web-aiavatar/DESIGN-desktop.md`](../apps/web-aiavatar/DESIGN-desktop.md) ★ | AI IP 工作台桌面面（并入 web-aiavatar） | **该子应用视觉系统真源** —— 低饱和群青 `#495B91` / 麦黄 `#E7D58D` / 纸白 `#F5F4EF` / 墨 `#202C42` 全量 token + 语义映射与实测对比度 + 字体·间距·圆角·阴影·交互 + **landing 与画布应用边界**（含 reject 清单）+ **landing 区块清单与文案纪律**（landing 不讲工作流 / 不讲模型）+ 图集素材契约（4×3 等格、12 格位对照、`AtlasFrame` 1:1 与 `AtlasPortrait` 竖幅两种裁切、禁 SVG 冒充作品、**生产真源在 OSS 绝对地址**、`public/landing/` 仅可选本地副本不入 git）（last-reviewed 2026-09-06，v0.152 含浏览器评审改判与图集上线；v0.151 的单一青色 `#12B3DE` 已退役） |
| [`apps/web-aiavatar/DECISIONS.md`](../apps/web-aiavatar/DECISIONS.md) | AiAvatar 平台 | 忠实移植原型 / strict 关闭 / 与 v0.45 server 领域解耦 / 字体策略 / 导航栈 决策记录；v0.104 追加六类资产扩展边界（§G 加类型不重做 · §H 授权只发人物与 IP · §I 作业执行体拆分 · §J mock 回填时机）；v0.105 追加真人刷脸认证边界（§K 假核验退役 · verify 唯一漏斗 · 回调不判定生效 · §L 授权硬闸前移到生成入口 · §M aigc 走平台默认组 + 配额债务）（last-reviewed 2026-08-02） |
| [`docs/AIAVATAR_PROGRESS.md`](AIAVATAR_PROGRESS.md) | AiAvatar 中心 | 实施进度台账 + 断点续传指引 + 三路 E2E 验证记录 |
| [`docs/ip-studio-ui-release-20261010.md`](ip-studio-ui-release-20261010.md) | Studio 生产发布 | 统一界面与独立品牌更新的代码 SHA、发布包、备份、线上资源校验与视觉验收；当前前端 `fb4502a2`（last-reviewed 2026-10-10） |
| [Studio 节点交互发布](ip-studio-node-release-20261011.md) | 素材上传、故事板、文本 AI 改稿与视频错误映射的发布/验收 | 2026-10-11 |
| [`docs/FACE_BEAUTY_RESEARCH.md`](FACE_BEAUTY_RESEARCH.md) | AiAvatar 平台 | 形象「精调 / 美颜」技术方案调研：浏览器端确定性美颜（推荐）vs 云 API vs Agnes i2i（last-reviewed 2026-06-07） |
| [`docs/ADMIN_ALIGNMENT_AUDIT.md`](ADMIN_ALIGNMENT_AUDIT.md) | admin / server / 子应用 | 三端配置对齐审计（v0.53 同期）：10 项发现、3 项已随 v0.53 修复、7 项待办含优先级（last-reviewed 2026-06-07） |
| [`docs/drama-ux-copy-pass.md`](drama-ux-copy-pass.md) ★ | AI 短剧（全站） | **drama 界面文字的术语表**（每个东西只许一种叫法，含「提示词直出 → 粘贴写好的脚本」等改名）+ 导航与用户路径决定 + 响应式规范（断点 / 两栏变页签 / 表格变卡片 / 贴底操作条）+ 共享底座与文件所有权（v0.197）+ §2.7 画布术语（v0.198，last-reviewed 2026-09-30） |
| [`docs/drama-canvas-plan.md`](drama-canvas-plan.md) | AI 短剧（画布） | **v0.198 设计真源**：独立入口 `/canvas`，照小云雀短剧 Agent 做的四屏流水（剧本 → 角色和场景画布 / 列表 → 逐集制作 → 单集编辑器按片段出片 → 合成成片）；数据独立存 `drama_canvas` 表、只存 key、baseDocVersion 防覆盖、运行记录另存；第二期自由画布 + AI 对话；§11 线上实测与 v0.198.1 修复（last-reviewed 2026-10-03） |
| [`docs/drama-storyboard-consistency.md`](drama-storyboard-consistency.md) | AI 短剧（视频工厂） | 一集多分镜视频一致性优化方案（借鉴 ViMax）：P0 镜间承接（已落地 v0.97）/ P1 storyboard prompt 增强 + 机位 / P2 seedance 首尾帧双关键帧 i2v + 链式承接（last-reviewed 2026-06-30） |
| [`docs/drama-short-vimax-lite-plan.md`](drama-short-vimax-lite-plan.md) | AI 短剧（风格短片） | ViMax-lite 前后一致性提升计划：提示词去污染 / ContinuityManifest / 关键帧依赖 DAG / 七牛 Kling 一致性模式 / 确定性声音总装 / 零 Token QA；明确不做多 Agent Review（last-reviewed 2026-08-18） |
| [`docs/[Fabel5][TODO]drama-audit-2026-07.md`](%5BFabel5%5D%5BTODO%5Ddrama-audit-2026-07.md) | AI 短剧（全局审计） | 产品逻辑 × 技术架构审计（只列问题+改进方案）：一致性引擎五层架构（L0 实体化→L3 VLM 质检）+ C-序列路线图 + P0-P3 排期总表；供后续执行 agent 作工作输入（last-reviewed 2026-07-04） |
| [`docs/[Fabel5]drama-consistency-engine-design.md`](%5BFabel5%5Ddrama-consistency-engine-design.md) | AI 短剧（一致性引擎） | 一致性引擎实现级设计（C-1 / D-11 / C-2 / C-3）：末帧 CDN 镜像 + applied_refs 回报 / 一用途多候选端点 + capability / 角色场景实体化 + 三视图 / 服务端参考装配；含 file:line 锚点、失败语义、门禁与冲突点裁决输入（last-reviewed 2026-07-10，C-1 已落地） |
| [`docs/payment-billing-audit-2026-07.md`](payment-billing-audit-2026-07.md) | 支付 / 计费 / 积分账本（全栈审计） | 充值·支付网关·账本·业务扣费·对账·退款·风控 全面审计报告 + 落地方案台账：33 项 Findings（2 P0 / 8 P1）+ 决策台账 D1-D8 + T1-T17 分波次 Task 卡（带 file:line + 验收断言）；供后续执行 agent 作工作输入（last-reviewed 2026-07-04） |
| [`docs/aiavatar-asset-platform-plan.md`](aiavatar-asset-platform-plan.md) | AiAvatar 平台（产品定位规划） | [fable5] 从「数字人生产工具」到「AI 数字资产平台」的定位跃迁方案：五方向（资产宇宙 / 权利层确权授权分成 / 市场流通 / Asset-as-a-Service 调用层 / 组合打包）+ P0-P3 路线图 + 现状事实速查；仅方案未改造，供后续执行 agent 作工作输入（last-reviewed 2026-07-09） |
| [`docs/ip-studio-plan.md`](ip-studio-plan.md) | **AI IP 工作台设计真源**（前端 v0.190 起并入 `apps/web-aiavatar`） | 个人照片 + 内置工作流 → 稳定产出同一人物同一风格的 AI IP 形象组，发布为 AiAvatar 资产（`DapAvatar` + `DapLook`）。决策：共用 aiavatar 开通；⚠️ §0 里「新桌面子应用」与「React Flow 画布」两条**均已被后续版本推翻** —— v0.157 改为整体 vendor infinite-canvas，v0.190 并回 web-aiavatar、全部复用 dap 生成链；§2 节点/运行契约、§3 五层一致性锁定、§4 服务端、§9 并行分工与文件所有权；v0.201 完整生成记录 / 版本恢复 / 云端画布素材（last-reviewed 2026-10-07） |
| [Studio 企业主子账号与积分管理方案](ip-studio-team-accounts-plan.md) | **v0.4 已生产发布** | 单企业归属、固定 RBAC、人工充值和积分批量分配/回收；分配积分归企业，开通沿用现有逻辑、不做企业席位（last-reviewed 2026-10-15） |
| [Studio 企业积分管理开发任务](ip-studio-enterprise-development-tasks.md) | **已生产发布** | E01–E12 的依赖、改造位置及验收标准；覆盖账户、RBAC、划拨、充值、全部生成链路、前后台与发布，执行状态统一在 TODO（last-reviewed 2026-10-15） |
| [企业积分生产发布](ip-studio-enterprise-production-release.md) | **f068b51d · 已开启** | 三服务发布、V56–V58、线上页面与存量钱包/账本/开通核对、备份及回退边界（last-reviewed 2026-10-15） |
| [企业积分第一批验收](ip-studio-enterprise-foundation-validation.md) | **E01–E04 测试与边界** | 企业权限、V56、钱包兼容的 H2/MySQL 验收、编译契约门及后续边界（last-reviewed 2026-10-15） |
| [企业群发邀请实现与验收](ip-studio-enterprise-invitation-validation.md) | **已生产发布** | 90 天/一年可多人分享链接、品牌短信注册加入、V59 旧邀请清理与权限边界（last-reviewed 2026-10-17） |
| [企业邀请与测试账号生产验收](ip-studio-enterprise-invitation-production-release-20261017.md) | **d8195896 · 已上线** | 同链接双成员入企、后台测试账号创建/入口/停用、V59、制品与清理；无需真实短信（last-reviewed 2026-10-17） |
| [后台测试账号](test-accounts-plan.md) | **已生产发布** | 超管创建独立测试身份、两分钟一次性正常 OIDC 登录、停用及业务边界（last-reviewed 2026-10-17） |
| [企业积分前端规划](ip-studio-enterprise-ui-plan.md) | **完整管理/付款/财务界面** | Studio及财务页沿用平台组件的设计、预览确认与权限动线（last-reviewed 2026-10-15） |
| [企业积分完整交付验收](ip-studio-enterprise-complete-validation.md) | **E07–E12 本地结果** | 18个产品场景、真实页面资金核对、任务恢复、测试与发布边界（last-reviewed 2026-10-15） |
| [企业积分第二批验收](ip-studio-enterprise-points-validation.md) | **E05–E06 测试与边界** | 划拨、人工财务、原充值来源、H2/MySQL及真实浏览器交易验收（last-reviewed 2026-10-15） |
| [`docs/ip-ecosystem-integration.md`](ip-ecosystem-integration.md) | **IP 工作台 / 数字资产 / 数字名片 整合方案** | 一条链：造形象 → 登记资产 → 对外发布。§2 打通只靠 `dapDisplayRef` + `DapAssetUsage` 两样现成东西、§3 内置工作流模板「IP 打造」（`ip-launch-female` / `ip-launch-male`，装扮 3 + 表情 3；短动作要发布后到 dap 里跑，画布跑不了）、§4 用户动线、§5 需新增项、§6 三条红线（last-reviewed 2026-09-07） |
| [`docs/digital-business-card-plan.md`](digital-business-card-plan.md) | **AI 数字名片（`apps/web-aiavatar` 下 `/card` 域）方案真源** | 见客户递一条链接就把人说清楚。一期只做门面（扫码即看 / 形象三档 / 存通讯录），交换与名片夹挂二期。§3 不发新产品码（`/api/v1/**` 兜底到 aiavatar）、§5 形象走 `dapDisplayRef` 引用不拷贝、§6 与 dap / IP 工作台的职责边界、§8 视频层叠三方案与交付清单、§9 需新增项（last-reviewed 2026-09-07） |
| [`docs/ip-studio-generalize-proposal.md`](ip-studio-generalize-proposal.md) | **IP 工作台通用化提案（v0.153 已落地）** | 形象卡五字段（outfit/pose/expression/details/props）在服务端只是按序拼成一串文本，拆分对出图无增益；改为「一个提示词框 + 内置模板库」，五层一致性锁定与计费纪律不动，零迁移（老画布读取回落）。文末有落地记录（last-reviewed 2026-09-07） |
| [`docs/ip-studio-libtv-alignment.md`](ip-studio-libtv-alignment.md) | **IPStudio 对标 LibTV 的原始提案与实时差距矩阵** | 首页与统一画布、助手/剧本/图片/原生视频/模板核心动线，v0.229 补回拖线引用、v0.231 模板直接复制为普通画布；多模态助手、长视频、专属声音等差距明确（last-reviewed 2026-10-10） |
| [全能创作生产验收](ip-studio-assistant-production-acceptance.md) | **生产发布与真实生成验收** | 简化面板、文字采用、跨步骤节点依赖、六个旧测试修复；真实文字→图片→5秒视频，231积分，刷新与原节点复用通过（last-reviewed 2026-10-13） |
| [`docs/ip-studio-assistant-context.md`](ip-studio-assistant-context.md) | **Studio 助手与画布引用** | @ / 感知画布、文档正文/本地媒体多选导入、同源素材库、图片/短视频四帧读取、对话恢复及文字快照分享/复制继续；v0.217 本地，未发布，音轨及完整视频未接 |
| [`docs/ip-studio-unified-canvas-plan.md`](ip-studio-unified-canvas-plan.md) | **AI IP Studio 统一画布产品与实施方案** | M0–M4 真实 Agnes 本地验收、M6 双集与连续制作；M5 商品/配音/同音频口型短样片通过，人物固定声音版本绑定已接，专属声音未接，M7 有限图片模板、版本/采用/归档/部分资产包本地通过；逐项验收、权限计费、兼容和 Sol 指令，未发布（last-reviewed 2026-10-09） |
| [`docs/ip-studio-conversational-video-recreation-plan.md`](ip-studio-conversational-video-recreation-plan.md) ★ | **全能创作对话驱动视频复刻 · 唯一方案真源（v4）** | 技能（仓内 `reference-video-recreation.md`）+ 连续线程 / 真流式 / 工作记录 / 转向 + 两阶段计划 + 服务端执行器（`ip_plan_execution`，提交前预算、租约、暂停只查）+ 原生 `check` 三态；S1/S2/S3 已本地实现（2026-10-18，未发布；S3 = 技能表 V63 / 后台技能页 / 多技能路由 / 蒸馏草稿），S0 付费实测待批预算；接入前两项产品问题已修（last-reviewed 2026-10-18） |
| [`docs/studio-recreation-release-20261018.md`](studio-recreation-release-20261018.md) | 全能创作复刻 S1/S2/S3 生产发布记录 | 发布 `20261018-studio-recreation-s1s3`（c6f40808）：基线核对与合并、V60–V63 迁移、技能 seed、verify 全绿、上线后配置项与未验证范围（last-reviewed 2026-10-18） |
| [`docs/studio-local-full-e2e-20261019.md`](studio-local-full-e2e-20261019.md) | Codex 本地全量端到端验收 | 对话、画布、成片、限流及复核修复结论：8 条中 7 条修复、1 条为别名配置（last-reviewed 2026-10-19） |
| [`docs/studio-user-journey-acceptance-20261019.md`](studio-user-journey-acceptance-20261019.md) | 线上只读的用户视角验收 | 文字落画布、复刻检查口径、成片默认片段等待办（last-reviewed 2026-10-19，后续见 TODO） |
| [`docs/ip-studio-workflow-template-plan.md`](ip-studio-workflow-template-plan.md) | **标准画布模板与人物设定图方案** | 用户新增核心方向；含 LibTV 公开/复制画布实测、默认一次人物设定图与反推提示词，进阶独立资产/拼板；模板输入/依赖/输出/版本/套用和有限执行（last-reviewed 2026-10-08） |
| [`docs/ip-studio-ui-audit.md`](ip-studio-ui-audit.md) | **Studio 界面与交互审查** | impeccable审查、画布区域分离、统一人物选择与响应式验收；本地未发布（last-reviewed 2026-10-08） |
| [Studio 创作首页](ip-studio-home.md) | AI IP 工作台 | 首页主要功能、近期画布与模板、同一 Studio 落点与品牌保留（last-reviewed 2026-10-08） |
| [Studio 视频模式](ip-studio-video-modes.md) | 产品 / 实施 | 原生首尾帧、全能参考、模型合同与费用校验；本地验证边界 |
| [Studio 运镜标签](ip-studio-camera-motion.md) | 产品 / 实施 | 原生面板、展开编辑器与抽屉共用命名指令、光标插入、编辑/移除及正文保存；v0.211 本地 |
| [Studio 视频特效库](ip-studio-video-effects.md) | 产品 / 实施 | 共用官方描述、本人收藏/最近/个人发布、模型筛选、点选与替换；v0.213 本地，原生供应商效果及完整社区未接 |
| [`docs/ip-studio-character-library.md`](ip-studio-character-library.md) | **Studio IP 人物库与小云雀对标** | 人物成组浏览、主图/设定图/视角/声音、免费归类、精确版本引用和浏览器验收；V45，本地未发布（last-reviewed 2026-10-08） |
| [个人资产库与快速编辑方案](ip-studio-personal-asset-library-plan.md) | **实际产品方案，已生产发布** | 贴合现有 `/assets`、画布、人物详情及剧本素材面板；提取/快速完善不进一级导航；自动归集与跨画布引用（last-reviewed 2026-10-11） |
| [个人资产库可交互原型](../prototypes/asset-library/README.md) | **停止迭代，不作为正式产品设计依据** | 独立本地演示，未接生产；用户改为评审实际产品方案；[演示边界](prototypes/asset-library-validation.md)（2026-10-11） |
| [`docs/prompts/ip-character-sheet.md`](prompts/ip-character-sheet.md) | **人物设定图一次出图提示词** | 用户附图版式拆解、可换人物的提示词与整图参考出单独镜头；反推词，不称作者原词（last-reviewed 2026-10-08） |
| [`docs/ip-studio-unified-canvas-validation.md`](ip-studio-unified-canvas-validation.md) | **统一 Studio 真实 Agnes 与确定性验证记录** | 样例与真实证据分开；三镜/双集/商品包装媒体、平台积分、恢复与下载、测试/构建/手机检查，以及声音和生产未验收边界（last-reviewed 2026-10-09） |
| [`docs/aiavatar-asset-hub-redesign.md`](aiavatar-asset-hub-redesign.md) | AiAvatar 平台（**中枢重构真源**） | 数字资产升格为生态资产中枢的产品 + 前端重构设计：四动词模型（注册/引用/回流/授权）+ 档案卡 + 两条铁律（不阻塞下游 / 联邦不集中）+ 新 IA 五路由 + /studio 双轨迁移 + P1-P4 分期；P1（真路由读界面）已落地（last-reviewed 2026-08-29） |
| [`docs/video-studio-plan.md`](video-studio-plan.md) | **视频生成区设计真源**（`apps/web-celebrity` `/studio/video`，v0.199） | 把 MiniMax H3 四种原生模式（文生 / 首帧 / 首尾帧 / 全能参考）原样搬进带货工作台，不做产品化封装。§2 厂商合同（读自 docs.jusuanhub.com + Portal「API 接入」，含 1:1 用 `square` 未实测）、§3 计价（我们自己定、后台按模式 × 清晰度配每秒价，没定价不能提交）、§4 接口与错误码、§5 复用通用视频链（新分区 `video-studio`，`VideoGenSpec` 一处解析）、§8 没做的、§9 智能优化（可选、默认勾上，后台任务 + 同键重试）、§10 模板 / 做同款（官方模板只有运营能发）、§11 后台定价页签、§12 V37 迁移（last-reviewed 2026-10-01） |
| [`docs/clip-avatar-video-plan.md`](clip-avatar-video-plan.md) | **`clip` 口播视频线**（军师小程序分包） | v0.135：本人素材单次直传、多数字人、逐句字幕与总装；最终音轨两遍归一并为 AAC 峰值回弹留余量，真实文件继续过严格质量门（last-reviewed 2026-08-18）。 |

不动产品规格的方向时不必读 §3 ~ §7。

## 2. 工程协议（"代码该怎么写"）

| 文档 | 给谁看 | 一句话 |
|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | **统一 agent 入口**（Claude Code / Cursor / Aider / Continue / 自建 SDK） | 项目概览 + 三端架构 + 硬规则 + 新增领域 SOP + 文档同步纪律（精简到 ~34k chars，version log 已外移） |
| [`CLAUDE.md`](../CLAUDE.md) | Claude Code（自动注入） | **symlink → AGENTS.md**（单点维护，内容等同 AGENTS.md） |
| [`docs/VERSION_HISTORY.md`](VERSION_HISTORY.md) | 完整连续版本增量（v0.5 → v0.129） | 新实体 / 路由 / 决策 / 注意事项的全量历史；从 AGENTS.md 拆分以保持主文件轻量 |
| [`apps/miniprogram/agent.md`](../apps/miniprogram/agent.md) | 任何在小程序目录工作的 agent | 微信平台坑（iOS/Android 差异、custom-tab-bar、CSS、setData、轮询清理） |
| [`.claude/skills/figma-migrate/SKILL.md`](../.claude/skills/figma-migrate/SKILL.md) | 触发 figma-migrate skill 时 | 五件套 + 三端同步 SOP |
| [`apps/design.md`](../apps/design.md) + [`apps/design/`](../apps/design/) | 前端设计 token 契约 + 设计稿 reference app（"AI IP Design Directions"，三套主题：tech/creator/premium） | 视觉规范真源；新增 UI 时必读 |

新人 agent 顺序：**AGENTS.md** → 对应的 `apps/<sub-app>/PRODUCT.md` → `apps/<sub-app>/README.md`（启动 + 版本日志）。

> **关于"PRODUCT.md"命名**：
> - 仓库**根** `./PRODUCT.md`（44 行）—— 是 [`/impeccable`](../.claude/skills/impeccable/SKILL.md) skill 的强制上下文（Users / Brand / Tone / Design Principles）。用于驱动设计决策的 personality 文档，**不是**业务规格
> - 各子应用 `apps/<sub-app>/PRODUCT.md` —— 各子产品的功能 + 路由 + 视觉系统 + 模块清单，**是**产品 + 设计约束真源
> - 业务功能规格在仓库根 `product_spec*.md`

## 3. 接口契约（"前后端怎么对齐"）

| 文档 | 用途 |
|---|---|
| [`specs/README.md`](../specs/README.md) ★ | **接口契约索引**：openapi.yaml + BUSINESS_RULES.md 关系、186 paths 分组、CI 守门规则、wire 命名规范 |
| [`specs/openapi.yaml`](../specs/openapi.yaml) | **唯一接口契约**（186 paths）。CI 守门：`pnpm check:api-contract` |
| [`specs/BUSINESS_RULES.md`](../specs/BUSINESS_RULES.md) | openapi 表达不了的业务规则：字段校验 / 计算公式 / 状态机 / 错误码 |

新增 / 修改接口时：先改前端 `types/*`（真源）→ 后端 `*Dto` → `specs/openapi.yaml` → CI 自动验。**v0.8 例外**：`/api/mixcut/*` 用 snake_case wire，详见 [`apps/web-celebrity/PRODUCT.md` §5.6](../apps/web-celebrity/PRODUCT.md)。

## 4. 各应用 README（"启动 / 目录 / 版本日志"）

| 文档 | 一句话 | 当前版本 |
|---|---|---|
| [`apps/server/README.md`](../apps/server/README.md) | Spring Boot 8080 / Profile / 角色体系 / **v0.5 新增表** / **AEP_SECRET_KEY 环境变量** / 社交账号 profile 字段 / **dap 数据模型（含 v0.105 `dap_material_group` + `dap_material`）** | v0.105 同步（真人刷脸认证 + 素材送审 + 授权硬闸前移） |
| [`apps/admin/README.md`](../apps/admin/README.md) | Next.js 运营后台 3003 / 当前 sidebar / v0.5.x 滚动更新 | v0.58 同步（消息中心真实化 + 结算中心流水补全） |
| [`apps/miniprogram/README.md`](../apps/miniprogram/README.md) | 微信小程序（带货方）/ 11 屏 / 启动方式 / 版本日志 | v0.5.4 |
| [`apps/web-music/README.md`](../apps/web-music/README.md) | **AI 音乐人**（Next 16，dev 3010）启动 / 技术栈 / 版本日志 | Phase 4b（v0.6 · 2026-05-15）— 产品/设计约束见 [`PRODUCT.md`](../apps/web-music/PRODUCT.md) |
| [`apps/web-drama/README.md`](../apps/web-drama/README.md) | **AI 短剧**（Next 16，dev 3011）启动 / 技术栈 / 版本日志 | Phase 4b（v0.6 · 2026-05-14）— 产品/设计约束见 [`PRODUCT.md`](../apps/web-drama/PRODUCT.md) |
| [`apps/web-celebrity/README.md`](../apps/web-celebrity/README.md) | **AI 明星带货**（Next 16，dev 3012）启动 / 技术栈 / 版本日志（含 mixcut 与分发中心） | v0.17（2026-05-20）— 产品/设计约束见 [`PRODUCT.md`](../apps/web-celebrity/PRODUCT.md) |

> `apps/web`（Next.js 用户端 3002）已于 **v0.109 / Phase 5（2026-08-03）删除**，历史版本日志见 [`docs/VERSION_HISTORY.md`](VERSION_HISTORY.md) `### v0.109`。

**packages/**（pnpm workspace 共享层；五个新 web app 消费，apps/admin 不消费）：
- `packages/types/` — TS 类型契约
- `packages/ui/` — shadcn + ThemeProvider + globals.css
- `packages/api-client/` — apiFetch + AuthProvider + format
- `packages/landing/` — ProductLanding 原语

> 共享包暂无独立 README；用法见各 PRODUCT.md「组件分层」段。

## 5. 部署 / 运维（"上线怎么部署"）

统一认证接入 SOP：[`aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md`](../../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md)，
§7.9 / §10.6 包含资料来源、手机号读取、后台搜索、分页、换绑、存量补齐与本地重启验收（last-reviewed 2026-10-10）。

| 文档 | 用途 |
|---|---|
| [`infra/README.md`](../infra/README.md) | 阿里云 ECS + RDS + OSS 部署的**单一真值源**：拓扑图、一次性环境拉起 SOP、env / nginx / systemd / 脚本一站式索引；**§5.1 nginx vhost 硬规则**（每子域必须同时有 80 和 443；443 已有 `000-default-ssl.conf` 兜底）+ **§5.2 www.\* 二级子域**（DNS 泛解析匹配任意层级，TLS 通配符只覆盖一级 —— 客户「链接打开不太对」的真因）+ **§5.3 证书与 certbot+Alidns 自动续期**（到期 2026-12-05）+ 线上 vhost 清单 / 新增子域 checklist（last-reviewed 2026-09-06） |
| [`docs/identity-phone-release-20261010.md`](identity-phone-release-20261010.md) | 统一手机号、后台搜索与测试账号归档/全量验证的发布证据；last-reviewed 2026-10-10 |
| [`infra/vendor/platform-sdk/README.md`](../infra/vendor/platform-sdk/README.md) | Java SDK 固定 release 的制品来源、SHA256 和 CI/部署安装路径；新 runner 无需跨私有仓认证（last-reviewed 2026-10-10） |
| [`.claude/skills/aliyun-deploy/SKILL.md`](../.claude/skills/aliyun-deploy/SKILL.md) | Agent 部署技能入口：本地 artifact 部署、按应用部署、GitHub Actions 流水线部署、验证与排障 |
| [`docs/ALIPAY_SANDBOX.md`](ALIPAY_SANDBOX.md) | **支付宝直连沙箱联调 Runbook**（v2 §6 driver=alipay）：拿沙箱凭证 → 本机配置 → 纯查单兜底 / 公网回调两种姿势 → 验证 → 上生产换 4 项（last-reviewed 2026-06-27） |
| [`infra/scripts/update-and-deploy.sh`](../infra/scripts/update-and-deploy.sh) | ECS 本机一键更新部署：补依赖、`git pull --ff-only`、build release、落位、restart、verify |
| [`infra/scripts/install-host-deps.sh`](../infra/scripts/install-host-deps.sh) | ECS 宿主机依赖补齐：按 `/etc/os-release` 自动选择 dnf / yum / apt 安装 Java、Node、pnpm、nginx、docker、ffmpeg 等 |
| [`infra/scripts/check-runtime-env.sh`](../infra/scripts/check-runtime-env.sh) | ECS runtime env 预检：检查 `/etc/aistareco/*.env`、关键密钥、SMS/OSS/CDN/sau 配置和 release manifest，不打印密钥值 |
| [`infra/rds/README.md`](../infra/rds/README.md) | RDS MySQL 8.0 创建 / 内网白名单 / 参数组 / Flyway baseline |
| [`infra/oss/README.md`](../infra/oss/README.md) | OSS Bucket / CDN 域名 / RAM 最小权限 / 生命周期规则 |
| [`infra/scripts/install-cjk-fonts.sh`](../infra/scripts/install-cjk-fonts.sh) | ECS 系统中文字体安装：Java2D / ffmpeg drawtext / headless browser 中文渲染兜底 |

**v0.8 新增部署需求**：mixcut 真后端要求生产环境装 ffmpeg：

```bash
# Ubuntu / Debian
sudo apt-get install -y ffmpeg

# 阿里云 CentOS / Alibaba Cloud Linux
sudo yum install -y ffmpeg ffmpeg-devel
```

并配置环境变量：`AEP_MIXCUT_OUTPUT_DIR` / `AEP_MIXCUT_WORK_DIR`（生产应指向有足够磁盘配额的卷）。

中文渲染要求 ECS 安装 CJK 字体；`install-host-deps.sh` / 部署脚本会默认执行
[`infra/scripts/install-cjk-fonts.sh`](../infra/scripts/install-cjk-fonts.sh)，`verify.sh` 会检查字体是否可用。

## 6. Figma 原型迁移 & 设计系统（"设计稿怎么落 / 长什么样"）

| 文档 | 用途 |
|---|---|
| [`.claude/skills/figma-migrate/SKILL.md`](../.claude/skills/figma-migrate/SKILL.md) | skill 入口：自动按"五件套 + 三端同步"模式落。**⚠️ 待更新**：原迁移目标 `apps/web`（含 `FIGMA_MIGRATION_GUIDE.md` / `specs/DESIGN_CONSTRAINTS.md`）已随 v0.109 删除，skill 内部路径仍指向 apps/web，重新启用前需先 retarget 到具体新 app |
| [`docs/design/celebrity/DESIGN.md`](../docs/design/celebrity/DESIGN.md) | **`apps/web-celebrity/` 子应用全域视觉系统真源** —— Creator-Friendly codify（tokens + 6 节 spec + 签名组件），对 apps/web-celebrity 整个子应用生效 |
| [`apps/web-aiavatar/DESIGN-desktop.md`](../apps/web-aiavatar/DESIGN-desktop.md) | **AI IP 工作台桌面面视觉系统文档真源**（v0.190 随并入从 web-ipstudio 迁来） —— 低饱和群青 + 麦黄双主色（token / 语义 / 实测对比度 / landing 与画布边界 / 图集素材契约）；改颜色前必读。色值代码真源是 `apps/web-aiavatar/src/styles/ip-desktop.css`（令牌挂 `.ip-surface` 而非 `:root`，Tailwind 用 `@theme inline` + `var()` 别名指过去、不复制 hex），故改色只动那一处 + 本文档 |
| [`.impeccable/celebrity/design.json`](../.impeccable/celebrity/design.json) | 上文的机器可读 sidecar（tonal ramps / shadows / motion / 完整组件 HTML+CSS 片段） |

## 7. 待办 / 已知问题

| 文档 | 用途 |
|---|---|
| [`TODO.md`](../TODO.md) | 当前未完成问题与候选计划；按 Studio、已定位问题、早期候选组织，重复条目已归并（last-reviewed 2026-10-13） |
| [TODO 历史记录 · 2026-10-13](archive/todo-2026-10-13.md) | 整理前完整快照、已完成记录、过时状态核对与重复条目去向；当前排期以根目录 TODO 为准（last-reviewed 2026-10-13） |
| [`docs/MATERIAL_OPS_AI_TEXT_PLAN.md`](MATERIAL_OPS_AI_TEXT_PLAN.md) | **已落地（v0.40）**：素材运营文本三件（脚本生成/卖点/变量抽取）接真 LLM —— 复用 `AiModelInvocationService.invokeChat`，prompt 建 `prompt_template` 表配置化；不引 agent 框架（last-reviewed 2026-05-29） |

**v0.10 候选**（mixcut 真素材化后的下一步）：

- OSS（Aliyun）存储替代本地 fs
- `/api/mixcut/**` 改 `.authenticated()`（当前 MVP permitAll）
- 视频自动缩略图（ffmpeg 抽帧首帧）
- drawtext + 中文字体（libfreetype + Source Han Sans）
- 像素水印 + SHA-256 文件哈希
- multi-worker 并发（Redis queue）
- 分片上传 / 断点续传（tus.io）

---

## 常见问答路径

| 我要做的事 | 入口 |
|---|---|
| 给 admin 加新页面 | [`apps/admin/README.md`](../apps/admin/README.md) → [`docs/ADMIN_PRODUCT_SPEC.md`](ADMIN_PRODUCT_SPEC.md) → `apps/admin/src/constants/nav.ts` |
| 修小程序 bug | [`apps/miniprogram/agent.md`](../apps/miniprogram/agent.md)（必读平台坑）→ [`apps/miniprogram/README.md`](../apps/miniprogram/README.md) |
| 给某子应用加新页面 / 模块 | 对应 [`apps/<sub>/PRODUCT.md`](../apps) → 改路由 sidebar → 写组件 → 改业务规格 |
| 加新接口 | 前端 `types/*` 改字段（真源）→ server `*Dto` → `specs/openapi.yaml` → 跑 `check:api-contract`；详见 [`AGENTS.md` §5](../AGENTS.md) |
| 看 AI 明星带货某功能怎么实现 | [`product_spec_ai_celebrity.md`](../product_spec_ai_celebrity.md)（找对应版本节）→ `apps/server/src/main/java/com/aistareco/aep/service/`（具体 service） |
| 看混剪专区怎么实现 | [`apps/web-celebrity/PRODUCT.md` §5](../apps/web-celebrity/PRODUCT.md) → `apps/server/src/main/java/com/aistareco/aep/service/mixcut/` |
| 部署到生产 | [`.claude/skills/aliyun-deploy/SKILL.md`](../.claude/skills/aliyun-deploy/SKILL.md) → [`infra/README.md`](../infra/README.md)；使用 `build-release.sh` / `deploy.sh` / GitHub Actions artifact 部署链路 |
| 修 admin auth/403 问题 | [`TODO.md`](../TODO.md) 的「安全 / Auth」待办；历史根因与修复过程见 [TODO 历史记录](archive/todo-2026-10-13.md) |
| 加新 LLM provider | `apps/server/.../service/AiModelInvocationService.java`（v0.5 仅 OPENAI/OPENAI_COMPATIBLE） |
| 配置 / 上下架 / 调价 | 进 admin（端口 3003），见 [`apps/admin/README.md`](../apps/admin/README.md) 当前可用菜单段 |
| 加新子产品（第 4 个 web-X） | 先看现有三个 PRODUCT.md（music / drama / celebrity）取经；走 pnpm workspace + Next 16 + Tailwind v4 模板 |

## 维护规则

- **加新文档**：必须同时更新本 INDEX
- **删旧文档**：先 `git grep -n '<filename>' -- '*.md'` 检查站内引用并改指；然后 `git rm`，依赖 git history 留底
- **大版本迭代**（如 v0.5.x → v0.6.0）：必须在同一 commit 同步更新：
  - `product_spec*.md` 版本节
  - 受影响 `apps/*/README.md`（版本日志）+ `PRODUCT.md`（功能新增）
  - `docs/VERSION_HISTORY.md` 追加新版本节（详尽日志）；`AGENTS.md` §7 仅维护「最近 5 版速览」表与 admin sidebar 启用状态
  - 本 INDEX 的 last-reviewed 日期
  - 详 [`AGENTS.md` §9 文档同步纪律](../AGENTS.md)
- **CLAUDE.md ↔ AGENTS.md**：CLAUDE.md 是 symlink，**不要单独修改**；改 AGENTS.md 即同步两者

- Studio 对话快照分享 v0.217：见 [助手范围](ip-studio-assistant-context.md) 与统一验证§28；last-reviewed: 2026-10-08，本地未发布。
- [模型接入端点并发与排队](ai-endpoint-generation-queue.md) · v0.220；last-reviewed: 2026-10-09，本地未发布。

- [Studio 生产发布与计价](ip-studio-production-release.md) · v0.228 定价快照、V48 迁移及上线记录；last-reviewed: 2026-10-10。

- [AiAvatar 账号与旧 Studio 界面统一](aiavatar-account-unification.md) · v0.230 桌面外壳、旧深链兼容与验收边界；last-reviewed: 2026-10-10。

- [个人资产库闭环验收](ip-studio-asset-library-validation.md) · 剧本内提取、快速完善与新画布引用；本地与生产验收通过，含 V52 和发布制品记录；last-reviewed: 2026-10-11。

- [复刻创作：全片创作拆解与视频拉片](ip-studio-recreation.md)：视频入口、报告契约、分段裁切、逐段Markdown及恐龙视频验收。last-reviewed: 2026-10-15。
- [视频拉片操作手册](training/studio-film-study.md)：6步实操截图，覆盖开始、进度、播放、文档编辑与导出。last-reviewed: 2026-10-15。
- [视频拉片技术分享：媒体工程、模型理解、成本与音频补全](studio-film-study-technical-sharing-20261017.md)：程序／LLM分工、资源与积分、模型候选；拉片仅提取原声，字幕等后续放在音频节点，含本地实施与验收边界。last-reviewed: 2026-10-17。
- [Studio原声提取发布](studio-source-audio-release-20261017.md)：本次提交与制品、用户视频的已有媒体结果、直接发布及未追加业务验收边界。last-reviewed: 2026-10-17。

- [企业生成入口与扣费引用](ip-studio-enterprise-generation-entry-map.md)
- [企业产品场景端到端验收](ip-studio-enterprise-scenario-acceptance.md)
- [企业发布准备与回退](ip-studio-enterprise-release-readiness.md)
- [企业完整界面验收](ip-studio-enterprise-ui-validation.md)

- [视频解析与拉片生产发布](studio-film-study-production-release.md)：版本、独立媒体运行时、验收范围与备份。

- [项目与灵感统一封面验收](studio-shared-covers-validation-20261017.md)：共用优先级、独立上传、恢复自动、权限与本地检查；已发布 a4092626（last-reviewed: 2026-10-17）。
- [统一画布封面生产发布](studio-shared-covers-production-20261017.md)：a4092626 两服务上线、真实封面验收与回退；已发布（last-reviewed: 2026-10-17）。
