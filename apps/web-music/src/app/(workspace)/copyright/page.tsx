"use client";

// /producer/copyright — 版权资产
import { CopyrightPage } from "@/components/producer/CopyrightPage";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerCopyrightPage() {
  const { lang, activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <CopyrightPage lang={lang} activeArtist={activeArtist} />;
}
