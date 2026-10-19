import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ token: "old-access", enabled: true, acting: false, refresh: vi.fn(), beginLogin: vi.fn(), clear: vi.fn() }));
vi.mock("./config", () => ({ API_BASE_URL: "/api", ENABLE_DEV_LOGIN: false, USE_MOCK: false, idIssuer: () => "https://id.example.com", isIdMode: () => state.enabled }));
vi.mock("./oidc", () => ({ refreshAccessToken: state.refresh, beginLogin: state.beginLogin, isTransientOidcError: (e: any) => e?.transient === true }));
vi.mock("./token-store", async importOriginal => ({ ...await importOriginal<any>(), getAuthToken: () => state.token, clearAuthTokens: state.clear }));
vi.mock("./impersonation-session", () => ({ isImpersonating: () => state.acting, expireImpersonation: vi.fn() }));
import { apiFetch, idApiFetch, setAppCode } from "./_client";
import { ensureInvitationCode, getMyInvitations } from "./api/invitation";

const response = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const ok = (data: unknown) => response(200, { success: true, data });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); state.token = "old-access"; state.enabled = true; state.acting = false;
  fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); setAppCode("aiavatar");
});
afterEach(() => { setAppCode(null); vi.unstubAllGlobals(); });

describe("账号接口与产品接口隔离", () => {
  it("直连 issuer，携带本人令牌但不携带产品头和 Cookie", async () => {
    fetchMock.mockImplementation(async () => ok({ records: [], total: 0 }));
    await getMyInvitations(2);
    expect(fetchMock).toHaveBeenCalledWith("https://id.example.com/api/me/invitations?page=2&pageSize=20", expect.objectContaining({ credentials: "omit", headers: { "Content-Type": "application/json", Authorization: "Bearer old-access" } }));
    await ensureInvitationCode();
    expect(fetchMock.mock.calls[1][0]).toBe("https://id.example.com/api/me/invitations/code");
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    await apiFetch("/me");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/me");
    expect(fetchMock.mock.calls[2][1].headers["X-App-Code"]).toBe("aiavatar");
    expect(fetchMock.mock.calls[2][1].credentials).toBe("include");
  });
  it("401 刷新一次后仍请求 ID，使用新令牌", async () => {
    fetchMock.mockResolvedValueOnce(response(401, {})).mockResolvedValueOnce(ok({ inviteCode: "code" }));
    state.refresh.mockImplementation(async () => { state.token = "new-access"; return true; });
    expect(await ensureInvitationCode()).toEqual({ inviteCode: "code" });
    expect(state.refresh).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[1][0]).toBe("https://id.example.com/api/me/invitations/code");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer new-access");
    expect(fetchMock.mock.calls[1][1].credentials).toBe("omit");
  });
  it("刷新临时失败保留登录状态，不伪装成邀请空列表", async () => {
    fetchMock.mockResolvedValue(response(401, {})); state.refresh.mockRejectedValue({ transient: true });
    await expect(getMyInvitations()).rejects.toMatchObject({ code: "AUTH_REFRESH_UNAVAILABLE" });
    expect(state.clear).not.toHaveBeenCalled(); expect(state.beginLogin).not.toHaveBeenCalled();
  });
  it("旧登录和运营查看状态不会将产品令牌发给 ID", () => {
    state.enabled = false;
    expect(() => getMyInvitations()).toThrow("当前登录方式不支持邀请管理");
    state.enabled = true; state.acting = true;
    expect(() => getMyInvitations()).toThrow("当前为运营查看状态");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["/api/me/../admin", "/api/me//evil", "https://other.example/api/me/invitations"])("拒绝越过本人接口的路径 %s", path => {
    expect(() => idApiFetch(path as `/api/me/${string}`)).toThrow("账号请求地址不正确");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
