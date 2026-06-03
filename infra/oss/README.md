# infra/oss/ — 阿里云 OSS 初始化

## 1. 创建 Bucket

OSS 控制台 → 「Bucket 列表」→ 「创建 Bucket」

- **Bucket 名**：`aistareco-prod`（生产）；环境隔离用 `aistareco-staging` / `aistareco-dev`
- **地域**：与 ECS / RDS **同地域**（如华东 1 杭州）
- **存储类型**：标准存储；用 `lifecycle.xml` 自动降级低频 / 归档
- **同城冗余**：建议开（默认存 3 副本同 zone；同城冗余存 3 zone）
- **读写权限**：**私有**（一定不要选公共读，OSS 全公开会被刷流量费）
- **服务端加密**：OSS 完全托管（KMS-Managed）
- **版本控制**：起步可不开（节省 50% 空间），重要数据后续可开

## 2. 拿 Endpoint

控制台 Bucket → 概览 → 「访问域名」：

- **内网 endpoint**：`oss-cn-hangzhou-internal.aliyuncs.com` —— **server.env 必须用这个**
- **外网 endpoint**：`oss-cn-hangzhou.aliyuncs.com` —— 仅本机调试用
- **Bucket 域名**：`aistareco-prod.oss-cn-hangzhou.aliyuncs.com` —— 浏览器直访（不推荐，用 CDN）

## 3. 绑 CDN 域名（强烈推荐）

阿里云 CDN 控制台 → 「域名管理」→ 「添加域名」：

- **加速域名**：`cdn.aibuzz.cn`
- **业务类型**：视频点播加速
- **回源**：OSS bucket（私有 bucket 需开「OSS Private Bucket 回源」）
- **加速区域**：中国内地（如需海外另起 `cdn-intl.aibuzz.cn`）
- **HTTPS**：必开（用阿里云免费 SSL 或上传自己的）

DNS 解析：把 `cdn.aibuzz.cn` CNAME 到阿里云分配的 `.kunlunca.com` 域名。

最终在 `server.env` 配：
```
AEP_CDN_OSS_BASE_URL=https://cdn.aibuzz.cn
AEP_CDN_PUBLIC_BASE_URL=https://cdn.aibuzz.cn
```

### 3.1 ⚠️ URL 鉴权 / 签名（v0.47+ 必配，防流量盗刷）

**仅 bucket 私有 + CDN 回源 远远不够**。一旦 `https://cdn.aibuzz.cn/mixcut/<jobId>/v0.mp4`
这种公开 URL 泄漏（被爬 / 进缓存 / 域名被扫），任何人都能持续刷流量直到资源消失，
**最坏情况能在一夜之间打出几千块 RMB 的 CDN/OSS 流量账单**。

#### 重要概念澄清 —— CDN URL 鉴权 vs OSS Pre-signed URL 是两套完全独立的体系

| 维度 | CDN URL 鉴权（Type A） | OSS Pre-signed URL |
|---|---|---|
| 签名密钥 | **CDN 控制台的 PrivateKey**（32 位字符串） | **OSS bucket 的 AccessKey ID/Secret**（同上传那对 AK） |
| 配置位置 | 阿里云 CDN 控制台 → 域名管理 → 访问控制 → URL 鉴权 → A 方式 | OSS 控制台 + RAM 子账号管理 |
| 算法 | `md5(URI-timestamp-rand-uid-PrivateKey)` | V4 = HMAC-SHA256（新 SDK 默认） |
| URL 形态 | `?auth_key=<ts>-<rand>-<uid>-<md5>` | `?x-oss-date=...&x-oss-signature=...&x-oss-credential=...` |
| host | CDN 域名（cdn.aibuzz.cn） | OSS endpoint 公网（bucket.oss-cn-hangzhou.aliyuncs.com） |
| 谁验签 | CDN 边缘节点 | OSS server |
| 流量走 | CDN（0.24 元/GB） | OSS 外网（0.5 元/GB） |
| OSS bucket / AK 是否需要 | 仅签 URL 不要；**上传文件依然要 OSS AK** | 签名 + 上传都要 |

**⚠️ 易踩坑**：选 `strategy=cdn` 时**不能**省 `AEP_CDN_OSS_*` 配置 ——
OSS AK 是 server 用来**上传文件**的（一直需要），CDN PrivateKey 是 server 用来**签 URL 给前端**的（仅 strategy=cdn 时用）。
两组配置并存。

server 端在 v0.47 起加了 `CdnUrlSigner`：所有 wire 出去的 CDN URL 都过一遍签名，
URL 自带 expires + 鉴权字段，过期即失效。三种策略：

| strategy | 适用 | 工作机制 | 带宽走 |
|---|---|---|---|
| `none` | dev / 调试 | 不签名，原样输出 | CDN |
| `oss`  | 中小流量 / 临时下载 | OSS SDK `generatePresignedUrl`，URL host = OSS endpoint | OSS 直连（不走 CDN） |
| `cdn`  | 生产视频（推荐） | 阿里云 CDN URL 鉴权 Type A | CDN |

**生产推荐 `cdn` 策略**，因为：
- 流量走 CDN（0.24 元/GB） vs OSS 外网（0.5 元/GB），高带宽节省一半
- 视频走 CDN 节点加速 + 全国低延迟，用户体验更好

**配置步骤**（strategy=cdn）：

1. 阿里云 CDN 控制台 → 域名管理 → 选 `cdn.aibuzz.cn` → **访问控制 → URL 鉴权**
2. 鉴权类型选 **Type A**（**主 KEY + 备 KEY 至少填一个**），**鉴权状态：开启**
3. 「主 KEY」点「自动生成」拿到 32 位字符串 → 复制下来（**这是一个全新的密钥，跟 OSS AK 没有任何关系**）
4. 把密钥填到 ECS 上的 `/etc/aistareco/server.env`：
   ```bash
   # ── A. OSS 上传 + 落点（任何 driver=oss 都必需，跟签名策略无关） ──
   AEP_CDN_DRIVER=oss
   AEP_CDN_OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com
   AEP_CDN_OSS_BUCKET=aistareco-prod
   AEP_CDN_OSS_ACCESS_KEY_ID=LTAI5tXXX                # OSS RAM 子账号 AK
   AEP_CDN_OSS_ACCESS_KEY_SECRET=XXX
   AEP_CDN_OSS_BASE_URL=https://cdn.aibuzz.cn          # 出 wire 用 CDN 域名
   AEP_CDN_OSS_KEY_PREFIX=media

   # ── B. URL 签名（独立配置；strategy=cdn 时密钥来源完全不同） ──
   AEP_CDN_SIGNED_URL_STRATEGY=cdn
   AEP_CDN_SIGNED_URL_TTL_SECONDS=3600     # URL 有效 1h
   AEP_CDN_SIGNED_URL_CDN_AUTH_KEY=<上面步骤 3 拿到的 32 位 PrivateKey>
   ```
5. `sudo systemctl restart aistareco-server`

**配置完后验证**：

```bash
# 拉一个混剪任务 JSON，检查 outputs[*].cdn_url 是否带 ?auth_key=…
curl -H "Authorization: Bearer <jwt>" https://api.aibuzz.cn/api/me/mixcut/jobs | jq '.data[0].outputs[0].cdn_url'
# 应该看到形如：https://cdn.aibuzz.cn/media/mixcut/abc/v0.mp4?auth_key=1700000000-xxxx-0-md5sum

# 直接 GET 应当 200；改 / 删 auth_key 后再 GET 应当 403
curl -I "<上面输出的 URL>"
curl -I "<上面输出的 URL 把 auth_key 改掉一位>"   # 期待 403
```

**注意事项**：
- TTL 不要短于 H5 视频播放时长。3600s（1h）够用；如有 4K 长视频可调到 14400（4h）。
- 备用密钥：阿里云支持「主 KEY + 备 KEY」热切，但本仓只读 server.env 一份；
  轮换时先在 CDN 控制台把备 KEY 设为新值 → 改主 KEY → server.env 同步 → 重启。
- `none` 策略仅 dev 用；生产任何 driver=oss 的环境默认配 `cdn`。
- 老 URL 兼容：DB 里仍存原始 CDN URL（不含签名），signer 在 DTO 出 wire 前实时签。
  老前端缓存的 URL 在过期前仍可访问，过期后用户刷新会拿到新签名 URL，无感知切换。
- 选 `strategy=oss`（非推荐路径）时：URL 用 OSS V1/V4 签名格式，host = OSS endpoint（绕 CDN）。
  OSS V4 签名 URL 最长 TTL 7 天（V1 无限制）。要走 CDN 节点 + OSS 签名的组合可以开 SDK
  `setSupportCname(true)` + endpoint 填 CDN 域名，但需 CDN 透传 query 参数 + 不改 host，
  实操复杂；本仓推荐直接用 strategy=cdn。

### 3.2 OSS / CDN 切换迁移 SOP（v0.47F+）

> **典型场景**：换 bucket / 跨地域迁 / 换 CDN 域名 / 换 AK / 上下游厂商切换。
>
> **前置**：v0.47F 起 DB 真值是 `cdn_key`（OSS object key），URL 是 DTO 出 wire 时
> 由 `CdnUrlSigner.signKey(cdnKey)` 实时派生 + 签名。所以**只要新 OSS 上对象的 key 与
> 老 OSS 完全一致**，切完配置 server 出 wire 的 URL 自动指向新 OSS / 新 CDN 域名。
>
> 详见 [`AGENTS.md`](../../AGENTS.md) §4.7「资产存储默认 OSS」硬规则。

#### 完全无缝的 4 条切换（只改配置 + 重启）

| 切换 | 改的 env | DB 改动 | 用户感知 |
|---|---|---|---|
| 同地域换 bucket | `AEP_CDN_OSS_BUCKET` | 0 | 0 |
| 跨地域迁 bucket | `BUCKET` + `ENDPOINT` + `REGION` | 0 | 0 |
| 换 CDN 域名 | `BASE_URL` + `CDN_AUTH_KEY` | 0 | 重启后新签名 URL 走新域名 |
| 同时换以上 + AK | 上面所有 + `ACCESS_KEY_ID/SECRET` | 0 | 0 |

#### 完整迁移流程

**步骤 1**：批量复制 OSS 对象（保持 key 完全一致）

```bash
# 阿里云推荐 ossutil sync（增量；幂等；支持 --update 仅同步 mtime 新的）
ossutil sync \
  oss://aistareco-prod-old/media/ \
  oss://aistareco-prod-new/media/ \
  --recursive --update

# 校验对象数一致
ossutil ls -s oss://aistareco-prod-old/ | tail -1
ossutil ls -s oss://aistareco-prod-new/ | tail -1

# 抽样几个对象确认可访问 + size 一致
ossutil stat oss://aistareco-prod-new/media/mixcut/jobs/abc/v0.mp4
```

**步骤 2（可选）**：新 CDN 域名准备（仅换 CDN 时）

阿里云 CDN 控制台：

1. 加速域名 `cdn-v2.aibuzz.cn` → 添加 → 备案
2. 回源 OSS bucket（开「OSS Private Bucket 回源」）→ 选新 bucket
3. HTTPS 证书 → 上传或申请阿里云免费证书
4. **访问控制 → URL 鉴权 → A 方式** → 鉴权开关「开启」→ 主 KEY 「自动生成」→ 复制下来
5. DNS：CNAME `cdn-v2.aibuzz.cn` → 阿里云分配的 `.kunlunca.com`

**步骤 3**：维护窗口切换 `server.env`

```bash
ssh root@<ECS_HOST>
vim /etc/aistareco/server.env

# 必改（任何换 bucket 场景）
AEP_CDN_OSS_BUCKET=aistareco-prod-new

# 跨地域时同步改
AEP_CDN_OSS_ENDPOINT=oss-cn-beijing-internal.aliyuncs.com
AEP_CDN_OSS_REGION=cn-beijing                  # V4 签名必填

# 换 AK 时（新 RAM 子账号最小权限按 ram-policy.json）
AEP_CDN_OSS_ACCESS_KEY_ID=<新 AK>
AEP_CDN_OSS_ACCESS_KEY_SECRET=<新 SK>

# 换 CDN 域名时（步骤 2 拿到的）
AEP_CDN_OSS_BASE_URL=https://cdn-v2.aibuzz.cn
AEP_CDN_SIGNED_URL_CDN_AUTH_KEY=<步骤 2.4 拿到的主 KEY>

sudo systemctl restart aistareco-server
```

**步骤 4**：验证

```bash
# 启动日志看到新配置
journalctl -u aistareco-server -n 30 | grep AliyunOssCdnUploader
# 期望: bucket=aistareco-prod-new endpoint=oss-cn-beijing-internal.aliyuncs.com
#       region=cn-beijing publicBase=https://cdn-v2.aibuzz.cn signVersion=V4 signStrategy=CDN

# 拉一个混剪任务，检查 cdn_url 是新域名 + 带签名
curl -H "Authorization: Bearer <jwt>" https://api.aibuzz.cn/api/me/mixcut/jobs \
  | jq '.data[0].outputs[0].cdn_url'
# 期望: https://cdn-v2.aibuzz.cn/media/mixcut/jobs/abc/v0.mp4?auth_key=<ts>-<rand>-0-<md5>

# 浏览器/curl 访问该 URL 应 200，去掉 auth_key 应 403
curl -I "<上一行输出的 URL>"
```

**步骤 5**：观察期后下老 OSS

- 老 bucket 保留 **7～14 天** 应急回滚 + 兜底访问
- 监控 CDN 老域名 + 老 bucket 访问日志，归零后再 ossutil rm 老 bucket
- 删 OSS bucket 前一定记得**先解绑 RAM 子账号 + 删除老 CDN 域名**

#### ⚠️ 3 个会翻车的边界 case

**case 1：v0.47F 之前的老数据 `cdn_key` 字段为空**

这些 row 出 wire 时 DTO 走 `signer.maybeSign(cdn_url)` fallback —— `cdn_url` 还是
老 CDN 域名字符串，新 driver 的 base-url 不匹配 → 原样返回老 URL → 404。

**修法**：迁移前跑一次性 SQL 回填 `cdn_key`（从 `cdn_url` 抽 path）：

```sql
-- 跑在切换 server.env 之前；幂等（只补 cdn_key IS NULL 的 row）
UPDATE aep_mixcut_render_outputs
SET cdn_key = REGEXP_REPLACE(cdn_url, '^https?://[^/]+/', '')
WHERE cdn_key IS NULL
  AND cdn_url IS NOT NULL
  AND cdn_url REGEXP '^https?://';

-- 类似的有 cdn_thumbnail_url（缩略图）；后续待补字段同理
```

**case 2：新 OSS 改了 `AEP_CDN_OSS_KEY_PREFIX`**

老 row `cdn_key="media/mixcut/..."`，新 prefix=`prod`，老 row 出 wire 时
`objectKeyFor()` 看到不带 `prod/` 前缀 → 又加上 → `prod/media/mixcut/...` → 404。

**修法二选一**：

- **首选**：迁移时**保留原 key-prefix**，不改 `AEP_CDN_OSS_KEY_PREFIX`
- **不得不改**：SQL 替换老 cdnKey 前缀：
  ```sql
  UPDATE aep_mixcut_render_outputs
  SET cdn_key = REPLACE(cdn_key, 'media/', 'prod/')
  WHERE cdn_key LIKE 'media/%';
  -- 同步 cdn_url 字段（兼容兜底）
  UPDATE aep_mixcut_render_outputs
  SET cdn_url = REPLACE(cdn_url, '/media/', '/prod/')
  WHERE cdn_url LIKE '%/media/%';
  ```

**case 3：跨厂商迁移（阿里云 OSS → 腾讯云 COS / AWS S3）**

`AliyunOssCdnUploader` 是阿里云专用实现（V4 签名 + CDN Type A 鉴权）。换厂商需要：

1. 新增 `TencentCosCdnUploader` / `AwsS3CdnUploader` 实现 `CdnUploader` 接口
2. `application.yml` 加 `AEP_CDN_DRIVER=cos|s3` 分支
3. 服务商各自的 RAM / 签名 / CDN 鉴权算法（COS 用 STS / S3 用 SigV4 / CloudFront 用 OAI）

这是大工程（每个签名算法重做一遍），**不在「换 bucket」无缝范畴**。需要先在 v0.48+
开新 driver 实现，灰度跑通后再切换。

#### 演练建议

正式切之前在**测试环境**完整跑一遍：

1. 把生产 RDS dump 一份到测试 RDS（带 `aep_mixcut_render_outputs` 等表）
2. 把生产 OSS sync 到测试 bucket
3. 测试 server 改 env 切到测试 bucket + 测试 CDN 域名
4. 验证 §步骤 4
5. 对照生产数据量评估 ossutil sync 完整耗时（大批量 TB 级可能要数小时）

---

## 4. RAM 子用户 + 权限

控制台 → 访问控制 RAM → 「用户」→ 「创建用户」：

- **登录名**：`aistareco-app`
- **访问方式**：编程访问（OpenAPI / SDK）→ 拿到 AccessKey ID + Secret

控制台 → RAM → 「权限策略」→ 「创建策略」→ 「脚本编辑」：
- 粘贴 `ram-policy.json` 内容（先替换 `aistareco-prod` 为你的 bucket 名）
- 命名 `AistarecoOssMixcutWrite`

回到子用户「权限管理」→ 「添加权限」→ 附加自定义策略 `AistarecoOssMixcutWrite`。

**绝对不要**给子用户绑 `AliyunOSSFullAccess`（默认策略），那会让 AK 一旦泄漏可删除整个账号下所有 bucket。

## 5. CORS 规则（可选）

控制台 Bucket → 数据安全 → 跨域设置 → XML 模板编辑，粘贴 `cors-config.json`。

当前架构是 server 上传 + 浏览器只读 CDN，CORS 主要给 `<video>` 标签预读元数据用。
后续若做前端直传，要在 CORS 加 PUT/POST 方法。

## 6. 生命周期规则

控制台 Bucket → 基础设置 → 生命周期 → XML 模板编辑，粘贴 `lifecycle.xml`。

规则语义与 server 端的 `MixcutOutputCleanupScheduler` 保持一致（30 天）。

## 7. 监控告警

控制台 OSS → 监控 → 告警规则：
- 存储用量超 50GB（提醒备份策略生效）
- 流量超 100GB / 月（避免被刷）
- 每秒请求数 QPS > 1000

## 8. 验证 OSS 切换

部署完 server 后跑：

```bash
# 在 ECS 上
curl -s http://127.0.0.1:8080/api/auth/dev-accounts
# 上传一个测试 mixcut 任务（前端走流程），然后看后端日志：
journalctl -u aistareco-server -n 100 | grep '\[cdn\]'
# 期望看到：
# [cdn] AliyunOssCdnUploader bucket=aistareco-prod endpoint=oss-cn-... publicBase=https://cdn.aibuzz.cn keyPrefix=mixcut
# [cdn] uploaded oss key=mixcut/<jobId>/v0.mp4 bytes=... url=https://cdn.aibuzz.cn/mixcut/...

# 浏览器打 https://cdn.aibuzz.cn/mixcut/<jobId>/v0.mp4，应该 200 视频流
```
