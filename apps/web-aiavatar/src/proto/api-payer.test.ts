// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ choose: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({ beginLogin: vi.fn(), clearAuthTokens: vi.fn(), getAuthToken: () => "access", idLogout: vi.fn(), isIdMode: () => true, refreshAccessToken: vi.fn(), setAppCode: vi.fn(), setAuthToken: vi.fn() }));
vi.mock("@ai-star-eco/api-client/image-upload", () => ({ prepareImageFormData: async (form: FormData) => form }));
vi.mock("@/ip/studio-billing-dialog", () => ({ chooseStudioBilling: state.choose }));
let api: typeof import("./api");
const fetchMock = vi.fn();
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "0"); vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  state.choose.mockReset().mockResolvedValue({ mode: "enterprise", enterpriseId: "team" });
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: "JOB-1" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  api = await import("./api");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const sentHeader = (call = 0) => (fetchMock.mock.calls[call][1].headers as Record<string, string>)["X-Aep-Billing"];

test("digital-asset creations pay through the same chooser as the canvas", async () => {
  await api.AvatarApi.createLook("DH-1", { prompt: "通勤装" });
  await api.AssetApi.createScene({ prompt: "清晨咖啡馆" });
  await api.ComposeApi.create({ avatarId: "DH-1", sceneId: "SC-1" });
  expect(state.choose.mock.calls.map(([details]) => details.operation)).toEqual(["look", "scene", "compose"]);
  expect([sentHeader(0), sentHeader(1), sentHeader(2)]).toEqual(["enterprise:team", "enterprise:team", "enterprise:team"]);
});

test("voice cloning sends the payer with its upload", async () => {
  state.choose.mockResolvedValue({ mode: "personal" });
  await api.VoiceApi.clone(new FormData());
  expect(state.choose).toHaveBeenCalledWith({ operation: "voice-clone" });
  expect(sentHeader()).toBe("personal");
});

test("a cancelled choice submits nothing", async () => {
  state.choose.mockRejectedValue(new Error("本次生成已取消，未提交任务。"));
  await expect(api.AvatarApi.generate("DH-1", { mode: "describe" })).rejects.toThrow("已取消");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("free derivatives do not ask who pays", async () => {
  await api.AvatarApi.createDerivative("DH-1", { type: "idle" });
  expect(state.choose).not.toHaveBeenCalled();
  expect(sentHeader()).toBeUndefined();
});
