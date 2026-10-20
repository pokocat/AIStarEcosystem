"use client";
// What the video composer says about a prompt before and after the vendor sees it (canvas-bridge/studio-video-prompt).
// Before: the lines it recognised, and a one-time question when the text names pictures the request does not carry.
// After: the description the vendor actually used, and the lines it dropped. The vendor rewrites after accepting the
// paid job, so the "after" part only explains a finished take; nothing here blocks or changes a request by itself.
import { Button, Modal } from "antd";
import type { IpRun } from "@ai-star-eco/types";
import type { VideoStudioModel, VideoStudioModeSpec } from "@ai-star-eco/types/video-studio";
import { studioVideoModeName } from "@/canvas-bridge/studio-video";
import { studioPromptLines, studioRunRewrites, type StudioFrameIntent, type StudioLostLine, type StudioTakeRewrite } from "@/canvas-bridge/studio-video-prompt";

const quoted = (parts: string[]) => parts.map(part => `「${part}」`).join("");
const lineText = (line: { speaker: string; text: string }) => `${line.speaker}${line.speaker ? "：" : ""}${line.text}`;

/** The take a reopened composer is about: the adopted one, else the first take that reports a rewrite. */
export function studioComposerTake(run: IpRun | undefined, primaryVideoId: string | undefined): StudioTakeRewrite | undefined {
  if (!run || run.kind !== "studio-video") return undefined;
  const takes = studioRunRewrites(run);
  const adopted = primaryVideoId === run.id ? 0 : primaryVideoId?.startsWith(`${run.id}:`) ? Number(primaryVideoId.slice(run.id.length + 1)) : undefined;
  return takes.find(take => take.index === adopted) || takes[0];
}

/** Shown above the generate button for models that rewrite the description before encoding. */
export function StudioVideoPromptNote({ model, prompt, keepPrompt, lastTake, onShowRewrite }: {
  model: VideoStudioModel; prompt: string; keepPrompt: boolean; lastTake?: StudioTakeRewrite; onShowRewrite?: () => void;
}) {
  if (!model.supportsPromptOptimization) return null;
  if (lastTake?.lost.length) {
    const missing = lastTake.lost.flatMap(line => line.missing);
    return <div className="studio-composer-validation studio-video-prompt-note" role="status">
      <p title={lastTake.lost.map(lineText).join("\n")}>上次出片前，模型改写描述时没有保留台词{quoted(missing)}，成片里可能听不到这几句。</p>
      <p>{keepPrompt ? "这次已选「按原文生成」，描述和台词会原样交给模型。" : "要让台词原样交给模型，可以在参数设置里勾选「按原文生成」再生成。"}
        {onShowRewrite && <Button type="link" size="small" onClick={onShowRewrite}>看模型实际用的描述</Button>}</p>
    </div>;
  }
  if (keepPrompt) return null;
  const lines = studioPromptLines(prompt);
  if (!lines.length) return null;
  const shown = lines.slice(0, 2).map(lineText);
  return <p className="studio-composer-validation studio-video-prompt-note" title={lines.map(lineText).join("\n")}>
    识别到{lines.length}句台词：{shown.map(text => `「${text}」`).join("")}{lines.length > 2 ? "等" : ""}。模型出片前会先改写描述，台词偶尔会被删掉；要一字不差，可以在参数设置里勾选「按原文生成」。
  </p>;
}

/** The mode a "bind pictures" answer switches to; undefined when the model has none that takes that many frames. */
export function studioFrameModeFor(model: VideoStudioModel, intent: StudioFrameIntent): VideoStudioModeSpec | undefined {
  const modes = model.contract.modes;
  if (intent.needed >= 2 || intent.lastFrameIgnored) return modes.find(mode => mode.needsFirstFrame && mode.needsLastFrame)
    || modes.find(mode => !!mode.references && !mode.needsFirstFrame && !mode.needsLastFrame);
  return modes.find(mode => mode.needsFirstFrame && !mode.needsLastFrame && !mode.references);
}

export type StudioFrameIntentChoice = "bind" | "text" | "cancel";

/** Asked once per prompt and mode when the text names pictures the request does not carry. Never picks pictures. */
export function StudioFrameIntentDialog({ intent, model, canvasImages, onChoose, onClosed, getContainer }: {
  intent?: StudioFrameIntent; model?: VideoStudioModel; canvasImages: number;
  onChoose: (choice: StudioFrameIntentChoice) => void; onClosed?: () => void; getContainer?: () => HTMLElement;
}) {
  const target = intent && model ? studioFrameModeFor(model, intent) : undefined;
  const title = !intent ? "" : intent.bound === 0 ? "描述里提到了图片，这次没有用上图片"
    : intent.lastFrameIgnored ? "描述里提到了尾帧，当前模式只用首帧" : `描述里提到了 ${intent.needed} 张图，这次只用了 ${intent.bound} 张`;
  return <Modal open={!!intent} title={title} onCancel={() => onChoose("cancel")} afterClose={onClosed} getContainer={getContainer} width={460}
    footer={[<Button key="text" onClick={() => onChoose("text")}>仍按文字生成</Button>,
      <Button key="bind" type="primary" onClick={() => onChoose("bind")}>{target ? `改用「${studioVideoModeName(target)}」选图片` : "去选择视频模式"}</Button>]}>
    {intent && <div className="studio-director-form">
      <p>{quoted(intent.mentions)}写在描述里只是文字，模型看不到画布上的图片。{target ? `要照着图片出片，改用「${studioVideoModeName(target)}」，再选好要用的图片。` : "要照着图片出片，请换一个能用图片的视频模式。"}</p>
      {canvasImages === 0 && <p>画布上还没有图片，可以先上传，或从人物库里选。</p>}
      <p>只想按文字出片，可以直接生成。</p>
    </div>}
  </Modal>;
}

/** The run-input modal's section for a video run: what each take was actually generated from. */
export function StudioVideoRewriteDetail({ run }: { run: IpRun }) {
  const takes = studioRunRewrites(run);
  if (!takes.length) return null;
  const many = (run.output.videoCandidates?.length || 0) > 1;
  return <div className="studio-video-rewrite-detail">
    {takes.map(take => <section key={take.index}>
      <strong>{many ? `候选 ${take.index + 1} · ` : ""}{take.rewrite.state === "off" ? "按原文生成" : take.rewrite.state === "running" ? "模型正在改写描述" : take.rewrite.state === "failed" ? "模型改写描述失败" : take.rewrite.prompt ? "模型实际用的描述" : "模型直接用了原文"}</strong>
      {take.rewrite.state === "off" && <p>这次没有让模型改写，描述和台词原样交给了模型。</p>}
      {take.rewrite.state === "running" && <p>模型先改写描述，改完才开始出片。</p>}
      {take.rewrite.state === "done" && take.rewrite.prompt && <>
        <p>出片前模型会先改写一遍描述，成片照着下面这份做。</p>
        <pre>{take.rewrite.prompt}</pre>
        {take.lost.length > 0 && <LostLines lines={take.lost}/>}
      </>}
    </section>)}
  </div>;
}

function LostLines({ lines }: { lines: StudioLostLine[] }) {
  return <div role="status"><p>原文里这些台词没有保留：</p>
    <ul>{lines.map((line, index) => <li key={index}>{line.speaker ? `${line.speaker}：` : ""}{quoted(line.missing)}{line.kept.length ? `（只留下了${quoted(line.kept)}）` : ""}</li>)}</ul>
  </div>;
}
