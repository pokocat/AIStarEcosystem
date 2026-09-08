// 画布模型下拉 ← 服务端候选。
//
// 这里守的是 v0.160 修掉的那条断链：`fetchModels()` 建好了却没人调，
// 画布下拉里于是一直是上游写死的 gpt-image-2 等我们根本没有的模型，
// 用户选中后 preflight 一律 503 ENDPOINT_NOT_ALLOWED —— 出图从头到尾跑不了。
// 跟发布按钮是同一类事故：接口做完了，UI 没接上，编译器查不出来。

import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchModelsMock = vi.fn();
vi.mock("./api", () => ({ fetchModels: (...a: unknown[]) => fetchModelsMock(...a) }));

import { useConfigStore } from "./config-store";
import { endpointIdFor, loadServerModels, SERVER_CHANNEL_ID } from "./models";

const serverModels = {
  image: [
    { endpointId: "ai-7f6cce37-778", name: "agnes-image", isDefault: true, capability: null, creditCost: 8, billingUnit: "per_image" },
  ],
  video: [
    { endpointId: "ai-39013ff4-012", name: "agnes-video", isDefault: true, capability: null, creditCost: 0, billingUnit: "per_image" },
    { endpointId: "ai-jusuan-minimax-h3", name: "MiniMax H3 · 768P", isDefault: false, capability: null, creditCost: 40, billingUnit: "per_image" },
  ],
};

beforeEach(() => {
  fetchModelsMock.mockReset();
});

describe("默认配置不能带假模型", () => {
  it("上游写死的 gpt-image-2 等已经清掉", () => {
    // 留着它们比空着更糟：用户能选，选了必然 503，而且看不出为什么。
    const models = JSON.stringify(useConfigStore.getState().config.channels);
    expect(models).not.toContain("gpt-image-2");
    expect(models).not.toContain("grok-imagine-video");
  });
});

describe("灌入服务端候选", () => {
  it("下拉里显示的是后台配的真模型名", async () => {
    fetchModelsMock.mockResolvedValue(serverModels);
    await loadServerModels();
    const ch = useConfigStore.getState().config.channels.find((c) => c.id === SERVER_CHANNEL_ID);
    expect(ch?.models.map((m) => m.name)).toEqual(["agnes-image", "agnes-video", "MiniMax H3 · 768P"]);
  });

  it("capability 按它来自哪个列表定，不靠猜名字", async () => {
    // 上游有个 guessCapability 按关键词猜（"video"/"tts"…）——「agnes-image」猜得对，
    // 「MiniMax H3 · 768P」就猜不出是视频了。服务端已经分好两个列表，别再猜。
    fetchModelsMock.mockResolvedValue(serverModels);
    await loadServerModels();
    const ch = useConfigStore.getState().config.channels.find((c) => c.id === SERVER_CHANNEL_ID);
    expect(ch?.models.find((m) => m.name === "MiniMax H3 · 768P")?.capability).toBe("video");
    expect(ch?.models.find((m) => m.name === "agnes-image")?.capability).toBe("image");
  });

  it("默认选中的是后台标了 isDefault 的那个", async () => {
    fetchModelsMock.mockResolvedValue(serverModels);
    await loadServerModels();
    const c = useConfigStore.getState().config;
    expect(endpointIdFor(c.imageModel)).toBe("ai-7f6cce37-778");
    expect(endpointIdFor(c.videoModel)).toBe("ai-39013ff4-012");
  });
});

describe("传给服务端的是 endpointId 不是模型名", () => {
  it("下拉值翻成服务端认的 id", async () => {
    fetchModelsMock.mockResolvedValue(serverModels);
    await loadServerModels();
    expect(endpointIdFor(`${SERVER_CHANNEL_ID}::MiniMax H3 · 768P`)).toBe("ai-jusuan-minimax-h3");
  });

  it("翻不出来就不传 —— 让服务端走后台配的默认端点", async () => {
    fetchModelsMock.mockResolvedValue(serverModels);
    await loadServerModels();
    // 不能瞎猜一个：指定了却悄悄换一个模型是 D-11 明令禁止的（用户按那个价付的钱）。
    expect(endpointIdFor("default::gpt-image-2")).toBeUndefined();
    expect(endpointIdFor("")).toBeUndefined();
    expect(endpointIdFor(undefined)).toBeUndefined();
  });
});

describe("后台一个端点都没配", () => {
  it("不塞假模型，就绪判断因此为 false", async () => {
    fetchModelsMock.mockResolvedValue({ image: [], video: [] });
    await loadServerModels();
    const c = useConfigStore.getState().config;
    const ch = c.channels.find((x) => x.id === SERVER_CHANNEL_ID);
    expect(ch?.models).toEqual([]);
    expect(c.imageModel).toBe("");
    // §8.0：宁可明说不可用，也不要列一个点了才失败的选项
    expect(useConfigStore.getState().isAiConfigReady(c, c.imageModel)).toBe(false);
  });
});

describe("就绪判断不再要 API Key", () => {
  it("选中的模型是服务端候选就算就绪", async () => {
    // 上游要求 baseUrl + apiKey 都填了才让跑 —— 它是单机工具，用户自带 Key。
    // 本仓的 Key 在服务端，浏览器里永远是空的：照那条判，点运行永远弹「请先配置 API Key」，
    // 而那是个用户根本无从满足的条件。
    fetchModelsMock.mockResolvedValue(serverModels);
    await loadServerModels();
    const c = useConfigStore.getState().config;
    const ch = c.channels.find((x) => x.id === SERVER_CHANNEL_ID);
    expect(ch?.apiKey).toBe("");
    expect(useConfigStore.getState().isAiConfigReady(c, c.imageModel)).toBe(true);
  });
});
