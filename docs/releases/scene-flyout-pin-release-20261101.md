# 发布：导航场景列表带「固定」（20261101-scene-flyout-pin）

2026-11-01，Asia/Shanghai。用户确认「提交并发前端」，只发 web-aiavatar。

## 内容

- 左侧导航「AI 视频 / AI 图片」悬停弹出的场景列表改为直接用场景页的「全部场景」组件（`SceneDrawer` 的 flyout 形态），带「固定」按钮：
  在场景页里点，页面那一列当场出来；在别的页面点，跳到对应场景页并固定。两处共用 `useSceneDrawerPin`，改了互相同步。
  用户原话：「两个地方用同一个组件即可，不要单独写」。main `c5ebee57d`，说明见 `docs/studio-scene-creation.md`。

## 制品与范围

| 项 | 值 |
|---|---|
| 正式构建 | main `c5ebee57d7731459a0632d8647465ae05b59a627`，仓外干净工作区 `../AIStarEcosystem-release-scene-flyout`（detached 在该提交） |
| 服务 | web-aiavatar |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭（`manifest.env` 已核对） |
| web-aiavatar tar SHA256 | `77ebe102ed9405ba18e85ebf4cf464715021b9d95e87fb9a3358892027469a71`；BUILD_ID `3KVF7MyCo1Y72idSHJG6I`（线上一致） |
| 上一版 web-aiavatar | `20261101-studio-prompt-chips`（`1e0ae2b72`，BUILD_ID `OJnWuRuRqi8B1gQ3AyRI-`） |
| 与线上 server 的关系 | 线上 server 为 `20261101-director-h3-storyboard`（`8af7ec7bf`）；从上一版前端到本版，前端只改这 4 个文件，不调用新接口 |

## 验收

- 发布前：组件与弹出列表测试 85 个通过（新增两条：弹出列表带固定、两处固定同步），web-aiavatar 类型检查通过；本机演示模式在 1440 宽走过三条路径（当前页固定、别处固定后跳转、页面取消固定后弹出列表同步）。
- 发布后：10:59:24 重启，`https://aiavatar.aibuzz.cn/login` 每秒探测 1 次 502，前后 200；`/login`、`/video`、`/image`、`/dashboard` 均 200；线上样式表含 `.scene-drawer.is-flyout`。
- 没做：登录线上账号实际悬停查看。

## 回滚

`deploy-release.sh` 指向生产机 `/opt/ai-star-eco/releases/20261101-studio-prompt-chips`，只回 web-aiavatar。
