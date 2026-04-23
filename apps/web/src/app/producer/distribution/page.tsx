"use client";

// /producer/distribution — 全网分发
import { DistributionPage } from "@/components/producer/DistributionPage";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerDistributionPage() {
  const { lang, activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <DistributionPage lang={lang} activeArtist={activeArtist} />;
}
