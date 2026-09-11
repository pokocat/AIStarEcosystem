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

## 界面在哪

爱速拍有自己的运营台：**https://wxapi.aibuzz.cn/quickreel/**（源码 `ai-pilot/quickreel-console/`）。
四屏：出片对账 / 模板货架 / 定价 / 供应商。六档单价和「把草稿存成模板」都在里面。

它与军师运营后台（`/admin/`）是两个前端、两个 URL。9/11 早上试过并入军师后台，当天撤了 ——
军师 30 屏，爱速拍四屏混进去谁也找不着。

共用账号中心：用运营后台同一个账号登录，但要有 **quickreel 产品授权**才进得来
（授权在军师后台「经营 · 产品」里发；超管隐式拥有）。

⚠️ 用「把草稿存成模板」之前，那个后台账号要先在军师后台「运营账户」里绑好 `linkedUserId`
—— 后台账号和小程序账号是两套体系，服务端只认这一列、不看请求体，所以存不了别人的草稿。
