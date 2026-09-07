// 生成层的单元测试。
//
// 这一层最怕的是「静默地错」：失败被当成「成功但没出图」、取消被当成失败、
// 参考图里混进没有存储键的项目导致服务端拿不到锚。都不会报错，只会表现得莫名其妙。

import { beforeEach, describe, expect, it, vi } from "vitest";

const generateMock = vi.fn();
const readRunMock = vi.fn();
const currentProjectIdMock = vi.fn(() => "IPP-test" as string | null);

vi.mock("./api", () => ({
  generate: (...a: unknown[]) => generateMock(...a),
  readRun: (...a: unknown[]) => readRunMock(...a),
  currentProjectId: () => currentProjectIdMock(),
  signKeys: vi.fn(),
  uploadImage: vi.fn(),
  setCurrentProjectId: vi.fn(),
}));

import { GenerationCanceled, requestEdit, requestGeneration } from "./generation";
import type { AiConfig } from "./config-store";

const cfg = { count: "2", size: "768x1024", imageModel: "ep-1" } as unknown as AiConfig;
const done = (candidates: Array<{ key: string; url: string }>) => ({
  id: "IPR-1", projectId: "IPP-test", nodeId: "n-1", status: "done" as const, cost: 16,
  outputs: { candidates },
});

beforeEach(() => {
  generateMock.mockReset();
  readRunMock.mockReset();
  currentProjectIdMock.mockReturnValue("IPP-test");
});

describe("出图", () => {
  it("把候选图变成画布认得的形状，并带上存储键", async () => {
    generateMock.mockResolvedValue({ id: "IPR-1", status: "running" });
    readRunMock.mockResolvedValue(done([{ key: "ipstudio_gen/u1/a.png", url: "https://cdn.test/a?sig=1" }]));

    const images = await requestEdit(cfg, "画一只柴犬", []);

    expect(images).toHaveLength(1);
    expect(images[0]!.storageKey).toBe("ipstudio_gen/u1/a.png");
    // 画布只把 dataUrl 当 img src 用 —— 这里放的是签名地址，不是 base64
    expect(images[0]!.dataUrl).toBe("https://cdn.test/a?sig=1");
  });

  it("只把带存储键的参考图报给服务端", async () => {
    generateMock.mockResolvedValue({ id: "IPR-1", status: "running" });
    readRunMock.mockResolvedValue(done([{ key: "k", url: "u" }]));

    await requestEdit(cfg, "换个装", [
      { id: "1", storageKey: "ipstudio_gen/u1/ref.png" },
      { id: "2", dataUrl: "data:image/png;base64,AAA" },   // 还没上传的，服务端拿不到
    ]);

    expect(generateMock).toHaveBeenCalledWith("IPP-test", expect.objectContaining({
      refKeys: ["ipstudio_gen/u1/ref.png"],
    }));
  });

  it("文生图就是没有参考图的出图", async () => {
    generateMock.mockResolvedValue({ id: "IPR-1", status: "running" });
    readRunMock.mockResolvedValue(done([{ key: "k", url: "u" }]));

    await requestGeneration(cfg, "凭空画一张");

    expect(generateMock).toHaveBeenCalledWith("IPP-test", expect.objectContaining({ refKeys: [] }));
  });

  it("张数被夹在 1–4 之间", async () => {
    generateMock.mockResolvedValue({ id: "IPR-1", status: "running" });
    readRunMock.mockResolvedValue(done([{ key: "k", url: "u" }]));

    await requestEdit({ ...cfg, count: "99" } as unknown as AiConfig, "很多张", []);

    expect(generateMock).toHaveBeenCalledWith("IPP-test", expect.objectContaining({ count: 4 }));
  });
});

describe("出错要说清楚，不能装作成功", () => {
  it("服务端说失败就抛，且带上它给的原因", async () => {
    generateMock.mockResolvedValue({ id: "IPR-1", status: "running" });
    readRunMock.mockResolvedValue({
      id: "IPR-1", status: "failed", cost: 0,
      errorCode: "AI_CALL_FAILED", errorMessage: "上游模型超时",
    });

    await expect(requestEdit(cfg, "会失败的", [])).rejects.toThrow("上游模型超时");
  });

  it("跑完了但一张图都没有，也算失败", async () => {
    // 这是最阴的一种：状态是 done，候选是空数组。
    // 不拦的话画布会把「没有图」当成一次正常结果，节点停在空白上。
    generateMock.mockResolvedValue({ id: "IPR-1", status: "running" });
    readRunMock.mockResolvedValue(done([]));

    await expect(requestEdit(cfg, "空结果", [])).rejects.toThrow(/没有出图/);
  });

  it("用户取消抛的是取消，不是失败", async () => {
    // 画布靠这个区分「我自己点的取消」和「真出错了」——
    // 混在一起用户会看到一个红色报错，以为哪里坏了。
    const ac = new AbortController();
    ac.abort();
    await expect(requestEdit(cfg, "取消掉", [], { signal: ac.signal }))
      .rejects.toBeInstanceOf(GenerationCanceled);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("画布还没打开就点生成，给一句人话而不是崩掉", async () => {
    currentProjectIdMock.mockReturnValue(null);
    await expect(requestEdit(cfg, "还没打开", [])).rejects.toThrow(/画布还没打开/);
  });
});
