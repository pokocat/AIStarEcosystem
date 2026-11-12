# 智能优化积分核对与同一草稿多条视频 · 发布记录（2026-11-12）

- 发布号：`20261111-optimize-credits-eb7bb9da`（server + web-aiavatar）
- 构建提交：main `eb7bb9dab`（本次修复 `0ae044451`，同包带上 main 上未发布的提交，用户同意按 main 全部一起发）
- 构建：Mac mini devq 快照，`checkout -f --detach eb7bb9dab` 后确认无未提交改动再 `build-release.sh`；`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`、`NEXT_PUBLIC_AUTH_MODE=id`；校验和核对通过
- 上线时间：2026-11-12 00:31 CST；无迁移（Flyway 校验 81 个，无需迁移）

## 起因

2026-11-11 21:43 线上用户（可乐米乐妈妈）：视频 930 积分全由 H3 赠款付，「智能优化」改写提示词要冻结 110 普通积分，账户只有 109。
页面只核对视频价就受理，任务第一步停在「需处理」；她在任务页点「再次生成」回到同一份草稿，之后 4 次「生成视频」都被
`STUDIO_PLAN_EXECUTION_BUSY` 挡住。本地按线上配置（不含密钥、厂商地址不可达）与余额复现了同样的经过。

## 本次上线内容

- 本次修复（`0ae044451`）：
  - AI 视频页的任务彼此不挡，也不挡画布上的对话制作（`StudioPlanExecutionService#holdsCanvas`）。
  - 普通视频开着智能优化时，建任务前按付款账户核对优化那一笔（只能用普通积分），付不起 402 `MODEL_CREDITS_INSUFFICIENT`，不建任务；新增只读 `GET /v1/ip-studio/studio/video-optimize-price`。
  - 页面「生成视频」「视频裂变」提交前另核对优化那一笔，积分不足提示框可选「按原文生成」接着交；视频由赠款抵扣时价格提示不再写「无需另付积分」。
- 同包带上（各会话已确认可一起上线）：
  - 导演台 `db7227cc8`（首张合格资产图自动采用）、`e5fc2d7a6`（视频提示词文字搬进提示词库）、`d1a6be9c0`（视频模板版本按编译时固定）、`eb7bb9dab`（编剧提示词不给能照抄的人名和道具）。
  - 深度复刻 `63c1a3cc4`、`089bacd17`、`26d2c39f7`、`2b29eab5e`（ECS-B 转发、252 推理、排队不误判超时、受理时限流）。
  - `95cef50e4`（GPT Image 1K/2K/4K 分档计价，与 00:07 只发 server 的 `20261111-studio-image-pricing-a22efc96` 同一补丁；第一次打的包落后于它，作废重打）。
  - `1636f0ec8`（爆款复刻没加参考视频不报价，默认 Seedance 2.0）。

## 线上验收

- 发布前：账号中心 200；`ip_run`、`ip_plan_execution`、`material_video_job` 均无在途任务。
- 重启窗口 00:31:37–53 共 12 个 502（任务轮询与 `/api/config`），启动后 0 ERROR；启动 17.5 秒。
- `verify.sh` 只有 `/projects` 在重启后首个请求超时（20 秒），随后 `/projects`、`/video`、`/templates`、`/` 均 200、约 0.09 秒。
- 提示词库按种子更新：`stage-director-script` v4、`director-genre-street-life` v2（启动日志 `[studio-skill] re-seeded`）。
- 制品：线上 JAR 含 `requireVideoRewriteAffordable`，网页包含 `video-optimize-price` 调用。
- 已登录账号只读调用 `video-optimize-price`：200，报价 33 普通积分、付得起（当晚为 110，说明这期间后台调过该文字模型的上限，与本次核对无关）。
- 视频页「爆款复刻」默认 Seedance 2.0，没加参考视频时按钮不显示积分。
- 未做：线上真实点一次「生成视频」走积分不足提示框（会真实扣费或建任务，只在本地按线上余额验证过）。

## 回滚

两个服务一起回：server → `20261111-studio-image-pricing-a22efc96`（保留 00:07 的分档计价），web-aiavatar → `20261111-clone-ui-229c9c56`。
无迁移，不用改库。旧网页不调新接口；旧 server 没有新接口时页面核对拿不到报价会放行（与修复前行为一致）。

## 未完

- 长视频、爆款复刻受理前没核对文字步骤要的普通积分（见 TODO.md）。
