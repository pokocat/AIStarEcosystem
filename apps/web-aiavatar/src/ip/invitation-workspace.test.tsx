// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { InvitationOverview } from "@ai-star-eco/types/invitation";
import { InvitationWorkspace } from "./invitation-workspace";

const state = vi.hoisted(() => ({ enabled: true, read: vi.fn(), generate: vi.fn(), copy: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({
  isIdMode: () => state.enabled, idIssuer: () => "https://id.example.com",
  InvitationApi: { getMyInvitations: state.read, ensureInvitationCode: state.generate },
  ApiError: class extends Error {},
}));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok" }));
vi.mock("@/shell/account-workspace", () => ({ AccountWorkspace: ({ children }: any) => <main>{children}</main> }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
const empty: InvitationOverview = { inviteCode: null, canInvite: true, inviter: null, invitedAt: null, records: [], total: 0, page: 0, pageSize: 20 };
const record = { id: "private-uid", account: { displayName: "林小满", avatarUrl: null, status: "active" as const }, createdAt: "2026-10-17T08:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks(); state.enabled = true;
  state.read.mockResolvedValue(empty); state.generate.mockResolvedValue({ inviteCode: "accepted-code" });
  state.copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: state.copy } });
});
afterEach(cleanup);

test("进入页面只读取，明确生成后展示 ID 返回的链接和可预览入口", async () => {
  render(<InvitationWorkspace/>);
  const generate = await screen.findByRole("button", { name: "生成邀请链接" });
  expect(state.generate).not.toHaveBeenCalled();
  fireEvent.click(generate);
  const input = await screen.findByLabelText("邀请链接") as HTMLInputElement;
  expect(input.value).toBe("https://id.example.com/i/accepted-code");
  expect(screen.getByRole("link", { name: "预览邀请页" }).getAttribute("href")).toBe(input.value);
  fireEvent.click(screen.getByRole("button", { name: "复制链接" }));
  await screen.findByText("邀请链接已复制，可以发给朋友了。");
  expect(state.copy).toHaveBeenCalledWith(input.value);
});

test("邀请人和直属记录来自 ID，翻页不泄露 UID 或修改关系", async () => {
  state.read.mockResolvedValueOnce({ ...empty, inviter: record.account, invitedAt: record.createdAt, total: 21, records: [record] })
    .mockResolvedValueOnce({ ...empty, total: 21, page: 1, records: [{ ...record, id: "second", account: { ...record.account, displayName: "周知远" } }] });
  const view = render(<InvitationWorkspace/>);
  await screen.findByText("共 21 条记录");
  expect(screen.getAllByText("林小满")).toHaveLength(2);
  expect(view.container.textContent).not.toContain("private-uid");
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  await screen.findByText("周知远");
  expect(state.read).toHaveBeenLastCalledWith(1);
  expect(screen.getByText("第 2 页")).toBeDefined();
});

test("读取失败不会伪造空记录，重试后才显示真实空态", async () => {
  state.read.mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(empty);
  render(<InvitationWorkspace/>);
  await screen.findByText("暂时无法读取邀请记录");
  expect(screen.queryByText("共 0 条记录")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText("共 0 条记录");
});

test("刷新失败保留上次列表并明确说明", async () => {
  state.read.mockResolvedValueOnce({ ...empty, total: 1, records: [record] }).mockRejectedValueOnce(new TypeError("network"));
  render(<InvitationWorkspace/>);
  await screen.findByText("林小满");
  fireEvent.click(screen.getByRole("button", { name: "刷新记录" }));
  await screen.findByText("邀请记录刷新失败");
  expect(screen.getByText("林小满")).toBeDefined();
  expect(screen.getByText(/当前仍显示上次读取的记录/)).toBeDefined();
});

test("生成失败不显示浏览器临时链接，允许显式重试", async () => {
  state.generate.mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce({ inviteCode: "real-code" });
  render(<InvitationWorkspace/>);
  fireEvent.click(await screen.findByRole("button", { name: "生成邀请链接" }));
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("邀请链接")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "生成邀请链接" }));
  await screen.findByLabelText("邀请链接");
  expect(state.generate).toHaveBeenCalledTimes(2);
});

test("剪贴板失败提示手动复制，不报告成功", async () => {
  state.read.mockResolvedValue({ ...empty, inviteCode: "existing" });
  state.copy.mockRejectedValue(new Error("permission denied"));
  render(<InvitationWorkspace/>);
  fireEvent.click(await screen.findByRole("button", { name: "复制链接" }));
  await screen.findByText("无法自动复制，已选中链接，请手动复制。");
  expect(screen.queryByText("邀请链接已复制，可以发给朋友了。")).toBeNull();
  const input = screen.getByLabelText("邀请链接") as HTMLInputElement;
  expect(input.selectionEnd! - input.selectionStart!).toBe(input.value.length);
});

test("ID 返回不能邀请时不渲染生成或复制操作", async () => {
  state.read.mockResolvedValue({ ...empty, canInvite: false });
  render(<InvitationWorkspace/>);
  await screen.findByText("体验账号由多人共用。请使用自己的账号邀请朋友。");
  expect(screen.queryByRole("button", { name: "生成邀请链接" })).toBeNull();
  expect(state.generate).not.toHaveBeenCalled();
});

test("旧登录方式明确说明能力不可用，不请求 ID 或伪造邀请数据", () => {
  state.enabled = false;
  render(<InvitationWorkspace/>);
  expect(screen.getByRole("heading", { name: "请使用统一账号登录" })).toBeDefined();
  expect(state.read).not.toHaveBeenCalled();
});
