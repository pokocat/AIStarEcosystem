"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 「这张画布在别处被改过了」—— 保存撞上别处编辑之后给用户选的弹窗。
//
// 之前的处理是顶栏一个小徽标「有更新的版本 · 刷新后再改」，没有任何能点的东西；
// 而冲突之后所有经过保存的操作都在报同一句错，用户只看到「页面一直在报错」，
// 却不知道该做什么（按 F5 还会被「离开页面？」拦一下，因为改动没存上）。
//
// 这里把三条出路摆明白，每条都写清楚会丢什么、不会丢什么。推荐的是「另存一份再换最新」：
// 它什么都不丢。弹窗可以先关掉去画布上看一眼再决定，顶栏的徽标会变成能点的「处理冲突」。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Modal } from "antd";
import { AlertTriangle } from "lucide-react";
import type { ConflictResolution, ConflictResolutionResult } from "@/canvas-bridge/project-sync";

export type CanvasConflictDialogProps = {
  open: boolean;
  onClose: () => void;
  resolve: (choice: ConflictResolution) => Promise<ConflictResolutionResult>;
  /** 另存成功之后告诉宿主（它会给一个能点过去的提示）。 */
  onCopySaved?: (copyId: string) => void;
};

const OPTIONS: Array<{ key: ConflictResolution; title: string; detail: string; busy: string; primary?: boolean; danger?: boolean }> = [
  { key: "save-copy", title: "另存为新画布并加载最新版本", detail: "此页面的改动另存为新画布，当前画布加载其他窗口保存的版本，两份内容都会保留。", busy: "正在另存…", primary: true },
  { key: "take-theirs", title: "加载最新版本", detail: "使用其他窗口保存的版本，此页面未保存的改动将丢失。", busy: "正在加载…" },
  { key: "keep-mine", title: "保留此页改动", detail: "保存此页面的改动，其他窗口保存的版本将被覆盖。", busy: "正在保存…", danger: true },
];

export function CanvasConflictDialog({ open, onClose, resolve, onCopySaved }: CanvasConflictDialogProps) {
  const [busy, setBusy] = React.useState<ConflictResolution | null>(null);
  const [note, setNote] = React.useState("");
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  React.useEffect(() => { if (open) setNote(""); }, [open]);

  const choose = async (choice: ConflictResolution) => {
    if (busy) return;
    setBusy(choice); setNote("");
    try {
      const result = await resolve(choice);
      if (!alive.current) return;
      if (result.copyId) onCopySaved?.(result.copyId);
      if (result.outcome === "resolved") { onClose(); return; }
      if (result.outcome === "conflict") setNote("其他窗口又保存了新版本，请重新选择。");
      // failed：具体原因已经由通知层说了，这里只把按钮放开
    } finally { if (alive.current) setBusy(null); }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={!busy}
      mask={{ closable: false }}
      keyboard={!busy}
      width={460}
      getContainer={() => document.querySelector<HTMLElement>(".ip-surface") ?? document.body}
      className="canvas-conflict-dialog"
      title={<span className="inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4" style={{ color: "var(--err)" }} />此画布已在其他窗口修改</span>}
    >
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
        此画布可能已在其他窗口或设备上修改并保存。此页面还有未保存的改动，两份内容无法自动合并，请选择处理方式：
      </p>
      <div className="flex flex-col gap-2 mt-4">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={!!busy}
            onClick={() => void choose(option.key)}
            className="text-left rounded-xl px-4 py-3 transition hover:brightness-95 disabled:opacity-60"
            style={option.primary
              ? { background: "var(--action)", color: "var(--on-action)" }
              : { background: "var(--surface-2)", color: option.danger ? "var(--err)" : "var(--ink-1)" }}
          >
            <span className="block text-[13px] font-bold">{busy === option.key ? option.busy : option.title}</span>
            <span className="block text-[12px] mt-0.5" style={{ opacity: 0.85 }}>{option.detail}</span>
          </button>
        ))}
      </div>
      {note && <p role="status" className="text-[12px] mt-3" style={{ color: "var(--err)" }}>{note}</p>}
      <p className="text-[12px] mt-3" style={{ color: "var(--ink-3)" }}>关闭后可点击顶栏「处理冲突」重新打开。处理冲突前，此页面的改动不会自动保存。</p>
    </Modal>
  );
}
