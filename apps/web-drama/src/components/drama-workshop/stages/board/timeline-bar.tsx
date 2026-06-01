"use client";

// 本场时间线条带 — 设计真源:screens-board.jsx `TimelineBar`。
// 各镜按时长比例分段;已完成镜=渐变实色 + check;未完成=灰底虚线;
// 超限镜右上角 ! 标记;active 加 2px 主色描边。
import * as React from "react";
import { Check, Layers } from "lucide-react";
import type { BoardShot } from "@/mocks/drama-workshop";

interface TimelineBarProps {
  shots: BoardShot[];
  active?: string | null;
  onJump: (shotId: string) => void;
}

export function TimelineBar({ shots, active, onJump }: TimelineBarProps) {
  const total = shots.reduce((s, x) => s + x.dur, 0);
  const done = shots.filter((s) => s.done).length;
  const allDone = done === shots.length;
  return (
    <div className="card" style={{ padding: 12, marginBottom: 14 }}>
      <div className="row" style={{ marginBottom: 8, justifyContent: "space-between" }}>
        <span className="row gap-2" style={{ fontSize: 11.5, fontWeight: 700 }}>
          <Layers size={14} style={{ color: "var(--accent)" }} /> 本场时间线
          <span
            className="tag num"
            style={{
              height: 18,
              padding: "0 7px",
              gap: 3,
              background: allDone ? "#dcfce7" : "var(--surface-2)",
              color: allDone ? "#15803d" : "var(--ink-2)",
            }}
          >
            {allDone && <Check size={11} />}已完成 {done}/{shots.length}
          </span>
        </span>
        <span className="faint num" style={{ fontSize: 11.5 }}>全长 {total}s</span>
      </div>
      <div className="row" style={{ gap: 3, height: 34 }}>
        {shots.map((s) => {
          const isDone = !!s.done;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(s.id)}
              title={`第${s.no}镜 · ${s.dur}s${isDone ? " · 已完成" : " · 未完成"}`}
              style={{
                flex: s.dur,
                borderRadius: 6,
                position: "relative",
                overflow: "hidden",
                background: isDone
                  ? s.engine === "avatar"
                    ? "linear-gradient(135deg,var(--accent),var(--accent-2))"
                    : "#22c55e"
                  : "var(--surface-2)",
                border: isActive
                  ? "2px solid var(--ink)"
                  : isDone
                    ? "2px solid transparent"
                    : "2px dashed var(--line)",
                color: isDone ? "#fff" : "var(--ink-3)",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                fontFamily: "var(--font-num)",
                cursor: "pointer",
              }}
            >
              {isDone && <Check size={11} style={{ color: "#fff" }} />}
              {s.no}
              {s.overLimit && (
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    right: 2,
                    color: isDone ? "#fff" : "#ef4444",
                    fontSize: 11,
                  }}
                >
                  !
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
