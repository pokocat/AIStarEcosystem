// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorWork } from "@ai-star-eco/types";
import { DIRECTOR_POLL_MS, useDirectorPoll } from "./director-poll";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorApi } from "../api";

// 2026-11-10 线上：轮询每 2.5 秒直接发，服务端慢的时候请求叠起来（一个账号 10 秒 125 个读取），连接池被占满。
// 这里钉住：上一次读取没返回就不发下一次。

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), patchWork: vi.fn() } }));
vi.mock("./director-script", () => ({ DirectorScript: () => null }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));

let visibility: DocumentVisibilityState = "visible";
beforeEach(() => {
  vi.resetAllMocks();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const showPage = () => act(async () => { document.dispatchEvent(new Event("visibilitychange")); });

test("a slow read is not stacked: the next poll goes out only after the previous one returns", async () => {
  const slow = deferred<void>();
  const poll = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValue(undefined);
  renderHook(() => useDirectorPoll(true, poll));
  await tick(DIRECTOR_POLL_MS + 10);
  expect(poll).toHaveBeenCalledTimes(1);
  await tick(DIRECTOR_POLL_MS * 6); // 服务端 15 秒还没返回
  await showPage();                 // 切回页面也不额外发
  expect(poll).toHaveBeenCalledTimes(1);
  await act(async () => { slow.resolve(); });
  await tick(DIRECTOR_POLL_MS - 100);
  expect(poll).toHaveBeenCalledTimes(1); // 返回后再等一个间隔
  await tick(200);
  expect(poll).toHaveBeenCalledTimes(2);
});

test("skips while another read on the page is in flight, and does not poll while the page is hidden", async () => {
  const poll = vi.fn().mockResolvedValue(undefined);
  let busy = true;
  renderHook(() => useDirectorPoll(true, poll, () => busy));
  await tick(DIRECTOR_POLL_MS * 3 + 10);
  expect(poll).not.toHaveBeenCalled();
  busy = false; visibility = "hidden";
  await tick(DIRECTOR_POLL_MS * 3);
  expect(poll).not.toHaveBeenCalled();
  visibility = "visible";
  await showPage(); // 回到页面立刻读一次
  expect(poll).toHaveBeenCalledTimes(1);
});

test("stops when there is nothing running any more", async () => {
  const poll = vi.fn().mockResolvedValue(undefined);
  const { rerender } = renderHook(({ active }) => useDirectorPoll(active, poll), { initialProps: { active: true } });
  await tick(DIRECTOR_POLL_MS + 10);
  expect(poll).toHaveBeenCalledTimes(1);
  rerender({ active: false });
  await tick(DIRECTOR_POLL_MS * 4);
  await showPage();
  expect(poll).toHaveBeenCalledTimes(1);
});

function runningWork(): DirectorWork {
  return {
    id: "w", title: "原作品名", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "故事创意", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, imageModel: null, textModel: null },
    episodes: [], assets: [], clips: [], pipeline: null, notice: null, textError: null,
    tasks: [{ id: "r", target: "script", status: "running", stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-26T00:00:00Z" }],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], imageModels: [], videoLimits: null, textModelMode: "selectable",
    textModels: [{ endpointId: "ds", name: "DeepSeek", isDefault: true, tokenPricing: { inputCreditsPerK: 0.01, outputCreditsPerK: 0.1, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 2 } }],
  };
}

test("the workbench does not pile up reads of a work while the server is slow", async () => {
  const slow = deferred<DirectorWork>();
  vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(runningWork()).mockReturnValueOnce(slow.promise).mockResolvedValue(runningWork());
  render(<DirectorWorkbench id="w"/>);
  await screen.findByRole("textbox", { name: "作品名" });
  expect(DirectorApi.getWork).toHaveBeenCalledTimes(1);
  await tick(DIRECTOR_POLL_MS + 10);
  expect(DirectorApi.getWork).toHaveBeenCalledTimes(2);
  await tick(10_000);
  await showPage();
  expect(DirectorApi.getWork).toHaveBeenCalledTimes(2); // 旧实现（setInterval）这期间每 2.5 秒照发
  await act(async () => { slow.resolve(runningWork()); });
  await tick(DIRECTOR_POLL_MS + 10);
  expect(DirectorApi.getWork).toHaveBeenCalledTimes(3);
});
