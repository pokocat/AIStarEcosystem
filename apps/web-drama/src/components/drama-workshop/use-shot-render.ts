"use client";

// use-shot-render — 短剧逐镜渲染引擎（共享 hook，v0.97 收敛）。
// 把原「视频工厂」的强能力（出图 4 版/选/锁帧、角色+场景+镜间承接参考图、首尾帧双关键帧、
// AI 拆镜、后台任务轮询/同步、批量出片、统一单价）抽成一处，供剧集脚本分镜表直接消费——
// 方案 B：剧集脚本分镜表 = 唯一逐镜工作面，不再有独立「视频工厂」阶段。
//
// 操作对象是 ProjectData.storyboard（按集 episodeDoc）派生的 RenderShot[]，渲染态写回落库。
import * as React from "react";
import { toast } from "sonner";
import { aiErrorMessage } from "@/lib/ai-error";
import { RenderApi, ProjectsApi } from "@/api";
import { useDramaConfig } from "@/lib/use-drama-config";
import { getEpisodeDoc, withEpisodeDoc, type BoardShot, type CharacterDef, type ProjectData } from "@/mocks/drama-workshop";
import type { StageContext } from "./stages/stage-context";

export type FlowKey = "draft" | "frame" | "frameLocked" | "clip" | "done";
export const FLOW_ORDER: FlowKey[] = ["draft", "frame", "frameLocked", "clip", "done"];
export const VARIATION_LABEL: Record<string, string> = { small: "小", medium: "中", large: "大" };

/** 渲染态镜头：BoardShot + 派生的场次定位 + 流水状态 + 场景参考图。 */
export interface RenderShot extends BoardShot {
  sceneId: string;
  place: string;
  sceneNo: number;
  flow: FlowKey;
  frameIdx: number;
  /** 该场绑定的场景参考图 URL（显式 sceneRefId 优先，否则按名称匹配 ProjectData.scenes）。 */
  sceneRefUrl?: string;
}

export interface UseShotRenderArgs {
  data: ProjectData;
  ep: number;
  chars: CharacterDef[];
  ctx?: StageContext;
  /** 乐观扣费回调（工作台 dispatch spend 的解耦封装）；不传则不做乐观扣减。 */
  onSpend?: (n: number) => void;
}

export interface SceneBinding {
  id: string;
  place: string;
  sceneNo: number;
  sceneRefId: string;
}

export function useShotRender({ data, ep, chars, ctx, onSpend }: UseShotRenderArgs) {
  const cfg = useDramaConfig();

  const build = React.useCallback((): RenderShot[] => {
    const list: RenderShot[] = [];
    const doc = getEpisodeDoc(data, ep);
    doc.storyboard.scenes.forEach((sc, si) => {
      const place = doc.script.scenes.find((x) => x.id === sc.id)?.place ?? `场景 ${si + 1}`;
      // 场景参考图：优先显式绑定（sceneRefId，P0-b），否则按名称把 place 关联到项目级 SceneAsset
      //（best-effort，仅"多一张参考图"，不命中也不影响）。
      const explicit = sc.sceneRefId ? (data.scenes ?? []).find((a) => a.id === sc.sceneRefId) : undefined;
      const sceneRefUrl =
        (explicit ??
          (data.scenes ?? []).find((a) => a.refUrl && a.name && a.name.length >= 2 && place.includes(a.name)))
          ?.refUrl;
      sc.shots.forEach((sh) =>
        list.push({
          ...sh,
          sceneId: sc.id,
          place,
          sceneNo: si + 1,
          sceneRefUrl,
          flow: (sh.flow as FlowKey) ?? (sh.done ? "clip" : "draft"),
          frameIdx: 0,
        }),
      );
    });
    return list;
  }, [data, ep]);

  const [shots, setShots] = React.useState<RenderShot[]>(build);
  React.useEffect(() => {
    setShots(build());
  }, [ep, build]);
  const upd = (id: string, patch: Partial<RenderShot>) =>
    setShots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /** 落库：把镜头渲染态写回 ProjectData.storyboard（缺 ctx 时跳过）。 */
  const persistShots = React.useCallback(
    async (arr: RenderShot[]) => {
      if (!ctx) return;
      const byId = new Map(arr.map((s) => [s.id, s]));
      const doc = getEpisodeDoc(data, ep);
      const scenes = doc.storyboard.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) => {
          const f = byId.get(sh.id);
          if (!f) return sh;
          return {
            ...sh,
            flow: f.flow,
            done: f.flow === "done",
            frameUrls: f.frameUrls,
            frameUrl: f.frameUrl,
            videoUrl: f.videoUrl,
            lastFrameUrl: f.lastFrameUrl,
            jobId: f.jobId,
            ffDesc: f.ffDesc,
            lfDesc: f.lfDesc,
            motionDesc: f.motionDesc,
            variationType: f.variationType,
            endFrameUrl: f.endFrameUrl,
          };
        }),
      }));
      await ctx.saveData(withEpisodeDoc(data, ep, { ...doc, storyboard: { ...doc.storyboard, scenes } }));
    },
    [ctx, data, ep],
  );

  /** 本集分场列表（场景参考绑定 UI 用）。 */
  const sceneList = React.useMemo<SceneBinding[]>(() => {
    const doc = getEpisodeDoc(data, ep);
    return doc.storyboard.scenes.map((sc, i) => ({
      id: sc.id,
      place: doc.script.scenes.find((x) => x.id === sc.id)?.place ?? `场景 ${i + 1}`,
      sceneNo: i + 1,
      sceneRefId: sc.sceneRefId ?? "",
    }));
  }, [data, ep]);

  /** 把某分场显式绑定到项目级场景资产（落库；该场出图并入其参考图，环境更一致）。 */
  const bindSceneRef = React.useCallback(
    async (sceneId: string, refId: string) => {
      if (!ctx) return;
      const doc = getEpisodeDoc(data, ep);
      const scenes = doc.storyboard.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, sceneRefId: refId || undefined } : sc,
      );
      await ctx.saveData(withEpisodeDoc(data, ep, { ...doc, storyboard: { ...doc.storyboard, scenes } }));
    },
    [ctx, data, ep],
  );

  const [busyMap, setBusyMap] = React.useState<Record<string, FlowKey>>({});
  // 镜间一致性承接：出首帧时额外参考「同场上一镜画面 + 场景参考图」，保持人物/环境/光线连贯。
  const [chainConsistency, setChainConsistency] = React.useState(true);
  const shotsRef = React.useRef(shots);
  React.useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  const markBusy = React.useCallback((id: string, to: FlowKey) => {
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

  const applyShotPatch = React.useCallback(
    (id: string, patch: Partial<RenderShot>) => {
      setShots((arr) => {
        const next = arr.map((x) => (x.id === id ? { ...x, ...patch } : x));
        void persistShots(next);
        return next;
      });
    },
    [persistShots],
  );

  const stat = {
    total: shots.length,
    framed: shots.filter((s) => FLOW_ORDER.indexOf(s.flow) >= FLOW_ORDER.indexOf("frameLocked")).length,
    done: shots.filter((s) => s.flow === "done").length,
  };
  const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 0;
  const draftCount = shots.filter((s) => s.flow === "draft").length;

  /** 镜头 → 生成提示词填充用 vars（模板在 server 端 drama.frame_image / drama.clip_video）。 */
  const shotVars = (s: RenderShot, mode: "frame" | "clip" = "frame"): Record<string, string> => {
    const castNames = (s.cast ?? [])
      .map((cid) => chars.find((c) => c.id === cid)?.name)
      .filter(Boolean)
      .join("、");
    // 拆镜后：首帧用 ffDesc（静态快照），出片用 motionDesc（运动描述）；未拆镜回退 desc。
    const visual = (mode === "clip" ? s.motionDesc : s.ffDesc)?.trim() || s.desc || s.place || "";
    return {
      visual,
      size: s.size || "",
      move: s.move || "",
      lineClause: s.line?.text ? `台词：${s.line.text}。` : "",
      castClause: castNames ? `出场人物：${castNames}。` : "",
      styleSuffix: `${data.projectInfo.type}风格。`,
    };
  };

  /** 同场上一镜的承接锚点——优先成片真实末帧（seedance return_last_frame），否则首帧（锁定优先）。 */
  const prevSceneFrame = (s: RenderShot): string | undefined => {
    const list = shotsRef.current.length ? shotsRef.current : shots;
    const idx = list.findIndex((x) => x.id === s.id);
    for (let i = idx - 1; i >= 0; i--) {
      const p = list[i];
      if (p.sceneId !== s.sceneId) break; // 跨场不承接（场切应换环境）
      const f = p.lastFrameUrl ?? p.frameUrl ?? p.frameUrls?.[p.frameIdx ?? 0] ?? p.frameUrls?.[0];
      if (f) return f;
    }
    return undefined;
  };

  /** 同场下一镜的开场首帧（锁定优先）——作本镜视频尾帧，使切镜更平滑（best-effort）。 */
  const nextSceneFrame = (s: RenderShot): string | undefined => {
    const list = shotsRef.current.length ? shotsRef.current : shots;
    const idx = list.findIndex((x) => x.id === s.id);
    for (let i = idx + 1; i < list.length; i++) {
      const n = list[i];
      if (n.sceneId !== s.sceneId) break;
      const f = n.frameUrl ?? n.frameUrls?.[n.frameIdx ?? 0] ?? n.frameUrls?.[0];
      if (f) return f;
    }
    return undefined;
  };

  /**
   * 出首帧参考图：角色绑定数字人/上传图（identity 优先）+（开承接时）场景参考图 + 同场上一镜画面。
   * extraLeading 在最前插入（如末帧出图把本镜首帧并入，保证首尾同源不漂移）。去重限 6 张。
   */
  const shotRefImages = (s: RenderShot, extraLeading?: (string | undefined)[]): string[] => {
    const charImgs = (s.cast ?? [])
      .map((cid) => {
        const c = chars.find((x) => x.id === cid);
        return c?.avatarImage || c?.refUrl || "";
      })
      .filter(Boolean);
    const all = [...(extraLeading ?? []).filter((x): x is string => !!x), ...charImgs];
    if (chainConsistency) {
      if (s.sceneRefUrl) all.push(s.sceneRefUrl);
      const prev = prevSceneFrame(s);
      if (prev) all.push(prev);
    }
    return Array.from(new Set(all)).slice(0, 6);
  };

  const applyFrameResult = React.useCallback(
    (id: string, job: RenderApi.DramaFrameJob | RenderApi.DramaRenderTask, spend: boolean) => {
      const frames = job.frames ?? job.result?.frames ?? [];
      if (job.status === "failed") {
        clearBusy(id);
        if (spend) toast.error(job.error_message || "首帧生成失败，请重试");
        return;
      }
      if (job.status !== "ready" || frames.length === 0) return;
      applyShotPatch(id, {
        flow: "frame" as FlowKey,
        frameUrls: frames.map((f) => f.url),
        frameIdx: 0,
        frameUrl: undefined,
        videoUrl: undefined,
      });
      clearBusy(id);
      if (spend) {
        onSpend?.(cfg.prices.frame);
        toast.success(`首帧已出 ${frames.length} 版,选定一版锁定`);
      }
    },
    [applyShotPatch, cfg.prices.frame, clearBusy, onSpend],
  );

  const applyClipResult = React.useCallback(
    (id: string, job: RenderApi.DramaEpisodeJob | RenderApi.DramaRenderTask, spend: boolean) => {
      if (job.status === "failed") {
        clearBusy(id);
        if (spend) toast.error(job.error_message || "视频生成失败，请重试");
        return;
      }
      if (job.status !== "ready" || !job.video_url) return;
      applyShotPatch(id, {
        flow: "clip" as FlowKey,
        videoUrl: job.video_url ?? undefined,
        // 成片真实末帧 → 下一镜首帧参考（链式承接闭环）。
        lastFrameUrl: job.last_frame_url ?? undefined,
        jobId: job.id,
      });
      clearBusy(id);
      if (spend) {
        onSpend?.(cfg.prices.clip);
        toast.success("视频已生成，验收看看");
      }
    },
    [applyShotPatch, cfg.prices.clip, clearBusy, onSpend],
  );

  const watchFrameJob = React.useCallback(
    async (jobId: string, shotId: string, spend: boolean) => {
      try {
        const done = await RenderApi.pollFrameJob(jobId, { timeoutMs: 240_000 });
        applyFrameResult(shotId, done, spend);
      } catch (e) {
        clearBusy(shotId);
        toast.error(aiErrorMessage(e, "首帧生成失败，请稍后重试"));
      }
    },
    [applyFrameResult, clearBusy],
  );

  const watchClipJob = React.useCallback(
    async (jobId: string, shotId: string, spend: boolean) => {
      try {
        const done = await RenderApi.pollClipJob(jobId, { timeoutMs: 240_000 });
        applyClipResult(shotId, done, spend);
      } catch (e) {
        clearBusy(shotId);
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
        const known = new Set(shotsRef.current.map((s) => s.id));
        const active: Record<string, FlowKey> = {};
        for (const task of snap.tasks) {
          const shotId = task.shot_id;
          if (!shotId || !known.has(shotId)) continue;
          if (task.episode_no && task.episode_no !== ep) continue;
          const current = shotsRef.current.find((s) => s.id === shotId);
          const isActiveTask = task.status === "queued" || task.status === "running" || task.status === "rendering";
          if (isActiveTask) active[shotId] = task.task_type === "frame" ? "frame" : "clip";
          if (task.task_type === "frame" && task.status === "ready" && (task.frames?.length || task.result?.frames?.length)) {
            if (!current?.frameUrls?.length) applyFrameResult(shotId, task, false);
          }
          if (task.task_type === "video" && task.status === "ready" && task.video_url) {
            if (current?.videoUrl !== task.video_url) applyClipResult(shotId, task, false);
          }
        }
        setBusyMap((prev) => {
          const next = { ...prev };
          for (const shotId of known) delete next[shotId];
          return { ...next, ...active };
        });
      } catch {
        // 后台任务状态是辅助信息，失败不打断当前编辑。
      }
    };
    void syncTasks();
    const timer = window.setInterval(syncTasks, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyClipResult, applyFrameResult, ctx?.projectId, ep]);

  /** 首帧生成（后台图片任务，出 4 版候选）。 */
  const renderFrame = async (id: string) => {
    const s = shots.find((x) => x.id === id);
    if (!s || isBusy(id)) return;
    markBusy(id, "frame");
    try {
      const job = await RenderApi.submitFrameJob({
        kind: "shot",
        vars: shotVars(s),
        refImages: shotRefImages(s),
        ratio: data.projectInfo.ratio,
        count: 4,
        projectId: ctx?.projectId,
        sceneId: s.sceneId,
        shotId: id,
        episodeNo: ep,
        name: `第${ep}集 镜${s.no} 首帧`,
      });
      toast.success("首帧已加入后台生成");
      void watchFrameJob(job.id, id, true);
    } catch (e) {
      clearBusy(id);
      toast.error(aiErrorMessage(e, "首帧生成失败，请稍后重试"));
    }
  };

  /** 视频生成（直接出片或基于已锁首帧；后台任务 + 轮询）。 */
  const renderVideo = async (id: string, useFrame: boolean) => {
    const s = shots.find((x) => x.id === id);
    if (!s || isBusy(id)) return;
    markBusy(id, "clip");
    try {
      const ownFrame = s.frameUrl ?? s.frameUrls?.[s.frameIdx];
      const firstFrame = useFrame ? ownFrame : chainConsistency ? prevSceneFrame(s) : undefined;
      // 尾帧（双关键帧）：优先拆镜末帧，否则同场下一镜开场首帧（seedance 支持，下游不支持忽略）。
      const endFrame = s.endFrameUrl ?? (chainConsistency ? nextSceneFrame(s) : undefined);
      const job = await RenderApi.renderClip({
        kind: "shot",
        vars: shotVars(s, "clip"),
        name: `第${ep}集 镜${s.no}`,
        durationSec: s.dur,
        ratio: data.projectInfo.ratio,
        projectId: ctx?.projectId,
        sceneId: s.sceneId,
        shotId: id,
        episodeNo: ep,
        target: useFrame ? "frame-clip" : "direct",
        frameUrl: firstFrame,
        lastFrameUrl: endFrame,
      });
      applyShotPatch(id, { jobId: job.id });
      toast.success("视频已加入后台生成");
      void watchClipJob(job.id, id, true);
    } catch (e) {
      clearBusy(id);
      toast.error(aiErrorMessage(e, "视频生成失败，请稍后重试"));
    }
  };

  const renderDirect = (id: string) => void renderVideo(id, false);
  const renderClip = (id: string) => void renderVideo(id, true);

  const lockFrame = (id: string) => {
    const next = shots.map((x) =>
      x.id === id ? { ...x, flow: "frameLocked" as FlowKey, frameUrl: x.frameUrls?.[x.frameIdx] ?? x.frameUrl } : x,
    );
    setShots(next);
    void persistShots(next);
    toast.success("首帧已锁，后续视频会基于这张画面生成");
  };
  const approve = (id: string) => {
    const next = shots.map((x) => (x.id === id ? { ...x, flow: "done" as FlowKey } : x));
    setShots(next);
    void persistShots(next);
    toast.success("本镜验收通过,已入片");
  };
  const reframe = (id: string) => void renderFrame(id);

  /**
   * 镜头分解（借鉴 ViMax）：单镜 → 首/末帧静态快照 + 运动描述 + 变化等级；并由末帧描述生成
   * 末帧关键帧图（出片时作 seedance 尾帧）。末帧出图把本镜首帧并入参考图，首尾同源不漂移。
   */
  const decompose = async (id: string) => {
    const s = shots.find((x) => x.id === id);
    if (!s || isBusy(id)) return;
    if (!ctx?.projectId) {
      toast.error("请先保存项目再拆镜");
      return;
    }
    markBusy(id, "frame");
    try {
      const cast = (s.cast ?? [])
        .map((cid) => chars.find((c) => c.id === cid)?.name)
        .filter((n): n is string => !!n);
      const d = await ProjectsApi.decomposeShot(ctx.projectId, { desc: s.desc || s.place || "", cast });
      // 末帧关键帧图（1 版，best-effort）：以本镜首帧为锚（首尾同源），失败不阻断。
      let endFrameUrl: string | undefined;
      if (d.lfDesc?.trim()) {
        try {
          const ownFrame = s.frameUrl ?? s.frameUrls?.[s.frameIdx];
          const frames = await RenderApi.renderFrame({
            kind: "shot",
            vars: { ...shotVars(s, "frame"), visual: d.lfDesc },
            refImages: shotRefImages(s, [ownFrame]),
            ratio: data.projectInfo.ratio,
            count: 1,
          });
          endFrameUrl = frames[0]?.url;
        } catch {
          /* 末帧出图失败：保留文本，尾帧走 nextSceneFrame 兜底 */
        }
      }
      applyShotPatch(id, {
        ffDesc: d.ffDesc,
        lfDesc: d.lfDesc,
        motionDesc: d.motionDesc,
        variationType: d.variationType,
        endFrameUrl,
      });
      onSpend?.(cfg.prices.decompose + (endFrameUrl ? cfg.prices.frame : 0));
      toast.success("已拆出首 / 末帧与运动描述");
    } catch (e) {
      toast.error(aiErrorMessage(e, "镜头分解失败，请稍后重试"));
    } finally {
      clearBusy(id);
    }
  };

  /** 批量首帧：批量入队，真实并发由后端任务池控制。 */
  const batchFrame = async () => {
    const drafts = shots.filter((s) => s.flow === "draft" && !isBusy(s.id));
    if (!drafts.length) {
      toast.success("没有待生成首帧的镜头");
      return;
    }
    let okCount = 0;
    for (const d of drafts) {
      markBusy(d.id, "frame");
      try {
        const job = await RenderApi.submitFrameJob({
          kind: "shot",
          vars: shotVars(d),
          refImages: shotRefImages(d),
          ratio: data.projectInfo.ratio,
          count: 4,
          projectId: ctx?.projectId,
          sceneId: d.sceneId,
          shotId: d.id,
          episodeNo: ep,
          name: `第${ep}集 镜${d.no} 首帧`,
        });
        void watchFrameJob(job.id, d.id, true);
        okCount++;
      } catch (e) {
        clearBusy(d.id);
        toast.error(`镜 ${d.no} 首帧失败：${aiErrorMessage(e, "未知错误")}`);
      }
    }
    if (okCount > 0) {
      toast.success(`已提交 ${okCount} 个首帧任务，后台会按顺序生成`);
    }
  };

  return {
    cfg,
    shots,
    setShots,
    upd,
    persistShots,
    sceneList,
    bindSceneRef,
    busyMap,
    isBusy,
    markBusy,
    clearBusy,
    chainConsistency,
    setChainConsistency,
    stat,
    pct,
    draftCount,
    shotVars,
    shotRefImages,
    prevSceneFrame,
    nextSceneFrame,
    renderFrame,
    renderVideo,
    renderDirect,
    renderClip,
    lockFrame,
    approve,
    reframe,
    decompose,
    batchFrame,
  };
}
