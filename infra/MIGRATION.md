# 阿里云 RDS + OSS 迁移 SOP

把当前 47.94.102.182 上的「单 ECS + localhost MariaDB + 本地盘 cdn-mock」架构迁到
「ECS + 阿里云 RDS + 阿里云 OSS + CDN 域名」目标架构的完整 step-by-step。

**预估停机窗口**：15-30 分钟（mysqldump + 推 RDS + 重启）。

---

## 0. 前置准备（不影响线上）

### 0.1 阿里云资源开通

| 资源 | 操作 | 文档 |
|---|---|---|
| **RDS MySQL 8.0** | 控制台创建 → 同 VPC + 同 vSwitch | [`rds/README.md`](rds/README.md) |
| **OSS Bucket** `aistareco-prod` | 同地域 + 私有 + 标准存储 | [`oss/README.md`](oss/README.md) |
| **CDN 域名** `cdn.aistar.com` | 回源 OSS + HTTPS | [`oss/README.md#3-绑-CDN-域名`](oss/README.md#3-绑-cdn-域名) |
| **RAM 子用户** `aistareco-app` | 绑 [`oss/ram-policy.json`](oss/ram-policy.json) | 同上 |

### 0.2 RDS 建库 + 应用账号

```bash
# 在能访问 RDS 内网的机器上（如目标 ECS）
mysql -h <RDS_INTERNAL_HOST> -u <RDS_ROOT> -p < infra/rds/00_create_database.sql

# 编辑 01_create_app_user.sql，替换 <APP_PASSWORD> 和 <VPC_CIDR_OR_PERCENT>
vim infra/rds/01_create_app_user.sql
mysql -h <RDS_INTERNAL_HOST> -u <RDS_ROOT> -p < infra/rds/01_create_app_user.sql
```

### 0.3 server.env 改一份"目标态"草稿（不替换线上）

```bash
cp infra/env/server.env.example /tmp/server-rds.env
vim /tmp/server-rds.env
# 至少填好：
#   DB_URL, DB_USERNAME, DB_PASSWORD          → RDS
#   AEP_CDN_DRIVER=oss
#   AEP_CDN_OSS_ENDPOINT/BUCKET/AK/SECRET/BASE_URL/KEY_PREFIX
#   AEP_JWT_SECRET, AEP_INTERNAL_SECRET, AEP_SECRET_KEY  → 高熵随机（**与现网一致才能解旧加密数据**）
#   AEP_SEED_DEV_DATA_ENABLED=false
```

**❗关键**：`AEP_JWT_SECRET` / `AEP_SECRET_KEY` **必须与现网一致**（不然旧 JWT 失效、AiModelProvider.apiKey 解不开）；
其它如 OSS AK 可以新生成。

---

## 1. 灰度迁移路径 A：**原地切换**（推荐，零数据迁移）

适用于：现网就是单 ECS，迁移过程不换机。

```
┌────────────────────────────────────────────────────────────────┐
│ ECS 47.94.102.182                                              │
│  ├─ MariaDB localhost  ──→  停掉 + 数据迁 RDS                  │
│  ├─ ./cdn-mock/        ──→  ossutil sync 到 OSS                │
│  ├─ ./static/videos/   ──→  ossutil sync 到 OSS                │
│  └─ server.env 改 DB_URL/AEP_CDN_DRIVER=oss → 重启 server     │
└────────────────────────────────────────────────────────────────┘
```

### 1.1 业务停写窗口（公告 + nginx 切只读，可选）

如想严谨：在 nginx 加一段 `return 503` 给写接口（POST/PUT/PATCH/DELETE），仅 GET 透传。
现实工作量小、流量低的话直接停 server 即可。

### 1.2 数据迁移

```bash
# 在本机执行
SOURCE_HOST=root@47.94.102.182 \
SOURCE_DB_USER=aistareco_app SOURCE_DB_PASS='<现网 db pwd>' \
RDS_HOST=rm-xxx.mysql.rds.aliyuncs.com \
RDS_USER=aistareco_root RDS_PASS='<RDS 主账号 pwd>' \
  ./infra/scripts/migrate-db.sh
```

脚本会：
- ssh 到 source 停 `aistareco-server`
- mysqldump → gz dump 文件
- 直接从 source ECS 推到 RDS
- 输出两边关键表的 count 对比

### 1.3 文件迁移

```bash
SOURCE_HOST=root@47.94.102.182 \
OSS_BUCKET=aistareco-prod \
OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com \
OSS_AK_ID=LTAI... OSS_AK_SECRET='<oss ak secret>' \
  ./infra/scripts/migrate-cdn.sh
```

迁移完成后**不删除**本地文件，作为应急回滚（24-48h 观察期后再删）。

### 1.4 应用切换

```bash
# 把目标态 env 推到 ECS
scp /tmp/server-rds.env root@47.94.102.182:/etc/aistareco/server.env

# 重启 server（已被 migrate-db.sh stop 了，这里直接 start）
ssh root@47.94.102.182 'systemctl start aistareco-server'

# 看启动日志（确认 Flyway baseline + 连 RDS 成功 + AliyunOssCdnUploader 注入）
ssh root@47.94.102.182 'journalctl -u aistareco-server -n 200 --no-pager'
```

期望看到这几行：
```
[cdn] AliyunOssCdnUploader bucket=aistareco-prod endpoint=oss-cn-... publicBase=https://cdn.aistar.com keyPrefix=mixcut
HHH000412: Hibernate ORM core version 6.x
Started AiStarEcoApplication in <N> seconds
```

### 1.5 数据库 URL 替换（如果之前文件 URL 已落库为 `/static/videos/`）

```sql
-- 在 RDS 上执行
UPDATE aep_forge_results
   SET video_url = REPLACE(video_url, '/static/videos/', 'https://cdn.aistar.com/forge/videos/')
 WHERE video_url LIKE '/static/videos/%';
```

MixcutRenderOutput.cdnUrl 历史数据**不需要改**，因为 v0.14 上线后已经是绝对 URL。

### 1.6 验证

```bash
./infra/scripts/verify.sh

# 浏览器：
#   /web /admin → 200
#   /api/auth/dev-accounts → 200 或 404（取决于 AEP_DEV_AUTH_ENABLED）
#   https://cdn.aistar.com/forge/videos/showreel-01.mp4 → 200 视频流

# 触发一个真实 mixcut 任务，确认新产出落到 oss://aistareco-prod/mixcut/ 而不是 ./cdn-mock
```

### 1.7 回滚（24h 内）

```bash
# 1) 切回老的 env
scp infra/env/server.env.legacy root@47.94.102.182:/etc/aistareco/server.env
ssh root@47.94.102.182 'systemctl restart aistareco-server'

# 2) 如果数据迁移期间 RDS 收了新数据想保留：
#    停 server → mysqldump RDS → import 回 MariaDB → 启动
#    （但建议直接接受 24h 内的少量数据丢失，避免双源数据同步复杂度）
```

---

## 2. 灰度迁移路径 B：**新 ECS 全新部署**（推荐用于生产正式上线）

适用于：要从老机器迁到新机器（如升级 ECS 规格 + 重建网络）。

```
┌──────────────────────────┐         ┌──────────────────────────┐
│ 老 ECS 47.94.102.182      │  保留   │ 新 ECS <new-ip>           │
│  (作为冷备 24-48h)        │  ──→    │  从 git 一键拉起          │
└──────────────────────────┘         │  连同一 RDS + OSS         │
                                     └──────────────────────────┘
```

步骤：

1. **路径 1 全部跑完**（在老 ECS 上）：数据进 RDS、文件进 OSS
2. **新 ECS 准备**：按 [`README.md` §3「一次性环境拉起」](README.md#3-一次性环境拉起) 操作
3. **应用部署**：
   ```bash
   ECS_HOST=root@<new-ip> ./infra/scripts/deploy.sh all
   ECS_HOST=root@<new-ip> ./infra/scripts/verify.sh
   ```
4. **DNS 切流**（如果有域名）：把 `aistar.com` / `*.aistar.com` A 记录改到新 ECS IP；TTL 提前调小到 60s 方便回退
5. **观察 24h**：新机器跑稳后下线老机器

---

## 3. 常见问题

### Q1: Flyway baseline 报 `Found non-empty schema(s) ... without schema history table`

**原因**：Flyway 首次启动看到 schema 已有表（Hibernate 之前 ddl-auto 建的）但没有 `flyway_schema_history` 表。

**解决**：`application-mysql.yml` 已配 `flyway.baseline-on-migrate: true`，Flyway 会自动建 history 表并标记 V1 已应用。
如果出现这个错说明配置没生效，请检查 `application-mysql.yml`。

### Q2: 启动报 `Could not derive aes key` / `JWT signature does not match`

**原因**：`AEP_SECRET_KEY` 或 `AEP_JWT_SECRET` 与现网不一致 → 历史加密数据解不开。

**解决**：从现网 `/etc/aistareco/server.env` 拿原值；如果原值已丢，做两件事：
1. 重置 `AiModelProvider.apiKey`（admin 后台重填）
2. 强制用户重新登录（旧 JWT 失效，新 JWT 用新密钥签发）

### Q3: server 启动很慢（> 5 分钟）

**原因**：RDS 内网延迟太高 / 表特别多。

**排查**：
- ECS 到 RDS ping `<1ms` 才合格
- `journalctl -u aistareco-server -f` 看 Hibernate 是不是在循环 ALTER TABLE（说明 ddl-auto 还在做大量 schema 变更）
- 如果是 ddl-auto 问题，临时改 `application-mysql.yml` 的 `ddl-auto: none` 启动一次，让 Hibernate 跳过校验

### Q4: OSS 上传 403 `AccessDenied`

**原因**：RAM 子用户权限不对 / Bucket 名拼错。

**排查**：
```bash
# 用 ossutil 验证 RAM 子用户能写
echo test | ossutil cp - oss://aistareco-prod/mixcut/test.txt
```
如果 403 → 检查 `oss/ram-policy.json` 是否绑到该子用户、Resource 行是否含 `aistareco-prod/mixcut/*`。

### Q5: 浏览器拿 OSS 视频 403 `RequestForbidden`

**原因**：Bucket 是私有 + CDN 没开「OSS Private Bucket 回源」。

**解决**：CDN 控制台 → 加速域名 → 回源配置 → 开启「OSS Private Bucket 回源」+ 录入 AK。

---

## 4. 验证完成清单

切完一周后检查（确认稳态）：

- [ ] 老 MariaDB 已 stop + disable + 数据 dump 备份到 OSS
- [ ] `/opt/ai-star-eco/cdn-mock` 和 `/opt/ai-star-eco/static/videos` 已删（节省 ECS 磁盘）
- [ ] OSS 控制台监控正常（每天有上传 / 流量稳定）
- [ ] RDS 控制台 CPU < 30% / 连接数 < 100 / 磁盘增长 < 100MB/天
- [ ] `infra/env/server.env.example` 同步任何新增的 env 变量
- [ ] `DEPLOYMENT.md` 标注「老 47.94.102.182 形态已废弃，参考 infra/MIGRATION.md」
