"use client";

// v0.23 起强制：禁止用浏览器原生 confirm/alert/prompt（AGENTS.md §8）。
// 与 web-celebrity `components/common/confirm-dialog.tsx` 同模式，
// 迁移为 web-music 补齐 useConfirm()（此前 web-music 无该组件，
// PoseLibrary.tsx 的购买确认因此曾用 window.confirm，本次改用本组件）。
//
// 使用：
//   const { confirm, ConfirmHost } = useConfirm();
//
//   const handlePurchase = async () => {
//     const ok = await confirm({
//       title: "购买确认",
//       description: "需消耗 100 积分，确定？",
//     });
//     if (!ok) return;
//     // ... 真正干活
//   };
//
//   return (
//     <>
//       <Button onClick={handlePurchase}>购买</Button>
//       <ConfirmHost />
//     </>
//   );

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ai-star-eco/ui/ui/alert-dialog";
import { cn } from "@ai-star-eco/ui/ui/utils";

export interface ConfirmOptions {
  title: string;
  /** 副标题文案。可以是普通字符串或 ReactNode（多行 / 列表 / 红字强调等）。 */
  description?: React.ReactNode;
  /** 确认按钮文案，缺省「确认」。 */
  confirmText?: string;
  /** 取消按钮文案，缺省「取消」。 */
  cancelText?: string;
  /** danger = 红色确认按钮（解绑 / 删除 / 不可逆操作）。缺省 default。 */
  tone?: "default" | "danger";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void;
}

/**
 * 在组件内挂一次 `<ConfirmHost />`，然后 `await confirm(opts)` 返回 boolean。
 * 同时只允许一个弹窗在飞；并发 confirm 会被排队（FIFO），避免遮罩叠层。
 */
export function useConfirm() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);
  // 排队：第一个弹完关掉之后，自动起下一个。
  const queueRef = React.useRef<PendingConfirm[]>([]);

  const enqueue = React.useCallback((item: PendingConfirm) => {
    setPending((cur) => {
      if (cur == null) return item;
      queueRef.current.push(item);
      return cur;
    });
  }, []);

  const confirm = React.useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        enqueue({ ...opts, resolve });
      }),
    [enqueue],
  );

  const close = React.useCallback((result: boolean) => {
    setPending((cur) => {
      if (cur) cur.resolve(result);
      const next = queueRef.current.shift() ?? null;
      return next;
    });
  }, []);

  const ConfirmHost = React.useCallback(() => {
    const isDanger = pending?.tone === "danger";
    return (
      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => {
          // Radix 在 ESC / 点遮罩时把 open 切 false —— 视作取消。
          if (!o && pending !== null) close(false);
        }}
      >
        <AlertDialogContent className="z-[200]" overlayClassName="z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description != null && (
              <AlertDialogDescription asChild>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {pending.description}
                </div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {pending?.cancelText ?? "取消"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={cn(
                isDanger &&
                  "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600/40",
              )}
            >
              {pending?.confirmText ?? "确认"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [pending, close]);

  return { confirm, ConfirmHost };
}
