# 文档索引 · INDEX

> 单页地图。任何 agent / 新人进仓库时先开本文。
> 按"想做什么"组织：先选场景，再跳到对应的真源文档。
> last-reviewed：2026-05-15 / v0.5.4 + 三子产品拆分 Phase 4b 完成（music / drama / celebrity 全部路由生产级化）

> ⚠️ **正在进行：monorepo 拆为三个独立 web app**。新代码（`apps/web-music` / `apps/web-drama` / `apps/web-celebrity` + `packages/*`）走 Next 16 + React 19 + pnpm；遗留 `apps/web`、`apps/admin`、`apps/server` 不动。详见 [`CLAUDE.md`](../CLAUDE.md) 顶部警告块与 plan 文件 `/Users/donis/.claude/plans/ethereal-petting-cosmos.md`。

---

## 1. 产品 / 业务规格（"产品要什么"）

| 文档 | 范围 | 当前状态 |
|---|---|---|
| `product_spec.md` | **数字人 / 数字 IP 主线** —— 数字艺人孵化、音乐工坊、内容（影视/综艺/广告/配音）、社群、版权、分发、变现 | v2.7 canonical（2026-05-06） |
| `product_spec_ai_celebrity.md` | **AI 明星带货主线** —— 明星市场、授权、模板/脚本、AI 模型、生成器、积分钱包、消息中心 | v0.5.x rolling（2026-05-08 起按版本日志追加） |
| `docs/ADMIN_PRODUCT_SPEC.md` | **运营后台规划** —— 全配置化终态规划（含 ConfigItem / 灰度 / AB 桶 / 17 个字典上移） | 大目标稿；当前 admin 是其 P0 子集 |

不动产品规格的方向时不必读 §3 ~ §7。

## 2. 工程协议（"代码该怎么写"）

| 文档 | 给谁看 | 一句话 |
|---|---|---|
| `CLAUDE.md` | Claude Code agent 入仓库第一份必读 | 快速 SOP + 致命陷阱 + 真源指针 |
| `AGENTS.md` | 同上的"详细版" | 三端架构 + 领域对齐表 + 「v0.5 增量」节 + 文档同步纪律 |
| `apps/miniprogram/agent.md` | 任何在小程序目录工作的 agent | 微信平台坑（iOS/Android 差异、custom-tab-bar、CSS、setData、轮询清理） |
| `.claude/skills/figma-migrate/SKILL.md` | 触发 figma-migrate skill 时 | 五件套 + 三端同步 SOP |

新人 agent 顺序：CLAUDE.md → AGENTS.md → 对应的 apps/*/README.md。

## 3. 接口契约（"前后端怎么对齐"）

| 文档 | 用途 |
|---|---|
| `specs/openapi.yaml` | **唯一接口契约**（180+ paths）。CI 守门：`(cd apps/web && npm run check:api-contract)` |
| `specs/BUSINESS_RULES.md` | openapi 表达不了的业务规则：扣分公式、状态机时序、敏感词、错误码 |

新增 / 修改接口时：先改 `apps/web/src/types/*`（真源）→ 改 `apps/server/.../*Dto` → 改 `specs/openapi.yaml` → CI 自动验。

## 4. 各应用 README（"启动 / 目录 / 版本日志"）

| 文档 | 一句话 | 当前版本 |
|---|---|---|
| `apps/server/README.md` | Spring Boot 8080 / Profile / 角色体系 / **v0.5 新增表** / **AEP_SECRET_KEY 环境变量** | v0.5.4 同步 |
| `apps/web/README.md` | Next.js 用户端 3002 / 完整版本日志（v1.x ~ v2.7） | v2.7（v0.5.x 不影响 web）；**Phase 5 删除** |
| `apps/admin/README.md` | Next.js 运营后台 3003 / 当前 sidebar / v0.5.x 滚动更新 | v0.5.4 |
| `apps/miniprogram/README.md` | 微信小程序（带货方）/ 11 屏 / 启动方式 / 版本日志 | v0.5.4 |
| `apps/web-music/README.md` ★ | **AI 音乐人独立 web app**（Next 16，dev 3010） | Phase 4b 完成；路由生产级化 + README 落地（v0.6 · 2026-05-15）|
| `apps/web-drama/README.md` ★ | **AI 短剧独立 web app**（Next 16，dev 3011） | Phase 4b 完成；17 个 page 全交互化（v0.6 · 2026-05-14）|
| `apps/web-celebrity/README.md` ★ | **AI 明星带货独立 web app**（Next 16，dev 3012） | Phase 4b 完成；celebrity-zone 33 组件迁入 + README 落地（v0.6 · 2026-05-15）|

**packages/**（pnpm workspace 共享层；三个新 web app 消费，apps/web 与 apps/admin 不消费）：
- `packages/types/` — TS 类型契约
- `packages/ui/` — shadcn + ThemeProvider + globals.css
- `packages/api-client/` — apiFetch + AuthProvider + format
- `packages/landing/` — ProductLanding 原语

## 5. 部署 / 运维（"上线怎么部署"）

| 文档 | 用途 |
|---|---|
| `DEPLOYMENT.md` | 47.94.102.182 当前线上部署基线 + 增量部署 SOP + **v0.5 部署变更（AEP_SECRET_KEY、新 admin 路径）** |
| `.claude/skills/aistareco-deploy/SKILL.md` | 触发 deploy skill 时使用；当前是 v0.4 期版本，v0.6 真生产部署时再大改 |
| `.claude/skills/aistareco-deploy/references/production.md` | 同上的引用 |

## 6. Figma 原型迁移（"设计稿怎么落"）

| 文档 | 用途 |
|---|---|
| `apps/web/FIGMA_MIGRATION_GUIDE.md` | figma → web 的迁移手册 |
| `apps/web/specs/DESIGN_CONSTRAINTS.md` | 设计约束（视觉/交互） |
| `.claude/skills/figma-migrate/SKILL.md` | skill 入口：自动按"五件套 + 三端同步"模式落 |

## 7. 待办 / 已知问题

| 文档 | 用途 |
|---|---|
| `TODO.md` | 已定位但未修的问题清单 + **v0.6 候选**（engine-pricing 落表 / WebSocket / OSS 上传 / 配置中心 / 角色拆分 等）+ **三子产品 web app 待办**（CG-* / M-* / D-* / C-*，2026-05-15 起合并自各 README） |

---

## 常见问答路径

| 我要做的事 | 入口 |
|---|---|
| 给 admin 加新页面 | `apps/admin/README.md` → `docs/ADMIN_PRODUCT_SPEC.md`（规划） → `apps/admin/src/constants/nav.ts` |
| 修小程序 bug | `apps/miniprogram/agent.md`（必读平台坑）→ `apps/miniprogram/README.md` |
| 加新接口 | `apps/web/src/types/*` 改字段（真源）→ server `*Dto` → `specs/openapi.yaml` → 跑 `check:api-contract` |
| 看 AI 明星带货某功能怎么实现 | `product_spec_ai_celebrity.md`（找对应版本节）→ `apps/server/src/main/java/com/aistareco/aep/service/`（具体 service） |
| 部署到生产 | `DEPLOYMENT.md` → 注意 `AEP_SECRET_KEY` 必配 |
| 修 admin auth/403 问题 | `TODO.md` 第一节（仍未做） |
| 加新 LLM provider | `apps/server/.../service/AiModelInvocationService.java`（v0.5 仅 OPENAI/OPENAI_COMPATIBLE） |
| 配置 / 上下架 / 调价 | 进 admin（端口 3003），见 `apps/admin/README.md` 当前可用菜单段 |

## 维护规则

- **加新文档**：必须同时更新本 INDEX。
- **删旧文档**：先 `git grep -n '<filename>' -- '*.md'` 检查站内引用并改指；然后 `git rm`，依赖 git history 留底。
- **大版本迭代**（如 v0.5.x → v0.6.0）：必须在同一 commit 同步更新 `product_spec*.md` 版本节 + 受影响 `apps/*/README.md` + `AGENTS.md` 增量节 + 本 INDEX 的 last-reviewed 日期。详 `CLAUDE.md` / `AGENTS.md` / `apps/miniprogram/agent.md` 的「文档同步纪律」段。
