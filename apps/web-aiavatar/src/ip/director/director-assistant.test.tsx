// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorAssistantMessage, DirectorWork } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorApi } from "../api";

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), runTask: vi.fn(), edit: vi.fn() } }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));

const ep = { id: "ep1", no: 1, title: "叶上的耳朵", summary: "", content: "老贺凑过去看。那盆绿萝叶子油绿。\n陈德茂头也不抬：别人丢的。", extracted: false, planStale: false, planError: null, pendingPlan: null, rev: 3 };

function work(messages: DirectorAssistantMessage[] = [], over: Partial<DirectorWork> = {}): DirectorWork {
  return {
    id: "w", title: "枯绿", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "绿萝长耳朵", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [ep], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null,
    assistant: { current: "th1", threads: [{ id: "th1", title: "t", createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z", messages }] },
    ...over,
  };
}

const replied = (clientId: string): DirectorAssistantMessage[] => [
  { id: "m1", clientId, role: "user", text: "就改我选中的这段", at: "2026-10-26T00:00:00Z", status: "done", scope: { kind: "selection", episodeId: "ep1", text: "老贺凑过去看。", label: "第 1 集 · 叶上的耳朵 · 已选正文" } },
  { id: "m2", role: "assistant", text: "保留原有设定，只调整这一段：", at: "2026-10-26T00:00:01Z", status: "done", scope: { kind: "selection", episodeId: "ep1", label: "第 1 集 · 叶上的耳朵 · 已选正文" },
    proposals: [{ id: "p1", type: "script.replace", status: "open", note: "更诡异", targetLabel: "第 1 集", target: "ep1", original: "老贺凑过去看。", replacement: "老贺凑近那盆绿萝，收音机忽然没了声。" }] },
];

beforeEach(() => { vi.resetAllMocks(); document.documentElement.dataset.layout = "desktop"; window.localStorage.setItem("director-assistant:open", "1"); });
afterEach(() => { cleanup(); window.localStorage.clear(); delete document.documentElement.dataset.layout; });

test("selecting text sends a selection-scoped message; an unknown result is recovered with the same request id", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(work());
  render(<DirectorWorkbench id="w"/>);
  const text = await screen.findByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement;
  text.focus();
  text.setSelectionRange(0, 7);
  fireEvent.mouseUp(text);
  fireEvent.click(screen.getByRole("button", { name: /问 AI/ }));
  const panel = screen.getByRole("complementary", { name: "全能创作助手" });
  expect(within(panel).getByText("正在讨论：第 1 集 · 已选正文")).toBeTruthy();
  fireEvent.change(within(panel).getByRole("textbox", { name: "和助手说" }), { target: { value: "就改我选中的这段，更诡异一点" } });
  // 第一次网关超时、回读时服务端也还没有这条：同一编号重发一次。
  vi.mocked(DirectorApi.runTask).mockRejectedValueOnce(new ApiError({ code: "HTTP_ERROR", message: "HTTP 504" }, 504));
  vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(work());
  vi.mocked(DirectorApi.runTask).mockImplementationOnce(async (_id, body) => work(replied(body.clientRequestId)));
  fireEvent.keyDown(within(panel).getByRole("textbox", { name: "和助手说" }), { key: "Enter" });
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledTimes(2), { timeout: 4000 });
  const [first, second] = vi.mocked(DirectorApi.runTask).mock.calls.map(c => c[1]);
  expect(second.clientRequestId).toBe(first.clientRequestId);
  expect(first.options).toMatchObject({ message: "就改我选中的这段，更诡异一点", scope: { kind: "selection", episodeId: "ep1", text: "老贺凑过去看。" } });
  expect(await within(panel).findByText("老贺凑近那盆绿萝，收音机忽然没了声。")).toBeTruthy();
});

test("preview shows original and suggestion in the script; adopting saves unsaved edits first, keeping original dismisses", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(work(replied("c1")));
  render(<DirectorWorkbench id="w"/>);
  const text = await screen.findByRole("textbox", { name: "第 1 集正文" });
  // 用户在别处手改了一句，还没保存。
  fireEvent.change(text, { target: { value: ep.content + "\n老贺：你这盆，真是别人丢的？" } });
  fireEvent.click(screen.getByRole("button", { name: "预览修改" }));
  const review = await screen.findByLabelText("第 1 集正文：预览修改");
  expect(within(review).getByText("老贺凑过去看。")).toBeTruthy();
  expect(within(review).getAllByText("老贺凑近那盆绿萝，收音机忽然没了声。").length).toBeGreaterThan(0);
  vi.mocked(DirectorApi.edit).mockResolvedValueOnce(work(replied("c1"), { episodes: [{ ...ep, content: ep.content + "\n老贺：你这盆，真是别人丢的？", rev: 4 }] }));
  vi.mocked(DirectorApi.edit).mockResolvedValueOnce(work(replied("c1")));
  fireEvent.click(within(review).getByRole("button", { name: "采用这处修改" }));
  await waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledTimes(2));
  expect(vi.mocked(DirectorApi.edit).mock.calls[0]).toEqual(["w", "episode.update", "ep1", 3, { title: ep.title, summary: "", content: ep.content + "\n老贺：你这盆，真是别人丢的？" }]);
  expect(vi.mocked(DirectorApi.edit).mock.calls[1]).toEqual(["w", "assistant.apply", null, null, { messageId: "m2", proposalId: "p1" }]);
});

// review 2026-10-28：结果不确定时收起再打开助手，仍按原请求编号恢复；发送前先保存眼前未保存的正文。
test("an unknown send keeps its request id after closing and reopening the assistant", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  vi.mocked(DirectorApi.runTask).mockRejectedValue(new Error("network unavailable"));
  render(<DirectorWorkbench id="w"/>);
  const area = await screen.findByRole("textbox", { name: "和助手说" });
  fireEvent.change(area, { target: { value: "保留结局，只改对白" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await screen.findByText(/发送状态还不确定/, {}, { timeout: 5000 });
  const original = vi.mocked(DirectorApi.runTask).mock.calls[0][1];
  fireEvent.click(screen.getByRole("button", { name: "收起助手" }));
  fireEvent.click(screen.getByRole("button", { name: "创作助手" }));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work(replied(original.clientRequestId)));
  fireEvent.click(await screen.findByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledTimes(3));
  const retry = vi.mocked(DirectorApi.runTask).mock.calls[2][1];
  expect(retry.clientRequestId).toBe(original.clientRequestId);
  expect(retry.options).toEqual(original.options);
  expect(window.localStorage.getItem("director-assistant:pending:w")).toBeNull();
});

test("sending saves the unsaved text on screen first, so the assistant reads what the user sees", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  vi.mocked(DirectorApi.edit).mockResolvedValue(work([], { episodes: [{ ...ep, content: "这是刚写的新场景。", rev: 4 }] }));
  vi.mocked(DirectorApi.runTask).mockImplementation(async (_id, body) => work(replied(body.clientRequestId)));
  render(<DirectorWorkbench id="w"/>);
  fireEvent.change(await screen.findByRole("textbox", { name: "第 1 集正文" }), { target: { value: "这是刚写的新场景。" } });
  fireEvent.change(screen.getByRole("textbox", { name: "和助手说" }), { target: { value: "评价我当前这一段" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.edit).mock.calls[0]).toEqual(["w", "episode.update", "ep1", 3, { title: ep.title, summary: "", content: "这是刚写的新场景。" }]);
  expect(vi.mocked(DirectorApi.edit).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(DirectorApi.runTask).mock.invocationCallOrder[0]);
});

// review 2026-10-28：发送时自动保存正文，保存期间用户又补了一句；保存回来后新补的那句不能被清掉。
test("text typed while the send-time auto-save is in flight survives", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  let release!: (w: DirectorWork) => void;
  vi.mocked(DirectorApi.edit).mockImplementationOnce(() => new Promise<DirectorWork>(r => { release = r; }));
  vi.mocked(DirectorApi.runTask).mockImplementation(async (_id, body) => work(replied(body.clientRequestId), { episodes: [{ ...ep, content: "第一版正文。", rev: 4 }] }));
  render(<DirectorWorkbench id="w"/>);
  const body = await screen.findByRole("textbox", { name: "第 1 集正文" });
  fireEvent.change(body, { target: { value: "第一版正文。" } });
  fireEvent.change(screen.getByRole("textbox", { name: "和助手说" }), { target: { value: "评价这一段" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledOnce());
  fireEvent.change(body, { target: { value: "第一版正文。\n老贺：我又补了一句。" } });
  release(work([], { episodes: [{ ...ep, content: "第一版正文。", rev: 4 }] }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  await waitFor(() => expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).value).toBe("第一版正文。\n老贺：我又补了一句。"));
});

// review 2026-10-28（第二轮）：正文 A 改成 B，发送触发自动保存；保存期间又改回 A，保存回来后必须还是 A（仍算未保存）。
test("reverting to the old text while the send-time auto-save is in flight is kept", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  let release!: (w: DirectorWork) => void;
  vi.mocked(DirectorApi.edit).mockImplementationOnce(() => new Promise<DirectorWork>(r => { release = r; }));
  vi.mocked(DirectorApi.runTask).mockImplementation(async (_id, body) => work(replied(body.clientRequestId), { episodes: [{ ...ep, content: "B 版正文。", rev: 4 }] }));
  render(<DirectorWorkbench id="w"/>);
  const body = await screen.findByRole("textbox", { name: "第 1 集正文" });
  fireEvent.change(body, { target: { value: "B 版正文。" } });
  fireEvent.change(screen.getByRole("textbox", { name: "和助手说" }), { target: { value: "评价这一段" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledOnce());
  fireEvent.change(body, { target: { value: ep.content } });
  release(work([], { episodes: [{ ...ep, content: "B 版正文。", rev: 4 }] }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  await waitFor(() => expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).value).toBe(ep.content));
  expect(screen.getAllByText("未保存").length).toBeGreaterThan(0);
});
