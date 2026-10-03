import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { RenderModelOption, RenderModelsResponse } from "@/api/render";

const listRenderModels = vi.fn();
vi.mock("@/api", () => ({ RenderApi: { listRenderModels: () => listRenderModels() } }));

import { priceBlockReason, renderCreditCost, useRenderModels } from "./render-model-select";

// 断行为：报价 = 服务端实扣（DramaRenderService.renderFrame / renderClip + effectiveVideoCreditCost）。
const opt = (endpointId: string, creditCost: number, billingUnit: RenderModelOption["billingUnit"], isDefault = false): RenderModelOption => ({
  endpointId, name: endpointId, isDefault, capability: {}, creditCost, billingUnit,
});
const models: RenderModelsResponse = {
  image: [opt("img-a", 2, "per_call", true), opt("img-b", 6, "per_call")],
  video: [opt("vid-a", 30, "per_call", true), opt("vid-sec", 40, "per_second")],
};

describe("renderCreditCost", () => {
  it("没有候选（演示模式 / 后台没配多个模型 / 列表没拉到）走全局单价", () => {
    expect(renderCreditCost({ models: { image: [], video: [] }, lane: "video", fallback: 30, durationSec: 5 })).toBe(30);
  });

  it("选了哪个模型按哪个模型的单价；没选按默认那个", () => {
    expect(renderCreditCost({ models, lane: "image", endpointId: "img-b", fallback: 2 })).toBe(6);
    expect(renderCreditCost({ models, lane: "image", fallback: 99 })).toBe(2);
    expect(renderCreditCost({ models, lane: "video", endpointId: "vid-a", fallback: 99, durationSec: 8 })).toBe(30);
  });

  it("按秒计费乘时长：选每秒 40 的模型生成 5 秒 = 200（评审复现的那一例）", () => {
    expect(renderCreditCost({ models, lane: "video", endpointId: "vid-sec", fallback: 30, durationSec: 5 })).toBe(200);
  });

  it("按秒的秒数和服务端一致：截断取整、夹到 2..60、没给按 5", () => {
    const c = (d?: number) => renderCreditCost({ models, lane: "video", endpointId: "vid-sec", fallback: 30, durationSec: d });
    expect(c(1)).toBe(80); // 服务端 clamp 到 2 秒
    expect(c(4.7)).toBe(160); // Jackson asInt 截断
    expect(c(90)).toBe(2400); // 上限 60 秒
    expect(c(undefined)).toBe(200); // asInt(5)
  });

  it("选的模型已经不在列表里：回全局单价（服务端会 503，不扣）", () => {
    expect(renderCreditCost({ models, lane: "video", endpointId: "gone", fallback: 30, durationSec: 5 })).toBe(30);
  });
});

describe("useRenderModels 的加载状态（没读到价格时不能按全局价报价）", () => {
  it("拉取失败标 failed、停用原因非空；重试成功后 ready、选中默认候选", async () => {
    listRenderModels.mockReset();
    listRenderModels.mockRejectedValueOnce(new Error("502"));
    const { result } = renderHook(() => useRenderModels());
    expect(result.current.status).toBe("loading");
    expect(priceBlockReason(result.current.status)).not.toBeNull();
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(priceBlockReason(result.current.status)).not.toBeNull();

    listRenderModels.mockResolvedValueOnce(models);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(priceBlockReason(result.current.status)).toBeNull();
    expect(result.current.videoEndpointId).toBe("vid-a");
  });
});
