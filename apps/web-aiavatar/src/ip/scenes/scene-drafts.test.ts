import { describe, expect, it, test, vi } from "vitest";
const api = vi.hoisted(() => ({ listProjects: vi.fn() }));
vi.mock("../api", () => ({ IpStudioApi: { listProjects: api.listProjects } }));
import type { IpProjectDoc } from "@ai-star-eco/types";
import { addImageRow, addScriptNode, addVideoRow, imageRows, listSceneDrafts, patchNode, resubmitRow, rowUploads, scriptNodes, submissionRejected, videoRows, sceneInputsOf, withSceneInput } from "./scene-drafts";

const empty: IpProjectDoc = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };
const photo = { key: "ipstudio/source/u1/a.jpg", url: "https://cdn/a.jpg", name: "a.jpg" };

test("a generation is a canvas row: the request is written into its node before submission, references wired in", () => {
  const { doc, request, nodeId } = addImageRow(empty, { title: "脸部三视图", prompt: "以图1为准", refs: [{ upload: photo, label: "人物照片" }],
    ratio: "16:9", count: 2, size: "2048x1152", model: "ep-1", maxCost: 16 });
  expect(request).toMatchObject({ nodeId, operation: "image", prompt: "以图1为准", aspectRatio: "16:9", count: 2, size: "2048x1152", model: "ep-1", maxCost: 16,
    references: [{ storageKey: photo.key, role: "character" }] });
  const target = doc.nodes.find(n => n.id === nodeId)!;
  expect(target.metadata?.status).toBe("loading");
  expect(target.metadata?.studio?.request).toEqual(request);
  const ref = doc.nodes.find(n => n.metadata?.storageKey === photo.key)!;
  expect(doc.connections).toEqual([expect.objectContaining({ fromNodeId: ref.id, toNodeId: nodeId })]);
  // 结果节点在参考图前面：自动封面取它出的图，而不是上传的照片。
  expect(doc.nodes.map(n => n.id)).toEqual([nodeId, ref.id]);
});

test("the same photo is placed once and reused by the next generation; newest rows list first", () => {
  const first = addImageRow(empty, { title: "A", prompt: "p", refs: [{ upload: photo, label: "人物照片" }], ratio: "1:1", count: 1 });
  const second = addImageRow(first.doc, { title: "B", prompt: "p", refs: [{ upload: photo, label: "人物照片" }], ratio: "1:1", count: 1 });
  expect(second.doc.nodes.filter(n => n.metadata?.storageKey === photo.key)).toHaveLength(1);
  expect(second.doc.connections).toHaveLength(2);
  expect(imageRows(second.doc).map(n => n.title)).toEqual(["B", "A"]);
  expect(second.request.clientRequestId).not.toBe(first.request.clientRequestId);
});

test("removing a cancelled row also removes its connections", () => {
  const row = addImageRow(empty, { title: "A", prompt: "p", refs: [{ upload: photo, label: "人物照片" }], ratio: "1:1", count: 1 });
  const doc = patchNode(row.doc, row.nodeId, () => undefined);
  expect(doc.nodes.some(n => n.id === row.nodeId)).toBe(false);
  expect(doc.connections).toHaveLength(0);
});

test("only a request the server never accepted counts as rejected; anything else keeps the original request", () => {
  expect(submissionRejected(new Error("offline"), false)).toBe(true);
  expect(submissionRejected({ status: 400, code: "STUDIO_INPUT_INVALID" }, true)).toBe(true);
  expect(submissionRejected({ status: 408 }, true)).toBe(false);
  expect(submissionRejected({ status: 502 }, true)).toBe(false);
  expect(submissionRejected(new TypeError("Failed to fetch"), true)).toBe(false);
});

test("reopening a row gives back the photos it used, in the same order", () => {
  const scene2 = { key: "ipstudio/source/u1/b.jpg", url: "https://cdn/b.jpg", name: "b.jpg" };
  const row = addImageRow(empty, { title: "换脸", prompt: "p", refs: [{ upload: photo, label: "模特图" }, { upload: scene2, label: "新面孔" }], ratio: "3:4", count: 1 });
  const node = row.doc.nodes.find(n => n.id === row.nodeId)!;
  expect(rowUploads(row.doc, node)).toEqual([{ key: photo.key, url: photo.url, name: "模特图" }, { key: scene2.key, url: scene2.url, name: "新面孔" }]);
});

test("retrying a failed row reuses the same row with the same inputs and a new request id", () => {
  const row = addImageRow(empty, { title: "A", prompt: "p", refs: [{ upload: photo, label: "人物照片" }], ratio: "1:1", count: 1, model: "ep" });
  const failed = patchNode(row.doc, row.nodeId, n => ({ ...n, metadata: { ...n.metadata, status: "error", errorDetails: "限流",
    studio: { ...n.metadata!.studio!, runId: "IPR-1" } } }));
  const again = resubmitRow(failed, row.nodeId)!;
  const node = again.doc.nodes.find(n => n.id === row.nodeId)!;
  expect(again.doc.nodes).toHaveLength(row.doc.nodes.length);
  expect(again.request).toEqual({ ...row.request, clientRequestId: again.request.clientRequestId });
  expect(again.request.clientRequestId).not.toBe(row.request.clientRequestId);
  expect(node.metadata).toMatchObject({ status: "loading", errorDetails: undefined });
  expect(node.metadata?.studio?.runId).toBeUndefined();
  expect(node.metadata?.studio?.request).toEqual(again.request);
});

test("drafts are recognised by the scene recorded on the project, so renaming a canvas keeps it in 最近", async () => {
  api.listProjects.mockResolvedValue([
    { id: "a", name: "随便改的名字", status: "draft", createdAt: "", updatedAt: "2026-10-29T02:00:00Z", sceneId: "face-turnaround" },
    { id: "b", name: "脸部三视图 · AI 图片", status: "draft", createdAt: "", updatedAt: "2026-10-29T03:00:00Z" },
    { id: "c", name: "口播带货", status: "draft", createdAt: "", updatedAt: "2026-10-29T04:00:00Z", sceneId: "ecom-talking" },
  ]);
  expect((await listSceneDrafts(new Set(["face-turnaround", "free"]))).map(p => p.id)).toEqual(["a"]);
});

test("编导每一版脚本是一个文字节点：请求带上一版正文、看哪几张图；新一版接在上一版后面", () => {
  const withPhoto = addImageRow(empty, { title: "A", prompt: "p", refs: [{ upload: photo, label: "商品图 1" }], ratio: "1:1", count: 1 }).doc;
  const imageId = withPhoto.nodes.find(n => n.metadata?.storageKey === photo.key)!.id;
  const first = addScriptNode(withPhoto, { ask: "保湿精华", revision: false, prompt: "写脚本", materialIds: [imageId], imageIds: [imageId],
    duration: 15, ratio: "9:16", language: "中文", model: "ep-qwen", maxCost: 21 });
  expect(first.request).toMatchObject({ operation: "text", prompt: "写脚本", textEdit: { content: "" }, contextNodeIds: [imageId], readVisuals: true, model: "ep-qwen", maxCost: 21 });
  const node = first.doc.nodes.find(n => n.id === first.nodeId)!;
  expect(node.metadata?.studio?.request).toEqual(first.request);
  expect(node.metadata?.studio?.sceneDirector).toMatchObject({ ask: "保湿精华", revision: false, duration: 15, ratio: "9:16" });
  expect(first.doc.connections.at(-1)).toMatchObject({ fromNodeId: imageId, toNodeId: first.nodeId });

  const written = patchNode(first.doc, first.nodeId, n => ({ ...n, metadata: { ...n.metadata, status: "success", content: "镜头1：……" } }));
  const second = addScriptNode(written, { ask: "口语一点", revision: true, prompt: "改脚本", materialIds: [imageId], imageIds: [], duration: 15, ratio: "9:16", language: "中文" });
  // 改稿基于上一版正文；不看图时不带 readVisuals。
  expect(second.request.textEdit).toEqual({ content: "镜头1：……" });
  expect(second.request.readVisuals).toBeUndefined();
  expect(second.doc.connections.at(-1)).toMatchObject({ fromNodeId: first.nodeId, toNodeId: second.nodeId });
  expect(scriptNodes(second.doc).map(n => n.id)).toEqual([first.nodeId, second.nodeId]);
});

test("按脚本出的视频挂在脚本右边，脚本和参考素材连进来；新的排前面", () => {
  const script = addScriptNode(empty, { ask: "", revision: false, prompt: "写", materialIds: [], imageIds: [], duration: 10, ratio: "9:16", language: "中文" });
  const video = { mode: "t2v", resolutionTier: "768p" };
  const a = addVideoRow(script.doc, { title: "口播带货 · 10 秒", prompt: "镜头1", scriptId: script.nodeId, refIds: [], video, durationSec: 10, aspectRatio: "9:16", model: "ep-h3", maxCost: 400 });
  expect(a.request).toMatchObject({ operation: "video", prompt: "镜头1", references: [], video, durationSec: 10, aspectRatio: "9:16", count: 1, model: "ep-h3", maxCost: 400 });
  expect(a.doc.connections.at(-1)).toMatchObject({ fromNodeId: script.nodeId, toNodeId: a.nodeId });
  const b = addVideoRow(a.doc, { title: "第二条", prompt: "镜头1", scriptId: script.nodeId, refIds: [], video, durationSec: 10, aspectRatio: "9:16" });
  expect(videoRows(b.doc).map(n => n.title)).toEqual(["第二条", "口播带货 · 10 秒"]);
  // 失败的那一条原地重交：同样的输入，新的请求编号。
  const again = resubmitRow(b.doc, a.nodeId)!;
  expect(again.request).toEqual({ ...a.request, clientRequestId: again.request.clientRequestId });
  expect(again.request.clientRequestId).not.toBe(a.request.clientRequestId);
});

// 视频页的素材格子（2026-10-30 复核：移除 / 更换只改了页面，重开又是旧素材）。
describe("scene inputs", () => {
  const media = (id: string, type: string, title: string, key: string, y = 100) => ({ id, type, title, position: { x: 100, y }, width: 100, height: 100,
    metadata: { storageKey: key, content: `https://cdn/${key}`, origin: "upload", status: "success" } });
  const legacy = { nodes: [media("v1", "audio", "声音样本", "old.mp3"), media("v2", "audio", "声音样本", "new.mp3"),
    media("r1", "video", "参考视频", "first.mp4"), media("r2", "video", "参考视频", "second.mp4"),
    media("i1", "image", "商品图 1", "a.jpg", 100), media("i2", "image", "商品图 2", "b.jpg", 400)] as never[], connections: [], viewport: { x: 0, y: 0, k: 1 } };

  it("an old draft without a record takes the newest voice and reference video, and the uploaded pictures in order", () => {
    expect(sceneInputsOf(legacy)).toEqual({ images: ["a.jpg", "b.jpg"], character: null, voice: "new.mp3", video: "second.mp4" });
  });
  it("a script written by a model that cannot read pictures recorded none, so the uploaded pictures still come back", () => {
    const script = addScriptNode(legacy, { ask: "a", revision: false, prompt: "p", materialIds: ["i1"], imageIds: [], duration: 15, ratio: "9:16", language: "中文" });
    expect(sceneInputsOf(script.doc).images).toEqual(["a.jpg", "b.jpg"]);
  });
  it("removing a slot records it as empty, and the record wins over the nodes on the canvas", () => {
    const removed = withSceneInput(legacy, "voice", "new.mp3", "remove");
    expect(removed.sceneInputs?.voice).toBeNull();
    expect(removed.nodes).toHaveLength(legacy.nodes.length);
    expect(sceneInputsOf(removed).voice).toBeNull();
    expect(sceneInputsOf(withSceneInput(removed, "voice", "old.mp3", "add")).voice).toBe("old.mp3");
  });
  it("pictures are added at the end without duplicates and removed one at a time", () => {
    const added = withSceneInput(withSceneInput(legacy, "image", "c.jpg", "add"), "image", "a.jpg", "add");
    expect(added.sceneInputs?.images).toEqual(["b.jpg", "c.jpg", "a.jpg"]);
    expect(withSceneInput(added, "image", "c.jpg", "remove").sceneInputs?.images).toEqual(["b.jpg", "a.jpg"]);
    expect(withSceneInput(legacy, "image", "z.jpg", "add", 2).sceneInputs?.images).toEqual(["a.jpg", "b.jpg"]);
  });
});
