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

- **加速域名**：`cdn.aistar.com`
- **业务类型**：视频点播加速
- **回源**：OSS bucket（私有 bucket 需开「OSS Private Bucket 回源」）
- **加速区域**：中国内地（如需海外另起 `cdn-intl.aistar.com`）
- **HTTPS**：必开（用阿里云免费 SSL 或上传自己的）

DNS 解析：把 `cdn.aistar.com` CNAME 到阿里云分配的 `.kunlunca.com` 域名。

最终在 `server.env` 配：
```
AEP_CDN_OSS_BASE_URL=https://cdn.aistar.com
AEP_CDN_PUBLIC_BASE_URL=https://cdn.aistar.com
```

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
# [cdn] AliyunOssCdnUploader bucket=aistareco-prod endpoint=oss-cn-... publicBase=https://cdn.aistar.com keyPrefix=mixcut
# [cdn] uploaded oss key=mixcut/<jobId>/v0.mp4 bytes=... url=https://cdn.aistar.com/mixcut/...

# 浏览器打 https://cdn.aistar.com/mixcut/<jobId>/v0.mp4，应该 200 视频流
```

## 9. 现网静态文件迁移（cdn-mock / showreel videos → OSS）

见 `infra/scripts/migrate-cdn.sh`。
