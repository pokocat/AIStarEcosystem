"use client";

// 分集导航(左轨) — 设计真源 v4 screens-episode-v4.jsx `EpisodeRail4`:
// 进入剧集制作后替代阶段轨;窄视口自动收窄为图标轨。
// v0.197：≤720 整条隐藏（styles/pages/workbench.css `.wb-episode-rail`），改由步骤页签左侧的集选择器切集。
// 集状态不再读旧的 `locked`（「脚本已锁」与事实不符 —— 脚本随时能改），改按本集真实产物算。
import * as React from "react";
import { ChevronLeft, ScrollText, Network } from "lucide-react";
import { episodeTitle, type EpisodeOutline } from "@/mocks/drama-workshop";
import { RenderTaskDock } from "../render-task-dock";

export interface EpisodeStatus {
  label: string;
  /** done = 已合成成片；progress = 已有分镜；idle = 还没开始 */
  tone: "done" | "progress" | "idle";
}

interface EpisodeRailProps {
  ep: number;
  total: number;
  episodes: EpisodeOutline[];
  /** 窄视口收窄为 72px 图标轨 */
  slim?: boolean;
  onEp: (n: number) => void;
  onBack: () => void;
  /** 返回按钮去哪：普通短剧回「短剧设定」，互动剧回「互动编排」。 */
  backTo?: "setup" | "branch";
  /** 每集当前做到哪（由外壳按 episodeDocs 计算）。 */
  statusOf?: (no: number) => EpisodeStatus;
  /** 还有集没写剧情时，点底部那块去补。 */
  onAddMore?: () => void;
}

const DOT: Record<EpisodeStatus["tone"], string> = {
  done: "#22c55e",
  progress: "var(--accent)",
  idle: "transparent",
};

export function EpisodeRail({ ep, total, episodes, slim, onEp, onBack, backTo = "setup", statusOf, onAddMore }: EpisodeRailProps) {
  const backLabel = backTo === "branch" ? "互动编排" : "短剧设定";
  const BackIcon = backTo === "branch" ? Network : ScrollText;
  return (
    <nav
      className="col wb-episode-rail"
      aria-label="分集"
      style={{
        width: slim ? 72 : "var(--rail-w)",
        flex: "none",
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        padding: slim ? "14px 10px" : "14px 12px",
        gap: 4,
        minHeight: 0,
        transition: "width .2s",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        title={`回到${backLabel}`}
        aria-label={`回到${backLabel}`}
        className="row gap-2"
        style={{
          padding: "7px 10px",
          borderRadius: 11,
          marginBottom: 6,
          color: "var(--ink-3)",
          fontWeight: 600,
          fontSize: 12.5,
          flex: "none",
          justifyContent: slim ? "center" : "flex-start",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-2)";
          e.currentTarget.style.color = "var(--ink)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-3)";
        }}
      >
        {/* 收窄时不能只剩一个「<」：顶栏的「<」回列表，两个一样的箭头去不同地方很容易点错 */}
        {slim ? <BackIcon size={16} /> : (<><ChevronLeft size={14} /> {backLabel}</>)}
      </button>
      <div
        className="row"
        style={{ padding: slim ? "0 0 6px" : "0 10px 6px", flex: "none", justifyContent: slim ? "center" : "flex-start" }}
      >
        {slim ? (
          <span className="faint num" style={{ fontSize: 10.5, fontWeight: 700 }} title={`第 ${ep} 集，共 ${total} 集`}>
            {ep}/{total}
          </span>
        ) : (
          <>
            <span className="faint" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em" }}>
              分集 · 共 {total} 集
            </span>
            <span className="grow" />
            <span className="faint num" style={{ fontSize: 11 }}>第 {ep} 集</span>
          </>
        )}
      </div>

      <div className="scroll col gap-1 grow" style={{ minHeight: 0, paddingRight: 2 }}>
        {episodes.map((e) => {
          const on = e.no === ep;
          const st: EpisodeStatus = statusOf?.(e.no) ?? { label: "还没开始", tone: "idle" };
          return (
            <button
              key={e.no}
              type="button"
              onClick={() => onEp(e.no)}
              title={`第 ${e.no} 集 · ${episodeTitle(e)} · ${st.label}`}
              aria-current={on ? "true" : undefined}
              className="row gap-2"
              style={{
                padding: slim ? "6px 0" : "8px 9px",
                borderRadius: 11,
                textAlign: "left",
                alignItems: slim ? "center" : "flex-start",
                justifyContent: slim ? "center" : "flex-start",
                background: on ? "var(--accent-soft)" : "transparent",
                position: "relative",
              }}
              onMouseEnter={(ev) => {
                if (!on) ev.currentTarget.style.background = "var(--surface-2)";
              }}
              onMouseLeave={(ev) => {
                if (!on) ev.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="num"
                style={{
                  flex: "none",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11.5,
                  fontWeight: 800,
                  background: on ? "var(--accent)" : "var(--surface-2)",
                  color: on ? "#fff" : "var(--ink-3)",
                  position: "relative",
                }}
              >
                {e.no}
                {slim && st.tone !== "idle" && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: DOT[st.tone],
                      border: "1.5px solid var(--surface)",
                    }}
                  />
                )}
              </span>
              {!slim && (
                <span className="col" style={{ minWidth: 0, gap: 2, flex: 1 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: on ? 700 : 600,
                      color: on ? "var(--accent)" : "var(--ink-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                      minWidth: 0,
                    }}
                  >
                    {episodeTitle(e)}
                  </span>
                  <span className="row gap-1" style={{ fontSize: 10 }}>
                    {st.tone === "idle" ? (
                      <span className="faint">{st.label}</span>
                    ) : (
                      <span
                        className="row"
                        style={{ gap: 3, color: st.tone === "done" ? "#15803d" : "var(--accent)", fontWeight: 700 }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: DOT[st.tone] }} />
                        {st.label}
                      </span>
                    )}
                  </span>
                </span>
              )}
            </button>
          );
        })}
        {total > episodes.length && !slim && (
          <button
            type="button"
            onClick={onAddMore ?? onBack}
            className="col center"
            style={{ padding: "12px 8px", borderRadius: 11, border: "1.5px dashed var(--line)", gap: 4, marginTop: 4, background: "transparent", cursor: "pointer" }}
          >
            <span className="faint num" style={{ fontSize: 11, fontWeight: 700 }}>
              第 {episodes.length + 1}-{total} 集
            </span>
            <span className="faint" style={{ fontSize: 10.5, textAlign: "center", lineHeight: 1.5 }}>
              这几集还没写剧情，点这里回「短剧设定」补齐
            </span>
          </button>
        )}
      </div>

      {/* 后台生成任务面板 —— 钉在分集轨底部（窄轨时省略）；不再悬浮遮挡正文 */}
      {!slim && <RenderTaskDock style={{ flex: "none", paddingTop: 8 }} />}
    </nav>
  );
}
