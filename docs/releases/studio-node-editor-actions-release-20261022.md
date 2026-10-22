# Studio 节点操作合并 · 生产发布与验收

- 日期：2026-10-22（发布完成 15:33 UTC / 23:33 CST）。
- 发布范围：仅 `web-aiavatar`，已合入并推送 main 后从干净 main 构建。
- 构建代码：`cf91ae0e3ad939a9d4180f5c53e88a202c52d004`。
- Release ID：`20261022-studio-node-editor-actions`。
- BUILD_ID：`owxt0_AmTmnw2xS9IWz4S`（本地制品与服务端一致）。
- 后端不在本次发布范围，仍为 `20261022-model-alert-context-schema` / `bca7980f8715dcbf6d8ebbc68eba1f081b38a88d`，PID `1728015` 未变。

## 交互结果

移除卡片下方独立小操作条。「问助手」与节点独有操作进入对应编辑面板；图像/视频生成面板的问助手、更多操作、参考、IP 人物库、上传/替换图片在同一行，窄屏横向滚动。参考素材标签另占内容行，避免把操作按钮挤成多行。

左键单击打开编辑面板；右键保存并收起生成/配音编辑面板后只显示操作菜单，保存失败则保留编辑内容。操作始终绑定当前编辑节点，避免选择变化后误操作另一张卡片。文案/剧本、图片/视频、配音、口型、拉片/复刻与作品编辑面板均保留适用操作。

## 本地验证

- `pnpm typecheck:all`、`pnpm typecheck:admin`、服务端 `./mvnw compile -q -o`、`pnpm check:api-contract` 全部通过。
- 8 个相关测试文件、121 项测试通过，覆盖左右键切换、原草稿保存、节点目标绑定、作品媒体操作及原有生成编辑流程。
- `build-release.sh web-aiavatar` 正式构建通过；`NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_ENABLE_DEV_LOGIN=0`、OIDC 模式及正式 issuer 配置。
- 浏览器本地验收图片/视频/文字面板与右键菜单；桌面五按钮同一纵坐标、高度 32px。
- 实测窄屏 `innerWidth=375`，操作行宽 253px、内容宽 336px、横向滚动；按钮仍同一行，页面宽度保持 375px，没有整页横向溢出。

## 线上验收

- `deploy-release.sh` 完成；自带 `verify.sh` 的公共入口、所有服务健康、服务端 API、Nginx 检查全绿。
- `https://aiavatar.aibuzz.cn/projects` 返回 200。已有登录会话刷新正式画布后，左键打开图片编辑面板。
- 五个按钮实际 DOM 纵坐标均 `543.296875`、高度均 32px，操作行宽 626px；独立 `.studio-context-toolbar` 数量为 0。
- 「更多操作」可见引用生成视频、加入 IP、下载图片，确认独有功能入口保留。
- 从可见卡片标题右键后，生成编辑面板数量为 0，仅显示编辑内容、重命名、替换图片、裁剪图片、局部重绘、拆分图片、复制节点、删除节点菜单。点击「编辑内容」可重开面板，原创作要求仍在。
- 浏览器控制台无 error；前端服务 `active`、`NRestarts=0`，新进程正常 Ready。
- 此次只验收布局与操作入口，未提交付费生成任务，未重新验证模型生成质量。
- 浏览器截图本机留在原工作区 `.studio-e2e/node-editor-actions-20261022/`：`production-editor.png`、`production-context.png`、`mobile.png`，不纳入仓库。

## 制品与回退

制品目录：`dist/deploy/20261022-studio-node-editor-actions`。

| 制品/资源 | SHA-256 | 验证 |
|---|---|---|
| `web-aiavatar.tar.gz` | `f9050a3b37e021240e2d82bb3518908b9988c35555f1eb40c4e71380ed551420` | 本地正式制品 |
| `static/chunks/1596.46e12972ae83fbf4.js` | `a40811d44a195bc53188f003d9a11fc3c701e352a74e1fffd6ed328e2262daca` | 公网与本地一致 |
| `static/css/686978a1461bfdc6.css` | `954f06c87dc4084471d2868ddce644aa996f466c8e773c18b6feb6c047cb72bd` | 公网与本地一致 |
| `static/css/cb96cb78a258ea93.css` | `a1d8ccb0898865ef1958188729e9d16369f9633153808f5e5542b897b87fe8cd` | 公网与本地一致 |

服务目录 `/opt/ai-star-eco/web-aiavatar` 的 `release-id.txt` 与 `release-sha.txt` 已写入本次发布标记。

发布前独立备份：`/opt/ai-star-eco/backups/studio-node-editor-actions-20261022/web-aiavatar`，约 108MB。旧版本为 `20261022-generation-failure-alerts` / `54e161e9721827ff05b93dc13c6b2515c5d49111`。需要回退时恢复该前端目录并重启 `aistareco-web-aiavatar`，然后复查页面、BUILD_ID 与健康；不涉及数据库或后端回退。本次未执行回退。
