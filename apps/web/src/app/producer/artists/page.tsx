"use client";

// /producer/artists — MCN与孵化（列表 / 网格 + 详情弹窗）
import { MCNMatrix } from "@/components/producer/MCNMatrix";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerArtistsPage() {
  const { lang, navigate } = useProducerShell();
  return <MCNMatrix lang={lang} onCreateArtist={() => navigate("incubator")} />;
}
