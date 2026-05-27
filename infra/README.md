# infra/ — 阿里云部署基础设施

把部署所需的所有资产（nginx 配置、systemd 单元、环境变量模板、RDS 建库脚本、OSS Bucket
策略、部署脚本）**全部归一到 git**。新机器从零拉起一套完整环境，按本文 §3
「一次性环境拉起」执行即可在 30~60 分钟内完成。

本文件是 AI Star Eco 在阿里云上部署的**单一真值源**。

---

## 1. 目录速览

```
infra/
├── README.md                       ← 本文件（入口 + 拓扑 + SOP + FAQ）
│
├── env/                            ← 各服务环境变量模板（**不含真实密钥**）
│   ├── server.env.example          ← Spring Boot 完整变量清单
│   ├── sau-service.env.example     ← Python sau-service Docker 容器
│   ├── web.env.example             ← apps/web（Next 14, basePath=/web）
│   ├── admin.env.example           ← apps/admin（Next 14, basePath=/admin）
│   ├── web-celebrity.env.example   ← apps/web-celebrity（Next 16, 根路径）
│   ├── web-music.env.example       ← apps/web-music
│   └── web-drama.env.example       ← apps/web-drama
│
├── nginx/                          ← Nginx 配置（落 /etc/nginx/conf.d/）
│   ├── ai.conf.example             ← HTTP 入口形态（首次部署 / 内网联调）
│   ├── ai.aibuzz.cn.conf.example  ← HTTPS 多子域生产形态
│   └── snippets/
│       └── proxy-defaults.conf     ← 通用 proxy_set_header 集
│
├── systemd/                        ← systemd 单元模板（落 /etc/systemd/system/）
│   ├── aistareco-server.service.example
│   ├── aistareco-web.service.example
│   ├── aistareco-admin.service.example
│   ├── aistareco-web-celebrity.service.example
│   ├── aistareco-web-music.service.example
│   ├── aistareco-web-drama.service.example
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
    ├── dev-server.sh               ← 本机 server 启动 wrapper（自动起 docker mysql + 注入 dev 弱密钥）
    ├── deploy.sh                   ← deploy.sh <service> [tag]，幂等
    ├── rollback.sh                 ← rollback.sh <service> <tag>
    └── verify.sh                   ← 部署后健康检查批量
```

---

## 2. 架构拓扑

```
                          ┌─ SLB / Nginx (公网入口, HTTPS 域名)
                          │   ├─ aibuzz.cn / www → web (3002, basePath=/web)
                          │   ├─ admin.aibuzz.cn → admin (3003)
                          │   ├─ celebrity.aibuzz.cn → web-celebrity (3012)
                          │   ├─ music.aibuzz.cn → web-music (3010)
                          │   ├─ drama.aibuzz.cn → web-drama (3011)
                          │   └─ api.aibuzz.cn → server (8080)
                          │
ECS 集群 (1~N 台, VPC 内网)│
  ├─ systemd                                                                  
  │   • aistareco-server         :8080  (Spring Boot)
  │   • aistareco-web            :3002  (Next 14 standalone)
  │   • aistareco-admin          :3003  (Next 14 standalone)
  │   • aistareco-web-music      :3010  (Next 16 standalone)
  │   • aistareco-web-drama      :3011  (Next 16 standalone)
  │   • aistareco-web-celebrity  :3012  (Next 16 standalone)
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
./infra/scripts/preflight.sh --remote root@<ECS_HOST>

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

# Java 17 + nginx + docker + ffmpeg
yum install -y java-17-openjdk-headless nginx rsync ffmpeg
systemctl enable --now nginx docker

# nvm + node 24（next standalone runtime）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 24

# 拉仓库
mkdir -p /opt/ai-star-eco
git clone <repo-url> /opt/ai-star-eco/repo
ln -s /opt/ai-star-eco/repo/apps /opt/ai-star-eco/apps
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
# 或选生产 HTTPS 多子域：
# cp infra/nginx/ai.aibuzz.cn.conf.example /etc/nginx/conf.d/ai.aibuzz.cn.conf
nginx -t && systemctl reload nginx

# systemd 单元
cp infra/systemd/aistareco-server.service.example         /etc/systemd/system/aistareco-server.service
cp infra/systemd/aistareco-web.service.example            /etc/systemd/system/aistareco-web.service
cp infra/systemd/aistareco-admin.service.example          /etc/systemd/system/aistareco-admin.service
cp infra/systemd/aistareco-web-celebrity.service.example  /etc/systemd/system/aistareco-web-celebrity.service
cp infra/systemd/aistareco-web-music.service.example      /etc/systemd/system/aistareco-web-music.service
cp infra/systemd/aistareco-web-drama.service.example      /etc/systemd/system/aistareco-web-drama.service
cp infra/systemd/aistareco-sau-service.service.example    /etc/systemd/system/aistareco-sau-service.service
systemctl daemon-reload
systemctl enable aistareco-server aistareco-web aistareco-admin \
                 aistareco-web-celebrity aistareco-web-music aistareco-web-drama \
                 aistareco-sau-service
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

代码改动后，本地 build → rsync 产物 → ssh 重启：

```bash
ECS_HOST=root@<ECS_HOST> ./infra/scripts/deploy.sh <service>
ECS_HOST=root@<ECS_HOST> ./infra/scripts/verify.sh
```

`<service>` 取值：`server / web / admin / web-celebrity / web-music / web-drama / sau-service / all`。

回滚到任意历史 tag：

```bash
ECS_HOST=root@<ECS_HOST> ./infra/scripts/rollback.sh <service> <git-sha>
```

---

## 5. 关键约定

- **OSS endpoint 用内网**（`oss-cn-hangzhou-internal.aliyuncs.com`），公网会算流量费 + 暴露 AK 风险面
- **RDS 内网 endpoint** 同理；公网 endpoint 仅本机调试用
- **密钥不入 git**：`infra/env/*.env`（不含 `.example`）和 `apps/miniprogram/config/env.js` 都已在 `.gitignore`
- **`AEP_SEED_DEV_DATA_ENABLED=false`**：生产 server.env 默认值，避免新空库写入演示账号
- **`AEP_DEV_AUTH_ENABLED=false`**：生产必须关闭免密 dev-login 入口
- **JWT / AES 密钥**：`AEP_JWT_SECRET`（≥32 字符高熵）/ `AEP_SECRET_KEY`（32 字节）必须 env 注入；
  mysql/prod profile 启动看到 dev default 直接抛异常拒绝启动
- **MixcutPresetSeeder 不受 dev-data gate 控制**（GIF 扰动贴图池是平台基础数据，生产也要种）

---

## 6. Phase 路线图

| Phase | 状态 | 范围 |
|---|---|---|
| **0** 基础设施版本化 | ✅ | `infra/` 目录骨架（本 README + 模板 + 脚本） |
| **1** 生产硬伤修复 | ✅ | Flyway 接入 + 7 个 seeder 加 dev-data gate + JWT/AES 密钥 fail-fast |
| **2** RDS / OSS 配置就绪 | ✅ | env 模板齐全，代码层 AliyunOssCdnUploader / AliyunSmsSender 早已实现，配 env 即可启用 |
| **3** 全栈容器化 + CI/CD | ⏳ 待 | 给所有 app 加 Dockerfile + docker-compose + GitHub Actions 推 ACR |
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
