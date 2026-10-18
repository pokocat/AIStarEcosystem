# Studio 原声提取发布 · 2026-10-17

状态：已提交、推送并生产发布。2026-10-17 14:40 UTC（ECS 22:40 CST）更新server与web-aiavatar。用户明确要求「不用验了，直接发布」，本次停止新增验收，仅执行必要构建与发布；不将发布完成等同于浏览器业务验收。

## 范围

- 解析／拉片用FFmpeg提取完整混合原声，保存为本人WAV音频资产并落为普通音频节点。
- 无音轨不创建静音占位；分段继续复用原任务音频；同源节点复用，保留用户编辑与删除。
- 复用现有成片合成音轨选择；支持参考音频的原生视频模式仍按各模型合同接收音频。
- 不增加ASR、字幕、翻译或人声/BGM分离；无新模型调用、积分项、表或API路径。
- 只发布server、web-aiavatar。工作区其他页面与图片压缩变更不在本次提交／制品中。身份中心、admin及其他子应用不发布。

## 已有证据与边界

此前已完成后端60项、前端58项专项，AiAvatar类型与API契约检查通过；后端服务类采用Java17定向编译与JUnit Console验证。浏览器连接超时，尚未完成本轮页面实操。

本地实际媒体已按用户要求切换为 `1792081443234..mp4`：原片720×1280、15.071995秒、H.264/AAC。已启动的4项音频测试在用户要求停止新增验收前完成；原声WAV为15.092979秒、2,897,976字节。没有把个人视频提交到代码仓库或额外发送给模型，存储使用测试替身，非生产OSS全链验收。技术说明见[分享第7节](../audits/studio-film-study-technical-sharing-2026-10.md#7-按产品边界收简拉片只提取原声)。

后续用户要求直接发布，因此不重跑上述测试，不补新的模型生成或浏览器验收。生产环境文件、模型配置、企业与统一登录配置保持原设置。

## 制品、切换与回退

构建使用本次提交的干净源码快照，排除工作区其他未提交改动；真实API、正式统一登录、企业功能开启，关闭mock与开发登录。制品与切换结果如下；文档补录提交不代表再次构建发布。


| 项目 | 实际结果 |
|---|---|
| 代码 | `f8d8cf1bc18e806977d9d8fa88f714a77f41b3aa`，已推送`codex/unified-ip-studio` |
| Release | `20261017-source-audio-f8d8cf1b`，server / web-aiavatar |
| JAR SHA256 | `567e0d7b7b0c77788480dc1865b8f48acd2d888ed49c52bfe111831e921d676e` |
| 前端包 SHA256 | `72ce87518eaec9996f08c6a0dcc4197eba7b058a20f3dc1dd644c8bd2418eaa7` |
| 前端 BUILD_ID | `kcS3oet5YNDV5yVpuPe9J` |
| 更新前备份 | `/opt/ai-star-eco/backups/studio-source-audio-20261017T143348Z/{app.jar,web-aiavatar.tar.gz,state.json}`，root私有 |

- 使用仓库正式`build-release.sh`从提交快照构建；Java17后端package与Next16生产构建成功。按用户要求跳过独立typecheck和额外测试；Next构建自身的TypeScript编译正常完成。
- `deploy-release.sh`退出0，`VERIFY=0`，未运行部署后的`verify.sh`、浏览器业务验收或收费模型请求。
- 服务切换：server为22:40:27 CST、web-aiavatar为22:40:29 CST，均active/running；后端日志记录应用启动完成。线上JAR SHA和BUILD_ID匹配本次制品，版本记录已更新。
- `/etc/aistareco/server.env`与`web-aiavatar.env`发布前后SHA一致；无配置写入、无数据库迁移或客户数据操作。原声音频能力无需新增配置。
- 原JAR SHA为`0eb8b018f742b10efe1f5df5092f9db8d8c21e94c1684e2df9276da3d77e29ff`，原前端BUILD_ID为`a-WP7MVR-pVTA2PHoQnkT`；若回退，使用上述备份恢复对应服务并重启，不回退客户数据、不覆盖环境文件。
- 工作区原有页面与图片压缩改动保留未提交，未进入本轮制品；个人视频、提取音频、本地身份和测试运行时均不进入生产包。
