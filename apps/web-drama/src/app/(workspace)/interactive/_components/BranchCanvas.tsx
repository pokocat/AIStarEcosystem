"use client";

// 剧集分支画布 —— 把剧集图按「分支深度」自动从上往下铺开（竖向流：起始集在顶，越往后越往下），
// SVG 连线（互动选项标在线上），直观看清剧情走向。点节点 = 编辑；点节点上的「拉线」手柄进入连线
// 模式，再点目标 = 直接接一条分支。竖向流让画板更窄、向下生长，适合放左侧操控、右侧留给信息面板。
// 无第三方图库：小规模剧集图用 BFS 分层 + 每层水平居中 + 绝对定位 + SVG 贝塞尔即可，且完全贴合暖白主题。

import * as React from "react";
import { Flag, Link2, Star, X } from "lucide-react";
import type { EpisodeGenStatus, EpisodeNode, InteractiveSeries } from "@/api/interactive-drama";
import { episodeTargets } from "@/lib/interactive-graph";

const NW = 208; // 节点宽
const NH = 66; // 节点高
const COL = 248; // 同层相邻节点的水平间距（含节点宽）
const ROW = 132; // 相邻深度层的垂直间距（含节点高，留出连线 + 选项标签的竖向空间）
const PAD = 28;

const GEN_DOT: Record<EpisodeGenStatus, string> = {
  idle: "var(--ink-3)",
  generating: "var(--warning)",
  ready: "var(--success)",
  failed: "var(--danger)",
};

interface Props {
  series: InteractiveSeries;
  reachable: Set<string>;
  /** 点节点：打开单集编辑器。 */
  onEditNode: (id: string) => void;
  /** 连线：从 fromId 接一条分支到 toId（父级决定是加互动选项还是设线性下一集）。 */
  onConnect: (fromId: string, toId: string) => void;
}

function outgoing(e: EpisodeNode): string[] {
  return episodeTargets(e);
}

export function BranchCanvas({ series, reachable, onEditNode, onConnect }: Props) {
  const [connectFrom, setConnectFrom] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!connectFrom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConnectFrom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectFrom]);

  // 节点不存在了就退出连线
  React.useEffect(() => {
    if (connectFrom && !series.episodes.some((e) => e.id === connectFrom)) setConnectFrom(null);
  }, [series.episodes, connectFrom]);

  const { pos, width, height, edges } = React.useMemo(() => layout(series), [series]);

  function handleNodeClick(id: string) {
    if (connectFrom) {
      if (connectFrom !== id) onConnect(connectFrom, id);
      setConnectFrom(null);
    } else {
      onEditNode(id);
    }
  }

  const connectName = connectFrom ? series.episodes.find((e) => e.id === connectFrom)?.title ?? "" : "";

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        background:
          "radial-gradient(circle at 1px 1px, var(--line) 1px, transparent 0) 0 0 / 22px 22px, var(--surface)",
        overflow: "auto",
        maxHeight: "72vh",
      }}
    >
      {connectFrom && (
        <div
          className="row gap-2 pop-in"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            margin: 10,
            padding: "8px 12px",
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12.5,
            color: "var(--accent)",
            fontWeight: 600,
            width: "fit-content",
          }}
        >
          <Link2 size={14} /> 连线中：点目标剧集，作为「{connectName}」的分支去向（Esc 取消）
          <button
            type="button"
            onClick={() => setConnectFrom(null)}
            className="btn btn-icon btn-ghost btn-sm"
            style={{ color: "var(--accent)", marginLeft: 4 }}
            title="取消连线"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div style={{ position: "relative", width, height, minWidth: "100%" }}>
        {/* 连线层 */}
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <defs>
            <marker id="ic-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
            </marker>
            <marker id="ic-arrow-neutral" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)" />
            </marker>
          </defs>
          {edges.map((ed, i) => {
            const s = pos.get(ed.from);
            const t = pos.get(ed.to);
            if (!s || !t) return null;
            const sx = s.x + NW / 2;
            const sy = s.y + NH;
            const tx = t.x + NW / 2;
            const ty = t.y;
            const dy = Math.max(30, Math.abs(ty - sy) / 2);
            const d = `M ${sx} ${sy} C ${sx} ${sy + dy}, ${tx} ${ty - dy}, ${tx} ${ty}`;
            const accent = ed.kind === "choice";
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={accent ? "var(--accent)" : "var(--ink-3)"}
                strokeWidth={accent ? 2 : 1.6}
                strokeDasharray={ed.kind === "linear" ? "5 4" : undefined}
                markerEnd={`url(#ic-arrow-${accent ? "accent" : "neutral"})`}
                opacity={0.85}
              />
            );
          })}
        </svg>

        {/* 连线标签（互动选项文案） */}
        {edges.map((ed, i) => {
          if (ed.kind !== "choice") return null;
          const s = pos.get(ed.from);
          const t = pos.get(ed.to);
          if (!s || !t) return null;
          const mx = (s.x + t.x) / 2 + NW / 2;
          const my = (s.y + NH + t.y) / 2;
          return (
            <div
              key={`l${i}`}
              style={{
                position: "absolute",
                left: mx,
                top: my,
                transform: "translate(-50%, -50%)",
                background: "var(--surface)",
                border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                color: "var(--accent)",
                borderRadius: 999,
                padding: "1px 8px",
                fontSize: 10.5,
                fontWeight: 700,
                maxWidth: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {ed.label || "选项"}
            </div>
          );
        })}

        {/* 节点层 */}
        {series.episodes.map((node) => {
          const p = pos.get(node.id);
          if (!p) return null;
          const isStart = node.id === series.start_episode_id;
          const isEnding = !!node.is_ending;
          const orphan = !reachable.has(node.id) && !isStart;
          const isSource = connectFrom === node.id;
          const flowText = isEnding
            ? `结局${node.ending_label ? " · " + node.ending_label : ""}`
            : node.interactions.length > 0
              ? `互动 · ${node.interactions.length} 点`
              : node.next_episode_id
                ? "线性 →"
                : "未接后续";
          return (
            <div
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              title={connectFrom ? "设为分支目标" : "点击编辑本集"}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: NW,
                height: NH,
                boxSizing: "border-box",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                background: isEnding ? "var(--accent-2-soft)" : "var(--surface)",
                border: isSource
                  ? "2px solid var(--accent)"
                  : isStart
                    ? "2px solid var(--accent)"
                    : orphan
                      ? "1.5px dashed var(--warning)"
                      : "1px solid var(--line-2)",
                boxShadow: isSource ? "var(--shadow-accent)" : "var(--shadow-sm)",
                cursor: connectFrom ? "crosshair" : "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                overflow: "hidden",
                transition: "border-color .15s, box-shadow .15s",
              }}
            >
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: GEN_DOT[node.gen_status ?? "idle"],
                    flex: "none",
                    animation: node.gen_status === "generating" ? "drama-spin 1s linear infinite" : undefined,
                  }}
                />
                {isStart && <Star size={11} style={{ color: "var(--accent)", flex: "none" }} />}
                {isEnding && <Flag size={11} style={{ color: "var(--accent-2)", flex: "none" }} />}
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {node.title}
                </span>
              </div>
              <div className="row gap-2" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: 10.5,
                    color: node.interactions.length > 0 ? "var(--accent)" : orphan ? "var(--warning)" : "var(--ink-3)",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {orphan ? "孤立 · " : ""}
                  {flowText}
                </span>
                {!isEnding && (
                  <button
                    type="button"
                    title="从这里拉一条分支线"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConnectFrom((cur) => (cur === node.id ? null : node.id));
                    }}
                    className="btn btn-icon btn-ghost btn-sm"
                    style={{
                      flex: "none",
                      width: 22,
                      height: 22,
                      color: isSource ? "var(--accent)" : "var(--ink-3)",
                      background: isSource ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <Link2 size={12} />
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

interface Edge {
  from: string;
  to: string;
  kind: "choice" | "linear";
  label?: string;
}

/** BFS 分层（深度=行，自上而下；层内顺序=列，每层水平居中），孤立节点放末行；返回坐标 + 画布尺寸 + 连线。 */
function layout(series: InteractiveSeries): {
  pos: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  edges: Edge[];
} {
  const eps = series.episodes;
  const byId = new Map(eps.map((e) => [e.id, e] as const));
  const depth = new Map<string, number>();
  const start = series.start_episode_id;
  const queue: string[] = [];
  if (byId.has(start)) {
    depth.set(start, 0);
    queue.push(start);
  }
  while (queue.length) {
    const id = queue.shift()!;
    const e = byId.get(id);
    if (!e) continue;
    for (const t of outgoing(e)) {
      if (byId.has(t) && !depth.has(t)) {
        depth.set(t, (depth.get(id) ?? 0) + 1);
        queue.push(t);
      }
    }
  }
  let maxReached = 0;
  depth.forEach((d) => (maxReached = Math.max(maxReached, d)));
  const orphanDepth = depth.size < eps.length ? maxReached + 1 : maxReached;
  for (const e of eps) if (!depth.has(e.id)) depth.set(e.id, orphanDepth);

  // 每个深度 = 一行（竖向往下铺），行内节点水平排开。
  const rows = new Map<number, string[]>();
  for (const e of eps) {
    const d = depth.get(e.id) ?? 0;
    if (!rows.has(d)) rows.set(d, []);
    rows.get(d)!.push(e.id);
  }
  let maxCols = 0;
  let maxDepth = 0;
  rows.forEach((ids, d) => {
    maxCols = Math.max(maxCols, ids.length);
    maxDepth = Math.max(maxDepth, d);
  });

  // 最宽一行的像素宽度；每行据此水平居中，使整张图呈自上而下、左右对称的树形。
  const contentW = Math.max(0, maxCols - 1) * COL + NW;
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((ids, d) => {
    const rowW = Math.max(0, ids.length - 1) * COL + NW;
    const x0 = PAD + Math.max(0, (contentW - rowW) / 2);
    ids.forEach((id, c) => pos.set(id, { x: x0 + c * COL, y: PAD + d * ROW }));
  });

  const edges: Edge[] = [];
  for (const e of eps) {
    for (const itx of e.interactions) {
      for (const o of itx.options) {
        if (o.next_episode_id && byId.has(o.next_episode_id)) {
          edges.push({ from: e.id, to: o.next_episode_id, kind: "choice", label: o.label });
        }
      }
    }
    if (e.next_episode_id && byId.has(e.next_episode_id)) {
      edges.push({ from: e.id, to: e.next_episode_id, kind: "linear" });
    }
  }

  const width = PAD + contentW + PAD;
  const height = PAD + maxDepth * ROW + NH + PAD;
  return { pos, width: Math.max(width, NW + PAD * 2), height: Math.max(height, NH + PAD * 2), edges };
}
