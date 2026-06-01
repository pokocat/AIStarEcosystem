"use client";

// 阶段 4 单集剧本 — 分场景剧本 + 行内可编辑台词 + 撤销重做。
// 设计真源:screens-script.jsx `ScriptStage / SceneBlock`。
import * as React from "react";
import { toast } from "sonner";
import { Edit, Mic, Plus, Redo2, Sparkles, Undo2, Wand2, X } from "lucide-react";
import {
  AICollab,
  Avatar,
  Editable,
  GenSkeleton,
  useGen,
} from "@/components/drama-ui";
import { StageHeader } from "../workbench";
import { STAGE_BY_KEY } from "../stages-config";
import type { WorkshopAction, WorkshopState } from "../workbench";
import type { CharacterDef, ProjectData, ScriptScene, ScriptLine } from "@/mocks/drama-workshop";

interface ScriptStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
}

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function ScriptStage({ state, dispatch, data }: ScriptStageProps) {
  const { phase, run, retry } = useGen({ initial: "done" });
  const initScenes = React.useCallback(
    () => data.script.scenes.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l })) })),
    [data.script.scenes],
  );
  const [hist, setHist] = React.useState<History<ScriptScene[]>>(() => ({
    past: [],
    present: initScenes(),
    future: [],
  }));
  const scenes = hist.present;

  const setScenes = (updater: (prev: ScriptScene[]) => ScriptScene[]) =>
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

  const upd = (i: number, patch: Partial<ScriptScene>) =>
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
  const addScene = () =>
    setScenes((arr) => [
      ...arr,
      { id: "new" + Date.now(), place: "内景 · 新场景 · 时间", mood: "待定", action: "", lines: [] },
    ]);

  const stageCost = STAGE_BY_KEY.script.cost;

  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 32px 64px" }}>
        <StageHeader
          no={4}
          scope="剧集"
          title={`第 ${state.ep} 集 · 剧本`}
          desc="把这一集写成一个个场景。点任意文字即可直接编辑。"
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
              <span className="tag tag-gray">
                <Edit size={12} /> 点击文字可改
              </span>
            </div>
          }
        />

        <AICollab
          title="分场景剧本"
          hint="台词标了说话角色,和右侧角色面板联动"
          cost={stageCost}
          generating={phase === "gen"}
          done={phase === "done"}
          error={phase === "error"}
          locked={state.lockedStages.script}
          onGenerate={run}
          onRetry={retry}
          onLock={() => dispatch({ type: "lock", stage: "script", cost: stageCost })}
          lockLabel="锁定剧本,去拆分镜"
        >
          {phase === "gen" && (
            <GenSkeleton lines={3} label={`正在把第 ${state.ep} 集写成分场景剧本…`} />
          )}
          {phase === "done" && (
            <div className="col gap-4">
              {scenes.map((s, i) => (
                <SceneBlock
                  key={s.id}
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
              ))}
              <button
                type="button"
                className="btn btn-line"
                style={{ alignSelf: "flex-start" }}
                onClick={addScene}
              >
                <Plus size={15} /> 加一场
              </button>
            </div>
          )}
        </AICollab>
      </div>
    </div>
  );
}

function SceneBlock({
  s,
  i,
  chars,
  onEdit,
  onEditLine,
  onAddLine,
  onDelLine,
  onDelScene,
  onRewrite,
}: {
  s: ScriptScene;
  i: number;
  chars: CharacterDef[];
  onEdit: (p: Partial<ScriptScene>) => void;
  onEditLine: (li: number, p: Partial<ScriptLine>) => void;
  onAddLine: () => void;
  onDelLine: (li: number) => void;
  onDelScene: () => void;
  onRewrite: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  const findChar = (name: string) => chars.find((c) => c.name === name);
  return (
    <div
      className="card fade-up"
      style={{ padding: 0, overflow: "hidden", animationDelay: i * 60 + "ms" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="row gap-3"
        style={{
          padding: "12px 16px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <span className="num tag tag-accent">场 {i + 1}</span>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>
          <Editable
            value={s.place}
            placeholder="时空标题"
            onCommit={(v) => onEdit({ place: v })}
          />
        </span>
        <span className="grow" />
        <span className="tag tag-gray">
          <Sparkles size={11} fill="currentColor" strokeWidth={0} />{" "}
          <Editable
            value={s.mood}
            placeholder="情绪"
            onCommit={(v) => onEdit({ mood: v })}
          />
        </span>
        <div
          className="row gap-2"
          style={{ opacity: hover ? 1 : 0, transition: "opacity .15s" }}
        >
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRewrite}>
            <Wand2 size={13} /> 重写本场
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            title="删除本场"
            onClick={onDelScene}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="col gap-3" style={{ padding: 16 }}>
        <div
          className="row gap-2"
          style={{ color: "var(--ink-2)", fontSize: 13, fontStyle: "italic" }}
        >
          <Edit size={13} style={{ flex: "none", marginTop: 2, color: "var(--ink-3)" }} />
          <span className="grow" style={{ fontStyle: "normal" }}>
            <Editable
              block
              value={s.action}
              placeholder="补一句动作 / 场面描述…"
              onCommit={(v) => onEdit({ action: v })}
              style={{ display: "block", color: "var(--ink-2)", fontStyle: "italic" }}
            />
          </span>
        </div>
        <div className="col gap-2">
          {s.lines.map((l, j) => {
            const c = findChar(l.who);
            return (
              <div key={j} className="row gap-3" style={{ alignItems: "flex-start" }}>
                <div
                  className="row gap-2"
                  style={{ flex: "none", width: 100, alignItems: "center" }}
                >
                  {c ? (
                    <Avatar theme={c.avatar} size={24} />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "var(--surface-2)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--ink-3)",
                        flex: "none",
                      }}
                    >
                      <Mic size={13} />
                    </div>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>
                    <Editable
                      value={l.who}
                      placeholder="角色"
                      onCommit={(v) => onEditLine(j, { who: v })}
                    />
                  </span>
                </div>
                <div className="grow" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                  {l.emotion && (
                    <span
                      className="tag tag-pink"
                      style={{ marginRight: 6, transform: "translateY(-1px)" }}
                    >
                      <Editable
                        value={l.emotion}
                        placeholder="情绪"
                        onCommit={(v) => onEditLine(j, { emotion: v })}
                      />
                    </span>
                  )}
                  <Editable
                    block
                    value={l.text}
                    placeholder="写一句台词 / 旁白…"
                    onCommit={(v) => onEditLine(j, { text: v })}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost btn-sm"
                  title="删除此行"
                  style={{ flex: "none", height: 26, width: 26 }}
                  onClick={() => onDelLine(j)}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="chip"
            style={{ alignSelf: "flex-start", marginTop: 2 }}
            onClick={onAddLine}
          >
            <Plus size={13} /> 加一句台词
          </button>
        </div>
      </div>
    </div>
  );
}
