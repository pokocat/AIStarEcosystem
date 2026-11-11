"use client";

import type { StudioCloneAdvice, StudioVideoCloneMode } from '@ai-star-eco/types/ip-studio-video-task';
import type { VideoStudioModel } from '@ai-star-eco/types/video-studio';
import { apiFetch } from '@/ip/api/_client';
import '@/styles/studio-toolbox.css';

/**
 * 爆款复刻的三种方式（服务端 StudioCloneVideoPlan）。三种都先拉片、按原片分段，区别是每段交给视频模型什么，
 * 所以适合的视频不同：工具箱、视频页的方式选择和任务标题都读这里。提示词在服务端。
 * image 是示意图（public/studio/clone-modes，虚构人物，不是真实生成结果）；limit 只写会影响选择的限制，
 * 「仅部分视频模型可用」对应 cloneReferenceMode：深度复刻和元素替换要把原片片段作为参考视频交给模型。
 */
export const VIDEO_CLONE_TOOLS = [
  { mode: 'recreation', title: '分镜复刻', short: '照原片分镜重拍', image: '/studio/clone-modes/recreation.webp',
    description: '按原片的镜头和节奏，用你的人物和商品重新拍摄。',
    fit: '剪辑多、镜头切换频繁的视频，如带货混剪、剧情、探店。',
    limit: '动作和运镜与原片会有差异。' },
  { mode: 'depth', title: '深度复刻', short: '照原片动作重拍', image: '/studio/clone-modes/depth.webp',
    description: '保留原片的动作和运镜，人物、商品和场景换成你的。',
    fit: '镜头少、动作连贯的视频，如口播、单人展示、舞蹈。',
    limit: '仅部分视频模型可用。镜头多、切换快的视频建议使用分镜复刻。' },
  { mode: 'replacement', title: '元素替换', short: '只换其中一样', image: '/studio/clone-modes/replacement.webp',
    description: '保留原片画面，只替换其中的人物、商品或场景。',
    fit: '原片画面满意、只需替换一样东西的视频。',
    limit: '仅部分视频模型可用。原片里的字幕和水印会保留。' },
] as const;
/** 三种方式共同的限制：拉片和分段按整条原片算。 */
export const CLONE_SOURCE_LIMIT = '参考视频最长 60 秒。';
export const cloneModeOf = (value?: string | null): StudioVideoCloneMode => value === 'depth' || value === 'replacement' ? value : 'recreation';
export const cloneTool = (mode: StudioVideoCloneMode) => VIDEO_CLONE_TOOLS.find(t => t.mode === mode)!;
export const cloneToolHref = (mode: StudioVideoCloneMode) => mode === 'recreation' ? '/video?scene=recreation' : `/video?scene=recreation&tool=${mode}`;
/** 深度复刻和元素替换要把原片片段作为参考视频交给模型：只有能带参考视频的模式才行。 */
export const cloneReferenceMode = (model?: VideoStudioModel) => model?.contract.modes.find(m => !m.needsFirstFrame && !m.needsLastFrame && m.references && m.references.video.maxCount > 0);
/** 这条参考视频适合哪种方式：按真实切镜数和镜头时长，不调模型、不扣积分。 */
export const cloneAdvice = (key: string, signal?: AbortSignal) => apiFetch<StudioCloneAdvice>('/v1/ip-studio/studio/clone-advice', { query: { key }, signal });

/** 适合什么视频、有哪些限制：工具箱卡片和视频页的方式说明共用。 */
export function CloneModeFacts({ mode, withSource }: { mode: StudioVideoCloneMode; withSource?: boolean }) {
  const t = cloneTool(mode);
  return <dl className="studio-clone-facts">
    <div><dt>适合</dt><dd>{t.fit}</dd></div>
    <div><dt>限制</dt><dd>{withSource ? `${t.limit}${CLONE_SOURCE_LIMIT}` : t.limit}</dd></div>
  </dl>;
}

export function CloneModePicker({ mode, disabled, onChange, advice, autoCheck = true, onAutoCheck }: {
  mode: StudioVideoCloneMode; disabled: boolean; onChange: (mode: StudioVideoCloneMode) => void; advice?: StudioCloneAdvice;
  /** 「自动检查」：每段生成后检查人和商品是否换对，没换对重新生成一次（服务端 StudioSegmentedRun）。不传 onAutoCheck 就不显示。 */
  autoCheck?: boolean; onAutoCheck?: (on: boolean) => void;
}) {
  const recommended = advice ? cloneTool(advice.recommended) : undefined;
  // 元素替换看的是想不想保留原片画面，不按视频推荐；其余两种按切镜结果说明为什么
  const note = !recommended || mode === 'replacement' ? undefined
    : recommended.mode === mode ? `${advice!.reason}，适合${recommended.title}。` : `${advice!.reason}，建议使用${recommended.title}。`;
  return <div className="studio-clone-modes">
    <div className="studio-clone-modes-head"><span>复刻方式</span></div>
    <div className="studio-clone-mode-list" role="radiogroup" aria-label="复刻方式">
      {VIDEO_CLONE_TOOLS.map(t => <button key={t.mode} type="button" role="radio" disabled={disabled} aria-checked={mode === t.mode} onClick={() => onChange(t.mode)}>
        <span className="studio-clone-mode-image" title="示意图"><img src={t.image} alt="" loading="lazy" decoding="async"/></span>
        <span className="studio-clone-mode-title">{t.title}{advice?.recommended === t.mode && <em>推荐</em>}</span>
        <span className="studio-clone-mode-desc" title={t.description}>{t.short}</span>
      </button>)}
    </div>
    {note && <p className="studio-clone-advice">{note}</p>}
    <CloneModeFacts mode={mode} withSource/>
    {onAutoCheck && <div className="studio-clone-check" role="group" aria-label="自动检查"><span>自动检查</span>
      <div className="scene-choice-row">
        <button type="button" disabled={disabled} aria-pressed={autoCheck} onClick={() => onAutoCheck(true)}>开启</button>
        <button type="button" disabled={disabled} aria-pressed={!autoCheck} onClick={() => onAutoCheck(false)}>关闭</button></div>
      <p>{autoCheck ? '每段生成后检查人和商品是否换对，没换对会自动重新生成一次，费用另计。' : '不检查，也不会自动重新生成。'}</p></div>}
  </div>;
}
