"use client";

// 剧集脚本(剧本 + 分镜合并) — 设计真源 v4 screens-episode-v4.jsx `ScriptBoardStage`:
// 顶部操作条(生成方式 / 视图切换)+ 场景卡片(默认,卡内承接本场分镜)/
// 脚本表格(平铺:时间 / 场景 / 视频脚本 / 语音 / 字幕 / 参考)+ 右下悬浮 CTA。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Copy,
  Edit,
  Film,
  Image as ImageIcon,
  Layers,
  Lock,
  Mic,
  Package,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { Avatar, Cost, Editable, GenSkeleton } from "@/components/drama-ui";
import { RefCell, RichScript, SubToggle } from "../script-refs";
import { SceneBlock } from "./scene-block";
import { matById, type BoardShot, type Material, type ProjectData, type ScriptLine, type ScriptScene } from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";

const SHOT_GEN_COST = 6;

/** 剧集脚本里的场景:剧本场景 + 参考素材 + 字幕开关 */
export interface EpScene extends ScriptScene {
  refs: Material[];
  sub: boolean;
}

const SRC_OPTS: { key: string; name: string; icon: React.ElementType; cost: number; hot?: boolean }[] = [
  { key: "template", name: "套爆款模板", icon: Layers, cost: 12, hot: true },
  { key: "derive", name: "衍生上一集", icon: Copy, cost: 8 },
  { key: "free", name: "AI 自由起草", icon: Wand2, cost: 22 },
];

interface EpScriptStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
}

export function EpScriptStage({ state, dispatch, data }: EpScriptStageProps) {
  const initScenes = React.useCallback((): EpScene[] => {
    const keyChar = data.characters.find((c) => c.role === "key" && c.bound);
    return data.script.scenes.map((s, i) => {
      const refs = (i === 0 ? [matById("a1"), matById("r1")] : [matById("r1")]).filter(Boolean) as Material[];
      let action = s.action;
      if (i === 0 && action && refs.length && keyChar && action.includes(keyChar.name)) {
        action = action.replace(keyChar.name, "[参考1] ");
      }
      return { ...s, action, refs, sub: true, lines: s.lines.map((l) => ({ ...l })) };
    });
  }, [data]);

  const [view, setView] = React.useState<"cards" | "sheet">("cards");
  const [source, setSource] = React.useState<string>("template");
  const [phase, setPhase] = React.useState<"gen" | "done">("done");
  const [scenes, setScenes] = React.useState<EpScene[]>(initScenes);
  const [shotsMap, setShotsMap] = React.useState<Record<string, BoardShot[]>>(() =>
    Object.fromEntries(data.storyboard.scenes.map((sc) => [sc.id, sc.shots])),
  );
  const [genScene, setGenScene] = React.useState<string | null>(null);
  const locked = !!state.lockedStages.epscript;

  React.useEffect(() => {
    setScenes(initScenes());
    setShotsMap(Object.fromEntries(data.storyboard.scenes.map((sc) => [sc.id, sc.shots])));
    setView("cards");
  }, [state.ep, initScenes, data.storyboard.scenes]);

  const regen = (src: string) => {
    setSource(src);
    setPhase("gen");
    const cost = SRC_OPTS.find((o) => o.key === src)?.cost ?? 12;
    dispatch({ type: "spend", n: cost });
    setTimeout(() => {
      setScenes(initScenes());
      setPhase("done");
      toast.success("剧本草稿已就绪,分镜会跟着场景联动");
    }, 1300);
  };

  const genShots = (sceneId: string) => {
    setGenScene(sceneId);
    dispatch({ type: "spend", n: SHOT_GEN_COST });
    setTimeout(() => {
      const donor = data.storyboard.scenes.find((x) => x.shots.length > 0);
      setShotsMap((m) => ({
        ...m,
        [sceneId]: (donor?.shots ?? [])
          .slice(0, 3)
          .map((sh, i) => ({ ...sh, id: sceneId + "-n" + i, no: i + 1, done: false })),
      }));
      setGenScene(null);
      toast.success("本场分镜已生成,提示词已挂到每个镜头");
    }, 1400);
  };

  const upd = (i: number, patch: Partial<EpScene>) =>
    setScenes((arr) => arr.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updLine = (si: number, li: number, patch: Partial<ScriptLine>) =>
    setScenes((arr) =>
      arr.map((s, j) =>
        j === si ? { ...s, lines: s.lines.map((l, k) => (k === li ? { ...l, ...patch } : l)) } : s,
      ),
    );
  const addLine = (si: number) =>
    setScenes((arr) =>
      arr.map((s, j) => (j === si ? { ...s, lines: [...s.lines, { who: "旁白", text: "" }] } : s)),
    );
  const delLine = (si: number, li: number) =>
    setScenes((arr) =>
      arr.map((s, j) => (j === si ? { ...s, lines: s.lines.filter((_, k) => k !== li) } : s)),
    );
  const delScene = (si: number) => setScenes((arr) => arr.filter((_, j) => j !== si));

  return (
    <div className="col" style={{ height: "100%", minHeight: 0, position: "relative" }}>
      {/* ===== 顶部操作条 ===== */}
      <div
        className="row"
        style={{
          padding: "10px 24px",
          gap: 10,
          borderBottom: "1px solid var(--line-soft)",
          background: "var(--surface)",
          flex: "none",
          flexWrap: "wrap",
        }}
      >
        {!locked && (
          <>
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700, flex: "none" }}>生成方式</span>
            <div className="row gap-1" style={{ flex: "none" }}>
              {SRC_OPTS.map((o) => {
                const OIcon = o.icon;
                return (
                  <button
                    key={o.key}
                    type="button"
                    className={"chip" + (source === o.key ? " on" : "")}
                    title={`约 ${o.cost} 积分`}
                    onClick={() => regen(o.key)}
                  >
                    <OIcon size={12} /> {o.name}
                    {o.hot && source !== o.key ? " ·推荐" : ""}
                  </button>
                );
              })}
            </div>
            <button type="button" className="chip" style={{ flex: "none" }} onClick={() => regen(source)}>
              <RefreshCw size={12} /> 重新生成
            </button>
          </>
        )}
        {locked && (
          <span className="row gap-2" style={{ color: "var(--accent)", fontSize: 12.5, fontWeight: 700 }}>
            <Lock size={14} /> 本集脚本已锁定,视频工厂以此为准
          </span>
        )}
        <span className="grow" />
        <div className="row" style={{ background: "var(--surface-2)", borderRadius: 999, padding: 3, gap: 2, flex: "none" }}>
          {(
            [
              ["cards", Film, "场景卡片"],
              ["sheet", Layers, "脚本表格"],
            ] as const
          ).map(([k, VIcon, label]) => (
            <button
              key={k}
              type="button"
              className="chip"
              onClick={() => setView(k)}
              style={{
                height: 26,
                background: view === k ? "var(--surface)" : "transparent",
                color: view === k ? "var(--accent)" : "var(--ink-3)",
                boxShadow: view === k ? "var(--shadow-sm)" : "none",
              }}
            >
              <VIcon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 正文 ===== */}
      <div className="scroll grow" style={{ minHeight: 0 }}>
        <div style={{ maxWidth: 1020, margin: "0 auto", padding: "22px 32px 110px" }}>
          {phase === "gen" && (
            <div className="card" style={{ padding: 18 }}>
              <GenSkeleton lines={3} label={`正在写第 ${state.ep} 集剧本…`} />
            </div>
          )}

          {phase === "done" && view === "sheet" && (
            <ScriptSheet
              scenes={scenes}
              shotsMap={shotsMap}
              chars={state.chars}
              locked={locked}
              genScene={genScene}
              onEditScene={upd}
              onEditLine={updLine}
              onGenShots={genShots}
            />
          )}

          {phase === "done" && view === "cards" && (
            <div className="col gap-4">
              {scenes.map((s, i) => {
                const shots = shotsMap[s.id] ?? [];
                return (
                  <div key={s.id} className="card fade-up" style={{ padding: 0, overflow: "hidden", animationDelay: i * 50 + "ms" }}>
                    {/* 场景剧本 */}
                    <div style={{ padding: "16px 18px 6px" }}>
                      <SceneBlock
                        s={s}
                        i={i}
                        chars={state.chars}
                        onEdit={(patch) => upd(i, patch)}
                        onEditLine={(li, patch) => updLine(i, li, patch)}
                        onAddLine={() => addLine(i)}
                        onDelLine={(li) => delLine(i, li)}
                        onDelScene={() => delScene(i)}
                        onRewrite={() => toast.success("已重写本场台词")}
                      />
                    </div>
                    {/* 本场分镜(同卡承接,不割裂) */}
                    <div style={{ borderTop: "1px dashed var(--line)", background: "var(--surface-2)", padding: "12px 18px 14px" }}>
                      <div className="row gap-2" style={{ marginBottom: shots.length || genScene === s.id ? 10 : 0 }}>
                        <Film size={14} style={{ color: "var(--accent)" }} />
                        <span style={{ fontWeight: 700, fontSize: 12.5 }}>本场分镜</span>
                        {shots.length > 0 ? (
                          <span className="faint num" style={{ fontSize: 11.5 }}>
                            {shots.length} 镜 · 共 {shots.reduce((a, x) => a + (x.dur || 0), 0)}s · 文字脚本,出片在视频工厂
                          </span>
                        ) : (
                          <span className="faint" style={{ fontSize: 11.5 }}>剧本定了就拆镜头,每镜自动带视频提示词</span>
                        )}
                        <span className="grow" />
                        {shots.length > 0 && !locked && (
                          <button type="button" className="chip" style={{ height: 25, fontSize: 11 }} onClick={() => genShots(s.id)}>
                            <RefreshCw size={11} /> 重拆本场
                          </button>
                        )}
                        {shots.length === 0 && genScene !== s.id && !locked && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => genShots(s.id)}>
                            <Wand2 size={13} /> 生成本场分镜 <Cost n={SHOT_GEN_COST} />
                          </button>
                        )}
                      </div>
                      {genScene === s.id && <GenSkeleton lines={1} label="正在按台词与情绪拆镜头…" />}
                      {shots.length > 0 && (
                        <div className="row gap-2" style={{ overflowX: "auto", paddingBottom: 4, alignItems: "stretch" }}>
                          {shots.map((sh) => (
                            <MiniShot key={sh.id} sh={sh} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== 悬浮操作(右下角):下一步永远看得见 ===== */}
      {phase === "done" && !locked && (
        <div
          className="row gap-2 pop-in"
          style={{
            position: "absolute",
            right: 26,
            bottom: 22,
            zIndex: 20,
            background: "var(--surface)",
            padding: 10,
            borderRadius: 16,
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--line-soft)",
          }}
        >
          <span className="faint" style={{ fontSize: 11.5, alignSelf: "center", paddingLeft: 4 }}>
            脚本和分镜都满意了?
          </span>
          <button
            type="button"
            className="btn btn-grad"
            onClick={() => dispatch({ type: "lock", stage: "epscript", cost: 30 })}
          >
            <Check size={15} /> 通过整集 · 进视频工厂
          </button>
        </div>
      )}
      {locked && (
        <div
          className="row gap-2 pop-in"
          style={{
            position: "absolute",
            right: 26,
            bottom: 22,
            zIndex: 20,
            background: "var(--surface)",
            padding: 10,
            borderRadius: 16,
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--line-soft)",
          }}
        >
          <button type="button" className="btn btn-grad" onClick={() => dispatch({ type: "jump", stage: "factory" })}>
            <ImageIcon size={14} /> 去视频工厂出片 <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ============ 脚本表格视图(平铺:时间 / 场景 / 视频脚本 / 语音 / 字幕 / 参考) ============ */
const SH_TH: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--ink-3)",
  letterSpacing: ".05em",
  padding: "10px 14px",
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--line)",
  position: "sticky",
  top: 0,
  zIndex: 2,
  whiteSpace: "nowrap",
};
const SH_TD: React.CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid var(--line-soft)",
  verticalAlign: "top",
  fontSize: 13,
  lineHeight: 1.7,
};

function fmtT(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function ScriptSheet({
  scenes,
  shotsMap,
  chars,
  locked,
  genScene,
  onEditScene,
  onEditLine,
  onGenShots,
}: {
  scenes: EpScene[];
  shotsMap: Record<string, BoardShot[]>;
  chars: WorkshopState["chars"];
  locked: boolean;
  genScene: string | null;
  onEditScene: (i: number, patch: Partial<EpScene>) => void;
  onEditLine: (si: number, li: number, patch: Partial<ScriptLine>) => void;
  onGenShots: (sceneId: string) => void;
}) {
  let acc = 0;
  const rows = scenes.map((s) => {
    const shots = shotsMap[s.id] ?? [];
    const dur = shots.length ? shots.reduce((a, x) => a + (x.dur || 0), 0) : 15;
    const r = { s, shots, start: acc, end: acc + dur, est: !shots.length };
    acc += dur;
    return r;
  });
  const findChar = (name: string) => chars.find((c) => c.name === name);
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
          <thead>
            <tr>
              <th style={{ ...SH_TH, width: 84 }}>时间</th>
              <th style={{ ...SH_TH, width: 118 }}>场景</th>
              <th style={{ ...SH_TH, width: "36%" }}>视频脚本</th>
              <th style={SH_TH}>语音</th>
              <th style={{ ...SH_TH, width: 56 }}>字幕</th>
              <th style={{ ...SH_TH, width: 104 }}>参考</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, shots, start, end, est }, i) => (
              <tr key={s.id}>
                {/* 时间 */}
                <td style={{ ...SH_TD, whiteSpace: "nowrap" }}>
                  <div className="num" style={{ fontWeight: 800, fontSize: 13, color: "var(--accent)" }}>
                    {fmtT(start)}-{fmtT(end)}
                  </div>
                  {est && (
                    <div className="faint" style={{ fontSize: 10.5, marginTop: 2 }}>估 · 待拆镜</div>
                  )}
                </td>
                {/* 场景 */}
                <td style={SH_TD}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>
                    <Editable value={s.place} placeholder="场景" onCommit={(v) => onEditScene(i, { place: v })} />
                  </div>
                  <span className="tag tag-gray" style={{ marginTop: 6 }}>{s.mood}</span>
                </td>
                {/* 视频脚本(动作 + 分镜,可内嵌 [参考N] 引用) */}
                <td style={{ ...SH_TD, fontSize: 13.5 }}>
                  {(s.action || !shots.length) && (
                    <div style={{ marginBottom: shots.length ? 8 : 0, color: "var(--ink-2)" }}>
                      <RichScript
                        text={s.action}
                        refs={s.refs}
                        onCommit={(v) => onEditScene(i, { action: v })}
                        placeholder="点击编写视频脚本…用 [参考N] 引用右侧素材"
                      />
                    </div>
                  )}
                  {shots.length > 0 && (
                    <div className="col" style={{ gap: 6 }}>
                      {shots.map((sh) => (
                        <div key={sh.id} className="row gap-2" style={{ alignItems: "flex-start" }}>
                          <span
                            className="num"
                            style={{
                              flex: "none",
                              fontSize: 10.5,
                              fontWeight: 800,
                              color: "var(--accent)",
                              background: "var(--accent-soft)",
                              borderRadius: 6,
                              padding: "1px 7px",
                              marginTop: 4,
                            }}
                          >
                            #{sh.no}
                          </span>
                          <span style={{ minWidth: 0, lineHeight: 1.8 }}>
                            <b>
                              {sh.size} · {sh.move} · <span className="num">{sh.dur}s</span>:
                            </b>{" "}
                            <RichScript text={sh.desc} refs={s.refs} />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {shots.length === 0 && genScene !== s.id && s.action && !locked && (
                    <button
                      type="button"
                      className="chip"
                      style={{ height: 25, fontSize: 11, marginTop: 6 }}
                      onClick={() => onGenShots(s.id)}
                    >
                      <Wand2 size={11} /> 拆分镜 · {SHOT_GEN_COST} 积分
                    </button>
                  )}
                  {genScene === s.id && (
                    <div style={{ marginTop: 6 }}>
                      <GenSkeleton lines={1} label="正在拆镜头…" />
                    </div>
                  )}
                </td>
                {/* 语音 */}
                <td style={SH_TD}>
                  {s.lines.length > 0 ? (
                    <div className="col" style={{ gap: 6 }}>
                      {s.lines.map((l, j) => {
                        const c = findChar(l.who);
                        return (
                          <div key={j} className="row gap-2" style={{ alignItems: "flex-start" }}>
                            {c ? (
                              <Avatar theme={c.avatar} size={18} />
                            ) : (
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  background: "var(--surface-2)",
                                  display: "inline-grid",
                                  placeItems: "center",
                                  color: "var(--ink-3)",
                                  flex: "none",
                                  marginTop: 2,
                                }}
                              >
                                <Mic size={10} />
                              </span>
                            )}
                            <span style={{ minWidth: 0 }}>
                              <b style={{ fontSize: 12.5 }}>{l.who}</b>
                              {l.emotion && (
                                <span className="tag tag-pink" style={{ margin: "0 5px", transform: "translateY(-1px)" }}>
                                  {l.emotion}
                                </span>
                              )}
                              :&ldquo;
                              <Editable
                                value={l.text}
                                placeholder="台词…"
                                onCommit={(v) => onEditLine(i, j, { text: v })}
                                style={{ display: "inline" }}
                              />
                              &rdquo;
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="faint" style={{ fontStyle: "italic" }}>环境音 / 无台词</span>
                  )}
                </td>
                {/* 字幕 */}
                <td style={SH_TD}>
                  <SubToggle on={s.sub !== false} onToggle={() => onEditScene(i, { sub: s.sub === false })} />
                </td>
                {/* 参考 */}
                <td style={SH_TD}>
                  <RefCell refs={s.refs} onChange={(next) => onEditScene(i, { refs: next })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row gap-2" style={{ padding: "10px 14px", borderTop: "1px solid var(--line-soft)", background: "var(--surface-2)" }}>
        <Edit size={12} style={{ color: "var(--ink-3)" }} />
        <span className="faint" style={{ fontSize: 11.5 }}>
          场景、视频脚本、台词点击即可改 · 脚本里用 [参考N] 引用右侧素材 · 共约{" "}
          {fmtT(rows.reduce((a, r) => a + (r.end - r.start), 0))}
        </span>
      </div>
    </div>
  );
}

/* 分镜迷你卡:纯文字(这一步还没生成视频,画面在视频工厂才出) */
function MiniShot({ sh }: { sh: BoardShot }) {
  const [peek, setPeek] = React.useState(false);
  return (
    <div
      className="col"
      style={{
        flex: "none",
        width: 196,
        background: "var(--surface)",
        borderRadius: 12,
        border: "1px solid var(--line-soft)",
        padding: "10px 11px",
        gap: 5,
      }}
    >
      <div className="row gap-2">
        <span
          className="num"
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: "var(--accent)",
            background: "var(--accent-soft)",
            borderRadius: 6,
            padding: "1px 7px",
            flex: "none",
          }}
        >
          #{sh.no}
        </span>
        <span
          className="faint num"
          style={{ fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
        >
          {sh.size} · {sh.move}
        </span>
        <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", marginLeft: "auto", flex: "none" }}>
          {sh.dur}s
        </span>
      </div>
      <span style={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--ink-2)" }}>{sh.desc}</span>
      <button
        type="button"
        className="chip"
        style={{
          height: 22,
          fontSize: 10,
          alignSelf: "flex-start",
          padding: "0 8px",
          marginTop: "auto",
          background: peek ? "var(--accent-soft)" : "var(--surface-2)",
          color: peek ? "var(--accent)" : "var(--ink-3)",
        }}
        onClick={() => setPeek(!peek)}
      >
        <Package size={10} /> 视频提示词
      </button>
      {peek && (
        <div style={{ fontSize: 10, lineHeight: 1.5, color: "var(--ink-2)", background: "var(--surface-2)", borderRadius: 8, padding: "6px 8px" }}>
          {sh.size} · {sh.move} · {sh.dur}s · {sh.engine === "avatar" ? "数字人出镜" : "场景特效"} —— {sh.desc}
        </div>
      )}
    </div>
  );
}
