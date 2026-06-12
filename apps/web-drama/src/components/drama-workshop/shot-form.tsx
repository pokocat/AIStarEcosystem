"use client";

// 分镜表单卡 — 参照「短剧分镜V2(结构化版-适配Web表单)」字段结构:
// 镜号 / 时间线(单镜时长) / 画面内容(纯视觉) / 音频内容(人声+音效+BGM) /
// 镜头参数(景别/运镜) / 特效氛围(画面包装) / 参考素材 / 字幕。
// 左列保留渲染渐进逻辑:待渲 → 首帧 → 成片 → 验收。
// 短剧「剧集脚本」与短视频制作页共用。
import * as React from "react";
import { Check, Film, Image as ImageIcon, Play, RefreshCw, X, Zap } from "lucide-react";
import { Editable, Thumb } from "@/components/drama-ui";
import { RefCell, RichScript } from "./script-refs";
import { SubToggle } from "./script-refs";
import type { Material } from "@/mocks/drama-workshop";

export type ShotFlow = "draft" | "frame" | "clip" | "done";

export interface FormShot {
  id: string;
  no: number;
  /** 单镜时长(秒) */
  dur: number;
  /** 画面内容(纯视觉) */
  visual: string;
  /** 景别 */
  size: string;
  /** 运镜 */
  move: string;
  /** 人声:说话人(旁白/角色/口播…) */
  voWho: string;
  /** 人声:台词文本 */
  voText: string;
  /** 音效 */
  sfx: string;
  /** BGM */
  bgm: string;
  /** 特效氛围(画面包装) */
  fx: string;
  refs: Material[];
  sub: boolean;
  flow: ShotFlow;
}

function fmtT(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

const LBL: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".04em", flex: "none", width: 92 };

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row gap-2" style={{ alignItems: "flex-start" }}>
      <span style={{ ...LBL, marginTop: 3 }}>{label}</span>
      <div className="grow" style={{ minWidth: 0, fontSize: 13, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

export function ShotFormCard({
  s,
  start,
  colors,
  speakerOptions,
  busy,
  locked,
  onPatch,
  onDelete,
  onRenderFrame,
  onRenderDirect,
  onRenderClip,
  onApprove,
}: {
  s: FormShot;
  /** 本镜起始秒(时间线自动累计) */
  start: number;
  colors: { from: string; to: string };
  /** 人声说话人可选项(旁白 + 角色 / 口播) */
  speakerOptions: string[];
  busy: ShotFlow | null;
  locked?: boolean;
  onPatch: (patch: Partial<FormShot>) => void;
  onDelete?: () => void;
  onRenderFrame: () => void;
  onRenderDirect: () => void;
  onRenderClip: () => void;
  onApprove: () => void;
}) {
  const rendered = s.flow !== "draft";
  const isVideo = s.flow === "clip" || s.flow === "done";
  const whoList = speakerOptions.includes(s.voWho) || !s.voWho ? speakerOptions : [s.voWho, ...speakerOptions];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* 头:镜号 + 时间线 + 单镜时长 + 字幕 + 删除 */}
      <div className="row gap-2" style={{ padding: "9px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--line-soft)" }}>
        <span className="num" style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 7, padding: "2px 9px", flex: "none" }}>
          镜 {s.no}
        </span>
        <span className="num" style={{ fontSize: 12.5, fontWeight: 800, flex: "none" }}>
          {fmtT(start)} - {fmtT(start + (s.dur || 0))}
        </span>
        <span className="row gap-1 faint num" style={{ fontSize: 11, flex: "none" }}>
          时长
          <input
            type="number"
            min={1}
            max={30}
            value={s.dur}
            disabled={locked}
            onChange={(e) => onPatch({ dur: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
            style={{ width: 44, height: 22, border: "1px solid var(--line)", borderRadius: 6, padding: "0 5px", fontSize: 11.5, outline: "none", background: "var(--surface)", textAlign: "center" }}
          />
          s
        </span>
        <span className="grow" />
        <span className="row gap-1 faint" style={{ fontSize: 10.5, flex: "none" }}>字幕 <SubToggle on={s.sub !== false} onToggle={() => onPatch({ sub: s.sub === false })} /></span>
        {onDelete && !locked && (
          <button type="button" className="btn btn-icon btn-ghost btn-sm" title="删除本镜" style={{ width: 24, height: 24 }} onClick={onDelete}>
            <X size={13} />
          </button>
        )}
      </div>

      <div className="row gap-4" style={{ padding: "12px 14px 14px", alignItems: "stretch" }}>
        {/* 左:渲染渐进(首帧 → 成片) */}
        <div className="col gap-2" style={{ width: 104, flex: "none" }}>
          <div style={{ position: "relative" }}>
            <Thumb
              from={rendered ? colors.from : "#cbd5e1"}
              to={rendered ? colors.to : "#94a3b8"}
              ratio="9/14"
              radius={10}
              stripes={!rendered}
              style={{ width: "100%" }}
            />
            {busy && (
              <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.32)", display: "grid", placeItems: "center", borderRadius: 10 }}>
                <span aria-hidden style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "drama-spin .7s linear infinite" }} />
              </span>
            )}
            {isVideo && !busy && (
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.88)", display: "grid", placeItems: "center" }}>
                  <Play size={12} style={{ color: "var(--ink)", marginLeft: 2 }} />
                </span>
              </span>
            )}
            <span style={{ position: "absolute", top: 5, left: 5 }}>
              {s.flow === "draft" && <span className="tag tag-gray" style={{ fontSize: 9.5, padding: "0 6px", height: 18 }}>待渲</span>}
              {s.flow === "frame" && !busy && <span className="tag tag-amber" style={{ fontSize: 9.5, padding: "0 6px", height: 18 }}>首帧</span>}
              {s.flow === "clip" && !busy && <span className="tag tag-amber" style={{ fontSize: 9.5, padding: "0 6px", height: 18 }}>待验收</span>}
              {s.flow === "done" && <span className="tag tag-green" style={{ fontSize: 9.5, padding: "0 6px", height: 18 }}><Check size={9} /> 成片</span>}
            </span>
          </div>
          {s.flow === "draft" && (
            <>
              <button type="button" className="btn btn-grad btn-sm" style={{ height: 26, justifyContent: "center", fontSize: 10.5, padding: 0 }} disabled={!!busy} onClick={onRenderFrame} title="先渲首帧锁画面,稳妥省抽卡 · 约 2 积分">
                <ImageIcon size={11} /> 首帧 · 2
              </button>
              <button type="button" className="btn btn-line btn-sm" style={{ height: 24, justifyContent: "center", fontSize: 10, padding: 0 }} disabled={!!busy} onClick={onRenderDirect} title="跳过首帧,直接生成分镜视频 · 约 9 积分">
                <Zap size={10} /> 直出 · 9
              </button>
            </>
          )}
          {s.flow === "frame" && (
            <button type="button" className="btn btn-primary btn-sm" style={{ height: 26, justifyContent: "center", fontSize: 10.5, padding: 0 }} disabled={!!busy} onClick={onRenderClip}>
              <Film size={11} /> 渲成片 · 7
            </button>
          )}
          {s.flow === "clip" && (
            <button type="button" className="btn btn-primary btn-sm" style={{ height: 26, justifyContent: "center", fontSize: 10.5, padding: 0 }} onClick={onApprove}>
              <Check size={11} /> 验收入片
            </button>
          )}
          {s.flow === "done" && (
            <button type="button" className="chip" style={{ height: 24, justifyContent: "center", fontSize: 10 }} onClick={onRenderFrame}>
              <RefreshCw size={10} /> 回炉重渲
            </button>
          )}
        </div>

        {/* 右:结构化表单(字段完全拆分独立,可逐条读改) */}
        <div className="col grow gap-2" style={{ minWidth: 0 }}>
          <FieldRow label="画面内容">
            <RichScript
              text={s.visual}
              refs={s.refs}
              onCommit={locked ? undefined : (v) => onPatch({ visual: v })}
              onRefsChange={(next) => onPatch({ refs: next })}
              placeholder="点击编写画面(纯视觉)…输入 @ 引用素材"
            />
          </FieldRow>
          <FieldRow label="镜头参数">
            <span className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="chip static" style={{ height: 24, fontSize: 11.5 }}>
                景别 · <Editable value={s.size} placeholder="景别" onCommit={(v) => onPatch({ size: v })} />
              </span>
              <span className="chip static" style={{ height: 24, fontSize: 11.5 }}>
                运镜 · <Editable value={s.move} placeholder="运镜" onCommit={(v) => onPatch({ move: v })} />
              </span>
            </span>
          </FieldRow>
          <FieldRow label="音频内容">
            <div className="col gap-1">
              <span className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={s.voWho || speakerOptions[0]}
                  disabled={locked}
                  onChange={(e) => onPatch({ voWho: e.target.value })}
                  style={{ height: 24, border: "1px solid var(--line)", borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: "var(--surface-2)", color: "var(--ink-2)", outline: "none", padding: "0 4px" }}
                >
                  {whoList.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <span style={{ minWidth: 0, flex: 1 }}>
                  “<Editable block value={s.voText} placeholder="台词 / 口播…(留空 = 无人声)" onCommit={(v) => onPatch({ voText: v })} style={{ display: "inline" }} />”
                </span>
              </span>
              <span className="row gap-2" style={{ flexWrap: "wrap", fontSize: 12.5 }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, flex: "none" }}>音效</span>
                <span style={{ minWidth: 120, flex: 1 }}><Editable block value={s.sfx} placeholder="环境音 / 音效…" onCommit={(v) => onPatch({ sfx: v })} /></span>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, flex: "none" }}>BGM</span>
                <span style={{ minWidth: 100, flex: 1 }}><Editable block value={s.bgm} placeholder="无 / 渐入…" onCommit={(v) => onPatch({ bgm: v })} /></span>
              </span>
            </div>
          </FieldRow>
          <FieldRow label="特效氛围">
            <Editable block value={s.fx} placeholder="画面包装:光效 / 慢放 / 提亮…" onCommit={(v) => onPatch({ fx: v })} style={{ display: "block", color: "var(--ink-2)" }} />
          </FieldRow>
          <FieldRow label="参考素材">
            <span className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <RefCell refs={s.refs} onChange={(next) => onPatch({ refs: next })} />
              <span className="faint" style={{ fontSize: 10.5 }}>画面里输入 @ 可直接引用</span>
            </span>
          </FieldRow>
        </div>
      </div>
    </div>
  );
}
