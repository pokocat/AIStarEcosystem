"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/types/app";
import type { SingerDetail, SingerWorkspacePayload } from "@/types/contracts/singers";
import { createSinger, deleteSinger, getMySingerWorkspace, updateSinger } from "@/api/singers";

export function useSingers(lang: Lang) {
  const [data, setData] = useState<SingerWorkspacePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);

    getMySingerWorkspace(lang)
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

  const handleCreateSinger = async () => {
    const created = await createSinger(lang);
    setData((current) => (current ? { ...current, singers: [created, ...current.singers] } : current));
    return created;
  };

  const handleUpdateSinger = async (singer: SingerDetail) => {
    const updated = await updateSinger(singer.id, singer);
    setData((current) =>
      current
        ? { ...current, singers: current.singers.map((item) => (item.id === updated.id ? updated : item)) }
        : current
    );
    return updated;
  };

  const handleDeleteSinger = async (id: string) => {
    await deleteSinger(id);
    setData((current) =>
      current ? { ...current, singers: current.singers.filter((item) => item.id !== id) } : current
    );
  };

  return { data, isLoading, error, createSinger: handleCreateSinger, updateSinger: handleUpdateSinger, deleteSinger: handleDeleteSinger };
}
