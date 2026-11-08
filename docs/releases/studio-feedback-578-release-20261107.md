# Studio 反馈 5、7、8 修复发布

记录日期：2026-11-07，America/Los_Angeles；生产机时间为 2026-11-08 CST。

- 合并 PR：[#169](https://github.com/pokocat/AIStarEcosystem/pull/169)。构建 main：`1e3aa4bb74a670673ab1d97f77a81d6fe7f3477c`。
- 发布：`20261107-studio-feedback-578-1e3aa4bb7`，只更新 `web-aiavatar`，保留 main 已有功能。后端、数据库及模型配置未变。
- Mac mini 干净主线快照构建，队列 `170ccaa350bf` 退出 0；真实 API、ID 登录、企业开关保持生产配置。正式 `deploy-release.sh` 完成，`verify.sh ALL GREEN`。
- 前端于 2026-11-08 15:08:05 CST 启动，active，NRestarts=0。BUILD_ID：`twZDpAg-ykyiFKrnDus_O`，与制品一致。
- 制品 SHA256：`a84da73660ca471269d4efdf993f2bef5a55f732ad8ebaf49288d6920ba916cb`。本地 `dist/deploy/<发布号>/` 与生产 `/opt/ai-star-eco/releases/<发布号>/` 均保留校验文件及制品。

## 修复与验证

| 反馈 | 修复 | 验证 |
| --- | --- | --- |
| 5 人物选择缺已有 IP / 三视图 | 全部人物合并本人 IP 主形象、历史版本、衍生图，角色卡版本逐张可选，保留准确素材与版本；自建库保持范围，AI 生成空态引导到全部人物 | 线上搜索原先缺失的「潮玩个人IP」，显示主形象和 7 张造型；选中「去掉墨镜。穿芥末黄…」准确带回，刷新仍有角色图。本地三视图夹具验证精确 key，375px 无溢出 |
| 7 团购图片上传引导 | 增加产品图片 / 环境图片，分别说明用途、打开对应标题的现有选择框，共用总张数限制 | 线上两个入口均正确打开，均有上传按钮；集成测试覆盖连续添加及重开草稿，375/1280/1440 宽引导组件预览通过 |
| 8 失败重新编辑丢脚本 | 按任务快照中已采用正文补回脚本节点，避免悬空 scriptId 使恢复逻辑丢弃提示词；手机返回编辑面 | 原录屏与完整组件回归定位采用脚本分支。线上失败任务 `PEX-9caea05b1848414ca167` 重新编辑到独立草稿 `IPP-de820734`，3068 字脚本保留，换为 Fast 并刷新后正文及模型仍保留 |

线上验收未点生成 / 重试 / AI 改写，积分始终为 2078，原任务和原草稿保留。另有素材验收草稿 `IPP-1e59f99a`。以上两个验收草稿未产生模型费用。

原反馈账号的具体三视图未逐张核对；三视图 exact key 使用本地回归验证，线上使用当前账号同类 IP 的独立造型。没有重跑原 Fast 付费任务，也未再次上传文件；上传沿用既有通路，本次新增两处引导。

## 检查与空闲窗口

- 远程队列 `90021a6544a2`：全工作区串行类型检查、后台类型检查、后端离线编译、API 契约、Studio 全量 226 文件 / 1944 项测试全部通过。
- CI 首次暴露既有模板视频测试的异步时序依赖。现显式延迟制作计划回包、等待视频出现；队列 `416f4ec03879` 的 4 项用例和类型检查通过。
- 最终 PR CI [42457068950](https://github.com/pokocat/AIStarEcosystem/actions/runs/42457068950)：两组 Studio 测试、前端构建与浏览器、API 契约和聚合 CI 全部通过；后端作业按变更范围跳过。
- 上线前 07:02、07:05、07:07 UTC 三次只读检查：近 5 分钟 40 条后台轮询、0 次主动操作；`ip_run`、视频 Job、运行中执行计划均为 0。日志覆盖完整窗口，保留后台轮询计数。
- 07:07:43–07:09:00 UTC 发布窗口 nginx 访问日志无 5xx。公开 `/`、`/login`、`/video`、`/image`、`/assets`、`/api/config`，兼容 aiavatar 域的视频和资产页均 200；服务、API、代发健康检查与 nginx 配置检查通过。
- 后端启动时间仍为 2026-11-08 09:31:39 CST；JAR SHA256 仍为 `1748df604cc7f81bb15b920f16c27f54bfd9428242e3d7925a262d8a61f61cda`。

飞书原文档的 5、7、8 状态已依次更新并回读，最终 revision 160；原截图和录屏 token 保留。文档：[问题反馈](https://ji6siiy0q6l.feishu.cn/wiki/VxpewJSTri8F49kkHedcwgXjntd)。

## 回滚

前一前端制品 `/opt/ai-star-eco/releases/20261108-director-video-playback-7121e8ada/web-aiavatar.tar.gz` 已核对 SHA256：`3e59df814d6fffbe0498bd3c3a2767b94004e9a7f65b66b0143fbb5709a3b0a2`。需要时用正式部署脚本仅恢复 web-aiavatar；不重启后端、不恢复数据库、不重新提交生成任务。

旧页面刷新后加载新版。新发现的 TaskThumb / SignedImage 嵌套按钮告警仍单独记在 TODO，不计入本次三项修复。

## 线上截图

![产品与环境图片引导](studio-feedback-578-release-20261107/guide.png)

![已有 IP 与各造型](studio-feedback-578-release-20261107/ip-picker.png)

![重新编辑、切换 Fast 并刷新后保留脚本](studio-feedback-578-release-20261107/reedit.png)
