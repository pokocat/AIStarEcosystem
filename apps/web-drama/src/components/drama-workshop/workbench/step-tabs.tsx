"use client";

// 顶部步骤页签 — 设计真源 v4 screens-episode-v4.jsx `StepTabs4`:
// 每一集内两步:① 分镜 › ② 合成成片;下一步带提示。
// v0.197：不再折行（一行横滑）；≤720 分集轨隐藏后，左侧「第 N 集」换成集选择器，并补一个回设定页的按钮
//（样式见 styles/pages/workbench.css `.wb-step-tabs`）。
import * as React from "react";
import { Check, ChevronDown, ChevronLeft } from "lucide-react";
import { episodeTitle, type EpisodeOutline } from "@/mocks/drama-workshop";
import { EP_STEPS, type StageKey } from "../stages-config";

interface StepTabsProps {
  stage: StageKey;
  ep: number;
  locked: Partial<Record<StageKey, boolean>>;
  onJump: (key: StageKey) => void;
  /** 集选择器（≤720 才显示）的选项来源。 */
  episodes?: EpisodeOutline[];
  onEp?: (n: number) => void;
  /** ≤720 的返回按钮（分集轨隐藏后唯一的回设定页入口）。 */
  onBack?: () => void;
  backLabel?: string;
}

const HINT: Partial<Record<StageKey, string>> = {
  epscript: "在分镜表里逐镜出首帧和视频，都有视频了再合成成片",
  prompt: "把这一集的镜头视频拼成成片",
};

export function StepTabs({ stage, ep, locked, onJump, episodes, onEp, onBack, backLabel = "短剧设定" }: StepTabsProps) {
  const curIdx = EP_STEPS.findIndex((s) => s.key === stage);
  const hint = HINT[stage];
  return (
    <div
      className="row wb-step-tabs"
      style={{
        padding: "0 24px",
        gap: 4,
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        flex: "none",
        minHeight: 50,
        flexWrap: "nowrap",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {onBack && (
        <button
          type="button"
          className="btn btn-icon btn-ghost btn-sm wb-step-back"
          title={`回到${backLabel}`}
          aria-label={`回到${backLabel}`}
          onClick={onBack}
          style={{ flex: "none" }}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      <span
        className="num wb-step-ep-label"
        style={{ fontWeight: 800, fontSize: 14, color: "var(--accent)", padding: "13px 10px 13px 0", flex: "none", whiteSpace: "nowrap" }}
      >
        第 {ep} 集
      </span>
      {episodes && episodes.length > 0 && onEp && (
        // 收起时只显示「第 N 集 ▾」，点开是原生下拉（带每集标题）；原生 select 透明地盖在上面。
        <span
          className="wb-step-ep-select num"
          style={{
            position: "relative",
            flex: "none",
            alignItems: "center",
            gap: 4,
            height: 34,
            padding: "0 10px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: "var(--accent)",
            fontWeight: 800,
            fontSize: 13.5,
            whiteSpace: "nowrap",
          }}
        >
          第 {ep} 集 <ChevronDown size={14} style={{ flex: "none" }} />
          <select
            aria-label="切换到第几集"
            value={ep}
            onChange={(e) => onEp(Number(e.target.value))}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 16 }}
          >
            {episodes.map((e) => (
              <option key={e.no} value={e.no}>
                第 {e.no} 集 · {episodeTitle(e)}
              </option>
            ))}
          </select>
        </span>
      )}
      {EP_STEPS.map((s, i) => {
        const on = stage === s.key;
        const done = !!locked[s.key];
        const next = !on && !done && i === curIdx + 1;
        return (
          <React.Fragment key={s.key}>
            <button
              type="button"
              onClick={() => onJump(s.key)}
              className="row gap-2 wb-step-tab"
              title={s.sub}
              aria-current={on ? "step" : undefined}
              style={{
                padding: "0 16px",
                alignSelf: "stretch",
                position: "relative",
                flex: "none",
                whiteSpace: "nowrap",
                color: on ? "var(--accent)" : done ? "var(--ink-2)" : "var(--ink-3)",
                fontWeight: on ? 800 : 600,
                fontSize: 13.5,
              }}
            >
              {done && !on ? (
                <Check size={13} style={{ color: "#16a34a", flex: "none" }} />
              ) : (
                <span className="num" style={{ fontSize: 11, opacity: 0.7 }}>{i + 1}</span>
              )}
              {s.name}
              {next && (
                <span className="tag tag-accent wb-step-next" style={{ fontSize: 9.5, padding: "1px 7px", flex: "none" }}>
                  下一步
                </span>
              )}
              {on && (
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    right: 10,
                    bottom: 0,
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
      {hint && (
        <span
          className="faint wb-steptabs-hint"
          title={hint}
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
          {hint}
        </span>
      )}
    </div>
  );
}
