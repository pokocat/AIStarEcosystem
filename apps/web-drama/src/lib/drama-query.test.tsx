import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAsync, mutate, invalidate, clearAll } from "./drama-query";

// drama-query 是 client-side 轻量缓存（替代 React Query）。这里锁住 TODO D-6 点名的
// 「cache 失效」语义：命中复用、精确失效、前缀失效、乐观写入、refetch、登出清空。
// cache 是模块级单例 —— 每个用例前 clearAll() 隔离，并用唯一 key 防串扰。

beforeEach(() => {
  clearAll();
});

describe("useAsync 基本取数", () => {
  it("首次挂载触发 loader，解析后给出 data", async () => {
    const loader = vi.fn().mockResolvedValue("v1");
    const { result } = renderHook(() => useAsync("/t/basic", loader));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe("v1");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("loader 抛错时 error 落位、data 仍为空", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAsync("/t/err", loader));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.data).toBeUndefined();
  });
});

describe("缓存命中 / 乐观写入", () => {
  it("mutate 预写后，useAsync 同步命中且不调 loader", async () => {
    mutate("/t/seeded", "seed");
    const loader = vi.fn().mockResolvedValue("fromLoader");
    const { result } = renderHook(() => useAsync("/t/seeded", loader));

    expect(result.current.data).toBe("seed");
    expect(result.current.isLoading).toBe(false);
    // 已有缓存 → 不应再触发取数
    await act(async () => {});
    expect(loader).not.toHaveBeenCalled();
  });
});

describe("invalidate 失效语义", () => {
  it("精确 key：失效后 refetch 重新取数", async () => {
    let n = 0;
    const loader = vi.fn(() => Promise.resolve(`v${++n}`));
    const { result } = renderHook(() => useAsync("/t/exact", loader));
    await waitFor(() => expect(result.current.data).toBe("v1"));

    act(() => invalidate("/t/exact"));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toBe("v2"));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("前缀 key（以 / 结尾）：清掉所有子项，精确 key 不误伤", async () => {
    mutate("/cast/list", "list");
    mutate("/cast/detail/1", "d1");
    mutate("/scripts/list", "scripts");

    act(() => invalidate("/cast/"));

    // 子项被清 → 重新取数；非前缀项保留
    const castLoader = vi.fn().mockResolvedValue("listFresh");
    const { result: castRes } = renderHook(() => useAsync("/cast/list", castLoader));
    expect(castRes.current.data).toBeUndefined();
    await waitFor(() => expect(castRes.current.data).toBe("listFresh"));

    const scriptLoader = vi.fn().mockResolvedValue("shouldNotRun");
    const { result: scriptRes } = renderHook(() => useAsync("/scripts/list", scriptLoader));
    expect(scriptRes.current.data).toBe("scripts");
    expect(scriptLoader).not.toHaveBeenCalled();
  });
});

describe("clearAll（登出）", () => {
  it("清空后所有 key 重新取数", async () => {
    mutate("/a", "a");
    mutate("/b", "b");
    clearAll();

    const loader = vi.fn().mockResolvedValue("reloaded");
    const { result } = renderHook(() => useAsync("/a", loader));
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toBe("reloaded"));
  });
});
