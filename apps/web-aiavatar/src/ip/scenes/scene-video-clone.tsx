"use client";

import type { StudioVideoCloneMode } from '@ai-star-eco/types/ip-studio-video-task';
import type { VideoStudioModel } from '@ai-star-eco/types/video-studio';
import '@/styles/studio-toolbox.css';

/** Labels shared by toolbox, editor and task snapshots. Technical prompts live on the server. */
export const VIDEO_CLONE_TOOLS = [
  { mode: 'depth', title: '深度复刻', description: '参考动作与镜头，换上你的人物、商品或背景。', detail: '添加参考视频并描述新画面，可选添加人物、商品或背景图片。' },
  { mode: 'recreation', title: '分镜复刻', description: '借鉴原片的分镜与节奏，用你的素材重新演绎。', detail: '需要参考视频，可补充素材与改编要求。' },
  { mode: 'replacement', title: '元素替换', description: '替换指定人物、商品或背景，尽量保留其余画面。', detail: '添加参考视频和修改说明，可选添加替换图片。' },
] as const;
export const cloneModeOf = (value?: string | null): StudioVideoCloneMode => value === 'depth' || value === 'replacement' ? value : 'recreation';
export const cloneTool = (mode: StudioVideoCloneMode) => VIDEO_CLONE_TOOLS.find(t => t.mode === mode)!;
export const cloneToolHref = (mode: StudioVideoCloneMode) => `/video?scene=recreation&tool=${mode}`;
export const cloneReferenceMode = (model?: VideoStudioModel) => model?.contract.modes.find(m => !m.needsFirstFrame && !m.needsLastFrame && m.references && m.references.video.maxCount > 0);

export function CloneModePicker({ mode, disabled, onChange }: { mode: StudioVideoCloneMode; disabled: boolean; onChange: (mode: StudioVideoCloneMode) => void }) {
  return <div className="studio-clone-modes">
    <div role="group" aria-label="复刻方式">{VIDEO_CLONE_TOOLS.map(t => <button key={t.mode} type="button" disabled={disabled} aria-pressed={mode === t.mode} onClick={() => onChange(t.mode)}>{t.title}</button>)}</div>
    <p>{cloneTool(mode).description}</p>
  </div>;
}
