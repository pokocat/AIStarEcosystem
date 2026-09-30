import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "@ai-star-eco/api-client";
import type { CanvasImageRunBody, DramaCanvasDetail, DramaCanvasDoc, DramaCanvasRun } from "@ai-star-eco/types/drama-canvas";

// §8.0.1 ⑨：flush 不抛、只回结果 —— submit 必须判它，存不上 / 冲突时不发请求、不花钱。
// 断请求与文档结构，不断文案（§8.0.1 ⑩）。

const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  runImage: vi.fn(),
  runImageBatch: vi.fn(),
  runScript: vi.fn(),
  getRuns: vi.fn(),
  lookupRuns: vi.fn(),
  cancelRun: vi.fn(),
}));
vi.mock("@/api/canvas", () => ({ CanvasApi: api }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", () => ({ toast: { error: toastError, success: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: vi.fn() }));

import { CanvasDocProvider, useCanvasDoc } from "./use-canvas-doc";
import {
  __resetCanvasRunsForTest,
  CanvasRunsProvider,
  PENDING_RETRY_DELAYS_MS,
  RECONNECT_DELAYS_MS,
  RUN_POLL_MS,
  useCanvasRuns,
} from "./use-canvas-runs";
import { __resetPendingForTest, readPending, upsertPending } from "./pending-requests";
import { emptyDoc, findLook } from "./doc-ops";
import { runRefAt } from "./merge";

function doc(over: Partial<DramaCanvasDoc> = {}): DramaCanvasDoc {
  return {
    ...emptyDoc(),
    characters: [
      {
        id: "ch_1",
        name: "林微",
        role: "lead",
        looks: [
          { id: "lk_1", name: "基础造型", prompt: "描述", episodes: [1], images: { versions: [] } },
          { id: "lk_2", name: "学生时期", prompt: "描述", episodes: [1], images: { versions: [] } },
        ],
      },
    ],
    ...over,
  };
}

function detail(d: DramaCanvasDoc = doc()): DramaCanvasDetail {
  return {
    id: "dcv_1",
    title: "画布",
    ratio: "9:16",
    step: "assets",
    episodeCount: 0,
    characterCount: 1,
    sceneCount: 0,
    segmentsDone: 0,
    segmentsTotal: 0,
    episodesAssembled: 0,
    createdAt: "2026-09-29T01:00:00.000Z",
    updatedAt: "2026-09-29T01:00:00.000Z",
    doc: d,
    docVersion: "v0",
  };
}

function run(over: Partial<DramaCanvasRun> = {}): DramaCanvasRun {
  return {
    id: "r1",
    canvasId: "dcv_1",
    kind: "image",
    target: "look:lk_1",
    status: "queued",
    cost: 2,
    createdAt: "2026-09-30T01:00:00.000Z",
    ...over,
  };
}

const imageReq = { kind: "image" as const, body: { target: { kind: "look" as const, id: "lk_1" }, count: 1 } };

async function flushMicrotasks() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CanvasDocProvider canvasId="dcv_1">
    <CanvasRunsProvider>{children}</CanvasRunsProvider>
  </CanvasDocProvider>
);

async function mount() {
  const hook = renderHook(() => ({ doc: useCanvasDoc(), runs: useCanvasRuns() }), { wrapper });
  await act(async () => {
    await flushMicrotasks();
  });
  return hook;
}

describe("useCanvasRuns", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const f of Object.values(api)) f.mockReset();
    toastError.mockReset();
    __resetCanvasRunsForTest();
    __resetPendingForTest();
    try {
      window.localStorage.clear();
    } catch {
      /* 测试环境里 Node 自带的 localStorage 可能不可用：core 会退到内存 */
    }
    api.get.mockResolvedValue(detail());
    let n = 0;
    api.save.mockImplementation(async () => ({ docVersion: `v${++n}`, updatedAt: "2026-09-30T01:00:00.000Z" }));
    api.getRuns.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("先存再发：带上刚存好的 docVersion 和 core 生成的幂等键；引用写进文档并立刻存上", async () => {
    api.runImage.mockResolvedValue(run());
    const { result } = await mount();
    act(() => result.current.doc.update((d) => ({ ...d, materials: [{ id: "m1", name: "m", kind: "text", text: "x" }] })));
    let res: unknown;
    await act(async () => {
      res = await result.current.runs.submit(imageReq);
      await flushMicrotasks();
    });
    expect(res).toMatchObject({ ok: true, runs: [{ id: "r1" }] });
    expect(api.save).toHaveBeenCalledTimes(2); // 生成前的 flush + 写完引用后的 flush
    const body = api.runImage.mock.calls[0][1] as CanvasImageRunBody;
    expect(api.runImage.mock.calls[0][0]).toBe("dcv_1");
    expect(body.docVersion).toBe("v1");
    expect(body.clientRequestId).toMatch(/\S{8,}/);
    expect(body.target).toEqual({ kind: "look", id: "lk_1" });
    expect(runRefAt(result.current.doc.doc, "look:lk_1")).toEqual({ runId: "r1", status: "queued" });
    expect(runRefAt(api.save.mock.calls[1][1].doc, "look:lk_1")).toEqual({ runId: "r1", status: "queued" });
    expect(result.current.runs.runFor("look:lk_1")?.id).toBe("r1");
    expect(result.current.runs.pending.map((r) => r.id)).toEqual(["r1"]);
  });

  it("保存失败：不发生成请求，返回 save-failed", async () => {
    api.save.mockRejectedValue(new ApiError({ code: "DRAMA_CANVAS_DOC_INVALID", message: "x" }, 400));
    const { result } = await mount();
    act(() => result.current.doc.update((d) => ({ ...d, materials: [{ id: "m1", name: "m", kind: "text", text: "x" }] })));
    let res: unknown;
    await act(async () => {
      res = await result.current.runs.submit(imageReq);
    });
    expect(res).toMatchObject({ ok: false, reason: "save-failed" });
    expect(api.runImage).not.toHaveBeenCalled();
  });

  it("保存撞上 409：不发生成请求，返回 stale", async () => {
    api.save.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_STALE", message: "x" }, 409));
    const { result } = await mount();
    act(() => result.current.doc.update((d) => ({ ...d, materials: [{ id: "m1", name: "m", kind: "text", text: "x" }] })));
    let res: unknown;
    await act(async () => {
      res = await result.current.runs.submit(imageReq);
    });
    expect(res).toMatchObject({ ok: false, reason: "stale" });
    expect(api.runImage).not.toHaveBeenCalled();
    expect(result.current.doc.status).toBe("stale");
  });

  it("服务端 4xx 拒绝：返回 rejected + 错误码 + 服务端的话；生成请求撞 409 时文档进 stale", async () => {
    api.runImage.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_ASSET_NOT_OWNED", message: "有参考图不是你的素材" }, 400));
    const { result } = await mount();
    let res: unknown;
    await act(async () => {
      res = await result.current.runs.submit(imageReq);
    });
    expect(res).toEqual({ ok: false, reason: "rejected", errorCode: "DRAMA_CANVAS_ASSET_NOT_OWNED", message: "有参考图不是你的素材" });

    api.runImage.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_STALE", message: "x" }, 409));
    await act(async () => {
      res = await result.current.runs.submit(imageReq);
    });
    expect(res).toMatchObject({ ok: false, reason: "stale" });
    expect(result.current.doc.status).toBe("stale");
  });

  it("没收到回应（断网）：再点一次同样的请求沿用同一个幂等键；有了明确结果后换新键", async () => {
    api.runImage.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    // 第二次拿到的是已经出完的原记录（终态），第三次同一目标才允许再生成一次
    api.runImage.mockResolvedValueOnce(run({ status: "succeeded", finishedAt: "2026-09-30T01:00:03.000Z", result: { images: [{ key: "mock/a.png" }] } }));
    api.runImage.mockResolvedValueOnce(run({ id: "r2" }));
    const { result } = await mount();
    await act(async () => {
      await result.current.runs.submit(imageReq);
    });
    await act(async () => {
      await result.current.runs.submit(imageReq);
    });
    const k1 = (api.runImage.mock.calls[0][1] as CanvasImageRunBody).clientRequestId;
    const k2 = (api.runImage.mock.calls[1][1] as CanvasImageRunBody).clientRequestId;
    expect(k2).toBe(k1);
    await act(async () => {
      await flushMicrotasks(); // 引用存上、表项删掉
      await result.current.runs.submit(imageReq);
    });
    const k3 = (api.runImage.mock.calls[2][1] as CanvasImageRunBody).clientRequestId;
    expect(k3).not.toBe(k1);
  });

  it("轮询到终态：结果合进文档（图进候选并挑中）、不再轮询", async () => {
    api.runImage.mockResolvedValue(run());
    const { result } = await mount();
    await act(async () => {
      await result.current.runs.submit(imageReq);
    });
    api.getRuns.mockResolvedValueOnce([run({ status: "running" })]);
    await act(async () => {
      vi.advanceTimersByTime(RUN_POLL_MS);
      await flushMicrotasks();
    });
    expect(runRefAt(result.current.doc.doc, "look:lk_1")?.status).toBe("running");

    api.getRuns.mockResolvedValueOnce([
      run({ status: "succeeded", finishedAt: "2026-09-30T01:00:03.000Z", result: { images: [{ key: "mock/x.png", url: "data:x", runId: "r1" }] } }),
    ]);
    await act(async () => {
      vi.advanceTimersByTime(RUN_POLL_MS);
      await flushMicrotasks();
    });
    const look = findLook(result.current.doc.doc, "lk_1")!.look;
    expect(look.images.pickedKey).toBe("mock/x.png");
    expect(look.run).toEqual({ runId: "r1", status: "succeeded" });
    expect(result.current.runs.pending).toEqual([]);
    expect(result.current.runs.runFor("look:lk_1")?.status).toBe("succeeded");

    const calls = api.getRuns.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(RUN_POLL_MS * 5);
      await flushMicrotasks();
    });
    expect(api.getRuns.mock.calls.length).toBe(calls);
  });

  it("进页接回：文档里挂着的运行引用批量查一次并合进来", async () => {
    const d = doc();
    d.characters[0].looks[0].run = { runId: "r9", status: "running" };
    api.get.mockResolvedValue(detail(d));
    api.getRuns.mockResolvedValueOnce([run({ id: "r9", status: "succeeded", result: { images: [{ key: "mock/y.png" }] } })]);
    const { result } = await mount();
    expect(api.getRuns).toHaveBeenCalledWith("dcv_1", ["r9"]);
    expect(findLook(result.current.doc.doc, "lk_1")!.look.images.versions.map((v) => v.key)).toEqual(["mock/y.png"]);
    expect(result.current.runs.runFor("look:lk_1")?.id).toBe("r9");
  });

  it("取消：合进 canceled；已开始的（409）用 toast 报出来", async () => {
    api.runImage.mockResolvedValue(run());
    const { result } = await mount();
    await act(async () => {
      await result.current.runs.submit(imageReq);
    });
    api.cancelRun.mockResolvedValueOnce(run({ status: "canceled", finishedAt: "2026-09-30T01:00:01.000Z" }));
    await act(async () => {
      await result.current.runs.cancel("r1");
    });
    expect(runRefAt(result.current.doc.doc, "look:lk_1")?.status).toBe("canceled");

    api.cancelRun.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_RUN_NOT_CANCELABLE", message: "已经开始生成，停不下来" }, 409));
    await act(async () => {
      await result.current.runs.cancel("r1");
    });
    expect(toastError).toHaveBeenCalled();
  });

  it("卸载后停止轮询", async () => {
    api.runImage.mockResolvedValue(run());
    const { result, unmount } = await mount();
    await act(async () => {
      await result.current.runs.submit(imageReq);
    });
    unmount();
    const calls = api.getRuns.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(RUN_POLL_MS * 4);
      await flushMicrotasks();
    });
    expect(api.getRuns.mock.calls.length).toBe(calls);
  });
});

// ── Codex 评审 P1 #1–#3 / P2 #5 / #10：未确认请求表、连点去重、离页接回、接回退避、只读不取消 ──────────

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useCanvasRuns · 幂等与接回", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const f of Object.values(api)) f.mockReset();
    toastError.mockReset();
    __resetCanvasRunsForTest();
    __resetPendingForTest();
    try {
      window.localStorage.clear();
    } catch {
      /* 测试环境里 Node 自带的 localStorage 可能不可用：core 会退到内存 */
    }
    api.get.mockResolvedValue(detail());
    let n = 0;
    api.save.mockImplementation(async () => ({ docVersion: `v${++n}`, updatedAt: "2026-09-30T01:00:00.000Z" }));
    api.getRuns.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("连点：同一目标提交中再点一次，返回同一个 Promise、只发一次请求；isSubmitting 覆盖提交中", async () => {
    const d = deferred<DramaCanvasRun>();
    api.runImage.mockReturnValue(d.promise);
    const { result } = await mount();
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.runs.submit(imageReq);
      p2 = result.current.runs.submit(imageReq);
    });
    expect(p2).toBe(p1);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.runs.isSubmitting("look:lk_1")).toBe(true);
    expect(result.current.runs.isSubmitting("look:lk_2")).toBe(false);
    expect(api.runImage).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve(run());
      await p1;
      await flushMicrotasks();
    });
    expect(result.current.runs.isSubmitting("look:lk_1")).toBe(false);
    expect(api.runImage).toHaveBeenCalledTimes(1);
  });

  it("B 的响应丢了、之后 A 完成改了文档版本：重试 B 仍用原键（不看文档版本）", async () => {
    const reqB = { kind: "image" as const, body: { target: { kind: "look" as const, id: "lk_2" }, count: 1 } };
    api.runImage.mockRejectedValueOnce(new TypeError("Failed to fetch")); // B：没收到回应
    const { result } = await mount();
    await act(async () => {
      await result.current.runs.submit(reqB);
    });
    const keyB = (api.runImage.mock.calls[0][1] as CanvasImageRunBody).clientRequestId;
    expect(readPending("dcv_1").map((e) => e.clientRequestId)).toEqual([keyB]);

    // A 提交并完成 → 结果合进文档 → 自动保存，文档版本变了
    api.runImage.mockResolvedValueOnce(run({ id: "rA" }));
    await act(async () => {
      await result.current.runs.submit(imageReq);
      await flushMicrotasks();
    });
    api.getRuns.mockResolvedValue([run({ id: "rA", status: "succeeded", result: { images: [{ key: "mock/a.png" }] } })]);
    await act(async () => {
      vi.advanceTimersByTime(RUN_POLL_MS);
      await flushMicrotasks();
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });
    const versionNow = result.current.doc.docVersion;
    expect(versionNow).not.toBe("v0");

    // 重试 B：同一个键、带当前的文档版本
    api.runImage.mockResolvedValueOnce(run({ id: "rB", target: "look:lk_2" }));
    await act(async () => {
      await result.current.runs.submit(reqB);
      await flushMicrotasks();
    });
    const retry = api.runImage.mock.calls[2][1] as CanvasImageRunBody;
    expect(retry.clientRequestId).toBe(keyB);
    expect(readPending("dcv_1")).toEqual([]); // 引用存上了，表项删掉
  });

  it("请求在飞时离开画布：迟到的响应记进表里，重新进来时接回（引用写进文档并保存）", async () => {
    const d = deferred<DramaCanvasRun>();
    api.runImage.mockReturnValue(d.promise);
    const first = await mount();
    let p!: Promise<unknown>;
    act(() => {
      p = first.result.current.runs.submit(imageReq);
    });
    await act(async () => {
      await flushMicrotasks();
    });
    expect(api.runImage).toHaveBeenCalledTimes(1);
    first.unmount();
    await act(async () => {
      d.resolve(run({ id: "r5" }));
      await p;
    });
    expect(readPending("dcv_1")[0].runIds).toEqual(["r5"]);

    api.getRuns.mockImplementation(async (_id: string, ids: string[]) => (ids.includes("r5") ? [run({ id: "r5", status: "running" })] : []));
    const second = await mount();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(runRefAt(second.result.current.doc.doc, "look:lk_1")).toEqual({ runId: "r5", status: "running" });
    expect(api.save.mock.calls.some((c) => runRefAt(c[1].doc, "look:lk_1")?.runId === "r5")).toBe(true);
    expect(readPending("dcv_1")).toEqual([]);
    expect(api.runImage).toHaveBeenCalledTimes(1); // 有运行 id 就直接查，不重发
  });

  it("响应一直没回来就关了页面：重进时按幂等键 lookup（只查不建）——受理过的接回，没受理的删掉，全程不发 POST", async () => {
    const entry = (clientRequestId: string, id: string, ageMs = 0) => ({
      clientRequestId,
      kind: "image" as const,
      body: { target: { kind: "look", id }, count: 1 },
      slot: `look:${id}`,
      sig: clientRequestId,
      targets: [`look:${id}`],
      docVersion: "v0", // 和现在的文档版本一样：以前的重发会被当成新请求执行，现在绝不重发
      createdAt: Date.now() - ageMs,
    });
    upsertPending("dcv_1", entry("dcv-accepted", "lk_1"));
    upsertPending("dcv_1", entry("dcv-never", "lk_2", 11 * 60_000)); // 发出超过 10 分钟还查不到 = 没受理
    api.lookupRuns.mockImplementation(async (_id: string, key: string) => (key === "dcv-accepted" ? [run({ id: "r7" })] : []));
    const { result } = await mount();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(api.lookupRuns.mock.calls.map((c) => c[1]).sort()).toEqual(["dcv-accepted", "dcv-never"]);
    expect(api.runImage).not.toHaveBeenCalled();
    expect(runRefAt(result.current.doc.doc, "look:lk_1")?.runId).toBe("r7");
    expect(runRefAt(result.current.doc.doc, "look:lk_2")).toBeUndefined();
    expect(readPending("dcv_1")).toEqual([]);
  });

  it("进页 lookup 断网：未确认项留着，下次进页再查（仍不发 POST）", async () => {
    upsertPending("dcv_1", {
      clientRequestId: "dcv-unknown",
      kind: "image",
      body: imageReq.body,
      slot: "look:lk_1",
      sig: "z",
      targets: ["look:lk_1"],
      docVersion: "v0",
      createdAt: Date.now(),
    });
    api.lookupRuns.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const first = await mount();
    expect(readPending("dcv_1").map((e) => e.clientRequestId)).toEqual(["dcv-unknown"]);
    expect(api.runImage).not.toHaveBeenCalled();
    first.unmount();

    api.lookupRuns.mockResolvedValueOnce([run({ id: "r8", status: "running" })]);
    const second = await mount();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(runRefAt(second.result.current.doc.doc, "look:lk_1")?.runId).toBe("r8");
    expect(readPending("dcv_1")).toEqual([]);
    expect(api.runImage).not.toHaveBeenCalled();
  });

  it("会话里用户再点同一个动作（显式操作）：沿用未确认项的原键重发", async () => {
    api.runImage.mockRejectedValueOnce(new ApiError({ code: "HTTP_ERROR", message: "x" }, 502));
    api.runImage.mockResolvedValueOnce(run());
    const { result } = await mount();
    await act(async () => {
      await result.current.runs.submit(imageReq);
    });
    await act(async () => {
      await result.current.runs.submit(imageReq);
      await flushMicrotasks();
    });
    const [a, b] = api.runImage.mock.calls.map((c) => (c[1] as CanvasImageRunBody).clientRequestId);
    expect(b).toBe(a);
    expect(api.lookupRuns).not.toHaveBeenCalled();
  });

  it("很老的未确认项也不按年龄删：照样 lookup，明确查不到（过了 10 分钟宽限期）才删；全程不重发", async () => {
    upsertPending("dcv_1", {
      clientRequestId: "old",
      kind: "image",
      body: imageReq.body,
      slot: "look:lk_1",
      sig: "x",
      targets: ["look:lk_1"],
      docVersion: "v0",
      createdAt: Date.now() - 25 * 3600 * 1000,
    });
    api.lookupRuns.mockResolvedValue([]);
    await mount();
    expect(api.lookupRuns).toHaveBeenCalledWith("dcv_1", "old");
    expect(api.runImage).not.toHaveBeenCalled();
    expect(readPending("dcv_1")).toEqual([]);
  });

  it("lookup 一直失败（断网）：再老的未确认项也一直留着继续查，不因年龄删", async () => {
    upsertPending("dcv_1", {
      clientRequestId: "old-unknown",
      kind: "image",
      body: imageReq.body,
      slot: "look:lk_1",
      sig: "x",
      targets: ["look:lk_1"],
      docVersion: "v0",
      createdAt: Date.now() - 30 * 24 * 3600 * 1000,
    });
    api.lookupRuns.mockRejectedValue(new TypeError("Failed to fetch"));
    await mount();
    await act(async () => {
      vi.advanceTimersByTime(PENDING_RETRY_DELAYS_MS[0]);
      await flushMicrotasks();
    });
    expect(api.lookupRuns.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(readPending("dcv_1").map((e) => e.clientRequestId)).toEqual(["old-unknown"]);
  });

  it("首次接回失败（断网）：退避重试，恢复后结果合进来", async () => {
    const d = doc();
    d.characters[0].looks[0].run = { runId: "r9", status: "running" };
    api.get.mockResolvedValue(detail(d));
    api.getRuns.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    api.getRuns.mockResolvedValue([run({ id: "r9", status: "succeeded", result: { images: [{ key: "mock/z.png" }] } })]);
    const { result } = await mount();
    expect(findLook(result.current.doc.doc, "lk_1")!.look.images.versions).toEqual([]);
    await act(async () => {
      vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0]);
      await flushMicrotasks();
    });
    expect(findLook(result.current.doc.doc, "lk_1")!.look.images.versions.map((v) => v.key)).toEqual(["mock/z.png"]);
    expect(result.current.runs.runFor("look:lk_1")?.status).toBe("succeeded");
  });

  it("只读（stale）时取消：不发请求，toast 说清要先载入最新", async () => {
    api.save.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_STALE", message: "x" }, 409));
    const { result } = await mount();
    act(() => result.current.doc.update((dd) => ({ ...dd, materials: [{ id: "m1", name: "m", kind: "text", text: "x" }] })));
    await act(async () => {
      await result.current.doc.flush();
    });
    expect(result.current.doc.status).toBe("stale");
    await act(async () => {
      await result.current.runs.cancel("r1");
    });
    expect(api.cancelRun).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });
});

// ── Codex 复审 N1 / N3 / N5：lookup 空结果先留着、pending 接回退避、submitSequence 与批量不重叠 ──────────

describe("useCanvasRuns · 复审", () => {
  const pendingEntry = (over: Partial<Parameters<typeof upsertPending>[1]> = {}) => ({
    clientRequestId: "dcv-k",
    kind: "image" as const,
    body: imageReq.body,
    slot: "look:lk_1",
    sig: "s",
    targets: ["look:lk_1"],
    docVersion: "v0",
    createdAt: Date.now(),
    ...over,
  });
  const reqLk2 = { kind: "image" as const, body: { target: { kind: "look" as const, id: "lk_2" }, count: 1 } };

  beforeEach(() => {
    vi.useFakeTimers();
    for (const f of Object.values(api)) f.mockReset();
    toastError.mockReset();
    __resetCanvasRunsForTest();
    __resetPendingForTest();
    api.get.mockResolvedValue(detail());
    let n = 0;
    api.save.mockImplementation(async () => ({ docVersion: `v${++n}`, updatedAt: "2026-09-30T01:00:00.000Z" }));
    api.getRuns.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("N1：刚发出不久、lookup 还查不到 → 先留着，隔 10 秒再查，查到就接回（全程不发 POST）", async () => {
    upsertPending("dcv_1", pendingEntry());
    api.lookupRuns.mockResolvedValueOnce([]).mockResolvedValueOnce([run({ id: "r3", status: "running" })]);
    const { result } = await mount();
    expect(readPending("dcv_1")).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(PENDING_RETRY_DELAYS_MS[0]);
      await flushMicrotasks();
    });
    expect(api.lookupRuns).toHaveBeenCalledTimes(2);
    expect(runRefAt(result.current.doc.doc, "look:lk_1")?.runId).toBe("r3");
    expect(readPending("dcv_1")).toEqual([]);
    expect(api.runImage).not.toHaveBeenCalled();
  });

  it("N1：有运行 id（受理过）的项不按年龄删，照样接回；getRuns 明确查不到那条才删", async () => {
    upsertPending("dcv_1", pendingEntry({ clientRequestId: "old-accepted", runIds: ["r4"], createdAt: Date.now() - 2 * 24 * 3600 * 1000 }));
    upsertPending("dcv_1", pendingEntry({ clientRequestId: "ancient", slot: "look:lk_2", targets: ["look:lk_2"], runIds: ["r0"], createdAt: Date.now() - 8 * 24 * 3600 * 1000 }));
    api.getRuns.mockImplementation(async (_id: string, ids: string[]) => (ids.includes("r4") ? [run({ id: "r4", status: "running" })] : []));
    const { result } = await mount();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(runRefAt(result.current.doc.doc, "look:lk_1")?.runId).toBe("r4");
    expect(api.getRuns.mock.calls.some((c) => (c[1] as string[]).includes("r0"))).toBe(true); // 8 天前的也照样查
    expect(readPending("dcv_1")).toEqual([]); // r4 接回存上了；r0 服务端明确没有 → 删
  });

  it("N5：pending 接回断网 → 同一次进页里退避再查，网络恢复后接回", async () => {
    upsertPending("dcv_1", pendingEntry());
    api.lookupRuns.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce([run({ id: "r6", status: "running" })]);
    const { result } = await mount();
    expect(readPending("dcv_1")).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(PENDING_RETRY_DELAYS_MS[0]);
      await flushMicrotasks();
    });
    expect(runRefAt(result.current.doc.doc, "look:lk_1")?.runId).toBe("r6");
    expect(readPending("dcv_1")).toEqual([]);
  });

  it("N3：submitSequence 一进来整批登记为提交中；轮到之前单独点后面那项被挡住，轮到时才发（每项只发一次）", async () => {
    const a = deferred<DramaCanvasRun>();
    api.runImage.mockImplementation((_id: string, body: CanvasImageRunBody) =>
      body.target.kind === "look" && body.target.id === "lk_1" ? a.promise : Promise.resolve(run({ id: "rB", target: "look:lk_2" })),
    );
    const { result } = await mount();
    let seq!: Promise<unknown[]>;
    act(() => {
      seq = result.current.runs.submitSequence([imageReq, reqLk2]);
    });
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.runs.isSubmitting("look:lk_1")).toBe(true);
    expect(result.current.runs.isSubmitting("look:lk_2")).toBe(true); // 还没轮到也算提交中
    let single: unknown;
    await act(async () => {
      single = await result.current.runs.submit(reqLk2);
    });
    expect(single).toMatchObject({ ok: false, reason: "rejected" });
    expect(api.runImage).toHaveBeenCalledTimes(1);

    let out: unknown[] = [];
    await act(async () => {
      a.resolve(run());
      out = await seq;
      await flushMicrotasks();
    });
    expect(out.map((r) => (r as { ok: boolean }).ok)).toEqual([true, true]);
    expect(api.runImage).toHaveBeenCalledTimes(2);
    expect(result.current.runs.isSubmitting("look:lk_2")).toBe(false);
  });

  it("N3：轮到某一项时它已经在生成 → 跳过（skipped）；stopOnError 时前一项失败，后面的都不发", async () => {
    const d = doc();
    d.characters[0].looks[1].run = { runId: "rRun", status: "running" };
    api.get.mockResolvedValue(detail(d));
    api.getRuns.mockResolvedValue([run({ id: "rRun", target: "look:lk_2", status: "running" })]);
    api.runImage.mockResolvedValue(run());
    const { result } = await mount();
    let out: { ok: boolean; reason?: string }[] = [];
    await act(async () => {
      out = (await result.current.runs.submitSequence([imageReq, reqLk2])) as typeof out;
    });
    expect(out.map((r) => r.reason ?? "ok")).toEqual(["ok", "skipped"]);
    expect(api.runImage).toHaveBeenCalledTimes(1);

    api.runImage.mockReset();
    api.runImage.mockRejectedValueOnce(new ApiError({ code: "DRAMA_CANVAS_PROMPT_EMPTY", message: "x" }, 400));
    // lk_1 刚被上一批提交、正在生成，这里换两个空闲的目标
    const s2 = { kind: "image" as const, body: { target: { kind: "scene" as const, id: "sc_8" }, count: 1 } };
    const s3 = { kind: "image" as const, body: { target: { kind: "scene" as const, id: "sc_9" }, count: 1 } };
    await act(async () => {
      out = (await result.current.runs.submitSequence([s2, s3])) as typeof out;
    });
    expect(out.map((r) => r.reason ?? "ok")).toEqual(["rejected", "skipped"]);
    expect(api.runImage).toHaveBeenCalledTimes(1);
  });

  it("N3：image-batch 与在提交中的单条重叠 → 整批不发，回 rejected", async () => {
    const a = deferred<DramaCanvasRun>();
    api.runImage.mockReturnValue(a.promise);
    const { result } = await mount();
    act(() => {
      void result.current.runs.submit(imageReq);
    });
    await act(async () => {
      await flushMicrotasks();
    });
    let res: unknown;
    await act(async () => {
      res = await result.current.runs.submit({
        kind: "image-batch",
        body: { items: [{ target: { kind: "look", id: "lk_1" }, count: 1 }, { target: { kind: "look", id: "lk_2" }, count: 1 }] },
      });
    });
    expect(res).toMatchObject({ ok: false, reason: "rejected" });
    expect(api.runImageBatch).not.toHaveBeenCalled();
    await act(async () => {
      a.resolve(run());
      await flushMicrotasks();
    });
  });
});

describe("useCanvasRuns · 第三次复核", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const f of Object.values(api)) f.mockReset();
    toastError.mockReset();
    __resetCanvasRunsForTest();
    __resetPendingForTest();
    api.get.mockResolvedValue(detail());
    let n = 0;
    api.save.mockImplementation(async () => ({ docVersion: `v${++n}`, updatedAt: "2026-09-30T01:00:00.000Z" }));
    api.getRuns.mockResolvedValue([]);
    api.lookupRuns.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("单条 submit：目标已有受理的运行在排队 / 生成 → rejected，不发请求（和批量 / sequence 对称）", async () => {
    const d = doc();
    d.characters[0].looks[0].run = { runId: "rq", status: "queued" };
    api.get.mockResolvedValue(detail(d));
    api.getRuns.mockResolvedValue([run({ id: "rq", status: "queued" })]);
    const { result } = await mount();
    let res: unknown;
    await act(async () => {
      res = await result.current.runs.submit(imageReq);
    });
    expect(res).toMatchObject({ ok: false, reason: "rejected" });
    expect(api.runImage).not.toHaveBeenCalled();
  });

  it("storage 先正常写入 K、之后 getItem 抛错：切进内存模式仍能读到 K，重试沿用原键", async () => {
    const m = new Map<string, string>();
    const ctl = { failReads: false };
    const fake = {
      getItem: (k: string) => {
        if (ctl.failReads) throw new Error("SecurityError");
        return m.has(k) ? m.get(k)! : null;
      },
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      length: 0,
    };
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { value: fake, configurable: true });
    try {
      api.runImage.mockRejectedValueOnce(new TypeError("Failed to fetch")); // 响应丢了：K 留在表里
      api.runImage.mockResolvedValueOnce(run());
      const { result } = await mount();
      await act(async () => {
        await result.current.runs.submit(imageReq);
      });
      const k = (api.runImage.mock.calls[0][1] as CanvasImageRunBody).clientRequestId;
      expect(m.get("drama-canvas-pending:dcv_1")).toContain(k);

      ctl.failReads = true; // storage 突然读不了
      expect(readPending("dcv_1").map((e) => e.clientRequestId)).toEqual([k]);
      await act(async () => {
        await result.current.runs.submit(imageReq);
        await flushMicrotasks();
      });
      expect((api.runImage.mock.calls[1][1] as CanvasImageRunBody).clientRequestId).toBe(k);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
