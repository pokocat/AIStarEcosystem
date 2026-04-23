"use client";

// /producer/community — 粉丝社群
import { CommunityPage } from "@/components/producer/CommunityPage";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerCommunityPage() {
  const { lang, activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <CommunityPage lang={lang} activeArtist={activeArtist} />;
}
