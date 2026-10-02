// ─────────────────────────────────────────────────────────────────────────────
// shorts/make/shot-run.ts — 短视频制作页「逐镜生成」的状态规则（纯函数，页面与单测共用）。
//
// 这里的每一条都对应一次评审确认过的扣费 / 覆盖事故，改之前先看注释里的「为什么」：
//   · 在途镜头（有 pendingJob，或当前正在提交 / 轮询的那一镜）不能再提交：服务端每次
//     提交都新建任务、独立冻结积分，没有按镜头去重（MaterialVideoJobService.createJob）。
//   · 「有视频」只认 flow 为 clip / done 的那条：重出首帧后旧视频已经作废（v0.197 前会
//     残留 videoUrl，被批量生成跳过、又被「全部就用这版」重新确认）。
//   · 批量一轮只要离开页面 / 卸载 / 点停止，就不再提交下一镜（此前只有「停止」按钮会停）。
//   · AI 改图的结果可能晚到（弹窗关了请求照跑）：那时这一镜要是已经有任务在跑或有了视频，
//     改好的图只换首帧，**不清任务号、不动视频**（frameEditPatch）。此前一律按「首帧换了」清掉，
//     在途视频的任务号跟着没了：结果回来被当成旧结果丢掉，批量又把这一镜标成「就用这版」而它没有视频。
// ─────────────────────────────────────────────────────────────────────────────
import type { FormShot } from "@/components/drama-workshop/shot-form";

/** 已提交、还没回填的后台任务（随草稿落库，回到本页对账）。 */
export interface PendingJob {
  jobId: string;
  kind: "frame" | "clip";
}

/** 这些规则只看镜头的这几个字段。 */
export type RunShot = Pick<FormShot, "id" | "flow" | "videoUrl"> & { pendingJob?: PendingJob };

/** 这一镜手上有一条「当前首帧对应的」视频（旧首帧留下的视频不算）。 */
export function hasCurrentVideo(s: RunShot): boolean {
  return !!s.videoUrl && (s.flow === "clip" || s.flow === "done");
}

/** 这一镜有任务在跑：已提交没回填（pendingJob），或页面正在提交 / 等它（busyId）。 */
export function isInFlight(s: RunShot, busyId?: string | null): boolean {
  return !!s.pendingJob || (!!busyId && busyId === s.id);
}

/** 「剩下的镜头一起生成」要处理的镜：没有当前视频、也没有任务在跑。 */
export function batchTargets<T extends RunShot>(shots: T[], busyId?: string | null): T[] {
  return shots.filter((s) => !hasCurrentVideo(s) && !isInFlight(s, busyId));
}

/** 能一键标成「就用这版」的镜：刚生成好待确认（flow=clip + 有视频），且没有新任务在跑。 */
export function approvableIds(shots: RunShot[], busyId?: string | null): string[] {
  return shots.filter((s) => s.flow === "clip" && !!s.videoUrl && !isInFlight(s, busyId)).map((s) => s.id);
}

/** 按镜累加报价（每镜时长 / 所选模型都可能不同，不能用「镜数 × 单价」）。 */
export function sumCost<T>(shots: T[], costOf: (s: T) => number): number {
  return shots.reduce((acc, s) => acc + Math.max(0, costOf(s)), 0);
}

/**
 * 首帧（重新）生成成功后的回填。首帧换了，照旧首帧做出来的视频、尾帧、动作描述都作废，
 * 连同它们的任务号一起清掉 —— jobId 留着的话，对账会把旧视频填回来。
 * 正常轮询、回到页面续轮询、进页对账三条路径都用这一个函数（§8.0.1 ④：规则只写一遍）。
 */
export function freshFramePatch(frameUrls: string[], appliedRefs?: FormShot["appliedRefs"]) {
  return {
    flow: "frame" as const,
    frameUrls,
    frameUrl: frameUrls[0],
    appliedRefs,
    videoUrl: undefined,
    jobId: undefined,
    lastFrameUrl: undefined,
    endFrameUrl: undefined,
    ffDesc: undefined,
    lfDesc: undefined,
    motionDesc: undefined,
    variationType: undefined,
    pendingJob: undefined,
  } satisfies Partial<FormShot> & { pendingJob?: PendingJob };
}

/**
 * AI 改图成功后的回填。改图弹窗只在「没视频、没任务在跑」的镜上打得开，所以正常情况下就是换了首帧，
 * 走 freshFramePatch。但请求发出去之后弹窗可以关、页面照常能点：等结果回来时这一镜可能已经在生成视频
 * （单镜或批量轮到它）、甚至已经有了新视频。这时它是**晚到的旧操作**，只能换首帧图：
 *   · 在途任务的任务号留着 —— 清掉的话结果回来会被当成旧结果丢掉，轮询超时后连对账都没处对；
 *   · 已有的视频留着 —— 那是用户在改图之后才点的，也花了积分。
 * 想按新首帧出视频，点「重新生成」（它带的是当前首帧）。
 */
export function frameEditPatch(shot: RunShot, frameUrl: string, busyId?: string | null) {
  if (isInFlight(shot, busyId) || hasCurrentVideo(shot)) {
    return { late: true as const, patch: { frameUrl, frameUrls: [frameUrl] } satisfies Partial<FormShot> };
  }
  return { late: false as const, patch: freshFramePatch([frameUrl]) };
}

/**
 * 离开页面之后才拿到的任务号（提交请求返回得比离开晚），能不能补记到这一镜上：
 * 这一镜还在、手上没有别的任务、没有当前视频、也不是已经回填过的那条（clipResultPatch 会把 jobId 留在镜上）。
 * 不满足就不补 —— 补上去会让已经对过账的镜再对一次，或者盖掉新提交的那条任务号。
 */
export function canAdoptLateJob(s: RunShot & { jobId?: string }, pj: PendingJob): boolean {
  return !s.pendingJob && !hasCurrentVideo(s) && s.jobId !== pj.jobId;
}

/** 视频生成成功后的回填（待确认，flow=clip）。 */
export function clipResultPatch(jobId: string, videoUrl: string | undefined, appliedRefs?: FormShot["appliedRefs"]) {
  return {
    flow: "clip" as const,
    videoUrl,
    jobId,
    appliedRefs,
    pendingJob: undefined,
  } satisfies Partial<FormShot> & { pendingJob?: PendingJob };
}

/**
 * 批量一轮的开关。begin() 开一轮拿令牌；stop()（点停止 / 离开页面）让当前这一轮在下一镜之前停下；
 * dispose()（组件卸载）之后任何一轮都不再有效，哪怕确认框是在卸载之后才点的「开始」。
 */
export interface RunGate {
  begin(): number;
  stop(): void;
  dispose(): void;
  isLive(token: number): boolean;
  readonly stopped: boolean;
}

export function createRunGate(): RunGate {
  let current = 0;
  let stopped = false;
  let disposed = false;
  return {
    begin() {
      stopped = false;
      current += 1;
      return current;
    },
    stop() {
      stopped = true;
    },
    dispose() {
      disposed = true;
      stopped = true;
    },
    isLive(token: number) {
      return !disposed && !stopped && token === current;
    },
    get stopped() {
      return stopped || disposed;
    },
  };
}

/**
 * 单镜生成的结果。stale = 等到了结果，但这一镜在等的时候被删了 / 任务号被换了，结果没落到镜上
 * （settleJob 判旧）—— 它不是 done：批量不能把这一镜算成生成好、更不能标「就用这版」。
 */
export type ShotRunResult = "done" | "failed" | "pending" | "stale";

export interface BatchOutcome<T> {
  /** all=全部生成好；stopped=停下了（停止 / 离开）；pending=某镜转到后台；failed=某镜没成。 */
  outcome: "all" | "stopped" | "pending" | "failed";
  done: number;
  /** pending / failed 时是哪一镜。 */
  at?: T;
}

/**
 * 依次给 targets 生成视频。每一镜提交之前都检查两件事：这一轮还有效（没停、没离开），
 * 这一镜此刻仍然需要生成（stillNeeded 读最新状态：可能已被后台任务回填、正在跑，或被删了）。
 * 不需要的镜跳过、不提交；这一轮失效就停，已经受理的任务留给下次进页对账。
 */
export async function runBatch<T extends { id: string }>(opts: {
  targets: T[];
  gate: RunGate;
  token: number;
  stillNeeded: (id: string) => boolean;
  renderOne: (s: T) => Promise<ShotRunResult>;
  onShotDone?: (s: T, done: number) => void;
}): Promise<BatchOutcome<T>> {
  let done = 0;
  for (const s of opts.targets) {
    if (!opts.gate.isLive(opts.token)) return { outcome: "stopped", done };
    if (!opts.stillNeeded(s.id)) continue;
    const r = await opts.renderOne(s);
    if (r === "pending") return { outcome: "pending", done, at: s };
    if (r === "failed") return { outcome: "failed", done, at: s };
    if (r === "stale") continue; // 结果没落到这一镜上：不算生成好，也不回调 onShotDone
    done += 1;
    opts.onShotDone?.(s, done);
  }
  return { outcome: "all", done };
}
