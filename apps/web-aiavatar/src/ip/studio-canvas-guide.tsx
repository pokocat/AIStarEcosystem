"use client";
// The empty canvas (docs/ip-studio-new-canvas-and-threads.md §2.3): one card in the middle of the part of the stage the user
// can see, with five ways in. Each entry sends the same studio-command the rail's 「＋添加」 runs (the canvas handles
// add-text / add-image / add-video / upload; the workspace handles speech and templates), so there is one path, not two.
// The card replaces the old 「画布还是空的 / 和助手开始」 block that only showed while the assistant was closed.
import { FileText, ImagePlus, Music2, Upload, Video } from "lucide-react";
import { dispatchStudioCommand } from "@/canvas-bridge/studio-nodes";
import { AiMark } from "./studio-ai-icon";

export const studioCanvasGuideEntries = [
  { action: "add-text", label: "文字", hint: "写设定、剧本或提示词", Icon: FileText },
  { action: "add-image", label: "图片生成", hint: "写一句描述出图，可以加参考图", Icon: ImagePlus },
  { action: "add-video", label: "视频生成", hint: "用描述或一张首帧出视频", Icon: Video },
  { action: "speech", label: "配音", hint: "选一个声音，把台词念出来", Icon: Music2 },
  { action: "upload", label: "上传素材", hint: "图片、视频或文档", Icon: Upload },
] as const;

/**
 * Shown only on an empty canvas, in the canvas view, while no creation panel (director, voice, lip sync, analysis,
 * templates, asset library…) is open. The first node makes it go away.
 */
export function studioCanvasGuideVisible({ nodeCount, mode, panelOpen }: { nodeCount: number; mode: string; panelOpen: boolean }) {
  return nodeCount === 0 && mode === "canvas" && !panelOpen;
}

export function StudioCanvasGuide({ assistantOpen, onStartAssistant }: { assistantOpen: boolean; onStartAssistant: () => void }) {
  return <div className="studio-canvas-guide">
    <section className="studio-canvas-guide-card" aria-labelledby="studio-canvas-guide-title">
      <h2 id="studio-canvas-guide-title">这张画布还是空的</h2>
      <p>在助手里说想做什么，它会把每一步放进画布。也可以自己选一个开始：</p>
      {!assistantOpen && <button type="button" className="studio-canvas-guide-primary" onClick={onStartAssistant}><AiMark size={14}/>和助手开始</button>}
      <div className="studio-canvas-guide-entries" role="group" aria-label="自己选一个开始">
        {studioCanvasGuideEntries.map(({ action, label, hint, Icon }) => <button type="button" key={action} className="studio-canvas-guide-entry"
          aria-label={label} aria-describedby={`studio-canvas-guide-${action}`} onClick={() => dispatchStudioCommand(action)}>
          <Icon size={18} strokeWidth={1.75} aria-hidden="true"/><strong>{label}</strong><small id={`studio-canvas-guide-${action}`}>{hint}</small>
        </button>)}
      </div>
      <p className="studio-canvas-guide-foot">双击画布空白处也能添加 · <button type="button" onClick={() => dispatchStudioCommand("templates")}>从模板开始</button></p>
    </section>
  </div>;
}
