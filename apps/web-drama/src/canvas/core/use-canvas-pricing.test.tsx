import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// 价格来自 /me/drama/config 与 /me/drama/render/models（fixture 照服务端形状写，§8.0.1 ⑦）；断数字不断文案。

vi.mock("@/api/_client", () => ({ USE_MOCK: false }));
vi.mock("@/api/drama-config", async () => {
  const actual = await vi.importActual<typeof import("@/api/drama-config")>("@/api/drama-config");
  return {
    ...actual,
    getDramaConfig: () =>
      Promise.resolve({ confirmThreshold: 20, prices: { ...actual.DRAMA_CONFIG_DEFAULTS.prices, canvasScriptOutline: 7, frame: 3 } }),
  };
});
vi.mock("@/api/render", () => ({
  listRenderModels: () =>
    Promise.resolve({
      image: [
        { endpointId: "img-a", name: "A", isDefault: true, capability: {}, creditCost: 2, billingUnit: "per_call" },
        { endpointId: "img-b", name: "B", isDefault: false, capability: {}, creditCost: 5, billingUnit: "per_call" },
      ],
      video: [
        { endpointId: "vid-sec", name: "按秒", isDefault: true, capability: { maxDurationSec: 12 }, creditCost: 6, billingUnit: "per_second" },
        { endpointId: "vid-call", name: "按次", isDefault: false, capability: { maxDurationSec: null, maxRefImages: 0 }, creditCost: 30, billingUnit: "per_call" },
      ],
    }),
}));

import { __resetCanvasPricingForTest, DEFAULT_MAX_SEGMENT_SEC, useCanvasPricing } from "./use-canvas-pricing";

async function mount() {
  const hook = renderHook(() => useCanvasPricing());
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  return hook;
}

describe("useCanvasPricing", () => {
  beforeEach(() => {
    __resetCanvasPricingForTest();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it("文字类单价读配置；出图 = 单价 × 张数（缺省默认端点）", async () => {
    const { result } = await mount();
    const p = result.current;
    expect(p.ready).toBe(true);
    expect(p.confirmThreshold).toBe(20);
    expect(p.scriptPrice("setting")).toBe(2);
    expect(p.scriptPrice("outline")).toBe(7);
    expect(p.scriptPrice("episode")).toBe(4);
    expect(p.extractPrice()).toBe(4);
    expect(p.storyboardPrice()).toBe(4);
    expect(p.imagePrice(3)).toBe(6);
    expect(p.imagePrice(2, "img-b")).toBe(10);
  });

  it("视频：按秒的 = 单价 × 秒数，按次的 = 单价；片段上限跟着当前模型；选择按画布记住", async () => {
    const { result } = await mount();
    expect(result.current.videoModelId).toBe("vid-sec");
    expect(result.current.videoPrice(7)).toBe(42);
    expect(result.current.videoPrice(7, "vid-call")).toBe(30);
    expect(result.current.maxSegmentSec()).toBe(12);
    expect(result.current.videoModels.find((m) => m.endpointId === "vid-call")?.acceptsFirstFrame).toBe(false);

    act(() => result.current.setVideoModelId("vid-call"));
    expect(result.current.videoModelId).toBe("vid-call");
    expect(result.current.videoPrice(7)).toBe(30);
    expect(result.current.maxSegmentSec()).toBe(DEFAULT_MAX_SEGMENT_SEC);
  });
});
