import { expect, test } from "vitest";
import type { ProjectJSON } from "@twick/timeline";
import { toEditTimeline, toLiveProject, toStoredProject } from "./studio-edit-timeline";

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
