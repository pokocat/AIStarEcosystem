"use client";

// 右侧角色面板(常驻 · 可折叠) — 设计真源:components.jsx `CastPanel`。
// 关键角色:绑数字人 / 已锁徽标 / 参考图计数;龙套:文字外观。
import * as React from "react";
import { ChevronLeft, ChevronRight, Sparkles, User, Users } from "lucide-react";
import { Avatar } from "@/components/drama-ui";
import type { CharacterDef } from "@/mocks/drama-workshop";

interface CastPanelProps {
  chars: CharacterDef[];
  collapsed: boolean;
  onToggle: () => void;
  onBind?: (c: CharacterDef) => void;
  /** 当前高亮的关键角色 id(分镜屏可视化引用关系用) */
  activeRef?: string | null;
}

export function CastPanel({ chars, collapsed, onToggle, onBind, activeRef }: CastPanelProps) {
  const keys = chars.filter((c) => c.role === "key");
  const extras = chars.filter((c) => c.role === "extra");

  if (collapsed) {
    return (
      <aside
        className="col"
        style={{
          width: 60,
          flex: "none",
          background: "var(--surface)",
          borderLeft: "1px solid var(--line)",
          padding: "16px 0",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          className="btn btn-icon btn-ghost btn-sm"
          title="展开角色面板"
          onClick={onToggle}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ width: 28, height: 1, background: "var(--line)" }} />
        <div className="col" style={{ gap: 8, alignItems: "center" }}>
          {keys.map((c) => (
            <button
              type="button"
              key={c.id}
              title={c.name}
              onClick={onToggle}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            >
              <Avatar theme={c.avatar} bound={c.bound} size={34} />
            </button>
          ))}
          {extras.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.name}
              onClick={onToggle}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--surface-2)",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-3)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <User size={15} />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="col scroll"
      style={{
        width: "var(--cast-w)",
        flex: "none",
        background: "var(--surface)",
        borderLeft: "1px solid var(--line)",
        padding: 16,
      }}
    >
      <div className="row gap-2" style={{ marginBottom: 4 }}>
        <Users size={17} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 700 }}>角色面板</span>
        <span className="tag tag-gray num">{chars.length}</span>
        <span className="grow" />
        <button
          type="button"
          className="btn btn-icon btn-ghost btn-sm"
          title="收起角色面板"
          onClick={onToggle}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="faint" style={{ fontSize: 11.5, marginBottom: 12 }}>
        剧本 / 分镜里 @角色 都从这里来
      </div>

      <div
        className="faint"
        style={{
          fontSize: 11,
          fontWeight: 700,
          marginBottom: 8,
          letterSpacing: ".05em",
        }}
      >
        关键角色 · 锁形象
      </div>
      <div className="col gap-2" style={{ marginBottom: 16 }}>
        {keys.map((c) => (
          <div
            key={c.id}
            className="row gap-3 card"
            style={{
              padding: 10,
              border: activeRef === c.id ? "1.5px solid var(--accent)" : "1px solid var(--line-soft)",
            }}
          >
            <Avatar theme={c.avatar} bound={c.bound} size={40} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.name}</div>
              <div
                className="faint"
                style={{
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.cast}
              </div>
            </div>
            {c.bound ? (
              <span className="tag tag-accent">
                <Sparkles size={11} fill="currentColor" strokeWidth={0} /> 已锁
              </span>
            ) : (
              <button
                type="button"
                className="chip"
                style={{ height: 26, fontSize: 11.5 }}
                onClick={() => onBind?.(c)}
              >
                绑定
              </button>
            )}
          </div>
        ))}
      </div>

      <div
        className="faint"
        style={{
          fontSize: 11,
          fontWeight: 700,
          marginBottom: 8,
          letterSpacing: ".05em",
        }}
      >
        龙套 · 文字外观
      </div>
      <div className="col gap-2">
        {extras.map((c) => (
          <div key={c.id} className="row gap-3" style={{ padding: "6px 8px" }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "var(--surface-2)",
                display: "grid",
                placeItems: "center",
                flex: "none",
                color: "var(--ink-3)",
              }}
            >
              <User size={16} />
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
              <div
                className="faint"
                style={{
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.cast}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
