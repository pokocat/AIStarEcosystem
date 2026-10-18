# 企业群发邀请与后台测试账号：生产验收

2026-10-17（本地时间；服务器 UTC 发布跨至 10-18）。已提交、推送并发布。

## 交付

- 企业邀请：默认 90 天、可选一年，同一链接不限单人，可撤销；注册/登录后加入企业，沿用产品开通和 RBAC。企业宣传片风格新头图已上线。
- 后台[账号管理](https://admin.aibuzz.cn/admin/platform/accounts)增加「测试账号」，仅有效超级管理员可创建、生成入口和停用。独立身份无手机号；一次性入口两分钟有效，正常 OIDC/PKCE 登录 Studio，持续显示测试标识。
- 测试身份只免真实手机要求，产品开通、企业权限、积分和模型计费照常；不发放免费积分，不使用固定验证码或模拟短信。具体约束见[测试账号说明](test-accounts-plan.md)。

## 发布真值

| 项目 | 实际发布 |
| --- | --- |
| 产品源代码 | `d8195896c0cf0ec4dc50cea602a2b793da6fa45e`，分支 `codex/enterprise-invite-release` |
| 产品制品 | `20261017-enterprise-invite-final`：server、web-aiavatar、admin |
| ID 源代码 | `0dc48cb96152470accfaab9bb163d71ae35fdf3a`，分支 `codex/test-accounts` |
| ID 制品 | `20261018-062044`，当前服务实际指向该版本 |
| server JAR SHA256 | `8d226c4d4a3f6800cd92ed64a0485131b01bf7fa50e2ffff0393d30e3b608b61` |
| ID JAR SHA256 | `7a4901672cf1b5db95a159b27f2cac7c31fb4d5ba73d3f658a1b0313a401fa8f` |
| Studio / admin BUILD_ID | `hUC-ZWjV6GVvQGYC8yHye` / `hM-u08YVF2LH7RWzgQDTY` |
| 迁移 | V59 成功，旧 `accepted_by` 列已删除；不改成员、钱包或作品 |

采用干净发布分支，保留已上线的表单、Group、封面及字体改动；未将主工作区其他未提交功能混入。原环境、ID 客户端授权及生产开通策略未变。线上标准健康检查全部通过，公开头图内容 SHA256 与源码一致（`028b2bf74e7c1ff224e1d17acf0fe85f9c22b647702c5aeb662ae88ce9a73de4`）。

## 真实线上流程

| 场景 | 结果 |
| --- | --- |
| 新测试身份首次进入 | 独立 ID 测试身份 → 一次性入口 → 正常 OIDC code/PKCE → 产品首次建档 → Studio；未发短信 |
| 同链接多人加入 | 测试主账号创建企业和 90 天链接；成员 A、B 用各自身份打开同一链接并加入；管理页真实显示 3 人，链接仍有效 |
| 角色与积分 | A、B 均为普通成员，不显示成员管理操作；企业/成员余额与冻结均为 0，无免费积分或付费模型调用 |
| 后台界面 | 超管创建第 4 个测试身份，自动生成入口；复制内容一致；创建/生成入口/停用的持久审计分别为 1/1/4 条 |
| 停用与收尾 | 第 4 个身份停用后，未使用入口点击登录显示「测试登录已失效」；全部 4 个 ID 身份和产品 identity_state 均为 SUSPENDED |
| 企业收尾 | 原主账号通过真实页面撤销邀请、预览并关闭临时企业；数据库状态 closed、邀请 revoked、当前成员 0；保留审计和零余额历史记录 |
| 数据边界 | 4 个测试身份均无手机号/密码/登录名/PHONE 凭据，产品 phone_verified=false；账本从验收前至结束均为 810 条 |

部署前后、创建测试数据之前，钱包/账本/开通/成员快照逐字节一致。测试期间仅产生明确标识的测试身份、企业关系及既有开通策略的建档结果，没有改真实用户余额或身份。

本次按用户要求以后台测试身份验收，**未重测真实短信首次注册及短信网关**；普通用户短信注册代码仍走原 ID SMS grant。本地短信流程记录见[实现与验收](ip-studio-enterprise-invitation-validation.md)，不把本地固定码或测试身份结果当作生产短信证明。

## 检查与回退

- ID 全量：75 类、528 项，0 失败/跳过；[完整 CI](https://github.com/pokocat/aibuzz-id/actions/runs/39103415733)成功，包含 MySQL/Redis 集成。产品专项 78 项、后台交互 3 项通过，邀请本地与真实 MySQL结果见原记录。
- 全 workspace 类型、后端编译、API 契约及 enterprise 16 组镜像检查通过；最终三服务正式构建成功。全局 4 组 clip 镜像漂移为既有待办。
- 备份位于服务器 root 私有目录 `/opt/ai-star-eco/backups/20261017-enterprise-invite-test-accounts`，含两库、旧制品、环境/客户端配置和财务快照。日志不记录邀请 token、一次性入口或访问令牌。
- V59 已执行；回退应用须保留当前数据库，选择兼容群发结构的制品或关闭入口，不能直接恢复整库覆盖上线后的正常数据。ID 无新迁移，可按既有发布脚本回退。

[邀请页截图](../apps/web-aiavatar/.impeccable/review/enterprise-invitation/production-invite.png) · [三成员结果](../apps/web-aiavatar/.impeccable/review/enterprise-invitation/production-members.png) · [后台收尾](../apps/web-aiavatar/.impeccable/review/enterprise-invitation/production-admin-test-accounts.png)
