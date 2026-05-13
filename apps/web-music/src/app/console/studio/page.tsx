"use client";

// /producer/studio — 创作工坊（根据 activeArtist.type 动态换标题）
import { StudioPage } from "@/components/producer/StudioPage";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerStudioPage() {
  const { lang, activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <StudioPage lang={lang} activeArtist={activeArtist} />;
}
