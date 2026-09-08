// 「重试」与「刷新后接回」的回归。
//
// 这两条坏掉的时候都不会报错，只会安静地花钱：
//   · 重试丢参考图 → 那一次悄悄变成纯文生图，出来的人不像自己，钱照扣；
//   · 刷新时把还在跑的运行标成「已中断」→ 服务端跑完、扣了钱，图没人认领。

import { beforeEach, describe, expect, it, vi } from "vitest";

const signKeysMock = vi.fn();
vi.mock("./api", () => ({
  signKeys: (...a: unknown[]) => signKeysMock(...a),
  uploadImage: vi.fn(),
  currentProjectId: () => "IPP-test",
  setCurrentProjectId: vi.fn(),
  generate: vi.fn(),
  readRun: vi.fn(),
  cancelRun: vi.fn(),
}));

import { applyCandidateToNode, hasResumableImageRun, resetInterruptedGeneration, resolveMetadataReferences, resumableImageRuns, isSupportedUploadImage } from "@/canvas/lib/canvas/canvas-generation-helpers";
import type { CanvasNodeData, CanvasNodeMetadata } from "@/canvas/types/canvas";

beforeEach(() => {
  signKeysMock.mockReset();
});

const imageNode = (metadata: CanvasNodeMetadata): CanvasNodeData => ({
  id: "n-1", type: "image", title: "主形象", position: { x: 0, y: 0 }, width: 340, height: 240, metadata,
});

describe("重试时的参考图", () => {
  it("存的是 OSS 存储键（referenceUrl 写进去的就是它）—— 必须还原成 storageKey", async () => {
    // 坏掉的样子：只认 `image:` 前缀（上游 IndexedDB 的约定，本仓一个都没有），
    // OSS key 落到「当成地址」那一支 → storageKey 为空 → refKeys 空数组 →
    // 服务端按纯文生图跑，而 generationType 还写着 edit。
    signKeysMock.mockResolvedValue({ "ipstudio_source/u1/ref.png": "https://cdn.test/ref.png?sig=1" });

    const refs = await resolveMetadataReferences({
      generationType: "edit",
      references: ["ipstudio_source/u1/ref.png"],
    });

    expect(refs).toHaveLength(1);
    expect(refs![0]!.storageKey).toBe("ipstudio_source/u1/ref.png");
    expect(refs![0]!.dataUrl).toBe("https://cdn.test/ref.png?sig=1");
  });

  it("签名地址换不出来也保留这一项 —— 生成只需要 key，地址只影响预览", async () => {
    signKeysMock.mockRejectedValue(new Error("网络断了"));
    const refs = await resolveMetadataReferences({
      generationType: "edit",
      references: ["ipstudio_gen/u1/a.png"],
    });
    expect(refs).toHaveLength(1);
    expect(refs![0]!.storageKey).toBe("ipstudio_gen/u1/a.png");
  });

  it("真的是外链（http）时不当成存储键", async () => {
    const refs = await resolveMetadataReferences({
      generationType: "edit",
      references: ["https://example.com/a.png"],
    });
    expect(refs![0]!.storageKey).toBeUndefined();
    expect(refs![0]!.dataUrl).toBe("https://example.com/a.png");
    expect(signKeysMock).not.toHaveBeenCalled();
  });

  it("不是 edit 就没有参考图这回事（返回空数组，不是 null）", async () => {
    await expect(resolveMetadataReferences({ generationType: "generation" })).resolves.toEqual([]);
  });
});

describe("刷新之后怎么处理还在跑的节点", () => {
  it("留了运行号的候选不许标失败 —— 那是一张已经受理、可能已扣费的图", () => {
    const [node] = resetInterruptedGeneration([
      imageNode({
        status: "loading",
        images: [{ id: "i-1", status: "loading", content: "", storageKey: undefined, naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "", runId: "IPR-9" }],
      }),
    ]);
    expect(node!.metadata!.status).toBe("loading");
    expect(node!.metadata!.images![0]!.status).toBe("loading");
    expect(hasResumableImageRun(node!)).toBe(true);
    expect(resumableImageRuns(node!).map((i) => i.runId)).toEqual(["IPR-9"]);
  });

  it("连运行号都没有的（请求没被受理）照旧标失败", () => {
    const [node] = resetInterruptedGeneration([
      imageNode({
        status: "loading",
        images: [{ id: "i-1", status: "loading", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "" }],
      }),
    ]);
    expect(node!.metadata!.status).toBe("error");
    expect(node!.metadata!.images![0]!.status).toBe("error");
    expect(hasResumableImageRun(node!)).toBe(false);
  });

  it("同一个节点上混着两种：接得回来的留着，接不回来的标失败，节点整体仍在跑", () => {
    const [node] = resetInterruptedGeneration([
      imageNode({
        status: "loading",
        images: [
          { id: "i-1", status: "loading", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "" },
          { id: "i-2", status: "loading", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "", runId: "IPR-9" },
        ],
      }),
    ]);
    expect(node!.metadata!.status).toBe("loading");
    expect(node!.metadata!.images!.map((i) => i.status)).toEqual(["error", "loading"]);
  });

  it("视频任务照旧按 videoTaskId 接回（本仓的 provider 恒为 plugin，也要存）", () => {
    const nodes: CanvasNodeData[] = [
      { id: "v-1", type: "video", title: "视频", position: { x: 0, y: 0 }, width: 300, height: 500, metadata: { status: "loading", videoTaskId: "mvj_1", videoTaskProvider: "plugin" } },
    ];
    expect(resetInterruptedGeneration(nodes)[0]).toBe(nodes[0]);
  });
});

describe("能上传什么", () => {
  const file = (name: string, type: string) => new File([new Uint8Array([1])], name, { type });

  it("只收 JPG / PNG —— 服务端 /uploads 就只收这两种", () => {
    expect(isSupportedUploadImage(file("a.jpg", "image/jpeg"))).toBe(true);
    expect(isSupportedUploadImage(file("a.png", "image/png"))).toBe(true);
    // 拖进来必然 400 的那些：此前调用点没有 catch，界面上什么都不发生
    expect(isSupportedUploadImage(file("a.mp4", "video/mp4"))).toBe(false);
    expect(isSupportedUploadImage(file("a.mp3", "audio/mpeg"))).toBe(false);
    expect(isSupportedUploadImage(file("a.webp", "image/webp"))).toBe(false);
    expect(isSupportedUploadImage(file("a.heic", "image/heic"))).toBe(false);
  });

  it("浏览器没给 type 时按扩展名认（拖拽有时就是空 type）", () => {
    expect(isSupportedUploadImage(file("photo.JPEG", ""))).toBe(true);
    expect(isSupportedUploadImage(file("clip.mov", ""))).toBe(false);
  });
});

// 写回成图这一段：v0.175 的事故就在这儿（服务端每次都出了新图、扣了钱，
// 画布上永远是第一张）。三条路径（正常出图 / 单张重试 / 刷新后接回）现在共用它，
// 所以这里的行为必须钉死。
describe("把出好的候选写回节点", () => {
  const uploaded = { url: "https://cdn/new.png?sig=1", storageKey: "ipstudio_gen/u/new.png", width: 832, height: 1248, bytes: 100, mimeType: "image/png" };

  it("还没有主图时：更新节点显示的那张 + 候选 + 运行号，并按长边收尺寸", () => {
    const [node] = applyCandidateToNode(
      [imageNode({ status: "loading", images: [{ id: "i-1", status: "loading", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "", runId: "IPR-9" }] })],
      "n-1", "i-1", uploaded, "IPR-9", 340,
    );
    const m = node!.metadata!;
    expect(m.content).toBe(uploaded.url);
    expect(m.storageKey).toBe(uploaded.storageKey);
    expect(m.primaryImageId).toBe("i-1");
    expect(m.runId).toBe("IPR-9");
    expect(m.images![0]!.status).toBe("success");
    // 竖图不许被撑成方框（v0.175 的另一半）：长边收到 340，宽按比例（832/1248）
    expect(node!.height).toBeCloseTo(340, 5);
    expect(node!.width).toBeCloseTo(340 * (832 / 1248), 5);
  });

  it("已经有主图时只进候选，不动节点当前显示的那张（多候选的第 2..N 张）", () => {
    const [node] = applyCandidateToNode(
      [imageNode({
        status: "loading",
        content: "https://cdn/first.png",
        storageKey: "ipstudio_gen/u/first.png",
        primaryImageId: "i-1",
        images: [
          { id: "i-1", status: "success", content: "https://cdn/first.png", storageKey: "ipstudio_gen/u/first.png", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "" },
          { id: "i-2", status: "loading", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "" },
        ],
      })],
      "n-1", "i-2", uploaded, "IPR-9", 0,
    );
    const m = node!.metadata!;
    expect(m.content).toBe("https://cdn/first.png");
    expect(m.primaryImageId).toBe("i-1");
    expect(m.images![1]!.storageKey).toBe(uploaded.storageKey);
  });

  it("别的节点原样返回（引用都不换，免得白白触发一次自动保存）", () => {
    const other = imageNode({ status: "success" });
    other.id = "n-2";
    const out = applyCandidateToNode([other], "n-1", "i-1", uploaded, undefined, 0);
    expect(out[0]).toBe(other);
  });
});

// 蒙版编辑 / 视角变化建的节点**没有候选数组** —— 结果直接写进节点 metadata。
// 它俩也是付费入口（v0.179 复核补上）：运行号只能记在节点级 `metadata.runId` 上，
// 漏掉就是「局部重绘一中断，那张已经扣过费的图永远找不回来」。
describe("没有候选数组的节点（蒙版编辑 / 视角变化）", () => {
  it("节点级 runId + 还没出图 = 接得回来", () => {
    const node = imageNode({ status: "loading", runId: "IPR-mask" });
    expect(resumableImageRuns(node)).toEqual([{ runId: "IPR-mask" }]);
    expect(hasResumableImageRun(node)).toBe(true);
  });

  it("已经出图了就不再接（那个 runId 只是「这张图来自哪次运行」）", () => {
    const node = imageNode({ status: "success", runId: "IPR-mask", content: "https://cdn/a.png", storageKey: "ipstudio_gen/u/a.png" });
    expect(resumableImageRuns(node)).toEqual([]);
  });

  it("刷新时不许把它标成失败", () => {
    const [node] = resetInterruptedGeneration([imageNode({ status: "loading", runId: "IPR-mask" })]);
    expect(node!.metadata!.status).toBe("loading");
    expect(node!.metadata!.runId).toBe("IPR-mask");
  });

  it("有候选数组时以候选为准（不会因为节点级 runId 多接一次）", () => {
    const node = imageNode({
      status: "loading",
      runId: "IPR-old",
      images: [{ id: "i-1", status: "loading", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "", runId: "IPR-new" }],
    });
    expect(resumableImageRuns(node)).toEqual([{ runId: "IPR-new", imageId: "i-1" }]);
  });
});

// v0.179 复核（Codex #7）：重出的正好是**当前显示的那张主候选**时，
// 节点级 content / storageKey 也必须更新 —— 那两个字段是**下游生成的参考图真值**
// （canvas-node-generation.ts 拿的就是 node.metadata.storageKey）。
// 只改候选数组的话：画布上显示新图，而接在它后面的每一次生成还照着旧图画，钱照扣。
describe("重出当前这张主候选", () => {
  const uploaded = { url: "https://cdn/new.png?sig=1", storageKey: "ipstudio_gen/u/new.png", width: 800, height: 800, bytes: 100, mimeType: "image/png" };

  it("主候选就是这一张 → 节点显示与参考图真值一起更新", () => {
    const [node] = applyCandidateToNode(
      [imageNode({
        status: "loading",
        content: "https://cdn/old.png",
        storageKey: "ipstudio_gen/u/old.png",
        primaryImageId: "i-1",
        images: [{ id: "i-1", status: "loading", content: "https://cdn/old.png", storageKey: "ipstudio_gen/u/old.png", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "" }],
      })],
      "n-1", "i-1", uploaded, "IPR-9", 340,
    );
    const m = node!.metadata!;
    expect(m.storageKey).toBe("ipstudio_gen/u/new.png");   // ← 下游参考图会拿到新图
    expect(m.content).toBe(uploaded.url);
    expect(m.primaryImageId).toBe("i-1");
    expect(m.images![0]!.storageKey).toBe("ipstudio_gen/u/new.png");
  });

  it("重出的是**别的**候选时仍然不动主图", () => {
    const [node] = applyCandidateToNode(
      [imageNode({
        status: "loading",
        content: "https://cdn/first.png",
        storageKey: "ipstudio_gen/u/first.png",
        primaryImageId: "i-1",
        images: [
          { id: "i-1", status: "success", content: "https://cdn/first.png", storageKey: "ipstudio_gen/u/first.png", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "" },
          { id: "i-2", status: "loading", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "" },
        ],
      })],
      "n-1", "i-2", uploaded, "IPR-9", 0,
    );
    expect(node!.metadata!.storageKey).toBe("ipstudio_gen/u/first.png");
  });
});
