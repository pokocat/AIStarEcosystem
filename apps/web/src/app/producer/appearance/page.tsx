"use client";

// /producer/appearance — AI 形象锻造（顶满视口正式版）
// v1（AppearanceForge.legacy.tsx）/ v2（AppearanceForge.v2.legacy.tsx）保留为备份，不再挂载。
import { AppearanceForgeV3 } from "@/components/producer/AppearanceForge.v3";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerAppearancePage() {
  const { lang, activeArtist, setActiveArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;

  return (
    <AppearanceForgeV3
      lang={lang}
      activeArtist={activeArtist}
      onArtistAvatarSaved={(nextAvatar: string) => {
        setActiveArtist((prev) =>
          prev && prev.id === activeArtist.id ? { ...prev, avatar: nextAvatar } : prev,
        );
      }}
    />
  );
}
