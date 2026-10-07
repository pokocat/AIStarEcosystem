import type { CanvasNodeData } from "@/canvas/types/canvas";
let active: { projectId: string; insert: (node: CanvasNodeData) => void } | null = null;
export function registerCanvasRecovery(projectId: string, insert: (node: CanvasNodeData) => void) {
  const handler = { projectId, insert }; active = handler;
  return () => { if (active === handler) active = null; };
}
export function insertRecoveredNode(projectId: string, node: CanvasNodeData) {
  if (!active || active.projectId !== projectId) throw new Error("画布尚未打开，请稍后重试");
  active.insert(node);
}
