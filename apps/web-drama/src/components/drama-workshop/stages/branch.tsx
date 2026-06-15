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
  type Issue,
} from "@/lib/interactive-graph";
import { BranchCanvas } from "@/components/interactive/branch-canvas";
import { EpisodeEditor } from "@/components/interactive/episode-editor";
import { FlagsPanel } from "@/components/interactive/flags-panel";
import { PlaythroughDialog } from "@/components/interactive/playthrough-dialog";
import { ExportDialog } from "@/components/interactive/export-dialog";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { ProjectsApi } from "@/api";
import { aiErrorMessage } from "@/lib/ai-error";

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

  const validation = React.useMemo(() => validateStory(story), [story]);
  const byId = React.useMemo(() => new Map(story.episodes.map((e) => [e.episodeId, e])), [story.episodes]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // 防抖保存：本阶段改动经 story 适配器写回 ProjectData（保留 episodeDocs 成片），由工作台统一落库。
  const dataRef = React.useRef(data);
  dataRef.current = data;
  const storyRef = React.useRef(story);
  storyRef.current = story;
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNow = React.useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await ctx.saveData(writeStoryToProject(dataRef.current, storyRef.current)).catch(() => {});
  }, [ctx]);

  const queueSave = React.useCallback(() => {
    ctx.notifyEditing?.();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void ctx.saveData(writeStoryToProject(dataRef.current, storyRef.current)).catch(() => {});
    }, 1000);
  }, [ctx]);

  // story 变化即防抖落库（跳过首挂载）。
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    queueSave();
  }, [story, queueSave]);
  React.useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

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
    setRightTab("episode");
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
      title: `删除「${ep.title}」?`,
      body: "删除后所有指向这一集的接线会被断开，这一集已制作的脚本 / 分镜 / 成片也会一并移除（校验会提示需要重新接）。",
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
      toast.error("结局集不能再外连");
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
    setRightTab("episode");
    toast.success("已接上一条分支");
  };

  // 去制作这一集：先落库当前编排，再跳进六阶段「剧集脚本」（state.ep = 该集），复用单集全流程出片。
  const goProduce = async (no: number) => {
    if (!Number.isFinite(no)) return;
    await persistNow();
    dispatch({ type: "setEp", ep: no });
    dispatch({ type: "jump", stage: "epscript" });
  };

  // AI 起草整张分支图（覆盖当前大纲 + 编排）。
  const aiDraft = async () => {
    const theme = (story.title || data.projectInfo?.title || "").trim();
    const ok = await dramaConfirm({
      title: "用 AI 起草整张分支图?",
      body: `将以「${theme || "本项目主题"}」为主题生成一张可玩、可达、含结局的剧集分支图，覆盖当前所有集与接线（各集仍需在六阶段里出片）。`,
      confirmLabel: "AI 起草",
      cancelLabel: "再想想",
    });
    if (!ok) return;
    setDrafting(true);
    try {
      const res = await ProjectsApi.interactiveDraft(ctx.projectId, theme || undefined);
      const next: ProjectData = {
        ...data,
        projectInfo: { ...data.projectInfo, episodes: res.episodes.length },
        episodes: res.episodes,
        episodeDocs: {},
        interactive: res.interactive,
      };
      await ctx.saveData(next, { stage: 2 });
      const fresh = projectToStory(next);
      setStory(fresh);
      setSelectedId(fresh.startEpisodeId || fresh.episodes[0]?.episodeId || null);
      setRightTab("episode");
      toast.success(`已起草 ${res.episodes.length} 集的分支图`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "AI 起草失败，请稍后重试"));
    } finally {
      setDrafting(false);
    }
  };

  const errorCount = validation.errors.length;
  const warnCount = validation.warnings.length;

  return (
    <div className="col" style={{ height: "100%", minHeight: 0, background: "var(--bg)" }}>
      {/* 阶段工具条 */}
      <div className="row gap-2" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none" }}>
        <Network size={16} style={{ color: "var(--accent)", flex: "none" }} />
        <span style={{ fontWeight: 800, fontSize: 14 }}>互动编排</span>
        <span className="faint num" style={{ fontSize: 11 }}>
          {story.episodes.length} 集 · {story.episodes.filter((e) => e.isEnding).length} 结局
        </span>
        <span className="grow" />
        <div className="row" style={{ background: "var(--surface-2)", borderRadius: 999, padding: 3, gap: 2, flex: "none" }}>
          {([["graph", Network, "图"], ["list", List, "列表"]] as const).map(([k, Icon, label]) => (
            <button key={k} type="button" className="chip" onClick={() => setView(k)} style={{ height: 28, background: view === k ? "var(--surface)" : "transparent", color: view === k ? "var(--accent)" : "var(--ink-3)", boxShadow: view === k ? "var(--shadow-sm)" : "none" }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={aiDraft} disabled={drafting} style={{ flex: "none" }}>
          {drafting ? <Loader2 size={13} style={{ animation: "drama-spin .8s linear infinite" }} /> : <Sparkles size={13} />} AI 起草
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPlay(true)} style={{ flex: "none" }}>
          <Play size={13} /> 试玩
        </button>
        <button type="button" className="btn btn-grad btn-sm" onClick={() => setShowExport(true)} style={{ flex: "none" }}>
          <Download size={13} /> 导出
        </button>
      </div>

      {/* 主体：左 画布/列表 + 右 检查器 */}
      <div className="row" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
        <div className="col grow" style={{ minWidth: 0, minHeight: 0 }}>
          <div className="row gap-2" style={{ padding: "8px 14px", borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
            <button type="button" className="btn btn-line btn-sm" onClick={addEpisode}>
              <Plus size={13} /> 加一集
            </button>
            <span className="grow" />
            {errorCount > 0 ? (
              <button type="button" className="chip" style={{ color: "var(--danger)" }} onClick={() => setRightTab("validate")}>
                <CircleAlert size={13} /> {errorCount} 个错误
              </button>
            ) : story.episodes.length > 0 ? (
              <span className="row gap-1" style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                <Check size={13} /> 结构通过
              </span>
            ) : null}
            {warnCount > 0 && (
              <button type="button" className="chip" style={{ color: "#b45309" }} onClick={() => setRightTab("validate")}>
                <TriangleAlert size={13} /> {warnCount}
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
                  还没有剧集。点「AI 起草」一句话生成整张分支图，或「加一集」手动搭。每一集都会进六阶段工作台出片。
                </div>
                <div className="row gap-2">
                  <button type="button" className="btn btn-grad btn-sm" onClick={aiDraft} disabled={drafting}>
                    {drafting ? <Loader2 size={13} style={{ animation: "drama-spin .8s linear infinite" }} /> : <Sparkles size={13} />} AI 起草分支图
                  </button>
                  <button type="button" className="btn btn-line btn-sm" onClick={addEpisode}>
                    <Plus size={13} /> 加一集
                  </button>
                </div>
              </div>
            ) : view === "graph" ? (
              <BranchCanvas
                data={story}
                selectedId={selectedId}
                connectFrom={connectFrom}
                onSelect={(eid) => { setSelectedId(eid); setRightTab("episode"); }}
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
                    return (
                      <button
                        key={e.episodeId}
                        type="button"
                        onClick={() => { setSelectedId(e.episodeId); setRightTab("episode"); }}
                        className="row gap-2 card"
                        style={{ padding: "10px 13px", border: sel ? "1.5px solid var(--accent)" : "1px solid var(--line-soft)", cursor: "pointer", textAlign: "left" }}
                      >
                        {isStart && <Star size={13} style={{ color: "var(--accent)", flex: "none" }} fill="var(--accent)" />}
                        {e.isEnding && <Flag size={13} style={{ color: "#d97706", flex: "none" }} />}
                        <span className="col" style={{ gap: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                          <span className="faint num" style={{ fontSize: 11 }}>{e.episodeId} · {e.durationSec > 0 ? `${e.durationSec}s` : "未出片"} · {e.interactions.length} 互动</span>
                        </span>
                        <span className="grow" />
                        {e.videoUrl && <span className="tag tag-green" style={{ height: 20 }}>已成片</span>}
                        {e.endingLabel && <span className="tag tag-amber" style={{ height: 20 }}>{e.endingLabel}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右检查器 */}
        <div className="col" style={{ width: 392, flex: "none", borderLeft: "1px solid var(--line)", background: "var(--surface)", minHeight: 0 }}>
          <div className="row" style={{ borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
            {([["episode", "本集"], ["flags", "全局标记"], ["validate", "校验"]] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRightTab(k)}
                className="grow"
                style={{
                  padding: "11px 6px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 700,
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
          </div>
          <div className="scroll grow" style={{ minHeight: 0 }}>
            {rightTab === "episode" ? (
              selected ? (
                <EpisodeEditor
                  episode={selected}
                  allEpisodes={story.episodes}
                  flagNames={Object.keys(story.globalFlags ?? {})}
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
                  <span style={{ fontSize: 13 }}>在左侧点一个集来编辑它的剧情、互动点与接线，或去六阶段制作它的视频。</span>
                </div>
              )
            ) : rightTab === "flags" ? (
              <div style={{ padding: 18 }}>
                <FlagsPanel flags={story.globalFlags ?? {}} onChange={setFlags} />
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
        <span style={{ fontWeight: 700, fontSize: 14 }}>结构校验通过</span>
        <span className="faint" style={{ fontSize: 12 }}>起点可达、选项接线齐全、有可达结局，可导出下发。</span>
      </div>
    );
  }
  return (
    <div className="col gap-2" style={{ padding: 16 }}>
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
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>{it.message}</span>
        </button>
      ))}
    </div>
  );
}
