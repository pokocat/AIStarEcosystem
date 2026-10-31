# Studio 运营看板发布（2026-10-26）

## 范围

- 入口：`https://aistar.aibuzz.cn/admin`
- 独立应用：`apps/web-aiavatar/studio-admin`
- 独立进程：`aistareco-studio-admin`，仅监听 `127.0.0.1:3004`
- 首次仅上线独立前端；同日后续从已推送的干净 `main` 提交 `92d74f05de7984b1e67b239a572144cb22a3adac` 同步发布独立前端和新增只读聚合 API。
- 后续发布只重启 `aistareco-server` 和 `aistareco-studio-admin`；未发布或重启 `apps/web-aiavatar`，未执行数据库迁移、积分或钱包写操作。
- 生产构建固定 `basePath=/admin`，页面资源位于 `/admin/_next/**`；根 `/api/**` 继续由既有 aistar Nginx vhost 代理共享 server。

## 构建与测试

- `pnpm --filter @ai-star-eco/studio-admin run typecheck`：通过。
- `pnpm --filter @ai-star-eco/studio-admin run test`：2 个文件、3 项测试通过。
- `./infra/scripts/build-studio-admin-release.sh`：Next 16.2.6 production build 通过。
- `pnpm typecheck:all`：11 个 workspace package 通过。
- `apps/admin` Vitest：8 个文件、38 项通过。
- 后端 `StudioOperationsDashboardServiceTest`、`StudioOperationsDashboardIntegrationTest`、`AdminStudioOperationsControllerSecurityTest`：10 项通过。
- `apps/server ./mvnw compile -q -o` 与 `pnpm check:api-contract`：通过。
- 解包制品本地验证：`/admin` 200、`/admin/login` 200、`/admin/_next/**` 200、根 `/` 404；根 `/api/**` 保持独立 rewrite。

## 上线步骤与回滚点

- 安装独立 env：`/etc/aistareco/studio-admin.env`（0600）。
- 安装独立 systemd：`/etc/systemd/system/aistareco-studio-admin.service`。
- 制品目录：`/opt/ai-star-eco/studio-admin`。
- 线上 Nginx 文件：`/etc/nginx/conf.d/aistar.aibuzz.cn.conf`。
- Nginx 备份：`/etc/nginx/conf.d/aistar.aibuzz.cn.conf.before-studio-admin-20261026171931`。
- `nginx -t` 成功后执行 graceful reload；未 restart Nginx、Studio 或 server。

## 线上验收

- `https://aistar.aibuzz.cn/admin`：200。
- `https://aistar.aibuzz.cn/admin/login`：200。
- `/admin/_next/**` 抽样资源：200。
- `https://aistar.aibuzz.cn/` 原 Studio 首页：200。
- 浏览器匿名访问 `/admin` 自动进入 `/admin/login?next=%2Fadmin`。
- 匿名 `/api/admin/auth/me`：401 `UNAUTHORIZED`。
- 匿名 `/api/admin/studio-operations?days=7`：401 `UNAUTHORIZED`。
- `aistareco-studio-admin`：active，`NRestarts=0`。
- 后续发布完成后 `aistareco-server` PID `2956819`、`NRestarts=0`，线上 JAR SHA-256 `8c0e6198fd1ac096c42ee708d560df436be7a874ae25ccb2cd265214d81af3b4`。
- 后续发布前后 Studio 主前端均为 PID `2936908`、启动时间 `2026-10-26 18:36:19 CST`、`NRestarts=0`。
- Flyway 报告 schema 版本 69 且无迁移可执行。共享 server 的既有 `SellingChannelMigrationSeeder` 在每次启动时会重新执行幂等 `issuer_tenant_id NULL` DDL；本次日志无新建默认渠道或历史批次回填记录。
- 公网 `/api/config` 为 200；匿名 `/api/admin/studio-operations` 与 `/credit-events` 均为 401。
- 仓库标准 `infra/scripts/verify.sh` 验收 ALL GREEN，包括全部现有 systemd 单元、Nginx、MySQL、辅助服务及 Studio 公网入口。

## 已知限制

新增 `studio-operations` 聚合接口已发布，但本次没有使用或创建生产账号，因此只完成了线上匿名 401 边界和本地角色级 403/200 自动测试，未用生产登录态验证真实聚合数据。发版标记、供应商配额/并发余量等无安全现成数据源的项仍按契约显示未接入，不伪装为健康或真实数据。
