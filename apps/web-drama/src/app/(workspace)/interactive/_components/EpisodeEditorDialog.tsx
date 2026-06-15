"use client";

// 单集编辑器（受控）：编辑直接写回父级 draft（live），页面级「保存」统一持久化。
// 对齐抖音互动视频：本集视频时间轴上可配多个「互动点」（在 trigger_time 秒触发，类型
// choice/input/countdown，选项 → 下一集，可带限时与条件）；外加「播完之后」的线性续播 /
// 结局收束。

import * as React from "react";
import { Plus, Trash2, Flag, GitBranch, ArrowRight, Star, Clock } from "lucide-react";
import { Dialog, Field, TextInput, TextArea, Select } from "@/components/common";
import { Button, Chip } from "@/components/premium";
import { blankInteraction, blankOption } from "@/lib/interactive-graph";
import type { Interaction, InteractionType, EpisodeNode, InteractiveSeries } from "@/api/interactive-drama";

type EndFlow = "linear" | "ending" | "none";

const TYPE_OPTIONS: { value: InteractionType; label: string }[] = [
  { value: "choice", label: "选择（分支）" },
  { value: "input", label: "输入" },
  { value: "countdown", label: "倒计时" },
];

function endFlowOf(node: EpisodeNode): EndFlow {
  if (node.is_ending) return "ending";
  if (node.next_episode_id) return "linear";
  return "none";
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
  const others = series.episodes.filter((e) => e.id !== node.id);
  const endFlow = endFlowOf(node);
  const duration = node.duration_sec ?? 60;

  function patchInteractions(next: Interaction[]) {
    onPatch({ interactions: next });
  }
  function updateInteraction(id: string, mut: (i: Interaction) => Interaction) {
    if (!node) return;
    patchInteractions(node.interactions.map((i) => (i.id === id ? mut(i) : i)));
  }
  function addInteraction() {
    if (!node) return;
    patchInteractions([...node.interactions, blankInteraction(node.duration_sec ?? 60, others[0]?.id, others[1]?.id ?? others[0]?.id)]);
  }
  function removeInteraction(id: string) {
    if (!node) return;
    patchInteractions(node.interactions.filter((i) => i.id !== id));
  }
  function onOptionTarget(itxId: string, optIdx: number, val: string) {
    const id = val === "__new__" ? onAddTarget() : val;
    updateInteraction(itxId, (i) => ({ ...i, options: i.options.map((o, k) => (k === optIdx ? { ...o, next_episode_id: id } : o)) }));
  }
  function setEndFlow(next: EndFlow) {
    if (!node) return;
    if (next === "ending") onPatch({ is_ending: true, next_episode_id: null, ending_label: node.ending_label || "结局" });
    else if (next === "linear") onPatch({ is_ending: false, next_episode_id: node.next_episode_id ?? "" });
    else onPatch({ is_ending: false, next_episode_id: null });
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
      description="本集视频时间轴上可配多个互动点（第几秒触发、问什么、每个选项跳哪一集）；再设「播完之后」的续播或结局。"
      width={660}
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
            value={duration}
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

      {/* 互动点（时间轴） */}
      <Field label="互动点" hint="视频播到 trigger_time 秒弹出；选项决定跳到哪一集。单集可多个。">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {node.interactions.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-3)", padding: "2px 0" }}>
              本集暂无互动点 —— 是一段纯剧情（靠下面「播完之后」续播 / 收束）。
            </div>
          )}
          {node.interactions.map((itx, idx) => (
            <div
              key={itx.id}
              style={{
                padding: "12px 14px",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-2)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <span className="row gap-1" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>
                  <GitBranch size={12} /> 互动点 {idx + 1}
                </span>
                <div className="grow" />
                <span className="row gap-1" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                  <Clock size={12} /> 触发(秒)
                </span>
                <TextInput
                  type="number"
                  value={itx.trigger_time}
                  onChange={(e) => updateInteraction(itx.id, (i) => ({ ...i, trigger_time: Math.max(0, Number(e.target.value) || 0) }))}
                  style={{ width: 76 }}
                />
                <Select
                  value={itx.type}
                  onChange={(e) => updateInteraction(itx.id, (i) => ({ ...i, type: e.target.value as InteractionType }))}
                  style={{ width: 124 }}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  title="删除互动点"
                  onClick={() => removeInteraction(itx.id)}
                  className="btn btn-icon btn-ghost btn-sm"
                  style={{ flex: "none", color: "var(--danger)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <Field label="问题文案" required>
                <TextInput
                  value={itx.prompt}
                  onChange={(e) => updateInteraction(itx.id, (i) => ({ ...i, prompt: e.target.value }))}
                  placeholder="例如：她该当面拆穿他吗？"
                />
              </Field>

              <div style={{ fontSize: 11.5, color: "var(--ink-2)", fontWeight: 600 }}>选项（每个指向一集）</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {itx.options.map((o, optIdx) => (
                  <div key={o.id} className="row gap-2" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--ink-3)", width: 16 }}>{optIdx + 1}</span>
                    <TextInput
                      value={o.label}
                      onChange={(e) =>
                        updateInteraction(itx.id, (i) => ({
                          ...i,
                          options: i.options.map((x, k) => (k === optIdx ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      placeholder="选项文案，如：原谅他"
                      style={{ flex: 1 }}
                    />
                    <ArrowRight size={13} style={{ color: "var(--ink-3)", flex: "none" }} />
                    <Select value={o.next_episode_id} onChange={(e) => onOptionTarget(itx.id, optIdx, e.target.value)} style={{ flex: 1 }}>
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
                      onClick={() => updateInteraction(itx.id, (i) => ({ ...i, options: i.options.filter((_, k) => k !== optIdx) }))}
                      className="btn btn-icon btn-ghost btn-sm"
                      style={{ flex: "none", color: "var(--danger)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateInteraction(itx.id, (i) => ({ ...i, options: [...i.options, blankOption(others[0]?.id ?? "")] }))}
                >
                  <Plus size={12} /> 新增选项
                </Button>
                <div className="grow" />
                <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>限时(秒)</span>
                <TextInput
                  type="number"
                  value={itx.countdown_sec ?? ""}
                  onChange={(e) =>
                    updateInteraction(itx.id, (i) => ({ ...i, countdown_sec: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) }))
                  }
                  placeholder="不限"
                  style={{ width: 72 }}
                />
              </div>

              <Field label="触发条件" hint="可选。满足才弹出，如 globalFlags.hasKey == true（标记在右侧「全局标记」声明）">
                <TextInput
                  value={itx.condition ?? ""}
                  onChange={(e) => updateInteraction(itx.id, (i) => ({ ...i, condition: e.target.value || null }))}
                  placeholder="留空 = 无条件，到点就弹"
                />
              </Field>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addInteraction}>
            <Plus size={13} /> 新增互动点
          </Button>
        </div>
      </Field>

      {/* 播完之后 */}
      <Field label="本集播完之后（无互动跳转时）">
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {(
            [
              { k: "linear" as const, label: "续播下一集", icon: ArrowRight },
              { k: "ending" as const, label: "结局集", icon: Flag },
              { k: "none" as const, label: "断点（暂不接）", icon: GitBranch },
            ]
          ).map(({ k, label, icon: Icon }) => {
            const active = endFlow === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setEndFlow(k)}
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
                <Icon size={13} /> {label}
              </button>
            );
          })}
        </div>
      </Field>

      {endFlow === "linear" && (
        <Field label="续播下一集" hint="视频自然播完、且没有互动跳转时进入这一集">
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

      {endFlow === "ending" && (
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
