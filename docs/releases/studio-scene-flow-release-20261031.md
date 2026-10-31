# 场景页创作流程：server + web-aiavatar + studio-admin 发布

2026-10-31，Asia/Shanghai。用户确认「绿了就合入」后，#142、#143、#144 依次在 CI 全绿后合入 main，随后用户确认「发布这三个」。

## 内容

全部内置图片 / 视频场景的流程改造（方案 [`audits/studio-built-in-creation-flow-plan-2026-10-30.md`](../audits/studio-built-in-creation-flow-plan-2026-10-30.md)，设计真源 [`studio-scene-creation.md`](../studio-scene-creation.md) §15–18）：

- **#142**：AI 图片 / AI 视频的创作条件存进草稿（`doc.sceneImageState` / `sceneVideoState`），刷新、再打开原样回来；「重新编辑」放回那一次的条件，可撤销；换场景只带同名素材位；模型做不到的比例 / 张数 / 时长写明按什么出。
- **#143**：编导只给会交给视频模型的图编号、看不到图就照实说；脚本写成 H3 认的「第N镜（0–2 秒）……旁白说：「……」」；21 个视频场景加 `brief`（要做到什么、要用户给的信息、结尾、能不能编），缺必填信息写「还缺」和【待补】、有【待补】不让出片；「写清楚」小标签；用户写的数字没进脚本就提醒；后台场景模板可编辑 brief。
- **#144**：出的图「当参考图」「做成视频」；改图类场景原图放在结果前面；结果和素材地址过期自动换签；交给创作助手后结果区显示制作进度。
- 同包带上 main 上另一个会话已合入未发布的 `b9531ab2e`（会员页 / 企业页「模型赠款」卡片按钮改用品牌样式）。

无数据库迁移。接口改动都是加法（`StudioSceneComposeRequest` 加 `seenTitles` / `characterSeen` / `visual`，`StudioVideoScene` 加 `brief`）。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 正式构建 | main `fe4a654ceb6aeae09478df2df3ede8f64619475b`，仓外干净工作区 `../AIStarEcosystem-release-scene-flow`（`git worktree add --detach origin/main`）构建 |
| CI | #142 / #143 / #144 合入前各 8 项全过（#143 第一次 `frontend-tests` 挂在 `studio-template-source.test.tsx` 的时序问题上，查明是测试的通知根先于组件解除「提交中」渲染，修测试后重跑通过，见 #143 最后一个提交） |
| 发布包 | `20261031-studio-scene-flow`（server + web-aiavatar）；studio-admin `20261031-studio-admin-scene-brief` |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭（与上一版一致，`manifest.env` 已核对） |
| server JAR SHA256 | `3821358bdbb41432894cd6fe5638149c6ccadb3dc44b44307de34c633e384bd1`，线上与本地一致 |
| web-aiavatar tar SHA256 | `82ca8e1f6cd856bc724de15b8561988c601b96390c60368043d72342650ca35a`；BUILD_ID `Hbvy3TmnJPTjcfV2Drdrh`（线上一致） |
| studio-admin tar SHA256 | `815f78c579d0dcf750f65fe6412a59d31a3f48776529bda3d12a9af9f12451d9`（构建脚本内 typecheck 与 12 条测试通过） |
| 服务启动 | server 10:16:17 重启、10:16:36 启动完成（19.0 秒）；web-aiavatar 10:16:18；studio-admin 10:17:12。三个服务 NRestarts=0 |
| 数据库 | 无新迁移；Flyway 校验 72 个迁移，`No migration necessary` |
| env-check / verify | 均 ALL GREEN |
| 发布前在途 | `ip_run` running 0、`material_video_job` 未结束 0、`ip_plan_execution` running 0、待支付充值订单 0 |

## 线上核对

- 线上 `/video` 页面引用的 chunk 就是本次构建的 `page-1787620316ce3a24.js`，含「写清楚」「还有没填的」「让编导照现在的改一版」。
- `aep_platform_configs` 里没有 `studio.scene-catalog` 行：线上用随包场景目录，21 个视频场景的 brief 直接生效（JAR 内 `scenes.json` 含 21 个 `brief`）。
- `/admin/login`、`/admin/scenes`、`/video`、`/image`、`/api/v1/ip-studio/scenes/home` 200；`/api/v1/ip-studio/scenes`、`/api/admin/studio/scenes` 未登录 401。
- server 重启后 ERROR 0 条（同一 grep 近 24 小时命中 43 条，确认能匹配）。

**没有在线上账号里走一遍登录后的流程**（没有用别人的账号操作），也没有触发线上任何付费生成。登录后的行为以本地真后端 + Agnes 免费模型的验收为准（见 `studio-scene-creation.md` §17 末条与 #143 / #144 说明）。

## 重启窗口

nginx 访问日志 10:15–10:18：200 共 29 个、302 1 个、502 6 个。6 个 502 全是部署脚本从发布机出口探测的 `GET /api/config`（10:16:19–10:16:34），没有用户请求失败。不声称零中断。

## 回滚

server 与 web-aiavatar 的上一版 `20261030-studio-wechat-pay` 还在生产机 `/opt/ai-star-eco/releases/` 下，取回后用原脚本部署：

```bash
rsync -a -e "ssh -i /Users/donis/dev/aliyun/aiartist.pem" ecs-user@47.98.162.120:/opt/ai-star-eco/releases/20261030-studio-wechat-pay/ dist/deploy/20261030-studio-wechat-pay/
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/20261030-studio-wechat-pay server,web-aiavatar
```

studio-admin 发布脚本不保留旧目录；回到上一版要从 main `0cf885c55` 重新跑 `build-studio-admin-release.sh` 再 `deploy-studio-admin-release.sh`。新加的 brief 是可选字段，旧后台保存目录时会丢掉 brief，回滚后台期间不要在「场景模板」里保存。

## 没有做的

- 成片层付费验收（团购、品牌故事、数字人口播、换脸各一条）需另批预算；本地 Agnes 视频一直「队列已满」，没出过成片。
- 生产库里运营发布的 3 个配方模板（工厂首播反转、原声视频复刻·换人、末日英雄 IP）没走查。
- 还没有草稿时（第一次生成 / 上传之前）刷新会丢输入。
