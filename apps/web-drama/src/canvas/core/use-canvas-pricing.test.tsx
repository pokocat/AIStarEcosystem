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
        { endpointId: "vid-sec", name: "按秒", isDefault: true, capability: { maxDurationSec: 12, minDurationSec: 5 }, creditCost: 6, billingUnit: "per_second" },
        { endpointId: "vid-call", name: "按次", isDefault: false, capability: { maxDurationSec: null, maxRefImages: 0 }, creditCost: 30, billingUnit: "per_call" },
      ],
    }),
}));

import { __resetCanvasPricingForTest, DEFAULT_MAX_SEGMENT_SEC, DEFAULT_MIN_SEGMENT_SEC, useCanvasPricing } from "./use-canvas-pricing";

async function mount() {
  const hook = renderHook(() => useCanvasPricing());
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  return hook;
}

/** Node 自带的 localStorage（没给 --localstorage-file）会盖住 jsdom 的、而且不能用：换一个内存版。 */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("useCanvasPricing", () => {
  const realStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  beforeEach(() => {
    __resetCanvasPricingForTest();
    Object.defineProperty(window, "localStorage", { configurable: true, value: fakeStorage() });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (realStorage) Object.defineProperty(window, "localStorage", realStorage);
  });

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
    expect(result.current.minSegmentSec()).toBe(5);
    expect(result.current.videoModels.find((m) => m.endpointId === "vid-call")?.acceptsFirstFrame).toBe(false);

    act(() => result.current.setVideoModelId("vid-call"));
    expect(result.current.videoModelId).toBe("vid-call");
    expect(result.current.videoPrice(7)).toBe(30);
    expect(result.current.maxSegmentSec()).toBe(DEFAULT_MAX_SEGMENT_SEC);
    expect(result.current.minSegmentSec()).toBe(DEFAULT_MIN_SEGMENT_SEC);
  });

  it("出图模型：一个画布一个选择，所有用到的组件共享；记在 localStorage，刷新后还在；价格跟着选的模型", async () => {
    const a = await mount();
    const b = await mount();
    expect(a.result.current.imageModelId).toBe("img-a");
    expect(a.result.current.imagePrice(1)).toBe(2);

    act(() => a.result.current.setImageModelId("img-b"));
    expect(a.result.current.imageModelId).toBe("img-b");
    expect(b.result.current.imageModelId).toBe("img-b"); // 另一个组件里同时变
    expect(a.result.current.imagePrice(2)).toBe(10); // 缺省 = 选中的那个
    expect(a.result.current.imagePrice(2, "img-a")).toBe(4);
    expect(a.result.current.videoModelId).toBe("vid-sec"); // 出图和视频各记各的

    // 「刷新」：内存缓存清掉，从 localStorage 读回来
    expect(window.localStorage.getItem("drama-canvas:image-model:default")).toBe("img-b");
    expect(window.localStorage.getItem("drama-canvas:video-model:default")).toBeNull();
    __resetCanvasPricingForTest();
    const again = await mount();
    expect(again.result.current.imageModelId).toBe("img-b");
  });

  it("localStorage 读写都抛（隐私模式）：照样能选，只在这一页记着", async () => {
    const throwing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    Object.defineProperty(window, "localStorage", { configurable: true, value: throwing });
    const { result } = await mount();
    expect(result.current.imageModelId).toBe("img-a");
    act(() => result.current.setImageModelId("img-b"));
    expect(result.current.imageModelId).toBe("img-b");
  });

  it("存的出图模型已经不在候选里：回到默认模型", async () => {
    window.localStorage.setItem("drama-canvas:image-model:default", "img-gone");
    const { result } = await mount();
    expect(result.current.imageModelId).toBe("img-a");
    expect(result.current.imagePrice(1)).toBe(2);
  });
});
