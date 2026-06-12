"use client";

// 六阶段轨 — 设计真源:components.jsx `StageRail / StageItem`。
// 左侧固定 248px,项目阶段 1-3 + 剧集阶段 4-6,软锁可自由跳。
import * as React from "react";
import { Lock } from "lucide-react";
import { STAGES, type StageDef, type StageKey } from "../stages-config";

interface StageRailProps {
  current: StageKey;
  locked: Partial<Record<StageKey, boolean>>;
  onJump: (key: StageKey) => void;
  onHome?: () => void;
}

export function StageRail({ current, locked, onJump, onHome }: StageRailProps) {
  return (
    <nav
      className="col"
      style={{
        width: "var(--rail-w)",
        flex: "none",
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        padding: "16px 14px",
        gap: 4,
        overflowY: "auto",
      }}
    >
      <button
        type="button"
        onClick={onHome}
        className="row gap-3"
        style={{
          padding: "8px 10px",
          borderRadius: 12,
          marginBottom: 8,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--ink)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <img src="/icon.svg" alt="" style={{ width: 30, height: 30, borderRadius: 9, flex: "none" }} />
        <span style={{ fontWeight: 800, letterSpacing: ".01em" }}>短剧工坊</span>
      </button>

      <div
        className="faint"
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: "8px 12px 4px",
          letterSpacing: ".06em",
        }}
      >
        项目阶段 · 跨集共享
      </div>
      {STAGES.slice(0, 3).map((s) => (
        <StageItem key={s.key} s={s} current={current} locked={locked} onJump={onJump} />
      ))}

      <div
        className="faint"
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: "12px 12px 4px",
          letterSpacing: ".06em",
        }}
      >
        剧集阶段 · 针对当前集
      </div>
      {STAGES.slice(3).map((s) => (
        <StageItem key={s.key} s={s} current={current} locked={locked} onJump={onJump} />
      ))}
    </nav>
  );
}

function StageItem({
  s,
  current,
  locked,
  onJump,
}: {
  s: StageDef;
  current: StageKey;
  locked: Partial<Record<StageKey, boolean>>;
  onJump: (key: StageKey) => void;
}) {
  const active = current === s.key;
  const isLocked = !!locked[s.key];
  return (
    <button
      type="button"
      onClick={() => onJump(s.key)}
      className="row gap-3"
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        position: "relative",
        textAlign: "left",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--ink-2)",
        fontWeight: active ? 700 : 600,
        transition: "background .15s",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        className="num"
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          flex: "none",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 700,
          background: active ? "var(--accent)" : "var(--surface-2)",
          color: active ? "#fff" : "var(--ink-3)",
        }}
      >
        {s.no}
      </span>
      <span className="grow" style={{ fontSize: 13.5 }}>{s.name}</span>
      {isLocked && <Lock size={14} style={{ color: "var(--ink-3)" }} />}
    </button>
  );
}
