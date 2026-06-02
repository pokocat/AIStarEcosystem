"use client";

// 数字人分身选择器(沉浸大图变体) — 设计真源:screens-project.jsx `AvatarPicker`(immersive)。
import * as React from "react";
import { Check, Sparkles, X } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { AVATAR_LIBRARY, type AvatarLibItem, type CharacterDef } from "@/mocks/drama-workshop";

interface AvatarPickerProps {
  char: CharacterDef;
  onClose: () => void;
  onConfirm: (charId: string, avatarKey: string) => void;
}

export function AvatarPicker({ char, onClose, onConfirm }: AvatarPickerProps) {
  const [sel, setSel] = React.useState<string | null>(null);
  const lib = AVATAR_LIBRARY;
  const cur: AvatarLibItem = sel ? lib.find((a) => a.id === sel) ?? lib[0] : lib[0];

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in"
        style={{ width: 760, maxWidth: "94vw", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              为「{char.name}」选数字人分身
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              真人脸由数字人引擎承接,选定后跨集形象一致
            </div>
          </div>
          <div className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="row" style={{ alignItems: "stretch" }}>
          <Thumb from={cur.from} to={cur.to} w={300} ratio="3/4" radius={0} style={{ flex: "none" }}>
            <div style={{ position: "absolute", bottom: 16, left: 16, color: "#fff", zIndex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 20, textShadow: "0 1px 6px rgba(0,0,0,.3)" }}>
                {cur.name}
              </div>
              <div className="row gap-2" style={{ marginTop: 6 }}>
                {cur.tags.map((tg) => (
                  <span key={tg} className="thumb-label">{tg}</span>
                ))}
              </div>
            </div>
          </Thumb>
          <div className="col" style={{ flex: 1, padding: 20 }}>
            <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
              分身资产库 · {lib.length} 个
            </div>
            <div
              className="scroll"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 10,
                maxHeight: 280,
                alignContent: "start",
              }}
            >
              {lib.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSel(a.id)}
                  style={{
                    borderRadius: 12,
                    padding: 3,
                    border:
                      cur.id === a.id
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <Thumb from={a.from} to={a.to} ratio="3/4" radius={9} stripes={false} />
                </button>
              ))}
            </div>
            <div className="row gap-3" style={{ marginTop: "auto", paddingTop: 16, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-grad"
                onClick={() => onConfirm(char.id, char.avatar)}
              >
                <Sparkles size={15} fill="currentColor" strokeWidth={0} /> 锁定 {cur.name}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ScenePickerProps {
  sceneName: string;
  onClose: () => void;
  onConfirm: (assetId: string) => void;
}

export function ScenePicker({ sceneName, onClose, onConfirm }: ScenePickerProps) {
  const [sel, setSel] = React.useState<string | null>(null);
  // 复用 6 个场景资产
  const LIB = [
    { id: "r1", name: "冷调公寓夜", from: "#64748b", to: "#1e293b" },
    { id: "r2", name: "霓虹雨夜",   from: "#7c3aed", to: "#2563eb" },
    { id: "r3", name: "暖黄室内",   from: "#f59e0b", to: "#b45309" },
    { id: "r4", name: "金属电梯",   from: "#94a3b8", to: "#475569" },
    { id: "r5", name: "落地窗景",   from: "#22d3ee", to: "#0e7490" },
    { id: "r6", name: "空镜街道",   from: "#a78bfa", to: "#6366f1" },
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in"
        style={{ width: 600, maxWidth: "94vw", padding: 22, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              为「{sceneName}」锁定参考图
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              选定后这个场景在每一集都按同一套视觉来
            </div>
          </div>
          <div className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div
          className="scroll"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
            maxHeight: 360,
            padding: 2,
          }}
        >
          {LIB.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSel(a.id)}
              className="col"
              style={{
                gap: 6,
                borderRadius: 14,
                padding: 4,
                border: sel === a.id ? "2px solid var(--accent)" : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ position: "relative", width: "100%" }}>
                <Thumb from={a.from} to={a.to} ratio="16/9" radius={10} style={{ width: "100%" }} />
                {sel === a.id && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                    }}
                  >
                    <Check size={13} />
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                {a.name}
              </div>
            </button>
          ))}
        </div>
        <div className="row gap-3" style={{ marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            type="button"
            className="btn btn-grad"
            disabled={!sel}
            onClick={() => sel && onConfirm(sel)}
          >
            锁定参考
          </button>
        </div>
      </div>
    </div>
  );
}
