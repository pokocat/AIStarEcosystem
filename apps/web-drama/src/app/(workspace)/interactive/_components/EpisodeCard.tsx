"use client";

// 剧集分支地图里的一个节点卡：标题 + 生成态 + 流转可视化（互动选项 / 线性 / 结局）+ 操作。

import * as React from "react";
import { ArrowRight, Copy, Flag, GitBranch, Loader2, Pencil, Play, Sparkles, Star, Trash2 } from "lucide-react";
import { Card, Button, Chip } from "@/components/premium";
import { StatusBadge, type StatusTone } from "@/components/common";
import { episodeTitle } from "@/lib/interactive-graph";
import type { EpisodeGenStatus, EpisodeNode, InteractiveSeries } from "@/api/interactive-drama";

const GEN_META: Record<EpisodeGenStatus, { tone: StatusTone; label: string }> = {
  idle: { tone: "neutral", label: "未生成" },
  generating: { tone: "info", label: "生成中…" },
  ready: { tone: "success", label: "已生成" },
  failed: { tone: "danger", label: "生成失败" },
};

interface Props {
  series: InteractiveSeries;
  node: EpisodeNode;
  isStart: boolean;
  /** 从起始集走不到（孤立节点）—— 在卡片上就地高亮。 */
  unreachable?: boolean;
  genBusy: boolean;
  onEdit: () => void;
  onGenerate: () => void;
  onPreview: () => void;
  onClone: () => void;
  onSetStart: () => void;
  onDelete: () => void;
}

export function EpisodeCard({ series, node, isStart, unreachable, genBusy, onEdit, onGenerate, onPreview, onClone, onSetStart, onDelete }: Props) {
  const gen = GEN_META[node.gen_status ?? "idle"];
  const flowNode =
    node.is_ending ? "ending" : node.interaction ? "interactive" : node.next_episode_id ? "linear" : "dead";

  return (
    <Card style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 头部 */}
      <div className="row gap-2" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{node.title}</span>
            {isStart && (
              <Chip tone="accent">
                <Star size={10} /> 起始集
              </Chip>
            )}
            {node.branch_label && <Chip tone="violet">{node.branch_label}</Chip>}
            <StatusBadge tone={gen.tone}>{gen.label}</StatusBadge>
            {unreachable && !isStart && <StatusBadge tone="warning">孤立 · 走不到</StatusBadge>}
          </div>
          {node.synopsis && (
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{node.synopsis}</div>
          )}
        </div>
      </div>

      {/* 流转可视化 */}
      <div
        style={{
          borderTop: "1px dashed var(--line)",
          paddingTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {flowNode === "ending" && (
          <div className="row gap-2" style={{ fontSize: 12.5, color: "var(--accent-2)", fontWeight: 600 }}>
            <Flag size={13} /> 结局 · {node.ending_label || "未命名结局"}
          </div>
        )}

        {flowNode === "interactive" && node.interaction && (
          <>
            <div className="row gap-2" style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
              <GitBranch size={13} style={{ color: "var(--accent)" }} />
              互动：{node.interaction.prompt || <span style={{ color: "var(--danger)" }}>（未填问题）</span>}
              {typeof node.interaction.countdown_sec === "number" && (
                <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>· 限时 {node.interaction.countdown_sec}s</span>
              )}
            </div>
            {node.interaction.choices.map((c, i) => (
              <div
                key={c.id}
                className="row gap-2"
                style={{ fontSize: 12.5, color: "var(--ink-2)", paddingLeft: 18 }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "var(--accent-soft)",
                    borderRadius: 6,
                    padding: "1px 7px",
                    flex: "none",
                  }}
                >
                  {c.label || `选项${i + 1}`}
                </span>
                <ArrowRight size={12} style={{ color: "var(--ink-3)", flex: "none" }} />
                <span style={{ color: c.next_episode_id ? "var(--ink)" : "var(--danger)" }}>
                  {c.next_episode_id ? episodeTitle(series, c.next_episode_id) : "（未指定）"}
                </span>
              </div>
            ))}
          </>
        )}

        {flowNode === "linear" && (
          <div className="row gap-2" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            <ArrowRight size={13} style={{ color: "var(--ink-3)" }} /> 下一集 ·
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{episodeTitle(series, node.next_episode_id)}</span>
          </div>
        )}

        {flowNode === "dead" && (
          <div className="row gap-2" style={{ fontSize: 12, color: "var(--warning)" }}>
            <Flag size={13} /> 未设置后续 —— 剧情会断在这里
          </div>
        )}
      </div>

      {/* 操作 */}
      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <Pencil size={12} /> 编辑
        </Button>
        {node.video_url && (
          <Button variant="ghost" size="sm" onClick={onPreview}>
            <Play size={12} /> 预览
          </Button>
        )}
        {node.gen_status === "ready" ? (
          <Button variant="ghost" size="sm" onClick={onGenerate} disabled={genBusy}>
            <Sparkles size={12} /> 重新生成
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onGenerate} disabled={genBusy || node.gen_status === "generating"}>
            {node.gen_status === "generating" ? (
              <Loader2 size={12} className="animate-spin" style={{ animation: "drama-spin 800ms linear infinite" }} />
            ) : (
              <Sparkles size={12} />
            )}
            生成此集
          </Button>
        )}
        <div className="grow" />
        {!isStart && (
          <Button variant="ghost" size="sm" onClick={onSetStart}>
            <Star size={12} /> 设为起始
          </Button>
        )}
        <button type="button" title="复制本集（生成新分支变体）" onClick={onClone} className="btn btn-icon btn-ghost btn-sm" style={{ color: "var(--ink-3)" }}>
          <Copy size={13} />
        </button>
        <button type="button" title="删除此集" onClick={onDelete} className="btn btn-icon btn-ghost btn-sm" style={{ color: "var(--danger)" }}>
          <Trash2 size={13} />
        </button>
      </div>
    </Card>
  );
}
