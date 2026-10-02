// ─────────────────────────────────────────────────────────────────────────────
// canvas/board/viewport-store.ts —— 画布视口（平移 / 缩放）按画布记在这台浏览器里（localStorage）。
//
// 为什么不写文档（doc.board.viewport）：视口一变就写文档 = 每拖一下画布就是一次保存。两个标签页开着同一张画布时，
// 光是在这边拖画布，就会让另一边下一次保存撞 409、进只读 —— 为了一个纯个人的「看到哪儿了」，代价太大。
// 所以视口只存本机；doc.board.viewport 字段保留（老文档里可能有值，进页时本机没记录就用它），但不再维护。
// 读写都 try/catch：隐私模式 / 存储被禁用时 localStorage 可能直接抛错，那就当没有记录（进页 fitView）。
// ─────────────────────────────────────────────────────────────────────────────

export type StoredViewport = { x: number; y: number; zoom: number };

export const VIEWPORT_STORAGE_PREFIX = "drama-canvas-viewport:";

export const viewportStorageKey = (canvasId: string) => `${VIEWPORT_STORAGE_PREFIX}${canvasId}`;

function valid(v: unknown): v is StoredViewport {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.x === "number" &&
    Number.isFinite(o.x) &&
    typeof o.y === "number" &&
    Number.isFinite(o.y) &&
    typeof o.zoom === "number" &&
    Number.isFinite(o.zoom) &&
    o.zoom > 0
  );
}

/** 这台浏览器上次看这张画布时的视口；没有 / 读不了 / 格式不对都回 null。 */
export function readStoredViewport(canvasId: string): StoredViewport | null {
  try {
    const raw = window.localStorage.getItem(viewportStorageKey(canvasId));
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return valid(v) ? { x: v.x, y: v.y, zoom: v.zoom } : null;
  } catch {
    return null;
  }
}

/** 记下视口（取整，缩放留三位小数）。写不进去就算了（下次进页 fitView）。 */
export function writeStoredViewport(canvasId: string, v: StoredViewport): void {
  try {
    const out = { x: Math.round(v.x), y: Math.round(v.y), zoom: Math.round(v.zoom * 1000) / 1000 };
    window.localStorage.setItem(viewportStorageKey(canvasId), JSON.stringify(out));
  } catch {
    /* 存不了（隐私模式 / 超额）：不影响画布本身 */
  }
}
