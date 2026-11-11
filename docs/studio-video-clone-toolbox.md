# Studio 工具箱：视频复刻

2026-11-07，本地实现，尚未部署。

> **2026-11-11 改**：深度复刻和元素替换不再把整条原片一次交给模型，改成和分镜复刻一样先拉片、按原片分段、每段出片再合成，入口改成「爆款复刻」的三种方式。现行做法见 `docs/ip-studio-recreation.md`「三种复刻方式」；本文下面的动作提取（ReShot）、运行依赖和 2026-11-08 改版仍然有效，「后台画布流程」表和单段时长限制以那一节为准。

首页「视频复刻」与左侧「工具箱」进入 `/toolbox`，三个入口落到 AI 视频的同一任务工作区。用户添加素材、填写要求、选择模型与规格后开始制作，留在原页看真实阶段、历史任务和结果；主动点「在画布上查看」才进入画布。

| 入口 | 后台画布流程 | 输入与限制 |
|---|---|---|
| 深度复刻 | 原片 → 时序深度提取 → 深度视频 + 可选替换图 → 视频生成 | 参考片服从所选渠道上限，平台最多 60 秒；图片选填，需描述目标画面；渠道必须开放视频参考 |
| 分镜复刻 | 原片分析 → 编排分镜 → 图片与片段 → 合成 | 沿用既有爆款复刻，支持较长参考片与动态分段 |
| 元素替换 | 原片 + 修改说明 + 可选替换图 → 视频参考生成 | 修改内容写在要求中，参考片长度服从渠道合同、平台最多 60 秒 |

原生参考两种模式的出片时长服从渠道单段上限，不截断原片。元素替换是生成模型的视频参考编辑，不承诺逐像素保留或精准分割。首版不部署 ControlNet，也不提供并未接通的 `depth_strength` 参数。

## 实现

- 既有 `/video-tasks`、`ip_plan_execution`、`ip_run` 保存输入、预算、尝试和状态，计费仍走原生视频链。无新数据库表或产品码。
- `kind=depth` 的第一步是零积分 `video-control`。固定程序调用 ReShot 0.5.0 / Video Depth Anything **Small**，提取时序一致的真实深度视频，不用灰度滤镜。Small 权重与 ReShot 为 Apache-2.0，不能换用非商用的 Base/Large 权重。
- 每个实例同时只执行一次深度推理，等待与推理期间更新心跳，支持超时、取消和临时目录清理。用户不能指定程序、权重或命令参数。无服务时，在报价和受理前拒绝，由能力列表禁用前台生成。
- 受理时从本人画布读取并冻结真实素材 key，后续编辑不改变本次引用。深度结果经 `FileStorageService` 存 OSS；下一步只引用真实产物，提取失败不提交付费视频、不改用原片或文生视频。
- 参考图片、视频和声音继续走所选渠道的合同、素材库、归属与内容验证。模型名称不等于渠道能力，只开放实际声明支持视频参考的候选。
- 画布打开时从原生记录恢复相同节点与连线，深度视频默认不加入成片。视频失败重试复用已成功的深度结果，供应商受理不明时查询原任务。
- 模式存于 `sceneVideoState.cloneMode`，任务链接携带 `tool`，草稿、最近任务与重新编辑均保留。

## 运行依赖

发布前在运行 server 的机器安装隔离运行时，不把 Mini 路径当成生产配置。仍需既有 ffmpeg/ffprobe、OSS 与视频渠道配置。开发安装、测试、推理均经 devq remote 队列。

```sh
export STUDIO_DEPTH_HOME=/absolute/path/studio-depth
sh tools/studio-depth/install.sh
# 系统 Python 小于 3.10 时，先准备便携 Python >=3.10 或 uv。
# 依赖、权重和安装版本记录留在 STUDIO_DEPTH_HOME，不进入源码。
```

server 显式配置（环境变量对应 `AEP_STUDIO_DEPTH_COMMAND`、`AEP_STUDIO_DEPTH_CHECKPOINT`、`AEP_STUDIO_DEPTH_TIMEOUT_MS`，可选 `AEP_STUDIO_DEPTH_POSE_CHECKPOINT_DIR`、`AEP_STUDIO_DEPTH_MAX_RES`、`AEP_STUDIO_DEPTH_POSE_MIN_COVERAGE`）：

```properties
aep.studio.depth.command=/absolute/path/studio-depth/venv/bin/reshot
aep.studio.depth.checkpoint=/absolute/path/studio-depth/weights/video_depth_anything_vits.pth
aep.studio.depth.timeout-ms=1200000
# 可选：DWPose 两个权重所在目录（install.sh 下载到 weights/dwpose），配了才会对全身动作改用骨骼图
aep.studio.depth.pose-checkpoint-dir=/absolute/path/studio-depth/weights/dwpose
```

中国大陆机器下载权重先 `export HF_ENDPOINT=https://hf-mirror.com`（ReShot 文档的做法）。2026-11-08 Mini 上 hf_hub 被限流（429）、hf-mirror 卡住、直连超时，最后在本机下载 `dw-ll_ucoco_384.onnx` 并按 ReShot `scripts/mirror_weights_to_modelscope.py` 里的官方 sha256 核对后拷入；ReShot 在魔搭的模型卡没有放权重文件。

GPU 不是强制依赖，容量与耗时按实际机器测量。深度推理需要专门资源，不在生产请求里临时下载模型。

ReShot 保留内存预检，资源不足时明确失败，不使用 `--force` 绕过。较长、高帧率与极端比例的视频需要更多推理资源；60 秒是平台输入上限，不代表每个渠道都接受 60 秒参考，出片长度也仍按渠道合同。`--target h3` 用于像素对齐，该预设的时长提示不会截断输入；处理后再次核验输出完整时长。

## 验证边界

`tools/studio-depth/smoke.py` 用合成移动画面做真实推理，不上传私人素材、不调用付费视频模型。Mini 实测 2 秒、48 帧、24 fps 的输入，输出 704×1280、48 帧、636270 字节的深度 MP4；ReShot 报告推理约 11.4 秒、流程约 13.4 秒（首次 Python 导入另计）。这不等于人物动作复刻或元素替换效果验收。

`StudioDepthVideoRealTest` 在 `STUDIO_DEPTH_REAL=1` 时验证 Java 调用真实进程、ffprobe、媒体保存及原片不变。普通测试覆盖无配置拒绝、归属、源媒体、渠道能力、深度与原片引用差异、报价；前端覆盖入口、模式保存、输入快照、后台受理与无服务禁用。实际付费生成效果须用目标渠道和代表素材验收，不以结构测试代替。

已通过的远程验证：全仓串行 typecheck（包括两个管理后台）、API 契约、wire mirror、后端编译；前端原回归 116 个用例及新增画布恢复用例 1 个，后端相关回归 100 个用例（含真实 Java → 深度推理），补充输入边界后再通过相关 20 个用例。任务记录分别为 `b89c5205985b`、`40e8e86f921e`、`64cf9cdd6e44`，退出码均为 0。桌面和 390px 手机宽度实测工具箱入口、模式切换与无模型阻止生成，未发现横向溢出；浏览器使用演示数据，未启动付费生成。验收服务与本机 SSH 隧道已释放，其他聊天服务保留。

参考：[用户指定页面](https://maolong.da-ai.cc/toolbox/depth-video-clone)、[ReShot 官方项目](https://github.com/maosika-ai/reshot)、[Video Depth Anything](https://github.com/DepthAnything/Video-Depth-Anything)。本次没有调用参考站的生成服务。

用户补充的 rea-video 与 cangjie-skill 已完成源码评估和切镜模块的隔离实测，结论与复现方式见[补充项目评估](audits/studio-clone-reference-projects-2026-11.md)。已将画面分层和按渠道能力组织生成段落的方法补进复刻规则；rea-video 切镜模块尚未加入运行时。

2026-11-08 完整任务链复验：最终队列 `d7f920798437` 退出码 0，全仓类型、契约、wire 检查、前端相关 38 项、后端相关 66 项全部通过，包含真实深度进程、3 条原生 HTTP/持久化/结算链及 17 秒完整深度视频。验收范围、复现环境和要求核对见[本地验收记录](releases/studio-video-clone-local-validation-20261108.md)。


## 2026-11-08 改版：照 ReShot 的公开做法接入

复盘四条真实成片后发现，深度复刻本身是成熟做法，问题在接法：ReShot README 给 H3 的用法我们有六处没做到。本次照它改，**ReShot 的说明和示例提示词是真源**（github.com/maosika-ai/reshot，`docs/prompts/` 里有交给 H3 的完整示例）。

| ReShot 的要求 | 改之前 | 现在 |
|---|---|---|
| 控制视频要和模型的帧率一致 | ReShot 按「帧序号 ÷ 帧率」取时间，可变帧率原片（9862：13.46 秒 721 帧）动作最多晚 1.25 秒，我们只核总时长查不出 | 先用 ffmpeg 按真实时间戳转成恒定 24 帧再交给 ReShot；时长按画面流核对，不按音轨 |
| 给 H3 的控制视频缩到长边 320（全尺寸会把脸型拉向原片里的人） | 704×1280 | `--max-res 320`（`aep.studio.depth.max-res`） |
| 肢体是看点时用骨骼，近景用深度 | 只有深度。9861 俯拍躺姿的深度图里人和地板一样深，看不到人 | 配了骨骼权重时先出骨骼图，整个人（肩、髋、膝中至少四个，不贴画面边缘，且肩宽不超过画面 35%，即不是近景）可见的帧占比 ≥ 0.5 就用骨骼，否则出深度图；骨骼失败也退回深度。选了哪种记在产物 `controlType` / `poseCoverage` |
| H3 用固定六段式，把视频1 定义成单独的主体：只迁移动作、时间和机位（attribute_transfer），灰色画面 / 火柴人不迁移 | 中文按原文直发「视频1是深度结构视频」 | 深度复刻的视频步骤总是先走 H3 优化（`StudioCloneVideoPlan.optimize`，编辑器里不再给「按原文生成」）；参考清单里视频1 按实际产物写深度图或骨骼图的英文说明（`H3StudioPrompt.controlNote`）；优化稿把它标成完全保留时改回 attribute_transfer，漏写时按 attribute_transfer 补回 |
| 不支持优化的模型 | 同上 | 中文说明照 ReShot 给 Seedance 的写法：参考视频1的动作与运镜、顺序一致，画面里不出现深度图或骨骼线条 |

骨骼还是深度，用 9861 / 9862 原片实测定的规则（每秒一帧的原片 / 骨骼 / 深度对照：`releases/evidence/studio-video-clone-real-20261108/reshot-9861-original-pose-depth.jpg`、`reshot-9862-original-pose-depth.jpg`）：

- 9861 俯拍躺姿：骨骼把每个姿势都画出来了，风扇叶挡住时骨骼正好消失；深度图里人几乎看不见，只剩风扇叶。全身帧占比 0.592（遮挡帧和 3 秒尾卡里没人），所以门槛定 0.5 而不是 0.6。
- 9862 车内近景：骨骼把方向盘后看不到的腿也画了出来，是猜的；深度图保留了方向盘、伸向镜头的手和头肩。肩宽中位数是画面宽度的 0.459（9861 是 0.147），所以肩宽超过 35% 的帧算近景、不计入，9862 回到深度。

还没做的（ReShot 也明确要求）：**用文字逐段写清灰色画面里在发生什么**。现在只能靠用户在要求里写；要做到需要先加一步原片分析（同时可以识别并裁掉平台尾卡，ReShot 要求「先裁到只剩需要的镜头」，9862 带 3 秒抖音尾卡）。人物参考也应换成设定图或关键画面，而不是证件照。这两项和真实付费出片对比记在 TODO。

本轮验证（Mac mini 队列，均未调用付费视频模型）：后端 `36a31ce6894b` 退出码 0，跑了深度服务、真实提取、H3 控制视频、H3 优化、视频优化 worker、复刻计划与复刻任务集成共 8 个测试类；真实提取里 9862 选深度（全身帧占比 0）、9861 选骨骼（0.592），两段都转成恒定 24 帧、长边 320、时长与原片画面一致。前端 `1852881c81dc` 退出码 0：AiAvatar 类型检查、接口契约、4 个测试文件 53 项。Mini 运行时已补装 `reshot[pose]`（onnxruntime 1.31.1）和 DWPose 两个权重（sha256 与 ReShot 公布值一致）。改版后的效果还没有用付费 H3 真实出片对比。
