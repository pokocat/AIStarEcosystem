# Studio 视频复刻工具箱：本地验收

2026-11-08。当前工作树实现，**未提交、未部署，未修改线上配置或数据**。本次测试不调用付费生成模型。

## 功能与要求核对

| 要求 | 当前实现与证据 |
|---|---|
| Studio 工具箱提供参考站的几个功能 | `/toolbox`、导航和首页入口；深度复刻 / 分镜复刻 / 元素替换。组件测试检查实际链接，先前桌面和 390px 手机浏览器走查无横向溢出 |
| 后台画布串流程 | `StudioCloneVideoPlan` 系统编排，沿用 `ip_plan_execution`、`ip_run`；真实集成验证深度步骤完成后才提交视频，元素替换不建深度步骤 |
| 用户留在 AI 视频页看更新和结果 | `SceneVideoStudio` / `SceneVideoWorkspace` 共用原生任务；前端测试验证受理后不跳画布，当前模式、素材和任务地址保存；真实详情 API 连续读取 3 次恢复同一完成任务 |
| 深度提取是真实媒体处理 | Mini 上 Java 调用 ReShot 0.5.0 / VDA Small；2 秒与 17 秒完整视频分别通过，不截到 15 秒，原片字节不变 |
| 深度与元素替换使用正确参考 | 真实 HTTP 请求中，深度任务只传深度 MP4 与本次图片，不传原片；替换任务传原片；纯文字替换不伪造图片引用 |
| 图片选填，长度服从渠道 | 2026-11-08 再次读取参考站可见表单，图片/人物/背景/声音均选填，参考视频建议 4–60 秒。当前源码据此移除额外图片硬闸和固定 15 秒限制；仍按渠道合同及平台 60 秒上限校验，17 秒真实处理和 30 秒合同单测通过 |
| 编辑、刷新与重复请求不改变已受理任务 | 集成测试在受理后修改草稿图片 key，供应商仍收到受理时的原 key；相同请求重放返回同一任务，供应商只收到一次提交；画布恢复测试验证原片 → 深度 → 生成视频和图片连线，中间深度不进最终剪辑 |
| 使用既有结算与真实产物 | 实际原生 worker 从本地供应商下载 MP4、镜像、抽封面并提交原冻结；每例最终只扣 10 测试积分、pending 为 0，控制步骤为 0 积分 |
| 配置缺失明确不可用 | 缺推理命令/权重时无能力声明、报价/受理拒绝；不拿灰度滤镜、原片或文生视频作为替代成功。归属、渠道与媒体规则继续走原生校验 |

## 实测任务

完整 Spring、真实 H2 持久化、HTTP 模型适配器、原生 worker、积分与媒体链在 `StudioCloneTaskIntegrationTest` 内运行。供应商是测试内临时 HTTP 服务，只返回合成测试图案；未使用真实供应商密钥。生成画面不能证明主体替换、动作跟随或美学质量。

初次完整链通过任务 `036acf8f3a79` 的深度与图片替换两例；随后按参考站语义调整后，最终任务 `d7f920798437` 通过深度、图片替换、纯文字替换三例。该任务来自源码快照 `/Users/donis/dev/from-macbook/AIStarEcosystem-c944c68b66/20261108T075214Z-7dd28ecc`，退出码 0。

最终任务包括：

- 全仓串行 typecheck，包括两个管理后台；API 契约和 wire mirror 检查。
- 前端相关 5 个文件、38 项测试；后端编译及相关 8 个测试类、66 项测试，失败、错误、跳过均为 0。
- 后端 66 项内包含真实完整任务链 3 项、真实深度处理 2 项、计划执行推进 32 项，以及合同、素材与请求幂等回归。

更早的一组全仓门和相关回归见[功能文档](../studio-video-clone-toolbox.md)；rea-video 的 6 组合成切镜评估及其误切记录见[补充项目评估](../audits/studio-clone-reference-projects-2026-11.md)，它不是当前生产运行依赖。

复现关键环境（只在已配置运行时的 Mini 共享队列内执行）：`STUDIO_DEPTH_REAL=1`、`STUDIO_DEPTH_HOME=/Users/donis/BuildBox/tools/studio-depth`、`STUDIO_DEPTH_SOURCE=/Users/donis/BuildBox/artifacts/studio-depth-smoke/reference.mp4`、`STUDIO_DEPTH_FFPROBE=/Users/donis/BuildBox/bin/ffprobe`、`STUDIO_CLONE_CDN_HOST=192.168.31.155`。最后一项是测试 HTTP 服务的显式开发 LAN 地址，不是生产 CDN。临时服务、文件和连接池随测试结束释放，未停止其他聊天的任务。

## 浏览器界面验收与截图（2026-11-08）

按用户要求补做浏览器实际走查：桌面约 1319px 与手机 390×844。使用当前 Next 前端，后端响应由隔离的界面测试服务提供，账号、模型、预算、进度与结果均为测试数据；彩条媒体来自此前 FFmpeg 合成素材。**本节截图不能作为 Spring 任务执行、真实费用或真实供应商效果证据**；真实后端链路证据在上文。

已走查工具箱三入口、模式切换保留素材与文字、选择原片/选填图片、提交后留在原页、进度到完成、手机设置/作品切换、任务抽屉以及重新编辑。桌面 `scrollWidth=1319 / innerWidth=1319`，手机 `scrollWidth=379 / innerWidth=390`，未发现横向溢出。页面内有垂直滚动区域，手机长配置需向下滚动到生成按钮。

发现并修复：`SceneVideoStudio.reuseTask` 只切换了工作区视图，未将 `mobileView` 复位，导致手机从结果点「重新编辑」后仍看到示例。现明确回到 `compose`，浏览器复验保留原片、图片、要求和深度模式，创建新草稿、保留原任务。新增回归验证该动线；Mini 队列 `532661964714` 的类型检查及两个相关测试文件 49 项全部通过，退出码 0。

截图：

- [桌面工具箱](evidence/studio-video-clone-ui-20261108/desktop-toolbox.jpg)
- [深度复刻编辑](evidence/studio-video-clone-ui-20261108/desktop-depth-settings.jpg)、[分镜复刻编辑](evidence/studio-video-clone-ui-20261108/desktop-storyboard-settings.jpg)、[元素替换编辑](evidence/studio-video-clone-ui-20261108/desktop-replacement-settings.jpg)
- [桌面制作进度](evidence/studio-video-clone-ui-20261108/desktop-progress.jpg)、[桌面完成结果](evidence/studio-video-clone-ui-20261108/desktop-result.jpg)
- [手机工具箱](evidence/studio-video-clone-ui-20261108/mobile-toolbox.jpg)、[修正后的手机编辑](evidence/studio-video-clone-ui-20261108/mobile-editor.jpg)
- [手机制作进度](evidence/studio-video-clone-ui-20261108/mobile-progress.jpg)、[手机完成结果](evidence/studio-video-clone-ui-20261108/mobile-result.jpg)、[手机任务抽屉](evidence/studio-video-clone-ui-20261108/mobile-history.jpg)
- [观察记录](evidence/studio-video-clone-ui-20261108/ui-observations.json)、[隔离界面数据服务](evidence/studio-video-clone-ui-20261108/ui-preview.mjs)

视口已恢复；本聊天的预览服务与 SSH 隧道已停止，其他聊天的服务保持原状。本次未发布。

## 发布边界

这次交付是源码功能与本地验收。生产尚未安装/配置深度运行时，也未发布工具箱；真实渠道样片效果未验收。部署时应在 server 的实际执行环境准备 Linux/对应平台运行时和 Small 权重，复查视频参考能力、真实素材及原任务查询/结算路径。不能复制 Mini 的 macOS venv 到 Linux，也不能将测试供应商画面当成真实复刻成片。
