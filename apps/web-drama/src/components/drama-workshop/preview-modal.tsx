"use client";

// 统一预览组件 — 设计真源 v4 preview-modal.jsx:
// 首页热门模板 / 新建短剧的热门结构 / 新建短视频的推荐共用同一套预览（封面 + 描述 + 节奏预估 + 动作）。
import * as React from "react";
import { Clock, Film, Sparkles, X } from "lucide-react";
import { CreditMark, Thumb } from "@/components/drama-ui";
import { ModalShell } from "@/components/common/ModalShell";
import type { Template } from "@/mocks/drama-workshop";
import { tplBeats, type PreviewBeat } from "@/mocks/drama-workshop";

export interface TplPreviewItem {
  cover: { from: string; to: string; src?: string };
  previewVideo?: string;
  title: string;
  cat?: string;
  desc: string;
  /** 给了目录结构（catalog template）就按它出「节奏预估」；否则用 beats */
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
  /** 封面左下角的小标签；不传就不显示（没有视频时别写「成片片段」这种不属实的话）。 */
  label?: string;
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
        {(videoError || label) && (
          <span className="thumb-label" style={{ position: "absolute", left: 10, bottom: 10 }}>
            {videoError ? "视频没加载出来，先看封面" : label}
          </span>
        )}
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
        aria-label={`${cat || "模板"}范例视频`}
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
        {label ?? "范例视频"}
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
  const label = beatsLabel ?? (tpl ? "节奏预估" : "AI 会怎么做");
  return (
    <div className="col gap-3">
      <div style={{ borderRadius: 14, overflow: "hidden", flex: "none" }}>
        <PreviewHeroMedia
          cover={cover}
          previewVideo={previewVideo}
          cat={cat}
          personal={personal}
          label={coverLabel}
        />
      </div>
      <div>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 16, minWidth: 0, overflowWrap: "anywhere" }}>{title}</span>
          {tpl && (
            <span className="faint num" style={{ fontSize: 12 }}>
              {tpl.eps > 1 ? `${tpl.eps} 集 · ${tpl.scene}` : `单条 · ${tpl.scene}`}
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
            <span className="faint" style={{ fontSize: 11.5 }}>做同款后都能改</span>
          </div>
          {beats.map((b, i) => (
            <div
              key={i}
              className="row gap-3"
              style={{ padding: "8px 11px", background: "var(--surface-2)", borderRadius: 11 }}
            >
              <span
                className="num"
                style={{ fontWeight: 700, fontSize: 12, color: "var(--accent)", flex: "none", width: 86, overflowWrap: "anywhere" }}
              >
                {b.range}
              </span>
              <span className="grow" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>
                {b.beat}
              </span>
              {b.est && (
                <span className="faint num" style={{ fontSize: 11, flex: "none" }}>
                  {b.est}
                </span>
              )}
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
              <Film size={13} style={{ flex: "none" }} /> 共 {tpl.eps} 集，全剧约 {Math.round((tpl.eps * 76) / 60)} 分钟 · {tpl.scene}
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
          <Clock size={13} style={{ color: "var(--accent)", flex: "none" }} />{" "}
          {estimate ?? "做同款后按你的主题生成分镜和每段时长"}
        </div>
      )}
    </div>
  );
}

interface PreviewActionBase {
  label: string;
  icon?: React.ReactNode;
  variant?: "grad" | "primary" | "line" | "ghost";
  disabled?: boolean;
  onClick: () => void;
}

/**
 * 预览弹窗底部的动作。
 *
 * 不扣积分的动作：不传 cost / confirm，点了直接执行，不挂钻石。
 * 扣积分的动作：cost 与 confirm 必须一起给 —— cost 只用来挂钻石标记和悬停提示，
 * 扣费确认由调用方给（如单条模板「做同款」= 开始制作短视频，走共享的 confirmShortStart）。
 * v0.197 起弹窗自己不再拼扣费确认：之前这里走 CreditButton 的通用确认，标题、说明、按钮
 * 由各调用方各写一份，同一笔 shortEntry 在不同入口问法不一样。扣费后刷新余额也由调用方负责。
 */
export type PreviewAction =
  | (PreviewActionBase & { cost?: undefined; confirm?: undefined })
  | (PreviewActionBase & {
      /** 本次消耗（只用于钻石标记的悬停提示，真实计费在后台）。 */
      cost: number;
      /** 扣费确认：resolve true 才执行 onClick。 */
      confirm: () => Promise<boolean>;
    });

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
      // 宽度用 vw 兜底：.overlay 是 grid，格子按内容撑开，max-width:100% 在这里约束不住定宽弹窗（375 下右边被裁）。
      // 100vw - 24px = 窄屏 .overlay 左右各 12px 内边距后的可用宽度。
      style={{ width: "min(560px, calc(100vw - 24px))", maxWidth: "100%", maxHeight: "90vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
    >
        <div className="scroll col" style={{ padding: "18px 20px 16px", minHeight: 0, position: "relative" }}>
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
            style={{ position: "absolute", top: 26, right: 28, zIndex: 2, background: "rgba(255,255,255,.92)", boxShadow: "var(--shadow-sm)" }}
          >
            <X size={16} />
          </button>
          <TplPreviewBody {...item} />
        </div>
        {actions.length > 0 && (
          <div
            className="row gap-2 hm-pv-actions"
            style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--line-soft)", background: "var(--surface)", flex: "none", flexWrap: "wrap", justifyContent: "flex-end" }}
          >
            {actions.map((a, i) =>
              a.cost != null ? (
                <PaidActionButton key={i} action={a} className={cls[a.variant ?? "line"]} />
              ) : (
                <button key={i} type="button" className={cls[a.variant ?? "line"]} onClick={a.onClick} disabled={a.disabled}>
                  {a.icon} {a.label}
                </button>
              ),
            )}
          </div>
        )}
    </ModalShell>
  );
}

/** 扣积分的动作：挂钻石标记；点了先走调用方的扣费确认，确认了才执行。确认框开着时不接受重复点击。 */
function PaidActionButton({
  action,
  className,
}: {
  action: Extract<PreviewAction, { cost: number }>;
  className: string;
}) {
  const [asking, setAsking] = React.useState(false);
  const onClick = async () => {
    if (action.disabled || asking) return;
    setAsking(true);
    let ok = false;
    try {
      ok = await action.confirm();
    } finally {
      setAsking(false);
    }
    if (ok) action.onClick();
  };
  return (
    <button
      type="button"
      className={className}
      title={`会消耗 ${action.cost} 积分`}
      disabled={action.disabled || asking}
      onClick={() => void onClick()}
    >
      {action.icon} {action.label}
      <CreditMark tone="inherit" size={13} />
    </button>
  );
}
