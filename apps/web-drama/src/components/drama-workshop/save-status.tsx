"use client";

// 草稿保存状态指示器（v0.76）—— 短剧工作台 / 短视频制作页底部悬浮小药丸。
// 与 useSaveStatus 配合：保存中 / 已自动保存 / 保存失败；idle 不渲染。
import * as React from "react";
import { Check, CloudOff } from "lucide-react";
import type { SaveStatus as Status } from "@/lib/use-save-status";

export function SaveStatus({ status }: { status: Status }) {
  if (status === "idle") return null;

  let icon: React.ReactNode;
  let text: string;
  let color = "var(--ink-2)";
  if (status === "saving") {
    icon = (
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          border: "2px solid var(--line)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          display: "inline-block",
          animation: "drama-spin .7s linear infinite",
        }}
      />
    );
    text = "保存中…";
  } else if (status === "saved") {
    icon = <Check size={13} />;
    text = "已自动保存";
    color = "#15803d";
  } else {
    icon = <CloudOff size={13} />;
    text = "保存失败 · 请检查网络";
    color = "#dc2626";
  }

  return (
    <div
      className="row gap-2 pop-in"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 999,
        padding: "6px 14px",
        boxShadow: "var(--shadow-lg)",
        fontSize: 12,
        fontWeight: 600,
        color,
        pointerEvents: "none",
      }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
