"use client";

// 首页脑暴工作室（chatOn）—— 设计真源 AI短剧工作台.dc.html `chatOn`：
// 左 AI 脑暴对话 / 右 故事大纲（空 → 生成中 → 已生成，全部可编辑）→ 去制作。
// 立项之前的可恢复草稿：?b=<id> 入 URL，整页 BrainstormData 防抖自动保存，刷新/返回可恢复。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUp,
  Check,
  ChevronLeft,
  Clapperboard,
  Info,
  ScrollText,
  Sparkles,
  Zap,
} from "lucide-react";
import { BrainstormApi } from "@/api";
import type { BrainstormData, BrainstormForm, BrainstormMessage } from "@/api/brainstorm";
import { useAsync } from "@/lib/drama-query";
import { useSaveStatus } from "@/lib/use-save-status";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { Editable } from "@/components/drama-ui";
import { aiErrorMessage } from "@/lib/ai-error";

const RATIOS: { k: string; label: string }[] = [
  { k: "9:16", label: "9:16" },
  { k: "16:9", label: "16:9" },
  { k: "1:1", label: "1:1" },
];
const RATIO_LABEL: Record<string, string> = { "9:16": "竖屏 9:16", "16:9": "横屏 16:9", "1:1": "方形 1:1" };

export function BrainstormStudio({ id }: { id: string }) {
  const router = useRouter();
  const { data: detail, isLoading, error } = useAsync(
    `/me/drama/brainstorms/${id}`,
    () => BrainstormApi.getBrainstorm(id),
  );

  const [data, setData] = React.useState<BrainstormData | null>(null);
  React.useEffect(() => {
    if (detail?.data) setData(detail.data);
  }, [detail]);

  const { status: saveStatus, notifyEditing, track } = useSaveStatus();
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖落库（编辑大纲 / 设置）。
  const patch = React.useCallback(
    (next: BrainstormData) => {
      setData(next);
      notifyEditing();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void track(() => BrainstormApi.saveBrainstorm(id, next)).catch(() => {});
      }, 700);
    },
    [id, notifyEditing, track],
  );
  // 立即落库（AI 出对话 / 大纲后，确保不丢）。
  const flush = React.useCallback(
    async (next: BrainstormData) => {
      setData(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      try {
        await track(() => BrainstormApi.saveBrainstorm(id, next));
      } catch {
        /* 出错下次编辑再保存；指示器已反映 */
      }
    },
    [id, track],
  );
  React.useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const [input, setInput] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [outlineLoading, setOutlineLoading] = React.useState(false);
  const [producing, setProducing] = React.useState(false);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<HTMLInputElement>(null);
  const sending = React.useRef(false);
  const kicked = React.useRef(false);

  React.useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.messages, typing]);

  const send = React.useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || !data || sending.current) return;
      if (t === "套爆款模板") { router.push("/templates"); return; }
      sending.current = true;
      setInput("");
      const userMsg: BrainstormMessage = { role: "user", text: t };
      const withUser: BrainstormData = { ...data, messages: [...data.messages, userMsg] };
      setData(withUser);
      setTyping(true);
      try {
        const { message } = await BrainstormApi.chat(id, t, withUser.messages);
        const next: BrainstormData = { ...withUser, messages: [...withUser.messages, message] };
        setTyping(false);
        await flush(next);
      } catch (e) {
        setTyping(false);
        await flush(withUser);
        toast.error(aiErrorMessage(e, "脑暴助手连接失败，请重试"));
      } finally {
        sending.current = false;
      }
    },
    [data, id, flush, router],
  );

  // 带 seed 进来：自动把首条点子发出去，触发第一条 AI 回复（只跑一次）。
  React.useEffect(() => {
    if (kicked.current || !data) return;
    const onlyGreeting = data.messages.length === 1 && data.messages[0].role === "ai";
    if (data.seed && data.seed.trim() && onlyGreeting) {
      kicked.current = true;
      void send(data.seed.trim());
    } else if (onlyGreeting) {
      kicked.current = true; // 无 seed 也标记，避免重复判断
    }
  }, [data, send]);

  const genOutline = React.useCallback(async () => {
    if (!data || outlineLoading) return;
    // 还没聊过（只有 AI 开场白）就点生成 → 友好提示去聊，不打会 400 的请求。
    if (!data.messages.some((m) => m.role === "user")) {
      toast("请先在左侧描述你的想法，再生成故事大纲");
      chatInputRef.current?.focus();
      return;
    }
    setOutlineLoading(true);
    try {
      const { outline } = await BrainstormApi.generateOutline(id, data.messages);
      await flush({ ...data, outline });
    } catch (e) {
      toast.error(aiErrorMessage(e, "故事大纲生成失败，请补充对话后重试"));
    } finally {
      setOutlineLoading(false);
    }
  }, [data, id, outlineLoading, flush]);

  const goProduce = React.useCallback(async () => {
    if (!data?.outline || producing) return;
    setProducing(true);
    const form = data.settings.form;
    try {
      // 先把最新态落库，再带 data promote（后端用最新大纲 / 设置）。
      const result = await BrainstormApi.promote(id, form, data);
      if (result.kind === "short") {
        toast.success("已生成短视频草稿，去工厂继续");
        router.push(`/shorts/make?draft=${encodeURIComponent(result.shortId)}`);
      } else {
        toast.success("已立项，去工作台写剧本、拆分镜");
        router.push(`/projects/${result.projectId}`);
      }
    } catch (e) {
      setProducing(false);
      toast.error(aiErrorMessage(e, "去制作失败，请重试"));
    }
  }, [data, id, producing, router]);

  if (isLoading || (!data && !error)) {
    return <StudioLoading />;
  }
  if (error || !data) {
    return <StudioNotFound onBack={() => router.push("/dashboard")} />;
  }

  const outline = data.outline;
  const form = data.settings.form;
  const ratio = data.settings.ratio;
  const metaLine = outline
    ? [outline.type, form === "single" ? "单片" : "剧集连载", RATIO_LABEL[ratio] ?? ratio, outline.tone]
        .filter(Boolean)
        .join("　·　")
    : "";

  return (
    <div className="ws-flush col" style={{ background: "var(--bg)" }}>
      <div className="row" style={{ padding: "16px 24px 0", flex: "none", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="row gap-2"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600, padding: 4 }}
        >
          <ChevronLeft size={14} /> 回首页
        </button>
        <span className="grow" />
        <SaveStatus status={saveStatus} />
      </div>
      <div className="row gap-4" style={{ flex: 1, minHeight: 0, alignItems: "stretch", padding: "12px 24px 24px", maxWidth: 1180, width: "100%", margin: "0 auto" }}>
        {/* 左：AI 脑暴对话 */}
        <div
          className="col"
          style={{
            width: 368,
            flex: "none",
            borderRadius: 20,
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            boxShadow: "0 22px 56px -26px color-mix(in oklch, var(--accent) 42%, transparent), 0 2px 10px rgba(20,10,50,.06)",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <div className="row gap-3" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-soft)", flex: "none", alignItems: "center" }}>
            <span className="icon-badge" style={{ width: 30, height: 30, borderRadius: 9 }}>
              <Sparkles size={15} />
            </span>
            <div className="col" style={{ lineHeight: 1.25 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>AI 脑暴助手</span>
              <span className="faint" style={{ fontSize: 11 }}>描述你的想法，AI 梳理成一部短剧</span>
            </div>
          </div>
          <div ref={chatScrollRef} className="scroll col gap-3" style={{ padding: "18px 16px", flex: 1, minHeight: 0, background: "var(--bg)" }}>
            {data.messages.map((m, i) => (
              <ChatBubble key={i} m={m} onQuick={(q) => void send(q)} />
            ))}
            {typing && (
              <div className="row" style={{ justifyContent: "flex-start" }}>
                <div className="row gap-1" style={{ padding: "13px 15px", borderRadius: 14, borderBottomLeftRadius: 5, background: "var(--surface-2)" }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" style={{ animationDelay: ".16s" }} />
                  <span className="typing-dot" style={{ animationDelay: ".32s" }} />
                </div>
              </div>
            )}
          </div>
          <div className="row gap-2" style={{ padding: "12px 14px", borderTop: "1px solid var(--line-soft)", alignItems: "center", flex: "none" }}>
            <input
              ref={chatInputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="输入你的想法，回车发送…"
              style={{ flex: 1, height: 42, border: "1.5px solid var(--line)", borderRadius: 12, padding: "0 14px", fontSize: 14, background: "var(--surface-2)", outline: "none", color: "var(--ink)" }}
            />
            <button type="button" onClick={() => void send(input)} className="btn btn-grad btn-icon" style={{ width: 42, height: 42, flex: "none" }} aria-label="发送">
              <ArrowUp size={17} />
            </button>
          </div>
        </div>

        {/* 右：故事大纲 */}
        <div
          className="col grow"
          style={{ minWidth: 0, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--line-soft)", boxShadow: "0 2px 10px rgba(20,10,50,.04)", overflow: "hidden", minHeight: 0 }}
        >
          <div className="row gap-3" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
            <ScrollText size={17} style={{ color: "var(--accent)", flex: "none" }} />
            <span style={{ fontWeight: 800, fontSize: 14, flex: "none", whiteSpace: "nowrap" }}>故事大纲</span>
            <span className="faint" style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {outlineLoading ? "正在整理对话内容…" : outline ? "根据对话整理出的故事大纲" : "还没生成，点下方按钮生成"}
            </span>
            {outline && !outlineLoading && (
              <span style={{ flex: "none", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface-2)", padding: "2px 9px", borderRadius: 999 }}>新生成</span>
            )}
          </div>

          {!outline && !outlineLoading && (
            <div className="col center grow" style={{ padding: "30px 28px", textAlign: "center", gap: 15, minHeight: 0 }}>
              <span style={{ width: 60, height: 60, borderRadius: 18, background: "var(--surface-2)", border: "1.5px dashed var(--line)", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
                <ScrollText size={27} />
              </span>
              <div className="col gap-1" style={{ maxWidth: 300 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>故事大纲会出现在这里</div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.65 }}>
                  在左侧描述清楚你的想法，点击「生成故事大纲」，AI 会把人物、脉络与设定整理到这里。
                </div>
              </div>
              <button type="button" onClick={() => void genOutline()} className="btn btn-grad" style={{ height: 42, padding: "0 22px" }}>
                <Sparkles size={16} /> 生成故事大纲
              </button>
            </div>
          )}

          {outlineLoading && <OutlineSkeleton />}

          {outline && !outlineLoading && (
            <>
              <div className="scroll grow gen-reveal" style={{ minHeight: 0, padding: "22px" }}>
                <div className="col" style={{ gap: 20 }}>
                  {/* 故事 */}
                  <div className="col gap-3">
                    <div className="faint" style={{ fontSize: 12 }}>{metaLine}</div>
                    <Editable
                      value={outline.title}
                      onCommit={(v) => patch({ ...data, outline: { ...outline, title: v } })}
                      block
                      style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2 }}
                    />
                    <div style={{ borderLeft: "3px solid color-mix(in oklch, var(--accent) 45%, var(--line))", background: "var(--surface-2)", borderRadius: "0 10px 10px 0", padding: "9px 13px", marginTop: 2 }}>
                      <div className="row gap-2" style={{ alignItems: "center", marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", color: "var(--accent)" }}>剧情脉络</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)", padding: "1px 6px", borderRadius: 999 }}>AI 分析</span>
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-2)" }}>{outline.beats.join("　→　")}</div>
                    </div>
                    <Editable
                      value={outline.logline}
                      onCommit={(v) => patch({ ...data, outline: { ...outline, logline: v } })}
                      block
                      style={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--ink-2)" }}
                    />
                  </div>

                  <div style={{ height: 1, background: "var(--line-soft)" }} />

                  {/* 核心人物 —— 紧凑双列卡片（原先单列整行铺开太占空间） */}
                  <div className="col gap-3">
                    <div className="row gap-2" style={{ alignItems: "center" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>核心人物</span>
                      <span className="faint" style={{ fontSize: 11 }}>{outline.roles.length} 位 · 点击可改</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))", gap: 8 }}>
                      {outline.roles.map((r, i) => (
                        <div
                          key={i}
                          className="row gap-2"
                          style={{
                            alignItems: "center",
                            padding: "7px 10px 7px 7px",
                            borderRadius: 12,
                            background: "var(--surface-2)",
                            boxShadow: "inset 0 0 0 1px var(--line-soft)",
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, color-mix(in oklch, var(--accent) 18%, #fff), color-mix(in oklch, var(--accent-2) 18%, #fff))",
                              boxShadow: "inset 0 0 0 1px var(--line)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 13,
                              fontWeight: 800,
                              color: "var(--accent-2)",
                              flex: "none",
                            }}
                          >
                            {r.name.slice(0, 1)}
                          </div>
                          <div className="col" style={{ minWidth: 0, gap: 1, lineHeight: 1.3 }}>
                            <Editable
                              value={r.name}
                              onCommit={(v) => patch({ ...data, outline: { ...outline, roles: outline.roles.map((x, j) => (j === i ? { ...x, name: v } : x)) } })}
                              block
                              style={{ fontSize: 13.5, fontWeight: 700 }}
                            />
                            <Editable
                              value={r.role}
                              onCommit={(v) => patch({ ...data, outline: { ...outline, roles: outline.roles.map((x, j) => (j === i ? { ...x, role: v } : x)) } })}
                              block
                              style={{ fontSize: 11.5, color: "var(--ink-3)" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: 1, background: "var(--line-soft)" }} />

                  {/* 取景参考 */}
                  <div className="col gap-3">
                    <div className="row gap-2" style={{ alignItems: "center" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>取景参考</span>
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.9, color: "var(--ink-2)" }}>{outline.scenes.join("　·　")}</div>
                  </div>

                  <div style={{ height: 1, background: "var(--line-soft)" }} />

                  {/* 制作设置 */}
                  <div className="col gap-3">
                    <div className="row gap-2" style={{ alignItems: "center" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>制作设置</span>
                      <span className="faint" style={{ fontSize: 11 }}>形态决定去做短剧还是短视频</span>
                    </div>
                    <SettingRow label="形态">
                      <Seg
                        options={[{ k: "series", label: "剧集" }, { k: "single", label: "单片" }]}
                        value={form}
                        onChange={(k) => patch({ ...data, settings: { ...data.settings, form: k as BrainstormForm } })}
                      />
                    </SettingRow>
                    <SettingRow label="画幅比">
                      <Seg options={RATIOS} value={ratio} onChange={(k) => patch({ ...data, settings: { ...data.settings, ratio: k } })} />
                    </SettingRow>
                  </div>
                </div>
              </div>

              {/* 底部 CTA */}
              <div className="row gap-3" style={{ padding: "12px 18px", borderTop: "1px solid var(--line-soft)", flex: "none", alignItems: "center" }}>
                <Info size={13} style={{ color: "var(--ink-3)", flex: "none" }} />
                <span className="faint" style={{ fontSize: 11.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  满意后进入工作台逐集撰写剧本、拆分镜；需要调整可在左侧继续对话
                </span>
                <button type="button" onClick={() => void goProduce()} disabled={producing} className="btn btn-grad" style={{ height: 40, padding: "0 20px", flex: "none" }}>
                  {form === "single" ? <Zap size={15} /> : <Clapperboard size={15} />}
                  {producing ? "处理中…" : form === "single" ? "去做短视频" : "去制作"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ m, onQuick }: { m: BrainstormMessage; onQuick: (q: string) => void }) {
  const mine = m.role === "user";
  return (
    <div className="row" style={{ justifyContent: mine ? "flex-end" : "flex-start" }}>
      <div className="col gap-2" style={{ maxWidth: "84%" }}>
        <div
          style={{
            padding: "11px 14px",
            borderRadius: 14,
            borderBottomLeftRadius: mine ? 14 : 5,
            borderBottomRightRadius: mine ? 5 : 14,
            background: mine ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "var(--surface-2)",
            color: mine ? "#fff" : "var(--ink)",
            fontSize: 13.5,
            lineHeight: 1.65,
            whiteSpace: "pre-line",
          }}
        >
          {m.text}
        </div>
        {!mine && m.quick && m.quick.length > 0 && (
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {m.quick.map((q, i) => (
              <button key={i} type="button" onClick={() => onQuick(q)} className="chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--ink-2)", width: 56, flex: "none" }}>{label}</span>
      <div className="row" style={{ background: "var(--surface-2)", borderRadius: 10, padding: 3, gap: 2, flex: "none" }}>{children}</div>
    </div>
  );
}

function Seg({ options, value, onChange }: { options: { k: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            style={{
              height: 30,
              padding: "0 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: on ? "var(--surface)" : "transparent",
              boxShadow: on ? "var(--shadow-sm)" : "none",
              color: on ? "var(--accent)" : "var(--ink-3)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </>
  );
}

function OutlineSkeleton() {
  return (
    <div className="col grow" style={{ padding: "24px 22px", gap: 18, minHeight: 0 }}>
      <div className="col center gap-3" style={{ padding: "6px 0 2px" }}>
        <span className="gen-pulse" style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "grid", placeItems: "center", color: "#fff" }}>
          <Sparkles size={24} />
        </span>
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>正在生成故事大纲</span>
          <span className="row gap-1">
            <span className="typing-dot" />
            <span className="typing-dot" style={{ animationDelay: ".16s" }} />
            <span className="typing-dot" style={{ animationDelay: ".32s" }} />
          </span>
        </div>
      </div>
      <div className="col gap-2"><div className="skel" style={{ height: 13, width: "38%" }} /><div className="skel" style={{ height: 24, width: "72%" }} /></div>
      <div className="skel" style={{ height: 58, width: "100%" }} />
      <div className="col gap-2"><div className="skel" style={{ height: 13, width: "30%" }} /><div className="skel" style={{ height: 40, width: "100%" }} /><div className="skel" style={{ height: 40, width: "100%" }} /></div>
    </div>
  );
}

function StudioLoading() {
  return (
    <div className="ws-flush col center" style={{ gap: 14, background: "var(--bg)" }}>
      <span aria-hidden style={{ width: 34, height: 34, border: "3px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "drama-spin .8s linear infinite" }} />
      <div className="muted" style={{ fontSize: 13 }}>正在打开脑暴…</div>
    </div>
  );
}

function StudioNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="ws-flush col center" style={{ gap: 14, textAlign: "center", background: "var(--bg)" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>没找到这次脑暴</h1>
      <div className="muted">可能是链接过期或已删除。回首页重新开始。</div>
      <button type="button" className="btn btn-line" onClick={onBack}>
        <ChevronLeft size={16} /> 回首页
      </button>
    </div>
  );
}
