# 待部署：clip 运营面 + 单价配置化 + 存模板（40a4e979 → 404f8891）

**状态：包已构建，未部署。** 目标机 `47.98.162.120` 2026-09-11 04:0x 起 userspace 卡死
（ICMP 正常、TCP 22/80/443/8080 都能连上，但 sshd banner 不回、HTTP 不响应），
需要先在阿里云 ECS 控制台强制重启。

## 恢复之后跑这条

```bash
cd ~/dev/AIStarEcosystem
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=~/dev/aliyun/aiartist.pem \
  RELEASE_ID=20260911071115-404f8891 \
  ./infra/scripts/deploy-release.sh dist/deploy/20260911071115-404f8891 server
```

包在 `dist/deploy/20260911071115-404f8891/`（app.jar 127MB）。三个提交：

- `40a4e979` `/api/service/clip/admin/**`（service token 鉴权：模板列表 + 上下架 + 供应商总览）
- `62e2ac4e` 六档单价搬进数据库（**含 Flyway V34**，建 `clip_pricing` 单行表，不 seed 初始行）
  + 草稿存成模板
- `404f8891` codex 审出的四条（intValue 截断、回落配置没卡上限会溢出成负数、缓存竞态、
  剥离改白名单 + preset 查库）

**V34 是纯新增一张表，不动任何既有表。** 空表 = 回落 application.yml 的兜底价，
也就是发上去之后定价行为与现在逐字节一致，直到运营在后台按一次保存。

## 发完怎么验

```bash
# 在目标机上，用 clip service token（与军师 BFF 共用的那个）
TOKEN=$(sudo grep -oP '^AEP_CLIP_SERVICE_TOKEN=\K.*' /etc/aistareco/... )   # 路径见部署文档
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "X-External-Owner-Id: junshi-admin-console" \
     -H "X-External-Tenant-Id: junshi" \
     http://127.0.0.1:8080/api/service/clip/admin/templates | head -c 300
```

再到 `https://wxapi.aibuzz.cn/admin/` → 左栏切「爱速拍」→「商品 · 模板货架」和
「经营 · 供应商」，两屏都该出数。**在 AIStar 发上去之前，这两屏会显示 502 错误态**
（这是设计如此：上游挂了如实报错，不吞成「一个模板都没有」）。

军师 BFF 侧（8.136.36.175）已经发到 `3c7f93d`，不用再动。

**在 AIStar 发上去之前，后台这四处会显示 502 错误态**（设计如此：上游挂了如实报错，
不吞成「一个都没有」）：模板货架、供应商、爱速拍定价里的「生成单价」那一段、以及存模板。
克隆定价（军师库里的那四档）不受影响。
