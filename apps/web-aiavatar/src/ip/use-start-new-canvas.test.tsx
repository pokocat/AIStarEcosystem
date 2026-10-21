// @vitest-environment jsdom
// 「新建」 navigates only from the page that asked (Codex review 2026-10-20): an answer that arrives after the page was left
// (desktop /create, then the back button) must not pull the user to the new canvas; under StrictMode one start still makes
// one canvas and navigates once.
import { StrictMode, useEffect } from "react";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ start: vi.fn(), push: vi.fn(), replace: vi.fn() }));
const router = vi.hoisted(() => ({ push: (href: string) => mocks.push(href), replace: (href: string) => mocks.replace(href) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./studio-entry", () => ({ startNewCanvas: () => mocks.start() }));
import { useStartNewCanvas } from "./use-start-new-canvas";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(ok => { resolve = ok; });
  return { promise, resolve };
}

beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/create"); });
afterEach(cleanup);

test("an answer that arrives after the page unmounted does not navigate", async () => {
  const made = deferred<string>();
  mocks.start.mockReturnValue(made.promise);
  const { result, unmount } = renderHook(() => useStartNewCanvas({ navigate: "replace" }));
  let starting!: Promise<void>;
  act(() => { starting = result.current.start(); });
  unmount();
  await act(async () => { made.resolve("/projects/P-new?start=assistant"); await starting; });
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});

test("an answer that arrives after another navigation changed the address does not navigate, and the page can start again", async () => {
  const made = deferred<string>();
  mocks.start.mockReturnValueOnce(made.promise).mockResolvedValueOnce("/projects/P-new?start=assistant");
  const { result } = renderHook(() => useStartNewCanvas());
  let starting!: Promise<void>;
  act(() => { starting = result.current.start(); });
  expect(result.current.creating).toBe(true);
  window.history.pushState(null, "", "/projects");
  await act(async () => { made.resolve("/projects/P-new?start=assistant"); await starting; });
  expect(mocks.push).not.toHaveBeenCalled();
  expect(result.current.creating).toBe(false);
  await act(async () => { await result.current.start(); });
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.push).toHaveBeenCalledWith("/projects/P-new?start=assistant");
});

test("StrictMode: a start from an effect makes one canvas and navigates once, after the remount", async () => {
  const made = deferred<string>();
  mocks.start.mockReturnValue(made.promise);
  function Page() {
    const { start } = useStartNewCanvas({ navigate: "replace" });
    useEffect(() => { void start(); }, [start]);
    return null;
  }
  render(<StrictMode><Page/></StrictMode>);
  // StrictMode has already run cleanup and setup a second time; the answer comes after that.
  expect(mocks.start).toHaveBeenCalledTimes(1);
  await act(async () => { made.resolve("/projects/P-new?start=assistant"); await made.promise; });
  expect(mocks.replace).toHaveBeenCalledTimes(1);
  expect(mocks.replace).toHaveBeenCalledWith("/projects/P-new?start=assistant");
});

test("a double click makes one canvas", async () => {
  const made = deferred<string>();
  mocks.start.mockReturnValue(made.promise);
  const { result } = renderHook(() => useStartNewCanvas());
  let first!: Promise<void>;
  act(() => { first = result.current.start(); void result.current.start(); });
  await act(async () => { made.resolve("/projects/P-1?start=assistant"); await first; });
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(mocks.push).toHaveBeenCalledTimes(1);
});
