"use client";

// 剧集脚本 — 结构化分镜表单(参照「短剧分镜V2 · 结构化版-适配Web表单」):
// 基础通用信息 + 按场分组的分镜表单卡(镜号/时间线/画面/音频[人声+音效+BGM]/
// 镜头参数/特效氛围/参考素材/字幕),左列保留 首帧 → 成片 渐进渲染;
// 左下悬浮 AI 对话框(【衍生上一集】【给我惊喜】),模板在立项时已套全量。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Plus,
  RefreshCw,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { Avatar, CreditButton, Editable, GenSkeleton } from "@/components/drama-ui";
import { ConfirmDialog } from "@/components/common";
import { type FormShot } from "../shot-form";
import { StoryboardTable } from "../storyboard-table";
import { episodeContent, episodeTitle, getEpisodeDoc, matById, MATERIALS, withEpisodeDoc, type BoardScene, type BoardShot, type Material, type ProjectData, type ScriptLine, type ScriptScene } from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";
import { ProjectsApi, RenderApi } from "@/api";
import { useDramaConfig } from "@/lib/use-drama-config";
import type { StageContext } from "./stage-context";


interface EpScene extends ScriptScene {
  refs: Material[];
}

function toFormShot(sh: BoardShot, refs: Material[]): FormShot {
  return {
    id: sh.id,
    no: sh.no,
    dur: sh.dur,
    visual: sh.desc,
    size: sh.size,
    move: sh.move,
    camId: sh.camId,
    cast: sh.cast ?? [],
    voWho: sh.line?.who ?? "旁白",
    voText: sh.line?.text ?? "",
    sfx: sh.sfx ?? sh.voice ?? "",
    bgm: sh.bgm ?? "",
    fx: sh.fx ?? "",
    refs: [...refs],
    sub: true,
    // 归一化历史 flow：旧版「已锁首帧 frameLocked」映射为 frame，避免旧数据落入无按钮死状态。
    flow: sh.flow === "frameLocked" ? "frame" : ((sh.flow as FormShot["flow"]) ?? (sh.done ? "clip" : "draft")),
    frameUrls: sh.frameUrls,
    frameUrl: sh.frameUrl,
    videoUrl: sh.videoUrl,
    jobId: sh.jobId,
    lastFrameUrl: sh.lastFrameUrl,
    ffDesc: sh.ffDesc,
    lfDesc: sh.lfDesc,
    motionDesc: sh.motionDesc,
    variationType: sh.variationType,
    endFrameUrl: sh.endFrameUrl,
  };
}

/** FormShot → BoardShot（落库形态；engine 沿用旧值，缺省 seedance）。 */
function toBoardShot(sh: FormShot, prevEngine?: BoardShot["engine"]): BoardShot {
  return {
    id: sh.id,
    no: sh.no,
    size: sh.size,
    move: sh.move,
    camId: sh.camId,
    dur: sh.dur,
    engine: prevEngine ?? "seedance",
    desc: sh.visual,
    cast: sh.cast ?? [],
    line: sh.voText ? { who: sh.voWho || "旁白", text: sh.voText } : null,
    voice: sh.sfx || undefined,
    sfx: sh.sfx || undefined,
    bgm: sh.bgm || undefined,
    fx: sh.fx || undefined,
    done: sh.flow === "done",
    flow: sh.flow,
    frameUrls: sh.frameUrls,
    frameUrl: sh.frameUrl,
    videoUrl: sh.videoUrl,
    jobId: sh.jobId,
    lastFrameUrl: sh.lastFrameUrl,
    ffDesc: sh.ffDesc,
    lfDesc: sh.lfDesc,
    motionDesc: sh.motionDesc,
    variationType: sh.variationType,
    endFrameUrl: sh.endFrameUrl,
  };
}

export function EpScriptStage({ state, dispatch, data, ctx }: {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  ctx?: StageContext;
}) {
  /** 本集出场人物(可在整集设置里添加:素材库人物 / 临时演员) */
  const initCast = React.useCallback(
    (): EpCharacter[] => {
      const m = getEpisodeDoc(data, state.ep).meta;
      if (m?.cast && m.cast.length) return m.cast.map((c) => ({ ...c }));
      return data.characters.map((c) => ({ id: c.id, name: c.name, theme: c.avatar, bound: c.bound, removable: false }));
    },
    [data, state.ep],
  );
  const [cast, setCast] = React.useState<EpCharacter[]>(initCast);
  const speakerOptions = ["旁白", ...cast.map((c) => c.name)];

  /** 本集剧情（单一真源 = data.episodes[].content；老数据回退旧三段 / meta.plot / logline）。改完可让 AI 按它重生成分场分镜。 */
  const epOutline = data.episodes[state.ep - 1];
  const initPlot = React.useCallback(
    () => {
      if (epOutline) {
        const c = episodeContent(epOutline);
        if (c) return c;
      }
      const m = getEpisodeDoc(data, state.ep).meta;
      return m?.plot || data.projectInfo.logline;
    },
    [epOutline, data, state.ep],
  );
  const [plot, setPlot] = React.useState<string>(initPlot);
  // 本集剧情/标题写回 data.episodes[]（单一真源，outline 阶段与项目卡同步）；用 patchData 合并防覆盖。
  const saveEpContent = (v: string) => {
    setPlot(v);
    ctx?.notifyEditing?.();
    void ctx?.patchData?.((prev) => ({
      ...prev,
      episodes: (prev.episodes ?? []).map((e, i) => (i === state.ep - 1 ? { ...e, content: v } : e)),
    })).catch(() => {});
  };
  const saveEpTitle = (v: string) => {
    ctx?.notifyEditing?.();
    void ctx?.patchData?.((prev) => ({
      ...prev,
      episodes: (prev.episodes ?? []).map((e, i) => (i === state.ep - 1 ? { ...e, title: v } : e)),
    })).catch(() => {});
  };

  // v0.66：按集取文档 —— 切集互不覆盖（episodeDocs 优先，老项目回读 legacy 字段）
  const initScenes = React.useCallback((): EpScene[] => {
    return getEpisodeDoc(data, state.ep).script.scenes.map((s, i) => {
      const refs = (i === 0 ? [matById("a1"), matById("r1")] : [matById("r1")]).filter(Boolean) as Material[];
      return { ...s, refs, lines: s.lines.map((l) => ({ ...l })) };
    });
  }, [data, state.ep]);
  const initShots = React.useCallback((): Record<string, FormShot[]> => {
    const refsFor = (i: number) => (i === 0 ? [matById("a1"), matById("r1")] : [matById("r1")]).filter(Boolean) as Material[];
    return Object.fromEntries(
      getEpisodeDoc(data, state.ep).storyboard.scenes.map((sc, i) => [sc.id, sc.shots.map((sh) => toFormShot(sh, refsFor(i)))]),
    );
  }, [data, state.ep]);

  const [phase, setPhase] = React.useState<"gen" | "done">("done");
  const [scenes, setScenes] = React.useState<EpScene[]>(initScenes);
  const [shotsMap, setShotsMap] = React.useState<Record<string, FormShot[]>>(initShots);
  const [genScene, setGenScene] = React.useState<string | null>(null);
  const [busyMap, setBusyMap] = React.useState<Record<string, FormShot["flow"]>>({});
  // 镜间一致性承接：出首帧/出片时额外参考「角色图 + 场景参考图 + 同场上一镜画面」，保持人物/环境/光线连贯。
  const [chainConsistency, setChainConsistency] = React.useState(true);
  const [style, setStyle] = React.useState(
    () => getEpisodeDoc(data, state.ep).meta?.style ?? `${data.projectInfo.type} · 强钩子快节奏 · 竖屏短平快`,
  );
  const locked = !!state.lockedStages.epscript;
  const cfg = useDramaConfig();

  React.useEffect(() => {
    setScenes(initScenes());
    setShotsMap(initShots());
    setCast(initCast());
    setPlot(initPlot());
    setStyle(getEpisodeDoc(data, state.ep).meta?.style ?? `${data.projectInfo.type} · 强钩子快节奏 · 竖屏短平快`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ep, initScenes, initShots, initCast, initPlot]);

  // v0.88：本集设置（叙事/风格/出场人物）改动也落库（草稿态可回溯）。
  const plotRef = React.useRef(plot);
  const styleRef = React.useRef(style);
  const castRef = React.useRef(cast);
  plotRef.current = plot;
  styleRef.current = style;
  castRef.current = cast;

  /** 落库（v0.66）：本地 scenes/shotsMap → episodeDocs[当前集]，切集互不覆盖。 */
  const persist = React.useCallback(
    async (scenesNext: EpScene[], shotsNext: Record<string, FormShot[]>) => {
      if (!ctx) return;
      const curDoc = getEpisodeDoc(data, state.ep);
      const prevEngine = new Map<string, BoardShot["engine"]>();
      for (const sc of curDoc.storyboard.scenes) for (const sh of sc.shots) prevEngine.set(sh.id, sh.engine);
      const scriptScenes: ScriptScene[] = scenesNext.map(({ refs: _refs, ...s }) => ({
        ...s,
        lines: s.lines.map((l) => ({ ...l })),
      }));
      const boardScenes: BoardScene[] = scenesNext.map((s) => ({
        id: s.id,
        shots: (shotsNext[s.id] ?? []).map((sh) => toBoardShot(sh, prevEngine.get(sh.id))),
      }));
      await ctx.saveData(
        withEpisodeDoc(data, state.ep, {
          ...curDoc,
          // v0.88：本集叙事/风格/出场人物随脚本一起落库。
          meta: {
            plot: plotRef.current,
            style: styleRef.current,
            cast: castRef.current.map((c) => ({
              id: c.id, name: c.name, theme: c.theme, bound: c.bound, from: c.from, to: c.to, removable: c.removable,
            })),
          },
          script: { ep: state.ep, scenes: scriptScenes },
          storyboard: { ep: state.ep, scenes: boardScenes },
        }),
      );
    },
    [ctx, data, state.ep],
  );

  // 手改（场景/台词/分镜表单）debounce 落库，避免切阶段或刷新丢编辑。
  // 用 ref 取最新 state（setState 异步），且只在用户编辑时排程 —— 不订阅 scenes/shotsMap
  // 变化本身，避免「保存→data prop 重置→再保存」的循环。
  const scenesRef = React.useRef(scenes);
  const shotsRef = React.useRef(shotsMap);
  scenesRef.current = scenes;
  shotsRef.current = shotsMap;
  // 持有最新 persist（绑定当前集）供卸载时 flush，避免用陈旧闭包写错集。
  const persistRef = React.useRef(persist);
  persistRef.current = persist;
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = React.useCallback(() => {
    if (!ctx || locked) return;
    ctx.notifyEditing?.(); // 标脏：1.5s 防抖落库前离开也会提醒（v0.76）
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(scenesRef.current, shotsRef.current).catch(() => {});
    }, 1500);
  }, [ctx, locked, persist]);
  // 卸载（含按集 key 重挂载 = 切集）时：先 flush 待落库编辑，再清定时器。
  // EpScriptStage 在 page.tsx 以 key={state.ep} 挂载，切集即卸载本集实例 →
  // 用本集的 persistRef + 本集的 refs flush，绝不会把本集编辑写进别集（修跨集覆盖/丢失）。
  React.useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void persistRef.current(scenesRef.current, shotsRef.current).catch(() => {});
    }
  }, []);

  const markBusy = React.useCallback((id: string, to: FormShot["flow"]) => {
    setBusyMap((m) => ({ ...m, [id]: to }));
  }, []);
  const clearBusy = React.useCallback((id: string) => {
    setBusyMap((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  }, []);
  const isBusy = React.useCallback((id: string) => !!busyMap[id], [busyMap]);

  /** 真实 AI 重写整集（分场 + 分镜）。instruction 追加到剧情后（可选）。 */
  const runEpDraft = async (cost: number, instruction?: string) => {
    if (phase === "gen") return;
    // v0.88：本集叙事(plot)为空就点「基于剧情重新生成分场分镜」→ 后端会 400 DRAMA_PLOT_REQUIRED。
    // 友好提示去填，不打会失败的请求（与脑暴大纲守卫同理）。
    if (ctx && !(plot || "").trim() && !(instruction || "").trim()) {
      toast("请先在上方「本集剧情」中简要描述本集内容，AI 将据此生成分场分镜。");
      return;
    }
    setPhase("gen");
    if (!ctx) {
      // 脱离工作台的演示态
      setTimeout(() => {
        setScenes(initScenes());
        setShotsMap(initShots());
        setPhase("done");
        toast.success("已按最新整集剧情重写分场分镜");
      }, 1300);
      return;
    }
    try {
      const res = await ProjectsApi.epscriptAiDraft(ctx.projectId, {
        ep: state.ep,
        plot: instruction ? `${plot}。改写要求：${instruction}` : plot,
        style,
        cast: cast.map((c) => c.name),
      });
      const defaultRefs = (i: number) =>
        (i === 0 ? [matById("a1"), matById("r1")] : [matById("r1")]).filter(Boolean) as Material[];
      const scenesNext: EpScene[] = res.scenes.map((s, i) => ({ ...s, refs: defaultRefs(i) }));
      const shotsNext: Record<string, FormShot[]> = Object.fromEntries(
        res.boardScenes.map((bs, i) => [bs.id, bs.shots.map((sh) => toFormShot(sh, defaultRefs(i)))]),
      );
      setScenes(scenesNext);
      setShotsMap(shotsNext);
      await persist(scenesNext, shotsNext);
      dispatch({ type: "spend", n: cost });
      setPhase("done");
      toast.success("已按最新整集剧情重写分场分镜");
    } catch (e) {
      setPhase("done");
      toast.error(aiErrorMessage(e, "分场分镜生成失败，请稍后重试"));
    }
  };

  /** 基于整集剧情重新生成分场分镜 */
  const regenFromPlot = () => void runEpDraft(cfg.prices.epscript);

  /** v0.97 P5：行级就地改写本镜（对齐 ViMax design_storyboard 逐镜可控，替代整篇推倒重写浮窗）。 */
  const [rewritingId, setRewritingId] = React.useState<string | null>(null);
  const rewriteShot = async (sceneId: string, shotId: string, instruction: string) => {
    const shot = (shotsMap[sceneId] ?? []).find((s) => s.id === shotId);
    if (!shot || !instruction.trim() || rewritingId) return;
    if (!ctx?.projectId) {
      toast.error("请先保存项目再改写");
      return;
    }
    setRewritingId(shotId);
    try {
      const castNames = (shot.cast ?? []).map((cid) => data.characters.find((c) => c.id === cid)?.name).filter((n): n is string => !!n);
      const r = await ProjectsApi.rewriteShot(ctx.projectId, {
        desc: shot.visual,
        size: shot.size,
        move: shot.move,
        line: shot.voText ? { who: shot.voWho || "旁白", text: shot.voText } : null,
        instruction,
        cast: castNames,
      });
      applyRenderPatch(sceneId, shotId, {
        visual: r.desc,
        size: r.size || shot.size,
        move: r.move || shot.move,
        voWho: r.line?.who || shot.voWho,
        voText: r.line?.text ?? shot.voText,
      });
      dispatch({ type: "spend", n: cfg.prices.shotRewrite });
      toast.success("本镜已按指令改写");
    } catch (e) {
      toast.error(aiErrorMessage(e, "改写失败，请稍后重试"));
    } finally {
      setRewritingId(null);
    }
  };

  /* —— 场景 / 台词草稿（手改 → debounce 落库） —— */
  const updScene = (i: number, patch: Partial<EpScene>) => {
    setScenes((arr) => arr.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    queueSave();
  };
  const updLine = (si: number, li: number, patch: Partial<ScriptLine>) => {
    setScenes((arr) => arr.map((s, j) => (j === si ? { ...s, lines: s.lines.map((l, k) => (k === li ? { ...l, ...patch } : l)) } : s)));
    queueSave();
  };
  const addLine = (si: number) => {
    setScenes((arr) => arr.map((s, j) => (j === si ? { ...s, lines: [...s.lines, { who: "旁白", text: "" }] } : s)));
    queueSave();
  };
  const delLine = (si: number, li: number) => {
    setScenes((arr) => arr.map((s, j) => (j === si ? { ...s, lines: s.lines.filter((_, k) => k !== li) } : s)));
    queueSave();
  };

  /* —— 分镜（手改 → debounce 落库） —— */
  const updShot = (sceneId: string, id: string, patch: Partial<FormShot>) => {
    setShotsMap((m) => ({ ...m, [sceneId]: (m[sceneId] ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
    queueSave();
  };
  const applyRenderPatch = React.useCallback(
    (sceneId: string, id: string, patch: Partial<FormShot>) => {
      setShotsMap((m) => {
        const next = { ...m, [sceneId]: (m[sceneId] ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) };
        void persist(scenesRef.current, next).catch(() => {});
        return next;
      });
    },
    [persist],
  );
  const applyFrameResult = React.useCallback(
    (sceneId: string, id: string, job: RenderApi.DramaFrameJob | RenderApi.DramaRenderTask, cost: number, msg: string, spend: boolean) => {
      const frames = job.frames ?? job.result?.frames ?? [];
      if (job.status === "failed") {
        clearBusy(id);
        if (spend) toast.error(job.error_message || "首帧生成失败，请重试");
        return;
      }
      if (job.status !== "ready" || frames.length === 0) return;
      // 重新出首帧 → 清掉基于旧首帧的末帧/拆镜/成片产物，避免新首帧配旧末帧（首尾不同源）。
      applyRenderPatch(sceneId, id, {
        flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url,
        endFrameUrl: undefined, ffDesc: undefined, lfDesc: undefined, motionDesc: undefined, variationType: undefined,
        videoUrl: undefined, lastFrameUrl: undefined,
      });
      clearBusy(id);
      if (spend) {
        dispatch({ type: "spend", n: cost });
        toast.success(msg);
      }
    },
    [applyRenderPatch, clearBusy, dispatch],
  );
  const applyClipResult = React.useCallback(
    (sceneId: string, id: string, job: RenderApi.DramaEpisodeJob | RenderApi.DramaRenderTask, cost: number, msg: string, spend: boolean) => {
      if (job.status === "failed") {
        clearBusy(id);
        if (spend) toast.error(job.error_message || "视频生成失败，请重试");
        return;
      }
      if (job.status !== "ready" || !job.video_url) return;
      applyRenderPatch(sceneId, id, { flow: "clip", videoUrl: job.video_url ?? undefined, lastFrameUrl: job.last_frame_url ?? undefined, jobId: job.id });
      clearBusy(id);
      if (spend) {
        dispatch({ type: "spend", n: cost });
        toast.success(msg);
      }
    },
    [applyRenderPatch, clearBusy, dispatch],
  );
  const watchFrameJob = React.useCallback(
    async (jobId: string, sceneId: string, id: string, cost: number, msg: string, spend: boolean) => {
      try {
        const done = await RenderApi.pollFrameJob(jobId, { timeoutMs: 240_000 });
        applyFrameResult(sceneId, id, done, cost, msg, spend);
      } catch (e) {
        clearBusy(id);
        toast.error(aiErrorMessage(e, "首帧生成失败，请稍后重试"));
      }
    },
    [applyFrameResult, clearBusy],
  );
  const watchClipJob = React.useCallback(
    async (jobId: string, sceneId: string, id: string, cost: number, msg: string, spend: boolean) => {
      try {
        const done = await RenderApi.pollClipJob(jobId, { timeoutMs: 240_000 });
        applyClipResult(sceneId, id, done, cost, msg, spend);
      } catch (e) {
        clearBusy(id);
        toast.error(aiErrorMessage(e, "视频生成失败，请稍后重试"));
      }
    },
    [applyClipResult, clearBusy],
  );
  // 有进行中任务时才轮询 render/tasks：busyMap 非空（出图/出片中）或某镜出片未出成片（jobId 未成）。
  // 空闲时不轮询，避免后台一直刷；提交新任务使 pendingCount 变化 → effect 重启轮询。
  const pendingCount = React.useMemo(() => {
    let n = Object.keys(busyMap).length;
    for (const rows of Object.values(shotsMap)) for (const s of rows) if (s.jobId && !s.videoUrl) n++;
    return n;
  }, [busyMap, shotsMap]);
  React.useEffect(() => {
    if (!ctx?.projectId) return;
    let cancelled = false;
    const syncTasks = async () => {
      try {
        const snap = await RenderApi.listRenderTasks(ctx.projectId);
        if (cancelled) return;
        const shotToScene = new Map<string, string>();
        Object.entries(shotsRef.current).forEach(([sceneId, rows]) => {
          rows.forEach((row) => shotToScene.set(row.id, sceneId));
        });
        const active: Record<string, FormShot["flow"]> = {};
        for (const task of snap.tasks) {
          const shotId = task.shot_id;
          if (!shotId) continue;
          const sceneId = shotToScene.get(shotId);
          if (!sceneId) continue;
          if (task.episode_no && task.episode_no !== state.ep) continue;
          const current = (shotsRef.current[sceneId] ?? []).find((s) => s.id === shotId);
          const isActiveTask = task.status === "queued" || task.status === "running" || task.status === "rendering";
          if (isActiveTask) active[shotId] = task.task_type === "frame" ? "frame" : "clip";
          if (task.task_type === "frame" && task.status === "ready" && (task.frames?.length || task.result?.frames?.length)) {
            if (!current?.frameUrls?.length) applyFrameResult(sceneId, shotId, task, cfg.prices.frame, "首帧已出，满意就生成视频", false);
          }
          if (task.task_type === "video" && task.status === "ready" && task.video_url) {
            if (current?.videoUrl !== task.video_url) applyClipResult(sceneId, shotId, task, cfg.prices.clip, "视频已生成，验收看看", false);
          }
        }
        setBusyMap((prev) => {
          const next = { ...prev };
          for (const shotId of shotToScene.keys()) delete next[shotId];
          return { ...next, ...active };
        });
      } catch {
        // 辅助恢复失败不影响脚本编辑。
      }
    };
    const run = () => { if (!cancelled && !document.hidden) void syncTasks(); };
    run(); // 进页 / 切集 / 任务起止时对齐一次
    if (pendingCount === 0) return () => { cancelled = true; }; // 无进行中任务 → 不再轮询
    const timer = window.setInterval(run, 5000);
    const onVis = () => { if (!document.hidden) run(); }; // 切回前台立即补一次
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [applyClipResult, applyFrameResult, cfg.prices.clip, cfg.prices.frame, ctx?.projectId, state.ep, pendingCount]);
  // 删除本镜：先二次确认（§8 禁裸删），确认后再删。
  const [delTarget, setDelTarget] = React.useState<{ sceneId: string; id: string; no: number } | null>(null);
  const askDelShot = (sceneId: string, id: string) => {
    const sh = (shotsRef.current[sceneId] ?? []).find((s) => s.id === id);
    setDelTarget({ sceneId, id, no: sh?.no ?? 0 });
  };
  const delShot = (sceneId: string, id: string) => {
    setShotsMap((m) => ({ ...m, [sceneId]: (m[sceneId] ?? []).filter((s) => s.id !== id).map((s, i) => ({ ...s, no: i + 1 })) }));
    queueSave();
  };
  const addShot = (sceneId: string, sceneIdx: number) => {
    setShotsMap((m) => {
      const list = m[sceneId] ?? [];
      return {
        ...m,
        [sceneId]: [
          ...list,
          {
            id: sceneId + "-add" + Date.now(),
            no: list.length + 1,
            dur: 4,
            visual: "",
            size: "中景",
            move: "固定",
            voWho: "旁白",
            voText: "",
            sfx: "",
            bgm: "",
            fx: "",
            refs: scenes[sceneIdx]?.refs ?? [],
            sub: true,
            flow: "draft",
          },
        ],
      };
    });
    queueSave();
  };
  const genShots = async (sceneId: string, sceneIdx: number) => {
    const scene = scenes[sceneIdx];
    if (!scene) return;
    // v0.88：这场还没写「场面描述」也没台词 → AI 无从拆镜（后端会 400 DRAMA_SCENE_REQUIRED）。
    // 平铺分镜表里没有场面描述输入位，故直接给一条可编辑空镜 + 友好提示，不打会失败的请求。
    if (ctx && !(scene.action || "").trim() && !(scene.lines ?? []).some((l) => (l.text || "").trim())) {
      addShot(sceneId, sceneIdx);
      toast("本场暂无内容，已添加一条空镜头，可直接在表格中填写画面与台词；也可使用「基于剧情重新生成分场分镜」由 AI 整集生成。");
      return;
    }
    setGenScene(sceneId);
    try {
      if (!ctx) {
        // 演示态
        await new Promise((r) => setTimeout(r, 1200));
        const donor = data.storyboard.scenes.find((x) => x.shots.length > 0);
        setShotsMap((m) => ({
          ...m,
          [sceneId]: (donor?.shots ?? []).slice(0, 3).map((sh, i) =>
            toFormShot({ ...sh, id: sceneId + "-n" + i, no: i + 1, done: false }, scene.refs)),
        }));
      } else {
        const shots = await ProjectsApi.splitSceneShots(ctx.projectId, {
          sceneId,
          place: scene.place,
          action: scene.action,
          lines: scene.lines,
          style,
        });
        const next = { ...shotsMap, [sceneId]: shots.map((sh) => toFormShot(sh, scene.refs)) };
        setShotsMap(next);
        await persist(scenes, next);
      }
      dispatch({ type: "spend", n: cfg.prices.splitScene });
      toast.success("本场分镜已拆好,逐镜表单可直接改");
    } catch (e) {
      toast.error(aiErrorMessage(e, "拆镜失败，请稍后重试"));
    } finally {
      setGenScene(null);
    }
  };

  /* —— 逐镜渲染引擎（强版，v0.97 收敛：与原视频工厂同能力）—— */
  /** 镜头 → 出图/出片提示词填充 vars（拆镜后首帧用 ffDesc、出片用 motionDesc；否则回退画面）。 */
  /** 场景地点 + 氛围（喂进出图/出片提示词的 sceneClause，让模型还原正确取景地，不乱编）。 */
  const sceneClauseFor = (sceneId: string): string => {
    const sc = scenesRef.current.find((s) => s.id === sceneId);
    const p = (sc?.place || "").trim();
    const m = (sc?.mood || "").trim();
    if (!p && !m) return "";
    return `场景：${p}${m ? "，" + m : ""}。`;
  };
  const shotVars = (shot: FormShot, mode: "frame" | "clip", sceneId?: string): Record<string, string> => {
    const castNames = (shot.cast ?? []).map((cid) => data.characters.find((c) => c.id === cid)?.name).filter(Boolean).join("、");
    const visual = (mode === "clip" ? shot.motionDesc : shot.ffDesc)?.trim() || shot.visual || "";
    return {
      visual,
      size: shot.size || "",
      move: shot.move || "",
      sceneClause: sceneId ? sceneClauseFor(sceneId) : "",
      lineClause: shot.voText ? `台词：${shot.voText}。` : "",
      castClause: castNames ? `出场人物：${castNames}。` : "",
      styleSuffix: `${data.projectInfo.type}风格。`,
    };
  };
  /** 本场景绑定的参考图：优先用显式绑定的场景资产（sceneRefId），否则回退按场名匹配（best-effort），保障场景一致性。 */
  const sceneRefUrlFor = (sceneId: string): string | undefined => {
    const sc = scenesRef.current.find((s) => s.id === sceneId);
    const assets = data.scenes ?? [];
    if (sc?.sceneRefId) {
      const bound = assets.find((a) => a.id === sc.sceneRefId);
      if (bound?.refUrl) return bound.refUrl;
    }
    const place = sc?.place ?? "";
    return assets.find((a) => a.refUrl && a.name && a.name.length >= 2 && place.includes(a.name))?.refUrl;
  };
  /** 同场上一镜的承接锚点：优先成片真实末帧，否则首帧。 */
  const prevFrameInScene = (sceneId: string, shotId: string): string | undefined => {
    const rows = shotsRef.current[sceneId] ?? [];
    const idx = rows.findIndex((x) => x.id === shotId);
    for (let i = idx - 1; i >= 0; i--) {
      const f = rows[i].lastFrameUrl ?? rows[i].frameUrl ?? rows[i].frameUrls?.[0];
      if (f) return f;
    }
    return undefined;
  };
  /** 同场下一镜的开场首帧：作本镜视频尾帧，切镜更平滑。 */
  const nextFrameInScene = (sceneId: string, shotId: string): string | undefined => {
    const rows = shotsRef.current[sceneId] ?? [];
    const idx = rows.findIndex((x) => x.id === shotId);
    for (let i = idx + 1; i < rows.length; i++) {
      const f = rows[i].frameUrl ?? rows[i].frameUrls?.[0];
      if (f) return f;
    }
    return undefined;
  };
  /** 出首帧参考图：出场角色图（@提及优先→画面文本名匹配兜底→本集全体）+ 场景参考图 + 同场上一镜画面。 */
  const shotRefImages = (sceneId: string, shot: FormShot, extraLeading?: (string | undefined)[]): string[] => {
    // 出场角色：优先本镜 @提及的 cast；老镜/未 @ → 从画面文本按角色名兜底匹配（避免塞错人）。
    let cast = shot.cast ?? [];
    if (cast.length === 0) {
      const v = shot.visual || "";
      cast = data.characters.filter((c) => c.name && c.name.length >= 2 && v.includes(c.name)).map((c) => c.id);
    }
    let charImgs = cast
      .map((cid) => data.characters.find((c) => c.id === cid))
      .map((c) => c?.avatarImage || c?.refUrl || "")
      .filter(Boolean);
    if (charImgs.length === 0) {
      // 仍无（都没标、也没配参考图）→ 退回本集所有有形象的角色，尽量锁脸。
      charImgs = data.characters.map((c) => c.avatarImage || c.refUrl || "").filter(Boolean);
    }
    const all = [...(extraLeading ?? []).filter((x): x is string => !!x), ...charImgs];
    if (chainConsistency) {
      const sref = sceneRefUrlFor(sceneId);
      if (sref) all.push(sref);
      const prev = prevFrameInScene(sceneId, shot.id);
      if (prev) all.push(prev);
    }
    return Array.from(new Set(all)).slice(0, 6);
  };

  /** 单镜生成：frame=首帧参考图（后台图片任务，出 2 版），clip=直接出片/成片（后台视频任务 + 轮询，带首尾帧）。 */
  const render = async (sceneId: string, id: string, to: FormShot["flow"], cost: number, msg: string) => {
    const shot = (shotsMap[sceneId] ?? []).find((s) => s.id === id);
    if (!shot || isBusy(id) || decomposingId === id) return;
    markBusy(id, to);
    try {
      if (to === "frame") {
        const job = await RenderApi.submitFrameJob({
          kind: "shot",
          vars: shotVars(shot, "frame", sceneId),
          refImages: shotRefImages(sceneId, shot),
          ratio: data.projectInfo.ratio,
          count: 2,
          projectId: ctx?.projectId,
          sceneId,
          shotId: id,
          episodeNo: state.ep,
          name: `第${state.ep}集 镜${shot.no} 首帧`,
        });
        toast.success("首帧已加入后台生成");
        void watchFrameJob(job.id, sceneId, id, cost, msg, true);
      } else {
        const ownFrame = shot.frameUrl ?? shot.frameUrls?.[0];
        // 基于已选首帧出片用本镜首帧；直出（无首帧）镜间承接用上一镜真实末帧作开场。
        const firstFrame = ownFrame ?? (chainConsistency ? prevFrameInScene(sceneId, id) : undefined);
        // 尾帧（双关键帧）：优先拆镜末帧，否则同场下一镜开场首帧（seedance 支持，下游不支持忽略）。
        const endFrame = shot.endFrameUrl ?? (chainConsistency ? nextFrameInScene(sceneId, id) : undefined);
        const job = await RenderApi.renderClip({
          kind: "shot",
          vars: shotVars(shot, "clip", sceneId),
          name: `第${state.ep}集 镜${shot.no}`,
          durationSec: shot.dur,
          ratio: data.projectInfo.ratio,
          projectId: ctx?.projectId,
          sceneId,
          shotId: id,
          episodeNo: state.ep,
          target: ownFrame ? "frame-clip" : "direct",
          frameUrl: firstFrame,
          lastFrameUrl: endFrame,
        });
        applyRenderPatch(sceneId, id, { jobId: job.id });
        toast.success("视频已加入后台生成");
        void watchClipJob(job.id, sceneId, id, cost, msg, true);
      }
    } catch (e) {
      clearBusy(id);
      toast.error(aiErrorMessage(e, "生成失败，请稍后重试"));
    }
  };

  /** AI 拆镜（借鉴 ViMax）：单镜 → 首/末帧静态快照 + 运动 + 变化等级；末帧以本镜首帧为锚出图（首尾同源）。 */
  // 拆镜走同步接口、不产生带 shot_id 的后台任务，故用独立 busy 态（不能用 busyMap——会被 5s 任务轮询清掉）。
  const [decomposingId, setDecomposingId] = React.useState<string | null>(null);
  const decompose = async (sceneId: string, id: string) => {
    const shot = (shotsMap[sceneId] ?? []).find((s) => s.id === id);
    if (!shot || isBusy(id) || decomposingId) return;
    if (!ctx?.projectId) {
      toast.error("请先保存项目再拆镜");
      return;
    }
    setDecomposingId(id);
    try {
      const castNames = (shot.cast ?? []).map((cid) => data.characters.find((c) => c.id === cid)?.name).filter((n): n is string => !!n);
      const d = await ProjectsApi.decomposeShot(ctx.projectId, { desc: shot.visual || "", cast: castNames });
      let endFrameUrl: string | undefined;
      if (d.lfDesc?.trim()) {
        try {
          const ownFrame = shot.frameUrl ?? shot.frameUrls?.[0];
          const frames = await RenderApi.renderFrame({
            kind: "shot",
            vars: { ...shotVars(shot, "frame", sceneId), visual: d.lfDesc },
            refImages: shotRefImages(sceneId, shot, [ownFrame]),
            ratio: data.projectInfo.ratio,
            count: 1,
          });
          endFrameUrl = frames[0]?.url;
        } catch {
          /* 末帧出图失败：保留文本，尾帧走 nextFrameInScene 兜底 */
        }
      }
      applyRenderPatch(sceneId, id, {
        ffDesc: d.ffDesc,
        lfDesc: d.lfDesc,
        motionDesc: d.motionDesc,
        variationType: d.variationType,
        endFrameUrl,
      });
      dispatch({ type: "spend", n: cfg.prices.decompose + (endFrameUrl ? cfg.prices.frame : 0) });
      toast.success("已拆出首 / 末帧与运动描述");
    } catch (e) {
      toast.error(aiErrorMessage(e, "镜头分解失败，请稍后重试"));
    } finally {
      setDecomposingId(null);
    }
  };

  /* 时间线累计(跨场连续) */
  const allShots = scenes.flatMap((s) => shotsMap[s.id] ?? []);
  const totalDur = allShots.reduce((a, x) => a + (x.dur || 0), 0);
  const starts = new Map<string, number>();
  {
    let acc = 0;
    for (const sc of scenes) for (const sh of shotsMap[sc.id] ?? []) {
      starts.set(sh.id, acc);
      acc += sh.dur || 0;
    }
  }

  return (
    <div className="col" style={{ height: "100%", minHeight: 0, position: "relative" }}>
      <div className="scroll grow" style={{ minHeight: 0 }}>
        {/* 整宽容器：分镜表放开到整宽，上半部信息卡保持易读窄宽（左对齐同起点）。 */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 28px 130px" }}>
          <div style={{ maxWidth: 880 }}>
          {/* ===== 本集剧情(先改剧情,再让 AI 按它重生成分场分镜) ===== */}
          <div className="card" style={{ padding: "14px 16px", marginBottom: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="num tag tag-accent" style={{ flex: "none" }}>第 {state.ep} 集</span>
              <span style={{ fontWeight: 800, fontSize: 14, flex: "none", maxWidth: 320, overflow: "hidden" }}>
                {locked ? (epOutline ? episodeTitle(epOutline) : "本集剧情") : (
                  <Editable value={epOutline?.title ?? ""} placeholder="集标题…" onCommit={saveEpTitle} />
                )}
              </span>
              <span className="grow" style={{ minWidth: 12 }} />
              {!locked && (
                <CreditButton
                  cost={cfg.prices.epscript}
                  onConfirm={regenFromPlot}
                  confirmTitle="重新生成分场分镜"
                  confirmBody="AI 会按当前剧情把整集重写为新的分场分镜。"
                  className="btn btn-grad btn-sm"
                  style={{ flex: "none", whiteSpace: "nowrap" }}
                  disabled={phase === "gen"}
                  title="对当前分场分镜不满意？修改剧情后点击此处，AI 将据此重写整集"
                >
                  <RefreshCw size={13} /> 基于剧情重新生成分场分镜
                </CreditButton>
              )}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.75 }}>
              <Editable block value={plot} placeholder="本集剧情：开场钩子→主体→结尾悬念，一段连贯…" onCommit={saveEpContent} style={{ display: "block" }} />
            </div>
          </div>

          {/* ===== 基础通用信息 ===== */}
          <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
            <div className="row gap-2" style={{ marginBottom: 10 }}>
              <Clapperboard size={15} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 800, fontSize: 13.5 }}>基础通用信息</span>
              <span className="faint" style={{ fontSize: 11 }}>跨镜共享,改一处全集生效</span>
              <span className="grow" />
              <span className="tag tag-accent num">整体时长 · {totalDur}s</span>
            </div>
            <div className="col gap-2" style={{ fontSize: 13 }}>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 64, flex: "none", marginTop: 3 }}>作品风格</span>
                <span className="grow" style={{ minWidth: 0 }}><Editable block value={style} placeholder="风格关键词…" onCommit={(v) => { setStyle(v); queueSave(); }} /></span>
              </div>
              <div className="row gap-2" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 64, flex: "none", marginTop: 4 }}>出场人物</span>
                <CastEditor cast={cast} onChange={(next) => { setCast(next); queueSave(); }} disabled={locked} />
              </div>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 64, flex: "none", marginTop: 3 }}>拍摄场景</span>
                <span className="grow muted" style={{ minWidth: 0, fontSize: 12.5 }}>
                  {scenes.map((s) => s.place.replace(/^(内景|外景)\s*·\s*/, "")).join(" / ")}
                </span>
              </div>
            </div>
          </div>

          {phase === "gen" && (
            <div className="card" style={{ padding: 18 }}>
              <GenSkeleton lines={4} label={`正在重写第 ${state.ep} 集脚本…`} />
            </div>
          )}
          </div>

          {/* ===== 分镜表（设计稿平铺表格 · 结构化字段喂视频生成提示词；整宽展示） ===== */}
          {phase === "done" && (
            <>
              <div className="row gap-2" style={{ alignItems: "center", margin: "2px 0 10px" }}>
                <span style={{ fontWeight: 800, fontSize: 14.5 }}>分镜表</span>
                <span className="faint" style={{ fontSize: 11 }}>单元格文字可直接编辑 · 点击首帧进入「AI 改图」· 出 2 版首帧参考图可挑 · 选好后可「补末帧」让出片首尾更稳</span>
                <span className="grow" />
                {!locked && (
                  <label className="row gap-2" style={{ alignItems: "center", cursor: "pointer", fontSize: 11.5, color: "var(--ink-2)" }} title="出首帧/出片时额外参考同场上一镜画面 + 场景参考图，保持人物/环境/光线连贯">
                    <input type="checkbox" checked={chainConsistency} onChange={(e) => setChainConsistency(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--accent)" }} />
                    镜间一致性承接
                  </label>
                )}
              </div>
              <StoryboardTable
                scenes={scenes}
                sceneAssets={data.scenes ?? []}
                characters={data.characters.map((c) => ({ id: c.id, name: c.name }))}
                shotsMap={shotsMap}
                speakerOptions={speakerOptions}
                locked={locked}
                busyMap={decomposingId ? { ...busyMap, [decomposingId]: "frame" } : busyMap}
                starts={starts}
                genScene={genScene}
                onUpdScene={updScene}
                onUpdShot={updShot}
                onDelShot={askDelShot}
                onAddShot={addShot}
                onGenShots={genShots}
                onRender={(sceneId, shotId, kind) => {
                  if (kind === "frame") render(sceneId, shotId, "frame", 2, "首帧已生成，确认后可继续生成视频");
                  else if (kind === "direct") render(sceneId, shotId, "clip", 9, "分镜视频已生成，请验收");
                  else render(sceneId, shotId, "clip", 7, "成片已生成，请验收");
                }}
                onApprove={(sceneId, shotId) => {
                  const next = { ...shotsMap, [sceneId]: (shotsMap[sceneId] ?? []).map((x) => (x.id === shotId ? { ...x, flow: "done" as const } : x)) };
                  setShotsMap(next);
                  void persist(scenes, next);
                  toast.success("本镜已验收入片");
                }}
                onFrameEdited={(sceneId, shotId, frameUrl) => updShot(sceneId, shotId, { frameUrl, frameUrls: [frameUrl] })}
                onDecompose={(sceneId, shotId) => void decompose(sceneId, shotId)}
                rewritingId={rewritingId}
                onRewriteShot={(sceneId, shotId, instruction) => void rewriteShot(sceneId, shotId, instruction)}
              />
            </>
          )}
        </div>
      </div>

      {/* 悬浮 CTA(右下)：逐镜出片在本页分镜表完成后，去成片合成拼接。脚本始终可回改，不再锁定。 */}
      {phase === "done" && (
        <div className="row gap-2 pop-in" style={{ position: "absolute", right: 24, bottom: 22, zIndex: 20, background: "var(--surface)", padding: 9, borderRadius: 15, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)" }}>
          <span className="faint" style={{ fontSize: 11, alignSelf: "center", paddingLeft: 4 }}>镜头都出片了？</span>
          <button
            type="button"
            className="btn btn-grad btn-sm"
            onClick={async () => {
              try {
                await persist(scenes, shotsMap);
              } catch { /* persist 内部已提示 */ }
              dispatch({ type: "jump", stage: "prompt" });
            }}
          >
            <Check size={14} /> 保存·去成片合成 <ArrowRight size={12} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(next) => { if (!next) setDelTarget(null); }}
        title={`删除第 ${delTarget?.no ?? ""} 镜？`}
        description="删除后该镜的画面、台词、已生成的首帧/末帧/成片都会一并移除，且不可恢复。"
        confirmLabel="删除本镜"
        cancelLabel="取消"
        destructive
        onConfirm={() => { if (delTarget) delShot(delTarget.sceneId, delTarget.id); setDelTarget(null); }}
      />
    </div>
  );
}

/* ============ 本集出场人物编辑(整集设置内) ============ */
interface EpCharacter {
  id: string;
  name: string;
  /** 项目角色的数字人主题 key */
  theme?: string;
  bound?: boolean;
  /** 素材库人物带来的配色 */
  from?: string;
  to?: string;
  /** 临时演员 / 后加的人物可移除 */
  removable?: boolean;
}

const TEMP_SUGGESTS = ["路人甲", "路人乙", "群演"];

function CastEditor({ cast, onChange, disabled }: { cast: EpCharacter[]; onChange: (next: EpCharacter[]) => void; disabled?: boolean }) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const matPeople = MATERIALS.filter((m) => m.cat === "人物" && !cast.some((c) => c.name === m.name));

  const addTemp = (n: string) => {
    const v = n.trim();
    if (!v || cast.some((c) => c.name === v)) return;
    onChange([...cast, { id: "tmp" + Date.now(), name: v, removable: true }]);
    setName("");
  };
  const addFromMaterial = (m: Material) => {
    onChange([...cast, { id: "mat-" + m.id, name: m.name, from: m.from, to: m.to, removable: true }]);
  };

  return (
    <div className="col gap-2 grow" style={{ minWidth: 0 }}>
      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
        {cast.map((c) => (
          <span key={c.id} className="row" style={{ padding: "2px 8px 2px 2px", borderRadius: 999, background: c.theme ? "var(--accent-soft)" : "var(--surface-2)", gap: 5 }}>
            {c.theme ? (
              <Avatar theme={c.theme} size={18} bound={c.bound} />
            ) : c.from ? (
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(140deg,${c.from},${c.to})`, flex: "none" }} />
            ) : (
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--ink-3)", flex: "none" }}>
                <UserRound size={11} />
              </span>
            )}
            <span style={{ fontSize: 11.5, fontWeight: 700, color: c.theme ? "var(--accent)" : "var(--ink-2)" }}>{c.name}</span>
            {c.removable && !disabled && (
              <button type="button" title="移除" onClick={() => onChange(cast.filter((x) => x.id !== c.id))} style={{ color: "var(--ink-3)", display: "grid", placeItems: "center" }}>
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <button type="button" className="chip" style={{ height: 24, fontSize: 11 }} onClick={() => setAdding(!adding)}>
            <Plus size={11} /> 添加人物
          </button>
        )}
      </div>

      {adding && !disabled && (
        <div className="card col gap-2 pop-in" style={{ padding: "10px 12px", background: "var(--surface-2)", border: "1px dashed var(--line)" }}>
          {matPeople.length > 0 && (
            <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, flex: "none" }}>从素材库选</span>
              {matPeople.slice(0, 6).map((m) => (
                <button key={m.id} type="button" className="row gap-1" title={`把素材「${m.name}」加为出场人物`} onClick={() => addFromMaterial(m)}
                  style={{ padding: "2px 8px 2px 2px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", gap: 5 }}>
                  <span style={{ width: 17, height: 17, borderRadius: "50%", background: `linear-gradient(140deg,${m.from},${m.to})`, flex: "none" }} />
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{m.name}</span>
                  <Plus size={10} style={{ color: "var(--ink-3)" }} />
                </button>
              ))}
            </div>
          )}
          <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, flex: "none" }}>临时演员</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTemp(name);
                }
              }}
              placeholder="比如:路人甲"
              style={{ height: 26, width: 120, border: "1px solid var(--line)", borderRadius: 8, padding: "0 8px", fontSize: 11.5, outline: "none", background: "var(--surface)" }}
            />
            <button type="button" className="btn btn-primary btn-sm" style={{ height: 26, fontSize: 11 }} disabled={!name.trim()} onClick={() => addTemp(name)}>
              <Plus size={11} /> 添加
            </button>
            {TEMP_SUGGESTS.filter((t) => !cast.some((c) => c.name === t)).map((t) => (
              <button key={t} type="button" className="chip" style={{ height: 22, fontSize: 10.5 }} onClick={() => addTemp(t)}>
                {t}
              </button>
            ))}
          </div>
          <span className="faint" style={{ fontSize: 10 }}>新增人物将出现在下方各场对白与分镜配音的说话人选项中</span>
        </div>
      )}
    </div>
  );
}
