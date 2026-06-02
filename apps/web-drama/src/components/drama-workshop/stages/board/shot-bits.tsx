"use client";

// 镜头卡通用零件 — 设计真源:screens-board.jsx
// CastChips / OverLimit / DoneToggle / ShotToolbar。
import * as React from "react";
import { Check, GripVertical, TriangleAlert, X } from "lucide-react";
import { Avatar } from "@/components/drama-ui";
import type { CharacterDef } from "@/mocks/drama-workshop";

interface CastChipsProps {
  ids: string[];
  chars: CharacterDef[];
  shotId?: string;
  onRefCast?: (shotId: string, charId: string) => void;
}

export function CastChips({ ids, chars, shotId, onRefCast }: CastChipsProps) {
  if (!ids || ids.length === 0) {
    return (
      <span className="faint" style={{ fontSize: 12 }}>无角色出场(空镜)</span>
    );
  }
  return (
    <div className="row gap-2" style={{ flexWrap: "wrap" }}>
      {ids.map((id) => {
        const c = chars.find((x) => x.id === id);
        if (!c) return null;
        return (
          <button
            key={id}
            type="button"
            className="row gap-2"
            onClick={() => shotId && onRefCast?.(shotId, id)}
            title="点击:本镜引用其数字人形象"
            style={{
              padding: "3px 10px 3px 3px",
              borderRadius: 999,
              background: "var(--accent-soft)",
              gap: 6,
              border: "none",
              cursor: onRefCast ? "pointer" : "default",
            }}
          >
            <Avatar theme={c.avatar} size={22} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function OverLimit() {
  return (
    <div
      className="row gap-2"
      style={{
        color: "#dc2626",
        fontSize: 12,
        fontWeight: 600,
        background: "#fef2f2",
        padding: "7px 10px",
        borderRadius: 9,
      }}
    >
      <TriangleAlert size={14} /> 特效镜参考素材超限(总时长 &gt; 15s)—— 缩短参考或拆成两镜
    </div>
  );
}

interface DoneToggleProps {
  done?: boolean;
  onToggle: (next: boolean) => void;
  label?: boolean;
}

export function DoneToggle({ done, onToggle, label }: DoneToggleProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!done);
      }}
      title={done ? "已完成 · 点击取消" : "标记为完成"}
      className="row gap-2"
      style={{
        height: 26,
        padding: done ? "0 10px 0 7px" : "0 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: done ? "#dcfce7" : "var(--surface-2)",
        color: done ? "#15803d" : "var(--ink-3)",
        border: done ? "1px solid #86efac" : "1px solid transparent",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: done ? "#22c55e" : "transparent",
          border: done ? "none" : "1.5px solid var(--ink-3)",
        }}
      >
        {done && <Check size={10} color="#fff" />}
      </span>
      {label !== false && (done ? "已完成" : "完成")}
    </button>
  );
}

interface ShotToolbarProps {
  id: string;
  i: number;
  count: number;
  onMove: (id: string, dir: -1 | 1) => void;
  onDel: (id: string) => void;
  vertical?: boolean;
}

export function ShotToolbar({ id, i, count, onMove, onDel, vertical }: ShotToolbarProps) {
  return (
    <div
      className="row gap-2"
      style={{ flexDirection: vertical ? "column" : "row" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn btn-icon btn-ghost btn-sm"
        title="上移"
        disabled={i === 0}
        style={{ opacity: i === 0 ? 0.35 : 1, width: 26, height: 26 }}
        onClick={() => onMove(id, -1)}
      >
        <GripVertical size={14} style={{ transform: "rotate(90deg)" }} />
      </button>
      <button
        type="button"
        className="btn btn-icon btn-ghost btn-sm"
        title="下移"
        disabled={i === count - 1}
        style={{ opacity: i === count - 1 ? 0.35 : 1, width: 26, height: 26 }}
        onClick={() => onMove(id, 1)}
      >
        <GripVertical size={14} style={{ transform: "rotate(-90deg)" }} />
      </button>
      <button
        type="button"
        className="btn btn-icon btn-ghost btn-sm"
        title="删除本镜"
        style={{ width: 26, height: 26, color: "#dc2626" }}
        onClick={() => onDel(id)}
      >
        <X size={15} />
      </button>
    </div>
  );
}
