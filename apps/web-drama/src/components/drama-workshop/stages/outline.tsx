"use client";

// 短剧设定 · 故事大纲 + 分集剧情（v0.89 起只作为「短剧设定」单页的一块，独立阶段页已退役）。
// 设计真源:screens-outline-v4.jsx `OutlineStage4 / EpRow4` + AI短剧工作台.dc.html。
//
// v0.197 计价与集数按服务端真实规则算（DramaProjectService#outlineAiDraft）：
//   · AI 最多写到第 12 集（服务端 clamp 1..12，从第 1 集起写），第 13 集起用「加一集」自己写；
//   · 价格按「这次写几集」分两档：≤6 集 = prices.outlineTrial，>6 集 = prices.outlineFull（不是按集数相乘）。
// 之前前端按「单价 × 总集数」算，60 集的剧显示 360 积分，实际只扣 18、只写 12 集；
// 「铺完整 60 集」点完只拿到 12 集，而且把前面已写（包括手改过）的集整体覆盖掉。
// 现在：「补齐」只追加没写过的集号，前面的集原样保留；「全部重写」先确认会替换什么。
//
// v0.197 评审 WB1：首次生成低于免确认阈值（默认 6 < 10），CreditButton 等配置回来期间可以再点一次，
// 两次回调都会走到 outlineAiDraft，服务端每次独立冻结 / 结算 → 扣两份。现在点击当下（捕获阶段，早于
// CreditButton 等配置 / 弹确认）领一张「生成票」，发请求前核票 + 占在途锁（useOutlineRunGate）：
// 同一时刻只有一个请求，一轮点击最多换来一次请求；配置慢回来的第二个回调既拿不到票也过不了锁。
//
// 复核（remount）：上面那道闸挂在组件实例上。生成中切去逐集制作再切回来，OutlineStage 是新实例、闸是空的，
// 分集剧情还没落库所以又是空态，按钮能再点一次 → 第二次 outlineAiDraft，服务端每次新冻结一笔 → 扣两份。
// 现在两道锁都放进模块级的 action-lock（组件卸载不释放，请求结束才释放）：
//   · 三个生成按钮共用 CreditButton 的 lockKey = outlineLockKey(projectId)，重挂后的新按钮读到「在途」、点了不算；
//   · 请求闸 useOutlineRunGate(projectId) 占 `outline-request:<projectId>`，新实例 arm 时看得到旧请求还在跑；
//   · 重挂后只要请求还在途就显示「正在写」，不把空态和能点的按钮摆出来。
//
// 所有保存都走 ctx.patchData（按保存那一刻的最新文档合并），不再用渲染时的 data 快照整份保存：
// 生成要等十几秒，期间写回的角色 / 场景图会被旧快照盖掉（WB2 同类问题）。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Clapperboard,
  GripVertical,
  Layers,
  Link as LinkIcon,
  List,
  Plus,
  Sparkles,
} from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { CreditButton, Editable, GenSkeleton } from "@/components/drama-ui";
import { acquireActionLock, isActionLocked, useActionLock } from "@/components/drama-ui/action-lock";
import type { WorkshopAction, WorkshopState } from "../workbench";
import { episodeContent, episodeTitle, type EpisodeOutline, type ProjectData } from "@/mocks/drama-workshop";
import { ProjectsApi } from "@/api";
import { useDramaConfig } from "@/lib/use-drama-config";
import type { StageContext } from "./stage-context";

/** 「先写开头」写几集。 */
const TRIAL_EPS = 6;
/** AI 最多写到第几集（DramaProjectService#outlineAiDraft clamp 1..12，从第 1 集起写）。 */
const MAX_BATCH = 12;
const DUR_OPTS = ["60 秒/集", "75 秒/集", "90 秒/集"];
const STEP_BTN: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 6, padding: 0,
  border: "1px solid var(--line)", background: "var(--surface)",
  display: "grid", placeItems: "center", cursor: "pointer",
  fontSize: 13, fontWeight: 800, color: "var(--ink)", lineHeight: 1, flex: "none",
};

/**
 * 这一集的剧情正文（界面显示和手改的起点）。
 * 多集模板「做同款」建出来的短剧，服务端 seed（DramaRecipeService#seedProjectFromRecipe，mock 的 applyRecipe 同形）
 * 把模板的 beat 同时写进 synopsis 和 beat，旧三段一拼就是「钩子。X。X」。两段一样时只留一份。
 * 拼接规则本身仍在 episodeContent，这里只是在交给它之前去掉重复的那一段。
 */
export function outlineContent(e: EpisodeOutline): string {
  const beat = (e.beat || "").trim();
  const dupBeat = !!beat && beat === (e.synopsis || "").trim();
  return episodeContent(dupBeat ? { ...e, beat: undefined } : e);
}

/** 三个分集剧情生成按钮共用的 CreditButton lockKey（跨实例互斥，见 action-lock.ts 的 key 约定）。 */
export const outlineLockKey = (projectId: string) => `outline-draft:${projectId}`;
/** 真正发 outlineAiDraft 请求期间占住的锁：「有没有请求在途」只看它。 */
export const outlineRequestKey = (projectId: string) => `outline-request:${projectId}`;

/**
 * 分集剧情生成的在途锁（WB1 + 复核 remount）。
 * - arm：挂在按钮外层的 onClickCapture 上，点击当下执行（早于 CreditButton 拉配置 / 弹确认）。
 *   有请求在途（本实例或上一个实例发的）→ 直接吞掉这次点击；否则领一张票。
 * - enter：真正发请求前调。没票（这轮点击已经换过一次请求）或有请求在途 → 返回 false；否则占锁。
 * - leave：请求结束（成功或失败）后放锁。组件卸载不放 —— 请求还在跑，新挂上的实例要看得到。
 * - running：有没有请求在途（跨实例；重挂后用来显示「正在写」）。
 * 票挂在实例上即可：它只管「一轮点击最多换一次请求」，跨实例的互斥由模块级的请求锁负责。
 * 取消确认框不会发请求，票留着也无害：下一次点击会重新领。
 */
export function useOutlineRunGate(projectId?: string) {
  const requestKey = projectId ? outlineRequestKey(projectId) : null;
  const busyRef = React.useRef(false);
  const ticketRef = React.useRef(false);
  const releaseRef = React.useRef<(() => void) | null>(null);
  const running = useActionLock(requestKey);
  const inFlight = React.useCallback(
    () => busyRef.current || (requestKey ? isActionLocked(requestKey) : false),
    [requestKey],
  );
  const arm = React.useCallback(
    (e: React.SyntheticEvent) => {
      if (inFlight()) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      ticketRef.current = true;
    },
    [inFlight],
  );
  const enter = React.useCallback(() => {
    if (inFlight() || !ticketRef.current) return false;
    if (requestKey) {
      const release = acquireActionLock(requestKey);
      if (!release) return false;
      releaseRef.current = release;
    }
    ticketRef.current = false;
    busyRef.current = true;
    return true;
  }, [inFlight, requestKey]);
  const leave = React.useCallback(() => {
    busyRef.current = false;
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);
  return { arm, enter, leave, running };
}

interface OutlineStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  /** 模板模式:已预填,做"改而非建"的提示 */
  prefilled?: boolean;
  /** v0.64+:项目 id + 保存回调（真实后端落地）。 */
  ctx?: StageContext;
}

export function OutlineStage({ data, prefilled, ctx }: OutlineStageProps) {
  const total = data.projectInfo.episodes;
  // 空项目(还没分集剧情)→ idle 引导生成;已有 → done 直接展示。
  const [phase, setPhase] = React.useState<"idle" | "gen" | "done">(data.episodes.length ? "done" : "idle");
  const [scope, setScope] = React.useState<"trial" | "full">(data.outlinePrefs?.scope ?? "trial");
  const [dur, setDur] = React.useState(data.outlinePrefs?.dur ?? DUR_OPTS[0]);
  const [genCount, setGenCount] = React.useState(0);
  // v0.88：分集剧情的生成参数（写几集 / 每集时长）落库（草稿态可回溯）。
  const savePrefs = (patch: { scope?: "trial" | "full"; dur?: string }, extra?: Partial<ProjectData["projectInfo"]>) => {
    if (!ctx) return;
    ctx.notifyEditing?.();
    void ctx
      .patchData((prev) => ({
        ...prev,
        outlinePrefs: { scope, dur, ...patch },
        ...(extra ? { projectInfo: { ...prev.projectInfo, ...extra } } : {}),
      }))
      .catch(() => {});
  };
  const pickScope = (k: "trial" | "full") => { setScope(k); savePrefs({ scope: k }); };
  // 每集时长同时写进 projectInfo.duration，顶栏「每集 N 秒」跟着变（之前只存在 outlinePrefs，两处对不上）。
  const pickDur = (d: string) => {
    setDur(d);
    const sec = parseInt(d, 10);
    savePrefs({ dur: d }, Number.isFinite(sec) ? { duration: `每集 ${sec} 秒` } : undefined);
  };
  // v0.97：总集数可调（选「一次写完」时露出步进器），落库到 projectInfo.episodes。
  const pickTotal = (n: number) => {
    const next = Math.max(1, Math.min(99, n));
    if (!ctx || next === total) return;
    ctx.notifyEditing?.();
    void ctx.patchData((prev) => ({ ...prev, projectInfo: { ...prev.projectInfo, episodes: next } })).catch(() => {});
  };
  const [eps, setEps] = React.useState<EpisodeOutline[]>(data.episodes);
  React.useEffect(() => {
    setEps(data.episodes);
    // 外部写入分集后，从空态切到列表态（不打断生成中）。
    setPhase((p) => (p === "idle" && data.episodes.length ? "done" : p));
  }, [data.episodes]);
  const cfg = useDramaConfig();

  // ── 集数与计价（与服务端同一套规则，见文件头注释） ──
  const trialCount = Math.max(1, Math.min(TRIAL_EPS, total));
  const fullCount = Math.max(1, Math.min(total, MAX_BATCH));
  const oneOption = total <= TRIAL_EPS; // 总共就几集时不用选「先写几集」
  const countOf = (k: "trial" | "full") => (oneOption ? total : k === "trial" ? trialCount : fullCount);
  const priceOf = (count: number) => (count <= TRIAL_EPS ? cfg.prices.outlineTrial : cfg.prices.outlineFull);
  const curCount = countOf(scope);
  const remaining = Math.max(0, total - eps.length);
  const canAiFill = eps.length < fullCount; // AI 还能往后补（AI 最多写到第 12 集）
  const hasEpisodeWork = Object.keys(data.episodeDocs ?? {}).length > 0;

  /**
   * 真实生成：调后端大模型 → 合并进整套文档 → 落库。
   * mode=replace 整体换掉现有分集；mode=append 只追加还没有的集号，已写（含手改）的集不动。
   */
  const gate = useOutlineRunGate(ctx?.projectId);
  const lockKey = ctx ? outlineLockKey(ctx.projectId) : undefined;
  // 生成中切走再切回来：这是新实例，phase 从 idle / done 起步，但上一个实例的请求还在跑 → 照样显示「正在写」。
  // 请求结束后，结果经 ctx.patchData 写进文档，上面的 data.episodes 副作用把 idle 切到 done。
  const view = gate.running ? "gen" : phase;
  const runOutline = async (count: number, mode: "replace" | "append") => {
    if (!ctx || !gate.enter()) return;
    setGenCount(mode === "append" ? count - eps.length : count);
    setPhase("gen");
    try {
      const drafted = await ProjectsApi.outlineAiDraft(ctx.projectId, count);
      // 在保存那一刻的最新文档上合并（append 以最新的分集为底，只追加还没有的集号）。
      const merge = (base: EpisodeOutline[]) => {
        if (mode !== "append") return { next: drafted, added: drafted.length };
        const have = new Set(base.map((e) => e.no));
        const fresh = drafted.filter((e) => !have.has(e.no)).sort((a, b) => a.no - b.no);
        return { next: [...base, ...fresh], added: fresh.length };
      };
      let result = merge(eps);
      await ctx.patchData((prev) => {
        result = merge(prev.episodes);
        return { ...prev, episodes: result.next };
      }, { stage: 2 });
      const { next, added } = result;
      setEps(next);
      setPhase("done");
      if (mode === "append") {
        if (added > 0) toast.success(`补上了 ${added} 集，前面的集没动`);
        else toast.info("这次没有写出新的集，请再试一次");
      } else {
        toast.success(`分集剧情写好了，共 ${next.length} 集，点文字就能改`);
      }
    } catch (e) {
      setPhase(eps.length ? "done" : "idle");
      toast.error(aiErrorMessage(e, "分集剧情没写出来，请稍后重试"));
    } finally {
      gate.leave();
    }
    // 余额刷新由 CreditButton 在这个 Promise 结束后统一触发（notifyWalletChanged）。
  };

  // v0.76：分集的手改 / 调序 / 加集都即时落库。
  const saveEps = React.useCallback(
    (nextEps: EpisodeOutline[]) => {
      setEps(nextEps);
      if (!ctx) return;
      ctx.notifyEditing?.();
      void ctx.patchData((prev) => ({ ...prev, episodes: nextEps }), { stage: 2 }).catch(() => {});
    },
    [ctx],
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
  const moveEp = (no: number, dir: -1 | 1) => {
    const i = eps.findIndex((x) => x.no === no);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= eps.length) return;
    reorderEp(no, eps[j].no);
  };

  const addEp = () => {
    const maxNo = eps.reduce((a, e) => Math.max(a, e.no), 0);
    saveEps([...eps, { no: maxNo + 1, hook: "", synopsis: "", beat: "自定义" }]);
  };

  const editEp = (no: number, patch: Partial<EpisodeOutline>) =>
    saveEps(eps.map((e) => (e.no === no ? { ...e, ...patch } : e)));

  // 一句话剧情：之前在这里只读，为空时让人「去脑暴 / 套模板」—— 那两条路都会新建一部剧，补不到这一部上。
  const editLogline = (v: string) => {
    if (!ctx || v === (data.projectInfo.logline ?? "")) return;
    ctx.notifyEditing?.();
    void ctx.patchData((prev) => ({ ...prev, projectInfo: { ...prev.projectInfo, logline: v } })).catch(() => {});
  };

  const outlineGenerated = !!(data.projectInfo.logline || data.projectInfo.mainline);
  const mainlineSteps = data.projectInfo.mainline ? data.projectInfo.mainline.split(" → ").filter(Boolean) : [];

  const genControls = (
    <div className="row wb-outline-controls" style={{ gap: 20, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end" }}>
      {!oneOption && (
        <div className="col gap-2" style={{ alignItems: "flex-start", minWidth: 0 }}>
          <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>先写几集</span>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {(["trial", "full"] as const).map((k) => {
              const on = scope === k;
              const showStepper = on && k === "full"; // 选「一次写完」时露出总集数步进器
              const n = countOf(k);
              const name = k === "trial" ? `先写前 ${n} 集` : total > MAX_BATCH ? `一次写 ${n} 集` : "一次写完";
              const cardStyle: React.CSSProperties = {
                padding: "7px 13px",
                borderRadius: 11,
                textAlign: "left",
                gap: 2,
                border: on ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                background: on ? "var(--accent-soft)" : "var(--surface)",
                whiteSpace: "nowrap",
                cursor: showStepper ? "default" : "pointer",
                minWidth: 0,
              };
              const inner = (
                <>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: on ? "var(--accent)" : "var(--ink)" }}>{name}</span>
                  {showStepper ? (
                    <div className="row" style={{ alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <span className="faint" style={{ fontSize: 11 }}>全剧共</span>
                      <button type="button" aria-label="减少集数" onClick={() => pickTotal(total - 1)} style={STEP_BTN}>−</button>
                      <span className="num" style={{ fontSize: 12.5, fontWeight: 800, minWidth: 20, textAlign: "center", color: "var(--accent)" }}>{total}</span>
                      <button type="button" aria-label="增加集数" onClick={() => pickTotal(total + 1)} style={STEP_BTN}>+</button>
                      <span className="faint" style={{ fontSize: 11 }}>集 · {priceOf(n)} 积分</span>
                    </div>
                  ) : (
                    <span className="faint num" style={{ fontSize: 11 }}>{priceOf(n)} 积分</span>
                  )}
                </>
              );
              return showStepper ? (
                <div key={k} className="col wb-outline-scope" style={cardStyle}>{inner}</div>
              ) : (
                <button key={k} type="button" onClick={() => pickScope(k)} className="col wb-outline-scope" style={cardStyle}>{inner}</button>
              );
            })}
          </div>
        </div>
      )}
      <div className="col gap-2" style={{ alignItems: "flex-start", minWidth: 0 }}>
        <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>每集时长</span>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
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
      {/* ===== 故事大纲（一句话剧情 + 主线） ===== */}
      <div className="row gap-2" style={{ alignItems: "center", margin: "20px 0 12px", flexWrap: "wrap" }}>
        <span className="icon-badge" style={{ width: 27, height: 27, borderRadius: 8 }}>
          <LinkIcon size={15} />
        </span>
        <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>故事大纲</span>
        {prefilled && (
          <span className="tag tag-pink" style={{ flex: "none" }}>
            <Layers size={11} /> 来自模板，可以直接改
          </span>
        )}
        <span className="grow" />
        <span className={outlineGenerated ? "tag tag-green" : "tag tag-amber"} style={{ flex: "none" }}>
          {outlineGenerated ? (
            <>
              <Check size={11} /> 已写好
            </>
          ) : (
            "还没写"
          )}
        </span>
      </div>
      <div className="card" style={{ padding: 18, marginBottom: 6 }}>
        <div className="faint" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>一句话剧情</div>
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.65, color: "var(--ink)" }}>
          {ctx ? (
            <Editable
              block
              value={data.projectInfo.logline ?? ""}
              placeholder="一句话写清这部剧讲什么，比如：被悔婚的她赌气闪婚，没想到嫁的是隐藏首富。"
              onCommit={editLogline}
              style={{ display: "block" }}
            />
          ) : (
            data.projectInfo.logline || <span className="faint" style={{ fontWeight: 400 }}>还没有一句话剧情</span>
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
              <span style={{ fontWeight: 800, fontSize: 12.5, color: "var(--accent)" }}>主线</span>
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {mainlineSteps.map((s, i) => (
                <React.Fragment key={`${s}-${i}`}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{s}</span>
                  {i < mainlineSteps.length - 1 && <ArrowRight size={13} style={{ color: "var(--ink-3)", flex: "none" }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== 分集剧情（生成控件落在空态里） ===== */}
      <div className="row gap-2" style={{ alignItems: "center", margin: "22px 0 12px", flexWrap: "wrap" }}>
        <span className="icon-badge" style={{ width: 27, height: 27, borderRadius: 8 }}>
          <Clapperboard size={15} />
        </span>
        <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>分集剧情</span>
        <span className={view === "done" && eps.length > 0 ? "tag tag-green" : "tag tag-amber"} style={{ flex: "none" }}>
          {view === "done" && eps.length > 0 ? (
            <>
              <Check size={11} /> {eps.length < total ? `已写 ${eps.length} 集` : "已写完"}
            </>
          ) : (
            "还没写"
          )}
        </span>
        {view === "done" && eps.length > 0 && (
          <EpisodeProgress done={Math.min(eps.length, total || eps.length)} total={total || eps.length} />
        )}
      </div>

      {view === "idle" && (
        <div className="card col center" style={{ padding: "34px 20px", textAlign: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
            <Clapperboard size={26} />
          </div>
          <div className="col gap-1" style={{ alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>还没有分集剧情</div>
            <div className="muted" style={{ maxWidth: 440, fontSize: 13, lineHeight: 1.6 }}>
              AI 按故事大纲，把整部剧拆成一集一集的剧情。{oneOption ? "先选每集多长。" : "先选写几集、每集多长。"}
              {total > MAX_BATCH && ` AI 最多写到第 ${MAX_BATCH} 集，第 ${MAX_BATCH + 1} 集起点「加一集」自己写。`}
            </div>
          </div>
          {genControls}
          {/* display:contents 不参与布局，只为在捕获阶段领生成票（WB1） */}
          <span style={{ display: "contents" }} onClickCapture={gate.arm} data-testid="outline-gen-first">
            <CreditButton
              cost={priceOf(curCount)}
              onConfirm={() => runOutline(curCount, "replace")}
              lockKey={lockKey}
              confirmTitle={`写 ${curCount} 集分集剧情`}
              confirmBody="AI 按故事大纲写每一集的开头钩子、主体和结尾悬念，写完点文字就能改。"
              confirmLabel="开始写"
              className="btn btn-grad"
              style={{ height: 44, padding: "0 24px", fontSize: 14.5, marginTop: 4 }}
              disabled={!ctx}
            >
              <Sparkles size={16} /> AI 写 {curCount} 集分集剧情 · {priceOf(curCount)} 积分
            </CreditButton>
          </span>
        </div>
      )}

      {view === "gen" && (
        <div className="card" style={{ padding: 18 }}>
          <GenSkeleton lines={4} label={genCount > 0 ? `正在按故事大纲写 ${genCount} 集的剧情…` : "正在按故事大纲写分集剧情…"} />
        </div>
      )}

      {view === "done" && (
        <div className="col gap-3">
          {eps.map((e, i) => (
            <EpisodeRow
              key={e.no}
              e={e}
              delay={i * 45}
              prefilled={prefilled}
              editable={!!ctx}
              first={i === 0}
              last={i === eps.length - 1}
              onReorder={reorderEp}
              onMove={moveEp}
              onEdit={editEp}
            />
          ))}
          {remaining > 0 && (
            <div id="wb-fill-rest" className="card row gap-3" style={{ padding: 16, border: "1.5px dashed var(--line)", background: "var(--surface-2)", flexWrap: "wrap" }}>
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
              {canAiFill ? (
                <>
                  <div className="grow" style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                      {fullCount >= total
                        ? `开头满意？剩下 ${remaining} 集也让 AI 写完`
                        : `开头满意？让 AI 接着写到第 ${fullCount} 集`}
                    </div>
                    <div className="faint" style={{ fontSize: 12 }}>
                      前 {eps.length} 集不动，AI 按故事大纲写第 {eps.length + 1}–{fullCount} 集
                      {fullCount < total ? `；AI 最多写到第 ${MAX_BATCH} 集，第 ${MAX_BATCH + 1} 集起点「加一集」自己写` : ""}
                    </div>
                  </div>
                  <span style={{ display: "contents" }} onClickCapture={gate.arm} data-testid="outline-gen-append">
                    <CreditButton
                      cost={priceOf(fullCount)}
                      alwaysConfirm
                      onConfirm={() => runOutline(fullCount, "append")}
                      lockKey={lockKey}
                      confirmTitle="补齐剩下的分集剧情？"
                      confirmBody={`前 ${eps.length} 集保持不动（包括你改过的），AI 按故事大纲写第 ${eps.length + 1}–${fullCount} 集，写好接在后面。`}
                      confirmLabel="开始写"
                      className="btn btn-primary btn-sm"
                      style={{ flex: "none" }}
                    >
                      补齐到第 {fullCount} 集 · {priceOf(fullCount)} 积分
                    </CreditButton>
                  </span>
                </>
              ) : (
                <div className="grow" style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>还有 {remaining} 集没写剧情</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    AI 最多写到第 {MAX_BATCH} 集，第 {MAX_BATCH + 1} 集起点「加一集」自己写。
                  </div>
                </div>
              )}
            </div>
          )}
          {ctx && (
            <div className="row gap-2" style={{ justifyContent: "flex-end", marginTop: 2, flexWrap: "wrap" }}>
              <span style={{ display: "contents" }} onClickCapture={gate.arm} data-testid="outline-gen-rewrite">
                <CreditButton
                  cost={priceOf(curCount)}
                  alwaysConfirm
                  onConfirm={() => runOutline(curCount, "replace")}
                  lockKey={lockKey}
                  confirmTitle="全部重写分集剧情？"
                  confirmBody={`AI 按故事大纲重新写前 ${curCount} 集。现在的 ${eps.length} 集分集剧情会被替换，包括你改过的${
                    hasEpisodeWork ? "；已经做好的分镜和视频不会删，但可能和新剧情对不上" : ""
                  }。已花的积分不退。`}
                  confirmLabel="全部重写"
                  className="btn btn-ghost btn-sm"
                >
                  <Sparkles size={14} /> 全部重写 · {priceOf(curCount)} 积分
                </CreditButton>
              </span>
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

function EpisodeRow({
  e,
  delay,
  prefilled,
  editable,
  first,
  last,
  onReorder,
  onMove,
  onEdit,
}: {
  e: EpisodeOutline;
  delay: number;
  prefilled?: boolean;
  editable?: boolean;
  first?: boolean;
  last?: boolean;
  onReorder?: (fromNo: number, toNo: number) => void;
  onMove?: (no: number, dir: -1 | 1) => void;
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
        <div className="col" style={{ flex: "none", textAlign: "center", alignItems: "center" }}>
          <span
            draggable
            className="wb-ep-grip"
            title="拖动调整顺序"
            onDragStart={(ev) => {
              ev.dataTransfer.setData("text/plain", String(e.no));
              ev.dataTransfer.effectAllowed = "move";
            }}
            style={{ cursor: "grab", color: "var(--ink-3)", display: "block", marginBottom: 2 }}
          >
            <GripVertical size={14} />
          </span>
          <div className="num wb-ep-no" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: "var(--accent)" }}>
            {String(e.no).padStart(2, "0")}
          </div>
          {/* 触屏拖不动：窄屏给上移 / 下移（样式里 ≤720 才显示） */}
          {editable && (
            <div className="col wb-ep-move" style={{ gap: 4, marginTop: 6 }}>
              <button type="button" className="btn btn-icon btn-ghost btn-sm" aria-label="上移一集" title="上移" disabled={first} onClick={() => onMove?.(e.no, -1)}>
                <ArrowUp size={13} />
              </button>
              <button type="button" className="btn btn-icon btn-ghost btn-sm" aria-label="下移一集" title="下移" disabled={last} onClick={() => onMove?.(e.no, 1)}>
                <ArrowDown size={13} />
              </button>
            </div>
          )}
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)", flex: "none" }} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {editable ? (
              <Editable value={e.title ?? ""} placeholder="给这一集起个标题" onCommit={(v) => onEdit?.(e.no, { title: v })} />
            ) : (
              episodeTitle(e)
            )}
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {editable ? (
              <Editable
                block
                value={outlineContent(e)}
                placeholder="这一集讲什么：开头怎么抓人，中间发生什么，结尾留什么悬念"
                onCommit={(v) => onEdit?.(e.no, { content: v })}
                style={{ display: "block" }}
              />
            ) : (
              outlineContent(e)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 分集进度胶囊：X/Y 集 + 进度环。 */
function EpisodeProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const remaining = Math.max(0, total - done);
  return (
    <div
      className="row"
      style={{
        alignItems: "center",
        gap: 8,
        flex: "none",
        padding: "3px 10px 3px 8px",
        borderRadius: 999,
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
      }}
      title={`已写 ${done} / ${total} 集`}
    >
      <div style={{ position: "relative", width: 34, height: 34, flex: "none" }}>
        <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="17" cy="17" r="13" fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle
            cx="17"
            cy="17"
            r="13"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 2 * Math.PI * 13} ${2 * Math.PI * 13}`}
            style={{ transition: "stroke-dasharray .6s cubic-bezier(.22,1,.36,1)" }}
          />
        </svg>
        <span
          className="num"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontSize: 9,
            fontWeight: 800,
            color: "var(--accent)",
            letterSpacing: "-.02em",
          }}
        >
          {pct}%
        </span>
      </div>
      <div className="col" style={{ gap: 1, lineHeight: 1.1 }}>
        <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)" }}>
          {done}<span className="faint" style={{ fontWeight: 500 }}> / {total} 集</span>
        </span>
        <span className="faint" style={{ fontSize: 10 }}>
          {remaining > 0 ? `还差 ${remaining} 集` : "全部写完"}
        </span>
      </div>
    </div>
  );
}
