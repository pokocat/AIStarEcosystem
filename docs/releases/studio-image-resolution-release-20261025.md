# Studio 图片系列与分辨率路由 · 生产发布（2026-10-25）

代码已部署。生产目前只配置 GPT Image 2 的 1K / 2K；Flare、Sunburst 和 4K 仍缺正式端点、合法输出规格及已确认售价，未完成三个系列的真实出图验收。

## 发布制品

- 功能提交：`eab29339009b933c622ac994cfae7577ec65a500`。
- 合入 main 并推送后，从干净 main `feb6e4e0bd09ea74a41b8e672ec75c3d5759bc81` 构建。
- 发布目录：`/opt/ai-star-eco/releases/20261025-studio-image-resolution`；范围仅 `server web-aiavatar`。
- 构建时间：2026-10-25 05:47:27 UTC。服务启动：后端 13:49:26 CST，Studio 13:49:27 CST。
- 沿用 `NEXT_PUBLIC_ENTERPRISE_ENABLED=1`、统一账号中心登录、真实 API 和关闭开发登录的构建参数；没有编辑生产 env 或模型配置。
- JAR SHA-256：`e79d9a535355dc948885a97c8788480d435c5f0e93684318d096850bf795cbba`。
- Studio Build ID：`xUoRddEcDrWAFbWgoK6jz`。
- Web 包 SHA-256：`e9f6c66d442ddfff041346b933c09d71fd1d92b0fc93e740bc0e5cc6fa7e47e4`。

上个后端制品保留于 `20261025-ai-director-14`，上个 Studio 制品保留于 `20261025-ai-director-12`；本轮没有新增数据库迁移。

## 行为

模型列表把供应商端点折叠成产品系列，提交稳定系列标识与精确像素尺寸；服务端按开放候选和合法输出规格路由，按实际候选售价报价、冻结。任务保存端点、供应商模型、尺寸、规格及单价快照，worker 使用快照组包。旧草稿端点 ID 和旧画布节点重新运行兼容；已有视频模型计价单位保持原逻辑。

| 产品系列 | 1K / 2K 供应商型号 | 4K 供应商型号 |
|---|---|---|
| `gpt-image-2` | `gpt-image-2-1k-pic` | `gpt-image-2-4k-pic` |
| `gpt-image-2.5-flare` | `gpt-image-2.5-flare-1k` | `gpt-image-2.5-flare-4k` |
| `gpt-image-2.5-sunburst` | `gpt-image-2.5-sunburst-1k` | `gpt-image-2.5-sunburst-4k` |

该表是代码映射；模型是否可用仍取决于后台端点、场景开放、合法输出规格与售价。

## 检查与线上证据

- 干净 main：全工作区类型检查、admin 类型检查、后端离线编译、API 契约检查通过；契约工具保留既有未实现 handler / orphan 提示。
- 后端专项 63 项通过：系列路由、模型列表聚合与视频计价、尺寸/价格快照、旧节点重新运行、非法尺寸不冻结、最终供应商请求型号。
- Studio 工作台回归 77 项通过，含 4K 选择、精确尺寸与报价随请求提交。
- 完整 `verify.sh` 最终 ALL GREEN：公开首页、登录、项目、导演台及配置接口，所有既有服务、nginx 配置与本机 API 正常。
- 首轮本机公开域名探测超时；使用实际服务器 IP 的 `curl --resolve` 并保持域名证书校验后复验通过，未再次部署或重启。
- 运行中 JAR 指纹与本地制品一致；远端 Build ID 与本地构建一致。公开 JS `chunks/332.2b482f4af723d037.js` 的 SHA-256 为 `58c45d4722ad5ba1294d3ce7ab9d544df3fa759ca8f7273eff5a0c14d106c4b0`，与本地相同，包含分辨率报价代码。
- 公开与本机鉴权模型接口结果一致：`studio-image:gpt-image-2`，1K / 2K 均为 30 积分/张，旧端点映射 `ai-abadd123-a06`。原视频候选列表逐字段一致；图片端点、候选和场景策略内容指纹发布前后相同。
- 启动后两个服务 ERROR 日志行均为 0，检查时无运行中的图片任务。
- 原工作区其他 16 个未提交文件逐一 SHA-256 核对保留；它们未进入功能提交或发布制品。

本轮没有提交收费生成、重投旧任务或改写账本；供应商真实输出尺寸与三个系列的完整生产验收仍待正式配置后执行，不能据此报告已完成真实出图。

本地证据：原工作区 `.studio-e2e/image-resolution-release-20261025/` 保存基线和文件保留校验；main 发布工作区同名目录保存编译门、构建、部署、最终健康检查、运行时与公开资源指纹。远端配置投影快照：`/opt/ai-star-eco/backups/studio-image-resolution-20261025/{before,after}.json`。
