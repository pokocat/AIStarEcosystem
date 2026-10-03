"use client";

// 「我的短剧」项目卡 — 设计真源:screens-entry.jsx `ProjectCard`。
// 视觉:9:16 / 16:10 渐变缩略图占大头 + 类型 / 来源 chip + 进度条 + 上次更新时间。
import * as React from "react";
import { Clock, Trash2 } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import { Thumb } from "@/components/drama-ui";
import { stageNameByNo } from "./stages-config";
import type { DramaProjectSummary } from "@/mocks/drama-workshop";

interface ProjectCardProps {
  p: DramaProjectSummary;
  delay?: number;
  onOpen?: (p: DramaProjectSummary) => void;
  /** 提供时显示「移到回收站」按钮（软删）：桌面悬停出现，触屏常显（home.css `.hm-card-del`）。 */
  onDelete?: (p: DramaProjectSummary) => void;
}

export function ProjectCard({ p, delay = 0, onOpen, onDelete }: ProjectCardProps) {
  const [hover, setHover] = React.useState(false);
  // v0.98：统一走 stageNameByNo（线性阶段 + 老 stage 5/6 归一到成片合成），不再用数组下标（会把 stage=6 错标成互动编排）。
  const stageLabel = stageNameByNo(p.stage);
  const updated = formatDateTime(p.updatedAt, "");
  const modeLabel = p.mode === "interactive" ? "互动剧" : p.mode === "guided" ? "原创" : "用了模板";
  const modeTitle =
    p.mode === "interactive" ? "观众在剧中做选择的互动剧" : p.mode === "guided" ? "从你自己的想法开始做的" : "用模板做的同款";
  return (
    <div
      className="hm-card-wrap"
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
            {/* 右上角留给「移到回收站」（触屏常显），状态与集数都放左边 */}
            <div className="row gap-1" style={{ flexWrap: "wrap", paddingRight: onDelete ? 36 : 0 }}>
              <span className="thumb-label" style={{ whiteSpace: "nowrap" }}>
                {p.ratio} · {p.episodes} 集
              </span>
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
        <div className="row gap-2" style={{ minWidth: 0 }}>
          <span className="tag tag-gray" title={p.type} style={TAG_CLIP}>{p.type}</span>
          <span
            className="tag"
            title={modeTitle}
            style={{
              ...TAG_CLIP,
              background: p.mode === "interactive" ? "#ede9fe" : p.mode === "guided" ? "var(--accent-soft)" : "var(--accent-2-soft)",
              color: p.mode === "interactive" ? "#7c3aed" : p.mode === "guided" ? "var(--accent)" : "var(--accent-2)",
            }}
          >
            {modeLabel}
          </span>
        </div>
        <div className="col gap-2">
          <div className="row" style={{ justifyContent: "space-between", fontSize: 11.5, gap: 6, minWidth: 0 }}>
            <span className="faint" title={`做到「${stageLabel}」`} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              做到「{stageLabel}」
            </span>
            <span
              className="num"
              style={{
                fontWeight: 700,
                flex: "none",
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
        {updated && (
          <div className="faint row gap-1 num" title={`更新于 ${updated}`} style={{ fontSize: 11, minWidth: 0 }}>
            <Clock size={12} style={{ flex: "none" }} aria-label="更新于" />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{updated}</span>
          </div>
        )}
      </div>
    </button>
    {onDelete && (
      <button
        type="button"
        className="hm-card-del"
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
          width: 32,
          height: 32,
          borderRadius: 9,
          border: "none",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          background: "rgba(0,0,0,.46)",
          color: "#fff",
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

const TAG_CLIP: React.CSSProperties = { minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", lineHeight: "22px" };
