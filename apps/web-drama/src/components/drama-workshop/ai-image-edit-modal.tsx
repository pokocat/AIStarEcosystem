"use client";

// AI 改图弹窗（通用）— 设计稿 imgEditOpen：左指令对话 + 右预览 + 版本号；复用 render/frame + ref 图迭代。
// 同时服务「分镜首帧」（9:16）与「场景参考图」（16:9）—— 逻辑一致，只是比例 / 文案不同。
import * as React from "react";
import { ArrowUp, Sparkles, Wand2, X, Zap } from "lucide-react";
import { RenderApi } from "@/api";
import type { RenderedFrame } from "@/api/render";
import { aiErrorMessage } from "@/lib/ai-error";

const DEFAULT_CHIPS = ["换成夜景", "换暖色调", "背景虚化", "再高级一点", "加点氛围感"];

export interface AiImageEditModalProps {
  /** 标题右侧小标签，如「镜 3」「场景」。 */
  tag?: string;
  /** 开场 AI 提示语。 */
  openingText: string;
  /** 画面基础描述，会拼进改图提示词：`${baseDesc}。改图要求：…`。 */
  baseDesc: string;
  /** 可选场景名（喂 render vars.scene）。 */
  sceneName?: string;
  /** 当前图片（首帧 / 参考图）。 */
  initialUrl?: string;
  /** 预览比例。 */
  ratio: "9:16" | "16:9";
  /** 快捷指令 chips（默认通用一组）。 */
  chips?: string[];
  onClose: () => void;
  /** 改图成功回填：新图的 url + cdnKey（cdnKey 为真值，调用方按需落库）。 */
  onCommit: (frame: { url: string; cdnKey?: string }) => void;
}

export function AiImageEditModal({
  tag,
  openingText,
  baseDesc,
  sceneName,
  initialUrl,
  ratio,
  chips = DEFAULT_CHIPS,
  onClose,
  onCommit,
}: AiImageEditModalProps) {
  const [msgs, setMsgs] = React.useState<{ role: "ai" | "user"; text: string }[]>([
    { role: "ai", text: openingText },
  ]);
  const [input, setInput] = React.useState("");
  const [url, setUrl] = React.useState<string | undefined>(initialUrl);
  const [ver, setVer] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const e = scrollRef.current;
    if (e) e.scrollTop = e.scrollHeight;
  }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const { frames } = await RenderApi.renderFrame({
        kind: "shot",
        vars: { desc: `${baseDesc}。改图要求：${t}`, ...(sceneName ? { scene: sceneName } : {}) },
        ratio,
        count: 1,
        refImages: url ? [url] : undefined,
      });
      const f: RenderedFrame | undefined = frames[0];
      if (f?.url) {
        setUrl(f.url);
        setVer((v) => v + 1);
        onCommit({ url: f.url, cdnKey: f.cdnKey });
        setMsgs((m) => [...m, { role: "ai", text: `按「${t}」重新生成，右侧为第 ${ver + 1} 版。可继续输入指令调整，满意后关闭即可。` }]);
      } else {
        setMsgs((m) => [...m, { role: "ai", text: "本次未生成新图，请调整描述后重试。" }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "ai", text: aiErrorMessage(e, "改图失败，请稍后重试") }]);
    } finally {
      setBusy(false);
    }
  };

  const previewBox: React.CSSProperties =
    ratio === "16:9"
      ? { width: "100%", maxWidth: 540, aspectRatio: "16/9" }
      : { height: "100%", maxHeight: 430, aspectRatio: "9/16" };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="pop-in col"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(900px,94vw)", height: "min(580px,90vh)", background: "var(--surface)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", alignItems: "center" }}>
          <span className="icon-badge" style={{ width: 28, height: 28, borderRadius: 8 }}><Wand2 size={14} /></span>
          <span style={{ fontWeight: 800, fontSize: 15 }}>AI 改图</span>
          {tag && <span className="tag tag-accent" style={{ flex: "none" }}>{tag}</span>}
          <span className="grow" />
          <button type="button" onClick={onClose} className="btn btn-icon btn-ghost btn-sm"><X size={15} /></button>
        </div>
        <div className="row grow" style={{ minHeight: 0, alignItems: "stretch" }}>
          {/* 左：对话 */}
          <div className="col" style={{ width: 340, flex: "none", borderRight: "1px solid var(--line-soft)" }}>
            <div ref={scrollRef} className="scroll grow col gap-3" style={{ padding: 16, minHeight: 0, background: "var(--bg)" }}>
              {msgs.map((m, i) => (
                <div key={i} className="row" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ padding: "9px 12px", borderRadius: 13, borderBottomRightRadius: m.role === "user" ? 4 : 13, borderBottomLeftRadius: m.role === "user" ? 13 : 4, background: m.role === "user" ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "var(--surface-2)", color: m.role === "user" ? "#fff" : "var(--ink)", fontSize: 12.5, lineHeight: 1.6, maxWidth: "86%" }}>{m.text}</div>
                </div>
              ))}
              {busy && (
                <div className="row" style={{ justifyContent: "flex-start" }}>
                  <div className="row gap-1" style={{ padding: "11px 13px", borderRadius: 13, borderBottomLeftRadius: 4, background: "var(--surface-2)" }}>
                    <span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: ".16s" }} /><span className="typing-dot" style={{ animationDelay: ".32s" }} />
                  </div>
                </div>
              )}
            </div>
            <div className="col gap-2" style={{ padding: "10px 12px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                {chips.map((c) => (
                  <button key={c} type="button" onClick={() => void send(c)} className="chip" style={{ height: 25, fontSize: 11, background: "var(--accent-soft)", color: "var(--accent)" }}>{c}</button>
                ))}
              </div>
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(input); } }}
                  placeholder="描述你想如何修改这张图…" className="chat-input" style={{ flex: 1, height: 40, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 13px", fontSize: 13, background: "var(--surface-2)", outline: "none", color: "var(--ink)" }} />
                <button type="button" onClick={() => void send(input)} className="btn btn-grad btn-icon" style={{ width: 40, height: 40, flex: "none" }}><ArrowUp size={16} /></button>
              </div>
            </div>
          </div>
          {/* 右：预览 */}
          <div className="col center grow" style={{ padding: 22, background: "var(--surface-2)", minWidth: 0, gap: 12 }}>
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow)", background: "#1c1917", ...previewBox }}>
              {url ? <img src={url} alt="预览" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div className="col center grow" style={{ height: "100%", color: "#fff" }}><Sparkles size={28} /></div>}
              {busy && (
                <div className="col center gap-2" style={{ position: "absolute", inset: 0, background: "rgba(28,25,23,.42)", backdropFilter: "blur(2px)", color: "#fff" }}>
                  <span className="gen-pulse" style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "grid", placeItems: "center" }}><Sparkles size={20} /></span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>正在重新生成…</span>
                </div>
              )}
            </div>
            <div className="faint row gap-1" style={{ fontSize: 11.5 }}><Zap size={12} /> 第 {ver} 版 · 左侧输入指令继续改</div>
          </div>
        </div>
      </div>
    </div>
  );
}
