"use client";

// 「视频生成」表单里反复用到的几个小件：分节、分段按钮、图标按钮。
// 视觉照 apps/web-celebrity/DESIGN.md：选中态用唯一的紫色强调，其余走暖米中性色；
// 白卡片 + 1px 细线，不叠阴影。

import * as React from "react";
import { cn } from "@ai-star-eco/ui/ui/utils";

/** 表单里的一节：小号眉标 + 内容，节与节之间一条细线。 */
export function FormSection({
  title,
  extra,
  children,
  className,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2.5 border-t border-zinc-200 px-4 py-4 first:border-t-0", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="eyebrow shrink-0">{title}</span>
        {extra ? <div className="ml-auto flex min-w-0 items-center gap-2">{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** 分段按钮（选中态紫色）。 */
export function ChoiceButton({
  selected,
  disabled,
  onClick,
  title,
  className,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "min-w-0 rounded-[10px] border px-3 py-2 text-left transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-violet-500 bg-violet-50 text-violet-700"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 只有图标的小按钮（上移 / 下移 / 删除…），必须带 label 给读屏与悬停提示。 */
export function IconButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "mobile-icon-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors",
        "hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500",
        tone === "danger" ? "hover:text-rose-600" : "hover:text-zinc-800",
      )}
    >
      {children}
    </button>
  );
}
