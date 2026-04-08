import type { Lang } from "@/types/app";
import type { TrackGenerationRequest } from "@/types/contracts/tracks";
import { resolveGeneratedTrack, resolveTrackWorkspace } from "@/mocks/tracks/resolver";

export async function getMyTracks(lang: Lang) {
  return resolveTrackWorkspace(lang);
}

export async function generateTrack(lang: Lang, request: TrackGenerationRequest) {
  return resolveGeneratedTrack(lang, request);
}
