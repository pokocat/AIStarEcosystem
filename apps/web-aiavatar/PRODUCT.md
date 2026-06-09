# Product

> AiAvatar · 数字人资产平台（web-aiavatar）的战略层文档。
> 本文件回答「谁 / 做什么 / 为什么」；视觉「长什么样」见 [DESIGN.md](DESIGN.md)；
> 技术启动与版本日志见 [README.md](README.md)；落地取舍见 [DECISIONS.md](DECISIONS.md)。
> 三者分工：PRODUCT = 战略，DESIGN = 视觉，README/DECISIONS = 技术 / 架构记录。

## Register

product

## Users

**主要用户**：内容创作者与数字 IP 运营者（音乐人、短剧团队、带货商家）。使用语境是**手机上、碎片时间**，形态为移动端 H5 / 微信小程序的全屏沉浸式 SPA。

**要做的事（job-to-be-done）**：把一个数字人沉淀成**可复用、带版本、带授权**的资产，然后一键接入下游子应用（音乐 / 短剧 / 带货）去变现。

**两条创建路径**：
- **真人授权复刻** —— 录制引导 → 倒计时录制 → 身份核验 → 选音色 → 保存并登记肖像授权。
- **纯 AI 原创** —— 上传照片 或 文字描述 → 四宫格挑选 → 推荐音色 → 保存。

资产一旦定稿，形象 / 声音 / 衍生物（图集 · 表情 · 场景 · 换装 · 3D · 运镜视频）一站式沉淀，可被下游 app 反复复用而无需重新生成。

## Product Purpose

**是什么**：移动端「数字人资产平台」—— 把分散的 AI 生成能力（形象生成、声音克隆、衍生物产出）收敛成一个「资产沉淀 + 复用」的中枢。

**为什么存在**：下游子应用都需要「可信、可复用、带授权」的数字人形象。与其每个 app 各自生成、各自管理，不如有一个统一的资产中枢：一次创建、处处复用、版本可追、授权可查。

**成功长什么样**：创作者能在手机上几分钟内创建一个数字人、定稿形象、生成所需衍生物，并把它授权接入某个下游 app；同一资产被反复复用而零重复生成；每个产物都诚实标注（真产物 vs 占位）。

## Brand Personality

**三词**：清爽（clean / airy）· 档案感（archival / precise）· 可信（trustworthy）。

**声音与语气**：去黑话、口语化中文、不画大饼。文案诚实（状态用「已就绪」而非技术黑话；占位产物明示 mock，绝不假装成功）。

**情绪目标**：让创作者同时感到「专业的工坊」与「严谨的登记处」—— 既有创作的温度（衬线资产名），又有台账的精确（登记号 / 版本 / 授权）。对应 DESIGN.md 的创意北极星 **「The Atelier Ledger」（工坊台账）**。

## Anti-references

明确**不要**做成：

- **不是深色 SaaS 仪表盘**。不靠 dark-mode 炫技；这是纸白移动端工具，不是控制台。
- **不是彩虹分类**。衍生物 / 资产类型**不**各配一色；V4「清爽」皮肤已把分类收敛为单一墨灰 + 图标区分（见 DESIGN.md 的 Collapsed-Rainbow Rule）。
- **不是套壳演示预览**。已删除 iPhone 外壳 / 伪微信胶囊 / 伪状态栏 / 伪 home 指示条；用真实安全区，是能投产的 H5，不是手机模型截图（DECISIONS §F）。
- **不套用共享 shadcn 设计系统**。强行套用 `@ai-star-eco/ui` 会摧毁 HeyGen 风视觉语言；本 app 自带 `src/proto/*` 设计层（DECISIONS §A）。
- **不用浏览器原生 `confirm` / `alert` / `prompt`**。二次确认走 `Confirm` 弹窗，提示走 toast / inline error（仓库 CLAUDE.md §8 强制）。
- **不伪装能力**。未配引擎 / 调用失败 → 占位产物 + `mock=true` 角标 + 不扣费；绝不假装成功、绝不返回假内容（CLAUDE.md §8.0）。

## Design Principles

1. **资产即档案（Asset as dossier）**。每个数字人是被登记、编号、版本化、授权化的资产。登记处的仪式感（登记号 · 衬线资产名 · 字段标签 · 归档钢印）是产品骨架，不是装饰。

2. **诚实优先，绝不伪装（Honesty over illusion）**。降级必须可见（mock 角标）、不扣费、不造假内容。能力没接通就明说「去后台哪里配什么」，不端上假产物冒充真产物。

3. **Mock 是一等公民（Mock is first-class）**。所有流程离线可演示。唯一数据出入口是 `src/proto/api.ts`；从 mock 切真后端只改 `NEXT_PUBLIC_USE_MOCK`，屏幕层零改动。

4. **真实可投产，而非演示（Ship a product, not a preview）**。真安全区、真永久链接（hash 路由随导航写回 URL）、真返回栈、真下拉刷新。去掉一切「演示壳」与原型残留。

5. **忠实还原优于过早抽象（Fidelity before abstraction）**。忠实移植上传规格 + Figma 原型；用松类型的 `createElement` 屏幕层换取最大设计还原度与最低回归风险，类型契约集中在 `data.ts` / `api.ts`。

6. **确定性保身份（Deterministic, identity-preserving）**。涉及人脸 / 身份的编辑优先端上确定性算法（MediaPipe 关键点 + WebGL 实时美颜，像素级可复算、保身份），而非不可控、会漂移身份的扩散重绘。

## Accessibility & Inclusion

**现状为 de-facto 姿态，尚无正式 WCAG 等级承诺**；以下含已落地项与候选改进。

- **触控优先**：输入控件高 44px；可点元素 `user-select:none` + 禁长按菜单。⚠️ viewport 禁缩放（`maximumScale:1, userScalable:false`）对低视力用户是 trade-off，列为已知点待复评。
- **动效健壮 + 可关**：入场动画只动 `transform`（被节流 / 截图 / 打印时不会消失）；动画由 `html.anim` 类整体门控，具备「一键关闭」基础。⚠️ 候选：显式接 `prefers-reduced-motion` 自动摘除 `html.anim`。
- **不靠颜色单独传意**：分类靠**图标**区分而非颜色（对色盲友好）；语义状态（成功 / 警告 / 错误）均带图标 + 文案。正文深石板墨（#14202B）on 纸白，对比充足。
- **语言**：中文单语（符合仓库约定）。
- **安全区**：刘海屏 / home 指示条用真实 `env(safe-area-inset-*)`，加入主屏后接近原生 app。
