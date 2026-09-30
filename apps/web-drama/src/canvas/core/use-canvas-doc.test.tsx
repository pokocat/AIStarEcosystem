import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "@ai-star-eco/api-client";
import type { DramaCanvasDetail, DramaCanvasDoc, SaveDramaCanvasBody } from "@ai-star-eco/types/drama-canvas";

// 断行为与契约（§8.0.1 ⑩）：发出去的请求体、状态、flush 的返回值；不断言文案。
// fixture 照服务端 DramaCanvasDetail 的形状写（§8.0.1 ⑦）。

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("@/api/canvas", () => ({ CanvasApi: api }));

import { CANVAS_SAVE_DEBOUNCE_MS, CanvasDocProvider, pendingSaveFor, useCanvasDoc } from "./use-canvas-doc";
import { emptyDoc } from "./doc-ops";

function docWithImage(): DramaCanvasDoc {
  const d = emptyDoc();
  return {
    ...d,
    scenes: [{ id: "sc_1", name: "旧教室", prompt: "", episodes: [], images: { versions: [{ key: "mock/a.png", url: "https://signed/a.png?x=1" }] } }],
  };
}

function detail(over: Partial<DramaCanvasDetail> = {}): DramaCanvasDetail {
  return {
    id: "dcv_1",
    title: "我的画布",
    ratio: "9:16",
    step: "script",
    episodeCount: 0,
    characterCount: 0,
    sceneCount: 1,
    segmentsDone: 0,
    segmentsTotal: 0,
    episodesAssembled: 0,
    createdAt: "2026-09-29T01:00:00.000Z",
    updatedAt: "2026-09-29T01:00:00.000Z",
    doc: docWithImage(),
    docVersion: "v0",
    ...over,
  };
}

const addMaterial = (id: string) => (d: DramaCanvasDoc): DramaCanvasDoc => ({
  ...d,
  materials: [...d.materials, { id, name: id, kind: "text", text: id }],
});

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

const wrapper = ({ children }: { children: React.ReactNode }) => <CanvasDocProvider canvasId="dcv_1">{children}</CanvasDocProvider>;

async function mountLoaded() {
  const hook = renderHook(() => useCanvasDoc(), { wrapper });
  await act(async () => {
    await flushMicrotasks();
  });
  return hook;
}

const bodyAt = (i: number) => api.save.mock.calls[i][1] as SaveDramaCanvasBody;

describe("useCanvasDoc", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.get.mockReset();
    api.save.mockReset();
    api.get.mockResolvedValue(detail());
    let n = 0;
    api.save.mockImplementation(async () => ({ docVersion: `v${++n}`, updatedAt: "2026-09-29T02:00:00.000Z" }));
  });
  afterEach(() => vi.useRealTimers());

  it("Provider 外调用直接报错", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCanvasDoc())).toThrow();
    spy.mockRestore();
  });

  it("加载前 status=loading、readOnly、update 一律不接、不保存；加载后才 ready", async () => {
    let resolve!: (d: DramaCanvasDetail) => void;
    api.get.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useCanvasDoc(), { wrapper });
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.status).toBe("loading");
    expect(result.current.readOnly).toBe(true);
    act(() => result.current.update(addMaterial("m0")));
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS * 3);
      await flushMicrotasks();
    });
    expect(api.save).not.toHaveBeenCalled();
    let flushed: unknown;
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect(flushed).toEqual({ ok: false, reason: "failed" });

    await act(async () => {
      resolve(detail());
      await flushMicrotasks();
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.readOnly).toBe(false);
    expect(result.current.docVersion).toBe("v0");
    expect(result.current.meta.title).toBe("我的画布");
    expect(result.current.doc.materials).toEqual([]);
  });

  it("防抖合并多次 update：只存一次、带 baseDocVersion、请求体里剥掉了 url；下一次用新指纹", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.update(addMaterial("a")));
    act(() => result.current.update(addMaterial("b")));
    expect(result.current.saveState).toBe("dirty");
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS - 1);
      await flushMicrotasks();
    });
    expect(api.save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0][0]).toBe("dcv_1");
    expect(bodyAt(0).baseDocVersion).toBe("v0");
    expect(bodyAt(0).doc.materials.map((m) => m.id)).toEqual(["a", "b"]);
    expect(bodyAt(0).doc.scenes[0].images.versions[0]).toEqual({ key: "mock/a.png" });
    // 内存里的文档保留地址（界面照常显示）
    expect(result.current.doc.scenes[0].images.versions[0].url).toBeTruthy();
    expect(result.current.saveState).toBe("saved");
    expect(result.current.docVersion).toBe("v1");

    act(() => result.current.update(addMaterial("c")));
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS);
      await flushMicrotasks();
    });
    expect(bodyAt(1).baseDocVersion).toBe("v1");
  });

  it("保存串行：上一次没回来不发下一次；回来后又改过就再存一次（基线用新的）", async () => {
    let release!: () => void;
    api.save.mockImplementationOnce(
      () => new Promise((r) => (release = () => r({ docVersion: "v1", updatedAt: "2026-09-29T02:00:00.000Z" }))),
    );
    const { result } = await mountLoaded();
    act(() => result.current.update(addMaterial("a")));
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS);
      await flushMicrotasks();
    });
    expect(api.save).toHaveBeenCalledTimes(1);
    act(() => result.current.update(addMaterial("b")));
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS * 2);
      await flushMicrotasks();
    });
    expect(api.save).toHaveBeenCalledTimes(1); // 第一次还在路上
    await act(async () => {
      release();
      await flushMicrotasks();
    });
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(bodyAt(1).baseDocVersion).toBe("v1");
    expect(bodyAt(1).doc.materials.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("409：进 stale、只读、停自动保存；flush 一直回 stale、不发请求", async () => {
    api.save.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_STALE", message: "x", details: { docVersion: "vX" } }, 409));
    const { result } = await mountLoaded();
    act(() => result.current.update(addMaterial("a")));
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS);
      await flushMicrotasks();
    });
    expect(result.current.status).toBe("stale");
    expect(result.current.readOnly).toBe(true);

    act(() => result.current.update(addMaterial("b")));
    expect(result.current.doc.materials.map((m) => m.id)).toEqual(["a"]); // stale 时 update 不接
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS * 5);
      await flushMicrotasks();
    });
    let flushed: unknown;
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect(flushed).toEqual({ ok: false, reason: "stale" });
    expect(api.save).toHaveBeenCalledTimes(1);

    // 载入最新：重新读、回到 ready
    api.get.mockResolvedValueOnce(detail({ docVersion: "vX" }));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.docVersion).toBe("vX");
  });

  it("保存失败：flush 回 {ok:false, reason:'failed'}、状态 failed；改动还在，下一次能存上", async () => {
    api.save.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_DOC_INVALID", message: "x" }, 400));
    const { result } = await mountLoaded();
    act(() => result.current.update(addMaterial("a")));
    let flushed: unknown;
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect(flushed).toEqual({ ok: false, reason: "failed" });
    expect(result.current.saveState).toBe("failed");
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect(flushed).toEqual({ ok: true, docVersion: "v1" });
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(bodyAt(1).doc.materials.map((m) => m.id)).toEqual(["a"]);
  });

  it("没有改动时 flush 直接回当前版本、不白发请求；flush 会清掉防抖计时器", async () => {
    const { result } = await mountLoaded();
    let flushed: unknown;
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect(flushed).toEqual({ ok: true, docVersion: "v0" });
    expect(api.save).not.toHaveBeenCalled();

    act(() => result.current.update(addMaterial("a")));
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect(flushed).toEqual({ ok: true, docVersion: "v1" });
    await act(async () => {
      vi.advanceTimersByTime(CANVAS_SAVE_DEBOUNCE_MS * 2);
      await flushMicrotasks();
    });
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it("改名随下一次保存带上 title", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.rename("新名字"));
    expect(result.current.meta.title).toBe("新名字");
    await act(async () => {
      await result.current.flush();
    });
    expect(bodyAt(0).title).toBe("新名字");
  });

  it("找不到：status=not-found；别的错误：status=error 带一句话", async () => {
    api.get.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_NOT_FOUND", message: "x" }, 404));
    const a = await mountLoaded();
    expect(a.result.current.status).toBe("not-found");
    a.unmount();

    api.get.mockRejectedValueOnce(new ApiError({ code: "HTTP_ERROR", message: "服务器处理请求失败（HTTP 502）" }, 502));
    const b = await mountLoaded();
    expect(b.result.current.status).toBe("error");
    expect(b.result.current.errorMessage).toBeTruthy();
  });

  it("卸载时把防抖里的最后一笔补存；有没存上的改动时 beforeunload 会拦", async () => {
    const { result, unmount } = await mountLoaded();
    act(() => result.current.update(addMaterial("a")));
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    unmount();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(pendingSaveFor("dcv_1")).toBeDefined();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(pendingSaveFor("dcv_1")).toBeUndefined();
  });

  it("重新打开同一张画布：先等上一次的补存落地再读", async () => {
    let release!: () => void;
    api.save.mockImplementationOnce(
      () => new Promise((r) => (release = () => r({ docVersion: "v1", updatedAt: "2026-09-29T02:00:00.000Z" }))),
    );
    const first = await mountLoaded();
    act(() => first.result.current.update(addMaterial("a")));
    first.unmount();
    api.get.mockClear();
    const second = renderHook(() => useCanvasDoc(), { wrapper });
    await act(async () => {
      await flushMicrotasks();
    });
    expect(api.get).not.toHaveBeenCalled();
    expect(second.result.current.status).toBe("loading");
    await act(async () => {
      release();
      await flushMicrotasks();
    });
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
