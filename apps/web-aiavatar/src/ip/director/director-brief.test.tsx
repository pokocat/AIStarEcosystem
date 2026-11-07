// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorBrief, DirectorWork } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorWorkbench } from "./director-workbench";
import { guessFormat } from "./director-brief";
import { DirectorApi } from "../api";

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), runTask: vi.fn(), edit: vi.fn(), patchWork: vi.fn() } }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));

const asked: DirectorBrief = { status: "asking", rounds: 1, maxRounds: 2, summary: "", genre: "", tone: "", title: "", messages: [
  { id: "b1", clientId: "open-w", role: "assistant", text: "先定两件事。", at: "2026-10-28T00:00:00Z", status: "done",
    questions: [{ q: "想让观众看完是什么感觉？", options: ["细思极恐", "温情治愈"] }, { q: "篇幅大概多长？", options: ["1 集 60 秒", "3 集"] }] }] };

const confirmedFormat = { kind: "series" as const, episodes: 3, seconds: 90 };

function work(brief: DirectorBrief | null, over: Partial<DirectorWork> = {}): DirectorWork {
  return {
    id: "w", title: "快递站", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "快递站夜班收到寄给十年后自己的包裹", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null, format: confirmedFormat },
    episodes: [], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [], brief,
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null,
    draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false, ...over,
  };
}

beforeEach(() => { vi.resetAllMocks(); window.localStorage.clear(); document.documentElement.dataset.layout = "desktop"; });
afterEach(() => { cleanup(); delete document.documentElement.dataset.layout; });

// 2026-11-05 用户反馈：写剧本的问答是单独的对话框，也没问集数。问答收进全能创作助手，先确认形式、集数和时长。
test("the questions live in the assistant: basics first, no model call until confirmed", async () => {
  const opening = work({ ...asked, rounds: 0, messages: [] }, { settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null, format: null } });
  vi.mocked(DirectorApi.getWork).mockResolvedValue(opening);
  vi.mocked(DirectorApi.patchWork).mockResolvedValue(work({ ...asked, rounds: 0, messages: [] }, { settings: { ...opening.settings, format: { kind: "series", episodes: 10, seconds: 90 } } }));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work(asked));
  render(<DirectorWorkbench id="w"/>);
  const panel = await screen.findByRole("complementary", { name: "全能创作助手" });
  const basics = within(panel).getByRole("group", { name: "基本要素" });
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox", { name: "你的想法" })).toBeNull();
  fireEvent.click(within(basics).getByRole("button", { name: "10 集" }));
  fireEvent.click(within(basics).getByRole("button", { name: "确认" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.patchWork).mock.calls[0][1]).toEqual({ settings: { format: { kind: "series", episodes: 10, seconds: 90 } } });
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "brief", clientRequestId: "open-w", options: { message: "" } });
  expect(await within(panel).findByText("想让观众看完是什么感觉？")).toBeTruthy();
});

test("what the idea already says is picked in advance", () => {
  expect(guessFormat("一部 12 集的短剧，每集 2 分钟")).toEqual({ kind: "series", episodes: 12, seconds: 120 });
  expect(guessFormat("拍一条 3 分钟的短片")).toEqual({ kind: "single", episodes: 1, seconds: 180 });
  expect(guessFormat("每集 10 分钟的长剧，六集")).toEqual({ kind: "long", episodes: 6, seconds: 600 });
  expect(guessFormat("外卖员捡到一只猫")).toEqual({ kind: "series", episodes: 3, seconds: 90 });
});

test("a question can be left to the AI", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work(asked));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work(asked));
  render(<DirectorWorkbench id="w"/>);
  const panel = await screen.findByRole("complementary", { name: "全能创作助手" });
  const group = await within(panel).findByRole("group", { name: "想让观众看完是什么感觉？" });
  fireEvent.click(within(group).getByRole("button", { name: "AI 决定" }));
  fireEvent.click(within(panel).getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "brief", options: { message: "想让观众看完是什么感觉？ AI 决定" } });
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
  fireEvent.click(screen.getByRole("button", { name: /跳过问答，生成剧本/ }));
  await screen.findByText(/送达状态尚未确认/, {}, { timeout: 5000 });
  const skip = vi.mocked(DirectorApi.runTask).mock.calls[1][1];
  expect(skip).toMatchObject({ type: "script", options: { skip: true } });
  first.unmount();
  // 刷新后：服务端已经收到（剧本在写）→ 不再重发，记录清掉
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work({ ...asked, status: "writing" }, { tasks: [{ id: "r", target: "script", status: "running", stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-28T00:00:02Z" } as never] }));
  render(<DirectorWorkbench id="w"/>);
  expect(await screen.findByText("AI 正在写剧本，完成后自动显示")).toBeTruthy();
  await waitFor(() => expect(window.localStorage.getItem("director-brief:pending:w")).toBeNull());
  expect(DirectorApi.runTask).toHaveBeenCalledTimes(3); // 1 回答 + 跳过的首发与同编号重试，刷新后没有再发
  expect(vi.mocked(DirectorApi.runTask).mock.calls[2][1].clientRequestId).toBe(skip.clientRequestId);
});

test("a long script says how far it has got and can carry on", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work(null, { draft: "# 第1集 开始\n正文", scriptProgress: { written: 3, total: 10, nextTo: 6 } }));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work(null, { draft: "# 第1集 开始\n正文", scriptProgress: { written: 6, total: 10, nextTo: 9 } }));
  render(<DirectorWorkbench id="w"/>);
  expect(await screen.findByText("全剧 10 集，已写 3 集")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "继续写第 4–6 集" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "script-more" });
  expect(await screen.findByRole("button", { name: "继续写第 7–9 集" })).toBeTruthy();
});
