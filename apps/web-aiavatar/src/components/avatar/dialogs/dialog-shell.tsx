"use client";

import * as React from "react";
import { X } from "lucide-react";

/** 轻量受控弹窗壳（深色），避免引入额外 radix 依赖。 */
export function DialogShell({
  title, onClose, children, footer, wide,
}: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-zinc-800 bg-[var(--bg-1)] shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
