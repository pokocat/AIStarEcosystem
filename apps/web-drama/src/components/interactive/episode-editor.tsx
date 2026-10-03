"use client";

// 单集编辑器（v0.79）—— 编辑某一集：标题 / 剧情 / 成片 / 结局 / 播完接哪一集 + 互动点。
// 互动点：第几秒弹出 / 类型（选一项·填一句话·倒计时）/ 弹出条件 / 问题 / 限时 / 选项（→ 去哪一集 + 选了之后记下的剧情状态）。
// 纯受控组件：所有改动经 onChange(更新后的整集) 上抛，由父级整图自动保存。
// v0.197：界面上不再出现 episodeId / condition / setFlags 这类字段名；弹出条件从手写表达式改成三个下拉
//（拼出来的仍是导出契约里的 condition 字符串，见 lib/interactive-graph.ts parseCondition / buildCondition）。
// v0.197 评审 WB6 / WB7：
//   · 值的输入方式按剧情状态**现在**的类型定（之前看旧值的类型，「是否」改成「数字」后旧选项还只能选是 / 否）；
//     旧值和现在的类型对不上时就地提示重填。
//   · 条件引用的剧情状态被删了：下拉照样显示（标「已删除」），并给「清掉条件」—— 之前整块藏起来，只能删掉整个互动点。
import * as React from "react";
import { Plus, Trash2, Copy, Star, Film, ArrowRight, Clock, GitBranch, Flag, X } from "lucide-react";
import type {
  FlagValue,
  InteractionOption,
  InteractionPoint,
  InteractionType,
  InteractiveEpisode,
} from "@/lib/interactive-types";
import {
  FLAG_KIND_LABEL,
  buildCondition,
  conditionFitsFlag,
  epDisplayTitle,
  flagKindOf,
  opsForFlagKind,
  parseCondition,
  type ConditionOp,
} from "@/lib/interactive-graph";

interface Props {
  episode: InteractiveEpisode;
  allEpisodes: InteractiveEpisode[];
  /** 已添加的剧情状态及开始时的值（决定条件 / 选项里值的输入方式）。 */
  flags: Record<string, FlagValue>;
  isStart: boolean;
  onChange: (ep: InteractiveEpisode) => void;
  onSetStart: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  /** 去逐集制作这一集（① 分镜 → ② 合成成片）。 */
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
  minWidth: 0,
};

const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--ink-3)" };

const OP_LABEL: Record<ConditionOp, string> = {
  "==": "等于",
  "!=": "不等于",
  ">": "大于",
  "<": "小于",
  ">=": "不少于",
  "<=": "不超过",
};

const TYPE_HINT: Record<InteractionType, string> = {
  choice: "弹出几个选项，观众点一个",
  input: "让观众填一句话，记到剧情状态里",
  countdown: "限时选择，时间到自动选第一个",
};

function nextLetter(opts: InteractionOption[]): string {
  const used = new Set(opts.map((o) => o.id));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!used.has(c)) return c;
  }
  return "O" + opts.length;
}

const STALE_INPUT: React.CSSProperties = { borderColor: "var(--danger)", background: "var(--surface)" };

/**
 * 剧情状态的值输入：是否 → 下拉「是 / 否」；数字 → 数字框；文字 → 文本框。
 * 用哪种按 declared（这个状态现在的类型）定；状态已经删了才看值本身。
 * 值和现在的类型对不上（改过类型）→ 空着等重填，红框标出来。
 */
function FlagValueInput({
  declared,
  value,
  onChange,
  style,
}: {
  declared: FlagValue | undefined;
  value: FlagValue;
  onChange: (v: FlagValue) => void;
  style?: React.CSSProperties;
}) {
  const kind = flagKindOf(declared ?? value);
  const stale = flagKindOf(value) !== kind;
  const staleStyle = stale ? STALE_INPUT : undefined;
  const staleTitle = stale ? `这里还是改类型之前的值，按「${FLAG_KIND_LABEL[kind]}」重新填` : undefined;
  if (kind === "boolean") {
    return (
      <select
        value={stale ? "" : String(value === true)}
        onChange={(e) => onChange(e.target.value === "true")}
        aria-invalid={stale || undefined}
        title={staleTitle}
        style={{ ...INPUT, width: 72, ...style, ...staleStyle }}
      >
        {stale && <option value="" disabled>重选</option>}
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    );
  }
  if (kind === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        placeholder={stale ? "重填" : undefined}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        aria-invalid={stale || undefined}
        title={staleTitle}
        style={{ ...INPUT, width: 72, ...style, ...staleStyle }}
      />
    );
  }
  return (
    <input
      value={typeof value === "string" ? value : ""}
      placeholder={stale ? "重填" : undefined}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={stale || undefined}
      title={staleTitle}
      style={{ ...INPUT, width: 110, ...style, ...staleStyle }}
    />
  );
}

const HINT_DANGER: React.CSSProperties = { fontSize: 11.5, lineHeight: 1.5, color: "var(--danger)", minWidth: 0 };

export function EpisodeEditor({
  episode,
  allEpisodes,
  flags,
  isStart,
  onChange,
  onSetStart,
  onDelete,
  onDuplicate,
  onProduce,
}: Props) {
  const ep = episode;
  const targets = allEpisodes.filter((e) => e.episodeId !== ep.episodeId);
  const flagNames = Object.keys(flags);
  const hasFlag = (f: string) => Object.prototype.hasOwnProperty.call(flags, f);
  const defaultValueOf = (f: string): FlagValue => {
    const v = flags[f];
    return typeof v === "boolean" ? true : typeof v === "number" ? 1 : "";
  };

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

  const epOptionLabel = (t: InteractiveEpisode) => `第 ${t.no} 集 · ${epDisplayTitle(t)}`;

  return (
    <div className="col gap-4 wb-ep-editor" style={{ padding: 18 }}>
      {/* 头部 */}
      <div className="row gap-2">
        <span className="num faint" style={{ fontSize: 11.5, flex: "none", fontWeight: 700 }}>第 {ep.no} 集</span>
        <input value={ep.title} onChange={(e) => patch({ title: e.target.value })} placeholder={epDisplayTitle({ no: ep.no, synopsis: ep.synopsis })} aria-label="这一集的标题" style={{ ...INPUT, fontWeight: 700, fontSize: 14 }} />
      </div>
      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
        <button type="button" className={isStart ? "chip on" : "chip"} onClick={onSetStart} disabled={isStart} title="观众从这一集开始看">
          <Star size={12} /> {isStart ? "起始集" : "设为起始集"}
        </button>
        <button type="button" className="chip" onClick={onDuplicate}>
          <Copy size={12} /> 复制这一集
        </button>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={onDelete}>
          <Trash2 size={13} /> 删除
        </button>
      </div>

      {/* 剧情 */}
      <div className="col gap-1">
        <span style={LABEL}>这一集讲什么（AI 按这段出画面）</span>
        <textarea value={ep.synopsis ?? ""} onChange={(e) => patch({ synopsis: e.target.value })} rows={2} placeholder="简单写几句这一集的剧情" style={{ ...INPUT, resize: "vertical" }} />
      </div>

      {/* 本集视频：来自「逐集制作」合成的成片，互动点按它的时长核对 */}
      <div className="card col gap-2" style={{ padding: 12, background: "var(--surface-2)" }}>
        <div className="row gap-2">
          <Film size={14} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>这一集的成片</span>
          <span className="grow" />
          {ep.videoUrl ? (
            <span className="tag tag-green num" style={{ height: 20, flex: "none" }}>已成片 · {ep.durationSec} 秒</span>
          ) : (
            <span className="tag tag-gray" style={{ height: 20, flex: "none" }}>还没成片</span>
          )}
        </div>
        {ep.videoUrl ? (
          <video src={ep.videoUrl} controls muted playsInline style={{ width: "100%", maxHeight: 200, borderRadius: 8, background: "#000" }} />
        ) : (
          <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
            点「制作本集」去逐镜出首帧和视频，再合成成片。观众看到的就是这条成片。
          </div>
        )}
        <button type="button" className="btn btn-grad btn-sm" style={{ alignSelf: "flex-start" }} onClick={onProduce}>
          <ArrowRight size={13} /> {ep.videoUrl ? "去修改本集" : "制作本集"}
        </button>
      </div>

      {/* 结局 / 播完接哪一集 */}
      <div className="col gap-2">
        <label className="row gap-2" style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={ep.isEnding}
            onChange={(e) => patch({ isEnding: e.target.checked, ...(e.target.checked ? { nextVideoId: null } : {}), endingLabel: e.target.checked ? ep.endingLabel || "结局" : undefined })}
          />
          <Flag size={13} style={{ color: ep.isEnding ? "#d97706" : "var(--ink-3)", flex: "none" }} /> 这一集是结局集
        </label>
        {ep.isEnding ? (
          <div className="col gap-1">
            <span style={LABEL}>结局名（观众会看到）</span>
            <input value={ep.endingLabel ?? ""} onChange={(e) => patch({ endingLabel: e.target.value })} placeholder="比如：逃出生天" style={INPUT} />
          </div>
        ) : (
          <div className="col gap-1">
            <span style={LABEL}>播完自动接哪一集（没有互动点时用这个）</span>
            <select value={ep.nextVideoId ?? ""} onChange={(e) => patch({ nextVideoId: e.target.value || null })} style={INPUT}>
              <option value="">不自动接（由互动点决定去哪）</option>
              {targets.map((t) => (
                <option key={t.episodeId} value={t.episodeId}>{epOptionLabel(t)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 互动点 */}
      <div className="col gap-2">
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <Clock size={14} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 800, fontSize: 13.5, whiteSpace: "nowrap", flex: "none" }}>互动点</span>
          <span className="faint" style={{ fontSize: 11, minWidth: 0, flex: "1 1 120px" }}>播到设定的秒数时弹出</span>
          <button type="button" className="btn btn-line btn-sm" onClick={addInteraction} disabled={ep.isEnding} style={{ flex: "none" }}>
            <Plus size={13} /> 添加互动点
          </button>
        </div>
        {ep.isEnding ? (
          <div className="faint" style={{ fontSize: 11.5 }}>结局集不用再设互动点。</div>
        ) : ep.interactions.length === 0 ? (
          <div className="faint" style={{ fontSize: 11.5 }}>还没有互动点。加一个，让观众自己选剧情往哪走。</div>
        ) : (
          ep.interactions.map((it, idx) => {
            const cond = parseCondition(it.condition);
            const condUnreadable = !!it.condition?.trim() && !cond;
            const condFlagGone = !!cond && !hasFlag(cond.flag); // 条件用的剧情状态已经删了
            const condKind = cond ? flagKindOf(condFlagGone ? cond.value : flags[cond.flag]) : "boolean";
            const condStale = !!cond && !condFlagGone && !conditionFitsFlag(cond, flags[cond.flag]);
            const condOps = opsForFlagKind(condKind);
            const clearCond = () => setInteraction(idx, { condition: undefined });
            return (
              <div key={it.id} className="card col gap-2" style={{ padding: 12 }}>
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  <div className="row gap-1" style={{ flex: "none" }}>
                    <span style={LABEL}>第</span>
                    <input type="number" aria-label="第几秒弹出" value={it.triggerTime} onChange={(e) => setInteraction(idx, { triggerTime: Math.max(0, Number(e.target.value) || 0) })} style={{ ...INPUT, width: 64, padding: "4px 6px" }} />
                    <span style={LABEL}>秒弹出</span>
                  </div>
                  <select
                    value={it.interactionType}
                    aria-label="互动方式"
                    title={TYPE_HINT[it.interactionType]}
                    onChange={(e) => setInteraction(idx, { interactionType: e.target.value as InteractionType })}
                    style={{ ...INPUT, width: 104 }}
                  >
                    <option value="choice">选一项</option>
                    <option value="input">填一句话</option>
                    <option value="countdown">倒计时</option>
                  </select>
                  <div className="row gap-1" style={{ flex: "none" }}>
                    <span style={LABEL}>限时</span>
                    <input type="number" aria-label="限时秒数" value={it.uiConfig.countdownSec ?? 0} onChange={(e) => setUi(idx, { countdownSec: Math.max(0, Number(e.target.value) || 0) || undefined })} style={{ ...INPUT, width: 56, padding: "4px 6px" }} />
                    <span style={LABEL}>秒</span>
                  </div>
                  <span className="grow" />
                  <button type="button" className="btn btn-icon btn-ghost btn-sm wb-touch-icon" title="删除这个互动点" aria-label="删除这个互动点" style={{ color: "var(--danger)", flex: "none" }} onClick={() => removeInteraction(idx)}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="faint" style={{ fontSize: 11 }}>{TYPE_HINT[it.interactionType]}</div>
                <input value={it.uiConfig.question} onChange={(e) => setUi(idx, { question: e.target.value })} placeholder="问观众什么，比如：要不要开门？" aria-label="问观众什么" style={INPUT} />

                {/* 弹出条件：三个下拉拼成 condition 字符串 */}
                <div className="col gap-1">
                  <span style={LABEL}>弹出条件（可选，不设就每次都弹）</span>
                  {condUnreadable ? (
                    <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                      <span className="faint" style={{ fontSize: 11.5 }}>这条条件的写法这里改不了</span>
                      <button type="button" className="chip" onClick={clearCond}>
                        清掉，重新设
                      </button>
                    </div>
                  ) : !cond && flagNames.length === 0 ? (
                    <span className="faint" style={{ fontSize: 11.5 }}>先在「剧情状态」里添加一条，才能按它设条件。</span>
                  ) : (
                    <>
                      <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                        <select
                          value={cond?.flag ?? ""}
                          aria-label="按哪个剧情状态判断"
                          onChange={(e) => {
                            const f = e.target.value;
                            if (!f) return clearCond();
                            setInteraction(idx, { condition: buildCondition({ flag: f, op: "==", value: defaultValueOf(f) }) });
                          }}
                          style={{ ...INPUT, width: 140, ...(condFlagGone ? STALE_INPUT : {}) }}
                        >
                          <option value="">不设条件</option>
                          {cond && condFlagGone && <option value={cond.flag}>{cond.flag}（已删除）</option>}
                          {flagNames.map((f) => (<option key={f} value={f}>{f}</option>))}
                        </select>
                        {cond && (
                          <>
                            <select
                              value={cond.op}
                              aria-label="怎么比较"
                              onChange={(e) => setInteraction(idx, { condition: buildCondition({ ...cond, op: e.target.value as ConditionOp }) })}
                              style={{ ...INPUT, width: 88, ...(condOps.includes(cond.op) ? {} : STALE_INPUT) }}
                            >
                              {/* 改过类型后旧的比较方式（如「大于」）不在可选范围里，照实显示出来等重选 */}
                              {!condOps.includes(cond.op) && <option value={cond.op}>{OP_LABEL[cond.op]}</option>}
                              {condOps.map((op) => (
                                <option key={op} value={op}>{OP_LABEL[op]}</option>
                              ))}
                            </select>
                            <FlagValueInput
                              declared={condFlagGone ? undefined : flags[cond.flag]}
                              value={cond.value}
                              onChange={(v) =>
                                setInteraction(idx, {
                                  condition: buildCondition({ ...cond, op: condOps.includes(cond.op) ? cond.op : "==", value: v }),
                                })
                              }
                            />
                          </>
                        )}
                      </div>
                      {condFlagGone && cond && (
                        <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                          <span style={HINT_DANGER}>「{cond.flag}」这条剧情状态已经删了，在「剧情状态」里加回来，或者清掉这个条件。</span>
                          <button type="button" className="chip" onClick={clearCond}>
                            清掉条件
                          </button>
                        </div>
                      )}
                      {condStale && cond && (
                        <span style={HINT_DANGER}>
                          「{cond.flag}」现在记的是{FLAG_KIND_LABEL[condKind]}，这个条件还是按原来的类型设的，重新选一下。
                        </span>
                      )}
                    </>
                  )}
                </div>

                {it.interactionType === "input" ? (
                  <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                    <div className="col gap-1">
                      <span style={LABEL}>把观众填的内容记到</span>
                      <select
                        value={it.uiConfig.inputKey ?? ""}
                        onChange={(e) => setUi(idx, { inputKey: e.target.value || undefined })}
                        style={{ ...INPUT, width: 140, ...(it.uiConfig.inputKey && !hasFlag(it.uiConfig.inputKey) ? STALE_INPUT : {}) }}
                      >
                        <option value="">不记录</option>
                        {it.uiConfig.inputKey && !hasFlag(it.uiConfig.inputKey) && (
                          <option value={it.uiConfig.inputKey}>{it.uiConfig.inputKey}（已删除）</option>
                        )}
                        {flagNames.map((f) => (<option key={f} value={f}>{f}</option>))}
                      </select>
                    </div>
                    <div className="col gap-1 grow" style={{ minWidth: 0 }}>
                      <span style={LABEL}>输入框里的提示文字</span>
                      <input value={it.uiConfig.placeholder ?? ""} onChange={(e) => setUi(idx, { placeholder: e.target.value || undefined })} placeholder="比如：写下你想对她说的话" style={INPUT} />
                    </div>
                  </div>
                ) : (
                  <div className="col gap-2">
                    <span style={LABEL}>选项（选了之后跳到哪一集）</span>
                    {(it.uiConfig.options ?? []).map((o, oIdx) => (
                      <div key={o.id} className="col gap-1" style={{ border: "1px solid var(--line-soft)", borderRadius: 10, padding: 9 }}>
                        <div className="row gap-2">
                          <span className="num tag tag-accent" style={{ height: 22, flex: "none" }}>{o.id}</span>
                          <input value={o.text} onChange={(e) => setOption(idx, oIdx, { text: e.target.value })} placeholder="观众看到的选项文字" aria-label="选项文字" style={{ ...INPUT, flex: 1 }} />
                          <button type="button" className="btn btn-icon btn-ghost btn-sm wb-touch-icon" title="删除这个选项" aria-label="删除这个选项" style={{ color: "var(--danger)", flex: "none" }} onClick={() => removeOption(idx, oIdx)}>
                            <X size={13} />
                          </button>
                        </div>
                        <div className="row gap-1" style={{ minWidth: 0 }}>
                          <GitBranch size={12} style={{ color: "var(--accent)", flex: "none" }} />
                          <select value={o.nextVideoId ?? ""} aria-label="选了之后跳到哪一集" onChange={(e) => setOption(idx, oIdx, { nextVideoId: e.target.value || null })} style={{ ...INPUT, flex: 1 }}>
                            <option value="">选了之后跳到…（还没连）</option>
                            {targets.map((t) => (<option key={t.episodeId} value={t.episodeId}>{epOptionLabel(t)}</option>))}
                          </select>
                        </div>
                        {/* 选了之后记下的剧情状态 */}
                        <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                          {Object.entries(o.setFlags ?? {}).map(([k, v]) => {
                            const gone = !hasFlag(k);
                            return (
                              <span
                                key={k}
                                className="row gap-1 tag tag-gray"
                                style={{ height: "auto", minHeight: 26, padding: "2px 6px", maxWidth: "100%", flexWrap: "wrap", ...(gone ? { color: "var(--danger)" } : {}) }}
                              >
                                <span
                                  style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}
                                  title={gone ? `「${k}」这条剧情状态已经删了，点旁边的 × 不再记下它` : `选了之后记下：${k}`}
                                >
                                  记下「{k}」{gone ? "（已删除）" : ""}
                                </span>
                                <FlagValueInput
                                  declared={gone ? undefined : flags[k]}
                                  value={v}
                                  onChange={(val) => setOptionFlag(idx, oIdx, k, val)}
                                  style={{ height: 22, padding: "0 4px", fontSize: 11, width: flagKindOf(gone ? v : flags[k]) === "string" ? 80 : 56 }}
                                />
                                <button type="button" aria-label={`不再记下「${k}」`} title="不再记下" onClick={() => removeOptionFlag(idx, oIdx, k)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)", lineHeight: 0, flex: "none" }}>
                                  <X size={11} />
                                </button>
                              </span>
                            );
                          })}
                          {flagNames.some((f) => (o.setFlags ?? {})[f] === undefined) && (
                            <select
                              value=""
                              aria-label="选了之后记下哪个剧情状态"
                              onChange={(e) => { if (e.target.value) setOptionFlag(idx, oIdx, e.target.value, defaultValueOf(e.target.value)); }}
                              style={{ ...INPUT, width: 150, height: 28, padding: "2px 6px", fontSize: 11.5 }}
                            >
                              <option value="">+ 选了之后记下…</option>
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
            );
          })
        )}
      </div>
    </div>
  );
}
