"use client";
// The 「复刻一条短视频」 start: before the first message goes out, show what the recreation needs and where
// each missing piece comes from. Pure client guidance over the composer's pins / attachments / text; the
// server still routes and quotes as usual. Dismissable: a user who knows what they want just sends.
import { Check } from "lucide-react";
import type { CanvasNodeData } from "@/canvas/types/canvas";

export type RecreationChecklist = { video?: CanvasNodeData; images: CanvasNodeData[]; textReady: boolean };

/** `[你的商品图]` style blanks the start text leaves for the user; full-width brackets count too. */
export const hasBlanks = (text: string) => /[\[［][^\]］\n]*[\]］]/.test(text);

/** The reason the message cannot go yet, in the order the list shows; empty when the three items are met. */
export function recreationBlocker(list: RecreationChecklist) {
  if (!list.video) return "先选一条参考视频";
  if (!list.images.length) return "先补上替换素材";
  if (!list.textReady) return "把输入框里的空位补上";
  return "";
}

export function StudioAssistantChecklist({ list, videoCount, onPickVideo, onPickImage, onUpload, onDismiss }: {
  list: RecreationChecklist; videoCount: number;
  onPickVideo: () => void; onPickImage: () => void; onUpload: () => void; onDismiss: () => void;
}) {
  const videoLabel = list.video ? `${list.video.title} · 画布上已有` : videoCount ? `画布上有 ${videoCount} 条视频，选一条` : "还没有";
  const imageLabel = list.images.length ? list.images.map(n => n.title).join("、") : "还没有，1 到 3 张图片";
  return <section className="studio-assistant-checklist" aria-label="复刻需要的素材">
    <p>复刻要这三样，齐了就能发。</p>
    <ol>
      <li data-state={list.video ? "done" : "missing"}>
        <span className="studio-assistant-checklist-mark" aria-label={list.video ? "已满足" : "还缺"}>{list.video ? <Check size={14} aria-hidden="true"/> : "!"}</span>
        <span className="studio-assistant-checklist-body"><strong>参考视频</strong><span title={videoLabel}>{videoLabel}</span></span>
        <span className="studio-assistant-checklist-actions">
          <button type="button" onClick={onPickVideo}>{list.video ? "换一条" : "从画布选"}</button>
          {!list.video && <button type="button" onClick={onUpload}>上传</button>}
        </span>
      </li>
      <li data-state={list.images.length ? "done" : "missing"}>
        <span className="studio-assistant-checklist-mark" aria-label={list.images.length ? "已满足" : "还缺"}>{list.images.length ? <Check size={14} aria-hidden="true"/> : "!"}</span>
        <span className="studio-assistant-checklist-body"><strong>要换进去的商品或人物</strong><span title={imageLabel}>{imageLabel}</span></span>
        <span className="studio-assistant-checklist-actions">
          <button type="button" onClick={onPickImage}>{list.images.length ? "再加一张" : "从画布选"}</button>
          <button type="button" onClick={onUpload}>上传</button>
        </span>
      </li>
      <li data-state={list.textReady ? "done" : "pending"}>
        <span className="studio-assistant-checklist-mark" aria-label={list.textReady ? "已满足" : "待填写"}>{list.textReady ? <Check size={14} aria-hidden="true"/> : "3"}</span>
        <span className="studio-assistant-checklist-body"><strong>说清要换什么、留什么</strong><span>{list.textReady ? "写好了" : "把输入框里方括号的空位补上"}</span></span>
      </li>
    </ol>
    <p className="studio-helper-note"><button type="button" className="studio-dialogue-link" onClick={onDismiss}>不用清单，直接说</button></p>
  </section>;
}
