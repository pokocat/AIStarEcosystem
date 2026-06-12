"use client";

// 阶段轨 v4 — 设计真源:app-v4.jsx `StageRail2`。
// 项目设置逐项列出;剧集制作收敛为单一「剧集工作台」入口,
// 进入后左轨变为分集导航,步骤在顶部页签切换。
import * as React from "react";
import { ChevronLeft, Film, Lock } from "lucide-react";
import { STAGES, type StageDef, type StageKey, EPISODE_STAGE_KEYS } from "../stages-config";

interface StageRailProps {
  current: StageKey;
  locked: Partial<Record<StageKey, boolean>>;
  ep: number;
  onJump: (key: StageKey) => void;
  onHome?: () => void;
}

export function StageRail({ current, locked, ep, onJump, onHome }: StageRailProps) {
  const setup = STAGES.filter((s) => s.scope === "项目");
  const inEp = EPISODE_STAGE_KEYS.includes(current);
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
        className="row gap-2"
        style={{
          padding: "7px 10px",
          borderRadius: 11,
          marginBottom: 8,
          color: "var(--ink-3)",
          fontWeight: 600,
          fontSize: 12.5,
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-2)";
          e.currentTarget.style.color = "var(--ink)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-3)";
        }}
      >
        <ChevronLeft size={14} /> 回短剧工坊
      </button>

      <div className="faint" style={{ fontSize: 11, fontWeight: 700, padding: "10px 12px 4px", letterSpacing: ".06em" }}>
        项目设置 · 跨集共享
      </div>
      {setup.map((s) => (
        <StageItem key={s.key} s={s} current={current} locked={locked} onJump={onJump} />
      ))}

      <div className="faint" style={{ fontSize: 11, fontWeight: 700, padding: "14px 12px 4px", letterSpacing: ".06em" }}>
        剧集制作 · 逐集推进
      </div>
      <button
        type="button"
        onClick={() => {
          if (!inEp) onJump("epscript");
        }}
        className="row gap-3"
        style={{
          padding: "10px 11px",
          borderRadius: 12,
          textAlign: "left",
          background: inEp ? "var(--accent-soft)" : "transparent",
          color: inEp ? "var(--accent)" : "var(--ink-2)",
        }}
        onMouseEnter={(e) => {
          if (!inEp) e.currentTarget.style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          if (!inEp) e.currentTarget.style.background = "transparent";
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            flex: "none",
            display: "grid",
            placeItems: "center",
            background: inEp ? "var(--accent)" : "var(--surface-2)",
            color: inEp ? "#fff" : "var(--ink-3)",
          }}
        >
          <Film size={16} />
        </div>
        <div className="col" style={{ minWidth: 0, gap: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>剧集工作台</span>
          <span className="faint" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>
            第 {ep} 集 · 脚本→工厂→成片
          </span>
        </div>
      </button>
      {inEp && (
        <div className="faint" style={{ fontSize: 10.5, padding: "2px 12px 0", lineHeight: 1.5 }}>
          进入后左侧变为分集列表,步骤在顶部页签切换
        </div>
      )}
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
