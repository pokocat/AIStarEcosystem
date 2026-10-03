import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DramaRenderTask, RenderTaskSnapshot } from "@/api/render";

// §8.0.1 ⑥ / ⑩：钉住后台生成面板的行为 —— 按当前短剧过滤、多个面板共用一次轮询、
// 任务结束时通知余额重读、顶栏小入口真的能打开面板。不断言可视文案。

let pathname = "/projects/p1";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const listRenderTasks = vi.fn<(projectId?: string) => Promise<RenderTaskSnapshot>>();
vi.mock("@/api", () => ({ RenderApi: { listRenderTasks: (id?: string) => listRenderTasks(id) } }));

const notifyWalletChanged = vi.fn();
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: () => notifyWalletChanged() }));

import { RenderTaskDock, RenderTaskTopbarEntry } from "./render-task-dock";

function task(over: Partial<DramaRenderTask>): DramaRenderTask {
  return { id: "t1", task_type: "frame", name: "第1集 镜3 首帧", status: "running", shot_id: "shot_abcdef12345", ...over };
}

function snap(tasks: DramaRenderTask[]): RenderTaskSnapshot {
  const running = tasks.filter((t) => t.status === "running").length;
  return {
    summary: {
      frame: { queued: 0, running, limit: 2 },
      video: { queued: 0, running: 0, limit: 3 },
      total: { queued: 0, running, limit: 5 },
    },
    tasks,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  listRenderTasks.mockReset();
  notifyWalletChanged.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RenderTaskDock", () => {
  it("在某部短剧里只查这部短剧的任务", async () => {
    pathname = "/projects/p-filter";
    listRenderTasks.mockResolvedValue(snap([task({})]));
    render(<RenderTaskDock />);
    await flush();
    expect(listRenderTasks).toHaveBeenCalledWith("p-filter");
  });

  it("回收站 / 新建页不轮询、不渲染", async () => {
    for (const p of ["/projects/trash", "/projects/new", "/dashboard"]) {
      pathname = p;
      listRenderTasks.mockResolvedValue(snap([task({})]));
      const { container, unmount } = render(<RenderTaskDock />);
      await flush();
      expect(container.firstChild, p).toBeNull();
      unmount();
    }
    expect(listRenderTasks).not.toHaveBeenCalled();
  });

  it("行标题用提交时的名字，不露镜头 id", async () => {
    pathname = "/projects/p-label";
    listRenderTasks.mockResolvedValue(snap([task({})]));
    const { container } = render(<RenderTaskDock />);
    await flush();
    fireEvent.click(container.querySelector(".render-task-head")!);
    const row = container.querySelector(".render-task-row strong")!;
    expect(row.textContent).toContain("第1集 镜3");
    expect(container.textContent).not.toContain("12345");
  });

  it("侧栏面板和顶栏入口同时挂着时共用一次轮询", async () => {
    pathname = "/projects/p-shared";
    listRenderTasks.mockResolvedValue(snap([task({})]));
    render(
      <>
        <RenderTaskDock />
        <RenderTaskTopbarEntry />
      </>,
    );
    await flush();
    expect(listRenderTasks).toHaveBeenCalledTimes(1);
  });

  it("任务从进行中变成完成时通知余额重读", async () => {
    pathname = "/projects/p-wallet";
    listRenderTasks.mockResolvedValueOnce(snap([task({ status: "running" })]));
    listRenderTasks.mockResolvedValueOnce(snap([task({ status: "ready" })]));
    render(<RenderTaskDock />);
    await flush();
    expect(notifyWalletChanged).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    await flush();
    expect(listRenderTasks).toHaveBeenCalledTimes(2);
    expect(notifyWalletChanged).toHaveBeenCalledTimes(1);
  });

  // 评审 P2：summary.total 是全平台计数，列表却只列自己（这部短剧）的 —— 入口和展开后的数量要是同一批任务。
  it("数量按自己列出的任务算，全平台的只进「平台排队」那一块", async () => {
    pathname = "/projects/p-count";
    const s = snap([
      task({ id: "a", status: "ready" }),
      task({ id: "b", status: "running", task_type: "video" }),
      task({ id: "c", status: "queued" }),
    ]);
    // 全平台：别人还有一堆在跑、在排队
    s.summary.total = { queued: 9, running: 5, limit: 5 };
    s.summary.frame = { queued: 6, running: 2, limit: 2 };
    s.summary.video = { queued: 3, running: 3, limit: 3 };
    listRenderTasks.mockResolvedValue(s);
    const { container } = render(<RenderTaskDock />);
    await flush();
    fireEvent.click(container.querySelector(".render-task-head")!);
    const meter = container.querySelector(".render-task-meter") as HTMLElement;
    expect(meter.dataset.running).toBe("1");
    expect(meter.dataset.queued).toBe("1");
    const platform = container.querySelector(".render-task-platform") as HTMLElement;
    expect(platform.dataset.platformQueued).toBe("9");
    // 入口的「进行中」与面板同一批：1 在生成 + 1 在排队
    expect(container.querySelector(".render-task-title span")!.textContent).toContain("2");
  });

  it("自己的都结束了、平台上别人还在跑：面板不说自己有在生成的", async () => {
    pathname = "/projects/p-idle";
    const s = snap([task({ id: "a", status: "ready" })]);
    s.summary.total = { queued: 4, running: 5, limit: 5 };
    listRenderTasks.mockResolvedValue(s);
    const { container } = render(<RenderTaskDock />);
    await flush();
    fireEvent.click(container.querySelector(".render-task-head")!);
    const meter = container.querySelector(".render-task-meter") as HTMLElement;
    expect(meter.dataset.running).toBe("0");
    expect(meter.dataset.queued).toBe("0");
  });

  it("顶栏入口点开是一个对话框", async () => {
    pathname = "/shorts/make";
    listRenderTasks.mockResolvedValue(snap([task({ project_id: "d1" })]));
    const { container } = render(<RenderTaskTopbarEntry />);
    await flush();
    const pill = container.querySelector("button.render-task-pill") as HTMLButtonElement;
    expect(pill).not.toBeNull();
    fireEvent.click(pill);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("dialog").querySelector(".render-task-row")).not.toBeNull();
  });
});
