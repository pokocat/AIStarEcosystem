// 成片高级编辑（2026-10-19）的工程转换，纯函数、不加载 Twick 运行时，便于测试：
// · toStoredProject / toLiveProject：存档时去掉 blob 地址只留 storageKey，打开时换回来；
// · toEditTimeline：导出时转成服务端合成用的清单（StudioEditTimeline）。
import type { ProjectJSON } from "@twick/timeline";
import type { StudioAdvancedEdit, StudioEditTimeline } from "@ai-star-eco/types/ip-studio-workflow";

/** 存档时去掉 blob 地址，只留 storageKey；打开时再换回来。没有 storageKey 的媒体（不该出现）不落库。 */
export function toStoredProject(project: ProjectJSON): StudioAdvancedEdit["project"] {
  return { ...project, tracks: project.tracks.map(track => ({ ...track,
    elements: track.elements.filter(el => !el.props?.src || el.metadata?.storageKey)
      .map(el => el.props?.src ? { ...el, props: { ...el.props, src: "" } } : el) })) };
}
export function toLiveProject(stored: StudioAdvancedEdit["project"], urls: Map<string, string>): ProjectJSON {
  const tracks = (stored.tracks as ProjectJSON["tracks"]).map(track => ({ ...track,
    elements: track.elements.filter(el => !el.metadata?.storageKey || urls.has(String(el.metadata.storageKey)))
      .map(el => el.metadata?.storageKey ? { ...el, props: { ...el.props, src: urls.get(String(el.metadata.storageKey)) } } : el) }));
  return { ...(stored as unknown as ProjectJSON), tracks };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const hexColor = (value: unknown) => {
  const s = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase() : "#FFFFFF";
};
const speedOf = (props: Record<string, unknown>) => {
  const rate = Number(props.playbackRate ?? 1);
  return Number.isFinite(rate) && rate > 0 ? clamp(rate, 0.5, 2) : 1;
};
/** Twick 的 fade 动画就是导出时的淡入淡出：enter = 开头，exit = 结尾，both = 两头；interval 是秒数。 */
const fades = (el: ProjectJSON["tracks"][number]["elements"][number]) => {
  const animation = el.animation as { name?: string; animate?: string; interval?: number } | undefined;
  if (animation?.name !== "fade") return {};
  const seconds = clamp(Number(animation.interval) || 0.5, 0.1, 3);
  return { ...(animation.animate === "enter" || animation.animate === "both" ? { fadeIn: seconds } : {}), ...(animation.animate === "exit" || animation.animate === "both" ? { fadeOut: seconds } : {}) };
};
const LOOKS = new Set(["saturated", "bright", "black_white", "warm", "cool"]);
/** 显示尺寸和位置：Twick 把它们放在 frame 上，x / y 是相对画面中心的偏移。 */
const frameOf = (el: ProjectJSON["tracks"][number]["elements"][number], size: { width: number; height: number }) => {
  const frame = (el.frame || {}) as { size?: [number, number]; width?: number; height?: number; x?: number; y?: number };
  return { x: round(clamp(Number(frame.x) || 0, -size.width, size.width)), y: round(clamp(Number(frame.y) || 0, -size.height, size.height)),
    width: round(clamp(Number(frame.size?.[0] ?? frame.width) || size.width / 3, 16, size.width * 2)), height: round(clamp(Number(frame.size?.[1] ?? frame.height) || size.height / 3, 16, size.height * 2)) };
};

/**
 * 把 Twick 工程转成服务端合成用的清单。只认我们界面上能加的这些：视频、音频、图片、文字、字幕。
 * · 视频 / 音频：Twick 播放的素材时间是 (props.time + 已播放秒数) × 速度，所以素材起点是 props.time × 速度；
 *   拖得比素材还长的收回到素材末尾（服务端按时长截取，素材不够会让后面的片段错位）。
 * · metadata.pip 的视频和所有图片叠在主画面上（画中画、贴图），其余视频排成主轨。
 * · 文字：props.x / y 是相对画面中心的偏移，原样交给服务端；颜色统一成 #RRGGBB。
 * · 字幕：文字在元素的 t 上。
 * · autoCaptions：时间线上没有字幕时，导出时自动生成。
 * · musicStorageKey：背景音乐，不进时间线，导出时铺满全片并在说话时压低。
 */
export function toEditTimeline(project: ProjectJSON, size: { width: number; height: number }, options?: { autoCaptions?: boolean; musicStorageKey?: string }): StudioEditTimeline {
  const out: StudioEditTimeline = { width: size.width, height: size.height, clips: [], audios: [], texts: [], captions: [], overlays: [] };
  for (const track of project.tracks) for (const el of track.elements) {
    const start = round(Math.max(0, Number(el.s) || 0)), end = round(Number(el.e) || 0);
    if (!(end > start)) continue;
    const props = el.props || {};
    if (el.type === "video" || el.type === "audio") {
      const storageKey = el.metadata?.storageKey ? String(el.metadata.storageKey) : "";
      if (!storageKey) continue;
      const speed = speedOf(props);
      const from = round(Math.max(0, Number(props.time) || 0) * speed);
      const media = Number(el.metadata?.mediaDuration ?? el.mediaDuration);
      const stop = Number.isFinite(media) && media > 0 ? Math.min(end, round(start + (media - from) / speed)) : end;
      if (!(stop - start > 0.01)) continue;
      const volume = Number(props.volume ?? 1);
      const level = Number.isFinite(volume) ? clamp(volume, 0, 2) : 1;
      if (el.type === "video" && el.metadata?.pip) {
        out.overlays!.push({ kind: "video", storageKey, start, end: stop, from, ...frameOf(el, size), volume: level, ...(speed !== 1 ? { speed } : {}) });
        continue;
      }
      const look = String(props.mediaFilter || "");
      (el.type === "video" ? out.clips : out.audios).push({ storageKey, start, end: stop, from, volume: level, ...(speed !== 1 ? { speed } : {}),
        ...(el.type === "video" ? fades(el) : {}), ...(el.type === "video" && LOOKS.has(look) ? { look } : {}) });
    } else if (el.type === "image") {
      const storageKey = el.metadata?.storageKey ? String(el.metadata.storageKey) : "";
      if (storageKey) out.overlays!.push({ kind: "image", storageKey, start, end, ...frameOf(el, size) });
    } else if (el.type === "text") {
      const text = String(props.text || "").trim().slice(0, 120);
      if (text) out.texts.push({ text, start, end, x: round(clamp(Number(props.x) || 0, -size.width, size.width)), y: round(clamp(Number(props.y) || 0, -size.height, size.height)),
        fontSize: Math.round(clamp(Number(props.fontSize) || 48, 12, 200)), color: hexColor(props.fill) });
    } else if (el.type === "caption") {
      const text = String(el.t ?? props.text ?? "").trim().slice(0, 80);
      if (text) out.captions.push({ text, start, end });
    }
  }
  if (!out.overlays!.length) delete out.overlays;
  if (options?.autoCaptions && !out.captions.length) out.autoCaptions = true;
  if (options?.musicStorageKey) out.musicStorageKey = options.musicStorageKey;
  return out;
}

/** 小窗放在四个角之一：只调大小，不用自己算坐标。corner：[-1 左 / 1 右, -1 上 / 1 下]。 */
export function cornerFrame(parent: { width: number; height: number }, aspect: number, corner: [number, number], scale: number) {
  const width = Math.round(parent.width * scale), height = Math.round(width / (aspect > 0 ? aspect : 16 / 9)), margin = Math.round(parent.width / 24);
  return { size: [width, height] as [number, number], x: corner[0] * (parent.width / 2 - width / 2 - margin), y: corner[1] * (parent.height / 2 - height / 2 - margin) };
}

/** 主画面片段之间的空白秒数（拖短一段后留下的）：导出时这段是黑屏。不到 0.05 秒的不算。 */
export function studioEditGapSeconds(clips: readonly { start: number; end: number }[]): number {
  let at = 0, gaps = 0;
  for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
    if (clip.start > at + 0.05) gaps += clip.start - at;
    at = Math.max(at, clip.end);
  }
  return gaps;
}
