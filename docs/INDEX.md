# 文档索引 · INDEX

> 单页地图。任何 agent / 新人进仓库先开本文，按「想做什么」找到对应真源。
> last-reviewed：**2026-10-18**（文档整理：`docs/` 分出 `runbooks/` / `audits/` / `archive/` 三个子目录，去掉 `[Fabel5]` 前缀，
> 根目录 `DEPLOYED.md` 并入 clip 方案；上一次内容性更新是 2026-10-07 / v0.201）。

**目录约定**（新文档按这个放，细则见 [`AGENTS.md` §9](../AGENTS.md)）：

| 位置 | 放什么 | 文件名 |
|---|---|---|
| `docs/*.md` | **现行设计真源**（还在指导代码的方案）+ 本索引 + 版本历史 | kebab-case，不加 `[xxx]` 前缀 |
| `docs/runbooks/` | 运维 / 联调**操作手册**（照着做就行的） | kebab-case |
| `docs/audits/` | 带日期的**一次性审计 / 调研**，写完不再改 | `xxx-YYYY-MM.md` |
| `docs/archive/` | **已落地或已被取代**的方案、关闭的 TODO 段；顶部一行写明现行真源在哪 | 原名 |
| `docs/design/` | 子应用视觉系统（目前只有 celebrity；其他 app 的 `DESIGN*.md` 在各自目录） | — |

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
| [`infra/README.md`](../infra/README.md) ★ | 阿里云 ECS + RDS + OSS 部署**单一真值源**：拓扑、环境拉起 SOP、env / nginx / systemd 索引、§5 vhost 与证书硬规则 |
| [`.claude/skills/aliyun-deploy/SKILL.md`](../.claude/skills/aliyun-deploy/SKILL.md) | agent 部署技能：本地 artifact / 按应用 / GitHub Actions 三条链路 + 验证排障 |
| [`infra/rds/README.md`](../infra/rds/README.md) · [`infra/oss/README.md`](../infra/oss/README.md) | RDS 创建 / 白名单 / Flyway baseline；OSS Bucket / CDN / RAM / 生命周期 |
| `infra/scripts/update-and-deploy.sh` · `install-host-deps.sh` · `check-runtime-env.sh` · `install-cjk-fonts.sh` | ECS 一键更新、宿主依赖、runtime env 预检、中文字体 |
| [`docs/runbooks/alipay-sandbox.md`](runbooks/alipay-sandbox.md) | 支付宝直连沙箱本地联调：拿凭证 → 配置 → 查单兜底 / 公网回调 → 上生产换 4 项 |
| [`docs/runbooks/impersonation.md`](runbooks/impersonation.md) | 附身登录：管理员以用户身份进五个产品的工作台 |

## 6. 审计 / 调研（带日期的一次性报告，写完不再改）

| 文档 | 结论一句话 |
|---|---|
| [`docs/audits/drama-audit-2026-07.md`](audits/drama-audit-2026-07.md) | web-drama 产品 × 架构审计：一致性引擎五层架构 + C 序列路线图；后续全部由 [`drama-consistency-engine-design.md`](drama-consistency-engine-design.md) 落地 |
| [`docs/audits/payment-billing-audit-2026-07.md`](audits/payment-billing-audit-2026-07.md) | 支付 / 计费 / 积分账本全栈审计：33 项 Findings、决策台账 D1–D8、T1–T17 任务卡 |
| [`docs/audits/admin-alignment-audit-2026-06.md`](audits/admin-alignment-audit-2026-06.md) | admin ↔ server ↔ 子应用三端对齐审计：10 项全部处置；文末「长期防 drift 约定」仍有效 |
| [`docs/audits/face-beauty-research-2026-06.md`](audits/face-beauty-research-2026-06.md) | 形象精调 / 美颜方案调研：浏览器端确定性美颜（已采纳）vs 云 API vs i2i |

## 7. 待办与归档

| 文档 | 用途 |
|---|---|
| [`TODO.md`](../TODO.md) ★ | 已定位未修的问题 + 候选排期，**只留还有未勾项的段**；维护纪律见 AGENTS.md §9 |
| [`docs/archive/todo-closed.md`](archive/todo-closed.md) | 从 TODO.md 整段移出的已关闭段（条目原样保留） |
| [`docs/archive/ip-studio-generalize-proposal.md`](archive/ip-studio-generalize-proposal.md) | IP 工作台「一个提示词框 + 模板库」提案，v0.153 已落地；留「为什么改」 |
| [`docs/archive/aiavatar-asset-platform-plan-2026-07.md`](archive/aiavatar-asset-platform-plan-2026-07.md) | 2026-07 数字资产平台定位分析，被 asset-hub-redesign 取代 |
| [`docs/archive/material-ops-ai-text-plan.md`](archive/material-ops-ai-text-plan.md) | 素材运营文本三件接真 LLM，v0.40 已落地 |
| [`docs/archive/aiavatar-progress-2026-05.md`](archive/aiavatar-progress-2026-05.md) | 首版 AiAvatar 实施台账；文中 `aiavatar_*` 表已删（V8），只作历史 |

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
