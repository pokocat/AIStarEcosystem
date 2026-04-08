import type { Lang } from "@/types/app";
import type { TrackGenerationRequest, TrackSummary, TrackWorkspacePayload } from "@/types/contracts/tracks";
import { proxySpring } from "@/server/adapters/spring/shared";

export async function getMyTracks(lang: Lang) {
  return proxySpring<TrackWorkspacePayload>(`/api/tracks/my?lang=${lang}`);
}

export async function generateTrack(_lang: Lang, request: TrackGenerationRequest) {
  return proxySpring<TrackSummary>("/api/tracks/generate", {
    method: "POST",
    body: JSON.stringify(request)
  });
}
