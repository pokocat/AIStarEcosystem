"use client";

// /producer/wardrobe — 造型与道具
import { WardrobePage } from "@/components/producer/WardrobePage";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerWardrobePage() {
  const { lang, activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <WardrobePage lang={lang} activeArtist={activeArtist} />;
}
