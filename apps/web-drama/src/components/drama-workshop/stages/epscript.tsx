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
  Image as ImageIcon,
  Lock,
  Plus,
  RefreshCw,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { Avatar, CreditButton, Editable, GenSkeleton } from "@/components/drama-ui";
import { AiChatPanel, type ChatMsg } from "../ai-chat-panel";
import { type FormShot } from "../shot-form";
import { StoryboardTable } from "../storyboard-table";
import { getEpisodeDoc, matById, MATERIALS, withEpisodeDoc, type BoardScene, type BoardShot, type Material, type ProjectData, type ScriptLine, type ScriptScene } from "@/mocks/drama-workshop";
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
    voWho: sh.line?.who ?? "旁白",
    voText: sh.line?.text ?? "",
    sfx: sh.voice ?? "",
    bgm: "",
    fx: "",
    refs: [...refs],
    sub: true,
    flow: (sh.flow as FormShot["flow"]) ?? (sh.done ? "clip" : "draft"),
    frameUrls: sh.frameUrls,
    frameUrl: sh.frameUrl,
    videoUrl: sh.videoUrl,
    jobId: sh.jobId,
  };
}

/** FormShot → BoardShot（落库形态；engine 沿用旧值，缺省 seedance）。 */
function toBoardShot(sh: FormShot, prevEngine?: BoardShot["engine"]): BoardShot {
  return {
    id: sh.id,
    no: sh.no,
    size: sh.size,
    move: sh.move,
    dur: sh.dur,
    engine: prevEngine ?? "seedance",
    desc: sh.visual,
    cast: [],
    line: sh.voText ? { who: sh.voWho || "旁白", text: sh.voText } : null,
    voice: sh.sfx || undefined,
    done: sh.flow === "done",
    flow: sh.flow,
    frameUrls: sh.frameUrls,
    frameUrl: sh.frameUrl,
    videoUrl: sh.videoUrl,
    jobId: sh.jobId,
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

  /** 本集叙事（整集剧情速览,不直接用于生成;改完可让 AI 按它重生成分场分镜） */
  const epOutline = data.episodes[state.ep - 1];
  const initPlot = React.useCallback(
    () => {
      const m = getEpisodeDoc(data, state.ep).meta;
      if (m?.plot) return m.plot;
      return epOutline ? `${epOutline.hook}。${epOutline.synopsis}` : data.projectInfo.logline;
    },
    [epOutline, data, state.ep],
  );
  const [plot, setPlot] = React.useState<string>(initPlot);

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
  const [style, setStyle] = React.useState(
    () => getEpisodeDoc(data, state.ep).meta?.style ?? `${data.projectInfo.type} · 强钩子快节奏 · 竖屏短平快`,
  );
  const [chat, setChat] = React.useState<ChatMsg[]>([
    { who: "ai", text: `第 ${state.ep} 集脚本已按大纲起草好。想整体调整就跟我说,也可以点下面的快捷指令。` },
  ]);
  const locked = !!state.lockedStages.epscript;
  const cfg = useDramaConfig();

  React.useEffect(() => {
    setScenes(initScenes());
    setShotsMap(initShots());
    setCast(initCast());
    setPlot(initPlot());
    setStyle(getEpisodeDoc(data, state.ep).meta?.style ?? `${data.projectInfo.type} · 强钩子快节奏 · 竖屏短平快`);
    setChat([{ who: "ai", text: `第 ${state.ep} 集脚本已按大纲起草好。想整体调整就跟我说,也可以点下面的快捷指令。` }]);
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
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = React.useCallback(() => {
    if (!ctx || locked) return;
    ctx.notifyEditing?.(); // 标脏：1.5s 防抖落库前离开也会提醒（v0.76）
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(scenesRef.current, shotsRef.current).catch(() => {});
    }, 1500);
  }, [ctx, locked, persist]);
  React.useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
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

  /** 真实 AI 重写整集（分场 + 分镜）。instruction 追加到剧情后（对话驱动改写用）。 */
  const runEpDraft = async (cost: number, instruction?: string, aiReply?: string) => {
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
      if (aiReply) setChat((c) => [...c, { who: "ai", text: aiReply }]);
      toast.success("已按最新整集剧情重写分场分镜");
    } catch (e) {
      setPhase("done");
      const msg = aiErrorMessage(e, "分场分镜生成失败，请稍后重试");
      setChat((c) => [...c, { who: "ai", text: `生成失败：${msg}` }]);
      toast.error(msg);
    }
  };

  /** 基于整集剧情重新生成分场分镜 */
  const regenFromPlot = () => void runEpDraft(cfg.prices.epscript);

  /* —— AI 对话驱动整体重写 —— */
  const sendChat = (text: string) => {
    if (phase === "gen") return;
    setChat((c) => [...c, { who: "me", text }]);
    void runEpDraft(
      cfg.prices.epscript,
      text,
      text === "衍生上一集"
        ? "已按上一集的人物关系和节奏衍生出本集脚本,钩子接得上,你看看。"
        : "脚本已按你的要求更新，再看看还有哪里需要调整？",
    );
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
      applyRenderPatch(sceneId, id, { flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url });
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
      applyRenderPatch(sceneId, id, { flow: "clip", videoUrl: job.video_url ?? undefined, jobId: job.id });
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
    void syncTasks();
    const timer = window.setInterval(syncTasks, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyClipResult, applyFrameResult, cfg.prices.clip, cfg.prices.frame, ctx?.projectId, state.ep]);
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

  /** 单镜生成：frame=首帧（后台图片任务），clip=直接出片/成片（后台视频任务 + 轮询）。 */
  const render = async (sceneId: string, id: string, to: FormShot["flow"], cost: number, msg: string) => {
    const shot = (shotsMap[sceneId] ?? []).find((s) => s.id === id);
    if (!shot || isBusy(id)) return;
    markBusy(id, to);
    try {
      if (to === "frame") {
        const job = await RenderApi.submitFrameJob({
          kind: "shot",
          vars: { visual: shot.visual, size: shot.size, move: shot.move, lineClause: "", castClause: "", styleSuffix: "" },
          ratio: data.projectInfo.ratio,
          count: 1,
          projectId: ctx?.projectId,
          sceneId,
          shotId: id,
          episodeNo: state.ep,
          name: `第${state.ep}集 镜${shot.no} 首帧`,
        });
        toast.success("首帧已加入后台生成");
        void watchFrameJob(job.id, sceneId, id, cost, msg, true);
      } else {
        const job = await RenderApi.renderClip({
          kind: "shot",
          vars: {
            visual: shot.visual, size: shot.size, move: shot.move,
            lineClause: shot.voText ? `台词：${shot.voText}` : "", castClause: "", styleSuffix: "",
          },
          name: `第${state.ep}集 镜${shot.no}`,
          durationSec: shot.dur,
          ratio: data.projectInfo.ratio,
          projectId: ctx?.projectId,
          sceneId,
          shotId: id,
          episodeNo: state.ep,
          target: shot.frameUrl ? "frame-clip" : "direct",
          frameUrl: shot.frameUrl,
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
          {locked && (
            <div className="row gap-3 fade-up" style={{ padding: "10px 14px", background: "var(--accent-soft)", borderRadius: 12, marginBottom: 14, color: "var(--accent)" }}>
              <Lock size={15} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>本集脚本已锁定，视频工厂以此为准；如需调整可修改后重新确认。</span>
            </div>
          )}

          {/* ===== 本集剧情(先改剧情,再让 AI 按它重生成分场分镜) ===== */}
          <div className="card" style={{ padding: "14px 16px", marginBottom: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 8 }}>
              <span className="num tag tag-accent" style={{ flex: "none" }}>第 {state.ep} 集</span>
              <span style={{ fontWeight: 800, fontSize: 13.5 }}>本集剧情</span>
              {epOutline && <span className="tag tag-gray" style={{ flex: "none" }}>{epOutline.beat}</span>}
              <span className="faint" style={{ fontSize: 11 }}>仅供预览，不直接参与生成</span>
              <span className="grow" />
              {!locked && (
                <CreditButton
                  cost={cfg.prices.epscript}
                  onConfirm={regenFromPlot}
                  confirmTitle="重新生成分场分镜"
                  confirmBody="AI 会按当前剧情把整集重写为新的分场分镜。"
                  className="btn btn-line btn-sm"
                  style={{ flex: "none" }}
                  disabled={phase === "gen"}
                  title="对当前分场分镜不满意？修改剧情后点击此处，AI 将据此重写整集"
                >
                  <RefreshCw size={13} /> 基于剧情重新生成分场分镜
                </CreditButton>
              )}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.75 }}>
              <Editable block value={plot} placeholder="这一集大致讲什么…" onCommit={(v) => { setPlot(v); queueSave(); }} style={{ display: "block" }} />
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
                <span className="faint" style={{ fontSize: 11 }}>单元格文字可直接编辑 · 点击首帧进入「AI 改图」</span>
              </div>
              <StoryboardTable
                scenes={scenes}
                shotsMap={shotsMap}
                speakerOptions={speakerOptions}
                locked={locked}
                busyMap={busyMap}
                starts={starts}
                genScene={genScene}
                onUpdScene={updScene}
                onUpdShot={updShot}
                onDelShot={delShot}
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
              />
            </>
          )}
        </div>
      </div>

      {/* 悬浮 AI 对话(左下):模板化提示词 衍生上一集 / 给我惊喜 */}
      <AiChatPanel msgs={chat} quick={["衍生上一集", "给我惊喜"]} busy={phase === "gen"} onSend={sendChat} />

      {/* 悬浮 CTA(右下) */}
      {phase === "done" && !locked && (
        <div className="row gap-2 pop-in" style={{ position: "absolute", right: 24, bottom: 22, zIndex: 20, background: "var(--surface)", padding: 9, borderRadius: 15, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)" }}>
          <span className="faint" style={{ fontSize: 11, alignSelf: "center", paddingLeft: 4 }}>脚本与分镜已确认？</span>
          <button
            type="button"
            className="btn btn-grad btn-sm"
            onClick={async () => {
              try {
                await persist(scenes, shotsMap);
              } catch { /* persist 内部已提示 */ }
              dispatch({ type: "lock", stage: "epscript", cost: 30 });
            }}
          >
            <Check size={14} /> 保存分镜·去视频工厂
          </button>
        </div>
      )}
      {locked && (
        <div className="row gap-2 pop-in" style={{ position: "absolute", right: 24, bottom: 22, zIndex: 20, background: "var(--surface)", padding: 9, borderRadius: 15, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)" }}>
          <button type="button" className="btn btn-grad btn-sm" onClick={() => dispatch({ type: "jump", stage: "factory" })}>
            <ImageIcon size={13} /> 去视频工厂出片 <ArrowRight size={12} />
          </button>
        </div>
      )}
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
