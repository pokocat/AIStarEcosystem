"use client";
// Explicit frame confirmation and the model-side optimization result for historical video runs.
import { Button, Modal } from "antd";
import type { IpRun } from "@ai-star-eco/types";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { studioFrameIntentCopy, studioRunRewrites, type StudioFrameIntent } from "@/canvas-bridge/studio-video-prompt";

export type StudioFrameIntentChoice = "bind" | "text" | "cancel";

/** Asked once per prompt and mode when the text names pictures the request does not carry. Never picks pictures. */
export function StudioFrameIntentDialog({ intent, model, canvasImages, onChoose, onClosed, getContainer }: {
  intent?: StudioFrameIntent; model?: VideoStudioModel; canvasImages: number;
  onChoose: (choice: StudioFrameIntentChoice) => void; onClosed?: () => void; getContainer?: () => HTMLElement;
}) {
  const copy = intent ? studioFrameIntentCopy(intent, model?.contract.modes || [], canvasImages) : undefined;
  return <Modal open={!!intent} title={copy?.title} onCancel={() => onChoose("cancel")} afterClose={onClosed} getContainer={getContainer} width={460}
    footer={[<Button key="text" onClick={() => onChoose("text")}>仍按文字生成</Button>,
      <Button key="bind" type="primary" onClick={() => onChoose("bind")}>{copy?.bindLabel}</Button>]}>
    {copy && <div className="studio-director-form">{copy.lines.map(line => <p key={line}>{line}</p>)}</div>}
  </Modal>;
}

/** The run-input modal's section for a video run: what each take was actually generated from. */
export function StudioVideoRewriteDetail({ run }: { run: IpRun }) {
  // 我们自己的智能优化（2026-10-27）：发给模型的英文、提示、没用上时的说明。这时厂商的改写是关着的，不再逐条写「已关闭」。
  const ours = run.output.videoPrompt, notes = run.output.videoPromptNotes || [];
  const takes = studioRunRewrites(run).filter(take => !(ours || notes.length) || take.rewrite.state !== "off");
  if (!takes.length && !ours && !notes.length) return null;
  const many = (run.output.videoCandidates?.length || 0) > 1;
  return <div className="studio-video-rewrite-detail">
    {(ours || notes.length > 0) && <section>
      <strong>{notes.length ? "智能优化 · 没用上" : "智能优化 · 发给模型的英文"}</strong>
      {notes.map(note => <p key={note}>{note}</p>)}
      {!!ours?.warnings.length && <ul>{ours.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      {!!ours?.notes?.length && <p>已自动处理：{ours.notes.join("；")}</p>}
      {ours && !notes.length && <pre>{ours.text}</pre>}
    </section>}
    {takes.map(take => <section key={take.index}>
      <strong>{many ? `候选 ${take.index + 1} · ` : ""}{take.rewrite.state === "off" ? "智能优化 · 已关闭" : take.rewrite.state === "running" ? "智能优化 · 优化中" : take.rewrite.state === "failed" ? "智能优化 · 失败" : take.rewrite.prompt ? "智能优化结果" : "智能优化 · 未返回内容"}</strong>
      {take.rewrite.state === "done" && take.rewrite.prompt && <pre>{take.rewrite.prompt}</pre>}
    </section>)}
  </div>;
}
