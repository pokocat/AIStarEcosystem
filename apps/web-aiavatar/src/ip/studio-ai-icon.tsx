"use client";

/** Marks an action that submits billable model work. Local edits and task reads omit it. */
export function StudioAiIcon() {
  return <svg className="studio-ai-icon" data-ai-action="true" aria-hidden="true" width="22" height="16" viewBox="0 0 22 16" fill="none">
    <title>AI 处理，会消耗积分</title>
    <path d="M3 12L7 4L11 12M4.5 9H9.5M15 4H19M17 4V12M15 12H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

/**
 * The AI sign: a filled four-point star (画布页改版设计稿 · Language 画板). It marks only what AI made or is making —
 * node badges, the assistant, the orb, 「问助手」 — so no other icon on the canvas page is a star.
 */
export function AiMark({ size = 12 }: { size?: number }) {
  return <svg className="studio-ai-mark" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>
  </svg>;
}
