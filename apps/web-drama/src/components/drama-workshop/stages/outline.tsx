"use client";

// 阶段 2 大纲分集 v4 — 操作条置顶:AI 参数(设计范围/每集时长)+ 高亮生成按钮。
// 试水模式只铺前 6 集,满意再补铺完整;分集卡可拖拽调序 / 重写。
// 设计真源:screens-outline-v4.jsx `OutlineStage4 / EpRow4`。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Clapperboard,
  GripVertical,
  Layers,
  Link as LinkIcon,
  List,
  Lock,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { Editable, Field, GenSkeleton } from "@/components/drama-ui";
import { StageHeader } from "../workbench";
import type { WorkshopAction, WorkshopState } from "../workbench";
import { episodeContent, episodeTitle, type EpisodeOutline, type ProjectData } from "@/mocks/drama-workshop";
import { ProjectsApi } from "@/api";
import { useDramaConfig } from "@/lib/use-drama-config";
import type { StageContext } from "./stage-context";

const SCOPE_OPTS = [
  { key: "trial", name: "试做开头", eps: 6 as number | null, cost: 6 },
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
  /** v0.87：内嵌进「短剧设定」单页时去掉自己的滚动壳/标题/终态按钮（由 SetupStage 统一提供）。 */
  embedded?: boolean;
}

export function OutlineStage({ state, dispatch, data, prefilled, ctx, embedded }: OutlineStageProps) {
  const total = data.projectInfo.episodes;
  // 空项目(还没大纲)→ idle 引导生成;已有大纲 → done 直接展示。
  const [phase, setPhase] = React.useState<"idle" | "gen" | "done">(data.episodes.length ? "done" : "idle");
  const [scope, setScope] = React.useState<"trial" | "full">(data.outlinePrefs?.scope ?? "trial");
  const [dur, setDur] = React.useState(data.outlinePrefs?.dur ?? DUR_OPTS[1]);
  // v0.88：大纲 AI 参数（范围/时长）落库（草稿态可回溯）。
  const savePrefs = (patch: { scope?: "trial" | "full"; dur?: string }) => {
    if (!ctx) return;
    ctx.notifyEditing?.();
    void ctx.saveData({ ...data, outlinePrefs: { scope, dur, ...patch } }).catch(() => {});
  };
  const pickScope = (k: "trial" | "full") => { setScope(k); savePrefs({ scope: k }); };
  const pickDur = (d: string) => { setDur(d); savePrefs({ dur: d }); };
  const [eps, setEps] = React.useState<EpisodeOutline[]>(data.episodes);
  React.useEffect(() => {
    setEps(data.episodes);
    // 外部（如「短剧设定」浮动条「加一集」）写入分集后，从空态切到列表态（不打断生成中）。
    setPhase((p) => (p === "idle" && data.episodes.length ? "done" : p));
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
      toast.success("大纲已生成 · 可编辑、可重新生成");
    } catch (e) {
      setPhase(data.episodes.length ? "done" : "idle");
      toast.error(aiErrorMessage(e, "大纲生成失败，请稍后重试"));
    }
  };

  // v0.76：大纲的手改 / 调序 / 加集都即时落库（此前只在「AI 生成」「锁定」时存，刷新即丢）。
  const saveEps = React.useCallback(
    (nextEps: EpisodeOutline[]) => {
      setEps(nextEps);
      if (!ctx) return;
      ctx.notifyEditing?.();
      void ctx.saveData({ ...data, episodes: nextEps }, { stage: 2 }).catch(() => {});
    },
    [ctx, data],
  );

  const reorderEp = (fromNo: number, toNo: number) => {
    const f = eps.findIndex((x) => x.no === fromNo);
    const tIdx = eps.findIndex((x) => x.no === toNo);
    if (f < 0 || tIdx < 0 || f === tIdx) return;
    const next = [...eps];
    const [m] = next.splice(f, 1);
    next.splice(tIdx, 0, m);
    saveEps(next);
  };

  const addEp = () => {
    const maxNo = eps.reduce((a, e) => Math.max(a, e.no), 0);
    saveEps([...eps, { no: maxNo + 1, hook: "", synopsis: "", beat: "自定义" }]);
  };

  const editEp = (no: number, patch: Partial<EpisodeOutline>) =>
    saveEps(eps.map((e) => (e.no === no ? { ...e, ...patch } : e)));

  const gen = () => runOutline(scope, scopeCost(scope));
  const fillRest = () => runOutline("full", fillRestCost);

  // ── v0.89：内嵌「短剧设定」时按设计稿拆成两块：剧情大纲（主线+脉络）/ 分集剧情（生成控件落在空态里）。
  if (embedded) {
    const outlineGenerated = !!(data.projectInfo.logline || data.projectInfo.mainline);
    const mainlineSteps = data.projectInfo.mainline ? data.projectInfo.mainline.split(" → ") : [];
    const genControls = (
      <div className="row" style={{ gap: 20, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end" }}>
        <div className="col gap-2" style={{ alignItems: "flex-start" }}>
          <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>范围</span>
          <div className="row gap-2">
            {SCOPE_OPTS.map((o) => {
              const on = scope === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => pickScope(o.key)}
                  className="col"
                  style={{
                    padding: "7px 13px",
                    borderRadius: 11,
                    textAlign: "left",
                    gap: 1,
                    border: on ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                    background: on ? "var(--accent-soft)" : "var(--surface)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: on ? "var(--accent)" : "var(--ink)" }}>{o.name}</span>
                  <span className="faint num" style={{ fontSize: 11 }}>
                    {o.eps ? `前 ${o.eps} 集` : `全部 ${total} 集`} · {scopeCost(o.key)} 积分
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="col gap-2" style={{ alignItems: "flex-start" }}>
          <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>每集时长</span>
          <div className="row gap-2">
            {DUR_OPTS.map((d) => (
              <button key={d} type="button" className={"chip num" + (dur === d ? " on" : "")} onClick={() => pickDur(d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    return (
      <>
        {/* ===== 剧情大纲（总览 + 主线脉络） ===== */}
        <div className="row gap-2" style={{ alignItems: "center", margin: "20px 0 12px" }}>
          <span className="icon-badge" style={{ width: 27, height: 27, borderRadius: 8 }}>
            <LinkIcon size={15} />
          </span>
          <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>剧情大纲</span>
          <span className="tag tag-gray" style={{ flex: "none" }}>总览 · 分集</span>
          {prefilled && (
            <span className="tag tag-pink" style={{ flex: "none" }}>
              <Layers size={11} /> 模板已预填
            </span>
          )}
          <span className="grow" />
          <span className={outlineGenerated ? "tag tag-green" : "tag tag-amber"} style={{ flex: "none" }}>
            {outlineGenerated ? (
              <>
                <Check size={11} /> 已生成
              </>
            ) : (
              "待完善"
            )}
          </span>
        </div>
        <div className="card" style={{ padding: 18, marginBottom: 6 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.65, color: "var(--ink)" }}>
            {data.projectInfo.logline || data.projectInfo.mainline || (
              <span className="faint" style={{ fontWeight: 400 }}>还没有一句话剧情，可先通过脑暴或套用模板补全主线。</span>
            )}
          </div>
          {mainlineSteps.length > 0 && (
            <div
              style={{
                marginTop: 14,
                borderLeft: "3px solid var(--accent)",
                background: "var(--accent-soft)",
                borderRadius: "0 12px 12px 0",
                padding: "11px 14px",
              }}
            >
              <div className="row gap-2" style={{ marginBottom: 9, alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 12.5, color: "var(--accent)" }}>剧情脉络</span>
                <span className="tag tag-gray" style={{ height: 18, fontSize: 10, padding: "0 7px" }}>AI 分析</span>
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {mainlineSteps.map((s, i) => (
                  <React.Fragment key={`${s}-${i}`}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{s}</span>
                    {i < mainlineSteps.length - 1 && <ArrowRight size={13} style={{ color: "var(--ink-3)" }} />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== 分集剧情（生成控件落在空态里） ===== */}
        <div className="row gap-2" style={{ alignItems: "center", margin: "22px 0 12px" }}>
          <span className="icon-badge" style={{ width: 27, height: 27, borderRadius: 8 }}>
            <Clapperboard size={15} />
          </span>
          <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>分集剧情</span>
          <span className={phase === "done" ? "tag tag-green" : "tag tag-amber"} style={{ flex: "none" }}>
            {phase === "done" ? (
              <>
                <Check size={11} /> 已生成
              </>
            ) : (
              "待生成"
            )}
          </span>
          {locked && (
            <span className="tag tag-gray" style={{ flex: "none" }}>
              <Lock size={11} /> 已锁定
            </span>
          )}
        </div>

        {phase === "idle" && (
          <div className="card col center" style={{ padding: "34px 24px", textAlign: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
              <Clapperboard size={26} />
            </div>
            <div className="col gap-1" style={{ alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>还没有分集剧情</div>
              <div className="muted" style={{ maxWidth: 430, fontSize: 13, lineHeight: 1.6 }}>
                AI 将沿用上方「剧情脉络」，把整部剧拆解为各集的钩子与梗概。请先选择范围与每集时长。
              </div>
            </div>
            {genControls}
            <button
              type="button"
              className="btn btn-grad"
              style={{ height: 44, padding: "0 24px", fontSize: 14.5, marginTop: 4 }}
              onClick={gen}
            >
              <Sparkles size={16} /> AI 生成分集剧情 · {scopeCost(scope)} 积分
            </button>
          </div>
        )}

        {phase === "gen" && (
          <div className="card" style={{ padding: 18 }}>
            <GenSkeleton lines={4} label={`正在按主线生成${scope === "trial" ? "前 6 集" : `全部 ${total} 集`}的钩子…`} />
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
                editable={!locked}
                onReorder={reorderEp}
                onEdit={editEp}
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
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>开头满意?把剩下 {total - 6} 集一并补齐</div>
                  <div className="faint" style={{ fontSize: 12 }}>AI 将延续这 6 集的节奏与人物关系续写，风格保持连贯</div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" style={{ flex: "none" }} onClick={fillRest}>
                  铺完整 {total} 集 · 补 {fillRestCost} 积分
                </button>
              </div>
            )}
            {!locked && (
              <div className="row gap-2" style={{ justifyContent: "flex-end", marginTop: 2, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={gen}>
                  <Sparkles size={14} /> 重新生成
                </button>
                <button type="button" className="btn btn-line btn-sm" onClick={addEp}>
                  <Plus size={14} /> 加一集
                </button>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  const inner = (
    <>
        {!embedded && (
        <StageHeader
          no={2}
          scope="项目"
          title="大纲分集"
          desc="先设置参数，让 AI 一次生成每集的钩子与梗概，确认后再锁定。"
          right={
            prefilled && (
              <span className="tag tag-pink">
                <Layers size={12} /> 模板已预填，可直接修改
              </span>
            )
          }
        />
        )}
        {embedded && (
          <div className="row gap-2" style={{ alignItems: "center", margin: "20px 0 14px" }}>
            <span className="icon-badge" style={{ width: 27, height: 27, borderRadius: 8 }}>
              <List size={15} />
            </span>
            <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>剧情大纲</span>
            <span className="tag tag-gray" style={{ flex: "none" }}>总览 · 分集</span>
            {prefilled && (
              <span className="tag tag-pink" style={{ flex: "none" }}>
                <Layers size={11} /> 模板已预填
              </span>
            )}
          </div>
        )}

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
                  设置参数后点击右侧，一次生成每集钩子
                </span>
              </div>
              {phase === "done" && (
                <span className="tag tag-green">
                  <Check size={11} /> 已生成 · 可编辑、可重新生成
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
                        onClick={() => pickScope(o.key)}
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
                    <button key={d} type="button" className={"chip num" + (dur === d ? " on" : "")} onClick={() => pickDur(d)}>
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
              大纲已锁定，左侧分集导航与剧集脚本均以此为准。
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
              <b style={{ color: "var(--accent)" }}>AI 生成大纲</b>,试做开头仅需 6 积分。
            </div>
          </div>
        )}
        {phase === "gen" && (
          <div className="card" style={{ padding: 18 }}>
            <GenSkeleton lines={4} label={`正在按主线生成${scope === "trial" ? "前 6 集" : `全部 ${total} 集`}的钩子…`} />
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
                editable={!locked}
                onReorder={reorderEp}
                onEdit={editEp}
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
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>开头满意?把剩下 {total - 6} 集一并补齐</div>
                  <div className="faint" style={{ fontSize: 12 }}>AI 将延续这 6 集的节奏与人物关系续写，风格保持连贯</div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" style={{ flex: "none" }} onClick={fillRest}>
                  铺完整 {total} 集 · 补 {fillRestCost} 积分
                </button>
              </div>
            )}
            {!locked && (
              <div className="row gap-3" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                <button type="button" className="btn btn-line" onClick={addEp}>
                  <Plus size={15} /> 加一集
                </button>
                {!embedded && (
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
                  <Check size={16} /> 锁定大纲 · 设定角色
                </button>
                )}
              </div>
            )}
          </div>
        )}
    </>
  );
  // embedded 分支已在上方提前返回；此处只服务独立「大纲分集」阶段页。
  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 32px 64px" }}>
        {inner}
      </div>
    </div>
  );
}

function EpisodeRow({
  e,
  delay,
  prefilled,
  editable,
  onReorder,
  onEdit,
}: {
  e: EpisodeOutline;
  delay: number;
  prefilled?: boolean;
  editable?: boolean;
  onReorder?: (fromNo: number, toNo: number) => void;
  onEdit?: (no: number, patch: Partial<EpisodeOutline>) => void;
}) {
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
          {prefilled && (
            <div className="row gap-2" style={{ marginBottom: 5, flexWrap: "wrap" }}>
              <span className="tag tag-pink">
                <Layers size={11} /> 模板已填
              </span>
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {editable ? (
              <Editable value={e.title ?? ""} placeholder="集标题…" onCommit={(v) => onEdit?.(e.no, { title: v })} />
            ) : (
              episodeTitle(e)
            )}
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {editable ? (
              <Editable
                block
                value={episodeContent(e)}
                placeholder="本集剧情（开场钩子→主体→结尾悬念，一段连贯）…"
                onCommit={(v) => onEdit?.(e.no, { content: v })}
                style={{ display: "block" }}
              />
            ) : (
              episodeContent(e)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
