"use client";
// ============================================================
// PipelineNav — 7 步向导条（从原型 shell.jsx 的 WizardBar 移植，按 avatar 作用域）。
// material → sampling → drafting → studio → output → finalize → derive
// ============================================================
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { modeLabel } from "@/constants/aiavatar-ui";
import type { AiAvatarCreationMode } from "@ai-star-eco/types/ai-avatar";

export const WIZARD = [
  { key: "material", no: "02", label: "素材准备" },
  { key: "sampling", no: "03", label: "打样" },
  { key: "drafting", no: "04", label: "草稿迭代" },
  { key: "studio", no: "05", label: "精细化精调" },
  { key: "output", no: "06", label: "分视角出图" },
  { key: "finalize", no: "07", label: "定稿确认" },
  { key: "derive", no: "08", label: "衍生 · 入库" },
] as const;

export type WizardStep = (typeof WIZARD)[number]["key"];

export function PipelineNav({
  avatarId,
  mode,
  current,
}: {
  avatarId: string;
  mode: AiAvatarCreationMode;
  current: WizardStep;
}) {
  const router = useRouter();
  const idx = WIZARD.findIndex((w) => w.key === current);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "14px 36px", borderBottom: "1px solid var(--line)", background: "var(--bg-0)", overflowX: "auto" }}>
      <button
        onClick={() => router.push(`/avatars/${avatarId}`)}
        style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", color: "var(--ink-2)", cursor: "pointer", fontSize: 12.5, fontFamily: "var(--font-mono)", flexShrink: 0, paddingRight: 20 }}
      >
        <Icons.back size={14} />
        {modeLabel(mode)}
      </button>
      {WIZARD.map((w, i) => {
        const done = i < idx;
        const active = i === idx;
        const clickable = done || active;
        const pill = (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              cursor: clickable ? "pointer" : "default",
              background: active ? "var(--accent-soft)" : "transparent",
              border: "1px solid " + (active ? "var(--accent-line)" : "transparent"),
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                background: active ? "var(--accent)" : done ? "transparent" : "var(--bg-3)",
                color: active ? "#1a1205" : done ? "var(--accent)" : "var(--ink-2)",
                border: done ? "1px solid var(--accent-line)" : "none",
              }}
            >
              {done ? <Icons.check size={12} stroke={2.6} /> : w.no}
            </span>
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--accent-hi)" : done ? "var(--ink-1)" : "var(--ink-2)", whiteSpace: "nowrap" }}>{w.label}</span>
          </span>
        );
        return (
          <div key={w.key} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {i > 0 && <span style={{ width: 28, height: 1, background: done ? "var(--accent-line)" : "var(--line-2)", margin: "0 4px" }} />}
            {clickable ? <Link href={`/avatars/${avatarId}/${w.key}`}>{pill}</Link> : pill}
          </div>
        );
      })}
    </div>
  );
}
