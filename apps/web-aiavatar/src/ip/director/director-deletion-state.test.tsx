// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorWork } from "@ai-star-eco/types";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorApi } from "../api";

const failure = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("../studio-errors", async importOriginal => ({ ...await importOriginal<typeof import("../studio-errors")>(), useStudioFailure: () => failure.show }));

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
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, imageModel: null, textModel: null },
    episodes: [], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], imageModels: [], videoLimits: null, textModelMode: mode,
    textModels: [
      { endpointId: "ds", name: "DeepSeek", isDefault: true, tokenPricing: { inputCreditsPerK: 0.01, outputCreditsPerK: 0.1, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 2 } },
      { endpointId: "claude", name: "Claude", isDefault: false, tokenPricing: { inputCreditsPerK: 1, outputCreditsPerK: 10, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 148 } },
    ],
  };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

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

test("opening a deleted work shows the deleted state with the way back, the trash and a reload", async () => {
  vi.mocked(DirectorApi.getWork).mockRejectedValue(await gone("w"));
  render(<DirectorWorkbench id="w"/>);
  expect(await screen.findByText("作品已删除或不存在")).toBeTruthy();
  expect(screen.getByRole("link", { name: "返回作品列表" }).getAttribute("href")).toBe("/director");
  expect(screen.getByRole("link", { name: "打开回收站" }).getAttribute("href")).toBe("/director/trash");
  expect(screen.getByRole("button", { name: "重新加载" })).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "作品名" })).toBeNull();
});

// ── 回收站恢复之后（2026-10-29）──────────────────────────────────────────────

test("after the work is restored elsewhere, reload brings the page back", async () => {
  vi.mocked(DirectorApi.getWork).mockRejectedValueOnce(await gone("w")).mockResolvedValue(work());
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "重新加载" }));
  expect(await screen.findByRole("textbox", { name: "作品名" })).toBeTruthy();
  expect(screen.queryByText("作品已删除或不存在")).toBeNull();
});

test("reload is not sent twice while it is in flight, and a network failure is shown on the page", async () => {
  const { ApiError } = await import("@ai-star-eco/api-client");
  let reject!: (e: unknown) => void;
  vi.mocked(DirectorApi.getWork).mockRejectedValueOnce(await gone("w"))
    .mockImplementationOnce(() => new Promise((_resolve, r) => { reject = r; }));
  render(<DirectorWorkbench id="w"/>);
  const reload = await screen.findByRole("button", { name: "重新加载" });
  fireEvent.click(reload); fireEvent.click(reload); fireEvent.click(reload);
  expect(DirectorApi.getWork).toHaveBeenCalledTimes(2);
  const busy = screen.getByRole("button", { name: "重新加载中" });
  expect(busy).toHaveProperty("disabled", true);
  await act(async () => { reject(new ApiError({ code: "HTTP_ERROR", message: "网络连接失败，请稍后重试" }, 0)); });
  expect(await screen.findByText(/网络连接失败/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "重新加载" })).toHaveProperty("disabled", false);
  expect(screen.getByText("作品已删除或不存在")).toBeTruthy();
});

test("reloading a work that is still in the trash says so", async () => {
  vi.mocked(DirectorApi.getWork).mockRejectedValue(await gone("w"));
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "重新加载" }));
  expect(await screen.findByText(/还是找不到这部作品/)).toBeTruthy();
});

/** 同一部作品：新的读取先成功，更早发出的那次 404 后到 —— 不能把页面打回「已删除」，也不能清掉草稿。 */
test("an older read that 404s after a newer read succeeded does not mark the same work deleted", async () => {
  const { useDraft, hasDrafts, clearDrafts } = await import("./director-shared");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  const running = { ...work(), tasks: [{ id: "r", target: "script", status: "running" as const, stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-26T00:00:00Z" }] };
  let rejectOld!: (e: unknown) => void;
  vi.mocked(DirectorApi.getWork)
    .mockResolvedValueOnce(running)                                                         // 打开
    .mockImplementationOnce(() => new Promise((_resolve, r) => { rejectOld = r; }))         // 较早的一次读取，迟迟不回
    .mockResolvedValueOnce({ ...running, revision: 2 });                                    // 较新的一次，先回来
  function DraftProbe() { const [value, setValue] = useDraft("w:content", ""); return <input aria-label="草稿" value={value} onChange={e => setValue(e.target.value)}/>; }
  render(<><DirectorWorkbench id="w"/><DraftProbe/></>);
  await screen.findByRole("textbox", { name: "作品名" });
  fireEvent.change(screen.getByRole("textbox", { name: "草稿" }), { target: { value: "没保存的正文" } });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await waitFor(() => expect(DirectorApi.getWork).toHaveBeenCalledTimes(3));
  await act(async () => { rejectOld(await gone("w")); });
  expect(screen.queryByText("作品已删除或不存在")).toBeNull();
  expect(screen.getByRole("textbox", { name: "作品名" })).toBeTruthy();
  expect(hasDrafts("w:")).toBe(true);
  clearDrafts("w:");
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
  await waitFor(() => expect(failure.show).toHaveBeenCalled());
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

// ── 删除期间发出、恢复之后才回来的请求（2026-10-29 独立复核）────────────────────────
// 请求经真实的 scopeToWork 打代次标记；恢复由后一次读取带回的新 restoredAt 体现（作品在别的页面被恢复）。

async function restoredScenario(id: string) {
  const { scopeToWork } = await import("../api/director");
  const { ApiError } = await import("@ai-star-eco/api-client");
  const { useDraft } = await import("./director-shared");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  const running = { ...work(), id, tasks: [{ id: "r", target: "script", status: "running" as const, stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-26T00:00:00Z" }] };
  vi.mocked(DirectorApi.getWork)
    .mockImplementationOnce(() => scopeToWork(id, Promise.resolve({ ...running, restoredAt: null })))
    .mockImplementation(() => scopeToWork(id, Promise.resolve({ ...running, revision: 3, restoredAt: "2026-10-29T04:00:00Z" })));
  const pending: Array<(e: unknown) => void> = [];
  vi.mocked(DirectorApi.patchWork).mockImplementation(() => scopeToWork(id, new Promise<DirectorWork>((_r, reject) => { pending.push(reject); })));
  function DraftProbe() { const [value, setValue] = useDraft(`${id}:content`, ""); return <input aria-label="草稿" value={value} onChange={e => setValue(e.target.value)}/>; }
  render(<><DirectorWorkbench id={id}/><DraftProbe/></>);
  const rename = async (to: string) => {
    const title = await screen.findByRole("textbox", { name: "作品名" });
    fireEvent.change(title, { target: { value: to } });
    fireEvent.blur(title);
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));
  };
  const restoreElsewhere = async () => {
    await screen.findByRole("textbox", { name: "作品名" }); // 作品读到、轮询挂上之后
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(DirectorApi.getWork).toHaveBeenCalledTimes(2));
  };
  const notFound = () => new ApiError({ code: "DIRECTOR_WORK_NOT_FOUND", message: "作品不存在" }, 404);
  return { rename, restoreElsewhere, notFound, pending };
}

test("a save sent while the work was deleted and answered with 404 after the restore keeps the restored work and its new draft", async () => {
  const { hasDrafts, clearDrafts, STALE_GONE_MESSAGE } = await import("./director-shared");
  const s = await restoredScenario("stale-w");
  await s.rename("删除期间改的名字");          // 删除期间发出的保存，迟迟不回
  await s.restoreElsewhere();                  // 恢复后最新的读取先成功，带回新的 restoredAt
  fireEvent.change(screen.getByRole("textbox", { name: "草稿" }), { target: { value: "恢复后写的正文" } });
  expect(hasDrafts("stale-w:")).toBe(true);
  await act(async () => { s.pending[0](s.notFound()); });
  expect(screen.queryByText("作品已删除或不存在")).toBeNull();
  expect(screen.getByRole("textbox", { name: "作品名" })).toBeTruthy();
  expect(hasDrafts("stale-w:")).toBe(true);
  await waitFor(() => expect(failure.show).toHaveBeenCalledWith(expect.objectContaining({ error: STALE_GONE_MESSAGE })));
  clearDrafts("stale-w:");
});

test("after the restore, a new request that really gets 404 still marks the work deleted", async () => {
  const { hasDrafts } = await import("./director-shared");
  const s = await restoredScenario("fresh-w");
  await s.restoreElsewhere();
  fireEvent.change(screen.getByRole("textbox", { name: "草稿" }), { target: { value: "恢复后写的正文" } });
  await s.rename("恢复后改的名字");            // 恢复之后发出的保存
  await act(async () => { s.pending[0](s.notFound()); }); // 作品又被删了
  expect(await screen.findByText("作品已删除或不存在")).toBeTruthy();
  expect(hasDrafts("fresh-w:")).toBe(false);
});
