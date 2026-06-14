"use client";

// 场景剧本卡 — 设计真源:screens-script.jsx `SceneBlock`。
// v4 起由「剧集脚本」(剧本+分镜合并视图)复用;台词、动作、情绪点击即改。
import * as React from "react";
import { Edit, Mic, Plus, Sparkles, Wand2, X } from "lucide-react";
import { Avatar, Editable } from "@/components/drama-ui";
import type { CharacterDef, ScriptScene, ScriptLine } from "@/mocks/drama-workshop";

export function SceneBlock({
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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="row gap-3" style={{ paddingBottom: 10 }}>
        <span className="num tag tag-accent" style={{ flex: "none" }}>场 {i + 1}</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 13.5,
            flex: "1 1 auto",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <Editable
            value={s.place}
            placeholder="时空标题"
            onCommit={(v) => onEdit({ place: v })}
          />
        </span>
        <span className="grow" />
        <span className="tag tag-gray" style={{ flex: "none", whiteSpace: "nowrap" }}>
          <Sparkles size={11} fill="currentColor" strokeWidth={0} />{" "}
          <Editable
            value={s.mood}
            placeholder="情绪"
            onCommit={(v) => onEdit({ mood: v })}
          />
        </span>
        <div
          className="row gap-2"
          style={{ opacity: hover ? 1 : 0, transition: "opacity .15s", flex: "none" }}
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
      <div className="col gap-3" style={{ paddingBottom: 10 }}>
        <div
          className="row gap-2"
          style={{ color: "var(--ink-2)", fontSize: 13 }}
        >
          <Edit size={13} style={{ flex: "none", marginTop: 2, color: "var(--ink-3)" }} />
          <span className="grow">
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
