# ai-star-eco-llm-gateway

OpenAI 兼容的统一大模型网关，监听 **8081**。属于「姿势 A」：独立 Spring Boot 服务，
对外只暴露 `/v1/*`（OpenAI 协议），所有上游差异在网关内部消化。

## 技术栈选型（2026-05 决策）

**Java 17 + Spring Boot 3.3.5 + WebFlux**，不是 Go。

权衡过 Go（性能 / 内存 / 启动时间更优），最终留在 Spring 栈：
- 与 `apps/server` 同栈，DTO / Crypto util / JJWT / 依赖管理可直接复用
- 团队 Spring 熟练度 = 落地速度；新增网关 ≠ 新增语言运维负担
- WebFlux + Reactor + Netty 跑流式 SSE 不阻塞，单机万并发不是瓶颈
- 业务侧调用方只看 OpenAI 协议，未来要换 Go 零感知，**保留可迁移性**

迁移到 Go 的触发条件（任一即可）：
1. 单节点扛不住（4C8G WebFlux 跑不动当前负载）
2. 资源成本敏感到要把镜像 ~400MB→~20MB、内存 ~400MB→~80MB
3. 团队主力转向 Go，再维护 Spring 反而成本高

迁移工作量预估：600–800 行 Go，重写 5 个文件（proxy / filter / reporter / sync / config）；
对外协议不变，admin / apps/server 零改动。

## 已内置 upstream

| id | providerType | 路由前缀 | 上游 |
|---|---|---|---|
| `volcengine-doubao` | `VOLCENGINE` | `doubao-*`、`ep-*` | 火山方舟 Ark `https://ark.cn-beijing.volces.com/api/v3` |
| `aliyun-qwen` | `ALIYUN` | `qwen-*`、`qwq-*`、`qvq-*` | 阿里 DashScope `https://dashscope.aliyuncs.com/compatible-mode/v1` |

两家均原生兼容 OpenAI 协议，网关只做「选 upstream + 替换 Authorization + 透传 body」。

### 官方文档

- **火山方舟（Doubao / Ark）** — <https://www.volcengine.com/docs/82379/1099475>
  - 鉴权方式：`Authorization: Bearer <ARK_API_KEY>`
  - `model` 字段：填 Doubao 公共模型名（如 `doubao-1-5-pro-32k`）或自建 endpoint id（`ep-xxxxxxxx`）
- **阿里 DashScope（千问 / Qwen）** — <https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope>
  - 鉴权方式：`Authorization: Bearer <DASHSCOPE_API_KEY>`
  - `model` 字段：`qwen-plus` / `qwen-max` / `qwen-turbo` / `qwq-32b-preview` 等

## 跑起来

```bash
cd apps/llm-gateway
export LLM_GATEWAY_VOLCENGINE_KEY=...
export LLM_GATEWAY_DASHSCOPE_KEY=...
./mvnw spring-boot:run
```

> 没配 key 的 upstream 启动时会 WARN 跳过，不影响进程；线上至少配一家。

健康检查：

```bash
curl http://127.0.0.1:8081/v1/healthz
```

## 调用样例

```bash
# 火山 · 非流式
curl http://127.0.0.1:8081/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-1-5-pro-32k",
    "messages": [{"role":"user","content":"你好"}]
  }'

# 千问 · 流式
curl -N http://127.0.0.1:8081/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen-plus",
    "stream": true,
    "messages": [{"role":"user","content":"用一句话介绍你自己"}]
  }'
```

业务侧用任意 OpenAI SDK 都能直接调，只要把 `base_url` 设为 `http://127.0.0.1:8081/v1`，
`api_key` 用任意字符串（当前未启用网关层鉴权，TODO 见下方）。

## Admin 同步（可选开关）

设 `LLM_GATEWAY_ADMIN_SYNC_ENABLED=true` 后，网关每 30 秒（可调）拉
`GET http://<server>/api/internal/ai-models/upstreams`，
按 `enabled=true` 覆盖本地 upstream 表。运营在 admin `/platform/ai-models`
改完 key/baseUrl 后无需重启网关。需要同时配：

- `LLM_GATEWAY_SERVER_BASE_URL` — apps/server 地址，默认 `http://127.0.0.1:8080`
- `LLM_GATEWAY_INTERNAL_SECRET` — 与 apps/server `AEP_INTERNAL_SECRET` 一致
- `LLM_GATEWAY_ADMIN_SYNC_POLL_SECONDS` — 拉取周期，默认 30

未启用时（默认）：upstream 来自 `application.yml`。

## 业务鉴权 + 计费回写（可选开关）

设 `LLM_GATEWAY_BUSINESS_AUTH_ENABLED=true` 后，所有 `/v1/chat/*` / `/v1/embeddings/*`
要求 `Authorization: Bearer sk-aep-*`，网关向 apps/server 校验：

- `POST /api/internal/llm-keys/validate` — 校验 key 合法性（命中 prefix → bcrypt 比对）
- `POST /api/internal/llm-keys/usage` — 调用结束后异步上报 tokens，apps/server 写一条
  `LedgerEntry`（reason `LLM_CALL`，金额 = `tokens × credits-per-100-tokens / 100`，
  从用户 wallet 扣减，gift→license→recharge 顺序）

key 在 admin `/platform/llm-keys` 创建，明文仅创建瞬间显示一次。

## 后续 TODO（按优先级）

1. **fallback 路由** — 当前命中第一个匹配 upstream 即返回，未来按 priority 排序 + 失败切备。
2. **限流** — 三级令牌桶（tenant / api_key / model），用 Redis Lua 实现。
3. **可观测** — 每次调用一条 trace → ClickHouse，给运营做用量 / 成本看板。
4. **mTLS** — 当前 server↔gateway 内部接口只验共享密钥，生产建议加 mTLS。

## 与 apps/server 的关系

- `apps/server` 的 `AiModelInvocationService` 是 v0.5 的**内嵌实现**（非流式、单条 chat），用于业务后台自己调模型（剧本草稿、安全审查等 internal purpose）。
- 本网关是 v0.6+ 的**独立 runtime**，暴露 OpenAI 协议给三个 web app（music / drama / celebrity）以及未来的 SDK 直连。
- 两者并存：admin `/platform/ai-models` 页面已经是 provider 配置真源，网关后续会从那里同步。
