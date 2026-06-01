"use client";

// 单镜配方预览弹层 — 设计真源:screens-board.jsx `ShotPromptPeek`。
// 四段式精简版(风格/画面/声音/参考)。
import * as React from "react";
import { Copy, X } from "lucide-react";
import { Avatar } from "@/components/drama-ui";
import type { BoardShot, CharacterDef } from "@/mocks/drama-workshop";

interface ShotPromptPeekProps {
  shot: BoardShot;
  chars: CharacterDef[];
  onClose: () => void;
}

export function ShotPromptPeek({ shot, chars, onClose }: ShotPromptPeekProps) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in"
        style={{
          width: 520,
          maxWidth: "94vw",
          padding: 0,
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)" }}
        >
          <span className="num tag tag-accent" style={{ marginRight: 8 }}>
            第 {shot.no} 镜
          </span>
          <span style={{ fontWeight: 700 }}>这一镜的成片配方</span>
          <span className="grow" />
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
        <div className="col gap-3" style={{ padding: 18, fontSize: 13.5 }}>
          <Seg label="风格">
            <span>悬疑风格,{shot.dur}秒,9:16,{shot.size}</span>
          </Seg>
          <Seg label="画面">
            <span>{shot.desc || "(待补充画面描述)"}</span>
          </Seg>
          <Seg label="声音">
            <span>{shot.voice || "(待补充声音指令)"}</span>
          </Seg>
          {shot.cast.length > 0 && (
            <Seg label="参考">
              <div
                className="row gap-2 card"
                style={{
                  padding: "6px 10px 6px 6px",
                  gap: 8,
                  background: "var(--surface-2)",
                  border: "none",
                  display: "inline-flex",
                }}
              >
                {(() => {
                  const c = chars.find((x) => x.id === shot.cast[0]);
                  return c ? (
                    <>
                      <Avatar theme={c.avatar} size={30} bound />
                      <div>
                        <div className="num faint" style={{ fontSize: 10 }}>
                          @图片1
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {c.name}的数字人形象
                        </div>
                      </div>
                    </>
                  ) : null;
                })()}
              </div>
            </Seg>
          )}
        </div>
        <div
          className="row"
          style={{
            padding: 14,
            borderTop: "1px solid var(--line-soft)",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button type="button" className="btn btn-grad btn-sm" onClick={onClose}>
            <Copy size={14} /> 复制本镜
          </button>
        </div>
      </div>
    </div>
  );
}

function Seg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row gap-3" style={{ alignItems: "flex-start" }}>
      <span
        className="tag"
        style={{
          flex: "none",
          width: 52,
          justifyContent: "center",
          background: "var(--ink)",
          color: "#fff",
        }}
      >
        {label}
      </span>
      <div className="grow" style={{ lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
