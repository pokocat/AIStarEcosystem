"use client";

// /producer/appearance — AI 形象锻造（v1 / v2 / v3 由 ?forge= 切换）
import { useSearchParams } from "next/navigation";
import { AppearanceForge } from "@/components/producer/AppearanceForge";
import { AppearanceForgeV2 } from "@/components/producer/AppearanceForge.v2";
import { AppearanceForgeV3 } from "@/components/producer/AppearanceForge.v3";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerAppearancePage() {
  const { lang, activeArtist, setActiveArtist } = useProducerShell();
  const searchParams = useSearchParams();
  if (!activeArtist) return <NoArtistState />;

  const raw = searchParams?.get("forge");
  const variant = raw === "v3" ? "v3" : raw === "v2" ? "v2" : "v1";

  if (variant === "v3") {
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
  if (variant === "v2") return <AppearanceForgeV2 lang={lang} activeArtist={activeArtist} />;
  return <AppearanceForge lang={lang} activeArtist={activeArtist} />;
}
