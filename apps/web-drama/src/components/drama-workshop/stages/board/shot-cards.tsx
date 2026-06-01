"use client";

// 镜头卡三布局 — 设计真源:screens-board.jsx
// ShotList / ShotCardFlow / ShotCardTimeline / ShotCardGrid。
import * as React from "react";
import { Box, Check, Edit, Mic, Plus, TriangleAlert } from "lucide-react";
import { Editable, EngineTag, Thumb } from "@/components/drama-ui";
import type { BoardShot, CharacterDef } from "@/mocks/drama-workshop";
import { CastChips, DoneToggle, OverLimit, ShotToolbar } from "./shot-bits";
import type { BoardLayout } from "./layout-toggle";

interface CommonProps {
  s: BoardShot;
  i: number;
  count: number;
  chars: CharacterDef[];
  active?: string | null;
  onOpen: (id: string) => void;
  onPeek: (s: BoardShot) => void;
  onUpd: (id: string, patch: Partial<BoardShot>) => void;
  onDel: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
  onToggleDone: (id: string, v: boolean) => void;
}

interface ShotListProps {
  layout: BoardLayout;
  shots: BoardShot[];
  chars: CharacterDef[];
  active?: string | null;
  onOpen: (id: string) => void;
  onPeek: (s: BoardShot) => void;
  onUpd: (id: string, patch: Partial<BoardShot>) => void;
  onDel: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
  onToggleDone: (id: string, v: boolean) => void;
  onRefCast?: (shotId: string, charId: string) => void;
}

export function ShotList(props: ShotListProps) {
  const { layout, shots } = props;
  if (layout === "grid") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 14,
        }}
      >
        {shots.map((s, i) => (
          <ShotCardGrid key={s.id} {...common(props, s, i)} />
        ))}
      </div>
    );
  }
  if (layout === "timeline") {
    return (
      <div className="col" style={{ position: "relative" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 27,
            top: 10,
            bottom: 10,
            width: 2,
            background: "var(--line)",
          }}
        />
        {shots.map((s, i) => (
          <ShotCardTimeline key={s.id} {...common(props, s, i)} />
        ))}
      </div>
    );
  }
  return (
    <div className="col gap-3">
      {shots.map((s, i) => (
        <ShotCardFlow
          key={s.id}
          {...common(props, s, i)}
          onRefCast={props.onRefCast}
        />
      ))}
    </div>
  );
}

function common(p: ShotListProps, s: BoardShot, i: number): CommonProps {
  return {
    s,
    i,
    count: p.shots.length,
    chars: p.chars,
    active: p.active,
    onOpen: p.onOpen,
    onPeek: p.onPeek,
    onUpd: p.onUpd,
    onDel: p.onDel,
    onMove: p.onMove,
    onReorder: p.onReorder,
    onToggleDone: p.onToggleDone,
  };
}

function ShotCardFlow(
  props: CommonProps & {
    onRefCast?: (shotId: string, charId: string) => void;
  },
) {
  const { s, i, count, chars, active, onOpen, onPeek, onUpd, onDel, onMove, onReorder, onToggleDone, onRefCast } =
    props;
  const [hover, setHover] = React.useState(false);
  const [over, setOver] = React.useState(false);
  return (
    <div
      className="card fade-up"
      style={{
        padding: 14,
        animationDelay: i * 50 + "ms",
        border:
          active === s.id ? "2px solid var(--accent)" : "1px solid var(--line-soft)",
        borderLeft: s.done ? "3px solid #22c55e" : undefined,
        boxShadow: over ? "0 0 0 2px var(--accent)" : undefined,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id && id !== s.id) onReorder(id, s.id);
      }}
    >
      <div className="row gap-4" style={{ alignItems: "flex-start" }}>
        <button
          type="button"
          style={{
            position: "relative",
            flex: "none",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
          onClick={() => onOpen(s.id)}
          title="点开精修"
        >
          <Thumb
            from={s.engine === "avatar" ? "#a78bfa" : "#cbd5e1"}
            to={s.engine === "avatar" ? "#f0abfc" : "#94a3b8"}
            w={92}
            ratio="9/16"
            radius={10}
            label={`#${s.no}`}
          />
          <span
            className="num"
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              background: "rgba(0,0,0,.5)",
              color: "#fff",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 6,
              fontWeight: 700,
            }}
          >
            {s.dur}s
          </span>
          {s.done && (
            <span
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#22c55e",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 0 0 2px #fff",
              }}
            >
              <Check size={12} color="#fff" />
            </span>
          )}
        </button>
        <div className="grow col gap-2" style={{ minWidth: 0 }}>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <button
              type="button"
              className="tag tag-gray"
              onClick={() => onOpen(s.id)}
              title="在精修栏改景别"
              style={{ border: "none", cursor: "pointer" }}
            >
              {s.size}
            </button>
            <button
              type="button"
              className="tag tag-gray"
              onClick={() => onOpen(s.id)}
              title="在精修栏改运镜"
              style={{ border: "none", cursor: "pointer" }}
            >
              {s.move}
            </button>
            <EngineTag engine={s.engine} />
            <span className="grow" />
            <DoneToggle done={s.done} onToggle={(v) => onToggleDone(s.id, v)} />
            <div style={{ opacity: hover ? 1 : 0, transition: "opacity .15s" }}>
              <ShotToolbar id={s.id} i={i} count={count} onMove={onMove} onDel={onDel} />
            </div>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            <Editable
              block
              value={s.desc}
              placeholder="写这一镜的画面描述…"
              onCommit={(v) => onUpd(s.id, { desc: v })}
              style={{ display: "block" }}
            />
          </div>
          <CastChips ids={s.cast} chars={chars} shotId={s.id} onRefCast={onRefCast} />
          {s.line ? (
            <div
              className="row gap-2"
              style={{ fontSize: 12.5, color: "var(--ink-2)" }}
            >
              <Mic size={13} style={{ flex: "none", color: "var(--ink-3)" }} />
              <b>{s.line.who}:</b>「
              <Editable
                value={s.line.text}
                placeholder="台词"
                onCommit={(v) =>
                  onUpd(s.id, { line: { ...s.line!, text: v } })
                }
              />
              」
            </div>
          ) : (
            <button
              type="button"
              className="chip"
              style={{ alignSelf: "flex-start" }}
              onClick={() =>
                onUpd(s.id, {
                  line: {
                    who:
                      chars.find((c) => s.cast.includes(c.id))?.name ?? "旁白",
                    text: "",
                  },
                })
              }
            >
              <Plus size={12} /> 加台词
            </button>
          )}
          {s.overLimit && <OverLimit />}
          <div className="row gap-2" style={{ marginTop: 2 }}>
            <button
              type="button"
              className="btn btn-line btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onPeek(s);
              }}
            >
              <Box size={13} /> 看本镜配方
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(s.id);
              }}
            >
              <Edit size={13} /> 精修
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShotCardTimeline(props: CommonProps) {
  const { s, i, count, chars, active, onOpen, onPeek, onUpd, onDel, onMove, onToggleDone } = props;
  const [hover, setHover] = React.useState(false);
  return (
    <div
      className="row gap-4 fade-up"
      style={{
        alignItems: "flex-start",
        marginBottom: 14,
        animationDelay: i * 50 + "ms",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="num"
        style={{ flex: "none", width: 56, textAlign: "center", zIndex: 1 }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            margin: "0 auto",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            color: "#fff",
            background: s.done
              ? "#22c55e"
              : s.engine === "avatar"
                ? "linear-gradient(135deg,var(--accent),var(--accent-2))"
                : "var(--ink-3)",
            boxShadow: "0 0 0 4px var(--surface)",
          }}
        >
          {s.done ? <Check size={17} color="#fff" /> : s.no}
        </div>
        <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>{s.dur}s</div>
      </div>
      <div
        className="card grow"
        style={{
          padding: 14,
          border:
            active === s.id ? "2px solid var(--accent)" : "1px solid var(--line-soft)",
          borderLeft: s.done ? "3px solid #22c55e" : undefined,
        }}
      >
        <div className="row gap-2" style={{ marginBottom: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="tag tag-gray"
            onClick={() => onOpen(s.id)}
            style={{ border: "none", cursor: "pointer" }}
          >
            {s.size}
          </button>
          <button
            type="button"
            className="tag tag-gray"
            onClick={() => onOpen(s.id)}
            style={{ border: "none", cursor: "pointer" }}
          >
            {s.move}
          </button>
          <EngineTag engine={s.engine} />
          <span className="grow" />
          <DoneToggle done={s.done} onToggle={(v) => onToggleDone(s.id, v)} label={false} />
          <div style={{ opacity: hover ? 1 : 0, transition: "opacity .15s" }}>
            <ShotToolbar id={s.id} i={i} count={count} onMove={onMove} onDel={onDel} />
          </div>
        </div>
        <div style={{ fontSize: 13.5, marginBottom: 8 }}>
          <Editable
            block
            value={s.desc}
            placeholder="画面描述…"
            onCommit={(v) => onUpd(s.id, { desc: v })}
            style={{ display: "block" }}
          />
        </div>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <CastChips ids={s.cast} chars={chars} shotId={s.id} />
          <div className="row gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(s.id)}>
              <Edit size={13} /> 精修
            </button>
            <button type="button" className="btn btn-line btn-sm" onClick={() => onPeek(s)}>
              <Box size={13} /> 配方
            </button>
          </div>
        </div>
        {s.overLimit && (
          <div style={{ marginTop: 8 }}>
            <OverLimit />
          </div>
        )}
      </div>
    </div>
  );
}

function ShotCardGrid(props: CommonProps) {
  const { s, i, count, onOpen, onPeek, active, onUpd, onDel, onMove, onToggleDone } = props;
  const [hover, setHover] = React.useState(false);
  return (
    <div
      className="card fade-up"
      style={{
        padding: 0,
        overflow: "hidden",
        animationDelay: i * 40 + "ms",
        border:
          active === s.id
            ? "2px solid var(--accent)"
            : s.done
              ? "1px solid #86efac"
              : "1px solid var(--line-soft)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
        onClick={() => onOpen(s.id)}
      >
        <Thumb
          from={s.engine === "avatar" ? "#a78bfa" : "#cbd5e1"}
          to={s.engine === "avatar" ? "#f0abfc" : "#94a3b8"}
          ratio="9/11"
          radius={0}
          label={`#${s.no} · ${s.size}`}
          style={{ width: "100%" }}
        />
        <span
          className="num"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(0,0,0,.5)",
            color: "#fff",
            fontSize: 11,
            padding: "2px 7px",
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          {s.dur}s
        </span>
        {s.done && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "#22c55e",
              color: "#fff",
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 0 0 2px #fff",
            }}
          >
            <Check size={13} color="#fff" />
          </span>
        )}
        {s.overLimit && !s.done && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "#dc2626",
              color: "#fff",
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
            }}
          >
            <TriangleAlert size={12} />
          </span>
        )}
        <div style={{ position: "absolute", bottom: 8, left: 8 }}>
          <EngineTag engine={s.engine} />
        </div>
        {hover && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 38,
              background: "var(--surface)",
              borderRadius: 8,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <ShotToolbar id={s.id} i={i} count={count} onMove={onMove} onDel={onDel} />
          </div>
        )}
      </button>
      <div className="col gap-2" style={{ padding: 12 }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, minHeight: 38 }}>
          <Editable
            block
            value={s.desc}
            placeholder="画面描述…"
            onCommit={(v) => onUpd(s.id, { desc: v })}
            style={{ display: "block" }}
          />
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <DoneToggle done={s.done} onToggle={(v) => onToggleDone(s.id, v)} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: "0 8px" }}
            onClick={() => onPeek(s)}
          >
            <Box size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
