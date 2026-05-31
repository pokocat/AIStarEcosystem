"use client";

// useConfirm() — Promise-based 二次确认（禁用浏览器原生 confirm，AGENTS §8）。
import * as React from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@ai-star-eco/ui/ui/alert-dialog";

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
}

type Resolver = (ok: boolean) => void;

const ConfirmCtx = React.createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOpts(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(o) => { if (!o) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{opts?.cancelText ?? "取消"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={opts?.tone === "danger" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
            >
              {opts?.confirmText ?? "确认"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  return React.useContext(ConfirmCtx);
}
