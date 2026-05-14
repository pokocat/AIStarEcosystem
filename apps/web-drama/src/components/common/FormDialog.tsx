"use client";

// FormDialog — 表单弹窗骨架：标题 + body slot + 提交按钮。
// 调用方传 onSubmit，FormDialog 负责 loading 态 / Enter 提交 / 关闭。

import * as React from "react";
import { Dialog } from "./Dialog";
import { Button } from "@/components/premium";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  width?: number;
  onSubmit: () => void | Promise<void>;
  children: React.ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "提交",
  cancelLabel = "取消",
  width = 520,
  onSubmit,
  children,
}: Props) {
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (busy) return;
    try {
      setBusy(true);
      await onSubmit();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      title={title}
      description={description}
      width={width}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant="primary" size="md" loading={busy} onClick={() => handleSubmit()}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>{children}</form>
    </Dialog>
  );
}
