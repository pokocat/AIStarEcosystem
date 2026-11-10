# AI 编导提示词爆款化发布（2026-11-10）

已发布，2026-11-10 09:05（北京时间）。只发 `server`、`web-aiavatar`。

## 内容

- AI 视频页编导（`stage-scene-script`）与长视频分段脚本（`stage-segmented-script`）的提示词按爆款经验重写：新增带货、到店、剧情、品牌、IP 五个方法层，镜头约 4 秒，台词有人设和态度，表演写到手和物件，声音写到配乐起落，禁止项只写画面上看得见的。
- 去掉功效夸大类限制（底座、对话、复刻、写作、导演台带货），价格、地址、销量、获奖仍不凭空写。
- 修复：模型把数字字母写成全角时（线上 11-09 的 terra 脚本 8 篇中 6 篇），H3 改写认不出镜头、网页的台词超量和数字核对提示失效。`H3PromptRewrite` 与 `scene-script-check.ts` 先换回半角。
- 同包带上本地 main 上未推送的 `a0e690e89`（视频页显示所选参考视频和文件名，纯前端）和 origin/main 上 `e978bfce4` 之后的发布记录提交。
- 调优过程与盲评结果见 [`docs/audits/studio-scene-script-viral-tuning-2026-11.md`](../audits/studio-scene-script-viral-tuning-2026-11.md)。

## 发布

- 构建提交：main `cbbfa03022ebc533e4ece999cc5aee6cca89eceb`。仓外干净工作区 `../AIStarEcosystem-scene-script`，Mac mini 队列 `379e6f525a2b` 构建，退出码 0；制品 `20261110-scene-script-cbbfa030`，参数 `NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。
- 发布前：合并后的编译门（web-aiavatar 类型检查、接口契约、服务端编译）Mac mini 队列 `3265e8314749` 退出码 0；分支上相关后端测试 183 个、前端 `scene-script-check` 10 个通过。账号中心 200；线上没有排队或生成中的任务（最近一条 92 分钟前）；`e978bfce4..cbbfa0302` 没有 DTO 或 openapi 改动。无数据库迁移。
- 线上 `ip_skill_version` 发布前没有后台改过的版本，所以仓库文件直接生效：启动时自动换新 `base` v3、`stage-scene-script` v5、`stage-segmented-script` v2、`script-writing` v2、`reference-video-recreation` v5、各视频场景新版本，五个方法层 v1。
- `deploy-release.sh` 自带的 `verify.sh` 全绿。JAR 校验和 `b7efae1efc2cb31d…` 与制品一致；服务 09:05:44 重启、18 秒启动完成，重启后 0 条 ERROR；当小时 11 个 502（重启窗口）。

## 没做

- 没出真实视频对比（付费，需定预算）。
- 发给视频模型时只挑画面相关段落（分层）未做。均已记在 TODO.md「AI 编导爆款化」。

## 回滚

server 和 web-aiavatar 都回生产机 `/opt/ai-star-eco/releases/20261109-account-pages-e978bfce`，可分开回。旧 server 启动时，改过的提示词文件与库里最新的种子版本对不上，会按旧文件自动再换一个新版本，等于退回旧提示词（`StudioSkillStore`，前提是期间没人在后台改过）。新增的五个 `method-*` 条目会留在库里，旧版本的编导同样按场景分组拼 `method-<分组>`，要退干净就在后台把这五条停用。
