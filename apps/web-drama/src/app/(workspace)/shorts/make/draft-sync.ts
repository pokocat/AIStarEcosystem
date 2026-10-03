// ─────────────────────────────────────────────────────────────────────────────
// shorts/make/draft-sync.ts — 同一条短视频草稿的读写排队 + 离开页面后才拿到的任务号。
//
// 为什么要有它（评审确认过的覆盖竞态）：服务端 PUT /me/drama/shorts/{id} 整份替换 payload、没有版本比较
// （DramaShortService.save），前端却有好几条互不相等的整份保存：防抖自动保存、卸载时补存、
// 提交请求在离页之后才返回时补记任务号。它们各发各的，谁后到谁赢：
//   ① 点生成后立刻离页：卸载补存（没有任务号）和补记任务号（有）同时在路上，前者后到 → 任务号没了；
//   ② 离页后很快又打开这条草稿接着改：旧页面迟到的补存把新页面已经存下的编辑整份盖掉，
//      而新页面手上没有那个任务号，它下一次自动保存又把任务号冲掉。
//
// 这里做三件事：
//   · enqueue：同一条草稿的读写按调用顺序一个接一个发（站内离开再进来还是同一个 JS 运行时，旧页面
//     排着的保存一定先于新页面的读取落库，新页面读到的就是最新的）；
//   · reportLateJob：迟到的任务号**不再整份保存旧页面的快照**，只补这一镜的 pendingJob ——
//     这条草稿正开着就交给开着的那个页面（它自己会立刻落库），没开着就排队「读最新 → 只改这一镜 → 存」；
//   · subscribe：制作页挂载时认领还没交出去的任务号（打开得比补记早也不会漏）。
//
// 跨标签页 / 跨设备仍然是「后存的赢」：那需要服务端给草稿加版本号，前端这里做不到（见 TODO.md）。
// ─────────────────────────────────────────────────────────────────────────────
import type { ShortDraftData, ShortDraftDetail } from "@/api/shorts";
import { canAdoptLateJob, type PendingJob } from "./shot-run";

export interface DraftSyncApi {
  getDraft: (id: string) => Promise<ShortDraftDetail>;
  saveDraft: (id: string, data: ShortDraftData, opts?: { status?: "draft" | "done" }) => Promise<unknown>;
}

export type LateJobListener = (shotId: string, pj: PendingJob) => void;

export interface DraftSync {
  /** 排进这条草稿的读写队列：前面的（不论成败）结束了才发这一个。返回的就是 run 的结果。 */
  enqueue<T>(draftId: string, run: () => Promise<T>): Promise<T>;
  /** 页面已经离开之后才拿到的任务号。返回的 Promise 只为测试用，调用方不用等。 */
  reportLateJob(draftId: string, shotId: string, pj: PendingJob): Promise<void>;
  /** 制作页挂载时调用：先把还没交出去的任务号交给它，之后再有迟到的直接交它。返回退订函数。 */
  subscribe(draftId: string, listener: LateJobListener): () => void;
}

export function createDraftSync(api: DraftSyncApi): DraftSync {
  const chains = new Map<string, Promise<void>>();
  const late = new Map<string, Map<string, PendingJob>>();
  const listeners = new Map<string, LateJobListener>();

  const enqueue = <T,>(draftId: string, run: () => Promise<T>): Promise<T> => {
    const prev = chains.get(draftId) ?? Promise.resolve();
    // 前一个失败不挡后一个；队尾只记「结束了」，不把失败往后传（也不留未处理的 rejection）。
    const next = prev.then(run, run);
    const tail = next.then(
      () => undefined,
      () => undefined,
    );
    chains.set(draftId, tail);
    void tail.then(() => {
      if (chains.get(draftId) === tail) chains.delete(draftId);
    });
    return next;
  };

  const deliver = (draftId: string, listener: LateJobListener) => {
    const pending = late.get(draftId);
    if (!pending) return;
    late.delete(draftId);
    for (const [shotId, pj] of pending) listener(shotId, pj);
  };

  const reportLateJob = (draftId: string, shotId: string, pj: PendingJob): Promise<void> => {
    // 先记在内存里：就算下面「读最新 → 存」失败了，这条草稿下次在本页打开时还能认领。
    const pending = late.get(draftId) ?? new Map<string, PendingJob>();
    pending.set(shotId, pj);
    late.set(draftId, pending);
    const live = listeners.get(draftId);
    if (live) {
      deliver(draftId, live);
      return Promise.resolve();
    }
    return enqueue(draftId, async () => {
      const detail = await api.getDraft(draftId);
      const shots = detail.data.shots ?? [];
      const cur = shots.find((s) => s.id === shotId);
      if (!cur || !canAdoptLateJob(cur, pj)) return;
      await api.saveDraft(
        draftId,
        { ...detail.data, shots: shots.map((s) => (s.id === shotId ? { ...s, pendingJob: pj } : s)) },
        { status: detail.meta.status === "done" ? "done" : "draft" },
      );
    }).catch(() => {
      /* 没存上：内存里还记着，下次打开这条草稿时认领 */
    });
  };

  const subscribe = (draftId: string, listener: LateJobListener) => {
    listeners.set(draftId, listener);
    deliver(draftId, listener);
    return () => {
      if (listeners.get(draftId) === listener) listeners.delete(draftId);
    };
  };

  return { enqueue, reportLateJob, subscribe };
}
