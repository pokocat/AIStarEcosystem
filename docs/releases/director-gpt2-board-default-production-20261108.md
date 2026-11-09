# 导演台 GPT Image 2 竖屏分镜默认规格 · 2026-11-08

## 发布结果

默认图片模型保留 GPT Image 2。作品没有显式选择图片接入点时，分镜图跟随作品比例：原接入点支持则沿用，不支持时仅从同一 GPT 图片系列中选择已开放、可用且支持该比例的接入点。当前 9:16 分镜使用 GPT Image 2 4K 的 2160x3840，55 积分/张；资产图继续使用 GPT Image 2 原接入点，16 积分/张。横屏分镜仍为原 2048x1152 / 16 积分，方图沿用原规格。

没有切换到 Seedream 4.5。此前误改的导演台默认值已撤回，生产 `directorImageDefault` 仍为 `ai-abadd123-a06`。用户显式保存的图片接入点保持原状，不跨系列替换；无同系列可用规格时明确报错，不修改作品画幅。

作品响应增加只读 `boardImage` 规格及 `pricing.boardImage` 单价。分镜弹窗、批量生成、助手重生成、一键制作估价与预算检查使用该单价，实际受理仍由原 `IpRunService` 校验 maxCost 并结算。没有新账本、迁移或供应商协议修改。

## 制品

- PR：[175](https://github.com/pokocat/AIStarEcosystem/pull/175)。构建来源为干净主线 `dfeb20f1b54fd83e1dc407c1f5fc2692d0231c86`，与检查通过的代码 `ed821ec589e1fa704e327b9d58d0dc6d964c9806` 内容一致。
- 发布号：`20261108-director-gpt2-board-dfeb20f1`，范围仅 `server,web-aiavatar`。
- JAR SHA256：`3f5f8a6dcc043742d365f683ba529bb81f4c8fd6d662dd5ba6e421aa4eb4daf9`，上线后与运行目录文件核对一致。
- web-aiavatar 包 SHA256：`ad46b0d8402a2af446704506dd688dd384768c94852a32a6091d78567f6c0f28`。
- 构建在 Mac mini 经 devq 执行，任务 `7de5d44c0c5a`；未同步生产环境配置或凭据。前端保留现网 ID 登录及企业功能开关。打包脚本使用 `-DskipTests clean package`，此前已独立完成下述测试，打包不替代测试。

## 验证

- 后端最终回归：32 个测试类、328 项，失败/错误/跳过均为 0（`Director*Test`、`IpRunServiceTest`、`IpStudioModelOptionsTest`）。覆盖竖屏分镜实际提交 4K 接入点和 55 积分上限、资产提交原接入点和 16 积分、横屏保持原价、禁止切换到 Seedream、显式选择不替换、估价分别计算两类图片。
- 前端最终相关测试 42 项通过；另一次 web-aiavatar 全套 1,944 项通过。全工作区、后台类型检查、API 契约和 Java 离线编译均通过。最终检查任务 `5890234d317a` 退出 0。
- 发布前账号中心 discovery 返回 200；发布后 server 与 web-aiavatar 均 active、NRestarts=0，运行 JAR 校验通过。
- 默认 IP 探针的 `/api/config` 从当前电脑超时，但服务器本机 API 正常；改用实际 HTTPS 域名验收。aiavatar 域没有 `/admin` 路由，因此后台入口单独以 `https://admin.aibuzz.cn/admin` 核验，未修改路由或服务配置。最终 `verify.sh`：`PUBLIC_BASE=https://aiavatar.aibuzz.cn`，`PUBLIC_PATHS='/ /login /api/config'`，`PUBLIC_URLS='https://aiavatar.aibuzz.cn/projects https://admin.aibuzz.cn/admin'`，ALL GREEN。
- Chrome 在已登录的既有线上作品中只读验收：作品设置显示“默认（GPT Image 2）”、分镜“GPT Image 2 4K · 2160×3840 · 约 55 积分/张”、资产“约 16 积分/张”；9:16、4 镜的未生成分镜弹窗显示同一规格和 55 积分，“生成分镜图”按钮 enabled，无“不支持竖图”提示。
- 未点击生成或保存作品设置，没有收费生成、修改用户作品、重试原失败任务或补偿操作。供应商真实 4K 成图未在本次复测。

线上设置截图仅保存在当前验收工作区的 `docs/releases/evidence/director-gpt2-board-20261108/settings.jpg`，未上传到 Git；截图含验收账号与作品界面。

## 回滚

本次没有修改持久化作品结构或端点尺寸配置。可用原制品恢复两个服务；server 原运行包对应发布 `20261108-video-task-retry-11907af69`，原 JAR SHA256 为 `1748df604cc7f81bb15b920f16c27f54bfd9428242e3d7925a262d8a61f61cda`；web-aiavatar 原最新发布为 `20261108-studio-voice-accent-7be9bb8a`，部署脚本另保留 previous 目录。回滚会重新出现默认 GPT Image 2 不支持 9:16 的旧限制，不应通过恢复 OneToken 无效尺寸来掩盖。
