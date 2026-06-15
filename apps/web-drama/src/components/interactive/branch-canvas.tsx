"use client";

// 互动剧分支图画布（v0.79）—— 自绘 SVG，无第三方图库。
// 剧集按分支深度 BFS 左→右分层铺开；贝塞尔连线把互动选项文案标在线上；
// 起始集（★）/ 结局集（旗）/ 孤立节点（虚线）分别高亮；节点带出片态圆点。
// 点节点 = 选中（父级打开单集编辑器）；点节点「拉线」手柄 → 再点目标 = 请求父级接一条分支。
import * as React from "react";
import { Flag, GitBranch, Star, Film } from "lucide-react";
import type { InteractiveStoryData } from "@/lib/interactive-types";
import { layoutGraph, NODE_SIZE, type GraphLayout } from "@/lib/interactive-graph";

interface Props {
  data: InteractiveStoryData;
  selectedId: string | null;
  connectFrom: string | null;
  onSelect: (id: string) => void;
  onConnectStart: (id: string) => void;
  onConnectTo: (id: string) => void;
  onCancelConnect: () => void;
}

const STATUS_DOT: Record<string, string> = {
  idle: "var(--ink-3)",
  ready: "var(--success)",
};

export function BranchCanvas({
  data,
  selectedId,
  connectFrom,
  onSelect,
  onConnectStart,
  onConnectTo,
  onCancelConnect,
}: Props) {
  const layout: GraphLayout = React.useMemo(() => layoutGraph(data), [data]);
  const { w, h } = NODE_SIZE;

  React.useEffect(() => {
    if (!connectFrom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelConnect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectFrom, onCancelConnect]);

  const posById = React.useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of layout.nodes) m.set(n.id, { x: n.x, y: n.y });
    return m;
  }, [layout]);

  return (
    <div
      className="scroll"
      style={{ width: "100%", height: "100%", overflow: "auto", background: "var(--bg)", position: "relative" }}
    >
      {connectFrom && (
        <div
          className="row gap-2 pop-in"
          style={{
            position: "sticky",
            top: 12,
            left: 12,
            zIndex: 5,
            margin: 12,
            width: "fit-content",
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            borderRadius: 999,
            padding: "6px 14px",
            boxShadow: "var(--shadow)",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--accent)",
          }}
        >
          <GitBranch size={14} /> 接线中：点一个目标集接上分支
          <button type="button" className="chip" style={{ height: 24 }} onClick={onCancelConnect}>
            取消 (Esc)
          </button>
        </div>
      )}
      <div style={{ position: "relative", width: layout.width, height: layout.height, minHeight: "100%" }}>
        <svg
          width={layout.width}
          height={layout.height}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <defs>
            <marker id="ia-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3 L0,6 Z" fill="var(--ink-3)" />
            </marker>
            <marker id="ia-arrow-opt" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3 L0,6 Z" fill="var(--accent)" />
            </marker>
          </defs>
          {layout.edges.map((e, i) => {
            const a = posById.get(e.from);
            const b = posById.get(e.to);
            if (!a || !b) return null;
            const sx = a.x + w;
            const sy = a.y + h / 2;
            const tx = b.x;
            const ty = b.y + h / 2;
            const dx = Math.max(40, Math.abs(tx - sx) / 2);
            const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
            const isOpt = e.kind === "option";
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2;
            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={isOpt ? "var(--accent)" : "var(--ink-3)"}
                  strokeWidth={isOpt ? 2 : 1.5}
                  strokeDasharray={isOpt ? undefined : "5 4"}
                  markerEnd={isOpt ? "url(#ia-arrow-opt)" : "url(#ia-arrow)"}
                  opacity={0.85}
                />
                {isOpt && e.label && (
                  <text x={mx} y={my - 6} textAnchor="middle" fontSize="10.5" fill="var(--accent)" style={{ fontWeight: 600 }}>
                    {e.label.length > 10 ? e.label.slice(0, 10) + "…" : e.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {layout.nodes.map((n) => {
          const ep = n.episode;
          const isStart = data.startEpisodeId === ep.episodeId;
          const selected = selectedId === ep.episodeId;
          const isSource = connectFrom === ep.episodeId;
          const interactionCount = ep.interactions?.length ?? 0;
          const status = ep.videoStatus ?? (ep.videoUrl ? "ready" : "idle");
          const clickable = !!connectFrom && !isSource;
          return (
            <div
              key={ep.episodeId}
              onClick={() => {
                if (connectFrom && !isSource) onConnectTo(ep.episodeId);
                else if (!connectFrom) onSelect(ep.episodeId);
              }}
              style={{
                position: "absolute",
                left: n.x,
                top: n.y,
                width: w,
                height: h,
                cursor: clickable ? "crosshair" : "pointer",
                background: "var(--surface)",
                border: `2px solid ${
                  selected ? "var(--accent)" : isSource ? "var(--accent-2)" : ep.isEnding ? "#d97706" : "var(--line)"
                }`,
                borderStyle: n.reachable ? "solid" : "dashed",
                borderRadius: 14,
                boxShadow: selected ? "var(--shadow)" : "var(--shadow-sm)",
                padding: "9px 11px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                transition: "border-color .15s, box-shadow .15s",
              }}
            >
              <div className="row gap-1" style={{ minWidth: 0 }}>
                {isStart && <Star size={12} style={{ color: "var(--accent)", flex: "none" }} fill="var(--accent)" />}
                {ep.isEnding && <Flag size={12} style={{ color: "#d97706", flex: "none" }} />}
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                  title={ep.title}
                >
                  {ep.title || ep.episodeId}
                </span>
              </div>
              <div className="faint" style={{ fontSize: 10.5, fontFamily: "var(--font-num)" }}>
                {ep.episodeId} · {ep.durationSec > 0 ? `${ep.durationSec}s` : "未出片"}
              </div>
              <div className="row gap-2" style={{ marginTop: "auto", justifyContent: "space-between" }}>
                <span className="row gap-1" style={{ fontSize: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_DOT[status] ?? "var(--ink-3)" }} />
                  {status === "ready" ? <Film size={10} style={{ color: "var(--success)" }} /> : null}
                  {interactionCount > 0 && (
                    <span className="tag tag-accent" style={{ height: 16, padding: "0 5px", fontSize: 9.5 }}>
                      {interactionCount} 互动
                    </span>
                  )}
                  {ep.endingLabel && (
                    <span className="tag tag-amber" style={{ height: 16, padding: "0 5px", fontSize: 9.5 }}>
                      {ep.endingLabel}
                    </span>
                  )}
                </span>
                {!ep.isEnding && !connectFrom && (
                  <button
                    type="button"
                    title="拉线接分支"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectStart(ep.episodeId);
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface-2)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--accent)",
                      flex: "none",
                    }}
                  >
                    <GitBranch size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
