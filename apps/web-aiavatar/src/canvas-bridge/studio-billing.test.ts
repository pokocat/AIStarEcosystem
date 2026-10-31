// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { invalidateStudioModelQuote, withStudioBilling } from "./studio-billing";
const api = vi.hoisted(() => ({ lookup: vi.fn(), choose: vi.fn(), confirm: vi.fn(), quote: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({ apiFetch: api.lookup }));
vi.mock("@/ip/studio-model-quote-dialog", () => ({ confirmStudioModelQuote: api.confirm }));
vi.mock("./studio-model-quote", () => ({ quoteWorkflowImage: api.quote, quoteImageRequest: api.quote, quoteImageNode: api.quote, quoteWorkflowVideo: api.quote, quoteVideoRequest: api.quote }));
vi.mock("@/ip/studio-billing-dialog", () => ({ chooseStudioBilling: api.choose }));
const approval = { walletId: "member", target: { appCode: "aiavatar", action: "image", endpointId: "endpoint", providerModel: "image-model", specKey: "1024x1024", unit: "image" as const }, usage: { quantity: 1, outputQuantity: 0 }, priceVersion: "v1", freeOnly: false, maxWalletCredits: 8 };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1"); vi.stubGlobal("crypto", webcrypto); sessionStorage.clear(); api.lookup.mockImplementation(async (path: string) => path.endsWith("/capabilities") ? { mock: false } : { found: false }); api.confirm.mockResolvedValue(approval); api.choose.mockResolvedValue({ mode: "enterprise", enterpriseId: "team" }); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
test("new requests explicitly choose a payer with cost, and an uncertain retry keeps it", async () => {
  const request = { clientRequestId: "new", model: "model", operation: "image", maxCost: 24 };
  const first = await withStudioBilling("project", request);
  expect(api.choose).toHaveBeenCalledWith(expect.objectContaining({ operation: "image", expectedCost: 24, model: "model", modelQuote: true }));
  expect(first).toMatchObject({ billing: { mode: "enterprise", enterpriseId: "team" } });
  api.choose.mockResolvedValue({ mode: "personal" });
  expect(await withStudioBilling("project", { clientRequestId: "new" })).toMatchObject({ billing: { mode: "enterprise", enterpriseId: "team" } });
  expect(api.choose).toHaveBeenCalledTimes(1);
});
test("legacy accepted requests replay without introducing a billing key", async () => {
  api.lookup.mockResolvedValue({ found: true, billing: null });
  const result = await withStudioBilling("project", { clientRequestId: "legacy" });
  expect(result).toEqual({ clientRequestId: "legacy" }); expect(Object.hasOwn(result, "billing")).toBe(false); expect(api.choose).not.toHaveBeenCalled();
});
test("server accepted payer wins after storage loss or membership changes", async () => {
  api.lookup.mockResolvedValue({ found: true, billing: { mode: "enterprise", enterpriseId: "old-enterprise" } });
  expect(await withStudioBilling("project", { clientRequestId: "accepted", billing: { mode: "personal" as const } })).toMatchObject({ billing: { mode: "enterprise", enterpriseId: "old-enterprise" } }); expect(api.choose).not.toHaveBeenCalled();
});
test("a failed task fork with a new request id must choose again", async () => {
  api.choose.mockResolvedValue({ mode: "personal" });
  expect(await withStudioBilling("project", { clientRequestId: "fork", billing: { mode: "enterprise" as const, enterpriseId: "old-enterprise" } })).toMatchObject({ billing: { mode: "personal" } }); expect(api.choose).toHaveBeenCalledTimes(1);
});
test("lookup failure never silently falls back or creates a new submission", async () => {
  api.lookup.mockRejectedValue(new Error("原任务核对失败"));
  await expect(withStudioBilling("project", { clientRequestId: "unknown" })).rejects.toThrow("原任务核对失败"); expect(api.choose).not.toHaveBeenCalled();
});
test("concurrent duplicate clicks share one payment choice", async () => {
  const [first, second] = await Promise.all([withStudioBilling("project", { clientRequestId: "same" }), withStudioBilling("project", { clientRequestId: "same" })]);
  expect(first).toEqual(second); expect(api.choose).toHaveBeenCalledTimes(1);
});
test("library generation looks up original object request and stores no private content", async () => {
  await withStudioBilling("library:object", { clientRequestId: "library", prompt: "private" }, { operation: "image", libraryObjectId: "object" });
  expect(api.lookup).toHaveBeenCalledWith("/v1/ip-studio/library/objects/object/billing-selection", { query: { clientRequestId: "library" } });
  expect([...Array(sessionStorage.length)].map((_, i) => sessionStorage.getItem(sessionStorage.key(i)!)).join()).not.toContain("private");
});
test("feature off preserves non-image calls exactly without enterprise reads", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0"); const request = { clientRequestId: "personal", operation: "text" };
  expect(await withStudioBilling("project", request)).toBe(request); expect(api.lookup).not.toHaveBeenCalled(); expect(api.choose).not.toHaveBeenCalled();
});

test("explicit personal accepted requests preserve the original billing key on replay", async () => {
  api.lookup.mockResolvedValue({ found: true, billing: { mode: "personal" } });
  expect(await withStudioBilling("project", { clientRequestId: "explicit-personal" })).toEqual({ clientRequestId: "explicit-personal", billing: { mode: "personal" } }); expect(api.choose).not.toHaveBeenCalled();
});

test("personal image quotes remain mandatory when enterprise feature is off", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0");
  const request = { clientRequestId: "personal-image", operation: "image", prompt: "private" };
  expect(await withStudioBilling("project", request)).toMatchObject({ modelBilling: approval });
  expect(api.choose).not.toHaveBeenCalled();expect(api.confirm).toHaveBeenCalledTimes(1);
  const load=api.confirm.mock.calls[0][0]; const signal=new AbortController().signal;
  await load(true,signal);
  expect(api.quote).toHaveBeenCalledWith("project",expect.objectContaining({prompt:"private",modelBilling:undefined}),true,signal);
  expect([...Array(sessionStorage.length)].map((_,i)=>sessionStorage.getItem(sessionStorage.key(i)!)).join()).not.toContain("private");
});
test("unknown network receipts retain approval and payer while a known rollback requires reconfirmation", async () => {
  const free={...approval,freeOnly:true,maxWalletCredits:0};api.confirm.mockResolvedValue(free);
  const request={clientRequestId:"quote-retry",operation:"image",modelBilling:undefined as typeof approval|undefined};
  await withStudioBilling("project",request);
  invalidateStudioModelQuote("project",request,new Error("network"));
  await withStudioBilling("project",request);expect(api.confirm).toHaveBeenCalledTimes(1);
  invalidateStudioModelQuote("project",request,{code:"MODEL_QUOTE_CHANGED"});
  await withStudioBilling("project",request);expect(api.confirm).toHaveBeenCalledTimes(2);
  expect(api.confirm.mock.calls[1][2]).toBe(true);expect(api.choose).toHaveBeenCalledTimes(1);
});
test("accepted image replays recover original approval without consulting today's capabilities or prices", async () => {
  api.lookup.mockResolvedValue({found:true,billing:{mode:"enterprise",enterpriseId:"old-team"},modelBilling:approval});
  expect(await withStudioBilling("project",{clientRequestId:"image-replay",operation:"image"})).toMatchObject({modelBilling:approval,billing:{enterpriseId:"old-team"}});
  expect(api.confirm).not.toHaveBeenCalled();expect(api.lookup).toHaveBeenCalledTimes(1);
});
test("fixture image generation skips real-model pricing", async () => {
  api.lookup.mockImplementation(async(path:string)=>path.endsWith("/capabilities")?{mock:true}:{found:false});
  expect(await withStudioBilling("project",{clientRequestId:"fixture",operation:"image"})).not.toHaveProperty("modelBilling");
  expect(api.confirm).not.toHaveBeenCalled();
});
test("concurrent image submissions share one approval dialog",async()=>{
  await Promise.all([withStudioBilling("project",{clientRequestId:"shared-image",operation:"image"}),withStudioBilling("project",{clientRequestId:"shared-image",operation:"image"})]);
  expect(api.confirm).toHaveBeenCalledTimes(1);expect(api.choose).toHaveBeenCalledTimes(1);
});
test("node generation quotes its server-owned node compilation",async()=>{
  await withStudioBilling("project",{clientRequestId:"node"},{operation:"image",nodeId:"node-a"});
  await api.confirm.mock.calls[0][0](false,new AbortController().signal);
  expect(api.quote.mock.calls[0].slice(0,2)).toEqual(["project","node-a"]);
});

test("video creation confirms one batch quote without an enterprise picker when disabled",async()=>{
 vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED","0");const request={clientRequestId:"video-quote",operation:"video",count:4,durationSec:5};
 expect(await withStudioBilling("project",request)).toMatchObject({modelBilling:approval});
 await api.confirm.mock.calls[0][0](true,new AbortController().signal);
 expect(api.quote).toHaveBeenCalledWith("project",expect.objectContaining({count:4,durationSec:5}),true,expect.any(AbortSignal));expect(api.choose).not.toHaveBeenCalled();
});
