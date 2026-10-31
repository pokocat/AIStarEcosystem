"use client";
// The dialogue-first start shared by the desktop home hero, the mobile home and the creation page:
// one box to say what you want, a few example openers, and 「开始对话」. Submitting creates a canvas
// (free) with the brief and opens it with the assistant already talking. Each reply is charged by
// actual usage (a few credits, the ceiling shows next to the canvas composer); images and videos are
// quoted and start only after the user confirms. A brief that needs a reference video is not sent
// until the video is there (studioBriefNeedsReference).
import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, Loader2 } from "lucide-react";
import { useUiVersion } from "@/shell/ui-version";

export const conversationExamples = [
  { label: "复刻一条短视频", text: "照这条视频的拍法，把里面的商品换成我的，保留原片的节奏和反转。" },
  { label: "做一个 IP 形象", text: "帮我设计一个原创 IP 形象，要让人一眼记住。先聊思路，再出图。" },
  { label: "写一段短剧", text: "写一集 60 秒的短剧，主角是一个爱吐槽的外卖员，结尾要有反转。" },
  { label: "搭一套创作流程", text: "帮我把整套流程串起来：先写人物设定，再出三视图和细节图，最后做成场景视频。" },
] as const;

export function StudioConversationStart({ onStart, creating, pending = false, compact = false, heading }: {
  /** An empty brief opens the canvas with the assistant waiting; a non-empty one is sent as the first message. */
  onStart: (brief: string) => void; creating?: boolean; pending?: boolean; compact?: boolean;
  /** Shown above the box where the page has no heading of its own (the mobile home). */
  heading?: string;
}) {
  const [brief, setBrief] = useState("");
  const version = useUiVersion();
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
        placeholder="说说你的想法，比如：照这条视频的拍法，把商品换成我的保温杯"/>
      <div className="studio-conversation-start-row">
        <div className="studio-conversation-start-examples" aria-label="试试这样说">
          {conversationExamples.map(example => <button key={example.label} type="button" disabled={locked} onClick={() => { setBrief(example.text); area.current?.focus(); }}>{example.label}</button>)}
        </div>
        <button type="submit" className="studio-conversation-start-send" disabled={!canSubmit} title={pending ? "继续保存刚才的想法并打开画布" : brief.trim() ? "开始对话（Enter）" : "先写一句想做什么"}>
          {creating ? <Loader2 size={18} className="studio-gallery-spinner" aria-hidden="true"/> : <ArrowUp size={18} aria-hidden="true"/>}<span>{pending ? "继续保存并打开" : "开始对话"}</span>
        </button>
      </div>
      <p className="studio-conversation-start-note">助手每轮回复按实际用量扣少量积分；出图、出片先报价，你确认了才开始。{version === "next"
        ? <>不想打字？直接选场景：<Link href="/video" className="studio-conversation-start-link">AI 视频</Link>或<Link href="/image" className="studio-conversation-start-link">AI 图片</Link></>
        : <>还没想好？逛逛<Link href="/templates" className="studio-conversation-start-link">灵感</Link>或<Link href="/scenes" className="studio-conversation-start-link">专项创作</Link></>}</p>
    </div>
  </form>;
}
