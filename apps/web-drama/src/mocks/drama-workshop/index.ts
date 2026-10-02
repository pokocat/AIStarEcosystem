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
 * mock：写入 / 覆盖一部短剧的工作台文档（新建、保存时用）。
 * 此前 mock createProject 只返回 meta 不落表，新建完一打开就是「没找到这部短剧」。
 */
export function setProjectData(projectId: string, data: ProjectData): void {
  PROJECT_DATA[projectId] = data;
}

/** mock：彻底删除时连文档一起清掉。 */
export function deleteProjectData(projectId: string): void {
  delete PROJECT_DATA[projectId];
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

/**
 * 一部短剧做到哪了（写进列表卡片的 progress）。「做完」= 每一集都合成了成片 —— 合成第 N 集只说明那一集好了。
 * 服务端 DramaProjectService#toSummary 按 progress ≥ 100 发 done，列表 / 预览据此把整部当成片打开；
 * 以前合成任意一集就固定写 100，一部 12 集只做完第 1 集的剧也被当成完成（评审 P2）。
 *
 * 口径：短剧设定完成记 50（setup.tsx 进逐集制作时写的值），剩下 50 按已合成的集数平分，
 * 1..总集数 每一集都有成片才到 100；没全合成最多 99。集号超出总集数的成片（后来把集数改少了）不算。
 */
export function seriesProgress(data: ProjectData): number {
  const total = Math.max(1, Math.trunc(Number(data.projectInfo?.episodes) || 1));
  let assembled = 0;
  for (let n = 1; n <= total; n++) {
    if (data.episodeDocs?.[String(n)]?.assembled?.url?.trim()) assembled++;
  }
  if (assembled >= total) return 100;
  return Math.min(99, 50 + Math.floor((50 * assembled) / total));
}
