import type { Lang } from "@/types/app";
import type { TrackGenerationRequest, TrackSummary } from "@/types/contracts/tracks";
import { buildTrackWorkspace } from "@/mocks/tracks/factory";

export function resolveTrackWorkspace(lang: Lang) {
  return buildTrackWorkspace(lang);
}

export function resolveGeneratedTrack(lang: Lang, request: TrackGenerationRequest): TrackSummary {
  return {
    id: `track-${Date.now()}`,
    title: request.prompt.slice(0, 30) || (lang === "zh" ? "未命名作品" : "Untitled Track"),
    style: request.style || "Electronic",
    durationSec: request.durationSec,
    durationLabel: `${Math.floor(request.durationSec / 60)}:${String(request.durationSec % 60).padStart(2, "0")}`,
    status: "Draft",
    date: new Date().toISOString().slice(0, 10),
    plays: 0
  };
}
