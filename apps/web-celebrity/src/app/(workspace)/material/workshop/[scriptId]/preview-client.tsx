"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MaterialOpsApi } from "@/api";
import { MATERIAL_PRODUCTS } from "@/mocks/material-ops";
import type { MaterialProduct, MaterialVideo, ScriptAsset, VariantConfig } from "@/components/material-ops/types";
import { ScriptPreview } from "@/components/material-ops/ScriptPreview";
import { VideoGenDialog } from "@/components/material-ops/VideoGenDialog";

export function PreviewClient({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [script, setScript] = React.useState<ScriptAsset | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [genOpen, setGenOpen] = React.useState(false);

  React.useEffect(() => {
    MaterialOpsApi.getScript(scriptId).then((s) => {
      setScript(s);
      setLoading(false);
    });
  }, [scriptId]);

  if (loading) return <div style={{ padding: 40, color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>加载脚本…</div>;
  if (!script) return <div style={{ padding: 40, color: "var(--fg-2)" }}>未找到脚本 {scriptId}</div>;

  const product: MaterialProduct = script.product ?? MATERIAL_PRODUCTS.find((p) => p.id === script.product_id) ?? MATERIAL_PRODUCTS[0];
  const isFromLibrary = script.kind !== "my_script";

  const onComplete = (videos: MaterialVideo[]) => {
    MaterialOpsApi.addVideos(videos).then(() => {
      setGenOpen(false);
      router.push("/material/assets");
    });
  };
  const onSubmitAsync = (payload: { names: string[]; configs: VariantConfig[] }) => {
    const tasks = payload.names.map((name, i) => ({
      id: `task-${Date.now()}-${i}`,
      script_id: script.id,
      product_id: script.product_id,
      parent_video_id: null,
      kind: "baseline" as const,
      name,
      status: "pending" as const,
      submitted_at: new Date(Date.now() + i * 100).toISOString(),
      eta_sec: 90,
      progress_pct: 0,
      stage: "已入队",
      variant_config: payload.configs[i] ?? payload.configs[0],
    }));
    MaterialOpsApi.enqueueRenderTasks(tasks).then(() => {
      setGenOpen(false);
      router.push("/material/assets");
    });
  };

  return (
    <>
      <ScriptPreview
        script={script}
        product={product}
        isFromLibrary={isFromLibrary}
        onBack={() => router.push("/material/workshop")}
        onEdit={() => router.push(`/material/workshop/${scriptId}/edit`)}
        onGenerateVideo={() => setGenOpen(true)}
      />
      {genOpen && (
        <VideoGenDialog
          script={{ ...script, product }}
          mode="baseline"
          baseline={null}
          onClose={() => setGenOpen(false)}
          onComplete={onComplete}
          onSubmitAsync={onSubmitAsync}
        />
      )}
    </>
  );
}
