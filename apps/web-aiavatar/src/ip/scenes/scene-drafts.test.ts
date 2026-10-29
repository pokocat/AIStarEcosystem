import { expect, test, vi } from "vitest";
vi.mock("../api", () => ({ IpStudioApi: {} }));
import type { IpProjectDoc } from "@ai-star-eco/types";
import { addImageRow, imageRows, patchNode, submissionRejected } from "./scene-drafts";

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
