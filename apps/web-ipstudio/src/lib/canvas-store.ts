"use client";

// ─────────────────────────────────────────────────────────────────────────────
// lib/canvas-store.ts — 画布状态（zustand）。
//
// 真值分层（docs/ip-studio-plan.md §2）：
//   doc  —— 客户端拥有，防抖 PUT 整存整取
//   runs —— 服务端拥有的运行投影，前端只读缓存（运行结束后写回）
// 撤销重做只作用于 doc，上限 60 步；拖动节点不逐帧入栈（松手时 pushHistory 一次）。
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type {
  IpEdge, IpNode, IpNodeType, IpProject, IpProjectDoc, IpProjectStatus, IpRun, IpViewport,
} from "@ai-star-eco/types";
import { addEdge as addEdgeTo, canConnect, newNodeId } from "@/lib/graph";
import { defaultNodeData } from "@/lib/node-meta";

const HISTORY_LIMIT = 60;

const EMPTY_DOC: IpProjectDoc = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface CanvasState {
  projectId: string | null;
  name: string;
  status: IpProjectStatus;
  publishedAvatarId?: string;
  templateId?: string;
  doc: IpProjectDoc;
  /** nodeId → 该节点最近一次运行（服务端投影） */
  runs: Record<string, IpRun>;
  /**
   * runId → 运行明细。选中的候选可能来自更早的一次运行（服务端投影按 nodeId 只带最新
   * 那条），所以本会话见过的运行都留一份，好让「已选定」的缩略图始终解析得出来。
   */
  runsById: Record<string, IpRun>;
  selectedNodeId: string | null;
  past: IpProjectDoc[];
  future: IpProjectDoc[];
  saveState: SaveState;
  /** 正在运行的节点 → runId（用于节点卡上的进度与「运行中」禁用） */
  activeRuns: Record<string, string>;

  load: (project: IpProject) => void;
  setName: (name: string) => void;
  setSaveState: (s: SaveState) => void;
  select: (nodeId: string | null) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /** 位置更新：高频，不入历史（松手时由调用方 pushHistory） */
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;
  setViewport: (viewport: IpViewport) => void;
  addNode: (type: IpNodeType, position: { x: number; y: number }) => string;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  connect: (source: string, target: string) => boolean;
  /** 按类型安全地改节点 data（只允许同类型的部分字段） */
  patchNodeData: <T extends IpNodeType>(nodeId: string, type: T, patch: Partial<Extract<IpNode, { type: T }>["data"]>) => void;
  setNodeLabel: (nodeId: string, label: string) => void;
  /** 设为主形象：全项目唯一，切换即转移 */
  setMaster: (nodeId: string) => void;

  putRun: (run: IpRun) => void;
  setActiveRun: (nodeId: string, runId: string | null) => void;
  markPublished: (avatarId: string) => void;
}

/** 服务端 runs 投影里仍在跑的那些 → nodeId → runId。 */
function runningRuns(project: IpProject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const run of Object.values(project.runs ?? {})) {
    if (run.status === "running") out[run.nodeId] = run.id;
  }
  return out;
}

/** 视口变化是否值得存一次（避免滚轮微调也触发 PUT）。 */
function viewportChanged(a: IpViewport, b: IpViewport): boolean {
  return Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs(a.zoom - b.zoom) > 0.01;
}

function cloneDoc(doc: IpProjectDoc): IpProjectDoc {
  return {
    nodes: doc.nodes.map((n) => ({ ...n, position: { ...n.position }, data: { ...n.data } })) as IpNode[],
    edges: doc.edges.map((e) => ({ ...e })),
    viewport: { ...doc.viewport },
  };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  projectId: null,
  name: "",
  status: "draft",
  doc: EMPTY_DOC,
  runs: {},
  runsById: {},
  selectedNodeId: null,
  past: [],
  future: [],
  saveState: "idle",
  activeRuns: {},

  load: (project) =>
    set({
      projectId: project.id,
      name: project.name,
      status: project.status,
      publishedAvatarId: project.publishedAvatarId,
      templateId: project.templateId,
      doc: cloneDoc(project.doc?.nodes ? project.doc : EMPTY_DOC),
      runs: project.runs ?? {},
      runsById: {
        ...Object.fromEntries(Object.values(project.runs ?? {}).map((r) => [r.id, r])),
        ...(project.runsById ?? {}),
      },
      past: [],
      future: [],
      saveState: "idle",
      selectedNodeId: null,
      // 刷新后还在跑的运行必须认回来：清空 activeRuns 会让节点看着像空闲，
      // 用户既取消不了、又会点「运行」撞服务端 409（同节点已有 running）。
      // 认回来之后由画布页对这些 runId 续上轮询（见 canvas-shell 的恢复 effect）。
      activeRuns: runningRuns(project),
    }),

  setName: (name) => set({ name, saveState: "dirty" }),
  setSaveState: (saveState) => set({ saveState }),
  select: (selectedNodeId) => set({ selectedNodeId }),

  pushHistory: () =>
    set((s) => ({
      past: [...s.past, cloneDoc(s.doc)].slice(-HISTORY_LIMIT),
      future: [],
    })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        past: s.past.slice(0, -1),
        future: [cloneDoc(s.doc), ...s.future].slice(0, HISTORY_LIMIT),
        doc: prev,
        saveState: "dirty",
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        past: [...s.past, cloneDoc(s.doc)].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        doc: next,
        saveState: "dirty",
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  moveNode: (nodeId, position) =>
    set((s) => ({
      doc: { ...s.doc, nodes: s.doc.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)) },
      saveState: "dirty",
    })),

  // 视口也是文档的一部分（下次进来还在原处），所以要标脏 —— 之前不标，
  // 平移缩放永远存不下去。只有真的挪动了才标，配合 1.2s 防抖存盘，
  // 一次连续的滚轮/拖拽合并成一次 PUT（React Flow 的 onMoveEnd 已经是「停下来」才回调）。
  setViewport: (viewport) =>
    set((s) =>
      viewportChanged(s.doc.viewport, viewport)
        ? { doc: { ...s.doc, viewport }, saveState: "dirty" }
        : { doc: { ...s.doc, viewport } },
    ),

  addNode: (type, position) => {
    const id = newNodeId(type);
    get().pushHistory();
    const node = { ...defaultNodeData(type), id, position } as IpNode;
    set((s) => ({ doc: { ...s.doc, nodes: [...s.doc.nodes, node] }, selectedNodeId: id, saveState: "dirty" }));
    return id;
  },

  removeNode: (nodeId) => {
    get().pushHistory();
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.filter((n) => n.id !== nodeId),
        edges: s.doc.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      },
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
      saveState: "dirty",
    }));
  },

  removeEdge: (edgeId) => {
    get().pushHistory();
    set((s) => ({ doc: { ...s.doc, edges: s.doc.edges.filter((e) => e.id !== edgeId) }, saveState: "dirty" }));
  },

  connect: (source, target) => {
    const { doc } = get();
    if (!canConnect(doc, source, target)) return false;
    get().pushHistory();
    const edges: IpEdge[] = addEdgeTo(doc, source, target);
    set((s) => ({ doc: { ...s.doc, edges }, saveState: "dirty" }));
    return true;
  },

  patchNodeData: (nodeId, type, patch) => {
    get().pushHistory();
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.map((n) =>
          n.id === nodeId && n.type === type ? ({ ...n, data: { ...n.data, ...patch } } as IpNode) : n,
        ),
      },
      saveState: "dirty",
    }));
  },

  setNodeLabel: (nodeId, label) => {
    get().pushHistory();
    set((s) => ({
      doc: { ...s.doc, nodes: s.doc.nodes.map((n) => (n.id === nodeId ? { ...n, label } : n)) },
      saveState: "dirty",
    }));
  },

  setMaster: (nodeId) => {
    get().pushHistory();
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.map((n) =>
          n.type === "generate"
            ? ({ ...n, data: { ...n.data, isMaster: n.id === nodeId } } as IpNode)
            : n,
        ),
      },
      saveState: "dirty",
    }));
  },

  putRun: (run) =>
    set((s) => ({
      runs: { ...s.runs, [run.nodeId]: run },
      runsById: { ...s.runsById, [run.id]: run },
    })),

  setActiveRun: (nodeId, runId) =>
    set((s) => {
      const next = { ...s.activeRuns };
      if (runId) next[nodeId] = runId;
      else delete next[nodeId];
      return { activeRuns: next };
    }),

  markPublished: (avatarId) => set({ status: "published", publishedAvatarId: avatarId }),
}));
