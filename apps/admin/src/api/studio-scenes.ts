// ─────────────────────────────────────────────────────────────────────────────
// api/studio-scenes.ts — Studio 场景模板（/api/admin/studio/scenes）。
// 整份目录一次保存，带上读到的版本号；别人先存过返回 409 STUDIO_SCENE_CATALOG_STALE。
// 封面和参考示例先传到 /media 拿 key。NEXT_PUBLIC_USE_MOCK=1 时走 mocks/studio-scenes.ts。
// ─────────────────────────────────────────────────────────────────────────────

import type { StudioSceneAdminView, StudioSceneCatalog, StudioSceneUploaded } from "@/types/studio-scenes";
import { USE_MOCK, apiFetch, mockDelay } from "./_client";
import { mockGetStudioScenes, mockResetStudioScenes, mockSaveStudioScenes, mockUploadStudioSceneMedia } from "@/mocks/studio-scenes";

/** GET /admin/studio/scenes */
export async function getStudioScenes(): Promise<StudioSceneAdminView> {
  if (USE_MOCK) return mockDelay(mockGetStudioScenes());
  return apiFetch<StudioSceneAdminView>("/admin/studio/scenes");
}

/** PUT /admin/studio/scenes —— 整份保存；baseVersion 是读到的版本号（还没存过是 0）。 */
export async function saveStudioScenes(catalog: StudioSceneCatalog, baseVersion: number): Promise<StudioSceneAdminView> {
  if (USE_MOCK) return mockDelay(mockSaveStudioScenes(catalog, baseVersion));
  return apiFetch<StudioSceneAdminView>("/admin/studio/scenes", { method: "PUT", body: { catalog, baseVersion } });
}

/** DELETE /admin/studio/scenes —— 恢复随包的默认目录。 */
export async function resetStudioScenes(baseVersion: number): Promise<StudioSceneAdminView> {
  if (USE_MOCK) return mockDelay(mockResetStudioScenes(baseVersion));
  return apiFetch<StudioSceneAdminView>("/admin/studio/scenes", { method: "DELETE", query: { baseVersion } });
}

/** POST /admin/studio/scenes/media —— 封面或参考示例（JPG / PNG / WEBP 图片，或 MP4 视频）。 */
export async function uploadStudioSceneMedia(file: File): Promise<StudioSceneUploaded> {
  if (USE_MOCK) return mockDelay(mockUploadStudioSceneMedia(file));
  const body = new FormData(); body.append("file", file);
  return apiFetch<StudioSceneUploaded>("/admin/studio/scenes/media", { method: "POST", body });
}
