"use client";

// 草稿保存状态指示器（v0.89）—— 顶栏右上角内联「状态说明」，实时反映自动保存进度。
// 设计：不再是底部悬浮药丸（浮框），而是随各页 header 排版的一行轻量状态文字，
//       常驻显示「自动保存」，随编辑实时切到 保存中 / 已保存 / 未保存，颜色与图标平滑过渡。
import * as React from "react";
import { Check, Cloud, CloudOff } from "lucide-react";
import type { SaveStatus as Status } from "@/lib/use-save-status";

export function SaveStatus({ status }: { status: Status }) {
  let icon: React.ReactNode;
  let text: string;
  let color = "var(--ink-3)";

  if (status === "saving") {
    icon = (
      <span
        aria-hidden
        style={{
          width: 11,
          height: 11,
          border: "2px solid var(--line)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          display: "inline-block",
          animation: "drama-spin .7s linear infinite",
        }}
      />
    );
    text = "保存中";
  } else if (status === "saved") {
    icon = <Check size={13} strokeWidth={2.6} />;
    text = "已保存";
    color = "var(--success)";
  } else if (status === "error") {
    icon = <CloudOff size={13} />;
    text = "未保存";
    color = "var(--danger)";
  } else {
    // idle：常驻轻提示，让用户知道改动会自动保存。
    icon = <Cloud size={13} />;
    text = "自动保存";
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="row gap-1"
      style={{
        fontSize: 12,
        fontWeight: 600,
        color,
        whiteSpace: "nowrap",
        userSelect: "none",
        flex: "none",
        transition: "color .2s ease",
      }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
