# 新版手机底栏「创作」先选三项 · 生产发布（2026-11-02）

上一版发布后留了一个方向待定：新版手机底栏的「创作」直接进画布列表（`/create`），而手机上最常用的是 AI 视频和 AI 图片。用户回复「改成先选三项」。设计见 [`docs/studio-scene-creation.md`](../studio-scene-creation.md) §22 末段。

## 改了什么（只动新版 `html[data-ui="next"]` 的手机底栏，旧版不变）

- 「创作」从链接改成按钮，点开是底部弹层「想做点什么？」：AI 视频（`/video`）、AI 图片（`/image`）、画布（`/create`），各带一句说明；当前所在那项图标是墨色。
- Esc、点遮罩、关闭按钮都能关；键盘打开时焦点在第一项，关掉回到「创作」；打开期间背后页面不滚动。
- 弹层挂在 `body` 上（`components/hub/ui.tsx` 的 `CreateSheet`），桌面不出现。

## 正式制品

| 项目 | 真值 |
| --- | --- |
| PR | [#150](https://github.com/pokocat/AIStarEcosystem/pull/150)，CI 8 项全绿后合入（第一次 `frontend-tests` 里 admin 的 `studio-skills/page.test.tsx` 超时：CI 上跑了 5.4 秒、本地 0.5 秒，没改 admin，重跑后通过） |
| 构建 main 提交 | `5bcdebd3b`（合并提交），仓外干净工作区 `../AIStarEcosystem-release-mobile-design`，统一队列构建 |
| 发布包 | `20261102-studio-create-chooser`：只有 web-aiavatar |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1（`manifest.env` 已核对） |
| 制品 | `web-aiavatar.tar.gz` SHA256 `e57d24183342c3e6ba8127666572ec09d424b3632e545d6a1a1b0fa598dc095c`，BUILD_ID `NW9BUEwaWjzgmhLD4yw_3` |
| 上一版 | web-aiavatar `20261102-studio-mobile-design`（`5dbb7d79a`，BUILD_ID `x0S49UCc5AwXUkrJjVkOc`）；到本次只有这次的前端与文档改动 |
| server | 未动（仍是 `20261102-enterprise-canvas-credits`，18:31:16 启动） |

## 检查

- 本地：web-aiavatar `tsc --noEmit`、全量 vitest 1609 条通过；本地库副本 + 开发登录，390×844 在「我的」、AI 视频、画布页打开弹层，核对当前项标记、焦点落在第一项、Esc 关闭后焦点回到「创作」、点选跳转；桌面宽度底栏仍隐藏。本地后端打包时跳过了测试，只用来看界面。
- /impeccable 检测器对 `ui.tsx` 0 条。

## 发布与线上验收

- `deploy-release.sh` 内置 verify ALL GREEN；web-aiavatar 20:47:19 CST 启动，NRestarts=0，启动后日志无 error。
- 正式站 BUILD_ID 为 `NW9BUEwaWjzgmhLD4yw_3`。
- nginx `access.log` 20:46–20:49：147 条 200、0 条 5xx。
- 正式站 390×844、新版：「我的」页点「创作」出现三项，焦点在「AI 视频」；点「AI 视频」进到视频页，弹层关闭、页面滚动恢复。没有提交任何生成、没有扣积分。浏览器面板验完切回旧版。

## 回滚

生产机 `/opt/ai-star-eco/releases/` 下的 `20261102-studio-mobile-design`，只回 web-aiavatar。

## 没做

手机首页第一屏选项多（13 个）仍待定，记在 TODO「Studio 场景化创作」段。没有真机（iOS / 安卓 / 微信内置浏览器）验收。
