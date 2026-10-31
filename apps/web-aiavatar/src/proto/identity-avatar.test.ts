// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({ beginLogin: vi.fn(), clearAuthTokens: vi.fn(), getAuthToken: () => "access", idLogout: vi.fn(), isIdMode: () => true, refreshAccessToken: state.refresh, setAppCode: vi.fn(), setAuthToken: vi.fn() }));
let api: typeof import("./api");
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "0");
  state.refresh.mockReset().mockResolvedValue(true);
  api = await import("./api");
});
afterEach(() => { api.clearMeCache(); vi.unstubAllEnvs(); });
const returnToStudio = async () => {
  window.dispatchEvent(new Event("blur"));
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve(); await Promise.resolve();
};

test("projects the actual /api/me avatar and full account key separately from the display UID", () => {
  const me = { id: "local-id", identityUid: "123456789abc-full-random-uid", avatarUrl: "https://id.example/a.jpg", displayName: "小满" };
  expect(api.projectIdentity(me)).toMatchObject({ uid: "123456789abc", avatarSeed: me.identityUid, avatarUrl: me.avatarUrl });
  expect(api.projectIdentity({ ...me, displayName: "新名字" })?.avatarSeed).toBe(me.identityUid);
  expect(api.projectIdentity({ id: "legacy-full-random-id" })).toMatchObject({ avatarSeed: "legacy-full-random-id", avatarUrl: null });
});

test("returning from the editor refreshes once and invalidates the shared identity cache", async () => {
  const error = vi.fn();
  api.prepareIdentityProfileEdit(error);
  await returnToStudio();
  expect(state.refresh).toHaveBeenCalledOnce();
  expect(api.isSameSession(0)).toBe(false);
  expect(error).not.toHaveBeenCalled();
});

test("changing accounts cancels a pending edit refresh", async () => {
  api.prepareIdentityProfileEdit(vi.fn());
  api.clearMeCache();
  await returnToStudio();
  expect(state.refresh).not.toHaveBeenCalled();
});

test("an old refresh completing after a session change cannot invalidate the new account", async () => {
  let complete!: (value: boolean) => void;
  state.refresh.mockImplementation(() => new Promise<boolean>(resolve => { complete = resolve; }));
  api.prepareIdentityProfileEdit(vi.fn());
  await returnToStudio();
  api.clearMeCache();
  complete(true); await Promise.resolve();
  expect(api.isSameSession(1)).toBe(true);
});

test("a failed refresh reports an error and preserves the current identity cache", async () => {
  state.refresh.mockRejectedValue(new Error("temporary"));
  const error = vi.fn();
  api.prepareIdentityProfileEdit(error);
  await returnToStudio();
  expect(error).toHaveBeenCalledOnce();
  expect(api.isSameSession(0)).toBe(true);
});
