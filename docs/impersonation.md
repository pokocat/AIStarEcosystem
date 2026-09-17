# 附身登录：管理员以用户身份操作

2026-09-17 · 按“简单登录、与目标用户相同权限”实现。

## 使用

admin → 平台账户 → 账号 & 经纪公司 → 启用中的用户 → 附身登录 → 选择产品 → 登录用户账号。
新标签页进入目标用户的工作台，原管理后台不退出。五个产品（drama/music/celebrity/aiavatar/star）
共用回调。页面显示“正在以某用户操作”和“退出附身”。编辑、生成、删除、支付等操作不做附身专属
只读限制；按用户原有权限、产品开通、数据归属和计费规则执行，操作真实生效。

仅当前有效的后台 SUPER_ADMIN 能发起；包括现存 admin_users 和 operator-login 超管入口。
用户会话不继承管理员后台权限。目标用户自己的 in-app operatorRole 按原逻辑判断，不额外剥夺。
不要求目标密码、短信，不要求管理员关联账号中心 uid；没有审批、原因必填、角色迁移或新数据库表。

## 实现与边界

产品后端建立普通用户的 Spring Security 主体，复用既有 EnrollmentGuard 和业务权限；
不新签账号中心 OIDC 令牌，也不改账号中心已有 impersonate grant。仅限本产品服务的用户端，
不是账号中心的 SSO 会话，访问账号中心安全管理仍需真实身份验证。

交接码 256 位随机、60 秒有效、一次消费，通过 URL fragment 交接并立即从地址栏移除；
换取 30 分钟不透明 Bearer 会话，无刷新令牌。浏览器按标签页存 sessionStorage，原账号的
localStorage/refresh token 不被覆盖。过期不会回落到原账号重放请求。退出撤销当前会话，
整页重载清缓存；不会注销目标用户或调用其全局登出。

当前是**单进程内存会话**，最多 500 个票据/会话，过期清理。服务重启会使附身失效，重新发起即可。
多实例负载均衡尚不支持：不能将本实现宣称为分布式会话；扩容时改共享存储或先做粘性路由。
管理员和目标用户状态每个请求重查；已开始执行的请求不因随后撤权而回滚。
关闭标签页不是服务器撤销，剩余会话到期自然失效；显式“退出附身”会马上删除本次服务端会话。
XSS 可读取 sessionStorage，仍须沿用现有前端安全治理，不宣称等同 HttpOnly。

接口机器可读补充契约：[`../specs/impersonation.openapi.yaml`](../specs/impersonation.openapi.yaml)。

## 接口

| 方法 | 路径 | 权限/行为 |
|---|---|---|
| POST | /api/admin/aep-users/{id}/impersonate | SUPER_ADMIN；body `{product}`，返回 `{handoffUrl}` |
| POST | /api/auth/impersonation/exchange | 一次性交接码；body `{code,product}`，Origin 必须等于该产品服务端登记值 |
| POST | /api/auth/impersonation/exit | 当前附身 Bearer；幂等退出，不影响本人正常登录 |

均使用现有 `{success,data}` / `{success:false,error:{code,message}}` 响应壳，响应 no-store。
登录响应 `{token,targetName,product,expiresAt}`。本模块错误码以 `IMPERSONATION_` 开头。
发起/进入/退出进入原 AuditService；附身请求日志记录 actor、target、method、path、status，不记录凭证。

## 配置与交付

默认产品地址为 `https://<product>.aibuzz.cn`；覆盖配置 `aep.impersonation.origins.<product>`。
本地 dev/test 可以显式设 `http://localhost:<port>`；生产只接受 HTTPS origin，不接受路径/参数。
无需配置账号中心客户端、密钥或数据库迁移。

发布 server、admin 和使用附身的 web 产品需配套更新。五端回调均为
`/auth/callback/impersonation`，代理需继续把 `/api` 转发给同一产品后端。
本轮不部署、不改生产权限或账户数据。生产需用无余额/权益风险的测试账号验证完整流程后再使用真实账号。

测试覆盖：admin 限制、当前角色复核、过期/重放/并发交接、Origin/产品校验、普通写操作、
目标用户状态、退出隔离、401 不刷新/不重放原账号、sessionStorage 与原登录态隔离。


## 验证命令与验收范围

`Impersonation CI` 只构建/测试，不自动提交、不调用生产部署，也不读取生产凭据。
服务端执行 `./mvnw verify`；`ImpersonationSecurityTest` 使用完整 Spring Security 链及 H2，
验证管理员发起、真实修改测试用户资料、目标产品未开通仍被拒、退出隔离与撤权。
`ImpersonationTest` 覆盖一次消费/并发/时间边界；共享客户端测试覆盖令牌隔离与回调重入。

前端执行 workspace 类型检查与单元测试，另构建 admin 和五个 Web 产品。
`scripts/impersonation/browser.cjs` 在真实 Chromium 和生产 Next 页面上验证后台入口、
一次性交接、回调不请求原用户、跨标签页隔离、过期页面不循环、提示条与退出。
**浏览器 API 响应为合成测试夹具**；服务端权限由前述真实安全链测试独立覆盖。
这不等于已经在生产环境登录真实用户，也不构成真实扣费、微信/OIDC 联调验收。

手机号策略和各产品运营授权不在本 PR 改造范围。后台角色与原产品规则不修改；
本次附身只是临时以目标用户操作，不能将后台管理员的权限转赠给目标用户。
