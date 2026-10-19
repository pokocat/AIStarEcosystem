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
/**
 * 把 Twick 工程转成服务端合成用的清单。只认我们界面上能加的四类：视频、音频、文字、字幕。
 * · 视频 / 音频：props.time 是素材里的起点；拖得比素材还长的收回到素材末尾（服务端按时长截取，素材不够会让后面的片段错位）。
 * · 文字：props.x / y 是相对画面中心的偏移，原样交给服务端；颜色统一成 #RRGGBB。
 * · 字幕：文字在元素的 t 上。
 */
export function toEditTimeline(project: ProjectJSON, size: { width: number; height: number }): StudioEditTimeline {
  const out: StudioEditTimeline = { width: size.width, height: size.height, clips: [], audios: [], texts: [], captions: [] };
  for (const track of project.tracks) for (const el of track.elements) {
    const start = round(Math.max(0, Number(el.s) || 0)), end = round(Number(el.e) || 0);
    if (!(end > start)) continue;
    const props = el.props || {};
    if (el.type === "video" || el.type === "audio") {
      const storageKey = el.metadata?.storageKey ? String(el.metadata.storageKey) : "";
      if (!storageKey) continue;
      const from = round(Math.max(0, Number(props.time) || 0));
      const media = Number(el.metadata?.mediaDuration ?? el.mediaDuration);
      const stop = Number.isFinite(media) && media > 0 ? Math.min(end, round(start + media - from)) : end;
      if (!(stop - start > 0.01)) continue;
      const volume = Number(props.volume ?? 1);
      (el.type === "video" ? out.clips : out.audios).push({ storageKey, start, end: stop, from, volume: Number.isFinite(volume) ? clamp(volume, 0, 2) : 1 });
    } else if (el.type === "text") {
      const text = String(props.text || "").trim().slice(0, 120);
      if (text) out.texts.push({ text, start, end, x: round(clamp(Number(props.x) || 0, -size.width, size.width)), y: round(clamp(Number(props.y) || 0, -size.height, size.height)),
        fontSize: Math.round(clamp(Number(props.fontSize) || 48, 12, 200)), color: hexColor(props.fill) });
    } else if (el.type === "caption") {
      const text = String(el.t ?? props.text ?? "").trim().slice(0, 80);
      if (text) out.captions.push({ text, start, end });
    }
  }
  return out;
}
