# 风格短片 · ViMax-lite 前后一致性提升计划

> 状态：P0 / P1 / P2（非视频部分）/ P4 / P5 已实现；P3A/P3B 视频协议、默认模型切换和真实试片按用户要求不做
> last-reviewed：2026-08-18
> 范围：`apps/web-drama` 的 `/shorts/make` 风格短片链路
> 关联真源：[`drama-storyboard-consistency.md`](drama-storyboard-consistency.md)、[`[Fabel5]drama-consistency-engine-design.md`](%5BFabel5%5Ddrama-consistency-engine-design.md)

## 1. 决策摘要

本轮采用「**ViMax-lite 一致性主干**」：借鉴 ViMax 的结构化角色设定、角色基准图、首尾关键帧、机位依赖和跨镜状态传递；暂不引入多 Agent Review、逐镜 VLM 打分、best-of-N 自动筛选、循环反思与自动重写。

本方案不推倒现有 C-1～C-3 / D-11，一致性资产和参考图装配继续复用：

- `DramaReferenceAssembler`：角色、场景、上一镜真实末帧的服务端装配与 `applied_refs` 回报；
- `MaterialVideoJob.lastFrameCdnKey`：真实末帧 CDN key 真值；
- `useShotRender`：短剧工作台和风格短片共享的提交、轮询、任务恢复逻辑；
- `DramaReferenceAssetService`：项目线角色/场景参考资产和多角度参考图能力。

新增工作的重点是补齐风格短片链路的四个断点：

1. 全局视觉设定与台词混在一起，口头禅被每镜重复注入；
2. 无模板时仍会把默认「口播带货」名称写进逐镜提示词；
3. 当前 MiniMax H3 集成固定走纯文生视频，首帧和参考图没有进入视频模型；
4. 「合成成片」只把草稿标为完成，没有生成和持久化真正的整片。

## 2. 当前事实与根因

### 2.1 提示词污染

`apps/web-drama/src/app/(workspace)/shorts/make/page.tsx` 的 `metaPromptPrefix()` 会把整个 `meta.character.description` 注入每镜。人物描述一旦包含口头禅、说话方式或剧情信息，这些文本就会被视频模型理解为每镜都应出现的内容。

同时，`fmt` 在没有真实模板时回落 `SHORT_FORMATS[0]`。显示标签虽已使用中性 `displayName`，但首帧和视频 `styleSuffix` 仍读取 `fmt.name`，因此「风格短片」仍可能收到「口播带货风格」。

逐镜生成目前主要传入 `metaPrefix + visual + lineClause + styleSuffix`；已有的 `beat / move / sfx / bgm / fx` 没有完整进入提示词编译，模型获得的是被污染且信息不完整的镜头指令。

### 2.2 参考图在 H3 视频阶段失效

当前聚算 JusuanHub 协议在 `MaterialVideoModelClient.buildSubmitBody()` 中固定：

```json
{
  "generationMode": "t2v"
}
```

代码会从 prompt 中剥离首帧提示；候选能力也如实配置为：

- `maxRefImages=0`
- `supportsFirstLastFrame=false`
- `supportsSubjectReference=false`

因此，主角图和场景图可以参与首帧出图，但 H3 视频生成仍是一次独立的纯文本生成。人物换装、宠物品种变化、场景漂移和动作不落地，不能靠继续加长文本提示词解决。

### 2.3 成片链路未闭合

风格短片页的「合成成片」当前只执行：

```ts
setDraftStatus("done");
flushSave({ status: "done", progress: 100 });
```

`DramaShortService.previewMedia()` 再从镜头数组里取第一条完成视频作为列表视频。项目线已有真正的 `DramaAssembleService`，但它只服务 `DramaProject`，没有覆盖 `DramaShort`。

## 3. ViMax 借鉴边界

参考实现固定到 ViMax commit `05a48943878312d88fe5a016c12a9654940ecc43`：

- [角色结构](https://github.com/HKUDS/ViMax/blob/05a48943878312d88fe5a016c12a9654940ecc43/interfaces/character.py)：把人物拆成稳定外观 `static_features` 和可变服装/配饰 `dynamic_features`；
- [角色基准图](https://github.com/HKUDS/ViMax/blob/05a48943878312d88fe5a016c12a9654940ecc43/agents/character_portraits_generator.py)：由同一正面基准图派生侧面和背面视图；
- [镜头结构](https://github.com/HKUDS/ViMax/blob/05a48943878312d88fe5a016c12a9654940ecc43/interfaces/shot_description.py)：把镜头拆成首帧、尾帧、画面运动和声音；
- [机位依赖](https://github.com/HKUDS/ViMax/blob/05a48943878312d88fe5a016c12a9654940ecc43/agents/camera_image_generator.py)：用父镜头生成新机位的构图锚，再补缺失的人物信息；
- [生成管线](https://github.com/HKUDS/ViMax/blob/05a48943878312d88fe5a016c12a9654940ecc43/pipelines/script2video_pipeline.py)：先准备角色资产和镜头关键帧，再逐镜生成并最终拼接。

### 3.1 本轮采用

- 一次生成、全片复用的角色视觉基准；
- 静态外观与动态服装/道具分层；
- 场景环境、光线和色板的结构化锁定；
- 每镜显式首帧、尾帧、运动、对白和声音字段；
- 同机位复用与新机位父镜头依赖；
- 前镜结束状态到后镜开始状态的显式传递；
- 已产资产和上游任务的 checkpoint / resume，避免重复付费提交；
- 最终真实成片合成。

### 3.2 本轮明确不做

- 多 Agent 协商、审稿和多轮反思；
- 每镜调用 VLM 检查人物、场景、构图；
- best-of-N 自动生成多版再评分；
- Review 不通过后自动循环重生成；
- 为维持 Agent 长上下文而反复压缩、总结或重放历史；
- 使用大模型选择参考图。

参考图选择改为确定性优先级：`角色身份 > 服装/道具 > 场景 > 上一镜真实末帧 > 同机位根首帧`，再按端点 capability 裁剪并通过 `applied_refs` 如实回报。

## 4. 目标架构

```text
用户创意
  ↓ 现有一次脚本起草调用
脚本 + ContinuityManifest
  ├─ VisualBible：风格、色板、角色静态特征、服装、道具、场景
  └─ ShotPlan[]：机位、首末状态、首末帧、运动、对白、声音
  ↓ 确定性 PromptCompiler（不调用 LLM）
角色/场景基准资产 ──→ 各镜首帧
                         ↓
            镜头依赖 DAG（同链串行、独立链并行）
                         ↓
          首帧/首尾帧图生视频模型
                         ↓
             TTS / 字幕 / SFX / BGM
                         ↓
            ffmpeg 总装 + OSS cdnKey
                         ↓
               DramaShort 最终成片
```

### 4.1 ContinuityManifest

第一阶段先存入 `DramaShort.payloadJson`，不新增独立实体；资产真值仍存 `cdnKey`，出 wire 时重签。建议结构：

```ts
interface ShortContinuityManifest {
  version: 1;
  visualStyle: {
    genre: string;
    rendering: string;
    palette: string[];
    lighting: string;
    forbiddenVisuals: string[]; // 例如画面文字、字幕、水印、现代物件
  };
  characters: Array<{
    id: string;
    name: string;
    staticFeatures: string;
    wardrobe: string;
    props: string[];
    speechTraits?: string;      // 不进入全局视觉 prompt
    referenceCdnKeys: string[];
  }>;
  scenes: Array<{
    id: string;
    environment: string;
    palette: string[];
    lighting: string;
    referenceCdnKey?: string;
  }>;
  shots: Array<{
    id: string;
    no: number;
    sceneId: string;
    camId: string;
    parentShotId?: string;
    castIds: string[];
    startState: string;
    endState: string;
    firstFrame: string;
    lastFrame: string;
    motion: string;
    dialogue?: { characterId: string; text: string; emotion?: string };
    sfx?: string;
    bgm?: string;
    fx?: string;
    durationSec: number;
  }>;
}
```

硬规则：

- `staticFeatures` 只允许可见外观，不允许口头禅、性格、关系和剧情；
- `speechTraits` 只影响 TTS 或指定镜头对白，不进入每镜视觉 prompt；
- 对白只属于一个 `shot.dialogue`，不能复制进全局 meta；
- 状态变化必须在上一镜 `endState` 和下一镜 `startState` 中对齐；
- 角色、场景、镜头引用一律用稳定 ID，不依赖名称模糊匹配；
- `parentShotId` 必须指向更早镜头，DAG 不得成环。

### 4.2 PromptCompiler

逐镜提示词由代码本地编译，不再逐镜调用文本模型：

```text
视觉风格
+ 当前场景环境/光线/色板
+ 当前镜头出现角色的静态特征
+ 当前镜头服装/道具
+ startState → motion → endState
+ 景别/角度/机位/构图
+ 禁止画面文字、字幕、Logo
```

过渡阶段（P0～P3）仍把**当前镜头自己的对白**传给现有有声视频模型，但明确标注为表演/口播内容并禁止画面文字；不得再把对白或口头禅放进全局 meta。P4 的 TTS 和字幕总装就绪后，才从视频模型 prompt 中移除对白原文，改由后期确定性处理。这样既消除跨镜台词污染，也不会在声音管线尚未上线时让成片突然失声。

## 5. 视频模型路线

### 5.1 推荐分层

| 模式 | 模型候选 | 用途 | 产品承诺 |
|---|---|---|---|
| 一致性模式（P3 灰度，P4 后才可默认） | 七牛 `kling-v2-5-turbo` | 首帧/首尾帧图生视频，优先平衡速度与质量 | 支持角色和场景参考约束；声音总装完成前不替换线上默认 |
| 高质量模式 | 七牛 `kling-video-o1` | 对质量要求更高的关键镜头 | 价格按七牛控制台实际单价配置 |
| 快速文生视频 | 当前 `minimax-h3` | 无固定角色、环境空镜、快速草稿 | 明确提示“不保证跨镜人物一致” |

七牛官方 Kling API 使用 `POST /v1/videos` 创建任务、`GET /v1/videos/{id}` 查询；支持文生视频、图生视频、参考图和首尾帧生视频，单条时长为 5 秒或 10 秒：

- [七牛 Kling 视频生成官方文档](https://developer.qiniu.com/aitokenapi/13388/new-video-generate-kling-api)

### 5.2 新协议适配

在 `MaterialVideoModelClient` 新增 `PROTOCOL_QINIU_KLING`：

- 识别条件：七牛 `api.qnaigc.com` 且模型名包含 `kling`；
- submit path：`/videos`，不是现有 generic 的 `/videos/generations`；
- poll path：`/videos/{taskId}`，不是 `/async-result/{taskId}`；
- 时长硬边界：只允许 `5 | 10` 秒；
- `image_list` 显式传入角色/场景参考、`first_frame` 和可选 `end_frame`；
- capability 按具体候选真实配置，不允许用 null/legacy 猜测；
- 请求日志记录 generation mode 和 applied ref roles，但不记录 API Key；
- 已受理任务必须按原 taskId 恢复轮询，禁止自动再次提交。

示意请求：

```json
{
  "model": "kling-v2-5-turbo",
  "prompt": "当前镜头的纯视觉运动描述",
  "seconds": "5",
  "size": "720x1280",
  "mode": "std",
  "image_list": [
    { "image": "https://signed/first-frame.png", "type": "first_frame" },
    { "image": "https://signed/end-frame.png", "type": "end_frame" }
  ]
}
```

实际字段在实现前必须再按当日官方文档和账号可用模型列表确认，不能直接以示意体发起付费请求。

## 6. Token 经济方案

### 6.1 文本模型调用预算

- 脚本、角色视觉设定和 `ContinuityManifest` 合并进现有一次 `drama.script_draft`；
- 不新增 continuity planner 第二次调用；
- 不逐镜调用文本模型重写 prompt；
- 不调用 LLM 选择参考图；
- 不调用 VLM Review；
- 不做语义不满意后的自动重试；
- JSON 解析/网络失败仍可保留现有工程性重试，但需记录次数和 token 用量。

目标：五镜风格短片仍只有 **1 次脚本 LLM 调用**，其余均为本地结构化编译和媒体模型调用。

### 6.2 max_tokens

`drama.script_draft` 的 prompt 级默认上限从 4096 调整为 **6144**，不修改整个端点的全局默认值。

理由：

- 新增清单后 4096 的截断余量偏小；
- `max_tokens` 是输出上限，不代表每次都会消耗 6144；
- 严格 JSON schema、短字段和稳定 ID 可以控制真实输出长度；
- 检测到 `finish_reason=length` 时返回明确错误，不拿残缺 JSON 继续出片；
- 不通过 Review 循环放大 token 消耗。

### 6.3 视频提示词长度

Kling 官方 prompt 最大 2500 字符。逐镜只传当前场景、当前角色、当前状态和当前动作；不重复整份全片设定，不附带历史对话和其他镜头全文。

## 7. 分阶段实施

### P0 — 正确性止血

目标：先修复已证实的提示词污染和假合成，不依赖新模型。

工作项：

1. `metaPromptPrefix` 改为仅输出视觉字段，不包含人物口头禅/对白；
2. 没有模板时 `styleSuffix` 使用 `displayName` 或中性「风格短片」，禁止使用 `SHORT_FORMATS[0].name`；
3. 新建统一 `compileShortFramePrompt` / `compileShortVideoPrompt`，纳入 `beat/move/sfx/bgm/fx`；
4. 视频 prompt 加硬约束：对白仅作本镜表演/口播音频，不得烧成画面文字、字幕或 Logo；P4 前不能直接移除对白；
5. 新增 `DramaShortAssembleService` 或把 `DramaAssembleService` 抽成可复用媒体总装原语；
6. `POST /api/me/drama/shorts/{id}/assemble` 真正下载、排序、拼接、上传 OSS、落 `payloadJson.assembled.cdnKey`；
7. 只有总装成功后才把短片标为 `done`；失败保持 draft，可重试；
8. 列表和预览优先播放最终成片，不再取第一条完成镜头。

实施结果（2026-08-18）：

- 新增 `short-render-prompt.ts`，全局视觉设定不再携带标题、口头禅或人物描述；逐镜显式编译节拍、画面、景别、运镜、特效、当前镜对白、音效与 BGM；
- 无真实模板时改用创意风格名或中性「风格短片」，不再把 `SHORT_FORMATS[0]` 的「口播带货」送进模型；
- 新增 `DramaShortAssembleService` 和 `/assemble` 端点，按镜号校验并拼接全部已验收视频，转码回退、OSS key 真值、签名 URL、存储计量、旧成片清理与输入指纹幂等均已接通；
- 客户端不能再通过 PUT 伪造 `assembled` 或直接标记 `done`；镜头编辑会令旧成片失效，只有服务端合成成功才进入完成态；
- `/shorts/make` 已补合成 loading、失败可重试、缺失媒体提示、成功反馈、窄屏安全宽度和 `aria-live/aria-busy`；
- 自动化门禁：web-drama 40/40、server 全量 626（skip 3）、Next 生产构建 31 路由、admin 生产构建 64 路由、全 workspace typecheck、API contract 均通过；全量 server 在本地测试驱动下显式使用 `aep.cdn.driver=local` 与 H2 `NON_KEYWORDS=CAST`。未发起任何付费模型任务。

主要文件：

```text
apps/web-drama/src/app/(workspace)/shorts/make/page.tsx
apps/web-drama/src/api/shorts.ts
apps/server/.../controller/DramaShortController.java
apps/server/.../service/DramaShortService.java
apps/server/.../service/DramaShortAssembleService.java（新增或复用抽象）
specs/openapi.yaml
```

### P1 — 一致性清单与确定性编译

目标：让全片前后关系成为数据，而不是散落在自然语言中。

工作项：

1. 前端类型增加 `ShortContinuityManifest`；
2. `drama.script_draft` schema 同时返回 manifest；
3. 服务端校验角色/场景/镜头 ID、DAG、时长和状态衔接；
4. 将人物视觉特征与说话特征分栏；
5. 生成 prompt 时只选择当前镜头涉及的数据；
6. prompt、manifest version、模型、端点和参考资产快照随 job 持久化，便于复现；
7. prompt 上限调至 6144，并处理 `finish_reason=length`。

先行实施（2026-08-18）：第 7 项已完成。`DramaScriptService` 的 `drama.script_draft` prompt 级缺省上限改为 6144，运营明确配置的值仍优先；`finish_reason=length` 返回 `AI_OUTPUT_TRUNCATED`，不再把残缺 JSON 当成普通解析失败。admin 两个 Prompt 编辑入口同步显示该动作留空即 6144；共享端点的全局默认保持不变。

实施结果（2026-08-18）：前端类型和草稿契约已加入 `ShortContinuityManifest`；脚本模型仍只调用一次，服务端在响应后确定性派生稳定角色/场景/镜头 ID、父镜依赖、参考优先级和音频时间轴，因此不让模型重复输出冗长 manifest。草稿每次保存都按当前分镜重建 DAG；逐镜 prompt 只读取本镜 scene/cast 的视觉字段，说话特征与台词不进入视觉锚点。

### P2 — 视觉依赖链

目标：在视频生成前先得到稳定的视觉锚。

工作项：

1. 用户上传/选择的主角图作为 canonical identity；
2. 默认只生成一张正面或 3/4 基准图，侧面/背面仅在镜头需要时按需生成，避免无效媒体费用；
3. 场景底图只生成一次并全片复用；
4. 每镜生成首帧；变化较大的镜头再生成尾帧；
5. 同机位复用根首帧，新机位读取 `parentShotId` 的末态；
6. 同一依赖链串行，不同场景/独立机位并行；
7. `applied_refs` 必须保存到镜头，界面展示真实生效数量和被裁剪原因；
8. 用户只需在角色/场景基准资产处做一次人工确认，不做逐镜 AI Review。

实施结果（2026-08-18）：主角数字人/参考图和主场景图作为 canonical ref；镜头依赖表按 `parentShotId` 生成批次，首镜为 anchor、后续镜头为 chain；现有 `DramaReferenceAssembler` 继续按角色 > 场景 > 上一镜末帧裁剪并回报 `applied_refs`。需要实际图像/视频模型调用的按需角度图、首尾帧生成与真实样片未执行。

### P3A — 七牛 Kling 一致性视频协议（灰度，不切默认）

目标：让首帧和参考图真正进入视频模型。

工作项：

1. 新增 `PROTOCOL_QINIU_KLING` submit/poll/body/response 适配；
2. admin 新增或配置 Kling 候选和 capability；
3. 先只作为显式可选/灰度候选，声音总装完成前不得替换线上默认视频模型；
4. 时长在脚本阶段归一为 5 秒或 10 秒，不能提交后才报错；
5. H3 继续保留，但 capability 为 0 时 UI 明示纯 T2V；
6. 先进行 1 个授权样片的人工验收，再决定 `v2-5-turbo` 与 `video-o1` 的默认档位和积分换算；
7. 真实试片必须由用户明确授权，避免无意产生媒体费用。

### P4 — 声音、字幕与确定性总装

目标：把对白准确性从视频模型中拿回来。

工作项：

1. 视频模型只生成无字画面；
2. `shot.dialogue` 按角色音色生成 TTS；
3. SFX/BGM 按时间轴混音；
4. 字幕由平台按原文烧录，模型不得自行生成文字；
5. 合成时归一分辨率、H.264/AAC、帧率、响度和 faststart；
6. 落 `finalVideoCdnKey`、封面 key、真实总时长和完成时间。

实施结果（2026-08-18）：视频 prompt 已改为无字视觉指令，不再携带台词/SFX/BGM 原文；新增逐镜 V2 音色 TTS 准备端点，按台词指纹幂等复用并立即镜像我方存储。Manifest 给每镜生成 `startSec/endSec/sfx/bgm` 时间轴；没有真实 SFX/BGM 媒体 key 时只保留制作建议，不伪造声音素材。总装逐镜用 TTS 真实时长替换源音轨、平台烧录原文字幕，统一 720×1280 / 30fps / H.264 / AAC / loudnorm / faststart，最终 ffprobe 验证音轨和时长，上传视频与封面 key。

P4 验收完成后再执行 **P3B**：将固定角色/固定场景的风格短片默认切到 Kling 一致性模式；快速 H3 仍保留为用户可选的纯 T2V 档。

### P5 — 零 Token 质量门与观测

目标：不用 Review 模型也能阻止明显错误进入付费生成和交付。

生成前：

- manifest schema 完整；
- 所有引用 ID 存在；
- DAG 无环；
- 镜头时长符合所选模型；
- 固定角色模式必须有 canonical identity；
- 一致性模式必须选择 `maxRefImages>0` 的视频候选；
- 预计积分在 hold 前展示。

生成后：

- `applied_refs.applied > 0`；
- 上游 taskId、端点、模型与本地 job 一一对应；
- 不存在一个镜头重复付费提交；
- ffprobe 验证视频可解码、分辨率、音视频流和时长；
- N 个完成镜头必须合成 N 段；
- 最终时长与分镜时长总和误差不超过 0.5 秒或 2%（取较大者）；
- 列表播放 URL 必须来自 `finalVideoCdnKey`。

实施结果（2026-08-18）：新增 `/preflight` 零 Token 质量门与制作页可见状态，覆盖 schema/ID/DAG/画面/时长/canonical ref/applied refs/TTS 指纹/镜头完成度；编辑后状态明确变为待重检。TTS 与总装均以内容指纹恢复，已成功项不重复生成；最终总装检查 N 镜对应 N 段、音轨存在和时间轴偏差，并只从最终 `cdnKey` 派生播放 URL。

## 8. 验收场景

以「喵影江湖」五镜样片作为回归夹具，但不复用已付费任务做重新提交。

### 8.1 语义准确

- 「本喵懒得理你」只出现在指定镜头的 TTS 和字幕中；
- 其余四镜 prompt、画面文字、音轨和字幕均不出现该句；
- 风格短片 prompt 中不出现「口播带货风格」；
- 墨镜、金链、角色被击飞等动作只出现在指定镜头。

### 8.2 视觉一致

- 五镜使用同一个主角 reference asset ID/cdnKey；
- 未声明换装时服装、配饰和毛色不变；
- 同场景光线、建筑材质和主色板保持一致；
- 前镜 `endState` 与后镜 `startState` 对得上；
- 新机位可改变角度和景别，但不能改变角色身份。

### 8.3 请求真实生效

- Kling 一致性请求体含 `image_list` 和正确的 `first_frame`/`end_frame` role；
- `applied_refs` 回报与请求实际一致；
- H3 请求保持 `t2v` 时不得显示“首帧已用于视频”或“角色已锁定”；
- 页面超时或重进只恢复原 taskId，不产生第二条付费生成任务。

### 8.4 成片交付

- 五个成功镜头得到一条真实完整成片；
- 成片包含五段而不是第一镜；
- 总时长与分镜总和相符；
- `DramaShort` 完成态必须具有 `payloadJson.assembled.cdnKey`；
- OSS 签名过期后重新读取仍能通过 key 派生新 URL。

## 9. 实施顺序与门禁

严格顺序：

```text
P0 正确性止血
→ P1 ContinuityManifest
→ P2 视觉依赖链
→ P3A Kling 协议和真实授权样片（灰度）
→ P4 声音/字幕总装
→ P3B 固定角色短片切一致性默认
→ P5 零 Token QA 与观测
```

每阶段至少执行：

```bash
pnpm --filter @ai-star-eco/web-drama typecheck
pnpm --filter @ai-star-eco/web-drama build
(cd apps/server && ./mvnw test-compile)
(cd apps/server && ./mvnw test)
pnpm check:api-contract
```

涉及真实模型前增加只读预检：端点启用状态、模型可用范围、capability、时长、积分报价和 API Key scope；未经授权不发起付费生成。

## 10. 非目标

- 不建设通用 Agent 视频制作平台；
- 不复制 ViMax 的完整 Python pipeline；
- 不把项目线 `DramaProject` 全量迁移到新数据模型；
- 不在本阶段处理长剧跨集记忆；
- 不承诺纯 T2V 模型能稳定保持人物身份；
- 不以增大 max token 代替视觉参考、状态传递和真实总装。
