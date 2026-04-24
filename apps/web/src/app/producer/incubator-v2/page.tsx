"use client";

// /producer/incubator-v2 — Genesis Chamber 版 AI 艺人孵化向导
import { IncubationWizardV2 } from "@/components/producer/IncubationWizardV2";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerIncubatorV2Page() {
  const { lang, navigate } = useProducerShell();
  return (
    <IncubationWizardV2
      lang={lang}
      onClose={() => navigate("artists")}
      onCreated={() => navigate("artists")}
    />
  );
}
