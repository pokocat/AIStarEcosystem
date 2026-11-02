# 图片上传评审修正 · 本地验收

日期：2026-11-01。本次不部署；测试页只存在于临时源码副本，不进入产品代码。

## 构建与实际浏览器

- `web-celebrity`：执行原来的 `pnpm --filter @ai-star-eco/web-celebrity run build`，Next 16 默认 Turbopack，通过；devq `dd3d41cf3c51`。
- `web-aiavatar`：执行原来的 `pnpm run build`，webpack，通过；devq `1d23378a7125`。资源验收副本把静态生成并发设为 2，不修改原工作区配置或构建脚本。
- Turbopack `next start`：Chrome 验证真实发布产物 Worker，成功；devq `417a0e3726f9`。详见 [生产模式浏览器结果](turbopack-results.json)。
- Turbopack 原有 dev 脚本：Chrome 同组验证成功；devq `3751a2f702d4`。使用 localhost，未为验收放宽 dev origin。详见 [开发模式结果](turbopack-dev-results.json)。
- EXIF 旋转 JPEG：压缩前后方向/比例正确；devq `5ffa16582a5f`，详见 [方向结果](orientation-results.json)。

浏览器用例使用合成渐变/纯色图片、填充文件，以及 libheif 的 example.heic，不作为真实照片压缩率基准。P3 使用合成 HEIC 对照 macOS 原生解码，最大通道差 2。

## 编译与回归

devq `ce735ec9d112` 成功，串行执行：

1. `pnpm -r --workspace-concurrency=1 run typecheck`、`pnpm typecheck:admin`。
2. api-client：P3 属性与 Worker 像素保护，6 项。
3. web-aiavatar：图片处理、上传接口、助手附件、重复上传短路、候选恢复、封面、素材库、导演台及素材选择器，67 项。
4. web-celebrity：原来的 `pnpm ... test`，108 项。
5. 后端 `./mvnw compile -q -o`。
6. `pnpm check:api-contract`、`git diff --check`。

共 181 项相关测试通过，没有调用付费模型、刷脸核验或生产写接口。所有测试服务已经释放；不停止或重启其它聊天的服务。

## 未验收项

- iPhone Safari 真机：iOS 16 / 17 文件选择器的 `.heic` 行为、原生/Worker 分支、真实手机内存。
- 不同厂商、HDR 与超高像素 HEIC 全覆盖。
- 真实的 Modelink 本人刷脸。DAP 图片重编码只做了实际代码链路核对。

## 范围

本轮仅调整图片预处理、相关 UI 提示、测试与文档；其它聊天的录音、开发配置、seedance、场景流程等工作不在本轮提交范围。
