// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "@ai-star-eco/api-client";
import { useEnterpriseCredits, useWalletBalance } from "./wallet-balance";

const api = vi.hoisted(() => ({ balance: vi.fn(), token: vi.fn(), mine: vi.fn(), myBalance: vi.fn() }));
vi.mock("@/proto/api", () => ({ WalletApi: { balance: api.balance }, auth: { token: api.token }, USE_MOCK: false }));
vi.mock("@ai-star-eco/api-client", async original => ({ ...await original<object>(), EnterpriseApi: { mine: api.mine, myBalance: api.myBalance } }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  api.token.mockReturnValue("current-session");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });
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
  rerender({ route: "/me/credits", desktop: true });
  await settle();
  expect(result.current.balance).toBe(25);
  rerender({ route: "/me", desktop: false });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(api.balance).toHaveBeenCalledTimes(2);
  expect(result.current.balance).toBeUndefined();
});

const company = (member = "active") => [{ enterprise: { id: "team", name: "创作公司", status: "active" }, member: { status: member } }];

test("an active member sees the enterprise credits assigned to them", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.mine.mockResolvedValue(company()); api.myBalance.mockResolvedValue({ totalBalance: 5000, pendingBalance: 8 });
  const { result } = renderHook(() => useEnterpriseCredits("account", true, "/projects/p"));
  await settle();
  expect(result.current).toEqual({ name: "创作公司", balance: 5000 }); expect(api.myBalance).toHaveBeenCalledWith("team");
});

test("no enterprise credits are shown without an active membership or with the feature off", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.mine.mockResolvedValueOnce(company("suspended")).mockRejectedValueOnce(new ApiError({ code: "NOT_FOUND", message: "Not found" }, 404));
  const suspended = renderHook(() => useEnterpriseCredits("account", true, "/projects/p")); await settle();
  expect(suspended.result.current).toBeUndefined(); expect(api.myBalance).not.toHaveBeenCalled();
  const disabled = renderHook(() => useEnterpriseCredits("account", true, "/projects/p")); await settle();
  expect(disabled.result.current).toBeUndefined();
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0"); api.mine.mockClear();
  renderHook(() => useEnterpriseCredits("account", true, "/projects/p")); await settle();
  expect(api.mine).not.toHaveBeenCalled();
});
