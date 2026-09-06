"use client";

// 左侧节点面板 —— 拖到画布或点一下即在视口中央添加。附模板说明。

import * as React from "react";
import { GripVertical, Info } from "lucide-react";
import type { IpNodeType } from "@ai-star-eco/types";
import { NODE_META, PALETTE_ORDER, portColor } from "@/lib/node-meta";

export const NODE_DRAG_MIME = "application/x-ipstudio-node";

interface PaletteProps {
  onAdd: (type: IpNodeType) => void;
  templateName?: string;
  templateSummary?: string;
}

export function NodePalette({ onAdd, templateName, templateSummary }: PaletteProps) {
  return (
    <aside
      className="w-[212px] shrink-0 flex flex-col overflow-y-auto scrollbar-thin"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }}
    >
      <div className="px-3.5 pt-4 pb-2">
        <div className="field-label">节点</div>
        <p className="mt-1 text-[10.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          拖到画布上，或点一下加到画布中央。
        </p>
      </div>

      <div className="px-2.5 pb-3 space-y-1">
        {PALETTE_ORDER.map((type) => {
          const meta = NODE_META[type];
          const Icon = meta.icon;
          return (
            <button
              key={type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(NODE_DRAG_MIME, type);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAdd(type)}
              className="group w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-grab active:cursor-grabbing"
              style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
              title={meta.hint}
            >
              <span
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-[1px]"
                style={{ background: "var(--surface-2)" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: portColor(meta.flow) }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold truncate" style={{ color: "var(--ink)" }}>
                  {meta.label}
                </span>
                <span className="block text-[10px] leading-snug line-clamp-2" style={{ color: "var(--ink-3)" }}>
                  {meta.hint}
                </span>
              </span>
              <GripVertical className="w-3 h-3 shrink-0 mt-1 opacity-0 transition group-hover:opacity-40" style={{ color: "var(--ink-3)" }} />
            </button>
          );
        })}
      </div>

      {templateName && (
        <div className="mt-auto m-2.5 p-3 rounded-xl" style={{ background: "var(--primary-tint)", border: "1px solid var(--primary-soft)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Info className="w-3 h-3 shrink-0" style={{ color: "var(--primary-700)" }} />
            <span className="text-[11px] font-bold truncate" style={{ color: "var(--primary-700)" }} title={templateName}>
              {templateName}
            </span>
          </div>
          <p className="text-[10.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {templateSummary ?? "节点已按这套工作流排好，填照片就能跑。"}
          </p>
        </div>
      )}
    </aside>
  );
}
