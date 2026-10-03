"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/use-canvas-doc.tsx —— 画布文档 ⇄ 服务端（v0.198，契约见 contract.ts「文档」一节）。
//
// `<CanvasDocProvider canvasId>` 在 [canvasId]/layout.tsx 挂一次，四屏共用一份文档，切步骤不重新加载。
// **服务端是唯一真值**：进页拉一次，改动 900ms 防抖整份回存。纪律照 AI IP 工作台真出过的事故来
// （apps/web-aiavatar/src/canvas-bridge/project-sync.ts）：
//   1. 加载完成前 status=loading、doc 是一份空文档 —— 外壳（CanvasGate）这时只画骨架，**不渲染编辑界面**；
//      update() 在加载完成前一律忽略，否则空文档一自动保存就把服务端的内容覆盖掉。
//   2. 保存带 baseDocVersion；409 DRAMA_CANVAS_STALE → status=stale、readOnly、**停掉自动保存、不重试**
//      （重试 = 拿这一份覆盖别处的改动），直到用户点「载入最新」（reload）。
//   3. 保存请求串行：上一次没回来不发下一次；回来之后如果又改过，再存一次。
//   4. 离开（组件卸载）时把防抖里的最后一笔立刻补存；关标签页 / 刷新时还有没存上的改动就让浏览器问一句。
//   5. 补存可能在卸载后才落地，而用户也许马上又打开同一张画布 —— 加载前先等它落地，
//      否则读回的是补存之前那一版、基线也旧一版（下一次保存必然假 409）。
//   6. 一切异步回调只认自己那一代（epoch）：切画布 / 重新加载之后，旧的在途请求不许回头改界面和基线。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { CanvasApi } from "@/api/canvas";
import { aiErrorMessage } from "@/lib/ai-error";
import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import type { CanvasDocStatus, CanvasDocValue, CanvasMeta, CanvasSaveState, FlushResult } from "./contract";
import { emptyDoc, stripAssetUrls } from "./doc-ops";

export const CANVAS_SAVE_DEBOUNCE_MS = 900;

/** 保存失败（断网 / 5xx）后自动再试的间隔与次数；4xx（内容格式不对、太大）不自动重试。 */
const RETRY_DELAY_MS = 5000;
const MAX_AUTO_RETRIES = 3;

// ── 模块级：还没落地的保存（跨 Provider 实例，见头注释第 5 条）──────────────

const pendingSaves = new Map<string, Promise<unknown>>();

function trackPendingSave(canvasId: string, task: Promise<unknown>) {
  pendingSaves.set(canvasId, task);
  void task.finally(() => {
    if (pendingSaves.get(canvasId) === task) pendingSaves.delete(canvasId);
  });
}

/** 这张画布有没有还在路上的保存（测试也用）。 */
export function pendingSaveFor(canvasId: string): Promise<unknown> | undefined {
  return pendingSaves.get(canvasId);
}

const MAX_PENDING_SAVE_WAITS = 12;
/**
 * 等在途保存的上限。apiFetch 没有超时，一条卡住的 PUT 可能挂好几分钟；但等超了也不能照常打开：
 * 读到的那一份已知是旧的，摆出来让人接着改，每次保存都会撞 409。
 */
const MAX_PENDING_SAVE_WAIT_MS = 8000;

async function awaitPendingSaves(canvasId: string): Promise<"drained" | "timeout"> {
  for (let i = 0; i < MAX_PENDING_SAVE_WAITS; i++) {
    const pending = pendingSaves.get(canvasId);
    if (!pending) return "drained";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const capped = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, MAX_PENDING_SAVE_WAIT_MS);
    });
    await Promise.race([pending.catch(() => undefined), capped]);
    if (timer) clearTimeout(timer);
    if (pendingSaves.get(canvasId) === pending) return "timeout";
  }
  return "timeout";
}

function errorCode(e: unknown): string | undefined {
  return e && typeof e === "object" && typeof (e as { code?: unknown }).code === "string" ? (e as { code: string }).code : undefined;
}

function errorStatus(e: unknown): number | undefined {
  const s = e && typeof e === "object" ? (e as { status?: unknown }).status : undefined;
  return typeof s === "number" ? s : undefined;
}

const isStale = (e: unknown) => errorCode(e) === "DRAMA_CANVAS_STALE";
const isNotFound = (e: unknown) => errorCode(e) === "DRAMA_CANVAS_NOT_FOUND" || errorStatus(e) === 404;
/** 断网（没有状态码）或 5xx：过一会儿自动再试有意义；4xx 再试也是同一个结果。 */
const isRetryable = (e: unknown) => {
  const s = errorStatus(e);
  return s === undefined || s >= 500;
};

const EMPTY_META: CanvasMeta = { title: "", ratio: "9:16", createdAt: "", updatedAt: "" };

// ── Context ──────────────────────────────────────────────────────────────────

const CanvasDocContext = React.createContext<CanvasDocValue | null>(null);

/** core 内部用（useCanvasRuns 在生成请求撞上 409 时把文档标成 stale）；不从 index.ts 导出给页面。 */
interface CanvasDocControl {
  markStale: () => void;
}
const CanvasDocControlContext = React.createContext<CanvasDocControl | null>(null);

export function useCanvasDoc(): CanvasDocValue {
  const v = React.useContext(CanvasDocContext);
  if (!v) throw new Error("useCanvasDoc 只能在 CanvasDocProvider 里面用（[canvasId]/layout.tsx 挂着它）");
  return v;
}

/** 可能不在 Provider 里时用（如 useCanvasPricing 在「新建画布」页也会被调到）。 */
export function useOptionalCanvasDoc(): CanvasDocValue | null {
  return React.useContext(CanvasDocContext);
}

export function useCanvasDocControl(): CanvasDocControl {
  const v = React.useContext(CanvasDocControlContext);
  if (!v) throw new Error("useCanvasDocControl 只能在 CanvasDocProvider 里面用");
  return v;
}

type Snapshot = { id: string; doc: DramaCanvasDoc; title: string; base: string };

export function CanvasDocProvider({ canvasId, children }: { canvasId: string; children: React.ReactNode }) {
  const [status, setStatusState] = React.useState<CanvasDocStatus>("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>(undefined);
  const [meta, setMeta] = React.useState<CanvasMeta>(EMPTY_META);
  const [doc, setDocState] = React.useState<DramaCanvasDoc>(emptyDoc);
  const [docVersion, setDocVersion] = React.useState("");
  const [saveState, setSaveState] = React.useState<CanvasSaveState>("saved");

  const statusRef = React.useRef<CanvasDocStatus>("loading");
  const docRef = React.useRef<DramaCanvasDoc>(doc);
  const titleRef = React.useRef("");
  /** 服务端当前那一版的指纹 —— 下一次保存要带的 baseDocVersion。 */
  const baseRef = React.useRef("");
  const loadedRef = React.useRef(false);
  const dirtyRef = React.useRef(false);
  const staleRef = React.useRef(false);
  const epochRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = React.useRef(0);
  const inFlightRef = React.useRef<Promise<FlushResult> | null>(null);
  const flushRef = React.useRef<() => Promise<FlushResult>>(() => Promise.resolve({ ok: false, reason: "failed" }));

  const setStatus = React.useCallback((s: CanvasDocStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const clearTimers = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    timerRef.current = null;
    retryTimerRef.current = null;
  }, []);

  const snapshot = React.useCallback(
    (): Snapshot => ({ id: canvasId, doc: docRef.current, title: titleRef.current, base: baseRef.current }),
    [canvasId],
  );

  /** 真正发那一次 PUT。界面状态只在同一代里写；结果照样返回（卸载后的补存要靠它串起来）。 */
  const put = React.useCallback(
    (snap: Snapshot, epoch: number): Promise<FlushResult> => {
      const title = snap.title.trim();
      const task: Promise<FlushResult> = CanvasApi.save(snap.id, {
        doc: stripAssetUrls(snap.doc),
        ...(title ? { title } : {}),
        baseDocVersion: snap.base,
      })
        .then((res): FlushResult => {
          if (epoch === epochRef.current) {
            baseRef.current = res.docVersion;
            retriesRef.current = 0;
            setDocVersion(res.docVersion);
            setMeta((m) => ({ ...m, updatedAt: res.updatedAt }));
            setSaveState(dirtyRef.current ? "dirty" : "saved");
          }
          return { ok: true, docVersion: res.docVersion };
        })
        .catch((e: unknown): FlushResult => {
          const stale = isStale(e);
          if (epoch === epochRef.current) {
            dirtyRef.current = true; // 没存上，改动还在本地
            setSaveState("failed");
            if (stale) {
              staleRef.current = true;
              clearTimers();
              setStatus("stale");
            } else if (isRetryable(e) && retriesRef.current < MAX_AUTO_RETRIES) {
              retriesRef.current += 1;
              if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
              retryTimerRef.current = setTimeout(() => {
                retryTimerRef.current = null;
                if (epoch === epochRef.current) void flushRef.current();
              }, RETRY_DELAY_MS);
            }
          }
          return { ok: false, reason: stale ? "stale" : "failed" };
        })
        .finally(() => {
          if (inFlightRef.current === task) inFlightRef.current = null;
        });
      inFlightRef.current = task;
      trackPendingSave(snap.id, task);
      return task;
    },
    [clearTimers, setStatus],
  );

  const flushNow = React.useCallback((): Promise<FlushResult> => {
    if (staleRef.current) return Promise.resolve({ ok: false, reason: "stale" });
    if (!loadedRef.current) return Promise.resolve({ ok: false, reason: "failed" });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const inFlight = inFlightRef.current;
    // 串行：在途时等它的真实结果；它存上了、这期间又改过，就接着再存一次
    if (inFlight) return inFlight.then((r) => (r.ok ? flushRef.current() : r));
    if (!dirtyRef.current) return Promise.resolve({ ok: true, docVersion: baseRef.current });
    const snap = snapshot();
    dirtyRef.current = false;
    setSaveState("saving");
    return put(snap, epochRef.current);
  }, [put, snapshot]);

  flushRef.current = flushNow;

  const schedule = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, CANVAS_SAVE_DEBOUNCE_MS);
  }, []);

  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
    retriesRef.current = 0;
    setSaveState(inFlightRef.current ? "saving" : "dirty");
    schedule();
  }, [schedule]);

  // ── 加载 ──────────────────────────────────────────────────────────────────
  const load = React.useCallback(
    async (epoch: number): Promise<void> => {
      clearTimers();
      loadedRef.current = false;
      dirtyRef.current = false;
      staleRef.current = false;
      inFlightRef.current = null;
      baseRef.current = "";
      retriesRef.current = 0;
      const blank = emptyDoc();
      docRef.current = blank;
      setDocState(blank);
      setDocVersion("");
      setErrorMessage(undefined);
      setSaveState("saved");
      setStatus("loading");

      const queue = await awaitPendingSaves(canvasId);
      if (epoch !== epochRef.current) return;
      if (queue === "timeout") {
        setErrorMessage("上一次的改动还在保存，网络好像卡住了。现在打开会看到旧内容，等一下再点「重新打开」。");
        setStatus("error");
        return;
      }
      try {
        const d = await CanvasApi.get(canvasId);
        if (epoch !== epochRef.current) return;
        docRef.current = d.doc;
        titleRef.current = d.title;
        baseRef.current = d.docVersion;
        setDocState(d.doc);
        setDocVersion(d.docVersion);
        setMeta({ title: d.title, ratio: d.ratio, createdAt: d.createdAt, updatedAt: d.updatedAt });
        loadedRef.current = true;
        setStatus("ready");
      } catch (e) {
        if (epoch !== epochRef.current) return;
        if (isNotFound(e)) {
          setStatus("not-found");
          return;
        }
        setErrorMessage(aiErrorMessage(e, "这张画布没打开，请重试"));
        setStatus("error");
      }
    },
    [canvasId, clearTimers, setStatus],
  );

  /** 卸载 / 切画布之前把最后一笔补上（基线要用在途那次存完之后的，否则必然 409）。 */
  const flushOnTeardown = React.useCallback(() => {
    if (staleRef.current || !loadedRef.current || !dirtyRef.current) return;
    const snap = snapshot();
    const epoch = epochRef.current;
    const inFlight = inFlightRef.current;
    dirtyRef.current = false;
    void (inFlight
      ? inFlight.then((r) => (r.ok ? put({ ...snap, base: r.docVersion }, epoch) : r))
      : put(snap, epoch));
  }, [put, snapshot]);
  const teardownRef = React.useRef(flushOnTeardown);
  teardownRef.current = flushOnTeardown;

  React.useEffect(() => {
    const epoch = ++epochRef.current;
    void load(epoch);
    return () => {
      teardownRef.current();
      epochRef.current += 1; // 让这一代的在途回调不再改界面
      clearTimers();
      loadedRef.current = false;
      dirtyRef.current = false;
    };
  }, [load, clearTimers]);

  // 关标签页 / 刷新：还有没存上的改动就让浏览器问一句。stale 之后不问：那份改动本来就存不上了。
  React.useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (staleRef.current) return;
      if (!dirtyRef.current && !inFlightRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  const update = React.useCallback(
    (updater: (d: DramaCanvasDoc) => DramaCanvasDoc) => {
      // 加载完成前 / stale / 打不开：一律不接（见头注释第 1、2 条）
      if (!loadedRef.current || staleRef.current || statusRef.current !== "ready") return;
      const prev = docRef.current;
      const next = updater(prev);
      if (next === prev) return;
      docRef.current = next;
      setDocState(next);
      markDirty();
    },
    [markDirty],
  );

  const rename = React.useCallback(
    (title: string) => {
      if (!loadedRef.current || staleRef.current || statusRef.current !== "ready") return;
      if (title === titleRef.current) return;
      titleRef.current = title;
      setMeta((m) => ({ ...m, title }));
      // 空着不存（服务端保留原名）；输完再存
      if (title.trim()) markDirty();
    },
    [markDirty],
  );

  const flush = React.useCallback((): Promise<FlushResult> => flushRef.current(), []);

  const reload = React.useCallback((): Promise<void> => {
    const epoch = ++epochRef.current;
    return load(epoch);
  }, [load]);

  const getDoc = React.useCallback(() => docRef.current, []);

  const markStale = React.useCallback(() => {
    if (!loadedRef.current) return;
    staleRef.current = true;
    clearTimers();
    setStatus("stale");
  }, [clearTimers, setStatus]);

  const value = React.useMemo<CanvasDocValue>(
    () => ({
      canvasId,
      status,
      errorMessage,
      meta,
      doc,
      getDoc,
      docVersion,
      saveState,
      update,
      rename,
      flush,
      reload,
      readOnly: status !== "ready",
    }),
    [canvasId, status, errorMessage, meta, doc, getDoc, docVersion, saveState, update, rename, flush, reload],
  );
  const control = React.useMemo<CanvasDocControl>(() => ({ markStale }), [markStale]);

  return (
    <CanvasDocContext.Provider value={value}>
      <CanvasDocControlContext.Provider value={control}>{children}</CanvasDocControlContext.Provider>
    </CanvasDocContext.Provider>
  );
}
