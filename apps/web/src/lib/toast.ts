// Thin wrapper over sonner so every page uses one consistent toast API.
// Use these instead of alert() or silent no-op handlers.

import { toast as sonnerToast } from "sonner";

type ToastOpts = {
  description?: string;
  /** Sonner duration in ms; sonner defaults to 4000. Pass Infinity for sticky. */
  duration?: number;
  /** Optional action button (e.g. "撤销" / "Undo"). */
  action?: { label: string; onClick: () => void };
};

const buildOpts = (opts?: ToastOpts) => {
  if (!opts) return undefined;
  return {
    description: opts.description,
    duration: opts.duration,
    action: opts.action
      ? { label: opts.action.label, onClick: opts.action.onClick }
      : undefined,
  };
};

export const toast = {
  success: (title: string, opts?: ToastOpts) =>
    sonnerToast.success(title, buildOpts(opts)),
  error: (title: string, opts?: ToastOpts) =>
    sonnerToast.error(title, buildOpts(opts)),
  info: (title: string, opts?: ToastOpts) =>
    sonnerToast(title, buildOpts(opts)),
};
