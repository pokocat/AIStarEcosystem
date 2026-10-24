# AI 导演台与 AID／ViMax 的源码对照

> 核对日期：2026-10-22。范围为指定生成链路及相关 Agent 提示词，不是对两个工程的完整质量审计。
> 本轮已将取舍写入 [提示词 v0.2](../prompts/ai-director-agents-v1.md) 与 [工作流 v0.2](../ai-director-workflow-plan.md)。只修改设计文档，未运行生成、未安装两个工程，也未验证实际画面质量。

## 1. 结论

v0.1 的数据与执行边界较清楚，但创作提示词过于概括，对参考图的具体用途、首尾帧和长剧本处理不够细。
v0.2 吸收 AID 的片段化业务组织、主形象与变体方法，以及 ViMax 的分步写作、参考筛选和首帧／运动／尾帧设计；保留本平台的后台执行、版本与计费真值。

八类 Agent 是职责分工，不等于每次固定串行调用八个模型。新增细节都放在后台，用户仍操作剧本、资产、分镜三个工作区。

## 2. 核查基线与证据边界

本轮通过 GitHub 查询 main，两个 HEAD 与上一轮固定版本相同：

- AID：`7e0ed1512b295e558e9c0accd9c12689076b3547`。
- ViMax：`fd4b72e7731be6e5f88486206d25ea59849b0285`。

代码和公开种子提示词是已观察事实；对本项目的适配、费用和质量收益是设计判断。AID 数据库中的运营提示词可以覆盖种子，因此本文不推断任何线上部署当前用的原词。

## 3. 值得吸收的做法，以及我们的补强

| 主题 | 源码里的长处 | v0.1 缺口 | v0.2 决策 |
|---|---|---|---|
| 故事创作 | ViMax Screenwriter 分发展故事与改成场景剧本两步；提示词强调目标、动机、因果和可视化 | A1 基本是一轮写完整剧本 | 后台先形成故事计划，再按场次展开；长稿分块，不新增必经向导 [V1] |
| 角色与造型 | AID 主形象给完整外观，变体写稳定差异；ViMax 侧／背面由正面参考派生 | 只有“身份与造型分开”的原则 | 增加基准版本、身份不变量与变体差异；按需派生视图 [A1][V2] |
| 提取顺序 | AID 连续剧先角色、后场景与道具；缺图阶段收集缺失形态再生成 | 三类资产的身份关联和覆盖状态未细化 | 先持久化角色身份，后续复用正式 ID；按范围记录提取覆盖，避免漏项 [A2] |
| 镜头细化 | AID 分镜编剧处理当前镜头组，图片与视频链围绕同一组；ViMax 每镜有叙事作用与机位 | A4 容易一次输出整集庞大结构 | 先分场次／片段，再单片段细化；覆盖原文动作与对白，稳定 ID 对齐结果 [A1][A3][V3] |
| 首尾与过程 | ViMax 把镜头描述拆为首帧、尾帧和运动 | 只有 stillMoment，可能把动作完成图当首帧 | 增加首尾静态状态、主体／相机运动及代表时刻；更新信封样例 [V3] |
| 参考筛选 | ViMax 先按文字缩小大参考库，再输入图片；优先同机位、合适视角和近时状态 | A5 没定义大库怎么选、如何避免旧姿态污染 | 系统先锁定必要版本；元数据筛选后再看图，输出每图“沿用／不沿用”内容和适用镜头 [V4] |
| 参考编号 | ViMax 明确选出子集后按子集位置引用；越界索引会拒绝 | 仅规定“系统编号”，缺少回归场景 | 以版本 ID 穿透两次筛选，最终统一编号，校验正文引用与文件顺序相同 [V4] |
| 机位基准 | ViMax 建机位依赖并识别父画面缺失的信息，再补人物参考 | 仅记录 cameraSetupKey，缺少依赖范围 | 同场次复用已确认基准，允许不同场景多个根；不默认额外生成过渡视频 [V5][V6] |
| 候选与恢复 | ViMax 多候选路径持久化 request_fingerprint、各候选状态、选择方式和理由，并可复用有效候选 | 未明确检查规则更新是否需要重生成 | 吸收可追溯选择记录，落入平台版本／任务；生成指纹与检查指纹分开，规则变只重检 [V6] |
| 质检输入 | ViMax 同时比较原参考、候选及目标描述 | 大宫格缩略图可能看不清细节 | 整板检查结合必要单格原图；视频按动作区间提供证据；只有一个候选仍验收 [V7] |

## 4. 不能直接照搬的部分

### AID：借业务链路，不沿用其全部运行假设

1. **前端负责跨阶段推进。** `runStudioFlowAutoPipeline` 在浏览器里逐阶段 await。AID 同时有服务端异步媒体任务，不能因此说它“完全靠前端生成”。本平台需要把跨阶段推进也持久化到后台。[A2]
2. **已有资产数量不等于覆盖完成。** 所读 Runner 的提取步骤在 `existingCount > 0` 时跳过；这是该入口的具体行为，不能泛化为整个工程没有增量提取。本平台按当前源版本、范围和类别判断，防新稿增加资产后被跳过。[A2]
3. **失效引用的运行行为以代码为准。** 图片提示词服务里的 `validateReferencedAssetsExist` 名字与部分注释看似会硬拦，实际末尾记录警告并继续清洗；视频引用解析也存在降级为文字的分支。我们必要引用缺失就阻止对应片段，不能只抄校验函数名。[A3][A5]
4. **宫格输入不能只检查“支持图片”。** 所读宫格视频入口检查创作模式、图片能力并进入图生路径；这不等于已证明任意模型都能正确把宫格展开成多镜头。我们的模型适配需要验证此行为，不支持时走已明确的逐镜路径。[A5]
5. **公开种子提示词有重复公共段落。** 提取职责、输出约束与生成原则即可，公共规则只注入一次，不把多次重复的文本全部搬进每个 Agent。公共规则外仍保留各任务特有约束。[A1]

### ViMax：借视觉方法，适配规格与验收

1. **横屏假设。** 所读角色提示词要求16:9横屏；多候选生成路径默认1600×900，并拒绝 `width <= height`。这些是该实现的默认和局部校验，不代表框架无法修改。我们按实际用途和模型能力校验，不能拒绝正常9:16图。[V2][V6]
2. **择优不是验收。** BestImageSelector 即使没有理想候选也会选择相对较好的一项。多候选路径只有一张有效图时跳过视觉比较；配置只有一个候选时该函数直接调用生图。我们单张仍需验收，所有候选可能都不合格。[V6][V7]
3. **参考策略不能固定。** 所读选择提示词将最多参考数写成8，并倾向每角色一个视角；这些不适合所有模型及多机位宫格。上限取实际模型配置，视角按镜头覆盖需要决定。[V4]
4. **缓存已有进步，不能概括为只有文件存在检查。** 多候选路径确实包含请求指纹和逐候选记录；同一管线另有首帧／成片按文件存在复用的分支。我们统一以平台版本与输入指纹决定有效性，不能用本地文件存在作为业务成功真值。[V6]
5. **机位依赖不能全剧单根。** 所读 camera_image_generator 提示词要求第一机位为根且只有一个无父机位，这适用于其输入范围。跨多场次适配时需按场次划分，否则会把无关空间强连起来；其通过过渡视频获取新机位的方法也不作为默认必走步骤。[V5][V6]

## 5. 我们自己的方案需要继续克制

- 不把每个字段都做成用户必填。创作目标与设计可按用户授权自动补齐，已采用事实不能被静默改变。
- 不把所有步骤都做成自由 Agent：文件校验、编号映射、预算、依赖图、幂等和状态恢复用确定性程序处理。
- 不让生成提示词的 Agent 自己决定全部验收项目。必须项来自用户要求与采用计划，生成器只能补充检查项。
- 不把“多候选+多次反思”作为默认。先一张候选与一次必要检查，失败按原因修复；只在明确选择或预算允许时扩展候选。
- 不把视觉模型当可靠性100%的裁判。保留 unknown、证据及人工纠正；无法看清先补图／补帧，不先重生成。
- 先做好角色、场景、关键道具的可观测一致性。复杂精确空间推理、全自动完美连贯不作首版承诺。

## 6. 怎么证明这些改动有用

先使用同一个“拿信封并回头”的小片段验证首帧／代表图差异，再加入跨集换装、正反打、角色别名、多人参考超限、长稿末段覆盖和候选全错用例。
固定输入素材、模型配置及预算比较 v0.1 与 v0.2；记录原文覆盖、引用正确率、身份／道具一致性、关键动作完成情况、人工修改量、成本与耗时。生成有随机性，不能以单个漂亮结果证明普遍提升。
本轮只完成源码对照与设计修订；上述效果评测尚未执行。

## 7. 固定版本来源

| 编号 | 核查源码 |
|---|---|
| A1 | [AID 内置 Agent 提示词：aid-init.sql](https://github.com/gzxx-2025/aid-studio/blob/7e0ed1512b295e558e9c0accd9c12689076b3547/sql/aid-init.sql)，关注 casting_director、visual_stylist、scene_stylist、prop_stylist、storyboard_writer、grid_painter、visual_director_grid |
| A2 | [AID studioFlowAutoPipelineRunner.ts](https://github.com/gzxx-2025/aid-studio/blob/7e0ed1512b295e558e9c0accd9c12689076b3547/frontend/web/utils/studio/studioFlowAutoPipelineRunner.ts)，关注 runExtractStage、runFormImageStage、runStudioFlowAutoPipeline |
| A3 | [AID StoryboardImagePromptServiceImpl.java](https://github.com/gzxx-2025/aid-studio/blob/7e0ed1512b295e558e9c0accd9c12689076b3547/aid-interface/aid-interface-main/src/main/java/com/aid/rps/service/impl/StoryboardImagePromptServiceImpl.java)，关注 buildLlmInputGrid、validateReferencedAssetsExist |
| A4 | [AID StoryboardVideoPromptServiceImpl.java](https://github.com/gzxx-2025/aid-studio/blob/7e0ed1512b295e558e9c0accd9c12689076b3547/aid-interface/aid-interface-main/src/main/java/com/aid/rps/service/impl/StoryboardVideoPromptServiceImpl.java)，关注 buildBatchLlmInputGroup、appendBatchOutputContract、continuityAssembler 调用 |
| A5 | [AID StoryboardVideoGenerationServiceImpl.java](https://github.com/gzxx-2025/aid-studio/blob/7e0ed1512b295e558e9c0accd9c12689076b3547/aid-interface/aid-interface-main/src/main/java/com/aid/storyboard/service/impl/StoryboardVideoGenerationServiceImpl.java)，关注 generateVideoFromGrid、resolveReferences |
| V1 | [ViMax screenwriter.py](https://github.com/HKUDS/ViMax/blob/fd4b72e7731be6e5f88486206d25ea59849b0285/agents/screenwriter.py)，关注 develop_story、write_script_based_on_story |
| V2 | [ViMax character_portraits_generator.py](https://github.com/HKUDS/ViMax/blob/fd4b72e7731be6e5f88486206d25ea59849b0285/agents/character_portraits_generator.py)，关注三种视角模板和 reference_image_paths |
| V3 | [ViMax storyboard_artist.py](https://github.com/HKUDS/ViMax/blob/fd4b72e7731be6e5f88486206d25ea59849b0285/agents/storyboard_artist.py)，关注 design_storyboard、decompose_visual_description |
| V4 | [ViMax reference_image_selector.py](https://github.com/HKUDS/ViMax/blob/fd4b72e7731be6e5f88486206d25ea59849b0285/agents/reference_image_selector.py)，关注文本预筛、图像筛选、子集索引 |
| V5 | [ViMax camera_image_generator.py](https://github.com/HKUDS/ViMax/blob/fd4b72e7731be6e5f88486206d25ea59849b0285/agents/camera_image_generator.py)，关注 select_reference_camera 模板 |
| V6 | [ViMax script2video_pipeline.py](https://github.com/HKUDS/ViMax/blob/fd4b72e7731be6e5f88486206d25ea59849b0285/pipelines/script2video_pipeline.py)，关注 generate_frames_for_single_camera、generate_and_select_best_image |
| V7 | [ViMax best_image_selector.py](https://github.com/HKUDS/ViMax/blob/fd4b72e7731be6e5f88486206d25ea59849b0285/agents/best_image_selector.py)，关注比较提示词和 BestImageResponse |

引用用于追溯设计依据；本文没有原样复制大段外部提示词。后续移植代码或原文片段时保留项目许可与版权说明。
