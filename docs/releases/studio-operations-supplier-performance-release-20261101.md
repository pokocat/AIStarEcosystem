# Studio 运营后台供应商分析发布（2026-11-01）

## 范围

- 独立入口：`https://aistar.aibuzz.cn/admin`。
- 新增真实主路由 `/business`、`/technology`、`/suppliers`，左侧为主菜单、顶部为当前模块子页签；只挂载当前路由和页签需要的查询组件。
- 新增供应商交付分析：有界时间范围、时区、供应商/模型/任务类型/状态/排除项筛选，终态成功率、成功样本 P50/P95/最长耗时、失败分类、趋势和分页任务明细。
- 后端只读接口：`GET /api/admin/studio-operations/supplier-performance`；沿用 `SUPER_ADMIN`、`OPERATOR`、`FINANCE_ADMIN` 服务端角色门禁。明细不返回用户、完整提示词、原始错误文案或上游凭据。
- 经营/技术聚合增加 `scope`，不计算当前页面不展示的另一半模块；共用健康状态仍保留。

本次只发布共享 `aistareco-server` 和独立 `aistareco-studio-admin`。未发布或重启 Studio 主前端，未执行数据库迁移、钱包/积分/赠款写操作，也未修改 Nginx、身份权限或网络安全配置。

## 主线与制品

- 功能提交：`942c055d9bfb5ec57b8da4397ed7499e3b94358f`。
- 部署探针修复：`45951ef39598afcaa770066f18c4587da22490d3`。
- `/admin` basePath 跳转修复：`febd0a8093a92d542584fb430c810761b930a38e`。
- server 发布包：`20261101-studio-ops-supplier-942c055d`，JAR SHA-256 `b37e0161b33a1f954008e99058bbca09e41e113570729002faee00e6f0202be8`，线上一致。
- studio-admin 发布包：`20261101-studio-ops-supplier-febd0a80`，tar SHA-256 `9d74d4de59d3ef05d1a2493b79e3c5af7f17eeea3a5107dee8b0ddf5a52d9c3d`，BUILD_ID `WxOkcwE-g1H2_qA2AURaQ`，线上一致。
- 回滚备份：`/opt/ai-star-eco/backups/20261101-studio-ops-supplier-942c055d-predeploy/`，仅保存发布前 server JAR 和独立 studio-admin 目录；不包含数据库或运行环境配置。

## 发布前验证

- `@ai-star-eco/studio-admin`：类型检查通过；6 个测试文件、16 项测试通过；Next 16.2.6 production build 通过，生成 `/`、`/business`、`/technology`、`/suppliers`、`/scenes`、`/login`。
- 后端：`StudioOperationsDashboardServiceTest`、`StudioOperationsDashboardIntegrationTest`、`AdminStudioOperationsControllerSecurityTest`、`StudioSupplierPerformanceServiceTest` 共 16 项通过；匿名/普通用户拒绝与允许角色的接口边界由 MockMvc 覆盖。
- 全仓门：11 个 workspace 类型检查、独立 Admin 类型检查、后端离线编译通过；API contract 检查退出成功，保留仓库既有 24 条“前端有调用但未发现 handler”的非本次 warning。
- 差异中没有数据库迁移、钱包、账本、Nginx、systemd 或权限配置改动。

## 部署与线上验收

- server 发布后仓库标准 `infra/scripts/verify.sh` 为 `ALL GREEN`：公网入口、Nginx、MySQL、全部既有 systemd 单元、共享 API 与辅助服务通过。
- 独立前端前两次尝试均由部署脚本自动回滚：第一次是新根路由正常 307 被旧探针误判，第二次由修正后的探针发现根跳转重复 basePath（`/admin/admin/business`）。修复并增加回归测试后第三次发布成功；期间旧前端持续可用。
- `https://aistar.aibuzz.cn/admin` 返回 307，`Location: /admin/business`；`/admin/business`、`/admin/technology`、`/admin/suppliers`、`/admin/login` 均为 200。
- `https://aistar.aibuzz.cn/` 与 `/api/config` 均为 200；Studio 主前端 PID `550295`、启动时间 `2026-11-01 17:06:09 CST`、`NRestarts=0`，发布前后未变化。
- 发布后 server 与 studio-admin 均为 active/running、`NRestarts=0`、`ExecMainStatus=0`。
- 匿名 `/api/admin/auth/me`、`/api/admin/studio-operations?days=7&scope=business`、`/api/admin/studio-operations/supplier-performance` 均为 401。

本次没有使用、创建或猜测生产账号，因此未用生产登录态读取跨账户真实数据，也未在生产验证普通用户 403；该负向权限和允许角色 200 由本地自动测试覆盖。GitHub 对应用提交没有自动 CI run（生产 workflow 仅 `workflow_dispatch`），不把本地和线上检查表述成 GitHub CI 全绿。
