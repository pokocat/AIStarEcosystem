"use client";

// /producer/finance — 商业变现 / 账单流水
import { FinancePage } from "@/components/producer/FinancePage";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerFinancePage() {
  const { lang, activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <FinancePage lang={lang} activeArtist={activeArtist} />;
}
