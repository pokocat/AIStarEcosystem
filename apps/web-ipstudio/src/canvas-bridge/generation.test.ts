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
// 字段名必须与服务端 IpRunDto 一致：**output**（单数）。
// 这份 fixture 此前写的是 outputs（复数）—— 跟被测代码里同一个笔误配成了一对，
// 于是测试一直是绿的，而生产上每一次出图都被判成「这次没有出图」。
const done = (candidates: Array<{ key: string; url: string }>) => ({
  id: "IPR-1", projectId: "IPP-test", nodeId: "n-1", status: "done" as const, cost: 16,
  output: { candidates },
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

    await expect(requestEdit(cfg, "空结果", [])).rejects.toThrow(/没有返回图片/);
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

describe("运行结果的字段名必须跟服务端一致", () => {
  it("读的是 output.candidates（不是 outputs）", async () => {
    // v0.162 修的那条：canvas-bridge 手抄了一份 IpRun 类型，把字段写成 outputs（复数），
    // 而服务端 IpRunDto 发的是 output（单数）。于是 run.outputs 永远 undefined，
    // **每一次画布出图都被判成「这次没有出图」** —— 服务端出了图、也扣了费。
    // 类型现在直接用 @ai-star-eco/types，这条测试守的是「真的按服务端字段读」。
    generateMock.mockResolvedValue({ id: "IPR-1", status: "running" });
    readRunMock.mockResolvedValue({
      id: "IPR-1",
      status: "done",
      output: { candidates: [{ key: "ipstudio_gen/u/a.png", url: "https://cdn/a.png?sig=1" }] },
    });

    const out = await requestGeneration({ ...cfg, count: "1" }, "画一个");
    expect(out).toHaveLength(1);
    expect(out[0].storageKey).toBe("ipstudio_gen/u/a.png");
  });

  it("真的没有候选时，不许谎称积分已退回", async () => {
    // 运行是 done 就意味着已经结算了。此前这里写死「积分已退回」，是错的。
    generateMock.mockResolvedValue({ id: "IPR-2", status: "running" });
    readRunMock.mockResolvedValue({ id: "IPR-2", status: "done", output: { candidates: [] } });

    const err = await requestGeneration({ ...cfg, count: "1" }, "画一个").catch((e: Error) => e);
    expect((err as Error).message).toContain("IPR-2");
    expect((err as Error).message).not.toContain("已退回");
  });
});

// 「这次到底发给模型什么」必须留痕：出的图不像参考图时，用户能看的只有这个。
// 成功要留，失败更要留 —— 失败那次恰恰是最需要看提示词的一次。
describe("留下这次的真实入参", () => {
  it("成功时记下完整提示词与参考图生效情况", async () => {
    const { useLastRun } = await import("./last-run");
    useLastRun.getState().set(null);
    generateMock.mockResolvedValue({ id: "IPR-9", status: "running" });
    readRunMock.mockResolvedValue({
      ...done([{ key: "ipstudio_gen/u1/a.png", url: "https://cdn.test/a" }]),
      id: "IPR-9",
      inputs: {
        prompt: "模板前缀 用户写的那段 模板后缀",
        refs: [{ role: "reference", note: "原照片", applied: true },
               { role: "reference", note: "风格图", applied: false, reason: "读不到" }],
        size: "768x1024", count: 1,
      },
    });

    await requestEdit(cfg, "用户写的那段", []);
    const last = useLastRun.getState().last!;
    expect(last.id).toBe("IPR-9");
    expect(last.prompt).toContain("模板前缀");
    expect(last.refs.map((r) => r.applied)).toEqual([true, false]);
    expect(last.refs[1].reason).toBe("读不到");
  });

  it("失败时也记 —— 不然最该看提示词的那次反而什么都看不到", async () => {
    const { useLastRun } = await import("./last-run");
    useLastRun.getState().set(null);
    generateMock.mockResolvedValue({ id: "IPR-10", status: "running" });
    readRunMock.mockResolvedValue({
      id: "IPR-10", projectId: "IPP-test", nodeId: "n-1", status: "failed",
      cost: 0, errorMessage: "模型拒绝了这次请求",
      inputs: { prompt: "发出去的完整提示词", refs: [] },
      output: {},
    });

    await expect(requestEdit(cfg, "x", [])).rejects.toThrow("模型拒绝了这次请求");
    expect(useLastRun.getState().last?.prompt).toBe("发出去的完整提示词");
  });
});
