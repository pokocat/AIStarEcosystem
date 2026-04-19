# AI Star Eco 部署与本地调试说明

本文记录 2026-04-19 这次实际部署过程、后续增量部署 SOP，以及在本次 `/web`、`/admin` 子路径部署与共享视频静态资源改造之后的本地启动调试方式。

## 1. 当前线上部署基线

### 1.1 服务器与目录

- 服务器：`root@47.94.102.182`
- 项目根目录：`/opt/ai-star-eco`
- 三端代码目录：
  - `web`：`/opt/ai-star-eco/apps/web`
  - `admin`：`/opt/ai-star-eco/apps/admin`
  - `server`：`/opt/ai-star-eco/apps/server`
- 共享静态视频目录：`/opt/ai-star-eco/static/videos`

### 1.2 端口与公网路径

- `server` 本机监听：`127.0.0.1:8080`
- `web` 本机监听：`127.0.0.1:3002`
- `admin` 本机监听：`127.0.0.1:3003`
- 公网入口：
  - `http://47.94.102.182/web`
  - `http://47.94.102.182/admin`
  - `http://47.94.102.182/api/*`
  - `http://47.94.102.182/static/videos/*`

### 1.3 systemd 服务

- `aistareco-server`
- `aistareco-web`
- `aistareco-admin`

### 1.4 关键配置文件

- Nginx：`/etc/nginx/conf.d/ai.conf`
- 后端环境变量：`/etc/aistareco/server.env`

当前后端环境变量至少包含：

```bash
SPRING_PROFILES_ACTIVE=mysql
DB_URL=jdbc:mysql://127.0.0.1:3306/aistareco?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai
DB_USERNAME=aistareco_app
DB_PASSWORD=***
AEP_JWT_SECRET=***
AEP_JWT_EXPIRATION_MS=3600000
SERVER_ADDRESS=127.0.0.1
AEP_DEV_AUTH_ENABLED=true
AEP_FORGE_VIDEO_BASE=/static/videos
```

### 1.5 视频路径改造结论

本次改造后，形象锻造相关视频不再依赖 `apps/web/public/videos` 的线上直出路径，而是统一走共享静态资源路径：

- 线上保存和回显使用：`/static/videos/showreel-0X.mp4`
- 线上实际文件目录：`/opt/ai-star-eco/static/videos`
- 前端视频池定义：`apps/web/src/lib/forge-video.ts`
- 后端保存视频 URL 的逻辑：`apps/server/src/main/java/com/aistareco/aep/controller/ForgeController.java`
- 后端默认视频基路径配置：`apps/server/src/main/resources/application.yml`

## 2. 2026-04-19 本次实际部署记录

### 2.1 首次服务器准备

在服务器上完成了以下基础准备：

```bash
yum install -y java-17-openjdk-headless mariadb-server rsync
systemctl enable --now mariadb
```

创建数据库与应用账号：

```sql
CREATE DATABASE aistareco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'aistareco_app'@'localhost' IDENTIFIED BY '***';
GRANT ALL PRIVILEGES ON aistareco.* TO 'aistareco_app'@'localhost';
FLUSH PRIVILEGES;
```

### 2.2 三端上线形态

1. `server` 以 Spring Boot jar 方式运行，由 `aistareco-server.service` 托管。
2. `web`、`admin` 以 `next start` 方式运行，由各自 systemd 服务托管。
3. Nginx 统一代理：
   - `/web` -> `127.0.0.1:3002`
   - `/admin` -> `127.0.0.1:3003`
   - `/api` -> `127.0.0.1:8080`
4. 根路径 `/` 302 到 `/web`。

### 2.3 本次与视频相关的实际变更

1. 新建共享静态目录：

```bash
mkdir -p /opt/ai-star-eco/static/videos
chmod 755 /opt/ai-star-eco/static /opt/ai-star-eco/static/videos
```

2. 将本地视频上传到共享目录：

```bash
rsync -avz --progress apps/web/public/videos/ \
  root@47.94.102.182:/opt/ai-star-eco/static/videos/
```

3. 修改 Nginx，新增静态资源映射：

```nginx
location /static/videos/ {
    alias /opt/ai-star-eco/static/videos/;
    access_log off;
    expires 7d;
    add_header Cache-Control "public, max-age=604800, immutable";
}
```

4. 修改后端环境变量：

```bash
AEP_FORGE_VIDEO_BASE=/static/videos
```

5. 将数据库里历史旧链接从 `/videos/*` 迁到 `/static/videos/*`：

```sql
UPDATE aep_forge_results
SET video_url = REPLACE(video_url, '/videos/', '/static/videos/')
WHERE video_url LIKE '/videos/%';
```

### 2.4 本次代码侧实际变更

前端：

- `apps/web/src/lib/forge-video.ts`
- `apps/web/src/mocks/appearance-forge.ts`
- `apps/web/src/components/producer/dashboard/artist/AppearanceGallery.tsx`

后端：

- `apps/server/src/main/java/com/aistareco/aep/controller/ForgeController.java`
- `apps/server/src/main/resources/application.yml`

行为变化：

1. 前后端统一使用同一套视频池。
2. 视频池文件名改为集中维护。
3. 默认视频基路径改为可配置：
   - 线上：`/static/videos`
   - 本地推荐：`/web/videos`

### 2.5 本次发布时的实际操作

#### `web`

优先采用“本地 build，远端同步 `.next`”的方式发布，不依赖远端 `next build`。

```bash
cd apps/web
npm run build

rsync -avz --delete .next/ \
  root@47.94.102.182:/opt/ai-star-eco/apps/web/.next/
```

#### `admin`

`admin` 沿用同样的发布思路：

```bash
cd apps/admin
npm run build

rsync -avz --delete .next/ \
  root@47.94.102.182:/opt/ai-star-eco/apps/admin/.next/
```

#### `server`

```bash
cd apps/server
./mvnw package -DskipTests

rsync -avz target/ai-star-eco-server-1.0.0.jar \
  root@47.94.102.182:/opt/ai-star-eco/apps/server/target/
```

#### 重启服务

```bash
ssh root@47.94.102.182 'systemctl restart aistareco-web'
ssh root@47.94.102.182 'systemctl restart aistareco-admin'
ssh root@47.94.102.182 'systemctl restart aistareco-server'
```

### 2.6 本次发布后的验证结果

验证通过的项：

- `http://47.94.102.182/web` -> `200`
- `http://47.94.102.182/admin` -> `200`
- `http://47.94.102.182/static/videos/showreel-01.mp4` -> `200`
- `http://47.94.102.182/static/videos/showreel-05.mp4` -> `200`
- `http://47.94.102.182/api/auth/dev-accounts` -> `200`
- 历史 `aep_forge_results.video_url` 已迁到 `/static/videos/...`

## 3. 后续标准部署 SOP

### 3.1 推荐原则

推荐继续使用“本地构建，远端只接收产物并重启”的方式：

1. 避免远端 `next build` 卡住或耗时过长。
2. 更容易控制产物一致性。
3. 遇到问题时，本地更容易先验证 build 是否成功。

### 3.2 仅更新视频资源

如果只新增或替换 `apps/web/public/videos/*`，不需要重发三端代码，只需：

```bash
rsync -avz --progress apps/web/public/videos/ \
  root@47.94.102.182:/opt/ai-star-eco/static/videos/
```

如果新增了新的 `showreel-0X.mp4`，并且希望它参与“随机分配”，还要同步修改两处视频池：

- `apps/web/src/lib/forge-video.ts`
- `apps/server/src/main/java/com/aistareco/aep/controller/ForgeController.java`

然后按 3.3 和 3.5 重新发布 `web` 与 `server`。

### 3.3 发布 `web`

```bash
cd apps/web
npm install
npm run build

rsync -avz --delete .next/ \
  root@47.94.102.182:/opt/ai-star-eco/apps/web/.next/

rsync -avz src/ \
  root@47.94.102.182:/opt/ai-star-eco/apps/web/src/

ssh root@47.94.102.182 'systemctl restart aistareco-web'
```

如果 `package.json` 或 `package-lock.json` 有变化，需要补一次远端依赖安装：

```bash
rsync -avz package.json package-lock.json \
  root@47.94.102.182:/opt/ai-star-eco/apps/web/

ssh root@47.94.102.182 'cd /opt/ai-star-eco/apps/web && /root/.nvm/versions/node/v24.14.1/bin/npm install'
```

### 3.4 发布 `admin`

```bash
cd apps/admin
npm install
npm run build

rsync -avz --delete .next/ \
  root@47.94.102.182:/opt/ai-star-eco/apps/admin/.next/

rsync -avz src/ \
  root@47.94.102.182:/opt/ai-star-eco/apps/admin/src/

ssh root@47.94.102.182 'systemctl restart aistareco-admin'
```

如果依赖变化，同样先同步 `package.json` / `package-lock.json`，再在远端执行 `npm install`。

### 3.5 发布 `server`

```bash
cd apps/server
./mvnw package -DskipTests

rsync -avz target/ai-star-eco-server-1.0.0.jar \
  root@47.94.102.182:/opt/ai-star-eco/apps/server/target/

rsync -avz src/main/resources/application.yml \
  root@47.94.102.182:/opt/ai-star-eco/apps/server/src/main/resources/application.yml

ssh root@47.94.102.182 'systemctl restart aistareco-server'
```

如果新增了环境变量，记得同步更新：

```bash
ssh root@47.94.102.182 'vim /etc/aistareco/server.env'
ssh root@47.94.102.182 'systemctl restart aistareco-server'
```

### 3.6 发布后验证

```bash
curl -I http://47.94.102.182/web
curl -I http://47.94.102.182/admin
curl -I http://47.94.102.182/static/videos/showreel-01.mp4
curl http://47.94.102.182/api/auth/dev-accounts
```

建议补查服务状态：

```bash
ssh root@47.94.102.182 'systemctl status --no-pager aistareco-web | sed -n "1,25p"'
ssh root@47.94.102.182 'systemctl status --no-pager aistareco-admin | sed -n "1,25p"'
ssh root@47.94.102.182 'systemctl status --no-pager aistareco-server | sed -n "1,25p"'
```

### 3.7 已知现象

1. `server` 在 MySQL 模式下启动较慢，常见耗时约 2 到 3 分钟。
2. `web` 或 `admin` 刚重启完成时，公网第一次访问可能短暂出现 `502`，通常等待 `next start` ready 即可恢复。
3. MariaDB 上 `aep_notifications.read` 字段仍会触发建表保留字告警；当前不会阻塞整个服务最终启动，但后续建议单独修复。

## 4. 本地启动与调试方式

### 4.1 路由与访问地址

由于 `web` 与 `admin` 现在都使用了 `basePath`：

- 本地 `web` 入口：`http://localhost:3002/web`
- 本地 `admin` 入口：`http://localhost:3003/admin`
- 本地 `server`：`http://localhost:8080`

不要再把本地入口写成裸的 `http://localhost:3002` 或 `http://localhost:3003`。

### 4.2 推荐的本地联调环境变量

#### `apps/web/.env.local`

```bash
NEXT_PUBLIC_USE_MOCK=0
NEXT_PUBLIC_SERVER_API_BASE=http://localhost:8080
NEXT_PUBLIC_FORGE_VIDEO_BASE=/web/videos
```

说明：

1. `NEXT_PUBLIC_USE_MOCK=0` 表示联真实后端。
2. `NEXT_PUBLIC_SERVER_API_BASE=http://localhost:8080` 让 Next 将 `/api/*` 代理到本地 Spring Boot。
3. `NEXT_PUBLIC_FORGE_VIDEO_BASE=/web/videos` 让前端在本地直接读取 `apps/web/public/videos/*`，不依赖线上 `/static/videos`。

如果只想跑纯前端 mock：

```bash
NEXT_PUBLIC_USE_MOCK=1
NEXT_PUBLIC_FORGE_VIDEO_BASE=/web/videos
```

#### `apps/admin/.env.local`

```bash
NEXT_PUBLIC_USE_MOCK=0
NEXT_PUBLIC_SERVER_API_BASE=http://localhost:8080
```

### 4.3 本地启动命令

#### 启动 `server`（推荐）

使用 H2 开发库，并开启调试登录入口，同时把锻造视频基路径指到本地 `web` 的静态目录：

```bash
cd apps/server
AEP_DEV_AUTH_ENABLED=true \
AEP_FORGE_VIDEO_BASE=/web/videos \
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

#### 启动 `web`

```bash
cd apps/web
npm install
npm run dev
```

访问：

```text
http://localhost:3002/web
```

#### 启动 `admin`

```bash
cd apps/admin
npm install
npm run dev
```

访问：

```text
http://localhost:3003/admin
```

### 4.4 本地 debug 登录入口

本次改动后，`DevAuthController` 不再只受 `dev profile` 控制，而是受 `AEP_DEV_AUTH_ENABLED=true` 控制，因此只要打开这个环境变量，就能使用手动 debug 登录。

查询可用调试账号：

```bash
curl http://localhost:8080/api/auth/dev-accounts
```

手动登录并获取 JWT：

```bash
curl -X POST http://localhost:8080/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"studio_starlight"}'
```

常用调试用户名：

- `agency_moonrise`
- `creator_luna`
- `studio_starlight`

如果前端登录页保留了“手动输入用户名（调试用）”入口，直接输入上面的用户名即可。

### 4.5 本地调试建议

1. 想看形象锻造视频回显，优先保证：
   - `apps/web/.env.local` 里有 `NEXT_PUBLIC_FORGE_VIDEO_BASE=/web/videos`
   - `server` 启动时带 `AEP_FORGE_VIDEO_BASE=/web/videos`
2. 如果只调前端页面，不依赖真实后端，可把 `NEXT_PUBLIC_USE_MOCK=1`。
3. 如果要验证保存后的 `videoUrl` 是否正确，检查返回值应类似：

```json
{
  "videoUrl": "/web/videos/showreel-03.mp4"
}
```

线上环境对应则应类似：

```json
{
  "videoUrl": "/static/videos/showreel-03.mp4"
}
```

4. 只要 `videoUrl` 指向的是相对路径，浏览器会从当前前端站点同源请求资源；因此本地和线上可以通过环境变量切换不同的静态基路径，而无需改业务代码。

