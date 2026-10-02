"use client";

// 阶段轨 v0.89 — 设计真源 AI短剧工作台.dc.html 左边栏：
// 项目头卡（封面 + 标题 + 类型·集数）+ 时间线两步（短剧设定 / 逐集制作 第 N 集）
// + 底部「转换为互动剧」。互动剧项目额外插入「互动编排」步骤。
// v0.197：≤860 左轨隐藏，改由 StageBar（顶栏下一条横向阶段切换）承担，见 styles/pages/workbench.css。
import * as React from "react";
import { ChevronLeft, ChevronRight, Film, Network, ScrollText } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { STAGE_BY_KEY, type StageKey, EPISODE_STAGE_KEYS } from "../stages-config";
import { RenderTaskDock } from "../render-task-dock";
import type { DramaProjectSummary } from "@/mocks/drama-workshop";

interface StageRailProps {
  meta: DramaProjectSummary;
  current: StageKey;
  locked: Partial<Record<StageKey, boolean>>;
  ep: number;
  /** 头卡上的集数：读 projectInfo.episodes（与顶栏同一个数；meta 是列表摘要，可能是旧值）。 */
  episodes?: number;
  /** v0.79：互动剧项目额外显示「互动编排」入口。 */
  interactive?: boolean;
  /** v0.79：非互动剧项目显示「转换为互动剧」入口（把线性大纲转成可分支的互动剧）。 */
  onConvert?: () => void;
  onJump: (key: StageKey) => void;
  onHome?: () => void;
}

/** 时间线步骤：左节点（圆 + 连接线）+ 右卡片。 */
function StepRow({
  icon,
  active,
  connect,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  active?: boolean;
  /** 在下方画一段连接线（非最后一步）。 */
  connect?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="row" style={{ alignItems: "stretch", gap: 11 }}>
      <div className="col" style={{ width: 34, flex: "none", alignItems: "center" }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            flex: "none",
            display: "grid",
            placeItems: "center",
            background: active ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "var(--surface)",
            border: active ? "none" : "1.5px solid var(--line)",
            color: active ? "#fff" : "var(--ink-3)",
            boxShadow: active ? "var(--shadow-accent)" : "none",
          }}
        >
          {icon}
        </span>
        {connect && (
          <span style={{ flex: 1, width: 2, marginTop: 4, minHeight: 18, background: "var(--line)", borderRadius: 2 }} />
        )}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="col"
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          padding: "11px 13px",
          borderRadius: 14,
          marginBottom: 8,
          gap: 0,
          background: active ? "var(--accent-soft)" : "transparent",
          cursor: "pointer",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        {children}
      </button>
    </div>
  );
}

export function StageRail({ meta, current, ep, episodes, interactive, onConvert, onJump, onHome }: StageRailProps) {
  const inEp = EPISODE_STAGE_KEYS.includes(current);
  const onBranch = current === "branch";
  const onSetup = !inEp && !onBranch;
  const branch = STAGE_BY_KEY.branch;

  return (
    <nav
      className="col wb-stage-rail"
      aria-label="短剧制作步骤"
      style={{
        width: "var(--rail-w)",
        flex: "none",
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        padding: "16px 14px",
        gap: 0,
        overflowY: "auto",
      }}
    >
      {/* 返回 */}
      <button
        type="button"
        onClick={onHome}
        className="row gap-2"
        style={{
          padding: "7px 8px",
          borderRadius: 10,
          marginBottom: 12,
          color: "var(--ink-3)",
          fontWeight: 600,
          fontSize: 13,
          textAlign: "left",
          flex: "none",
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
        <ChevronLeft size={15} /> 返回我的短剧
      </button>

      {/* 项目头卡 */}
      <div
        className="row gap-3"
        style={{ padding: 12, borderRadius: 14, background: "var(--surface-2)", marginBottom: 16, flex: "none", alignItems: "center" }}
      >
        <Thumb
          from={meta.cover.from}
          to={meta.cover.to}
          w={54}
          ratio={meta.ratio === "16:9" ? "16/10" : "3/4"}
          radius={10}
          stripes={false}
        />
        <div className="col" style={{ minWidth: 0, gap: 3 }}>
          <div
            style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={meta.title}
          >
            {meta.title}
          </div>
          <div className="faint num" style={{ fontSize: 11.5 }}>
            {meta.type} · {episodes ?? meta.episodes} 集
          </div>
        </div>
      </div>

      {/* 时间线步骤 */}
      <div className="col" style={{ flex: "none" }}>
        {/* 短剧设定 */}
        <StepRow icon={<ScrollText size={16} />} active={onSetup} connect onClick={() => onJump("outline")}>
          <div className="row gap-2" style={{ alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: onSetup ? "var(--accent)" : "var(--ink)" }}>短剧设定</span>
            <span className="grow" />
            {onSetup && <span className="tag tag-accent" style={{ flex: "none", height: 20 }}>当前</span>}
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.5 }}>故事大纲 · 分集剧情 · 角色与场景</div>
          <div className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>所有集通用</div>
        </StepRow>

        {/* 互动编排（仅互动剧） */}
        {interactive && (
          <StepRow icon={<Network size={15} />} active={onBranch} connect onClick={() => onJump("branch")}>
            <div className="row gap-2" style={{ alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: onBranch ? "var(--accent)" : "var(--ink)" }}>
                {branch?.name ?? "互动编排"}
              </span>
            </div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.5 }}>画分支图，给每集设互动点</div>
            <div className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>试玩没问题再导出</div>
          </StepRow>
        )}

        {/* 逐集制作 */}
        <StepRow icon={<Film size={16} />} active={inEp} onClick={() => { if (!inEp) onJump("epscript"); }}>
          <div className="row gap-2" style={{ alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: inEp ? "var(--accent)" : "var(--ink)" }}>逐集制作</span>
            <span className="grow" />
            <span className="tag tag-gray num" style={{ flex: "none", height: 20 }}>第 {ep} 集</span>
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.5 }}>① 分镜 → ② 合成成片</div>
          <div className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>逐镜出首帧和视频，再合成成片</div>
          {!inEp && (
            <div className="row gap-1" style={{ marginTop: 6, color: "var(--accent)", fontSize: 12, fontWeight: 700, alignItems: "center" }}>
              去做第 {ep} 集 <ChevronRight size={13} />
            </div>
          )}
        </StepRow>
      </div>

      {/* 底部：后台任务面板 + 转换为互动剧 */}
      <span className="grow" style={{ minHeight: 12 }} />
      <RenderTaskDock style={{ flex: "none", paddingBottom: 4 }} />
      {!interactive && onConvert && (
        <button
          type="button"
          onClick={onConvert}
          className="row gap-2"
          title="让观众在剧中做选择、走向不同结局。现有分集会保留，转换后不能改回"
          style={{
            flex: "none",
            marginTop: 8,
            padding: "13px 12px 4px",
            borderTop: "1px solid var(--line)",
            color: "var(--ink-2)",
            fontSize: 13,
            fontWeight: 600,
            justifyContent: "center",
            background: "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-2)"; }}
        >
          <Network size={15} /> 转换为互动剧
        </button>
      )}
    </nav>
  );
}

interface StageBarProps {
  current: StageKey;
  ep: number;
  interactive?: boolean;
  onConvert?: () => void;
  onJump: (key: StageKey) => void;
}

/**
 * v0.197：窄屏（≤860）替代左阶段轨的横向阶段切换条，放在顶栏下面。
 * 桌面上由 CSS 藏起来（`.wb-stage-bar`），不在 JS 里判宽度。
 */
export function StageBar({ current, ep, interactive, onConvert, onJump }: StageBarProps) {
  const inEp = EPISODE_STAGE_KEYS.includes(current);
  const onBranch = current === "branch";
  const onSetup = !inEp && !onBranch;
  const pill = (active: boolean): React.CSSProperties => ({
    flex: "none",
    minHeight: 34,
    padding: "0 14px",
    borderRadius: 999,
    border: active ? "1.5px solid var(--accent)" : "1px solid var(--line)",
    background: active ? "var(--accent-soft)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--ink-2)",
    fontSize: 13,
    fontWeight: active ? 800 : 600,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  });
  return (
    <nav className="wb-stage-bar" aria-label="短剧制作步骤">
      <button type="button" style={pill(onSetup)} aria-current={onSetup ? "step" : undefined} onClick={() => onJump("outline")}>
        <ScrollText size={14} /> 短剧设定
      </button>
      {interactive && (
        <button type="button" style={pill(onBranch)} aria-current={onBranch ? "step" : undefined} onClick={() => onJump("branch")}>
          <Network size={14} /> 互动编排
        </button>
      )}
      <button
        type="button"
        style={pill(inEp)}
        aria-current={inEp ? "step" : undefined}
        onClick={() => {
          if (!inEp) onJump("epscript");
        }}
      >
        <Film size={14} /> 逐集制作 · 第 {ep} 集
      </button>
      {!interactive && onConvert && (
        <button
          type="button"
          onClick={onConvert}
          title="让观众在剧中做选择、走向不同结局。现有分集会保留，转换后不能改回"
          style={{ ...pill(false), borderStyle: "dashed", color: "var(--ink-3)" }}
        >
          <Network size={14} /> 转换为互动剧
        </button>
      )}
    </nav>
  );
}
