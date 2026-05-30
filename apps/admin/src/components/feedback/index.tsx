"use client";

import * as React from "react";
import { ToastProvider } from "./Toaster";
import { ConfirmProvider } from "./ConfirmProvider";
import { GlobalErrorNotifier } from "./GlobalErrorNotifier";

export { useToast } from "./Toaster";
export { useConfirm } from "./ConfirmProvider";
export type { ConfirmOptions, ConfirmResult } from "./ConfirmProvider";

export function FeedbackProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GlobalErrorNotifier />
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
