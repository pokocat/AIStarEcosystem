# 灵感库发布（2026-11-06）

发布号 `20261106-inspiration-library`（server + web-aiavatar），从 main `3c8e01beb` 在仓外工作区 `../AIStarEcosystem-release-inspiration` 构建，带 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（已核对 `manifest.env`）。无数据库迁移。设计见 [studio-inspiration-library.md](../studio-inspiration-library.md)。

## 上线内容

- 新版导航加「灵感」，排在首页后面；新版手机「我的」里也有。旧版顶栏本来就有。
- `/templates` 默认显示案例，可筛视频、图片，搜索能搜到提示词。
- 点开案例是居中弹窗，不再全屏：左边看效果，右边是规格、需要准备的素材和可复制的提示词。点「做同款」才复制画布并进入。
- 做同款后助手打开并预填要求、绑定方法，发不发由用户决定。选填的素材位空着不挡生成。
- 服务端修复：发布官方示例时文字节点的正文不再被删；画面描述里的「不出现」「描写」「手写」不再把出图请求路由到写剧本。

同包没有带别的功能：线上上一版 `f90dfab6d`（长视频）之后，main 上只有灵感库和发布记录。DTO 与 openapi 没有变化。

## 窗口与验收

- 发布前查过线上：没有在跑的文字、图片、视频任务（7 项老的连续制作停在等用户，不受影响）。
- 08:07 CST 重启。502 共 6 个，全是 `/api/config`（部署探测）。重启后 0 条 ERROR，`verify` 全绿，`app.jar` 校验和与发布包一致（`c686867cba25bfb4`）。
- 线上用超管账号打开 `/templates`：显示「全部案例 13 / 视频 9 / 图片 4 / 官方模板 12 / 我的模板 1」。点开「电梯开门大促」弹窗 992×640，地址不变，视频静音自动播放，关闭后回到列表。

## 发布前的检查

- 合并 main 后：`typecheck:all`、`typecheck:admin`、`check:api-contract`、服务端编译通过。
- 服务端 `ipstudio` 全部测试 1410 个（5 个跳过）通过，web-aiavatar 全部 1712 个通过。
- 本地 35 个示例全部发布过一遍，走通灵感页 → 弹窗 → 做同款 → 画布，并在「我的版本」上用预填提示词经费用确认真实出了一张图（Agnes）。

## 示例内容

**35 个示例还没有发到线上。** 发布要超级管理员令牌，内置浏览器又不让线上页面读本机素材，这一步要用户操作，见 [设计文档「怎么发布」](../studio-inspiration-library.md)。

## 没有验证的

- 助手用真模型到确认卡（本地 Agnes 限流且不能看图，由组件测试覆盖）。
- 视频真实生成。

## 回滚

server 和 web-aiavatar 一起回到 `20261106-segmented-video-2`。旧 server 发布示例仍会删文字节点正文，示例发布之后回滚不影响已发布的内容。
