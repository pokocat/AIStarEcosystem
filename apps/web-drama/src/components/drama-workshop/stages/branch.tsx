"use client";

// 互动编排阶段（v0.79）—— 短剧工坊「互动剧」形态的分支编排中枢。
// 数据驱动：剧集（图节点）= 项目大纲分集；每集视频 = 该集走完六阶段的成片（episodeDocs[no].assembled）；
// 本阶段只改「分支叠加层」（互动点 / 接线 / 全局标记 / 起始集 / 结局），经 story 适配器读写 ProjectData。
// 点节点「去制作这一集」= 跳进剧集脚本阶段（state.ep=该集），复用单集 AI 出脚本 / 分镜 / 出片 / 成片全流程。
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Network,
  List,
  Play,
  Download,
  Plus,
  Sparkles,
  CircleAlert,
  TriangleAlert,
  Check,
  Flag,
  Star,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { WorkshopAction, WorkshopState } from "../workbench";
import type { StageContext } from "./stage-context";
import type { ProjectData } from "@/mocks/drama-workshop";
import type { InteractiveEpisode, InteractiveStoryData } from "@/lib/interactive-types";
import {
  projectToStory,
  writeStoryToProject,
  validateStory,
  epIdForNo,
  noFromEpId,
  epDisplayTitle,
  flagUsages,
  type Issue,
} from "@/lib/interactive-graph";
import { BranchCanvas } from "@/components/interactive/branch-canvas";
import { EpisodeEditor } from "@/components/interactive/episode-editor";
import { FlagsPanel } from "@/components/interactive/flags-panel";
import { PlaythroughDialog } from "@/components/interactive/playthrough-dialog";
import { ExportDialog } from "@/components/interactive/export-dialog";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { CreditMark } from "@/components/drama-ui";
import { ProjectsApi } from "@/api";
import { aiErrorMessage } from "@/lib/ai-error";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { useDramaConfig } from "@/lib/use-drama-config";

interface Props {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  ctx: StageContext;
}

export function BranchStage({ dispatch, data, ctx }: Props) {
  const router = useRouter();
  // story 视图：进本阶段时由 ProjectData 合成一次（含最新成片），此后本组件持有为编辑真源。
  const [story, setStory] = React.useState<InteractiveStoryData>(() => projectToStory(data));
  const [view, setView] = React.useState<"graph" | "list">("graph");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => projectToStory(data).startEpisodeId || null,
  );
  const [connectFrom, setConnectFrom] = React.useState<string | null>(null);
  const [rightTab, setRightTab] = React.useState<"episode" | "flags" | "validate">("episode");
  const [showPlay, setShowPlay] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const draftingRef = React.useRef(false); // 同步在途锁：确认框点完到按钮置灰之间再点一次也不会发两次
  // AI 起草单价（服务端 KEY_INTERACTIVE_DRAFT，经 /me/drama/config 下发）。读不到就不让点：扣多少说不清的按钮不能放出去。
  const cfg = useDramaConfig();
  const draftCost = cfg.prices.interactiveDraft;
  const draftPriceKnown = typeof draftCost === "number" && Number.isFinite(draftCost) && draftCost >= 0;
  // ≤860 检查器改成底部抽屉：选中一集 / 点问题数 / 点「剧情状态」时才弹出（桌面上 CSS 常显，这个值不起作用）。
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // 手机上分支图横向太宽，默认先看列表（与 CSS 同一个断点 720）。
  React.useEffect(() => {
    if (window.matchMedia("(max-width: 720px)").matches) setView("list");
  }, []);
  const openTab = (k: "episode" | "flags" | "validate") => {
    setRightTab(k);
    setSheetOpen(true);
  };

  const validation = React.useMemo(() => validateStory(story), [story]);
  const byId = React.useMemo(() => new Map(story.episodes.map((e) => [e.episodeId, e])), [story.episodes]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // 防抖保存：本阶段改动经 story 适配器写回 ProjectData（保留 episodeDocs 成片），由工作台统一落库。
  // v0.197 评审 WB3：之前 queueSave 依赖 ctx，而 ctx 每次渲染都是新对象 → 保存后重渲染又排一次保存，
  // 改一次就一直存。现在 ctx 只存引用、保存函数身份稳定，只有 story 真的变了（用户编辑）才排保存。
  // 落库走 patchData：在保存那一刻的最新文档上叠分支图（不拿本组件上一次渲染的 data）。
  const ctxRef = React.useRef(ctx);
  ctxRef.current = ctx;
  const storyRef = React.useRef(story);
  storyRef.current = story;
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = React.useRef(false);

  const persistNow = React.useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingSave.current = false;
    await ctxRef.current.patchData((prev) => writeStoryToProject(prev, storyRef.current)).catch(() => {});
  }, []);

  const queueSave = React.useCallback(() => {
    ctxRef.current.notifyEditing?.();
    pendingSave.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistNow(), 1000);
  }, [persistNow]);

  // story 真的换了才防抖落库（首挂载、开发模式下 effect 重跑都不算编辑）。
  const lastStory = React.useRef(story);
  React.useEffect(() => {
    if (lastStory.current === story) return;
    lastStory.current = story;
    queueSave();
  }, [story, queueSave]);
  // 离开互动编排（切阶段 / 离开工作台）时，没到时间的那次改动立刻存掉，不丢。
  React.useEffect(
    () => () => {
      if (pendingSave.current) void persistNow();
    },
    [persistNow],
  );

  // ── 图操作（全在 story 上；落库由适配器对账 ProjectData） ─────────────────────────
  const updateEpisode = (epId: string, updated: InteractiveEpisode) =>
    setStory((s) => ({ ...s, episodes: s.episodes.map((e) => (e.episodeId === epId ? updated : e)) }));

  const nextNo = React.useCallback(() => {
    const nos = story.episodes.map((e) => e.no).filter((n) => Number.isFinite(n));
    return (nos.length ? Math.max(...nos) : 0) + 1;
  }, [story.episodes]);

  const addEpisode = () => {
    const no = nextNo();
    const epId = epIdForNo(no);
    const ep: InteractiveEpisode = {
      episodeId: epId,
      no,
      title: `第 ${no} 集`,
      synopsis: "",
      videoUrl: null,
      durationSec: 0,
      videoStatus: "idle",
      interactions: [],
      nextVideoId: null,
      isEnding: false,
    };
    setStory((s) => ({ ...s, episodes: [...s.episodes, ep] }));
    setSelectedId(epId);
    openTab("episode");
  };

  const duplicateEpisode = (epId: string) => {
    const src = byId.get(epId);
    if (!src) return;
    const no = nextNo();
    const newId = epIdForNo(no);
    const clone: InteractiveEpisode = {
      ...structuredClone(src),
      episodeId: newId,
      no,
      title: src.title + " · 副本",
      videoUrl: null,
      durationSec: 0,
      videoStatus: "idle",
      isEnding: false,
      interactions: src.interactions.map((it, i) => ({ ...structuredClone(it), id: `${newId}_i${i + 1}` })),
    };
    setStory((s) => ({ ...s, episodes: [...s.episodes, clone] }));
    setSelectedId(newId);
  };

  const deleteEpisode = async (epId: string) => {
    const ep = byId.get(epId);
    if (!ep) return;
    const ok = await dramaConfirm({
      title: `删除「${epDisplayTitle(ep)}」？`,
      body: "删掉后，连到这一集的线会断开，这一集做好的分镜、视频和成片也会一起删掉。",
      confirmLabel: "删除这一集",
      cancelLabel: "先保留",
      tone: "danger",
    });
    if (!ok) return;
    setStory((s) => {
      const episodes = s.episodes
        .filter((e) => e.episodeId !== epId)
        .map((e) => ({
          ...e,
          nextVideoId: e.nextVideoId === epId ? null : e.nextVideoId,
          interactions: e.interactions.map((it) => ({
            ...it,
            uiConfig: {
              ...it.uiConfig,
              options: it.uiConfig.options?.map((o) => (o.nextVideoId === epId ? { ...o, nextVideoId: null } : o)),
            },
          })),
        }));
      const startEpisodeId = s.startEpisodeId === epId ? episodes[0]?.episodeId ?? "" : s.startEpisodeId;
      return { ...s, episodes, startEpisodeId };
    });
    setSelectedId((cur) => (cur === epId ? null : cur));
  };

  const setStart = (epId: string) => setStory((s) => ({ ...s, startEpisodeId: epId }));
  const setFlags = (flags: InteractiveStoryData["globalFlags"]) => setStory((s) => ({ ...s, globalFlags: flags }));

  // 拉线接分支：已是「选择」互动 → 加选项；已有线性下一集 → 升级为二选互动；否则设为线性下一集；结局禁止外连。
  const connect = (fromId: string, toId: string) => {
    setConnectFrom(null);
    if (fromId === toId) return;
    const from = byId.get(fromId);
    if (!from) return;
    if (from.isEnding) {
      toast.error("结局集不能再连到别的集");
      return;
    }
    setStory((s) => ({
      ...s,
      episodes: s.episodes.map((e) => {
        if (e.episodeId !== fromId) return e;
        const choice = e.interactions.find((it) => it.interactionType === "choice");
        if (choice) {
          const used = new Set((choice.uiConfig.options ?? []).map((o) => o.id));
          let letter = "A";
          for (let i = 0; i < 26; i++) { const c = String.fromCharCode(65 + i); if (!used.has(c)) { letter = c; break; } }
          return {
            ...e,
            interactions: e.interactions.map((it) =>
              it === choice
                ? { ...it, uiConfig: { ...it.uiConfig, options: [...(it.uiConfig.options ?? []), { id: letter, text: "新选项", nextVideoId: toId }] } }
                : it,
            ),
          };
        }
        if (e.nextVideoId) {
          const prev = e.nextVideoId;
          return {
            ...e,
            nextVideoId: null,
            interactions: [
              ...e.interactions,
              {
                id: `${e.episodeId}_i${e.interactions.length + 1}`,
                triggerTime: e.durationSec > 5 ? e.durationSec - 5 : 5,
                interactionType: "choice" as const,
                uiConfig: {
                  question: "你的选择？",
                  countdownSec: 10,
                  options: [
                    { id: "A", text: "选项 A", nextVideoId: prev },
                    { id: "B", text: "选项 B", nextVideoId: toId },
                  ],
                },
              },
            ],
          };
        }
        return { ...e, nextVideoId: toId };
      }),
    }));
    setSelectedId(fromId);
    openTab("episode");
    toast.success("已连上");
  };

  // 去制作这一集：先落库当前编排，再跳进六阶段「剧集脚本」（state.ep = 该集），复用单集全流程出片。
  const goProduce = async (no: number) => {
    if (!Number.isFinite(no)) return;
    await persistNow();
    dispatch({ type: "setEp", ep: no });
    dispatch({ type: "jump", stage: "epscript" });
  };

  // AI 生成整张分支图（覆盖当前大纲 + 编排 + 各集已做的分镜 / 成片）。
  const aiDraft = async () => {
    if (draftingRef.current) return;
    if (!draftPriceKnown) {
      toast.error("没读到这次要花多少积分，刷新页面后再试");
      return;
    }
    const theme = (story.title || data.projectInfo?.title || "").trim();
    const madeEps = Object.keys(data.episodeDocs ?? {}).length;
    const hasContent = story.episodes.length > 0;
    const ok = await dramaConfirm({
      cost: draftCost,
      title: hasContent ? "用 AI 重新生成整张分支图？" : "用 AI 生成分支图？",
      body: hasContent
        ? `AI 按片名「${theme || "这部剧"}」重新写一套剧集和互动点。现在的 ${story.episodes.length} 集、连线和剧情状态都会被替换${
            madeEps > 0 ? `，已经做过的 ${madeEps} 集分镜、视频和成片也会被删掉` : ""
          }。已花的积分不退。`
        : `AI 按片名「${theme || "这部剧"}」写一套剧集、互动点和结局，写完每一集的视频还要到「逐集制作」里去做。`,
      confirmLabel: hasContent ? "替换并重新生成" : "开始生成",
      cancelLabel: "先不",
      tone: hasContent ? "danger" : "default",
    });
    if (!ok || draftingRef.current) return;
    draftingRef.current = true;
    setDrafting(true);
    try {
      const res = await ProjectsApi.interactiveDraft(ctx.projectId, theme || undefined);
      // 等待期间排着的编排保存作废（新图整个替换它），落库在最新文档上合并。
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pendingSave.current = false;
      const apply = (prev: ProjectData): ProjectData => ({
        ...prev,
        projectInfo: { ...prev.projectInfo, episodes: res.episodes.length },
        episodes: res.episodes,
        episodeDocs: {},
        interactive: res.interactive,
      });
      const saved: { doc?: ProjectData } = {};
      await ctx.patchData((prev) => (saved.doc = apply(prev)), { stage: 2 });
      const fresh = projectToStory(saved.doc ?? apply(data));
      lastStory.current = fresh; // 刚存过，不用再排一次自动保存
      setStory(fresh);
      setSelectedId(fresh.startEpisodeId || fresh.episodes[0]?.episodeId || null);
      setRightTab("episode");
      toast.success(`分支图生成好了，共 ${res.episodes.length} 集`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "分支图没生成出来，请稍后重试"));
    } finally {
      draftingRef.current = false;
      setDrafting(false);
      notifyWalletChanged();
    }
  };
  const draftDisabledReason = draftPriceKnown ? null : "没读到 AI 生成要花多少积分，刷新页面后再试";

  const errorCount = validation.errors.length;
  const warnCount = validation.warnings.length;
  const endingCount = story.episodes.filter((e) => e.isEnding).length;

  const aiBtnLabel = story.episodes.length > 0 ? "AI 重新生成" : "AI 生成分支图";

  return (
    <div className="col" style={{ height: "100%", minHeight: 0, background: "var(--bg)" }}>
      {/* 阶段工具条 */}
      <div className="row gap-2 wb-branch-toolbar" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", flexWrap: "wrap" }}>
        <Network size={16} style={{ color: "var(--accent)", flex: "none" }} />
        <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>互动编排</span>
        <span className="faint num" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
          {story.episodes.length} 集 · {endingCount} 个结局
        </span>
        <span className="grow" />
        <div className="row" style={{ background: "var(--surface-2)", borderRadius: 999, padding: 3, gap: 2, flex: "none" }}>
          {([["graph", Network, "分支图"], ["list", List, "列表"]] as const).map(([k, Icon, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={view === k} onClick={() => setView(k)} style={{ height: 28, background: view === k ? "var(--surface)" : "transparent", color: view === k ? "var(--accent)" : "var(--ink-3)", boxShadow: view === k ? "var(--shadow-sm)" : "none" }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={aiDraft}
          disabled={drafting || !draftPriceKnown}
          data-testid="branch-ai-draft"
          style={{ flex: "none" }}
          title={
            draftDisabledReason ??
            (story.episodes.length > 0
              ? `用 AI 重新生成整张分支图（会替换现在的内容，扣 ${draftCost} 积分）`
              : `用 AI 按片名生成分支图（扣 ${draftCost} 积分）`)
          }
        >
          {drafting ? <Loader2 size={13} style={{ animation: "drama-spin .8s linear infinite" }} /> : <Sparkles size={13} />}
          <span className="ws-btn-label">{aiBtnLabel}</span> <CreditMark size={13} />
        </button>
        {draftDisabledReason && story.episodes.length > 0 && (
          <span className="faint" style={{ fontSize: 11, minWidth: 0, flex: "0 1 auto" }}>{draftDisabledReason}</span>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPlay(true)} style={{ flex: "none" }} title="像观众一样点一遍">
          <Play size={13} /> <span className="ws-btn-label">试玩</span>
        </button>
        <button type="button" className="btn btn-line btn-sm" onClick={() => setShowExport(true)} style={{ flex: "none" }} title="导出给播放器用的互动配置文件">
          <Download size={13} /> <span className="ws-btn-label">导出</span>
        </button>
      </div>

      {/* 主体：画布/列表 + 检查器（≤860 检查器改成底部抽屉） */}
      <div className="row" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
        <div className="col grow" style={{ minWidth: 0, minHeight: 0 }}>
          <div className="row gap-2" style={{ padding: "8px 14px", borderBottom: "1px solid var(--line-soft)", flex: "none", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-line btn-sm" onClick={addEpisode} data-testid="branch-add-episode">
              <Plus size={13} /> 加一集
            </button>
            <button type="button" className="chip wb-branch-mobile-only" onClick={() => openTab("flags")}>
              <Flag size={13} /> 剧情状态
            </button>
            <span className="grow" />
            {errorCount > 0 ? (
              <button type="button" className="chip" style={{ color: "var(--danger)" }} onClick={() => openTab("validate")}>
                <CircleAlert size={13} /> {errorCount} 个问题要改
              </button>
            ) : story.episodes.length > 0 ? (
              <button type="button" className="chip" style={{ color: "var(--success)" }} onClick={() => openTab("validate")}>
                <Check size={13} /> 检查通过
              </button>
            ) : null}
            {warnCount > 0 && (
              <button type="button" className="chip" style={{ color: "#b45309" }} onClick={() => openTab("validate")}>
                <TriangleAlert size={13} /> {warnCount} 条提醒
              </button>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {story.episodes.length === 0 ? (
              <div className="col center" style={{ height: "100%", textAlign: "center", gap: 14, padding: 32 }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
                  <Network size={28} />
                </div>
                <div className="muted" style={{ maxWidth: 380, fontSize: 13.5, lineHeight: 1.6 }}>
                  还没有剧集。让 AI 按片名生成一张分支图，或者自己一集一集加。每一集的视频要到「逐集制作」里做。
                </div>
                <div className="row gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="btn btn-grad btn-sm"
                    onClick={aiDraft}
                    disabled={drafting || !draftPriceKnown}
                    title={draftDisabledReason ?? `用 AI 按片名生成分支图（扣 ${draftCost} 积分）`}
                  >
                    {drafting ? <Loader2 size={13} style={{ animation: "drama-spin .8s linear infinite" }} /> : <Sparkles size={13} />} AI 生成分支图 <CreditMark tone="inherit" size={13} />
                  </button>
                  <button type="button" className="btn btn-line btn-sm" onClick={addEpisode}>
                    <Plus size={13} /> 加一集
                  </button>
                </div>
                {draftDisabledReason && <span className="faint" style={{ fontSize: 11.5 }}>{draftDisabledReason}</span>}
              </div>
            ) : view === "graph" ? (
              <BranchCanvas
                data={story}
                selectedId={selectedId}
                connectFrom={connectFrom}
                onSelect={(eid) => { setSelectedId(eid); openTab("episode"); }}
                onConnectStart={(eid) => setConnectFrom(eid)}
                onConnectTo={(eid) => connectFrom && connect(connectFrom, eid)}
                onCancelConnect={() => setConnectFrom(null)}
              />
            ) : (
              <div className="scroll" style={{ height: "100%", padding: 16 }}>
                <div className="col gap-2" style={{ maxWidth: 620, margin: "0 auto" }}>
                  {story.episodes.map((e) => {
                    const sel = e.episodeId === selectedId;
                    const isStart = story.startEpisodeId === e.episodeId;
                    const name = epDisplayTitle(e);
                    return (
                      <button
                        key={e.episodeId}
                        type="button"
                        onClick={() => { setSelectedId(e.episodeId); openTab("episode"); }}
                        className="row gap-2 card"
                        style={{ padding: "10px 13px", border: sel ? "1.5px solid var(--accent)" : "1px solid var(--line-soft)", cursor: "pointer", textAlign: "left", minWidth: 0 }}
                      >
                        {isStart && <Star size={13} style={{ color: "var(--accent)", flex: "none" }} fill="var(--accent)" aria-label="起始集" />}
                        {e.isEnding && <Flag size={13} style={{ color: "#d97706", flex: "none" }} aria-label="结局集" />}
                        <span className="col" style={{ gap: 1, minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>{name}</span>
                          <span className="faint num" style={{ fontSize: 11 }}>
                            第 {e.no} 集 · {e.durationSec > 0 ? `${e.durationSec} 秒` : "还没成片"} · {e.interactions.length} 个互动点
                          </span>
                        </span>
                        {e.videoUrl && <span className="tag tag-green" style={{ height: 20, flex: "none" }}>已成片</span>}
                        {e.endingLabel && (
                          <span className="tag tag-amber" style={{ height: 20, flex: "none", maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.endingLabel}>
                            {e.endingLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 检查器：桌面贴右侧；≤1180 收窄；≤860 底部抽屉（styles/pages/workbench.css） */}
        {sheetOpen && <div className="wb-branch-sheet-backdrop" onClick={() => setSheetOpen(false)} />}
        <div
          className={"col wb-branch-inspector" + (sheetOpen ? " is-open" : "")}
          style={{ width: 392, flex: "none", borderLeft: "1px solid var(--line)", background: "var(--surface)", minHeight: 0 }}
        >
          <div className="row" style={{ borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
            {([["episode", "这一集"], ["flags", "剧情状态"], ["validate", "检查"]] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRightTab(k)}
                className="grow"
                aria-pressed={rightTab === k}
                style={{
                  padding: "11px 6px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: rightTab === k ? "var(--accent)" : "var(--ink-3)",
                  borderBottom: `2px solid ${rightTab === k ? "var(--accent)" : "transparent"}`,
                }}
              >
                {label}
                {k === "validate" && errorCount > 0 && (
                  <span className="num" style={{ marginLeft: 5, color: "var(--danger)" }}>{errorCount}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-icon btn-ghost btn-sm wb-branch-sheet-close"
              aria-label="收起"
              title="收起"
              onClick={() => setSheetOpen(false)}
              style={{ flex: "none", alignSelf: "center", marginRight: 6 }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="scroll grow" style={{ minHeight: 0 }}>
            {rightTab === "episode" ? (
              selected ? (
                <EpisodeEditor
                  episode={selected}
                  allEpisodes={story.episodes}
                  flags={story.globalFlags ?? {}}
                  isStart={story.startEpisodeId === selected.episodeId}
                  onChange={(ep) => updateEpisode(selected.episodeId, ep)}
                  onSetStart={() => setStart(selected.episodeId)}
                  onDelete={() => void deleteEpisode(selected.episodeId)}
                  onDuplicate={() => duplicateEpisode(selected.episodeId)}
                  onProduce={() => void goProduce(noFromEpId(selected.episodeId))}
                />
              ) : (
                <div className="faint col center" style={{ padding: 40, textAlign: "center", gap: 8 }}>
                  <Network size={26} />
                  <span style={{ fontSize: 13 }}>点一集，改它的剧情、互动点和连线，或者去做这一集的视频。</span>
                </div>
              )
            ) : rightTab === "flags" ? (
              <div style={{ padding: 18 }}>
                <FlagsPanel flags={story.globalFlags ?? {}} onChange={setFlags} usagesOf={(k) => flagUsages(story, k)} />
              </div>
            ) : (
              <ValidationPanel issues={[...validation.errors, ...validation.warnings]} ok={validation.ok && story.episodes.length > 0} onLocate={(eid) => { if (eid) { setSelectedId(eid); setRightTab("episode"); setView("graph"); } }} />
            )}
          </div>
        </div>
      </div>

      <PlaythroughDialog open={showPlay} data={story} onClose={() => setShowPlay(false)} />
      <ExportDialog open={showExport} dramaId={ctx.projectId} title={story.title || "interactive-drama"} data={story} onClose={() => setShowExport(false)} />
    </div>
  );
}

function ValidationPanel({ issues, ok, onLocate }: { issues: Issue[]; ok: boolean; onLocate: (episodeId?: string) => void }) {
  if (ok && issues.length === 0) {
    return (
      <div className="col center" style={{ padding: 40, textAlign: "center", gap: 8, color: "var(--success)" }}>
        <Check size={26} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>检查通过</span>
        <span className="faint" style={{ fontSize: 12 }}>从起始集能走到结局，每个选项都连上了，可以导出给播放器。</span>
      </div>
    );
  }
  return (
    <div className="col gap-2" style={{ padding: 16 }}>
      {ok && (
        <div className="row gap-2" style={{ fontSize: 12.5, color: "var(--success)", fontWeight: 700, padding: "0 2px 4px" }}>
          <Check size={14} /> 没有必须改的问题，只有几条提醒
        </div>
      )}
      {issues.map((it, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onLocate(it.episodeId)}
          className="row gap-2 card"
          style={{ padding: "10px 12px", textAlign: "left", cursor: it.episodeId ? "pointer" : "default", border: "1px solid var(--line-soft)", alignItems: "flex-start" }}
        >
          {it.level === "error" ? (
            <CircleAlert size={15} style={{ color: "var(--danger)", flex: "none", marginTop: 1 }} />
          ) : (
            <TriangleAlert size={15} style={{ color: "#b45309", flex: "none", marginTop: 1 }} />
          )}
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)", minWidth: 0 }}>{it.message}</span>
        </button>
      ))}
    </div>
  );
}
