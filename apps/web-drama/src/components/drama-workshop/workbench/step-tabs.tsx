"use client";

// 顶部步骤页签 — 设计真源 v4 screens-episode-v4.jsx `StepTabs4`:
// 每一集内三步:① 剧集脚本 › ② 视频工厂 › ③ 成片配方;下一步带提示。
import * as React from "react";
import { Check } from "lucide-react";
import { EP_STEPS, type StageKey } from "../stages-config";

interface StepTabsProps {
  stage: StageKey;
  ep: number;
  locked: Partial<Record<StageKey, boolean>>;
  onJump: (key: StageKey) => void;
}

export function StepTabs({ stage, ep, locked, onJump }: StepTabsProps) {
  const curIdx = EP_STEPS.findIndex((s) => s.key === stage);
  return (
    <div
      className="row"
      style={{
        padding: "0 24px",
        gap: 4,
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        flex: "none",
        minHeight: 50,
        flexWrap: "wrap",
      }}
    >
      <span
        className="num"
        style={{ fontWeight: 800, fontSize: 14, color: "var(--accent)", padding: "13px 10px 13px 0", flex: "none", whiteSpace: "nowrap" }}
      >
        第 {ep} 集
      </span>
      {EP_STEPS.map((s, i) => {
        const on = stage === s.key;
        const done = !!locked[s.key];
        const next = !on && !done && i === curIdx + 1;
        return (
          <React.Fragment key={s.key}>
            <button
              type="button"
              onClick={() => onJump(s.key)}
              className="row gap-2"
              title={s.sub}
              style={{
                padding: "0 16px",
                alignSelf: "stretch",
                position: "relative",
                flex: "none",
                color: on ? "var(--accent)" : done ? "var(--ink-2)" : "var(--ink-3)",
                fontWeight: on ? 800 : 600,
                fontSize: 13.5,
              }}
            >
              {done && !on ? (
                <Check size={13} style={{ color: "#16a34a" }} />
              ) : (
                <span className="num" style={{ fontSize: 11, opacity: 0.7 }}>{i + 1}</span>
              )}
              {s.name}
              {next && (
                <span className="tag tag-accent" style={{ fontSize: 9.5, padding: "1px 7px" }}>
                  下一步
                </span>
              )}
              {on && (
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    right: 10,
                    bottom: -1,
                    height: 3,
                    borderRadius: 3,
                    background: "linear-gradient(90deg,var(--accent),var(--accent-2))",
                  }}
                />
              )}
            </button>
            {i < EP_STEPS.length - 1 && (
              <span className="faint" style={{ alignSelf: "center", fontSize: 13, flex: "none" }}>
                ›
              </span>
            )}
          </React.Fragment>
        );
      })}
      <span className="grow" />
      <span
        className="faint"
        style={{
          alignSelf: "center",
          fontSize: 11.5,
          flex: "0 1 auto",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        脚本 → 分镜提示词 → AI 生成视频,一条线走完
      </span>
    </div>
  );
}
