"use client";

// 逐集制作 ① 分镜（界面名；StageKey 仍是 epscript）— 结构化分镜表(参照「短剧分镜V2 · 结构化版-适配Web表单」):
// 本集剧情 + 本集设定 + 按场分组的分镜表(镜号/时间线/画面/音频[人声+音效+BGM]/镜头参数/特效氛围),
// 首帧列按 首帧 → 视频 渐进生成。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Clapperboard,
  Maximize2,
  Plus,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { USE_MOCK } from "@/api/_client";
import { Avatar, CreditMark, Editable, GenSkeleton, dramaConfirm } from "@/components/drama-ui";
import { ConfirmDialog } from "@/components/common";
import { type FormShot } from "../shot-form";
import { StoryboardTable } from "../storyboard-table";
import { RenderModelSelect, priceBlockReason, renderCreditCost } from "../render-model-select";
import { EPOCH_ISO, laterIso, lastFrameOf, planShotRecovery, resetMarkForNewShots } from "./epscript-recovery";
import { useShotRender } from "@/lib/use-shot-render";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { episodeContent, episodeTitle, getEpisodeDoc, matById, MATERIALS, withEpisodeDoc, type BoardScene, type BoardShot, type Material, type ProjectData, type ScriptLine, type ScriptScene } from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";
import { ProjectsApi, RenderApi } from "@/api";
import { ApiError } from "@/api/_client";
import { useDramaConfig } from "@/lib/use-drama-config";
import type { StageContext } from "./stage-context";


/**
 * 轮询是否因超时返回（任务其实仍在后台跑，不能当失败丢弃，否则用户会重新提交造成双重扣费）。
 * 与 shorts/make/page.tsx 的 isPollTimeout 同一模式，与 RenderApi.POLL_TIMEOUT_MESSAGE 做**全等**比较。
 */
function isPollTimeout(job: { status?: string; error_message?: string | null }): boolean {
  return job.status === "failed" && job.error_message === RenderApi.POLL_TIMEOUT_MESSAGE;
}

interface EpScene extends ScriptScene {
  refs: Material[];
}

/**
 * 落库的镜头 + 对账分界 resetAt（见 ./epscript-recovery.ts）。
 * BoardShot 定义在 mocks/drama-workshop/types.ts（不归本簇），字段加进去之前先用交叉类型带着；
 * 服务端整存整取 payloadJson，不认识的字段原样保留。
 */
type BoardShotWithReset = BoardShot & { resetAt?: string };

/**
 * 在途表的一行：这一镜点了生成、还没结束的那条任务。
 * - jobId：提交回执里的任务号，回执还没回来时是 null。
 * - gen：提交那一刻这一镜的「代」（见 genRef）。镜头被整体替换后代会变，这条任务的结果就不再属于它。
 */
interface Inflight {
  jobId: string | null;
  kind: "frame" | "clip";
  gen: number;
}

/** 刷新后第一次对账最多等多久（毫秒）。等不到就按老办法放行，不让按钮一直转。 */
const FIRST_SYNC_WAIT_MS = 8000;

function toFormShot(sh: BoardShotWithReset, refs: Material[]): FormShot {
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
    flow: normalizeFlow(sh),
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
    appliedRefs: sh.appliedRefs,
    resetAt: sh.resetAt,
  };
}

/**
 * 归一化历史 flow：
 * - 旧版「已锁首帧 frameLocked」→ frame，避免旧数据落入无按钮死状态；
 * - 标了 done / clip 却没有视频文件（老数据、演示数据）→ 有首帧回到 frame，没有就 draft。
 *   否则界面会在一张没有视频的格子上挂「待确认 / 就用这版」，跟实际对不上。
 */
function normalizeFlow(sh: BoardShot): FormShot["flow"] {
  const hasFrame = !!(sh.frameUrl || sh.frameUrls?.length);
  const raw = sh.flow === "frameLocked" ? "frame" : ((sh.flow as FormShot["flow"] | undefined) ?? (sh.done ? "clip" : "draft"));
  if ((raw === "clip" || raw === "done") && !sh.videoUrl) return hasFrame ? "frame" : "draft";
  if (raw === "frame" && !hasFrame) return "draft";
  return raw;
}

/** FormShot → BoardShot（落库形态；engine 沿用旧值，缺省 seedance）。 */
function toBoardShot(sh: FormShot, prevEngine?: BoardShot["engine"]): BoardShotWithReset {
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
    appliedRefs: sh.appliedRefs,
    resetAt: sh.resetAt,
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
  // 最近一次拉到的后台任务列表（给新镜头算 resetAt 用，见 ./epscript-recovery.ts）。
  const lastTasksRef = React.useRef<RenderApi.DramaRenderTask[] | null>(null);
  // 在途表：「这一镜有没有任务在跑」的真值（同步可读，render() 靠它挡重复提交）；busyMap 只是它的显示。
  // 本页点了生成的、和后台对账看到还在跑的都记在这里。后台对账拉列表可能早于服务端建好任务，
  // 那一刻列表里没有它；不认这张表的话会把「生成中」清掉，按钮又能点，再点一次就是第二次扣费。
  const inflightRef = React.useRef<Map<string, Inflight>>(new Map());
  // 每一镜的「代」：镜头被整体替换（按剧情重写本集 / 让 AI 拆这一场 / 删掉这一镜）时 +1。
  // 新镜头和旧镜头同 id（sc_<集>_<场>_s<镜>），还在跑的旧任务回来时按 id 找得到新镜头 ——
  // 提交时记下代，回填前比一下，代变了就丢掉，不往新镜头上写。
  const genRef = React.useRef<Map<string, number>>(new Map());
  const genOf = React.useCallback((id: string) => genRef.current.get(id) ?? 0, []);
  // 已经填过的任务号：单任务轮询和后台对账可能都拿到同一条结果，晚到的那次会把用户之后改过的
  // 首帧（AI 改图）盖回去。每条任务只填一次。
  const appliedRef = React.useRef<Set<string>>(new Set());
  // 进页后第一次对账：它回来之前在途表是空的，render() 先等它，不然已经有任务在跑的镜头会被再提交一次。
  const firstSyncRef = React.useRef<Promise<void> | null>(null);
  // 镜间一致性承接：出首帧/出片时额外参考「角色图 + 场景参考图 + 同场上一镜画面」，保持人物/环境/光线连贯。
  // C-3：参考装配已下沉服务端（render 传 shot_ref，服务端按项目文档 + 角色/场景实体自装配）。
  const [chainConsistency, setChainConsistency] = React.useState(true);
  // C-3 逐镜渲染共享引擎（提交 + 轮询 + 出片模型选择；D-11 候选端点缺省 → 走后端默认）。
  const shotRender = useShotRender({ projectId: ctx?.projectId, ratio: data.projectInfo.ratio, kind: "shot" });
  const renderModels = shotRender.models;
  // 候选模型（含单价）还没读到 / 读失败：报价只能按全局价猜，服务端却按默认模型的价扣 → 按模型计价的生成先停用。
  const priceBlock = priceBlockReason(renderModels.status);
  // 分镜表全屏放大（与内联共用同一份表，编辑实时同步），对齐短视频「放大」体验。
  const [tableMax, setTableMax] = React.useState(false);
  // 放大弹层：ESC 关闭 + Tab 焦点圈定（打开时才启用）。
  const tableMaxRef = React.useRef<HTMLDivElement>(null);
  useModalA11y(tableMaxRef, () => setTableMax(false), tableMax);
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

  /** 落库（v0.66）：本地 scenes/shotsMap → episodeDocs[当前集]，切集互不覆盖。
   *  v0.197：改用 patchData 按**最新**文档合并。原来用渲染时的 data 整份 saveData —— 1.5s 防抖期间
   *  若在角色面板绑了数字人（角色区 600ms 先落库），这边晚到的保存会把旧角色列表写回去。 */
  const persist = React.useCallback(
    async (scenesNext: EpScene[], shotsNext: Record<string, FormShot[]>) => {
      if (!ctx) return;
      await ctx.patchData((base) => {
      const curDoc = getEpisodeDoc(base, state.ep);
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
      return withEpisodeDoc(base, state.ep, {
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
        });
      });
    },
    [ctx, state.ep],
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
      // 定时器到点时取**最新**的 persist（绑定最新 ctx），不用排程那一刻闭包里的旧函数。
      void persistRef.current(scenesRef.current, shotsRef.current).catch(() => {});
    }, 1500);
  }, [ctx, locked]);
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
  /** 这条任务结束了：在途表里记的正是它才删（回执还没回来的新提交不能被别的任务的结果解锁）。 */
  const settle = React.useCallback((id: string, jobId: string) => {
    const inf = inflightRef.current.get(id);
    if (inf && inf.jobId !== jobId) return;
    inflightRef.current.delete(id);
    clearBusy(id);
  }, [clearBusy]);
  /** 这些镜头要被整体替换：代 +1（还在跑的旧任务回来也不填），在途和「生成中」一起清掉。 */
  const retireShots = React.useCallback((ids: Iterable<string>) => {
    const list = Array.from(new Set(ids));
    for (const id of list) {
      genRef.current.set(id, (genRef.current.get(id) ?? 0) + 1);
      inflightRef.current.delete(id);
    }
    setBusyMap((m) => {
      const next = { ...m };
      for (const id of list) delete next[id];
      return next;
    });
  }, []);

  /**
   * 新镜头的 resetAt。AI 返回之后现拉一次任务列表：点重写之前（以及 AI 写的这几秒里）旧镜头
   * 提交的任务都在里面，取其中最新的 created_at 当分界（服务端时间，不受浏览器时钟影响）。
   */
  const freshResetMark = async (): Promise<string> => {
    const now = new Date().toISOString();
    if (!ctx?.projectId) return resetMarkForNewShots(lastTasksRef.current, now);
    try {
      const snap = await RenderApi.listRenderTasks(ctx.projectId);
      lastTasksRef.current = snap.tasks;
      return resetMarkForNewShots(snap.tasks, now);
    } catch {
      return resetMarkForNewShots(lastTasksRef.current, now);
    }
  };

  /** 真实 AI 重写整集（分场 + 分镜）。instruction 追加到剧情后（可选）。 */
  const runEpDraft = async (cost: number, instruction?: string) => {
    if (phase === "gen") return;
    // v0.88：本集叙事(plot)为空就点「基于剧情重新生成分场分镜」→ 后端会 400 DRAMA_PLOT_REQUIRED。
    // 友好提示去填，不打会失败的请求（与脑暴大纲守卫同理）。
    if (ctx && !(plot || "").trim() && !(instruction || "").trim()) {
      toast("先在「本集剧情」里写几句这一集讲什么，AI 按它来拆分镜。");
      return;
    }
    setPhase("gen");
    if (!ctx) {
      // 脱离工作台的演示态
      setTimeout(() => {
        setScenes(initScenes());
        setShotsMap(initShots());
        setPhase("done");
        toast.success("已按剧情重写这一集的分镜");
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
      // 新镜头和旧镜头同 id（sc_<集>_<场>_s<镜>）：旧镜头的后台任务不能被对账填进新镜头。
      const mark = await freshResetMark();
      const scenesNext: EpScene[] = res.scenes.map((s, i) => ({ ...s, refs: defaultRefs(i) }));
      const shotsNext: Record<string, FormShot[]> = Object.fromEntries(
        res.boardScenes.map((bs, i) => [bs.id, bs.shots.map((sh) => ({ ...toFormShot(sh, defaultRefs(i)), resetAt: mark }))]),
      );
      // 旧镜头还在跑的任务作废：换代 + 清在途 / 生成中（新镜头 id 和它们一样，不能让结果写进新镜头）。
      retireShots([...Object.values(shotsRef.current).flat(), ...Object.values(shotsNext).flat()].map((x) => x.id));
      // ref 跟着同步换掉：下一次后台对账可能在这次重渲染之前就回来，按旧表算会把旧结果填进新镜头。
      scenesRef.current = scenesNext;
      shotsRef.current = shotsNext;
      setScenes(scenesNext);
      setShotsMap(shotsNext);
      await persist(scenesNext, shotsNext);
      void cost; // 扣费在服务端；这里只让余额重读一次
      notifyWalletChanged();
      setPhase("done");
      toast.success("已按剧情重写这一集的分镜");
    } catch (e) {
      setPhase("done");
      toast.error(aiErrorMessage(e, "分镜生成失败，请稍后重试"));
    }
  };

  /** 按剧情重写本集分镜：会整体替换 scenes + shotsMap，已生成的首帧 / 视频一起丢掉 → 一律先确认、写清会丢什么。 */
  const regenFromPlot = async () => {
    if (phase === "gen") return;
    const rows = Object.values(shotsRef.current).flat();
    const frameN = rows.filter((x) => !!(x.frameUrl || x.frameUrls?.length)).length;
    const videoN = rows.filter((x) => !!x.videoUrl).length;
    const runningN = rows.filter((x) => inflightRef.current.has(x.id)).length;
    const lost: string[] = [];
    if (frameN) lost.push(`${frameN} 张首帧`);
    if (videoN) lost.push(`${videoN} 条视频`);
    // 还在生成的那几镜：结果回来也不会再填进表里（镜头换了），积分照扣。
    const runningNote = runningN ? `有 ${runningN} 个镜头还在生成，生成完也不会放进新的分镜表。` : "";
    const ok = await dramaConfirm({
      cost: cfg.prices.epscript,
      tone: lost.length || runningN ? "danger" : "default",
      title: rows.length ? "按剧情重写本集分镜？" : "按剧情生成本集分镜？",
      body: rows.length
        ? (lost.length || runningN
          ? `AI 会按「本集剧情」重写这一集所有的场次和分镜。表里现在的 ${rows.length} 个镜头会被替换${lost.length ? `，已生成的 ${lost.join("、")}也会一起去掉` : ""}。${runningNote}已花的积分不退。`
          : `AI 会按「本集剧情」重写这一集所有的场次和分镜，表里现在的 ${rows.length} 个镜头会被替换。`)
        : "AI 会按「本集剧情」拆出这一集的场次和分镜，拆完每一镜都能改。",
      confirmLabel: rows.length ? "重写分镜" : "生成分镜",
    });
    if (ok) void runEpDraft(cfg.prices.epscript);
  };

  /** v0.97 P5：行级就地改写本镜（对齐 ViMax design_storyboard 逐镜可控，替代整篇推倒重写浮窗）。 */
  const [rewritingId, setRewritingId] = React.useState<string | null>(null);
  const rewriteShot = async (sceneId: string, shotId: string, instruction: string) => {
    const shot = (shotsMap[sceneId] ?? []).find((s) => s.id === shotId);
    if (!shot || !instruction.trim() || rewritingId) return;
    if (!ctx?.projectId) {
      toast.error("还没保存好，稍等几秒再试");
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
      toast.success("这一镜改好了");
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
  // 生成结果回填：updater 里只算新表，落库排到这次渲染提交之后（persistTick effect）。
  // 以前在 setShotsMap 的 updater 里直接调 persist —— persist 会 setState 父组件的保存状态，
  // React 报「Cannot update a component while rendering a different component」。
  const [persistTick, setPersistTick] = React.useState(0);
  React.useEffect(() => {
    if (persistTick === 0) return;
    void persistRef.current(scenesRef.current, shotsRef.current).catch(() => {});
  }, [persistTick]);
  const applyRenderPatch = React.useCallback(
    (sceneId: string, id: string, patch: Partial<FormShot> | ((cur: FormShot) => Partial<FormShot>)) => {
      setShotsMap((m) => ({
        ...m,
        [sceneId]: (m[sceneId] ?? []).map((s) => (s.id === id ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s)),
      }));
      setPersistTick((t) => t + 1);
    },
    [],
  );
  /** 这一镜现在在哪一场（按最新的表找）。 */
  const sceneOfShot = (id: string): string | undefined => {
    for (const [sceneId, list] of Object.entries(shotsRef.current)) if (list.some((x) => x.id === id)) return sceneId;
    return undefined;
  };
  // 两个回填函数都先过两道闸：① 代没变（镜头没被替换，gen 是提交 / 对账那一刻记下的）；
  // ② 这条任务没填过（appliedRef）。过不了的只解锁、不写镜头。
  const applyFrameResult = React.useCallback(
    (sceneId: string, id: string, job: RenderApi.DramaFrameJob | RenderApi.DramaRenderTask, gen: number, msg: string, announce: boolean) => {
      if (genOf(id) !== gen) return; // 旧镜头的任务（retireShots 已经清过在途）
      const frames = job.frames ?? job.result?.frames ?? [];
      if (job.status === "failed") {
        settle(id, job.id);
        if (announce) toast.error(job.error_message || "首帧生成失败，请重试");
        return;
      }
      if (job.status !== "ready" || frames.length === 0) return;
      settle(id, job.id);
      if (appliedRef.current.has(job.id)) return;
      appliedRef.current.add(job.id);
      // 重新出首帧（含「从头重做」）→ 清掉基于旧首帧的尾帧/拆镜/视频产物，避免新首帧配旧尾帧（首尾不同源）。
      // jobId 一起清，resetAt 挪到这次首帧任务的创建时间（只往后挪，laterIso）：比它早的视频任务都是旧首帧的，
      // 后台对账不会再把它们填回来（./epscript-recovery.ts 的 afterFrameRestore 是同一套）。
      applyRenderPatch(sceneId, id, (cur) => ({
        flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url,
        endFrameUrl: undefined, ffDesc: undefined, lfDesc: undefined, motionDesc: undefined, variationType: undefined,
        videoUrl: undefined, lastFrameUrl: undefined, jobId: undefined,
        resetAt: laterIso(cur.resetAt, job.created_at) ?? new Date().toISOString(),
        appliedRefs: job.applied_refs ?? job.result?.applied_refs,
      }));
      notifyWalletChanged(); // 扣费在服务端；这里只让余额重读一次
      if (announce) toast.success(msg);
    },
    [applyRenderPatch, genOf, settle],
  );
  const applyClipResult = React.useCallback(
    (sceneId: string, id: string, job: RenderApi.DramaEpisodeJob | RenderApi.DramaRenderTask, gen: number, msg: string, announce: boolean) => {
      if (genOf(id) !== gen) return;
      if (job.status === "failed") {
        settle(id, job.id);
        if (announce) toast.error(job.error_message || "视频生成失败，请重试");
        return;
      }
      if (job.status !== "ready" || !job.video_url) return;
      settle(id, job.id);
      if (appliedRef.current.has(job.id)) return;
      appliedRef.current.add(job.id);
      // applied_refs 只在 renderClip 提交响应上（轮询卡不带）——这里不覆盖，沿用提交时落的值。
      // 末帧：单任务查询在顶层，任务列表里只在 source 里（lastFrameOf 两处都看）。
      applyRenderPatch(sceneId, id, { flow: "clip", videoUrl: job.video_url ?? undefined, lastFrameUrl: lastFrameOf(job), jobId: job.id });
      notifyWalletChanged();
      if (announce) toast.success(msg);
    },
    [applyRenderPatch, genOf, settle],
  );
  // 查进度出错（网络断了一下、网关 502）≠ 任务失败：任务可能还在跑。这时不解锁 —— 解锁了用户再点就是第二次扣费；
  // 交给后台对账接着查（列表里有就按列表，列表里没了就单查，查无此任务才解锁）。
  const watchFrameJob = React.useCallback(
    async (jobId: string, sceneId: string, id: string, gen: number, msg: string, announce: boolean) => {
      try {
        const done = await RenderApi.pollFrameJob(jobId, { timeoutMs: 240_000 });
        if (genOf(id) !== gen) return;
        if (isPollTimeout(done)) {
          // 超时 ≠ 失败：任务仍在后台跑，保留 busy 态（按钮不可再点），交给后台任务轮询对账，不清空、不重扣。
          if (announce) toast("首帧还在后台生成，稍后回到这页看");
          return;
        }
        applyFrameResult(sceneId, id, done, gen, msg, announce);
      } catch {
        if (genOf(id) === gen && announce) toast("首帧的进度暂时没查到，好了会自动显示在分镜表里");
      }
    },
    [applyFrameResult, genOf],
  );
  const watchClipJob = React.useCallback(
    async (jobId: string, sceneId: string, id: string, gen: number, msg: string, announce: boolean) => {
      try {
        const done = await RenderApi.pollClipJob(jobId, { timeoutMs: 240_000 });
        if (genOf(id) !== gen) return;
        if (isPollTimeout(done)) {
          if (announce) toast("视频还在后台生成，稍后回到这页看");
          return;
        }
        applyClipResult(sceneId, id, done, gen, msg, announce);
      } catch {
        if (genOf(id) === gen && announce) toast("视频的进度暂时没查到，好了会自动显示在分镜表里");
      }
    },
    [applyClipResult, genOf],
  );
  // 有进行中任务时才轮询 render/tasks：busyMap 非空（出图/出片中）或某镜出片未出成片（jobId 未成）。
  // 空闲时不轮询，避免后台一直刷；提交新任务使 pendingCount 变化 → effect 重启轮询。
  const pendingCount = React.useMemo(() => {
    let n = Object.keys(busyMap).length;
    for (const rows of Object.values(shotsMap)) for (const s of rows) if (s.jobId && !s.videoUrl) n++;
    return n;
  }, [busyMap, shotsMap]);
  // 立刻对账一次（render() 在第一次对账之前被点时用；effect 挂上之后才有）。
  const syncNowRef = React.useRef<(() => Promise<void>) | null>(null);
  React.useEffect(() => {
    if (!ctx?.projectId) return;
    let cancelled = false;
    const FRAME_MSG = "首帧好了，挑一张满意的再生成视频";
    const CLIP_MSG = "这一镜的视频好了";
    /** 在途任务从列表里消失了（服务端列表只返回最近 50 条首帧、合并后截到 80 条）：单查一次。 */
    const lookupMissing = async (shotId: string, inf: Inflight & { jobId: string }) => {
      try {
        if (inf.kind === "frame") {
          const job = await RenderApi.getFrameJob(inf.jobId);
          const sceneId = sceneOfShot(shotId);
          if (!cancelled && sceneId) applyFrameResult(sceneId, shotId, job, inf.gen, FRAME_MSG, false);
        } else {
          const job = await RenderApi.getClipJob(inf.jobId);
          const sceneId = sceneOfShot(shotId);
          if (!cancelled && sceneId) applyClipResult(sceneId, shotId, job, inf.gen, CLIP_MSG, false);
        }
      } catch (e) {
        // 查无此任务 → 解锁；别的错（网络）留着锁，下一轮再查。
        if (!cancelled && e instanceof ApiError && e.status === 404 && genOf(shotId) === inf.gen) settle(shotId, inf.jobId);
      }
    };
    const syncTasks = async () => {
      // 拉列表这段时间里被替换掉的镜头（代变了）这一轮不碰，下一轮按新镜头算。
      const genAtStart = new Map(genRef.current);
      const stable = (id: string) => genOf(id) === (genAtStart.get(id) ?? 0);
      try {
        const snap = await RenderApi.listRenderTasks(ctx.projectId);
        if (cancelled) return;
        lastTasksRef.current = snap.tasks;
        const shotToScene = new Map<string, string>();
        const rows: FormShot[] = [];
        Object.entries(shotsRef.current).forEach(([sceneId, list]) => {
          list.forEach((row) => {
            if (!stable(row.id)) return;
            shotToScene.set(row.id, sceneId);
            rows.push(row);
          });
        });
        // 哪条任务填回哪一镜：规则和理由都在 ./epscript-recovery.ts（有单测）。
        // 视频：有 jobId 认它和它之后的新任务；没 jobId（回执没存下来就刷新了）认 resetAt 之后的任务。
        // 首帧：认比 resetAt 新的那次首帧任务（「从头重做」刷新后也能回来，并清掉旧视频和尾帧）。
        const plan = planShotRecovery(rows, snap.tasks, state.ep);
        // 先填首帧、再填视频：同一镜两样都有时，视频是按「填完首帧之后」算的（首帧回填会清掉旧视频）。
        plan.frames.forEach((task, shotId) => {
          const sceneId = shotToScene.get(shotId);
          if (sceneId) applyFrameResult(sceneId, shotId, task, genOf(shotId), FRAME_MSG, false);
        });
        plan.videos.forEach((task, shotId) => {
          const sceneId = shotToScene.get(shotId);
          if (sceneId) applyClipResult(sceneId, shotId, task, genOf(shotId), CLIP_MSG, false);
        });
        // 在途表：列表里还在跑的（只算这一镜分界之后的）记进去 —— render() 同步读它挡重复提交。
        const byId = new Map(snap.tasks.map((t) => [t.id, t]));
        const missing: Array<[string, Inflight & { jobId: string }]> = [];
        for (const shotId of shotToScene.keys()) {
          const act = plan.active.get(shotId);
          if (act) {
            inflightRef.current.set(shotId, { jobId: act.taskId, kind: act.kind, gen: genOf(shotId) });
            continue;
          }
          const inf = inflightRef.current.get(shotId);
          // 没在跑 / 本页刚提交、回执还没回来（保持生成中，回执回来后按任务号接着认）
          if (!inf || !inf.jobId) continue;
          const seen = byId.get(inf.jobId);
          if (!seen) missing.push([shotId, { ...inf, jobId: inf.jobId }]);
          else if (seen.status === "ready" || seen.status === "failed") inflightRef.current.delete(shotId); // 结果在上面 / 各自的轮询里填
        }
        const busyNow = new Map<string, "frame" | "clip">();
        for (const shotId of shotToScene.keys()) {
          const inf = inflightRef.current.get(shotId);
          if (inf) busyNow.set(shotId, inf.kind);
        }
        setBusyMap((prev) => {
          const next = { ...prev };
          for (const shotId of shotToScene.keys()) {
            const kind = busyNow.get(shotId);
            if (kind) next[shotId] = prev[shotId] ?? kind;
            else delete next[shotId];
          }
          return next;
        });
        for (const [shotId, inf] of missing) void lookupMissing(shotId, inf);
      } catch {
        // 辅助恢复失败不影响脚本编辑。
      }
    };
    // 「第一次对账」记的是本次 effect 自己发起的那一次；effect 被拆掉（切集、开发模式下 StrictMode 挂两遍、
    // pendingCount 变了重挂）时它可能还没填在途表就被 cancelled 了，清掉让下一次挂上后的那次顶上。
    let ownFirst: Promise<void> | null = null;
    const markFirst = (p: Promise<void>) => {
      if (!firstSyncRef.current) firstSyncRef.current = ownFirst = p;
      return p;
    };
    const run = () => {
      if (cancelled || document.hidden) return;
      markFirst(syncTasks());
    };
    syncNowRef.current = () => markFirst(syncTasks());
    run(); // 进页 / 切集 / 任务起止时对齐一次
    const onVis = () => { if (!document.hidden) run(); }; // 切回前台立即补一次（进页时在后台标签里也靠它补上第一次）
    document.addEventListener("visibilitychange", onVis);
    const timer = pendingCount === 0 ? null : window.setInterval(run, 5000); // 无进行中任务 → 不定时轮询
    return () => {
      cancelled = true;
      syncNowRef.current = null;
      if (ownFirst && firstSyncRef.current === ownFirst) firstSyncRef.current = null;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // sceneOfShot 只读 ref，不进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyClipResult, applyFrameResult, genOf, settle, ctx?.projectId, state.ep, pendingCount]);
  // 删除本镜：先二次确认（§8 禁裸删），确认后再删。镜号每场从 1 起，标题里带上场号才分得清。
  const [delTarget, setDelTarget] = React.useState<{ sceneId: string; id: string; no: number; sceneNo: number } | null>(null);
  const askDelShot = (sceneId: string, id: string) => {
    const sh = (shotsRef.current[sceneId] ?? []).find((s) => s.id === id);
    const sceneNo = scenesRef.current.findIndex((x) => x.id === sceneId) + 1;
    setDelTarget({ sceneId, id, no: sh?.no ?? 0, sceneNo });
  };
  const delShot = (sceneId: string, id: string) => {
    // 这一镜还在跑的任务作废（它的 id 以后可能被「让 AI 拆分镜」重新用上）。
    retireShots([id]);
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
            // id 带时间戳、不会和任何旧镜头重复 → 之后的任务都算它的。
            resetAt: EPOCH_ISO,
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
      toast("这场还没写内容，先加了一个空白镜头，可以直接在分镜表里填画面和台词。");
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
        // 拆出来的镜头 id 是 <场>_s<镜>，和这场以前的镜头同 id → 同样要打分界，还在跑的旧任务作废。
        const mark = await freshResetMark();
        const nextShots = shots.map((sh) => ({ ...toFormShot(sh, scene.refs), resetAt: mark }));
        retireShots([...(shotsRef.current[sceneId] ?? []), ...nextShots].map((x) => x.id));
        // 按最新的表改（AI 拆的这几秒里别的场可能改过），ref 同步换掉（理由同 runEpDraft）。
        const next = { ...shotsRef.current, [sceneId]: nextShots };
        shotsRef.current = next;
        setShotsMap((m) => ({ ...m, [sceneId]: nextShots }));
        await persist(scenesRef.current, next);
      }
      toast.success("这场的分镜拆好了，分镜表里可以直接改");
    } catch (e) {
      toast.error(aiErrorMessage(e, "拆分镜失败，请稍后重试"));
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
  // C-3：参考图装配（出场角色 @cast→文本名→全员、场景参考、同场上一镜真实末帧、同场下一镜尾帧）已整体
  // 下沉服务端 —— render 只传 shot_ref（镜头坐标 + chainConsistency），服务端按 payloadJson + 角色/场景实体
  // 自装配并按端点 capability 裁剪、回报 applied_refs。前端不再拼 refImages（删 shotRefImages / sceneRefUrlFor /
  // prevFrameInScene / nextFrameInScene）。本镜坐标 → shot_ref 的构造器：
  const shotRefFor = React.useCallback(
    (sceneId: string, shotId: string) => ({
      episodeNo: state.ep, sceneId, shotId, chainConsistency,
    }),
    [state.ep, chainConsistency],
  );
  /** 出片前一致性体检用：本场是否已备场景参考图（显式绑定 sceneRefId 或按场名匹配到场景资产）。纯 UI 提示。 */
  const sceneHasRef = (sceneId: string): boolean => {
    const sc = scenesRef.current.find((s) => s.id === sceneId);
    const assets = data.scenes ?? [];
    if (sc?.sceneRefId && assets.some((a) => a.id === sc.sceneRefId && (a.refUrl || a.refImages?.length))) return true;
    const place = sc?.place ?? "";
    return assets.some((a) => (a.refUrl || a.refImages?.length) && a.name && a.name.length >= 2 && place.includes(a.name));
  };

  /** 单镜生成：frame=首帧参考图（后台图片任务，出 2 版），clip=直接出片/成片（后台视频任务 + 轮询，带首尾帧）。 */
  /** 出图/出片前一致性体检（P0 系统交互）：出场角色缺定妆图 / 本场未绑场景 / 同场上一镜未出片（无法承接真实末帧）。 */
  const shotConsistencyIssues = (sceneId: string, shot: FormShot, to: FormShot["flow"]): string[] => {
    const issues: string[] = [];
    for (const cid of shot.cast ?? []) {
      const c = data.characters.find((x) => x.id === cid);
      if (c && !c.avatarImage && !c.refUrl) issues.push(`「${c.name}」还没有定妆照，这一镜的长相可能和别的镜对不上`);
    }
    if (chainConsistency && !sceneHasRef(sceneId)) {
      issues.push("这场还没选场景图，各镜的环境可能对不上");
    }
    // 串行提示仅在出片时给（首帧批量生成不打扰）：直出无首帧时最需要承接上一镜真实末帧。
    if (to === "clip" && chainConsistency && !(shot.frameUrl ?? shot.frameUrls?.[0])) {
      const rows = shotsRef.current[sceneId] ?? [];
      const idx = rows.findIndex((x) => x.id === shot.id);
      if (idx > 0 && !rows[idx - 1].videoUrl) {
        issues.push("同一场的上一镜还没生成视频，这一镜接不上它的最后一帧。建议按镜头顺序一镜一镜生成");
      }
    }
    return issues;
  };

  /** 旧镜头提交的任务回执在镜头被替换之后才回来：它的创建时间可能晚于新镜头的分界，分界挪到它后面。 */
  const pushFloorPast = (id: string, createdAt?: string) => {
    if (!createdAt || inflightRef.current.has(id)) return;
    const sceneId = sceneOfShot(id);
    if (sceneId) applyRenderPatch(sceneId, id, (cur) => ({ resetAt: laterIso(cur.resetAt, createdAt) }));
  };

  const render = async (sceneId: string, id: string, to: FormShot["flow"], msg: string) => {
    if (priceBlock) {
      toast(priceBlock);
      return;
    }
    // 刷新后第一次对账还没回来时在途表是空的：先等它（最多 FIRST_SYNC_WAIT_MS），再判这一镜是不是已经有任务在跑。
    // 不能靠 busyMap —— CreditButton 调的是点击那一刻的 onConfirm，闭包里的 busyMap 是旧的。
    let first = firstSyncRef.current;
    if (!first && syncNowRef.current) first = syncNowRef.current();
    if (first) await Promise.race([first, new Promise((r) => setTimeout(r, FIRST_SYNC_WAIT_MS))]);
    const shot = (shotsRef.current[sceneId] ?? []).find((s) => s.id === id);
    // 在途表是同步的：连点两下、或者对账刚发现它在跑，这里都挡得住（第二次提交 = 第二次扣费）。
    if (!shot || inflightRef.current.has(id) || decomposingRef.current === id) return;
    // 出片前一致性体检（P0）已前置到出片按钮（CreditButton getWarnings）——费用确认与一致性警告合并为
    // 单个 danger 弹窗（见 storyboardTable getClipWarnings）；此处不再二次弹窗，确保任何路径只弹一次（v0.103）。
    const gen = genOf(id);
    const kind = to === "frame" ? "frame" : "clip";
    markBusy(id, to);
    inflightRef.current.set(id, { jobId: null, kind, gen });
    // 老镜头没有对账分界：提交前按已知任务补一个（这之前的任务都不算这一镜的），刷新后才认得回这次提交。
    // 列表还没拉到就不补（只能拿浏览器时间，时钟偏了反而会把这次提交挡在外面），走老数据的规则。
    if (!shot.resetAt && lastTasksRef.current) {
      applyRenderPatch(sceneId, id, { resetAt: resetMarkForNewShots(lastTasksRef.current, new Date().toISOString()) });
    }
    try {
      if (to === "frame") {
        // C-3：只传 shot_ref，服务端自装配参考（角色/场景/上一镜末帧）+ 按 capability 裁剪。
        const job = await shotRender.submitFrameJob({
          vars: shotVars(shot, "frame", sceneId),
          count: 2,
          shotRef: shotRefFor(sceneId, id),
          name: `第${state.ep}集 第${shot.no}镜 首帧`,
        });
        // 等回执这段时间镜头被整体替换了（重写本集 / 重拆这一场）：这条任务属于旧镜头，不记、不盯。
        if (genOf(id) !== gen) return pushFloorPast(id, job.created_at);
        inflightRef.current.set(id, { jobId: job.id, kind, gen });
        toast.success("首帧生成中，好了会自动显示在分镜表里");
        void watchFrameJob(job.id, sceneId, id, gen, msg, true);
      } else {
        const ownFrame = shot.frameUrl ?? shot.frameUrls?.[0];
        // C-3：本镜已锁首帧 / 拆镜末帧显式传入（in-memory 优先）；直出无首帧 + 尾帧的镜间承接
        // （上一镜真实末帧 / 下一镜开场首帧）由服务端按 shot_ref 派生。
        const job = await shotRender.renderClip({
          vars: shotVars(shot, "clip", sceneId),
          name: `第${state.ep}集 第${shot.no}镜 视频`,
          durationSec: shot.dur,
          sceneId,
          shotId: id,
          episodeNo: state.ep,
          target: ownFrame ? "frame-clip" : "direct",
          frameUrl: ownFrame,
          lastFrameUrl: shot.endFrameUrl,
          shotRef: shotRefFor(sceneId, id),
        });
        if (genOf(id) !== gen) return pushFloorPast(id, job.created_at);
        inflightRef.current.set(id, { jobId: job.id, kind, gen });
        applyRenderPatch(sceneId, id, { jobId: job.id, appliedRefs: job.applied_refs });
        toast.success("视频生成中，好了会自动显示在分镜表里");
        void watchClipJob(job.id, sceneId, id, gen, msg, true);
      }
    } catch (e) {
      if (genOf(id) !== gen) return;
      // 只解开这次提交自己的锁（回执没回来 = jobId 还是 null）。
      if (inflightRef.current.get(id)?.jobId === null) {
        inflightRef.current.delete(id);
        clearBusy(id);
      }
      toast.error(aiErrorMessage(e, "生成失败，请稍后重试"));
    }
  };

  /** AI 拆镜（借鉴 ViMax）：单镜 → 首/末帧静态快照 + 运动 + 变化等级；末帧以本镜首帧为锚出图（首尾同源）。 */
  // 拆镜走同步接口、不产生带 shot_id 的后台任务，故用独立 busy 态（不能用 busyMap——会被 5s 任务轮询清掉）。
  const [decomposingId, setDecomposingId] = React.useState<string | null>(null);
  const decomposingRef = React.useRef<string | null>(null); // 同步可读（按钮闭包里的 decomposingId 可能是旧的）
  const decompose = async (sceneId: string, id: string) => {
    const shot = (shotsRef.current[sceneId] ?? []).find((s) => s.id === id);
    if (!shot || inflightRef.current.has(id) || decomposingRef.current) return;
    if (priceBlock) {
      toast(priceBlock);
      return;
    }
    if (!ctx?.projectId) {
      toast.error("还没保存好，稍等几秒再试");
      return;
    }
    // 上次动作描述补好了、只是尾帧画面没画出来 → 这次只重画尾帧：不再调拆镜接口，也就不再扣拆镜的积分
    // （按钮上报的是 endFrameRetryCost = 图片单价，见下面 StoryboardTable 的传参）。
    // 判断条件和 ShotFrameCell 里「重画尾帧」按钮的条件是同一个：有动作描述 + 有尾帧描述 + 没有尾帧图。
    const retryOnly = !!(shot.motionDesc && shot.lfDesc?.trim() && !shot.endFrameUrl);
    decomposingRef.current = id;
    setDecomposingId(id);
    try {
      let d: { ffDesc?: string; lfDesc?: string; motionDesc?: string; variationType?: string };
      if (retryOnly) {
        d = { ffDesc: shot.ffDesc, lfDesc: shot.lfDesc, motionDesc: shot.motionDesc, variationType: shot.variationType };
      } else {
        const castNames = (shot.cast ?? []).map((cid) => data.characters.find((c) => c.id === cid)?.name).filter((n): n is string => !!n);
        d = await ProjectsApi.decomposeShot(ctx.projectId, { desc: shot.visual || "", cast: castNames });
      }
      let endFrameUrl: string | undefined;
      let frameError: unknown;
      if (d.lfDesc?.trim()) {
        try {
          const ownFrame = shot.frameUrl ?? shot.frameUrls?.[0];
          // C-3：末帧以本镜首帧为锚（refLeading 置顶）+ shot_ref 自装配角色/场景，保首尾同源。
          const { frames } = await shotRender.renderFrame({
            vars: { ...shotVars(shot, "frame", sceneId), visual: d.lfDesc },
            shotRef: shotRefFor(sceneId, id),
            refLeading: ownFrame ? [ownFrame] : undefined,
            count: 1,
          });
          endFrameUrl = frames[0]?.url;
        } catch (e) {
          frameError = e; // 尾帧没画出来：动作描述照样留着，按钮变成「重画尾帧」只重试这一步
        }
      }
      applyRenderPatch(sceneId, id, {
        ffDesc: d.ffDesc,
        lfDesc: d.lfDesc,
        motionDesc: d.motionDesc,
        variationType: d.variationType,
        endFrameUrl,
      });
      if (endFrameUrl) toast.success("尾帧补好了，生成视频时会从首帧过渡到尾帧");
      else if (!d.lfDesc?.trim()) toast("动作描述补好了，但 AI 没写出结尾的画面，生成视频时只用首帧");
      else {
        const why = frameError ? aiErrorMessage(frameError, "出图失败") : "";
        toast(`尾帧画面没画出来${why ? `：${why}` : ""}。可以点「重画尾帧」再试，不补的话生成视频时只用首帧`);
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "补尾帧失败，请稍后重试"));
    } finally {
      decomposingRef.current = null;
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
  // 悬浮条的进度按「有没有视频」算 —— 和合成成片同一口径（有视频的镜头都会拼进去）。
  const videoCount = allShots.filter((x) => !!x.videoUrl).length;
  // 本集已经有花过钱的产物（首帧 / 视频）→「按剧情重写本集分镜」降级成次要按钮。
  const hasGenerated = allShots.some((x) => !!(x.frameUrl || x.frameUrls?.length || x.videoUrl));
  const scrollToFirstTodo = () => {
    const first = allShots.find((x) => !x.videoUrl);
    if (!first) return;
    const el = document.querySelector(`[data-shot-id="${CSS.escape(first.id)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // 报价跟着分镜表上选的模型走（服务端按命中候选的单价扣，按秒计费的视频再乘时长），
  // 别再直接用 cfg.prices.frame / clip —— 选了贵的模型，确认框却按全局价报，实扣会高出好几倍。
  const imageCost = renderCreditCost({
    models: renderModels.models, lane: "image", endpointId: renderModels.imageEndpointId, fallback: cfg.prices.frame,
  });
  const clipCostFor = (shot: Pick<FormShot, "dur">) => renderCreditCost({
    models: renderModels.models, lane: "video", endpointId: renderModels.videoEndpointId, fallback: cfg.prices.clip,
    durationSec: shot.dur,
  });

  // 分镜表元素：内联与「放大」全屏弹层共用同一份（同一组 state/handlers，编辑实时同步）。
  const storyboardTable = (
    <StoryboardTable
      scenes={scenes}
      sceneAssets={data.scenes ?? []}
      characters={data.characters.map((c) => ({ id: c.id, name: c.name }))}
      shotsMap={shotsMap}
      speakerOptions={speakerOptions}
      locked={locked}
      frameCost={imageCost}
      clipCost={cfg.prices.clip}
      clipCostFor={clipCostFor}
      splitCost={cfg.prices.splitScene}
      // 补尾帧 = 拆镜（动作描述）+ 用所选图片模型画一张尾帧；只重画尾帧时只有后一半。
      endFrameCost={cfg.prices.decompose + imageCost}
      endFrameRetryCost={imageCost}
      imageEndpointId={renderModels.imageEndpointId}
      priceBlock={priceBlock}
      rewriteCost={cfg.prices.shotRewrite}
      busyMap={decomposingId ? { ...busyMap, [decomposingId]: "frame" } : busyMap}
      starts={starts}
      genScene={genScene}
      onUpdScene={updScene}
      onUpdShot={updShot}
      onDelShot={askDelShot}
      onAddShot={addShot}
      onGenShots={genShots}
      // 下面几个都挂在 CreditButton 的 onConfirm 上：把 Promise 交回去，它等动作结束再刷新余额
      // （不交回去就只能按 1.5 秒猜）。所以这些动作函数自己不再调 notifyWalletChanged。
      onRender={(sceneId, shotId, kind) =>
        kind === "frame"
          ? render(sceneId, shotId, "frame", "首帧好了，挑一张满意的再生成视频")
          : render(sceneId, shotId, "clip", "这一镜的视频好了，满意可以点「就用这版」")
      }
      // 只重做视频：render("clip") 带着本镜现有的首帧 / 尾帧（frameUrl / endFrameUrl）提交，
      // 结果回填只改 videoUrl / lastFrameUrl / jobId / flow，首帧和尾帧原样保留。
      onRedoClip={(sceneId, shotId) => render(sceneId, shotId, "clip", "新视频好了，满意可以点「就用这版」")}
      onApprove={(sceneId, shotId) => {
        const next = { ...shotsMap, [sceneId]: (shotsMap[sceneId] ?? []).map((x) => (x.id === shotId ? { ...x, flow: "done" as const } : x)) };
        setShotsMap(next);
        void persist(scenes, next);
        toast.success("这一镜已确认");
      }}
      // AI 改了首帧 → 旧尾帧图是照着旧首帧画的，去掉（打开改图前 StoryboardTable 已经确认过）。
      // 不去掉的话下一次生成视频会拿新首帧配旧尾帧，首尾对不上。动作描述是按画面文字写的，留着：
      // 格子上会出现「重画尾帧」，照新首帧再画一张尾帧（只扣出图的积分）。
      onFrameEdited={(sceneId, shotId, frameUrl) => updShot(sceneId, shotId, { frameUrl, frameUrls: [frameUrl], endFrameUrl: undefined })}
      onDecompose={(sceneId, shotId) => decompose(sceneId, shotId)}
      rewritingId={rewritingId}
      onRewriteShot={(sceneId, shotId, instruction) => rewriteShot(sceneId, shotId, instruction)}
      getClipWarnings={(sceneId, shot) => shotConsistencyIssues(sceneId, shot, "clip")}
      onGoSceneAssets={() => dispatch({ type: "jump", stage: "cast" })}
    />
  );

  return (
    <div className="col" style={{ height: "100%", minHeight: 0, position: "relative" }}>
      <div className="scroll grow" style={{ minHeight: 0 }}>
        {/* 整宽容器：分镜表放开到整宽，上半部信息卡保持易读窄宽（左对齐同起点）。 */}
        <div className="ep-wrap">
          {/* ===== 本集剧情(先改剧情,再让 AI 按它重写分镜) ===== */}
          <div className="card" style={{ padding: "14px 16px", marginBottom: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 8, alignItems: "center", flexWrap: "wrap", rowGap: 8 }}>
              <span className="num tag tag-accent" style={{ flex: "none" }}>第 {state.ep} 集</span>
              <span style={{ fontWeight: 800, fontSize: 14, flex: "1 1 160px", minWidth: 0, maxWidth: 320, overflow: "hidden" }}>
                {locked ? (epOutline ? episodeTitle(epOutline) : "本集剧情") : (
                  <Editable value={epOutline?.title ?? ""} placeholder="给这一集起个标题" onCommit={saveEpTitle} />
                )}
              </span>
              <span className="grow" style={{ minWidth: 12 }} />
              {!locked && (
                <button
                  type="button"
                  onClick={() => void regenFromPlot()}
                  className={hasGenerated ? "btn btn-line btn-sm" : "btn btn-grad btn-sm"}
                  style={{ flex: "none", whiteSpace: "nowrap" }}
                  disabled={phase === "gen"}
                  title="改完剧情后点这里，AI 按新剧情重写这一集的分镜"
                >
                  <RefreshCw size={13} /> {allShots.length ? "按剧情重写本集分镜" : "按剧情生成本集分镜"}
                  <CreditMark tone={hasGenerated ? "gold" : "inherit"} size={13} />
                </button>
              )}
            </div>
            <div className="faint" style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 2 }}>本集剧情</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.75 }}>
              <Editable block value={plot} placeholder="写这一集讲什么：开头怎么抓人、中间发生什么、结尾留什么悬念" onCommit={saveEpContent} style={{ display: "block" }} />
            </div>
          </div>

          {/* ===== 本集设定 ===== */}
          <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
            <div className="row gap-2" style={{ marginBottom: 10, alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
              <Clapperboard size={15} style={{ color: "var(--accent)", flex: "none" }} />
              <span className="ep-setting-title" style={{ fontWeight: 800, fontSize: 13.5 }}>本集设定</span>
              <span className="faint ws-topbar-sub" style={{ fontSize: 11, minWidth: 0 }}>这一集每个镜头都会用到</span>
              <span className="grow" />
              <span className="tag tag-accent num" style={{ flex: "none" }}>本集时长 {totalDur} 秒</span>
            </div>
            <div className="col gap-2" style={{ fontSize: 13 }}>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 56, flex: "none", marginTop: 3 }}>画面风格</span>
                <span className="grow" style={{ minWidth: 0 }}><Editable block value={style} placeholder="如：悬疑、冷色调、快节奏" onCommit={(v) => { setStyle(v); queueSave(); }} /></span>
              </div>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 56, flex: "none", marginTop: 4 }}>出场人物</span>
                <CastEditor cast={cast} onChange={(next) => { setCast(next); queueSave(); }} disabled={locked} />
              </div>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 56, flex: "none", marginTop: 3 }}>拍摄场景</span>
                <span className="grow muted" style={{ minWidth: 0, fontSize: 12.5 }}>
                  {scenes.map((s) => s.place.replace(/^(内景|外景)\s*·\s*/, "")).join(" / ")}
                </span>
              </div>
            </div>
          </div>

          {phase === "gen" && (
            <div className="card" style={{ padding: 18 }}>
              <GenSkeleton lines={4} label={`正在按剧情重写第 ${state.ep} 集分镜…`} />
            </div>
          )}

          {/* ===== 分镜表（设计稿平铺表格 · 结构化字段喂视频生成提示词；整宽展示） ===== */}
          {phase === "done" && (
            <>
              <div className="row gap-2" style={{ alignItems: "center", margin: "2px 0 4px", flexWrap: "wrap", rowGap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 14.5, flex: "none" }}>分镜表</span>
                <span className="faint" style={{ fontSize: 11, flex: "none" }}>文字点一下就能改</span>
                <span className="grow" />
                {allShots.length > 0 && (
                  <button type="button" className="chip ep-hide-sm" style={{ height: 24, fontSize: 11 }} title="全屏查看分镜表" onClick={() => setTableMax(true)}>
                    <Maximize2 size={12} /> 放大
                  </button>
                )}
                {!locked && (
                  <RenderModelSelect lane="image" models={renderModels.models}
                    value={renderModels.imageEndpointId} onChange={renderModels.setImageEndpointId} />
                )}
                {!locked && (
                  <RenderModelSelect lane="video" models={renderModels.models}
                    value={renderModels.videoEndpointId} onChange={renderModels.setVideoEndpointId} />
                )}
                {!locked && renderModels.status === "failed" && (
                  <span className="row gap-1" role="status" style={{ alignItems: "center", minWidth: 0, maxWidth: "100%", fontSize: 11, color: "var(--warn, #d97706)" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={priceBlock ?? undefined}>
                      没读到模型和价格，生成先停用
                    </span>
                    <button type="button" className="chip ep-chip-touch" style={{ height: 22, fontSize: 10.5, flex: "none" }} onClick={renderModels.retry}>
                      重试
                    </button>
                  </span>
                )}
                {!locked && (
                  <label className="row gap-2 ep-chip-touch" style={{ alignItems: "center", cursor: "pointer", fontSize: 11.5, color: "var(--ink-2)" }} title="打开后，出首帧和生成视频时会参考同一场上一镜的画面和场景图，人物、环境、光线更连贯">
                    <input type="checkbox" checked={chainConsistency} onChange={(e) => setChainConsistency(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--accent)" }} />
                    接着上一镜的画面生成
                  </label>
                )}
              </div>
              {/* 每一镜的步骤常显（手机上没有 hover，别只写在 title 里）。
                  「就用这版」只是标记：合成成片时有视频的镜头都会拼进去（DramaAssembleService 按 videoUrl 取）。 */}
              {allShots.length > 0 && (
                <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6, marginBottom: 10 }}>
                  每一镜：先出首帧 → 挑一张 → 生成视频（生成前可以补尾帧；满意的视频可以点「就用这版」做个标记）。按镜头顺序做，后一镜能接上前一镜的画面。
                </div>
              )}
              {/* 本集还没有分镜：一行说明指向「按剧情生成本集分镜」（按钮就在本集剧情卡上，悬浮条的「先拆分镜」也走它），
                  这里不再放第三个同样的按钮。 */}
              {allShots.length === 0 && (
                <div className="card ep-sb-none" role="status">
                  {locked
                    ? "这一集还没有分镜。"
                    : "这一集还没有分镜。点「按剧情生成本集分镜」，AI 按「本集剧情」拆好场次和镜头，拆完每一镜都能改。"}
                </div>
              )}
              {/* 一场都没有时表格只剩表头，不画；有场次没镜头时每场自带「加一镜 / 让 AI 拆分镜」 */}
              {scenes.length > 0 && storyboardTable}
            </>
          )}
        </div>
      </div>

      {/* 悬浮条：进度 + 去合成成片。脚本始终可回改，不再锁定。 */}
      {phase === "done" && (
        <div className="ep-cta pop-in">
          <span className="faint num ep-cta-note">
            {allShots.length === 0 ? "这一集还没有分镜" : `已出视频 ${videoCount}/${allShots.length} 镜`}
          </span>
          {allShots.length === 0 ? (
            // 下一步是拆分镜，不是生成视频：直接走同一个「按剧情生成本集分镜」（带扣费确认）。
            !locked && (
              <button type="button" className="btn btn-grad btn-sm" onClick={() => void regenFromPlot()}>
                先拆分镜 <CreditMark tone="inherit" size={12} />
              </button>
            )
          ) : videoCount === 0 ? (
            <button type="button" className="btn btn-line btn-sm" onClick={scrollToFirstTodo}>
              先给镜头生成视频
            </button>
          ) : (
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
              下一步：合成成片 <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* 分镜表全屏放大：与内联共用同一份表（编辑实时同步），对齐短视频「放大」体验。 */}
      {tableMax && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="分镜表全屏"
          onClick={(e) => { if (e.target === e.currentTarget) setTableMax(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,10,30,.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: "3vh 2vw" }}
        >
          <div ref={tableMaxRef} tabIndex={-1} className="col" style={{ width: "min(1400px, 97vw)", height: "94vh", background: "var(--bg)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)", outline: "none" }}>
            <div className="row gap-2" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
              <Clapperboard size={16} style={{ color: "var(--accent)", flex: "none" }} />
              <span style={{ fontWeight: 800, fontSize: 15, flex: "none" }}>分镜表 · 第 {state.ep} 集</span>
              <span className="tag tag-accent num" style={{ flex: "none" }}>共 {allShots.length} 镜 · {totalDur} 秒</span>
              <span className="grow" />
              <span className="faint ws-topbar-sub" style={{ fontSize: 11.5 }}>点单元格直接改</span>
              <button type="button" className="btn btn-icon btn-sm" title="退出全屏" aria-label="退出全屏" onClick={() => setTableMax(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="scroll grow" style={{ minHeight: 0, padding: "18px 22px 28px" }}>
              {storyboardTable}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(next) => { if (!next) setDelTarget(null); }}
        title={delTarget ? `删除场 ${delTarget.sceneNo} 的第 ${delTarget.no} 镜？` : "删除这一镜？"}
        description="这一镜的画面、台词，以及已生成的首帧、尾帧和视频都会删掉，不能恢复。"
        confirmLabel="删除"
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

const TEMP_SUGGESTS = ["路人甲", "路人乙", "路人丙"];

function CastEditor({ cast, onChange, disabled }: { cast: EpCharacter[]; onChange: (next: EpCharacter[]) => void; disabled?: boolean }) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  // 「从素材库选」读的是本地演示素材（MATERIALS），不是用户真实的素材库 —— 只在演示模式下给，
  // 真实模式下不拿演示人物冒充用户素材（接上素材库接口前先隐藏）。
  const matPeople = USE_MOCK ? MATERIALS.filter((m) => m.cat === "人物" && !cast.some((c) => c.name === m.name)) : [];

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
            <span title={c.name} style={{ fontSize: 11.5, fontWeight: 700, color: c.theme ? "var(--accent)" : "var(--ink-2)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle" }}>{c.name}</span>
            {c.removable && !disabled && (
              <button type="button" className="ep-sb-iconbtn" title="移除这个人物" aria-label={`移除${c.name}`} onClick={() => onChange(cast.filter((x) => x.id !== c.id))} style={{ width: 22, height: 22, margin: "-2px -4px -2px -2px" }}>
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <button type="button" className="chip ep-chip-touch" style={{ height: 24, fontSize: 11 }} aria-expanded={adding} onClick={() => setAdding(!adding)}>
            <Plus size={11} /> 添加人物
          </button>
        )}
      </div>

      {adding && !disabled && (
        <div className="card col gap-2 pop-in" style={{ padding: "10px 12px", background: "var(--surface-2)", border: "1px dashed var(--line)" }}>
          {matPeople.length > 0 && (
            <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, flex: "none" }}>从演示素材里选</span>
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
              placeholder="比如：路人甲"
              aria-label="临时演员的名字"
              style={{ height: 26, width: 120, border: "1px solid var(--line)", borderRadius: 8, padding: "0 8px", fontSize: 11.5, outline: "none", background: "var(--surface)" }}
            />
            <button type="button" className="btn btn-primary btn-sm" style={{ height: 26, fontSize: 11 }} disabled={!name.trim()} onClick={() => addTemp(name)}>
              <Plus size={11} /> 添加
            </button>
            {TEMP_SUGGESTS.filter((t) => !cast.some((c) => c.name === t)).map((t) => (
              <button key={t} type="button" className="chip ep-chip-touch" style={{ height: 22, fontSize: 10.5 }} onClick={() => addTemp(t)}>
                {t}
              </button>
            ))}
          </div>
          <span className="faint" style={{ fontSize: 10 }}>加进来的人物会出现在分镜表「台词」的说话人里</span>
        </div>
      )}
    </div>
  );
}
