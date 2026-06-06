// ============================================================
// Toast 桥接 —— UI.ToastHost 在挂载时把真正的实现写到 window.toast；
// 屏幕层调用本模块的 toast(...) 即可（SSR 安全，服务端渲染时为 no-op）。
// ============================================================

export interface ToastOpts {
  tone?: "ok" | "err" | "warn" | "default";
  dur?: number;
}

export function toast(msg: unknown, opts?: ToastOpts): void {
  if (typeof window !== "undefined" && typeof window.toast === "function") {
    window.toast(msg, opts);
  }
}
