# apps/admin — AI Star Eco · 运营后台

> 本期（v0.5）聚焦 **AI 明星带货线** 的运营能力。其他产品线（数字人 / 数字 IP / 音乐 / 影视 / NFT / 社群）的页面仍在 `app/` 中，但 sidebar 已隐藏（`enabled: false`）。

## 启动

```bash
cd apps/admin
npm install
npm run dev      # http://localhost:3003
npm run typecheck
npm run build
```

环境变量（`.env.local`）：

```
NEXT_PUBLIC_API_BASE_URL=/api          # 反代到 apps/server (8080) 或开发态直连
NEXT_PUBLIC_USE_MOCK=0                 # 0 跑真后端；1 用 mocks/ 静态数据
```

## 端口对照

| 服务 | 端口 |
|---|---|
| `apps/server`（Spring Boot） | 8080 |
| `apps/admin`（本应用） | **3003** |
| `apps/web`（带货方用户端） | 3002 |
| `apps/miniprogram`（小程序） | — |

## 登录

`AdminAuthController` 在 `/api/admin/auth/login`：

```bash
curl -s -X POST localhost:8080/api/admin/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq .data.token
```

DataInitializer 默认 seed 两个账号：

| username | password | role |
|---|---|---|
| admin    | admin123    | SUPER_ADMIN |
| operator | operator123 | OPERATOR |

> v0.5：`AdminRole` 在 admin TS 已与 server enum 大小写对齐为 `SUPER_ADMIN | OPERATOR`。

## 当前可用菜单（v0.5 sidebar enabled = true）

- **平台账户**：账号 / 经纪公司、秘钥批次
- **AI 艺人**：生命周期、艺人档案
- **明星带货** ★（重点）：明星档案、模板、**模板脚本**、**授权关系**、**引擎价格**、带货项目、商品库
- **财务**：结算中心、**充值套餐**、异常风控
- **分发**：分发渠道、发行队列
- **基础数据**：积分包（其他子项隐藏）
- **平台与配置**：**AI 模型**、平台配置
- **消息与日志**：消息中心、审计日志

## 隐藏的菜单（v0.5 sidebar enabled = false，URL 直访仍可用）

- AI 作品（数字人产品线）：歌曲、专辑、演唱会、短剧、电影、广告、配音、版权
- 变现 / 社群（数字人产品线）：数字藏品、社群活动、互动审核
- 基础数据中：曲风/造型库/姿态库/锻造预设

> 切回需要时改 `apps/admin/src/constants/nav.ts` 中对应组的 `enabled` 即可。

## 关键页面（v0.5 新增）

- `/celebrity/stars`（既有，CRUD 待补 v0.6）
- `/celebrity/templates`（既有，CRUD 待补 v0.6）
- **`/celebrity/template-scripts`**（v0.5 新增）— 模板脚本列表 / 状态推进 / 试跑
- **`/celebrity/star-authorizations`**（v0.5 新增）— 用户 × 明星 授权 CRUD + 状态机推进
- **`/celebrity/engine-pricing`**（v0.5 新增）— 引擎价格表
- **`/finance/recharge-packages`**（v0.5 新增）— 充值套餐 CRUD（软删）
- **`/platform/ai-models`**（v0.5 新增）— OpenAI 兼容 API token 接入

## 与 server / web / miniprogram 的契约

- Types：`apps/admin/src/types/*` 与 `apps/web/src/types/*` **逐字段一致**（admin-only 扩展用 `Admin*` 命名）
- Server DTO：字段名严格匹配 TS interface
- Endpoint 全集：`specs/openapi.yaml`，`(cd apps/web && npm run check:api-contract)` 守门

## 版本日志

- **v0.5.0 / 2026-05-08**：明星 / 模板 / 授权 / 套餐 / 引擎价 / 模板脚本 / AI 模型 全栈 admin CRUD；sidebar 聚焦明星带货线。详见 `product_spec_ai_celebrity.md` v0.5 节。
- **v0.4.0 / 2026-05-07**：server 端用户侧接口打通（小程序和 server 双端跑通）；admin 维持 GET-only。
- 之前版本：见 `product_spec_ai_celebrity.md`。
