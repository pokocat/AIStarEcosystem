# 整仓生产发布（2026-11-07）

本记录日期和操作时间采用 America/Los_Angeles（PST）。对应的生产机日志日期为 2026-11-08 CST。

## 发布结果

- 发布号：`20261107-full-38de5c736`。
- 代码：`38de5c736535f6c969f01f864583034924a85a2f`。先将干净 main 从 `c71a81de0` 快进至 `ab6aa33dd`（含 PR 161），再提交 6 行 clip 类型镜像补齐。
- 服务：`server`、`web-music`、`web-drama`、`web-celebrity`、`web-aiavatar`、`web-star`、`web-incubator`、`admin`、`studio-admin`、`sau-service`，共 10 个。
- 09:06:56–09:07:03 切换后端和七个 Web 应用；09:13:46 切换代发服务；09:13:58 切换 Studio 运营看板。
- `verify.sh ALL GREEN`；另逐一核对 10 个 systemd 单元均 active、`NRestarts=0`。发布目录全部 15 个文件的校验和通过。
- 统一账号中心、快出片预发、ClassVibe 和其他项目不在此次部署范围；未修改生产环境文件或密钥。

近期合入的主要功能包括：导演台剧情带货及参考素材关联、视频素材库统一准备、积分不足弹窗与恢复路径、成片自动字幕和编辑室调整、运营看板模型配置及反馈修复。以该代码版本为准确边界，不表示这些功能都重新做过真实付费生成验收。

## 检查与构建

构建、安装、类型检查和测试均在 Mac mini 的 devq 队列执行；检查链内部串行。使用 Node 22、pnpm 10.33.2、JDK 17；Maven 堆 1536 MiB、Spring 上下文缓存 2、单测试 fork。

| 检查 | 结果 |
|---|---|
| 后端全量 `verify` | 3817 项，失败 0、错误 0、条件跳过 13 |
| API 客户端 | 112 项通过 |
| web-drama | 693 项通过 |
| web-aiavatar | 1927 项通过 |
| admin | 39 项通过 |
| studio-admin | 50 项通过 |
| web-celebrity | 108 项通过 |
| 全工作区类型检查 | 通过 |
| API 契约、wire mirror | 修正后均通过 |
| 后端、七个 Web 应用、独立运营看板生产包 | 全部成功，构建任务退出码 0 |

前端合计 2929 项测试通过。全量运行在 `ab6aa33dd`；随后只修改共享类型，在 `38de5c736` 重新执行全工作区类型检查、两项契约检查和全部生产构建。Java 源码未变。发布脚本的后端打包使用 `-DskipTests clean package`，此前的全量 `verify` 已通过，不把打包跳过测试当作测试结论。

首次额外执行 wire mirror 时，发现 clip 的四组响应类型漏了模板来源、段状态和试听地址；补齐 `packages/types/src/clip.ts`，未改变运行逻辑。API 契约检查仍有既有未实现/未来接口的警告，但退出码为 0，没有把警告描述成接口功能已经完整。

近期 PR 161、160、158 各自的 CI 已成功；本次类型补齐为直接提交，不另称该新提交的 GitHub CI 已通过。合并后验证以上述队列任务为准。

## 迁移和运行制品

- Flyway 从 V74 升至 V76：V75 创建 `video_asset_library`、补充端点引用并迁移 2 个 OneToken 模型；V76 扩展两张绑定表的用途枚举，支持 `DAP_TRANSCRIBE`。生产历史两项均 `success=1`。
- OneToken 素材库存在，两个模型均指向 `onetoken-main`。
- 语音识别绑定数为 0。后台已显示「Studio · 语音识别 / 未绑定」，此次没有配置或调用新识别模型。
- 后端 JAR SHA256：`51b9341c5c7ab522057eb12e5c504cdfee94a4c678c69b76fb83154e011cf652`，线上与发布包一致。

| 应用 | 线上与制品一致的 BUILD_ID |
|---|---|
| web-music | `O7jdEQfd75t8aFML_ACi-` |
| web-drama | `RBxQ-2ORZNIFfH0xAcypH` |
| web-celebrity | `KgsRp2oLhXtgk3dRehHXj` |
| web-aiavatar | `izoAubrkTAJhj3apZ23Dq` |
| web-star | `HfwPcfCW54QSexdmWrK4y` |
| web-incubator | `hpSEp-9VecbozIvF3pS-X` |
| admin | `nmWQ80FOS3y4oiUbcG1Pr` |
| studio-admin | `KGrx8dOOtUB4s8QrqBJug` |

### 代发镜像的构建恢复

标准部署在 GitHub 固定依赖下载处退出 1：生产机 `git clone --filter=blob:none` 的后续对象下载超时。此前应用制品已保存、后端和 Web 已切换，旧代发容器仍健康；未因此重复重启后端。

恢复时复用原镜像 `sha256:3ae4c937914321aec9376e477750169f9083a05d2d7fcea52569a7b49eb95395` 的依赖层：

1. 核对旧镜像的 `pyproject.toml`、兼容补丁与当前源码 SHA256 完全一致；已安装上游的 `direct_url.json` 确认固定提交为 `721476f7b49c2c8c4625ea9b053745b89138d5d8`。
2. 整体替换 `/app/src`，包含删除旧源码文件；没有复用旧业务代码。
3. 重新执行兼容补丁和抖音、视频号、快手、小红书四个真实驱动的导入检查，全部通过。未登录这些平台、未代发视频。
4. 以新标签构建，切换源码目录及 `real` 标签后只重启代发单元。健康检查返回 `ok:true, mockMode:false`，容器随后为 healthy。

过程中旧 Docker builder 两次在覆盖相同文件后的 COPY 层导出失败；改为复制到独立目录、在同一 RUN 内替换源码后成功。没有清空缓存、删除其他镜像或重启 Docker 守护进程。

最终镜像：`sha256:911252f82c1f54986874b86e279fc7c172732078f0e6ed815a7b7a8cf649d805`，revision 标签为本次代码 SHA。恢复配方保存在发布目录的 `Dockerfile.sau-dependency-reuse`，已加入本地及远端校验和清单。

## 发布窗口与线上验收

- 发布前两次只读核对：运行中的 `ip_run`、视频任务和制作执行合计 0；18 条 `needs_user` 制作记录保持等待状态。
- 09:06:57–09:07:20（17:06:57–17:07:20 UTC）访问日志共 10 个 502：8 个探测 `/api/config`，2 个用户 `/api/me/wallet`。不是无中断发布。核对至 09:18 左右，未出现该窗口之后的 5xx。
- 08:59:34–09:17:22 的公网采样共 2808 次：2798 个 200、8 个 502、2 次 6 秒客户端超时。两个超时分别在 Studio 首页和短剧首页，未取得 HTTP 状态；其后针对这两处复查均 200，不把超时等同于服务端 5xx。
- 后端启动窗口日志包含已知启动标记；ERROR 0，WARN 2，分别是 MySQLDialect 和 UserDetailsService 自动配置提示。
- 公网主页、Studio 视频/图片/导演台/项目页、两个后台登录入口均通过；后端本机 API、中文字体、代发健康检查和 `nginx -t` 通过。未登录的 Studio 任务接口返回 401，OIDC discovery 返回 200。
- Chrome 用现有登录态实际打开 Studio、导演台列表及既有作品，展开新「本集剧本」，核对原内容、账户和 2868 积分；视频页读到模型和折扣价；AI 图片入口和管理后台绑定页正常。上述 Studio、管理后台标签未记录 console error。
- Chrome 另打开音乐、短剧、带货、明星及孵化演示首页，均显示对应应用内容。独立运营看板未登录时正确进入登录页。
- 用生产机原有 2018 年 ffmpeg 实跑 2 秒合成：调色、淡入淡出、响度、说话侧链压低背景音乐及混音成功，ffprobe 核对 H.264/AAC 和 2 秒时长。

## 备份、回滚与验证边界

服务器备份目录：`/opt/ai-star-eco/backups/20261107-full-ab6aa33dd`。含发布前 JAR、八个前端目录、代发源代码及旧镜像引用，另有 252 MiB 数据库完整备份；目录 0700、SQL 0600，未下载数据库或机密到开发机。旧 JAR SHA256 为 `d9d8b34463dc97bb8b373915d83c931eb303d5a8b2c366ba03a952f6c968712f`。

代码回滚应恢复相应的 JAR/前端目录及旧代发镜像，然后核对健康和版本。V75 保留旧 `inputAssets` 配置，V76 仅扩展枚举且当前没有新用途绑定；不随代码回滚自动恢复整个数据库，以免覆盖备份后的业务数据。若之后配置了语音识别，回滚前另核对用途兼容。

本次没有真实调用付费生成、重新导出客户成片、支付或实际代发，也没有验证手机真机和独立运营看板登录后的数据页。语音识别仍未配置：导演台按已知台词估算字幕时间，一键成片不编造字幕；真实识别效果与费用需在确定端点后另验。
