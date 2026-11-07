"use client";

import * as React from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@ai-star-eco/ui/ui/alert-dialog";

/** 不用浏览器原生 confirm：一个 AlertDialog，返回用户点没点确定。 */
type ConfirmRequest = { title: string; description: React.ReactNode; confirmLabel: string; resolve: (ok: boolean) => void };

export function useConfirmDialog() {
  const [request, setRequest] = React.useState<ConfirmRequest | null>(null);
  const confirm = (title: string, description: React.ReactNode, confirmLabel: string) =>
    new Promise<boolean>((resolve) => setRequest({ title, description, confirmLabel, resolve }));
  const close = (ok: boolean) => { request?.resolve(ok); setRequest(null); };
  const dialog = <AlertDialog open={!!request} onOpenChange={(open) => { if (!open) close(false); }}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{request?.title}</AlertDialogTitle><AlertDialogDescription asChild><div>{request?.description}</div></AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel onClick={() => close(false)}>取消</AlertDialogCancel><AlertDialogAction onClick={() => close(true)}>{request?.confirmLabel}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { confirm, dialog };
}
