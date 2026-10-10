# 统一认证跨应用 SOP 复核（2026-10-10）

状态：本轮修复和回归在本地完成，未提交或部署。跨产品矩阵、证据、适用边界和未完成项的唯一记录为 [账号中心复核记录](../../aibuzz-id/docs/INTEGRATION-SOP-AUDIT-20261010.md)，验收规则为 [中心 SOP](../../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md) §7.9 / §10.6。

## 本仓共享后端

五个 web 产品（music/drama/celebrity/aiavatar 含 Studio/star）共用 server。新增当前 profile 更新、旧 JWT 防回写、UID/ACTIVE 行锁复查、事件使在途资料失效、首登前注销/合并 UID 墓碑、事务后回执与严格 outbox 页校验；本人和后台读取同一档案。未修改积分和开通，不重复此前 2000 积分赠送。

最终 Java 17 身份专项 **68 项全部通过，无失败/跳过**，覆盖 IdentityPhoneSyncServiceTest、IdentityOutboxTest、IdentityProvisioningServiceTest、IdentityJwtFilterTest、IdentityCenterEnvelopeContractTest、AdminAccountSearchTest；包括真实 H2/JPA 合并 flush、旧 UID 墓碑、首登前注销、实际 HTTP 机器令牌/回执、非法分页与禁止重定向。共享 api-client **70 项通过**，typecheck 通过，新增在途刷新成功/失败期间退出和换账号的四项回归。

共享 `packages/api-client` 发现与小程序相同的旧刷新响应覆盖问题，五个 web 产品一起修复：响应写存储前重查 access/refresh 会话，退出或新登录后丢弃旧响应，旧临时故障也不恢复/清除已改变的会话。保留 Web Locks、多标签页轮换、租约接管与瞬时错误原有语义。

## 其他产品

- 爱速拍/军师：既有 UID 刷新手机号/昵称/头像，阻止旧资料覆盖新资料；后台修掉最新 300 截断；小程序刷新期间登出/换账号不再被旧成功响应恢复。BFF 全量 2188 通过、2 既有跳过；缺生产机器客户端与 outbox 是剩余接入缺口。
- AI Slides：已关联号码验证、标准验证优先级、窄 CAS、issuer 精确匹配；83 项通过。既有 outbox/产品链接阶段未完成。
- ClassVibe：资料唯一真值、V14 资料时钟、搜索竞态、注销/合并墓碑与回执；94 身份专项、503 前端测试、真实本地 OIDC/重启验收通过。生产停服，2 项既有部署脚本门禁失败；不声称线上修好。
- Ops：20 项真实 PostgreSQL 身份/权限回归通过，无同类代码缺陷，只更新登记状态文档；不把品牌成员别名改成全局昵称。

此前手机号/后台搜索的已上线事实保留在 [独立发布验收](identity-phone-release-20261010.md)。本轮新增代码与其他应用的生产发布不能由该记录推导。

## Follow-up implementation and release (2026-10-10)

User authorized deployment after tests and confirmed ClassVibe existing valid transition configuration. Quickreel BFF durable event consumer, UID tombstones, cursor/receipt ordering and token versions pass 2195 tests (2 existing skips). AI Slides OIDC/auth suite: 270 pass; real SQLite and PostgreSQL upgrades: 3 pass. ClassVibe 915 backend tests, 503 frontend tests and real MySQL/Redis gates pass; release cef916d, V14/V15, active/enabled service and public health verified. Production identity acceptance remains in progress; private media migration is separate.
