# 爆款复刻：直接看视频的拉片与代码拼方案 · 发布记录（2026-11-10）

发布号 `20261110-recreation-197b6cfc`（server + web-aiavatar）和 `20261110-recreation-197b6cfc-admin`（studio-admin）。设计与实测见 [`docs/ip-studio-recreation.md`](../ip-studio-recreation.md) 第一节，PR [pokocat/AIStarEcosystem#185](https://github.com/pokocat/AIStarEcosystem/pull/185)。

## 内容

- 拉片可以把整条视频（画面 + 声音）交给后台用途 `DAP_VIDEO_UNDERSTAND` 绑定的模型；台词带时间，长镜头按台词间隙切拍，按视频模型时长分段。
- AI 视频页的复刻，制作方案由代码拼（分段、秒数、模型、清晰度、画幅、每段素材），模型只写每段提示词和字幕；出片不带原片片段。
- 写提示词的规则：换产品整个换、台词保留句式改说用户商品、不写给系统的话、不复刻原作者账号、原商品的说法不安到用户商品上。
- 视频页选好参考视频后，时长按原片设置；Studio 后台模型页显示「看视频」。
- 迁移 V79：`ai_app_binding.purpose` 等用途列加 `DAP_VIDEO_UNDERSTAND`（只扩枚举）。

**没绑定视频理解模型时，三个拉片入口照旧抽帧读图**，视频页复刻的方案也照旧由模型写。上线后要另配接入点才生效，见下文「配置」。

## 构建

- 构建提交：`197b6cfc072b421fcfbab5d8ffc0ec5dbed6ddb7`（PR #185 合入当时最新的 main `9c9ee8887` 后的提交，main 已快进到它）。第一次打的包 `20261110-recreation-2e3541db` 是在 main 多出「编导脚本分层」和「资产页删除」两次已上线的发布之前合的，发出去会把这两项退回，作废未用。
- 仓外干净工作区 `../AIStarEcosystem-recreation`。Mac mini 磁盘已满（同步过去的源码快照占 165G，清理因别的会话有任务被拒），这次改在本机 devq 队列构建（`508e67f0db41`），参数 `NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。
- 检查：PR CI 26 项全绿（含三组后端测试）；第一次合并前在 Mac mini 跑过编译门，本机相关后端测试 383 个通过。
- 线上基线：server `20261110-scene-layers-8c43f1d0`、web-aiavatar `20261110-asset-delete-2eb4e1d1`，数据库迁移到 V78。从基线到本次，接口只新增 `AiModelEntryDto.supportsVideo`，没有删除或改名。

## 发布

- 2026-11-10 15:27（北京时间）：账号中心 200；线上有 1 张图在生成、1 条视频在提交，等两者结束（剩 2 条已在厂商生成中的视频，重启后接着查）再发。
- studio-admin `20261110-recreation-197b6cfc-admin` 先发，未重启共享服务。
- server + web-aiavatar `20261110-recreation-197b6cfc`：`deploy-release.sh` 退出码 0，`verify ALL GREEN`；V79 15:28:46 执行成功，`ai_app_binding.purpose` 枚举含 `DAP_VIDEO_UNDERSTAND`。
- 重启前 37 秒有一条视频失败（`mvj_f5280b46ee15`），原因是聚算 H3 个人素材空间满（409 `personal_asset_quota_exceeded`），积分已退回，和本次发布无关，但会影响之后所有带参考素材的 H3 出片，见 TODO。

## 配置

改前备份 `ai_model_providers`、`ai_app_binding`、`ai_app_endpoint_candidate`、`aep_platform_configs` 到 `/opt/ai-star-eco/backups/recreation-seed-20261110T073013Z`。经签名命令（actor `claude-code-donis`）：

- 新建接入点 `ai-1583b53c-52e`「火山方舟 · Seed 2.0 Lite（视频理解）」：`https://ark.cn-beijing.volces.com/api/v3`，用户本人火山账号的 Key（尾号 ba192，用户 2026-11-10 指定），模型 `doubao-seed-2-0-lite-260428`，`models_json` 声明 `supportsVision`、`supportsVideo`；JSON 输出、流式、`reasoning_effort=minimal`、温度可调，默认输出 16000、上限 32000，并发 5。先建成停用，配完再启用。这几项参数事先用同一个 Key 真调确认过（JSON 输出、流式带用量、思考 Token 为 0）。
- 成本 `TOKENS`：输入 600、输出 3600 微元每千 Token（即 ¥0.6 / ¥3.6 每百万）。这是按第三方报价折算的，官方控制台价待核对，见 TODO。
- 售价：`ai.chat-token-pricing` 第 10 版，只加这一条：输入 0.09、输出 0.54 积分每千 Token（成本加 50%，1 元 = 100 积分），`maxInputTokens` 128000、`maxOutputTokens` 16000，单次冻结约 21 积分、按实际用量结算。
- 开放范围：文字类、全部应用（绑定用途要求全部应用，和 Terra 一样）；没有加进任何功能的候选，所以只有拉片用它。
- 绑定 `DAP_VIDEO_UNDERSTAND` → `ai-1583b53c-52e`。

## 线上验收

- 内置浏览器、线上账号：AI 视频页选「爆款复刻」，从资产库选一条视频，到画布对它「拉片」（视频页那里的「生成视频」会做到成片，约 1,606 积分，而且当时聚算素材空间已满，没点）。
- 任务 `IPR-c5725a17814443fba9b1`：受理时选中的端点是 `ai-1583b53c-52e`，6 秒视频 17 秒完成，策略 `video-understanding-v1`、`audioAnalyzed=true`；拆成 2 个镜头（推镜到蜡烛火焰、再拉远），听出「舒缓钢琴纯音乐、没有台词」，切出 1 段；冻结 21、实扣 1、退回 20 积分。画布上拉片说明、片段、镜头表都显示出来。
- **没验**：带台词的视频在线上的拉片、视频页从拉片一路到成片（受聚算素材空间满阻塞）、换真人人物的复刻。

## 回滚

- server、web-aiavatar 回 `20261110-scene-script-cbbfa030`，可以分开回；studio-admin 回上一版。
- V79 只给枚举加值，旧版本读得到；回滚前要先把 `DAP_VIDEO_UNDERSTAND` 的绑定删掉，否则旧版本读到不认识的用途值。
