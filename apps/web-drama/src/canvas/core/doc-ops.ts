// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/doc-ops.ts —— 文档常用编辑（v0.198，契约见 contract.ts「doc-ops.ts」一节）。
//
// 四块（剧本 / 角色和场景 / 画布 / 逐集）共用这一份，不要各写一份（§8.0.1 ④）。
// 全部是纯函数：不改入参，返回新文档；没有变化时尽量原样返回入参（React 据此跳过重渲染）。
// 组件里的用法：`update((d) => addLook(d, characterId).doc)`。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CanvasAsset,
  CanvasCharacter,
  CanvasEpisode,
  CanvasImageSet,
  CanvasLook,
  CanvasMaterial,
  CanvasScene,
  CanvasSegment,
  CanvasVideoSet,
  CanvasVideoVersion,
  DramaCanvasDoc,
  DramaCanvasRunTarget,
  DramaCanvasStep,
} from "@ai-star-eco/types/drama-canvas";
import { newId } from "./ids";
import { totalDuration } from "./refs";

/** 「基础造型」：每个角色的第一个造型默认叫这个；lookLabel 遇到它只显示角色名。 */
export const BASE_LOOK_NAME = "基础造型";

/** 场景分组 id / 角色分组 id（CanvasBoard.positions 的 key 约定）。 */
export const SCENES_GROUP_ID = "group:scenes";
export const characterGroupId = (characterId: string) => `group:char:${characterId}`;

// ── 空文档 ───────────────────────────────────────────────────────────────────

/** 空文档（加载完成前 CanvasDocValue.doc 就是它 —— 只作占位，不要拿来渲染编辑界面）。 */
export function emptyDoc(): DramaCanvasDoc {
  return {
    schema: 1,
    source: "paste",
    style: { id: "none", name: "无风格", prompt: "" },
    script: { episodes: [], history: [] },
    characters: [],
    scenes: [],
    materials: [],
    board: { positions: {}, edges: [], collapsed: [], viewport: { x: 0, y: 0, zoom: 1 } },
    episodes: [],
  };
}

/** 画布停在哪一步（与服务端 DramaCanvasSummary.step 同一条规则）：没拆过角色场景 → 剧本；还没有任何片段 → 角色和场景；否则逐集制作。 */
export function canvasStep(doc: DramaCanvasDoc): DramaCanvasStep {
  if (!doc.script.extractedAt) return "script";
  if (!doc.episodes.some((e) => e.segments.length > 0)) return "assets";
  return "episodes";
}

// ── 挑中的那一版 ─────────────────────────────────────────────────────────────

/** 挑中的那张图（pickedKey 缺省或指向不存在的版本时 = 第一张）。 */
export function pickedImage(set: CanvasImageSet | undefined | null): CanvasAsset | undefined {
  if (!set || !set.versions.length) return undefined;
  return (set.pickedKey && set.versions.find((v) => v.key === set.pickedKey)) || set.versions[0];
}

/** 挑中的那版视频（同上）。 */
export function pickedVideo(set: CanvasVideoSet | undefined | null): CanvasVideoVersion | undefined {
  if (!set || !set.versions.length) return undefined;
  return (set.pickedKey && set.versions.find((v) => v.key === set.pickedKey)) || set.versions[0];
}

// ── 查找 ─────────────────────────────────────────────────────────────────────

export function findCharacter(doc: DramaCanvasDoc, characterId: string): CanvasCharacter | null {
  return doc.characters.find((c) => c.id === characterId) ?? null;
}

export function findLook(doc: DramaCanvasDoc, lookId: string): { character: CanvasCharacter; look: CanvasLook } | null {
  for (const character of doc.characters) {
    const look = character.looks.find((l) => l.id === lookId);
    if (look) return { character, look };
  }
  return null;
}

export function findScene(doc: DramaCanvasDoc, sceneId: string): CanvasScene | null {
  return doc.scenes.find((s) => s.id === sceneId) ?? null;
}

export function findMaterial(doc: DramaCanvasDoc, materialId: string): CanvasMaterial | null {
  return doc.materials.find((m) => m.id === materialId) ?? null;
}

export function findEpisode(doc: DramaCanvasDoc, no: number): CanvasEpisode | null {
  return doc.episodes.find((e) => e.no === no) ?? null;
}

export function findSegment(doc: DramaCanvasDoc, no: number, segmentId: string): CanvasSegment | null {
  return findEpisode(doc, no)?.segments.find((s) => s.id === segmentId) ?? null;
}

// ── 生成目标 ─────────────────────────────────────────────────────────────────

export type ParsedRunTarget =
  | { kind: "script:setting" }
  | { kind: "script:outline" }
  | { kind: "script:episode"; no: number }
  | { kind: "extract" }
  | { kind: "look"; id: string }
  | { kind: "scene"; id: string }
  | { kind: "material"; id: string }
  | { kind: "frame"; no: number; segmentId: string }
  | { kind: "storyboard"; no: number }
  | { kind: "video"; no: number; segmentId: string }
  | { kind: "assemble"; no: number };

/** 拆开 RunTarget 字符串（格式见 drama-canvas.ts DramaCanvasRunTarget）；认不得返回 null。 */
export function parseRunTarget(target: DramaCanvasRunTarget | string): ParsedRunTarget | null {
  if (target === "script:setting") return { kind: "script:setting" };
  if (target === "script:outline") return { kind: "script:outline" };
  if (target === "extract") return { kind: "extract" };
  const parts = target.split(":");
  const num = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : NaN);
  switch (parts[0]) {
    case "script": {
      const no = num(parts[2]);
      return parts[1] === "episode" && parts.length === 3 && Number.isFinite(no) ? { kind: "script:episode", no } : null;
    }
    case "look":
    case "scene":
    case "material": {
      const id = parts.slice(1).join(":");
      return id ? { kind: parts[0], id } : null;
    }
    case "frame":
    case "video": {
      const no = num(parts[1]);
      const segmentId = parts.slice(2).join(":");
      return Number.isFinite(no) && segmentId ? { kind: parts[0], no, segmentId } : null;
    }
    case "storyboard":
    case "assemble": {
      const no = num(parts[1]);
      return parts.length === 2 && Number.isFinite(no) ? { kind: parts[0], no } : null;
    }
    default:
      return null;
  }
}

// ── 内部：按 id 改一处 ───────────────────────────────────────────────────────

function mapCharacters(doc: DramaCanvasDoc, fn: (c: CanvasCharacter) => CanvasCharacter): DramaCanvasDoc {
  let changed = false;
  const characters = doc.characters.map((c) => {
    const n = fn(c);
    if (n !== c) changed = true;
    return n;
  });
  return changed ? { ...doc, characters } : doc;
}

/** 改某个造型（找不到原样返回）。 */
export function mapLook(doc: DramaCanvasDoc, lookId: string, fn: (l: CanvasLook) => CanvasLook): DramaCanvasDoc {
  return mapCharacters(doc, (c) => {
    const i = c.looks.findIndex((l) => l.id === lookId);
    if (i < 0) return c;
    const next = fn(c.looks[i]);
    if (next === c.looks[i]) return c;
    const looks = c.looks.slice();
    looks[i] = next;
    return { ...c, looks };
  });
}

export function mapScene(doc: DramaCanvasDoc, sceneId: string, fn: (s: CanvasScene) => CanvasScene): DramaCanvasDoc {
  const i = doc.scenes.findIndex((s) => s.id === sceneId);
  if (i < 0) return doc;
  const next = fn(doc.scenes[i]);
  if (next === doc.scenes[i]) return doc;
  const scenes = doc.scenes.slice();
  scenes[i] = next;
  return { ...doc, scenes };
}

export function mapMaterial(doc: DramaCanvasDoc, materialId: string, fn: (m: CanvasMaterial) => CanvasMaterial): DramaCanvasDoc {
  const i = doc.materials.findIndex((m) => m.id === materialId);
  if (i < 0) return doc;
  const next = fn(doc.materials[i]);
  if (next === doc.materials[i]) return doc;
  const materials = doc.materials.slice();
  materials[i] = next;
  return { ...doc, materials };
}

export function mapEpisode(doc: DramaCanvasDoc, no: number, fn: (e: CanvasEpisode) => CanvasEpisode): DramaCanvasDoc {
  const i = doc.episodes.findIndex((e) => e.no === no);
  if (i < 0) return doc;
  const next = fn(doc.episodes[i]);
  if (next === doc.episodes[i]) return doc;
  const episodes = doc.episodes.slice();
  episodes[i] = next;
  return { ...doc, episodes };
}

export function mapSegment(
  doc: DramaCanvasDoc,
  no: number,
  segmentId: string,
  fn: (s: CanvasSegment) => CanvasSegment,
): DramaCanvasDoc {
  return mapEpisode(doc, no, (e) => {
    const i = e.segments.findIndex((s) => s.id === segmentId);
    if (i < 0) return e;
    const next = fn(e.segments[i]);
    if (next === e.segments[i]) return e;
    const segments = e.segments.slice();
    segments[i] = next;
    return { ...e, segments };
  });
}

/** 删掉某些节点 id 的连线、位置、收起状态。 */
function dropBoardNodes(doc: DramaCanvasDoc, ids: string[]): DramaCanvasDoc {
  if (!ids.length) return doc;
  const gone = new Set(ids);
  const edges = doc.board.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target));
  const positions: Record<string, { x: number; y: number }> = {};
  let posChanged = false;
  for (const [k, v] of Object.entries(doc.board.positions)) {
    if (gone.has(k)) posChanged = true;
    else positions[k] = v;
  }
  const collapsed = doc.board.collapsed.filter((id) => !gone.has(id));
  if (edges.length === doc.board.edges.length && !posChanged && collapsed.length === doc.board.collapsed.length) return doc;
  return { ...doc, board: { ...doc.board, edges, positions, collapsed } };
}

const emptyImages = (): CanvasImageSet => ({ versions: [] });

// ── 增 ───────────────────────────────────────────────────────────────────────

/** 加一个角色（带一个「基础造型」）。 */
export function addCharacter(doc: DramaCanvasDoc, name: string): { doc: DramaCanvasDoc; characterId: string; lookId: string } {
  const characterId = newId("character");
  const lookId = newId("look");
  const character: CanvasCharacter = {
    id: characterId,
    name: name.trim() || `角色 ${doc.characters.length + 1}`,
    role: "support",
    looks: [{ id: lookId, name: BASE_LOOK_NAME, prompt: "", episodes: [], images: emptyImages() }],
  };
  return { doc: { ...doc, characters: [...doc.characters, character] }, characterId, lookId };
}

/** 给角色加一个造型（名字缺省「造型 N」）。角色不存在时原样返回、lookId 为空串。 */
export function addLook(doc: DramaCanvasDoc, characterId: string, name?: string): { doc: DramaCanvasDoc; lookId: string } {
  const character = findCharacter(doc, characterId);
  if (!character) return { doc, lookId: "" };
  const lookId = newId("look");
  const look: CanvasLook = {
    id: lookId,
    name: name?.trim() || `造型 ${character.looks.length + 1}`,
    prompt: "",
    episodes: [],
    images: emptyImages(),
  };
  const next = mapCharacters(doc, (c) => (c.id === characterId ? { ...c, looks: [...c.looks, look] } : c));
  return { doc: next, lookId };
}

export function addScene(doc: DramaCanvasDoc, name: string): { doc: DramaCanvasDoc; id: string } {
  const id = newId("scene");
  const scene: CanvasScene = {
    id,
    name: name.trim() || `场景 ${doc.scenes.length + 1}`,
    prompt: "",
    episodes: [],
    images: emptyImages(),
  };
  return { doc: { ...doc, scenes: [...doc.scenes, scene] }, id };
}

/** 加一个素材：图（可上传或按提示词画）/ 文字。 */
export function addMaterial(doc: DramaCanvasDoc, kind: CanvasMaterial["kind"]): { doc: DramaCanvasDoc; id: string } {
  const id = newId("material");
  const n = doc.materials.filter((m) => m.kind === kind).length + 1;
  const material: CanvasMaterial =
    kind === "image"
      ? { id, name: `素材图 ${n}`, kind, images: emptyImages(), prompt: "" }
      : { id, name: `文字 ${n}`, kind, text: "" };
  return { doc: { ...doc, materials: [...doc.materials, material] }, id };
}

// ── 删（连带连线与位置）──────────────────────────────────────────────────────

/** 删一个造型。**删的是这个角色的最后一个造型时，整个角色一起删掉**（角色至少要有一个造型）。 */
export function removeLook(doc: DramaCanvasDoc, lookId: string): DramaCanvasDoc {
  const hit = findLook(doc, lookId);
  if (!hit) return doc;
  if (hit.character.looks.length <= 1) return removeCharacter(doc, hit.character.id);
  const next = mapCharacters(doc, (c) =>
    c.id === hit.character.id ? { ...c, looks: c.looks.filter((l) => l.id !== lookId) } : c,
  );
  return dropBoardNodes(next, [lookId]);
}

export function removeCharacter(doc: DramaCanvasDoc, characterId: string): DramaCanvasDoc {
  const character = findCharacter(doc, characterId);
  if (!character) return doc;
  const next = { ...doc, characters: doc.characters.filter((c) => c.id !== characterId) };
  return dropBoardNodes(next, [characterGroupId(characterId), ...character.looks.map((l) => l.id)]);
}

export function removeScene(doc: DramaCanvasDoc, sceneId: string): DramaCanvasDoc {
  if (!findScene(doc, sceneId)) return doc;
  return dropBoardNodes({ ...doc, scenes: doc.scenes.filter((s) => s.id !== sceneId) }, [sceneId]);
}

export function removeMaterial(doc: DramaCanvasDoc, materialId: string): DramaCanvasDoc {
  if (!findMaterial(doc, materialId)) return doc;
  return dropBoardNodes({ ...doc, materials: doc.materials.filter((m) => m.id !== materialId) }, [materialId]);
}

// ── 挑图 / 挑视频版本 ────────────────────────────────────────────────────────

function pickIn<T extends { versions: { key: string }[]; pickedKey?: string }>(set: T, key: string): T {
  if (!set.versions.some((v) => v.key === key)) return set;
  if (set.pickedKey === key) return set;
  return { ...set, pickedKey: key };
}

/**
 * 挑中某一版：target 用 RunTarget 的写法 —— look:<id> / scene:<id> / material:<id>（候选图）、
 * frame:<集>:<片段>（首帧）、video:<集>:<片段>（视频版本）。key 不在候选里时原样返回。
 */
export function setPicked(doc: DramaCanvasDoc, target: DramaCanvasRunTarget | string, key: string): DramaCanvasDoc {
  const t = parseRunTarget(target);
  if (!t) return doc;
  switch (t.kind) {
    case "look":
      return mapLook(doc, t.id, (l) => {
        const images = pickIn(l.images, key);
        return images === l.images ? l : { ...l, images };
      });
    case "scene":
      return mapScene(doc, t.id, (s) => {
        const images = pickIn(s.images, key);
        return images === s.images ? s : { ...s, images };
      });
    case "material":
      return mapMaterial(doc, t.id, (m) => {
        if (!m.images) return m;
        const images = pickIn(m.images, key);
        return images === m.images ? m : { ...m, images };
      });
    case "frame":
      return mapSegment(doc, t.no, t.segmentId, (s) => {
        const frame = pickIn(s.frame, key);
        return frame === s.frame ? s : { ...s, frame };
      });
    case "video":
      return mapSegment(doc, t.no, t.segmentId, (s) => {
        const video = pickIn(s.video, key);
        return video === s.video ? s : { ...s, video };
      });
    default:
      return doc;
  }
}

// ── 逐集 / 片段 ──────────────────────────────────────────────────────────────

/** 确保有这一集的逐集记录（按集号升序插入）。已有时原样返回。 */
export function ensureEpisode(doc: DramaCanvasDoc, no: number): DramaCanvasDoc {
  if (findEpisode(doc, no)) return doc;
  const episodes = [...doc.episodes, { no, segments: [] }].sort((a, b) => a.no - b.no);
  return { ...doc, episodes };
}

export function emptySegment(id = newId("segment")): CanvasSegment {
  return { id, text: "", durationSec: 0, frame: { versions: [] }, video: { versions: [] } };
}

/** 在第 index 个位置插一个空片段（index 越界时夹到两端）；这一集还没有逐集记录时先建。 */
export function insertSegment(doc: DramaCanvasDoc, no: number, index: number): { doc: DramaCanvasDoc; segmentId: string } {
  const seg = emptySegment();
  const withEp = ensureEpisode(doc, no);
  const next = mapEpisode(withEp, no, (e) => {
    const at = Math.max(0, Math.min(e.segments.length, Math.trunc(index)));
    const segments = e.segments.slice();
    segments.splice(at, 0, seg);
    return { ...e, segments };
  });
  return { doc: next, segmentId: seg.id };
}

export function removeSegment(doc: DramaCanvasDoc, no: number, segmentId: string): DramaCanvasDoc {
  return mapEpisode(doc, no, (e) => {
    if (!e.segments.some((s) => s.id === segmentId)) return e;
    return { ...e, segments: e.segments.filter((s) => s.id !== segmentId) };
  });
}

/**
 * 改片段。改了 text 而没显式给 durationSec 时，按文本里各镜时长的和同步 durationSec
 * （文本里一个时长都没写 = 和为 0 时保留原值，免得一改字就把时长清零）。
 */
export function updateSegment(
  doc: DramaCanvasDoc,
  no: number,
  segmentId: string,
  patch: Partial<Omit<CanvasSegment, "id">>,
): DramaCanvasDoc {
  return mapSegment(doc, no, segmentId, (s) => {
    const next: CanvasSegment = { ...s, ...patch };
    if (patch.text !== undefined && patch.durationSec === undefined) {
      const total = totalDuration(patch.text);
      if (total > 0) next.durationSec = total;
    }
    const same = (Object.keys(next) as (keyof CanvasSegment)[]).every((k) => next[k] === s[k]);
    return same ? s : next;
  });
}

/**
 * 这一集做到哪了：片段数、有挑中视频的片段数、成片是否过期
 * （合成时用的各片段视频和现在挑中的对不上 = 过期，界面提示「成片是旧的，重新合成」）。
 */
export function episodeProgress(doc: DramaCanvasDoc, no: number): { segments: number; withVideo: number; assembledStale: boolean } {
  const ep = findEpisode(doc, no);
  if (!ep) return { segments: 0, withVideo: 0, assembledStale: false };
  const picked = ep.segments.map((s) => pickedVideo(s.video)?.key);
  const withVideo = picked.filter(Boolean).length;
  let assembledStale = false;
  if (ep.assembled) {
    const used = ep.assembled.videoKeys;
    assembledStale = used.length !== picked.length || used.some((k, i) => k !== picked[i]);
  }
  return { segments: ep.segments.length, withVideo, assembledStale };
}

/** 造型的显示名：「林微·学生时期」；造型名是「基础造型」（或空）时只显示角色名。 */
export function lookLabel(character: Pick<CanvasCharacter, "name">, look: Pick<CanvasLook, "name">): string {
  const lookName = look.name.trim();
  if (!lookName || lookName === BASE_LOOK_NAME) return character.name;
  return `${character.name}·${lookName}`;
}

// ── 存盘前剥掉派生地址 ───────────────────────────────────────────────────────

/**
 * 递归去掉 `url` / `lastFrameUrl`（签名地址 1 小时就过期，不许存回文档；drama-canvas.ts 红线 1）。
 * 只用在发出去的请求体上 —— 内存里的文档保留地址，界面照常显示。服务端落库前还会再剥一遍。
 */
export function stripAssetUrls<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripAssetUrls(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "url" || k === "lastFrameUrl") continue;
      out[k] = stripAssetUrls(v);
    }
    return out as T;
  }
  return value;
}
