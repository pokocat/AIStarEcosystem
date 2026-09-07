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
vi.mock("./api", () => ({ setCurrentProjectId: vi.fn() }));

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

  it("存不上要说出来，不能让用户以为改动落盘了", async () => {
    getProjectMock.mockResolvedValue({ id: "IPP-1", name: "我的 IP", doc: serverDoc });
    updateProjectMock.mockRejectedValue(new Error("网络断了"));
    const { result } = renderHook(() => useProjectSync("IPP-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => { useCanvasStore.getState().updateProject("IPP-1", { nodes: [] }); });

    await waitFor(() => expect(result.current.saveState).toBe("failed"), { timeout: 3000 });
  });
});
