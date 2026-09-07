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

const SAVE_DEBOUNCE_MS = 900;

type IpDoc = { nodes?: CanvasNodeData[]; connections?: CanvasConnection[]; viewport?: ViewportTransform };

const EMPTY_VIEWPORT: ViewportTransform = { x: 0, y: 0, k: 1 };

function toCanvasProject(id: string, name: string, doc: IpDoc | null | undefined, updatedAt?: string): CanvasProject {
  return {
    id,
    title: name || "未命名 IP",
    createdAt: updatedAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
    nodes: doc?.nodes ?? [],
    connections: doc?.connections ?? [],
    chatSessions: [],
    activeChatId: null,
    backgroundMode: "lines",
    showImageInfo: false,
    viewport: doc?.viewport ?? EMPTY_VIEWPORT,
  };
}

export type SyncState = "loading" | "ready" | "error";
export type SaveState = "idle" | "saving" | "saved" | "failed";

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
  const loadedRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = React.useRef(false);
  const pendingRef = React.useRef(false);

  // ── 加载 ──────────────────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    setState("loading");
    setCurrentProjectId(projectId);

    void IpStudioApi.getProject(projectId)
      .then((p) => {
        if (!alive) return;
        useCanvasStore.setState({
          projects: [toCanvasProject(p.id, p.name, p.doc as IpDoc, p.updatedAt)],
          deletedProjects: [],
          hydrated: true,
        });
        loadedRef.current = true;
        setState("ready");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "这个项目打不开");
        setState("error");
      });

    return () => {
      alive = false;
      setCurrentProjectId(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId]);

  // ── 自动保存 ──────────────────────────────────────────
  React.useEffect(() => {
    const flush = async () => {
      if (!loadedRef.current) return;
      if (inFlightRef.current) { pendingRef.current = true; return; }
      const project = useCanvasStore.getState().projects.find((p) => p.id === projectId);
      if (!project) return;
      inFlightRef.current = true;
      setSaveState("saving");
      try {
        await IpStudioApi.updateProject(projectId, {
          name: project.title,
          doc: { nodes: project.nodes, connections: project.connections, viewport: project.viewport },
        });
        setSaveState("saved");
      } catch {
        // 不吞：存不上就明说，别让用户以为改动落盘了
        setSaveState("failed");
      } finally {
        inFlightRef.current = false;
        if (pendingRef.current) { pendingRef.current = false; void flush(); }
      }
    };

    const unsub = useCanvasStore.subscribe((cur, prev) => {
      if (!loadedRef.current) return;
      const a = cur.projects.find((p) => p.id === projectId);
      const b = prev.projects.find((p) => p.id === projectId);
      // 只认内容变化：拖动视口也算（用户下次打开希望还在原来那个位置）
      if (!a || (b && a.nodes === b.nodes && a.connections === b.connections
                 && a.viewport === b.viewport && a.title === b.title)) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void flush(); }, SAVE_DEBOUNCE_MS);
    });
    return unsub;
  }, [projectId]);

  return { state, error, saveState };
}
