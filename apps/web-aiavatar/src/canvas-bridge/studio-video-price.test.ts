// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ModelBillingQuote } from "@ai-star-eco/types/model-billing";

const api = vi.hoisted(() => ({ quote: vi.fn(), account: vi.fn() }));
vi.mock("./studio-model-quote", () => ({ quoteVideoPrice: api.quote }));
vi.mock("./studio-billing-preference", async original => ({ ...(await original<typeof import("./studio-billing-preference")>()), loadStudioBillingAccount: api.account }));
import { describeStudioVideoPrice, studioPreviewPayer, studioVideoPriceQuery, useStudioVideoPrice, type StudioVideoPrice } from "./studio-video-price";

/** 照服务端 ModelChargeService.Quote 的形状。 */
function quote(patch: Partial<ModelBillingQuote> = {}): ModelBillingQuote {
  const target = { appCode: "aiavatar", action: "video", endpointId: "ai-jusuan-minimax-h3", providerModel: "minimax-h3", specKey: "s", unit: "second" as const };
  return { target, usage: { quantity: 15, outputQuantity: 0 }, standardCredits: 930, discountCredits: 0, payableCredits: 930, scopedCredits: 0, walletCredits: 930,
    discountName: null, priceVersion: "v", grantAllocations: [], freeOnly: false, canAfford: true, unavailableCode: null, unavailableReason: null,
    approval: { walletId: "w", target, usage: { quantity: 15, outputQuantity: 0 }, priceVersion: "v", freeOnly: false, maxWalletCredits: 930 }, ...patch };
}
const half = (patch: Partial<ModelBillingQuote> = {}) => quote({ discountCredits: 465, payableCredits: 465, walletCredits: 465, discountName: "H3限时折扣", ...patch });
const ready = (q: ModelBillingQuote): StudioVideoPrice => ({ status: "ready", payer: "decided", quote: q });

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

test("付款账户定了：折后价只在按钮上，折扣放悬停提示；下面只写赠款、积分不足和优化另计", () => {
  expect(describeStudioVideoPrice(ready(half()), 930, { optimizing: true }))
    .toEqual({ standard: 930, shown: 465, discount: "H3限时折扣，省 465 积分", note: "优化提示词按实际用量另计。" });
  expect(describeStudioVideoPrice(ready(half({ scopedCredits: 100, walletCredits: 365 })), 930)?.note)
    .toBe("模型赠款抵扣 100 积分，另需支付 365 积分。");
  expect(describeStudioVideoPrice(ready(half({ scopedCredits: 465, walletCredits: 0 })), 930)?.note).toContain("无需另付积分");
  expect(describeStudioVideoPrice(ready(half({ canAfford: false, unavailableCode: "MODEL_CREDITS_INSUFFICIENT" })), 930)?.note)
    .toBe("可用积分不足，需支付 465 积分。");
  // 优化提示词不含在按钮价格里，有没有折扣都要说；不优化、没赠款就只有价，没有那一行字。
  expect(describeStudioVideoPrice(ready(quote()), 930, { optimizing: true })?.note).toBe("优化提示词按实际用量另计。");
  expect(describeStudioVideoPrice(ready(quote()), 930)).toEqual({ standard: 930, shown: 930, note: undefined });
});

test("付款账户没定：只说视频费，不说要付多少；两个账户价不同就都写出来", () => {
  const same = describeStudioVideoPrice({ status: "ready", payer: "undecided", personal: half(), enterprise: half() }, 930);
  expect(same).toMatchObject({ standard: 930, shown: 465 });
  expect(same?.discount).toBe("H3限时折扣，省 465 积分");
  expect(same?.note).toBeUndefined();
  const differ = describeStudioVideoPrice({ status: "ready", payer: "undecided", personal: half(), enterprise: quote() }, 930);
  expect(differ).toMatchObject({ standard: 930, shown: 465, from: true, note: "个人账户 465 积分，企业账户 930 积分。" });
  // 个人账户有模型赠款也不提：账户没定。
  expect(describeStudioVideoPrice({ status: "ready", payer: "undecided", personal: half({ scopedCredits: 100, walletCredits: 365 }) }, 930)?.note).toBeUndefined();
});

test("报价没回来先垫本地价表价（淡显示）；报不出来就是本地价；本地也算不出就不显示价格", () => {
  expect(describeStudioVideoPrice({ status: "loading" }, 930)).toEqual({ standard: 930, shown: 930, pending: true });
  expect(describeStudioVideoPrice({ status: "failed" }, 930)).toEqual({ standard: 930, shown: 930, pending: false });
  expect(describeStudioVideoPrice({ status: "loading" }, null)).toBeUndefined();
});

test("报价参数只有影响价格的：素材按类型数张数，不带文件 key，也没有提示词", () => {
  const query = studioVideoPriceQuery("ep-h3", { mode: "universal_reference_video", resolutionTier: "768p", rewrite: "review",
    references: [{ mediaType: "image", key: "ipstudio/u/a.png" }, { mediaType: "image", key: "ipstudio/u/b.png" }, { mediaType: "audio", key: "ipstudio/u/v.mp3" }] }, 15, "9:16");
  expect(query).toEqual({ model: "ep-h3", mode: "universal_reference_video", tier: "768p", aspectRatio: "9:16", durationSec: 15, imageRefs: 2, videoRefs: 0, audioRefs: 1 });
  expect(JSON.stringify(query)).not.toContain("ipstudio/");
});

test("付款账户：没开企业 / 没加入企业是个人；设了默认按默认；企业成员没设默认算没定", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0");
  expect(await studioPreviewPayer()).toEqual({ kind: "decided", billing: { mode: "personal" } });
  expect(api.account).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.account.mockResolvedValueOnce({ userId: "u" });
  expect(await studioPreviewPayer()).toEqual({ kind: "decided", billing: { mode: "personal" } });
  const team = (billingDefault: string | null) => ({ userId: "u", context: { enterprise: { id: "team", name: "公司", status: "active" }, member: { status: "active" }, billingDefault } });
  api.account.mockResolvedValueOnce(team("enterprise"));
  expect(await studioPreviewPayer()).toEqual({ kind: "decided", billing: { mode: "enterprise", enterpriseId: "team" } });
  api.account.mockResolvedValueOnce(team(null));
  expect(await studioPreviewPayer()).toEqual({ kind: "undecided", enterpriseId: "team" });
});

test("换了参数，慢回来的旧报价不会盖住新的；付款账户没定时个人和企业各报一次，企业报不出来不挡个人价", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0");
  const slow: { resolve?: (q: ModelBillingQuote) => void } = {};
  api.quote.mockImplementation((q: { durationSec: number }) => q.durationSec === 15
    ? new Promise<ModelBillingQuote>(resolve => { slow.resolve = resolve; })
    : Promise.resolve(half({ standardCredits: 620, discountCredits: 310, payableCredits: 310, walletCredits: 310 })));
  const base = { model: "ep-h3", mode: "t2v", tier: "768p", aspectRatio: "9:16", imageRefs: 0, videoRefs: 0, audioRefs: 0 };
  const { result, rerender } = renderHook(({ q }) => useStudioVideoPrice(q), { initialProps: { q: { ...base, durationSec: 15 } } });
  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(slow.resolve).toBeTruthy());
  rerender({ q: { ...base, durationSec: 10 } });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => { slow.resolve!(half()); });
  expect(result.current).toMatchObject({ status: "ready", quote: { payableCredits: 310 } });
  expect(api.quote).toHaveBeenLastCalledWith({ ...base, durationSec: 10 }, { mode: "personal" }, expect.any(AbortSignal));

  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.account.mockResolvedValue({ userId: "u", context: { enterprise: { id: "team", name: "公司", status: "active" }, member: { status: "active" }, billingDefault: null } });
  api.quote.mockImplementation((_q: unknown, billing: { mode: string }) => billing.mode === "enterprise"
    ? Promise.reject(Object.assign(new Error("在途满了"), { code: "ENTERPRISE_ACTIVE_JOB_LIMIT" })) : Promise.resolve(half()));
  const undecided = renderHook(() => useStudioVideoPrice({ ...base, durationSec: 15 }));
  await waitFor(() => expect(undecided.result.current.status).toBe("ready"));
  expect(undecided.result.current).toMatchObject({ payer: "undecided", personal: { payableCredits: 465 }, enterprise: undefined });
  expect(api.quote).toHaveBeenCalledWith(expect.anything(), { mode: "enterprise", enterpriseId: "team" }, expect.any(AbortSignal));
});

test("切回之前用过的参数也重新报：后台刚停掉的折扣不会因为旧结果还挂在页面上", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0");
  api.quote.mockResolvedValue(half());
  const base = { model: "ep-h3", mode: "t2v", tier: "768p", aspectRatio: "9:16", imageRefs: 0, videoRefs: 0, audioRefs: 0 };
  const { result, rerender } = renderHook(({ q }) => useStudioVideoPrice(q), { initialProps: { q: { ...base, durationSec: 15 } } });
  await waitFor(() => expect(result.current).toMatchObject({ status: "ready", quote: { payableCredits: 465 } }));
  rerender({ q: { ...base, durationSec: 10 } });
  await waitFor(() => expect(api.quote).toHaveBeenCalledTimes(2));
  api.quote.mockResolvedValue(quote()); // 运营停掉了折扣
  rerender({ q: { ...base, durationSec: 15 } });
  await waitFor(() => expect(result.current).toMatchObject({ status: "ready", quote: { payableCredits: 930, discountCredits: 0 } }));
  expect(api.quote).toHaveBeenCalledTimes(3);
});

test("不用报价时不发请求", () => {
  const { result } = renderHook(() => useStudioVideoPrice(undefined));
  expect(result.current.status).toBe("idle");
  expect(api.quote).not.toHaveBeenCalled();
});
