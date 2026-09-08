"use client";

// 属性面板的表单原语 —— 统一字号、统一 label 排版、统一折叠块。
//
// 字号下限（design.md §5，评审要求）：可编辑输入 / 主按钮 / 属性说明 **≥14px**，
// 辅助字段标签 12px（`.field-label`）。面板宽度不变，长文靠换行而不是缩小字号。

import * as React from "react";
import { ChevronDown, Loader2, Upload } from "lucide-react";
import { USE_MOCK } from "@ai-star-eco/api-client";
import { MockBadge } from "@/ip/common/mock-badge";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label block mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-1.5 text-[14px] leading-[1.7]" style={{ color: "var(--ink-2)" }}>{hint}</span>}
    </label>
  );
}

const controlStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line-2)",
  color: "var(--ink)",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-10 px-3 rounded-lg text-[14px] outline-none transition focus:border-[var(--primary)]"
      style={{ ...controlStyle, ...props.style }}
    />
  );
}





/** 图片上传（点选 + 拖入）。上传本身由调用方给的 onPick 承担。 */
