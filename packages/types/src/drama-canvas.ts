// ─────────────────────────────────────────────────────────────────────────────
// drama-canvas.ts — web-drama「画布」契约真源（v0.198，设计真源 docs/drama-canvas-plan.md）。
//
// 画布 = 照小云雀「短剧 Agent」做的一条独立流水：剧本 → 角色和场景 → 逐集制作 → 单集编辑器（按片段出片）→ 合成成片。
// 它和原来的「我的短剧」（DramaProject / 旧工作台）**互相独立**：自己的表、自己的入口、自己的列表。
//
// server 侧 `com.aistareco.aep.dto.DramaCanvas*` / `Canvas*` 的 record 字段名必须与本文件 1:1（AGENTS.md §4.1）。
// 时间字段一律 ISO 8601（§4.8）。
//
// 四条红线（照 AI IP 工作台踩过的坑，见 AGENTS.md 顶部 ipstudio 段）：
// 1. 文档里的图 / 视频**只存 key**，`url` / `lastFrameUrl` 只在出 wire 时由服务端派生（签名有 TTL，存 URL 1 小时后就裂图）。
//    服务端落库前剥掉所有 `url`，读出时只给**属于本人**的 key 重签（不是本人的不签，前端显示占位）。
// 2. 文档由客户端拥有、服务端整存整取；保存必须带 `baseDocVersion`，对不上 409 `DRAMA_CANVAS_STALE`。
// 3. 生成结果另存为运行记录（DramaCanvasRun），服务端**从不改文档**；前端拿到结果自己合进文档再保存。
//    合并必须幂等（同一个 runId 合两次不重复），见各结果类型上的 runId。
// 4. 生成用到的提示词、参考图、首帧、片段顺序，**服务端一律从已保存的文档里读**，客户端不传；
//    所以每个生成请求都带 `docVersion`（前端先 flush 保存成功再发），对不上 409 `DRAMA_CANVAS_STALE`。
//    文档里读出来的每个 key 仍要过归属闸，不属于本人 → 400 `DRAMA_CANVAS_ASSET_NOT_OWNED`，不扣费。
// ─────────────────────────────────────────────────────────────────────────────

/** 画幅：整张画布一个（片段首帧、片段视频、成片都用它）。 */
export type DramaCanvasRatio = "9:16" | "16:9";

/** 出图面板可选的画幅（造型默认 9:16 全身立绘；场景、素材默认跟画布；片段首帧强制跟画布）。 */
export type CanvasImageRatio = "9:16" | "16:9" | "1:1" | "4:3" | "3:4";

/** 一个资产（图）。真值是 `key`；`url` 是出 wire 时派生的短期签名地址，不许存回文档。 */
export interface CanvasAsset {
  key: string;
  url?: string;
  /** 哪次生成产出的（上传的没有）。合并运行结果时按它去重。 */
  runId?: string;
}

/** 一组候选图（一次出 N 张、或多次生成累积下来的）。挑中的那张由 pickedKey 指定，缺省 = versions[0]。
 *  下游引用（出图参考、片段首帧参考）一律以挑中的那张为准。 */
export interface CanvasImageSet {
  versions: CanvasAsset[];
  pickedKey?: string;
}

/** 一版片段视频。 */
export interface CanvasVideoVersion {
  key: string;
  url?: string;
  /** 视频真实末帧（模型回传并镜像到我方存储时才有）；下一片段「用上一片段最后一帧」优先用它。 */
  lastFrameKey?: string;
  lastFrameUrl?: string;
  durationSec?: number;
  runId: string;
  createdAt: string;
}

export interface CanvasVideoSet {
  versions: CanvasVideoVersion[];
  pickedKey?: string;
}

/** 文档里记着的「正在跑 / 刚跑完」的那次生成；刷新后靠 runId 接回（GET runs?ids=）。 */
export interface CanvasRunRef {
  runId: string;
  status: DramaCanvasRunStatus;
}

/** 全剧风格（前端常量列表里选，整条写进文档；服务端出图 / 出视频时把 prompt 拼进提示词）。 */
export interface CanvasStyle {
  id: string;
  name: string;
  /** 风格提示词（「90 年代写实电影风格，胶片颗粒，暖黄调……」）。id = "none" 时为空串。 */
  prompt: string;
}

// ── 剧本 ─────────────────────────────────────────────────────────────────────

export interface CanvasOutlineEpisode {
  no: number;
  title: string;
  /** 这一集的钩子（开头抓人的那一下）。 */
  hook: string;
  summary: string;
}

export interface CanvasScriptEpisode {
  no: number;
  title: string;
  /**
   * 剧本正文，标准剧本格式的纯文本：
   *   ### 场1-1
   *   日 内 旧教室
   *   出场人物：林微
   *   △ 动作描写
   *   林微（语气）：台词
   *   同事（vo）：画外音
   *   【字幕：……】 / 【闪回】
   */
  text: string;
  /** 锁上的集：AI 重写不覆盖（前端不给点、服务端也拒绝 409 `DRAMA_CANVAS_EPISODE_LOCKED`）。 */
  locked?: boolean;
  run?: CanvasRunRef;
}

/** 剧本的一版快照（「通过」或 AI 重写前自动存；最多留 10 版，超出丢最老的）。 */
export interface CanvasScriptVersion {
  id: string;
  at: string;
  /** 给人看的说明：「通过故事设定」「重写第 2 集前」。 */
  label: string;
  setting?: string;
  outline?: CanvasOutlineEpisode[];
  episodes: { no: number; title: string; text: string }[];
}

export interface CanvasScript {
  /** 用户那句话（source=idea）；source=paste 时缺省。 */
  idea?: string;
  /** 目标集数与每集时长（source=idea 时建画布就定；AI 写分集剧情时按它）。 */
  targetEpisodes?: number;
  episodeDurationSec?: number;
  /** 故事大纲（界面叫法，§2.7）：题材、主线、人物小传（纯文本，可手改）。source=paste 时缺省。 */
  setting?: { text: string; approvedAt?: string; run?: CanvasRunRef };
  /** 分集剧情。source=paste 时缺省。 */
  outline?: { episodes: CanvasOutlineEpisode[]; approvedAt?: string; run?: CanvasRunRef };
  /** 分集剧本（真正拿去拆角色场景、生成分镜脚本的东西）。 */
  episodes: CanvasScriptEpisode[];
  history: CanvasScriptVersion[];
  /** 上次「拆出角色和场景」成功合并的时间；缺省 = 还没拆过（决定画布停在哪一步）。 */
  extractedAt?: string;
  extractRun?: CanvasRunRef;
}

// ── 角色和场景 ───────────────────────────────────────────────────────────────

export type CanvasCharacterRole = "lead" | "support" | "extra";

/** 一个造型（小云雀叫「形象」；我们的术语表里「形象」留给数字人，这里叫造型）。 */
export interface CanvasLook {
  id: string;
  /** 造型名：「基础造型」「学生时期」「摘掉安全帽」。 */
  name: string;
  /**
   * 外貌描述 = 出图提示词正文。结构化分段（AI 拆出来时就是这个格式，用户可自由改）：
   *   基本信息：… / 面部特征：… / 服饰装备：… / 配饰：… / 姿态构图：… / 光影渲染：…
   */
  prompt: string;
  /** 「角色设计」标签选择器的勾选状态（分类 → 选中的标签）；只给界面回显，出图以 prompt 为准。 */
  traits?: Record<string, string[]>;
  /** 出现在哪几集（集号，升序）。 */
  episodes: number[];
  images: CanvasImageSet;
  run?: CanvasRunRef;
}

export interface CanvasCharacter {
  id: string;
  name: string;
  role: CanvasCharacterRole;
  /** 人物小传（一两句，给人看，不进画面）。 */
  bio?: string;
  /** 至少一个；第一个是「基础造型」。 */
  looks: CanvasLook[];
}

export interface CanvasScene {
  id: string;
  name: string;
  /** 环境、时间、光线、色调；不写人物。= 出图提示词正文。 */
  prompt: string;
  episodes: number[];
  images: CanvasImageSet;
  run?: CanvasRunRef;
}

/** 画布上的自由素材：一张图（上传或按提示词生成）或一段文字。连线连给造型 / 场景 / 别的图当参考。 */
export interface CanvasMaterial {
  id: string;
  name: string;
  kind: "image" | "text";
  /** kind=image：候选图（上传的也放这里，versions 只有一张）。 */
  images?: CanvasImageSet;
  /** kind=image 且要 AI 画时的提示词。 */
  prompt?: string;
  /** kind=text：正文；连给谁，就作为谁出图时的补充说明拼进提示词。 */
  text?: string;
  run?: CanvasRunRef;
}

/** 画布布局（React Flow）。节点集合由 characters / scenes / materials 决定，这里只存位置与连线。 */
export interface CanvasBoard {
  /**
   * 位置，key = 节点 id：look.id / scene.id / material.id / 分组 id。
   * 分组 id：角色分组 = `group:char:<characterId>`，场景分组 = `group:scenes`。
   * 造型 / 场景卡在分组里时，位置是相对分组左上角的（React Flow parentId 约定）。
   * 没有位置的节点由前端自动排版后写回（新拆出来的角色 / 场景第一次打开画布时）。
   */
  positions: Record<string, { x: number; y: number }>;
  /**
   * 连线：source 的产物给 target 当参考。允许的组合：
   *   素材图 / 造型 / 场景 → 造型 / 场景 / 素材图：拿 source 挑中的那张图当参考图
   *   文字素材 → 造型 / 场景 / 素材图：把文字拼进 target 出图的提示词
   * 其它组合前端连不上；服务端出图时只认这些组合，其余忽略。
   */
  edges: CanvasEdge[];
  /** 收起来的分组 id。 */
  collapsed: string[];
  viewport: { x: number; y: number; zoom: number };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

// ── 逐集制作 ─────────────────────────────────────────────────────────────────

/**
 * 片段 = 一次视频生成（1–4 个镜头，总时长 ≤ 所选视频模型的上限）。
 *
 * `text` 是分镜脚本，逐镜一行起头写时长：
 *   （4 秒）日，旧教室。近景，平视。@[林微·成年](look:lk_ab12) 蹲在地上整理旧物……
 *   （3 秒）特写，@[林微·成年](look:lk_ab12) 拉开书桌抽屉，摸到一个生锈的铁盒。
 *
 * 引用写法（前后端同一个正则）：`@[显示名](look|scene|material:<id>)`
 *   /@\[([^\]\n]{1,40})\]\((look|scene|material):([A-Za-z0-9_-]{1,64})\)/g
 * 显示名只给人看；服务端按 id 取造型 / 场景 / 素材挑中的那张图当首帧参考，拼提示词时把整个标记换成显示名。
 * id 在文档里找不到（造型被删了）→ 当普通文字处理，前端把这种标签标红。
 */
export interface CanvasSegment {
  id: string;
  text: string;
  /** 片段总时长（秒，整数）。改镜头时长时前端同步改它；服务端以它为准报价、出视频。 */
  durationSec: number;
  frame: CanvasImageSet;
  frameRun?: CanvasRunRef;
  video: CanvasVideoSet;
  videoRun?: CanvasRunRef;
}

export interface CanvasAssembled {
  key: string;
  url?: string;
  durationSec: number;
  at: string;
  /** 合成时用的各片段视频 key（按顺序）。和现在各片段挑中的版本对不上 = 成片过期了，界面提示重新合成。 */
  videoKeys: string[];
  runId: string;
}

export interface CanvasEpisode {
  /** 对应 script.episodes[].no。 */
  no: number;
  segments: CanvasSegment[];
  storyboardRun?: CanvasRunRef;
  assembled?: CanvasAssembled;
  assembleRun?: CanvasRunRef;
}

// ── 文档 ─────────────────────────────────────────────────────────────────────

export interface DramaCanvasDoc {
  schema: 1;
  source: "idea" | "paste";
  style: CanvasStyle;
  script: CanvasScript;
  characters: CanvasCharacter[];
  scenes: CanvasScene[];
  materials: CanvasMaterial[];
  board: CanvasBoard;
  episodes: CanvasEpisode[];
}

// ── 画布（列表 / 详情 / 新建 / 保存）─────────────────────────────────────────

/** 画布停在哪一步（服务端按文档推：没拆过角色场景 → script；还没有任何片段 → assets；否则 episodes）。 */
export type DramaCanvasStep = "script" | "assets" | "episodes";

export interface DramaCanvasSummary {
  id: string;
  title: string;
  ratio: DramaCanvasRatio;
  step: DramaCanvasStep;
  /** script.episodes 的集数。 */
  episodeCount: number;
  characterCount: number;
  sceneCount: number;
  /** 所有集的片段里，已有挑中视频的 / 总数。 */
  segmentsDone: number;
  segmentsTotal: number;
  /** 已合成成片的集数。 */
  episodesAssembled: number;
  /** 封面：第一张属于本人的挑中图（造型优先，其次场景），服务端派生签名地址；没有图时缺省。 */
  coverUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DramaCanvasDetail extends DramaCanvasSummary {
  doc: DramaCanvasDoc;
  /** 文档指纹；保存和每个生成请求都原样带回。 */
  docVersion: string;
  /**
   * 只在「粘贴写好的剧本」新建（POST，source=paste）的那次响应里有：按集切开时的说明
   * （「没找到『第 X 集』标记，整篇当作第 1 集」「开头的前言放进了第 1 集」）。前端在剧本页顶部显示一次；GET 详情不带。
   */
  splitNotes?: string[];
}

export interface CreateDramaCanvasBody {
  /** 缺省：source=idea 取想法前 20 字，source=paste 取「未命名画布」。 */
  title?: string;
  ratio: DramaCanvasRatio;
  source: "idea" | "paste";
  /** source=idea：一句话想法（1–500 字）。 */
  idea?: string;
  /** source=paste：剧本原文（1–100000 字）。服务端按集切开后放进 script.episodes（切分规则同 split 接口，免费）。 */
  text?: string;
  /** source=idea：目标集数 1–80，缺省 10；每集时长 30–180 秒，缺省 60。 */
  targetEpisodes?: number;
  episodeDurationSec?: number;
  style: CanvasStyle;
}

export interface SaveDramaCanvasBody {
  doc: DramaCanvasDoc;
  title?: string;
  baseDocVersion: string;
}

export interface SaveDramaCanvasResult {
  docVersion: string;
  updatedAt: string;
}

/**
 * 签名地址换新（POST /me/drama/canvases/{id}/assets/sign）：签名有 TTL（默认 1 小时），画布一开半天，
 * 图 / 视频加载失败时前端按 key 换一个新地址（不重新拉整份文档、不丢没存的改动）。
 * 只给**属于本人**的 key 签；不是本人的、不存在的，直接不出现在 urls 里（不报错）。keys 最多 100 个。
 */
export interface SignCanvasAssetsBody {
  keys: string[];
}

export interface SignCanvasAssetsResult {
  /** key → 新的签名地址。 */
  urls: Record<string, string>;
}

/** 粘贴的剧本按集切开（免费、同步、规则切分不调模型）。 */
export interface SplitCanvasScriptBody {
  text: string;
}

export interface SplitCanvasScriptResult {
  episodes: { no: number; title: string; text: string }[];
  /** 切分说明（「没找到『第 X 集』标记，整篇当作第 1 集」），给用户看。 */
  notes: string[];
}

// ── 生成（运行记录）──────────────────────────────────────────────────────────

export type DramaCanvasRunKind = "script" | "extract" | "image" | "storyboard" | "video" | "assemble";
export type DramaCanvasRunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

/**
 * 这次生成是给谁的（前端据此把结果合回文档的哪里）：
 *   script:setting | script:outline | script:episode:<no> | extract
 *   look:<lookId> | scene:<sceneId> | material:<materialId> | frame:<episodeNo>:<segmentId>
 *   storyboard:<episodeNo> | video:<episodeNo>:<segmentId> | assemble:<episodeNo>
 */
export type DramaCanvasRunTarget =
  | "script:setting"
  | "script:outline"
  | `script:episode:${number}`
  | "extract"
  | `look:${string}`
  | `scene:${string}`
  | `material:${string}`
  | `frame:${number}:${string}`
  | `storyboard:${number}`
  | `video:${number}:${string}`
  | `assemble:${number}`;

export interface ExtractedCanvasLook {
  name: string;
  prompt: string;
  episodes: number[];
}

export interface ExtractedCanvasCharacter {
  name: string;
  role: CanvasCharacterRole;
  bio: string;
  looks: ExtractedCanvasLook[];
}

export interface ExtractedCanvasScene {
  name: string;
  prompt: string;
  episodes: number[];
}

/** 运行结果：按 kind 只有其中一块。所有资产只给 key + 派生 url。 */
export interface DramaCanvasRunResult {
  /** kind=script, target=script:setting */
  setting?: { text: string };
  /** kind=script, target=script:outline */
  outline?: { episodes: CanvasOutlineEpisode[] };
  /** kind=script, target=script:episode:<no> */
  episode?: { no: number; title: string; text: string };
  /** kind=extract。合并规则：角色按名字、造型按（角色名 + 造型名）、场景按名字；已有的保留不动（只补出现集数），新的追加。 */
  extract?: { characters: ExtractedCanvasCharacter[]; scenes: ExtractedCanvasScene[]; notes: string[] };
  /** kind=storyboard。合并规则：这一集已有片段且有首帧 / 视频时，前端先确认再整体替换。 */
  storyboard?: { episodeNo: number; segments: { text: string; durationSec: number }[]; notes: string[] };
  /** kind=image（造型 / 场景 / 素材 / 片段首帧）。每张带 runId。 */
  images?: CanvasAsset[];
  /** kind=video */
  video?: CanvasVideoVersion;
  /** kind=assemble */
  assembled?: CanvasAssembled;
}

export interface DramaCanvasRun {
  id: string;
  canvasId: string;
  kind: DramaCanvasRunKind;
  target: DramaCanvasRunTarget;
  status: DramaCanvasRunStatus;
  /** 这次冻结 / 扣掉的积分（失败退回后仍显示原值，status 说明结果）。 */
  cost: number;
  /** status=succeeded 时有。 */
  result?: DramaCanvasRunResult;
  /**
   * 参考图实际送到模型的情况（kind=image/video）：requested = 文档里连进来 / @ 到的张数，applied = 真送到的。
   * 模型不看首帧、超过上限被裁掉的，在 notes 里说人话（「这个模型不看首帧，角色长相可能对不上」）。
   */
  refs?: { requested: number; applied: number; notes: string[] };
  /** 失败原因：错误码 + 给用户看的话（§8.0.1 ①：4xx 说清是哪里不对）。 */
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
}

/**
 * 按幂等键**只查不建**：GET /me/drama/canvases/{id}/runs/lookup?clientRequestId=<key> → DramaCanvasRun[]
 * （单条请求 0 或 1 条；批量按原始键查到整批；没受理过 → 空数组）。只查本人、本画布的；没有任何副作用、不扣费。
 * 用途：请求发出后响应丢了 / 页面在请求返回前离开，下次进页用它确认「当初到底受理了没有」——
 * **不许用原键重发 POST 来确认**：没受理过的请求重发一次就是一笔用户没点过的新扣费。
 */

/** 所有生成请求的公共部分。 */
export interface CanvasRunBase {
  /** 幂等键（前端生成的 uuid）：同一个键重复请求回原运行记录，不重复扣费。 */
  clientRequestId: string;
  /** 前端认为已保存的文档版本；服务端当前版本不是它 → 409 DRAMA_CANVAS_STALE（先存再生成）。 */
  docVersion: string;
}

export interface CanvasScriptRunBody extends CanvasRunBase {
  stage: "setting" | "outline" | "episode";
  /** stage=episode 时必填。 */
  episodeNo?: number;
  /** 重写要求（≤200 字，「节奏再快一点」）；缺省 = 按上一段直接写。 */
  instruction?: string;
}

export type CanvasExtractRunBody = CanvasRunBase;

export type CanvasImageTarget =
  | { kind: "look"; id: string }
  | { kind: "scene"; id: string }
  | { kind: "material"; id: string }
  | { kind: "segment"; episodeNo: number; segmentId: string };

export interface CanvasImageRunBody extends CanvasRunBase {
  target: CanvasImageTarget;
  /** 一次出几张（1–4）。计价 = 单价 × 张数。 */
  count: number;
  /** 缺省：造型 9:16，场景 / 素材跟画布；片段首帧忽略此字段、强制跟画布。 */
  ratio?: CanvasImageRatio;
  /** 出图模型（GET /me/drama/render/models 的 image[].endpointId）；缺省用默认端点。 */
  endpointId?: string;
}

/**
 * 批量出图：一次报总价、一次冻结；逐项成功结算、失败退回。最多 20 项、总共 40 张（超了 400 `DRAMA_CANVAS_BATCH_TOO_LARGE`）。
 * 每项生成一条运行记录：**第 0 项直接占用原始 clientRequestId**，其余项 `${clientRequestId}:${i}`（i≥1）——
 * 这样单条请求和批量请求抢的是同一把唯一索引，同一个键不会被两边各受理一次（客户端的键里不许有 `:`）。
 */
export interface CanvasImageBatchBody extends CanvasRunBase {
  items: { target: CanvasImageTarget; count: number; ratio?: CanvasImageRatio }[];
  endpointId?: string;
}

export interface CanvasStoryboardRunBody extends CanvasRunBase {
  episodeNo: number;
  /** 单个片段的时长上限（秒）= 所选视频模型的 maxDurationSec；缺省 10。服务端夹在 4–30。 */
  maxSegmentSec?: number;
  /**
   * 单个片段的时长下限（秒）= 所选视频模型的 minDurationSec（GET /me/drama/render/models 的
   * video[].capability.minDurationSec，如 H3 = 5）；模型没写明下限时前端不带，服务端用缺省（4）。
   * 服务端夹在 1–maxSegmentSec 并写进提示词；模型还是切出了更短的片段时，装段时把它并进相邻片段
   * （合并后不超过 maxSegmentSec，内容一字不改，notes 里说明）。
   */
  minSegmentSec?: number;
}

export interface CanvasVideoRunBody extends CanvasRunBase {
  episodeNo: number;
  segmentId: string;
  /** 视频模型（GET /me/drama/render/models 的 video[].endpointId）；缺省默认端点。 */
  endpointId?: string;
  /** true（默认）= 用片段挑中的首帧做图生视频；片段没有首帧时服务端当 false 处理并在 refs.notes 里说明。 */
  useFirstFrame?: boolean;
}

export interface CanvasAssembleRunBody extends CanvasRunBase {
  episodeNo: number;
}
