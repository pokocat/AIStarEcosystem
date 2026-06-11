# 明星商务工作台 · 产品 & 设计约束

> 源规格：《明星端工作台 · 产品文档 v3.0》（AI 艺人孵化平台 · 明星 IP 端）。
> 本文件是 web-star 的产品真值；技术 onboarding 见 [README.md](README.md)。

## 1. 产品定位

明星本人 / 经纪团队的核心审核与运营中枢，承担 IP 资产托管、授权审核、内容把关、
商品准入、品牌合作与收益结算的全链路管控。明星端**不直接产出内容**，但所有内容、
账号、商品、品牌合作必须经其审批阀门，方可在创作者端（web-celebrity）流转。

三方协同：明星端（本端）⇄ 生态创业者端（web-celebrity 创作者）⇄ 粉丝端。

## 2. 模块清单（13 + 1）

| 路由 | 模块 | 要点 |
|---|---|---|
| /dashboard | 总览 | KPI×6、IP 链路图、待办聚合（badge 与左导航联动） |
| /ip-auth | IP 授权中心 | 4 类资产（人像/切片/数字人/法务）× 6 状态机 notStarted→…→active；火山引擎回执 volcanoProjectId |
| /cooperation | 带货授权 ★ | celebrity 创作者授权申请审批；批准设场景/时长/风格；后端即 CelebrityStarAuthorization |
| /whitelist | 账号报白 | 5 步 received→contacting→sms→processing→authorized；报白参数一键复制；信用分展示 |
| /digital-human | 数字人授权 | 用途三选 live/shortVideo/ads + 平台白名单 + 时长 |
| /ai-likeness | AI 形象授权 | 模型三选 voice/face/fullBody；低/中/高三级风控（高风险强制批准需谨慎提示） |
| /content-review | 内容审核 | 四态 pending/approved/revision/rejected；revision 带意见回流 MCN 返工 |
| /product-onboard | 商品入库 ★ | 三源（平台/达人/品牌）6 步流程；双重寄样（平台路+明星路）均 approved 才入库 |
| /product-library | 商品库 | step=5 入库单派生；销量进度条 |
| /brand-auth | 品牌授权 | pending→platformReview→celebReview→sampleStage→approved；双向寄样 |
| /revenue | 收益分成 | 累计/本月 GMV、待结算/已结算；Recharts AreaChart 月度趋势；T+1 月 15 日打款 |
| /rules | 内容规则 | 绿/黄/橙/红四区启停；改动立即生效（已审项不回溯） |
| /infringement | 侵权巡查 | 全网监测；pending→investigating→confirmed→resolved；dismiss=误报 |
| /contracts | 合同中心 | 授权合同/补充协议/结算单；搜索+双筛选；30 天到期提醒 |

★ = 与 web-celebrity 打通的核心模块（见 README「打通」表）。

## 3. 状态机原则

凡流程实体（IP 授权 / 报白 / 商品入库 / 品牌授权 / 寄样）均为**只前进不回退**的
有向状态机；驳回（rejected）与回改（revision）是终态分支，需重新发起单据，
不在原单回滚 —— 保证审计链完整。

## 4. 设计约束（浅色 light 主题）

- **基调**：白底浅色为默认（画布 `--bg-0 #f7f6f3`、卡片暖近白），文本近黑
  `--ink-0 #1c1917`；品牌强调 = 红黑灰系列感 + 星光金（`--gradient-star`
  amber→red 仅用于品牌星标，不用于文字）。
- **模块 accent**：每个模块保留 Figma 原型的彩色 accent（indigo IP / rose 带货 /
  cyan 报白 / purple 数字人 / pink AI 形象 / orange 内容 / green 入库 / teal 商品库 /
  blue 品牌 / yellow 收益 / gray 规则 / red 侵权 / emerald 合同），白底上以
  `${color}14` pastel 背景 + 500/600 系文本呈现。
- **卡片**：`star-card`（rounded-2xl + 细边 + 柔影），hover 上浮 `star-card-hover`。
- **动效**：仅状态反馈（toggle、弹层进场、hover）；**禁止**页面加载编排 / 列表
  stagger；弹层进场走 tw-animate CSS，关闭即时卸载（React 19 下不用
  AnimatePresence exit）。
- **图标**：全部 lucide，禁 emoji。
- **弹层**：page-kit `<Modal>`（输入采集 / 二次确认），禁原生 confirm/alert/prompt。
- **可访问性**：全局 `:focus-visible` 焦点环；`prefers-reduced-motion` 停用动画；
  状态不只靠颜色（图标 + 文案并行）。
- **响应式**：≥1024 侧导航 240px；<1024 折叠为顶部横向 Tab（活跃模块自动滚动居中 +
  右端「全部」按钮打开分组模块抽屉，解决 14 模块横滑发现性）。
- **移动端（<640）**：弹层一律底部抽屉形态（全宽 + 仅上圆角 + 安全区 padding，footer
  按钮按内容比例占满整行）；卡片操作条用 page-kit `<CardActions>`（提示独占一行 +
  按钮整行伸展）；主操作触控高度 ≥44px、筛选 chip ≥38px，小控件用 `touch-hit` 扩展
  命中区；表单控件字号强制 16px 防 iOS 聚焦缩放；hover-only 可供性（如复制图标）触屏常显。
- **移动端禁横滑原则（<sm）**：除顶部模块 Tab 外不引入横向滚动 —— KPI 卡竖排（标签行→
  数值→副文，杜绝截断）；链路/流程图（IP 链路、传递链路、品牌审核链）折叠为 2×2 或
  N 等分网格（序号标记顺序）；步骤图例 `<sm` 隐藏，由卡内紧凑进度条 + 当前步标签承担；
  多组 chips 筛选 `<sm` 收口为原生 `<select>`（带计数）一行放下；视口高度一律 `dvh`。
- **数值**：一律原始整数（fans / priceCents / amountCents / durationSec…），
  展示经 `src/lib/format.ts`（formatWan / formatYuan / formatWanYuan /
  formatDurationZh / formatMonthsZh）。

## 5. Mock / 真后端

`NEXT_PUBLIC_USE_MOCK=1` 时 `api/star-workbench.ts` 全部命中内存 store
（`mocks/star-workbench.ts`，Figma 原型同源数据，人设「于震」），状态机操作真实
生效可演示；`=0` 时走 `/api/star/**`（绑定明星档案由 JWT principal 解析，
人设来自 server seed「沈腾」）。

## 6. 索引

- 后端契约：[`specs/openapi.yaml`](../../specs/openapi.yaml)（star tag）
- 域类型真源：[`packages/types/src/star-workbench.ts`](../../packages/types/src/star-workbench.ts)
- 跨端打通规格：README「与 web-celebrity 的打通」
