"use client";

// 成片预览弹窗 — 点击已完成的短剧 / 短视频时先看成片效果,
// 可切换到脚本视图,或一键衍生新剧。
import * as React from "react";
import { Boxes, Clapperboard, Copy, Download, Play, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";

export interface WorkPreviewItem {
  title: string;
  cover: { from: string; to: string };
  /** "9:16" / "16:9" */
  ratio?: string;
  /** 类型 · 集数/时长 等元信息 */
  metaLine: string;
  /** 成片时长标 */
  durLabel?: string;
  /** 真实成片视频。短视频完成态卡片默认点击播放这个 URL。 */
  videoUrl?: string | null;
  /** 真实首帧 / 封面图。 */
  coverUrl?: string | null;
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
  compactActions = false,
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
  /** 短视频完成态：右下小图标动作，不再展示大按钮。 */
  compactActions?: boolean;
}) {
  const [playing, setPlaying] = React.useState(() => !!item.videoUrl);
  const vertical = item.ratio !== "16:9";
  React.useEffect(() => {
    setPlaying(!!item.videoUrl);
  }, [item.title, item.videoUrl]);
  return (
    <ModalShell
      onClose={onClose}
      label={`成片预览 · ${item.title}`}
      overlayZIndex={90}
      className="card pop-in col"
      style={{ width: vertical ? 420 : 640, maxWidth: "94vw", maxHeight: "92vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
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
              background: item.coverUrl
                ? `url(${JSON.stringify(item.coverUrl)}) center/cover no-repeat, linear-gradient(150deg, ${item.cover.from}, ${item.cover.to})`
                : `linear-gradient(150deg, ${item.cover.from}, ${item.cover.to})`,
              cursor: item.videoUrl ? "default" : "pointer",
            }}
            onClick={() => {
              if (!item.videoUrl) setPlaying((v) => !v);
            }}
            title={playing ? "暂停" : "播放成片预览"}
          >
            {item.videoUrl ? (
              <video
                aria-label="成片视频"
                src={item.videoUrl}
                poster={item.coverUrl ?? undefined}
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
              />
            ) : (
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
            )}
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
        <div className="col gap-2" style={{ padding: compactActions ? "14px 18px 14px" : "14px 18px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{item.title}</div>
          {compactActions ? (
            <div className="row gap-2" data-testid="compact-preview-meta-row" style={{ alignItems: "center", minHeight: 38 }}>
              <div className="faint num grow" style={{ fontSize: 12, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.metaLine}
              </div>
              <div className="row gap-2" data-testid="compact-preview-actions" style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-icon btn-sm"
                  onClick={onScript}
                  disabled={extracting}
                  aria-label={scriptLabel}
                  title={scriptLabel}
                  style={{ width: 44, height: 34, borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink-2)", opacity: extracting ? 0.55 : 1 }}
                >
                  <Boxes size={15} />
                </button>
                {item.videoUrl ? (
                  <a
                    className="btn btn-icon btn-sm"
                    href={item.videoUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    aria-label="下载视频"
                    title="下载视频"
                    style={{ width: 44, height: 34, borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink-2)" }}
                  >
                    <Download size={15} />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    disabled
                    aria-label="暂无可下载视频"
                    title="暂无可下载视频"
                    style={{ width: 44, height: 34, borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink-2)", opacity: 0.5 }}
                  >
                    <Download size={15} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
    </ModalShell>
  );
}
