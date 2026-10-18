# web-drama 全局审计报告：产品逻辑 × 技术架构（2026-07-04）

> 审计对象：`apps/web-drama`（AI 短剧生成，Next 16）+ `apps/server` drama 域 + 相关文档真源。
> 审计约定：**只列问题、不足与改进方案，不评价优点**。本文档是交付给后续执行 agent 的工作输入，
> 所有断言尽量带 `file:line` 证据；业界对标以 ViMax（HKUDS）与 2025-2026 头部视频模型 API 为参照。
> 执行纪律：本文任何建议落地时仍须遵守 AGENTS.md §4.7（OSS/key-only）、§8.0（禁静默降级）、§5（新增领域 SOP）。

---

## 0. 总评（TL;DR）

产品侧：完整走通了「脑暴→立项→设定→分镜→出片→合成」的骨架，但**离"可上市的短剧生产工具"还差三块承重墙**——
① 一致性目前是"前端拼参数 + 人工挑图"的 best-effort，没有系统级保证，也没有度量；
② **音频线整体缺失**（分镜表有台词/BGM/音效字段，但审计未发现任何配音 TTS / BGM 合成 / 音画混流链路，成片合成只是无声视频 concat）——没有声音的短剧不成立；
③ 逐镜手工出片对 60-120 镜的多集项目在操作成本上不可行，缺"串行自动流水线"。

技术侧：**一致性语义全部活在前端组件里**（`epscript.tsx` 内的 `shotRefImages()` 拼参考图、承接开关、体检），服务端只做 URL 透传——这意味着一致性能力无法被批量流水线、自动重试、跨端（短视频线）复用，也无法演进为 VLM 自动质检闭环。数据模型（payloadJson 单列 LONGTEXT）与任务编排（@Async 内存态、宕机即失联）是另外两个会在用户量上来后先爆的点。

与 ViMax 的差距收敛为两件事：**显式 shot 依赖图 + 拓扑调度**（非相邻镜的跨镜一致 + 并行加速），和 **VLM best-of-k 自动质检闭环**（替代人工挑 4 版首帧）。这两件事都要求一致性逻辑先从前端下沉到服务端。

---

## 1. 核心瓶颈专章：视频生成一致性

### 1.1 现状盘点（v0.97 P0/P1/P2 之后我们在哪）

已落地的机制（真源 `docs/drama-storyboard-consistency.md`）：

| 层 | 已做 | 实现位置 |
|---|---|---|
| 文本层 | 电影语言 prompt 规则、`camId` 机位字段（仅透传，未使用） | `prompts/material/drama.epscript.md` 等 |
| 图像层 | ref_images = @提及角色参考图 + 场景参考图（`sceneRefId` 显式绑定）+ 同场上一镜末帧，去重限 6 张 | `epscript.tsx:643`（`shotRefImages`） |
| 视频层 | seedance 首尾帧协议 + `return_last_frame` → `lastFrameUrl` 回填 → 下镜链式承接；`drama.decompose` 拆镜 | `MaterialVideoModelClient.java`、`DramaRenderService.java:321-373` |
| 出片前 | `shotConsistencyIssues` 体检（缺定妆图/缺场景绑定/上镜未出片）+「建议逐镜按顺序出片」文案 | `epscript.tsx:670` |

对照业界（Kling Multi-Image Reference、Vidu Q2 七图参考、PixVerse `@ref_name`、Seedance reference-first），
**参考图管线的"接口能力"我们已经对齐主流；差的是接口之上的"系统"**。

### 1.2 差距清单（按严重度排序）

**G-1｜一致性是"建议"不是"保证"，且完全无度量。**
体检只产出警告文案，用户可无视；生成后没有任何自动校验（人脸相似度、场景相似度、VLM 打分），
"这一镜和上一镜是不是同一个人"全靠肉眼。ViMax 的做法是每个生成任务并行 k 个候选 → VLM judge
按视觉保真/叙事一致打分取 argmax（文档 §8 自己也承认 best-of-N 自检是"后续可选"）。
**没有度量就没有 SLA，没有 SLA 就没法对外承诺一致性——这直接卡住上市。**

**G-2｜一致性语义全部在前端，服务端只是哑管道。**
- `shotRefImages()` 的优先级链（@cast → 文本匹配 → 全员）、`chainConsistency` 开关、
  `prevSceneFrame()` 同场回溯——全在 `epscript.tsx` 组件内。
- 服务端 `DramaRenderService.callImageModel` 只把 `ref_images` 数组过滤后塞进 `extra_body.image`
  （`DramaRenderService.java:192-222`），对"哪张是角色、哪张是场景、哪张是承接帧"零感知。
- 后果：① 短视频线（`shorts/make`）要复用一致性就得复制代码（现状确实复制了）；
  ② 未来做"服务端串行自动流水线 / 批量出片 / 失败自动重试"时，服务端不知道该拿什么参考图重试；
  ③ VLM 质检、依赖图调度都没有落点。

**G-3｜角色/场景没有实体，参考图是散落在 JSON 文档里的裸 URL。**
- 角色是 `payloadJson.characters[]` 内嵌对象（`DramaProjectService.java:576-586` 生成 "ch_1" + 预设头像），
  场景是 `payloadJson.scenes[]`，均无独立表、无参考图集（一角色只有一张定妆图）、无 identity embedding /
  face id / per-character LoRA 的挂载点、无跨项目复用（v0.61 的 DapAvatar 引用只覆盖"形象来源"，
  没有覆盖"多角度参考图集 + 一致性资产"）。
- 业界趋势是 "Stateful identity anchoring"：角色身份是持久资产而非每次 prompt 描述。
  单张定妆图 + 文本描述的上限就是"像但不稳"，尤其侧脸/远景/动作镜头。

**G-4｜链式承接是"相邻镜"级别，没有 shot 依赖图，非相邻镜必漂。**
当前承接 = 同场上一镜末帧。但短剧叙事常见"场 A 镜 3 → 场 B 插叙 → 场 A 镜 4"，
回到场 A 时承接链已断（只有场景参考图兜底）。ViMax 的核心创新正是规划期构建
shot 依赖图（共享角色/环境/道具的镜相互连边），按拓扑序做 reference-conditioned 生成——
非相邻镜也能锚定同一视觉真源，且无依赖的镜可并行（我们现在的"建议逐镜串行"恰好放弃了并行）。

**G-5｜跨集一致性完全空白。**
episodeDocs 按集隔离解决了"互相覆盖"，但也意味着第 2 集出片时对第 1 集的视觉产物零感知。
多集短剧的主角必须跨集同脸同衣（换装需显式）；当前唯一跨集锚是全局 characters 的那张定妆图。

**G-6｜末帧承接的工程实现脆弱。**
- `lastFrameUrl` 存的是**上游模型的临时 URL**（文档 §8 自认"best-effort 有时效"），过期后链路静默断掉；
  未做 CDN 镜像（违背 §4.7 资产真值精神——它就是一个会过期的外部资产）。
- `renderClip` 把首尾帧 URL **拼进自然语言 prompt 文本**（`DramaRenderService.java:348-349`
  "（严格基于该首帧画面延展动态：URL）"）——对 GENERIC 协议模型这只是撞运气，模型多半不会去抓 URL；
  真正结构化传参只有 SEEDANCE 分支。等于"非 seedance 模型下一致性承接静默失效"，与 §8.0 精神冲突
  （传入不生效可以，但用户全程无感知）。
- dev/local 下 `isFetchableImageRef` 把 `/cdn`、localhost 参考图全部过滤（`DramaRenderService.java:417-421`），
  只打 WARN——本地联调时"看起来开了一致性，实际一张参考图都没送"，且前端不知情。

**G-7｜"逐镜手工出片"与 60s+ 内容规模矛盾。**
单集 60-90s ≈ 10-20 镜，一部 6 集试水剧 = 60-120 镜。每镜要：出 4 版首帧 → 人工挑 → （可选拆镜出末帧）→
出片 → 验收。全程串行人工。没有"串行自动流水线"（文档 §8 列为待办）、没有批量出片、
没有队列可视化。这是把 ViMax 用依赖图并行解决的问题反向做成了人肉瓶颈。
**上市语境下，这是获客后的第一个流失点。**

**G-8｜一用途一端点（AiAppBinding 主键即 purpose），一致性没有"模型能力路由"。**
首尾帧只有 seedance 支持；多参考图各家上限不同（Kling/Vidu 7 张、别家 4 张）。
当前架构下无法表达"这镜需要首尾帧 → 路由到 seedance；那镜只要 i2v → 用便宜模型"。
D-11 多模型不只是商业化定价问题，**是一致性管线的能力调度前提**。

### 1.3 目标架构：把一致性做成服务端的「一致性引擎」

建议把一致性从"前端交互特性"升格为服务端子系统，分五层。这是本报告最重要的建议，
后续 C-序列路线图全部围绕它展开。

```
┌─────────────────────────────────────────────────────────┐
│ L4 修复层（可选，最后做）                                    │
│   段间光照/风格融合、face-restore 兜底（SkyReels 模式）        │
├─────────────────────────────────────────────────────────┤
│ L3 质检层：VLM Judge                                       │
│   best-of-k 自动选优 + 一致性打分（角色相似/场景相似/规格符合）  │
│   分数落库 → 低分自动重试(换 seed/换参考) → 仍低分才交人工      │
├─────────────────────────────────────────────────────────┤
│ L2 生成编排层：Shot DAG Scheduler                           │
│   规划期建 shot 依赖图（角色/场景/道具共享 → 连边）             │
│   拓扑调度：无依赖并行、有依赖等上游关键帧；                     │
│   keyframe-first：先出全部首帧(可并行) → 再 FLF2V 出片(可并行)  │
├─────────────────────────────────────────────────────────┤
│ L1 参考装配层：Reference Assembler（服务端）                  │
│   输入 shotId → 输出结构化参考包：                            │
│   {character_refs[](多角度), scene_ref, anchor_frame,       │
│    prev_last_frame, style_anchor}                          │
│   槽位化（不再是无差别 URL 数组），按目标模型能力裁剪/降级并回报    │
├─────────────────────────────────────────────────────────┤
│ L0 一致性资产层：Character/Scene 实体化                       │
│   drama_characters / drama_scenes 独立表；                   │
│   角色参考图集（正/侧/全身/表情，cdnKey 真值）；                 │
│   场景参考图集；全局风格锚图；(远期) per-character LoRA/embedding│
└─────────────────────────────────────────────────────────┘
```

各层要点与落地约束：

**L0 实体化（先行，其他层的地基）**
- 新表 `drama_character`（projectId、name、dapAvatarId?、refImages[]（cdnKey，带 angle/expression 标签）、
  appearance 结构化描述、voiceId 预留）与 `drama_scene`（refImages[]、mood、styleTags）。
- payloadJson 里的 characters/scenes 保留为编辑器视图，但**渲染真值改从实体表取**（过渡期双写）。
- 按 §5 SOP 走 types → api → server mirror → openapi 全链。
- 收益：跨集/跨项目复用、多角度参考图集、给 L1 提供槽位数据、给未来 LoRA/embedding 留挂载点。

**L1 服务端参考装配（把 `shotRefImages()` 搬家并升级）**
- 新端点语义：render/frame、render/clip 不再收 `ref_images: string[]`，改收 `shotId`（或结构化槽位包），
  服务端按 shot.cast + scene 绑定 + DAG 上游产物装配参考。
- 按模型能力矩阵（L1 持有每个端点的 capability：max_ref_images / supports_flf / supports_subject_ref）
  裁剪并**在响应里回报实际生效的参考**（修 G-6 的静默失效：前端能展示"本次生效参考 4/6 张，末帧未生效（模型不支持）"）。
- 顺带修掉 dev 参考图被过滤的暗坑：local driver 下把 /cdn 资产临时签成外网可达 URL 或走 base64 inline。

**L2 Shot DAG（借 ViMax 的核心创新，但工程上做减法）**
- 不需要通用图引擎：`drama_shot_job` 表 + `depends_on` 列 + 状态机（pending/blocked/running/judging/done/failed）
  就够。依赖边生成规则：同场相邻镜（时序承接）、同角色关键镜（identity 锚）、同机位 camId（画面复用）。
- 「一键顺序出片」= 把整集 shots 建成 DAG 提交，服务端拓扑推进：首帧层全并行 → 出片层按依赖推进；
  每完成一镜自动把末帧/关键帧喂给下游。前端从"操作者"变"监工"（进度视图 + 低分镜召回人工）。
- 这同时解决 G-7（人肉串行）和宕机恢复（见 §3 任务编排）。

**L3 VLM 质检（替代 4 版人工挑，人工降级为兜底）**
- 新 purpose `VISION_JUDGE`（走 AiAppBinding 多模型改造后的能力路由）；prompt key `drama.judge_frame` /
  `drama.judge_clip`，按 §8.0：未配置 → 跳过质检但明确标注"未质检"，绝不伪造分数。
- 打分维度：角色一致（vs 参考图集）、场景一致（vs 场景锚）、规格符合（vs 分镜描述）、画质。
  分数落 `drama_shot_job.judge_score`，低于阈值自动重采样（换 seed / 增补参考），N 次仍低分 → 进人工队列。
- 计费：judge 每次调用真实成本低（VLM 看图），可打包进出片单价，不单独立扣费点（避免用户为质检犹豫）。

**L4 修复层（明确降级为远期，不要现在做）**
换脸/融合模型是兜底不是主线（业界共识：一致性预算花在生成前）。列入 backlog 即可。

### 1.4 一致性路线图（C 序列，供排期）

| # | 内容 | 依赖 | 预估量级 |
|---|---|---|---|
| C-1 | 末帧 CDN 镜像（出片成功即 `cdnUploader.upload` 落 cdnKey，修 G-6 时效性）+ 参考生效回报（响应体加 `applied_refs`） | 无 | 小 |
| C-2 | L0 角色/场景实体化 + 多角度参考图集（角色 sheet：一键生成 正/侧/全身 三视图） | 无 | 中 |
| C-3 | L1 服务端参考装配（shotRefImages 下沉 + 模型能力矩阵 + 短视频线共享） | C-2、D-11 | 中 |
| C-4 | L2 Shot DAG + 「一键顺序出片」（含任务持久化/恢复，见 §3.2） | C-3 | 大 |
| C-5 | L3 VLM best-of-k 质检闭环 | C-3（D-11 提供 judge 模型路由） | 中 |
| C-6 | 跨集一致锚（角色实体天然跨集 + 集间"上一集定妆快照"参考）+ 全局风格锚图 | C-2 | 小-中 |

D-11（多模型）应提级为 C 序列的前置依赖，与 C-2 并行启动。

---

## 2. 产品逻辑问题（用户视角）

**P-1｜音频线缺失（上市阻断级）。**
分镜表有台词/音效/BGM 列（`BoardShot.sfx/bgm`），但它们只是喂视频 prompt 的文本；
审计未发现任何 TTS 配音、BGM 生成/选曲、音画混流的链路；`DramaAssembleService` 只做视频 concat
（`DramaAssembleService.java:78-146`），音轨编码不一致时甚至可能 concat 失败。
**成片 = 无声视频**。需要：台词 → TTS（与 DapAvatar 音色联动，TODO 里 Phase 2 已有此意）→
逐镜音轨 → assemble 时 ffmpeg 混流 + BGM ducking + 字幕烧录（台词字段现成）。这是独立大 Epic，建议紧随 C-4。

**P-2｜成片合成是"拼接"不是"成片"。**
零转场（末帧闪跳）、无片头片尾、无字幕、无水印、帧率/PTS 不对齐会卡顿。对标竞品的最低线：
转场（哪怕只有 cut/fade 两种）+ 字幕烧录 + 统一转码。

**P-3｜逐镜手工出片的操作成本与内容规模不匹配**（= G-7 的产品面）。
无批量出片、无"整集自动流水线"、无队列/进度中心（轮询 5s 一跳、无进度百分比，`epscript.tsx:459-507`）。
用户在 20+ 镜的集里的真实体验是"点一下等两分钟，重复二十次"。
建议的交互终态：分镜表顶部「整集出片」→ 提交 DAG → 表格变成实时进度看板（每镜状态流转、
低分镜标红召回）→ 用户只处理异常镜。

**P-4｜一致性交互是"開關+警告"，用户无法感知也无法信任。**
`chainConsistency` 是一个布尔开关，体检是可无视的文案。用户看不到"这一镜用了哪些参考图"、
"生成结果一致性得分多少"。建议：镜行内展示参考缩略图 chips（点击可增删）+ 出片后一致性分徽标
（L3 落地后）；把"信任"做成可见的。

**P-5｜创作链路的断点：大纲/剧本改动不回溯。**
分镜生成后若回改剧本/大纲，已出片的镜不会标脏，没有 diff 提示"哪些镜与新剧本不一致"。
多集项目里几乎必然发生（改人设、改结局）。建议：script→storyboard 建立字段级指纹，
上游变更时给下游镜打"内容已过期"角标（不强制重出，用户决策）。

**P-6｜短视频线与剧集线是两个产品的成本、一个产品的心智。**
`shorts/make`（1340 行）与 `epscript.tsx`（1113 行）功能高度重叠但代码分裂
（`use-shot-render` 在 Epic-3 已随 factory 删除，"共享渲染引擎"名存实亡——
README v0.98 记录了抽取又删除的全过程）。用户视角两边的能力差异（短视频有"一键全出"、
剧集反而没有；beat 标签只在短视频）没有产品理由，纯粹是实现分裂的副作用。

**P-7｜移动端完全缺失。**
表格最小宽 940px、hover 交互（首末帧预演）无触屏等价物、无响应式。短剧创作者的巡检/验收场景
（在手机上看片、点验收）是真实需求；至少"查看+验收"路径要可用。

**P-8｜失败与重试体验粗糙。**
失败 = toast + 解锁按钮，用户手动重点；无自动重试、无失败原因分级（额度不足/模型超时/内容违规
应有不同引导）；`.catch(() => {})` 静默吞掉防抖保存失败（`epscript.tsx:245`），
用户可能在不知情下丢编辑。

**P-9｜计费颗粒度与心智负担。**
10 个 `drama.credit.*` 扣费点分散在每个按钮上，用户难以预估"做完这一集要花多少"。
建议：整集出片前给出预算估算（镜数 × 单价 + judge/decompose 附加），DAG 提交时一次 hold 总额。
另注意 v0.98 前分镜视频单价曾耦合带货线（`material.video-generate`），
虽已解耦为 `drama.credit.clip`，openapi/PRODUCT.md 的单价出处需复核同步。

---

## 3. 技术架构问题

### 3.1 数据模型：payloadJson 单列文档已到承载极限

事实：`DramaProject.payloadJson` 单列 LONGTEXT 装下整个项目（`DramaProject.java:58`），
读写为整树 `readTree → deepCopy → write`（`DramaProjectService.java:149`）。

问题（按爆炸顺序）：
1. **并发 Last-Write-Wins**：PUT 全量覆盖，无版本号/ETag。同一项目"前端编辑分镜表"与
   "后端异步任务回填 lastFrameUrl / 成片 URL"是真实并发（不是假设），函数式 `patchData` 只保护了
   前端内部，服务端两个写者之间没有任何仲裁。DAG 流水线（C-4）落地后写并发会放大 10 倍。
2. **无 schema、无版本化**：字段演进靠前端 TS + 后端 normalize 兜底，老文档升级路径不可审计。
3. **查询无能**：无法按"哪些镜已出片""哪个角色被哪些镜引用"查询——这恰是 DAG 调度和
   质检统计必需的查询。
4. **签名 URL 埋雷已爆过一次**（v0.98 补丁 4：payloadJson 存签名 URL → TTL 过期图裂 → 出 wire 递归重签），
   `DramaShort` 同类债 D-12 还欠着。文档里继续堆 URL 就会继续爆。

建议的演进（不是推倒重来）：
- **文档-实体混合**：payloadJson 保留为"编辑器文档"（脚本文本、UI 状态、大纲），
  但**渲染流水线相关的真值拆表**：`drama_shot_job`（C-4）、`drama_character` / `drama_scene`（C-2）、
  渲染产物（已有 MaterialVideoJob，补 frame 产物表）。原则：**会被服务端流程读写的数据必须出文档入表**；
  只被编辑器读写的数据留文档。
- 文档写入加乐观锁（version 列 + If-Match），冲突时返回 409 让前端合并——成本低，先做。
- 文档内资产一律存 cdnKey 不存 URL（对齐 §4.7.7 新代码首选），出 wire 统一派生。

### 3.2 任务编排：@Async 内存态，宕机即失联

事实：视频任务 `@Async("materialVideoExecutor")` 线程内 while 轮询（`MaterialVideoWorker.java:109-150`），
队列容量 128 满即 reject，无 @Scheduled 恢复扫描。

问题：
1. **重启丢 in-flight**：status=generating 时重启，任务永久卡死，前端无限轮询，积分 hold 悬挂
   （releaseHold 幂等但没人触发）。
2. **无重试**：上游一次网络抖动 = 任务失败 = 用户手动重来（重新扣费流程重走）。
3. **无背压**：128 队列满直接 reject，没有 429/排队位次反馈。
4. C-4 的 DAG 调度不可能建立在这个地基上。

建议：**DB-backed job queue + 恢复扫描**（不必上 Temporal/Kafka，Spring 单体内可解）：
- job 状态机全部落表（MaterialVideoJob 已有雏形，补 `leaseUntil`/`attempt` 列）；
- worker 改为"认领-租约"模型：@Scheduled 扫描到期/pending 任务认领执行，轮询进度也落表；
- 重启后扫描 generating 且租约过期的任务 → 恢复轮询（上游 taskId 已存，可续查）或按 attempt 重试；
- hold 悬挂对账：@Scheduled 巡检超龄 hold 自动 release（财务一致性，对齐积分账本纪律）。

### 3.3 AI 集成层

- **AiAppBinding 主键=purpose**（`AiAppBinding.java`）：单点、无 fallback、无能力元数据。
  D-11 的改造建议**同时引入 capability 描述**（max_ref_images / supports_flf / supports_subject_ref /
  max_duration_sec / 单价），这是 L1 参考装配和 C-5 质检路由的数据基础——只做"多选一"会再改一次。
- prompt 体系（PromptService 三层 + origin=code 503）方向对，但**媒体 prompt 把结构化参数
  （首尾帧 URL）拼成中文自然语言**是协议错位（G-6）；应当"结构化参数走协议字段、prompt 只描述内容"。
- dev-fake-llm 不覆盖图像/视频质检路径；C-5 落地时需扩 fake judge 分支，否则 E2E 无法门禁。

### 3.4 前端工程

- **双线渲染逻辑分裂**（= P-6 技术面）：重建共享 `useShotRender` hook（这次放 `src/lib` 或独立包，
  消费方为 epscript + shorts/make 双端，不再随某个 stage 陪葬）。C-3 服务端装配落地后此 hook 会显著变薄，
  建议与 C-3 同期做，避免白抽一次。
- **`EpScriptStage` 1113 行 / `make` 1340 行**：9+ useState、渲染/轮询/拆镜/改写/保存全内联；
  拆 `useShotPolling` / `useDecompose` / `useEpisodePersist`。
- **分镜表无虚拟化**：100+ 镜 × 富文本单元格，全量渲染。上虚拟滚动（表格结构适合 @tanstack/virtual）。
- **轮询升级 SSE**：DAG 时代每集几十个任务，5s 全量轮询不可持续；server 已有任务表，
  加 SSE 端点推状态变更（D-4 早已列此项）。
- prop drilling（StoryboardTable 10+ 回调）→ 引入 stage 级 context；硬编码常量
  （FRAME_COST/SHORT_*_COST 展示价与后端配置价可能漂移）→ 全部改读 `/me/drama/config`。

### 3.5 测试缺口

- 单测覆盖 CRUD/AI 起草/规范化，但**渲染管线、ffmpeg 合成、末帧承接闭环零集成测试**；
  一致性（本审计的核心资产）没有任何回归防线——参考图装配优先级链改坏了不会有测试红。
- 建议随 C-3 落地补：Reference Assembler 纯函数化 + 单测矩阵（cast/场景/承接/能力裁剪组合）；
  fake 模型服务扩协议分支（SEEDANCE 首尾帧回传、judge 打分）后跑 E2E；
  payloadJson 大文档（10 集×100 镜）序列化性能基准。

---

## 4. 优先级总表（供排期，P0=上市阻断）

| 优先级 | 事项 | 出处 |
|---|---|---|
| P0 | C-1 末帧 CDN 镜像 + 参考生效回报（修静默失效） | G-6 |
| P0 | C-2 角色/场景实体化 + 多角度参考图集 | G-3/G-5 |
| P0 | D-11 多模型 + capability 元数据（提级为一致性前置） | G-8/§3.3 |
| P0 | 音频线 Epic（TTS 配音 + 混流 + 字幕烧录） | P-1 |
| P1 | C-3 服务端参考装配 + 双线共享 useShotRender | G-2/P-6 |
| P1 | §3.2 DB-backed job queue + 恢复/重试/hold 对账 | 任务编排 |
| P1 | C-4 Shot DAG +「整集出片」流水线 + SSE 进度 | G-4/G-7/P-3 |
| P1 | payloadJson 乐观锁 + 渲染真值拆表 | §3.1 |
| P2 | C-5 VLM best-of-k 质检闭环 + 一致性分可视化 | G-1/P-4 |
| P2 | 成片合成升级（转场/统一转码/PTS 对齐） | P-2 |
| P2 | 分镜表虚拟化 + EpScriptStage 拆分 + 失败重试体验 | §3.4/P-8 |
| P3 | C-6 跨集锚 + 全局风格锚图；脚本→分镜脏标记；移动端验收路径；整集预算估算 | G-5/P-5/P-7/P-9 |

---

## 附：业界对标要点速查（调研摘录）

- **ViMax**（[GitHub](https://github.com/HKUDS/ViMax) / [arXiv 2606.07649](https://arxiv.org/html/2606.07649v1)）：
  层级分解（叙事→事件→场景→镜）；keyframe-first 两段式；**shot 依赖图 + 拓扑并行**；
  Reference Manager 智能选参考图；**VLM best-of-k 自动质检**；同场多机位用"过渡视频"做 3D 空间锚。
- **模型 API 能力（2025-2026 已成标配）**：Kling 1.6+ 多图主体参照、2.1 首尾帧；MiniMax S2V-01
  `subject_reference` 单脸锁全片；Vidu Q2 七图多实体参照；PixVerse C1 `@ref_name` 具名参照；
  Seedance 参考图分槽（角色/环境/道具）+ 首尾帧 + `return_last_frame`。
- **长视频四模式**：① keyframe-first（先图后片）② last-frame chaining（真实末帧续写）
  ③ anchor 关键帧序列 + FLF2V 并行补帧（段间无依赖、总时长≈单段耗时）④ scene anchor + 后期融合修复
  （SkyReels 专训融合模型；业界共识修复只是兜底）。
- **短剧平台**：SkyReels 自研 StoryboardGen 多智能体保跨分镜一致 + 专训图层融合模型；
  井英科技建"AI 演员库"+短剧专用服装/场景数据集。
