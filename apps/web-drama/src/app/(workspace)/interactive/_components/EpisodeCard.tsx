"use client";

// 剧集分支地图里的一个节点卡：标题 + 生成态 + 流转可视化（互动选项 / 线性 / 结局）+ 操作。

import * as React from "react";
import { ArrowRight, Clock, Copy, Flag, GitBranch, Loader2, Pencil, Play, Sparkles, Star, Trash2 } from "lucide-react";
import { Card, Button, Chip } from "@/components/premium";
import { StatusBadge, type StatusTone } from "@/components/common";
import { episodeTitle } from "@/lib/interactive-graph";
import type { EpisodeGenStatus, EpisodeNode, InteractionType, InteractiveSeries } from "@/api/interactive-drama";

const INTERACTION_TYPE_LABEL: Record<InteractionType, string> = { choice: "选择", input: "输入", countdown: "倒计时" };

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
  const isDead = node.interactions.length === 0 && !node.is_ending && !node.next_episode_id;

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

      {/* 流转可视化（时间轴互动点 + 结尾续播） */}
      <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {node.interactions.map((itx) => (
          <div key={itx.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="row gap-2" style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600, flexWrap: "wrap" }}>
              <GitBranch size={13} style={{ color: "var(--accent)", flex: "none" }} />
              <span className="row gap-1" style={{ fontSize: 11, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 6, padding: "1px 6px", flex: "none" }}>
                <Clock size={10} /> {itx.trigger_time}s · {INTERACTION_TYPE_LABEL[itx.type]}
              </span>
              {itx.prompt || <span style={{ color: "var(--danger)" }}>（未填问题）</span>}
              {typeof itx.countdown_sec === "number" && (
                <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>· 限时 {itx.countdown_sec}s</span>
              )}
              {itx.condition ? <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>· 条件触发</span> : null}
            </div>
            {itx.options.map((o, i) => (
              <div key={o.id} className="row gap-2" style={{ fontSize: 12.5, color: "var(--ink-2)", paddingLeft: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 6, padding: "1px 7px", flex: "none" }}>
                  {o.label || `选项${i + 1}`}
                </span>
                <ArrowRight size={12} style={{ color: "var(--ink-3)", flex: "none" }} />
                <span style={{ color: o.next_episode_id ? "var(--ink)" : "var(--danger)" }}>
                  {o.next_episode_id ? episodeTitle(series, o.next_episode_id) : "（未指定）"}
                </span>
              </div>
            ))}
          </div>
        ))}

        {node.is_ending && (
          <div className="row gap-2" style={{ fontSize: 12.5, color: "var(--accent-2)", fontWeight: 600 }}>
            <Flag size={13} /> 结局 · {node.ending_label || "未命名结局"}
          </div>
        )}

        {!node.is_ending && node.next_episode_id && (
          <div className="row gap-2" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            <ArrowRight size={13} style={{ color: "var(--ink-3)" }} /> 播完续播 ·
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{episodeTitle(series, node.next_episode_id)}</span>
          </div>
        )}

        {isDead && (
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
