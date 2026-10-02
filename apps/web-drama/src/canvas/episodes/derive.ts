// ─────────────────────────────────────────────────────────────────────────────
// canvas/episodes/derive.ts —— 逐集制作页与单集编辑器专用的纯函数（v0.198，docs/drama-canvas-plan.md §2.5 / §2.6）。
//
// 只读文档、不改文档（「用上一片段最后一帧」那一个除外，它也是纯函数：返回新文档）。
// 通用的查找 / 挑版本 / 片段增删改都在 `@/canvas/core`，这里不再写一份（§8.0.1 ④），只放这两屏自己才用的推导：
//   每集卡片的状态、封面、出场角色 / 场景数；片段格子的状态；价格文案；时长格式；
//   本集素材列表；「用上一片段最后一帧」；批量出视频的分组；覆盖 / 删除前要说清会丢什么。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CanvasAsset,
  CanvasEpisode,
  CanvasSegment,
  DramaCanvasDoc,
  DramaCanvasRunStatus,
} from "@ai-star-eco/types/drama-canvas";
import {
  episodeProgress,
  findEpisode,
  findLook,
  findMaterial,
  findScene,
  lookLabel,
  mapSegment,
  parseRefs,
  pickedImage,
  pickedVideo,
  type CanvasModelOption,
  type SegmentRef,
} from "@/canvas/core";

// ── 通用 ─────────────────────────────────────────────────────────────────────

export const isActiveStatus = (s?: DramaCanvasRunStatus): boolean => s === "queued" || s === "running";

/** 片段编号：01、02……（界面上一律两位）。 */
export const segmentNo = (index: number): string => String(index + 1).padStart(2, "0");

/** 片段轴上的时长：「00:42」「01:25」；一小时以上「1:02:05」。 */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 「第 1 集：落下的东西」；没标题（或标题就是「第 1 集」）时只写「第 1 集」。 */
export function episodeHeading(no: number, title?: string, sep = "："): string {
  const t = title?.trim();
  return t && t !== `第 ${no} 集` ? `第 ${no} 集${sep}${t}` : `第 ${no} 集`;
}

// ── 每集卡片 ─────────────────────────────────────────────────────────────────

export type EpisodeCardState = "no-storyboard" | "storyboarding" | "in-progress" | "to-assemble" | "assembling" | "stale" | "done";

export interface EpisodeCardStatus {
  state: EpisodeCardState;
  label: string;
  tone: "gray" | "accent" | "amber" | "green";
  segments: number;
  withVideo: number;
  /** 有成片、但合成时用的片段视频和现在挑中的对不上。 */
  assembledStale: boolean;
}

/**
 * 这一集做到哪了。live 是运行记录里的最新状态（比文档里的引用新），缺省读文档里的引用。
 * 顺序：分镜脚本生成中 → 还没有分镜脚本 → 正在合成 → 片段 a/b → 待合成 → 成片是旧的 → 已完成。
 */
export function episodeCardStatus(
  doc: DramaCanvasDoc,
  no: number,
  live: { storyboard?: DramaCanvasRunStatus; assemble?: DramaCanvasRunStatus } = {},
): EpisodeCardStatus {
  const ep = findEpisode(doc, no);
  const p = episodeProgress(doc, no);
  const base = { segments: p.segments, withVideo: p.withVideo, assembledStale: p.assembledStale };
  const sb = live.storyboard ?? ep?.storyboardRun?.status;
  const as = live.assemble ?? ep?.assembleRun?.status;
  if (isActiveStatus(sb)) return { ...base, state: "storyboarding", label: "分镜脚本生成中", tone: "accent" };
  if (!p.segments) return { ...base, state: "no-storyboard", label: "还没有分镜脚本", tone: "gray" };
  if (isActiveStatus(as)) return { ...base, state: "assembling", label: "正在合成成片", tone: "accent" };
  if (p.withVideo < p.segments) return { ...base, state: "in-progress", label: `片段 ${p.withVideo}/${p.segments}`, tone: "amber" };
  if (!ep?.assembled) return { ...base, state: "to-assemble", label: "待合成", tone: "accent" };
  if (p.assembledStale) return { ...base, state: "stale", label: "成片是旧的", tone: "amber" };
  return { ...base, state: "done", label: "已完成", tone: "green" };
}

/** 这一集所有片段里的引用。 */
export function episodeRefs(ep: CanvasEpisode | null | undefined): SegmentRef[] {
  return (ep?.segments ?? []).flatMap((s) => parseRefs(s.text));
}

/** 出现在这一集的角色数、场景数（造型 / 场景标了这一集，或者这一集的片段里 @ 到了）。 */
export function episodeCast(doc: DramaCanvasDoc, no: number): { characters: number; scenes: number } {
  const refs = episodeRefs(findEpisode(doc, no));
  const refLooks = new Set(refs.filter((r) => r.kind === "look").map((r) => r.id));
  const refScenes = new Set(refs.filter((r) => r.kind === "scene").map((r) => r.id));
  const characters = doc.characters.filter((c) => c.looks.some((l) => l.episodes.includes(no) || refLooks.has(l.id))).length;
  const scenes = doc.scenes.filter((s) => s.episodes.includes(no) || refScenes.has(s.id)).length;
  return { characters, scenes };
}

/** 封面：第一个有视频的片段的首帧（没有首帧用那版视频的末帧）；都没有视频时用第一张首帧。 */
export function episodeCover(doc: DramaCanvasDoc, no: number): CanvasAsset | undefined {
  const ep = findEpisode(doc, no);
  if (!ep) return undefined;
  const withVideo = ep.segments.find((s) => !!pickedVideo(s.video));
  if (withVideo) {
    const frame = pickedImage(withVideo.frame);
    if (frame) return frame;
    const v = pickedVideo(withVideo.video)!;
    if (v.lastFrameKey) return { key: v.lastFrameKey, ...(v.lastFrameUrl ? { url: v.lastFrameUrl } : {}) };
  }
  for (const s of ep.segments) {
    const f = pickedImage(s.frame);
    if (f) return f;
  }
  return undefined;
}

/** 卡片角标上的时长：有不过期的成片按成片，否则按各片段时长加总。 */
export function episodeDuration(doc: DramaCanvasDoc, no: number): number {
  const ep = findEpisode(doc, no);
  if (!ep) return 0;
  if (ep.assembled && !episodeProgress(doc, no).assembledStale) return ep.assembled.durationSec;
  return ep.segments.reduce((acc, s) => acc + (s.durationSec || 0), 0);
}

// ── 会丢什么（覆盖 / 删除前的确认框）──────────────────────────────────────────

export function segmentsLoss(segments: CanvasSegment[]): { frames: number; videos: number } {
  return segments.reduce(
    (acc, s) => ({ frames: acc.frames + s.frame.versions.length, videos: acc.videos + s.video.versions.length }),
    { frames: 0, videos: 0 },
  );
}

function lossPhrase(l: { frames: number; videos: number }): string {
  const parts: string[] = [];
  if (l.frames) parts.push(`${l.frames} 张首帧`);
  if (l.videos) parts.push(`${l.videos} 段视频`);
  return parts.join("、");
}

/** 重新生成分镜脚本会整体替换这一集的片段：写清会丢什么。这一集还没有片段时回 undefined（不用确认覆盖）。 */
export function storyboardReplaceNote(no: number, segments: CanvasSegment[]): string | undefined {
  if (!segments.length) return undefined;
  const loss = segmentsLoss(segments);
  if (loss.frames || loss.videos) return `第 ${no} 集已生成的 ${lossPhrase(loss)}会从这一集移除，已花的积分不退。`;
  return `第 ${no} 集现在的 ${segments.length} 个片段会换成新生成的，你改过的文字也会被替换。`;
}

/** 删一个片段：有首帧 / 视频时写清会丢什么；空片段回 undefined（不用确认）。 */
export function segmentDeleteNote(label: string, seg: CanvasSegment): string | undefined {
  const loss = segmentsLoss([seg]);
  if (!loss.frames && !loss.videos) return undefined;
  return `${label}的 ${lossPhrase(loss)}会一起删掉，已花的积分不退。`;
}

// ── 片段格子 ─────────────────────────────────────────────────────────────────

export type SegmentCellState = "empty" | "frame" | "video" | "running" | "failed" | "ref-changed";

/** 片段格子的状态：生成中 → 最近一次失败 → 用到的造型换过图了 → 有视频 → 有首帧 → 空。 */
export function segmentCellStatus(
  seg: CanvasSegment,
  opts: { frameStatus?: DramaCanvasRunStatus; videoStatus?: DramaCanvasRunStatus; refChanged?: boolean } = {},
): { state: SegmentCellState; label: string } {
  const frameStatus = opts.frameStatus ?? seg.frameRun?.status;
  const videoStatus = opts.videoStatus ?? seg.videoRun?.status;
  const hasVideo = !!pickedVideo(seg.video);
  const hasFrame = !!pickedImage(seg.frame);
  if (isActiveStatus(videoStatus)) return { state: "running", label: "视频生成中" };
  if (isActiveStatus(frameStatus)) return { state: "running", label: "首帧生成中" };
  if (videoStatus === "failed" || frameStatus === "failed") {
    return { state: "failed", label: hasVideo ? "有视频，最近一次没生成出来" : "最近一次没生成出来" };
  }
  if (opts.refChanged && (hasVideo || hasFrame)) return { state: "ref-changed", label: "用到的造型换过图了，可以重新生成" };
  if (hasVideo) return { state: "video", label: "有视频" };
  if (hasFrame) return { state: "frame", label: "有首帧，还没有视频" };
  return { state: "empty", label: "还没有首帧和视频" };
}

/** 格子缩略图：挑中的首帧；没有首帧但有视频时用那版视频的末帧；都没有 = undefined（有视频时界面画播放图标占位）。 */
export function cellThumb(seg: CanvasSegment): CanvasAsset | undefined {
  const f = pickedImage(seg.frame);
  if (f) return f;
  const v = pickedVideo(seg.video);
  if (v?.lastFrameKey) return { key: v.lastFrameKey, ...(v.lastFrameUrl ? { url: v.lastFrameUrl } : {}) };
  return undefined;
}

/** 引用指向的那张图（造型 / 场景 / 素材图挑中的那张）。 */
export function refImage(doc: DramaCanvasDoc, ref: Pick<SegmentRef, "kind" | "id">): CanvasAsset | undefined {
  if (ref.kind === "look") return pickedImage(findLook(doc, ref.id)?.look.images);
  if (ref.kind === "scene") return pickedImage(findScene(doc, ref.id)?.images);
  const m = findMaterial(doc, ref.id);
  return m && m.kind === "image" ? pickedImage(m.images) : undefined;
}

export interface RefView {
  label: string;
  /** id 在文档里找不到（被删了）。 */
  missing: boolean;
  image?: CanvasAsset;
}

/** 引用在界面上怎么显示：找得到用文档里现在的名字，找不到用标记里的名字并标红。 */
export function refView(doc: DramaCanvasDoc, ref: Pick<SegmentRef, "kind" | "id" | "label">): RefView {
  if (ref.kind === "look") {
    const hit = findLook(doc, ref.id);
    return hit ? { label: lookLabel(hit.character, hit.look), missing: false, image: pickedImage(hit.look.images) } : { label: ref.label, missing: true };
  }
  if (ref.kind === "scene") {
    const s = findScene(doc, ref.id);
    return s ? { label: s.name, missing: false, image: pickedImage(s.images) } : { label: ref.label, missing: true };
  }
  const m = findMaterial(doc, ref.id);
  return m ? { label: m.name, missing: false, image: m.kind === "image" ? pickedImage(m.images) : undefined } : { label: ref.label, missing: true };
}

export const MISSING_REF_TEXT: Record<SegmentRef["kind"], string> = {
  look: "这个造型被删了",
  scene: "这个场景被删了",
  material: "这个素材被删了",
};

/** 片段里用到的引用（按首次出现去重）。 */
export function segmentUses(doc: DramaCanvasDoc, text: string): (RefView & { kind: SegmentRef["kind"]; id: string })[] {
  const seen = new Set<string>();
  const out: (RefView & { kind: SegmentRef["kind"]; id: string })[] = [];
  for (const r of parseRefs(text)) {
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ kind: r.kind, id: r.id, ...refView(doc, r) });
  }
  return out;
}

/**
 * 片段生成之后，它 @ 到的造型 / 场景 / 素材图是不是换过图了（plan §5.2：已生成的不自动重跑，只在格子上标出来）。
 * 判据：引用挑中的那张图是某次出图生成的，且那次出图结束得比这个片段的视频（没有视频时按首帧那次）晚。
 * finishedAt 由界面按运行记录给（查不到的当不知道，不标）。上传的图没有运行记录，判断不了。
 */
export function segmentRefChanged(
  doc: DramaCanvasDoc,
  seg: CanvasSegment,
  finishedAt: (runId: string) => string | undefined,
): boolean {
  const v = pickedVideo(seg.video);
  const f = pickedImage(seg.frame);
  const basis = v?.createdAt ?? (f?.runId ? finishedAt(f.runId) : undefined);
  if (!basis) return false;
  for (const r of parseRefs(seg.text)) {
    const img = refImage(doc, r);
    if (!img?.runId) continue;
    const at = finishedAt(img.runId);
    if (at && at > basis) return true;
  }
  return false;
}

// ── 片段轴 / 合成 ────────────────────────────────────────────────────────────

/** 「已有视频的时长 / 全部片段时长」（有视频的按视频实际时长）。 */
export function timelineTotals(segments: CanvasSegment[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const s of segments) {
    const v = pickedVideo(s.video);
    const d = v?.durationSec ?? s.durationSec ?? 0;
    total += d;
    if (v) done += d;
  }
  return { done, total };
}

export interface AssembleInfo {
  segments: number;
  /** 还没有挑中视频的片段数。 */
  missing: number;
  canAssemble: boolean;
  running: boolean;
  stale: boolean;
}

export function assembleInfo(doc: DramaCanvasDoc, no: number, liveStatus?: DramaCanvasRunStatus): AssembleInfo {
  const ep = findEpisode(doc, no);
  const p = episodeProgress(doc, no);
  const running = isActiveStatus(liveStatus ?? ep?.assembleRun?.status);
  const missing = p.segments - p.withVideo;
  return { segments: p.segments, missing, canAssemble: p.segments > 0 && missing === 0 && !running, running, stale: p.assembledStale };
}

// ── 「用上一片段最后一帧」────────────────────────────────────────────────────

export type PrevLastFrame =
  | { kind: "first" }
  | { kind: "none" }
  | { kind: "ready"; asset: CanvasAsset }
  | { kind: "applied"; asset: CanvasAsset };

/** 上一片段挑中的视频有没有末帧；有的话本片段是不是已经在用它。 */
export function prevLastFrame(doc: DramaCanvasDoc, no: number, segmentId: string): PrevLastFrame {
  const ep = findEpisode(doc, no);
  const i = ep?.segments.findIndex((s) => s.id === segmentId) ?? -1;
  if (!ep || i < 0) return { kind: "none" };
  if (i === 0) return { kind: "first" };
  const v = pickedVideo(ep.segments[i - 1].video);
  if (!v?.lastFrameKey) return { kind: "none" };
  const asset: CanvasAsset = { key: v.lastFrameKey, ...(v.lastFrameUrl ? { url: v.lastFrameUrl } : {}) };
  const cur = pickedImage(ep.segments[i].frame);
  return cur?.key === asset.key ? { kind: "applied", asset } : { kind: "ready", asset };
}

/** 把上一片段的末帧加进本片段的首帧候选并选中（不调接口、不花钱）。没有末帧时原样返回。 */
export function applyPrevLastFrame(doc: DramaCanvasDoc, no: number, segmentId: string): DramaCanvasDoc {
  const p = prevLastFrame(doc, no, segmentId);
  if (p.kind !== "ready") return doc;
  return mapSegment(doc, no, segmentId, (s) => {
    const has = s.frame.versions.some((v) => v.key === p.asset.key);
    const versions = has ? s.frame.versions : [p.asset, ...s.frame.versions];
    return { ...s, frame: { versions, pickedKey: p.asset.key } };
  });
}

// ── 价格文案 ─────────────────────────────────────────────────────────────────

/** 价格文案拆成段：字符串原样显示，{credits} 显示成钻石 + 数字。 */
export type PricePart = string | { credits: number };

/** 测试 / 无障碍用的纯文字版（钻石写成 ✦）。 */
export function priceText(parts: PricePart[]): string {
  return parts.map((p) => (typeof p === "string" ? p : `✦${p.credits}`)).join("");
}

export interface VideoRate {
  unit: "per_second" | "per_call";
  rate: number;
}

/** 当前视频模型怎么计价；模型还没读到 / 没有时按次（fallbackPerCall = pricing.videoPrice 的兜底单价）。 */
export function videoRateOf(model: CanvasModelOption | undefined, fallbackPerCall: number): VideoRate {
  if (!model) return { unit: "per_call", rate: fallbackPerCall };
  return { unit: model.billingUnit, rate: model.creditCost };
}

/** 片段标题旁：「每秒 ✦6 · 本片段 7 秒 ✦42」；按次的「每条 ✦30 · 本片段 7 秒」。 */
export function segmentPriceParts(rate: VideoRate, durationSec: number, cost: number): PricePart[] {
  const dur = Math.max(0, Math.round(durationSec || 0));
  if (rate.unit === "per_second") return ["每秒 ", { credits: rate.rate }, ` · 本片段 ${dur} 秒 `, { credits: cost }];
  return ["每条 ", { credits: rate.rate }, ` · 本片段 ${dur} 秒`];
}

/**
 * 一集大概要花多少：分镜脚本 + 每个片段一张首帧 + 每个片段一条视频。
 * 片段数 = 一集时长 ÷ 视频模型单条上限（向上取整），时长尽量平均分。
 */
export function estimateEpisodeCost(input: {
  durationSec: number;
  maxSegmentSec: number;
  storyboard: number;
  frame: number;
  videoPrice: (durationSec: number) => number;
}): number {
  const dur = Math.max(1, Math.round(input.durationSec || 0));
  const max = Math.max(1, Math.round(input.maxSegmentSec || 0));
  const n = Math.max(1, Math.ceil(dur / max));
  const base = Math.floor(dur / n);
  const extra = dur - base * n;
  let video = 0;
  for (let i = 0; i < n; i++) video += input.videoPrice(base + (i < extra ? 1 : 0));
  return input.storyboard + n * input.frame + video;
}

/** 估价按多长一集算：新建时定的每集时长；没定（粘贴来的剧本）时按已有片段的集平均；都没有按 60 秒。 */
export function estimateEpisodeSec(doc: DramaCanvasDoc): number {
  const set = doc.script.episodeDurationSec;
  if (set && set > 0) return Math.round(set);
  const totals = doc.episodes.filter((e) => e.segments.length).map((e) => e.segments.reduce((a, s) => a + (s.durationSec || 0), 0));
  const valid = totals.filter((t) => t > 0);
  if (valid.length) return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  return 60;
}

/** 逐集制作页标题下那一行：「共 3 集 · 分镜脚本每集 ✦4，首帧每张 ✦2，视频按秒计（当前模型每秒 ✦6），60 秒一集约 ✦376」。 */
export function listPriceParts(input: {
  episodes: number;
  storyboard: number;
  frame: number;
  rate: VideoRate;
  estimateSec: number;
  estimate: number;
}): PricePart[] {
  const video: PricePart[] =
    input.rate.unit === "per_second"
      ? ["视频按秒计（当前模型每秒 ", { credits: input.rate.rate }, "）"]
      : ["视频按条计（当前模型每条 ", { credits: input.rate.rate }, "）"];
  return [
    `共 ${input.episodes} 集 · 分镜脚本每集 `,
    { credits: input.storyboard },
    "，首帧每张 ",
    { credits: input.frame },
    "，",
    ...video,
    `，${input.estimateSec} 秒一集约 `,
    { credits: input.estimate },
  ];
}

// ── 本集素材 ─────────────────────────────────────────────────────────────────

export interface EpisodeAssetItem {
  kind: SegmentRef["kind"];
  id: string;
  /** 插进片段文本时用的显示名（造型：「林微·学生时期」）。 */
  label: string;
  image?: CanvasAsset;
  /** 出现在这一集（造型 / 场景标了这一集，或这一集的片段里 @ 到了）。 */
  inEpisode: boolean;
  /** 「出现在第 1, 2 集」；素材没有集数。 */
  episodes?: number[];
}

/** 本集素材：造型（按角色顺序）、场景、素材图（文字素材不能当首帧参考，不列）。 */
export function episodeAssets(doc: DramaCanvasDoc, no: number): EpisodeAssetItem[] {
  const refs = episodeRefs(findEpisode(doc, no));
  const used = new Set(refs.map((r) => `${r.kind}:${r.id}`));
  const out: EpisodeAssetItem[] = [];
  for (const c of doc.characters) {
    for (const l of c.looks) {
      out.push({
        kind: "look",
        id: l.id,
        label: lookLabel(c, l),
        image: pickedImage(l.images),
        inEpisode: l.episodes.includes(no) || used.has(`look:${l.id}`),
        episodes: l.episodes,
      });
    }
  }
  for (const s of doc.scenes) {
    out.push({
      kind: "scene",
      id: s.id,
      label: s.name,
      image: pickedImage(s.images),
      inEpisode: s.episodes.includes(no) || used.has(`scene:${s.id}`),
      episodes: s.episodes,
    });
  }
  for (const m of doc.materials) {
    if (m.kind !== "image") continue;
    out.push({ kind: "material", id: m.id, label: m.name, image: pickedImage(m.images), inEpisode: used.has(`material:${m.id}`) });
  }
  return out;
}

/** 按「只看这一集 / 全部」和搜索词过滤（不区分大小写，按显示名）。 */
export function filterAssets(items: EpisodeAssetItem[], opts: { scope: "episode" | "all"; query?: string }): EpisodeAssetItem[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  return items.filter((it) => (opts.scope === "all" || it.inEpisode) && (!q || it.label.toLowerCase().includes(q)));
}

export const ASSET_GROUP_LABEL: Record<SegmentRef["kind"], string> = { look: "角色", scene: "场景", material: "素材图" };

export function episodesPhrase(episodes: number[] | undefined): string | undefined {
  if (!episodes?.length) return undefined;
  return `出现在第 ${[...episodes].sort((a, b) => a - b).join(", ")} 集`;
}

// ── 批量出视频 ───────────────────────────────────────────────────────────────

export interface BatchVideoPlan {
  /** 这次真的会发出去的片段（按片段顺序）。 */
  eligible: CanvasSegment[];
  withFrame: number;
  withoutFrame: number;
  /** 选了但这次跳过的（没写内容 / 没写时长 / 超过上限 / 正在生成）。 */
  skipped: number;
  cost: number;
}

export function batchVideoPlan(
  segments: CanvasSegment[],
  selected: ReadonlySet<string>,
  opts: { maxSec: number; price: (durationSec: number) => number; isRunning: (segmentId: string) => boolean },
): BatchVideoPlan {
  const plan: BatchVideoPlan = { eligible: [], withFrame: 0, withoutFrame: 0, skipped: 0, cost: 0 };
  for (const s of segments) {
    if (!selected.has(s.id)) continue;
    const ok = !!s.text.trim() && s.durationSec > 0 && s.durationSec <= opts.maxSec && !opts.isRunning(s.id);
    if (!ok) {
      plan.skipped += 1;
      continue;
    }
    plan.eligible.push(s);
    if (pickedImage(s.frame)) plan.withFrame += 1;
    else plan.withoutFrame += 1;
    plan.cost += opts.price(s.durationSec);
  }
  return plan;
}
