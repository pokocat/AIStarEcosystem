"use client";

// 统一预览组件 — 设计真源 v4 preview-modal.jsx:
// 创意推荐 / 模板库 / 快速开剧右栏共用同一套预览(封面 + 描述 + 估时大纲 + 动作)。
import * as React from "react";
import { Clock, Film, Sparkles, X } from "lucide-react";
import { CreditButton, Thumb } from "@/components/drama-ui";
import { ModalShell } from "@/components/common/ModalShell";
import type { Template } from "@/mocks/drama-workshop";
import { tplBeats, type PreviewBeat } from "@/mocks/drama-workshop";

export interface TplPreviewItem {
  cover: { from: string; to: string; src?: string };
  previewVideo?: string;
  title: string;
  cat?: string;
  desc: string;
  /** 给了模板就按模板出"估时大纲";否则用 beats */
  tpl?: Template;
  tags?: string[];
  personal?: boolean;
  coverLabel?: string;
  beats?: PreviewBeat[] | null;
  beatsLabel?: string;
  estimate?: string | null;
}

function PreviewHeroMedia({
  cover,
  previewVideo,
  cat,
  personal,
  label,
}: {
  cover: TplPreviewItem["cover"];
  previewVideo?: string;
  cat?: string;
  personal?: boolean;
  label: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [videoError, setVideoError] = React.useState(false);
  const aspect = natural && natural.w > 0 && natural.h > 0 ? natural.w / natural.h : null;
  const isPortrait = aspect != null && aspect < 1;
  const frameWidth = isPortrait && aspect
    ? `min(100%, calc(min(64vh, 520px) * ${aspect}))`
    : "100%";

  React.useEffect(() => {
    setNatural(null);
    setVideoError(false);
    const video = videoRef.current;
    if (!video || !previewVideo) return;
    video.muted = true;
    video.defaultMuted = true;
    const timer = window.setTimeout(() => {
      void video.play().catch(() => {
        // Muted autoplay should normally pass; if the browser blocks or the object fails,
        // keep the non-interactive poster fallback instead of exposing video controls.
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [previewVideo]);

  const tryPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    void video.play().catch(() => {});
  };

  if (!previewVideo || videoError) {
    return (
      <Thumb from={cover.from} to={cover.to} src={cover.src} ratio="16/9" radius={0} style={{ width: "100%" }}>
        {cat && (
          <span className="thumb-label" style={{ position: "absolute", top: 10, left: 10 }}>
            {cat}
          </span>
        )}
        {personal && (
          <span
            className="tag tag-pink"
            style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.92)" }}
          >
            <Sparkles size={10} fill="currentColor" strokeWidth={0} /> 猜你想拍
          </span>
        )}
        <span className="thumb-label" style={{ position: "absolute", left: 10, bottom: 10 }}>
          {videoError ? "视频加载失败 · 已显示封面" : label}
        </span>
      </Thumb>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: frameWidth,
        maxWidth: "100%",
        margin: "0 auto",
        aspectRatio: natural ? `${natural.w} / ${natural.h}` : "16 / 9",
        background: `linear-gradient(150deg, ${cover.from}, ${cover.to})`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={previewVideo}
        poster={cover.src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        aria-label={`${cat || "创意"}范例视频`}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setNatural({ w: video.videoWidth, h: video.videoHeight });
          }
          tryPlay();
        }}
        onLoadedData={tryPlay}
        onCanPlay={tryPlay}
        onError={() => setVideoError(true)}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#050505",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(180deg,rgba(0,0,0,.26),rgba(0,0,0,0) 40%,rgba(0,0,0,.44))",
        }}
      />
      {cat && (
        <span className="thumb-label" style={{ position: "absolute", top: 10, left: 10 }}>
          {cat}
        </span>
      )}
      <span className="thumb-label" style={{ position: "absolute", left: 10, bottom: 10 }}>
        {label}
      </span>
      {personal && (
        <span
          className="tag tag-pink"
          style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.92)" }}
        >
          <Sparkles size={10} fill="currentColor" strokeWidth={0} /> 猜你想拍
        </span>
      )}
    </div>
  );
}

export function TplPreviewBody({
  cover,
  previewVideo,
  title,
  cat,
  desc,
  tpl,
  tags,
  personal,
  coverLabel,
  beats: beatsProp,
  beatsLabel,
  estimate,
}: TplPreviewItem) {
  const beats = tpl ? tplBeats(tpl) : beatsProp;
  const label = beatsLabel ?? (tpl ? "估时大纲" : "AI 会这样帮你拍");
  return (
    <div className="col gap-3">
      <div style={{ borderRadius: 14, overflow: "hidden", flex: "none" }}>
        <PreviewHeroMedia
          cover={cover}
          previewVideo={previewVideo}
          cat={cat}
          personal={personal}
          label={coverLabel ?? (tpl ? "模板效果预览 · 同结构成片片段" : "效果预览 · 同类型成片片段")}
        />
      </div>
      <div>
        <div className="row gap-2">
          <span style={{ fontWeight: 800, fontSize: 16 }}>{title}</span>
          {tpl && (
            <span className="faint num" style={{ fontSize: 12 }}>
              {tpl.eps > 1 ? `${tpl.eps} 集 · ${tpl.scene}` : `单集 · ${tpl.scene}`}
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>
      {tags && tags.length > 0 && (
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {tags.map((h) => (
            <span key={h} className="tag tag-gray">
              {h}
            </span>
          ))}
        </div>
      )}
      {beats && (
        <div className="col gap-2">
          <div className="row gap-2">
            {tpl ? (
              <Clock size={14} style={{ color: "var(--accent)" }} />
            ) : (
              <Sparkles size={14} style={{ color: "var(--accent)" }} />
            )}
            <span style={{ fontWeight: 700, fontSize: 12.5 }}>{label}</span>
            <span className="faint" style={{ fontSize: 11.5 }}>开拍后可整段调整</span>
          </div>
          {beats.map((b, i) => (
            <div
              key={i}
              className="row gap-3"
              style={{ padding: "8px 11px", background: "var(--surface-2)", borderRadius: 11 }}
            >
              <span
                className="num"
                style={{ fontWeight: 700, fontSize: 12, color: "var(--accent)", flex: "none", width: 86 }}
              >
                {b.range}
              </span>
              <span className="grow" style={{ fontSize: 12.5, fontWeight: 600 }}>
                {b.beat}
              </span>
              <span className="faint num" style={{ fontSize: 11 }}>
                {b.est}
              </span>
            </div>
          ))}
          {tpl && tpl.eps > 1 && (
            <div
              className="row gap-2"
              style={{
                padding: "8px 11px",
                background: "var(--accent-soft)",
                borderRadius: 11,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              <Film size={13} /> 共 {tpl.eps} 集 · 成片约 {Math.round((tpl.eps * 76) / 60)} 分钟 · {tpl.scene}
            </div>
          )}
        </div>
      )}
      {!tpl && !beats && estimate !== null && (
        <div
          className="row gap-2"
          style={{
            padding: "8px 11px",
            background: "var(--surface-2)",
            borderRadius: 11,
            fontSize: 12,
            color: "var(--ink-2)",
            fontWeight: 600,
          }}
        >
          <Clock size={13} style={{ color: "var(--accent)" }} />{" "}
          {estimate ?? "AI 估算 · 开拍后根据你的主题生成逐镜节奏和完整估时大纲"}
        </div>
      )}
    </div>
  );
}

export interface PreviewAction {
  label: string;
  icon?: React.ReactNode;
  variant?: "grad" | "primary" | "line" | "ghost";
  cost?: number;
  onClick: () => void;
}

export function PreviewModal({
  item,
  onClose,
  actions = [],
}: {
  item: TplPreviewItem | null;
  onClose: () => void;
  actions?: PreviewAction[];
}) {
  if (!item) return null;
  const cls: Record<string, string> = {
    grad: "btn btn-grad",
    primary: "btn btn-primary",
    line: "btn btn-line",
    ghost: "btn btn-ghost",
  };
  return (
    <ModalShell
      onClose={onClose}
      label="模板预览"
      overlayZIndex={90}
      className="card pop-in col"
      style={{ width: 560, maxWidth: "94vw", maxHeight: "90vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
    >
        <div className="scroll col" style={{ padding: "18px 20px 16px", minHeight: 0, position: "relative" }}>
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            style={{ position: "absolute", top: 26, right: 28, zIndex: 2, background: "rgba(255,255,255,.92)", boxShadow: "var(--shadow-sm)" }}
          >
            <X size={16} />
          </button>
          <TplPreviewBody {...item} />
        </div>
        {actions.length > 0 && (
          <div
            className="row gap-2"
            style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--line-soft)", background: "var(--surface)", flex: "none" }}
          >
            <span className="grow" />
            {actions.map((a, i) =>
              a.cost != null ? (
                <CreditButton key={i} cost={a.cost} onConfirm={a.onClick} confirmTitle={a.label} className={cls[a.variant ?? "line"]}>
                  {a.icon} {a.label}
                </CreditButton>
              ) : (
                <button key={i} type="button" className={cls[a.variant ?? "line"]} onClick={a.onClick}>
                  {a.icon} {a.label}
                </button>
              ),
            )}
          </div>
        )}
    </ModalShell>
  );
}
