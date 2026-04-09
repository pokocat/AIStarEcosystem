import type { Lang } from "@/types/app";
import type { TrackGenerationRequest, TrackSummary, TrackWorkspacePayload } from "@/types/contracts/tracks";
import { fetcher } from "@/lib/http/fetcher";
import { resolveGeneratedTrack, resolveTrackWorkspace } from "@/mocks/tracks/resolver";

const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function getMyTracks(lang: Lang): Promise<TrackWorkspacePayload> {
  if (isMock) return resolveTrackWorkspace(lang);
  return fetcher<TrackWorkspacePayload>(`${apiBase}/api/tracks/my?lang=${lang}`);
}

export async function generateTrack(lang: Lang, request: TrackGenerationRequest): Promise<TrackSummary> {
  if (isMock) return resolveGeneratedTrack(lang, request);
  return fetcher<TrackSummary>(`${apiBase}/api/tracks/generate?lang=${lang}`, {
    method: "POST",
    body: JSON.stringify(request)
  });
}
