// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorWork } from "@ai-star-eco/types";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorApi } from "../api";

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), patchWork: vi.fn() } }));
vi.mock("./director-script", () => ({ DirectorScript: () => null }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));

function work(mode: "fixed" | "selectable" = "selectable"): DirectorWork {
  return {
    id: "w", title: "原作品名", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "故事创意", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null, textModelMode: mode,
    textModels: [
      { endpointId: "ds", name: "DeepSeek", isDefault: true, tokenPricing: { inputCreditsPerK: 0.01, outputCreditsPerK: 0.1, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 2 } },
      { endpointId: "claude", name: "Claude", isDefault: false, tokenPricing: { inputCreditsPerK: 1, outputCreditsPerK: 10, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 148 } },
    ],
  };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

test("settings opens from the workbench, previews each model's price and saves the chosen endpoint", async () => {
  const current = work();
  vi.mocked(DirectorApi.getWork).mockResolvedValue(current);
  vi.mocked(DirectorApi.patchWork).mockResolvedValue({ ...current, title: "AI 新剧名", revision: 2, settings: { ...current.settings, textModel: "claude" }, pricing: { ...current.pricing, textMax: 148 } });
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "真人写实 · 9:16" }));
  const dialog = screen.getByRole("dialog", { name: "作品设置" });
  expect(within(dialog).getByText(/输入 0.01 积分，输出 0.1 积分/)).toBeTruthy();
  // SelectField 的原生适配层把真实 change 事件交回设置面板。
  const select = dialog.querySelector("select")!;
  fireEvent.change(select, { target: { value: "claude" } });
  expect(within(dialog).getByText(/输入 1 积分，输出 10 积分。每次最多冻结 148 积分/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(DirectorApi.patchWork).toHaveBeenCalledWith("w", { settings: { style: "真人写实", aspectRatio: "9:16", textModel: "claude", videoModel: null } }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((screen.getByRole("textbox", { name: "作品名" }) as HTMLInputElement).value).toBe("AI 新剧名");
});

test("fixed model policy disables the settings selector", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work("fixed"));
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "真人写实 · 9:16" }));
  const dialog = screen.getByRole("dialog", { name: "作品设置" });
  expect(dialog.querySelector("select")!.disabled).toBe(true);
});

// 与真实 API 层一致：作品级 404 由 scopeToWork 打上作品 id（../api 被 mock 了，这里直接用真实的 api/director）。
async function gone(id: string) {
  const { ApiError } = await import("@ai-star-eco/api-client");
  const { scopeToWork } = await import("../api/director");
  return scopeToWork(id, Promise.reject(new ApiError({ code: "DIRECTOR_WORK_NOT_FOUND", message: "作品不存在" }, 404))).catch((e: unknown) => e);
}

test("when any request finds this work deleted, the page stops showing editable content, drops its drafts and offers the way back", async () => {
  const { useDraft, hasDrafts } = await import("./director-shared");
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  const error = await gone("w");
  vi.mocked(DirectorApi.patchWork).mockRejectedValue(error);
  function DraftProbe() { const [value, setValue] = useDraft("w:content", ""); return <input aria-label="草稿" value={value} onChange={e => setValue(e.target.value)}/>; }
  render(<><DirectorWorkbench id="w"/><DraftProbe/></>);
  const title = await screen.findByRole("textbox", { name: "作品名" });
  fireEvent.change(screen.getByRole("textbox", { name: "草稿" }), { target: { value: "没保存的正文" } });
  expect(hasDrafts("w:")).toBe(true);
  fireEvent.change(title, { target: { value: "改个名字" } });
  fireEvent.blur(title);
  expect(await screen.findByText("作品已删除或不存在")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "作品名" })).toBeNull();
  expect(screen.getByRole("link", { name: "返回作品列表" }).getAttribute("href")).toBe("/director");
  expect(hasDrafts("w:")).toBe(false); // 作品没了，关页面不再提示未保存
});

test("opening a deleted work shows the deleted state without a reload button", async () => {
  vi.mocked(DirectorApi.getWork).mockRejectedValue(await gone("w"));
  render(<DirectorWorkbench id="w"/>);
  expect(await screen.findByText("作品已删除或不存在")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "重新加载" })).toBeNull();
});

/** 2026-10-28 独立复核：作品 A 的保存还没回来就切到作品 B，A 迟到的 404 不能把 B 标成已删除、清掉 B 的草稿。 */
test("a late 404 for the previous work leaves the current work editable and keeps its unsaved drafts", async () => {
  const { useDraft, hasDrafts, clearDrafts } = await import("./director-shared");
  let rejectOld!: (e: unknown) => void;
  vi.mocked(DirectorApi.getWork).mockResolvedValue({ ...work(), id: "old", title: "旧作品" });
  vi.mocked(DirectorApi.patchWork).mockImplementation((id: string) => import("../api/director").then(({ scopeToWork }) =>
    scopeToWork(id, new Promise<DirectorWork>((_resolve, reject) => { rejectOld = reject; }))));
  const oldPage = render(<DirectorWorkbench id="old"/>);
  const oldTitle = await screen.findByRole("textbox", { name: "作品名" });
  fireEvent.change(oldTitle, { target: { value: "保存旧作品" } });
  fireEvent.blur(oldTitle);
  await waitFor(() => expect(rejectOld).toBeTypeOf("function"));
  oldPage.unmount();

  vi.mocked(DirectorApi.getWork).mockResolvedValue({ ...work(), id: "new", title: "正常作品" });
  function DraftProbe() { const [value, setValue] = useDraft("new:content", ""); return <input aria-label="草稿" value={value} onChange={e => setValue(e.target.value)}/>; }
  render(<><DirectorWorkbench id="new"/><DraftProbe/></>);
  expect(((await screen.findByRole("textbox", { name: "作品名" })) as HTMLInputElement).value).toBe("正常作品");
  fireEvent.change(screen.getByRole("textbox", { name: "草稿" }), { target: { value: "新作品未保存的正文" } });
  const { ApiError } = await import("@ai-star-eco/api-client");
  await act(async () => { rejectOld(new ApiError({ code: "DIRECTOR_WORK_NOT_FOUND", message: "旧作品已删除" }, 404)); await Promise.resolve(); });
  expect(screen.queryByText("作品已删除或不存在")).toBeNull();
  expect(screen.getByRole("textbox", { name: "作品名" })).toBeTruthy();
  expect(hasDrafts("new:")).toBe(true);
  clearDrafts("new:");
});

test("a 404 that cannot be attributed to a work only shows its message", async () => {
  const { ApiError } = await import("@ai-star-eco/api-client");
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  vi.mocked(DirectorApi.patchWork).mockRejectedValue(new ApiError({ code: "DIRECTOR_WORK_NOT_FOUND", message: "作品不存在" }, 404));
  render(<DirectorWorkbench id="w"/>);
  const title = await screen.findByRole("textbox", { name: "作品名" });
  fireEvent.change(title, { target: { value: "改个名字" } });
  fireEvent.blur(title);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("作品已删除或不存在")).toBeNull();
});

test("polling stops once the current work turns out deleted", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    const running = { ...work(), tasks: [{ id: "r", target: "script", status: "running" as const, stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-26T00:00:00Z" }] };
    vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(running).mockRejectedValue(await gone("w"));
    render(<DirectorWorkbench id="w"/>);
    await screen.findByRole("textbox", { name: "作品名" });
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    expect(await screen.findByText("作品已删除或不存在")).toBeTruthy();
    const calls = vi.mocked(DirectorApi.getWork).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(vi.mocked(DirectorApi.getWork).mock.calls.length).toBe(calls);
  } finally { vi.useRealTimers(); }
});
