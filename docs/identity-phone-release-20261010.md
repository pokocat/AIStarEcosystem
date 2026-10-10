# 统一认证手机号与后台搜索修复 · 2026-10-10

## 发布版本

| 项目 | 已核实结果 |
|---|---|
| 业务修复提交 | `a1fef5724942c790bed6083905506d94edc9e7ed` |
| 隔离构建提交 | `9e5de98214549cb4438083950678c432a35e4174`，与业务修复提交的 Git tree 完全相同 |
| 上线基线 | `8f4f4466a3edf0078c5ab9ef8836fa9747d39121`，保留此前已上线的 Studio 聚算模型与异步图片支持 |
| 发布包 | `20261010-identity-phone-a1fef572` |
| 发布服务 | `server`、`admin` |
| 在线 JAR SHA256 | `ae079cbb8bc3bb9ca88738e8e32401c44027f483348a6bc82d9d84478bfbab47`，与构建产物一致 |
| 账号中心 SOP | `pokocat/aibuzz-id` main 提交 `f0450a1cf1d3208340bc55a25898a6b75b65801c` |

手机号是产品展示与搜索副本，身份仍只按账号中心 UID 映射。完整号码仅从已验签且实际具有 `phone` scope 的用户令牌调用固定 issuer 的 `/userinfo`；响应主体和事务行锁后的本地 UID 均须匹配。失败保留旧资料、15 秒后重试；成功读取间隔最多 300 秒且不超过令牌有效期。换绑事件清除旧号码副本并使缓存失效，不把事件里的脱敏号码写入完整号码字段。

后台 `GET /api/admin/users` 先按 `q` 搜索，再分页；支持手机号、昵称、用户名、邮箱及本地 ID/UID，返回真实总数。前端每页 50 条并处理输入去抖、请求取消和旧响应，修复原来的“请求 200 条、服务端截为 100 条、浏览器只搜已加载用户名/昵称”问题。

## 验收证据

- 专项后端测试 46 项通过，失败/错误/跳过均为 0：手机号同步 8、outbox 14、JWT filter 13、建档映射 8、真实 H2 分页搜索 3。
- 全 workspace 类型检查、后台生产构建、接口契约检查通过；契约扫描原有非阻断警告未扩大。
- 本地真实账号中心完成 PKCE 密码登录、换令牌、`/userinfo`、产品 `/api/me` 和管理员手机号搜索；主体 UID 与本地用户 ID 一致，未触发生成。
- 本地验收使用独立临时 H2 的 MySQL 模式、Hibernate 建表且关闭 Flyway。全新库已有 V48 初始化顺序和 `cast` 列名问题另记 TODO，不能把这次专项验收视为全新 Flyway 启动通过；生产既有 schema 未改变，无新迁移。
- 线上 systemd 全服务 active、API 就绪、nginx 配置检查和 CJK/SAU 检查通过；在线 JAR 与发布包相符。
- 默认验证脚本在 admin 子域名探测 `/login` 得到 404；按该域名实际路由 `/admin/login`、`/admin/platform/accounts`、`/api/config` 重新验证，结果 ALL GREEN。这是探测路径差异，未修改生产路由。
- 对本次指定的手机号尾号 `4928` 存量账号，先核对账号中心手机号 → UID → 产品本地 ID，备份旧字段，再经既有管理员 PATCH 仅补齐 `phone` 副本。前后账号状态、phoneVerified、角色、开通记录、钱包和账本一致；原授权发放的 2000 积分账本仍唯一存在，没有再次赠送。
- Chrome 真实后台输入该完整手机号，只返回 1 个正确账号，邮箱/手机列显示完整号码；总数与分页一致。验收截图保存在本地忽略目录 `.studio-e2e/credit-grant/admin-phone-search-repaired.png`。

存量补齐的旧值和结果保存在 ECS `/opt/ai-star-eco/backups/identity-phone-20261010-<local-user-id>/`，目录 0700、文件 0600。维护令牌只在进程内存使用，没有进入文件、命令参数或日志。

## 统一认证接入 SOP

真源为独立账号中心仓库的 [INTEGRATION-GUIDE-FOR-AGENTS.md](https://github.com/pokocat/aibuzz-id/blob/main/docs/INTEGRATION-GUIDE-FOR-AGENTS.md)：

- §7.9：资料来源与消费位置、授权 scope、UID 核对、缺少授权/无号码/读取失败的区别、超时缓存、换绑与合并、后台跨分页搜索、存量补齐及权益不变。
- §10.6：新旧用户、换绑、异常、分页外账号、旧响应、真实线上 SHA 与 UI 的必验矩阵。
- §11：本地 issuer 与 hostname、端口、回调/退出地址、深链、持久数据库与幂等固定测试用户，以及本地配置不得发布。

账号中心本次只发布文档；资源服务器和后台的修复已上线，消费端前台无需重新构建。
