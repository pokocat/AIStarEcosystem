"use client";

// 专业模式的线性步进条（v0.7）：替换原 short-drama 的扁平 tab，表达清晰的创作动线。
import * as React from "react";
import { Check, Lock } from "lucide-react";
import type { CreateStep } from "./useDramaDraft";

export interface StepDef {
  key: CreateStep;
  label: string;
  icon: React.ReactNode;
  /** 占位/未开放（如「审核」），灰显不可点。 */
  disabled?: boolean;
}

export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: StepDef[];
  current: CreateStep;
  onSelect: (k: CreateStep) => void;
}) {
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
      {steps.map((s, i) => {
        const active = s.key === current;
        const done = i < currentIdx && !s.disabled;
        const clickable = !s.disabled;
        return (
          <React.Fragment key={s.key}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect(s.key)}
              title={s.disabled ? "即将上线" : s.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: "var(--radius-pill)",
                cursor: clickable ? "pointer" : "not-allowed",
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                background: active
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : done
                    ? "color-mix(in srgb, var(--success) 12%, transparent)"
                    : "var(--surface-1)",
                color: active ? "var(--accent)" : done ? "var(--success)" : s.disabled ? "var(--fg-3)" : "var(--fg-1)",
                border: active
                  ? "1px solid color-mix(in srgb, var(--accent) 34%, transparent)"
                  : done
                    ? "1px solid color-mix(in srgb, var(--success) 28%, transparent)"
                    : "1px solid var(--line)",
                opacity: s.disabled ? 0.7 : 1,
                transition: "background 160ms ease, border-color 160ms ease",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  background: active ? "var(--accent)" : done ? "var(--success)" : "var(--surface-2)",
                  color: active || done ? "#fff" : "var(--fg-2)",
                }}
              >
                {done ? <Check size={11} strokeWidth={3} /> : s.disabled ? <Lock size={10} /> : i + 1}
              </span>
              {s.icon}
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <span aria-hidden style={{ width: 14, height: 1, background: "var(--line-2)", flexShrink: 0 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
