"use client";

// /producer/wardrobe — 造型与道具（游戏装备风格 v2）
import { WardrobePageV2 } from "@/components/producer/WardrobePageV2";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerWardrobePage() {
  const { activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <WardrobePageV2 activeArtist={activeArtist} />;
}
