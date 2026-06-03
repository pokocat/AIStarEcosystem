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
2. 鉴权类型选 **Type A**，**鉴权状态：开启**
3. 「主 KEY」点「自动生成」拿到 32 位密钥 → 复制下来
4. 把密钥填到 ECS 上的 `/etc/aistareco/server.env`：
   ```bash
   AEP_CDN_SIGNED_URL_STRATEGY=cdn
   AEP_CDN_SIGNED_URL_TTL_SECONDS=3600     # URL 有效 1h
   AEP_CDN_SIGNED_URL_CDN_AUTH_KEY=<32 位主 KEY 明文>
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
