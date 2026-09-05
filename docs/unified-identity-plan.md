# 统一账号中心（id.aibuzz.cn）· 规划与设计

> **状态**：设计定稿；**P1 账号中心 MVP 已完成并通过 Codex 六轮评审放行「可进入 P2 接入」**（2026-09-04，143 测试全绿含真实 MySQL 8 门测）。P0 两项人工待办（微信开放平台主体确认、`id.aibuzz.cn` vhost）见 TODO.md。
> **范围**：aibuzz.cn 生态全部面向用户的产品：本仓 5 个 web app + 带货小程序、军师 ai-pilot（H5 / PC / 小程序）、主理人公社 ai-society（会员小程序）、以及后续任何新产品。
> **落点**：独立仓库 [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id)（Spring Boot 3.3.5 / Java 17 / Spring Authorization Server / Flyway / H2 dev · MySQL prod），生产域名 `id.aibuzz.cn`，本地 port **8090**；建议 clone 到本仓同级的 `../aibuzz-id`。初版代码曾在本仓 `apps/id-server` 孵化，2026-09-04 抽离，本仓只保留消费方接入（§12）。
> **相关**：军师侧早期思路见 `ai-pilot/docs/ECOSYSTEM_ACCOUNT_DESIGN.md`（2026-07，单库共用 User 的方案，已被本文取代）。

---

## 0. 一句话

**新建一个只管「你是谁」的独立服务。** 所有产品不再自己发验证码、自己签令牌，而是把用户送到账号中心登录，账号中心发一张全生态通认的令牌（RS256 JWT），各产品只用公钥验证。**身份只有一份（uid），产品侧「建档」自动、「开通」显式，权益真值永远在产品侧。**

---

## 1. 现状（2026-09-04 摸底）

| | AIStarEcosystem（本仓） | 军师 ai-pilot | 主理人公社 ai-society |
|---|---|---|---|
| 后端 | Spring Boot / MySQL | Fastify / Prisma / Postgres | Spring Boot / Java 21 / Postgres |
| 用户表 | `AepUser`：手机号 + 用户名，`platforms` CSV，**无微信字段** | `User`：手机号唯一 + `wechatOpenId/UnionId`，一 User 一 Tenant | `app_user` 员工（密码 + RBAC）与 `member` 会员（手机号 / unionid / 按 appid 的 openid）两张表 |
| 登录 | 短信码、密码、注册必须激活码 | 短信码、wx.login、一键取号 | 密码、小程序静默、PC 微信扫码、企微 |
| 令牌 | HS256 JWT 7d，无刷新，localStorage | HS256 JWT 30d，无刷新，`x-user-id` 头 | HS256 JWT 72h，无刷新 |
| 域名 | music/drama/celebrity/aiavatar/star/admin/api.aibuzz.cn | aibuzz.cn、wxapi.aibuzz.cn、copilot.aibuzz.cn | bossclub.aibuzz.cn |
| 机器互调 | 军师用固定 `AEP_CLIP_SERVICE_TOKEN` + `externalOwnerId` 调本仓 clip | — | — |

关键事实：全部在 `aibuzz.cn` 根域下；三套 JWT 各用各的密钥互不相认；同一个人在三边是三条无关记录；本仓「能进哪些子产品」只有前端拦（`AuthProvider.hasPlatformAccess`），后端 `/api/me/**` 只查已登录，`platforms` 为空还宽松放行。

---

## 2. 决策记录

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| D1 | 三边共用一张用户表？ | **否** | 三种数据库无法共库 |
| D2 | 拿某个现有后端当账号中心？ | **否** | 产品发版会拖垮全生态登录，身份与业务绑死 |
| D3 | 独立账号中心 + OIDC 标准协议 | **是** | 边界清楚，加第 N 个产品只是注册一个客户端 |
| D4 | 选型 | **自建 Spring Boot + Spring Authorization Server** | 团队 Spring 熟；本仓短信 / 密钥 fail-fast 代码可直接搬；Keycloak 类产品对微信小程序 / unionid 合并 / 激活码支持差 |
| D5 | 统一身份键 | **手机号为主；微信 unionid 只是「有则用」的加速器** | 2026-09-04 用户确认：三个小程序**不一定同主体**。基线按 `openid(appid)` 建号，跨小程序 / 跨端识别同一个人**只靠手机号**；同主体的小程序之间 unionid 自然带来静默互认，不同主体则退化为「各自 openid，绑手机后合并」（§5 合并规则本来就覆盖） |
| D6 | 各产品用户表 | **保留，加 uid 映射，不改业务外键** | 不动本仓几十张表的 `ownerUserId`、军师的 `tenantId` |
| D7 | 登录 vs 激活 | **分开** | 激活码是产品权益不是身份；先登录拿身份，进产品再「开通」 |
| D8 | 令牌 | **RS256 + JWKS，access ≤ 1h，refresh 30d 轮换** | 产品间不共享任何密钥；可随时踢人 |
| D9 | Web SSO 机制 | **账号中心自有会话 + 授权码 PKCE 跳转**，不做 `.aibuzz.cn` 全域共享 cookie | 任一子站点 XSS 不波及全生态**的会话**；但 P2 实现把 access / refresh 令牌放在各子站 localStorage（五个 web 客户端共用 `aistar-api` audience），同源 XSS 仍可窃取该用户在本仓产品的 30 天刷新能力（Codex P2 评审 P1-6）。**P5 改 BFF + HttpOnly cookie、access 只驻内存**（TODO.md） |
| D10 | 只有微信没手机号的人 | **建 uid，可浏览；手机号是「升级」不是「门槛」**（公社做法） | 拒绝建号会砍掉公社邀请归因与静默进入；付费 / 开通 / 生成由产品要求 `phone_verified` |
| D11 | 合并规则 | **手机号持有者 uid 存活，微信身份改挂过去，被并 uid 标 MERGED** | 公社 `member.merged_into` 已是同思路；导入三库老用户也要用 |
| D12 | 员工 / 后台账号 | **不并入消费者身份** | 本仓 `AdminUser`、军师 `AdminAccount`、公社 `app_user` 各留本地 RBAC |
| D13 | 令牌里放「已开通产品列表」？ | **否** | 到期 / 冻结 / 退款撤权会让列表过时，还泄露用户用过哪些产品 |
| D14 | 积分钱包 | **本期不合并** | 那是结算问题不是身份问题，另开决策 |

### 2.1 五层模型（Codex 评审后修正）

| 层 | 真值归属 | 含义 |
|---|---|---|
| 身份 Identity | **账号中心** | uid、手机号、微信、登录会话、账号安全状态 |
| 本地档案 Local subject | 产品 | uid 在本产品的映射行 + 资料，首次登录 **JIT 自动建** |
| 开通与权益 Enrollment / Entitlement | 产品 | 能不能进、套餐、额度、有效期；来源：激活码 / 购买 / 邀请 / 试用 |
| 组织与角色 Workspace / RBAC | 产品 | 属于哪个 Studio / Tenant，在里面是什么角色 |
| 业务资源 | 产品 | Studio、钱包、Member、项目、资产 |

**硬边界：JIT 建档 ≠ 开通。** 产品后端每个受保护业务入口必须查本产品的开通状态；前端拦截只做体验。账号中心只保存「uid 在哪些产品建过档 / 开通过」的**只读汇总**（`id_product_link`），供自助页与注销联动。

---

## 3. 账号中心 · 数据模型（`aibuzz-id` 仓，前缀 `id_`，Flyway 管 schema，`ddl-auto=validate`）

```
id_user
  uid              VARCHAR(32) PK        ULID 风格随机串（不用自增，不泄露规模）
  status           VARCHAR(16)           ACTIVE | SUSPENDED | CLOSED | MERGED
  merged_into_uid  VARCHAR(32) NULL
  phone            VARCHAR(32) NULL UNIQUE   E.164 或 11 位国内号，统一归一化
  phone_verified_at DATETIME NULL
  display_name / avatar_url  NULL
  created_at / updated_at / closed_at

id_identity                              一人多凭据；openid 按 appid 区分
  id BIGINT PK
  uid              FK id_user(uid)       V1 落真外键；id_product_link.uid 同
  type             VARCHAR(16)           PHONE | WX_UNIONID | WX_OPENID
  app_id           VARCHAR(64) NOT NULL DEFAULT ''   仅 WX_OPENID 有值
  identity_value   VARCHAR(128)          （`value` 是 H2 2.x 保留字，列名用 identity_value）
  status           VARCHAR(16)           ACTIVE | TOMBSTONE
  created_at
  UNIQUE(type, app_id, identity_value)

id_wechat_app                            账号中心替所有小程序 / 公众号保管密钥
  app_id PK, kind (MINI | MP | OPEN_WEB), app_secret_enc (AES-GCM), client_id (→ oauth2_registered_client), enabled

oauth2_registered_client / oauth2_authorization / oauth2_authorization_consent
                                         Spring Authorization Server 官方 JDBC schema，原样
id_client_meta
  client_id PK, product_code, display_name, audience

id_product_link                          只读汇总，真值在产品侧
  id BIGINT PK, uid, product_code, local_subject_id NULL,
  status (PROVISIONED | ACTIVE | CLOSED), updated_at
  UNIQUE(uid, product_code)

id_outbox                                产品拉取的事件流（pull 模型，免回调地址）
  id BIGINT PK AUTO, event_type (USER_MERGED | USER_CLOSED | PHONE_CHANGED),
  uid, payload_json, created_at
  产品用 client_credentials 按 id 游标拉取

id_login_event                           审计
  id, uid NULL, client_id, method (SMS | WX_MINI | PASSWORD | REFRESH), result, ip, ua, created_at
```

验证码走内存 `ConcurrentHashMap`（与本仓 `SmsCodeService` 一致，单实例够用；多实例前换 Redis）。所有「检查并占位 / 校验并消费」必须在单个 `compute` 内完成，防并发多发、一码多兑。发码限频三层：按手机号 60s + 每日上限、按 IP 每小时上限、全局每分钟上限。

MySQL 下不透明键列（uid / phone / identity_value / client_id / principal_name 等）显式 `COLLATE utf8mb4_bin`（Flyway placeholder `${keyCollate}`，H2 为空），避免大小写不敏感比较把两个不同 openid 当成同一个；真实 MySQL 8 由 Testcontainers 门测（Docker 不可用时跳过）。

---

## 4. 协议与端点

### 4.1 标准 OIDC（Spring Authorization Server 提供）

`/.well-known/openid-configuration` · `/oauth2/authorize` · `/oauth2/token` · `/oauth2/jwks` · `/userinfo` · `/oauth2/revoke` · `/connect/logout`

### 4.2 授权方式（grant）

| grant | 谁用 | 说明 |
|---|---|---|
| `authorization_code` + PKCE（公开客户端） | 5 个 web app、军师 H5 / PC、公社后台若有 | 浏览器跳 `id.aibuzz.cn/login`，有会话则静默跳回 → SSO |
| `refresh_token` | 所有用户端 | 30d，轮换 |
| `client_credentials` | 产品后端 | 调 §4.4 的产品接口、拉 outbox |
| **自定义** `urn:aibuzz:params:oauth:grant-type:wechat-mini` | 三个小程序 | 参数 `code`（wx.login）；client_id 反查 `id_wechat_app` 得 appid / secret → 微信 code2Session → 按 unionid → openid(appid) 找人 → 找不到按 D10 建 uid |
| **自定义** `urn:aibuzz:params:oauth:grant-type:sms` | 小程序 / 原生端手机号登录 | 参数 `phone`、`code`；找不到手机号 → 建 uid（`phone_verified_at=now`） |
| ~~password~~ | — | 不做 grant；本仓老用户密码登录只在 P2 迁移期作为登录页选项 |

登录页（`/login`，Thymeleaf 服务端渲染，中文，移动端友好）：手机号 + 短信验证码。第一方客户端 `requireAuthorizationConsent=false`，不弹授权同意页。

### 4.3 令牌契约

Access token（JWT，RS256，`kid` 轮换：JWK 文件可放多把 RSA 键，只有一把带私钥或用 `ID_JWK_ACTIVE_KID` 指定签名键；退役键只留公钥继续发布在 `/oauth2/jwks` 供重叠期验签）：

```
iss   https://id.aibuzz.cn
sub   uid
aud   [客户端注册时配置的产品 audience，如 "aistar-api" / "junshi-api" / "bossclub-api"]
azp   client_id
exp   iat + 3600（可按客户端下调）
iat / jti / sid
amr   ["sms"] | ["wx"] | ["pwd"] | ["refresh"]
phone_verified   boolean
wx_openid        仅当客户端绑定了 appid 且该 uid 有对应 openid 时带（微信支付 JSAPI 用）
```

**不带**：手机号（隐私，走 `/userinfo` scope `phone`）、已开通产品列表（D13）、产品角色。

ID token 标准 claims + `phone_verified`。Refresh token 不透明。

### 4.4 账号中心自有 API

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/me` | 用户 access token | 资料 + 凭据摘要（手机号脱敏、是否绑微信）+ `productLinks` |
| POST | `/api/me/phone/send-code` | 用户 token | 绑定 / 换绑发码 |
| POST | `/api/me/phone/bind` | 用户 token | `{phone, code}` 短信绑手机 → 可能触发 §5 合并 |
| POST | `/api/me/phone/wechat-bind` | 用户 token（wx 客户端） | `{code}` getPhoneNumber 一键取号 → 同上 |
| POST | `/api/me/close` | 用户 token | 注销：`status=CLOSED`，凭据 TOMBSTONE，撤销全部授权，写 outbox `USER_CLOSED` |
| PUT | `/api/products/{product}/links/{uid}` | client_credentials，scope `product.link` 且 client 的 product_code 匹配 | `{localSubjectId, status}` 产品回报建档 / 开通 / 注销回执 |
| GET | `/api/products/{product}/links/{uid}` | 同上 | |
| GET | `/api/products/{product}/outbox?after={id}&limit=` | 同上 | 拉事件 |
| POST | `/api/auth/sms/send-code` | 公开，限频 | 登录页与 sms grant 共用的发码 |

客户端注册不做 UI：`application.yml` 的 `id.clients[]` 声明式配置，启动时幂等 upsert 到 JDBC registry（含 redirect URIs、grant 集、audience、appid 绑定）。

---

## 5. 身份解析与合并

**微信小程序登录解析顺序**：`WX_UNIONID` → `WX_OPENID(appid)` → 无 → 建 uid（写入 unionid 与 openid 两条 identity；无 unionid 只写 openid）。已存在 uid 但缺 openid(appid) 行 → 补写。

**不同主体（D5 修订）**：微信只在同一开放平台主体下返回相同 unionid。本生态三个小程序不一定同主体，所以**不得把 unionid 当作可依赖的跨端键**：产品侧对小程序用户在开通 / 付费 / 生成等有副作用的动作前必须要求 `phone_verified=true`（引导 `getPhoneNumber` 一键取号或短信绑定），跨端合并由手机号触发（§5 第 3 步）。账号中心的解析顺序不变，unionid 有则加速、无则不影响。

**绑手机号**（`bind` / `wechat-bind` 经同一漏斗 `PhoneBindingService`；sms grant 与登录页走 `IdUserService.loginOrCreateByPhone`，两条路径共用同一套 TOMBSTONE / CLOSED / MERGED 闸门）：

1. 手机号归一化；当前 uid = A（取令牌**原始 `sub`**，且 A 必须严格 ACTIVE，见 §5.1）。
2. 手机号无人持有 → 写到 A，`phone_verified_at=now`；A 原有手机号（换绑）的 PHONE identity → TOMBSTONE，写 outbox `PHONE_CHANGED`（payload 只含脱敏号）。
3. 手机号属于 B（ACTIVE）且 A ≠ B → **合并**：
   - 存活方 = B（手机号持有者）。
   - A 的 ACTIVE **微信** identity 改挂 B（唯一键冲突的丢弃 A 侧那条）；A 的 **PHONE** identity 一律 TOMBSTONE —— 存活方只保留唯一规范手机号，**每个 uid 至多一条 ACTIVE PHONE**。
   - A：`status=MERGED, merged_into_uid=B`；撤销 A 的全部 oauth2_authorization（refresh 即刻失效；已签发的 access token 最长再活 1h，账号中心自有 `/api/me/**` 按 §5.1 拒绝，产品侧靠 `USER_MERGED` 事件对齐）。
   - `id_product_link`：A 的每条链接 → 写 outbox `USER_MERGED {fromUid:A, toUid:B, product}`，A 侧行标 CLOSED；产品收到事件后把本地档案指向 B。
   - 本次请求**不发新令牌**，返回 `{survivorUid:B, merged:true, reloginRequired:true}`；调用方丢弃本地令牌并重新登录（资源服务器端点不铸令牌，避免复制 token endpoint 的客户端校验）。
4. 手机号属于 MERGED 的 uid → 沿 `merged_into_uid` 找到最终存活方再按 3 处理。
5. 手机号属于 CLOSED 的 uid，或 PHONE identity 为 TOMBSTONE → **30 天冷静期**内一律 403 `ACCOUNT_CLOSED`，不能绑定、不能登录、不视为「无人持有」。只有 P5 的 reaper 在冷静期后原子清空 `id_user.phone` 并处理墓碑，号码才可复用。（`id_user.phone` 有唯一索引，注销时刻意**不**清空，正是为了让同号在冷静期内命中墓碑而不是静默建新号。）

### 5.1 鉴权主体规则（Codex 评审 P0）

`/api/me/**` 只接受**用户令牌**：`amr` 非空、`sub ≠ azp`，且令牌**原始 `sub`** 对应的 `id_user.status` 严格为 ACTIVE。MERGED / CLOSED / SUSPENDED → 401 `ACCOUNT_STATE_INVALID`，机器令牌 → 403。**禁止**在鉴权主体上调用 `resolveSurvivor`——否则被并方 A 的旧 access token 会被解析成 B，进而换绑 B 的手机号完成账号接管。`resolveSurvivor` 只用于「按手机号 / 微信凭据找人」的登录解析。

**注销后再登录**：wx.login 命中 TOMBSTONE identity、或手机号命中 CLOSED 用户 → 拒绝 `ACCOUNT_CLOSED`（不静默复活）。CLOSED 用户的 `id_product_link` 只接受产品回报 `CLOSED`，其他状态 409 `ACCOUNT_CLOSED`。

**并发首登**：同一手机号 / openid / unionid 的并发首登，唯一索引保证只有一方插入成功；败方捕获唯一键冲突后按凭据回读赢家继续，**不得**把数据库异常透成 500。

---

## 6. 小程序接入流程

1. 小程序 `wx.login` 取 code，`POST /oauth2/token` `grant_type=wechat-mini&client_id=<小程序客户端>&code=…`。
2. 账号中心用该 appid 的 secret 调 code2Session。**code 5 分钟有效且一次性，失败不重试**，返回 `WX_CODE_INVALID` 让端上重新 wx.login。
3. 解析 / 建号（§5），发 access + refresh；`session_key` 留在账号中心不下发。
4. 小程序本地存两枚令牌，请求本产品接口带 `Authorization: Bearer`；401 用 refresh 换新。
5. 需要手机号的动作由产品判断 `phone_verified`，引导调 `/api/me/phone/wechat-bind` 或短信绑定。
6. 邀请码 / 渠道码等归因参数不进账号中心，登录后由小程序自己带给产品后端。

三个小程序改动量：军师最小（换地址、`x-user-id` 改 Bearer、本地 User 加 uid）；公社换地址、归因留本地；本仓带货小程序改动最大（补 wx.login，删短信注册页，激活码改成登录后「开通带货」一步）。

---

## 7. 产品侧接入范式（P2+，各产品照此做）

```
1. 严格验 token：iss / aud / exp / kid / alg（Spring: oauth2-resource-server；Fastify: jose）
2. 以 identity_uid UNIQUE 做数据库原子 upsert 本地档案（不是先查再插）
3. 回读最终本地档案
4. 查本产品 enrollment / entitlement（缺 → 只放行「开通 / 帮助 / 退出」接口）
5. 开通成功后才初始化业务资源（Studio / Wallet / Tenant），并保留幂等 ensure 兜底
6. 本地事务提交后，PUT /api/products/{product}/links/{uid} 回报
7. 定时拉 outbox：USER_MERGED → 本地档案 repoint；USER_CLOSED → 本地墓碑
```

本仓 P2 具体：`AepUser.identityUid UNIQUE`；`platforms` CSV → `product_enrollment(user_id, product_code, status, activated_at, valid_until)` + `entitlement_grant(source, source_reference UNIQUE)`；激活码核销改条件更新 `UPDATE license_key SET status='ACTIVATED' WHERE id=? AND status='CREATED'` 影响 1 行才继续；`JwtAuthenticationFilter` 过渡期双验（老 HS256 + 新 RS256）；后台 `AdminUser` 令牌用独立 audience，不再由 `AepUser.operatorRole` 直通 `/api/admin/**`。

---

## 8. §8.0 合规（生产禁止静默降级）

| 能力 | 生产未配置 | dev 降级 |
|---|---|---|
| RSA 签名密钥 | 启动 fail-fast（`ID_JWK_SET_PATH` 必填；文件不存在 / 不可读 / 非 RSA / 无私钥 / <2048 位 / kid 重复 / 签名自检失败一律拒启） | dev 未配 → 启动时生成临时密钥并 WARN（重启令牌全失效，仅 dev） |
| 微信 code2Session / getPhoneNumber | 对应 appid 未配 secret → 503 `WX_APP_NOT_CONFIGURED`；HTTP 失败 → 502 `WX_CALL_FAILED`，不建号 | `id.wechat.allow-mock=true`（dev 默认 true，mysql/prod 默认 false，误开 ERROR 横幅）；mock code 形态 `mock:<openid>[:<unionid>]`，产出打 `mock=true` 日志 |
| 短信 | `ID_SMS_DRIVER=aliyun` 且 AK / SK / 签名 / 模板显式必填，缺 → 启动 fail-fast（**不**走阿里云默认凭据链）；供应商错误细节只进日志，对外一律 502 `SMS_SEND_FAILED` | `log` driver 仅 dev；`dev-fixed` 固定码仅 dev；默认凭据链仅 dev |
| issuer | mysql/prod 必须显式 `ID_ISSUER`，https、非 localhost、无 query → 否则拒启 | dev 默认 `http://localhost:8090` |
| 微信网关地址 | mysql/prod `id.wechat.base-url` 只允许 `https://api.weixin.qq.com`（或显式白名单） | dev 可指向 mock / 本地打桩 |
| 密钥加密（appsecret） | `ID_CRYPTO_KEY` 必填，缺 → fail-fast | dev 默认密钥仅 dev profile |
| DB | mysql profile 必配 | H2 内存 |

---

## 9. 分期

| 期 | 内容 | 状态 |
|---|---|---|
| **P0 前置** | ~~确认三个小程序挂同一微信开放平台主体~~ → 已定为「不一定同主体」（D5 修订，方案按 openid + 手机号为基线）；`id.aibuzz.cn` DNS（阿里云 CLI）+ nginx 443 vhost 与 systemd 单元（泛域名证书已有，2026-11-08 到期）；本文定稿 | ✅ DNS 已加、infra 文件就位；服务器上线步骤见 `infra/README.md` §4.3 |
| **P1 账号中心 MVP** | `aibuzz-id`：Flyway schema、SAS 授权码 PKCE + refresh + client_credentials、登录页（短信）、wechat-mini / sms 自定义 grant、微信网关（HTTP + mock）、绑手机 + 合并、`/api/me`、产品链接 API、outbox、审计、声明式客户端注册、§8.0 门禁、集成测试、README、launch.json | ✅ 2026-09-04（Codex 六轮评审放行，§11） |
| **P2 本仓接入** | 五个 web app 共用 `AuthProvider` 改走 PKCE；后端双验；`identityUid` 映射 + JIT；`product_enrollment` / `entitlement_grant`；激活码改开通；导入老用户手机号；小程序补 wx.login | ✅ 代码完成 2026-09-04（v0.149）；预发联调与上线待做（TODO.md） |
| **P3 军师接入** | Fastify 公钥验证；wx 登录改走账号中心；`externalOwnerId` → uid；User 加 `identity_uid` | 待 |
| **P4 公社会员端接入** | member 绑 uid；员工端 / 企微留本地 | 待 |
| **P5 收尾** | 关旧登录端点；统一登出；自助页（改手机、绑微信、注销）；注销 reaper；outbox 投递监控 | 待 |

---

## 10. 刻意不做

不合并三边积分钱包；不合并员工后台账号；不用全域共享 cookie；不做 password grant；账号中心不做任何「开通」写操作（只收回执）。

---

## 11. 评审记录

**2026-09-04 · Codex 只读评审（P1 MVP，48 测试全绿时）**：1 条 P0（被并方旧 access token 经 `resolveSurvivor` 解析成存活方后可换绑其手机号 → 账号接管）+ 13 条 P1 + 3 条 P2。判定「先修再接」。同日修复：P0 → §5.1 用户令牌闸门；P1 → 合并墓碑化 A 的手机凭据、注销号 30 天冷静期硬拒、并发首登回读、CLOSED 用户产品链接只收 CLOSED、JWK 内容校验、issuer 门禁、`/userinfo` `phone` scope、微信网关日志 / 地址收口、短信原子限频 + IP / 全局限额 + 日志脱敏 + 供应商错误不外泄 + 阿里云显式凭据、V1 外键 + `utf8mb4_bin` + Testcontainers MySQL 8 门测；P2 → 自定义 grant scope 交集、公开客户端 converter 限定 token endpoint。**遗留到 TODO.md**：声明式 Seeder 不回收已从配置移除的客户端 / 微信应用（需显式禁用清单）；验证码与限频存储多实例前换 Redis；`MP` / `OPEN_WEB` 扫码登录 grant 未做。

**2026-09-04 · Codex 第二轮复审**：12 条确认关闭；仍有 1 P0（`PhoneBindingService.bind` 对鉴权主体仍 `resolveSurvivor` → 闸门通过后被并发合并的 TOCTOU 窗口）+ 5 P1（短信 `pending` 占位在阿里云同步轮询送达期间挡住验码、60s 后可被覆盖；限频回滚不带票据会扣新窗口配额；首登重试耗尽仍透 DB 异常；JWK 多私钥无法选签名键、退役公钥被拒 → 轮换做不了；并发注销重复写 `USER_CLOSED`）+ 3 P2（限频无 HTTP 集成覆盖、`close` 重复语义与测试不一致、闸门边界无回归测试）。同日修复：绑定主体行锁 + 严格 ACTIVE、不跟合并链；供应商受理即确认、送达轮询转异步 best-effort、`pending` 30s 内不可覆盖；限频票据化回滚；重试耗尽 → 503 `LOGIN_BUSY`；JWK 多键 + `ID_JWK_ACTIVE_KID` + 退役公钥发布；注销条件更新；`/api/me/close` 重复调用契约定为 401 `ACCOUNT_STATE_INVALID`（令牌已死），服务层幂等；补 HTTP 限频与闸门边界测试。

**2026-09-04 · Codex 第三轮确认**：第二轮 9 条全部确认关闭，鉴权主体全仓再无 `resolveSurvivor`。修复自身新引入 4 P1（A↔B 反向合并互相等锁形成死锁环且绑定路径无重试；送达轮询线程池 `DiscardPolicy` 让「队列满 WARN」承诺落空；`shutdownNow` 静默丢回执；供应商已受理但占位被替换的旧请求错误退还限频配额）+ 4 P2（绑定锁缺真实并发库测试、闸门边界断言只查 ≠200、JWKS 无 HTTP 回归、README 密钥说明自相矛盾）。同日修复：两行按 uid 全局排序加锁 + 死锁重试 3 次耗尽 503 `BIND_BUSY`；自定义拒绝处理器记 WARN；优雅停机等待 5s 并记丢弃数；已发出的短信不退配额；MySQL 门测加 A↔B 反向并发绑定用例；边界断言收成 {400,401,403,404,405}；`/oauth2/jwks` HTTP 回归（全部 kid、无私钥成员）；README 密钥行改为「至少一把含私钥，退役键只留公钥」。

**2026-09-04 · Codex 第四轮**：第三轮 8 条中 7 条关闭；新 2 P1（自持 / 空号分支锁回 A 后漏复核状态；两账号并发抢同一空闲号撞手机号唯一键透 500）+ 1 P2（边界测试 302 白名单过宽）。同日修复：空号分支锁后 `requireStillActive`；`bindWithRetry` 对唯一键冲突**仅在该号此刻确已有人持有时**重试（真正的约束缺陷仍原样暴露），耗尽 503 `BIND_BUSY`；新增 `ConcurrentFreePhoneBindTest`（两账号抢同一空闲号：绝不透裸数据库异常，最终恰好一人持号、一条有效手机凭据）；边界测试改为每个变体限定预期状态（302 只给 `/API/ME` 且必须指向 `/login`）。

**2026-09-04 · Codex 第五轮**：3 条中 2 条关闭，剩 1 P1：`phoneNowTaken` 不能证明唯一键冲突来自手机号索引，可能吞并无关约束缺陷。同日修复：重试改为双条件 —— 异常文本（顺 cause 链）必须含 V1 手机号两条唯一索引名 `ux_id_user_phone` / `ux_id_identity_kv`（H2 / MySQL 报错都带索引名），且号此刻确已有人持有；新增 `PhoneUniqueViolationTest`（两种数据库文本识别、外键 / 其他唯一键不识别、索引名与 V1 一致性守门）。

**2026-09-04 · Codex 第六轮**：分类器可靠（Hibernate 包装层可穿透、MySQL `table.index` 与 H2 大写均识别），P1-2 关闭，无新 P0/P1。**判定：可进入 P2 接入。**

**2026-09-04 · 抽离为独立仓库**：账号中心从本仓 `apps/id-server` 迁到 [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id)（它服务的是整个生态，不只是本仓；本仓的部署脚本、nginx / systemd / env 样例、JWK 生成脚本随之一并移交该仓 `deploy/`）。本仓从此只留消费方：`AEP_ID_*`（server）、`NEXT_PUBLIC_ID_*`（五个 web app）、小程序 `idBaseUrl`。**Redis 路线**：验证码、发码限频、令牌 denylist 先用账号中心同机的**本机自建 Redis**（单实例够用、零额外成本）；将来真要跑多实例（集群化）时再换阿里云 Redis，接口 `KeyValueStore` 不变。

---

## 12. P2 · 本仓接入契约（2026-09-04 定稿，server / 前端 / 小程序 / 账号中心四路并行的共同真源）

### 12.1 server 接受账号中心令牌（双验过渡）

- `JwtAuthenticationFilter`：先按现有 HS256（`AEP_JWT_SECRET`）验；JOSE 头 `alg=RS256` 或 HS256 失败且 `iss` 等于 `AEP_ID_ISSUER` → 用账号中心 JWKS 验（`AEP_ID_ISSUER` 必填时经 `/.well-known/openid-configuration` 发现 `jwks_uri`，可用 `AEP_ID_JWKS_URI` 覆盖；Nimbus 远端 JWKSource 带缓存与 kid 未命中时刷新）。校验 `iss`、`exp`、`aud` 含 **`aistar-api`**。`amr` 非空 = 用户令牌；无 `amr` 的机器令牌不得进入 `/api/me/**`。
- **主体解析**：`sub`=uid → `aep_users.identity_uid` → 本地用户。没有 → **JIT 建档**（`kind=PERSONAL`，`status=ACTIVE`，`username` 生成为 `id_<uid 前 12 位>` 保证非空唯一，`phone`/`displayName` 为 null，`platforms` 留空但**不再**视作全集，见 12.2）。原子性：先插后读，捕获唯一键冲突后按 `identity_uid` 回读赢家；随后 best-effort 回报账号中心 `PUT /api/products/aistar/links/{uid}` `{localSubjectId: 本地 id, status: PROVISIONED}`。
- `AEP_ID_ISSUER` 未配置 → RS256 令牌一律 401，HS256 路径不受影响（过渡期允许，dev 默认 `http://localhost:8090`）。
- **后台令牌与消费者令牌分离**：`JwtUtil` 给 `AdminAuthController`（含 `operator-login`）签的令牌加 `typ=admin`；`JwtAuthenticationFilter` 只对 `typ=admin` 的令牌把 `role` 映射成 `ROLE_*` 后台权限；消费者登录（激活 / 短信 / 密码）签发的令牌 `role` 只放 `kind`，**不再**放 `operatorRole`；RS256 令牌永不映射后台角色。`AepUser.operatorRole` 持有人要进后台只能走 `operator-login`。

### 12.2 开通（enrollment）成为后端权益真值

表（新表用 `.sql` 迁移；编号接 V24 之后）：

```
product_enrollment(id, user_id, product, status[PENDING|ACTIVE|SUSPENDED|REVOKED], source[LICENSE|TRIAL|ADMIN|GRANT_ALL|LEGACY],
                   activated_at, valid_until, created_at, updated_at, UNIQUE(user_id, product))
entitlement_grant (id, user_id, product, source, source_reference, granted_at, valid_until, status, UNIQUE(source, source_reference, product))  -- 多产品秘钥每个产品一行
```

- **回填**（幂等 runner，@Order 靠后）：老账号 `platforms` CSV → 每个产品一条 `ACTIVE/LEGACY`；CSV 为空（历史语义 = 全集）→ 五个产品各一条 `ACTIVE/LEGACY`。runner 跑过之后 `MeDto.platforms` 改为**由 enrollments 中 ACTIVE 的产品派生**（enrollments 为空的账号才回落读 CSV，仅覆盖 runner 尚未跑到的瞬间）。
- **新用户**：dev（`aep.platform.dev-grant-all=true`）→ 五个产品 `ACTIVE/GRANT_ALL`；生产 → **一条 enrollment 都不建**，进产品看到开通页。
- **激活码 = 开通**：`POST /api/me/enrollments/{product}/activate` `{licenseKey}`：条件更新 `UPDATE license_key SET status='ACTIVATED', activated_by=? WHERE id=? AND status='CREATED'` **影响 1 行才继续**；写 `entitlement_grant(source=LICENSE, source_reference=<licenseKey id>)` + upsert enrollment `ACTIVE/LICENSE`；沿用现有「激活发积分」逻辑；`Studio` / `Wallet` 缺失时在此处幂等补建；成功后 best-effort 回报账号中心链接 `ACTIVE`。已激活 / 不存在 → 409 `LICENSE_KEY_UNAVAILABLE`；已开通再激活 → 追加权益（现有「已登录追加激活」语义）。旧 `POST /api/auth/activate`、`/api/auth/sms/register` 保留给 legacy 模式，内部改走同一开通服务。
- **后端拦截**（`EnrollmentGuard`，在 JWT 认证之后；**2026-09-04 Codex P2 评审后修订**——`X-App-Code` 只能选、不能定）：
  - **服务端路由表是真值**（`ProductRouteTable`）：每条业务路由前缀 → 允许的产品集合。单产品路由（`/api/celebrity/**`、`/api/mixcut/**`、`/api/material/**`、`/api/me/material/**`、`/api/me/drama/**`、`/api/appearance-forge/**`、`/api/me/songs/**`、`/api/star/**`、DAP 写路由 …）**硬映射**，请求头只作审计；真正共享的路由（如 `/api/me/digital-ips` music+drama 共用、`/api/v1/**` 的 DAP 只读列表供 music/drama 选择器）给允许集合，`X-App-Code` 必须 ∈ 集合。
  - 产品无关白名单（不拦）：`/api/me`、`/api/me/enrollments/**`、`/api/me/license/**`、`/api/me/wallet/**`、`/api/me/notifications/**`、`/api/me/password`、`/api/me/tenants`、`/api/me/messages-overview`、`/api/me/clip/**`（服务令牌）、`/api/auth/**`、`/api/admin/**`、`/api/v1/admin/**`、`/api/internal/**`、`/api/config/**`、健康检查。白名单匹配用 `equals || startsWith(prefix + "/")`。
  - **未登记的业务路由一律 403 `PRODUCT_ROUTE_UNMAPPED`**（fail-closed）；`ProductRouteTableCoverageTest` 扫描全部 `@RequestMapping` 强制每条路由要么白名单、要么在表里、要么在带理由的公开路由清单里——新增控制器必须登记。
  - `X-App-Code` 接受「产品-端」形态（`celebrity-mp` → celebrity）；缺头且路由允许集合 >1 → 403 `APP_CODE_REQUIRED`；定到产品后无 `ACTIVE` enrollment（或 `valid_until` 已过）→ 403 `PRODUCT_NOT_ENROLLED`，`error.details.product`。
  - 原本落在 `anyRequest().permitAll()` 的业务 / 计费写接口改为 `authenticated()` 并进闸；真正公开的落地页数据保持公开。
  - 机器令牌（clip 服务令牌、INTERNAL）不经此闸。开关 `aep.enrollment.enforce`（默认 **true**；只允许测试配置关闭）。
- `/api/me` 返回 `identityUid` + `enrollments[]`（`EnrollmentDto`，字段名与 TS `Enrollment` 1:1，wire 小写）。

### 12.3 老用户导入（一次性，运维触发）

- 账号中心新端点 `POST /api/products/{product}/import-users`（client_credentials，scope `product.link`）body `[{localSubjectId, phone}]`（≤500/批）：按归一化手机号找 / 建 uid（`phone_verified_at=now`，PHONE identity），写 product_link `ACTIVE`，返回 **标准壳** `{success:true, data:{results:[{localSubjectId, uid, created, skipped?}], created, linked, skipped}}`；手机号属于 CLOSED 用户 → 该条 `skipped:"ACCOUNT_CLOSED"`。server 端解析 `data.results`，壳不认识必须报错而不是当空。
- server 管理端点 `POST /api/admin/identity/import`（SUPER_ADMIN）：分批把「有手机号且 `identity_uid` 为空」的 `aep_users` 送过去，回写 `identity_uid`；幂等可重跑；返回统计。无手机号的老账号无法映射，保留 legacy 登录。

### 12.4 账号中心事件消费

- server `IdentityCenterClient`（`AEP_ID_ISSUER` + `AEP_ID_CLIENT_ID`=`aistar-server` + `AEP_ID_CLIENT_SECRET`，client_credentials，令牌缓存到过期前 60s）。
- outbox 响应壳：`{success:true, data:{events:[{id, eventType, uid, productCode, payload:{…}, createdAt}], nextAfter}}`；server 解析 `data.events`，壳不认识 → 报错、游标不推进。已识别事件但 payload 非法 → 不推进游标，连续 5 轮失败后落 dead-letter（`platform_config` 键 `identity.outbox.deadletter`）并 ERROR。
- `IdentityOutboxPoller`（@Scheduled 30s，游标存 `platform_config` 键 `identity.outbox.cursor`）：`USER_MERGED{fromUid,toUid}` → `from` 的本地用户：若 `to` 无本地用户则把 `identity_uid` 改成 `to`；若 `to` 已有本地用户 → `from` 本地用户 `identity_uid=null`、`status=SUSPENDED`，WARN 记「需人工合并两份本地档案」（本期不自动合并业务数据）。`USER_CLOSED{uid}` → 本地用户 `status=DELETED`、`identity_uid` 保留（墓碑）、撤销其 HS256 会话不可行则忽略。`PHONE_CHANGED` → 忽略。

### 12.5 前端（`packages/api-client` 共享，五个 web app 零散改动）

- 环境：`NEXT_PUBLIC_AUTH_MODE=id|legacy`（缺省：配了 `NEXT_PUBLIC_ID_ISSUER` 即 `id`，否则 `legacy`），`NEXT_PUBLIC_ID_ISSUER`，`NEXT_PUBLIC_ID_CLIENT_ID`（dev 统一 `web-dev`；生产每 app 一个 `web-music` … `web-star`）。`USE_MOCK=1` 与 legacy 现有流程**完全不变**。
- `id` 模式：`AuthProvider` 无令牌 → 生成 PKCE（Web Crypto）+ `state`（sessionStorage）→ 跳 `${issuer}/oauth2/authorize?...&redirect_uri=${origin}/auth/callback&scope=openid%20phone`；各 app 新增 `src/app/auth/callback/page.tsx`（薄壳，调共享 `completeAuthCallback()`：校验 state → `POST ${issuer}/oauth2/token`（PKCE，浏览器直连，账号中心开 CORS）→ 存 `aistareco.auth.token`（access）+ `aistareco.auth.refresh` → 回 `returnPath`）。`apiFetch` 遇 401 → 用 refresh 换一次（单飞，防并发多次刷新）→ 重放；再失败 → 清令牌回 authorize。登出：清本地 + 跳 `${issuer}/connect/logout?post_logout_redirect_uri=…`。
- **开通门**：`hasPlatformAccess` 改为 `enrollments` 里本产品 `status=active`（`enrollments` 缺失 → 回落旧 `platforms` 判定，兼容老后端）。未开通 → 各 workspace 布局渲染共享 `EnrollmentGate`（`packages/landing`）：产品名 + 激活码输入 → `POST /api/me/enrollments/{product}/activate` → 刷新 `/api/me` → 放行；403 `PRODUCT_NOT_ENROLLED` 的 API 响应也统一导向该门。
- 激活码注册页 / 短信注册页在 `id` 模式隐藏（登录一律去账号中心），legacy 模式保留。`X-App-Code` 继续发送（后端 12.2 依赖）。

### 12.6 小程序（`apps/miniprogram`）

- `config.js` 加 `authMode`（`id|legacy`）、`idBaseUrl`、`idClientId=mini-aistar`。`id` 模式：启动 `wx.login` → `POST {idBaseUrl}/oauth2/token` `grant_type=urn:aibuzz:params:oauth:grant-type:wechat-mini&client_id=mini-aistar&code=`；存 access / refresh；`utils/api.js` 带 Bearer，401 单飞刷新一次。
- 手机号：`phone_verified=false`（解 JWT payload 读 claim）→ 进入带货 / 生成 / 支付前弹「一键绑定手机号」（`getPhoneNumber` → `POST {idBaseUrl}/api/me/phone/wechat-bind {code}`），`reloginRequired=true` 时清令牌重新 `wx.login`。
- 开通：`/api/me` 无 `celebrity` ACTIVE → 开通页（激活码 → `POST /api/me/enrollments/celebrity/activate`）。legacy 的「手机号 + 短信 + 激活码」注册页在 `id` 模式不再进入。请求全部带 `X-App-Code: celebrity`。

### 12.7 账号中心侧配套（`aibuzz-id` 仓）

- 客户端：`mysql` profile 增加五个生产 web 客户端（公开，PKCE，redirect `https://<sub>.aibuzz.cn/auth/callback`，audience `aistar-api`，scopes `openid profile phone offline_access`）、`aistar-server`（机密，`product.link`）、`mini-aistar`（公开，wechat-mini + sms + refresh，`wechatAppId=${ID_WECHAT_APPID_AISTAR_MINI}`，secret `${ID_WECHAT_SECRET_AISTAR_MINI}`）；dev 在 `web-dev` 之外补 `mini-aistar` 用 mock appid。
- **CORS**：`id.cors.allowed-origins`（dev 默认 `http://localhost:3010..3014`；生产从 `ID_CORS_ALLOWED_ORIGINS` 读，必填否则拒启）作用于 `/oauth2/token`、`/oauth2/revoke`、`/api/me/**`、`/userinfo`；`/oauth2/authorize` 是跳转不需要。
- 12.3 的 `import-users` 端点。
- **遗留项全部本期做**：① Seeder 回收 —— `id.clients[].disabled`/`id.wechat-apps[].disabled` 显式禁用；库里有、配置里没有的客户端启动时 WARN 列出并**自动禁用**（`id_client_meta.disabled=true` 为准，grant 集换成哨兵 `…:disabled`——SAS 不允许空 grant 集；不删行；仓库层对禁用客户端返回 null）；生产 profile 下 `id.clients` 为空直接拒启（防配置挂载失败让旧客户端继续签发）；② Redis —— `SmsCodeService` / `SmsRateLimiter` / `jti` denylist 抽 `KeyValueStore` 接口，`ID_REDIS_URL` 配置即用 Lettuce 实现（Lua 原子脚本），未配置：dev 进程内实现；mysql/prod 必须配 Redis 或显式 `ID_SINGLE_INSTANCE=true`（打 ERROR 横幅），否则拒启；③ 令牌即时失效 —— 合并 / 注销时把该 uid 写入 denylist（TTL = access TTL），`UserTokenGuard` 与 `/userinfo` 先查 denylist；`GET /api/tokens/denylist?afterId=&limit=`（主键单调游标，`after` 时间戳只作首次同步过滤；响应 `{items:[{id,uid,deniedAt,expiresAt}], nextAfterId}`）供产品侧可选拉取（server 本期只消费 outbox，不接 denylist）；④ 扫码登录 —— `MP`（公众号网页授权 `snsapi_base`/`snsapi_userinfo`，H5 用）与 `OPEN_WEB`（开放平台网站应用 `qrconnect`，PC 用）作为账号中心登录页上的「微信登录」入口：账号中心自己发起跳转到微信、回调 `/login/wechat/callback` 换 openid/unionid → 走 §5 解析建会话 → 继续原授权码流程；kind 对应的 appid/secret 沿用 `id_wechat_app`。

### 12.8 门禁

server：`./mvnw test` 全量不得回退（基线 471，唯一已知 flaky `JwtUtilTest.registerTicket_tamperedTokenRejected`）；`pnpm typecheck:all`、`pnpm check:api-contract`（新端点写进 `specs/openapi.yaml`：`/me/enrollments/{product}/activate`、`/admin/identity/import`）；账号中心全量 + MySQL 门测；前端 `pnpm --filter <app> build` 五个 app；小程序无自动化，按 README 手测清单。

**2026-09-04 · Codex P2 接入评审**：3 P0（开通闸未覆盖 `/api/material/**`、`/api/appearance-forge/**` 等业务路由；`X-App-Code` 由客户端自报导致只是名义隔离，可借他产品权益通行；server 解析 outbox / import 响应时不认标准壳 `{success,data}` → 事件永远为空）+ 10 P1（坏事件被永久确认、`LEGACY_ADMIN_ROLES` 垫片窗口、V24 吞掉所有异常、多产品秘钥只记主产品、令牌落 localStorage、多标签页刷新与轮换冲突、`/api/me` 网络错误当未登录形成登录循环、小程序吞掉合并后重登失败、生产空客户端配置不 fail-fast）+ 6 P2。判定「先修再联调」。同日修复：服务端路由表 + 覆盖门测 + 未登记路由 fail-closed；壳解析改强类型契约 + 跨模块 JSON 契约测试；dead-letter；垫片改默认关闭（部署后管理员重新登录一次）；V24 只忽略「已存在」；`entitlement_grant` 每产品一行；Web Locks 跨标签页刷新协调；`/api/me` 仅 401 清会话；小程序合并重登失败向上抛、空 `enrollments` 为真、id 模式缺地址 fail-closed；生产空 `id.clients` 拒启；denylist 改主键游标。**遗留 P5**：BFF + HttpOnly cookie（D9 注）。

**2026-09-04 · Codex P2 第二、三轮**：第二轮 19 条中 16 条关闭、P1-6（localStorage）按约定延期 P5、P1-7 / P1-8 未彻底（锁等待超时后仍无锁刷新；`/me` 401 后刷新遇网络错误 / 5xx 仍清令牌）；新发现 1 P1（dead-letter 经匿名 `/api/config` 可读，含 uid）+ 2 P2（`GET /api/store/catalog` 匿名 200 但登录未开通 403；aiavatar 身份缓存被换号前的在途响应覆盖）。同日修复：锁超时改只读采纳 / 抛 TRANSIENT 绝不清令牌，只有锁内刷新可清；刷新失败分「确定性 / 瞬时」，瞬时 → 503 `AUTH_REFRESH_UNAVAILABLE` 保留令牌进重试屏；匿名 `/api/config` 改前缀白名单（`incubation.` / `forge.` / `drama.credit.`），dead-letter reason 脱敏；`PUBLIC_GETS` 表豁免公开目录且覆盖测试不再跳过；aiavatar 身份缓存按会话版本丢弃陈旧响应。第三轮确认见下。

**2026-09-05 · Codex P2 第三轮**：5 项中 4 项关闭；aiavatar 登出顺序（先作废缓存再清令牌，监听者会用旧令牌发新请求写回旧身份）未关闭；新 P1：无 Web Locks 时租约 10s 到期可被接管，而刷新请求无超时 → 第二标签页重复消费同一 refresh token 后清会话。同日修复：`postToken` 加 8s 硬超时（< 租约 TTL，超时归瞬时、不清令牌）；aiavatar `logout()` 先清令牌再作废缓存。门禁：server 821 / 0；api-client 45；五 app build 全过；`pokocat/aibuzz-id` CI 首推即绿（204，含真实 MySQL / Redis 容器）。

**2026-09-05 · Codex P2 第四轮**：登出顺序关闭；租约接管仍开着一条缝（定时器在 `res.json()` 前撤销，响应体阶段可拖过 10s 租约）。同日修复：中止定时器活到 body 读完、body 阶段中止归 NETWORK/TIMEOUT 瞬时；`withLease` 持有期间心跳续租。api-client 45 测试、typecheck、build 全绿。

**2026-09-05 · Codex P2 第五轮**：(a)(b)(c) 落实；残留：无 Web Locks 的降级租约下，持有页被浏览器冻结会连超时和心跳一起暂停，租约到期后另一页接管并重复消费同一 refresh token，收到 `invalid_grant` 仍会清会话。同日修复：租约区分「空闲取得」与「接管过期租约」，接管者的 `invalid_grant` 视为不可判定 → 抛 TRANSIENT 保留令牌（冻结页醒来落库后下一次重读即采纳）；Web Locks 路径不存在接管。这是降级路径的边角（现代浏览器都有 Web Locks），无新增 P0/P1。

**2026-09-05 · Codex P2 第六轮**：接管者首次 invalid_grant 已保留令牌，但释放租约后「不确定」状态丢失，下一次重试按空闲取得进来再失败即清会话——只是把误清推迟了一次。同日修复：不确定状态以 `aistareco.auth.refresh_ambiguous`（绑定出问题的 refresh token，窗口 60s）跨重试保留；窗口内同 token 再失败仍瞬时，窗口过后再失败才清会话重登；成功换发即作废标记。真吊销 / 冻结页永不醒来最多多等 60s，不会永久 TRANSIENT。

**2026-09-05 · Codex P2 第七轮**：不确定状态已跨重试保留、真吊销最多多等 60s、无新 P0/P1。**判定：可进入预发联调。** 顺手修正一条测试注释（原称「不发请求直接采纳」与实际不符，改为断言成功后标记被清）。至此 P1 六轮 + P2 七轮评审收口；下一步按 TODO.md「P2 收尾 · 预发联调」上线：账号中心（`pokocat/aibuzz-id`）→ server → 前端。
