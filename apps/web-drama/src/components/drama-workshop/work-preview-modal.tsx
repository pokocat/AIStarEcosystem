"use client";

// 成片预览弹窗 — 点击已完成的短剧 / 短视频时先看成片效果,
// 可切换到脚本视图,或一键衍生新剧。
import * as React from "react";
import { Boxes, Clapperboard, Copy, Play, X } from "lucide-react";

export interface WorkPreviewItem {
  title: string;
  cover: { from: string; to: string };
  /** "9:16" / "16:9" */
  ratio?: string;
  /** 类型 · 集数/时长 等元信息 */
  metaLine: string;
  /** 成片时长标 */
  durLabel?: string;
}

export function WorkPreviewModal({
  item,
  onClose,
  onScript,
  onDerive,
  onExtract,
  scriptLabel = "查看脚本",
  deriveLabel = "衍生新剧",
  extractLabel = "发布到创意市场",
  extracting = false,
}: {
  item: WorkPreviewItem;
  onClose: () => void;
  onScript: () => void;
  onDerive: () => void;
  /** v0.73 抽 skill：把这部成片发布到创意市场（提交运营审核）。提供后显示「发布到创意市场」按钮。 */
  onExtract?: () => void;
  scriptLabel?: string;
  deriveLabel?: string;
  extractLabel?: string;
  extracting?: boolean;
}) {
  const [playing, setPlaying] = React.useState(false);
  const vertical = item.ratio !== "16:9";
  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 90 }}>
      <div
        className="card pop-in col"
        style={{ width: vertical ? 420 : 640, maxWidth: "94vw", maxHeight: "92vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 成片播放区 */}
        <div style={{ position: "relative", background: "#0c0a09", display: "grid", placeItems: "center", padding: vertical ? "14px 0" : 0 }}>
          <div
            style={{
              position: "relative",
              width: vertical ? "min(248px, 60vw)" : "100%",
              aspectRatio: vertical ? "9/16" : "16/9",
              borderRadius: vertical ? 14 : 0,
              overflow: "hidden",
              background: `linear-gradient(150deg, ${item.cover.from}, ${item.cover.to})`,
              cursor: "pointer",
            }}
            onClick={() => setPlaying((v) => !v)}
            title={playing ? "暂停" : "播放成片预览"}
          >
            <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              {playing ? (
                <span className="col center gap-2" style={{ color: "rgba(255,255,255,.92)" }}>
                  <span aria-hidden style={{ width: 26, height: 26, border: "3px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "drama-spin .8s linear infinite" }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600 }}>成片预览播放中…点击暂停</span>
                </span>
              ) : (
                <span style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(255,255,255,.9)", display: "grid", placeItems: "center", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
                  <Play size={22} style={{ color: "var(--ink)", marginLeft: 3 }} />
                </span>
              )}
            </span>
            {item.durLabel && (
              <span className="num" style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 11, padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>
                {item.durLabel}
              </span>
            )}
            <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>成片预览</span>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.9)", boxShadow: "var(--shadow-sm)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 信息 + 动作 */}
        <div className="col gap-2" style={{ padding: "14px 18px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{item.title}</div>
          <div className="faint num" style={{ fontSize: 12 }}>{item.metaLine}</div>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-line grow" style={{ justifyContent: "center" }} onClick={onScript}>
              <Clapperboard size={15} /> {scriptLabel}
            </button>
            <button type="button" className="btn btn-grad grow" style={{ justifyContent: "center" }} onClick={onDerive}>
              <Copy size={15} /> {deriveLabel}
            </button>
          </div>
          {onExtract && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ justifyContent: "center", marginTop: 2 }}
              disabled={extracting}
              onClick={onExtract}
              title="把这部成片的结构 / 套路做成可复用创意，提交平台运营审核后进创意市场公开可套用"
            >
              <Boxes size={15} /> {extracting ? "发布中…" : extractLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
