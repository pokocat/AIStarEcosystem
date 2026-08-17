"use client";

// 分镜表（v0.88）— 设计稿 AI短剧工作台.dc.html「剧集脚本 · 分镜表」平铺表格。
// 列：镜号 / 时长 / 首帧 / 画面内容 / 镜头 / 台词·音频 / 特效氛围。所有单元格结构化可编辑、落库；
// 首帧 4 态（待生成→生成中→首帧→成片）+ 点首帧开「AI 改图」对话式迭代（复用 render/frame + ref 图）。
import * as React from "react";
import { ArrowRight, Check, Clapperboard, Image as ImageIcon, Play, Plus, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { CreditButton, Editable, GenFramePlaceholder, Thumb } from "@/components/drama-ui";
import { MediaLightbox, type LightboxMedia } from "./media-lightbox";
import { AiImageEditModal } from "./ai-image-edit-modal";
import type { FormShot, ShotFlow } from "./shot-form";
import type { SceneAsset } from "@/mocks/drama-workshop";
import { CharacterMentionInput, type MentionChar } from "./character-mention-input";

const FRAME_COST = 2; // 首帧默认价（drama.credit.frame）；视频价走 material.video-generate 由 props 传入
// 运动幅度（拆镜 variation_type）用户友好文案，仅用于 hover 提示，不直接暴露 small/medium/large 黑话。
const VARI: Record<string, string> = { small: "小幅", medium: "中幅", large: "大幅" };

// C-1 参考生效回报的用户友好文案（不暴露 role/reason 内部枚举原值，§跨 app 约定）。
const REF_ROLE_LABEL: Record<string, string> = {
  ref: "参考图", character: "角色参考", scene: "场景参考",
  prev_last_frame: "上一镜末帧", first_frame: "首帧", last_frame: "尾帧",
};
const REF_REASON_LABEL: Record<string, string> = {
  local_unfetchable: "本地开发环境的参考图外部模型抓取不到（生产环境正常生效）",
  model_no_flf: "当前视频模型不支持尾帧，未生效",
  model_no_image_input: "当前模型仅开放文生视频，参考图未送达",
  over_max_refs: "超出模型参考图数量上限，未送达",
  empty: "参考图为空",
};

/** 「参考 N/M 生效」chip：仅在有参考被过滤时显示（全部生效则不打扰）；被过滤项与原因放 hover 提示。 */
function AppliedRefsChip({ refs }: { refs?: import("@/api/render").AppliedRefs }) {
  if (!refs || refs.requested === 0 || refs.applied >= refs.requested) return null;
  const droppedLines = refs.items
    .filter((it) => !it.applied)
    .map((it) => `· ${REF_ROLE_LABEL[it.role] ?? "参考图"}：${REF_REASON_LABEL[it.reason ?? ""] ?? "未生效"}`);
  return (
    <div
      className="row"
      style={{ gap: 3, alignItems: "center", fontSize: 9, color: "var(--warn, #d97706)", maxWidth: 118, minWidth: 0 }}
      title={`上次生成实际生效 ${refs.applied}/${refs.requested} 张参考：\n${droppedLines.join("\n")}`}
    >
      <ImageIcon size={9} style={{ flex: "none" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>参考 {refs.applied}/{refs.requested} 生效</span>
    </div>
  );
}
const TH: React.CSSProperties = { padding: "11px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".04em", borderBottom: "2px solid var(--line)", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top", borderBottom: "1px solid var(--line-soft)" };

function fmtT(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export interface SbScene { id: string; place: string; mood: string; sceneRefId?: string }

export interface StoryboardTableProps {
  scenes: SbScene[];
  /** 项目级场景资产（可上传/AI 生成）——供每场绑定场景参考图，保障场景一致性。 */
  sceneAssets?: SceneAsset[];
  /** 本集角色——画面内容 @提及菜单来源；内联提及即本镜出场人物（写入 shot.cast）。 */
  characters?: MentionChar[];
  /** 首帧/视频/拆镜真实单价（均短剧 app 维度 drama.credit.*，admin 可配）；驱动按钮展示与确认阈值。 */
  frameCost?: number;
  clipCost?: number;
  splitCost?: number;
  shotsMap: Record<string, FormShot[]>;
  speakerOptions: string[];
  locked?: boolean;
  busyMap: Record<string, ShotFlow | null | undefined>;
  starts: Map<string, number>;
  genScene: string | null;
  onUpdScene: (i: number, patch: Partial<SbScene>) => void;
  onUpdShot: (sceneId: string, shotId: string, patch: Partial<FormShot>) => void;
  onDelShot: (sceneId: string, shotId: string) => void;
  onAddShot: (sceneId: string, sceneIdx: number) => void;
  onGenShots: (sceneId: string, sceneIdx: number) => void;
  onRender: (sceneId: string, shotId: string, kind: "frame" | "direct" | "clip") => void;
  onApprove: (sceneId: string, shotId: string) => void;
  /** AI 改图回填：把新版首帧落到该镜。 */
  onFrameEdited: (sceneId: string, shotId: string, frameUrl: string) => void;
  /** v0.97：AI 拆镜（首/末帧 + 运动 + 变化等级）。 */
  onDecompose: (sceneId: string, shotId: string) => void;
  /** v0.97 P5：行级就地改写本镜（按指令只改这一镜）。 */
  onRewriteShot?: (sceneId: string, shotId: string, instruction: string) => void;
  /** 正在改写的镜 id（显示 busy）。 */
  rewritingId?: string | null;
  /**
   * 出片（生成视频 / 直接出片）前的一致性问题即时求值。返回非空 → CreditButton 弹单个 danger 确认
   * （费用 + 警告合并），替代此前「费用弹窗 + 一致性弹窗」两个叠加弹窗。不传（如短视频线）则无警告。
   */
  getClipWarnings?: (sceneId: string, shot: FormShot) => string[];
}

export function StoryboardTable(props: StoryboardTableProps) {
  const { scenes, shotsMap, speakerOptions, locked, busyMap, starts, genScene } = props;
  const [edit, setEdit] = React.useState<{ sceneId: string; shot: FormShot } | null>(null);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 940, borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th style={{ ...TH, width: 52, textAlign: "center" }}>镜号</th>
              <th style={{ ...TH, width: 64, textAlign: "center" }}>时长</th>
              <th style={{ ...TH, width: 132, textAlign: "center" }}>首帧</th>
              <th style={{ ...TH, width: 250 }}>画面内容</th>
              <th style={{ ...TH, width: 92 }}>镜头</th>
              <th style={{ ...TH, width: 240 }}>台词 · 音频</th>
              <th style={{ ...TH, width: 130 }}>特效氛围</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((sc, i) => {
              const shots = shotsMap[sc.id] ?? [];
              return (
                <React.Fragment key={sc.id}>
                  {/* 场分隔行 */}
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td colSpan={7} style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)" }}>
                      <div className="row gap-2" style={{ alignItems: "center" }}>
                        <span className="num tag tag-accent" style={{ flex: "none" }}>场 {i + 1}</span>
                        <span style={{ fontWeight: 700, fontSize: 12.5 }}>
                          <Editable value={sc.place} placeholder="时空标题" onCommit={(v) => props.onUpdScene(i, { place: v })} />
                        </span>
                        <span className="tag tag-gray" style={{ flex: "none" }}>
                          <Editable value={sc.mood} placeholder="情绪" onCommit={(v) => props.onUpdScene(i, { mood: v })} />
                        </span>
                        <span className="grow" />
                        {(props.sceneAssets?.length ?? 0) > 0 && (() => {
                          const bound = props.sceneAssets!.find((a) => a.id === sc.sceneRefId);
                          return (
                            <span className="row" style={{ gap: 4, alignItems: "center", flex: "none" }} title="本场各镜首帧套用的场景参考图，保障同一场景画面一致">
                              {bound?.refUrl && <img src={bound.refUrl} alt="场景参考" style={{ width: 22, height: 14, objectFit: "cover", borderRadius: 3, border: "1px solid var(--line)" }} />}
                              <span className="faint" style={{ fontSize: 10.5 }}>场景参考</span>
                              <select
                                value={sc.sceneRefId ?? ""}
                                aria-label="场景参考图"
                                onChange={(e) => props.onUpdScene(i, { sceneRefId: e.target.value || undefined })}
                                style={{ fontSize: 10.5, height: 23, borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink-1)", maxWidth: 140, padding: "0 4px" }}
                              >
                                <option value="">不绑定</option>
                                {props.sceneAssets!.map((a) => (
                                  <option key={a.id} value={a.id}>{a.name}{a.refUrl ? "" : "（未出图）"}</option>
                                ))}
                              </select>
                            </span>
                          );
                        })()}
                        {shots.length > 0 && <span className="faint num" style={{ fontSize: 11 }}>{shots.length} 镜 · {shots.reduce((a, x) => a + x.dur, 0)}s</span>}
                        {!locked && shots.length > 0 && (
                          <button type="button" className="chip" style={{ height: 23, fontSize: 10.5 }} onClick={() => props.onAddShot(sc.id, i)}>
                            <Plus size={11} /> 加一镜
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* 未拆镜：拆分镜入口 */}
                  {shots.length === 0 && genScene !== sc.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: "14px 12px", borderBottom: "1px solid var(--line-soft)", textAlign: "center" }}>
                        {!locked ? (
                          <div className="row gap-2" style={{ justifyContent: "center", alignItems: "center" }}>
                            <button type="button" className="btn btn-line btn-sm" onClick={() => props.onAddShot(sc.id, i)}>
                              <Plus size={13} /> 加一镜
                            </button>
                            <CreditButton cost={props.splitCost ?? 6} onConfirm={() => props.onGenShots(sc.id, i)} confirmTitle="拆分镜" confirmBody="AI 将本场拆解为可逐镜编辑的分镜（需先填写场面描述或台词，否则将先生成一条空镜头供手动填写）。" className="btn btn-primary btn-sm">
                              <Wand2 size={13} /> 让 AI 拆分镜
                            </CreditButton>
                          </div>
                        ) : <span className="faint" style={{ fontSize: 12 }}>本场暂无分镜</span>}
                      </td>
                    </tr>
                  )}
                  {genScene === sc.id && (
                    <tr><td colSpan={7} style={{ padding: 14 }}><div className="skel" style={{ height: 40 }} /></td></tr>
                  )}
                  {/* 分镜行 */}
                  {shots.map((s) => (
                    <ShotRow
                      key={s.id}
                      s={s}
                      start={starts.get(s.id) ?? 0}
                      busy={busyMap[s.id] ?? null}
                      locked={locked}
                      speakerOptions={speakerOptions}
                      characters={props.characters ?? []}
                      frameCost={props.frameCost}
                      clipCost={props.clipCost}
                      onPatch={(patch) => props.onUpdShot(sc.id, s.id, patch)}
                      onDelete={() => props.onDelShot(sc.id, s.id)}
                      onRender={(kind) => props.onRender(sc.id, s.id, kind)}
                      onApprove={() => props.onApprove(sc.id, s.id)}
                      onAiEdit={() => setEdit({ sceneId: sc.id, shot: s })}
                      onDecompose={() => props.onDecompose(sc.id, s.id)}
                      onPick={(url) => props.onUpdShot(sc.id, s.id, { frameUrl: url })}
                      rewriting={props.rewritingId === s.id}
                      onRewrite={props.onRewriteShot ? (ins) => props.onRewriteShot!(sc.id, s.id, ins) : undefined}
                      getClipWarnings={props.getClipWarnings ? () => props.getClipWarnings!(sc.id, s) : undefined}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && (
        <AiImageEditModal
          tag={`镜 ${edit.shot.no}`}
          openingText={`这是镜 ${edit.shot.no} 的首帧。描述想要的修改即可，例如「换成夜景」「让她回头」「调整为更高级的色调」。`}
          baseDesc={edit.shot.visual || "分镜画面"}
          initialUrl={edit.shot.frameUrl ?? edit.shot.frameUrls?.[0]}
          ratio="9:16"
          cost={props.frameCost}
          chips={["换成夜景", "让她回头", "换暖色调", "背景虚化", "再高级一点"]}
          onClose={() => setEdit(null)}
          onCommit={(f) => { props.onFrameEdited(edit.sceneId, edit.shot.id, f.url); }}
        />
      )}
    </div>
  );
}

const REWRITE_CHIPS = ["惊喜化", "更紧凑", "换个机位", "强化冲突", "补一句台词"];

function ShotRow({
  s, start, busy, locked, speakerOptions, characters, frameCost, clipCost, onPatch, onDelete, onRender, onApprove, onAiEdit, onDecompose, onPick, rewriting, onRewrite, getClipWarnings,
}: {
  s: FormShot; start: number; busy: ShotFlow | null; locked?: boolean; speakerOptions: string[]; characters: MentionChar[]; frameCost?: number; clipCost?: number;
  onPatch: (patch: Partial<FormShot>) => void; onDelete: () => void;
  onRender: (kind: "frame" | "direct" | "clip") => void; onApprove: () => void; onAiEdit: () => void;
  onDecompose: () => void; onPick: (url: string) => void;
  rewriting?: boolean; onRewrite?: (instruction: string) => void;
  getClipWarnings?: () => string[];
}) {
  const [rwOpen, setRwOpen] = React.useState(false);
  const [rwText, setRwText] = React.useState("");
  const submitRw = (text: string) => {
    const t = text.trim();
    if (!t || !onRewrite) return;
    onRewrite(t);
    setRwText("");
    setRwOpen(false);
  };
  const whoList = speakerOptions.includes(s.voWho) || !s.voWho ? speakerOptions : [s.voWho, ...speakerOptions];
  const badge =
    s.flow === "done" ? <span className="tag tag-green" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>成片</span>
    : s.flow === "frame" ? <span className="tag tag-amber" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>首帧</span>
    : s.flow === "clip" ? <span className="tag tag-amber" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>待验收</span>
    : <span className="tag tag-gray" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>待生成</span>;
  return (
    <tr>
      <td style={{ ...TD, textAlign: "center" }}>
        <div className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", lineHeight: 1.1 }}>{s.no}</div>
        <div style={{ marginTop: 6 }}>{badge}</div>
        {!locked && onRewrite && (
          <button
            type="button"
            title="AI 改写本镜（只改这一镜）"
            onClick={() => setRwOpen((v) => !v)}
            disabled={rewriting}
            style={{ marginTop: 8, background: "none", border: "none", cursor: "pointer", color: rwOpen ? "var(--accent)" : "var(--ink-3)", display: "block", marginInline: "auto" }}
          >
            <Wand2 size={13} />
          </button>
        )}
        {!locked && (
          <button type="button" title="删除本镜" onClick={onDelete} style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "block", marginInline: "auto" }}>
            <X size={12} />
          </button>
        )}
      </td>
      <td style={{ ...TD, textAlign: "center" }}>
        <div className="num" style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.4 }}>{fmtT(start)}<br />{fmtT(start + (s.dur || 0))}</div>
        <input type="number" min={1} max={60} value={s.dur} disabled={locked} aria-label="时长（秒）"
          onChange={(e) => onPatch({ dur: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
          style={{ width: 40, height: 20, marginTop: 4, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11, textAlign: "center", outline: "none", background: "var(--surface)" }} />
      </td>
      <td style={{ ...TD, textAlign: "center" }}>
        <ShotFrameCell s={s} busy={busy} onRender={onRender} onApprove={onApprove} onAiEdit={onAiEdit} onDecompose={onDecompose} onPick={onPick} frameCost={frameCost} clipCost={clipCost} getClipWarnings={getClipWarnings} />
      </td>
      <td style={TD}>
        {/* v0.98：@提及富文本——输入 @ 选角色成内联 chip，chip 即本镜出场人物（→ shot.cast → 首帧喂角色参考图锁脸）。 */}
        <CharacterMentionInput
          value={s.visual}
          characters={characters}
          disabled={locked}
          onChange={(visual, cast) => onPatch({ visual, cast })}
        />
        {/* v0.97 P5：行级就地改写本镜（指令 + 快捷 chip，只改这一镜，替代整篇推倒重写的浮窗） */}
        {rwOpen && onRewrite && (
          <div className="col gap-2" style={{ marginTop: 8, padding: 8, borderRadius: 10, background: "var(--accent-soft)", border: "1px solid var(--line-soft)" }}>
            <div className="row gap-1" style={{ alignItems: "center" }}>
              <Sparkles size={11} style={{ color: "var(--accent)", flex: "none" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>AI 改写本镜</span>
              {rewriting && <span className="faint" style={{ fontSize: 10.5 }}>改写中…</span>}
              <span className="grow" />
              <button type="button" onClick={() => setRwOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}><X size={12} /></button>
            </div>
            <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              {REWRITE_CHIPS.map((c) => (
                <button key={c} type="button" disabled={rewriting} onClick={() => submitRw(c)}
                  className="chip" style={{ height: 22, fontSize: 10.5 }}>{c}</button>
              ))}
            </div>
            <div className="row gap-1">
              <input
                value={rwText}
                disabled={rewriting}
                placeholder="或描述想怎么改这一镜…"
                onChange={(e) => setRwText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitRw(rwText); }}
                style={{ flex: 1, minWidth: 0, height: 26, border: "1px solid var(--line)", borderRadius: 7, fontSize: 12, padding: "0 8px", outline: "none", background: "var(--surface)" }}
              />
              <button type="button" disabled={rewriting || !rwText.trim()} onClick={() => submitRw(rwText)} className="btn btn-grad btn-sm" style={{ height: 26, fontSize: 11, padding: "0 10px" }}>改</button>
            </div>
          </div>
        )}
      </td>
      <td style={TD}>
        <div className="col gap-2" style={{ fontSize: 12 }}>
          <div className="col" style={{ gap: 1 }}><span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>景别</span>
            <Editable className="edit-field" value={s.size} placeholder="景别" onCommit={(v) => onPatch({ size: v })} style={{ padding: "2px 5px" }} /></div>
          <div className="col" style={{ gap: 1 }}><span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>运镜</span>
            <Editable className="edit-field" value={s.move} placeholder="运镜" onCommit={(v) => onPatch({ move: v })} style={{ padding: "2px 5px" }} /></div>
        </div>
      </td>
      <td style={TD}>
        <div className="row gap-1" style={{ alignItems: "center", marginBottom: 3 }}>
          <select value={s.voWho || speakerOptions[0]} disabled={locked} aria-label="台词说话人" onChange={(e) => onPatch({ voWho: e.target.value })}
            style={{ height: 22, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "var(--surface-2)", color: "var(--accent)", outline: "none", maxWidth: 110 }}>
            {whoList.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <Editable block value={s.voText} placeholder="台词 / 口播…（留空=空镜）" onCommit={(v) => onPatch({ voText: v })}
          className="edit-field" style={{ display: "block", fontSize: 12.5, lineHeight: 1.6, padding: "3px 6px", background: "var(--accent-soft)", borderRadius: 8 }} />
        <div className="col" style={{ gap: 1, marginTop: 7, fontSize: 11, color: "var(--ink-2)" }}>
          <span className="row gap-1"><span className="faint" style={{ fontWeight: 700, flex: "none" }}>音效</span>
            <Editable className="edit-field" value={s.sfx} placeholder="环境音…" onCommit={(v) => onPatch({ sfx: v })} style={{ flex: 1, minWidth: 0 }} /></span>
          <span className="row gap-1"><span className="faint" style={{ fontWeight: 700, flex: "none" }}>BGM</span>
            <Editable className="edit-field" value={s.bgm} placeholder="无 / 渐入…" onCommit={(v) => onPatch({ bgm: v })} style={{ flex: 1, minWidth: 0 }} /></span>
        </div>
      </td>
      <td style={TD}>
        <Editable block value={s.fx} placeholder="光效 / 慢放 / 提亮…" onCommit={(v) => onPatch({ fx: v })}
          className="edit-field muted" style={{ display: "block", fontSize: 12, lineHeight: 1.6, padding: "3px 5px" }} />
      </td>
    </tr>
  );
}

/** 首帧渲染单元（紧凑版，表格用）。短剧分镜表 + 短视频分镜表共用。
 *  v0.97：项目表额外传 onPick（2 版首帧参考图挑选）+ onDecompose（补末帧 → 首/末帧双联），短视频表可不传。 */
export function ShotFrameCell({ s, busy, onRender, onApprove, onAiEdit, onDecompose, onPick, frameCost = FRAME_COST, clipCost = 30, getClipWarnings }: {
  s: FormShot; busy: ShotFlow | null;
  onRender: (kind: "frame" | "direct" | "clip") => void; onApprove: () => void; onAiEdit: () => void;
  onDecompose?: () => void; onPick?: (url: string) => void;
  /** 首帧/视频真实单价（首帧 drama.credit.frame；视频沿用带货线 material.video-generate，默认 30）。 */
  frameCost?: number; clipCost?: number;
  /** 出片（生成视频 / 直接出片）前的一致性问题即时求值；非空 → CreditButton 弹单个 danger 确认。短视频线不传。 */
  getClipWarnings?: () => string[];
}) {
  const isVideo = s.flow === "clip" || s.flow === "done";
  const frameSrc = s.frameUrl ?? s.frameUrls?.[0];
  const [lb, setLb] = React.useState<LightboxMedia | null>(null);
  const [scrub, setScrub] = React.useState(false); // 首帧→末帧 hover 预演
  const hasDual = s.flow === "frame" && !!frameSrc && !!s.endFrameUrl;
  return (
    <div className="col" style={{ alignItems: "center", gap: 6 }}>
      {busy ? (
        <GenFramePlaceholder width={62} height={96} radius={9} />
      ) : s.flow === "draft" ? (
        <div className="col center" style={{ width: 62, height: 96, borderRadius: 9, border: "1.5px dashed var(--line)", background: "var(--surface-2)", color: "var(--ink-3)", gap: 4 }}>
          <ImageIcon size={17} /><span style={{ fontSize: 9, fontWeight: 600 }}>无首帧</span>
        </div>
      ) : isVideo && s.videoUrl ? (
        <button type="button" onClick={() => setLb({ src: s.videoUrl!, kind: "video" })} title="点开预览" style={{ position: "relative", width: 62, height: 96, borderRadius: 9, overflow: "hidden", border: "none", cursor: "zoom-in", padding: 0, background: "#000" }}>
          <video src={s.videoUrl} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.9)", display: "grid", placeItems: "center" }}><Play size={11} style={{ color: "var(--ink)", marginLeft: 1 }} /></span>
          </span>
        </button>
      ) : hasDual ? (
        // 拆镜后：首帧 ▷ 末帧 双联。首帧格 hover 预演运动 + 点开 AI 改图；末帧格点开看大图。
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            type="button"
            tabIndex={0}
            onClick={onAiEdit}
            onMouseEnter={() => setScrub(true)}
            onMouseLeave={() => setScrub(false)}
            onFocus={() => setScrub(true)}
            onBlur={() => setScrub(false)}
            title="首帧 → 末帧（悬停或聚焦预演运动）· 点开 AI 改图"
            style={{ position: "relative", width: 44, height: 70, borderRadius: 7, overflow: "hidden", border: "none", padding: 0, cursor: "pointer", boxShadow: scrub ? "0 0 0 2px var(--accent)" : "none" }}
          >
            <img src={frameSrc} alt="首帧" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: scrub ? 0 : 1, transition: "opacity .5s" }} />
            <img src={s.endFrameUrl} alt="末帧" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: scrub ? 1 : 0, transition: "opacity .5s" }} />
            <span style={{ position: "absolute", left: 2, top: 2, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 7.5, fontWeight: 700, padding: "0 3px", borderRadius: 3 }}>{scrub ? "末" : "首"}</span>
          </button>
          <ArrowRight size={11} style={{ color: "var(--accent)", flex: "none" }} />
          <button
            type="button"
            onClick={() => s.endFrameUrl && setLb({ src: s.endFrameUrl, kind: "image" })}
            title="末帧 · 点开看大图"
            style={{ width: 30, height: 48, borderRadius: 6, overflow: "hidden", border: "none", padding: 0, cursor: "zoom-in", opacity: 0.9 }}
          >
            <img src={s.endFrameUrl} alt="末帧" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        </div>
      ) : (
        // 首帧已出：点开 AI 改图
        <button type="button" onClick={onAiEdit} title="点开 AI 改图" style={{ position: "relative", width: 62, height: 96, borderRadius: 9, overflow: "hidden", border: "none", cursor: "pointer", padding: 0 }}>
          {frameSrc
            ? <img src={frameSrc} alt={"镜" + s.no} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <Thumb from="#fb923c" to="#f472b6" ratio="9/14" radius={0} style={{ width: "100%", height: "100%" }} />}
          <span className="row center gap-1" style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 8.5, fontWeight: 600, padding: "2px 0" }}>
            <Wand2 size={9} /> AI 改图
          </span>
        </button>
      )}

      {/* 首帧参考图挑选（出 2 版，点选即锁；仅项目表传 onPick）。补末帧后锁定不再可改选（避免首末帧不同源）。 */}
      {!busy && s.flow === "frame" && onPick && !s.endFrameUrl && (s.frameUrls?.length ?? 0) > 1 && (
        <div className="row" style={{ gap: 4, justifyContent: "center" }}>
          {s.frameUrls!.slice(0, 2).map((u, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPick(u)}
              title={`选第 ${i + 1} 版`}
              style={{ width: 26, height: 42, borderRadius: 6, overflow: "hidden", padding: 0, cursor: "pointer", border: (s.frameUrl ?? s.frameUrls![0]) === u ? "2px solid var(--accent)" : "1px solid var(--line)" }}
            >
              <img src={u} alt={`版${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      {/* 拆镜后状态：首尾帧就绪（可视文案用户友好、定宽不溢出；运动幅度 + 运动描述放 hover 提示）。 */}
      {!busy && s.motionDesc && (
        <div
          className="row"
          style={{ gap: 3, alignItems: "center", fontSize: 9, color: "var(--ink-3)", maxWidth: 118, minWidth: 0 }}
          title={`首帧→末帧运动幅度：${VARI[s.variationType ?? ""] ?? "适中"}。${s.motionDesc}`}
        >
          <Sparkles size={9} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>首尾帧就绪</span>
        </div>
      )}

      {/* C-1：参考生效回报——有参考被过滤（本地不可达/模型不支持尾帧…）时如实提示，全部生效不显示。 */}
      {!busy && <AppliedRefsChip refs={s.appliedRefs} />}

      {/* 动作按钮（按状态） */}
      {!busy && s.flow === "draft" && (
        <>
          <CreditButton cost={frameCost} onConfirm={() => onRender("frame")} confirmTitle="生成首帧参考图" confirmBody={onPick ? "出 2 版首帧参考图，挑一版继续。" : "生成一版首帧参考图。"} className="btn btn-grad btn-sm" style={{ height: 26, width: 92, justifyContent: "center", fontSize: 11, padding: 0 }} markSize={11}>
            首帧参考图
          </CreditButton>
          <CreditButton
            cost={clipCost}
            alwaysConfirm
            getWarnings={getClipWarnings}
            onConfirm={() => onRender("direct")}
            confirmTitle="跳过首帧，直接出片？"
            confirmBody="不先出首帧参考图就直接生成视频，画面 / 人物 / 场景的一致性通常更差、也更难控。建议先「生成首帧参考图」挑一版满意的再出片。确定跳过首帧？"
            className="btn btn-ghost btn-sm"
            style={{ height: 22, fontSize: 10, color: "var(--ink-3)", padding: "0 6px" }}
            markSize={10}
          >
            直接出片
          </CreditButton>
        </>
      )}
      {!busy && s.flow === "frame" && (
        <>
          {/* 选好首帧后：可选「补末帧」——由 AI 拆出末帧画面（首尾帧双关键帧，出片运动更稳）→ 上方显示首帧▷末帧双联 + 悬停预演 */}
          {onDecompose && !s.motionDesc && (
            <button type="button" onClick={onDecompose} title="补末帧 · 首尾更稳——AI 生成本镜末帧画面（首帧→末帧双关键帧，出片起止更可控、更稳）" style={{ background: "none", border: "1px solid var(--line)", borderRadius: 7, cursor: "pointer", color: "var(--accent)", fontSize: 10, fontWeight: 700, height: 24, padding: "0 8px", whiteSpace: "nowrap" }}>
              <Sparkles size={10} /> 补末帧
            </button>
          )}
          <CreditButton cost={clipCost} getWarnings={getClipWarnings} onConfirm={() => onRender("clip")} confirmTitle="生成视频" confirmBody="基于已选首帧（有末帧则首尾帧双关键帧插值）生成这镜视频。" className="btn btn-grad btn-sm" style={{ height: 26, width: 92, justifyContent: "center", fontSize: 11, padding: 0 }} markSize={11}>
            <Clapperboard size={12} /> 生成视频
          </CreditButton>
        </>
      )}
      {!busy && s.flow === "clip" && (
        <button type="button" onClick={onApprove} className="btn btn-primary btn-sm" style={{ height: 25, width: 82, justifyContent: "center", fontSize: 10.5, padding: 0 }}>
          <Check size={11} /> 验收
        </button>
      )}
      {!busy && s.flow === "done" && (
        <CreditButton
          cost={frameCost}
          alwaysConfirm
          onConfirm={() => onRender("frame")}
          confirmTitle="重新生成首帧？"
          confirmBody="将重新生成首帧参考图，这镜会回到「挑首帧」步骤——已生成的视频和拆镜数据都会被清空，需要重新出片。"
          className="btn btn-line btn-sm"
          style={{ height: 25, width: 82, justifyContent: "center", fontSize: 10.5, padding: 0 }}
          markSize={10}
        >
          <RefreshCw size={10} /> 重出
        </CreditButton>
      )}
      <MediaLightbox media={lb} onClose={() => setLb(null)} />
    </div>
  );
}
