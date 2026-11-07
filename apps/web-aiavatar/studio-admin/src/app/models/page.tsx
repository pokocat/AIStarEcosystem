import { Suspense } from "react";
import { StudioShell } from "@/components/studio-shell";
import { ModelConfig } from "@/components/models/model-config";

/** 运营配置 · 模型配置：模型接入、IP Studio 模型、功能与售价。 */
export default function ModelsPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#f4f6fb]" />}>
      <StudioShell module="models">
        <ModelConfig />
      </StudioShell>
    </Suspense>
  );
}
