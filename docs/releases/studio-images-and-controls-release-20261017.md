# Studio 图片压缩与全仓输入控件修复 · 2026-10-17

## 图片压缩

前面只发布输入框热修复，未发布图片压缩。本次上线前公网 `/studio/create/image.png` 实测为 1,887,388 bytes，WebP 路径 404，确认线上仍在使用原图。

本次包含已准备的 16 张 UI 配图：9 张创作卡、4 张场景卡、首页主图及场景图集、品牌小图标。合计 33,576,514 → 1,024,483 bytes，减少 96.95%。卡片保持 3:2，编码为 960×640 / WebP quality 82；首页主图与图集保留 1672×941，图标由 1254 缩至 256。生成原图来源登记保留在 creation-cover-sources.json；不是用户上传或模型识别参考素材的压缩。

创作/场景及首页 CSS 改为引用新 WebP，首页主图接入 Next Image 的响应式尺寸与 preload。只压文件不改引用不会生效，本次两者一起发布。旧版未引用的历史图片不作为当前页面加载体积统计。

## 控件

全仓清单、40 处 select 统一、IME/焦点修复与浏览器验收范围，见 [输入控件检查](../audits/form-control-focus-audit-2026-10.md) 的本轮补查章节。

## 发布状态

已上线，发布标识 `20261017-forms-images-79667715`。

- 实际构建/部署代码：`796677150ad2be93ba6de03e1ba21ca1c3a662e1`，分支 `codex/forms-images-release`。从发布前线上 Studio 基线 `ccbff781c3f426808c5e2f0ac42e369fe4c2bfbf` 隔离，只带本次修复；主工作分支对应提交为 `b657ceac26c4d5cc3d7aac4163a358e3d002d3ed`。
- 部署服务：web-aiavatar、web-drama、web-music、web-celebrity、web-star、admin。未部署后端、账号中心或数据库迁移；未带入主工作区其他未提交功能。
- 产物：`dist/deploy/20261017-forms-images-79667715`。上线前六个服务备份位于服务器 `/opt/ai-star-eco/backups/20261017-forms-images-79667715/<service>.before.tar.gz`；需要回退时按服务恢复该包并重启后重新执行健康验收。

## 验证结果

- 196 项定向测试通过：AiAvatar 八个文件 131 项、短剧四个文件 64 项、全仓 select 结构守门 1 项。覆盖真实下拉交互/回调、空值、禁用、表单重置与 ref、富文本光标、IME、故事板失败重试和付款偏好。
- 全 workspace typecheck（顺序执行以避免本机并行内存竞争）、admin 单独 typecheck、Java 17 离线 compile、API 契约门、diff 空白检查通过。六个前端生产构建通过。
- 标准部署脚本的线上服务状态、nginx 配置与公共路由验收全部通过；六个线上 BUILD_ID 与本次产物逐一相同。
- 16 个新图片公网响应均为 200，SHA256 与本地产物逐一相同，合计 1,024,483 bytes。例如 `/studio/create/image.webp` 为 35,360 bytes，替代原 1,887,388 bytes 的 PNG。
- 六个应用各抽查一个含共享控件的 JS 和 CSS，共 12 个资源，公网 SHA256 与构建产物一致。
- 真实线上首页完成 hydration 后，主图 `currentSrc` 使用 `/_next/image?url=%2Flanding%2Fip-canvas-hero-v3.webp...`、complete=true，页面不再引用旧主图 PNG。首页按设备选择形态，不能用原始 SSR HTML 是否含主图文件名作为加载成功判断。
- 真实线上项目页：搜索内部 border=0、outline-style=none，外层保留 2px 焦点；状态菜单是页面内 listbox、8px 圆角，包含全部状态/草稿/已发布，关闭后焦点回到“画布状态”。只操作搜索/筛选展示，没有写入业务记录或调用付费生成。

浏览器证据和资源校验 JSON 保留在本地忽略目录 `.studio-e2e/form-controls-v2/`：`online-controls.png`、`online-home.png`、`browser-online.json`、`online-verification.json`。六套主题桌面/手机回归截图同目录。完整范围和原生输入法/小程序验收限制见输入控件检查文档。
