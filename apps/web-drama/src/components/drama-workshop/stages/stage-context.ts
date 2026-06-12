// 工作台阶段共享上下文：项目 id + 整套 ProjectData 保存回调。
// 由 /projects/[projectId] 页面注入，阶段内做真实 AI 生成 / 编辑后乐观更新 + 落库。
import type { ProjectData } from "@/mocks/drama-workshop";

export interface StageContext {
  projectId: string;
  /** 保存整套工作台文档（可选携带 stage / progress）。 */
  saveData: (next: ProjectData, opts?: { stage?: number; progress?: number }) => Promise<void>;
}
