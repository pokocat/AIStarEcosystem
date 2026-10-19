"use client";

/** Marks an action that submits billable model work. Local edits and task reads omit it. */
export function StudioAiIcon() {
  return <svg className="studio-ai-icon" data-ai-action="true" aria-hidden="true" width="22" height="16" viewBox="0 0 22 16" fill="none">
    <title>AI 处理，会消耗积分</title>
    <path d="M3 12L7 4L11 12M4.5 9H9.5M15 4H19M17 4V12M15 12H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
