"use client";

// 悬浮 AI 对话面板 — 剧集脚本编辑器左侧:收起为圆形 FAB,展开为对话框。
// 模板化提示词由调用方传入(如【衍生上一集】【给我惊喜】)。
import * as React from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";

export interface ChatMsg {
  who: "ai" | "me";
  text: string;
}

export function AiChatPanel({
  msgs,
  quick,
  busy,
  onSend,
}: {
  msgs: ChatMsg[];
  quick: string[];
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs.length, busy, open]);

  if (!open) {
    return (
      <button
        type="button"
        title="AI 脚本助手"
        onClick={() => setOpen(true)}
        className="pop-in"
        style={{
          position: "absolute",
          left: 22,
          bottom: 22,
          zIndex: 24,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <Sparkles size={22} />
      </button>
    );
  }

  return (
    <div
      className="card col pop-in"
      style={{
        position: "absolute",
        left: 22,
        bottom: 22,
        zIndex: 24,
        width: 300,
        maxHeight: "min(440px, 70%)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
      }}
    >
      <div className="row gap-2" style={{ padding: "9px 12px", borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
            display: "grid",
            placeItems: "center",
            flex: "none",
            color: "#fff",
          }}
        >
          <Sparkles size={12} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>AI 脚本助手</span>
        <span className="faint" style={{ fontSize: 10.5 }}>聊一句,改全篇</span>
        <span className="grow" />
        <button type="button" className="btn btn-icon btn-ghost btn-sm" style={{ width: 22, height: 22 }} onClick={() => setOpen(false)}>
          <X size={13} />
        </button>
      </div>

      <div ref={listRef} className="scroll grow col gap-2" style={{ minHeight: 120, padding: "10px 12px" }}>
        {msgs.map((m, i) => (
          <div key={i} className="row" style={{ justifyContent: m.who === "me" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "88%",
                padding: "7px 10px",
                borderRadius: 11,
                fontSize: 12,
                lineHeight: 1.55,
                background: m.who === "me" ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "var(--surface-2)",
                color: m.who === "me" ? "#fff" : "var(--ink)",
                borderBottomRightRadius: m.who === "me" ? 4 : 11,
                borderBottomLeftRadius: m.who === "me" ? 11 : 4,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="row gap-2" style={{ padding: "6px 10px", borderRadius: 11, background: "var(--surface-2)", alignSelf: "flex-start" }}>
            <span aria-hidden style={{ width: 11, height: 11, border: "2px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "drama-spin .7s linear infinite" }} />
            <span className="faint" style={{ fontSize: 11 }}>正在重写脚本…</span>
          </div>
        )}
      </div>

      <div className="col gap-2" style={{ padding: "8px 10px 10px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {quick.map((q) => (
            <button key={q} type="button" className="chip" style={{ height: 24, fontSize: 11, background: "var(--accent-soft)", color: "var(--accent)" }} disabled={busy} onClick={() => onSend(q)}>
              <Sparkles size={10} /> {q}
            </button>
          ))}
        </div>
        <div className="row gap-2" style={{ alignItems: "flex-end" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim()) {
                  onSend(draft.trim());
                  setDraft("");
                }
              }
            }}
            placeholder="告诉 AI 怎么改…"
            rows={1}
            style={{ flex: 1, minWidth: 0, minHeight: 32, maxHeight: 88, border: "1.5px solid var(--line)", borderRadius: 10, padding: "7px 10px", fontSize: 12, outline: "none", resize: "none", background: "var(--surface-2)", fontFamily: "inherit" }}
          />
          <button
            type="button"
            className="btn btn-grad btn-icon"
            style={{ width: 32, height: 32, flex: "none" }}
            disabled={busy || !draft.trim()}
            onClick={() => {
              onSend(draft.trim());
              setDraft("");
            }}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
