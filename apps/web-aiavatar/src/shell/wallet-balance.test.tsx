// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useWalletBalance } from "./wallet-balance";

const api = vi.hoisted(() => ({ balance: vi.fn(), token: vi.fn() }));
vi.mock("@/proto/api", () => ({ WalletApi: { balance: api.balance }, auth: { token: api.token }, USE_MOCK: false }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  api.token.mockReturnValue("current-session");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const settle = () => act(async () => {});

test("polling updates available credits and pauses while the window is hidden", async () => {
  api.balance.mockResolvedValueOnce({ totalBalance: 1500 }).mockResolvedValue({ totalBalance: 1400 });
  const { result } = renderHook(() => useWalletBalance("account", true, "/projects"));
  await settle();
  expect(result.current.balance).toBe(1500);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(api.balance).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(result.current.balance).toBe(1400);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(api.balance).toHaveBeenCalledTimes(3);
});

test("a failed balance cannot be mistaken for zero and retry recovers the real zero", async () => {
  api.balance.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ totalBalance: 0 });
  const { result } = renderHook(() => useWalletBalance("account", true, "/me"));
  await settle();
  expect(result.current).toMatchObject({ balance: undefined, error: true });
  await act(async () => { result.current.refresh(); });
  expect(result.current).toMatchObject({ balance: 0, error: false });
});

test("an old account response cannot replace a newly selected account's balance", async () => {
  let resolveOld!: (value: { totalBalance: number }) => void;
  api.balance.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ totalBalance: 12 });
  const { result, rerender } = renderHook(({ account }) => useWalletBalance(account, true, "/me"), { initialProps: { account: "old" } });
  api.token.mockReturnValue("new-session");
  rerender({ account: "new" });
  await settle();
  expect(result.current.balance).toBe(12);
  await act(async () => { resolveOld({ totalBalance: 999 }); });
  expect(result.current.balance).toBe(12);
});

test("route changes refresh without duplicate in-flight requests or hidden desktop polling", async () => {
  let resolve!: (value: { totalBalance: number }) => void;
  api.balance.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue({ totalBalance: 25 });
  const { result, rerender } = renderHook(({ route, desktop }) => useWalletBalance("account", desktop, route), { initialProps: { route: "/projects", desktop: true } });
  rerender({ route: "/me", desktop: true });
  act(() => window.dispatchEvent(new Event("focus")));
  expect(api.balance).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ totalBalance: 50 }); });
  rerender({ route: "/studio#/membership", desktop: true });
  await settle();
  expect(result.current.balance).toBe(25);
  rerender({ route: "/me", desktop: false });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(api.balance).toHaveBeenCalledTimes(2);
  expect(result.current.balance).toBeUndefined();
});
