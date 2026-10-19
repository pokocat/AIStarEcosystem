// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EnterpriseInvitationLanding } from "./enterprise-invitation-landing";
const state = vi.hoisted(() => ({ preview: vi.fn(), send: vi.fn(), login: vi.fn(), accept: vi.fn(), mine: vi.fn(), me: vi.fn(), token: "", impersonating: false }));
vi.mock("@ai-star-eco/api-client", () => ({
  ApiError: class extends Error { constructor(public code: string) { super(code); } },
  OidcError: class extends Error { constructor(public code: string) { super(code); } },
  isIdMode: () => true, getAuthToken: () => state.token, loginWithIdSms: state.login, beginLogin: vi.fn(),
  AccountApi: { getMe: state.me }, EnterpriseApi: { previewInvitation: state.preview, accept: state.accept, mine: state.mine },
  InvitationApi: { sendInvitationSms: state.send, InvitationPublicError: class extends Error { constructor(public code: string) { super(code); } } },
}));
vi.mock("@ai-star-eco/api-client/impersonation-session", () => ({ isImpersonating: () => state.impersonating }));
vi.mock("@ai-star-eco/landing/EnrollmentGate", () => ({ EnrollmentGate: ({ onActivated }: any) => <button onClick={onActivated}>完成产品开通</button> }));
import { ApiError } from "@ai-star-eco/api-client";
const bearer = "a".repeat(43);
const preview = { enterpriseId: "enterprise", enterpriseName: "山海影像工作室", expiresAt: "2027-01-15T08:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  state.token = ""; state.impersonating = false;
  window.history.replaceState(null, "", `/enterprise/invite#token=${bearer}`);
  state.preview.mockResolvedValue(preview); state.send.mockResolvedValue({ sent: true }); state.login.mockResolvedValue(undefined);
  state.accept.mockRejectedValue(new Error("network")); state.mine.mockResolvedValue([]); state.me.mockResolvedValue({ displayName: "林小满" });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
function enterCredentials() {
  fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13900000001" } });
  fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "123456" } });
}
test("anonymous user sees real company and registers/logs in then accepts the enterprise invitation", async () => {
  render(<EnterpriseInvitationLanding/>);
  await screen.findByText("山海影像工作室"); await screen.findByLabelText("手机号");
  expect(state.preview).toHaveBeenCalledWith(bearer, expect.any(AbortSignal));
  enterCredentials();
  fireEvent.submit(screen.getByRole("form", { name: "注册登录并加入企业" }));
  await waitFor(() => expect(state.accept).toHaveBeenCalledWith({ token: bearer }));
  expect(state.login).toHaveBeenCalledWith("13900000001", "123456"); // Never pass the enterprise token as a referral code.
  await screen.findByRole("button", { name: "加入企业" }); // Login is preserved if product API fails.
  expect(state.login).toHaveBeenCalledTimes(1);
});
test("SMS validation and countdown prevent duplicate sends and display recovery errors", async () => {
  render(<EnterpriseInvitationLanding/>); await screen.findByLabelText("手机号");
  fireEvent.click(screen.getByRole("button", { name: "获取验证码" })); expect(state.send).not.toHaveBeenCalled();
  enterCredentials(); fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
  await screen.findByText("验证码已发送，请查看手机短信。");
  expect(screen.getByRole("button", { name: "60 秒后重试" }).hasAttribute("disabled")).toBe(true);
  expect(state.send).toHaveBeenCalledTimes(1);
});
test("logged-in user explicitly confirms instead of joining on page load", async () => {
  state.token = "token"; render(<EnterpriseInvitationLanding/>);
  const button = await screen.findByRole("button", { name: "加入企业" });
  expect(state.accept).not.toHaveBeenCalled(); expect(screen.getByText("林小满")).toBeDefined();
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(state.accept).toHaveBeenCalledTimes(1));
});
test("successful join clears the bearer only after persistence and offers the fixed enterprise destination", async () => {
  state.token = "token"; state.accept.mockResolvedValue({ enterprise: { id: "enterprise" } });
  render(<EnterpriseInvitationLanding/>); fireEvent.click(await screen.findByRole("button", { name: "加入企业" }));
  await screen.findByText("已加入企业"); expect(window.location.hash).toBe("");
  expect(screen.getByRole("link", { name: "进入企业" }).getAttribute("href")).toBe("/enterprise");
});
test("existing membership in another enterprise is visible and never auto-switched", async () => {
  state.token = "token"; state.mine.mockResolvedValue([{ enterprise: { id: "other", name: "原公司" }, member: { status: "active" } }]);
  render(<EnterpriseInvitationLanding/>); await screen.findByText("你已加入其他企业");
  expect(state.accept).not.toHaveBeenCalled(); expect(screen.queryByLabelText("手机号")).toBeNull();
});
test("same-enterprise membership leads directly to management without creating another member", async () => {
  state.token = "token"; state.mine.mockResolvedValue([{ enterprise: { id: "enterprise", name: "山海影像工作室" }, member: { status: "active" } }]);
  render(<EnterpriseInvitationLanding/>); await screen.findByRole("link", { name: "进入企业管理" });
  expect(state.accept).not.toHaveBeenCalled();
});
test("product enrollment is retained and joining retries with the same token after activation", async () => {
  state.token = "token"; state.accept.mockRejectedValueOnce(new (ApiError as any)("PRODUCT_NOT_ENROLLED"));
  render(<EnterpriseInvitationLanding/>); fireEvent.click(await screen.findByRole("button", { name: "加入企业" }));
  fireEvent.click(await screen.findByRole("button", { name: "完成产品开通" }));
  await waitFor(() => expect(state.accept).toHaveBeenCalledTimes(2));
  expect(state.accept).toHaveBeenLastCalledWith({ token: bearer }); expect(state.login).not.toHaveBeenCalled();
});
test("expired/revoked invitation blocks SMS registration; network errors can retry", async () => {
  state.preview.mockRejectedValueOnce(new (ApiError as any)("ENTERPRISE_INVITATION_INVALID"));
  render(<EnterpriseInvitationLanding/>); await screen.findByText("这份邀请已失效");
  expect(screen.queryByLabelText("手机号")).toBeNull(); expect(state.send).not.toHaveBeenCalled();
  cleanup(); state.preview.mockRejectedValueOnce(new Error("offline"));
  render(<EnterpriseInvitationLanding/>); fireEvent.click(await screen.findByRole("button", { name: "重新读取" }));
  await screen.findByLabelText("手机号");
});
test("missing token makes no preview call; impersonation never registers or joins", async () => {
  window.history.replaceState(null, "", "/enterprise/invite"); render(<EnterpriseInvitationLanding/>);
  await screen.findByText("这份邀请已失效"); expect(state.preview).not.toHaveBeenCalled();
  cleanup(); window.history.replaceState(null, "", `/enterprise/invite#token=${bearer}`); state.impersonating = true;
  render(<EnterpriseInvitationLanding/>); await screen.findByText("请使用本人账号加入");
  expect(state.accept).not.toHaveBeenCalled(); expect(state.login).not.toHaveBeenCalled();
});
test("opening a different invitation fragment reloads the preview in the same page", async () => {
  window.history.replaceState(null, "", "/enterprise/invite"); render(<EnterpriseInvitationLanding/>);
  await screen.findByText("这份邀请已失效");
  window.history.replaceState(null, "", `/enterprise/invite#token=${bearer}`);
  fireEvent(window, new HashChangeEvent("hashchange"));
  await screen.findByLabelText("手机号"); expect(state.preview).toHaveBeenCalledWith(bearer, expect.any(AbortSignal));
});
