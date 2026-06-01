"use client";

import * as React from "react";
import { X } from "lucide-react";

/** 轻量受控弹窗壳（浅色工作台主题）。Esc 关闭 + 点遮罩关闭。 */
export function DialogShell({
  title, description, onClose, children, footer, wide,
}: {
  title: string; description?: string; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[oklch(0.3_0.02_266_/_0.4)] backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] shadow-[var(--shadow-lg)]`}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--fg-0)]">{title}</h2>
            {description && <p className="meta mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="关闭"
            className="-mr-1 shrink-0 rounded-md p-1 text-[var(--fg-3)] transition hover:bg-[var(--bg-2)] hover:text-[var(--fg-1)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--bg-1)] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
