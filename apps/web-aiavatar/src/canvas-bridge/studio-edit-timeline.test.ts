import { expect, test } from "vitest";
import type { ProjectJSON } from "@twick/timeline";
import { cornerFrame, studioEditGapSeconds, toEditTimeline, toLiveProject, toStoredProject } from "./studio-edit-timeline";

const size = { width: 720, height: 1280 };
// 形状照 Twick 0.15.31 的 ElementSerializer：视频 / 音频带 mediaDuration，字幕的文字在 t 上，文字位置在 props.x / y。
const project = (): ProjectJSON => ({ version: 1, tracks: [
  { id: "t-v", name: "视频", type: "video", elements: [
    { id: "v1", type: "video", s: 0, e: 2.5, props: { src: "blob:a", time: 0.5, volume: 0 }, mediaDuration: 3, metadata: { storageKey: "a.mp4", mediaDuration: 3 } },
    // 拖得比素材还长：素材 2 秒，从 0 开始，放了 3 秒。
    { id: "v2", type: "video", s: 3.5, e: 6.5, props: { src: "blob:b" }, mediaDuration: 2, metadata: { storageKey: "b.mp4" } },
    // 没有 storageKey 的（本地拖进来的）不交给服务端。
    { id: "v3", type: "video", s: 7, e: 8, props: { src: "blob:c" }, metadata: {} },
  ] },
  { id: "t-a", name: "配音", type: "audio", elements: [
    { id: "a1", type: "audio", s: 1, e: 5, props: { src: "blob:v", time: 0, volume: 3 }, mediaDuration: 10, metadata: { storageKey: "voice.m4a" } },
  ] },
  { id: "t-t", name: "文字", type: "element", elements: [
    { id: "x1", type: "text", s: 0, e: 2, props: { text: " 限时优惠 ", x: 10, y: -400, fontSize: 72.4, fill: "#fd0" } },
    { id: "x2", type: "text", s: 0, e: 2, props: { text: "   ", fill: "#FFFFFF" } },
    { id: "x3", type: "text", s: 2, e: 2, props: { text: "零长度", fill: "#FFFFFF" } },
  ] },
  { id: "t-c", name: "字幕", type: "caption", props: { capStyle: "soft_box" }, elements: [
    { id: "c1", type: "caption", s: 3.6, e: 5.4, t: "这是第一句字幕", props: {} },
  ] },
] });

test("the editor project becomes the clip / audio / text / caption list the server renders", () => {
  expect(toEditTimeline(project(), size)).toEqual({ width: 720, height: 1280,
    clips: [{ storageKey: "a.mp4", start: 0, end: 2.5, from: 0.5, volume: 0 }, { storageKey: "b.mp4", start: 3.5, end: 5.5, from: 0, volume: 1 }],
    audios: [{ storageKey: "voice.m4a", start: 1, end: 5, from: 0, volume: 2 }],
    texts: [{ text: "限时优惠", start: 0, end: 2, x: 10, y: -400, fontSize: 72, color: "#FFDD00" }],
    captions: [{ text: "这是第一句字幕", start: 3.6, end: 5.4 }] });
});

test("a split clip keeps reading from where the cut was", () => {
  const split = { version: 1, tracks: [{ id: "t", name: "视频", type: "video", elements: [
    { id: "p1", type: "video", s: 0, e: 1.2, props: { src: "blob:a", time: 0 }, metadata: { storageKey: "a.mp4", mediaDuration: 3 } },
    { id: "p2", type: "video", s: 1.2, e: 3, props: { src: "blob:a", time: 1.2 }, metadata: { storageKey: "a.mp4", mediaDuration: 3 } },
  ] }] } as ProjectJSON;
  expect(toEditTimeline(split, size).clips).toEqual([
    { storageKey: "a.mp4", start: 0, end: 1.2, from: 0, volume: 1 }, { storageKey: "a.mp4", start: 1.2, end: 3, from: 1.2, volume: 1 }]);
});

test("the saved project keeps storage keys, not blob addresses, and reopens with fresh ones", () => {
  const stored = toStoredProject(project());
  const media = (stored.tracks as ProjectJSON["tracks"]).flatMap(t => t.elements).filter(el => el.type === "video" || el.type === "audio");
  expect(media.map(el => el.props?.src)).toEqual(["", "", ""]);
  expect(media.map(el => el.id)).toEqual(["v1", "v2", "a1"]);
  const live = toLiveProject(stored, new Map([["a.mp4", "blob:new-a"], ["voice.m4a", "blob:new-v"]]));
  const reopened = live.tracks.flatMap(t => t.elements).filter(el => el.type === "video" || el.type === "audio");
  // b.mp4 没取到：从时间线去掉，其余换成新地址。
  expect(reopened.map(el => [el.id, el.props?.src])).toEqual([["v1", "blob:new-a"], ["a1", "blob:new-v"]]);
});

test("speed, fades and colour travel with the clip; the source start follows Twick's playback formula", () => {
  const timeline = toEditTimeline({ version: 1, tracks: [{ id: "v", name: "视频", type: "video", elements: [
    // Twick 播放的素材时间 = (time + 已播放秒数) × 速度。2 倍速、time 1 秒 → 从素材第 2 秒开始；素材 10 秒，最多放 4 秒。
    { id: "a", type: "video", s: 0, e: 6, props: { src: "x", time: 1, playbackRate: 2, mediaFilter: "warm" }, animation: { name: "fade", animate: "both", interval: 0.5 }, metadata: { storageKey: "a", mediaDuration: 10 } },
    { id: "b", type: "video", s: 4, e: 6, props: { src: "x", mediaFilter: "unknown" }, animation: { name: "rise", animate: "enter" }, metadata: { storageKey: "b" } },
  ] }] }, size);
  expect(timeline.clips).toEqual([
    { storageKey: "a", start: 0, end: 4, from: 2, volume: 1, speed: 2, fadeIn: 0.5, fadeOut: 0.5, look: "warm" },
    { storageKey: "b", start: 4, end: 6, from: 0, volume: 1 },
  ]);
  expect(timeline.overlays).toBeUndefined();
});

test("small windows and images sit on top of the main track with their position and size", () => {
  const timeline = toEditTimeline({ version: 1, tracks: [
    { id: "v", name: "视频", type: "video", elements: [{ id: "a", type: "video", s: 0, e: 5, props: { src: "x" }, metadata: { storageKey: "a" } }] },
    { id: "p", name: "小窗", type: "video", elements: [{ id: "p", type: "video", s: 1, e: 3, props: { src: "x", volume: 0 }, frame: { size: [240, 135], x: 200, y: -500 }, metadata: { storageKey: "p", pip: true } }] },
    { id: "i", name: "图片", type: "element", elements: [{ id: "i", type: "image", s: 2, e: 4, props: { src: "x" }, frame: { size: [100, 100], x: -100, y: 400 }, metadata: { storageKey: "i" } }] },
  ] }, size);
  expect(timeline.clips.map(c => c.storageKey)).toEqual(["a"]);
  expect(timeline.overlays).toEqual([
    { kind: "video", storageKey: "p", start: 1, end: 3, from: 0, x: 200, y: -500, width: 240, height: 135, volume: 0 },
    { kind: "image", storageKey: "i", start: 2, end: 4, x: -100, y: 400, width: 100, height: 100 },
  ]);
});

test("automatic captions are only asked for when the timeline has none of its own", () => {
  expect(toEditTimeline(project(), size, { autoCaptions: true }).autoCaptions).toBeUndefined();
  const bare: ProjectJSON = { version: 1, tracks: [{ id: "v", name: "视频", type: "video", elements: [{ id: "a", type: "video", s: 0, e: 5, props: { src: "x" }, metadata: { storageKey: "a" } }] }] };
  expect(toEditTimeline(bare, size, { autoCaptions: true }).autoCaptions).toBe(true);
  expect(toEditTimeline(bare, size).autoCaptions).toBeUndefined();
  expect(toEditTimeline(bare, size, { musicStorageKey: "song.mp3" }).musicStorageKey).toBe("song.mp3");
  expect(toEditTimeline(bare, size).musicStorageKey).toBeUndefined();
});

test("a corner frame stays inside the picture on every side", () => {
  for (const corner of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
    const frame = cornerFrame(size, 16 / 9, corner, 0.34);
    expect(Math.abs(frame.x) + frame.size[0] / 2).toBeLessThanOrEqual(size.width / 2);
    expect(Math.abs(frame.y) + frame.size[1] / 2).toBeLessThanOrEqual(size.height / 2);
  }
});

test("gap seconds count the black stretches between clips, including before the first one", () => {
  expect(studioEditGapSeconds([{ start: 0, end: 5 }, { start: 5, end: 8 }])).toBe(0);
  expect(studioEditGapSeconds([{ start: 7, end: 10 }, { start: 0, end: 5 }])).toBe(2);
  expect(studioEditGapSeconds([{ start: 1, end: 2 }])).toBe(1);
});

test("gap seconds ignore overlaps and rounding noise", () => {
  expect(studioEditGapSeconds([{ start: 0, end: 5 }, { start: 3, end: 8 }, { start: 8.01, end: 9 }])).toBe(0);
});
