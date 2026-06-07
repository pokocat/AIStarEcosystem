# admin 配置 ↔ server ↔ 子应用 三端对齐审计

> 审计日期：2026-06-07（v0.53 同期）· last-reviewed: 2026-06-07（同日二批治理后）
>
> 范围：admin 后台的配置域（秘钥 / 渠道 / 动作单价 / AI 模型与绑定 / Prompt / Agent 平台 /
> 充值套餐 / 账号权限 / 审计日志 / 平台门禁）与 server 端点·DTO·枚举、各子应用消费面的 drift。
> 严重度：**P1** = 运行时错误 / 配置无效 / 安全问题；**P2** = 功能 drift（配了不生效、枚举不一致、缺管理入口）；
> **P3** = UI/文档/标签缺失类。
>
> **状态：10 项发现已全部处置**（9 项修复 ✅ + 1 项核实为无 drift ✓）。本文件留作下次审计的基线。

## 汇总表

| # | 严重度 | 域 | 发现 | 处置 |
|---|--------|----|------|------|
| 1 | P1 | 平台门禁 | aiavatar 不在 SubProduct / PlatformSupport.ALL，web-aiavatar 无门禁，秘钥无法按子应用收窄 | ✅ v0.53 第一批（全集 3→4 + 门禁 + 批次 platforms + 追加激活） |
| 2 | P1 | License | packages/types/license.ts 的 LicenseBatch 缺 tier / sellingChannelId（与 server DTO、admin types 三方不一致） | ✅ v0.53 第一批（补 tier/sellingChannelId/platforms） |
| 3 | P2 | 动作单价 | server 5 个计费 action，admin「权益扣减配置」页只列 4 行 —— `material.video-generate` 漏列，运营无法改价 | ✅ v0.53 第一批（补行） |
| 4 | P2 | 账号权限 | `AepUser.platforms` 在 admin 无展示/编辑入口；改账号平台只能 SQL 或追加激活 | ✅ v0.53 第二批：`PATCH /api/admin/aep-users/{id}/platforms`（SUPER_ADMIN）+ `/celebrity/operators` 页「平台访问」列 + 编辑弹窗（不勾选 = 全平台） |
| 5 | P2 | License | tier 枚举三方不一致：admin 2 档 vs server 注释 6 档 vs DB 自由 string 无校验 | ✅ v0.53 第二批：`LicenseService.KNOWN_TIERS` 白名单校验（6 档宽集为契约，admin UI 暴露 basic/premium 子集），三处注释统一指向该真源 |
| 6 | P2 | dap 定价 | dap 生成单价只走 `aep.dap.pricing.*` env，调价要改环境变量重启 | ✅ v0.53 第二批：新 `DapPricingService` —— admin 动作单价表 `dap.*` 12 行优先（>0 生效），env 默认价 fallback；接线 DapJobService / DapVoiceService / DapAccountService；admin 页新增 dap 分组 |
| 7 | P3 | Prompt | admin prompts 页 KEY_LABEL 只配 3 个 material.*，其余 13 个 key 显示裸 key 名（列表本身是服务端动态的，无功能问题） | ✅ v0.53 第二批：KEY_LABEL 补全 16 keys |
| 8 | P3 | SellingChannel | admin types 缺 SellingChannelUpsertInput 镜像；api 用 Partial<SellingChannel> 充当入参（误含只读字段） | ✅ v0.53 第二批：补镜像 + api 改用 |
| 9 | P3 | openapi | /admin/license-batches* 等 7 个 admin license 路径与 LicenseBatch schema 未入 openapi | ✅ v0.53 第二批：paths + LicenseBatch/LicenseBatchStatus schema + /admin/aep-users/{id}/platforms 全部入约 |
| 10 | P3 | 充值套餐 | 审计代理初判「RechargePackage 无共享类型真源」 | ✓ 核实**无 drift**：packages/types / apps/web / admin 三方字段与 server DTO 完全一致（admin 多 `active?` 为软删专属字段，符合 §4.1 admin 独有字段惯例）。本仓 admin types 本就走「复制对齐」而非共享 import，不引新包 |

## 已确认对齐（基线，无需动作）

- **AI 模型 purpose**：server `AiModelPurpose` 13 个枚举值与 admin `api/ai-models.ts` 类型逐一对齐；
  「AI 应用绑定」Tab 渲染自服务端 `listBindings()`（遍历全部枚举），新 purpose 自动出现在 UI。
- **审计动作**：server `AuditService.Actions` 9 个动作与 admin AUTH_ACTION_LABEL 逐一对齐
  （v0.53 追加激活复用 `auth.license.activate`，无新增字典项）。
- **Agent 平台场景**：`/admin/agent-bots/scenes` 服务端单一真源，admin 动态拉取。
- **秘钥核销计数**：v0.47 起 DTO 走 keys 表实时派生 + 自愈。
- **引擎单价 / 充值套餐 CRUD**：admin ↔ server ↔ web-celebrity 对齐。
- **Prompt 列表**：admin 页服务端动态拉取（PromptsApi.listPrompts），覆盖全部 KNOWN_KEYS。

## 长期防 drift 约定（写给下次改动的人）

1. **新增 AiModelPurpose / prompt key / 计费 action** → 同 commit 更新 admin 对应字典
   （ai-models.ts 类型、prompts 页 KEY_LABEL、engine-pricing 页 ACTIONS/DAP_ACTIONS）。
2. **新增子产品** → `PlatformSupport.ALL` + `packages/types SubProduct` + admin types/account.ts
   三处同步（v0.53 起秘钥批次、平台门禁、admin 平台编辑都吃这份全集）。
3. **tier 加档** → 改 `LicenseService.KNOWN_TIERS` + admin `LicenseTier`/`LICENSE_TIERS` + openapi enum，三处同 commit。
4. **dap 定价语义**：admin 表 `dap.*` 行 >0 = 覆盖；0/缺失 = 走 `aep.dap.pricing.*` 部署默认。
   刻意不把 dap 写进 `ACTION_PRICING_DEFAULTS`（否则常量会压过 env 自定义）。
