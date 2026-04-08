import type { Lang } from "@/types/app";
import type { SingerDetail } from "@/types/contracts/singers";
import { resolveCreatedSinger, resolveSingerWorkspace } from "@/mocks/singers/resolver";

export async function getMySingerWorkspace(lang: Lang) {
  return resolveSingerWorkspace(lang);
}

export async function createSinger(lang: Lang) {
  return resolveCreatedSinger(lang);
}

export async function updateSinger(_id: string, singer: SingerDetail) {
  return singer;
}

export async function deleteSinger(id: string) {
  return { id, deleted: true };
}
