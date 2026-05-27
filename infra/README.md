# infra/ — 阿里云部署基础设施

这一目录把过去散落在生产 ECS `/etc/` 下、未受版本控制的部署资产**全部归一到 git**：nginx
配置、systemd 单元、环境变量模板、RDS 建库脚本、OSS Bucket / RAM 策略、迁移脚本。

新机器从零拉起整套环境，按 [MIGRATION.md](MIGRATION.md) 顺序执行即可在 30~60 分钟内完成。

---

## 1. 目录速览

```
infra/
├── README.md                       ← 本文件（入口）
├── MIGRATION.md                    ← 从单机 MariaDB+本地盘 迁到 RDS+OSS 的 SOP
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
├── nginx/                          ← Nginx 配置（线上 /etc/nginx/conf.d/ 真值源）
│   ├── ai.conf.example             ← 当前形态：单 IP / 子路径（/web、/admin）+ 子端口（:3012）
│   ├── ai.aistar.com.conf.example  ← 目标形态：HTTPS + 多子域（celebrity.aistar.com 等）
│   └── snippets/
│       ├── proxy-defaults.conf     ← 通用 proxy_set_header 集
│       └── ratelimit.conf          ← 可选限流（按需 include）
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
├── rds/                            ← 阿里云 RDS MySQL 初始化
│   ├── README.md                   ← RDS 创建 / 内网白名单 / 参数组建议
│   ├── 00_create_database.sql      ← 建库 + utf8mb4
│   └── 01_create_app_user.sql      ← 应用账号（最小权限）
│
├── oss/                            ← 阿里云 OSS Bucket 初始化
│   ├── README.md                   ← Bucket 创建 / CDN 绑定 / 内外网 endpoint
│   ├── ram-policy.json             ← OSS bucket 最小权限 RAM Policy
│   ├── cors-config.json            ← CORS 规则（前端直传 / signed url 用）
│   └── lifecycle.xml               ← OSS 生命周期（mixcut/temp/ 30 天清理）
│
└── scripts/                        ← 部署 / 验证 / 迁移脚本
    ├── deploy.sh                   ← deploy.sh <service> [tag]，幂等
    ├── rollback.sh                 ← rollback.sh <service> <tag>
    ├── verify.sh                   ← 部署后健康检查批量
    ├── migrate-db.sh               ← MariaDB localhost → RDS 数据迁移
    └── migrate-cdn.sh              ← ./cdn-mock + mixcut-* → OSS 迁移
```

---

## 2. 三层架构关系

```
┌─────────────────────────────────────────────────────────────┐
│  公网入口（SLB / nginx 单机均可）                              │
│  ├─ HTTPS 域名（推荐）                                         │
│  │   • aistar.com           → web (basePath=/web)            │
│  │   • admin.aistar.com     → admin                          │
│  │   • celebrity.aistar.com → web-celebrity                  │
│  │   • music.aistar.com     → web-music                      │
│  │   • drama.aistar.com     → web-drama                      │
│  │   • api.aistar.com       → server                         │
│  │     /static/videos/      → OSS CDN（迁移完成后）            │
│  └─ HTTP IP（当前 47.94.102.182 形态）                         │
└──────────────────────────────────────┬──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ECS（单机或集群；当前单机）                                    │
│  ├─ systemd                                                  │
│  │   • aistareco-server         :8080  (Spring Boot)         │
│  │   • aistareco-web            :3002                        │
│  │   • aistareco-admin          :3003                        │
│  │   • aistareco-web-music      :3010                        │
│  │   • aistareco-web-drama      :3011                        │
│  │   • aistareco-web-celebrity  :3012                        │
│  └─ Docker                                                   │
│      • aistareco-sau-service    :8090  (FastAPI + Playwright)│
└──────────────────────────────────────┬──────────────────────┘
                                       │ VPC 内网
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│  阿里云托管服务                                                 │
│  • RDS MySQL 8.0   ← rm-xxx.mysql.rds.aliyuncs.com:3306      │
│  • OSS Bucket      ← aistareco-prod (内网 endpoint)           │
│  • CDN 域名         ← cdn.aistar.com → 回源 OSS                │
│  • Redis（Phase 5+）← r-xxx.redis.rds.aliyuncs.com:6379       │
│  • KMS / Secret Manager（推荐）← 取代 server.env 明文密钥       │
│  • ACR              ← registry-vpc.cn-xxx.aliyuncs.com（容器化后）│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 一次性环境拉起

> **前置**：阿里云账号已开通 ECS / RDS / OSS，VPC 内网已通。

```bash
# 1. 在 RDS 控制台创建 MySQL 8.0 实例，记录 endpoint / port
# 2. 在 OSS 控制台创建 bucket aistareco-prod，记录内/外网 endpoint
# 3. 在 RAM 创建子用户 + access key（按 oss/ram-policy.json 绑权限）
# 4. （可选）阿里云 CDN 绑域名 cdn.aistar.com → 回源 OSS

# === ECS 准备 ===
ssh root@<ECS_IP>

# Java 17 + nginx + docker
yum install -y java-17-openjdk-headless nginx rsync
systemctl enable --now nginx docker

# nvm + node 24（用于 next standalone runtime）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 24

# 拉仓库
mkdir -p /opt/ai-star-eco
git clone https://github.com/pokocat/aisingerecosystemcopy.git /opt/ai-star-eco/repo
cd /opt/ai-star-eco/repo

# === 配置文件落位 ===
mkdir -p /etc/aistareco
cp infra/env/server.env.example      /etc/aistareco/server.env
cp infra/env/sau-service.env.example /etc/aistareco/sau-service.env
# 编辑这两个文件，把 <PLACEHOLDER> 替换为真实值（RDS endpoint / OSS AK / JWT secret 等）
vim /etc/aistareco/server.env

cp infra/nginx/ai.conf.example /etc/nginx/conf.d/ai.conf
# 编辑：替换 server_name 为你的 IP 或域名
vim /etc/nginx/conf.d/ai.conf
nginx -t && systemctl reload nginx

cp infra/systemd/aistareco-server.service.example       /etc/systemd/system/aistareco-server.service
cp infra/systemd/aistareco-web.service.example          /etc/systemd/system/aistareco-web.service
cp infra/systemd/aistareco-admin.service.example        /etc/systemd/system/aistareco-admin.service
cp infra/systemd/aistareco-web-celebrity.service.example /etc/systemd/system/aistareco-web-celebrity.service
systemctl daemon-reload

# === RDS 建库 ===
# 用 RDS 控制台先创主账号 / 把 ECS 内网 IP 加白名单
mysql -h <RDS_HOST> -u <RDS_ROOT> -p < infra/rds/00_create_database.sql
mysql -h <RDS_HOST> -u <RDS_ROOT> -p < infra/rds/01_create_app_user.sql
# 现网迁移：见 scripts/migrate-db.sh

# === 部署应用（本地 build → rsync → 重启）===
# 在本机 dev 上执行：
./infra/scripts/deploy.sh server <git-sha>
./infra/scripts/deploy.sh web    <git-sha>
./infra/scripts/deploy.sh admin  <git-sha>
./infra/scripts/deploy.sh web-celebrity <git-sha>
./infra/scripts/deploy.sh sau-service   <git-sha>

# === 验证 ===
./infra/scripts/verify.sh
```

---

## 4. 与 DEPLOYMENT.md 的关系

[`DEPLOYMENT.md`](../DEPLOYMENT.md)（仓库根）记录的是**当前生产**（47.94.102.182）的部署形态，
属于历史档案，新机器请直接按本目录的模板执行。两份内容会逐步收敛到本目录。

老的 `.claude/skills/aliyun-deploy/SKILL.md` 描述的是「快速增量重发布」流程，仍可用；
本目录补的是「从零拉起 + 切 RDS/OSS」的能力。

---

## 5. Phase 路线图（与 AGENTS.md v0.34 节同步）

| Phase | 状态 | 范围 |
|---|---|---|
| **0** 基础设施版本化 | ✅ 本次 | `infra/` 目录骨架（本 README） |
| **1** 生产硬伤修复 | ✅ 本次 | Flyway 接入 + DataInitializer gate + 密钥 fail-fast |
| **2** RDS / OSS 真切 | ✅ 本次 | 配置模板 + 迁移脚本（执行时机由用户决定） |
| **3** 全栈容器化 + CI/CD | ⏳ 待 | 给所有 app 加 Dockerfile + GitHub Actions |
| **4** 用户上传素材 OSS 化 | ⏳ 待 | MixcutAsset 上传走 CdnUploader |
| **5** 多实例就绪 | ⏳ 待 | Redis（SmsCodeService）+ ShedLock + cookie SSO |

---

## 6. 常见问题

**Q: `infra/env/*.example` 已经够全了吗？**
A: 是的，**所有**生产可配的环境变量都在模板里有占位 + 注释。新增 env 变量必须同步更新模板，否则 `infra/scripts/verify.sh` 会报缺失。

**Q: nginx / systemd 模板能直接 cp 用吗？**
A: 模板里 `<PLACEHOLDER>` 形式的占位符必须手工替换（IP / 域名 / 路径）；其余结构直接生效。

**Q: 我要从老的 47.94.102.182 平滑迁过来，怎么办？**
A: 看 [MIGRATION.md](MIGRATION.md) §3「灰度迁移路径」。
