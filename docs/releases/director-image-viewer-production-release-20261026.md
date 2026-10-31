# AI 导演台图片模型三种比例过滤与大图缩放发布（2026-10-26）

发布编号 `20261026-director-image-viewer`，服务 `server,web-aiavatar`，构建自远端 `main` `faee1ac3963c8c13e0ef6e822ebb69266f49e257`（合并 `codex/director-image-ratio-capability` 的 `420be1f2`）。

## 变更

**图片模型只开放三种比例都能出的接入点。** 起因是 2026-10-26 线上的一次故障：一部作品存了 GPT Image 2 4K 接入点，它只有 3840×2160 和 2160×3840 两种尺寸。「生成全部参考图」时，三个道具（固定 1:1）在冻结前全部被拒，报错却让用户去改作品画幅，而道具根本不读这个设置。

- 新选择只开放出图规格同时有 1:1、16:9、9:16 的接入点，按规格判断，不按型号名。缺比例的返回 400 `DIRECTOR_IMAGE_MODEL_UNSUPPORTED`。
- 作品里已存的旧选择原值照存，不挡保存其他设置，并照用原接入点、原价出它能出的画面。出不了的那一类在冻结前返回 `STUDIO_IMAGE_SIZE_UNSUPPORTED`，文案按资产类型说明该换模型还是换画幅。
- 默认模型缺比例时不换成别的模型，照上一条报错；停用的选择返回 503 `ENDPOINT_NOT_ALLOWED`。
- 作品数据新增 `imageModelState`，设置页据此说明模型已停用或哪类画面出不了。页面价格、预算估算、一键连跑和实际提交读同一个解析。

**大图可以缩放和拖动。** 资产详情和分镜图弹窗的大图改用 antd 图片预览，与画布共用一套。

- 滚轮、触控板、双指都能缩放，范围是适应窗口到 6 倍。放大后可以拖动，松手时图会弹回窗口内；双击在放大和适应窗口之间切换。
- 底部有缩小、放大和「适应窗口」，右上角有关闭按钮；Esc 只关大图，不关外面的抽屉或弹窗。
- `@rc-component/image` 1.10.0 打了补丁（`patches/@rc-component__image@1.10.0.patch`）：原来纯横向或纵向拖动、或一帧内松手时不会弹回，会把图拖出屏幕。

只改选择范围与显示，不动已有图片、采用指针、指纹、模型并发、线上配置和积分规则。

## 构建与发布

- `main` 在合并前多了另一会话的 `f762616b`（`JusuanImageClient` 放宽 base64 大图响应），本次一并上线；其测试 `JusuanImageClientTest`、`ProviderAlertTextTest` 在合并结果上通过。
- 原发布工作区 `AIStarEcosystem-main-release` 有另一会话未提交的改动（admin 运营页、nginx、`package.json`、锁文件等），没有在那里构建。本次在仓外新建干净工作区 `AIStarEcosystem-release-director`，从 `origin/main` 合并、检查、快进推送，再构建。
- 构建参数：`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。上一版 `20261026-director-text-credit-display` 的 web-aiavatar 用的是企业开关 `0`，与此前各版的 `1` 不同；本版恢复为 `1`，Studio 的企业入口会重新显示。
- 仓库 CI 只在 PR 和手动触发时运行，这次直推 main 没有 CI 结果。
- 制品 SHA-256：`server/app.jar` `03e9463a5f30df4bc338ef04e2088dffcb120146fb36f5004bdf6d7b894c9119`，`web-aiavatar.tar.gz` `ac13ab070f0ca63c5a04534f367286a0b5e28f070a22d1b9f825dc937e4b5649`。本地、release store 与线上运行的 `app.jar` 一致。
- 发布前只读查生产库：没有进行中的 `ip_run` 和视频任务。server 于 18:36:17 CST 重启，18:36:36 启动完成；Flyway 校验 69 个迁移，无变化；重启后 0 条 ERROR。`verify.sh` 全绿。

## 检查

- 合并结果：`typecheck:all`、`typecheck:admin`、API 契约检查通过。服务端相关测试 146 项通过，包括 `DirectorImageModelTest` 11 项（撤掉修复后其中 7 项失败）。导演台前端测试 24 项通过，其中大图 8 项，去掉补丁后「纯横向拖」和「一帧内松手」两项失败。
- 功能分支上：服务端 ipstudio 全包 1007 项通过；web-aiavatar 全量 1305 项中 1303 项通过，失败的 2 项在 main 上同样失败，原因是各自的 `api-client` mock 缺 `publicModelErrorMessage`（见上一版记录）。
- 本地无头 Chrome 走查（后端开测试响应，零成本），桌面 1280×800 与 390×844 触屏共 27 项全部通过：
  - 滚轮与按钮放大；
  - 快拖、慢拖、纯横向、纯纵向拖到四边，都贴齐且不丢；
  - 缩小、适应窗口、双击；
  - Esc 只关大图；重新打开从 100% 开始；
  - 手机上双指放大到 350% 再捏回，单指拖动，点图不关闭，抽屉不跟着滚动。

  触摸是 CDP 合成的多点触摸，iOS Safari 与安卓真机未验。

## 线上验收

在已登录账号的浏览器里只读操作，没有提交生成、没有保存设置。

- 作品数据的 `imageModels` 只有 Doubao-Seedream-4.5（16）、GPT Image 2（16，默认）、GPT Image 2.5 1K/2K（37），两个 4K 接入点已不在可选列表。
- 抽查的作品存的是 GPT Image 2.5 1K/2K：`imageModelState` 可用、不缺比例、37 积分/张，与 `pricing.image` 一致。
- 资产详情的人物设定图：能打开大图，滚轮放大到 150%，工具栏四个按钮都在。纯横向快速拖到底后，左边缘弹回贴齐（`left = 0`），没有拖丢。
- Esc 关闭大图后，资产抽屉仍在。
- 「适应窗口」在线上没有单独点到，以本地走查为准。

## 回滚

server 与 web-aiavatar 回到上一版：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh <20261026-director-text-credit-display 的制品目录> server,web-aiavatar
```

该版制品不在本工作区：从发布它的 Codex 工作区 `dist/deploy/`，或 ECS `/opt/ai-star-eco/releases/20261026-director-text-credit-display` 取回。注意它的 web-aiavatar 企业开关是 `0`。本次无迁移，回滚不涉及数据库。

## 已知非阻塞问题

- 点「缩小」后图边可能留空白，再拖一下就会收回。这是 antd 的行为：缩小时不做边界弹回。
- 一键制作预算估算对缺比例的旧选择会多估（把出不了的道具也算进去）；目前没有作品存着这类选择。
- 导演台开放 4K（系列 + 清晰度）未做；GPT Image 2 4K 两条「受理结果未知」单独待查，未重试。
