# Studio GPT Image 分辨率计价生产发布

2026-11-11 16:07 UTC 发布 `20261111-studio-image-pricing-a22efc96`。服务端制品基于当时线上提交 `0a330629c` 追加图片计价补丁 `a22efc961`，仅发布 `server`，Flyway 仍为 V81。

| 项目 | 生产售价 | 配置 |
|---|---:|---|
| OneToken Seedance 2.5 720p | 120 积分/秒 | `VIDEO_GENERATION` 的 `ai-onetoken-seedance25`，原价 121 |
| GPT Image 2、GPT Image 2.5 | 1K 20、2K 30、4K 30 积分/张 | `studio.image-resolution-pricing` v2 |
| GPT-6.1 Terra | 输入 0.06298、输出 0.3149 积分/千 Token | `ai.chat-token-pricing` v12，原价 0.2111 / 1.0553 |

Terra 售价按 OneToken 报价 ¥0.3149 / ¥1.5745 每百万输入 / 输出 Token 的两倍设置。图片按服务端最终选定尺寸报价和冻结。场景候选原价作为未配置规格价时的兼容价，已受理任务继续使用原价格快照。

Mac mini 干净检查和生产构建任务 `71f887eccdea` 退出 0，覆盖 API 契约、图片型号投影、冻结与导演台报价。生产运行 JAR 与发布包 SHA-256 均为 `d5c338b75e69683c5d0bac015bf9d56d860d9b66af9beeb030f5a86a2e10de66`。公网采样于 16:07:04 至 16:07:23 UTC 观察到 18 次 502，服务启动后恢复 200，重新运行 `verify.sh` 为 ALL GREEN。浏览器核对两个 GPT Image 系列三档售价，未触发付费生成。

回滚制品 `20261111-recreation-modes-0a330629`。如只需撤回图片分档，将 `studio.image-resolution-pricing` 设为空对象，恢复场景候选价。Seedance 与 Terra 可分别通过原配置入口恢复原费率。发布提交保存在本地分支 `codex/studio-image-resolution-pricing`，常规发版分支需带上相同图片计价补丁。
