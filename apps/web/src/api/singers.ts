import type { Lang } from "@/types/app";
import type { SingerDetail, SingerWorkspacePayload } from "@/types/contracts/singers";
import { fetcher } from "@/lib/http/fetcher";
import { resolveCreatedSinger, resolveSingerWorkspace } from "@/mocks/singers/resolver";

const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function getMySingerWorkspace(lang: Lang): Promise<SingerWorkspacePayload> {
  if (isMock) return resolveSingerWorkspace(lang);
  return fetcher<SingerWorkspacePayload>(`${apiBase}/api/singers/my?lang=${lang}`);
}

export async function createSinger(lang: Lang): Promise<SingerDetail> {
  if (isMock) return resolveCreatedSinger(lang);
  return fetcher<SingerDetail>(`${apiBase}/api/singers?lang=${lang}`, { method: "POST" });
}

export async function updateSinger(id: string, singer: SingerDetail): Promise<SingerDetail> {
  if (isMock) return singer;
  return fetcher<SingerDetail>(`${apiBase}/api/singers/${id}`, {
    method: "PUT",
    body: JSON.stringify(singer)
  });
}

export async function deleteSinger(id: string): Promise<{ id: string; deleted: boolean }> {
  if (isMock) return { id, deleted: true };
  return fetcher<{ id: string; deleted: boolean }>(`${apiBase}/api/singers/${id}`, { method: "DELETE" });
}
