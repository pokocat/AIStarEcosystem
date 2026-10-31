"use client";

import { useSearchParams } from "next/navigation";

/**
 * 场景页地址里的 `?scene=…&draft=…`（首页卡片、「最近」、前进后退都靠它）。
 *
 * 跟着 useSearchParams 走，不在挂载时读一次 window.location（2026-10-30 复测：从首页点「同城到店」进了口播带货）：
 * 站内跳转时 Next 先渲染新页面、后改地址栏，挂载那一刻读到的还是首页的地址。
 */
export function useSceneQuery() {
  const params = useSearchParams();
  // ref：从 AI 图片「做成视频」带过来的那张图（文件 key），视频页放进素材后就从地址里去掉。
  return { scene: params.get("scene") || undefined, draft: params.get("draft") || undefined, ref: params.get("ref") || undefined };
}

/** 页面里换场景 / 换草稿时改地址（不新增历史记录）；带上 history.state，Next 的路由状态不丢，useSearchParams 也会跟上。 */
export function writeSceneQuery(path: "/image" | "/video", scene: string, draft?: string) {
  const q = new URLSearchParams({ scene, ...(draft ? { draft } : {}) });
  window.history.replaceState(window.history.state, "", `${path}?${q}`);
}
