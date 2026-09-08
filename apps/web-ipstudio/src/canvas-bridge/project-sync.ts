"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布 ⇄ 服务端的项目同步。
//
// **服务端是唯一真值**：进页面拉一次，改动防抖回存。画布自己的 IndexedDB 持久化已经
// 关掉（见 canvas/stores/canvas/use-canvas-store.ts）—— 两份真值打架迟早出现
// 「我明明改了怎么没了」。
//
// 文档形状两边一致（nodes / connections / viewport），所以不需要转换器，
// 只在最外层套上项目名和时间。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useCanvasStore, type CanvasProject } from "@/canvas/stores/canvas/use-canvas-store";
import type { CanvasConnection, CanvasNodeData, ViewportTransform } from "@/canvas/types/canvas";
import { IpStudioApi } from "@/api";
import { setCurrentProjectId } from "./api";
import { loadServerModels } from "./models";

const SAVE_DEBOUNCE_MS = 900;

/**
 * 某个项目**还没落地的那次保存**（模块级，跨 hook 实例）。
 *
 * 为什么必须是模块级：「离开前补存」会在组件卸载之后才落地，而用户可能马上又把
 * 同一个项目打开 —— 新的 hook 实例对上一次的在途 PUT 一无所知，于是：
 *   · 读回来的是**补存之前**那一版（用户看到自己最后一笔改动没了，其实它在路上）；
 *   · 基线也是旧的（v1），补存落地后服务端已经是 v2 → 下一次保存必然 409
 *     `IP_PROJECT_STALE` → 自动保存整条停掉，「只开了一个窗口却说别处改过」。
 * 所以加载之前先等它落地。键是 projectId，落地即删，不会攒。
 */
const pendingSaves = new Map<string, Promise<unknown>>();

function trackPendingSave(projectId: string, task: Promise<unknown>) {
  pendingSaves.set(projectId, task);
  void task.finally(() => {
    if (pendingSaves.get(projectId) === task) pendingSaves.delete(projectId);
  });
}

/** 这个项目有没有还在路上的保存 —— 加载前等它，测试也用它。 */
export function pendingSaveFor(projectId: string): Promise<unknown> | undefined {
  return pendingSaves.get(projectId);
}

/**
 * 等这个项目的保存**队列排空**（不只是当前在途那一次）。
 *
 * 为什么不能只 await 一次（Codex 复核逮到）：补存要等在途那次落地之后才发得出去，
 * 所以「首个 PUT 在途 + 又改一笔 + 离开」会留下**两次** PUT。只等第一次的话，
 * 第二次刚被排上、还没落地，加载就已经读回去了 —— 读到的正是「最后一笔之前」那一版，
 * 而且基线也旧了一版。所以要循环到队列为空。
 *
 * 循环有上限：万一有别处不停往里排，也不能让画布永远停在「正在打开」。
 */
const MAX_PENDING_SAVE_WAITS = 12;
/**
 * 等它落地的上限。
 *
 * `apiFetch` 没有超时，一条卡住的 PUT 可能挂上几分钟 —— 无限等下去就是
 * 「画布永远停在『正在打开』」，用户什么也做不了、也不知道为什么。
 *
 * 但等超了**也不能照常打开**（Codex 复核纠正了我这一版）：那份文档我们**已经知道**
 * 是旧的（最后一笔还在那条卡住的 PUT 手里）。把它当成可编辑的正常内容摆出来，
 * 用户会在旧内容上接着改，然后每一次保存都撞 409、自动保存整条停掉 ——
 * 正是 v0.162 那次事故的形状。所以超时就**明确报错**（错误页自带「重新加载」），
 * 等那条 PUT 落地之后重试就能看到正确内容。
 */
const MAX_PENDING_SAVE_WAIT_MS = 8000;

export async function awaitPendingSaves(projectId: string): Promise<"drained" | "timeout"> {
  for (let i = 0; i < MAX_PENDING_SAVE_WAITS; i++) {
    const pending = pendingSaves.get(projectId);
    if (!pending) return "drained";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const capped = new Promise<void>((resolve) => { timer = setTimeout(resolve, MAX_PENDING_SAVE_WAIT_MS); });
    // put() 内部已经把失败收敛成结果，正常不会 reject；真 reject 也不该拦着人打开画布
    await Promise.race([pending.catch(() => undefined), capped]);
    if (timer) clearTimeout(timer);
    // 还是同一个在途 = 上面那条是超时赢的
    if (pendingSaves.get(projectId) === pending) return "timeout";
  }
  return "timeout";
}

type IpDoc = { nodes?: CanvasNodeData[]; connections?: CanvasConnection[]; viewport?: ViewportTransform };

const EMPTY_VIEWPORT: ViewportTransform = { x: 0, y: 0, k: 1 };

/**
 * 修一类**已经存进文档**的坏数据：primaryImageId 指向一个候选里根本没有的 id。
 *
 * 成因见 project.tsx 里「就地重出」那段注释：v0.166 之后重出会整个换掉 images[]，
 * 但旧的 primaryImageId 留了下来，写回成图那段看见它就只更新候选、不更新
 * metadata.content / storageKey —— 节点于是一直显示**第一次**那张图，
 * 而每次新出的图就躺在候选里没人看。写代码那侧已经修了（重出时清掉它），
 * 但已经存下来的画布还是坏的，光修新代码打不开的还是打不开。
 *
 * 处理办法：primary 指向不存在的 id 时，认最后一张**成功**的候选，把它扶正
 * （content / storageKey 一并更新）。没有成功候选就只把悬空的 primary 去掉。
 * 只在读进来的时候做一次，不改服务端数据 —— 用户随后任何一次编辑会把它存回去。
 */
export function healDanglingPrimary(nodes: CanvasNodeData[]): CanvasNodeData[] {
  let changed = false;
  const out = nodes.map((node) => {
    const meta = node.metadata as Record<string, unknown> | undefined;
    const primary = meta?.primaryImageId as string | undefined;
    const images = (meta?.images as Array<Record<string, unknown>> | undefined) ?? [];
    if (!primary || images.some((i) => i.id === primary)) return node;
    changed = true;
    const winner = [...images].reverse().find((i) => i.status === "success" && (i.storageKey || i.content));
    if (!winner) return { ...node, metadata: { ...meta, primaryImageId: undefined } } as CanvasNodeData;
    return {
      ...node,
      metadata: {
        ...meta,
        primaryImageId: winner.id,
        content: winner.content ?? meta?.content,
        storageKey: winner.storageKey ?? meta?.storageKey,
        naturalWidth: winner.naturalWidth ?? meta?.naturalWidth,
        naturalHeight: winner.naturalHeight ?? meta?.naturalHeight,
        mimeType: winner.mimeType ?? meta?.mimeType,
      },
    } as CanvasNodeData;
  });
  return changed ? out : nodes;
}

function toCanvasProject(id: string, name: string, doc: IpDoc | null | undefined, updatedAt?: string): CanvasProject {
  return {
    id,
    title: name || "未命名 IP",
    createdAt: updatedAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
    nodes: healDanglingPrimary(doc?.nodes ?? []),
    connections: doc?.connections ?? [],
    chatSessions: [],
    activeChatId: null,
    backgroundMode: "lines",
    showImageInfo: false,
    viewport: doc?.viewport ?? EMPTY_VIEWPORT,
  };
}

export type SyncState = "loading" | "ready" | "error";
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "failed" | "conflict";

/** 一次保存的结果。`conflict` 之后不再自动保存（见下面的注释）。 */
export type SaveOutcome = "saved" | "nothing-to-save" | "failed" | "conflict";

/** 一次 PUT 的结果：结论 + 服务端给的新指纹（下一次保存的基线）。 */
type SaveResult = { outcome: SaveOutcome; docVersion?: string };

/** 要存的那一份（内容 + 基线），从 store 里快照下来带走。 */
type Snapshot = { id: string; title: string; doc: Required<IpDoc>; base: string | null };

/**
 * 打开一个项目并保持同步。
 *
 * 返回 `ready` 之前不要渲染画布 —— 画布一挂载就会认为「这个项目没有内容」，
 * 紧接着的自动保存会把服务端上真正的内容覆盖成空的。
 */
export function useProjectSync(projectId: string) {
  const [state, setState] = React.useState<SyncState>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  /**
   * 发布状态 —— 画布上的「发布」按钮据此显示「发布到资产库」还是「已发布」。
   * 服务端对重复发布返回 409，但按钮得在点之前就说清楚，而不是让人点了才知道。
   */
  const [publishedAvatarId, setPublishedAvatarId] = React.useState<string | null>(null);
  const loadedRef = React.useRef(false);
  /**
   * 加载时那一版**文档的指纹** —— 保存时带回去，服务端据此拒绝覆盖别处的编辑。
   *
   * 早先带的是 updatedAt，那样会**误报**：时间戳内存里是纳秒、落库是微秒，存进去再读出来
   * 就不相等；而且发布只改状态不动文档，也会 bump 它。用户明明只开了一个窗口，
   * 却老被告知「在别处改过了」。指纹只跟文档内容有关，这两种情况都进不来。
   */
  const baseRef = React.useRef<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 在途那次保存。resolve 出的 `docVersion` 是**下一次保存要带的基线** ——
   * 「离开前补存」那条路要用它（见 `flushOnTeardown`）：拿旧基线去存必然 409。
   */
  const inFlightRef = React.useRef<Promise<SaveResult> | null>(null);
  /**
   * 撞上别处的编辑之后就一直是这个状态，直到用户刷新。
   *
   * 光靠 `loadedRef=false` 停掉自动保存不够：`saveNow()` 会因此返回「没什么可存」，
   * 而发布把那个当成「存好了」放行 —— 于是冲突之后照样能拿**服务端上的旧内容**发布出去
   * （Codex 复核逮到）。所以冲突要显式记住，并让 saveNow 一直如实回报 conflict。
   */
  const conflictRef = React.useRef(false);
  /**
   * 「这是第几次打开」的代次号。
   *
   * `baseRef` / `inFlightRef` / `dirtyRef` 都是**跨 projectId 共享**的 ref，而保存是异步的：
   * 同一个组件实例的 projectId 从 A 换成 B 时，A 的在途 PUT 可能晚于 B 的 GET 才 resolve ——
   * 它会把 `baseRef` 写成 A 的文档指纹，于是 B 的下一次保存带着 A 的 `baseDocVersion`，
   * 服务端判 409 `IP_PROJECT_STALE`，前端按设计**停掉全部自动保存**。用户只开了一个窗口，
   * 却被告知「别处改过」，此后所有改动都不落盘（v0.162 那次事故的伤害形状）。
   * 每次加载 +1，异步回调只认自己那一代。
   */
  const epochRef = React.useRef(0);
  /** 有没有还没存上的改动 —— 顶栏据此显示「未保存」，离开时据此决定要不要拦一下。 */
  const dirtyRef = React.useRef(false);

  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
    setSaveState((s) => (s === "conflict" ? s : "dirty"));
  }, []);

  /**
   * 最新的那个 flush。
   *
   * 为什么要绕这一手：**清理函数按 effect 的声明顺序执行**。下面「加载」那个 effect 的清理
   * 会把 `loadedRef` 置回 false（它必须这么做，否则旧项目的尾巴会拿着旧 id 再存一次），
   * 而 flush 看见 `loadedRef=false` 就直接返回 —— 所以「离开前存一次」必须声明在它**之前**，
   * 那会儿 `loadedRef` 还是 true。而 `flush` 定义在后面，只能靠 ref 取到。
   */
  const teardownRef = React.useRef<() => void>(() => {});

  // ── 离开之前把最后一笔存掉 ────────────────────────────
  //
  // 防抖 900ms 意味着「改一笔 → 立刻点顶栏『资产』/ 关标签页」= 那一笔没了，
  // 而界面上从没显示过「未保存」。这里堵住站内跳走那一半：组件卸载 / 切项目时立刻 flush。
  // 页面还活着，请求照样发得出去（关标签页那一半由下面的 beforeunload 拦）。
  React.useEffect(() => {
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      teardownRef.current();
    };
  }, [projectId]);

  // ── 加载 ──────────────────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    const epoch = ++epochRef.current;
    loadedRef.current = false;
    dirtyRef.current = false;
    conflictRef.current = false;
    inFlightRef.current = null;
    baseRef.current = null;
    setState("loading");
    setSaveState("idle");
    setPublishedAvatarId(null);
    setCurrentProjectId(projectId);

    // 模型候选与项目并行拉：拿不到不拦着人打开画布（只是生成不可用，画布会自己说）。
    // 这一步在 v0.157~v0.159 之间是缺的 —— 画布下拉里于是一直是上游那几个我们没有的模型名，
    // 选中后 preflight 一律 503，出图从头到尾跑不了。
    void loadServerModels().catch((e: unknown) => {
      console.warn("[ipstudio] 模型候选加载失败，生成会显示为不可用", e);
    });

    // 先等上一次打开留下的补存**全部**落地，再读 —— 否则读回的是补存之前那一版，
    // 而且基线也是旧的（下一次保存必然假 409）。队列可能有两笔（在途 + 排队的补存）。
    void awaitPendingSaves(projectId)
      .then((queue) => {
        if (!alive || epoch !== epochRef.current) return null;
        if (queue === "timeout") {
          // 已经知道要读到的是旧内容了 —— 不能摆出来当正常内容让人接着改（见上面的注释）
          setError("上一次的改动还在保存中（网络好像卡住了）。现在打开会看到旧内容，改动也存不上 —— 等一下点「重新加载」再试。");
          setState("error");
          return null;
        }
        return IpStudioApi.getProject(projectId);
      })
      .then((p) => {
        if (!p || !alive || epoch !== epochRef.current) return;
        useCanvasStore.setState({
          projects: [toCanvasProject(p.id, p.name, p.doc as IpDoc, p.updatedAt)],
          deletedProjects: [],
          hydrated: true,
        });
        baseRef.current = p.docVersion ?? null;
        setPublishedAvatarId(p.publishedAvatarId ?? null);
        loadedRef.current = true;
        setState("ready");
      })
      .catch((e: unknown) => {
        if (!alive || epoch !== epochRef.current) return;
        setError(e instanceof Error ? e.message : "这个项目打不开");
        setState("error");
      });

    return () => {
      alive = false;
      setCurrentProjectId(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      // 切项目时把在途保存的尾巴掐掉：旧项目的 flush 可能在切换之后才 resolve，
      // 它的尾随重试会拿着旧 projectId 再跑一次。靠 find 返回 undefined 也能兜住，
      // 但写明确点 —— 这种「碰巧安全」将来很容易被改坏。
      // （「离开前把最后一笔存掉」在上面那个 effect 里，它声明得更早、清理跑在这之前。）
      loadedRef.current = false;
      dirtyRef.current = false;
    };
  }, [projectId]);

  // ── 自动保存 ──────────────────────────────────────────
  /**
   * 要存的那一份 —— **带着内容和基线**，不是「回头去 store 里再找」。
   *
   * 「离开前补存」那条路必须这样：等在途那次结束之后，store 里可能已经是另一个项目了
   * （切项目时 load 会整块替换），那会儿再去 find 就什么都找不到，用户最后一笔改动就没了。
   */
  const snapshot = React.useCallback((): Snapshot | null => {
    const project = useCanvasStore.getState().projects.find((p) => p.id === projectId);
    if (!project) return null;
    return {
      id: project.id,
      title: project.title,
      doc: { nodes: project.nodes, connections: project.connections, viewport: project.viewport },
      base: baseRef.current,
    };
  }, [projectId]);

  /** 真正发那一次 PUT。状态只在同一代次里写（切项目 / 重开之后不许回头改界面）。 */
  const put = React.useCallback((snap: Snapshot, epoch: number): Promise<SaveResult> => {
    const task: Promise<SaveResult> = IpStudioApi.updateProject(snap.id, {
      name: snap.title,
      doc: snap.doc,
      baseDocVersion: snap.base ?? undefined,
    })
      .then((saved): SaveResult => {
        if (epoch === epochRef.current) {
          baseRef.current = saved.docVersion ?? baseRef.current;
          setSaveState(dirtyRef.current ? "dirty" : "saved");
        }
        return { outcome: "saved", docVersion: saved.docVersion ?? undefined };
      })
      .catch((e: unknown): SaveResult => {
        const stale = Boolean(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "IP_PROJECT_STALE");
        if (epoch === epochRef.current) {
          dirtyRef.current = true;   // 没存上，改动还在本地
          if (stale) {
            // 冲突不能重试（重试就是覆盖别处的改动，而画布是整存整取的 —— 覆盖掉的
            // 不是一个字段，是那边一整份工作）。也不能继续自动保存，否则用户越改越远，
            // 最后只能二选一丢一边。
            conflictRef.current = true;
            loadedRef.current = false;
            setSaveState("conflict");
          } else {
            // 不吞：存不上就明说，别让用户以为改动落盘了
            setSaveState("failed");
          }
        }
        return { outcome: stale ? "conflict" : "failed" };
      })
      .finally(() => {
        if (inFlightRef.current === task) inFlightRef.current = null;
      });
    inFlightRef.current = task;
    // 登记到模块级：这次可能在组件卸载之后才落地，而那时用户也许已经把同一个项目又打开了
    trackPendingSave(snap.id, task);
    return task;
  }, []);

  /**
   * 存一次，并**如实回报结果**（发布之前要据此决定发不发，见 publish-gate.ts）。
   *
   * 在途时等在途那次的真实结果，而不是像以前那样只置个 pending 标记就返回「存好了」
   * —— 那样调用方拿到的「存好了」其实是「排队了」。
   */
  const flushResult = React.useCallback((): Promise<SaveResult> => {
    // 冲突之后一直如实回报冲突，直到用户刷新（否则发布会拿服务端上的旧内容发出去）
    if (conflictRef.current) return Promise.resolve({ outcome: "conflict" });
    if (!loadedRef.current) return Promise.resolve({ outcome: "nothing-to-save" });
    const inFlight = inFlightRef.current;
    if (inFlight) return inFlight.then((r) => (dirtyRef.current || inFlightRef.current ? flushResult() : r));
    // 没有待存的改动就别白发一次 PUT（比如：发布前刚 saveNow 过，紧接着防抖计时器又到点）。
    // 「服务端已经有这份内容了」对调用方来说和「刚存好」是一个意思。
    if (!dirtyRef.current) return Promise.resolve({ outcome: "nothing-to-save" });
    const snap = snapshot();
    if (!snap) return Promise.resolve({ outcome: "nothing-to-save" });
    dirtyRef.current = false;
    setSaveState("saving");
    return put(snap, epochRef.current);
  }, [put, snapshot]);

  const flush = React.useCallback((): Promise<SaveOutcome> => flushResult().then((r) => r.outcome), [flushResult]);

  /**
   * 离开（卸载 / 切项目）之前把最后一笔补上。
   *
   * 两个坑都在这儿：
   *   · **不能等 store**：切项目时它马上会被换成新项目，所以现在就把内容快照下来；
   *   · **基线要用在途那次存完之后的**：正在存的那一次会把服务端的指纹推到下一版，
   *     拿加载时的旧基线去补存必然 409（而 409 会把这个项目的自动保存整条停掉）。
   */
  const flushOnTeardown = React.useCallback(() => {
    if (conflictRef.current || !loadedRef.current || !dirtyRef.current) return;
    const snap = snapshot();
    if (!snap) return;
    const epoch = epochRef.current;
    const inFlight = inFlightRef.current;
    dirtyRef.current = false;
    void (inFlight
      ? inFlight.then((r) => put({ ...snap, base: r.docVersion ?? snap.base }, epoch))
      : put(snap, epoch));
  }, [put, snapshot]);

  React.useEffect(() => { teardownRef.current = flushOnTeardown; }, [flushOnTeardown]);

  React.useEffect(() => {
    const unsub = useCanvasStore.subscribe((cur, prev) => {
      if (!loadedRef.current) return;
      const a = cur.projects.find((p) => p.id === projectId);
      const b = prev.projects.find((p) => p.id === projectId);
      // 只认内容变化：拖动视口也算（用户下次打开希望还在原来那个位置）
      if (!a || (b && a.nodes === b.nodes && a.connections === b.connections
                 && a.viewport === b.viewport && a.title === b.title)) return;
      markDirty();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void flush(); }, SAVE_DEBOUNCE_MS);
    });
    return unsub;
  }, [flush, markDirty, projectId]);

  // 关标签页 / 刷新那一半：这时候发请求不可靠（fetch 会被中断），所以不假装能存上，
  // 就是让浏览器问一句，让用户自己决定（文案由浏览器决定，我们改不了）。
  React.useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !inFlightRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  return {
    state,
    error,
    saveState,
    publishedAvatarId,
    setPublishedAvatarId,
    /** 立刻存一次并等它结束 —— 发布前用（发布读的是库里那份文档）。 */
    saveNow: flush,
    /** 保存失败后的重试入口。冲突不给重试（那只能刷新，见上面的注释）。 */
    retrySave: flush,
  };
}
