# Studio 默认出图模型切到 GPT Image 2.5（2026-11-05）

这是线上配置改动，没有发版。北京时间约 17:25，用签名命令 `scenePolicySave` 把 `ai.scene-policy.studio.image` 的 `defaultEndpointId` 从 `ai-abadd123-a06`（GPT Image 2）改成 `ai-c120fb1f-769`（GPT Image 2.5 1K/2K），候选和售价都没动。

## 影响

- **价格**：没手动选模型时，1K / 2K 从每张 16 积分变成 37 积分，4K 从 55 积分变成 61 积分。这是原来就配好的售价，用户仍可以手动选回 GPT Image 2。
- **范围**：Studio 的默认出图模型，包括 AI 图片页、画布，以及图片模型设为「跟随默认」的导演台作品。数字资产的形象生成走 `DAP_IMAGE` 用途绑定，没有改。已受理的任务按原来的模型和价格结算。
- **确认**：线上 `/api/v1/ip-studio/models` 返回 GPT Image 2.5 为默认，AI 图片页按钮显示 37 积分。

切换后没有在线上实际出图，因为线上出图会扣真实积分。

## 回滚

用同一个命令把 `defaultEndpointId` 改回 `ai-abadd123-a06`。改动前的配置备份在生产机 `/opt/ai-star-eco/backups/20261105-studio-image-default-20261105T092557Z/`。
