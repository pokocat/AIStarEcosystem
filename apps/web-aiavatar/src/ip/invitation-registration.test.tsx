// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { InvitationRegistration } from "./invitation-registration";
const state = vi.hoisted(() => ({ preview: vi.fn(), send: vi.fn(), login: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({
  isIdMode: () => true,
  loginWithIdSms: state.login,
  OidcError: class extends Error { constructor(public code: string) { super(code); } },
  InvitationApi: { getInvitationPreview: state.preview, sendInvitationSms: state.send,
    InvitationPublicError: class extends Error { constructor(public code: string) { super(code); } } },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.preview.mockResolvedValue({ displayName: "林小满" }); state.send.mockResolvedValue({ sent: true });
  state.login.mockRejectedValue(new Error("network"));
});
afterEach(cleanup);
test("打开即可输入手机号，不增加接受邀请步骤；发码与提交保留本次邀请码", async () => {
  render(<InvitationRegistration invitationCode="abcdefghijklmnopqrstuvwx"/>);
  await screen.findByText("林小满");
  expect(screen.queryByRole("button", { name: /接受邀请/ })).toBeNull();
  fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13900000001" } });
  fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
  await screen.findByText("验证码已发送，请查看手机短信。");
  expect(state.send).toHaveBeenCalledWith("13900000001");
  fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "654321" } });
  fireEvent.submit(screen.getByRole("button", { name: "注册并进入 Studio" }).closest("form")!);
  await waitFor(() => expect(state.login).toHaveBeenCalledWith("13900000001", "654321", "abcdefghijklmnopqrstuvwx"));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("手机号") as HTMLInputElement).value).toBe("13900000001");
});
test("读取失败阻止注册，重试成功后恢复同一邀请", async () => {
  state.preview.mockRejectedValueOnce(new Error("offline"));
  render(<InvitationRegistration invitationCode="abcdefghijklmnopqrstuvwx"/>);
  fireEvent.click(await screen.findByRole("button", { name: "重新读取邀请" }));
  await screen.findByLabelText("手机号");
  expect(state.preview).toHaveBeenLastCalledWith("abcdefghijklmnopqrstuvwx", expect.any(AbortSignal));
  expect(state.login).not.toHaveBeenCalled();
});
test("无效号码或验证码不会发送或登录", async () => {
  render(<InvitationRegistration invitationCode="abcdefghijklmnopqrstuvwx"/>);
  await screen.findByLabelText("手机号");
  fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
  expect(state.send).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13900000001" } });
  fireEvent.submit(screen.getByRole("button", { name: "注册并进入 Studio" }).closest("form")!);
  expect(state.login).not.toHaveBeenCalled();
  await screen.findByText("请输入 6 位短信验证码。");
});
