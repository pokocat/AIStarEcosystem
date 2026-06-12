"use client";

// 统一预览组件 — 设计真源 v4 preview-modal.jsx:
// 创意推荐 / 模板库 / 快速开剧右栏共用同一套预览(封面 + 描述 + 估时大纲 + 动作)。
import * as React from "react";
import { Clock, Film, Sparkles, X } from "lucide-react";
import { Cost } from "@/components/drama-ui";
import type { Template } from "@/mocks/drama-workshop";
import { tplBeats, type PreviewBeat } from "@/mocks/drama-workshop";
import { VideoCover } from "./video-cover";

export interface TplPreviewItem {
  cover: { from: string; to: string };
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
}

export function TplPreviewBody({
  cover,
  title,
  cat,
  desc,
  tpl,
  tags,
  personal,
  coverLabel,
  beats: beatsProp,
  beatsLabel,
}: TplPreviewItem) {
  const beats = tpl ? tplBeats(tpl) : beatsProp;
  const label = beatsLabel ?? (tpl ? "估时大纲" : "AI 会这样帮你拍");
  return (
    <div className="col gap-3">
      <div style={{ borderRadius: 14, overflow: "hidden", flex: "none" }}>
        <VideoCover
          from={cover.from}
          to={cover.to}
          ratio="16/9"
          big
          label={coverLabel ?? (tpl ? "模板效果预览 · 同结构成片片段" : "效果预览 · 同类型成片片段")}
        >
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
        </VideoCover>
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
      {!tpl && !beats && (
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
          <Clock size={13} style={{ color: "var(--accent)" }} /> AI 估算 · 约 60-80 集 · 每集 75
          秒左右,开拍后给出完整估时大纲
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
    <div className="overlay" onClick={onClose} style={{ zIndex: 90 }}>
      <div
        className="card pop-in col"
        style={{ width: 560, maxWidth: "94vw", maxHeight: "90vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
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
            {actions.map((a, i) => (
              <button key={i} type="button" className={cls[a.variant ?? "line"]} onClick={a.onClick}>
                {a.icon} {a.label} {a.cost != null && <Cost n={a.cost} prefix="约" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
