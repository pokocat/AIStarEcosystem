"use client";

// 角色卡 — 设计真源:screens-project.jsx `CharCard`。
// 关键角色:大数字人封面(已绑) / 待绑占位(未绑) + 三张参考图槽;龙套:文字外观。
import * as React from "react";
import { RefreshCw, Sparkles, User } from "lucide-react";
import { Avatar, Thumb } from "@/components/drama-ui";
import { AVATAR_THEMES, type CharacterDef } from "@/mocks/drama-workshop";

interface CharCardProps {
  c: CharacterDef;
  delay?: number;
  onBind: () => void;
  onToggleRole: () => void;
}

export function CharCard({ c, delay = 0, onBind, onToggleRole }: CharCardProps) {
  const isKey = c.role === "key";
  const theme = AVATAR_THEMES[c.avatar] ?? AVATAR_THEMES.default;

  return (
    <div
      className="card col fade-up"
      style={{
        padding: 0,
        overflow: "hidden",
        animationDelay: delay + "ms",
      }}
    >
      {/* 形象区:关键角色显数字人分身;龙套:无 */}
      {isKey ? (
        <div style={{ position: "relative" }}>
          {c.bound ? (
            <Thumb
              from={theme.from}
              to={theme.to}
              ratio="16/9"
              radius={0}
              style={{ width: "100%" }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                }}
              >
                <Avatar theme={c.avatar} size={64} ring />
                <div style={{ color: "#fff" }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 18,
                      textShadow: "0 1px 6px rgba(0,0,0,.3)",
                    }}
                  >
                    {c.name}
                  </div>
                  <div className="row gap-2" style={{ fontSize: 11.5, marginTop: 4 }}>
                    <span className="thumb-label">
                      <Sparkles
                        size={10}
                        fill="#fff"
                        strokeWidth={0}
                        style={{ verticalAlign: -1, marginRight: 3 }}
                      />
                      数字人已绑
                    </span>
                    <span className="thumb-label num">参考图 ×{c.refCount ?? 3}</span>
                  </div>
                </div>
              </div>
            </Thumb>
          ) : (
            <div
              className="col center"
              style={{
                aspectRatio: "16/9",
                background: "var(--surface-2)",
                gap: 10,
                borderBottom: "1px dashed var(--line)",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: "var(--surface)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ink-3)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <User size={24} />
              </div>
              <button
                type="button"
                className="btn btn-grad btn-sm"
                onClick={onBind}
              >
                <Sparkles size={14} fill="currentColor" strokeWidth={0} /> 绑定数字人分身
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="col gap-2" style={{ padding: 16 }}>
        <div className="row gap-2">
          {!isKey && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--surface-2)",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-3)",
                flex: "none",
              }}
            >
              <User size={17} />
            </div>
          )}
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 15 }}>{c.name}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{c.cast}</div>
          </div>
          <button
            type="button"
            className="chip"
            onClick={onToggleRole}
            style={{
              height: 26,
              fontSize: 11.5,
              background: isKey ? "var(--accent-soft)" : "var(--surface-2)",
              color: isKey ? "var(--accent)" : "var(--ink-2)",
            }}
          >
            {isKey ? "关键角色" : "龙套"}
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{c.desc}</div>
        {isKey && c.bound && (
          <div className="col gap-2" style={{ marginTop: 2 }}>
            <div
              className="faint"
              style={{ fontSize: 11, fontWeight: 700 }}
            >
              真人参考图 · 拖入真实剧照锁形象
            </div>
            <div className="row gap-2" style={{ alignItems: "flex-end" }}>
              {["正面", "侧面", "情绪"].map((lbl) => (
                <div key={lbl} className="col center" style={{ gap: 3 }}>
                  <div
                    style={{
                      width: 56,
                      height: 72,
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: "1.5px dashed var(--line)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--ink-3)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {lbl}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-line btn-sm"
                style={{ alignSelf: "flex-end" }}
                onClick={onBind}
              >
                <RefreshCw size={13} /> 换形象
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
