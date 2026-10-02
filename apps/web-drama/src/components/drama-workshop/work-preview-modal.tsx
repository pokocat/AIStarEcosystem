"use client";

// 作品预览弹窗 — 点击已完成的短剧 / 短视频时先看成片效果，
// 可以打开编辑，或照这部新建一部（/projects），或发布成模板、下载（/shorts）。
// v0.197：没有可播放的成片时如实说，不再放一个假的「播放中…」转圈。
import * as React from "react";
import { Boxes, Clapperboard, Copy, Download, X } from "lucide-react";
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
  scriptLabel = "打开编辑",
  deriveLabel = "照这部新建一部",
  extractLabel = "发布成模板",
  extracting = false,
  compactActions = false,
}: {
  item: WorkPreviewItem;
  onClose: () => void;
  onScript: () => void;
  onDerive: () => void;
  /** v0.73 抽 skill：把这部成片发布成模板（提交平台审核，通过后进模板广场）。提供后显示「发布成模板」按钮。 */
  onExtract?: () => void;
  scriptLabel?: string;
  deriveLabel?: string;
  extractLabel?: string;
  extracting?: boolean;
  /** 短视频完成态：只给「发布成模板」「下载」两个动作（scriptLabel 是发布按钮的文案）。 */
  compactActions?: boolean;
}) {
  const vertical = item.ratio !== "16:9";
  const hasVideo = !!item.videoUrl;
  return (
    <ModalShell
      onClose={onClose}
      label={`预览《${item.title}》`}
      overlayZIndex={90}
      className="card pop-in col"
      // .overlay 是 grid 居中，子项的 max-width:100% 量的是按内容撑开的格子、限不住宽度；
      // 直接按视口算（遮罩桌面 24px、窄屏 12px 内边距，按宽的那个留）。
      style={{ width: `min(${vertical ? 420 : 640}px, calc(100vw - 48px))`, maxHeight: "92vh", padding: 0, overflow: "auto", boxShadow: "var(--shadow-lg)" }}
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
            }}
          >
            {hasVideo ? (
              <video
                aria-label="成片视频"
                src={item.videoUrl ?? undefined}
                poster={item.coverUrl ?? undefined}
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
              />
            ) : (
              // 没有可播放的成片：只显示封面并如实说一句，不放假的播放键 / 「播放中」转圈。
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "end center", padding: 12 }}>
                <span
                  data-testid="preview-no-video"
                  style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,.55)", padding: "4px 10px", borderRadius: 999, maxWidth: "100%", textAlign: "center" }}
                >
                  {compactActions ? "还没有合成好的成片" : `这里还不能直接播放，点「${scriptLabel}」看每一集`}
                </span>
              </span>
            )}
            {item.durLabel && (
              <span className="num" style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 11, padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>
                {item.durLabel}
              </span>
            )}
            <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>{hasVideo ? "成片" : "封面"}</span>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-sm tap-target"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
            style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.9)", boxShadow: "var(--shadow-sm)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 信息 + 动作 */}
        <div className="col gap-2" style={{ padding: compactActions ? "14px 18px 14px" : "14px 18px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: 16, overflowWrap: "anywhere" }}>{item.title}</div>
          {compactActions ? (
            <>
              <div
                className="faint num"
                data-testid="compact-preview-meta-row"
                style={{ fontSize: 12, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                title={item.metaLine}
              >
                {item.metaLine}
              </div>
              {/* 按钮带字：只有图标时没人知道那个方块图标是「发布成模板」 */}
              <div className="se-preview-actions" data-testid="compact-preview-actions" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={onScript}
                  disabled={extracting}
                  title="审核通过后出现在模板广场，别人可以做同款"
                  style={{ opacity: extracting ? 0.55 : 1 }}
                >
                  <Boxes size={15} /> {scriptLabel}
                </button>
                {hasVideo ? (
                  <a className="btn btn-line" href={item.videoUrl ?? undefined} download target="_blank" rel="noreferrer">
                    <Download size={15} /> 下载视频
                  </a>
                ) : (
                  // 禁用原因直接写在按钮上（手机上没有 hover）
                  <button type="button" className="btn btn-line" disabled style={{ opacity: 0.5 }}>
                    <Download size={15} /> 还没有成片可下载
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="faint num" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{item.metaLine}</div>
              <div className="se-preview-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-line" onClick={onScript}>
                  <Clapperboard size={15} /> {scriptLabel}
                </button>
                <button type="button" className="btn btn-grad" onClick={onDerive}>
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
                  title="把这部的结构做成模板，平台审核通过后出现在模板广场，别人可以做同款"
                >
                  <Boxes size={15} /> {extracting ? "正在提交…" : extractLabel}
                </button>
              )}
            </>
          )}
        </div>
    </ModalShell>
  );
}
