"use client";

// 短视频分镜表（v0.94）— 设计真源：短视频制作右侧「分镜表」平铺表格。
// 列：镜·时长（beat 语义标签 + 镜号 + 时间线 + 时长） / 首帧（4 态 + AI 改图 + 出片）/
//     口播文案·画面（说话人 + 台词 + 画面）/ 镜头（景别·运镜）/ 音效·BGM·特效。
// 与短剧分镜表 StoryboardTable 同一视觉语言，但短视频是「单条平铺」无场分组，且每镜带 beat 标签。
import * as React from "react";
import { Mic, X } from "lucide-react";
import { Editable } from "@/components/drama-ui";
import { ShotFrameCell } from "./storyboard-table";
import { AiImageEditModal } from "./ai-image-edit-modal";
import type { FormShot, ShotFlow } from "./shot-form";

const TH: React.CSSProperties = {
  padding: "11px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--ink-3)",
  letterSpacing: ".04em",
  borderBottom: "2px solid var(--line)",
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top", borderBottom: "1px solid var(--line-soft)" };

function fmtT(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export interface ShortStoryboardTableProps {
  shots: FormShot[];
  /** 每镜 beat 语义标签（痛点开场 / 卖点演示 / 强 CTA 收尾…），按序号取，缺省回落「镜 N」。 */
  beats: string[];
  speakerOptions: string[];
  locked?: boolean;
  /** 首帧/视频真实单价（drama.credit.{frame,clip}，admin 可配）；驱动确认弹窗展示金额。 */
  frameCost?: number;
  clipCost?: number;
  /** 正在生成的镜：{id,to}；其余镜 busy=null。 */
  busy: { id: string; to: ShotFlow } | null;
  onPatch: (id: string, patch: Partial<FormShot>) => void;
  onDelete: (id: string) => void;
  onRender: (id: string, kind: "frame" | "direct" | "clip") => void;
  onApprove: (id: string) => void;
  onFrameEdited: (id: string, frameUrl: string) => void;
}

export function ShortStoryboardTable(props: ShortStoryboardTableProps) {
  const { shots, beats, speakerOptions, locked, busy, frameCost, clipCost } = props;
  const [edit, setEdit] = React.useState<FormShot | null>(null);

  // 时间线累计起点。
  const starts = new Map<string, number>();
  let acc = 0;
  for (const s of shots) {
    starts.set(s.id, acc);
    acc += s.dur || 0;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th style={{ ...TH, width: 116, textAlign: "center" }}>镜 · 时长</th>
              <th style={{ ...TH, width: 116, textAlign: "center" }}>首帧</th>
              <th style={{ ...TH, width: 280 }}>口播文案 · 画面</th>
              <th style={{ ...TH, width: 96 }}>镜头</th>
              <th style={{ ...TH, width: 140 }}>音效 · BGM</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((s, i) => (
              <ShortShotRow
                key={s.id}
                s={s}
                beat={beats[i] || `镜 ${i + 1}`}
                start={starts.get(s.id) ?? 0}
                busy={busy && busy.id === s.id ? busy.to : null}
                locked={locked}
                speakerOptions={speakerOptions}
                frameCost={frameCost}
                clipCost={clipCost}
                onPatch={(patch) => props.onPatch(s.id, patch)}
                onDelete={() => props.onDelete(s.id)}
                onRender={(kind) => props.onRender(s.id, kind)}
                onApprove={() => props.onApprove(s.id)}
                onAiEdit={() => setEdit(s)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <AiImageEditModal
          tag={`镜 ${edit.no}`}
          openingText={`这是镜 ${edit.no} 的首帧。说想怎么改就行，例如「换成夜景」「让她回头」「换成更高级的色调」。`}
          baseDesc={edit.visual || "分镜画面"}
          initialUrl={edit.frameUrl ?? edit.frameUrls?.[0]}
          ratio="9:16"
          chips={["换成夜景", "让她回头", "换暖色调", "背景虚化", "再高级一点"]}
          onClose={() => setEdit(null)}
          onCommit={(f) => props.onFrameEdited(edit.id, f.url)}
        />
      )}
    </div>
  );
}

function ShortShotRow({
  s,
  beat,
  start,
  busy,
  locked,
  speakerOptions,
  frameCost,
  clipCost,
  onPatch,
  onDelete,
  onRender,
  onApprove,
  onAiEdit,
}: {
  s: FormShot;
  beat: string;
  start: number;
  busy: ShotFlow | null;
  locked?: boolean;
  speakerOptions: string[];
  frameCost?: number;
  clipCost?: number;
  onPatch: (patch: Partial<FormShot>) => void;
  onDelete: () => void;
  onRender: (kind: "frame" | "direct" | "clip") => void;
  onApprove: () => void;
  onAiEdit: () => void;
}) {
  const whoList = speakerOptions.includes(s.voWho) || !s.voWho ? speakerOptions : [s.voWho, ...speakerOptions];
  return (
    <tr>
      {/* 镜 · 时长（beat 标签 + 镜号 + 时间线 + 时长） */}
      <td style={{ ...TD, textAlign: "center" }}>
        <span className="tag tag-accent" style={{ marginBottom: 8, fontSize: 10.5 }}>{beat}</span>
        <div className="num" style={{ fontSize: 26, fontWeight: 800, color: "var(--accent)", lineHeight: 1.05 }}>{s.no}</div>
        <div className="num faint" style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>
          {fmtT(start)}–{fmtT(start + (s.dur || 0))}
        </div>
        <input
          type="number"
          min={1}
          max={60}
          value={s.dur}
          disabled={locked}
          onChange={(e) => onPatch({ dur: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
          style={{ width: 46, height: 22, marginTop: 6, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11, textAlign: "center", outline: "none", background: "var(--surface)" }}
          aria-label="时长（秒）"
        />
        <div className="num faint" style={{ fontSize: 10, marginTop: 2 }}>{s.dur}s</div>
        {!locked && (
          <button type="button" title="删除本镜" onClick={onDelete} style={{ marginTop: 8, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}>
            <X size={12} />
          </button>
        )}
      </td>

      {/* 首帧（4 态 + AI 改图 + 出片，复用短剧分镜表的单元） */}
      <td style={{ ...TD, textAlign: "center" }}>
        <ShotFrameCell s={s} busy={busy} onRender={onRender} onApprove={onApprove} onAiEdit={onAiEdit} frameCost={frameCost} clipCost={clipCost} />
      </td>

      {/* 口播文案 · 画面 */}
      <td style={TD}>
        <div className="row gap-1" style={{ alignItems: "center", marginBottom: 5 }}>
          <Mic size={12} style={{ color: "var(--accent)", flex: "none" }} />
          <select
            value={s.voWho || speakerOptions[0]}
            disabled={locked}
            onChange={(e) => onPatch({ voWho: e.target.value })}
            style={{ height: 22, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: "var(--surface-2)", color: "var(--accent)", outline: "none", maxWidth: 120 }}
          >
            {whoList.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <Editable
          block
          value={s.voText}
          placeholder="口播文案 / 台词…（留空=空镜）"
          onCommit={(v) => onPatch({ voText: v })}
          className="edit-field"
          style={{ display: "block", fontSize: 13, lineHeight: 1.6, padding: "6px 9px", background: "var(--accent-soft)", borderRadius: 8 }}
        />
        <Editable
          block
          value={s.visual}
          placeholder="画面：镜头里发生什么…"
          onCommit={(v) => onPatch({ visual: v })}
          className="edit-field"
          style={{ display: "block", fontSize: 12.5, lineHeight: 1.7, padding: "5px 7px", marginTop: 7, color: "var(--ink-2)" }}
        />
      </td>

      {/* 镜头（景别 · 运镜） */}
      <td style={TD}>
        <div className="col gap-2" style={{ fontSize: 12 }}>
          <div className="col" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>景别</span>
            <Editable className="edit-field" value={s.size} placeholder="中景" onCommit={(v) => onPatch({ size: v })} style={{ padding: "2px 5px" }} />
          </div>
          <div className="col" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>运镜</span>
            <Editable className="edit-field" value={s.move} placeholder="固定" onCommit={(v) => onPatch({ move: v })} style={{ padding: "2px 5px" }} />
          </div>
        </div>
      </td>

      {/* 音效 · BGM · 特效 */}
      <td style={TD}>
        <div className="col" style={{ gap: 5, fontSize: 11.5, color: "var(--ink-2)" }}>
          <div className="col" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>音效</span>
            <Editable className="edit-field" value={s.sfx} placeholder="环境音…" onCommit={(v) => onPatch({ sfx: v })} style={{ padding: "2px 5px" }} />
          </div>
          <div className="col" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>BGM</span>
            <Editable className="edit-field" value={s.bgm} placeholder="无 / 渐入…" onCommit={(v) => onPatch({ bgm: v })} style={{ padding: "2px 5px" }} />
          </div>
          <div className="col" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>特效</span>
            <Editable className="edit-field" value={s.fx} placeholder="光效 / 慢放…" onCommit={(v) => onPatch({ fx: v })} style={{ padding: "2px 5px" }} />
          </div>
        </div>
      </td>
    </tr>
  );
}
