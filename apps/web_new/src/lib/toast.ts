// Thin wrapper over sonner so every page uses one consistent toast API.
// Use these instead of alert() or silent no-op handlers.

import { toast as sonnerToast } from "sonner";

type ToastOpts = { description?: string };

export const toast = {
  success: (title: string, opts?: ToastOpts) =>
    sonnerToast.success(title, { description: opts?.description }),
  error: (title: string, opts?: ToastOpts) =>
    sonnerToast.error(title, { description: opts?.description }),
  info: (title: string, opts?: ToastOpts) =>
    sonnerToast(title, { description: opts?.description }),
};
