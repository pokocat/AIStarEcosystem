"use client";

// v0.23: 替代 `window.confirm` 的统一 UI 组件 + Hook（apps/web 本地版，与
// apps/web-celebrity / apps/web-music 的 common/confirm-dialog.tsx 同构，
// 仅把 @ai-star-eco/ui 的 shadcn 引用换成本仓库内 ./ui 下的本地副本，
// 因为 apps/web 是独立 npm 项目、不在 pnpm workspace 内，无法引用共享包）。
//
// 使用：
//   const { confirm, ConfirmHost } = useConfirm();
//
//   const handleDelete = async () => {
//     const ok = await confirm({
//       title: "解绑账号",
//       description: "解绑后将无法用此账号继续发布。",
//       confirmText: "解绑",
//       tone: "danger",
//     });
//     if (!ok) return;
//     // ... 真正干活
//   };
//
//   return (
//     <>
//       <Button onClick={handleDelete}>解绑</Button>
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
} from "@/components/ui/alert-dialog";
import { cn } from "@/components/ui/utils";

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
        <AlertDialogContent>
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
