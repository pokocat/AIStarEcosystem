"use client";

// AI 改图弹窗（通用）— 设计稿 imgEditOpen：左指令对话 + 右预览 + 版本号；复用 render/frame + ref 图迭代。
// 同时服务「分镜首帧」（9:16）与「场景参考图」（16:9）—— 逻辑一致，只是比例 / 文案不同。
// v0.197：≤720 预览在上、对话在下（styles/pages/episode.css 的 .ep-imgedit*）。
// 每出一版就替换原图（onCommit），文案照实说，不写「满意后关闭即可」这种暗示关掉才算数的话。
// v0.197 评审后：
// - 改图要求以前塞在 vars.desc 里，而服务端三份出图模板（drama.frame_image / short_frame_image /
//   scene_frame_image）读的是 {{visual}} / {{place}}，没填的占位符会被清掉 —— 用户说的「换成夜景」
//   根本没进提示词。现在按 kind 填模板真正读的那个变量（editPromptVars，有单测对着模板文件校验）。
// - 每次发送都先确认：改图会直接替换原图，不适用「小额免打扰」。cost 必填，调用方传真实单价。
// - kind 必填：场景图 / 短视频分镜以前没传、默认走了短剧分镜模板，改图要求落不到它们自己的模板里。
import * as React from "react";
import { ArrowUp, Sparkles, Wand2, X, Zap } from "lucide-react";
import { RenderApi } from "@/api";
import type { RenderedFrame } from "@/api/render";
import { aiErrorMessage } from "@/lib/ai-error";
import { CreditMark, dramaConfirm } from "@/components/drama-ui";
import { useModalA11y } from "@/lib/use-modal-a11y";

const DEFAULT_CHIPS = ["换成夜景", "换暖色调", "背景虚化", "光线更有质感", "加点氛围感"];

/** 用哪份服务端出图模板：shot=短剧分镜首帧 / short=短视频分镜首帧 / scene=场景图（空景）。 */
export type ImageEditKind = "shot" | "short" | "scene";

/**
 * 改图请求的模板变量。键名必须是对应模板里真有的占位符（服务端 fill 之后会把没填上的 {{x}} 清掉，
 * 填错键名 = 改图要求静默丢失）：
 * - drama.frame_image / drama.short_frame_image 读 {{visual}}（shot 另有 {{sceneClause}}）
 * - drama.scene_frame_image 读 {{place}}
 */
export function editPromptVars(kind: ImageEditKind, baseDesc: string, instruction: string, sceneName?: string): Record<string, string> {
  const text = `${baseDesc}。改图要求：${instruction}`;
  if (kind === "scene") return { place: text };
  if (kind === "short") return { visual: text };
  return { visual: text, ...(sceneName ? { sceneClause: `场景：${sceneName}。` } : {}) };
}

export interface AiImageEditModalProps {
  /** 标题右侧小标签，如「场 1 · 第 3 镜」「场景」。 */
  tag?: string;
  /** 开场 AI 提示语。 */
  openingText: string;
  /** 画面基础描述，会拼进改图提示词：`${baseDesc}。改图要求：…`。 */
  baseDesc: string;
  /** shot 模板的场景（「地点，氛围」），和正常出首帧的 sceneClause 同一句；不传就不带场景。 */
  sceneName?: string;
  /**
   * 用哪份出图模板：短剧分镜 shot / 短视频分镜 short / 场景图 scene。**必填、没有默认值**：
   * 以前默认 shot，场景图和短视频调用方没传，场景图改图就走了人物分镜模板（场景图里冒出人来）。
   */
  kind: ImageEditKind;
  /** 用哪个图片模型（和分镜表上选的一致）；不传走默认模型。cost 要按同一个模型算。 */
  endpointId?: string;
  /** 当前图片（首帧 / 参考图）。 */
  initialUrl?: string;
  /** 预览比例。 */
  ratio: "9:16" | "16:9";
  /** 快捷指令 chips（默认通用一组）。 */
  chips?: string[];
  /** 每改一次的积分（按所用图片模型算，见 renderCreditCost）。每次发送前都会带着它确认。 */
  cost: number;
  onClose: () => void;
  /** 改图成功回填：新图的 url + cdnKey（cdnKey 为真值，调用方按需落库）。 */
  onCommit: (frame: { url: string; cdnKey?: string }) => void;
}

export function AiImageEditModal({
  tag,
  openingText,
  baseDesc,
  sceneName,
  kind,
  endpointId,
  initialUrl,
  ratio,
  chips = DEFAULT_CHIPS,
  cost,
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
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  // ESC 关闭 / Tab 焦点圈定 / 打开时聚焦 / 关闭还原焦点（同全站弹层，见 lib/use-modal-a11y）。
  useModalA11y(panelRef, onClose, true);
  React.useEffect(() => {
    const e = scrollRef.current;
    if (e) e.scrollTop = e.scrollHeight;
  }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    // 每次都确认：出来的新图直接替换原图，属于「会覆盖已有内容」，不吃小额免打扰（§2.6）。
    // 取消 = 不发请求、不扣积分，输入框里的字留着。
    const ok = await dramaConfirm({
      cost,
      title: "改这张图？",
      body: `按「${t}」出一版新图，出来后直接替换现在这张。每改一次扣一次积分。`,
      confirmLabel: "改图",
    });
    if (!ok) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const { frames } = await RenderApi.renderFrame({
        kind,
        vars: editPromptVars(kind, baseDesc, t, sceneName),
        ratio,
        count: 1,
        refImages: url ? [url] : undefined,
        endpointId,
      });
      const f: RenderedFrame | undefined = frames[0];
      if (f?.url) {
        setUrl(f.url);
        setVer((v) => v + 1);
        onCommit({ url: f.url, cdnKey: f.cdnKey });
        setMsgs((m) => [...m, { role: "ai", text: `按「${t}」改好了，这是第 ${ver + 1} 版，已经替换了原图。还想改就接着说。` }]);
      } else {
        setMsgs((m) => [...m, { role: "ai", text: "这次没出图，换个说法再试试。" }]);
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
      : { height: "calc(100% - 28px)", maxHeight: 430, aspectRatio: "9/16", maxWidth: "100%" }; // 28px 留给下面「第 N 版」那行

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="pop-in col ep-imgedit"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-lg)", outline: "none", maxWidth: "100%" }}
      >
        <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", alignItems: "center" }}>
          <span className="icon-badge" style={{ width: 28, height: 28, borderRadius: 8 }}><Wand2 size={14} /></span>
          <span id={titleId} style={{ fontWeight: 800, fontSize: 15, flex: "none" }}>AI 改图</span>
          {tag && <span className="tag tag-accent" style={{ flex: "none", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tag}>{tag}</span>}
          <span className="grow" />
          <button type="button" onClick={onClose} className="btn btn-icon btn-ghost btn-sm" aria-label="关闭" title="关闭"><X size={15} /></button>
        </div>
        <div className="ep-imgedit-body">
          {/* 桌面：左对话；≤720：下方对话 */}
          <div className="ep-imgedit-chat">
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
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }}
                  placeholder="想怎么改？比如：换成雨夜" aria-label="想怎么改这张图" className="chat-input" style={{ flex: 1, minWidth: 0, height: 40, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 13px", fontSize: 13, background: "var(--surface-2)", outline: "none", color: "var(--ink)" }} />
                <button type="button" onClick={() => void send(input)} className="btn btn-grad btn-icon" aria-label="发送" title="发送" style={{ width: 40, height: 40, flex: "none" }}><ArrowUp size={16} /></button>
              </div>
              <div className="faint row gap-1" style={{ fontSize: 10.5, alignItems: "center", justifyContent: "center" }}>
                <CreditMark size={11} /> 每改一次 <span className="num" style={{ fontWeight: 700 }}>{cost}</span> 积分，新图直接替换原图
              </div>
            </div>
          </div>
          {/* 桌面：右预览；≤720：上方预览 */}
          <div className="col center ep-imgedit-preview" style={{ background: "var(--surface-2)", gap: 12 }}>
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow)", background: "#1c1917", ...previewBox }}>
              {url ? <img src={url} alt="预览" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div className="col center grow" style={{ height: "100%", color: "#fff" }}><Sparkles size={28} /></div>}
              {busy && (
                <div className="col center gap-2" style={{ position: "absolute", inset: 0, background: "rgba(28,25,23,.42)", backdropFilter: "blur(2px)", color: "#fff" }}>
                  <span className="gen-pulse" style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "grid", placeItems: "center" }}><Sparkles size={20} /></span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>正在改图…</span>
                </div>
              )}
            </div>
            <div className="faint row gap-1" style={{ fontSize: 11.5, flex: "none" }}><Zap size={12} /> 第 {ver} 版</div>
          </div>
        </div>
      </div>
    </div>
  );
}
