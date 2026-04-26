"use client";

// /producer/incubator-v2 — Genesis Chamber 版 AI 艺人孵化向导
import { IncubationWizardV2 } from "@/components/producer/IncubationWizardV2";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerIncubatorV2Page() {
  const { lang, navigate } = useProducerShell();
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          AI 艺人孵化
        </h1>
        <p className="text-sm text-gray-400 font-light">
          为虚拟艺人定义身份、性格与世界观
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <IncubationWizardV2
          lang={lang}
          onClose={() => navigate("artists")}
          onCreated={() => navigate("artists")}
        />
      </div>
    </div>
  );
}
