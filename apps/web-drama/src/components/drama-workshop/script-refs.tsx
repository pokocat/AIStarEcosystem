"use client";

// 脚本引用体系 — 设计真源 v4 script-refs.jsx:
// 视频脚本内嵌 [参考N] 引用 chip / 参考列选素材库 / 字幕勾选。
import * as React from "react";
import { Check, Play, Plus, Users, X } from "lucide-react";
import { MAT_CATS, MATERIALS, type Material } from "@/mocks/drama-workshop";

/* 行内引用 chip:迷你缩略 + 「图片N/视频N」+ 可选 × 删除（@ 进来的引用可在正文里直接删） */
export function InlineRefChip({ r, n, onRemove }: { r: Material; n: string | number; onRemove?: () => void }) {
  return (
    <span
      title={r.name + " · " + (r.cat || "素材")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: onRemove ? "1px 4px 1px 3px" : "1px 8px 1px 3px",
        margin: "0 2px",
        borderRadius: 8,
        background: "var(--accent-soft)",
        color: "var(--accent)",
        fontWeight: 700,
        fontSize: ".92em",
        verticalAlign: "-3px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 17,
          height: 15,
          borderRadius: 4,
          background: `linear-gradient(140deg,${r.from},${r.to})`,
          display: "inline-grid",
          placeItems: "center",
        }}
      >
        {r.kind === "video" && <Play size={7} fill="#fff" strokeWidth={0} />}
      </span>
      {r.kind === "video" ? "视频" : "图片"} {n}
      {onRemove && (
        <button
          type="button"
          aria-label="删除该引用"
          title="删除该引用"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            cursor: "pointer",
            display: "inline-grid",
            placeItems: "center",
            padding: 0,
            width: 14,
            height: 14,
            borderRadius: "50%",
          }}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

/* 视频脚本富文本:渲染 [参考N] 为 chip,点击进入原文编辑;
   编辑态支持输入 @xxx 唤出素材库联想,选中即插入 [参考N] 引用 */
export function RichScript({
  text,
  refs,
  onCommit,
  onRefsChange,
  placeholder,
  minHeight,
}: {
  text: string;
  refs?: Material[];
  onCommit?: (v: string) => void;
  /** 提供后,编辑态输入 @ 可联想素材并自动把素材加入参考列表 */
  onRefsChange?: (next: Material[]) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text || "");
  const [mention, setMention] = React.useState<{ query: string; at: number } | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    setDraft(text || "");
  }, [text]);

  const detectMention = (val: string, caret: number) => {
    const before = val.slice(0, caret);
    const m = before.match(/@([^\s@\[\]【】]{0,12})$/);
    setMention(m ? { query: m[1], at: caret - m[0].length } : null);
  };

  const pickMention = (mat: Material) => {
    const list = refs ?? [];
    let next = list;
    let idx = list.findIndex((x) => x.id === mat.id);
    if (idx < 0) {
      next = [...list, mat];
      idx = next.length - 1;
      onRefsChange?.(next);
    }
    const caret = taRef.current?.selectionStart ?? draft.length;
    const token = `[参考${idx + 1}] `;
    const nv = draft.slice(0, mention?.at ?? caret) + token + draft.slice(caret);
    setDraft(nv);
    setMention(null);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        const pos = (mention?.at ?? caret) + token.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  if (editing) {
    const cand = mention
      ? MATERIALS.filter(
          (m) =>
            !mention.query ||
            m.name.includes(mention.query) ||
            m.cat.includes(mention.query) ||
            (m.tags ?? []).some((t) => t.includes(mention.query)),
        ).slice(0, 8)
      : [];
    return (
      <span style={{ position: "relative", display: "block" }}>
        <textarea
          ref={taRef}
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onClick={(e) => detectMention(draft, (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onBlur={() => {
            // 点联想项时不收起(onMouseDown 已 preventDefault)
            setEditing(false);
            setMention(null);
            onCommit?.(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && mention) {
              e.preventDefault();
              setMention(null);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !mention) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          placeholder="输入 @ 可引用素材库素材…"
          style={{
            width: "100%",
            minHeight: minHeight ?? 72,
            border: "1.5px solid var(--accent)",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 13,
            lineHeight: 1.8,
            outline: "none",
            background: "var(--surface)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        {mention && cand.length > 0 && (
          <span
            className="card pop-in col"
            style={{
              position: "absolute",
              left: 0,
              top: "100%",
              marginTop: 2,
              zIndex: 60,
              width: 260,
              padding: 6,
              gap: 2,
              boxShadow: "var(--shadow-lg)",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            <span className="faint" style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px" }}>
              @ 引用素材{mention.query ? ` · “${mention.query}”` : ""}
            </span>
            {cand.map((m) => (
              <button
                key={m.id}
                type="button"
                className="row gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(m);
                }}
                style={{ padding: "5px 6px", borderRadius: 8, textAlign: "left" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 20,
                    borderRadius: 5,
                    background: `linear-gradient(140deg,${m.from},${m.to})`,
                    flex: "none",
                    display: "inline-grid",
                    placeItems: "center",
                  }}
                >
                  {m.kind === "video" && <Play size={8} fill="#fff" strokeWidth={0} />}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name}
                </span>
                <span className="faint" style={{ fontSize: 10, flex: "none", marginLeft: "auto" }}>{m.cat}</span>
              </button>
            ))}
          </span>
        )}
      </span>
    );
  }
  // 删除某条引用（0-based）：从 refs 移除 + 正文里去掉 [参考N]，并把更大的序号 -1（保持引用对齐）。
  const removeRef = (idx: number) => {
    const list = refs ?? [];
    onRefsChange?.(list.filter((_, i) => i !== idx));
    let nv = String(text || "").replace(new RegExp(`\\[参考${idx + 1}\\]\\s?`, "g"), "");
    nv = nv.replace(/\[参考(\d+)\]/g, (_, k) => `[参考${+k > idx + 1 ? +k - 1 : +k}]`);
    onCommit?.(nv);
  };
  const canRemove = !!onCommit && !!onRefsChange;
  const parts = String(text || "").split(/(\[参考\d+\])/);
  const empty = !text || !text.trim();
  return (
    <span
      onClick={onCommit ? () => setEditing(true) : undefined}
      title={onCommit ? "点击编辑 · 用 [参考N] 引用右侧参考素材" : undefined}
      style={{ display: "block", lineHeight: 1.95, cursor: onCommit ? "text" : "default", borderRadius: 8 }}
      onMouseEnter={(e) => {
        if (onCommit) e.currentTarget.style.background = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {empty ? (
        <span className="faint">{placeholder ?? "点击编写视频脚本…"}</span>
      ) : (
        parts.map((p, i) => {
          const m = p.match(/^\[参考(\d+)\]$/);
          if (m) {
            const r = (refs ?? [])[+m[1] - 1];
            return r ? (
              <InlineRefChip key={i} r={r} n={m[1]} onRemove={canRemove ? () => removeRef(+m[1] - 1) : undefined} />
            ) : (
              <span key={i} className="faint">
                [参考{m[1]}]
              </span>
            );
          }
          return <React.Fragment key={i}>{p}</React.Fragment>;
        })
      )}
    </span>
  );
}

/* 参考列:已选素材缩略(带序号)+ 添加按钮 → 素材库选择弹窗 */
export function RefCell({ refs, onChange }: { refs?: Material[]; onChange: (next: Material[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const list = refs ?? [];
  return (
    <>
      <div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
        {list.map((r, i) => (
          <span
            key={r.id}
            title={`参考${i + 1} · ${r.name} · 脚本里用 [参考${i + 1}] 引用`}
            className="ref-chip"
            style={{ position: "relative", display: "inline-block" }}
          >
            <span
              style={{
                width: 30,
                height: 24,
                borderRadius: 6,
                display: "block",
                background: `linear-gradient(140deg,${r.from},${r.to})`,
                position: "relative",
              }}
            >
              {r.kind === "video" && (
                <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                  <Play size={9} fill="#fff" strokeWidth={0} />
                </span>
              )}
            </span>
            <span
              className="num"
              style={{
                position: "absolute",
                top: -5,
                left: -5,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 8.5,
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                border: "1.5px solid var(--surface)",
              }}
            >
              {i + 1}
            </span>
            <button
              type="button"
              aria-label={`删除参考${i + 1}`}
              title="删除该参考"
              onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--ink)",
                color: "#fff",
                border: "1.5px solid var(--surface)",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                padding: 0,
              }}
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <button
          type="button"
          className="chip"
          style={{ height: 24, fontSize: 10.5, padding: "0 8px" }}
          onClick={() => setOpen(true)}
        >
          <Plus size={10} />
          {list.length === 0 && " 选素材"}
        </button>
      </div>
      {open && <RefPickerModal refs={list} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

/* 素材库选择弹窗(多选,按类型标签切换) */
export function RefPickerModal({
  refs,
  onChange,
  onClose,
}: {
  refs: Material[];
  onChange: (next: Material[]) => void;
  onClose: () => void;
}) {
  const cats = MAT_CATS.map((c) => c.key);
  const [tab, setTab] = React.useState(cats[0] ?? "人物");
  const mats = MATERIALS;
  const sel = refs ?? [];
  const has = (id: string) => sel.some((x) => x.id === id);
  const toggle = (m: Material) => onChange(has(m.id) ? sel.filter((x) => x.id !== m.id) : [...sel, m]);
  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 95 }}>
      <div
        className="card pop-in col"
        style={{ width: 560, maxWidth: "94vw", maxHeight: "78vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-2" style={{ padding: "14px 18px 10px", flex: "none" }}>
          <Users size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 800, fontSize: 15 }}>选参考素材</span>
          <span className="faint" style={{ fontSize: 11.5 }}>选中后可在脚本里用 [参考N] 引用</span>
          <span className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="row gap-2" style={{ padding: "0 18px 10px", flex: "none", flexWrap: "wrap" }}>
          {cats.map((c) => (
            <button key={c} type="button" className={"chip" + (tab === c ? " on" : "")} onClick={() => setTab(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="scroll grow" style={{ minHeight: 0, padding: "2px 18px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(118px,1fr))", gap: 8 }}>
            {mats
              .filter((m) => m.cat === tab)
              .map((m) => {
                const on = has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m)}
                    className="col"
                    style={{
                      padding: 5,
                      borderRadius: 11,
                      textAlign: "left",
                      gap: 4,
                      border: on ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                      background: on ? "var(--accent-soft)" : "var(--surface)",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: "100%",
                        aspectRatio: "4/3",
                        borderRadius: 7,
                        background: `linear-gradient(140deg,${m.from},${m.to})`,
                        position: "relative",
                      }}
                    >
                      {m.kind === "video" && (
                        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                          <Play size={11} fill="#fff" strokeWidth={0} />
                        </span>
                      )}
                      {on && (
                        <span
                          style={{
                            position: "absolute",
                            right: 4,
                            bottom: 4,
                            width: 15,
                            height: 15,
                            borderRadius: "50%",
                            background: "var(--accent)",
                            display: "grid",
                            placeItems: "center",
                            color: "#fff",
                          }}
                        >
                          <Check size={8} />
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        padding: "0 2px",
                      }}
                    >
                      {m.name}
                    </span>
                  </button>
                );
              })}
            {mats.filter((m) => m.cat === tab).length === 0 && (
              <span className="faint" style={{ fontSize: 12, padding: 6 }}>
                素材库里还没有「{tab}」类素材
              </span>
            )}
          </div>
        </div>
        <div className="row gap-2" style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
          <span className="faint num" style={{ fontSize: 12 }}>
            已选 {sel.length} 个 · 序号即 [参考N]
          </span>
          <span className="grow" />
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            <Check size={13} /> 完成
          </button>
        </div>
      </div>
    </div>
  );
}

/* 字幕勾选 */
export function SubToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={on ? "将生成字幕,点击取消" : "不生成字幕,点击开启"}
      className="row gap-1"
      style={{
        padding: "3px 8px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        background: on ? "#dcfce7" : "var(--surface-2)",
        color: on ? "#15803d" : "var(--ink-3)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 13,
          height: 13,
          borderRadius: 4,
          border: on ? "none" : "1.5px solid var(--ink-3)",
          background: on ? "#16a34a" : "transparent",
          display: "grid",
          placeItems: "center",
          color: "#fff",
        }}
      >
        {on && <Check size={9} />}
      </span>
      生成
    </button>
  );
}
