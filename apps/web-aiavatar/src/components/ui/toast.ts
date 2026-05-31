// ============================================================
// 全局 Toast — 从原型 ui.jsx 的 toast() 1:1 移植。
// 命令式 DOM（无需 Provider），桌面 / 移动通用。SSR 安全（无 window 直接 no-op）。
// ============================================================

export interface ToastOptions {
  icon?: string;
  tone?: string;
  ms?: number;
}

export function toast(msg: string, opts: ToastOptions = {}): void {
  if (typeof document === "undefined") return;
  let host = document.getElementById("__toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "__toast-host";
    host.style.cssText =
      "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:2147483600;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  const icon = opts.icon || "✓";
  el.style.cssText =
    "display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:12px;background:var(--bg-2);border:1px solid var(--line-2);color:var(--ink-0);font-family:var(--font-ui);font-size:13.5px;box-shadow:var(--shadow-3);opacity:0;transform:translateY(8px);transition:all .25s";
  const iconSpan = document.createElement("span");
  iconSpan.style.cssText = `color:${opts.tone || "var(--accent)"};font-weight:700`;
  iconSpan.textContent = icon;
  el.appendChild(iconSpan);
  el.appendChild(document.createTextNode(msg));
  host.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 280);
  }, opts.ms || 2200);
}
