// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorBrief, DirectorWork } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorApi } from "../api";

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), runTask: vi.fn(), edit: vi.fn(), patchWork: vi.fn() } }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));

const asked: DirectorBrief = { status: "asking", rounds: 1, maxRounds: 3, summary: "", genre: "", tone: "", title: "", messages: [
  { id: "b1", clientId: "open-w", role: "assistant", text: "先定两件事。", at: "2026-10-28T00:00:00Z", status: "done",
    questions: [{ q: "想让观众看完是什么感觉？", options: ["细思极恐", "温情治愈"] }, { q: "篇幅大概多长？", options: ["1 集 60 秒", "3 集"] }] }] };

function work(brief: DirectorBrief | null, over: Partial<DirectorWork> = {}): DirectorWork {
  return {
    id: "w", title: "快递站", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "快递站夜班收到寄给十年后自己的包裹", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [], brief,
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null,
    draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false, ...over,
  };
}

beforeEach(() => { vi.resetAllMocks(); window.localStorage.clear(); });
afterEach(cleanup);

test("a new idea opens the creative chat once (fixed request id), never on refresh again", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work({ ...asked, rounds: 0, messages: [] }));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work(asked));
  const first = render(<DirectorWorkbench id="w"/>);
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "brief", clientRequestId: "open-w", options: { message: "" } });
  expect(await screen.findByText("想让观众看完是什么感觉？")).toBeTruthy();
  expect(screen.getByRole("button", { name: /跳过，直接生成剧本/ })).toBeTruthy();
  first.unmount();
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work(asked));
  render(<DirectorWorkbench id="w"/>);
  expect(await screen.findByText("已问 1 轮，最多还问 2 轮")).toBeTruthy();
  expect(DirectorApi.runTask).toHaveBeenCalledOnce();
});

/** 删除前还没开始的创意对话：从回收站恢复后打开，不自动发付费开场；用户点「开始聊」才发，发出后照常聊。 */
test("a work restored from the trash waits for the user to start the creative chat", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work({ ...asked, rounds: 0, messages: [] }, { restoredAt: "2026-10-29T03:00:00Z" }));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work(asked, { restoredAt: "2026-10-29T03:00:00Z" }));
  render(<DirectorWorkbench id="w"/>);
  const start = await screen.findByRole("button", { name: "开始聊" });
  await new Promise(r => setTimeout(r, 50));
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  fireEvent.click(start);
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "brief", clientRequestId: "open-w", options: { message: "" } });
  expect(await screen.findByText("想让观众看完是什么感觉？")).toBeTruthy();
});

test("answers are sent with the picked options; skipping mid-way generates with skip and keeps the request across a refresh", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work(asked));
  vi.mocked(DirectorApi.runTask).mockResolvedValueOnce(work({ ...asked, messages: [...asked.messages, { id: "u1", clientId: "x", role: "user", text: "想让观众看完是什么感觉？ 细思极恐", at: "2026-10-28T00:00:01Z", status: "done" }] }));
  const first = render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "细思极恐" }));
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "brief", options: { message: "想让观众看完是什么感觉？ 细思极恐" } });
  // 中途跳过：网关超时，回读也没收到 → 记录保留
  vi.mocked(DirectorApi.runTask).mockRejectedValue(new ApiError({ code: "HTTP_ERROR", message: "HTTP 504" }, 504));
  fireEvent.click(screen.getByRole("button", { name: /不聊了，直接生成剧本/ }));
  await screen.findByText(/发送状态还不确定/, {}, { timeout: 5000 });
  const skip = vi.mocked(DirectorApi.runTask).mock.calls[1][1];
  expect(skip).toMatchObject({ type: "script", options: { skip: true } });
  first.unmount();
  // 刷新后：服务端已经收到（剧本在写）→ 不再重发，记录清掉
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work({ ...asked, status: "writing" }, { tasks: [{ id: "r", target: "script", status: "running", stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-28T00:00:02Z" }] }));
  render(<DirectorWorkbench id="w"/>);
  expect(await screen.findByText("AI 正在写剧本")).toBeTruthy();
  await waitFor(() => expect(window.localStorage.getItem("director-brief:pending:w")).toBeNull());
  expect(DirectorApi.runTask).toHaveBeenCalledTimes(3); // 1 回答 + 跳过的首发与同编号重试，刷新后没有再发
  expect(vi.mocked(DirectorApi.runTask).mock.calls[2][1].clientRequestId).toBe(skip.clientRequestId);
});
