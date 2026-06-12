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
  Wand2,
  X,
} from "lucide-react";
import { Avatar, Cost, Editable, GenSkeleton } from "@/components/drama-ui";
import { AiChatPanel, type ChatMsg } from "../ai-chat-panel";
import { ShotFormCard, type FormShot } from "../shot-form";
import { matById, type BoardShot, type Material, type ProjectData, type ScriptLine, type ScriptScene } from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";

const SHOT_GEN_COST = 6;

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
    flow: sh.done ? "clip" : "draft",
  };
}

export function EpScriptStage({ state, dispatch, data }: {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
}) {
  const keyChars = data.characters.filter((c) => c.role === "key");
  const speakerOptions = ["旁白", ...data.characters.map((c) => c.name)];

  const initScenes = React.useCallback((): EpScene[] => {
    return data.script.scenes.map((s, i) => {
      const refs = (i === 0 ? [matById("a1"), matById("r1")] : [matById("r1")]).filter(Boolean) as Material[];
      return { ...s, refs, lines: s.lines.map((l) => ({ ...l })) };
    });
  }, [data]);
  const initShots = React.useCallback((): Record<string, FormShot[]> => {
    const refsFor = (i: number) => (i === 0 ? [matById("a1"), matById("r1")] : [matById("r1")]).filter(Boolean) as Material[];
    return Object.fromEntries(
      data.storyboard.scenes.map((sc, i) => [sc.id, sc.shots.map((sh) => toFormShot(sh, refsFor(i)))]),
    );
  }, [data]);

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

  React.useEffect(() => {
    setScenes(initScenes());
    setShotsMap(initShots());
    setChat([{ who: "ai", text: `第 ${state.ep} 集脚本已按大纲起草好。想整体调整就跟我说,也可以点下面的快捷指令。` }]);
  }, [state.ep, initScenes, initShots]);

  /* —— AI 对话驱动整体重写 —— */
  const sendChat = (text: string) => {
    if (phase === "gen") return;
    setChat((c) => [...c, { who: "me", text }]);
    setPhase("gen");
    dispatch({ type: "spend", n: text === "衍生上一集" ? 8 : 10 });
    setTimeout(() => {
      setScenes(initScenes());
      setShotsMap(initShots());
      setPhase("done");
      setChat((c) => [
        ...c,
        {
          who: "ai",
          text:
            text === "衍生上一集"
              ? "已按上一集的人物关系和节奏衍生出本集脚本,钩子接得上,你看看。"
              : text === "给我惊喜"
                ? "给你换了个更狠的开场钩子,反转提前了一镜 —— 脚本已更新,看看够不够惊喜。"
                : "改好了 —— 脚本已更新,你再看看还哪里要调?",
        },
      ]);
    }, 1300);
  };

  /* —— 场景 / 台词草稿 —— */
  const updScene = (i: number, patch: Partial<EpScene>) =>
    setScenes((arr) => arr.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updLine = (si: number, li: number, patch: Partial<ScriptLine>) =>
    setScenes((arr) => arr.map((s, j) => (j === si ? { ...s, lines: s.lines.map((l, k) => (k === li ? { ...l, ...patch } : l)) } : s)));
  const addLine = (si: number, who: string) =>
    setScenes((arr) => arr.map((s, j) => (j === si ? { ...s, lines: [...s.lines, { who, text: "" }] } : s)));
  const delLine = (si: number, li: number) =>
    setScenes((arr) => arr.map((s, j) => (j === si ? { ...s, lines: s.lines.filter((_, k) => k !== li) } : s)));

  /* —— 分镜 —— */
  const updShot = (sceneId: string, id: string, patch: Partial<FormShot>) =>
    setShotsMap((m) => ({ ...m, [sceneId]: (m[sceneId] ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const delShot = (sceneId: string, id: string) =>
    setShotsMap((m) => ({ ...m, [sceneId]: (m[sceneId] ?? []).filter((s) => s.id !== id).map((s, i) => ({ ...s, no: i + 1 })) }));
  const addShot = (sceneId: string, sceneIdx: number) =>
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
  const genShots = (sceneId: string, sceneIdx: number) => {
    setGenScene(sceneId);
    dispatch({ type: "spend", n: SHOT_GEN_COST });
    setTimeout(() => {
      const donor = data.storyboard.scenes.find((x) => x.shots.length > 0);
      setShotsMap((m) => ({
        ...m,
        [sceneId]: (donor?.shots ?? []).slice(0, 3).map((sh, i) =>
          toFormShot({ ...sh, id: sceneId + "-n" + i, no: i + 1, done: false }, scenes[sceneIdx]?.refs ?? []),
        ),
      }));
      setGenScene(null);
      toast.success("本场分镜已拆好,逐镜表单可直接改");
    }, 1400);
  };
  const render = (sceneId: string, id: string, to: FormShot["flow"], cost: number, msg: string) => {
    setBusy({ id, to });
    dispatch({ type: "spend", n: cost });
    setTimeout(() => {
      setBusy(null);
      updShot(sceneId, id, { flow: to });
      toast.success(msg);
    }, 1400);
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
              <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, width: 64, flex: "none" }}>核心人物</span>
                {keyChars.map((c) => (
                  <span key={c.id} className="row" style={{ padding: "2px 9px 2px 2px", borderRadius: 999, background: "var(--accent-soft)", gap: 5 }}>
                    <Avatar theme={c.avatar} size={18} bound={c.bound} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>{c.name}</span>
                  </span>
                ))}
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
                          {/* 加一句台词:先选旁白还是角色 */}
                          <div className="row gap-1" style={{ flexWrap: "wrap", marginTop: 2 }}>
                            <span className="faint" style={{ fontSize: 10.5, alignSelf: "center" }}>加一句:</span>
                            {speakerOptions.map((w) => (
                              <button key={w} type="button" className="chip" style={{ height: 22, fontSize: 10.5 }} onClick={() => addLine(i, w)}>
                                <Plus size={10} /> {w}
                              </button>
                            ))}
                          </div>
                        </div>
                        {!locked && (
                          <button type="button" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => genShots(s.id, i)}>
                            <Wand2 size={13} /> 把这场拆成分镜表单 <Cost n={SHOT_GEN_COST} />
                          </button>
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
                          updShot(s.id, sh.id, { flow: "done" });
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
          <button type="button" className="btn btn-grad btn-sm" onClick={() => dispatch({ type: "lock", stage: "epscript", cost: 30 })}>
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
