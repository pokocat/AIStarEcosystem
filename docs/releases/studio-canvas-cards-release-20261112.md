# Studio 画布卡片与生成浮层发布（2026-11-12）

本次只发布 `web-aiavatar`，应用提交为远端 `main` 的 `bafa569f4abd333479524ae95eac21696aa0a088`，发布号 `20261112-canvas-cards-bafa569f4`。

- **画布卡片**：外框、底色和阴影只画在内容区上，标题是卡片上方的一行字。节点的盒子没有变，标题仍占 36px、边框仍是 1px，只是边框改成透明，所以 `STUDIO_CARD_CHROME` 和已保存的节点尺寸都不用改。空卡片画成虚线框加一行提示，按钮在悬停时出现。所有类型的卡片选中时都是同一圈群青色描边，视频卡片也一样。
- **图片 / 视频生成浮层**：照设计稿改成以下样子。
  - 工具行只有文字。
  - 参考素材是一排带「图1 / 图2」编号的缩略图，最后是一个「＋」格，原来的标签、下拉框和预览图三处不再重复显示。
  - 输入框没有边框。
  - 底栏是两个浅灰块，生成按钮写着价格（「生成 32 积分」）。
  - 图片浮层宽 460，视频浮层宽 520。
- **浮层位置**：先放在节点右侧，然后依次试下方、左侧、上方，只要有一侧放得下就不盖住节点。四面都放不下时，画布把节点移开（`make-room` 命令），工作台不会因为收到这个命令关掉浮层。手机屏幕放不下浮层并排，仍按原来的方式居中。

## 检查与制品

- **测试**：Mac mini 上 `web-aiavatar` 的类型检查通过，画布、浮层和工作台相关的 6 个测试文件共 123 项全部通过。
- **浏览器走查**：本地用模拟数据和本地接口桩，在 1440 和 375 两种宽度下走了一遍。覆盖悬停、选中、改名、拖动、缩放、拉连线新建节点、参考素材选择，以及图片和视频浮层。画布让位在无头浏览器里验证：节点左移，浮层保持打开。
- **没测到的**：点击生成要走真实后端的付款接口，没有测。
- **CI**：[Impersonation CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43265079771) 在准确提交上通过。
- **前端构建**：[Studio 生产构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43265135482) 从分支 `claude/release-canvas-cards-bafa569f4` 运行，固定检出应用提交，包装提交为 `bfe75c15e`。
- **制品**：GitHub 制品归档 SHA-256 为 `bf0e174e18c91b642080cb95e7aac4b08041001b88ba0ccaa0040bd65eb82801`，`web-aiavatar.tar.gz` SHA-256 为 `93b4f7cf30ad646695dbf649944f82782e7893fa17a84eeffa20ad2a16a325e3`。清单核对了提交、服务、`NEXT_PUBLIC_USE_MOCK=0`、`AUTH_MODE=id`、生产 issuer、企业开关，以及 `ENABLE_DEV_LOGIN=0`。

## 线上验收

- **备用机预检**：A 原先是零权重热备，运行 `1c5144b2b`。新版先预置到 A，在备用端口 13093 预检通过，新的 BUILD_ID 为 `0hRfqxxzlvymTvxLBEamM`。
- **静态文件**：新版目录合并了 A 原版和 B 承流版 `Ngc8zeNREnUUz7_uZtKqb` 的静态文件，已经打开的旧页面仍能加载。
- **切流**：A 的连接排空后启用新版，前端组于 `2026-11-12T17:13:26Z` 完成双 VIP 和 ALB 健康验收。现在 A 以 100% 权重承流，B 以 0% 权重保留 `aaa1fa08a`（`Ngc8zeNREnUUz7_uZtKqb`）。两台的 Studio 管理后台都没有改动，仍是 `HgxHIZY6ezMPAmeLmiwPq`。
- **线上核对**：
  - `aiavatar.aibuzz.cn/projects`、`/assets` 和 `aistar.aibuzz.cn/video` 都返回 200，响应头 `X-Aistar-Frontend-Node: a`，页面带新版 BUILD_ID。
  - 新样式文件里有生成按钮的价格样式，旧版 `_buildManifest.js` 仍返回 200。
  - A 上的新容器 `aistar-front-web-aiavatar-bafa569f4` 为 active，有 1 条就绪日志，错误行数为 0。
- **线上没做的**：没有用真实登录态打开画布，也没有提交生成任务。

发布只切换了前端组。需要回退时，先在 B 上验证保留的 `aaa1fa08a` 制品和前端入口，再按生产发布手册把前端流量切回 B。
