# 企业主账号积分转入与成员手机号 · 生产发布

2026-11-01，America/Los_Angeles。用户授权“提交部署”，本次只提交本聊天的企业功能；原工作区其他未提交改动已备份、合并恢复并核对原增删内容，未带入制品。

## 结果

- 企业 owner 在“我的个人积分”点击“转入企业”，个人可用普通积分原桶转入企业待分配账户，再按原有流程分配给成员。无新增权限项、审批或迁移。
- “成员积分”和“成员与邀请”均显示产品档案中的手机号；后台流水识别“个人转入企业”。
- 最新 main 上 35 项前端、91 项企业后端回归全部通过；全工作区串行类型检查、独立 admin 类型、API 契约及三组企业 DTO 镜像通过。统一队列门禁 `c88d556feb53`，退出码 0。

## 正式制品

| 项目 | 真值 |
| --- | --- |
| 构建 main 提交 | `1e3e3f7953a105f5866b534ce5c36ee12b93e316` |
| main 同步 | 先以 origin/main `8de4c93a2` 整合，推入 main 后从对应干净提交构建；保留线上已有 H3 分镜、提示词素材标签及场景导航 |
| 发布包 | `20261101-enterprise-owner-deposit`，server / web-aiavatar / admin |
| 本地生产构建 | 统一队列 `7569cae4927e`，退出码 0；仓库脚本 `clean package`，测试已由前述门禁独立通过，打包阶段按脚本 `-DskipTests`；前端生产构建完成 |
| JAR SHA256 | `0566a0093b4e6ffeb6d30ca2ff339d5046c49507bba06a4b2beb895718a1105e` |
| Studio tar SHA256 | `801ecac620a3b0e854610d82434a9ecd154ff7526020f79a13057a299e1fa837` |
| admin tar SHA256 | `9b80d3302e795fade82938095dbdc6a5537ad5d08f162b86bee6e1c652cecec6` |
| 线上校验 | 三个归档哈希及运行 JAR 与本地一致；Studio BUILD_ID `2vNsflkIJsOBypUBghfxo`，admin `nhio936l74PlG0M5q7pRS` |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1；mock 与开发登录关闭；制品无 `.env*` |
| 契约核对 | 线上后端基线 `8af7ec7bf` 到本次 main，只新增企业 phone 字段、deposit 方向及两条接口；无删除或改名，无需补发 studio-admin 或其他产品前端 |
| 数据库 | 迁移文件与旧包相同、版本重复 0；线上成功校验 72 migrations，No migration necessary |
| CI | 直接推 main，现有工作流仅 PR / 手动触发，本次未触发远端 CI；不以本地检查冒充 CI |

生产运行记录已写入三个选中服务各自的 release-id.txt、release-sha.txt、release-manifest.env；没有改运行 env 或凭据。

## 线上验收

- deploy-release 的 env-check、verify 均 ALL GREEN；首页、登录、企业管理、项目、配置 API 和后台入口均 200，server、Studio、admin active/running、NRestarts=0，nginx 配置检查通过。
- 使用既有真实 owner 会话打开新的浏览器标签，确认转入入口及两张成员列表的手机号。输入 1 积分，实际 POST 预览成功，显示个人减少、企业待分配增加的正确前后余额；关闭表单，**没有点击确认转入，没有移动真实积分**。
- 发布前后钱包 57、企业钱包 20、账本 4076 条保持不变；钱包总可用 105713、冻结 0，企业钱包可用及冻结均 0，分桶不平及负余额均 0。原生成任务仍全部终态，没有新增收费生成。
- 线上截图仅保留在本机聊天产物，不将真实手机号和个人余额截图写入仓库。
- 新标签首次加载捕获一条 React #418 初始化日志，页面随后正常展示且成员列表和预览请求成功；本次未取得发布前同条件日志，不能认定为本次引入或已排除。已登记待独立复核，不称控制台零异常。
- 全局 wire-mirror 仍有既有 clip 四组字段漂移，本企业相关镜像均通过；本次未修改 clip。H2 测试启动保留既有 drama_character.cast DDL 警告，全部企业测试通过。

重启时间：2026-11-01 01:07:53–01:07:55 PDT（08:07:53–08:07:55 UTC）；后端 01:08:11 PDT 就绪。nginx 在 08:07:40–08:08:30 UTC 窗口有 25 次 200、7 次 502；5xx 首尾为 08:07:56 / 08:08:08 UTC。发布存在短暂重启窗口，不称零中断。

## 备份与回滚边界

生产 root-only `/opt/ai-star-eco/backups/20261101-enterprise-owner-deposit/` 保存企业域全部 14 张表与钱包、账本、冻结共 17 表的事务一致 SQL 备份，及原 server JAR、Studio/admin 完整运行目录 tar。SQL gzip SHA256 `8e462cf3692d17557217589abc62c08fac18fbe4a8c56224983efaa4467faaf1`。

上一版 server 为 `20261101-director-h3-storyboard`（`8af7ec7bf`，JAR SHA256 `042fc48bd26dd25d985e30a0ef3efd20fe66e98811777be8495132c7915dc8e9`），Studio 为 `20261101-scene-flyout-pin`（`c5ebee57d`）；admin 原运行目录独立归档。

必要时只恢复相应制品并重启选中服务，不自动恢复财务数据库、不覆盖上线后的合法流水。上线后若已出现 deposit 流水，旧界面可能将其显示为回收，回滚须保留新方向读取或采用前滚修复。远端本次 `/tmp/aistareco-release-*` 暂存已清理。
