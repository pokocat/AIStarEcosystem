"use client";

// /producer/incubator — AI 艺人孵化向导
import { IncubationWizard } from "@/components/producer/IncubationWizard";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerIncubatorPage() {
  const { lang, navigate } = useProducerShell();
  return (
    <IncubationWizard
      lang={lang}
      onClose={() => navigate("artists")}
      onCreated={() => navigate("artists")}
    />
  );
}
