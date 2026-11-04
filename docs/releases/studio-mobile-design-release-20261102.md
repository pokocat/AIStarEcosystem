# 新版手机端照设计稿收齐 · 生产发布（2026-11-02）

用户 2026-11-02 问「移动端是不是还没按照设计稿做优化重构」，看过线上走查结论后说「在这里改」。设计与改动见 [`docs/studio-scene-creation.md`](../studio-scene-creation.md) §22。

## 改了什么（只动新版 `html[data-ui="next"]`，旧版不变）

- 新版手机底栏换成设计稿的扁平底栏（`NextTabBar` / `.studio-tabbar`），首页、「我的」和其它新版页面同一个样子。
- 新版手机「我的」重写（`MeNext`），个人卡上显示可用积分。
- 手机首页边距、标题、常用开头、各块间距按手机重排。
- 项目、资产、发行顶上和底栏重复的文字导航只留给旧版。
- 「AI 编导」恢复紫色、「退出登录」恢复红色，「最近」点击区 44px，生成按钮关联「还差什么」，AI 图片「可选」只在混有必填格时标，资产库横滑右边淡出。

## 正式制品

| 项目 | 真值 |
| --- | --- |
| PR | [#149](https://github.com/pokocat/AIStarEcosystem/pull/149)，CI 8 项全绿后合入 |
| 构建 main 提交 | `5dbb7d79a`（合并提交），仓外干净工作区 `../AIStarEcosystem-release-mobile-design`，统一队列构建 |
| 发布包 | `20261102-studio-mobile-design`：只有 web-aiavatar |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1；mock 与开发登录关闭（`manifest.env` 已核对） |
| 制品 | `web-aiavatar.tar.gz` SHA256 `0cfcc8de26d8c2eef49aa215102b5bbd1106d44dd44444a60d845551a2f15ef6`，BUILD_ID `x0S49UCc5AwXUkrJjVkOc` |
| 上一版 | web-aiavatar `20261102-enterprise-canvas-credits`（`cbfdf1625`，BUILD_ID `klxN-tLZFalC_zeYTajaZ`）；`cbfdf1625` 到本次只有 web-aiavatar 与文档改动 |
| server | 未动（仍是 `20261102-enterprise-canvas-credits`，18:31:16 启动） |

## 检查

- 本地：相关 13 个测试文件 85 条、web-aiavatar 全量 204 个文件 1608 条通过，`tsc --noEmit` 通过；本地库副本 + 开发登录，390×844 逐页看过首页、我的、AI 视频、AI 图片、项目、资产、发行、创作，1440 宽确认底栏隐藏、桌面不变，旧版「我的」不变。本地后端打包时跳过了测试，只用来看界面。
- /impeccable 评审：设计评审与检测器各一个子任务。检测器在新代码上只报底栏 10.5px（已改 11px）；设计评审 26/40，首页间距不生效、按钮颜色被压、点击区偏小等按评审修了。
- PR CI：backend、frontend-tests、六个 build-and-browser 全绿。

## 发布与线上验收

- `deploy-release.sh` 内置 verify ALL GREEN；web-aiavatar 18:53:42 CST 启动，NRestarts=0，启动后 6 分钟日志无 error。
- 正式站 `/login` 的 BUILD_ID 为 `x0S49UCc5AwXUkrJjVkOc`。
- nginx `access.log` 18:52–18:55：449 条 200、0 条 5xx。
- 正式站 390×844、新版：首页、「我的」（显示可用积分）、项目、AI 视频都是新底栏，没有旧的凸起圆钮和顶部文字导航，「AI 编导」为 rgb(58,66,180)，当前项高亮正确。没有提交任何生成、没有扣积分。浏览器面板验完切回旧版。

## 回滚

生产机 `/opt/ai-star-eco/releases/` 下的 `20261102-enterprise-canvas-credits`，只回 web-aiavatar。

## 没做

底栏「创作」进 `/create`（画布列表）而不是 AI 视频 / AI 图片、手机首页第一屏选项多：都要定方向，记在 TODO「Studio 场景化创作」段。没有真机（iOS / 安卓 / 微信内置浏览器）验收，只有浏览器 390 宽模拟。
