"use client";
// ============================================================
// 人设工作室 —— 名片编辑页里那块「聊出你是谁」。
//
// 为什么名片要有这一层：名片上的字段（职位 / 城市 / 作品 / 履历）说的是
// **他做过什么**；而见了面真正记住一个人，靠的是**他是谁** —— 在意什么、
// 说话什么调子。这一层就是后者。
//
// 设计上刻意做成**对话**而不是表单：直接问「你的价值观是什么」没人答得上来，
// 答上来的也都是「诚信、专业、共赢」这种谁都能填的词。顾问的问法是问具体的小事
// （「上次你拒掉一单生意是因为什么」），从回答里把价值观**提炼**出来 ——
// 提示词里写死了这条规矩（resources/prompts/material/card.persona_chat.md）。
//
// 人设不是摆设：`voice`（怎么说 / 不说什么）是**说话方式的规格**，
// 「按人设改写文案」会用它重写访客真正看得见的那几句，且**只改说法不改事实**。
// 这是整个功能的落点 —— 聊完之后名片本身会变好，而不是多出一段没人看的自我介绍。
//
// §8.0：模型没配就如实报错（503），绝不用套话冒充「AI 帮你梳理的人设」——
// 这东西是要印在对外名片上的，假的比没有更糟。
// ============================================================
import React from "react";
import { Bot, Check, Loader2, RefreshCw, Sparkles, User, Wand2, X } from "lucide-react";
import { CardApi, EMPTY_PERSONA, type CardPersona, type CardProfile } from "@/proto/card";

type Msg = { role: "user" | "assistant"; content: string };
type Draft = NonNullable<Awaited<ReturnType<typeof CardApi.personaChat>>["draft"]>;

const OPENERS = [
  "我想让名片像我本人一点",
  "帮我把「我是谁」说清楚",
  "我不太会介绍自己",
];

export function PersonaStudio({
  cardId, doc, onPatch,
}: {
  cardId: string;
  doc: CardProfile;
  onPatch: (fn: (d: CardProfile) => CardProfile) => void;
}) {
  const persona = doc.persona ?? EMPTY_PERSONA;
  const has = Boolean(persona.essence || persona.values.length || persona.traits.length);

  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [rewrite, setRewrite] = React.useState<{ headline: string; give: string[]; want: string[]; note: string } | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);

  /** 交给模型的上下文：名片上已有的东西，顾问据此少问几个已经知道的问题。 */
  const context = React.useCallback(() => ({
    name: doc.name, title: doc.title, city: doc.city, headline: doc.headline,
    give: doc.offer.give.join("；"), want: doc.offer.want.join("；"),
    persona: has ? JSON.stringify(persona) : "",
  }), [doc, has, persona]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setErr(null);
    setInput("");
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: t }]);
    setBusy(true);
    try {
      const turn = await CardApi.personaChat(cardId, { context: context(), history, message: t });
      setMsgs((m) => [...m, { role: "assistant", content: turn.reply }]);
      if (turn.ready && turn.draft) setDraft(turn.draft);
    } catch (e) {
      // 如实说是哪一步不成 —— 未配置模型 / 调用失败，用户与运维要能据此行动
      setErr(e instanceof Error ? e.message : "聊不通，稍后再试");
    } finally {
      setBusy(false);
    }
  };

  const adopt = () => {
    if (!draft) return;
    onPatch((d) => ({
      ...d,
      persona: { ...draft, source: "chat", updatedAt: new Date().toISOString() },
    }));
    setDraft(null);
    setMsgs((m) => [...m, { role: "assistant", content: "已经写进名片了。要不要按这个人设，把「一句话 / 能提供 / 在找」也顺一遍？" }]);
  };

  const doRewrite = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await CardApi.personaRewrite(cardId, {
        persona: JSON.stringify(doc.persona ?? persona),
        headline: doc.headline, title: doc.title,
        give: doc.offer.give.join("；"), want: doc.offer.want.join("；"),
      });
      setRewrite(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "改写没成功，稍后再试");
    } finally {
      setBusy(false);
    }
  };

  const adoptRewrite = () => {
    if (!rewrite) return;
    onPatch((d) => ({
      ...d,
      headline: rewrite.headline || d.headline,
      offer: {
        give: rewrite.give?.length ? rewrite.give : d.offer.give,
        want: rewrite.want?.length ? rewrite.want : d.offer.want,
      },
    }));
    setRewrite(null);
  };

  const setPersona = (fn: (p: CardPersona) => CardPersona) =>
    onPatch((d) => ({ ...d, persona: fn(d.persona ?? EMPTY_PERSONA) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── 现状 ─────────────────────────────────────────────── */}
      {has ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row label="一句话人设">
            <input
              value={persona.essence}
              placeholder="这个人骨子里是谁"
              onChange={(e) => setPersona((p) => ({ ...p, essence: e.target.value }))}
              style={INPUT}
            />
          </Row>
          <Row label="价值观" hint="一行一条。这些是访客在名片上看得到的。">
            <textarea
              value={persona.values.join("\n")} rows={3} placeholder={"一行一条"}
              onChange={(e) => setPersona((p) => ({ ...p, values: lines(e.target.value) }))}
              style={{ ...INPUT, resize: "vertical" }}
            />
          </Row>
          <Row label="性格特征" hint="逗号或换行分隔。">
            <ChipEditor
              items={persona.traits}
              onChange={(v) => setPersona((p) => ({ ...p, traits: v }))}
              placeholder="加一个特征"
            />
          </Row>
          <Row label="说话方式" hint="「按人设改写文案」按这一条来写；将来数字人开口也按它。">
            <input
              value={persona.voice.tone}
              placeholder="例：句子短，先给结论，不铺垫"
              onChange={(e) => setPersona((p) => ({ ...p, voice: { ...p.voice, tone: e.target.value } }))}
              style={INPUT}
            />
          </Row>
          <Row label="不说这类话" hint="一行一条。改写时会避开。">
            <textarea
              value={persona.voice.avoid.join("\n")} rows={2} placeholder={"例：赋能、闭环、生态位"}
              onChange={(e) => setPersona((p) => ({ ...p, voice: { ...p.voice, avoid: lines(e.target.value) } }))}
              style={{ ...INPUT, resize: "vertical" }}
            />
          </Row>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={() => setOpen((v) => !v)} icon={<Bot size={14} />}>
              {open ? "收起对话" : "接着聊，改改人设"}
            </Btn>
            <Btn onClick={() => void doRewrite()} busy={busy} primary icon={<Wand2 size={14} />}>
              按人设改写名片文案
            </Btn>
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px dashed var(--line-2)", borderRadius: 14, padding: 18,
            background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14.5, fontWeight: 800 }}>
            <Sparkles size={16} style={{ color: "var(--primary)" }} /> 把「你是谁」说清楚
          </span>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-2)" }}>
            名片上现在写的是你**做过什么**。但见了面真正被记住的，是你在意什么、说话什么调子。
            跟顾问聊几句 —— 它问的都是具体的小事，你照实说就行，价值观和性格由它替你提炼。
          </p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {OPENERS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => { setOpen(true); void send(o); }}
                style={{
                  padding: "7px 12px", borderRadius: 999, border: "1px solid var(--line-2)",
                  background: "var(--surface)", color: "var(--ink-2)", fontSize: 12.5,
                  fontFamily: "inherit", cursor: "pointer",
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 对话 ─────────────────────────────────────────────── */}
      {(open || (!has && msgs.length > 0)) && (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: 14, overflow: "hidden", background: "var(--surface)" }}>
          <div style={{ maxHeight: 320, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.length === 0 && (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.7 }}>
                随便从哪句开始都行。顾问会一次问一个具体的问题。
              </p>
            )}
            {msgs.map((m, i) => <Bubble key={i} role={m.role} text={m.content} />)}
            {busy && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-3)" }}>
                <Loader2 size={13} className="spin" /> 想一下…
              </span>
            )}
            <div ref={endRef} />
          </div>

          {draft && <DraftCard draft={draft} onAdopt={adopt} onKeepTalking={() => setDraft(null)} />}

          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
            <input
              value={input}
              placeholder="照实说就行"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void send(input); }}
              style={{ ...INPUT, flex: 1 }}
            />
            <Btn onClick={() => void send(input)} busy={busy} primary>发送</Btn>
          </div>
        </div>
      )}

      {/* ── 改写结果 ─────────────────────────────────────────── */}
      {rewrite && (
        <div style={{ border: "1px solid var(--primary)", borderRadius: 14, padding: 14, background: "var(--primary-soft)" }}>
          <span style={{ fontSize: 13, fontWeight: 800, display: "block", marginBottom: 8 }}>按人设改写后</span>
          <Preview label="一句话" value={rewrite.headline} />
          <Preview label="能提供" value={(rewrite.give || []).join("　·　")} />
          <Preview label="在找" value={(rewrite.want || []).join("　·　")} />
          {rewrite.note && (
            <p style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.7, color: "var(--ink-3)" }}>{rewrite.note}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn onClick={adoptRewrite} primary icon={<Check size={14} />}>采用</Btn>
            <Btn onClick={() => setRewrite(null)} icon={<X size={14} />}>不用</Btn>
            <Btn onClick={() => void doRewrite()} busy={busy} icon={<RefreshCw size={14} />}>换一版</Btn>
          </div>
        </div>
      )}

      {err && (
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--err)" }}>{err}</p>
      )}
    </div>
  );
}

// ── 小件 ──────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px",
  border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)",
  background: "var(--surface)", color: "var(--ink)",
  fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, outline: "none",
};

const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--ink-4)", lineHeight: 1.6 }}>{hint}</span>}
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const me = role === "user";
  return (
    <div style={{ display: "flex", gap: 8, flexDirection: me ? "row-reverse" : "row" }}>
      <span
        style={{
          width: 24, height: 24, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center",
          background: me ? "var(--surface-2)" : "var(--primary-soft)",
          color: me ? "var(--ink-3)" : "var(--primary-700)",
        }}
      >
        {me ? <User size={13} /> : <Bot size={13} />}
      </span>
      <span
        style={{
          maxWidth: "80%", padding: "9px 12px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.75,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          background: me ? "var(--primary)" : "var(--surface-2)",
          color: me ? "#fff" : "var(--ink)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function DraftCard({ draft, onAdopt, onKeepTalking }: { draft: Draft; onAdopt: () => void; onKeepTalking: () => void }) {
  return (
    <div style={{ borderTop: "1px solid var(--line)", padding: 14, background: "var(--surface-2)" }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, display: "block", marginBottom: 9 }}>聊出来的人设</span>
      <Preview label="一句话" value={draft.essence} />
      <Preview label="价值观" value={(draft.values || []).join("　·　")} />
      <Preview label="性格" value={(draft.traits || []).join("　·　")} />
      <Preview label="说话方式" value={draft.voice?.tone ?? ""} />
      {draft.voice?.avoid?.length ? <Preview label="不说" value={draft.voice.avoid.join("　·　")} /> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
        <Btn onClick={onAdopt} primary icon={<Check size={14} />}>就它了</Btn>
        <Btn onClick={onKeepTalking}>再聊聊</Btn>
      </div>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0" }}>
      <span style={{ fontSize: 11, color: "var(--ink-4)", flexShrink: 0, width: 52 }}>{label}</span>
      <span style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap", minWidth: 0 }}>{value}</span>
    </div>
  );
}

function ChipEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [v, setV] = React.useState("");
  const add = () => {
    const t = v.trim();
    if (!t || items.includes(t)) { setV(""); return; }
    onChange([...items, t]);
    setV("");
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {items.map((t) => (
        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: "var(--surface-2)", fontSize: 12.5 }}>
          {t}
          <button
            type="button" aria-label={`删除 ${t}`} onClick={() => onChange(items.filter((x) => x !== t))}
            style={{ border: "none", background: "transparent", cursor: "pointer", lineHeight: 0, padding: 0, color: "var(--ink-4)" }}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={v} placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }}
        onBlur={add}
        style={{ ...INPUT, width: 120, padding: "5px 9px", fontSize: 12.5 }}
      />
    </div>
  );
}

function Btn({
  children, onClick, primary, busy, icon,
}: { children: React.ReactNode; onClick: () => void; primary?: boolean; busy?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} disabled={busy}
      style={{
        height: 34, padding: "0 13px", borderRadius: 9, cursor: busy ? "default" : "pointer",
        border: primary ? "none" : "1px solid var(--line-2)",
        background: primary ? "var(--primary)" : "var(--surface)",
        color: primary ? "#fff" : "var(--ink-2)",
        fontFamily: "inherit", fontSize: 13, fontWeight: 700,
        display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? <Loader2 size={14} className="spin" /> : icon}
      {children}
    </button>
  );
}
