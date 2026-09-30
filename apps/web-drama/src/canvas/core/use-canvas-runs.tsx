"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/use-canvas-runs.tsx —— 所有生成的唯一入口（v0.198，契约见 contract.ts「生成」一节）。
//
// `<CanvasRunsProvider>` 挂在 CanvasDocProvider 里面（[canvasId]/layout.tsx）。画布、列表、编辑器都走
// useCanvasRuns().submit()，不许各写一份（§8.0.1 ④）。submit 的顺序：
//   1. 同一目标已经在提交中 → 直接返回那一次的 Promise（连点去重；isSubmitting(target) 给按钮禁用用）；
//      目标正被一个批量 / submitSequence 占着、或已经有受理的运行在排队 / 生成（批量里任一成员如此）→ 不发，回 rejected；
//      一批按顺序发（写全部分集、生成选中的视频）一律用 submitSequence：整批先登记，每项发前重新核对；
//   2. flush() 把文档存上 —— 服务端生成时只读**已保存的**文档（drama-canvas.ts 红线 4）；
//      没存上 / 版本冲突 → 直接返回 {ok:false}，**不发请求、不花钱**（§8.0.1 ⑨：flush 不抛，要判返回值）；
//   3. 查「未确认请求」表（pending-requests.ts）：同一目标、同样的请求体还有没确认的 → 沿用它的幂等键
//      （重试不换键；不看文档版本）；否则新键。发请求**之前**先把这一项写进表；
//   4. 拿到运行记录 → 运行引用写进文档（applyRunRef）→ 立刻保存 → 保存成功才从表里删掉这一项；
//   5. 轮询（1.5 秒一次，页面在后台时放慢）→ 到了终态 applyRunResult 合进文档 → 自动保存。
// 提交的生命周期**不跟页面走**：请求在飞时离开画布，迟到的响应照样把运行 id 写进表里；下次进页接回。
// 进页（文档 ready 后）：先按文档里所有运行引用批量接回（失败按 2s → 5s → 15s → 30s 退避重试），
// 再把表里剩下的逐项接回（有运行 id 直接查；没有就按幂等键 lookup 只查不建 —— 查不到 = 当初没受理，删掉）。
// 进页流程里**不重发任何 POST**；只有用户在会话里再次点同一个动作时才沿用原键重发（那是用户自己点的）。
// 轮询同时盯着 state 里在跑的和文档里记着「在跑」的引用（首次接回失败也不会一直转圈）。卸载时停止轮询。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { CanvasApi } from "@/api/canvas";
import { aiErrorMessage } from "@/lib/ai-error";
import { toast } from "@/lib/toast";
import { notifyWalletChanged } from "@/lib/use-wallet";
import type { CanvasRunBase, DramaCanvasRun, DramaCanvasRunKind, DramaCanvasRunTarget } from "@ai-star-eco/types/drama-canvas";
import type { CanvasDocValue, CanvasRunRequest, CanvasRunsValue, SubmitResult } from "./contract";
import { newClientRequestId } from "./ids";
import { applyRunRef, applyRunResult, collectRunRefs, isTerminalStatus, runRefAt } from "./merge";
import {
  PENDING_LOOKUP_GRACE_MS,
  patchPending,
  readPending,
  removePending,
  sigOf,
  slotOf,
  targetsOf,
  upsertPending,
} from "./pending-requests";
import { useCanvasDoc, useCanvasDocControl } from "./use-canvas-doc";

export const RUN_POLL_MS = 1500;
/** 页面在后台（切走了标签页）时放慢轮询。 */
export const RUN_POLL_HIDDEN_MS = 6000;
/** 进页接回失败后的重试间隔（最后一档封顶一直用）。 */
export const RECONNECT_DELAYS_MS = [2000, 5000, 15000, 30000];
/** 未确认表里还没着落的项（lookup 断网 / 5xx，或刚发出不久、lookup 还查不到）隔多久再查一次（只读）。 */
export const PENDING_RETRY_DELAYS_MS = [10_000, 30_000, 60_000];
const MAX_BACKOFF_MS = 20_000;
/** GET runs?ids= 一次最多带几个 id（URL 别太长）。 */
const IDS_PER_REQUEST = 40;
/** 轮询时连续几次都查不到某个运行，就当它没了（不再一直转圈）。 */
const MISSING_STRIKES = 3;

const STALE_MESSAGE = "这张画布在别的页面改过了，先载入最新的再生成。这次没有生成，也没花积分。";
const SAVE_FAILED_MESSAGE = "改动还没保存上，这次没有生成，也没花积分。等保存好再试。";
const NOT_READY_MESSAGE = "画布还没打开，等一下再试。";
const MISSING_RUN_MESSAGE = "这次生成的记录找不到了，可以重新生成。";
const READONLY_CANCEL_MESSAGE = "这张画布在别的页面改过了，先载入最新";
const BATCH_OVERLAP_MESSAGE = "有几个还在生成，等它们出完再批量";
const IN_BATCH_MESSAGE = "这一项正跟着一批一起生成，等它出完再点";
const RUNNING_MESSAGE = "这一项正在生成，等它出完再点";
const SKIP_BUSY_MESSAGE = "这一项已经在生成了，这次跳过";
const SKIP_STOPPED_MESSAGE = "前面有一项没发出去，后面的先不发";

const FAILED_TITLE: Record<DramaCanvasRunKind, string> = {
  script: "剧本没写出来",
  extract: "角色和场景没拆出来",
  image: "图没生成出来",
  storyboard: "分镜脚本没生成出来",
  video: "视频没生成出来",
  assemble: "成片没合成出来",
};

const RunsContext = React.createContext<CanvasRunsValue | null>(null);

export function useCanvasRuns(): CanvasRunsValue {
  const v = React.useContext(RunsContext);
  if (!v) throw new Error("useCanvasRuns 只能在 CanvasRunsProvider 里面用（[canvasId]/layout.tsx 挂着它）");
  return v;
}

function errorInfo(e: unknown): { code?: string; status?: number } {
  if (!e || typeof e !== "object") return {};
  const o = e as { code?: unknown; status?: unknown };
  return {
    code: typeof o.code === "string" ? o.code : undefined,
    status: typeof o.status === "number" ? o.status : undefined,
  };
}

/** 没收到回应（断网）或 5xx：服务端可能已经受理，键要留着。 */
const isUnanswered = (status: number | undefined) => status === undefined || status >= 500;

/** 按 kind 调对应接口（请求体 = 页面给的 body + core 填的幂等键和文档版本）。 */
async function callRun(canvasId: string, req: CanvasRunRequest, base: CanvasRunBase): Promise<DramaCanvasRun[]> {
  switch (req.kind) {
    case "script":
      return [await CanvasApi.runScript(canvasId, { ...req.body, ...base })];
    case "extract":
      return [await CanvasApi.runExtract(canvasId, { ...base })];
    case "image":
      return [await CanvasApi.runImage(canvasId, { ...req.body, ...base })];
    case "image-batch":
      return CanvasApi.runImageBatch(canvasId, { ...req.body, ...base });
    case "storyboard":
      return [await CanvasApi.runStoryboard(canvasId, { ...req.body, ...base })];
    case "video":
      return [await CanvasApi.runVideo(canvasId, { ...req.body, ...base })];
    case "assemble":
      return [await CanvasApi.runAssemble(canvasId, { ...req.body, ...base })];
  }
}

async function fetchRuns(canvasId: string, ids: string[]): Promise<DramaCanvasRun[]> {
  const out: DramaCanvasRun[] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    out.push(...(await CanvasApi.getRuns(canvasId, ids.slice(i, i + IDS_PER_REQUEST))));
  }
  return out;
}

// ── 模块级：提交中的请求（不跟页面走）与当前挂着的 Provider ─────────────────

/** 接回：返回运行引用有没有存上（存上了才从未确认表里删）。 */
type AttachFn = (runs: DramaCanvasRun[], opts: { clientRequestId?: string; fromReconcile?: boolean }) => Promise<boolean>;

interface InflightSubmit {
  canvasId: string;
  targets: string[];
  promise: Promise<SubmitResult>;
}

const inflight = new Map<string, InflightSubmit>();
const inflightListeners = new Set<() => void>();
let inflightVersion = 0;
/** 每张画布当前挂着的 Provider 的「接回」函数；迟到的响应交给它（没挂着就留在表里，下次进页接）。 */
const activeAttach = new Map<string, AttachFn>();
/**
 * submitSequence 一进来就把整批目标登记在这里（isSubmitting 对它们返回 true，单独点 / 别的批量都被挡住），
 * 轮到某一项时先把它从登记里拿掉再提交（这时它进了 inflight）。
 */
interface Reservation {
  canvasId: string;
  targets: Set<string>;
}
const reservations = new Set<Reservation>();

/** 某个目标此刻是不是被别的提交占着（在途的请求，或别的批次登记着）。except：自己那一批的登记不算。 */
function targetTaken(canvasId: string, target: string, except?: Reservation): "inflight" | "reserved" | null {
  for (const it of inflight.values()) if (it.canvasId === canvasId && it.targets.includes(target)) return "inflight";
  for (const r of reservations) if (r !== except && r.canvasId === canvasId && r.targets.has(target)) return "reserved";
  return null;
}

const inflightKey = (canvasId: string, slot: string) => `${canvasId}\u0000${slot}`;

function bumpInflight() {
  inflightVersion += 1;
  for (const l of [...inflightListeners]) l();
}

/** 测试用。 */
export function __resetCanvasRunsForTest(): void {
  inflight.clear();
  activeAttach.clear();
  reservations.clear();
  bumpInflight();
}

async function doSubmit(
  canvasId: string,
  req: CanvasRunRequest,
  targets: string[],
  slot: string,
  doc: CanvasDocValue,
  markStale: () => void,
): Promise<SubmitResult> {
  if (doc.status === "stale") return { ok: false, reason: "stale", message: STALE_MESSAGE };
  if (doc.status !== "ready") return { ok: false, reason: "save-failed", message: NOT_READY_MESSAGE };

  const sig = sigOf(req);
  const prev = readPending(canvasId).find((e) => e.slot === slot && e.sig === sig);
  const clientRequestId = prev?.clientRequestId ?? newClientRequestId();

  const flushed = await doc.flush();
  if (!flushed.ok) {
    return flushed.reason === "stale"
      ? { ok: false, reason: "stale", message: STALE_MESSAGE }
      : { ok: false, reason: "save-failed", message: SAVE_FAILED_MESSAGE };
  }

  // 发出去之前先记下来：之后哪一步断掉（响应丢了、页面关了、保存没成功），下次都能用原键接回
  upsertPending(canvasId, {
    clientRequestId,
    kind: req.kind,
    body: req.body,
    slot,
    sig,
    targets,
    docVersion: flushed.docVersion,
    createdAt: prev?.createdAt ?? Date.now(),
  });

  let runs: DramaCanvasRun[];
  try {
    runs = await callRun(canvasId, req, { clientRequestId, docVersion: flushed.docVersion });
  } catch (e) {
    const { code, status } = errorInfo(e);
    // 没收到回应 / 5xx：服务端可能已经受理，表里那一项留着（再点一次沿用同一个键；下次进页自动接回）
    if (!isUnanswered(status)) removePending(canvasId, clientRequestId);
    if (code === "DRAMA_CANVAS_STALE") {
      markStale();
      return { ok: false, reason: "stale", errorCode: code, message: STALE_MESSAGE };
    }
    return {
      ok: false,
      reason: "rejected",
      ...(code ? { errorCode: code } : {}),
      message: aiErrorMessage(e, status === undefined ? "网络好像断了，没确认发出去。再点一次不会重复扣积分。" : "没发出去，请重试。"),
    };
  }

  patchPending(canvasId, clientRequestId, { runIds: runs.map((r) => r.id) });
  notifyWalletChanged();
  // 页面还挂着（或已经重新挂上）→ 交给它写引用、保存、删表项；没挂着 → 留在表里，下次进页接回
  const attach = activeAttach.get(canvasId);
  if (attach) void attach(runs, { clientRequestId });
  return { ok: true, runs };
}

// ── Provider ─────────────────────────────────────────────────────────────────

interface RunState {
  byId: Record<string, DramaCanvasRun>;
  /** 每个目标最近一次运行的 id。 */
  byTarget: Record<string, string>;
}

const EMPTY_STATE: RunState = { byId: {}, byTarget: {} };

function recordRuns(state: RunState, runs: DramaCanvasRun[], opts: { latest?: boolean } = {}): RunState {
  if (!runs.length) return state;
  const byId = { ...state.byId };
  const byTarget = { ...state.byTarget };
  for (const r of runs) {
    byId[r.id] = r;
    const curId = byTarget[r.target];
    const cur = curId ? byId[curId] : undefined;
    // 新提交的一律算「最近一次」；接回 / 轮询到的按开始时间比
    if (opts.latest || !cur || cur.id === r.id || (r.createdAt ?? "") >= (cur.createdAt ?? "")) byTarget[r.target] = r.id;
  }
  return { byId, byTarget };
}

export function CanvasRunsProvider({ children }: { children: React.ReactNode }) {
  const docCtx = useCanvasDoc();
  const control = useCanvasDocControl();
  const docRef = React.useRef(docCtx);
  docRef.current = docCtx;
  const controlRef = React.useRef(control);
  controlRef.current = control;
  const { canvasId, status: docStatus, doc } = docCtx;

  const [state, setState] = React.useState<RunState>(EMPTY_STATE);
  const stateRef = React.useRef(state);
  const commit = React.useCallback((fn: (s: RunState) => RunState) => {
    const next = fn(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  /** 轮询时连续几次没查到的运行。 */
  const strikes = React.useRef(new Map<string, number>());

  // 换画布：清空
  React.useEffect(() => {
    stateRef.current = EMPTY_STATE;
    setState(EMPTY_STATE);
    strikes.current.clear();
  }, [canvasId]);

  /** 把轮询 / 取消拿到的运行合进文档（applyRunResult：只动引用还指着这次的状态，终态才合内容，幂等）。 */
  const mergeIntoDoc = React.useCallback((runs: DramaCanvasRun[]) => {
    if (!runs.length) return;
    docRef.current.update((d) => runs.reduce((acc, r) => applyRunResult(acc, r), d));
  }, []);

  /**
   * 接回刚受理（或找回来）的运行：记进 state、引用写进文档、立刻保存；保存成功才从未确认表里删掉。
   * 找回来的（fromReconcile）不盖掉文档里更新的那一次引用。
   */
  const attach = React.useCallback<AttachFn>(
    async (runs, opts) => {
      if (!runs.length) return true;
      const known = stateRef.current.byId;
      commit((s) => recordRuns(s, runs, { latest: !opts.fromReconcile }));
      docRef.current.update((d) =>
        runs.reduce((acc, r) => {
          let next = acc;
          const cur = runRefAt(acc, r.target);
          const curRun = cur && cur.runId !== r.id ? known[cur.runId] : undefined;
          const newer = !opts.fromReconcile || !cur || cur.runId === r.id || !curRun || (r.createdAt ?? "") >= (curRun.createdAt ?? "");
          if (newer) next = applyRunRef(next, r);
          return isTerminalStatus(r.status) ? applyRunResult(next, r) : next;
        }, d),
      );
      const flushed = await docRef.current.flush();
      if (flushed.ok && opts.clientRequestId) removePending(docRef.current.canvasId, opts.clientRequestId);
      return flushed.ok;
    },
    [commit],
  );

  React.useEffect(() => {
    activeAttach.set(canvasId, attach);
    return () => {
      if (activeAttach.get(canvasId) === attach) activeAttach.delete(canvasId);
    };
  }, [canvasId, attach]);

  /** 状态从「在跑」变到终态的：刷新余额（结算 / 退回），失败的弹一句原因。 */
  const announce = React.useCallback((before: RunState, runs: DramaCanvasRun[]) => {
    let walletTouched = false;
    for (const r of runs) {
      const prev = before.byId[r.id];
      if (prev && isTerminalStatus(prev.status)) continue;
      if (!isTerminalStatus(r.status)) continue;
      walletTouched = true;
      if (r.status === "failed" && r.errorCode !== "DRAMA_CANVAS_RUN_MISSING") {
        toast.error(FAILED_TITLE[r.kind] ?? "没生成出来", {
          description: r.errorMessage || "请稍后再试。没生成出来的不扣积分。",
        });
      }
    }
    if (walletTouched) notifyWalletChanged();
  }, []);

  /**
   * 未确认表里剩下的逐项接回（**只查不建，进页流程里没有任何 POST**）：有运行 id 的按 id 查；没有的按幂等键
   * lookup —— 查到就接回；查不到时，发出不到 10 分钟的先留着（原请求可能还在服务端事务里没提交），超过才删。
   * 4xx 删掉；断网 / 5xx 留着。返回还有没有没着落的项（有 → 外面隔一会儿再查一遍）。
   */
  const reconcilePending = React.useCallback(
    async (alive: () => boolean): Promise<{ unresolved: boolean }> => {
      const cid = docRef.current.canvasId;
      let unresolved = false;
      for (const e of readPending(cid)) {
        if (!alive()) return { unresolved };
        if (inflight.has(inflightKey(cid, e.slot))) continue; // 这一次还在提交中：迟到的响应会自己接回
        try {
          let runs: DramaCanvasRun[];
          if (e.runIds?.length) {
            runs = await fetchRuns(cid, e.runIds);
            if (!runs.length) {
              removePending(cid, e.clientRequestId);
              continue;
            }
          } else {
            // 只查不建：没受理过的请求绝不在这里重发（那是一笔用户没点过的扣费）
            runs = await CanvasApi.lookupRuns(cid, e.clientRequestId);
            if (!runs.length) {
              if (Date.now() - e.createdAt <= PENDING_LOOKUP_GRACE_MS) unresolved = true; // 可能还没提交：过会儿再查
              else removePending(cid, e.clientRequestId); // 过了 10 分钟还查不到 = 当初没受理，没花钱
              continue;
            }
            patchPending(cid, e.clientRequestId, { runIds: runs.map((r) => r.id) });
          }
          if (!alive()) return { unresolved };
          const saved = await attach(runs, { clientRequestId: e.clientRequestId, fromReconcile: true });
          if (!saved) unresolved = true; // 引用没存上（保存失败）：表项留着，过会儿再接
        } catch (err) {
          if (isUnanswered(errorInfo(err).status)) unresolved = true;
          else removePending(cid, e.clientRequestId);
        }
      }
      return { unresolved };
    },
    [attach],
  );

  // ── 进页：接回文档里挂着的运行 + 未确认表（失败退避重试）──────────────────
  React.useEffect(() => {
    if (docStatus !== "ready") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const run = async () => {
      try {
        const refs = collectRunRefs(docRef.current.getDoc());
        const ids = [...new Set(refs.map((r) => r.ref.runId))];
        if (ids.length) {
          const runs = await fetchRuns(canvasId, ids);
          if (!alive) return;
          const got = new Set(runs.map((r) => r.id));
          // 文档里记着「在跑」、服务端却查不到：当它没了，不然卡片一直转圈
          const lost: DramaCanvasRun[] = refs
            .filter((r) => !got.has(r.ref.runId) && !isTerminalStatus(r.ref.status))
            .map((r) => missingRun(canvasId, r.ref.runId, r.target));
          commit((s) => recordRuns(s, [...runs, ...lost]));
          mergeIntoDoc([...runs, ...lost]);
        }
        if (!alive) return;
        await pendingPass();
      } catch {
        if (!alive) return;
        const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
        attempt += 1;
        timer = setTimeout(() => void run(), delay);
      }
    };
    // 未确认表：还有没着落的就按 10s → 30s → 60s（之后一直 60s）再查（只读）
    let pendingAttempt = 0;
    const pendingPass = async () => {
      const { unresolved } = await reconcilePending(() => alive);
      if (!alive || !unresolved) return;
      const delay = PENDING_RETRY_DELAYS_MS[Math.min(pendingAttempt, PENDING_RETRY_DELAYS_MS.length - 1)];
      pendingAttempt += 1;
      timer = setTimeout(() => void pendingPass(), delay);
    };
    void run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [canvasId, docStatus, commit, mergeIntoDoc, reconcilePending]);

  // ── 轮询在跑的运行（state 里的 + 文档里记着在跑的）──────────────────────────
  const docPending = React.useMemo(
    () => collectRunRefs(doc).filter((r) => !isTerminalStatus(r.ref.status)),
    [doc],
  );
  const pendingIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const r of Object.values(state.byId)) if (!isTerminalStatus(r.status)) ids.add(r.id);
    for (const r of docPending) {
      const known = state.byId[r.ref.runId];
      if (!known || !isTerminalStatus(known.status)) ids.add(r.ref.runId);
    }
    return [...ids].sort().join(",");
  }, [state.byId, docPending]);
  const docTargetsRef = React.useRef(new Map<string, DramaCanvasRunTarget>());
  docTargetsRef.current = new Map(docPending.map((r) => [r.ref.runId, r.target]));

  React.useEffect(() => {
    if (!pendingIds || docStatus !== "ready") return;
    const ids = pendingIds.split(",");
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (stopped) return;
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const base = hidden ? RUN_POLL_HIDDEN_MS : RUN_POLL_MS;
      timer = setTimeout(tick, failures ? Math.min(MAX_BACKOFF_MS, base * 2 ** failures) : base);
    };
    const tick = async () => {
      if (stopped) return;
      try {
        const runs = await fetchRuns(canvasId, ids);
        if (stopped) return;
        failures = 0;
        const got = new Set(runs.map((r) => r.id));
        const lost: DramaCanvasRun[] = [];
        for (const id of ids) {
          if (got.has(id)) {
            strikes.current.delete(id);
            continue;
          }
          const n = (strikes.current.get(id) ?? 0) + 1;
          strikes.current.set(id, n);
          const prev = stateRef.current.byId[id];
          const target = prev?.target ?? docTargetsRef.current.get(id);
          if (n >= MISSING_STRIKES && target) {
            strikes.current.delete(id);
            lost.push(missingRun(canvasId, id, target, prev));
          }
        }
        const all = [...runs, ...lost];
        const before = stateRef.current;
        commit((s) => recordRuns(s, all));
        mergeIntoDoc(all);
        announce(before, all);
      } catch {
        failures += 1;
      }
      // 状态有变化时 pendingIds 会变、effect 重跑；没变化就接着按原节奏轮询
      schedule();
    };
    schedule();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingIds, docStatus, canvasId, commit, mergeIntoDoc, announce]);

  // ── submit / isSubmitting ─────────────────────────────────────────────────
  const inflightTick = React.useSyncExternalStore(
    (l) => {
      inflightListeners.add(l);
      return () => {
        inflightListeners.delete(l);
      };
    },
    () => inflightVersion,
    () => 0,
  );

  /** 目标此刻有没有在生成（state 里在跑，或文档里记着在跑）。 */
  const targetRunning = React.useCallback((target: string): boolean => {
    const id = stateRef.current.byTarget[target];
    const r = id ? stateRef.current.byId[id] : undefined;
    if (r && !isTerminalStatus(r.status)) return true;
    const ref = runRefAt(docRef.current.getDoc(), target);
    if (!ref || isTerminalStatus(ref.status)) return false;
    const known = stateRef.current.byId[ref.runId];
    return !known || !isTerminalStatus(known.status);
  }, []);

  const submitInternal = React.useCallback(
    (req: CanvasRunRequest, self?: Reservation): Promise<SubmitResult> => {
      const doc = docRef.current;
      const cid = doc.canvasId;
      const targets = targetsOf(req);
      const slot = slotOf(req, targets);
      const key = inflightKey(cid, slot);
      const running = inflight.get(key);
      if (running) return running.promise; // 同一目标（同一批）还在提交中：连点只发一次
      if (req.kind === "image-batch") {
        // 批量不和单条 / 别的批次重叠：任一成员在提交中、被别的批次登记着、或正在生成 → 整批不发
        if (targets.some((t) => targetTaken(cid, t, self) || targetRunning(t))) {
          return Promise.resolve({ ok: false, reason: "rejected", message: BATCH_OVERLAP_MESSAGE });
        }
      } else if (targetTaken(cid, targets[0], self)) {
        // 这一项正被一个批量请求 / 一个 submitSequence 占着：不另发（那边会发它）
        return Promise.resolve({ ok: false, reason: "rejected", message: IN_BATCH_MESSAGE });
      } else if (targetRunning(targets[0])) {
        // 已经有受理的运行在排队 / 生成（内存或文档里记着）：和批量 / sequence 对称，不再发一次
        return Promise.resolve({ ok: false, reason: "rejected", message: RUNNING_MESSAGE });
      }
      const promise = doSubmit(cid, req, targets, slot, doc, () => controlRef.current.markStale());
      inflight.set(key, { canvasId: cid, targets, promise });
      bumpInflight();
      void promise.finally(() => {
        if (inflight.get(key)?.promise === promise) {
          inflight.delete(key);
          bumpInflight();
        }
      });
      return promise;
    },
    [targetRunning],
  );

  const submit = React.useCallback((req: CanvasRunRequest) => submitInternal(req), [submitInternal]);

  const submitSequence = React.useCallback<CanvasRunsValue["submitSequence"]>(
    async (reqs, opts) => {
      const stopOnError = opts?.stopOnError ?? true;
      const cid = docRef.current.canvasId;
      const perReq = reqs.map((r) => targetsOf(r));
      // 一进来整批登记为「提交中」：轮到之前，这些目标单独点 / 别的批量都会被挡住
      const mine: Reservation = { canvasId: cid, targets: new Set(perReq.flat()) };
      reservations.add(mine);
      bumpInflight();
      const out: (SubmitResult | { ok: false; reason: "skipped"; message: string })[] = [];
      let stopped = false;
      try {
        for (let i = 0; i < reqs.length; i++) {
          const ts = perReq[i];
          for (const t of ts) mine.targets.delete(t);
          bumpInflight();
          if (stopped) {
            out.push({ ok: false, reason: "skipped", message: SKIP_STOPPED_MESSAGE });
            continue;
          }
          // 发之前重新核对：这期间它可能已经被别处提交了、或者正在生成
          if (ts.some((t) => targetTaken(cid, t, mine) || targetRunning(t))) {
            out.push({ ok: false, reason: "skipped", message: SKIP_BUSY_MESSAGE });
            continue;
          }
          const r = await submitInternal(reqs[i], mine);
          out.push(r);
          if (!r.ok && stopOnError) stopped = true;
        }
      } finally {
        reservations.delete(mine);
        bumpInflight();
      }
      return out;
    },
    [submitInternal, targetRunning],
  );

  const isSubmitting = React.useCallback(
    (target: DramaCanvasRunTarget): boolean => {
      void inflightTick; // 依赖它重算
      return targetTaken(canvasId, target) !== null;
    },
    [canvasId, inflightTick],
  );

  const cancel = React.useCallback(
    async (runId: string): Promise<void> => {
      if (docRef.current.readOnly) {
        toast.error(READONLY_CANCEL_MESSAGE);
        return;
      }
      try {
        const run = await CanvasApi.cancelRun(docRef.current.canvasId, runId);
        const before = stateRef.current;
        commit((s) => recordRuns(s, [run]));
        mergeIntoDoc([run]);
        if (!before.byId[runId] || !isTerminalStatus(before.byId[runId].status)) notifyWalletChanged();
      } catch (e) {
        toast.error("没取消成功", { description: aiErrorMessage(e, "请稍后再试。") });
      }
    },
    [commit, mergeIntoDoc],
  );

  const runFor = React.useCallback(
    (target: DramaCanvasRunTarget): DramaCanvasRun | undefined => {
      const id = state.byTarget[target];
      return id ? state.byId[id] : undefined;
    },
    [state],
  );

  const pending = React.useMemo(() => Object.values(state.byId).filter((r) => !isTerminalStatus(r.status)), [state.byId]);

  const value = React.useMemo<CanvasRunsValue>(
    () => ({ submit, submitSequence, runFor, cancel, pending, isSubmitting }),
    [submit, submitSequence, runFor, cancel, pending, isSubmitting],
  );
  return <RunsContext.Provider value={value}>{children}</RunsContext.Provider>;
}

/** 查不到的运行：本地记成失败（只为了停掉转圈、给一句说明；不是服务端的记录，不存别处）。 */
function missingRun(canvasId: string, runId: string, target: DramaCanvasRunTarget, prev?: DramaCanvasRun): DramaCanvasRun {
  const now = new Date().toISOString();
  return {
    id: runId,
    canvasId,
    kind: prev?.kind ?? kindOfTarget(target),
    target,
    status: "failed",
    cost: prev?.cost ?? 0,
    errorCode: "DRAMA_CANVAS_RUN_MISSING",
    errorMessage: MISSING_RUN_MESSAGE,
    createdAt: prev?.createdAt ?? now,
    finishedAt: now,
  };
}

function kindOfTarget(target: string): DramaCanvasRunKind {
  if (target.startsWith("script:")) return "script";
  if (target === "extract") return "extract";
  if (target.startsWith("storyboard:")) return "storyboard";
  if (target.startsWith("video:")) return "video";
  if (target.startsWith("assemble:")) return "assemble";
  return "image";
}
