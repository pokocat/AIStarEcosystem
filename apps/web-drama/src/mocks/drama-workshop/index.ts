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

import type { ProjectData } from "./types";
import { PROJECT_DATA } from "./projects";

export function getProjectData(projectId: string): ProjectData | null {
  return PROJECT_DATA[projectId] ?? null;
}
