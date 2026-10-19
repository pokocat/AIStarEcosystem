# Studio 助手正文字体统一 · 2026-10-17

## 修改

按 DESIGN.md 的正文字体职责，助手面板从 Outfit 改为共享 `--font-ui`（Manrope、中文及系统无衬线回退）；根布局 Google Fonts 请求移除 Outfit。只改两行，未调整字号、字重、行高、布局和交互，也未添加设计检查忽略项。

主工作分支提交 `9157719b4`。实际发布分支基于发布前线上 `a4092626defee2713101a561b59aa13c34eda20e`，只增加本次字体修复，构建 SHA 为 `241e820c`。未带入主工作区其他未完成改动。

## 验证

- 全 workspace 顺序 typecheck、admin 单独 typecheck、Java 17 离线 compile、API 契约与 diff 空白门通过。第一次 typecheck 在依赖尚未安装完成时启动，出现 tsc 缺失；安装结束后完整重跑通过。
- 设计扫描已移除 Outfit 告警，没有新增发现；原 CSS 文件其余既有字号等提示不在此次范围，未修改或忽略。
- 用发布分支真实 StudioAssistant 组件、真实 Ant Provider 和根布局全部 17 份样式做隔离浏览器回归，未发出生成请求。面板、正文段落和输入区的 computed font-family 一致，以 Manrope 开头，包含 Noto Sans SC 与系统回退，无 Outfit。
- 桌面 1280px 与手机 390px 验证：文字可见、输入区可见，无页面横向溢出；手机面板宽 366px，边界 x=12..378。没有修改原来的文字尺寸和密度。
- 本地证据：`.studio-e2e/font-unify-results.json`、`font-unify-desktop.png`、`font-unify-mobile.png`、`font-unify-proof.png`。这是隔离组件回归，不冒充生产业务页截图。

## 发布

已上线：`20261017-studio-body-font`，仅部署 `web-aiavatar`。

- 完整构建 SHA：`241e820c9c1c2908626b0683a1f942b21e8ddf7e`；线上 BUILD_ID `9ijXNKGbWu4lxFNo2WRbP` 与本地产物一致。
- 新助手 CSS `/_next/static/css/3b8f6f0da7b612f0.css` 公网 200，SHA256 与构建产物一致，包含共享 `--font-ui` 声明、无 Outfit；线上浏览器实际加载了该 CSS，Google Fonts URL 也已不含 Outfit。
- 前端页面 `/`、`/login`、`/dashboard`、`/projects`、`/create` 和后端公共 `/api/config`、系统服务与 nginx 检查通过。首轮部署脚本因本次误传了已需登录的 `/api/celebrity/dictionaries` 探针而报 401；部署本身已完成。改用脚本说明中的公共 `/api/config` 后完整验收通过，没有修改认证策略或业务代码。
- 产物已保留在 `dist/deploy/20261017-studio-body-font`；远端回退包 `/opt/ai-star-eco/backups/20261017-studio-body-font/web-aiavatar.before.tar.gz`，对应发布前的 `a4092626` 版本。
- 本次未部署 server / ID / 其他五个前端，未变更数据库和运行时环境配置。
