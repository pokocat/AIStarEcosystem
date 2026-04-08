"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/types/app";
import { fetcher } from "@/lib/http/fetcher";
import type { TrackGenerationRequest, TrackSummary, TrackWorkspacePayload } from "@/types/contracts/tracks";

export function useTracks(lang: Lang) {
  const [data, setData] = useState<TrackWorkspacePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetcher<TrackWorkspacePayload>(`/api/tracks/my?lang=${lang}`)
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

  const generateTrack = async (request: TrackGenerationRequest) => {
    const track = await fetcher<TrackSummary>(`/api/tracks/generate?lang=${lang}`, {
      method: "POST",
      body: JSON.stringify(request)
    });
    setData((current) => (current ? { ...current, tracks: [track, ...current.tracks] } : current));
    return track;
  };

  return { data, isLoading, error, generateTrack };
}
