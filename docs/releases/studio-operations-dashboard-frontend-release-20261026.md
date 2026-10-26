# Studio 运营看板独立前端发布（2026-10-26）

## 范围

- 入口：`https://aistar.aibuzz.cn/admin`
- 独立应用：`apps/web-aiavatar/studio-admin`
- 独立进程：`aistareco-studio-admin`，仅监听 `127.0.0.1:3004`
- 本次未发布或重启 `apps/server`、`apps/web-aiavatar`，未执行数据库或积分写操作。
- 生产构建固定 `basePath=/admin`，页面资源位于 `/admin/_next/**`；根 `/api/**` 继续由既有 aistar Nginx vhost 代理共享 server。

## 构建与测试

- `pnpm --filter @ai-star-eco/studio-admin run typecheck`：通过。
- `pnpm --filter @ai-star-eco/studio-admin run test`：2 个文件、3 项测试通过。
- `./infra/scripts/build-studio-admin-release.sh`：Next 16.2.6 production build 通过。
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
- Studio 主前端上线前后均为 PID `2895483`、启动时间 `2026-10-26 15:35:02 CST`、`NRestarts=0`。
- 共享 server 上线前后均为 PID `2895432`、启动时间 `2026-10-26 15:35:01 CST`、`NRestarts=0`。

## 已知限制

本次按授权只发布查询前端，没有发布新增的 `studio-operations` 聚合接口。匿名请求会先被既有认证门禁拒绝；管理员登录后的聚合请求在共享后端尚未包含对应端点时会显示错误/未接入状态，不会使用演示数据或伪装成健康数据。已验证公开登录边界，未使用生产账号验证管理员登录后的聚合页面。
