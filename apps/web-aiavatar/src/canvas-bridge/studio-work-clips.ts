import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/canvas/types/canvas";
import { parseStudioCaptions } from "./studio-packaging";

/** Episode a clip belongs to in the work editor (clips without one belong to the first). */
export const studioClipEpisode = (node: CanvasNodeData) => node.metadata?.studio?.episodeNo || 1;

/**
 * Videos that other videos were made from (e.g. the original a recreation copies), and the cuts a film study made of it.
 * They are inputs, not cuts: the work editor leaves them out unless the user puts them in. A reference is often used only
 * through its analysis, never by a new clip, so it is also known by what points at it: a film-study cut carries its
 * `sourceRange`, the analysis names or links its reference (production 2026-10-19: the reference and three cuts were
 * ticked next to the three new clips).
 */
export function studioSourceClipIds(nodes: CanvasNodeData[], connections: CanvasConnection[]): Set<string> {
  const videos = new Map(nodes.filter(n => n.type === CanvasNodeType.Video).map(n => [n.id, n]));
  // Assembled works reference every clip they contain; that does not make those clips source material.
  const makers = [...videos.values()].filter(n => n.metadata?.studio?.kind !== "work");
  const ids = new Set<string>();
  for (const edge of connections) {
    if (edge.fromNodeId !== edge.toNodeId && videos.has(edge.fromNodeId) && makers.some(n => n.id === edge.toNodeId)) ids.add(edge.fromNodeId);
  }
  const keys = new Set<string>();
  for (const node of makers) {
    const own = node.metadata?.storageKey, studio = node.metadata?.studio;
    for (const ref of [...(studio?.references || []), ...(studio?.request?.references || [])]) if (ref.role !== "clip" && ref.storageKey !== own) keys.add(ref.storageKey);
    for (const ref of studio?.request?.video?.references || []) if (ref.key !== own) keys.add(ref.key);
  }
  for (const node of videos.values()) if (node.metadata?.storageKey && keys.has(node.metadata.storageKey)) ids.add(node.id);
  const analyses = new Set(nodes.filter(n => n.metadata?.studio?.kind === "recreation").map(n => n.id));
  for (const node of nodes) {
    const named = node.metadata?.studio?.recreation?.sourceNodeId;
    if (named && videos.has(named)) ids.add(named);
  }
  for (const edge of connections) if (videos.has(edge.fromNodeId) && analyses.has(edge.toNodeId)) ids.add(edge.fromNodeId);
  for (const node of videos.values()) if (node.metadata?.studio?.sourceRange) ids.add(node.id);
  return ids;
}

/** The one rule for "is this clip in the cut": an explicit choice wins, otherwise everything but source material. */
export const studioClipIncluded = (node: CanvasNodeData, sourceIds: Set<string>) =>
  node.metadata?.studio?.includeInWork ?? !sourceIds.has(node.id);

export type StudioClipOrigin = "source" | "generated" | "uploaded";
export function studioClipOrigin(node: CanvasNodeData, sourceIds: Set<string>): StudioClipOrigin {
  if (sourceIds.has(node.id)) return "source";
  const studio = node.metadata?.studio;
  return studio?.runId || studio?.request || studio?.execution || studio?.lipSyncRequest ? "generated" : "uploaded";
}

const GENERIC_TITLES = new Set(["", "视频", "视频片段", "生成视频", "上传视频", "video", "Video"]);
/** Default node titles say nothing about the clip; name it by where it came from instead. */
export function studioClipName(node: CanvasNodeData, origin: StudioClipOrigin): string {
  const title = node.title?.trim() || "";
  if (!GENERIC_TITLES.has(title) && !/^视频\s*\d+$/.test(title)) return title;
  return origin === "source" ? "原片" : origin === "generated" ? "AI 生成的片段" : "上传的视频";
}

/** Best known length before the browser has read the file: the adopted take, the upload probe, then the node. */
export function studioMediaSeconds(node: CanvasNodeData): number | undefined {
  const take = node.metadata?.videos?.find(v => v.id === node.metadata?.primaryVideoId);
  const candidates = [Number(take?.seconds), (node.metadata?.durationMs || 0) / 1000, Number(node.metadata?.seconds)];
  return candidates.find(s => Number.isFinite(s) && s > 0);
}

export function formatStudioSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds * 10) / 10} 秒`;
  const whole = Math.round(seconds), minutes = Math.floor(whole / 60), rest = whole % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

/** Player clock, mm:ss. */
export function formatStudioClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

/** The server letterboxes (scale + pad) clips whose shape differs from the chosen output by more than 2%. */
export function studioRatioHint(width: number | undefined, height: number | undefined, ratio: string): string | undefined {
  const [w, h] = ratio.split(":").map(Number);
  if (!width || !height || !w || !h) return undefined;
  const want = w / h, have = width / height;
  if (Math.abs(have - want) / want <= 0.02) return undefined;
  if (have > want) return want < 1 ? "横屏画面，成片里上下会留黑边" : "画面更宽，成片里上下会留黑边";
  return want > 1 ? "竖屏画面，成片里左右会留黑边" : "画面更窄，成片里左右会留黑边";
}

/** Start time of each clip in the cut; undefined once a length before it is unknown. */
export function studioClipOffsets(seconds: (number | undefined)[]): (number | undefined)[] {
  let at: number | undefined = 0;
  return seconds.map(s => { const start = at; at = at === undefined || s === undefined ? undefined : at + s; return start; });
}

/** "0-5: " lines for each clip, so the user only writes the words. */
export function studioCaptionTemplate(seconds: number[]): string {
  const round = (v: number) => Math.round(v * 10) / 10;
  let at = 0;
  return seconds.map(s => { const line = `${round(at)}-${round(at + s)}: `; at += s; return line; }).join("\n");
}

/** Caption problems the server would reject, said before the user waits for an assembly. */
export function studioCaptionProblem(text: string, totalSeconds?: number): string | undefined {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const empty = lines.findIndex(l => /^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*[:：]\s*$/.test(l));
  if (empty >= 0) return `第 ${empty + 1} 条字幕还没写内容`;
  let captions: ReturnType<typeof parseStudioCaptions>;
  try { captions = parseStudioCaptions(text); } catch (e) { return e instanceof Error ? e.message : "字幕格式不对"; }
  if (totalSeconds === undefined) return undefined;
  const late = captions.findIndex(c => c.end > totalSeconds + 0.25);
  return late >= 0 ? `第 ${late + 1} 条字幕结束在 ${captions[late].end} 秒，成片只有 ${formatStudioSeconds(totalSeconds)}` : undefined;
}
