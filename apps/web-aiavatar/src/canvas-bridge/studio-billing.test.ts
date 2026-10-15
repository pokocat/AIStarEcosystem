// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { withStudioBilling } from "./studio-billing";
const api = vi.hoisted(() => ({ lookup: vi.fn(), choose: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({ apiFetch: api.lookup }));
vi.mock("@/ip/studio-billing-dialog", () => ({ chooseStudioBilling: api.choose }));
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1"); vi.stubGlobal("crypto", webcrypto); sessionStorage.clear(); api.lookup.mockResolvedValue({ found: false }); api.choose.mockResolvedValue({ mode: "enterprise", enterpriseId: "team" }); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
test("new requests explicitly choose a payer with cost, and an uncertain retry keeps it", async () => {
  const request = { clientRequestId: "new", model: "model", operation: "image", maxCost: 24 };
  const first = await withStudioBilling("project", request);
  expect(api.choose).toHaveBeenCalledWith(expect.objectContaining({ operation: "image", expectedCost: 24, model: "model" }));
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
test("feature off preserves personal calls exactly without enterprise reads", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0"); const request = { clientRequestId: "personal", operation: "image" };
  expect(await withStudioBilling("project", request)).toBe(request); expect(api.lookup).not.toHaveBeenCalled(); expect(api.choose).not.toHaveBeenCalled();
});

test("explicit personal accepted requests preserve the original billing key on replay", async () => {
  api.lookup.mockResolvedValue({ found: true, billing: { mode: "personal" } });
  expect(await withStudioBilling("project", { clientRequestId: "explicit-personal" })).toEqual({ clientRequestId: "explicit-personal", billing: { mode: "personal" } }); expect(api.choose).not.toHaveBeenCalled();
});
