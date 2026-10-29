// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ConfigProvider } from "antd";
import { ApiError } from "@ai-star-eco/api-client";
import type { DirectorClip, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { useRewriteClip } from "./director-rewrite";
import { DirectorAntd } from "./director-antd";
import { saveStudioBillingPreference } from "@/canvas-bridge/studio-billing-preference";

const api = vi.hoisted(() => ({ account: vi.fn(), balance: vi.fn(), myBalance: vi.fn(), policy: vi.fn() }));
vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn() } }));
vi.mock("@/canvas-bridge/studio-billing-preference", async original => ({ ...await original<object>(), loadStudioBillingAccount: api.account }));
vi.mock("@/canvas-bridge/enterprise-api", () => ({ EnterpriseApi: api }));
vi.mock("@/proto/api", () => ({ WalletApi: { balance: api.balance } }));

const account = { userId: "user", context: { enterprise: { id: "team", name: "创作公司", status: "active" }, member: { status: "active" } } };
const clip = { id: "c2", order: 2, episodeId: "e1", board: { candidates: [] }, video: { candidates: [], pending: [] } } as unknown as DirectorClip;
const work = { id: "w", pricing: { textMax: 21, mock: false } } as DirectorWork;
const apply = vi.fn(), fail = vi.fn();
function Harness() {
  const { open, busy } = useRewriteClip(work, apply, fail);
  return <button disabled={!!busy} onClick={() => open(clip)}>重写</button>;
}
// jsdom 不会播放 CSS 退场动画；关闭动画，仍使用真实 antd 弹窗生命周期。
const show = () => render(<ConfigProvider theme={{ token: { motion: false } }}><DirectorAntd><Harness/></DirectorAntd></ConfigProvider>);
async function confirmRewrite() {
  fireEvent.click(screen.getByRole("button", { name: "重写" }));
  const dialog = await screen.findByRole("dialog", { name: "重写片段 2 的分镜脚本？" });
  fireEvent.click(within(dialog).getByRole("button", { name: "开始重写" }));
}
async function paymentDialog() {
  const dialog = await screen.findByRole("dialog", { name: "确认本次付款账户" });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "确认账户并生成" }).hasAttribute("disabled")).toBe(false));
  return dialog;
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.account.mockImplementation(async () => {
    // 付款账户开始读取时，范围确认框已完全关闭，不能只提高付款框的 z-index。
    expect(screen.queryByRole("dialog", { name: "重写片段 2 的分镜脚本？" })).toBeNull();
    return account;
  });
  api.balance.mockResolvedValue({ totalBalance: 500 });
  api.myBalance.mockResolvedValue({ totalBalance: 100, pendingBalance: 0 });
  api.policy.mockResolvedValue({ allowedEndpointIds: ["model"], maxActiveJobs: 3 });
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work);
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

test("rewrite confirmation closes before payment, which submits exactly once with the chosen payer", async () => {
  show(); await confirmRewrite();
  const dialog = await paymentDialog();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("radio", { name: /创作公司/ }));
  const submit = within(dialog).getByRole("button", { name: "确认账户并生成" });
  fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledTimes(1));
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({
    type: "reshoot", targetId: "e1", options: { clipIds: ["c2"] }, maxCost: 21,
    billing: { mode: "enterprise", enterpriseId: "team" },
  });
  expect(apply).toHaveBeenCalledWith(work); expect(fail).not.toHaveBeenCalled();
});

test("cancelling payment submits nothing, reports no failure and allows another rewrite", async () => {
  show(); await confirmRewrite();
  fireEvent.click(within(await paymentDialog()).getByRole("button", { name: "取消生成" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "重写" }).hasAttribute("disabled")).toBe(false));
  expect(DirectorApi.runTask).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled();
  await confirmRewrite();
  fireEvent.click(within(await paymentDialog()).getByRole("button", { name: "取消生成" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "重写" }).hasAttribute("disabled")).toBe(false));
});

test("cancelling the scope confirmation never opens payment or submits a task", async () => {
  show(); fireEvent.click(screen.getByRole("button", { name: "重写" }));
  const dialog = await screen.findByRole("dialog", { name: "重写片段 2 的分镜脚本？" });
  fireEvent.click(within(dialog).getByRole("button", { name: /取\s*消/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.account).not.toHaveBeenCalled(); expect(DirectorApi.runTask).not.toHaveBeenCalled();
});

test("saved payment preferences still skip the chooser after closing the scope confirmation", async () => {
  saveStudioBillingPreference(account as Parameters<typeof saveStudioBillingPreference>[0], "personal");
  show(); await confirmRewrite();
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledTimes(1));
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1].billing).toEqual({ mode: "personal" });
  expect(screen.queryByRole("dialog")).toBeNull(); expect(api.balance).not.toHaveBeenCalled();
});

test("a real submission failure still reaches the action error handler", async () => {
  const error = new ApiError({ code: "DIRECTOR_CLIP_BUSY", message: "片段正在生成" }, 409);
  vi.mocked(DirectorApi.runTask).mockRejectedValue(error);
  show(); await confirmRewrite();
  fireEvent.click(within(await paymentDialog()).getByRole("button", { name: "确认账户并生成" }));
  await waitFor(() => expect(fail).toHaveBeenCalledTimes(1));
  expect(fail.mock.calls[0][0]).toMatchObject({ error });
  expect(apply).not.toHaveBeenCalled();
});
