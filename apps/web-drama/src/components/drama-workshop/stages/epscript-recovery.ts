// ─────────────────────────────────────────────────────────────────────────────
// epscript-recovery.ts — 分镜表「后台任务对账」：刷新 / 回到页面时，哪条后台任务该填回哪一镜。
//
// 为什么单独一个文件：这段判断错一次，要么把旧视频填回刚重做过的镜头（用户白花了重做的钱），
// 要么已经生成好的视频永远填不回来（用户以为没生成，再点一次又扣一次）。纯函数 + 单测钉住。
//
// 依据（都是服务端时间，不用浏览器时钟比先后）：
// - 镜头上的 `jobId`：这一镜记着的视频任务。它只在「提交成功、拿到回执」之后才落库。
// - 镜头上的 `resetAt`：这一镜「从这之后创建的任务才算数」的分界。出新首帧时 = 那次首帧任务的
//   created_at；AI 重写 / 拆分镜 / 加一镜时 = 当时已知任务里最新的 created_at（镜头 id 是
//   `sc_<集>_<场>_s<镜>` 这种确定值，重写本集后新镜头会和旧镜头同 id，旧任务必须挡在外面）。
// - 任务的 `created_at`：服务端写的。
//
// 规则：
// 视频 ——
//   ① 镜头记着 jobId、且那条任务还在列表里：只认它和它之后这一镜新提交的任务（「重新生成视频」
//      时新任务号还没存下来就刷新，新任务比旧 jobId 新，照样认）；取最新一条，成功了才填。
//   ② 没有 jobId（任务已受理、回执没存下来就刷新）或 jobId 那条已不在列表里：只认 resetAt 之后
//      创建的任务，取最新一条，成功了才填。
//   ③ 老数据没有 resetAt：用「当前首帧是哪次首帧任务出的」那条任务的 created_at 当分界；
//      连这个也找不到（没首帧的老镜头）就不猜，宁可不填也不把别的视频填进来。
//   最新一条还在跑 / 失败了 → 不填更早的（更早的已经被它取代了）。
// 首帧 ——
//   取这一镜最新的首帧任务，成功了、且比 resetAt 新才填（「从头重做」出的新首帧刷新后也能回来）；
//   它的图已经在镜头上（挑过其中一张也算）就不动。AI 改图是同步出图、不产生任务，所以改过的首帧
//   不会被原来那次首帧任务覆盖回去（那次任务的 created_at 就等于 resetAt，不「比它新」）。
//   同一轮先填了首帧的镜头，按「填完首帧之后」的样子（afterFrameRestore）再算一次视频：比新首帧晚、
//   已经成功的视频这一轮一起填。以前是「下一轮再算」，可这一镜没有在跑的任务时根本没有下一轮，
//   用户看到新首帧没视频，会再点一次、再扣一次。
// 「生成中」（active）：这一镜分界之后创建的、还在跑的任务。分界之前的是旧镜头的（重写本集后新镜头和
//   旧镜头同 id），不能让新镜头一直挂着「生成中」。连分界都没有的老镜头（没 resetAt、也没首帧）照旧
//   只要有在跑的就算 —— 宁可多挡一次，也不放一次重复扣费。
// ─────────────────────────────────────────────────────────────────────────────
import type { DramaRenderTask, RenderedFrame } from "@/api/render";

/** 对账只需要镜头的这几项（FormShot 的子集）。 */
export interface RecoverableShot {
  id: string;
  jobId?: string;
  videoUrl?: string;
  frameUrl?: string;
  frameUrls?: string[];
  /** 从这之后创建的任务才算这一镜的（服务端时间 ISO）。老数据没有。 */
  resetAt?: string;
}

export interface RecoveryPlan {
  /** 要填回的首帧任务（按镜头 id）。 */
  frames: Map<string, DramaRenderTask>;
  /**
   * 要填回的视频任务（按镜头 id）。同一镜这一轮也要填首帧时，是按填完首帧之后的状态算的：
   * 调用方要先填首帧、再填视频（首帧回填会清掉旧视频）。
   */
  videos: Map<string, DramaRenderTask>;
  /** 还有任务在跑的镜头 → 显示「生成中」、按钮不可点。taskId 给调用方记进在途表（挡重复提交）。 */
  active: Map<string, { kind: "frame" | "clip"; taskId: string }>;
}

/** 分界时间：一个早于任何任务的值（镜头新建时列表里一条任务都没有）。 */
export const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

function at(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** 两个 ISO 时间里晚的那个（原样返回那个字符串）。分界只往后挪，不往回挪。 */
export function laterIso(a?: string | null, b?: string | null): string | undefined {
  const ta = at(a);
  const tb = at(b);
  if (ta == null) return tb == null ? undefined : b!;
  if (tb == null) return a!;
  return tb > ta ? b! : a!;
}

/** 按 created_at 从新到旧（服务端按字符串排序，frame / video 两种时间格式混排时不可靠，这里按时间重排）。 */
function newestFirst(tasks: DramaRenderTask[]): DramaRenderTask[] {
  return [...tasks].sort((a, b) => (at(b.created_at) ?? -Infinity) - (at(a.created_at) ?? -Infinity));
}

function framesOf(t: DramaRenderTask): RenderedFrame[] {
  return t.frames ?? t.result?.frames ?? [];
}

/** 两个地址是不是同一个文件：签名地址每次重签 query 都不一样，只比路径。data: 地址整串比。 */
export function sameAsset(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith("data:") || b.startsWith("data:")) return false;
  const path = (u: string) => {
    try {
      return new URL(u, "http://local").pathname;
    } catch {
      return u.split(/[?#]/)[0];
    }
  };
  return path(a) === path(b);
}

function currentFrames(shot: RecoverableShot): string[] {
  if (shot.frameUrls?.length) return shot.frameUrls;
  return shot.frameUrl ? [shot.frameUrl] : [];
}

function hasFrameOf(shot: RecoverableShot, task: DramaRenderTask): boolean {
  const cur = currentFrames(shot);
  return framesOf(task).some((f) => cur.some((c) => sameAsset(c, f.url)));
}

/** 这一镜的分界：resetAt；老数据退到「当前首帧出自哪次首帧任务」。都没有 → null（不猜）。 */
function lineageFloor(shot: RecoverableShot, frameTasks: DramaRenderTask[]): number | null {
  const reset = at(shot.resetAt);
  if (reset != null) return reset;
  const own = frameTasks.find((t) => hasFrameOf(shot, t));
  return own ? at(own.created_at) : null;
}

/**
 * 首帧任务填回之后镜头的样子（和 epscript.tsx applyFrameResult 的补丁同一套）：换上新首帧、
 * 清掉旧视频和任务号、分界挪到这次首帧任务的创建时间（只往后挪）。
 */
export function afterFrameRestore<S extends RecoverableShot>(shot: S, task: DramaRenderTask): S {
  const urls = framesOf(task).map((f) => f.url);
  return {
    ...shot,
    frameUrls: urls,
    frameUrl: urls[0],
    videoUrl: undefined,
    jobId: undefined,
    resetAt: laterIso(shot.resetAt, task.created_at) ?? shot.resetAt,
  } as S;
}

/**
 * 视频任务的真实末帧。/render/tasks 列表里视频的 last_frame_url 只在嵌套的 source 里
 * （DramaFrameJobService.toVideoTask 原样挂了 MaterialVideoJob 的卡片），单任务查询在顶层。
 * 两处都看，否则刷新后找回的视频没有末帧，下一镜只能拿这一镜的首帧去接。
 */
export function lastFrameOf(task: {
  last_frame_url?: string | null;
  source?: { last_frame_url?: string | null } | null;
}): string | undefined {
  return task.last_frame_url || task.source?.last_frame_url || undefined;
}

export function pickFrameToRestore(shot: RecoverableShot, tasks: DramaRenderTask[]): DramaRenderTask | null {
  const frameTasks = newestFirst(tasks.filter((t) => t.task_type === "frame"));
  const latest = frameTasks[0];
  if (!latest || latest.status !== "ready" || framesOf(latest).length === 0) return null;
  if (hasFrameOf(shot, latest)) return null; // 已经是它（或挑过它的其中一张）
  const latestAt = at(latest.created_at);
  const reset = at(shot.resetAt);
  if (reset != null) return latestAt != null && latestAt > reset ? latest : null;
  // 老数据：当前首帧出自哪条任务，比它新才填；镜头还没首帧 → 照旧填（以前就是这么恢复的）。
  if (currentFrames(shot).length === 0) return latest;
  const own = frameTasks.find((t) => hasFrameOf(shot, t));
  const ownAt = own ? at(own.created_at) : null;
  return ownAt != null && latestAt != null && latestAt > ownAt ? latest : null;
}

export function pickVideoToRestore(shot: RecoverableShot, tasks: DramaRenderTask[]): DramaRenderTask | null {
  const videos = newestFirst(tasks.filter((t) => t.task_type === "video"));
  if (videos.length === 0) return null;
  const own = shot.jobId ? videos.find((t) => t.id === shot.jobId) : undefined;
  let candidates: DramaRenderTask[];
  if (own) {
    const ownAt = at(own.created_at);
    candidates = videos.filter((t) => t === own || (ownAt != null && (at(t.created_at) ?? -Infinity) > ownAt));
  } else {
    const floor = lineageFloor(shot, tasks.filter((t) => t.task_type === "frame"));
    if (floor == null) return null;
    candidates = videos.filter((t) => (at(t.created_at) ?? -Infinity) > floor);
  }
  const latest = candidates[0];
  if (!latest || latest.status !== "ready" || !latest.video_url) return null;
  if (latest.id === shot.jobId && sameAsset(latest.video_url, shot.videoUrl)) return null;
  return latest;
}

const isActive = (t: DramaRenderTask) => t.status === "queued" || t.status === "running" || t.status === "rendering";

/**
 * 一次对账：tasks 是 /me/drama/render/tasks 的整张列表，shots 是本集全部镜头。
 * 其它集的任务（episode_no 不等于本集）不看。
 */
export function planShotRecovery(shots: RecoverableShot[], tasks: DramaRenderTask[], ep: number): RecoveryPlan {
  const byShot = new Map<string, DramaRenderTask[]>();
  for (const t of tasks) {
    if (!t.shot_id) continue;
    if (t.episode_no && t.episode_no !== ep) continue;
    const list = byShot.get(t.shot_id);
    if (list) list.push(t);
    else byShot.set(t.shot_id, [t]);
  }
  const plan: RecoveryPlan = { frames: new Map(), videos: new Map(), active: new Map() };
  for (const shot of shots) {
    const mine = byShot.get(shot.id);
    if (!mine) continue;
    const floor = lineageFloor(shot, mine.filter((t) => t.task_type === "frame"));
    const running = newestFirst(mine).find((t) => isActive(t) && belongsTo(shot, t, floor));
    if (running) plan.active.set(shot.id, { kind: running.task_type === "frame" ? "frame" : "clip", taskId: running.id });
    const frame = pickFrameToRestore(shot, mine);
    if (frame) plan.frames.set(shot.id, frame);
    const video = pickVideoToRestore(frame ? afterFrameRestore(shot, frame) : shot, mine);
    if (video) plan.videos.set(shot.id, video);
  }
  return plan;
}

/** 在跑的任务算不算这一镜的：这一镜记着的任务号；或分界之后创建的；没分界 / 没时间的一律算（防重复扣费）。 */
function belongsTo(shot: RecoverableShot, t: DramaRenderTask, floor: number | null): boolean {
  if (floor == null || t.id === shot.jobId) return true;
  const created = at(t.created_at);
  return created == null || created > floor;
}

/**
 * 新镜头（AI 重写本集 / 拆分镜 / 加一镜）的 resetAt：当时已知任务里最新的 created_at。
 * 新镜头可能和旧镜头同 id，这之前创建的任务都是旧镜头的。
 * 列表还没拉到（null）→ 只能用浏览器时间；拉到了但一条任务都没有 → EPOCH（之后的任务都算）。
 */
export function resetMarkForNewShots(knownTasks: DramaRenderTask[] | null, nowIso: string): string {
  if (!knownTasks) return nowIso;
  let best: { t: number; iso: string } | null = null;
  for (const task of knownTasks) {
    const t = at(task.created_at);
    if (t != null && (!best || t > best.t)) best = { t, iso: task.created_at! };
  }
  return best?.iso ?? EPOCH_ISO;
}
