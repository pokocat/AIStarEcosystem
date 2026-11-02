# 客户端图片上传 · 生产发布与验收

2026-11-02，America/Los_Angeles。发布开始于 11 月 1 日 23:49 PST，验收跨过午夜。用户要求从最新 main 部署并验收 HEIC 和大图上传。

## 制品与范围

| 项目 | 真值 |
|---|---|
| 构建 main | `76b353939745bcbe9692b649286665ba8c40f3e2`；构建前及部署前均核对 origin/main |
| 图片功能提交 | `22596e3f697d8cce63d4f80f5c2b0a4fe6435110`，已由 `23db226e4` 合入 main |
| 发布包 | `20261101-client-image-upload-76b353939` |
| 发布服务 | server / web-aiavatar / web-celebrity |
| Studio BUILD_ID | `8WoVKVrVK-DY035wxtHUm`（webpack） |
| 带货 BUILD_ID | `cqKDXTpH27SSSDkED5qa9`（Turbopack，原 build 脚本） |
| server JAR SHA256 | `dd50509a52fbc1a5b0449a9ca7cb0f79dd5d88578b6d85ac36b579fe9d709521`，线上文件一致 |
| Studio 包 SHA256 | `84e5a67fc5302e9c2d040ff8761afb16c40fd8e0f1b42a44d8fd9c50424dc2e0` |
| 带货包 SHA256 | `0fd1eef59fa9008a6063e45496110e9634030f4c48693fa4b085ccd8a1cc57e9` |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1；mock 与开发登录关闭 |
| 数据库 | 无新迁移；发布前后 Flyway 均为 72 条、installed_rank=72 |

原工作区有未提交改动，全部保留。正式源码来自 Codex 管理的干净工作区；制品生成前 Git 无跟踪文件差异。未将原工作区 Next 开发配置、Seedance、场景文档等改动带入制品。

图片处理本身不改后端。配套发布 server 的原因是最新 main 的声音上传界面依赖 `ad8203cee` 的后端截取样本逻辑，单发前端会显示旧后端不接受的音频范围。发布前核对线上 server `942c055d9` 到构建提交的 DTO / OpenAPI：没有字段删除或改名，OpenAPI 仅更新声音上传说明；后端业务差异为声音样本处理，无新迁移，无需跟发管理端。线上已有提示词库等功能保留。

## 检查与发布

- devq `d3033d0135d9`：pnpm 10.33.2、锁文件离线安装，退出码 0。
- devq `2c7420c83c14`：全工作区串行 typecheck、独立 admin typecheck、API 契约、api-client 109 项、Studio 1600 项、带货 108 项测试；后端离线 compile、声音专项测试、三个服务生产构建及打包，退出码 0。前端共 1817 项通过。`pnpm test -- …` 实际跑了两个 Vitest 包的全套测试，按实际汇总记录，不称仅跑指定文件。
- devq `6050441e43fe`：`StudioAudioReferenceTest` / `DirectorVoiceUploadTest` / `StudioMediaImportServiceTest` 共 17 项，失败、错误、跳过均 0，退出码 0。后端没有跑全量测试；打包脚本的 `-DskipTests clean package` 不替代上述检查。
- devq `c083dcb022be`：合成大图验收样本，退出码 0。未启动新本地常驻服务。
- 使用仓库 `build-release.sh` / `deploy-release.sh`。运行环境检查全绿；已有依赖与字体继续使用，未安装 HEIC 服务端库。
- 第一次 deploy 内置 verify 因本机 DNS 路由导致公网 curl 超时，退出码 1，三个服务已实际应用。固定本次探测的域名解析到生产 IP、保留 HTTPS 证书核验、绑定 en0 后，单独重跑 `verify.sh` 退出码 0：Studio `/`、`/login`、`/assets`、`/api/config`，带货 `/`、`/studio/video` 及远端服务、API、字体、nginx 全绿。没有再次部署或重启。
- 三个服务 07:49:15–07:49:17 UTC 启动，均 active、NRestarts=0；后端约 07:49:35 完成启动。release-id / release-sha / release-manifest 已写入对应服务目录。
- 发布前图片/视频任务均无在途。07:49:00–07:50:00 UTC 的 nginx 日志有 27 次 502、1 次 500（静态 chunk），主要发生在重启与旧页面预取窗口，不能称零停机；最终探测恢复。后续正常用户有生成活动，不将全站任务数量变化归因于本次验收。

## 真实线上上传

Chrome 登录状态下，从产品现有文件选择器上传到真实接口、OSS；没有临时验收路由、请求 mock 或替换处理函数。逐项查看了实际图片的 complete / naturalWidth / naturalHeight。图片预处理仍只有共享实现，服务端校验未放宽。

| 入口与样本 | 上传结果 | 终态 |
|---|---|---|
| Studio 资产库：libheif 官方 example.heic | JPG，1280×854，427729 字节 | 上传 200；资产条目与打开后的图片正常 |
| Studio 资产库：18 MiB / 8064×6048 JPG | JPG，4618×3464，205755 字节 | 上传 200；自动缩小，未因原尺寸或大小拒绝 |
| Studio 资产库：7 MiB / 6000×4000 JPG | 仍为 7340032 字节、6000×4000 | 上传 200；限额内未缩小或改变文件大小 |
| Studio 资产库：12 MiB 不透明 PNG | JPG，4032×3024，159957 字节 | 上传 200；保留尺寸，没有持续缩小 PNG |
| 带货视频生成：首帧 HEIC | JPG，1280×854，427729 字节 | 上传 200；首帧预览正常 |
| 带货视频生成：尾帧 18 MiB / 48MP JPG | JPG，4618×3464，205755 字节 | 上传 200；尾帧预览正常 |
| 新画布同时导入 HEIC、大图 | 两张图片分别为 1280×854、4618×3464 | 两次 media-import 均 200；显示节点，保存并刷新后两张仍正常 |

验收画布 `IPP-13057f02`，名称「图片上传验收 20261101」，可在本人项目中查看。保留四条测试资产和专用画布；没有点击视频生成、智能优化、发送助手消息或发布作品，未为验收调用付费模型。

大图为合成几何图及尾部填充文件，用于验证尺寸/字节阈值，不代表手机实拍的典型压缩率或画质。限额内 JPG 本次线上核对了尺寸与存储字节数，没有完成线上文件 SHA256 对比；原字节绕过重编码另有本地回归覆盖。

截图、去掉签名 URL 的验收 JSON 和健康信息保存在原工作区忽略目录 `.studio-e2e/client-image-upload-production-20261102/`。本地完整构建/发布日志在 `/tmp/aistar-image-production-20261101/`，不将令牌、环境配置或签名地址放入仓库。

## 已知边界与独立问题

- iPhone Safari 真机仍未验收，尤其 iOS 16 / 17 文件选择、48MP、色彩与低内存；桌面成功不代替手机结论。不同厂商真实 HDR / 超高像素 HEIC 也未全面覆盖。
- 原始 HEIC 直接调用后端的错误分类、clip 兼容策略仍是 TODO；本次没有加入服务端 HEIC 转换。
- 07:56:42 UTC 另捕获一次导演台 `DirectorService.pollVideos:1578` 空指针：读取任务为 null 后调用 `job.path`，追查号 `tAVCAMEupHdAp9R5`。该方法与发布前代码一致；与本次测试画布、图片上传请求无关。已记 TODO，未重提或改写已受理的视频任务，不能把本次验收描述为全站无 ERROR。

## 回滚

发布前 server JAR root-only 备份：`/opt/ai-star-eco/backups/20261101-client-image-upload-76b353939/server-before.jar`，SHA256 `b37e0161b33a1f954008e99058bbca09e41e113570729002faee00e6f0202be8`。

上一版 server 为 `20261101-studio-ops-supplier-942c055d`；上一版 Studio 前端为 `20261101-studio-prompt-library`（`0ffdde365`）；上一版带货前端为 `20261022-generation-failure-alerts`（`54e161e97`），远端包均保留在 `/opt/ai-star-eco/releases/`。无数据库迁移可逆问题。回旧 server 时应同时回旧 Studio 前端，避免最新声音上传说明与旧校验不一致；本次没有执行回滚。
