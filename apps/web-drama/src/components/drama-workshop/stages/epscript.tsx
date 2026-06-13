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
import { Avatar, CreditButton, Editable, GenSkeleton } from "@/components/drama-ui";
import { AiChatPanel, type ChatMsg } from "../ai-chat-panel";
import { ShotFormCard, type FormShot } from "../shot-form";
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
    (): EpCharacter[] =>
      data.characters.map((c) => ({ id: c.id, name: c.name, theme: c.avatar, bound: c.bound, removable: false })),
    [data],
  );
  const [cast, setCast] = React.useState<EpCharacter[]>(initCast);
  const speakerOptions = ["旁白", ...cast.map((c) => c.name)];

  /** 整集剧情(给人看的速览,不直接用于生成;改完可让 AI 按它重生成分场分镜) */
  const epOutline = data.episodes[state.ep - 1];
  const initPlot = React.useCallback(
    () => (epOutline ? `${epOutline.hook}。${epOutline.synopsis}` : data.projectInfo.logline),
    [epOutline, data],
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
  const [busy, setBusy] = React.useState<{ id: string; to: FormShot["flow"] } | null>(null);
  const [style, setStyle] = React.useState(() => `${data.projectInfo.type} · 强钩子快节奏 · 竖屏短平快`);
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
    setChat([{ who: "ai", text: `第 ${state.ep} 集脚本已按大纲起草好。想整体调整就跟我说,也可以点下面的快捷指令。` }]);
  }, [state.ep, initScenes, initShots, initCast, initPlot]);

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
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(scenesRef.current, shotsRef.current).catch(() => {});
    }, 1500);
  }, [ctx, locked, persist]);
  React.useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  /** 真实 AI 重写整集（分场 + 分镜）。instruction 追加到剧情后（对话驱动改写用）。 */
  const runEpDraft = async (cost: number, instruction?: string, aiReply?: string) => {
    if (phase === "gen") return;
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
      const msg = e instanceof Error ? e.message : "分场分镜生成失败，请稍后重试";
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
        : "改好了 —— 脚本已更新,你再看看还哪里要调?",
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
      toast.error(e instanceof Error ? e.message : "拆镜失败，请稍后重试");
    } finally {
      setGenScene(null);
    }
  };

  /** 单镜真实渲染：frame=首帧（图像），clip=直出/成片（视频任务 + 轮询）。 */
  const render = async (sceneId: string, id: string, to: FormShot["flow"], cost: number, msg: string) => {
    const shot = (shotsMap[sceneId] ?? []).find((s) => s.id === id);
    if (!shot) return;
    setBusy({ id, to });
    try {
      let patch: Partial<FormShot>;
      if (to === "frame") {
        const frames = await RenderApi.renderFrame({
          prompt: `${shot.visual}。景别：${shot.size}，运镜：${shot.move}。`,
          ratio: data.projectInfo.ratio,
          count: 1,
        });
        patch = { flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url };
      } else {
        const job = await RenderApi.renderClip({
          prompt: `${shot.visual}。景别：${shot.size}，运镜：${shot.move}。${shot.voText ? "台词：" + shot.voText : ""}`,
          name: `第${state.ep}集 镜${shot.no}`,
          durationSec: shot.dur,
          ratio: data.projectInfo.ratio,
          projectId: ctx?.projectId,
          frameUrl: shot.frameUrl,
        });
        const done = await RenderApi.pollClipJob(job.id, { timeoutMs: 240_000 });
        if (done.status === "failed") {
          throw new Error(done.error_message || "视频生成失败，请重试");
        }
        patch = { flow: "clip", videoUrl: done.video_url ?? undefined, jobId: job.id };
      }
      const next = {
        ...shotsMap,
        [sceneId]: (shotsMap[sceneId] ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      };
      setShotsMap(next);
      await persist(scenes, next);
      dispatch({ type: "spend", n: cost });
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "渲染失败，请稍后重试");
    } finally {
      setBusy(null);
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
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 28px 130px" }}>
          {locked && (
            <div className="row gap-3 fade-up" style={{ padding: "10px 14px", background: "var(--accent-soft)", borderRadius: 12, marginBottom: 14, color: "var(--accent)" }}>
              <Lock size={15} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>本集脚本已锁定,视频工厂以此为准 —— 仍可回改后重新通过。</span>
            </div>
          )}

          {/* ===== 本集剧情(先改剧情,再让 AI 按它重生成分场分镜) ===== */}
          <div className="card" style={{ padding: "14px 16px", marginBottom: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 8 }}>
              <span className="num tag tag-accent" style={{ flex: "none" }}>第 {state.ep} 集</span>
              <span style={{ fontWeight: 800, fontSize: 13.5 }}>本集剧情</span>
              {epOutline && <span className="tag tag-gray" style={{ flex: "none" }}>{epOutline.beat}</span>}
              <span className="faint" style={{ fontSize: 11 }}>给人看的速览,不直接喂给生成</span>
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
                  title="对下面的分场分镜不满意?改好剧情后点这里,AI 按它整集重写"
                >
                  <RefreshCw size={13} /> 基于剧情重新生成分场分镜
                </CreditButton>
              )}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.75 }}>
              <Editable block value={plot} placeholder="这一集大致讲什么…" onCommit={setPlot} style={{ display: "block" }} />
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
                <span className="grow" style={{ minWidth: 0 }}><Editable block value={style} placeholder="风格关键词…" onCommit={setStyle} /></span>
              </div>
              <div className="row gap-2" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 64, flex: "none", marginTop: 4 }}>出场人物</span>
                <CastEditor cast={cast} onChange={setCast} disabled={locked} />
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

          {/* ===== 按场分组的分镜表单 ===== */}
          {phase === "done" && (
            <div className="col gap-4">
              {scenes.map((s, i) => {
                const shots = shotsMap[s.id] ?? [];
                return (
                  <div key={s.id} className="col gap-2">
                    {/* 场分隔条 */}
                    <div className="row gap-2" style={{ marginTop: i === 0 ? 0 : 6 }}>
                      <span className="num tag tag-accent" style={{ flex: "none" }}>场 {i + 1}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <Editable value={s.place} placeholder="时空标题" onCommit={(v) => updScene(i, { place: v })} />
                      </span>
                      <span className="tag tag-gray" style={{ flex: "none" }}>
                        <Editable value={s.mood} placeholder="情绪" onCommit={(v) => updScene(i, { mood: v })} />
                      </span>
                      <span className="grow" style={{ height: 1, background: "var(--line-soft)" }} />
                      {shots.length > 0 && <span className="faint num" style={{ fontSize: 11, flex: "none" }}>{shots.length} 镜 · {shots.reduce((a, x) => a + x.dur, 0)}s</span>}
                      {!locked && shots.length > 0 && (
                        <button type="button" className="chip" style={{ height: 23, fontSize: 10.5, flex: "none" }} onClick={() => addShot(s.id, i)}>
                          <Plus size={11} /> 加一镜
                        </button>
                      )}
                    </div>

                    {/* 没拆镜:剧本草稿(动作 + 台词,可选说话人)+ AI 拆镜 */}
                    {shots.length === 0 && genScene !== s.id && (
                      <div className="card col gap-3" style={{ padding: "13px 15px", border: "1.5px dashed var(--line)" }}>
                        <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                          <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 64, flex: "none", marginTop: 3 }}>场面描述</span>
                          <span className="grow" style={{ minWidth: 0, fontSize: 13 }}>
                            <Editable block value={s.action} placeholder="这一场发生了什么…" onCommit={(v) => updScene(i, { action: v })} />
                          </span>
                        </div>
                        <div className="col gap-1">
                          {s.lines.map((l, j) => (
                            <div key={j} className="row gap-2" style={{ alignItems: "center" }}>
                              <select
                                value={speakerOptions.includes(l.who) ? l.who : l.who || "旁白"}
                                onChange={(e) => updLine(i, j, { who: e.target.value })}
                                style={{ height: 24, border: "1px solid var(--line)", borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: "var(--surface-2)", color: "var(--ink-2)", outline: "none", flex: "none" }}
                              >
                                {(speakerOptions.includes(l.who) ? speakerOptions : [l.who, ...speakerOptions]).map((w) => (
                                  <option key={w} value={w}>{w}</option>
                                ))}
                              </select>
                              <span className="grow" style={{ fontSize: 13, minWidth: 0 }}>
                                <Editable block value={l.text} placeholder="写一句台词 / 旁白…" onCommit={(v) => updLine(i, j, { text: v })} />
                              </span>
                              <button type="button" className="btn btn-icon btn-ghost btn-sm" style={{ width: 22, height: 22, flex: "none" }} onClick={() => delLine(i, j)}>
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          {/* 加一句对白:直接加一行,行内再选说话人(选项来自整集出场人物) */}
                          <button
                            type="button"
                            className="chip"
                            style={{ height: 24, fontSize: 11, alignSelf: "flex-start", marginTop: 2 }}
                            onClick={() => addLine(i)}
                          >
                            <Plus size={11} /> 加一句对白
                          </button>
                        </div>
                        {!locked && (
                          <CreditButton cost={cfg.prices.splitScene} onConfirm={() => genShots(s.id, i)} confirmTitle="拆分镜" confirmBody="AI 会把这一场拆成可逐镜编辑的分镜表单。" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }}>
                            <Wand2 size={13} /> 把这场拆成分镜表单
                          </CreditButton>
                        )}
                      </div>
                    )}
                    {genScene === s.id && (
                      <div className="card" style={{ padding: 14 }}>
                        <GenSkeleton lines={2} label="正在按台词与情绪拆镜头…" />
                      </div>
                    )}

                    {/* 已拆镜:逐镜表单卡 */}
                    {shots.map((sh) => (
                      <ShotFormCard
                        key={sh.id}
                        s={sh}
                        start={starts.get(sh.id) ?? 0}
                        colors={sh.flow === "draft" ? { from: "#cbd5e1", to: "#94a3b8" } : { from: "#fb923c", to: "#f472b6" }}
                        speakerOptions={speakerOptions}
                        busy={busy && busy.id === sh.id ? busy.to : null}
                        locked={locked}
                        onPatch={(patch) => updShot(s.id, sh.id, patch)}
                        onDelete={() => delShot(s.id, sh.id)}
                        onRenderFrame={() => render(s.id, sh.id, "frame", 2, "首帧已出,满意就渲成片")}
                        onRenderDirect={() => render(s.id, sh.id, "clip", 9, "分镜视频已生成,验收看看")}
                        onRenderClip={() => render(s.id, sh.id, "clip", 7, "成片已渲,验收看看")}
                        onApprove={() => {
                          const next = {
                            ...shotsMap,
                            [s.id]: (shotsMap[s.id] ?? []).map((x) => (x.id === sh.id ? { ...x, flow: "done" as const } : x)),
                          };
                          setShotsMap(next);
                          void persist(scenes, next);
                          toast.success("本镜已验收入片");
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 悬浮 AI 对话(左下):模板化提示词 衍生上一集 / 给我惊喜 */}
      <AiChatPanel msgs={chat} quick={["衍生上一集", "给我惊喜"]} busy={phase === "gen"} onSend={sendChat} />

      {/* 悬浮 CTA(右下) */}
      {phase === "done" && !locked && (
        <div className="row gap-2 pop-in" style={{ position: "absolute", right: 24, bottom: 22, zIndex: 20, background: "var(--surface)", padding: 9, borderRadius: 15, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)" }}>
          <span className="faint" style={{ fontSize: 11, alignSelf: "center", paddingLeft: 4 }}>脚本和分镜都满意了?</span>
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
            <Check size={14} /> 通过整集 · 进视频工厂
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
          <span className="faint" style={{ fontSize: 10 }}>加进来的人物会出现在下面每场对白和分镜人声的说话人选项里</span>
        </div>
      )}
    </div>
  );
}
