"use client";

// 分集导航(左轨) — 设计真源 v4 screens-episode-v4.jsx `EpisodeRail4`:
// 进入剧集制作后替代阶段轨;窄视口自动收窄为图标轨。
import * as React from "react";
import { ChevronLeft } from "lucide-react";
import type { EpisodeOutline } from "@/mocks/drama-workshop";

interface EpisodeRailProps {
  ep: number;
  total: number;
  episodes: EpisodeOutline[];
  /** 窄视口收窄为 72px 图标轨 */
  slim?: boolean;
  onEp: (n: number) => void;
  onBack: () => void;
}

export function EpisodeRail({ ep, total, episodes, slim, onEp, onBack }: EpisodeRailProps) {
  return (
    <nav
      className="col"
      style={{
        width: slim ? 72 : "var(--rail-w)",
        flex: "none",
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        padding: slim ? "14px 10px" : "14px 12px",
        gap: 4,
        minHeight: 0,
        transition: "width .2s",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        title="回项目设置"
        className="row gap-2"
        style={{
          padding: "7px 10px",
          borderRadius: 11,
          marginBottom: 6,
          color: "var(--ink-3)",
          fontWeight: 600,
          fontSize: 12.5,
          flex: "none",
          justifyContent: slim ? "center" : "flex-start",
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
        <ChevronLeft size={14} /> {!slim && "项目设置"}
      </button>
      <div
        className="row"
        style={{ padding: slim ? "0 0 6px" : "0 10px 6px", flex: "none", justifyContent: slim ? "center" : "flex-start" }}
      >
        {slim ? (
          <span className="faint num" style={{ fontSize: 10.5, fontWeight: 700 }}>
            {ep}/{total}
          </span>
        ) : (
          <>
            <span className="faint" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em" }}>
              分集 · 共 {total} 集
            </span>
            <span className="grow" />
            <span className="faint num" style={{ fontSize: 11 }}>第 {ep} 集</span>
          </>
        )}
      </div>

      <div className="scroll col gap-1 grow" style={{ minHeight: 0, paddingRight: 2 }}>
        {episodes.map((e) => {
          const on = e.no === ep;
          const hasScript = !!e.locked;
          return (
            <button
              key={e.no}
              type="button"
              onClick={() => onEp(e.no)}
              title={`第 ${e.no} 集 · ${e.beat}${hasScript ? " · 脚本已锁" : ""}`}
              className="row gap-2"
              style={{
                padding: slim ? "6px 0" : "8px 9px",
                borderRadius: 11,
                textAlign: "left",
                alignItems: slim ? "center" : "flex-start",
                justifyContent: slim ? "center" : "flex-start",
                background: on ? "var(--accent-soft)" : "transparent",
                position: "relative",
              }}
              onMouseEnter={(ev) => {
                if (!on) ev.currentTarget.style.background = "var(--surface-2)";
              }}
              onMouseLeave={(ev) => {
                if (!on) ev.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="num"
                style={{
                  flex: "none",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11.5,
                  fontWeight: 800,
                  background: on ? "var(--accent)" : "var(--surface-2)",
                  color: on ? "#fff" : "var(--ink-3)",
                  position: "relative",
                }}
              >
                {e.no}
                {slim && hasScript && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#22c55e",
                      border: "1.5px solid var(--surface)",
                    }}
                  />
                )}
              </span>
              {!slim && (
                <span className="col" style={{ minWidth: 0, gap: 2 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: on ? 700 : 600,
                      color: on ? "var(--accent)" : "var(--ink-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                      maxWidth: 118,
                    }}
                  >
                    {e.beat}
                  </span>
                  <span className="row gap-1" style={{ fontSize: 10 }}>
                    {hasScript ? (
                      <span className="row" style={{ gap: 3, color: "#15803d", fontWeight: 700 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
                        脚本已锁
                      </span>
                    ) : (
                      <span className="faint">待制作</span>
                    )}
                  </span>
                </span>
              )}
            </button>
          );
        })}
        {total > episodes.length && !slim && (
          <div
            className="col center"
            style={{ padding: "12px 8px", borderRadius: 11, border: "1.5px dashed var(--line)", gap: 4, marginTop: 4 }}
          >
            <span className="faint num" style={{ fontSize: 11, fontWeight: 700 }}>
              第 {episodes.length + 1}-{total} 集
            </span>
            <span className="faint" style={{ fontSize: 10.5, textAlign: "center", lineHeight: 1.5 }}>
              大纲铺到哪,这里就到哪
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}
