import { describe, expect, it } from "vitest";
import type { DramaRenderTask } from "@/api/render";
import {
  EPOCH_ISO, afterFrameRestore, lastFrameOf, laterIso, planShotRecovery, resetMarkForNewShots, sameAsset, type RecoverableShot,
} from "./epscript-recovery";

// 断行为：给定镜头状态 + 服务端任务列表，对账该填回哪条任务（§8.0.1 ⑩ 不断文案）。
// 时间都按服务端 created_at 的形状写（ISO，带偏移），两种偏移混着用 —— 服务端 frame / video 两张表格式不同。

const EP = 1;
const T = (min: number) => new Date(Date.UTC(2026, 8, 28, 2, min, 0)).toISOString(); // ...Z
const T8 = (min: number) => {
  // 同一时刻的 +08:00 写法（DramaFrameJobService.putTime 的 ISO_OFFSET_DATE_TIME 可能长这样）
  const d = new Date(Date.UTC(2026, 8, 28, 2, min, 0));
  const local = new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 19);
  return `${local}+08:00`;
};

function frameTask(id: string, created: string, urls: string[], status = "ready", shot = "s1"): DramaRenderTask {
  return {
    id, task_type: "frame", name: "首帧", status, shot_id: shot, episode_no: EP, created_at: created,
    frames: status === "ready" ? urls.map((url, i) => ({ url, cdnKey: `k${i}` })) : undefined,
  };
}
function videoTask(id: string, created: string, url: string | null, status = "ready", shot = "s1"): DramaRenderTask {
  return { id, task_type: "video", name: "视频", status, shot_id: shot, episode_no: EP, created_at: created, video_url: url };
}
const plan = (shot: RecoverableShot, tasks: DramaRenderTask[]) => planShotRecovery([shot], tasks, EP);

describe("视频任务对账", () => {
  it("任务已受理、任务号没存下来就刷新：按 resetAt 之后的任务找回（EP1 回归）", () => {
    const shot: RecoverableShot = { id: "s1", frameUrl: "/cdn/f1.png", frameUrls: ["/cdn/f1.png"], resetAt: T8(0) };
    const tasks = [videoTask("B", T(3), "/cdn/v-b.mp4"), frameTask("F1", T8(0), ["/cdn/f1.png"])];
    expect(plan(shot, tasks).videos.get("s1")?.id).toBe("B");
  });

  it("从头重做出了新首帧之后，旧视频任务不会被填回来", () => {
    // resetAt = 新首帧任务 F2 的创建时间；旧视频 A 在它之前
    const shot: RecoverableShot = { id: "s1", frameUrls: ["/cdn/f2.png"], frameUrl: "/cdn/f2.png", resetAt: T(10) };
    const tasks = [frameTask("F2", T(10), ["/cdn/f2.png"]), videoTask("A", T(5), "/cdn/v-a.mp4"), frameTask("F1", T(1), ["/cdn/f1.png"])];
    const p = plan(shot, tasks);
    expect(p.videos.has("s1")).toBe(false);
    expect(p.frames.has("s1")).toBe(false);
  });

  it("重新生成视频、新任务号没存下来就刷新：比记着的 jobId 新的那条照样认", () => {
    const shot: RecoverableShot = { id: "s1", jobId: "A", videoUrl: "/cdn/v-a.mp4", frameUrls: ["/cdn/f1.png"], resetAt: T(0) };
    const tasks = [videoTask("B", T(8), "/cdn/v-b.mp4"), videoTask("A", T(4), "/cdn/v-a.mp4"), frameTask("F1", T(0), ["/cdn/f1.png"])];
    expect(plan(shot, tasks).videos.get("s1")?.id).toBe("B");
  });

  it("最新一条还在跑或失败了：不拿更早的成功任务覆盖", () => {
    const shot: RecoverableShot = { id: "s1", jobId: "A", videoUrl: "/cdn/v-a.mp4", resetAt: T(0) };
    const failed = [videoTask("B", T(8), null, "failed"), videoTask("A", T(4), "/cdn/v-a.mp4")];
    expect(plan(shot, failed).videos.has("s1")).toBe(false);
    const running = [videoTask("B", T(8), null, "running"), videoTask("A", T(4), "/cdn/v-a.mp4")];
    const p = plan(shot, running);
    expect(p.videos.has("s1")).toBe(false);
    expect(p.active.get("s1")).toEqual({ kind: "clip", taskId: "B" });
  });

  it("签名地址重签过（query 不同）不算新视频，不会每轮都重新填一次", () => {
    const shot: RecoverableShot = { id: "s1", jobId: "A", videoUrl: "https://cdn.x.cn/media/v-a.mp4?auth_key=1-aaa", resetAt: T(0) };
    const tasks = [videoTask("A", T(4), "https://cdn.x.cn/media/v-a.mp4?auth_key=2-bbb")];
    expect(plan(shot, tasks).videos.has("s1")).toBe(false);
  });

  it("老数据没有 resetAt：用当前首帧出自的那次首帧任务当分界；连首帧都没有就不猜", () => {
    const withFrame: RecoverableShot = { id: "s1", frameUrls: ["/cdn/f1.png?sig=new"] };
    const tasks = [videoTask("B", T(6), "/cdn/v-b.mp4"), frameTask("F1", T(2), ["/cdn/f1.png?sig=old"]), videoTask("A", T(1), "/cdn/v-a.mp4")];
    expect(plan(withFrame, tasks).videos.get("s1")?.id).toBe("B");
    const draft: RecoverableShot = { id: "s1" };
    expect(plan(draft, [videoTask("A", T(1), "/cdn/v-a.mp4")]).videos.has("s1")).toBe(false);
  });

  it("jobId 那条已不在列表里：退回按 resetAt 认", () => {
    const shot: RecoverableShot = { id: "s1", jobId: "GONE", resetAt: T(3) };
    const tasks = [videoTask("B", T(5), "/cdn/v-b.mp4"), videoTask("OLD", T(1), "/cdn/v-old.mp4")];
    expect(plan(shot, tasks).videos.get("s1")?.id).toBe("B");
  });
});

describe("首帧任务对账", () => {
  it("从头重做的新首帧刷新后也能回来（之后由 applyFrameResult 清掉旧视频和尾帧）", () => {
    const shot: RecoverableShot = { id: "s1", jobId: "A", videoUrl: "/cdn/v-a.mp4", frameUrls: ["/cdn/f1.png"], resetAt: T(0) };
    const tasks = [frameTask("F2", T(9), ["/cdn/f2a.png", "/cdn/f2b.png"]), videoTask("A", T(4), "/cdn/v-a.mp4"), frameTask("F1", T(0), ["/cdn/f1.png"])];
    const p = plan(shot, tasks);
    expect(p.frames.get("s1")?.id).toBe("F2");
    expect(p.videos.has("s1")).toBe(false); // 旧视频 A 早于新首帧，不填
  });

  it("同一轮：填回新首帧的同时，比它晚、已经成功的视频一起填回（不等下一轮 —— 没在跑的任务时没有下一轮）", () => {
    // 文档还是旧首帧（保存失败 / 别的标签页用旧状态覆盖了），列表里新首帧和之后的视频都好了
    const shot: RecoverableShot = { id: "s1", frameUrls: ["/cdn/f1.png"], frameUrl: "/cdn/f1.png", resetAt: T(0) };
    const tasks = [videoTask("V2", T(12), "/cdn/v2.mp4"), frameTask("F2", T(9), ["/cdn/f2a.png"]), videoTask("A", T(4), "/cdn/v-a.mp4")];
    const p = plan(shot, tasks);
    expect(p.frames.get("s1")?.id).toBe("F2");
    expect(p.videos.get("s1")?.id).toBe("V2");
    expect(p.active.has("s1")).toBe(false);
  });

  it("afterFrameRestore 和首帧回填同一套：换首帧、清旧视频和任务号、分界只往后挪", () => {
    const shot: RecoverableShot = { id: "s1", jobId: "A", videoUrl: "/cdn/v-a.mp4", frameUrls: ["/cdn/f1.png"], resetAt: T(20) };
    const after = afterFrameRestore(shot, frameTask("F2", T(9), ["/cdn/f2a.png", "/cdn/f2b.png"]));
    expect(after.frameUrls).toEqual(["/cdn/f2a.png", "/cdn/f2b.png"]);
    expect(after.frameUrl).toBe("/cdn/f2a.png");
    expect(after.videoUrl).toBeUndefined();
    expect(after.jobId).toBeUndefined();
    expect(after.resetAt).toBe(T(20)); // 首帧任务比分界早：分界不往回挪
    expect(afterFrameRestore({ id: "s1", resetAt: T(1) }, frameTask("F3", T(30), ["/x.png"])).resetAt).toBe(T(30));
  });

  it("AI 改过的首帧不会被原来那次首帧任务盖回去", () => {
    const shot: RecoverableShot = { id: "s1", frameUrls: ["/cdn/edited.png"], frameUrl: "/cdn/edited.png", resetAt: T(0) };
    expect(plan(shot, [frameTask("F1", T(0), ["/cdn/f1.png"])]).frames.has("s1")).toBe(false);
  });

  it("挑了两张里的另一张，不算要重新填", () => {
    const shot: RecoverableShot = { id: "s1", frameUrls: ["/cdn/a.png", "/cdn/b.png"], frameUrl: "/cdn/b.png", resetAt: T(0) };
    expect(plan(shot, [frameTask("F1", T(0), ["/cdn/a.png", "/cdn/b.png"])]).frames.has("s1")).toBe(false);
  });
});

describe("重写本集后新镜头和旧镜头同 id", () => {
  it("旧镜头的首帧 / 视频任务都不会填进新镜头", () => {
    const old = [videoTask("A", T(2), "/cdn/v-a.mp4"), frameTask("F1", T(1), ["/cdn/f1.png"])];
    const mark = resetMarkForNewShots(old, T(30));
    const fresh: RecoverableShot = { id: "s1", resetAt: mark };
    const p = plan(fresh, old);
    expect(p.frames.has("s1")).toBe(false);
    expect(p.videos.has("s1")).toBe(false);
    // 之后在新镜头上提交的任务照常认
    const later = [...old, frameTask("F3", T(40), ["/cdn/f3.png"])];
    expect(plan(fresh, later).frames.get("s1")?.id).toBe("F3");
  });

  it("还有旧任务在跑：新镜头不挂「生成中」（那是旧镜头的任务），结果也不会填进来", () => {
    const running = [videoTask("A", T(2), null, "running")];
    const fresh: RecoverableShot = { id: "s1", resetAt: resetMarkForNewShots(running, T(30)) };
    const p = plan(fresh, running);
    expect(p.active.has("s1")).toBe(false);
    const done = [videoTask("A", T(2), "/cdn/v-a.mp4")];
    expect(plan(fresh, done).videos.has("s1")).toBe(false);
    // 新镜头自己提交的任务照常算生成中
    const mine = [...running, frameTask("F9", T(40), [], "running")];
    expect(plan(fresh, mine).active.get("s1")).toEqual({ kind: "frame", taskId: "F9" });
  });

  it("连分界都没有的老镜头（没 resetAt、也没首帧）：有在跑的就算生成中（宁可多挡一次也不重复扣费）", () => {
    const legacy: RecoverableShot = { id: "s1" };
    expect(plan(legacy, [videoTask("A", T(2), null, "running")]).active.get("s1")).toEqual({ kind: "clip", taskId: "A" });
  });
});

describe("其它", () => {
  it("别的集的任务不看", () => {
    const shot: RecoverableShot = { id: "s1", resetAt: T(0) };
    const other = { ...videoTask("B", T(5), "/cdn/v-b.mp4"), episode_no: 2 };
    expect(plan(shot, [other]).videos.has("s1")).toBe(false);
  });

  it("resetMarkForNewShots：列表没拉到用当前时间；拉到了为空用 EPOCH；否则取最新的 created_at", () => {
    expect(resetMarkForNewShots(null, "NOW")).toBe("NOW");
    expect(resetMarkForNewShots([], "NOW")).toBe(EPOCH_ISO);
    // +08:00 与 Z 混排也按真实先后取
    expect(resetMarkForNewShots([videoTask("a", T(5), null), frameTask("b", T8(7), [])], "NOW")).toBe(T8(7));
  });

  it("laterIso 取晚的那个（Z 与 +08:00 混排按真实先后），缺一个取另一个", () => {
    expect(laterIso(T(1), T8(2))).toBe(T8(2));
    expect(laterIso(T8(5), T(2))).toBe(T8(5));
    expect(laterIso(undefined, T(3))).toBe(T(3));
    expect(laterIso(T(3), null)).toBe(T(3));
    expect(laterIso(undefined, undefined)).toBeUndefined();
  });

  it("lastFrameOf：单任务查询在顶层，任务列表里只在 source 里（DramaFrameJobService.toVideoTask）", () => {
    expect(lastFrameOf({ last_frame_url: "/cdn/a.png" })).toBe("/cdn/a.png");
    expect(lastFrameOf({ source: { last_frame_url: "/cdn/b.png" } })).toBe("/cdn/b.png");
    expect(lastFrameOf({})).toBeUndefined();
  });

  it("sameAsset 只比路径（签名 query 不同算同一个文件）", () => {
    expect(sameAsset("https://c.cn/a/b.png?x=1", "https://c.cn/a/b.png?x=2")).toBe(true);
    expect(sameAsset("/cdn/a.png", "/cdn/b.png")).toBe(false);
    expect(sameAsset(undefined, "/cdn/a.png")).toBe(false);
  });
});
