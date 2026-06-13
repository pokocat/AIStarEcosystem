"use client";

// 阶段 2 大纲分集 v4 — 操作条置顶:AI 参数(设计范围/每集时长)+ 高亮生成按钮。
// 试水模式只铺前 6 集,满意再补铺完整;分集卡可拖拽调序 / 重写。
// 设计真源:screens-outline-v4.jsx `OutlineStage4 / EpRow4`。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Edit,
  GripVertical,
  Layers,
  Link as LinkIcon,
  List,
  Lock,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { Field, GenSkeleton } from "@/components/drama-ui";
import { StageHeader } from "../workbench";
import type { WorkshopAction, WorkshopState } from "../workbench";
import type { EpisodeOutline, ProjectData } from "@/mocks/drama-workshop";
import { ProjectsApi } from "@/api";
import { useDramaConfig } from "@/lib/use-drama-config";
import type { StageContext } from "./stage-context";

const SCOPE_OPTS = [
  { key: "trial", name: "先开个头试试", eps: 6 as number | null, cost: 6 },
  { key: "full", name: "完整设计", eps: null as number | null, cost: 18 },
] as const;
const DUR_OPTS = ["60 秒/集", "75 秒/集", "90 秒/集"];

interface OutlineStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  /** 模板模式:已预填,做"改而非建"的提示 */
  prefilled?: boolean;
  /** v0.64+:项目 id + 保存回调（真实后端落地）。 */
  ctx?: StageContext;
}

export function OutlineStage({ state, dispatch, data, prefilled, ctx }: OutlineStageProps) {
  const total = data.projectInfo.episodes;
  // 空项目(还没大纲)→ idle 引导生成;已有大纲 → done 直接展示。
  const [phase, setPhase] = React.useState<"idle" | "gen" | "done">(data.episodes.length ? "done" : "idle");
  const [scope, setScope] = React.useState<"trial" | "full">("trial");
  const [dur, setDur] = React.useState(DUR_OPTS[1]);
  const [eps, setEps] = React.useState<EpisodeOutline[]>(data.episodes);
  React.useEffect(() => {
    setEps(data.episodes);
  }, [data.episodes]);
  const locked = !!state.lockedStages.outline;
  const cfg = useDramaConfig();
  const scopeCost = (k: "trial" | "full") => (k === "trial" ? cfg.prices.outlineTrial : cfg.prices.outlineFull);
  const fillRestCost = Math.max(0, cfg.prices.outlineFull - cfg.prices.outlineTrial);
  const scopeOpt = SCOPE_OPTS.find((s) => s.key === scope)!;
  const showEps = scope === "trial" && !locked ? eps.slice(0, 6) : eps;

  // 真实大纲生成：调后端大模型 → 合并进整套文档 → 落库。无 ctx(脱离工作台)时退化为本地演示。
  const runOutline = async (nextScope: "trial" | "full", cost: number) => {
    setScope(nextScope);
    setPhase("gen");
    if (!ctx) {
      dispatch({ type: "spend", n: cost });
      setTimeout(() => setPhase("done"), 1400);
      return;
    }
    try {
      const count = nextScope === "trial" ? 6 : total || undefined;
      const episodes = await ProjectsApi.outlineAiDraft(ctx.projectId, count);
      setEps(episodes);
      await ctx.saveData({ ...data, episodes }, { stage: 2 });
      dispatch({ type: "spend", n: cost });
      setPhase("done");
      toast.success("大纲已生成 · 可改可重来");
    } catch (e) {
      setPhase(data.episodes.length ? "done" : "idle");
      toast.error(e instanceof Error ? e.message : "大纲生成失败，请稍后重试");
    }
  };

  const reorderEp = (fromNo: number, toNo: number) =>
    setEps((arr) => {
      const f = arr.findIndex((x) => x.no === fromNo);
      const tIdx = arr.findIndex((x) => x.no === toNo);
      if (f < 0 || tIdx < 0 || f === tIdx) return arr;
      const next = [...arr];
      const [m] = next.splice(f, 1);
      next.splice(tIdx, 0, m);
      return next;
    });

  const gen = () => runOutline(scope, scopeCost(scope));
  const fillRest = () => runOutline("full", fillRestCost);

  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 32px 64px" }}>
        <StageHeader
          no={2}
          scope="项目"
          title="大纲分集"
          desc="先定参数,让 AI 一次铺好每集的钩子与梗概 —— 改满意了再锁。"
          right={
            prefilled && (
              <span className="tag tag-pink">
                <Layers size={12} /> 模板已预填,改而非建
              </span>
            )
          }
        />

        {/* ===== 顶部操作条:AI 参数 + 高亮生成 ===== */}
        {!locked && (
          <div
            className="card"
            style={{
              padding: 0,
              marginBottom: 18,
              overflow: "hidden",
              border: "1.5px solid color-mix(in oklch, var(--accent) 35%, var(--line))",
              boxShadow: "0 0 0 4px var(--accent-soft), var(--shadow-sm)",
            }}
          >
            <div className="row gap-2" style={{ padding: "12px 18px 10px" }}>
              <div className="icon-badge" style={{ width: 30, height: 30, borderRadius: 9 }}>
                <Sparkles size={16} fill="currentColor" strokeWidth={0} />
              </div>
              <div className="grow">
                <span style={{ fontWeight: 800, fontSize: 14.5 }}>AI 生成大纲</span>
                <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>
                  设好参数点右边,一口气铺出每集钩子
                </span>
              </div>
              {phase === "done" && (
                <span className="tag tag-green">
                  <Check size={11} /> 已生成 · 可改可重来
                </span>
              )}
            </div>
            <div className="row" style={{ padding: "4px 18px 14px", gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* 设计范围 */}
              <div className="col gap-2">
                <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>设计范围</span>
                <div className="row gap-2">
                  {SCOPE_OPTS.map((o) => {
                    const on = scope === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setScope(o.key)}
                        className="col"
                        style={{
                          padding: "8px 14px",
                          borderRadius: 12,
                          textAlign: "left",
                          gap: 1,
                          border: on ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                          background: on ? "var(--accent-soft)" : "var(--surface)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: on ? "var(--accent)" : "var(--ink)" }}>
                          {o.name}
                        </span>
                        <span className="faint num" style={{ fontSize: 11 }}>
                          {o.eps ? `前 ${o.eps} 集` : `全部 ${total} 集`} · {scopeCost(o.key)} 积分
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* 每集时长 */}
              <div className="col gap-2">
                <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>每集时长</span>
                <div className="row gap-2">
                  {DUR_OPTS.map((d) => (
                    <button key={d} type="button" className={"chip num" + (dur === d ? " on" : "")} onClick={() => setDur(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <span className="grow" />
              <div className="col gap-1" style={{ alignItems: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-grad"
                  style={{ height: 44, padding: "0 22px", fontSize: 14.5 }}
                  disabled={phase === "gen"}
                  onClick={gen}
                >
                  <Sparkles size={16} /> {phase === "done" ? "重新生成大纲" : "AI 生成大纲"}
                </button>
                <span className="cost">
                  <Zap size={12} /> {scopeOpt.name} · 约 <b className="num">{scopeCost(scope)}</b> 积分
                </span>
              </div>
            </div>
          </div>
        )}
        {locked && (
          <div
            className="row gap-3 fade-up"
            style={{ padding: "12px 16px", background: "var(--accent-soft)", borderRadius: 14, marginBottom: 18, color: "var(--accent)" }}
          >
            <Lock size={17} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              大纲已锁定 —— 左侧分集导航和剧集脚本都以此为准。
            </span>
          </div>
        )}

        {/* 主线 & 设定 */}
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="row gap-2" style={{ marginBottom: 12 }}>
            <LinkIcon size={15} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>主线 &amp; 一句话设定</span>
          </div>
          <div className="col gap-3">
            <Field label="一句话剧情">{data.projectInfo.logline}</Field>
            <Field label="主线走向">
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {data.projectInfo.mainline.split(" → ").map((s, i, arr) => (
                  <React.Fragment key={`${s}-${i}`}>
                    <span className="chip static">{s}</span>
                    {i < arr.length - 1 && <ArrowRight size={13} style={{ color: "var(--ink-3)" }} />}
                  </React.Fragment>
                ))}
              </div>
            </Field>
          </div>
        </div>

        {/* 分集列表 */}
        {phase === "idle" && (
          <div className="card col center" style={{ padding: "46px 0", textAlign: "center", gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: "var(--accent-soft)",
                display: "grid",
                placeItems: "center",
                color: "var(--accent)",
              }}
            >
              <List size={26} />
            </div>
            <div className="muted" style={{ maxWidth: 340, fontSize: 13.5 }}>
              还没有大纲。在上方设好「范围 + 每集时长」,点{" "}
              <b style={{ color: "var(--accent)" }}>AI 生成大纲</b>,先开个头只要 6 积分。
            </div>
          </div>
        )}
        {phase === "gen" && (
          <div className="card" style={{ padding: 18 }}>
            <GenSkeleton lines={4} label={`正在按主线铺${scope === "trial" ? "前 6 集" : `全部 ${total} 集`}的钩子…`} />
          </div>
        )}
        {phase === "done" && (
          <div className="col gap-3">
            {showEps.map((e, i) => (
              <EpisodeRow
                key={e.no}
                e={e}
                delay={i * 45}
                prefilled={prefilled}
                onReorder={reorderEp}
                onRewrite={() => toast.success(`已为第 ${e.no} 集重写梗概`)}
              />
            ))}
            {scope === "trial" && !locked && (
              <div className="card row gap-3" style={{ padding: 16, border: "1.5px dashed var(--line)", background: "var(--surface-2)" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: "var(--accent-soft)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--accent)",
                    flex: "none",
                  }}
                >
                  <List size={18} />
                </div>
                <div className="grow">
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>开头满意?把剩下 {total - 6} 集一次铺完</div>
                  <div className="faint" style={{ fontSize: 12 }}>AI 会顺着这 6 集的节奏与人物关系往后铺,口吻不会断</div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" style={{ flex: "none" }} onClick={fillRest}>
                  铺完整 {total} 集 · 补 {fillRestCost} 积分
                </button>
              </div>
            )}
            {!locked && (
              <div className="row gap-3" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                <button type="button" className="btn btn-line" onClick={() => toast.success("已加一集占位,可手动填梗概")}>
                  <Plus size={15} /> 加一集
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (ctx) {
                      try {
                        await ctx.saveData({ ...data, episodes: eps }, { stage: 3, progress: 40 });
                      } catch {
                        /* saveData 内部已提示，锁定仍继续 */
                      }
                    }
                    dispatch({ type: "lock", stage: "outline", cost: 0 });
                  }}
                >
                  <Check size={16} /> 锁定大纲 · 去定角色
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EpisodeRow({
  e,
  delay,
  prefilled,
  onReorder,
  onRewrite,
}: {
  e: EpisodeOutline;
  delay: number;
  prefilled?: boolean;
  onReorder?: (fromNo: number, toNo: number) => void;
  onRewrite?: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  const [over, setOver] = React.useState(false);
  return (
    <div
      className="card fade-up"
      style={{
        padding: 15,
        animationDelay: delay + "ms",
        position: "relative",
        borderLeft: prefilled ? "3px solid var(--accent-2)" : undefined,
        boxShadow: over ? "0 0 0 2px var(--accent)" : undefined,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(ev) => {
        ev.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(ev) => {
        ev.preventDefault();
        setOver(false);
        const fromNo = Number(ev.dataTransfer.getData("text/plain"));
        if (fromNo && fromNo !== e.no) onReorder?.(fromNo, e.no);
      }}
    >
      <div className="row gap-3" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: "none", textAlign: "center" }}>
          <span
            draggable
            title="拖拽调序"
            onDragStart={(ev) => {
              ev.dataTransfer.setData("text/plain", String(e.no));
              ev.dataTransfer.effectAllowed = "move";
            }}
            style={{ cursor: "grab", color: "var(--ink-3)", display: "block", marginBottom: 2 }}
          >
            <GripVertical size={14} />
          </span>
          <div className="num" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: "var(--accent)" }}>
            {String(e.no).padStart(2, "0")}
          </div>
          {e.locked && <Lock size={12} style={{ color: "var(--ink-3)", marginTop: 4 }} />}
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
        <div className="grow">
          <div className="row gap-2" style={{ marginBottom: 5, flexWrap: "wrap" }}>
            <span className="tag tag-accent">
              <Zap size={11} /> {e.beat}
            </span>
            {prefilled && (
              <span className="tag tag-pink">
                <Layers size={11} /> 模板已填
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{e.hook}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{e.synopsis}</div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ opacity: hover ? 1 : 0, transition: "opacity .15s", flex: "none" }}
          onClick={onRewrite}
        >
          <Edit size={14} /> 重写梗概
        </button>
      </div>
    </div>
  );
}
