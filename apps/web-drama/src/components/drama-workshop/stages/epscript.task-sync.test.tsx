import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// 分镜表「提交 → 轮询 → 后台对账」的生命周期（v0.197 第三轮评审的几条）。
// 断行为：镜头最后落库成什么样、提交接口被调了几次、有没有单查任务；不断言可视文案（§8.0.1 ⑩），
// 按钮按可访问名字找（那是交互入口，不是被测的文案）。

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/drama-ui/confirm-dialog", () => ({ dramaConfirm: async () => true }));
vi.mock("@/api/drama-config", () => ({
  getDramaConfig: async () => ({ confirmThreshold: 10, prices: {} }),
}));
const PRICES = { frame: 2, clip: 30, decompose: 3, splitScene: 6, shotRewrite: 2, epscript: 12 };
vi.mock("@/lib/use-drama-config", () => ({ useDramaConfig: () => ({ confirmThreshold: 10, prices: PRICES }) }));

const submitFrameJob = vi.fn();
const renderClip = vi.fn();
let modelsStatus: "loading" | "ready" | "failed" = "ready";
vi.mock("@/lib/use-shot-render", () => ({
  useShotRender: () => ({
    models: {
      models: { image: [], video: [] },
      status: modelsStatus,
      retry: () => {},
      setImageEndpointId: () => {},
      setVideoEndpointId: () => {},
    },
    submitFrameJob: (a: unknown) => submitFrameJob(a),
    renderClip: (a: unknown) => renderClip(a),
    renderFrame: vi.fn(),
    pollFrame: vi.fn(),
    pollClip: vi.fn(),
  }),
}));

const listRenderTasks = vi.fn();
const pollFrameJob = vi.fn();
const pollClipJob = vi.fn();
const getFrameJob = vi.fn();
const getClipJob = vi.fn();
const epscriptAiDraft = vi.fn();
vi.mock("@/api", () => ({
  RenderApi: {
    listRenderTasks: (...a: unknown[]) => listRenderTasks(...a),
    pollFrameJob: (...a: unknown[]) => pollFrameJob(...a),
    pollClipJob: (...a: unknown[]) => pollClipJob(...a),
    getFrameJob: (...a: unknown[]) => getFrameJob(...a),
    getClipJob: (...a: unknown[]) => getClipJob(...a),
    listRenderModels: async () => ({ image: [], video: [] }),
    POLL_TIMEOUT_MESSAGE: "POLL_TIMEOUT",
  },
  ProjectsApi: {
    epscriptAiDraft: (...a: unknown[]) => epscriptAiDraft(...a),
    splitSceneShots: vi.fn(),
    rewriteShot: vi.fn(),
    decomposeShot: vi.fn(),
  },
}));

import { EpScriptStage } from "./epscript";
import type { BoardShot, ProjectData } from "@/mocks/drama-workshop";
import type { StageContext } from "./stage-context";

const T = (min: number) => new Date(Date.UTC(2026, 8, 28, 2, min, 0)).toISOString();
type Shot = BoardShot & { resetAt?: string };
const shot = (over: Partial<Shot>): Shot => ({
  id: "s1", no: 1, size: "中景", move: "固定", dur: 5, engine: "seedance", desc: "画面", cast: [], ...over,
});
const dataWith = (shots: Shot[]): ProjectData => ({
  projectInfo: { title: "T", type: "悬疑", episodes: 1, duration: "每集 60 秒", ratio: "9:16", logline: "L", mainline: "" },
  topicCards: [],
  episodes: [{ no: 1, content: "这一集的剧情" }],
  characters: [],
  scenes: [],
  script: { ep: 1, scenes: [{ id: "sc1", place: "屋里", mood: "", action: "动作", lines: [] }] },
  storyboard: { ep: 1, scenes: [{ id: "sc1", shots }] },
  promptPack: { ep: 1, scene: "", shots: [] },
} as unknown as ProjectData);

const snap = (tasks: unknown[]) => ({
  summary: { frame: { queued: 0, running: 0, limit: 2 }, video: { queued: 0, running: 0, limit: 3 }, total: { queued: 0, running: 0, limit: 5 } },
  tasks,
});
const frameTask = (id: string, created: string, urls: string[], status = "ready") => ({
  id, task_type: "frame", name: "首帧", status, shot_id: "s1", episode_no: 1, created_at: created,
  frames: status === "ready" ? urls.map((url) => ({ url })) : undefined,
});
const videoTask = (id: string, created: string, url: string | null, status = "ready", extra: object = {}) => ({
  id, task_type: "video", name: "视频", status, shot_id: "s1", episode_no: 1, created_at: created, video_url: url, ...extra,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

/** 外壳：saveData / patchData 回写 data（和工作台页面一样：patchData 在**最新**文档上合并），
 *  latest 永远是最后一次落库的文档。 */
let latest: ProjectData;
function Harness({ initial }: { initial: ProjectData }) {
  const [data, setData] = React.useState(initial);
  const docRef = React.useRef(initial);
  const ctx = React.useMemo<StageContext>(() => ({
    projectId: "p1",
    saveData: async (next: ProjectData) => {
      docRef.current = next;
      latest = next;
      setData(next);
    },
    patchData: async (patch: (prev: ProjectData) => ProjectData) => {
      const next = patch(docRef.current);
      docRef.current = next;
      latest = next;
      setData(next);
    },
  }), []);
  return <EpScriptStage state={{ ep: 1, lockedStages: {} } as never} dispatch={() => {}} data={data} ctx={ctx} />;
}
const savedShot = () => {
  const doc = latest.episodeDocs?.["1"];
  return doc?.storyboard.scenes[0]?.shots[0] as Shot | undefined;
};
const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const click = async (name: RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
  await flush();
};

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  for (const f of [submitFrameJob, renderClip, listRenderTasks, pollFrameJob, pollClipJob, getFrameJob, getClipJob, epscriptAiDraft]) f.mockReset();
  listRenderTasks.mockResolvedValue(snap([]));
  modelsStatus = "ready";
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("分镜表后台任务", () => {
  it("P1：视频生成中重写本集，旧任务晚到的结果不会写进同 id 的新镜头", async () => {
    const init = dataWith([shot({ flow: "frame", frameUrl: "/f1.png", frameUrls: ["/f1.png"], resetAt: T(0) })]);
    latest = init;
    const oldPoll = deferred<unknown>();
    renderClip.mockResolvedValue({ id: "V_OLD", status: "rendering", created_at: T(1) });
    pollClipJob.mockReturnValue(oldPoll.promise);
    render(<Harness initial={init} />);
    await flush();

    await click(/^\s*生成视频/);
    expect(renderClip).toHaveBeenCalledTimes(1);

    // 重写：AI 返回的新镜头 id 和旧镜头一样
    epscriptAiDraft.mockResolvedValue({
      scenes: [{ id: "sc1", place: "屋里", mood: "", action: "新动作", lines: [] }],
      boardScenes: [{ id: "sc1", shots: [shot({ desc: "新画面", flow: "draft" })] }],
    });
    listRenderTasks.mockResolvedValue(snap([videoTask("V_OLD", T(1), null, "running")]));
    await click(/按剧情重写本集分镜/);
    await flush();
    expect(savedShot()?.desc).toBe("新画面");

    // 旧任务这时才出结果
    await act(async () => {
      oldPoll.resolve({ id: "V_OLD", status: "ready", video_url: "/old.mp4", created_at: T(1) });
    });
    await flush();
    listRenderTasks.mockResolvedValue(snap([videoTask("V_OLD", T(1), "/old.mp4")]));
    await flush(5100);

    expect(savedShot()?.videoUrl).toBeUndefined();
    expect(savedShot()?.jobId).toBeUndefined();
    // 新镜头没被旧任务挂成「生成中」：出首帧的入口在
    expect(screen.getByRole("button", { name: /先出首帧/ })).toBeTruthy();
  });

  it("P2：对账这一轮先填回新首帧，比它晚、已经成功的视频同一轮一起填回（不会因为没有下一轮而丢）", async () => {
    const init = dataWith([shot({ flow: "frame", frameUrl: "/f1.png", frameUrls: ["/f1.png"], resetAt: T(0) })]);
    latest = init;
    listRenderTasks.mockResolvedValue(snap([
      videoTask("V2", T(7), "/v2.mp4", "ready", { source: { last_frame_url: "/v2-last.png" } }),
      frameTask("F2", T(5), ["/f2a.png", "/f2b.png"]),
      frameTask("F1", T(0), ["/f1.png"]),
    ]));
    render(<Harness initial={init} />);
    await flush();
    await flush();

    expect(listRenderTasks).toHaveBeenCalledTimes(1); // 没有在跑的任务：只对账这一次
    expect(savedShot()?.frameUrl).toBe("/f2a.png");
    expect(savedShot()?.videoUrl).toBe("/v2.mp4");
    // 列表里视频的末帧只在 source 里（P3）：照样填回，下一镜才接得上这一镜的最后一帧
    expect(savedShot()?.lastFrameUrl).toBe("/v2-last.png");
  });

  it("P3：刷新后第一次对账还没回来就点了生成，等对账看到这一镜已经在跑，就不再提交", async () => {
    const init = dataWith([shot({ flow: "frame", frameUrl: "/f1.png", frameUrls: ["/f1.png"], resetAt: T(0) })]);
    latest = init;
    const firstList = deferred<unknown>();
    listRenderTasks.mockReturnValueOnce(firstList.promise);
    render(<Harness initial={init} />);
    await flush();

    await click(/^\s*生成视频/);
    expect(renderClip).not.toHaveBeenCalled(); // 在等第一次对账

    await act(async () => {
      firstList.resolve(snap([videoTask("V_RUNNING", T(3), null, "running")]));
    });
    await flush();
    expect(renderClip).not.toHaveBeenCalled();
  });

  it("P3：在跑的任务被挤出列表（列表只返回最近几十条）也不会一直锁着：单查一次，好了照常填回", async () => {
    const init = dataWith([shot({ flow: "frame", frameUrl: "/f1.png", frameUrls: ["/f1.png"], resetAt: T(0) })]);
    latest = init;
    renderClip.mockResolvedValue({ id: "V1", status: "rendering", created_at: T(2) });
    pollClipJob.mockResolvedValue({ id: "V1", status: "failed", error_message: "POLL_TIMEOUT" }); // 单任务轮询超时
    getClipJob.mockResolvedValue({ id: "V1", status: "ready", video_url: "/v1.mp4", last_frame_url: "/v1-last.png" });
    render(<Harness initial={init} />);
    await flush();
    await click(/^\s*生成视频/);
    expect(renderClip).toHaveBeenCalledTimes(1);

    await flush(5100); // 定时对账：列表里没有 V1
    expect(getClipJob).toHaveBeenCalledWith("V1");
    await flush();
    expect(savedShot()?.videoUrl).toBe("/v1.mp4");
    expect(savedShot()?.lastFrameUrl).toBe("/v1-last.png");
  });

  it("P2：模型和价格没读到（loading / failed）时按模型计价的生成停用，点了也不提交", async () => {
    for (const status of ["loading", "failed"] as const) {
      modelsStatus = status;
      const init = dataWith([shot({ flow: "frame", frameUrl: "/f1.png", frameUrls: ["/f1.png"], resetAt: T(0) })]);
      latest = init;
      const { unmount } = render(<Harness initial={init} />);
      await flush();
      const btn = screen.getByRole("button", { name: /^\s*生成视频/ }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      await act(async () => { fireEvent.click(btn); });
      await flush();
      expect(renderClip).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("同一条首帧任务只填一次：对账先填回、用户挑了另一张之后，晚到的轮询结果不会把选择盖回去", async () => {
    const init = dataWith([shot({
      flow: "done", done: true, frameUrl: "/f1.png", frameUrls: ["/f1.png"], videoUrl: "/v0.mp4", jobId: "V0", resetAt: T(0),
    })]);
    latest = init;
    const latePoll = deferred<unknown>();
    submitFrameJob.mockResolvedValue({ id: "F2", status: "queued", created_at: T(5) });
    pollFrameJob.mockReturnValue(latePoll.promise);
    render(<Harness initial={init} />);
    await flush();

    await click(/从头重做/);
    expect(submitFrameJob).toHaveBeenCalledTimes(1);

    listRenderTasks.mockResolvedValue(snap([frameTask("F2", T(5), ["/f2a.png", "/f2b.png"])]));
    await flush(5100); // 对账先拿到结果
    expect(savedShot()?.frameUrl).toBe("/f2a.png");
    expect(savedShot()?.videoUrl).toBeUndefined();

    await click(/用第 2 张首帧/);
    await flush(2000);
    expect(savedShot()?.frameUrl).toBe("/f2b.png");

    await act(async () => {
      latePoll.resolve({ id: "F2", status: "ready", frames: [{ url: "/f2a.png" }, { url: "/f2b.png" }], created_at: T(5) });
    });
    await flush(2000);
    expect(savedShot()?.frameUrl).toBe("/f2b.png");
  });
});
