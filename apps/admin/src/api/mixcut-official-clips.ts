// ─────────────────────────────────────────────────────────────────────────────
// api/mixcut-official-clips.ts — Admin 「官方明星片段」CRUD。
// 对应 AdminMixcutOfficialController；路径前缀 /admin/mixcut/official-clips/*。
// v0.21+。
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE_URL, apiFetch, USE_MOCK, mockDelay, buildQuery } from "./_client";

export interface OfficialClip {
  id: string;
  kind: string;
  name: string;
  original_name?: string;
  file_url: string;
  preview_url?: string;
  mime_type?: string;
  file_size: number;
  duration: number;
  tags?: string;
  uploaded_at: string;
  deleted_at?: string;
  is_official: boolean;
  official_category?: string;
  related_star_id?: string;
}

export interface OfficialClipFilter {
  category?: string;
  starId?: string;
}

export interface OfficialClipUploadInput {
  file: File;
  category: string;
  kind?: string; // 默认 video
  name?: string;
  relatedStarId?: string;
  tags?: string;
}

export interface OfficialClipUpdateInput {
  name?: string;
  category?: string;
  related_star_id?: string | null;
  tags?: string;
}

export async function listOfficialClips(filter?: OfficialClipFilter): Promise<OfficialClip[]> {
  if (USE_MOCK) return mockDelay([]);
  const query: Record<string, unknown> = {};
  if (filter?.category) query.category = filter.category;
  if (filter?.starId) query.star_id = filter.starId;
  return apiFetch<OfficialClip[]>(`/admin/mixcut/official-clips${buildQuery(query)}`);
}

export async function uploadOfficialClip(input: OfficialClipUploadInput): Promise<OfficialClip> {
  if (USE_MOCK) {
    const fakeId = `official_${Math.random().toString(36).slice(2, 14)}`;
    return mockDelay({
      id: fakeId,
      kind: input.kind ?? "video",
      name: input.name ?? input.file.name,
      file_url: URL.createObjectURL(input.file),
      file_size: input.file.size,
      duration: 0,
      uploaded_at: new Date().toISOString(),
      is_official: true,
      official_category: input.category,
      related_star_id: input.relatedStarId,
      tags: input.tags,
    });
  }
  const form = new FormData();
  form.append("file", input.file);
  form.append("kind", input.kind ?? "video");
  form.append("category", input.category);
  if (input.relatedStarId) form.append("related_star_id", input.relatedStarId);
  if (input.name) form.append("name", input.name);
  if (input.tags) form.append("tags", input.tags);

  const res = await fetch(`${API_BASE_URL}/admin/mixcut/official-clips`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: OfficialClip;
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || json.error?.message || `上传失败 (HTTP ${res.status})`);
  }
  return json.data;
}

export async function updateOfficialClip(
  id: string,
  patch: OfficialClipUpdateInput,
): Promise<OfficialClip | null> {
  if (USE_MOCK) return mockDelay(null);
  return apiFetch<OfficialClip | null>(
    `/admin/mixcut/official-clips/${encodeURIComponent(id)}`,
    { method: "PUT", body: patch },
  );
}

export async function deleteOfficialClip(id: string): Promise<boolean> {
  if (USE_MOCK) return mockDelay(true);
  return apiFetch<boolean>(`/admin/mixcut/official-clips/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
