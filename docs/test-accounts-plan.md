# 后台测试账号

已生产发布。后台[平台账户 → 账号 & 经纪公司](https://admin.aibuzz.cn/admin/platform/accounts)的「测试账号」区，仅有效超级管理员可用。

- 创建独立测试身份，不填写真实手机号，不占用真实号码；名称带「测试」。
- 生成两分钟内有效的一次性登录链接，在独立浏览器打开；身份由账号中心校验，随后正常 OIDC/PKCE 进入 Studio，页面持续显示测试标识。
- 可重复生成入口，可停用；停用沿用账号中心撤授权/denylist/outbox。创建、生成入口、停用均有后台审计。
- 不开放普通用户固定码，不伪造 `phone_verified`；测试身份禁止绑定真实凭据。产品只为已验签的明确测试身份免去手机要求，原有开通、企业权限和积分规则保持。
- 首次产品建档、企业群发链接多人加入可用测试身份回归；短信网关、真实手机注册仍单独验收，不能混写成测试通过。

身份实现在 aibuzz-id README §26，无新数据库迁移、env 或客户端授权；已同步发布 ID、server、web-aiavatar、admin。账号中心原仓未提交的资料编辑不在范围内。

验证：ID 专项 9 项（正常 OIDC code/PKCE 与刷新、票据重放、CSRF、停用与普通账号拒绝），产品后端专项 78 项、后台交互 3 项通过；admin/Studio 类型与 API 契约门通过。ID 全量 75 类、528 项全过，MySQL/Redis CI 成功；线上创建、复制、停用及同一链接两人入企均通过。版本、清理与证据见[发布记录](releases/ip-studio-enterprise-invitation-production-release-20261017.md)。
