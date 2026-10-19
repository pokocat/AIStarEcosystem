# 企业主子账号第一批验收

> 本文保留当批验收及当时边界；后续状态见 [完整交付验收](ip-studio-enterprise-complete-validation.md)。

> 2026-10-15 · 本地基线 bcceeed2 上的未提交改动 · E01–E04 · 未部署生产。

## 已交付

| 任务 | 实际结果 |
|---|---|
| E01 | enterprise.ts 类型、共享 API 调用和 admin 镜像；OpenAPI 28 项 schema，13 个基础操作；后续资金接口标 planned；业务规则同步 |
| E02 | V56 企业/当前成员归属/邀请/策略/移交/审计/划拨结构；钱包主体、冻结、任务及订单账户关联；旧个人数据兼容 |
| E03 | 企业创建、邀请接受/撤销、角色能力、分页成员/审计、模型策略、双方确认移交；集中 RBAC，无平台角色继承 |
| E04 | 按 walletId 统一入账/冻结/结算核心，保留个人 userId 包装；引用匹配、资金锁序、企业账户空 userId 兼容，划拨不计发行/收入 |

企业管理接口由 `AEP_ENTERPRISE_ENABLED` 控制，默认关闭。当前创建企业和加入成员只建立零余额企业账户，不变更个人积分或产品开通。

## 测试证据

- **H2 及旧业务回归：47 项，46 通过，1 项按条件跳过**。跳过项是需独立 MySQL 连接的迁移测试，另在 MySQL 运行。测试类为 EnterpriseFoundationTest、EnterpriseMigrationTest、EnterpriseFeatureGateTest，以及 CreditServiceRefundTest、CreditServiceHoldLockTest、WalletBucketAndConcurrencyTest、EnumColumnWideningMigrationTest、AdminCreditControllerSecurityTest、AdminUserControllerWalletSecurityTest。
- **独立 MySQL：18 项全部通过**。包括14项企业/钱包集成、2项迁移（H2和MySQL各一次）、2项默认开关检查。使用本机一次性隔离库，未操作现有业务数据库。
- 编译门：`pnpm typecheck:all`、`pnpm typecheck:admin`、server `./mvnw compile -q -o`、`pnpm check:api-contract` 通过；企业领域 `check-wire-mirror --domain=enterprise` 的15对字段镜像、OpenAPI YAML 解析与 schema 引用通过。

核心断言：

1. 创建请求幂等；主账号移交后原创建请求仍可识别；不重复赠额或新增开通。
2. 邀请仅存哈希，过期/撤销失效；同一邀请不能并发被两人使用，一人不能并发加入两家企业。
3. 无开通用户不能通过企业邀请开通；普通成员不能提权，企业 owner 无平台财务权限，跨企业请求403，匿名401。
4. 移交必须接收者确认；两个接收者竞争只有一笔成功，最终恰好一个 owner；移交绑定原 owner 版本。
5. 企业成员冻结按企业钱包结算，个人/企业引用不能串用；修改金额或授权冲突拒绝，主账户不可直接消费。
6. 预占100、实扣40、释放60后，可用余额恢复正确、冻结清零；重复释放无额外入账；gift/recharge 桶属性保留。
7. 余额100并发两笔80，仅一笔成功；新增内部划拨流水不增加积分发行统计。
8. 历史迁移可重复验证，个人余额777、冻结40及旧账本金额/用户/类型保持，企业账户支持空 userId。

## 复现与范围

server 目录运行：

```bash
./mvnw -q -o -Dtest=EnterpriseFoundationTest,EnterpriseMigrationTest,EnterpriseFeatureGateTest,CreditServiceRefundTest,CreditServiceHoldLockTest,WalletBucketAndConcurrencyTest,EnumColumnWideningMigrationTest,AdminCreditControllerSecurityTest,AdminUserControllerWalletSecurityTest test
```

MySQL 验收另传 `-Denterprise.test.jdbc=<独立测试库JDBC>`、`-Denterprise.migration.jdbc=<另一个空测试库JDBC>`，仅供本机隔离测试。测试使用 create-drop 或创建历史表，**不能指向业务数据库**。迁移测试须使用新空库；本次本机测试使用独立 root 测试连接，不保存凭据或业务数据。

接口验收使用 Spring Security 链和 MockMvc，覆盖实际 controller/service/JPA。不是浏览器页面验收、真实 OIDC 登录链路或真实供应商生成验收。未调用付费生成，也未给实际企业充值。

页面规划已按指定 [gpt-taste](../ip-studio-enterprise-ui-plan.md) 完成，E09/E10 的完整界面尚未实现。旧财务页面仅做 nullable userId 和新流水类型兼容。

## 后续边界

E05 分配/回收、E06 企业人工充值、E07 企业生成准入、E08 停用/退出的资金闭环及 E09/E10 页面仍待实现；不能将基础开关打开当作这些能力已可用。企业分配积分仍归企业、开通沿用现有逻辑的规则已固定，后续按 [任务清单](../archive/ip-studio-enterprise-development-tasks.md) 继续。

契约检查仍有仓库存量的非本期 handler/orphan 提示；本期已使用的企业调用均有对应 handler。额外严格解析发现并修正了原 OpenAPI 四处 flow description 缺少引号的问题，未改变其业务含义。

附加全局 `pnpm check:wire-mirror` 仍报告4项存量 clip DTO/TS 漂移（Template/Job/Avatar/Voice）；相关文件本轮未改，已登记 TODO。企业领域检查单独通过；不将全局镜像检查记为通过。
