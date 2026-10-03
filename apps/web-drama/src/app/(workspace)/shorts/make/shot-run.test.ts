import { describe, expect, it, vi } from "vitest";
import {
  approvableIds,
  batchTargets,
  canAdoptLateJob,
  clipResultPatch,
  createRunGate,
  frameEditPatch,
  freshFramePatch,
  hasCurrentVideo,
  runBatch,
  sumCost,
  type RunShot,
} from "./shot-run";

type Shot = RunShot & {
  no: number;
  dur: number;
  frameUrl?: string;
  frameUrls?: string[];
  jobId?: string;
  endFrameUrl?: string;
  motionDesc?: string;
};

const shot = (id: string, patch: Partial<Shot> = {}): Shot => ({ id, no: 1, dur: 4, flow: "draft", ...patch });

describe("在途镜头不再提交（SM1）", () => {
  it("有 pendingJob 的镜不进批量，正在跑的那一镜也不进", () => {
    const shots = [
      shot("a"),
      shot("b", { flow: "frame", frameUrl: "f", pendingJob: { jobId: "j1", kind: "clip" } }),
      shot("c", { flow: "frame", frameUrl: "f" }),
    ];
    expect(batchTargets(shots, null).map((s) => s.id)).toEqual(["a", "c"]);
    expect(batchTargets(shots, "c").map((s) => s.id)).toEqual(["a"]);
  });

  it("轮询超时后再点一起生成：那一镜仍在途，不会被第二次提交", async () => {
    let shots = [shot("a", { flow: "frame", frameUrl: "f" }), shot("b", { flow: "frame", frameUrl: "f" })];
    const submitted: string[] = [];
    const renderOne = vi.fn(async (s: Shot) => {
      submitted.push(s.id);
      // 提交成功就写下任务号；a 的轮询超时 → pending
      shots = shots.map((x) => (x.id === s.id ? { ...x, pendingJob: { jobId: `job-${s.id}`, kind: "clip" as const } } : x));
      return s.id === "a" ? ("pending" as const) : ("done" as const);
    });
    const gate = createRunGate();
    const first = await runBatch({ targets: batchTargets(shots), gate, token: gate.begin(), stillNeeded: () => true, renderOne });
    expect(first.outcome).toBe("pending");
    expect(submitted).toEqual(["a"]);

    // 第二轮：a 还挂着任务号，只剩 b
    const second = batchTargets(shots);
    expect(second.map((s) => s.id)).toEqual(["b"]);
    await runBatch({ targets: second, gate, token: gate.begin(), stillNeeded: () => true, renderOne });
    expect(submitted).toEqual(["a", "b"]);
  });

  it("提交前按最新状态再判一次：已被后台结果填上的镜跳过、不提交", async () => {
    const renderOne = vi.fn(async () => "done" as const);
    const gate = createRunGate();
    const res = await runBatch({
      targets: [shot("a"), shot("b"), shot("c")],
      gate,
      token: gate.begin(),
      stillNeeded: (id) => id !== "b",
      renderOne,
    });
    expect(renderOne.mock.calls.map(([s]) => s.id)).toEqual(["a", "c"]);
    expect(res).toMatchObject({ outcome: "all", done: 2 });
  });
});

describe("离开页面停掉连跑（SM2）", () => {
  it("第一镜生成期间点了停止 / 离开：第二镜不提交", async () => {
    const gate = createRunGate();
    const token = gate.begin();
    const renderOne = vi.fn(async (s: Shot) => {
      if (s.id === "a") gate.stop(); // 用户在第一镜还没好时离开
      return "done" as const;
    });
    const res = await runBatch({ targets: [shot("a"), shot("b")], gate, token, stillNeeded: () => true, renderOne });
    expect(renderOne).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ outcome: "stopped", done: 1 });
  });

  it("卸载之后（哪怕确认框是卸载后才点的开始）一镜都不提交", async () => {
    const gate = createRunGate();
    gate.dispose();
    const renderOne = vi.fn(async () => "done" as const);
    const res = await runBatch({ targets: [shot("a")], gate, token: gate.begin(), stillNeeded: () => true, renderOne });
    expect(renderOne).not.toHaveBeenCalled();
    expect(res.outcome).toBe("stopped");
  });

  it("上一轮停过，新开一轮照常跑；旧一轮的令牌作废", async () => {
    const gate = createRunGate();
    const old = gate.begin();
    gate.stop();
    const fresh = gate.begin();
    expect(gate.isLive(old)).toBe(false);
    expect(gate.isLive(fresh)).toBe(true);
  });
});

describe("从头重做之后旧视频作废（SM3）", () => {
  const approved = shot("a", { flow: "done", frameUrl: "old-f", videoUrl: "old.mp4", jobId: "old-job", endFrameUrl: "e", motionDesc: "m" });

  it("重出首帧成功：清掉视频、任务号、尾帧、动作描述", () => {
    const after = { ...approved, ...freshFramePatch(["new-f"]) };
    expect(after).toMatchObject({ flow: "frame", frameUrl: "new-f", frameUrls: ["new-f"] });
    expect(after.videoUrl).toBeUndefined();
    expect(after.jobId).toBeUndefined();
    expect(after.endFrameUrl).toBeUndefined();
    expect(after.motionDesc).toBeUndefined();
    expect(after.pendingJob).toBeUndefined();
  });

  it("重做后的镜会被批量生成选中，不会被「全部就用这版」重新确认", () => {
    const after = { ...approved, ...freshFramePatch(["new-f"]) };
    expect(batchTargets([after]).map((s) => s.id)).toEqual(["a"]);
    expect(approvableIds([after])).toEqual([]);
  });

  it("存量草稿里残留的旧视频（flow=frame 还带 videoUrl）不算有视频", () => {
    const legacy = shot("a", { flow: "frame", frameUrl: "new-f", videoUrl: "old.mp4" });
    expect(hasCurrentVideo(legacy)).toBe(false);
    expect(batchTargets([legacy])).toHaveLength(1);
    expect(approvableIds([legacy])).toEqual([]);
  });

  it("「就用这版」只认生成好待确认的镜，且不在途", () => {
    const shots = [
      shot("a", { ...clipResultPatch("j", "a.mp4") }),
      shot("b", { ...clipResultPatch("j", "b.mp4"), pendingJob: { jobId: "j2", kind: "clip" } }),
      shot("c", { flow: "done", videoUrl: "c.mp4" }),
    ];
    expect(approvableIds(shots)).toEqual(["a"]);
    expect(approvableIds(shots, "a")).toEqual([]);
  });
});

describe("报价逐镜相加（SM4）", () => {
  it("按秒计费时，两镜各 10 秒、每秒 40 → 800，不是镜数 × 默认价", () => {
    const perSecond = (s: { dur: number }) => 40 * s.dur;
    expect(sumCost([shot("a", { dur: 10 }), shot("b", { dur: 10 })], perSecond)).toBe(800);
  });
});

describe("晚到的 AI 改图不清在途任务（SM1 复核 newIssue 1）", () => {
  it("没视频、没任务在跑：就是换了首帧，按重出首帧的规则清", () => {
    const idle = shot("a", { flow: "frame", frameUrl: "f", jobId: "old" });
    const r = frameEditPatch(idle, "edited");
    expect(r.late).toBe(false);
    expect({ ...idle, ...r.patch }).toMatchObject({ flow: "frame", frameUrl: "edited", frameUrls: ["edited"] });
  });

  it("改图请求在路上时这一镜开始生成视频：结果回来只换首帧，任务号留着，结果回来还能落上", () => {
    const generating = shot("a", { flow: "frame", frameUrl: "f", pendingJob: { jobId: "clip-1", kind: "clip" } });
    const after = { ...generating, ...frameEditPatch(generating, "edited").patch };
    expect(after.pendingJob).toEqual({ jobId: "clip-1", kind: "clip" });
    expect(after.frameUrl).toBe("edited");
    // 仍在途：不进批量、不会被第二次提交
    expect(batchTargets([after])).toEqual([]);
  });

  it("刚提交、任务号还没回来（只有 busy）时也不清", () => {
    const submitting = shot("a", { flow: "frame", frameUrl: "f" });
    const r = frameEditPatch(submitting, "edited", "a");
    expect(r.late).toBe(true);
    expect(r.patch).not.toHaveProperty("pendingJob");
    expect(r.patch).not.toHaveProperty("videoUrl");
  });

  it("这一镜已经有了新视频：视频留着，不被晚到的改图作废", () => {
    const withVideo = shot("a", { ...clipResultPatch("clip-1", "v.mp4"), frameUrl: "f" });
    const after = { ...withVideo, ...frameEditPatch(withVideo, "edited").patch };
    expect(after).toMatchObject({ flow: "clip", videoUrl: "v.mp4", jobId: "clip-1", frameUrl: "edited" });
    expect(hasCurrentVideo(after)).toBe(true);
  });
});

describe("结果没落到镜上（stale）不算生成好（SM1 复核 newIssue 1）", () => {
  it("stale 的镜不计数、不回调 onShotDone（不会被标成就用这版），后面的镜照常跑", async () => {
    const onShotDone = vi.fn();
    const renderOne = vi.fn(async (s: Shot) => (s.id === "a" ? ("stale" as const) : ("done" as const)));
    const gate = createRunGate();
    const res = await runBatch({ targets: [shot("a"), shot("b")], gate, token: gate.begin(), stillNeeded: () => true, renderOne, onShotDone });
    expect(renderOne).toHaveBeenCalledTimes(2);
    expect(onShotDone.mock.calls.map(([s]) => s.id)).toEqual(["b"]);
    expect(res).toMatchObject({ outcome: "all", done: 1 });
  });
});

describe("离页后迟到的任务号能不能补记（SM2 复核 newIssue P2）", () => {
  const pj = { jobId: "late-1", kind: "clip" as const };
  it("这一镜还没视频、手上没任务：补", () => {
    expect(canAdoptLateJob(shot("a", { flow: "frame", frameUrl: "f" }), pj)).toBe(true);
  });
  it("已经有别的任务 / 已经有视频 / 这条已经回填过：不补", () => {
    expect(canAdoptLateJob(shot("a", { pendingJob: { jobId: "other", kind: "clip" } }), pj)).toBe(false);
    expect(canAdoptLateJob(shot("a", { flow: "clip", videoUrl: "v.mp4", jobId: "x" }), pj)).toBe(false);
    expect(canAdoptLateJob(shot("a", { flow: "frame", jobId: "late-1" }), pj)).toBe(false);
  });
});
