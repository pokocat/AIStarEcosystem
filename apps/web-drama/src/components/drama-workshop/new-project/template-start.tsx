"use client";

// 模板式立项起点 — 设计真源:screens-entry.jsx `TemplateStart`。
// 该类型下的爆款结构模板,挑一个直接预填整套大纲。
import * as React from "react";
import { ArrowRight, Check, Layers } from "lucide-react";
import { TEMPLATES, type ContentType } from "@/mocks/drama-workshop";

interface TemplateStartProps {
  type: ContentType;
  onEnter: (payload: { mode: "template"; template: string; projectId: string }) => void;
}

export function TemplateStart({ type, onEnter }: TemplateStartProps) {
  const list = TEMPLATES[type.key] ?? [];
  const [pick, setPick] = React.useState<string | null>(null);

  if (list.length === 0) {
    return (
      <div
        className="card fade-up col center"
        style={{ marginTop: 28, padding: 40, textAlign: "center", gap: 14 }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: "var(--surface-2)",
            display: "grid",
            placeItems: "center",
            color: "var(--ink-3)",
          }}
        >
          <Layers size={28} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          「{type.name}」暂时还没有上新模板
        </div>
        <div className="muted" style={{ fontSize: 13.5, maxWidth: 360 }}>
          这一类的爆款结构还在整理中。要不先用 AI 引导式,从零聊出你的故事?
        </div>
      </div>
    );
  }

  // 模板和样例项目映射(暂用类型对应的样例项目作为预填演示)
  const sampleProjectId = sampleProjectByType(type.key);

  return (
    <div className="fade-up" style={{ marginTop: 28 }}>
      <div className="faint" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 14 }}>
        「{type.name}」下的爆款结构 · 选一个直接预填
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 16,
        }}
      >
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPick(t.id)}
            className="card col"
            style={{
              padding: 18,
              textAlign: "left",
              gap: 12,
              border:
                pick === t.id
                  ? "2px solid var(--accent-2)"
                  : "1.5px solid var(--line-soft)",
              cursor: "pointer",
            }}
          >
            <div className="row gap-3">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "var(--accent-2-soft)",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  color: "var(--accent-2)",
                }}
              >
                <Layers size={20} />
              </div>
              <div className="grow">
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>{t.name}</div>
                <div className="faint num" style={{ fontSize: 12 }}>
                  {t.eps} 集 · {t.scene}
                </div>
              </div>
              {pick === t.id && (
                <span className="tag tag-pink">
                  <Check size={11} />
                </span>
              )}
            </div>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {t.hooks.map((h) => (
                <span key={h} className="tag tag-gray">{h}</span>
              ))}
            </div>
            <div className="faint" style={{ fontSize: 12 }}>节奏卡点 · {t.pace}</div>
          </button>
        ))}
      </div>
      {pick && (
        <div className="row fade-up" style={{ justifyContent: "flex-end", marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-grad"
            onClick={() => onEnter({ mode: "template", template: pick, projectId: sampleProjectId })}
          >
            套用模板,预填大纲 <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function sampleProjectByType(typeKey: string): string {
  switch (typeKey) {
    case "mystery":   return "p1";
    case "palace":    return "p2";
    case "romance":   return "p3";
    case "public":    return "p4";
    case "scifi":     return "p5";
    case "corporate": return "p6";
    default:          return "p1";
  }
}
