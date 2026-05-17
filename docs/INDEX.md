# 文档索引 · INDEX

> 单页地图。任何 agent / 新人进仓库时先开本文。
> 按"想做什么"组织：先选场景，再跳到对应的真源文档。
> last-reviewed：2026-05-17 / v0.8 + 文档结构重构（CLAUDE.md ↔ AGENTS.md 单点 + 三子应用 PRODUCT.md 落地 + mixcut 真后端沉淀）

> ⚠️ **正在进行：monorepo 拆为三个独立 web app**。新代码（`apps/web-music` / `apps/web-drama` / `apps/web-celebrity` + `packages/*`）走 Next 16 + React 19 + pnpm；遗留 `apps/web`、`apps/admin`、`apps/server` 不动。详见 [`AGENTS.md`](../AGENTS.md) §1 顶部进度表。

---

## 1. 产品 / 业务规格（"产品要什么"）

### 1.1 跨子产品规格（仓库根）

| 文档 | 范围 | 当前状态 |
|---|---|---|
| [`product_spec.md`](../product_spec.md) | **数字人 / 数字 IP 主线** —— 数字艺人孵化、音乐工坊、内容（影视/综艺/广告/配音）、社群、版权、分发、变现 | v2.7 canonical（2026-05-06） |
| [`product_spec_ai_celebrity.md`](../product_spec_ai_celebrity.md) | **AI 明星带货主线** —— 明星市场、授权、模板/脚本、AI 模型、生成器、积分钱包、消息中心 | v0.5.x rolling（2026-05-08 起按版本日志追加） |
| [`docs/ADMIN_PRODUCT_SPEC.md`](ADMIN_PRODUCT_SPEC.md) | **运营后台规划** —— 全配置化终态（ConfigItem / 灰度 / AB 桶 / 17 个字典上移） | 大目标稿；当前 admin 是其 P0 子集 |

### 1.2 子应用产品 + 设计约束（每 app 一份）

| 文档 | 子产品 | 真源覆盖 |
|---|---|---|
| [`apps/web-music/PRODUCT.md`](../apps/web-music/PRODUCT.md) ★ | AI 音乐人（3010） | 产品定位 / 路由 / 业务领域 / 视觉系统（Restrained dark + Inter） |
| [`apps/web-drama/PRODUCT.md`](../apps/web-drama/PRODUCT.md) ★ | AI 短剧（3011） | 产品定位 / 路由 / 业务领域 / 视觉系统（Premium Cinematic + 金色 accent + serif） |
| [`apps/web-celebrity/PRODUCT.md`](../apps/web-celebrity/PRODUCT.md) ★ | AI 明星带货（3012） | 产品定位 / 路由 / 业务领域 / 视觉系统（Creator-Friendly + 紫罗兰）+ **混剪专区完整设计** |

不动产品规格的方向时不必读 §3 ~ §7。

## 2. 工程协议（"代码该怎么写"）

| 文档 | 给谁看 | 一句话 |
|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | **统一 agent 入口**（Claude Code / Cursor / Aider / Continue / 自建 SDK） | 项目概览 + 三端架构 + 硬规则 + 新增领域 SOP + v0.5-0.8 增量 + 文档同步纪律 |
| [`CLAUDE.md`](../CLAUDE.md) | Claude Code（自动注入） | **symlink → AGENTS.md**（单点维护，内容等同 AGENTS.md） |
| [`apps/miniprogram/agent.md`](../apps/miniprogram/agent.md) | 任何在小程序目录工作的 agent | 微信平台坑（iOS/Android 差异、custom-tab-bar、CSS、setData、轮询清理） |
| [`.claude/skills/figma-migrate/SKILL.md`](../.claude/skills/figma-migrate/SKILL.md) | 触发 figma-migrate skill 时 | 五件套 + 三端同步 SOP |

新人 agent 顺序：**AGENTS.md** → 对应的 `apps/<sub-app>/PRODUCT.md` → `apps/<sub-app>/README.md`（启动 + 版本日志）。

## 3. 接口契约（"前后端怎么对齐"）

| 文档 | 用途 |
|---|---|
| [`specs/README.md`](../specs/README.md) ★ | **接口契约索引**：openapi.yaml + BUSINESS_RULES.md 关系、186 paths 分组、CI 守门规则、wire 命名规范 |
| [`specs/openapi.yaml`](../specs/openapi.yaml) | **唯一接口契约**（186 paths）。CI 守门：`(cd apps/web && npm run check:api-contract)` |
| [`specs/BUSINESS_RULES.md`](../specs/BUSINESS_RULES.md) | openapi 表达不了的业务规则：字段校验 / 计算公式 / 状态机 / 错误码 |

新增 / 修改接口时：先改前端 `types/*`（真源）→ 后端 `*Dto` → `specs/openapi.yaml` → CI 自动验。**v0.8 例外**：`/api/mixcut/*` 用 snake_case wire，详见 [`apps/web-celebrity/PRODUCT.md` §5.6](../apps/web-celebrity/PRODUCT.md)。

## 4. 各应用 README（"启动 / 目录 / 版本日志"）

| 文档 | 一句话 | 当前版本 |
|---|---|---|
| [`apps/server/README.md`](../apps/server/README.md) | Spring Boot 8080 / Profile / 角色体系 / **v0.5 新增表** / **AEP_SECRET_KEY 环境变量** | v0.5.4 同步 |
| [`apps/web/README.md`](../apps/web/README.md) | Next.js 用户端 3002 / 完整版本日志（v1.x ~ v2.7） | v2.7（v0.5.x 不影响 web）；**Phase 5 删除** |
| [`apps/admin/README.md`](../apps/admin/README.md) | Next.js 运营后台 3003 / 当前 sidebar / v0.5.x 滚动更新 | v0.5.4 |
| [`apps/miniprogram/README.md`](../apps/miniprogram/README.md) | 微信小程序（带货方）/ 11 屏 / 启动方式 / 版本日志 | v0.5.4 |
| [`apps/web-music/README.md`](../apps/web-music/README.md) | **AI 音乐人**（Next 16，dev 3010）启动 / 技术栈 / 版本日志 | Phase 4b（v0.6 · 2026-05-15）— 产品/设计约束见 [`PRODUCT.md`](../apps/web-music/PRODUCT.md) |
| [`apps/web-drama/README.md`](../apps/web-drama/README.md) | **AI 短剧**（Next 16，dev 3011）启动 / 技术栈 / 版本日志 | Phase 4b（v0.6 · 2026-05-14）— 产品/设计约束见 [`PRODUCT.md`](../apps/web-drama/PRODUCT.md) |
| [`apps/web-celebrity/README.md`](../apps/web-celebrity/README.md) | **AI 明星带货**（Next 16，dev 3012）启动 / 技术栈 / 版本日志（含 mixcut v0.7-0.8） | v0.8（2026-05-17）— 产品/设计约束见 [`PRODUCT.md`](../apps/web-celebrity/PRODUCT.md) |

**packages/**（pnpm workspace 共享层；三个新 web app 消费，apps/web 与 apps/admin 不消费）：
- `packages/types/` — TS 类型契约
- `packages/ui/` — shadcn + ThemeProvider + globals.css
- `packages/api-client/` — apiFetch + AuthProvider + format
- `packages/landing/` — ProductLanding 原语

> 共享包暂无独立 README；用法见各 PRODUCT.md「组件分层」段。

## 5. 部署 / 运维（"上线怎么部署"）

| 文档 | 用途 |
|---|---|
| [`DEPLOYMENT.md`](../DEPLOYMENT.md) | 47.94.102.182 当前线上部署基线 + 增量部署 SOP + **v0.5 部署变更（AEP_SECRET_KEY、新 admin 路径）** |
| [`.claude/skills/aistareco-deploy/SKILL.md`](../.claude/skills/aistareco-deploy/SKILL.md) | 触发 deploy skill 时使用；当前是 v0.4 期版本，v0.6 真生产部署时再大改 |

**v0.8 新增部署需求**：mixcut 真后端要求生产环境装 ffmpeg：

```bash
# Ubuntu / Debian
sudo apt-get install -y ffmpeg

# 阿里云 CentOS / Alibaba Cloud Linux
sudo yum install -y ffmpeg ffmpeg-devel
```

并配置环境变量：`AEP_MIXCUT_OUTPUT_DIR` / `AEP_MIXCUT_WORK_DIR`（生产应指向有足够磁盘配额的卷）。

## 6. Figma 原型迁移（"设计稿怎么落"）

| 文档 | 用途 |
|---|---|
| [`apps/web/FIGMA_MIGRATION_GUIDE.md`](../apps/web/FIGMA_MIGRATION_GUIDE.md) | figma → web 的迁移手册 |
| [`apps/web/specs/DESIGN_CONSTRAINTS.md`](../apps/web/specs/DESIGN_CONSTRAINTS.md) | 设计约束（视觉/交互） |
| [`.claude/skills/figma-migrate/SKILL.md`](../.claude/skills/figma-migrate/SKILL.md) | skill 入口：自动按"五件套 + 三端同步"模式落 |

## 7. 待办 / 已知问题

| 文档 | 用途 |
|---|---|
| [`TODO.md`](../TODO.md) | 已定位但未修的问题清单 + **v0.6 候选**（engine-pricing 落表 / WebSocket / OSS 上传 / 配置中心 / 角色拆分 等）+ **三子产品 web app 待办**（CG-* / M-* / D-* / C-*） |

**v0.9 候选**（mixcut 真后端的下一步）：

- OSS（Aliyun）存储替代本地 fs
- `/api/mixcut/**` 改 `.authenticated()`（当前 MVP permitAll）
- drawtext + 中文字体（libfreetype + Source Han Sans）
- 像素水印 + SHA-256 文件哈希
- multi-worker 并发（Redis queue）

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
| 部署到生产 | [`DEPLOYMENT.md`](../DEPLOYMENT.md) → 注意 `AEP_SECRET_KEY` 必配；**v0.8 起注意 ffmpeg + AEP_MIXCUT_*** |
| 修 admin auth/403 问题 | [`TODO.md`](../TODO.md) 第一节 |
| 加新 LLM provider | `apps/server/.../service/AiModelInvocationService.java`（v0.5 仅 OPENAI/OPENAI_COMPATIBLE） |
| 配置 / 上下架 / 调价 | 进 admin（端口 3003），见 [`apps/admin/README.md`](../apps/admin/README.md) 当前可用菜单段 |
| 加新子产品（第 4 个 web-X） | 先看现有三个 PRODUCT.md（music / drama / celebrity）取经；走 pnpm workspace + Next 16 + Tailwind v4 模板 |

## 维护规则

- **加新文档**：必须同时更新本 INDEX
- **删旧文档**：先 `git grep -n '<filename>' -- '*.md'` 检查站内引用并改指；然后 `git rm`，依赖 git history 留底
- **大版本迭代**（如 v0.5.x → v0.6.0）：必须在同一 commit 同步更新：
  - `product_spec*.md` 版本节
  - 受影响 `apps/*/README.md`（版本日志）+ `PRODUCT.md`（功能新增）
  - `AGENTS.md` §7 v 增量节
  - 本 INDEX 的 last-reviewed 日期
  - 详 [`AGENTS.md` §9 文档同步纪律](../AGENTS.md)
- **CLAUDE.md ↔ AGENTS.md**：CLAUDE.md 是 symlink，**不要单独修改**；改 AGENTS.md 即同步两者
