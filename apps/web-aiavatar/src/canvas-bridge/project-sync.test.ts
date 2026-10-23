// @vitest-environment jsdom
// 项目同步的单元测试。
//
// 这里只有一条真正致命：**加载完成之前不能保存**。
// 画布一挂载就认为「这个项目是空的」，此时若触发自动保存，
// 服务端上真正的内容会被一份空文档覆盖 —— 用户的画布当场清零，而且不可逆。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "@ai-star-eco/api-client";

// 整个文件跑在假计时器上：900ms 防抖、1200ms「等过防抖窗口」都改成推进假时间，断言不变
// （原来 13 条用例真睡，占了这个文件约 14 秒）。`until` 是假计时器下的 waitFor：
// 每拍推进 50ms 假时间再重试，超过 maxMs 就把最后一次断言失败抛出来。
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
async function until(check: () => void, { timeout = 1000 }: { timeout?: number } = {}) {
  for (let elapsed = 0; ; elapsed += 50) {
    try { check(); return; } catch (error) { if (elapsed >= timeout) throw error; }
    await advance(50);
  }
}

const getProjectMock = vi.fn();
const updateProjectMock = vi.fn();
const createProjectMock = vi.fn();

vi.mock("@/ip/api", () => ({
  IpStudioApi: {
    getProject: (...a: unknown[]) => getProjectMock(...a),
    updateProject: (...a: unknown[]) => updateProjectMock(...a),
    createProject: (...a: unknown[]) => createProjectMock(...a),
  },
}));
// fetchModels 也从 ./api 出去：不补进 mock 的话 loadServerModels 会走异常分支，
// 测试照样过、但覆盖的是错的路径。
vi.mock("./api", () => ({
  setCurrentProjectId: vi.fn(),
  fetchModels: vi.fn().mockResolvedValue({ image: [], video: [] }),
  fetchStudioVideoModels: vi.fn().mockResolvedValue([]),
}));

import { useCanvasStore } from "@/canvas/stores/canvas/use-canvas-store";
import { useProjectSync } from "./project-sync";
import { receiveRemoteSave } from "./project-channel";
import { subscribeStudioErrors } from "@/ip/studio-errors";

const serverDoc = {
  nodes: [{ id: "n-1", type: "image", title: "招牌形象", position: { x: 0, y: 0 }, width: 300, height: 400, metadata: { prompt: "画一个" } }],
  connections: [],
  viewport: { x: 0, y: 0, k: 1 },
};

beforeEach(() => {
  vi.useFakeTimers();
  getProjectMock.mockReset();
  updateProjectMock.mockReset().mockResolvedValue({});
  createProjectMock.mockReset();
  useCanvasStore.setState({ projects: [], deletedProjects: [], hydrated: false });
});
afterEach(() => { vi.useRealTimers(); });

describe("加载", () => {
  it("加载失败通知保留服务端错误码和真实追查号，仍不创建空画布", async () => {
    const notify = vi.fn(), unsubscribe = subscribeStudioErrors(notify); notify.mockClear();
    getProjectMock.mockRejectedValue(Object.assign(new Error("画布不存在"), { code: "IP_PROJECT_NOT_FOUND", logId: "ABCDEF234567" }));
    const view = renderHook(() => useProjectSync("IPP-missing"));
    try {
      await until(() => expect(view.result.current.state).toBe("error"));
      // 给空画布 = 用户以为项目丢了，还会顺手在上面改 —— 一改就真丢了
      expect(view.result.current.error).toBe("画布不存在");
      expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ code: "IP_PROJECT_NOT_FOUND", message: "画布不存在", logId: "ABCDEF234567" }));
      expect(useCanvasStore.getState().projects).toHaveLength(0);
      expect(updateProjectMock).not.toHaveBeenCalled();
    } finally { view.unmount(); unsubscribe(); }
  });
  it("把服务端的文档灌进画布，ready 之后才允许渲染", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc, updatedAt: "2026-09-07T00:00:00Z" });

    const { result } = renderHook(() => useProjectSync("IPP-1"));
    expect(result.current.state).toBe("loading");

    await until(() => expect(result.current.state).toBe("ready"));
    const p = useCanvasStore.getState().projects[0]!;
    expect(p.id).toBe("IPP-1");
    expect(p.title).toBe("我的 IP");
    expect(p.nodes).toHaveLength(1);
  });

});

describe("自动保存", () => {
  it("网关恢复后先重试原快照，再用新版本保存等待期间的编辑", async () => {
    const notify = vi.fn(), unsubscribe = subscribeStudioErrors(notify); notify.mockClear();
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc, docVersion: "v1" });
    updateProjectMock.mockRejectedValueOnce(new ApiError({ code: "HTTP_ERROR", message: "unavailable" }, 502))
      .mockResolvedValueOnce({ docVersion: "v2" }).mockResolvedValue({ docVersion: "v3" });
    const view = renderHook(() => useProjectSync("IPP-1"));
    try {
      await until(() => expect(view.result.current.state).toBe("ready"));
      act(() => useCanvasStore.getState().updateProject("IPP-1", { title: "第一笔" }));
      await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1));
      expect(view.result.current.saveState).toBe("saving");
      act(() => useCanvasStore.getState().updateProject("IPP-1", { title: "等待时的第二笔" }));
      await advance(3000);
      await until(() => expect(view.result.current.saveState).toBe("saved"));
      expect(updateProjectMock.mock.calls[1]).toEqual(updateProjectMock.mock.calls[0]);
      expect(updateProjectMock.mock.calls[2]?.[1]).toMatchObject({ name: "等待时的第二笔", baseDocVersion: "v2" });
      expect(notify).not.toHaveBeenCalled();
    } finally { view.unmount(); unsubscribe(); }
  });
  it("保存失败通知保留服务端诊断，原文档和失败状态仍可恢复", async () => {
    const notify = vi.fn(), unsubscribe = subscribeStudioErrors(notify); notify.mockClear();
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    updateProjectMock.mockRejectedValue(Object.assign(new Error("保存失败"), { code: "IP_PROJECT_SAVE_FAILED", logId: "ABCDEF234567" }));
    const view = renderHook(() => useProjectSync("IPP-1"));
    try {
      await until(() => expect(view.result.current.state).toBe("ready"));
      act(() => useCanvasStore.getState().updateProject("IPP-1", { title: "新标题" }));
      let outcome: string | undefined;
      await act(async () => { outcome = await view.result.current.saveNow(); });
      expect(outcome).toBe("failed");
      expect(view.result.current.saveState).toBe("failed");
      expect(useCanvasStore.getState().projects[0]?.title).toBe("新标题");
      expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ code: "IP_PROJECT_SAVE_FAILED", message: "保存失败", logId: "ABCDEF234567" }));
    } finally { view.unmount(); unsubscribe(); }
  });
  it("加载完成之前的任何改动都不回存", async () => {
    // 最危险的一条：画布挂载得比加载快，此时 store 里是空的。
    // 存下去就是把服务端上真正的内容覆盖成空文档。
    let resolveLoad: (v: unknown) => void = () => {};
    getProjectMock.mockReturnValue(new Promise((r) => { resolveLoad = r; }));

    renderHook(() => useProjectSync("IPP-1"));
    act(() => {
      useCanvasStore.setState({ projects: [], deletedProjects: [], hydrated: true });
    });
    await advance(50);
    expect(updateProjectMock).not.toHaveBeenCalled();

    act(() => { resolveLoad({ id: "IPP-1", name: "我的 IP", doc: serverDoc }); });
  });

  it("加载完之后改动会防抖回存", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));

    act(() => {
      useCanvasStore.getState().updateProject("IPP-1", {
        nodes: [...serverDoc.nodes, { ...serverDoc.nodes[0]!, id: "n-2" }],
      });
    });

    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [id, payload] = updateProjectMock.mock.calls[0]!;
    expect(id).toBe("IPP-1");
    expect((payload as { doc: { nodes: unknown[] } }).doc.nodes).toHaveLength(2);
    await until(() => expect(result.current.saveState).toBe("saved"));
  });

  it("防抖还没到点就切走：那一笔存进**旧项目自己**，且切换后不再重复存", async () => {
    // v0.179 改判：原来这里断言的是「旧项目一次都不存」——
    // 而那正是用户丢改动的原因（改一笔、立刻走，900ms 防抖没到就没了）。
    // 真正要守的是「存的是旧项目自己那份内容、用旧 id，且只存这一次」。
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    const { result, rerender, unmount } = renderHook(({ id }) => useProjectSync(id), {
      initialProps: { id: "IPP-1" },
    });
    await until(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    // 防抖还没到点就切走
    getProjectMock.mockResolvedValue({ id: "IPP-2", name: "B", doc: serverDoc });
    rerender({ id: "IPP-2" });
    await until(() => expect(result.current.state).toBe("ready"));

    const forProjectOne = updateProjectMock.mock.calls.filter(([id]) => id === "IPP-1");
    expect(forProjectOne).toHaveLength(1);
    expect((forProjectOne[0]![1] as { name: string }).name).toBe("A");

    // 再等过防抖窗口：旧项目不该被存第二次（计时器已掐掉）
    await advance(1200);
    expect(updateProjectMock.mock.calls.filter(([id]) => id === "IPP-1")).toHaveLength(1);
    unmount();
  });

  it("卸载时把最后一笔存掉 —— 改一笔立刻点走，改动不能没", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    const { result, unmount } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    expect(result.current.saveState).toBe("dirty");   // 界面上得看得见「未保存」
    expect(updateProjectMock).not.toHaveBeenCalled(); // 防抖还没到点

    unmount();
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1));
    expect(updateProjectMock.mock.calls[0]![0]).toBe("IPP-1");
  });

  it("没有改动时卸载不白发一次 PUT", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    const { result, unmount } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    unmount();
    await advance(50);
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  it("存不上要说出来，不能让用户以为改动落盘了", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    updateProjectMock.mockRejectedValue(new Error("网络断了"));
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });

    await until(() => expect(result.current.saveState).toBe("failed"), { timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 跨项目的代次隔离。
//
// `baseRef` / 在途 promise 都是跨 projectId 共享的 ref：A 的在途 PUT 晚于 B 的 GET 返回时，
// 它会把 baseRef 写成 A 的指纹 → B 的下一次保存带着 A 的 baseDocVersion → 服务端 409
// `IP_PROJECT_STALE` → 前端按设计停掉全部自动保存。用户只开了一个窗口，却被告知
// 「别处改过」，此后所有改动都不落盘（v0.162 那次事故的伤害形状）。
describe("跨项目不许串号", () => {
  it("旧项目的保存响应不许污染新项目的 baseDocVersion", async () => {
    getProjectMock.mockImplementation((id: string) =>
      Promise.resolve({ id, name: id, doc: serverDoc, docVersion: `${id}-v1` }),
    );
    let finishA: (v: unknown) => void = () => {};
    updateProjectMock.mockImplementationOnce(() => new Promise((r) => { finishA = r; }));

    const { result, rerender, unmount } = renderHook(({ id }) => useProjectSync(id), {
      initialProps: { id: "IPP-1" },
    });
    await until(() => expect(result.current.state).toBe("ready"));

    // A 改一笔 → 在途（上面那个 promise 卡住不 resolve）
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1));

    // 切到 B，然后 A 的响应才回来（带着 A 的新指纹）
    rerender({ id: "IPP-2" });
    await until(() => expect(result.current.state).toBe("ready"));
    updateProjectMock.mockResolvedValue({ docVersion: "IPP-2-v2" });
    await act(async () => { finishA({ docVersion: "IPP-1-v2" }); await Promise.resolve(); });

    // B 改一笔：带的必须是 B 自己的指纹
    act(() => { useCanvasStore.getState().updateProject("IPP-2", { nodes: [] }); });
    await until(() => expect(updateProjectMock.mock.calls.some(([id]) => id === "IPP-2")).toBe(true), { timeout: 3000 });
    const callB = updateProjectMock.mock.calls.find(([id]) => id === "IPP-2")!;
    expect((callB[1] as { baseDocVersion?: string }).baseDocVersion).toBe("IPP-2-v1");
    expect(result.current.saveState).not.toBe("conflict");
    unmount();
  });
});

// 发布读的是**库里那份**文档，所以发布之前必须能确认「存上了没有」。
describe("saveNow 给调用方一个能据以决策的结果", () => {
  it("存好了返回 saved", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    updateProjectMock.mockResolvedValue({ docVersion: "v2" });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("saved");
  });

  it("存不上返回 failed（调用方据此拒绝发布，而不是拿旧内容发出去）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    updateProjectMock.mockRejectedValue(new Error("网络断了"));
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("failed");
    await until(() => expect(result.current.saveState).toBe("failed"));
    // 重试入口能真的再发一次
    updateProjectMock.mockResolvedValue({ docVersion: "v2" });
    await expect(result.current.retrySave()).resolves.toBe("saved");
  });

  it("撞上别处的编辑返回 conflict，并停掉自动保存（重试只会覆盖那份工作）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" });
    updateProjectMock.mockRejectedValue(Object.assign(new Error("stale"), { code: "IP_PROJECT_STALE" }));
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("conflict");
    await until(() => expect(result.current.saveState).toBe("conflict"));

    updateProjectMock.mockClear();
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [{ ...serverDoc.nodes[0]!, id: "n-9" }] }); });
    await advance(1200);
    expect(updateProjectMock).not.toHaveBeenCalled();
  });
});

describe("在途时的 saveNow 不许把「排队了」当成「存好了」", () => {
  it("在途保存失败就返回 failed，不自动再发请求", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    let rejectSave: (e: unknown) => void = () => {};
    updateProjectMock.mockReset();
    updateProjectMock.mockImplementationOnce(() => new Promise((_, rej) => { rejectSave = rej; }));
    updateProjectMock.mockRejectedValue(new Error("还是断的"));

    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));

    // 自动保存先跑起来（防抖到点），此时它卡在网络里
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

    // 用户这会儿点了发布 → saveNow 必须等那次的真实结果，而不是立刻说「存好了」
    let outcome: string | undefined;
    const pending = result.current.saveNow().then((o) => { outcome = o; });
    expect(outcome).toBeUndefined();
    await act(async () => { rejectSave(new Error("网络断了")); await pending; });
    expect(outcome).toBe("failed");
    // 失败由用户明确重试，导航/发布不自动重发。
    expect(updateProjectMock).toHaveBeenCalledTimes(1);
  });

  it("在途那次成功了就返回 saved（不再多存一次）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    let finishSave: (v: unknown) => void = () => {};
    updateProjectMock.mockReset();
    updateProjectMock.mockImplementationOnce(() => new Promise((r) => { finishSave = r; }));

    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

    let outcome: string | undefined;
    const pending = result.current.saveNow().then((o) => { outcome = o; });
    await act(async () => { finishSave({ docVersion: "v2" }); await pending; });
    expect(outcome).toBe("saved");
    expect(updateProjectMock).toHaveBeenCalledTimes(1);
  });
});

describe("不做无谓的保存", () => {
  it("发布前 saveNow 存过之后，防抖计时器到点不再重复 PUT 一遍", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    updateProjectMock.mockResolvedValue({ docVersion: "v2" });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("saved");
    expect(updateProjectMock).toHaveBeenCalledTimes(1);

    // 防抖窗口过去
    await advance(1200);
    expect(updateProjectMock).toHaveBeenCalledTimes(1);
    expect(result.current.saveState).toBe("saved");
  });

  it("什么都没改就点发布：不发 PUT，也不算失败（服务端已经有这份了）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    await expect(result.current.saveNow()).resolves.toBe("nothing-to-save");
    expect(updateProjectMock).not.toHaveBeenCalled();
  });
});

describe("离开前补存的那一笔", () => {
  it("用的是在途那次存完之后的基线 —— 拿旧基线补存必然假冲突", async () => {
    // 正在存的那一次会把服务端的文档指纹推到下一版。补存如果还带加载时那个基线，
    // 服务端一定判 409 `IP_PROJECT_STALE` —— 而 409 会把这个项目的自动保存整条停掉
    // （用户只开了一个窗口，却被告知「别处改过」，此后所有改动都不落盘）。
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" });
    let finishFirst: (v: unknown) => void = () => {};
    updateProjectMock.mockReset();
    updateProjectMock.mockImplementationOnce(() => new Promise((r) => { finishFirst = r; }));
    updateProjectMock.mockResolvedValue({ docVersion: "v3" });

    const { result, unmount } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(updateProjectMock.mock.calls[0]![1].baseDocVersion).toBe("v1");

    // 在途期间又改一笔，然后立刻离开
    act(() => { useCanvasStore.getState().renameProject("IPP-1", "改完就走"); });
    unmount();
    await act(async () => { finishFirst({ docVersion: "v2" }); });
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(2));

    const tail = updateProjectMock.mock.calls[1]![1] as { name: string; baseDocVersion?: string };
    expect(tail.name).toBe("改完就走");
    expect(tail.baseDocVersion).toBe("v2");   // ← 在途那次返回的新指纹，不是加载时的 v1
  });
});

describe("离开后立刻又打开同一个项目", () => {
  it("先等补存落地再读 —— 否则读回旧版、基线也是旧的（下一次保存必然假冲突）", async () => {
    // 服务端那份内容随 PUT 变化，用它来验证「读到的是哪一版」
    let persisted = { id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" };
    getProjectMock.mockImplementation(async () => ({ ...persisted }));
    let land: () => void = () => {};
    updateProjectMock.mockReset();
    updateProjectMock.mockImplementation((_id: string, payload: { name: string }) =>
      new Promise((resolve) => {
        land = () => {
          persisted = { ...persisted, name: payload.name, docVersion: "v2" };
          resolve({ docVersion: "v2" });
        };
      }),
    );

    const first = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(first.result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().renameProject("IPP-1", "改完就走"); });
    first.unmount();                                   // 补存出发，还没落地

    const second = renderHook(() => useProjectSync("IPP-1"));
    // 补存没落地之前不许读完（否则读到的是 name:"A"）
    await advance(50);
    expect(second.result.current.state).toBe("loading");

    await act(async () => { land(); await vi.advanceTimersByTimeAsync(0); });
    await until(() => expect(second.result.current.state).toBe("ready"));
    expect(useCanvasStore.getState().projects[0]!.title).toBe("改完就走");

    // 基线也得是新的：接着改一笔，带的必须是 v2，不能撞 409
    act(() => { useCanvasStore.getState().renameProject("IPP-1", "再改一笔"); });
    await until(() => expect(updateProjectMock.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    expect(updateProjectMock.mock.calls.at(-1)![1].baseDocVersion).toBe("v2");
    // 收尾：把第二次 PUT 也放行。模块级保存队列是跨 hook 实例活着的（设计如此），
    // 留一条永不落地的在里面会让后面用同一个 projectId 的测试一直在等它。
    await act(async () => { land(); await vi.advanceTimersByTimeAsync(0); });
    second.unmount();
  });
});

describe("等补存落地也要有上限", () => {
  it("一直没落地：既不能永远卡在「正在打开」，也不能把已知是旧的内容摆出来让人改", async () => {
    // apiFetch 没有超时，一条卡住的 PUT 能挂几分钟 —— 无限等就是画布永远打不开。
    // 但等超了**照常打开**同样不行（Codex 复核纠正了我这一版）：我们已经知道读到的是旧内容，
    // 用户会在旧内容上接着改，然后每次保存都撞 409、自动保存整条停掉 —— v0.162 那次事故的形状。
    // 所以：明确报错（错误页自带「重新加载」），别装作一切正常。
    vi.useFakeTimers();
    try {
      // 用一个独立的 projectId：这条测试会**故意**留下一条永不落地的保存，
      // 模块级队列跨实例活着，别让它污染其它测试。
      getProjectMock.mockResolvedValue({ id: "IPP-hang", name: "A", doc: serverDoc, docVersion: "v1" });
      updateProjectMock.mockReset();
      updateProjectMock.mockImplementation(() => new Promise(() => {}));   // 永远不落地

      const first = renderHook(() => useProjectSync("IPP-hang"));
      // 加载链有几层 await（等队列 → GET → 灌 store），推几拍让它跑完
      await act(async () => { await vi.advanceTimersByTimeAsync(5); });
      expect(first.result.current.state).toBe("ready");
      act(() => { useCanvasStore.getState().renameProject("IPP-hang", "卡住那一笔"); });
      await act(async () => { await vi.advanceTimersByTimeAsync(950); });
      expect(updateProjectMock).toHaveBeenCalledTimes(1);
      first.unmount();

      const second = renderHook(() => useProjectSync("IPP-hang"));
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      expect(second.result.current.state).toBe("loading");   // 先等
      await act(async () => { await vi.advanceTimersByTimeAsync(8100); });
      expect(second.result.current.state).toBe("error");     // 等超了如实报错
      expect(second.result.current.error).toMatch(/还在保存中/);
      expect(getProjectMock).toHaveBeenCalledTimes(1);       // 没有去读那份已知是旧的文档
      second.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

it('loads legacy conversation nodes into separate history and persists history-only changes without adding graph nodes',async()=>{
  const legacy={...serverDoc.nodes[0],id:'history',type:'text',metadata:{studio:{kind:'assistant',request:{clientRequestId:'original-paid-request'},conversation:{mode:'general',turns:[{role:'user',content:'原对话'}]}}}};
  getProjectMock.mockResolvedValue({id:'IPP-history',name:'历史画布',doc:{...serverDoc,nodes:[...serverDoc.nodes,legacy],connections:[{id:'legacy-edge',fromNodeId:'n-1',toNodeId:'history'}]},docVersion:'old'});
  const view=renderHook(()=>useProjectSync('IPP-history'));
  await until(()=>expect(view.result.current.state).toBe('ready'));
  const project=useCanvasStore.getState().projects[0];
  expect(project.nodes.map(n=>n.id)).toEqual(['n-1']);expect(project.connections).toEqual([]);
  expect(project.assistantConversations?.[0].metadata?.studio?.request?.clientRequestId).toBe('original-paid-request');
  await act(async()=>{useCanvasStore.getState().updateProject('IPP-history',{assistantConversations:project.assistantConversations!.map(n=>({...n,title:'更新后的对话'}))});await view.result.current.saveNow();});
  const payload=updateProjectMock.mock.calls.at(-1)![1];
  expect(payload.doc.nodes.map((n:{id:string})=>n.id)).toEqual(['n-1']);expect(payload.doc.assistantConversations[0].title).toBe('更新后的对话');
  view.unmount();
});

// ─────────────────────────────────────────────────────────────────────────────
// 同一个浏览器里把这张画布开了两个标签页（用户反馈：「画布已有修改的情况下页面持续报错」）。
// 真实形状：A 存了，B 的下一次保存撞 409 → 进冲突态；此前 B 只有一个不能点的徽标，
// 而冲突之后每一条经过保存的操作都再报一次同一句话。
// ─────────────────────────────────────────────────────────────────────────────
describe("别的标签页存了新版", () => {
  const otherTab = (docVersion: string) => receiveRemoteSave({ projectId: "IPP-1", docVersion, tabId: "tab-other" });
  const theirs = { ...serverDoc, nodes: [{ ...serverDoc.nodes[0]!, id: "n-theirs" }] };

  it("这里没改过东西：悄悄换成最新内容，不发 PUT、不进冲突，视口保留", async () => {
    getProjectMock.mockResolvedValueOnce({ id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { viewport: { x: 50, y: 60, k: 2 } }); });

    getProjectMock.mockResolvedValueOnce({ id: "IPP-1", name: "A 改过", doc: { ...theirs, viewport: { x: 0, y: 0, k: 1 } }, docVersion: "v2" });
    await act(async () => { otherTab("v2"); });
    await until(() => expect(result.current.remoteRefreshes).toBe(1));
    const p = useCanvasStore.getState().projects[0]!;
    expect(p.nodes.map((n) => n.id)).toEqual(["n-theirs"]);
    expect(p.title).toBe("A 改过");
    expect(p.viewport).toEqual({ x: 50, y: 60, k: 2 });   // 别让画布突然跳走
    expect(result.current.saveState).not.toBe("conflict");

    // 只拖过视口那一笔，补存到新基线上（而不是丢掉或撞 409）
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(updateProjectMock.mock.calls[0]![1]).toMatchObject({ baseDocVersion: "v2", doc: { viewport: { x: 50, y: 60, k: 2 } } });
  });

  it("这里改过内容：立刻进冲突态，不白发一次必然 409 的 PUT，也不弹通知", async () => {
    const notify = vi.fn(), unsubscribe = subscribeStudioErrors(notify); notify.mockClear();
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    try {
      await until(() => expect(result.current.state).toBe("ready"));
      act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
      await act(async () => { otherTab("v2"); });
      await until(() => expect(result.current.saveState).toBe("conflict"));
      await advance(1200);
      expect(updateProjectMock).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      expect(useCanvasStore.getState().projects[0]!.nodes).toEqual([]);   // 本地改动还在
      await expect(result.current.saveNow()).resolves.toBe("conflict");
    } finally { unsubscribe(); }
  });

  it("自己这一页的保存不算「别处」，同版本号的消息也不动", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(result.current.state).toBe("ready"));
    await act(async () => { otherTab("v1"); });
    await advance(50);
    expect(getProjectMock).toHaveBeenCalledTimes(1);
    expect(result.current.remoteRefreshes).toBe(0);
  });
});

describe("撞上冲突之后的三条出路", () => {
  const stale = Object.assign(new Error("stale"), { code: "IP_PROJECT_STALE" });
  const theirs = { ...serverDoc, nodes: [{ ...serverDoc.nodes[0]!, id: "n-theirs" }] };
  const mine = [{ ...serverDoc.nodes[0]!, id: "n-mine" }];

  async function openInConflict() {
    getProjectMock.mockResolvedValueOnce({ id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" });
    updateProjectMock.mockRejectedValueOnce(stale);
    const view = renderHook(() => useProjectSync("IPP-1"));
    await until(() => expect(view.result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: mine }); });
    await expect(view.result.current.saveNow()).resolves.toBe("conflict");
    await until(() => expect(view.result.current.saveState).toBe("conflict"));
    updateProjectMock.mockClear(); getProjectMock.mockClear();
    return view;
  }

  it("冲突本身不弹通知 —— 弹窗负责说，通知层逐条弹就是「页面一直在报错」", async () => {
    const notify = vi.fn(), unsubscribe = subscribeStudioErrors(notify); notify.mockClear();
    try { await openInConflict(); expect(notify).not.toHaveBeenCalled(); }
    finally { unsubscribe(); }
  });

  it("换成最新内容：画布变成服务端那份，冲突解除，自动保存恢复且带新基线", async () => {
    const { result } = await openInConflict();
    getProjectMock.mockResolvedValueOnce({ id: "IPP-1", name: "A", doc: theirs, docVersion: "v2" });
    updateProjectMock.mockResolvedValue({ docVersion: "v3" });
    await act(async () => { await expect(result.current.resolveConflict("take-theirs")).resolves.toEqual({ outcome: "resolved" }); });
    expect(useCanvasStore.getState().projects[0]!.nodes.map((n) => n.id)).toEqual(["n-theirs"]);
    expect(result.current.saveState).toBe("saved");
    expect(updateProjectMock).not.toHaveBeenCalled();

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await until(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(updateProjectMock.mock.calls[0]![1]).toMatchObject({ baseDocVersion: "v2", doc: { nodes: [] } });
    await expect(result.current.saveNow()).resolves.not.toBe("conflict");
  });

  it("以这里为准：拿服务端此刻的版本号重存本地内容，不是拿旧基线再撞一次", async () => {
    const { result } = await openInConflict();
    getProjectMock.mockResolvedValueOnce({ id: "IPP-1", name: "A", doc: theirs, docVersion: "v2" });
    updateProjectMock.mockResolvedValueOnce({ docVersion: "v3" });
    await act(async () => { await expect(result.current.resolveConflict("keep-mine")).resolves.toEqual({ outcome: "resolved" }); });
    expect(updateProjectMock).toHaveBeenCalledTimes(1);
    expect(updateProjectMock.mock.calls[0]![1]).toMatchObject({ baseDocVersion: "v2", doc: { nodes: [{ id: "n-mine" }] } });
    expect(useCanvasStore.getState().projects[0]!.nodes.map((n) => n.id)).toEqual(["n-mine"]);
    await until(() => expect(result.current.saveState).toBe("saved"));
    await expect(result.current.saveNow()).resolves.toBe("nothing-to-save");
  });

  it("以这里为准时别处又存了一版：还是冲突，如实回报，弹窗继续开着", async () => {
    const { result } = await openInConflict();
    getProjectMock.mockResolvedValueOnce({ id: "IPP-1", name: "A", doc: theirs, docVersion: "v2" });
    updateProjectMock.mockRejectedValueOnce(stale);
    await act(async () => { await expect(result.current.resolveConflict("keep-mine")).resolves.toEqual({ outcome: "conflict" }); });
    expect(result.current.saveState).toBe("conflict");
    await expect(result.current.saveNow()).resolves.toBe("conflict");
  });

  it("另存一份：本地内容进新画布（不带基线），这张换成最新内容，什么都不丢", async () => {
    const { result } = await openInConflict();
    createProjectMock.mockResolvedValueOnce({ id: "IPP-copy" });
    updateProjectMock.mockResolvedValueOnce({ docVersion: "c1" });
    getProjectMock.mockResolvedValueOnce({ id: "IPP-1", name: "A", doc: theirs, docVersion: "v2" });
    await act(async () => { await expect(result.current.resolveConflict("save-copy")).resolves.toEqual({ outcome: "resolved", copyId: "IPP-copy" }); });
    expect(createProjectMock).toHaveBeenCalledWith({ name: "A · 另一份" });
    expect(updateProjectMock).toHaveBeenCalledTimes(1);
    expect(updateProjectMock.mock.calls[0]![0]).toBe("IPP-copy");
    expect(updateProjectMock.mock.calls[0]![1]).toMatchObject({ doc: { nodes: [{ id: "n-mine" }] } });
    expect(updateProjectMock.mock.calls[0]![1].baseDocVersion).toBeUndefined();
    expect(useCanvasStore.getState().projects[0]!.nodes.map((n) => n.id)).toEqual(["n-theirs"]);
    expect(result.current.saveState).toBe("saved");
  });

  it("另存没成功：本地改动原样留着，还是冲突态，用户可以再选", async () => {
    const { result } = await openInConflict();
    createProjectMock.mockRejectedValueOnce(new Error("网络断了"));
    await act(async () => { await expect(result.current.resolveConflict("save-copy")).resolves.toEqual({ outcome: "failed" }); });
    expect(useCanvasStore.getState().projects[0]!.nodes.map((n) => n.id)).toEqual(["n-mine"]);
    expect(result.current.saveState).toBe("conflict");
  });
});
