"use client";

// /producer/wardrobe — 造型与道具（v1 默认 / ?v=2 进入游戏装备风格 v2）
import { useSearchParams } from "next/navigation";
import { WardrobePage } from "@/components/producer/WardrobePage";
import { WardrobePageV2 } from "@/components/producer/WardrobePageV2";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerWardrobePage() {
  const { lang, activeArtist } = useProducerShell();
  const searchParams = useSearchParams();
  if (!activeArtist) return <NoArtistState />;

  const variant = searchParams?.get("v") === "2" ? "v2" : "v1";
  if (variant === "v2") return <WardrobePageV2 activeArtist={activeArtist} />;
  return <WardrobePage lang={lang} activeArtist={activeArtist} />;
}
