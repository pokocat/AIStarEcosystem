import type { Lang } from "@/types/app";
import type { TrackGenerationRequest } from "@/types/contracts/tracks";
import * as mockAdapter from "@/server/adapters/mock/tracks";
import * as springAdapter from "@/server/adapters/spring/tracks";
import { shouldUseMockData } from "@/server/services/shared";

export async function listMyTracks(lang: Lang) {
  return shouldUseMockData() ? mockAdapter.getMyTracks(lang) : springAdapter.getMyTracks(lang);
}

export async function createGeneratedTrack(lang: Lang, request: TrackGenerationRequest) {
  return shouldUseMockData() ? mockAdapter.generateTrack(lang, request) : springAdapter.generateTrack(lang, request);
}
