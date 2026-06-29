"use client";

// 首页项目卡 — 设计真源:screens-entry.jsx `ProjectCard`。
// 视觉:9:16 / 16:10 渐变缩略图占大头 + 类型 / 模式 chip + 进度条 + 上次更新时间。
import * as React from "react";
import { Clock, Trash2 } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { STAGE_NAMES } from "./stages-config";
import type { DramaProjectSummary } from "@/mocks/drama-workshop";

interface ProjectCardProps {
  p: DramaProjectSummary;
  delay?: number;
  onOpen?: (p: DramaProjectSummary) => void;
  /** 提供时显示悬停「移到回收站」按钮（软删）。 */
  onDelete?: (p: DramaProjectSummary) => void;
  /** 阶段名,用来显示"走到「剧集脚本」";默认取 v4 六阶段 */
  stageNames?: readonly string[];
}

export function ProjectCard({ p, delay = 0, onOpen, onDelete, stageNames = STAGE_NAMES }: ProjectCardProps) {
  const [hover, setHover] = React.useState(false);
  const stageLabel = stageNames[p.stage - 1] ?? "选题立项";
  return (
    <div
      style={{ position: "relative", height: "100%" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
    <button
      type="button"
      className="card col fade-up"
      onClick={() => onOpen?.(p)}
      style={{
        padding: 0,
        overflow: "hidden",
        textAlign: "left",
        width: "100%",
        height: "100%",
        animationDelay: delay + "ms",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
        transition: "transform .18s, box-shadow .18s",
        cursor: "pointer",
      }}
    >
      <div style={{ position: "relative" }}>
        <Thumb
          from={p.cover.from}
          to={p.cover.to}
          ratio={p.ratio === "16:9" ? "16/10" : "1/1"}
          radius={0}
          stripes
          style={{ width: "100%" }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="thumb-label">{p.ratio}</span>
              {p.done && (
                <span
                  className="tag tag-green"
                  style={{ background: "rgba(255,255,255,.92)" }}
                >
                  已完成
                </span>
              )}
            </div>
            <div style={{ color: "#fff" }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: "-.01em",
                  lineHeight: 1.3,
                  textShadow: "0 1px 8px rgba(0,0,0,.25)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {p.title}
              </div>
            </div>
          </div>
        </Thumb>
      </div>
      <div className="col gap-2" style={{ padding: "11px 12px 12px" }}>
        <div className="row gap-2">
          <span className="tag tag-gray">{p.type}</span>
          {p.mode === "interactive" ? (
            <span className="tag" style={{ background: "#ede9fe", color: "#7c3aed" }}>互动剧</span>
          ) : (
            <span
              className="tag"
              style={{
                background: p.mode === "guided" ? "var(--accent-soft)" : "var(--accent-2-soft)",
                color: p.mode === "guided" ? "var(--accent)" : "var(--accent-2)",
              }}
            >
              {p.mode === "guided" ? "AI 引导" : "套用模板"}
            </span>
          )}
          <span className="grow" />
          <span className="faint num" style={{ fontSize: 12 }}>{p.episodes} 集</span>
        </div>
        <div className="col gap-2">
          <div className="row" style={{ justifyContent: "space-between", fontSize: 11.5 }}>
            <span className="faint">进度 · 走到「{stageLabel}」</span>
            <span
              className="num"
              style={{
                fontWeight: 700,
                color: p.progress === 100 ? "#15803d" : "var(--accent)",
              }}
            >
              {p.progress}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: p.progress + "%",
                borderRadius: 99,
                background:
                  p.progress === 100
                    ? "#22c55e"
                    : "linear-gradient(90deg,var(--accent),var(--accent-2))",
              }}
            />
          </div>
        </div>
        <div className="faint row gap-2" style={{ fontSize: 11 }}>
          <Clock size={12} /> {p.updated}更新
        </div>
      </div>
    </button>
    {onDelete && (
      <button
        type="button"
        title="移到回收站"
        aria-label="移到回收站"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(p);
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: 9,
          border: "none",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          background: "rgba(0,0,0,.46)",
          color: "#fff",
          opacity: hover ? 1 : 0,
          transition: "opacity .15s",
          zIndex: 2,
        }}
      >
        <Trash2 size={14} />
      </button>
    )}
    </div>
  );
}
