"use client";

// v0.22: 任务追踪「批次详情抽屉」。点 BatchSummaryCard 的「详情▶」打开。
//
// 内容：
//   - 顶部 summary header（与卡片同字段，但隐藏底排按钮，单点 source-of-truth）
//   - 主体直接嵌 PublishJobList projectId={projectId} —— 复用现有的轮询 / 状态 chip /
//     行级 start/cancel/retry/interact 按钮，无需重写
//
// 关闭策略：父级控制 open；onClose 时父级清掉 selectedProjectId 即可。
// 轮询：PublishJobList 内部已经有 2.5s 自适应轮询，drawer 关闭时组件 unmount
//      → 它的 effect cleanup 会自动停掉 setInterval。

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@ai-star-eco/ui/ui/sheet";
import type { PublishBatchSummary } from "@ai-star-eco/types/publish-job";
import { PublishJobList } from "./PublishJobList";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 当前选中的批次摘要；null = drawer 应关闭 */
  batch: PublishBatchSummary | null;
}

const SOURCE_LABEL: Record<PublishBatchSummary["source"], string> = {
  mixcut: "混剪批次",
  manual: "手动分发",
  other: "历史散件",
};

export function BatchDetailDrawer({ open, onClose, batch }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        {batch && (
          <>
            <SheetHeader className="border-b border-zinc-200 px-5 py-4 gap-1">
              <SheetTitle className="text-base font-semibold flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">
                  {SOURCE_LABEL[batch.source]}
                </span>
                {batch.displayTitle}
              </SheetTitle>
              <SheetDescription className="text-xs text-zinc-500">
                {batch.totalJobs} 条任务 · 进度 {batch.progressPct}% · 创建于{" "}
                {new Date(batch.firstCreatedAt).toLocaleString()}
              </SheetDescription>
              <div className="mt-2 text-[11px] text-zinc-500 font-mono break-all" title={batch.projectId}>
                projectId: {batch.projectId}
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* PublishJobList 内部自带 2.5s 轮询 + 行级 cancel/retry/start/interact —— 直接复用 */}
              <PublishJobList projectId={batch.projectId} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
