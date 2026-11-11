"use client";

import { useSearchParams } from "next/navigation";
import { rememberCanvasReturn } from "@/shell/canvas-return";

/**
 * 场景页地址里的 `?scene=…&draft=…`（首页卡片、「最近」、前进后退都靠它）。
 *
 * 跟着 useSearchParams 走，不在挂载时读一次 window.location（2026-10-30 复测：从首页点「同城到店」进了口播带货）：
 * 站内跳转时 Next 先渲染新页面、后改地址栏，挂载那一刻读到的还是首页的地址。
 */
export function useSceneQuery() {
  const params = useSearchParams();
  // ref：从 AI 图片「做成视频」带过来的那张图（文件 key），视频页放进素材后就从地址里去掉。
  return { scene: params.get("scene") || undefined, draft: params.get("draft") || undefined, ref: params.get("ref") || undefined, task: params.get("task") || undefined, tool: params.get("tool") || undefined };
}

/**
 * Next copies its own router state. Passing __NA back makes it skip the search-param update.
 * 这里顺手记下草稿号，画布的返回才能回到这份草稿。
 */
export function writeSceneQuery(path: "/image" | "/video", scene: string, draft?: string, task?: string, cloneMode?: import('@ai-star-eco/types/ip-studio-video-task').StudioVideoCloneMode) {
  const previous = new URLSearchParams(window.location.search);
  // 只带 task 的链接：页面补默认场景时也不能把任务丢掉，读到任务后会写回完整地址。
  const sameDraft = (draft ?? null) === previous.get('draft');
  const kept = task ?? (path === '/video' && sameDraft ? previous.get('task') : undefined);
  const q = new URLSearchParams({ scene, ...(draft ? { draft } : {}), ...(kept ? { task: kept } : {}) });
  const tool = cloneMode ?? (scene === 'recreation' ? previous.get('tool') : undefined);
  if (path === '/video' && scene === 'recreation' && (tool === 'depth' || tool === 'replacement')) q.set('tool', tool);
  window.history.replaceState(null, "", `${path}?${q}`);
  rememberCanvasReturn(path, q.toString());
}
