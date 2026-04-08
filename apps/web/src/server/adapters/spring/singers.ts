import type { Lang } from "@/types/app";
import type { SingerDetail, SingerWorkspacePayload } from "@/types/contracts/singers";
import { proxySpring } from "@/server/adapters/spring/shared";

export async function getMySingerWorkspace(lang: Lang) {
  return proxySpring<SingerWorkspacePayload>(`/api/singers/my?lang=${lang}`);
}

export async function createSinger(lang: Lang) {
  return proxySpring<SingerDetail>(`/api/singers?lang=${lang}`, { method: "POST" });
}

export async function updateSinger(id: string, singer: SingerDetail) {
  return proxySpring<SingerDetail>(`/api/singers/${id}`, {
    method: "PUT",
    body: JSON.stringify(singer)
  });
}

export async function deleteSinger(id: string) {
  return proxySpring<{ id: string; deleted: boolean }>(`/api/singers/${id}`, { method: "DELETE" });
}
