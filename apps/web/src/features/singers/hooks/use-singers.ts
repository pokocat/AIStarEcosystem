"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/types/app";
import { fetcher } from "@/lib/http/fetcher";
import type { SingerDetail, SingerWorkspacePayload } from "@/types/contracts/singers";

export function useSingers(lang: Lang) {
  const [data, setData] = useState<SingerWorkspacePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);

    fetcher<SingerWorkspacePayload>(`/api/singers/my?lang=${lang}`)
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load singers");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [lang]);

  const createSinger = async () => {
    const created = await fetcher<SingerDetail>(`/api/singers?lang=${lang}`, { method: "POST" });
    setData((current) => (current ? { ...current, singers: [created, ...current.singers] } : current));
    return created;
  };

  const updateSinger = async (singer: SingerDetail) => {
    const updated = await fetcher<SingerDetail>(`/api/singers/${singer.id}`, {
      method: "PUT",
      body: JSON.stringify(singer)
    });
    setData((current) =>
      current
        ? {
            ...current,
            singers: current.singers.map((item) => (item.id === updated.id ? updated : item))
          }
        : current
    );
    return updated;
  };

  const deleteSinger = async (id: string) => {
    await fetcher<{ id: string; deleted: boolean }>(`/api/singers/${id}`, { method: "DELETE" });
    setData((current) =>
      current
        ? {
            ...current,
            singers: current.singers.filter((item) => item.id !== id)
          }
        : current
    );
  };

  return { data, isLoading, error, createSinger, updateSinger, deleteSinger };
}
