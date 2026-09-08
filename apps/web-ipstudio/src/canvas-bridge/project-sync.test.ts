// 项目同步的单元测试。
//
// 这里只有一条真正致命：**加载完成之前不能保存**。
// 画布一挂载就认为「这个项目是空的」，此时若触发自动保存，
// 服务端上真正的内容会被一份空文档覆盖 —— 用户的画布当场清零，而且不可逆。

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const getProjectMock = vi.fn();
const updateProjectMock = vi.fn();

vi.mock("@/api", () => ({
  IpStudioApi: {
    getProject: (...a: unknown[]) => getProjectMock(...a),
    updateProject: (...a: unknown[]) => updateProjectMock(...a),
  },
}));
// fetchModels 也从 ./api 出去：不补进 mock 的话 loadServerModels 会走异常分支，
// 测试照样过、但覆盖的是错的路径。
vi.mock("./api", () => ({
  setCurrentProjectId: vi.fn(),
  fetchModels: vi.fn().mockResolvedValue({ image: [], video: [] }),
}));

import { useCanvasStore } from "@/canvas/stores/canvas/use-canvas-store";
import { useProjectSync } from "./project-sync";

const serverDoc = {
  nodes: [{ id: "n-1", type: "image", title: "招牌形象", position: { x: 0, y: 0 }, width: 300, height: 400, metadata: { prompt: "画一个" } }],
  connections: [],
  viewport: { x: 0, y: 0, k: 1 },
};

beforeEach(() => {
  getProjectMock.mockReset();
  updateProjectMock.mockReset().mockResolvedValue({});
  useCanvasStore.setState({ projects: [], deletedProjects: [], hydrated: false });
});

describe("加载", () => {
  it("把服务端的文档灌进画布，ready 之后才允许渲染", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc, updatedAt: "2026-09-07T00:00:00Z" });

    const { result } = renderHook(() => useProjectSync("IPP-1"));
    expect(result.current.state).toBe("loading");

    await waitFor(() => expect(result.current.state).toBe("ready"));
    const p = useCanvasStore.getState().projects[0]!;
    expect(p.id).toBe("IPP-1");
    expect(p.title).toBe("我的 IP");
    expect(p.nodes).toHaveLength(1);
  });

  it("读不出来时给错误态，不是空画布", async () => {
    // 给空画布 = 用户以为项目丢了，还会顺手在上面改 —— 一改就真丢了
    getProjectMock.mockRejectedValue(new Error("项目不存在"));
    const { result } = renderHook(() => useProjectSync("IPP-x"));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("项目不存在");
    expect(useCanvasStore.getState().projects).toHaveLength(0);
  });
});

describe("自动保存", () => {
  it("加载完成之前的任何改动都不回存", async () => {
    // 最危险的一条：画布挂载得比加载快，此时 store 里是空的。
    // 存下去就是把服务端上真正的内容覆盖成空文档。
    let resolveLoad: (v: unknown) => void = () => {};
    getProjectMock.mockReturnValue(new Promise((r) => { resolveLoad = r; }));

    renderHook(() => useProjectSync("IPP-1"));
    act(() => {
      useCanvasStore.setState({ projects: [], deletedProjects: [], hydrated: true });
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(updateProjectMock).not.toHaveBeenCalled();

    act(() => { resolveLoad({ id: "IPP-1", name: "我的 IP", doc: serverDoc }); });
  });

  it("加载完之后改动会防抖回存", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => {
      useCanvasStore.getState().updateProject("IPP-1", {
        nodes: [...serverDoc.nodes, { ...serverDoc.nodes[0]!, id: "n-2" }],
      });
    });

    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [id, payload] = updateProjectMock.mock.calls[0]!;
    expect(id).toBe("IPP-1");
    expect((payload as { doc: { nodes: unknown[] } }).doc.nodes).toHaveLength(2);
    await waitFor(() => expect(result.current.saveState).toBe("saved"));
  });

  it("防抖还没到点就切走：那一笔存进**旧项目自己**，且切换后不再重复存", async () => {
    // v0.179 改判：原来这里断言的是「旧项目一次都不存」——
    // 而那正是用户丢改动的原因（改一笔、立刻走，900ms 防抖没到就没了）。
    // 真正要守的是「存的是旧项目自己那份内容、用旧 id，且只存这一次」。
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    const { result, rerender, unmount } = renderHook(({ id }) => useProjectSync(id), {
      initialProps: { id: "IPP-1" },
    });
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    // 防抖还没到点就切走
    getProjectMock.mockResolvedValue({ id: "IPP-2", name: "B", doc: serverDoc });
    rerender({ id: "IPP-2" });
    await waitFor(() => expect(result.current.state).toBe("ready"));

    const forProjectOne = updateProjectMock.mock.calls.filter(([id]) => id === "IPP-1");
    expect(forProjectOne).toHaveLength(1);
    expect((forProjectOne[0]![1] as { name: string }).name).toBe("A");

    // 再等过防抖窗口：旧项目不该被存第二次（计时器已掐掉）
    await new Promise((r) => setTimeout(r, 1200));
    expect(updateProjectMock.mock.calls.filter(([id]) => id === "IPP-1")).toHaveLength(1);
    unmount();
  });

  it("卸载时把最后一笔存掉 —— 改一笔立刻点走，改动不能没", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    const { result, unmount } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    expect(result.current.saveState).toBe("dirty");   // 界面上得看得见「未保存」
    expect(updateProjectMock).not.toHaveBeenCalled(); // 防抖还没到点

    unmount();
    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledTimes(1));
    expect(updateProjectMock.mock.calls[0]![0]).toBe("IPP-1");
  });

  it("没有改动时卸载不白发一次 PUT", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    const { result, unmount } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    unmount();
    await new Promise((r) => setTimeout(r, 50));
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  it("存不上要说出来，不能让用户以为改动落盘了", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    updateProjectMock.mockRejectedValue(new Error("网络断了"));
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });

    await waitFor(() => expect(result.current.saveState).toBe("failed"), { timeout: 3000 });
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
    await waitFor(() => expect(result.current.state).toBe("ready"));

    // A 改一笔 → 在途（上面那个 promise 卡住不 resolve）
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledTimes(1));

    // 切到 B，然后 A 的响应才回来（带着 A 的新指纹）
    rerender({ id: "IPP-2" });
    await waitFor(() => expect(result.current.state).toBe("ready"));
    updateProjectMock.mockResolvedValue({ docVersion: "IPP-2-v2" });
    await act(async () => { finishA({ docVersion: "IPP-1-v2" }); await Promise.resolve(); });

    // B 改一笔：带的必须是 B 自己的指纹
    act(() => { useCanvasStore.getState().updateProject("IPP-2", { nodes: [] }); });
    await waitFor(() => expect(updateProjectMock.mock.calls.some(([id]) => id === "IPP-2")).toBe(true), { timeout: 3000 });
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
    await waitFor(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("saved");
  });

  it("存不上返回 failed（调用方据此拒绝发布，而不是拿旧内容发出去）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    updateProjectMock.mockRejectedValue(new Error("网络断了"));
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("failed");
    await waitFor(() => expect(result.current.saveState).toBe("failed"));
    // 重试入口能真的再发一次
    updateProjectMock.mockResolvedValue({ docVersion: "v2" });
    await expect(result.current.retrySave()).resolves.toBe("saved");
  });

  it("撞上别处的编辑返回 conflict，并停掉自动保存（重试只会覆盖那份工作）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc, docVersion: "v1" });
    updateProjectMock.mockRejectedValue(Object.assign(new Error("stale"), { code: "IP_PROJECT_STALE" }));
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("conflict");
    await waitFor(() => expect(result.current.saveState).toBe("conflict"));

    updateProjectMock.mockClear();
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [{ ...serverDoc.nodes[0]!, id: "n-9" }] }); });
    await new Promise((r) => setTimeout(r, 1200));
    expect(updateProjectMock).not.toHaveBeenCalled();
  });
});

describe("在途时的 saveNow 不许把「排队了」当成「存好了」", () => {
  it("一直存不上就返回 failed（并且只补存一次，不是死循环重试）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    let rejectSave: (e: unknown) => void = () => {};
    updateProjectMock.mockReset();
    updateProjectMock.mockImplementationOnce(() => new Promise((_, rej) => { rejectSave = rej; }));
    updateProjectMock.mockRejectedValue(new Error("还是断的"));

    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));

    // 自动保存先跑起来（防抖到点），此时它卡在网络里
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

    // 用户这会儿点了发布 → saveNow 必须等那次的真实结果，而不是立刻说「存好了」
    let outcome: string | undefined;
    const pending = result.current.saveNow().then((o) => { outcome = o; });
    expect(outcome).toBeUndefined();
    await act(async () => { rejectSave(new Error("网络断了")); await pending; });
    expect(outcome).toBe("failed");
    // 第一次失败会把「还没存上」重新标脏，所以补存一次；再失败就如实回报，不无限重试
    expect(updateProjectMock).toHaveBeenCalledTimes(2);
  });

  it("在途那次成功了就返回 saved（不再多存一次）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    let finishSave: (v: unknown) => void = () => {};
    updateProjectMock.mockReset();
    updateProjectMock.mockImplementationOnce(() => new Promise((r) => { finishSave = r; }));

    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

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
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await expect(result.current.saveNow()).resolves.toBe("saved");
    expect(updateProjectMock).toHaveBeenCalledTimes(1);

    // 防抖窗口过去
    await new Promise((r) => setTimeout(r, 1200));
    expect(updateProjectMock).toHaveBeenCalledTimes(1);
    expect(result.current.saveState).toBe("saved");
  });

  it("什么都没改就点发布：不发 PUT，也不算失败（服务端已经有这份了）", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "A", doc: serverDoc });
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
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
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });
    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(updateProjectMock.mock.calls[0]![1].baseDocVersion).toBe("v1");

    // 在途期间又改一笔，然后立刻离开
    act(() => { useCanvasStore.getState().renameProject("IPP-1", "改完就走"); });
    unmount();
    await act(async () => { finishFirst({ docVersion: "v2" }); });
    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledTimes(2));

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
    await waitFor(() => expect(first.result.current.state).toBe("ready"));
    act(() => { useCanvasStore.getState().renameProject("IPP-1", "改完就走"); });
    first.unmount();                                   // 补存出发，还没落地

    const second = renderHook(() => useProjectSync("IPP-1"));
    // 补存没落地之前不许读完（否则读到的是 name:"A"）
    await new Promise((r) => setTimeout(r, 50));
    expect(second.result.current.state).toBe("loading");

    await act(async () => { land(); await new Promise((r) => setTimeout(r, 0)); });
    await waitFor(() => expect(second.result.current.state).toBe("ready"));
    expect(useCanvasStore.getState().projects[0]!.title).toBe("改完就走");

    // 基线也得是新的：接着改一笔，带的必须是 v2，不能撞 409
    act(() => { useCanvasStore.getState().renameProject("IPP-1", "再改一笔"); });
    await waitFor(() => expect(updateProjectMock.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    expect(updateProjectMock.mock.calls.at(-1)![1].baseDocVersion).toBe("v2");
    // 收尾：把第二次 PUT 也放行。模块级保存队列是跨 hook 实例活着的（设计如此），
    // 留一条永不落地的在里面会让后面用同一个 projectId 的测试一直在等它。
    await act(async () => { land(); await new Promise((r) => setTimeout(r, 0)); });
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
