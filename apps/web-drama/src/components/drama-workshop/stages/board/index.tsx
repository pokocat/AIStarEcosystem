"use client";

// 阶段 5 分镜工作台 — 时间线概览 + 场景页签 + 三布局镜头列表 + 单镜精修
// 侧栏 + 单镜配方预览 + AICollab 锁定。
// 设计真源:screens-board.jsx `BoardStage / TimelineBar / ShotList /
// ShotDetail / ShotPromptPeek / SceneEmpty`。
import * as React from "react";
import { toast } from "sonner";
import { Check, Film, Plus, Redo2, Undo2, Wand2 } from "lucide-react";
import { AICollab, Cost, GenSkeleton, useGen } from "@/components/drama-ui";
import { STAGE_BY_KEY } from "../../stages-config";
import { StageHeader } from "../../workbench";
import type { WorkshopAction, WorkshopState } from "../../workbench";
import type { BoardScene, BoardShot, ProjectData } from "@/mocks/drama-workshop";
import { TimelineBar } from "./timeline-bar";
import { LayoutToggle, type BoardLayout } from "./layout-toggle";
import { ShotList } from "./shot-cards";
import { ShotDetail } from "./shot-detail";
import { ShotPromptPeek } from "./shot-prompt-peek";

interface BoardStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
}

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function BoardStage({ state, dispatch, data }: BoardStageProps) {
  const { phase, run, retry } = useGen({ initial: "done" });
  const [layout, setLayout] = React.useState<BoardLayout>("timeline");

  const initBoard = React.useCallback<() => BoardScene[]>(
    () =>
      data.storyboard.scenes.map((s) => ({
        ...s,
        shots: s.shots.map((sh) => ({ ...sh, moods: sh.moods ?? [] })),
      })),
    [data.storyboard.scenes],
  );
  const [hist, setHist] = React.useState<History<BoardScene[]>>(() => ({
    past: [],
    present: initBoard(),
    future: [],
  }));
  const board = hist.present;
  const setBoard = (updater: (prev: BoardScene[]) => BoardScene[]) =>
    setHist((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      return { past: [...h.past, h.present].slice(-60), present: next, future: [] };
    });
  const undo = () =>
    setHist((h) =>
      h.past.length
        ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
        : h,
    );
  const redo = () =>
    setHist((h) =>
      h.future.length
        ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
        : h,
    );
  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 默认选有镜头的场景(s2)
  const defaultSel = React.useMemo(() => {
    const withShots = board.find((s) => s.shots.length > 0);
    return withShots?.id ?? board[0]?.id ?? "";
  }, [board]);
  const [selId, setSelId] = React.useState<string>(defaultSel);
  React.useEffect(() => {
    if (!board.find((s) => s.id === selId)) setSelId(defaultSel);
  }, [board, defaultSel, selId]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [promptPeek, setPromptPeek] = React.useState<BoardShot | null>(null);
  const [genScene, setGenScene] = React.useState<string | null>(null);

  const sceneMeta = (id: string) => data.script.scenes.find((x) => x.id === id);
  const scenes = board.map((s, i) => {
    const meta = sceneMeta(s.id);
    return {
      ...s,
      idx: i,
      place: meta?.place ?? `场景 ${i + 1}`,
      mood: meta?.mood ?? "",
    };
  });
  const scene = scenes.find((s) => s.id === selId) ?? scenes[0];
  const hasShots = scene && scene.shots.length > 0;

  // 镜头编辑
  const renumber = (shots: BoardShot[]) =>
    shots.map((sh, i) => ({ ...sh, no: i + 1 }));
  const mutate = (fn: (shots: BoardShot[]) => BoardShot[]) =>
    setBoard((arr) =>
      arr.map((sc) => {
        if (sc.id !== selId) return sc;
        const shots = renumber(fn(sc.shots));
        return {
          ...sc,
          shots,
          duration: shots.reduce((a, x) => a + (x.dur || 0), 0),
        };
      }),
    );
  const updShot = (id: string, patch: Partial<BoardShot>) =>
    mutate((shots) => shots.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)));
  const delShot = (id: string) => {
    mutate((shots) => shots.filter((sh) => sh.id !== id));
    if (open === id) setOpen(null);
    toast.success("已删除该镜头");
  };
  const moveShot = (id: string, dir: -1 | 1) =>
    mutate((shots) => {
      const i = shots.findIndex((sh) => sh.id === id);
      const j = i + dir;
      if (j < 0 || j >= shots.length) return shots;
      const c = [...shots];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const reorderShot = (fromId: string, toId: string) =>
    mutate((shots) => {
      const f = shots.findIndex((s) => s.id === fromId);
      const t = shots.findIndex((s) => s.id === toId);
      if (f < 0 || t < 0 || f === t) return shots;
      const c = [...shots];
      const [m] = c.splice(f, 1);
      c.splice(t, 0, m);
      return c;
    });
  const addShot = () => {
    const nid = "sh" + Date.now();
    mutate((shots) => [
      ...shots,
      {
        id: nid,
        no: shots.length + 1,
        size: "中景",
        move: "固定",
        dur: 3,
        engine: "avatar",
        desc: "",
        cast: [],
        line: null,
        moods: [],
        voice: "",
      },
    ]);
    setOpen(nid);
  };

  const breakDown = (id: string) => {
    setGenScene(id);
    setTimeout(() => {
      setGenScene(null);
      const target = board.findIndex((s) => s.shots.length > 0);
      if (target >= 0) setSelId(board[target].id);
      toast.success("本场景已拆镜(示例:见已就绪的场景)");
    }, 1500);
  };

  const openShot = scene?.shots.find((s) => s.id === open) ?? null;
  const stageCost = STAGE_BY_KEY.board.cost;

  return (
    <div className="row" style={{ height: "100%", alignItems: "stretch" }}>
      <div className="scroll grow" style={{ height: "100%" }}>
        <div
          style={{
            maxWidth: layout === "grid" ? 1000 : 860,
            margin: "0 auto",
            padding: "28px 32px 64px",
            transition: "max-width .3s",
          }}
        >
          <StageHeader
            no={5}
            scope="剧集"
            title={`第 ${state.ep} 集 · 分镜`}
            desc="按剧本场景逐场拆镜。描述、台词点击即改,景别运镜在精修栏点选。"
            right={
              <div className="row gap-2">
                <div
                  className="row"
                  style={{
                    background: "var(--surface-2)",
                    borderRadius: 11,
                    padding: 3,
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    title="撤销 (⌘Z)"
                    disabled={!canUndo}
                    style={{
                      width: 30,
                      height: 30,
                      opacity: canUndo ? 1 : 0.35,
                      color: "var(--ink-2)",
                    }}
                    onClick={undo}
                  >
                    <Undo2 size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    title="重做 (⇧⌘Z)"
                    disabled={!canRedo}
                    style={{
                      width: 30,
                      height: 30,
                      opacity: canRedo ? 1 : 0.35,
                      color: "var(--ink-2)",
                    }}
                    onClick={redo}
                  >
                    <Redo2 size={15} />
                  </button>
                </div>
                <LayoutToggle layout={layout} onChange={setLayout} />
              </div>
            }
          />

          {/* 时间线概览 */}
          {hasShots && <TimelineBar shots={scene.shots} onJump={setOpen} active={open} />}

          {/* 场景分页签 */}
          <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            {scenes.map((s, i) => {
              const on = s.id === selId;
              const n = s.shots.length;
              const dn = s.shots.filter((x) => x.done).length;
              const allDone = n > 0 && dn === n;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelId(s.id);
                    setOpen(null);
                  }}
                  className="col"
                  style={{
                    textAlign: "left",
                    padding: "9px 14px",
                    borderRadius: 12,
                    gap: 2,
                    minWidth: 150,
                    background: on ? "var(--accent-soft)" : "var(--surface)",
                    border: on
                      ? "1.5px solid var(--accent)"
                      : "1.5px solid var(--line-soft)",
                    transition: "all .15s",
                    cursor: "pointer",
                  }}
                >
                  <div className="row gap-2">
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 13.5,
                        color: on ? "var(--accent)" : "var(--ink)",
                      }}
                    >
                      场景{CN_NUM[i] ?? i + 1}
                    </span>
                    {n > 0 ? (
                      <span
                        className={"tag num " + (allDone ? "tag-green" : "tag-gray")}
                        style={{ height: 18, padding: "0 7px", gap: 3 }}
                      >
                        {allDone && <Check size={11} />}
                        {dn}/{n}
                      </span>
                    ) : (
                      <span className="tag tag-gray" style={{ height: 18, padding: "0 6px" }}>
                        待拆
                      </span>
                    )}
                  </div>
                  <span
                    className="faint"
                    style={{
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 160,
                    }}
                  >
                    {s.place}
                  </span>
                </button>
              );
            })}
          </div>

          {scene && hasShots ? (
            <AICollab
              title={`场景${CN_NUM[scene.idx] ?? scene.idx + 1} · ${scene.place}`}
              hint={`共 ${scene.shots.length} 镜 · ${scene.duration ?? 0} 秒 · 已完成 ${scene.shots.filter((x) => x.done).length}`}
              cost={stageCost}
              generating={phase === "gen"}
              done={phase === "done"}
              error={phase === "error"}
              locked={state.lockedStages.board}
              onGenerate={run}
              onRetry={retry}
              onLock={() =>
                dispatch({ type: "lock", stage: "board", cost: stageCost })
              }
              lockLabel="锁定分镜,生成配方"
            >
              {phase === "gen" && (
                <GenSkeleton lines={3} label="正在把场景拆成镜头序列…" />
              )}
              {phase === "done" && (
                <div className="col gap-3">
                  <ShotList
                    layout={layout}
                    shots={scene.shots}
                    chars={state.chars}
                    onOpen={setOpen}
                    onPeek={setPromptPeek}
                    active={open}
                    onUpd={updShot}
                    onDel={delShot}
                    onMove={moveShot}
                    onReorder={reorderShot}
                    onToggleDone={(id, v) => updShot(id, { done: v })}
                    onRefCast={(_id, _cid) =>
                      toast.success("本镜已引用该角色的数字人形象")
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-line"
                    style={{ alignSelf: "flex-start", marginTop: 2 }}
                    onClick={addShot}
                  >
                    <Plus size={15} /> 加一镜
                  </button>
                </div>
              )}
            </AICollab>
          ) : (
            scene && (
              <SceneEmpty
                scene={scene}
                cn={CN_NUM[scene.idx] ?? String(scene.idx + 1)}
                generating={genScene === scene.id}
                onBreak={() => breakDown(scene.id)}
              />
            )
          )}
        </div>
      </div>

      {/* 单镜精修侧栏 */}
      {openShot && (
        <ShotDetail
          shot={openShot}
          chars={state.chars}
          onClose={() => setOpen(null)}
          onUpd={(patch) => updShot(openShot.id, patch)}
          onDel={() => delShot(openShot.id)}
          onPeek={() => setPromptPeek(openShot)}
        />
      )}

      {/* 单镜配方预览 */}
      {promptPeek && (
        <ShotPromptPeek
          shot={promptPeek}
          chars={state.chars}
          onClose={() => setPromptPeek(null)}
        />
      )}
    </div>
  );
}

function SceneEmpty({
  scene,
  cn,
  generating,
  onBreak,
}: {
  scene: { id: string; place: string };
  cn: string;
  generating: boolean;
  onBreak: () => void;
}) {
  if (generating) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <GenSkeleton lines={3} label={`正在把「场景${cn}」拆成镜头…`} />
      </div>
    );
  }
  return (
    <div
      className="card col center fade-up"
      style={{ padding: "48px 24px", textAlign: "center", gap: 14 }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: "var(--accent-soft)",
          display: "grid",
          placeItems: "center",
          color: "var(--accent)",
        }}
      >
        <Film size={28} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>「场景{cn}」还没拆镜</div>
        <div
          className="muted"
          style={{ fontSize: 13.5, marginTop: 4, maxWidth: 360 }}
        >
          {scene.place}
        </div>
      </div>
      <button type="button" className="btn btn-grad" onClick={onBreak}>
        <Wand2 size={15} /> AI 把这场拆成镜头 <Cost n={STAGE_BY_KEY.board.cost} />
      </button>
    </div>
  );
}
