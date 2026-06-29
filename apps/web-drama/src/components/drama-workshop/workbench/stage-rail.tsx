"use client";

// 阶段轨 v4 — 设计真源:app-v4.jsx `StageRail2`。
// 项目设置逐项列出;剧集制作收敛为单一「剧集工作台」入口,
// 进入后左轨变为分集导航,步骤在顶部页签切换。
import * as React from "react";
import { ChevronLeft, Film, Network, ScrollText } from "lucide-react";
import { STAGE_BY_KEY, type StageKey, EPISODE_STAGE_KEYS } from "../stages-config";

interface StageRailProps {
  current: StageKey;
  locked: Partial<Record<StageKey, boolean>>;
  ep: number;
  /** v0.79：互动剧项目额外显示「互动编排」入口。 */
  interactive?: boolean;
  /** v0.79：非互动剧项目显示「转换为互动剧」入口（把线性大纲转成可分支的互动剧）。 */
  onConvert?: () => void;
  onJump: (key: StageKey) => void;
  onHome?: () => void;
}

export function StageRail({ current, ep, interactive, onConvert, onJump, onHome }: StageRailProps) {
  const inEp = EPISODE_STAGE_KEYS.includes(current);
  const branch = STAGE_BY_KEY.branch;
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

      {/* v0.88：两步流程 —— 短剧设定（合并选题/大纲/角色场景）/ 剧集工作台。 */}
      <button
        type="button"
        onClick={() => onJump("outline")}
        className="row gap-3"
        style={{
          padding: "10px 11px",
          borderRadius: 12,
          textAlign: "left",
          background: !inEp && current !== "branch" ? "var(--accent-soft)" : "transparent",
          color: !inEp && current !== "branch" ? "var(--accent)" : "var(--ink-2)",
        }}
        onMouseEnter={(e) => {
          if (inEp || current === "branch") e.currentTarget.style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          if (inEp || current === "branch") e.currentTarget.style.background = "transparent";
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
            background: !inEp && current !== "branch" ? "var(--accent)" : "var(--surface-2)",
            color: !inEp && current !== "branch" ? "#fff" : "var(--ink-3)",
          }}
        >
          <ScrollText size={16} />
        </div>
        <div className="col" style={{ minWidth: 0, gap: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>短剧设定</span>
          <span className="faint" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>
            剧情大纲 · 角色 · 场景
          </span>
        </div>
      </button>

      {interactive && (
        <>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700, padding: "14px 12px 4px", letterSpacing: ".06em" }}>
            互动剧 · 分支编排
          </div>
          <button
            type="button"
            onClick={() => onJump("branch")}
            className="row gap-3"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              textAlign: "left",
              background: current === "branch" ? "var(--accent-soft)" : "transparent",
              color: current === "branch" ? "var(--accent)" : "var(--ink-2)",
              fontWeight: current === "branch" ? 700 : 600,
            }}
            onMouseEnter={(e) => {
              if (current !== "branch") e.currentTarget.style.background = "var(--surface-2)";
            }}
            onMouseLeave={(e) => {
              if (current !== "branch") e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                flex: "none",
                display: "grid",
                placeItems: "center",
                background: current === "branch" ? "var(--accent)" : "var(--surface-2)",
                color: current === "branch" ? "#fff" : "var(--ink-3)",
              }}
            >
              <Network size={13} />
            </span>
            <span className="grow" style={{ fontSize: 13.5 }}>{branch?.name ?? "互动编排"}</span>
          </button>
          <div className="faint" style={{ fontSize: 10.5, padding: "2px 12px 0", lineHeight: 1.5 }}>
            剧集分支图 / 时间轴互动点 / 全局标记 / 试玩 / 导出
          </div>
        </>
      )}

      {!interactive && onConvert && (
        <button
          type="button"
          onClick={onConvert}
          className="row gap-2"
          title="把当前分集大纲转成可分支的互动剧（不删原集）"
          style={{ marginTop: 8, padding: "8px 12px", borderRadius: 11, textAlign: "left", color: "var(--ink-3)", fontSize: 12, fontWeight: 600 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
        >
          <Network size={13} /> 转换为互动剧
        </button>
      )}

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
