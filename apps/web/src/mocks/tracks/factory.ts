import { pickLocalizedText } from "@/mocks/shared";
import type { Lang } from "@/types/app";
import type { TrackWorkspacePayload } from "@/types/contracts/tracks";
import { chartFixtures, generationStageFixtures, lyricFixtures, trackFixtures } from "@/mocks/tracks/fixtures";

export function buildTrackWorkspace(lang: Lang): TrackWorkspacePayload {
  return {
    tracks: trackFixtures.map((track) => ({
      id: track.id,
      title: pickLocalizedText(lang, track.title),
      style: track.style,
      durationSec: track.durationSec,
      durationLabel: track.durationLabel,
      status: track.status,
      date: track.date,
      plays: track.plays
    })),
    chartEntries: chartFixtures,
    lyrics: lyricFixtures,
    discoverySpotlight: {
      badge: lang === "zh" ? "新发行" : "New Release",
      title: lang === "zh" ? "Electric Dreams" : "Electric Dreams",
      artist: "Project: Zero",
      coverUrl: "https://images.unsplash.com/photo-1514525253440-b393452e2347?w=600",
      subtitle: lang === "zh" ? "Project: Zero · EP" : "Project: Zero · EP"
    },
    recommendations: [
      { id: "rec-1", title: "Song Name 1", artist: "Artist 1", coverUrl: "https://images.unsplash.com/photo-1500000005000?w=300" },
      { id: "rec-2", title: "Song Name 2", artist: "Artist 2", coverUrl: "https://images.unsplash.com/photo-1500000010000?w=300" },
      { id: "rec-3", title: "Song Name 3", artist: "Artist 3", coverUrl: "https://images.unsplash.com/photo-1500000015000?w=300" },
      { id: "rec-4", title: "Song Name 4", artist: "Artist 4", coverUrl: "https://images.unsplash.com/photo-1500000020000?w=300" }
    ],
    generationStages: generationStageFixtures
  };
}
