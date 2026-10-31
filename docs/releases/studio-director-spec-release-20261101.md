# AI 编导带上素材和时长、选择框收尾：web-aiavatar 发布

2026-11-01，Asia/Shanghai。用户确认「提交合并到 main，然后直接发布，等远端 CI 跑完有问题再修」：#147 没等 CI 就快进合入 main，从 main 只发 web-aiavatar。

## 内容

- **AI 编导页**：输入框里能看到、加、删已选素材（和编辑页同一份），下面是和编辑页同一个规格胶囊（语言 · 时长 · 比例）。最新一版脚本和现在的设置对不上时，不写字直接发送就让编导照现在的设置改一版；写了修改意见再发，设置的变化一起交给编导。超过单段上限的长片按整段时长写。
- **资产选择框**：声音一行一条（原来电脑版被图片网格的 150px 列宽压窄）；读不到的音频就地说明，不再每条弹错误框；确认按钮统一叫「使用」。
- **全站 antd 默认主题**（`src/shell/antd-theme.tsx`）：主按钮深墨 #202c42 白字、不能点的浅灰底灰字、两字按钮不加空格；`ip-brand.css` 的 `color: inherit` / 半透明不再作用到 antd 按钮。
- 同包带上 main 上另一个会话已合入、未发布的 `9cd423073`（账号默认头像与「修改头像」入口）。只改前端：头像读 `/api/me.avatarUrl`（没有就用按 UID 生成的默认头像），修改在账号中心已有的 `/account/profile` 完成，不依赖新的服务端接口。

服务端不发：`git diff 9902d4f63 6927fc59b -- apps/server specs/openapi.yaml` 为空，线上 server（`20261031-studio-redesign`）不用动。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 正式构建 | main `6927fc59b60cd441f206007788968671a7ee1b02`，仓外干净工作区 `../AIStarEcosystem-release-studio-redesign`（detached 在该提交）构建 |
| CI | #147 合入时 8 项都还在跑（按用户要求不等），结果见文末 |
| 本地门禁 | `tsc --noEmit`；定向 vitest（场景页、选择框、资产页、shell、canvas-bridge）通过；本地真后端 + 无头 Chrome 走过 1440 和 375 |
| 发布包 | `20261101-studio-director-spec`（只有 web-aiavatar），tar SHA256 `f30d86628d3e4cbf65a4a8d7013db943b3a4cb77b256b937960c315ec772879d`（线上一致），BUILD_ID `eNERTzSCQiT5y0FG0YtAV`（线上一致） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭（`manifest.env` 已核对） |
| server | 未重启，仍是 `20261031-studio-redesign`（9902d4f63） |
| 服务启动 | web-aiavatar 00:25:45 重启，NRestarts=0；env-check / verify ALL GREEN |
| 发布前在途 | 00:23:41 `ip_run` 未结束 0、`material_video_job` 未结束 0、`ip_plan_execution` 进行中 0 |

## 线上核对

- `/`、`/video`、`/image`、`/assets`、`/projects`、`/me` 200；`/video` 页面里的 BUILD_ID 是新版。
- 线上样式里有 `.scene-director-input>footer`、`.lmp-voice-icon`、`.signed-audio-missing`、`.lmp-use` 和 `:where(:not(.ant-btn))`；脚本里有「设置改过了，直接发送就照现在的改一版」「读不到这段音频」和主题色 `#202c42`。
- 重启窗口 00:24–00:27 nginx：200 共 171、308 共 82、401 共 2、302 共 1，没有 5xx。

**没有在线上账号里走一遍登录后的流程**，也没有触发付费生成；登录后的行为以本地真后端验收为准（编导页真 Agnes 写脚本、改时长后空发送可用、规格面板在卡片里、选择框声音行 678px、按钮颜色）。

## 回滚

web-aiavatar 上一版是 `20261031-studio-rail-fixes`（`3adff8c59`），在生产机 `/opt/ai-star-eco/releases/` 下：

```bash
rsync -a -e "ssh -i /Users/donis/dev/aliyun/aiartist.pem" ecs-user@47.98.162.120:/opt/ai-star-eco/releases/20261031-studio-rail-fixes/ dist/deploy/20261031-studio-rail-fixes/
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/20261031-studio-rail-fixes web-aiavatar
```

回滚会同时撤掉账号头像那一版（`9cd423073`）。

## CI

（待 #147 的检查跑完后补）
