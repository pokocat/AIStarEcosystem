"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { ActionDialog } from "@/components/ActionDialog";

type ConfirmTone = "primary" | "danger" | "warning" | "success";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: LucideIcon;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  /** Affected object summary rendered above the reason field. */
  affected?: React.ReactNode;
}

export interface ConfirmResult {
  ok: boolean;
  reason: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<ConfirmResult>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (r: ConfirmResult) => void;
}

const DEFAULT_ICON: Record<ConfirmTone, LucideIcon> = {
  primary: ShieldAlert,
  danger: Trash2,
  warning: AlertTriangle,
  success: ShieldAlert,
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);
  const [open, setOpen] = React.useState(false);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise((resolve) => {
      setPending({ options, resolve });
      setOpen(true);
    });
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && pending) {
      pending.resolve({ ok: false, reason: "" });
      window.setTimeout(() => setPending(null), 120);
    }
  };

  const handleConfirm = (reason: string) => {
    if (!pending) return;
    pending.resolve({ ok: true, reason });
    setOpen(false);
    window.setTimeout(() => setPending(null), 120);
  };

  const opts = pending?.options;
  const tone: ConfirmTone = opts?.tone ?? "primary";
  const icon = opts?.icon ?? DEFAULT_ICON[tone];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <ActionDialog
          open={open}
          onOpenChange={handleOpenChange}
          title={opts.title}
          description={typeof opts.description === "string" ? opts.description : undefined}
          icon={icon}
          tone={tone}
          confirmLabel={opts.confirmLabel}
          cancelLabel={opts.cancelLabel}
          requireReason={opts.requireReason}
          reasonPlaceholder={opts.reasonPlaceholder}
          onConfirm={handleConfirm}
        >
          {opts.description && typeof opts.description !== "string" && (
            <div className="text-sm text-muted-foreground">{opts.description}</div>
          )}
          {opts.affected && (
            <div className="rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm">
              {opts.affected}
            </div>
          )}
          {opts.body}
        </ActionDialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
