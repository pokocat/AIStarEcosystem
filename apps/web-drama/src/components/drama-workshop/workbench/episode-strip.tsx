"use client";

// 剧集概览带 — 设计真源:components.jsx `EpisodeStrip / Dot`。
// ④⑤⑥ 阶段顶部:全集卡片切换 + 完成度提示。
import * as React from "react";
import { ChevronDown, ChevronRight, Film, Lock } from "lucide-react";
import type { EpisodeOutline } from "@/mocks/drama-workshop";

interface EpisodeStripProps {
  ep: number;
  total: number;
  episodes: EpisodeOutline[];
  onChange: (n: number) => void;
}

interface EpisodeView {
  no: number;
  beat: string;
  hook: string;
  status: "done" | "current" | "wip" | "todo";
}

export function EpisodeStrip({ ep, total, episodes, onChange }: EpisodeStripProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  const list: EpisodeView[] = React.useMemo(
    () =>
      Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const e = episodes[i];
        const status: EpisodeView["status"] = e?.locked
          ? "done"
          : n === ep
            ? "current"
            : e
              ? "wip"
              : "todo";
        return {
          no: n,
          beat: e?.beat ?? "待续",
          hook: e?.hook ?? "尚未展开",
          status,
        };
      }),
    [ep, total, episodes],
  );

  const doneCount = list.filter((x) => x.status === "done").length;

  return (
    <div
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)",
        flex: "none",
      }}
    >
      <div className="row" style={{ padding: "8px 20px", gap: 12 }}>
        <button
          type="button"
          className="row gap-2"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            fontWeight: 700,
            fontSize: 13,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--ink)",
          }}
        >
          <Film size={15} style={{ color: "var(--accent)" }} />
          全 <b className="num">{total}</b> 集
          {collapsed ? (
            <ChevronRight size={14} style={{ color: "var(--ink-3)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--ink-3)" }} />
          )}
        </button>
        <span className="faint" style={{ fontSize: 12 }}>
          已锁 <b className="num" style={{ color: "#16a34a" }}>{doneCount}</b> · 当前正在做第{" "}
          <b className="num" style={{ color: "var(--accent)" }}>{ep}</b> 集
        </span>
        <span className="grow" />
        <div className="row gap-2 faint" style={{ fontSize: 11 }}>
          <Dot c="#16a34a" /> 已锁 <Dot c="var(--accent)" /> 当前 <Dot c="#cbd5e1" /> 未拍
        </div>
      </div>
      {!collapsed && (
        <div
          className="row scroll"
          style={{
            gap: 8,
            padding: "4px 20px 14px",
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          {list.map((e) => {
            const active = e.no === ep;
            const color =
              e.status === "done"
                ? "#16a34a"
                : e.status === "current" || active
                  ? "var(--accent)"
                  : e.status === "wip"
                    ? "#f59e0b"
                    : "#cbd5e1";
            return (
              <button
                key={e.no}
                type="button"
                onClick={() => onChange(e.no)}
                className="col"
                style={{
                  flex: "none",
                  width: 124,
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 12,
                  gap: 6,
                  background: active ? "var(--accent-soft)" : "var(--surface-2)",
                  border: active ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                  transition: "all .15s",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span
                    className="num"
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      color: active ? "var(--accent)" : "var(--ink)",
                    }}
                  >
                    {String(e.no).padStart(2, "0")}
                  </span>
                  {e.status === "done" ? <Lock size={13} style={{ color }} /> : <Dot c={color} />}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: active ? "var(--accent)" : "var(--ink-2)",
                  }}
                >
                  {e.beat}
                </div>
                <div
                  className="faint"
                  style={{
                    fontSize: 10.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                  }}
                >
                  {e.hook}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: c,
        flex: "none",
        display: "inline-block",
      }}
    />
  );
}
