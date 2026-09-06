# infra/ — 阿里云部署基础设施

把部署所需的所有资产（nginx 配置、systemd 单元、环境变量模板、RDS 建库脚本、OSS Bucket
策略、部署脚本）**全部归一到 git**。新机器从零拉起一套完整环境，按本文 §3
「一次性环境拉起」执行即可在 30~60 分钟内完成。

本文件是 AI Star Eco 在阿里云上部署的**单一真值源**。

## `clip` 军师预发隔离实例（2026-08-11）

军师「快出片」预发不复用 AIStar 生产实例：`aistareco-clip-preprod` 仅监听 `127.0.0.1:8081`，工作目录 `/opt/aistareco-clip-preprod/server`，运行时机密在 `/etc/aistareco/clip-preprod.env`（0600）。军师预发 BFF 从同机 `http://127.0.0.1:8081` 回源；公网只通过 `wxapi.aibuzz.cn/clip_preprod/cdn/` 与 `/files/` 读取作品，不公开 AIStar API。

初始化顺序：安装 Java 17 与带 `signalstats`、`metadata`、`loudnorm` 的 ffmpeg → 安装 `infra/systemd/aistareco-clip-preprod.service.example` → 按 `infra/env/clip-preprod.env.example` 安全落真实 env → 将 `infra/nginx/clip-preprod.wxapi.snippet.example` 合入 wxapi HTTPS server 并 `nginx -t` → 运行 `infra/scripts/deploy-clip-preprod.sh`。脚本先读取远端 env 指定的 ffmpeg/ffprobe 路径并硬检三个质量滤镜，再构建/替换该实例 JAR、重启该 systemd unit，并用 service token 验证至少 3 个模板；不访问 AIStar 生产。远端上传暂存位于 `/tmp/aistareco-clip-*.jar`，而该宿主的 `/tmp` 是最多占物理内存 50% 的 tmpfs：脚本必须用 `trap` 在成功/失败时删除当前 JAR，并在预检阶段清理超过 60 分钟的历史残留，禁止再次形成随部署次数增长的 Shmem 泄漏。石榴 token 和 BFF service token 禁止进入命令历史、日志、git 或部署版本文件。v0.113 起最终音轨先归一到 -16 LUFS / -1.5 dBTP，并按 `AEP_CLIP_{MIN,MAX}_*` 校验平均亮度、综合响度和真峰值；缺 filter 或结果无法解析会失败关闭。v0.114 起部署脚本默认 `TEST_MEDIA_MODE=true`，只在该隔离实例写入 `AEP_CLIP_FORCE_MOCK=true`，生成带永久「测试演示」标识的真实 MP4 以验收全产品链；需要验证真实石榴时显式运行 `TEST_MEDIA_MODE=false bash infra/scripts/deploy-clip-preprod.sh`。production/mysql 会硬拒绝 force-mock。

---

## 1. 目录速览

```
infra/
├── README.md                       ← 本文件（入口 + 拓扑 + SOP + FAQ）
│
├── env/                            ← 各服务环境变量模板（**不含真实密钥**）
│   ├── server.env.example          ← Spring Boot 完整变量清单
│   ├── sau-service.env.example     ← Python sau-service Docker 容器
│   ├── admin.env.example           ← apps/admin（Next 16, basePath=/admin）
│   ├── web-celebrity.env.example   ← apps/web-celebrity（Next 16, 根路径）
│   ├── web-music.env.example       ← apps/web-music
│   ├── web-drama.env.example       ← apps/web-drama
│   └── web-aiavatar.env.example    ← apps/web-aiavatar
│
├── nginx/                          ← Nginx 配置（落 /etc/nginx/conf.d/）
│   ├── ai.conf.example             ← HTTP 入口形态（首次部署 / 内网联调）
│   ├── ai.aibuzz.cn.conf.example   ← HTTPS 多子域生产形态（规划稿，非线上实际布局）
│   │
│   │   ── 全局块（务必先装这两个，见 §5.1 / §5.2）──
│   ├── 000-default-ssl.conf.example          ← 443 兜底默认站（未登记 host → 404）
│   ├── www-redirect.conf.example             ← 所有 www.<子域> → 308 去掉 www
│   ├── aistareco.conf.example                ← 80 总入口（IP 直访 + 五子域 308 跳 https + api:80）
│   │
│   │   ── 各生产子域的 443 vhost（与线上逐字节对齐，见 §5.1）──
│   ├── admin.aibuzz.cn.ssl.conf.example      ← admin        → 3003
│   ├── celebrity.aibuzz.cn.ssl.conf.example  ← web-celebrity → 3012
│   ├── music.aibuzz.cn.ssl.conf.example      ← web-music    → 3010
│   ├── drama.aibuzz.cn.ssl.conf.example      ← web-drama    → 3011
│   ├── aiavatar.aibuzz.cn.ssl.conf.example   ← web-aiavatar → 3013
│   ├── star.aibuzz.cn.ssl.conf.example       ← web-star     → 3014（80 在 star.*.conf.example）
│   ├── api.aibuzz.cn.ssl.conf.example        ← server       → 8080
│   │
│   │   ── 80 + 443 单文件形态（这两个域名线上就是这么配的，2026-09-06 已补齐反代）──
│   ├── aistar.aibuzz.cn.conf.example ← web-aiavatar → 3013（与 aiavatar.*.ssl 同上游）
│   ├── star.aibuzz.cn.conf.example   ← web-star 的 80 块（443 在 star.*.ssl.conf.example）
│   └── snippets/
│       └── proxy-defaults.conf     ← 通用 proxy_set_header 集
│
├── systemd/                        ← systemd 单元模板（落 /etc/systemd/system/）
│   ├── aistareco-server.service.example
│   ├── aistareco-admin.service.example
│   ├── aistareco-web-celebrity.service.example
│   ├── aistareco-web-music.service.example
│   ├── aistareco-web-drama.service.example
│   ├── aistareco-web-aiavatar.service.example
│   └── aistareco-sau-service.service.example   ← Docker 启动型
│
├── rds/                            ← 阿里云 RDS MySQL 8.0 初始化
│   ├── README.md                   ← RDS 创建 / 内网白名单 / 参数组建议
│   ├── 00_create_database.sql      ← 建库 + utf8mb4
│   └── 01_create_app_user.sql      ← 应用账号（最小权限）
│
├── oss/                            ← 阿里云 OSS Bucket 初始化
│   ├── README.md                   ← Bucket 创建 / CDN 绑定 / 内外网 endpoint
│   ├── ram-policy.json             ← OSS bucket 最小权限 RAM Policy
│   ├── cors-config.json            ← CORS 规则
│   └── lifecycle.xml               ← OSS 生命周期（temp/ 30 天清理等）
│
└── scripts/                        ← 部署 / 验证 / 回滚 + 引导式配置
    ├── preflight.sh                ← 检测本机 / ECS 是否装齐 java/nginx/docker/ffmpeg/node/ossutil...
    ├── init.sh                     ← 交互式收集参数 + openssl 生成密钥 + 渲染 env/nginx 到 infra/.local/
    ├── dev-server.sh               ← 本机 server 启动 wrapper（自动起 docker mysql + 生成/加载本机 env）
    ├── deploy.sh                   ← deploy.sh <service> [tag]，开发机 build → ssh 推到 ECS（幂等）
    ├── install-host-deps.sh         ← ECS 本机依赖补齐：按宿主机镜像自动走 dnf/yum/apt
    ├── check-runtime-env.sh         ← ECS runtime env 预检：/etc/aistareco/*.env + release manifest
    ├── deploy-local.sh             ← **在 ECS 本机直接部署**，不走 SSH（v0.47+，all-in-one 或独立服务）
    ├── update-and-deploy.sh         ← **ECS 一键更新代码 + 补依赖 + 本机部署**
    ├── rollback.sh                 ← rollback.sh <service> <tag>
    └── verify.sh                   ← 部署后健康检查批量（v0.47+ 支持 LOCAL_MODE=1 本机模式）
```

---

## 2. 架构拓扑

```
                          ┌─ SLB / Nginx (公网入口, HTTPS 域名)
                          │   ├─ aibuzz.cn / www → web-celebrity (3012)
                          │   ├─ admin.aibuzz.cn → admin (3003)
                          │   ├─ celebrity.aibuzz.cn → web-celebrity (3012)
                          │   ├─ music.aibuzz.cn → web-music (3010)
                          │   ├─ drama.aibuzz.cn → web-drama (3011)
                          │   ├─ aistar.aibuzz.cn → web-aiavatar (3013)
                          │   ├─ api.aibuzz.cn → server (8080)
                          │   └─ id.aibuzz.cn → 账号中心 (8091, 独立仓库 pokocat/aibuzz-id)
                          │
ECS 集群 (1~N 台, VPC 内网)│
  ├─ systemd                                                                  
  │   • aistareco-server         :8080  (Spring Boot)
  │   • aistareco-admin          :3003  (Next 14 standalone)
  │   • aistareco-web-music      :3010  (Next 16 standalone)
  │   • aistareco-web-drama      :3011  (Next 16 standalone)
  │   • aistareco-web-celebrity  :3012  (Next 16 standalone)
  │   • aistareco-web-aiavatar   :3013  (Next 16 standalone)
  │   • aistareco-web-star       :3014  (Next 16 standalone)
  │   • aistareco-id-server      :8091  (统一账号中心 / OIDC；本仓不发布，见 pokocat/aibuzz-id)
  └─ Docker                                                                   
      • aistareco-sau-service    :8090  (FastAPI + Playwright/patchright)
                                       │
                                       │ VPC 内网
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│  阿里云托管服务                                                 │
│  • RDS MySQL 8.0   ← rm-xxx.mysql.rds.aliyuncs.com:3306      │
│  • OSS Bucket      ← aistareco-prod (内网 endpoint)           │
│  • CDN 域名         ← cdn.aibuzz.cn → 回源 OSS                │
│  • Redis（Phase 5+）← SmsCodeService / JWT 黑名单 / ShedLock   │
│  • KMS / Secret Manager（推荐）← 取代 server.env 明文密钥       │
│  • ACR（Phase 3+）  ← 推送 docker image                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 一次性环境拉起（新 ECS）

> **前置**：阿里云账号已开通 ECS / RDS / OSS，VPC 内网已通。

### 3.0 快速路径：引导式脚本（推荐）

```bash
# 1) 检测本机工具齐备
./infra/scripts/preflight.sh

# 2) 检测目标 ECS 工具齐备（先做完 §3.2 ECS 准备）
SSH_KEY=/path/to/key.pem ./infra/scripts/preflight.sh --remote root@<ECS_HOST>

# 3) 交互式生成 server.env / sau-service.env / nginx config 到 infra/.local/
#    脚本会问 ECS / RDS / OSS / SMS / Coze 等参数，自动 openssl 生成 JWT/AES/INTERNAL 密钥
./infra/scripts/init.sh
```

生成完后 review `infra/.local/*` → 按脚本输出的「下一步」scp 到 ECS → 起服务。

⚠️ `infra/.local/secrets-backup.txt` 列出自动生成的密钥，**立刻备份到密码管理器后 rm**
（密钥已写入 server.env，删 backup 不影响 server 运行；丢了 `AEP_SECRET_KEY` 历史
加密数据不可解，丢了 `AEP_JWT_SECRET` 在线用户被登出但可恢复）。

下面 §3.1-§3.6 是详细的手动步骤，跟 §3.0 是「引导式」与「手工」两种路径，
做完任一即可。

### 3.1 阿里云资源开通

| 资源 | 操作 | 详细文档 |
|---|---|---|
| **RDS MySQL 8.0** | 控制台创建 → 与 ECS 同 VPC + 同 vSwitch | [`rds/README.md`](rds/README.md) |
| **OSS Bucket** | 同地域 + 私有 + 标准存储 | [`oss/README.md`](oss/README.md) |
| **CDN 域名** | 回源 OSS + HTTPS | [`oss/README.md#3-绑-CDN-域名`](oss/README.md) |
| **RAM 子用户** | 绑 [`oss/ram-policy.json`](oss/ram-policy.json) 最小权限 | 同上 |

### 3.2 ECS 准备

```bash
ssh root@<ECS_HOST>

# 如果是全新极简镜像，先装 git 以便拉仓库：
#   Alibaba Cloud Linux / CentOS / RHEL: sudo dnf install -y git || sudo yum install -y git
#   Ubuntu / Debian: sudo apt-get update && sudo apt-get install -y git

# 拉仓库
mkdir -p /opt/ai-star-eco
git clone <repo-url> /opt/ai-star-eco/repo
ln -s /opt/ai-star-eco/repo/apps /opt/ai-star-eco/apps

# 自动补齐 ECS 宿主机依赖。脚本会读取 /etc/os-release，并按实际镜像使用 dnf / yum / apt：
# Java 17 JDK、nginx、docker、ffmpeg、fontconfig + CJK 字体、Node 24.14.1、pnpm 10.33.2、rsync/curl/tar/unzip 等。
cd /opt/ai-star-eco/repo
sudo ./infra/scripts/install-host-deps.sh all
```

### 3.3 RDS 建库 + 应用账号

```bash
# 用 RDS 控制台开「内网白名单」加 ECS 内网 IP
# 用 RDS 控制台创主账号 aistareco_root（高权限）

mysql -h <RDS_INTERNAL_HOST> -u aistareco_root -p < infra/rds/00_create_database.sql

# 编辑 01_create_app_user.sql，替换 <APP_PASSWORD> 与 <VPC_CIDR_OR_PERCENT>
vim infra/rds/01_create_app_user.sql
mysql -h <RDS_INTERNAL_HOST> -u aistareco_root -p < infra/rds/01_create_app_user.sql
```

### 3.4 配置文件落位

```bash
mkdir -p /etc/aistareco

cp infra/env/server.env.example      /etc/aistareco/server.env
cp infra/env/sau-service.env.example /etc/aistareco/sau-service.env
# 编辑这两个文件，把 <FILL_xxx> 占位替换为真实值（RDS endpoint / OSS AK / JWT secret 等）
vim /etc/aistareco/server.env
vim /etc/aistareco/sau-service.env
chmod 600 /etc/aistareco/*.env

# 选 HTTP 入口形态（推荐首次部署用）：
cp infra/nginx/ai.conf.example /etc/nginx/conf.d/ai.conf
cp infra/nginx/snippets/proxy-defaults.conf /etc/nginx/conf.d/snippets/

# 生产 HTTPS：**每个子域一份 443 vhost**，与线上 conf.d 一一对应（见 §5.1）
# ⚠️ 只配 80 的子域，HTTPS 会落到 443 默认站并串到别的产品；HTTPS-First / HSTS
#    会让用户绕不过去。先装下面这两个全局块，它们是安全网：
# cp infra/nginx/000-default-ssl.conf.example        /etc/nginx/conf.d/000-default-ssl.conf
# cp infra/nginx/www-redirect.conf.example           /etc/nginx/conf.d/www-redirect.conf
# cp infra/nginx/aistareco.conf.example              /etc/nginx/conf.d/aistareco.conf
# cp infra/nginx/admin.aibuzz.cn.ssl.conf.example     /etc/nginx/conf.d/admin.aibuzz.cn.ssl.conf
# cp infra/nginx/celebrity.aibuzz.cn.ssl.conf.example /etc/nginx/conf.d/celebrity-ssl.conf
# cp infra/nginx/music.aibuzz.cn.ssl.conf.example     /etc/nginx/conf.d/music.aibuzz.cn.ssl.conf
# cp infra/nginx/drama.aibuzz.cn.ssl.conf.example     /etc/nginx/conf.d/drama.aibuzz.cn.ssl.conf
# cp infra/nginx/aiavatar.aibuzz.cn.ssl.conf.example  /etc/nginx/conf.d/aiavatar.aibuzz.cn.ssl.conf
# cp infra/nginx/star.aibuzz.cn.ssl.conf.example      /etc/nginx/conf.d/star.aibuzz.cn.ssl.conf
# cp infra/nginx/api.aibuzz.cn.ssl.conf.example       /etc/nginx/conf.d/api.aibuzz.cn.ssl.conf
# cp infra/nginx/aistar.aibuzz.cn.conf.example        /etc/nginx/conf.d/aistar.aibuzz.cn.conf
# cp infra/nginx/star.aibuzz.cn.conf.example          /etc/nginx/conf.d/star.aibuzz.cn.conf
# 泛域名证书须先落位到 /etc/nginx/certs/aibuzz.cn/{fullchain.pem,privkey.key}（签发与续期见 §5.3）
nginx -t && systemctl reload nginx

# systemd 单元
cp infra/systemd/aistareco-server.service.example         /etc/systemd/system/aistareco-server.service
cp infra/systemd/aistareco-admin.service.example          /etc/systemd/system/aistareco-admin.service
cp infra/systemd/aistareco-web-celebrity.service.example  /etc/systemd/system/aistareco-web-celebrity.service
cp infra/systemd/aistareco-web-music.service.example      /etc/systemd/system/aistareco-web-music.service
cp infra/systemd/aistareco-web-drama.service.example      /etc/systemd/system/aistareco-web-drama.service
cp infra/systemd/aistareco-web-aiavatar.service.example   /etc/systemd/system/aistareco-web-aiavatar.service
cp infra/systemd/aistareco-sau-service.service.example    /etc/systemd/system/aistareco-sau-service.service
systemctl daemon-reload
systemctl enable aistareco-server aistareco-web aistareco-admin \
                 aistareco-web-celebrity aistareco-web-music aistareco-web-drama \
                 aistareco-web-aiavatar aistareco-sau-service
```

### 3.5 首次部署 + 验证

```bash
# 在 本机 dev 上执行（部署脚本走本地 build → rsync → ssh restart）
ECS_HOST=root@<ECS_HOST> ./infra/scripts/deploy.sh server
ECS_HOST=root@<ECS_HOST> ./infra/scripts/deploy.sh web
ECS_HOST=root@<ECS_HOST> ./infra/scripts/deploy.sh admin
ECS_HOST=root@<ECS_HOST> ./infra/scripts/deploy.sh web-celebrity
ECS_HOST=root@<ECS_HOST> ./infra/scripts/deploy.sh sau-service

# 或一次性全部
ECS_HOST=root@<ECS_HOST> ./infra/scripts/deploy.sh all

# 验证健康
ECS_HOST=root@<ECS_HOST> ./infra/scripts/verify.sh
```

### 3.6 生产首个 SUPER_ADMIN

`aep.seed.dev-data.enabled=false` 默认让生产空库**不**写演示账号。需要 SQL 插入第一个超管：

```sql
-- 用 BCryptPasswordEncoder 离线生成密码哈希，例如：
-- new BCryptPasswordEncoder().encode("YourStrongPassword!")
INSERT INTO admin_users (id, username, password_hash, role, status, created_at)
VALUES (UUID(), 'your-admin', '<bcrypt-hash>', 'super_admin', 'active', NOW());
```

后续运营人员都通过 `/admin/platform/staff` 页面创建。

---

## 4. 日常增量部署

当前生产机采用「CI / 本地构建 release 包 → rsync 到 ECS → 远端解包 + systemd 重启」。
构建机不需要 Docker；`sau-service` 的真实模式镜像在 ECS 上构建，避免跨架构镜像问题。

### 4.1 本地手动部署

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
./infra/scripts/deploy.sh all
```

只部署某几个服务：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
./infra/scripts/deploy.sh server,web-celebrity
```

当前生产脚本支持的 `<service>`：`server / web-celebrity / web-aiavatar / admin / sau-service / all`。

也可以拆成两步，便于先检查产物再发布：

```bash
RELEASE_ID=$(git rev-parse --short HEAD) ./infra/scripts/build-release.sh all

DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
./infra/scripts/deploy-release.sh "dist/deploy/$(git rev-parse --short HEAD)" all
```

部署后验证：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
./infra/scripts/verify.sh
```

`deploy-release.sh` 默认会在 ECS 上幂等执行 `infra/scripts/install-host-deps.sh`、
`infra/scripts/check-runtime-env.sh` 和 `infra/scripts/install-cjk-fonts.sh`，按宿主机镜像自动补齐缺失命令，
检查 `/etc/aistareco/*.env` 与 release manifest，并确保系统层中文字体可供 Java2D、ffmpeg drawtext、
headless browser 等服务使用。若只想预检/手动修复：

```bash
ssh root@<ECS_HOST> 'bash -s' < infra/scripts/install-host-deps.sh
ssh root@<ECS_HOST> 'bash -s' < infra/scripts/check-runtime-env.sh
ssh root@<ECS_HOST> 'bash -s' < infra/scripts/install-cjk-fonts.sh
SSH_KEY=/path/to/key.pem ./infra/scripts/preflight.sh --remote root@<ECS_HOST>
```

如需排查包管理器或网络问题，可临时设置 `ENSURE_HOST_DEPS=0` 跳过远端依赖补齐；
只跳过 runtime env 检查用 `CHECK_RUNTIME_ENV=0`；只跳过字体安装用 `ENSURE_CJK_FONTS=0`。

### 4.1.1 ECS 本机直接部署（无 SSH，v0.47+）

适用场景：

- 开发机网络抖 / SSH 不稳，直接 ssh 进 ECS 本机一气呵成
- GitHub Actions runner 临时不可用，应急部署
- CI/CD pipeline 把代码 sync 到 ECS 后由 ECS 本机自己 build + 翻新

前提：仓库已经 clone 到 ECS（README §3.2 推荐 `/opt/ai-star-eco/repo`）。

```bash
ssh root@<ECS_HOST>
cd /opt/ai-star-eco/repo

# 一键：补依赖 → git fetch/pull --ff-only → build release → 本机落位 → restart → verify
sudo ./infra/scripts/update-and-deploy.sh all

# 只更新部分服务
sudo ./infra/scripts/update-and-deploy.sh server,admin
sudo ./infra/scripts/update-and-deploy.sh "web-celebrity sau-service"

# 等价快捷方式：deploy-local.sh --pull 会转交给 update-and-deploy.sh
sudo ./infra/scripts/deploy-local.sh all --pull

# 如果代码已经是目标版本，只部署当前工作区
sudo ./infra/scripts/deploy-local.sh server
sudo ./infra/scripts/deploy-local.sh web-celebrity
sudo ./infra/scripts/deploy-local.sh admin
sudo ./infra/scripts/deploy-local.sh sau-service

# 部分服务（逗号或空格分隔）
sudo ./infra/scripts/deploy-local.sh server,web-celebrity
sudo ./infra/scripts/deploy-local.sh "server admin"

# 紧急部署：跳 typecheck + 跳 verify
SKIP_TYPECHECK=1 sudo ./infra/scripts/deploy-local.sh all --no-verify

# 只在确认宿主机依赖已齐备时跳过依赖补齐
sudo ./infra/scripts/deploy-local.sh server,admin --no-deps

# 只在故障排查时跳过 runtime env 检查
sudo ./infra/scripts/deploy-local.sh server,admin --no-env-check

# 已经 build 过想只翻新位文件（如审 review 完产物再上线）
./infra/scripts/build-release.sh all                          # 第一步：本机 build
sudo ./infra/scripts/deploy-local.sh all \
  --no-build --release-id=<dist/deploy/ 下的 RELEASE_ID>      # 第二步：仅翻新 + restart
```

行为说明：

- 与 `deploy-release.sh` **完全相同**的落位规则：jar 直接 `install` 到 `$REMOTE_ROOT/server/app.jar`；
  web/admin 解包到 `$REMOTE_ROOT/<svc>` + 原目录改名 `<svc>.__previous__-<RELEASE_ID>` 备份；
  sau-service docker build 后 systemctl restart。
- **依赖补齐**：`deploy-local.sh` 默认先调用 `install-host-deps.sh`，按宿主机 `/etc/os-release`
  和可用包管理器自动安装缺失命令；`update-and-deploy.sh` 也会先执行同一检查。
  依赖包括 Java 17 JDK、nginx、docker（仅 sau-service/all 需要）、ffmpeg、fontconfig + CJK 字体、
  Node 24.14.1、pnpm 10.33.2、rsync/curl/tar/unzip 等。
- **runtime env 预检**：部署前默认调用 `check-runtime-env.sh`。它读取
  `/etc/aistareco/server.env`、`/etc/aistareco/sau-service.env` 和 release manifest，只输出变量名，
  不打印真实密钥值。缺文件、占位符、关键密钥缺失、`AEP_DEV_AUTH_ENABLED=true`、SMS/OSS 真驱动缺凭据、
  `SAU_MOCK_MODE!=0`、`SAU_INTERNAL_SECRET` 与 `AEP_INTERNAL_SECRET` 不一致会阻断部署；
  文件权限非 600、`AEP_SEED_DEV_DATA_ENABLED=true` 等高风险项只警告。排障时可用
  `--no-env-check` / `CHECK_RUNTIME_ENV=0` 跳过，或 `ENV_CHECK_WARN_ONLY=1` 改为只警告。
- **代码更新**：`update-and-deploy.sh` 默认只做 `git pull --ff-only`，遇到服务器工作区有未提交改动会中止。
  只有明确传 `--reset-to-origin` 时才会 `git reset --hard origin/<branch>` 丢弃服务器本地改动。
- **备份保留**：默认保留最近 2 份 `.__previous__-*` 目录，超过按 mtime 删除最旧的。
  调 `--keep-previous=N`（0 = 立即删；5 = 保留 5 份）。
  回滚方式：`sudo mv $REMOTE_ROOT/web-celebrity.__previous__-<old-id> $REMOTE_ROOT/web-celebrity`
  + `sudo systemctl restart aistareco-web-celebrity`。
- **部署后健康检查**：自动调 `verify.sh LOCAL_MODE=1`（不走 SSH，直接本机 curl + systemctl status）。
  失败只 WARN 不阻断（因为文件已经落位 + systemd 已重启）。
- **systemd 单元不存在时跳过 restart**：首次部署 ECS 没装 systemd 单元，脚本会 WARN
  「跳过 restart（首次部署？参考 infra/systemd/*.example）」并继续，便于先落位文件后人工建 systemd。

### 4.2 GitHub Actions（仅构建产物，不自动部署）

> **受控发布（2026-06-22 起）**：工作流 `.github/workflows/deploy-production.yml` 已**移除 SSH 自动部署**，
> 只做「构建 + 上传产物」。原因：不在 GitHub 放生产 SSH 私钥（长期主钥交给 GitHub 会扩大爆炸半径）。
> **不再需要任何 `PROD_SSH_*` Secrets**，dispatch 也不会再因缺密钥报错。

工作流：`.github/workflows/deploy-production.yml`（name: *Build release artifacts*），手动触发 `workflow_dispatch`。
触发时 `services` 可填：

```text
all
server
server,web-celebrity,web-aiavatar,admin
sau-service
```

工作流把 `dist/deploy/<release-id>` 上传为 GitHub artifact（保留 14 天）。**实际发布由人工受控执行**：

- 本机：`./infra/scripts/deploy.sh <services>`（构建+部署一步），或对已下载产物用 `deploy-release.sh <dir> <services>`
- ECS 上：`sudo ./infra/scripts/update-and-deploy.sh <services>`（git pull → 构建 → 部署，私钥不离机）

> 若将来确实要恢复 Actions 自动部署，**不要放主钥**——生成一把部署专用受限 key（`authorized_keys`
> 加 `command=`/`from=` 限制，泄露可单独轮换），再补回 Configure SSH / Deploy 两个 step 与对应 Secrets。

回滚到任意历史 tag 仍可用：

```bash
ECS_HOST=ecs-user@<ECS_HOST> ./infra/scripts/rollback.sh <service> <git-sha>
```

### 4.3 统一账号中心（id.aibuzz.cn）

**账号中心已抽离为独立仓库：<https://github.com/pokocat/aibuzz-id>。**
建库、env、RS256 签名密钥、systemd 单元、nginx vhost、部署与回滚，全部见该仓的
`deploy/README.md`；本仓的 `infra/scripts/*` 不再构建、不再部署它。

与本仓相关的落点事实（改机器 / 排端口冲突时要知道的）：

- 与 `aistareco-server` **同一台 ECS**，端口 **8091**（本机 8090 已被 `aistareco-sau-service`
  的 docker 容器占用）
- **独立库 `aistareco_id`**，与业务库 `aistareco` 分开
- 验证码 / 发码限频 / 令牌 denylist 用**本机自建 Redis**；将来要跑多实例（集群化）再换阿里云 Redis
- 证书复用 `*.aibuzz.cn` 泛域名证书，DNS 已有 `id A 47.98.162.120`

本仓这一侧只保留**消费方**配置，两边的值必须对上：

| 账号中心侧（见 pokocat/aibuzz-id） | 本仓 server 侧（`/etc/aistareco/server.env`） |
|---|---|
| `ID_ISSUER=https://id.aibuzz.cn` | `AEP_ID_ISSUER=https://id.aibuzz.cn` |
| `ID_CLIENT_SECRET_AISTAR_SERVER=<X>` | `AEP_ID_CLIENT_SECRET=<同一个 X>` |
| 客户端 `aistar-server` | `AEP_ID_CLIENT_ID=aistar-server` |

两边 secret 不一致的现象是 server 侧 401 + 账号中心侧一条 `invalid_client`，很难查。

前端（五个 web app）切到账号中心登录靠三个 `NEXT_PUBLIC_*`（见各 `infra/env/web-*.env.example`）。
⚠️ 它们是**构建期内联**的：只改 ECS 上的运行期 `.env` 不生效，必须打包时带上：

```bash
NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn \
  ./infra/scripts/deploy.sh web-music,web-drama,web-celebrity,web-aiavatar,web-star
```

默认值是 `legacy`，所以**不显式指定时现网行为完全不变**。回退 = 用 `legacy` 重新构建部署。

上线顺序：账号中心 → `apps/server` → 五个前端。反过来会让前端拿不到令牌。

---

## 5. 关键约定

- **OSS endpoint 用内网**（`oss-cn-hangzhou-internal.aliyuncs.com`），公网会算流量费 + 暴露 AK 风险面
- **RDS 内网 endpoint** 同理；公网 endpoint 仅本机调试用
- **密钥不入 git**：`infra/env/*.env`（不含 `.example`）和 `apps/miniprogram/config/env.js` 都已在 `.gitignore`
- **`AEP_SEED_DEV_DATA_ENABLED=false`**：生产 server.env 默认值，避免新空库写入演示账号
- **`AEP_DEV_AUTH_ENABLED=false`**：生产必须关闭免密 dev-login 入口
- **`AEP_PAYMENT_DRIVER`**：充值收银台 bootstrap 驱动（`server.env.example` §15）。生产渠道启用 + 机密以 admin 后台「支付配置」DB 为准（多渠道并存，用户收银台自选 `alipay` / `wechat`）；此 env 仅为 DB 尚无配置时的回落。真实渠道机密缺失时 fail-fast，绝不静默回落 shadow
- **系统 CJK 字体必须存在**：部署脚本默认确保 `google-noto-*-cjk-sc`，`verify.sh` 会检查。
  这是 picgen、ffmpeg drawtext、headless browser 中文渲染的服务器级兜底。
- **JWT / AES 密钥**：`AEP_JWT_SECRET`（≥32 字符高熵）/ `AEP_SECRET_KEY`（32 字节）必须 env 注入；
  mysql/prod profile 启动看到 dev default 直接抛异常拒绝启动
- **MixcutPresetSeeder 不受 dev-data gate 控制**（GIF 扰动贴图池是平台基础数据，生产也要种）
- **账号中心用 8091，不是 8090**：本机 8090 归 `aistareco-sau-service` 的 docker 容器
  （`server.env` 的 `SAU_SERVICE_URL` 指着它）。新加同机服务前先 `ss -ltn` 看一眼端口，
  别照抄应用文档里的默认端口。账号中心自身的部署与运维见独立仓库
  [pokocat/aibuzz-id](https://github.com/pokocat/aibuzz-id) 的 `deploy/README.md`

### 5.1 nginx vhost：每个子域必须**同时**有 80 和 443，且 443 有兜底默认站

> 2026-08-29 首次事故复盘，2026-09-06 收口。**这是硬规则，新增子域时一并建两个 vhost。**

**规则**：每个对外子域必须同时存在 `listen 80` 和 `listen 443 ssl` 两个 server block。
只建 80 的子域，用 HTTPS 打开时**不会报错，而是静默走到别的站点**。

**为什么**：`conf.d` 里如果没有任何 443 块标 `default_server`，nginx 就把
**配置加载顺序里第一个 `listen 443` 的 server 当作 443 默认站**；`include conf.d/*.conf`
按字典序展开，`admin.aibuzz.cn.ssl.conf` 恰好排第一 —— 于是**所有没有自己 443 vhost
的 host，HTTPS 请求全部落到 admin**，再被 admin 的 `location = / { return 302 /admin; }`
跳到后台登录页。用户侧表现是「域名打不开 / 莫名其妙跳到后台」，而不是证书错误。

**2026-09-06 已加兜底**：`000-default-ssl.conf`（文件名 `000-` 开头保证排第一）显式
`listen 443 ssl default_server`，未登记的 host 一律返回 404 纯文本，不再串到任何业务站点，
并单独记 `/var/log/nginx/unmatched-ssl.log`。**但这只是安全网，不是免建 vhost 的理由** ——
新子域仍必须自己建 80 + 443，否则用户看到的是 404。

**HTTPS-First / HSTS**：不需要用户手打 `https://`，Chrome/Edge 会自动升级；同源下发过的
HSTS（各 443 vhost 都带 `max-age=31536000`）更是强制。**所以「80 配好了就能访问」
在装过一次 HSTS 的浏览器上不成立。**

**线上 vhost 清单**（2026-09-06 核对 `ecs-user@47.98.162.120:/etc/nginx/conf.d/`）：

| 子域 | 上游 | 80 vhost | 443 vhost | 仓库 example |
|---|---|---|---|---|
| *（未登记 host）* | — | `aistareco.conf` 的 `listen 80 default_server`（IP 直访，回带货站） | `000-default-ssl.conf` → **404 兜底** | `000-default-ssl.conf.example` |
| `admin.aibuzz.cn` | admin 3003 | `aistareco.conf`（308 → https） | `admin.aibuzz.cn.ssl.conf` | `admin.aibuzz.cn.ssl.conf.example` |
| `celebrity.aibuzz.cn` | web-celebrity 3012 | `aistareco.conf`（308 → https） | `celebrity-ssl.conf` | `celebrity.aibuzz.cn.ssl.conf.example` |
| `music.aibuzz.cn` | web-music 3010 | `aistareco.conf`（308 → https） | `music.aibuzz.cn.ssl.conf` | `music.aibuzz.cn.ssl.conf.example` |
| `drama.aibuzz.cn` | web-drama 3011 | `aistareco.conf`（308 → https） | `drama.aibuzz.cn.ssl.conf` | `drama.aibuzz.cn.ssl.conf.example` |
| `aiavatar.aibuzz.cn` | web-aiavatar 3013 | `aistareco.conf`（308 → https） | `aiavatar.aibuzz.cn.ssl.conf` | `aiavatar.aibuzz.cn.ssl.conf.example` |
| `star.aibuzz.cn` | web-star 3014 | `star.aibuzz.cn.conf`（308 → https） | `star.aibuzz.cn.ssl.conf` | 两份同名 example |
| `aistar.aibuzz.cn` | web-aiavatar 3013 | `aistar.aibuzz.cn.conf` | 同文件 | `aistar.aibuzz.cn.conf.example` |
| `api.aibuzz.cn` | server 8080 | `aistareco.conf`（**不跳转**，见下） | `api.aibuzz.cn.ssl.conf` ← 2026-09-06 补 | `api.aibuzz.cn.ssl.conf.example` |
| `www.<任意子域>` | — | `www-redirect.conf`（308 → 去掉 www） | 同文件 | `www-redirect.conf.example` |
| `aibuzz.cn` / `www` | web-celebrity 3012 | `aibuzz-ssl.conf` | `aibuzz-ssl.conf` | 无（含 H5 演示静态站，暂不进仓） |
| `id.aibuzz.cn` | 账号中心 8091 | `id.aibuzz.cn.conf` | 同文件 | 不在本仓：见 pokocat/aibuzz-id 的 `deploy/` |

注意 80 和 443 **不在同一个文件里**：多数子域的 80 块集中在 `aistareco.conf`，443 块各占
一个 `<domain>.ssl.conf`。改动时两边都要看，别只 grep 一个文件就下结论。

**80 一律 308 跳 HTTPS（2026-09-06）**：`celebrity/music/drama/aiavatar/admin/star/aistar`
的 80 块此前直接明文出内容，现改为 `return 308 https://$host$request_uri`。
用 **308** 而不是 301：308 保留请求方法与 body，万一还有客户端在 POST `http://<域名>/api/...`
不会被降级成 GET 丢掉请求体。`/healthz` 仍留在 80 上直接返回 200，免得把监控探测也变成一次跳转。

**两个有意的例外**：
- `api.aibuzz.cn:80` 不强跳 —— 机器客户端入口，不确定有无老集成在用。
  **待办**：确认无 http 调用方后改成 308，否则 JWT 会明文过网。
- `aistareco.conf` 的 `listen 80 default_server`（`server_name 47.98.162.120`）不动 ——
  IP 直访、`infra/scripts/verify.sh` 的 `PUBLIC_BASE=http://47.98.162.120`、`/liuyue` 静态演示都靠它。

### 5.2 www.* 二级子域：DNS 泛解析 + TLS 通配符不覆盖两级

> 2026-09-06 事故复盘（这就是「客户说链接打开不太对」的真因）。

`aibuzz.cn` 在 Alidns 上是**泛解析** `* A 47.98.162.120`，DNS 通配符按 RFC 4592 会匹配
任意层级，所以 `www.music.aibuzz.cn`、甚至拼错的 `bossclud.aibuzz.cn` 都解析得通。
**但 TLS 通配符 `*.aibuzz.cn` 只覆盖一级**，`www.music.aibuzz.cn` 不在其中 ——
用户看到的是先证书红页警告、点「继续」之后再落到 443 默认站（当时 = admin 后台登录页）。

日志实测（2026-09-01 ~ 09-06，`/var/log/nginx/access.log` 按 Referer 统计）：
`www.drama` 252 次、`www.music` 240 次、`www.admin` 121 次、`www.bossclub` 105 次
全部打的是 `/api/admin/*`、`/admin/login` —— 即真实用户当时正对着后台登录页。

**已修**：
1. 重签证书把这些 www 名字写进 SAN（见 §5.3）。
2. 新增 `www-redirect.conf`：全部 `www.<子域>` 308 跳回不带 www 的正式地址，
   靠 `map $host $aep_naked_host { ~^www\.(?<aep_rest>.+)$ $aep_rest; default $host; }` 剥前缀。
3. `celebrity-ssl.conf` / `aistar.aibuzz.cn.conf` 的 `server_name` 摘掉各自的 www —— 
   否则与 `www-redirect.conf` 重复声明，nginx 会报 conflicting server name 并忽略后加载的那个。
   `www.aibuzz.cn`（apex 的 www，在 `aibuzz-ssl.conf`）与 `www.gallery`（在 `gallery.aibuzz.cn.conf`）
   **不在** `www-redirect.conf` 里，是有意的。

### 5.3 证书：一张 Let's Encrypt 泛域名证书 + 本机 certbot 自动续期

**当前证书**（2026-09-06 重签）：

```
颁发者   Let's Encrypt
有效期   2026-09-06 → 2026-12-05
SAN      *.aibuzz.cn, aibuzz.cn,
         www.{music,drama,celebrity,star,aiavatar,aistar,aislides,admin,id,api,wxapi,bossclub}.aibuzz.cn
真值路径 /etc/nginx/certs/aibuzz.cn/{fullchain.pem,privkey.key}
```

**所有 AI Star Eco 的 vhost 已统一指向上面这个真值路径**（2026-09-06 把 drama /
celebrity / admin / aistar 四处指向副本目录的配置改了过来）。线上仍存在 5 个同一张证书的
副本目录（`/etc/nginx/certs/celebrity.aibuzz.cn/`、`/etc/nginx/ssl/{admin,aistar,drama,bossclub}.aibuzz.cn/`），
其中只有 `bossclub.aibuzz.cn.conf`（非本仓产品）还在引用；部署脚本会连同副本一起更新，
所以漏换旧证书的坑已经堵上。

**续期是自动的**，跑在**本机（开发者 Mac）**上：

```
~/dev/aliyun/acme/
├── config/ work/ logs/          # certbot 的三个目录（--config-dir 等）
├── alidns-auth.sh               # DNS-01 挑战：用 aliyun CLI 往 aibuzz.cn 加 _acme-challenge TXT
├── alidns-cleanup.sh            # 验证完删掉那条 TXT（按 RR + Value 精确匹配）
├── deploy-to-ecs.sh             # certbot renew_hook：scp 到 ECS + 同步 5 个副本目录 + nginx -t + reload
└── renew.sh                     # cron 入口
```

crontab：`17 3,15 * * * ~/dev/aliyun/acme/renew.sh` —— 每天两次；certbot 只在剩余
< 30 天时才真续，其余时候几秒退出，不碰 DNS 也不碰线上。

手动操作：

```bash
A=~/dev/aliyun/acme
# 演练（走 LE staging，会真的加/删 DNS TXT，但不部署）
certbot renew --dry-run --cert-name aibuzz-wildcard \
  --config-dir $A/config --work-dir $A/work --logs-dir $A/logs
# 强制立即续期并部署
certbot renew --force-renewal --cert-name aibuzz-wildcard \
  --config-dir $A/config --work-dir $A/work --logs-dir $A/logs
```

依赖：本机 `aliyun` CLI 的 default profile 必须对 `aibuzz.cn` 有 Alidns 读写权限；
部署私钥固定为 `~/dev/aliyun/aliyun-ecs.pem`。

⚠️ **这套续期跑在个人 Mac 上，机器长期关机 / 换机就会失效**。要挪到 ECS 上跑，
需要一对有 `AliyunDNSFullAccess` 的 RAM AK/SK（ECS 上没配 aliyun CLI 凭据），
配好后把这三个脚本原样搬过去即可。

**新增子域 checklist**：

1. 加 80 block（`aistareco.conf` 或独立文件），内容通常就是 `return 308 https://$host$request_uri;`
2. 加 443 block（独立 `<domain>.ssl.conf`，从 `music.aibuzz.cn.ssl.conf.example` 复制改端口）
3. 如果要支持 `www.<新子域>`：**先把它加进证书 SAN 再重签**（`certbot certonly ... -d www.<新子域>.aibuzz.cn`），
   然后在 `www-redirect.conf` 的 `server_name` 里补一行 —— 只加 vhost 不加 SAN 等于证书红页
4. 仓库同步一份 `<domain>.ssl.conf.example`（AGENTS.md §9 文档同步纪律）
5. `sudo nginx -t && sudo systemctl reload nginx`
6. 验证**两个协议都通**，且落到正确上游：

```bash
for d in admin celebrity music drama aiavatar star aistar api id; do
  printf '%-10s http=%-4s https=%-4s %s\n' "$d" \
    "$(curl -s -o /dev/null -w '%{http_code}' -m 10 "http://$d.aibuzz.cn/")" \
    "$(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$d.aibuzz.cn/")" \
    "$(curl -sI -m 10 "https://$d.aibuzz.cn/" | grep -i '^location:' | tr -d '\r')"
done
# www.* 应全部 308 回不带 www 的地址，且 tls_verify=0
for d in music drama celebrity star aiavatar; do
  printf '%-26s ' "www.$d.aibuzz.cn"
  curl -s -o /dev/null -m 10 -w 'code=%{http_code} tls=%{ssl_verify_result} loc=%{redirect_url}\n' "https://www.$d.aibuzz.cn/"
done
```

443 落错站的老特征是 **302 到 `/admin`**：单看状态码像正常重定向，要看 `Location` 才发现
串站。加了 `000-default-ssl.conf` 之后这类问题会表现为 **404 + `unmatched-ssl.log` 里出现该 host**，
排查时先看那个日志：

```bash
# 该日志用专用 log_format aep_unmatched，直接记了 host=<用户敲的域名>
sudo awk '{for(i=1;i<=NF;i++) if($i ~ /^host=/) print $i}' \
  /var/log/nginx/unmatched-ssl.log | sort | uniq -c | sort -rn | head
```

---

## 6. Phase 路线图

| Phase | 状态 | 范围 |
|---|---|---|
| **0** 基础设施版本化 | ✅ | `infra/` 目录骨架（本 README + 模板 + 脚本） |
| **1** 生产硬伤修复 | ✅ | Flyway 接入 + 7 个 seeder 加 dev-data gate + JWT/AES 密钥 fail-fast |
| **2** RDS / OSS 配置就绪 | ✅ | env 模板齐全，代码层 AliyunOssCdnUploader / AliyunSmsSender 早已实现，配 env 即可启用 |
| **3a** artifact CI/CD | ✅ | GitHub Actions 构建 release 包，SSH/rsync 部署到当前单 ECS |
| **3b** 全栈容器化 | ⏳ 待 | 给所有 app 加 Dockerfile + docker-compose + ACR 镜像发布 |
| **4** 用户上传素材 OSS 化 | ⏳ 待 | `MixcutAssetService` 上传走 `CdnUploader`（当前仍落本地盘） |
| **5** 多实例就绪 | ⏳ 待 | Redis（`SmsCodeService`）+ ShedLock（`@Scheduled`）+ cookie SSO + JWT 黑名单 |

---

## 7. FAQ

### Q1: Flyway 启动报 `Found non-empty schema(s) ... without schema history table`

**原因**：Flyway 首次启动看到 schema 已有表（Hibernate `ddl-auto=update` 之前建的）但没有 `flyway_schema_history` 表。

**解决**：`application-mysql.yml` 已配 `flyway.baseline-on-migrate: true`，Flyway 会自动建 history 表并标记 V1 已应用。
如果仍报错说明配置没生效，检查 `application-mysql.yml` 是否被覆盖。

### Q2: server 启动报 `Could not derive aes key` / `JWT signature does not match`

**原因**：`AEP_SECRET_KEY` 或 `AEP_JWT_SECRET` 与历史数据加密所用的不一致 → 历史加密数据解不开 / 旧 JWT 解不开。

**解决**：把 `/etc/aistareco/server.env` 改回原值；如果原值已丢，做两件事：
1. 强制用户重新登录（旧 JWT 失效，新 JWT 用新密钥签发）
2. 重置 `AiModelProvider.apiKey` 等加密字段（admin 后台重填）

### Q3: server 启动很慢（> 5 分钟）

**原因**：RDS 内网延迟太高 / Hibernate 在循环 ALTER TABLE。

**排查**：
- ECS 到 RDS ping `< 1ms` 才合格（必须同 VPC 同 vSwitch）
- `journalctl -u aistareco-server -f` 看是不是 Hibernate 在大量 ALTER（说明 ddl-auto 与既有 schema 不一致）
- 临时改 `ddl-auto: none` 启动看 Hibernate 是否能跳过校验

### Q4: OSS 上传 403 `AccessDenied`

**原因**：RAM 子用户权限不对 / Bucket 名拼错。

**排查**：
```bash
echo test | ossutil cp - oss://<bucket>/mixcut/test.txt
```
如果 403 → 检查 `oss/ram-policy.json` 是否绑到该子用户、Resource 行是否含 `<bucket>/mixcut/*`。

### Q5: 浏览器拿 OSS 视频 403 `RequestForbidden`

**原因**：Bucket 是私有 + CDN 没开「OSS Private Bucket 回源」。

**解决**：CDN 控制台 → 加速域名 → 回源配置 → 开「OSS Private Bucket 回源」+ 录入 AK。

### Q6: `/web` 或 `/admin` 短暂 502

**原因**：Next standalone server 还没 ready。

**解决**：等 10-20s；如长时间 502 看 `journalctl -u aistareco-web -n 50`。Nginx 的
`proxy_pass` 必须 **无尾部 `/`**（看 `nginx/ai.conf.example` 注释），否则 `/web/_next/*` 会被剥成 `/_next/*` → chunk 404。

### Q7: sau-service `/login/start` 报 `ModuleNotFoundError: patchright`

**原因**：Docker image 没用 `--build-arg INSTALL_REAL=1` 构建。

**解决**：
```bash
ssh <ECS_HOST> 'cd /opt/ai-star-eco/repo/apps/sau-service && \
  DOCKER_BUILDKIT=1 docker build --build-arg INSTALL_REAL=1 -t aistareco/sau-service:real .'
ssh <ECS_HOST> 'systemctl restart aistareco-sau-service'
```

### Q8: `/api/me/social-accounts/bind-init` 504 (Gateway Timeout)

**原因**：nginx `/api/` 的 `proxy_read_timeout` 太短，首次 patchright + SPA 慢可达 60-90s。

**解决**：确认 nginx 配的是 `proxy_read_timeout 180s` + `proxy_send_timeout 180s`（见 `nginx/ai.conf.example`）。
