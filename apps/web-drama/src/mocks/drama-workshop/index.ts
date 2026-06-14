// 短剧工坊样例数据入口（USE_MOCK / 默认演示态都用这套）。
// 按项目隔离 — 切项目 = 切整套。
export * from "./types";
export * from "./avatar-themes";
export * from "./meta";
export * from "./materials";
export * from "./shorts";
export * from "./home-ideas";
export * from "./template-meta";
export * from "./review";
export { PROJECT_DATA } from "./projects";

import type { EpisodeDoc, ProjectData } from "./types";
import { PROJECT_DATA } from "./projects";

export function getProjectData(projectId: string): ProjectData | null {
  return PROJECT_DATA[projectId] ?? null;
}

/**
 * v0.66 按集取文档（剧本 + 分镜 + 成片）。
 * - episodeDocs 里有该集 → 用它；
 * - 项目还没启用 episodeDocs（老项目 / mock 演示）→ 回读 legacy script/storyboard；
 * - 已启用但该集还没内容 → 空文档（各阶段渲染空状态，互不污染）。
 */
export function getEpisodeDoc(data: ProjectData, ep: number): EpisodeDoc {
  const fromDocs = data.episodeDocs?.[String(ep)];
  if (fromDocs) return fromDocs;
  const docsEnabled = data.episodeDocs && Object.keys(data.episodeDocs).length > 0;
  if (!docsEnabled) {
    return { script: data.script, storyboard: data.storyboard };
  }
  return { script: { ep, scenes: [] }, storyboard: { ep, scenes: [] } };
}

/** v0.66 写回某集文档（返回新 ProjectData，不可变更新）。 */
export function withEpisodeDoc(data: ProjectData, ep: number, doc: EpisodeDoc): ProjectData {
  return { ...data, episodeDocs: { ...(data.episodeDocs ?? {}), [String(ep)]: doc } };
}
