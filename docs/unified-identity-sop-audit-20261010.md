# 统一认证跨应用 SOP 复核（2026-10-10）

状态：本轮修复已分仓提交、推送及部署，生产验收进行中。跨产品矩阵、证据、适用边界和未完成项的唯一记录为 [账号中心复核记录](../../aibuzz-id/docs/INTEGRATION-SOP-AUDIT-20261010.md)，验收规则为 [中心 SOP](../../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md) §7.9 / §10.6。

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

## 线上验收补漏与构建要求

- 实际浏览器发现首次制品默认 legacy，五个 Web 没走统一登录；生产构建默认改为 id + https://id.aibuzz.cn。必须查 manifest 的 AUTH_MODE/ISSUER 并逐应用验授权回跳，不能只看 HTTP 200。6ceed370 为中间制品，最终使用纠正配置重构建。
- 独立 V50 新增身份状态、发布事件时钟、令牌撤销时钟。中心停用与产品本地 status 分离，旧解除停用不覆盖新事件，CLOSED/MERGED 不复活；首登前停用写无权益占位。
- RS256 和关联 UID 的 legacy 用户令牌检查撤销时钟，解除停用不恢复旧票。合并提交后回报存活 UID 业务链接，再回 COMPLETED；已知身份事件连续失败留诊断，但不越过游标。
- Java17 身份及迁移专项最终 76 项通过，无失败或跳过；包括真实签名旧 JWT、H2 增量 V50 与重放。TypeScript、管理员、API 契约及编译门全通过。生产 V50 前 MySQL 备份 `/opt/ai-star-eco/backups/identity-v50-20261010/database-before-v50.sql`，10,009,264 bytes。
- 专用非真实账号广播 ID21–27；注销25、合并27已在 aistar、quickreel、aislides、classvibe 四产品收到 COMPLETED。两个旧签名 JWT 访问 AIStar 均401 ACCOUNT_DISABLED，不复活 UID；后续停用场景另验。
- 回补既有 ACTIVE 中心 UID 的产品档案链接，保留已有 ACTIVE 链接状态，不开通产品、不变更角色、钱包或积分。13939004928 本轮未再次充值。
