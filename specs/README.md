# `specs/` — 后端 API 契约

> 后端接口的**单一事实源**。任何 controller / DTO / 路径变更必须先反映在这里。前端 `apiFetch` URL 与本目录的 path 漂移由 CI 守门，强制零容忍。

## 内容

| 文件 | 行数 | 角色 |
|---|---|---|
| **[`openapi.yaml`](openapi.yaml)** | ~4700 | 数据形状 + 接口形态：186 paths（按 tag 分组）、50+ JSON schema |
| **[`BUSINESS_RULES.md`](BUSINESS_RULES.md)** | ~480 | 业务约束：字段校验、计算公式、错误码、状态机时序 |

**两者分工**：openapi 描述「**长什么样**」，BUSINESS_RULES 描述「**应该怎么用**」。openapi 不能表达的（如 "ledger 必须经过 CreditService"、"授权状态机 UNAUTHORIZED → PENDING → AUTHORIZED → EXPIRED 的转换时机"），全部沉淀到 BUSINESS_RULES。

## Path 分组（按 tag）

```
/admin/**                     — 管理后台（SUPER_ADMIN / OPERATOR）
/auth/**                      — 鉴权（licence 激活 / 管理员登录）
/me/**                        — 用户自身资源（messages-overview / wallet / recharge）
/celebrity/**                 — AI 明星带货（stars / templates / projects / videos / jobs）
/coach/**                     — 经纪/掌门人视图
/community/**                 — 粉丝社区
/distribution/**              — 分发管理
/finance/**                   — 财务
/notifications/**             — 通知 / Bot 会话
/template-scripts/**          — 模板脚本（用户端只读 published）
/appearance-forge/**          — 形象锻造
/music/**, /film/**, /coach/**, /community/**, /fan/**, /charts/**, /tracks/**, /singers/**, ... — 数字 IP 主线（v2.7）
/products/**                  — 商品库（v0.7 web-celebrity 子功能）
```

更精确的路径清单跑：
```bash
grep -E "^  /" specs/openapi.yaml | awk '{print $1}' | sort
```

## 增 / 改路径的流程

> 详见 [`../AGENTS.md` §5 新增领域 SOP](../AGENTS.md)。这里只列 specs 相关动作。

1. **在 openapi.yaml 加 path + schema**：
   - `components.schemas` 增 `<Entity>Dto`（字段名 = 前端 TS interface 字段名 1:1）
   - `paths` 增 `/...` 节，按 tag 归类
2. **如有非平凡业务约束**（计算公式 / 状态机 / 跨字段校验），同时改 BUSINESS_RULES.md
3. **跑 CI 守门**：
   ```bash
   pnpm check:api-contract
   ```
   - 实现：[`scripts/check-api-contract.mjs`](../scripts/check-api-contract.mjs)
   - 规则：每个前端 `apiFetch("/...")` URL 必须在 openapi.yaml 中找到对应 path
   - 失败信号：`✗ apiFetch URL <X> has no matching path in openapi.yaml`

## 命名规范

- **JSON 字段名**：`camelCase`（后端 Spring Boot Jackson 设 `LOWER_CAMEL_CASE`，前端 TS interface 同步）
  - **例外**：v0.7 新增的 `/api/mixcut/*` 用 `snake_case`（沿用 mixcut 原型），通过 `@JsonProperty` 显式映射；调用方需注意
- **enum wire 值**：全小写；含连字符的用 `wire` 字段（如 `"post-production"`）
- **时间字段**：ISO 8601 字符串（`OffsetDateTime` 序列化）
- **金额字段**：原始整数（无小数点；如 `priceCents: 9900` = ¥99.00），格式化在展示层

## 响应壳

```jsonc
// 单资源
{ "success": true, "data": <T>, "message": null }

// 分页（不嵌套 ApiResponse，直接 PageEnvelope）
{ "success": true, "data": [<T>], "pagination": { "page": 0, "limit": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": false } }

// 失败
{ "success": false, "error": { "code": "BIZ_ERROR", "message": "可读文案" } }
```

前端 `apiFetch` 自动解包 `data`；调用方拿到 `T` / `T[]`。

## 历史与版本

- **v2.0.0**（2026-05-06）：BUSINESS_RULES.md 从原 `BACKEND_API_SPEC.md`（1970 行）瘦身。原文档的枚举总表、数据模型、接口清单全部迁移到 `openapi.yaml` + 前端 TS types
- **v0.5.x**：AI 明星带货线 + 模板脚本 + AI 模型 provider 等增量见 [`../product_spec_ai_celebrity.md`](../product_spec_ai_celebrity.md)
- **v0.8**（2026-05-17）：mixcut 真后端落地（`/api/mixcut/jobs[/{id}{/progress}]`）；snake_case wire 例外见 [`../apps/web-celebrity/PRODUCT.md`](../apps/web-celebrity/PRODUCT.md) 「混剪专区」一节

> openapi.yaml 顶部 `info.version` 是 1.0.0（首次声明后保持稳定），不跟随产品版本号；产品版本看各 README + product_spec。
