import type { Lang } from "@/types/app";
import type { SingerDetail } from "@/types/contracts/singers";
import * as mockAdapter from "@/server/adapters/mock/singers";
import * as springAdapter from "@/server/adapters/spring/singers";
import { shouldUseMockData } from "@/server/services/shared";

export async function listMySingerWorkspace(lang: Lang) {
  return shouldUseMockData() ? mockAdapter.getMySingerWorkspace(lang) : springAdapter.getMySingerWorkspace(lang);
}

export async function createSinger(lang: Lang) {
  return shouldUseMockData() ? mockAdapter.createSinger(lang) : springAdapter.createSinger(lang);
}

export async function updateSinger(id: string, singer: SingerDetail) {
  return shouldUseMockData() ? mockAdapter.updateSinger(id, singer) : springAdapter.updateSinger(id, singer);
}

export async function deleteSinger(id: string) {
  return shouldUseMockData() ? mockAdapter.deleteSinger(id) : springAdapter.deleteSinger(id);
}
