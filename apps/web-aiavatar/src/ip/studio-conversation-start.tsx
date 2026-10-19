"use client";
// The dialogue-first start shared by the desktop home hero, the mobile home and the creation page:
// one box to say what you want, a few example openers, and 「开始对话」. Submitting creates a canvas
// (free) with the brief and opens it with the assistant already talking; nothing is generated and
// nothing is charged until the assistant quotes and the user confirms inside the canvas.
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

export const conversationExamples = [
  { label: "复刻一条短视频", text: "照这条视频的拍法，把里面的商品换成我的，保留原片的节奏和反转。" },
  { label: "做一个 IP 形象", text: "设计一个有辨识度的原创 IP 形象，先给出可生成图片的方案。" },
  { label: "写一段短剧", text: "写一集 60 秒的短剧，主角是一个爱吐槽的外卖员，结尾要有反转。" },
  { label: "搭一套创作流程", text: "帮我搭建从角色描述、多视角设定图、细节参考图到场景视频的创作流程。" },
] as const;

export function StudioConversationStart({ onStart, creating, pending = false, compact = false, heading }: {
  /** An empty brief opens the canvas with the assistant waiting; a non-empty one is sent as the first message. */
  onStart: (brief: string) => void; creating?: boolean; pending?: boolean; compact?: boolean;
  /** Shown above the box where the page has no heading of its own (the mobile home). */
  heading?: string;
}) {
  const [brief, setBrief] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  // While an earlier save is pending the text is frozen, but the retry button must stay live.
  const locked = !!creating || pending;
  const canSubmit = !creating && (pending || !!brief.trim());
  const submit = () => { if (canSubmit) onStart(brief.trim()); };
  const keydown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault(); submit();
  };
  return <form className={`studio-conversation-start${compact ? " is-compact" : ""}`} aria-label="和助手开始创作" onSubmit={e => { e.preventDefault(); submit(); }}>
    {heading && <h2>{heading}</h2>}
    <div className="studio-conversation-start-box">
      <label htmlFor="studio-conversation-brief" className="studio-conversation-start-label">想做什么</label>
      <textarea id="studio-conversation-brief" ref={area} value={brief} rows={compact ? 2 : 3} maxLength={4000} disabled={locked} onChange={e => setBrief(e.target.value)} onKeyDown={keydown}
        placeholder="想做什么，直接说。比如：照这条视频的拍法，把商品换成我的保温杯"/>
      <div className="studio-conversation-start-row">
        <div className="studio-conversation-start-examples" aria-label="试试这样说">
          {conversationExamples.map(example => <button key={example.label} type="button" disabled={locked} onClick={() => { setBrief(example.text); area.current?.focus(); }}>{example.label}</button>)}
        </div>
        <button type="submit" className="studio-conversation-start-send" disabled={!canSubmit} title={pending ? "继续保存刚才的想法并打开画布" : brief.trim() ? "开始对话（Enter）" : "先写一句想做什么"}>
          {creating ? <Loader2 size={18} className="studio-gallery-spinner" aria-hidden="true"/> : <ArrowUp size={18} aria-hidden="true"/>}<span>{pending ? "继续保存并打开" : "开始对话"}</span>
        </button>
      </div>
    </div>
    <p className="studio-conversation-start-note">建画布免费。助手的回复按实际用量扣积分，做图、做视频之前会先报价，你确认了才开始。
      <button type="button" className="studio-conversation-start-link" disabled={locked} onClick={() => onStart("")}>先进画布看看</button></p>
  </form>;
}
