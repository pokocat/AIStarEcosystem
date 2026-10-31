# Studio 头像外观与轮播圆点优化发布

2026-10-31，America/Los_Angeles；生产机记录为 2026-11-01，Asia/Shanghai。用户要求小范围验证后直接提交、合入 main 并发布，并确认同时优化轮播圆点动画。

## 结果

- 修正新版侧栏头像相对外圈向右下各偏 2px：头像随按钮内容区缩放，移除旧字母头像的固定尺寸规则，保留单层细边框和可见键盘焦点。
- 默认头像背景统一为浅灰 `#f3f4f6`，人物配置保持原样；已有自定义头像和账号中心修改入口沿用现有逻辑。
- 轮播圆点保持普通 7px、选中胶囊 18px，只对底色做过渡，移除宽度动画。已修复提示的 `layout-transition` 问题，没有添加忽略规则。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 构建来源 | 干净的 main `0921222f666a5036b54e4e96bd7fffdf93bea9e4`，构建前已推送 origin/main |
| 发布包 | `20261031-studio-avatar-polish`，仅 `web-aiavatar` |
| BUILD_ID | `XmJYyg0-NYvfHd9fDKhwN`，线上与本地一致 |
| tar SHA256 | `4c482aa86f8038edf46879d0c1d8951d4d9b76bd1614207232f58c1cc90c83f2`，线上与本地一致 |
| 构建配置 | `AUTH_MODE=id`、`ID_ISSUER=https://id.aibuzz.cn`、`ENTERPRISE_ENABLED=1`，mock 与开发登录均为 0；均为 `NEXT_PUBLIC_` 构建参数 |
| 前端服务 | `aistareco-web-aiavatar` active，01:21:43 CST 启动，PID 354211，NRestarts=0 |
| 后端服务 | 未更新、未重启；发布前后均为 PID 350589，01:08:34 CST 启动，NRestarts=0 |
| 发布流程 | `build-release.sh web-aiavatar` → `deploy-release.sh … web-aiavatar`，env-check 与 verify 全绿 |

从最新主线构建，保留其既有编导、选择框和头像功能。主线上较前端上一版新增的后端视频恢复改动已独立发布，本次只发前端，不修改数据库或运行环境配置。

## 验证

- 沿用本轮已通过的 5 文件、24 项头像/导航定向用例与应用类型检查；正式发布构建及其 TypeScript 检查通过。按用户要求未重复全仓大回归。构建和浏览器任务均经共享 devq 队列执行。
- 线上 `/`、`/login`、`/me`、`/api/config`、`/video`、`/image` 全部返回 200；服务状态、后端本地 API、nginx 配置检查通过。
- 无头 Chrome 加载真实生产前端，在桌面旧版、桌面新版（1280×900）和手机（390×844）检查 `/me`：头像圆心横纵偏差均为 0px，背景均为 `rgb(243, 244, 246)`，键盘焦点可见，页面脚本错误为零。
- 发布样式的定向 DOM 样例包含实际主题作用域，三种形态中圆点宽度为 7px/18px，`transitionProperty=background-color`。第一次样例漏带主题作用域，导致缓动变量无效；修正验收脚本后通过，生产代码未因此改动。
- 浏览器使用合成账号与 API 响应，仅验证真实线上前端的渲染和样式；本轮未重测真实短信注册、账号中心图片上传或付费模型生成，没有改真实用户资料。

截图、测量 JSON 与构建/发布日志保存在本工作区忽略目录 `.studio-e2e/avatar-alignment-20261031/`。

## 回滚制品

上一版前端为 `20261101-studio-director-spec`（main `6927fc59b60cd441f206007788968671a7ee1b02`，BUILD_ID `eNERTzSCQiT5y0FG0YtAV`），原发布包保留在生产机 `/opt/ai-star-eco/releases/20261101-studio-director-spec/`。必要时按既有 `deploy-release.sh` 流程只回滚 `web-aiavatar`；账号默认头像功能仍保留，外观与圆点动画恢复旧版。
