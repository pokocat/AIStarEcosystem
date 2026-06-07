"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@ai-star-eco/ui/ui/sheet";
import { cn } from "@ai-star-eco/ui/ui/utils";

export function MobileFilterSheet({
  title,
  summary,
  activeCount = 0,
  triggerLabel = "筛选",
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  activeCount?: number;
  triggerLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mobile-touch-target inline-flex items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition",
          activeCount > 0
            ? "border-violet-400/50 bg-violet-500/10 text-violet-700"
            : "border-zinc-200 bg-white text-zinc-700",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {triggerLabel}
        {activeCount > 0 && (
          <span className="rounded-full bg-violet-600 px-1.5 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[82dvh] overflow-hidden rounded-t-2xl border-zinc-200 bg-white p-0"
        >
          <div className="border-b border-zinc-200 px-5 py-4">
            <SheetTitle className="text-base font-semibold text-zinc-900">
              {title}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-zinc-500">
              {summary ?? "调整当前列表的筛选条件"}
            </SheetDescription>
          </div>
          <div className="max-h-[calc(82dvh-72px)] overflow-y-auto px-5 py-4">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
