"use client";

// 分镜表（v0.88）— 设计稿 AI短剧工作台.dc.html「剧集脚本 · 分镜表」平铺表格。
// 列：镜号 / 时长 / 首帧 / 画面内容 / 镜头 / 台词·音频 / 特效氛围。所有单元格结构化可编辑、落库；
// 首帧 4 态（待生成→生成中→首帧→成片）+ 点首帧开「AI 改图」对话式迭代（复用 render/frame + ref 图）。
import * as React from "react";
import { Check, Clapperboard, Image as ImageIcon, Play, Plus, RefreshCw, Wand2, X } from "lucide-react";
import { CreditButton, Editable, Thumb } from "@/components/drama-ui";
import { MediaLightbox, type LightboxMedia } from "./media-lightbox";
import { AiImageEditModal } from "./ai-image-edit-modal";
import type { FormShot, ShotFlow } from "./shot-form";

const FRAME_COST = 2, DIRECT_COST = 9, CLIP_COST = 7;
const TH: React.CSSProperties = { padding: "11px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".04em", borderBottom: "2px solid var(--line)", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top", borderBottom: "1px solid var(--line-soft)" };

function fmtT(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export interface SbScene { id: string; place: string; mood: string }

export interface StoryboardTableProps {
  scenes: SbScene[];
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
              <th style={{ ...TH, width: 104, textAlign: "center" }}>首帧</th>
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
                            <CreditButton cost={6} onConfirm={() => props.onGenShots(sc.id, i)} confirmTitle="拆分镜" confirmBody="AI 把这一场拆成可逐镜编辑的分镜（需先有场面描述或台词，否则会先给一条空镜手填）。" className="btn btn-primary btn-sm">
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
                      onPatch={(patch) => props.onUpdShot(sc.id, s.id, patch)}
                      onDelete={() => props.onDelShot(sc.id, s.id)}
                      onRender={(kind) => props.onRender(sc.id, s.id, kind)}
                      onApprove={() => props.onApprove(sc.id, s.id)}
                      onAiEdit={() => setEdit({ sceneId: sc.id, shot: s })}
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
          openingText={`这是镜 ${edit.shot.no} 的首帧。想怎么改？直接说，比如「换成夜景」「让她回头」「再高级一点的色调」。`}
          baseDesc={edit.shot.visual || "分镜画面"}
          initialUrl={edit.shot.frameUrl ?? edit.shot.frameUrls?.[0]}
          ratio="9:16"
          chips={["换成夜景", "让她回头", "换暖色调", "背景虚化", "再高级一点"]}
          onClose={() => setEdit(null)}
          onCommit={(f) => { props.onFrameEdited(edit.sceneId, edit.shot.id, f.url); }}
        />
      )}
    </div>
  );
}

function ShotRow({
  s, start, busy, locked, speakerOptions, onPatch, onDelete, onRender, onApprove, onAiEdit,
}: {
  s: FormShot; start: number; busy: ShotFlow | null; locked?: boolean; speakerOptions: string[];
  onPatch: (patch: Partial<FormShot>) => void; onDelete: () => void;
  onRender: (kind: "frame" | "direct" | "clip") => void; onApprove: () => void; onAiEdit: () => void;
}) {
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
        {!locked && (
          <button type="button" title="删除本镜" onClick={onDelete} style={{ marginTop: 8, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}>
            <X size={12} />
          </button>
        )}
      </td>
      <td style={{ ...TD, textAlign: "center" }}>
        <div className="num" style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.4 }}>{fmtT(start)}<br />{fmtT(start + (s.dur || 0))}</div>
        <input type="number" min={1} max={60} value={s.dur} disabled={locked}
          onChange={(e) => onPatch({ dur: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
          style={{ width: 40, height: 20, marginTop: 4, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11, textAlign: "center", outline: "none", background: "var(--surface)" }} />
      </td>
      <td style={{ ...TD, textAlign: "center" }}>
        <ShotFrameCell s={s} busy={busy} onRender={onRender} onApprove={onApprove} onAiEdit={onAiEdit} />
      </td>
      <td style={TD}>
        <Editable block value={s.visual} placeholder="画面内容（纯视觉）…" onCommit={(v) => onPatch({ visual: v })}
          className="edit-field" style={{ display: "block", fontSize: 13, lineHeight: 1.65, padding: "4px 6px" }} />
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
          <select value={s.voWho || speakerOptions[0]} disabled={locked} onChange={(e) => onPatch({ voWho: e.target.value })}
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

/** 首帧 4 态渲染单元（紧凑版，表格用）。 */
function ShotFrameCell({ s, busy, onRender, onApprove, onAiEdit }: {
  s: FormShot; busy: ShotFlow | null;
  onRender: (kind: "frame" | "direct" | "clip") => void; onApprove: () => void; onAiEdit: () => void;
}) {
  const isVideo = s.flow === "clip" || s.flow === "done";
  const frameSrc = s.frameUrl ?? s.frameUrls?.[0];
  const [lb, setLb] = React.useState<LightboxMedia | null>(null);
  return (
    <div className="col" style={{ alignItems: "center", gap: 6 }}>
      {busy ? (
        <div className="skel" style={{ width: 62, height: 96, borderRadius: 9 }} />
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

      {/* 动作按钮（按状态） */}
      {!busy && s.flow === "draft" && (
        <>
          <CreditButton cost={FRAME_COST} onConfirm={() => onRender("frame")} confirmTitle="生成首帧" confirmBody="先生成画面预览。" className="btn btn-grad btn-sm" style={{ height: 25, width: 80, justifyContent: "center", fontSize: 10.5, padding: 0 }} markSize={11}>
            <ImageIcon size={11} /> 出图
          </CreditButton>
          <button type="button" onClick={() => onRender("direct")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 9.5, fontWeight: 600 }}>跳过·直接出视频</button>
        </>
      )}
      {!busy && s.flow === "frame" && (
        <CreditButton cost={CLIP_COST} onConfirm={() => onRender("clip")} confirmTitle="生成视频" confirmBody="基于已选首帧生成这镜视频。" className="btn btn-grad btn-sm" style={{ height: 25, width: 80, justifyContent: "center", fontSize: 10.5, padding: 0 }} markSize={11}>
          <Clapperboard size={11} /> 生成视频
        </CreditButton>
      )}
      {!busy && s.flow === "clip" && (
        <button type="button" onClick={onApprove} className="btn btn-primary btn-sm" style={{ height: 25, width: 80, justifyContent: "center", fontSize: 10.5, padding: 0 }}>
          <Check size={11} /> 验收
        </button>
      )}
      {!busy && s.flow === "done" && (
        <button type="button" onClick={() => onRender("frame")} className="btn btn-line btn-sm" style={{ height: 25, width: 80, justifyContent: "center", fontSize: 10.5, padding: 0 }}>
          <RefreshCw size={10} /> 重出
        </button>
      )}
      <MediaLightbox media={lb} onClose={() => setLb(null)} />
    </div>
  );
}

