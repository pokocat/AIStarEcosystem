"use client";

// 单集编辑器（v0.79）—— 编辑某一集：标题 / 剧情 / 出片 / 时长 / 结局 / 续播 + 时间轴互动点。
// 互动点：触发秒 / 类型（选择·输入·倒计时）/ 条件 / 问题 / 限时 / 选项（→目标集 + setFlags 写标记）。
// 纯受控组件：所有改动经 onChange(更新后的整集) 上抛，由父级整图自动保存。
import * as React from "react";
import { Plus, Trash2, Copy, Star, Film, ArrowRight, Clock, GitBranch, Flag, X } from "lucide-react";
import type {
  FlagValue,
  InteractionOption,
  InteractionPoint,
  InteractionType,
  InteractiveEpisode,
} from "@/lib/interactive-types";

interface Props {
  episode: InteractiveEpisode;
  allEpisodes: InteractiveEpisode[];
  flagNames: string[];
  isStart: boolean;
  onChange: (ep: InteractiveEpisode) => void;
  onSetStart: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  /** 去六阶段制作这一集（剧集脚本 → 视频工厂 → 成片合成）。 */
  onProduce: () => void;
}

const INPUT: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: 13,
  background: "var(--surface-2)",
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
};

const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--ink-3)" };

function nextLetter(opts: InteractionOption[]): string {
  const used = new Set(opts.map((o) => o.id));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!used.has(c)) return c;
  }
  return "O" + opts.length;
}

export function EpisodeEditor({
  episode,
  allEpisodes,
  flagNames,
  isStart,
  onChange,
  onSetStart,
  onDelete,
  onDuplicate,
  onProduce,
}: Props) {
  const ep = episode;
  const targets = allEpisodes.filter((e) => e.episodeId !== ep.episodeId);

  const patch = (p: Partial<InteractiveEpisode>) => onChange({ ...ep, ...p });

  const setInteraction = (idx: number, p: Partial<InteractionPoint>) =>
    patch({ interactions: ep.interactions.map((it, i) => (i === idx ? { ...it, ...p } : it)) });
  const setUi = (idx: number, p: Partial<InteractionPoint["uiConfig"]>) =>
    patch({ interactions: ep.interactions.map((it, i) => (i === idx ? { ...it, uiConfig: { ...it.uiConfig, ...p } } : it)) });
  const setOption = (idx: number, oIdx: number, p: Partial<InteractionOption>) =>
    setUi(idx, { options: (ep.interactions[idx].uiConfig.options ?? []).map((o, j) => (j === oIdx ? { ...o, ...p } : o)) });

  const addInteraction = () => {
    const id = `${ep.episodeId}_i${(ep.interactions.length + 1)}_${Math.floor(Math.random() * 1e4)}`;
    const it: InteractionPoint = {
      id,
      triggerTime: ep.durationSec > 5 ? Math.max(1, ep.durationSec - 5) : 5,
      interactionType: "choice",
      uiConfig: {
        question: "你的选择？",
        countdownSec: 10,
        options: [
          { id: "A", text: "选项 A", nextVideoId: null },
          { id: "B", text: "选项 B", nextVideoId: null },
        ],
      },
    };
    patch({ interactions: [...ep.interactions, it] });
  };
  const removeInteraction = (idx: number) => patch({ interactions: ep.interactions.filter((_, i) => i !== idx) });

  const addOption = (idx: number) => {
    const opts = ep.interactions[idx].uiConfig.options ?? [];
    setUi(idx, { options: [...opts, { id: nextLetter(opts), text: "新选项", nextVideoId: null }] });
  };
  const removeOption = (idx: number, oIdx: number) =>
    setUi(idx, { options: (ep.interactions[idx].uiConfig.options ?? []).filter((_, j) => j !== oIdx) });

  const setOptionFlag = (idx: number, oIdx: number, key: string, value: FlagValue) => {
    const o = (ep.interactions[idx].uiConfig.options ?? [])[oIdx];
    setOption(idx, oIdx, { setFlags: { ...(o.setFlags ?? {}), [key]: value } });
  };
  const removeOptionFlag = (idx: number, oIdx: number, key: string) => {
    const o = (ep.interactions[idx].uiConfig.options ?? [])[oIdx];
    const next = { ...(o.setFlags ?? {}) };
    delete next[key];
    setOption(idx, oIdx, { setFlags: Object.keys(next).length ? next : undefined });
  };

  return (
    <div className="col gap-4" style={{ padding: 18 }}>
      {/* 头部 */}
      <div className="row gap-2">
        <span className="num faint" style={{ fontSize: 11, flex: "none" }}>{ep.episodeId}</span>
        <input value={ep.title} onChange={(e) => patch({ title: e.target.value })} placeholder="本集标题" style={{ ...INPUT, fontWeight: 700, fontSize: 14 }} />
      </div>
      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
        <button type="button" className={isStart ? "chip on" : "chip"} onClick={onSetStart} disabled={isStart}>
          <Star size={12} /> {isStart ? "起始集" : "设为起始集"}
        </button>
        <button type="button" className="chip" onClick={onDuplicate}>
          <Copy size={12} /> 复制本集
        </button>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={onDelete}>
          <Trash2 size={13} /> 删除
        </button>
      </div>

      {/* 剧情 */}
      <div className="col gap-1">
        <span style={LABEL}>本集剧情（出片画面依据）</span>
        <textarea value={ep.synopsis ?? ""} onChange={(e) => patch({ synopsis: e.target.value })} rows={2} placeholder="简述本集剧情" style={{ ...INPUT, resize: "vertical" }} />
      </div>

      {/* 本集视频：来自「剧集脚本 → 成片合成」的成片，互动点按其时长校验 */}
      <div className="card col gap-2" style={{ padding: 12, background: "var(--surface-2)" }}>
        <div className="row gap-2">
          <Film size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>本集视频</span>
          <span className="grow" />
          {ep.videoUrl ? (
            <span className="tag tag-green" style={{ height: 20 }}>已成片 · {ep.durationSec}s</span>
          ) : (
            <span className="tag tag-gray" style={{ height: 20 }}>未制作</span>
          )}
        </div>
        {ep.videoUrl ? (
          <video src={ep.videoUrl} controls muted playsInline style={{ width: "100%", maxHeight: 200, borderRadius: 8, background: "#000" }} />
        ) : (
          <div className="faint" style={{ fontSize: 11.5 }}>
            本集还没有成片。到「剧集脚本」逐镜出片，再用「成片合成」拼成一集；这条成片就是本集播放的视频，互动点按它的时长校验。
          </div>
        )}
        <button type="button" className="btn btn-grad btn-sm" style={{ alignSelf: "flex-start" }} onClick={onProduce}>
          <ArrowRight size={13} /> {ep.videoUrl ? "重新制作" : "制作本集"}
        </button>
      </div>

      {/* 结局 / 续播 */}
      <div className="col gap-2">
        <label className="row gap-2" style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={ep.isEnding}
            onChange={(e) => patch({ isEnding: e.target.checked, ...(e.target.checked ? { nextVideoId: null } : {}), endingLabel: e.target.checked ? ep.endingLabel || "结局" : undefined })}
          />
          <Flag size={13} style={{ color: ep.isEnding ? "#d97706" : "var(--ink-3)" }} /> 这是一个结局集
        </label>
        {ep.isEnding ? (
          <div className="col gap-1">
            <span style={LABEL}>结局名（展示给观众）</span>
            <input value={ep.endingLabel ?? ""} onChange={(e) => patch({ endingLabel: e.target.value })} placeholder="如：逃出生天" style={INPUT} />
          </div>
        ) : (
          <div className="col gap-1">
            <span style={LABEL}>播完之后（无互动分流时的线性续播）</span>
            <select value={ep.nextVideoId ?? ""} onChange={(e) => patch({ nextVideoId: e.target.value || null })} style={INPUT}>
              <option value="">（无 · 由下方互动点分流，或为断点）</option>
              {targets.map((t) => (
                <option key={t.episodeId} value={t.episodeId}>{t.title}（{t.episodeId}）</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 时间轴互动点 */}
      <div className="col gap-2">
        <div className="row gap-2">
          <Clock size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 800, fontSize: 13.5 }}>时间轴互动点</span>
          <span className="faint" style={{ fontSize: 11 }}>视频播放至触发秒数时弹出</span>
          <span className="grow" />
          <button type="button" className="btn btn-line btn-sm" onClick={addInteraction} disabled={ep.isEnding}>
            <Plus size={13} /> 添加互动点
          </button>
        </div>
        {ep.isEnding ? (
          <div className="faint" style={{ fontSize: 11.5 }}>结局集不再分流，无需互动点。</div>
        ) : ep.interactions.length === 0 ? (
          <div className="faint" style={{ fontSize: 11.5 }}>暂无互动点。添加一个「选择」点，由观众的选择决定剧情走向。</div>
        ) : (
          ep.interactions.map((it, idx) => (
            <div key={it.id} className="card col gap-2" style={{ padding: 12 }}>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                <div className="row gap-1">
                  <span style={LABEL}>触发秒</span>
                  <input type="number" value={it.triggerTime} onChange={(e) => setInteraction(idx, { triggerTime: Math.max(0, Number(e.target.value) || 0) })} style={{ ...INPUT, width: 64, padding: "4px 6px" }} />
                </div>
                <select value={it.interactionType} onChange={(e) => setInteraction(idx, { interactionType: e.target.value as InteractionType })} style={{ ...INPUT, width: 96 }}>
                  <option value="choice">选择</option>
                  <option value="input">输入</option>
                  <option value="countdown">倒计时</option>
                </select>
                <div className="row gap-1">
                  <span style={LABEL}>限时</span>
                  <input type="number" value={it.uiConfig.countdownSec ?? 0} onChange={(e) => setUi(idx, { countdownSec: Math.max(0, Number(e.target.value) || 0) || undefined })} style={{ ...INPUT, width: 56, padding: "4px 6px" }} />
                  <span style={LABEL}>秒</span>
                </div>
                <span className="grow" />
                <button type="button" className="btn btn-icon btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeInteraction(idx)}>
                  <Trash2 size={13} />
                </button>
              </div>
              <input value={it.uiConfig.question} onChange={(e) => setUi(idx, { question: e.target.value })} placeholder="向观众展示的问题" style={INPUT} />
              <div className="col gap-1">
                <span style={LABEL}>条件触发（可选，到达时间点后需满足该条件才弹出）</span>
                <input
                  value={it.condition ?? ""}
                  onChange={(e) => setInteraction(idx, { condition: e.target.value || undefined })}
                  placeholder='如 globalFlags.hasKey == true'
                  className="num"
                  style={{ ...INPUT, fontSize: 12 }}
                />
              </div>

              {it.interactionType === "input" ? (
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  <div className="col gap-1">
                    <span style={LABEL}>写入标记</span>
                    <select value={it.uiConfig.inputKey ?? ""} onChange={(e) => setUi(idx, { inputKey: e.target.value || undefined })} style={{ ...INPUT, width: 140 }}>
                      <option value="">（不写标记）</option>
                      {flagNames.map((f) => (<option key={f} value={f}>{f}</option>))}
                    </select>
                  </div>
                  <div className="col gap-1 grow">
                    <span style={LABEL}>输入框占位</span>
                    <input value={it.uiConfig.placeholder ?? ""} onChange={(e) => setUi(idx, { placeholder: e.target.value || undefined })} style={INPUT} />
                  </div>
                </div>
              ) : (
                <div className="col gap-2">
                  <span style={LABEL}>选项（→ 目标集 · 可写全局标记）</span>
                  {(it.uiConfig.options ?? []).map((o, oIdx) => (
                    <div key={o.id} className="col gap-1" style={{ border: "1px solid var(--line-soft)", borderRadius: 10, padding: 9 }}>
                      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                        <span className="num tag tag-accent" style={{ height: 22, flex: "none" }}>{o.id}</span>
                        <input value={o.text} onChange={(e) => setOption(idx, oIdx, { text: e.target.value })} placeholder="选项文案" style={{ ...INPUT, flex: 1, minWidth: 120 }} />
                        <button type="button" className="btn btn-icon btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeOption(idx, oIdx)}>
                          <X size={13} />
                        </button>
                      </div>
                      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                        <div className="row gap-1">
                          <GitBranch size={12} style={{ color: "var(--accent)" }} />
                          <select value={o.nextVideoId ?? ""} onChange={(e) => setOption(idx, oIdx, { nextVideoId: e.target.value || null })} style={{ ...INPUT, width: 200 }}>
                            <option value="">（未连线 → 选择目标剧集）</option>
                            {targets.map((t) => (<option key={t.episodeId} value={t.episodeId}>{t.title}（{t.episodeId}）</option>))}
                          </select>
                        </div>
                      </div>
                      {/* setFlags 写标记 */}
                      <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                        {Object.entries(o.setFlags ?? {}).map(([k, v]) => (
                          <span key={k} className="row gap-1 tag tag-gray" style={{ height: 24 }}>
                            <span className="num">{k}=</span>
                            <input
                              value={String(v)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const val: FlagValue = raw === "true" ? true : raw === "false" ? false : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
                                setOptionFlag(idx, oIdx, k, val);
                              }}
                              style={{ width: 48, border: "none", background: "transparent", fontSize: 11, outline: "none", fontFamily: "var(--font-num)", color: "var(--ink)" }}
                            />
                            <button type="button" onClick={() => removeOptionFlag(idx, oIdx, k)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)", lineHeight: 0 }}>
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {flagNames.some((f) => (o.setFlags ?? {})[f] === undefined) && (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) setOptionFlag(idx, oIdx, e.target.value, true); }}
                            style={{ ...INPUT, width: 130, height: 26, padding: "2px 6px", fontSize: 11.5 }}
                          >
                            <option value="">+ 写标记…</option>
                            {flagNames
                              .filter((f) => (o.setFlags ?? {})[f] === undefined)
                              .map((f) => (<option key={f} value={f}>{f}</option>))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => addOption(idx)}>
                    <Plus size={12} /> 添加选项
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
