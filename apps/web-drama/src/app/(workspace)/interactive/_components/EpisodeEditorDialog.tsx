"use client";

// 单集编辑器（受控）：编辑直接写回父级 draft（live），页面级「保存」统一持久化。
// 三种流转语义（互动分支 / 线性下一集 / 结局集）+ 互动选项配置（选项文案 → 目标集）。

import * as React from "react";
import { Plus, Trash2, Flag, GitBranch, ArrowRight, Star } from "lucide-react";
import { Dialog, Field, TextInput, TextArea, Select } from "@/components/common";
import { Button, Chip } from "@/components/premium";
import { blankChoice } from "@/lib/interactive-graph";
import type {
  EpisodeInteraction,
  EpisodeNode,
  InteractiveSeries,
} from "@/api/interactive-drama";

type FlowKind = "interactive" | "linear" | "ending";

function flowOf(node: EpisodeNode): FlowKind {
  if (node.is_ending) return "ending";
  if (node.interaction) return "interactive";
  return "linear";
}

interface Props {
  open: boolean;
  onClose: () => void;
  node: EpisodeNode | null;
  series: InteractiveSeries;
  isStart: boolean;
  onPatch: (patch: Partial<EpisodeNode>) => void;
  /** 新建一集作为分支目标，返回其 id。 */
  onAddTarget: () => string;
  onSetStart: () => void;
  onDelete: () => void;
}

export function EpisodeEditorDialog({
  open,
  onClose,
  node,
  series,
  isStart,
  onPatch,
  onAddTarget,
  onSetStart,
  onDelete,
}: Props) {
  if (!node) return null;
  const flow = flowOf(node);
  const others = series.episodes.filter((e) => e.id !== node.id);

  function setFlow(next: FlowKind) {
    if (!node) return;
    if (next === "ending") {
      onPatch({ is_ending: true, interaction: null, next_episode_id: null, ending_label: node.ending_label || "结局" });
    } else if (next === "interactive") {
      const seed: EpisodeInteraction =
        node.interaction ?? {
          prompt: "",
          choices: [blankChoice(others[0]?.id ?? ""), blankChoice(others[1]?.id ?? others[0]?.id ?? "")],
          countdown_sec: 10,
          default_choice_id: null,
        };
      onPatch({ is_ending: false, next_episode_id: null, interaction: seed });
    } else {
      onPatch({ is_ending: false, interaction: null, next_episode_id: node.next_episode_id ?? "" });
    }
  }

  function patchInteraction(mut: (i: EpisodeInteraction) => EpisodeInteraction) {
    if (!node) return;
    const cur: EpisodeInteraction = node.interaction ?? { prompt: "", choices: [], countdown_sec: null, default_choice_id: null };
    onPatch({ interaction: mut(cur) });
  }

  function onTargetChange(idx: number, val: string) {
    const id = val === "__new__" ? onAddTarget() : val;
    patchInteraction((i) => ({ ...i, choices: i.choices.map((c, k) => (k === idx ? { ...c, next_episode_id: id } : c)) }));
  }

  function onLinearChange(val: string) {
    const id = val === "__new__" ? onAddTarget() : val;
    onPatch({ next_episode_id: id || null });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="编辑剧集"
      description="互动发生在「剧集之间」：本集播完，按下面的流转决定观众接下来看什么。"
      width={620}
      footer={<Button variant="primary" onClick={onClose}>完成</Button>}
    >
      <div className="row gap-2" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {isStart ? (
          <Chip tone="accent">
            <Star size={11} /> 起始集
          </Chip>
        ) : (
          <Button variant="ghost" size="sm" onClick={onSetStart}>
            <Star size={11} /> 设为起始集
          </Button>
        )}
        {node.branch_label ? <Chip tone="violet">{node.branch_label}</Chip> : null}
      </div>

      <Field label="集标题" required>
        <TextInput value={node.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder="例如：第10集 · 真相浮现" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
        <Field label="分支线标签" hint="可选，用于区分同一集号的不同分支线">
          <TextInput value={node.branch_label ?? ""} onChange={(e) => onPatch({ branch_label: e.target.value })} placeholder="如：拆穿线" />
        </Field>
        <Field label="时长(秒)">
          <TextInput
            type="number"
            value={node.duration_sec ?? 60}
            onChange={(e) => onPatch({ duration_sec: Math.max(1, Number(e.target.value) || 0) })}
          />
        </Field>
      </div>

      <Field label="一句话剧情" hint="P1 用它驱动生成；细化单集分镜留给「单集剧本」阶段（P2）">
        <TextArea
          rows={2}
          value={node.synopsis ?? ""}
          onChange={(e) => onPatch({ synopsis: e.target.value })}
          placeholder="这一集发生了什么 / 留下什么钩子"
        />
      </Field>

      {/* 流转类型 */}
      <Field label="本集播完之后">
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {(
            [
              { k: "interactive" as const, label: "互动分支", icon: GitBranch },
              { k: "linear" as const, label: "线性下一集", icon: ArrowRight },
              { k: "ending" as const, label: "结局集", icon: Flag },
            ]
          ).map(({ k, label, icon: Icon }) => {
            const active = flow === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFlow(k)}
                className="row gap-2"
                style={{
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: active ? "1px solid var(--accent)" : "1px solid var(--line-2)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-2)",
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* 互动配置 */}
      {flow === "interactive" && node.interaction && (
        <div
          style={{
            marginTop: 4,
            padding: "14px 16px",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-2)",
          }}
        >
          <Field label="互动问题" required>
            <TextInput
              value={node.interaction.prompt}
              onChange={(e) => patchInteraction((i) => ({ ...i, prompt: e.target.value }))}
              placeholder="例如：她该当面拆穿他吗？"
            />
          </Field>

          <div style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600, margin: "4px 0 8px" }}>
            选项（每个选项指向一集）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {node.interaction.choices.map((c, idx) => (
              <div key={c.id} className="row gap-2" style={{ alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)", width: 16 }}>{idx + 1}</span>
                <TextInput
                  value={c.label}
                  onChange={(e) =>
                    patchInteraction((i) => ({
                      ...i,
                      choices: i.choices.map((x, k) => (k === idx ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                  placeholder="选项文案，如：原谅他"
                  style={{ flex: 1 }}
                />
                <ArrowRight size={13} style={{ color: "var(--ink-3)", flex: "none" }} />
                <Select value={c.next_episode_id} onChange={(e) => onTargetChange(idx, e.target.value)} style={{ flex: 1 }}>
                  <option value="">（未指定）</option>
                  {others.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                  <option value="__new__">＋ 新建一集…</option>
                </Select>
                <button
                  type="button"
                  title="删除选项"
                  onClick={() => patchInteraction((i) => ({ ...i, choices: i.choices.filter((_, k) => k !== idx) }))}
                  className="btn btn-icon btn-ghost btn-sm"
                  style={{ flex: "none", color: "var(--danger)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="row gap-2" style={{ marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patchInteraction((i) => ({ ...i, choices: [...i.choices, blankChoice(others[0]?.id ?? "")] }))}
            >
              <Plus size={12} /> 新增选项
            </Button>
            <div className="grow" />
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>限时(秒)</span>
            <TextInput
              type="number"
              value={node.interaction.countdown_sec ?? ""}
              onChange={(e) =>
                patchInteraction((i) => ({ ...i, countdown_sec: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) }))
              }
              placeholder="不限"
              style={{ width: 80 }}
            />
          </div>
        </div>
      )}

      {/* 线性下一集 */}
      {flow === "linear" && (
        <Field label="线性下一集" hint="本集播完直接进入这一集，没有互动">
          <Select value={node.next_episode_id ?? ""} onChange={(e) => onLinearChange(e.target.value)}>
            <option value="">（未指定）</option>
            {others.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
            <option value="__new__">＋ 新建一集…</option>
          </Select>
        </Field>
      )}

      {/* 结局 */}
      {flow === "ending" && (
        <Field label="结局标签" hint="观众走到这条分支的终点会看到的结局名">
          <TextInput
            value={node.ending_label ?? ""}
            onChange={(e) => onPatch({ ending_label: e.target.value })}
            placeholder="如：HE · 重圆 / BE · 错过 / 开放结局"
          />
        </Field>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={12} /> 删除此集
        </Button>
      </div>
    </Dialog>
  );
}
