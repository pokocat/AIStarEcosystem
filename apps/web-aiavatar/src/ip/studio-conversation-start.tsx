"use client";
// The dialogue-first start on the home page: one box to say what you want, a row of example openers
// under it, and 「开始对话」. Submitting creates a canvas (free) with the brief and opens it with the
// assistant already talking. No charge note here: images and videos are quoted and start only after
// the user confirms. A brief that needs a reference video is not sent until the video is there
// (studioBriefNeedsReference).
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

export const conversationExamples = [
  { label: "复刻一条短视频", text: "照这条视频的拍法，把里面的商品换成我的，保留原片的节奏和反转。" },
  { label: "做一个 IP 形象", text: "帮我设计一个原创 IP 形象，要让人一眼记住。先聊思路，再出图。" },
  { label: "写一段短剧", text: "写一集 60 秒的短剧，主角是一个爱吐槽的外卖员，结尾要有反转。" },
  { label: "搭一套创作流程", text: "帮我把整套流程串起来：先写人物设定，再出三视图和细节图，最后做成场景视频。" },
] as const;

export function StudioConversationStart({ onStart, creating, pending = false, pill = false }: {
  /** An empty brief opens the canvas with the assistant waiting; a non-empty one is sent as the first message. */
  onStart: (brief: string) => void; creating?: boolean; pending?: boolean;
  /** 首页主视觉用的细边胶囊：一行起步，写长了往下长（最多几行后在框内滚动），发送按钮在右边。 */
  pill?: boolean;
}) {
  const [brief, setBrief] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = area.current;
    if (!pill || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    // 到了最大高度才出滚动条；没到时出现滚动条是小数像素的误差。
    el.style.overflowY = el.scrollHeight > el.clientHeight + 1 ? "auto" : "hidden";
  }, [pill, brief]);
  // While an earlier save is pending the text is frozen, but the retry button must stay live.
  const locked = !!creating || pending;
  const canSubmit = !creating && (pending || !!brief.trim());
  const submit = () => { if (canSubmit) onStart(brief.trim()); };
  const keydown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault(); submit();
  };
  return <form className={pill ? "studio-conversation-start is-pill" : "studio-conversation-start"} aria-label="与助手开始创作" onSubmit={e => { e.preventDefault(); submit(); }}>
    <div className="studio-conversation-start-box">
      <label htmlFor="studio-conversation-brief" className="studio-conversation-start-label">想做什么</label>
      <textarea id="studio-conversation-brief" ref={area} value={brief} rows={pill ? 1 : 3} maxLength={4000} disabled={locked} onChange={e => setBrief(e.target.value)} onKeyDown={keydown}
        placeholder="描述你想做的内容，例如：参照这条视频的拍法，把商品换成我的保温杯"/>
      <div className="studio-conversation-start-row">
        <button type="submit" className="studio-conversation-start-send" disabled={!canSubmit} title={pending ? "继续保存并打开画布" : brief.trim() ? "开始对话（Enter）" : "请输入想做的内容"}>
          {creating ? <Loader2 size={18} className="studio-gallery-spinner" aria-hidden="true"/> : <ArrowUp size={18} aria-hidden="true"/>}<span>{pending ? "继续保存并打开" : "开始对话"}</span>
        </button>
      </div>
    </div>
    <div className="studio-conversation-start-examples" aria-label="试试这样说">
      {conversationExamples.map(example => <button key={example.label} type="button" disabled={locked} onClick={() => { setBrief(example.text); area.current?.focus(); }}>{example.label}</button>)}
    </div>
  </form>;
}
