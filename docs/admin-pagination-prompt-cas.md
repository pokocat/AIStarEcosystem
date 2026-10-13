# 管理明细与 Prompt 保存后续修复

日期：2026-10-13（北京时间）。复用现有原库、原服务、身份与管理签名，不迁移业务数据。

- `usageRecordsPage` 对原流水在库内筛选、计数与排序分页；固定 asOf，新记录不会挤占后续页；老 500 条数组命令保留兼容。
- Prompt 写入使用原预期版本条件更新；首次创建依靠原唯一键。正文、历史和既有审计同事务，缓存仅提交后失效；保存 / 历史恢复冲突返回 409，不覆盖他人修改。原 admin 两处 Prompt 页面发送表单编辑基准版本，不随列表刷新静默升级。
- `endpointProbe` 把当前地址和密钥委派给原 discoverModels，编辑同供应商可复用原密钥，换供应商要求新密钥。只读目录，不发起生成或保存端点；错误脱敏、目录去重与非法 200 校验。前端目录 / 检测结果由平台按当前配置管理。

与本轮原后端版本相应的能力、限制及契约见 specs/openapi.yaml / BUSINESS_RULES.md。无数据库结构迁移。专项测试使用 H2 与本地 HTTP 夹具，未读取生产凭据或发起真实供应商请求；维护中 admin 的类型检查与 API 契约检查通过。发布 SHA、备份及验收另补。

## 生产发布

本轮功能代码 `238a9872`；合入执行期间已经部署的模型候选契约修复 `d486879d` 后，实际上线代码 `69203eab710f4a300570e83baf14817630426fee`。server / admin 产物发布到 `/opt/ai-star-eco/releases/20261013-admin-followups-69203eab`，JAR SHA256 `8e430a4358652d7b546a7f9b458f8199a049f76818ad6a3b7c4d60a2e08ec28d` 与运行文件一致。只重发 server / admin，业务前端没有重发。

备份在 `/opt/ai-star-eco/backups/admin-followups-20261013T105559Z`，包含 MySQL 单事务 dump、旧 JAR / admin 与现有环境和 systemd；root 可读，完成标记及归档目录检查通过。首次激活因错误 `/login` 验收路径自动恢复旧产物；核对真实 `/admin/login` 后再次激活成功。服务 active、`/api/config` 与 `/admin/login` 200，无本轮数据库结构迁移。最新基线 69 项专项测试和最后候选契约回归 36 项通过，不重复计算重叠用例；前端类型与契约检查通过。

平台运营入口 [ops.aibuzz.cn](https://ops.aibuzz.cn) 已验收主页面 Prompt Tab、真实总数分页及新增端点检测 / 拉取入口。生产验收未更改正式模板或端点，未发起供应商请求。部署与线上证据存于平台 docs/reviews/2026-10-13-admin-followups-production-release.md。
