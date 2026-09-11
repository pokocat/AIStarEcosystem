# clip 运营面 + 单价配置化 + 存模板 —— 已部署

**状态：已上线并验过。** 2026-09-11 21:xx，`20260911133547-8734c100`。

上一版 `20260911071115-404f8891` 曾因目标机 userspace 卡死（ICMP 正常、TCP 能连、
sshd banner 不回）卡了一天，经控制台强制重启后恢复，两版先后发上去。

## 线上现状

| 项 | 值 |
|---|---|
| release | `20260911133547-8734c100` |
| Flyway | V35（V34 `clip_pricing` 建表、V35 模板出处两列） |
| `clip_pricing` | **0 行** = 运营未核定，回落 `application.yml` 兜底价 |
| `clip_template` | 3 条官方模板，`source_project_id` / `created_by` 均为 NULL（V35 之前直接写库建的） |

发布前对生产库做过一次全量备份：目标机 `/tmp/aistareco-preV34-20260911T213202.sql.gz`（707K）。

## 验过的

```
GET /admin/video/generation-pricing  →  六档齐全，configured:false（空表回落配置，符合设计）
GET /admin/video/templates           →  3 条官方模板
GET /video/templates、/video/pricing →  401（路由在、要登录）
https://id.aibuzz.cn/.well-known/openid-configuration → 200
deploy-release 自带的 verify：ALL GREEN（含 8 个 web-* 与 sau-service）
```

## 两件还没做的

1. **六档单价后台改不了。** 表建好了、读路径通了（空表回落配置），但写入口所在的
   那四屏运营面 2026-09-11 从军师后台撤掉了 —— 爱速拍要单独做自己的运营控制台。
   服务端 `PUT /admin/video/generation-pricing` 保留可用，等那套控制台接。
2. **存模板同理**：`POST /admin/video/templates/from-project` 在，没有界面调它。
   调它之前，执行存模板的后台账号要先在军师后台「运营账户」里绑好 `linkedUserId`
   （后台账号和小程序账号是两套体系，服务端只认这一列，不看请求体）。
