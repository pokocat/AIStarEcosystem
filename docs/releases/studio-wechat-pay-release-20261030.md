# 微信扫码充值：server + admin + web-aiavatar 发布

2026-10-30，Asia/Shanghai。用户确认「合进 main」后又确认「现在发布」。

## 内容

Studio「会员与积分」的充值改成收银台弹窗：按服务端列出的真实渠道选择支付方式，微信显示扫码二维码，支付宝进入收银台；关掉弹窗不取消订单，刷新可恢复，到账以服务端 `paid` 为准。服务端补齐微信公钥模式、下单结果不明时保留原订单、查单与通知核对商户 / AppID / 金额 / 交易号、关单先关微信侧订单。后台支付配置可填微信支付公钥 ID 与公钥 PEM。合入 main 的提交 `ad1075609`，详见提交说明与 [接入手册](../runbooks/studio-wechat-ai-pilot.md)。

**微信渠道在线上还没有启用**：生产 `aep_payment_channels` 只有 `alipay` 一行。要用上微信，先在军师商户后台开通 Native 支付（今天探测返回 `403 NO_AUTH`）并申请微信支付公钥，再到后台「支付配置」填写、启用。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 正式构建 | main `ad10756096419e5846e2a6c6b4987e621a41c5ff`，仓外干净工作区 `../AIStarEcosystem-wechat-pay` 构建 |
| 发布包 | `20261030-studio-wechat-pay`，服务 `server admin web-aiavatar` |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（与上一版一致） |
| server JAR SHA256 | `55b5658bb1a55bc5d9ece282a9a5576d83863ec0804c2b0ea2926553374bb93a`，线上与本地一致；运行中的 JAR 含新错误码 `PAYMENT_ORDER_CHANNEL_LOCKED` |
| 服务启动 | server 21:34:04 重启、21:34:23 启动完成（17.6 秒）；admin 21:34:05、web-aiavatar 21:34:07 启动；三个服务 NRestarts=0 |
| 数据库 | 无新迁移；Flyway 校验 72 个迁移，`No migration necessary` |
| env-check / verify | 均 ALL GREEN |
| 发布前在途 | `ip_run` running 0、`material_video_job` 未结束 0、待支付充值订单 0 |
| 前端产物 | 线上 web-aiavatar 收银台 chunk、admin 公钥字段 chunk 均可取到且含新文案 |
| CI | main `ad1075609` 手动触发 run 41061263874：backend、frontend-tests 与六个应用的构建 + 浏览器检查全部通过 |

## 对现有支付宝的影响

- 点「立即充值」先弹出收银台选择支付方式，再跳转支付宝收银台，比原来多一步。
- 查单补单多核对金额与交易号（支付宝查单本来返回金额，不受影响）；对账不再跳过超过 30 分钟仍待支付的订单（这类订单正常会先被超时关单）。
- 发布后没有做真实付款。

## 重启窗口

nginx 访问日志：21:34:06 至 21:34:20 共 11 个 502，全是 GET，全部来自发布机所在出口 IP：5 个是部署脚本探测 `/api/config`，6 个是同一出口上已打开的一个 Studio 对话页（对话快照、事件流、钱包），21:34:25 起恢复 200。没有其他用户的请求失败，没有写请求失败。新进程启动后 ERROR 为 0；窗口内唯一一条 ERROR 来自旧进程关停（响应已提交，无法渲染错误页），与上次发布相同。

## 回滚

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh ../AIStarEcosystem-fix-image-size/dist/deploy/20261030-studio-image-size-deliver server

DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh ../AIStarEcosystem-release-scene-home/dist/deploy/20261030-studio-feed-columns web-aiavatar
```

admin 的上一版 `20261027-video-prompt-binding` 本机没有构建目录，发布包留在生产机 `/opt/ai-star-eco/releases/20261027-video-prompt-binding/`（含 `admin.tar.gz`），需要时从那里取回再用 `deploy-release.sh` 发布。本次没有迁移，回滚不涉及数据库；回滚 server 后已建的微信订单字段与状态都兼容旧版本。
