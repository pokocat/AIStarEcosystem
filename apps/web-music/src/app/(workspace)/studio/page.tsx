"use client";

// /producer/studio — 创作工坊（根据 activeArtist.type 动态换标题）。
// 2026-08-29 起不再要求签约艺人：无艺人时进入自由创作模式，作品直接归属账号。
import { StudioPage } from "@/components/producer/StudioPage";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerStudioPage() {
  const { lang, activeArtist } = useProducerShell();
  return <StudioPage lang={lang} activeArtist={activeArtist} />;
}
