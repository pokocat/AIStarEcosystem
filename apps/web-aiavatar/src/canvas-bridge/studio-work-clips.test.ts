import { describe, expect, test } from "vitest";
import type { CanvasConnection, CanvasNodeData } from "@/canvas/types/canvas";
import { reorderStudioClips } from "./studio-script";
import {
  formatStudioSeconds, studioCaptionProblem, studioCaptionTemplate, studioClipIncluded, studioClipName, studioClipOffsets,
  studioClipOrigin, studioMediaSeconds, studioRatioHint, studioSourceClipIds,
} from "./studio-work-clips";

const video = (id: string, metadata: Partial<NonNullable<CanvasNodeData["metadata"]>> = {}, title = "视频"): CanvasNodeData =>
  ({ id, type: "video" as never, title, position: { x: 0, y: 0 }, width: 320, height: 420, metadata: { status: "success", storageKey: `${id}.mp4`, ...metadata } });
const edge = (fromNodeId: string, toNodeId: string): CanvasConnection => ({ id: `${fromNodeId}-${toNodeId}`, fromNodeId, toNodeId });

describe("which clips go into the cut", () => {
  // 2026-10-19 user report: in a recreation canvas the uploaded original was ticked by default and got stitched in front of the copy.
  test("the original another video was made from is source material and stays out unless the user puts it in", () => {
    const source = video("src"), take = video("take", { studio: { kind: "shot", includeInWork: true, runId: "r1" } });
    const ids = studioSourceClipIds([source, take], [edge("src", "take")]);
    expect([...ids]).toEqual(["src"]);
    expect(studioClipIncluded(source, ids)).toBe(false);
    expect(studioClipIncluded(take, ids)).toBe(true);
    expect(studioClipIncluded({ ...source, metadata: { ...source.metadata, studio: { includeInWork: true } } }, ids)).toBe(true);
    expect(studioClipOrigin(source, ids)).toBe("source");
    expect(studioClipOrigin(take, ids)).toBe("generated");
  });

  test("a reference inside the video request marks the original even without a connection", () => {
    const source = video("src");
    const take = video("take", { studio: { kind: "shot", request: { clientRequestId: "k", nodeId: "take", operation: "video", prompt: "p",
      video: { mode: "omni-reference", resolutionTier: "768p", references: [{ mediaType: "video", key: "src.mp4" }] } } } });
    expect(studioSourceClipIds([source, take], []).has("src")).toBe(true);
  });

  test("being inside an assembled work does not make a clip source material", () => {
    const clip = video("clip"), work = video("work", { studio: { kind: "work", references: [{ storageKey: "clip.mp4", role: "clip" }] } });
    expect(studioSourceClipIds([clip, work], [edge("clip", "work")]).size).toBe(0);
  });

  test("uploaded clips nothing was made from stay in, as before", () => {
    const upload = video("up");
    const ids = studioSourceClipIds([upload], []);
    expect(studioClipIncluded(upload, ids)).toBe(true);
    expect(studioClipOrigin(upload, ids)).toBe("uploaded");
  });
});

test("default node titles are replaced by where the clip came from; real titles are kept", () => {
  expect(studioClipName(video("a"), "source")).toBe("原片");
  expect(studioClipName(video("a", {}, "视频片段"), "generated")).toBe("AI 生成的片段");
  expect(studioClipName(video("a", {}, "视频 2"), "uploaded")).toBe("上传的视频");
  expect(studioClipName(video("a", {}, "第 2 镜 · 视频"), "generated")).toBe("第 2 镜 · 视频");
});

test("length comes from the adopted take, then the upload probe, then the node", () => {
  expect(studioMediaSeconds(video("a", { primaryVideoId: "t", videos: [{ id: "t", status: "success", seconds: "5" }], durationMs: 9000, seconds: "8" }))).toBe(5);
  expect(studioMediaSeconds(video("a", { durationMs: 6000, seconds: "8" }))).toBe(6);
  expect(studioMediaSeconds(video("a", { seconds: "0" }))).toBeUndefined();
  expect(studioClipOffsets([5, 4, undefined, 3])).toEqual([0, 5, 9, undefined]);
  expect(formatStudioSeconds(4.25)).toBe("4.3 秒");
  expect(formatStudioSeconds(75)).toBe("1 分 15 秒");
});

test("letterbox hints follow the server's 2% ratio tolerance", () => {
  expect(studioRatioHint(1280, 720, "9:16")).toBe("横屏画面，成片里上下会留黑边");
  expect(studioRatioHint(720, 1280, "16:9")).toBe("竖屏画面，成片里左右会留黑边");
  expect(studioRatioHint(768, 1344, "9:16")).toBeUndefined();
  expect(studioRatioHint(undefined, undefined, "9:16")).toBeUndefined();
});

test("caption problems match what the server rejects, said before assembling", () => {
  expect(studioCaptionTemplate([6, 5, 4])).toBe("0-6: \n6-11: \n11-15: ");
  expect(studioCaptionProblem("0-6: \n6-11: 第二句")).toBe("第 1 条字幕还没写内容");
  expect(studioCaptionProblem("0-6 第一句")).toBe("第 1 条字幕请使用“开始秒-结束秒: 文字”");
  expect(studioCaptionProblem("0-6: 第一句\n6-20: 第二句", 15)).toBe("第 2 条字幕结束在 20 秒，成片只有 15 秒");
  expect(studioCaptionProblem("0-6: 第一句\n6-15.2: 第二句", 15)).toBeUndefined();
  expect(studioCaptionProblem("0-6: 第一句\n6-20: 第二句")).toBeUndefined();
});

test("moving a clip shifts the ones in between instead of swapping the two ends", () => {
  const clips = ["a", "b", "c", "d"].map(id => video(id));
  const moved = reorderStudioClips(clips, clips.map(n => n.id), 0, 2);
  expect(moved.map(n => [n.id, n.metadata?.studio?.order])).toEqual([["a", 2], ["b", 0], ["c", 1], ["d", 3]]);
  expect(reorderStudioClips(clips, clips.map(n => n.id), 1, 1)).toBe(clips);
});
