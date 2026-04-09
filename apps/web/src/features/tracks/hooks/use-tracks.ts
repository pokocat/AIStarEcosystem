"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/types/app";
import type { TrackGenerationRequest, TrackSummary, TrackWorkspacePayload } from "@/types/contracts/tracks";
import { generateTrack, getMyTracks } from "@/api/tracks";

export function useTracks(lang: Lang) {
  const [data, setData] = useState<TrackWorkspacePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getMyTracks(lang)
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load tracks");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [lang]);

  const handleGenerateTrack = async (request: TrackGenerationRequest): Promise<TrackSummary> => {
    const track = await generateTrack(lang, request);
    setData((current) => (current ? { ...current, tracks: [track, ...current.tracks] } : current));
    return track;
  };

  return { data, isLoading, error, generateTrack: handleGenerateTrack };
}
