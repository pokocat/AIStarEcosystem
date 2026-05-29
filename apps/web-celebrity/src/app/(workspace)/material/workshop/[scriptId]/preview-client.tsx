"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MaterialOpsApi } from "@/api";
import type { MaterialProduct, ScriptAsset } from "@/components/material-ops/types";
import { ScriptPreview } from "@/components/material-ops/ScriptPreview";
import { VideoGenDialog } from "@/components/material-ops/VideoGenDialog";

export function PreviewClient({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [script, setScript] = React.useState<ScriptAsset | null>(null);
  const [product, setProduct] = React.useState<MaterialProduct | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [genOpen, setGenOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    MaterialOpsApi.getScript(scriptId).then(async (s) => {
      if (cancelled) return;
      setScript(s);
      // 按 product_id 解析真实关联商品（全量商品库），不再回退到错误的 MATERIAL_PRODUCTS[0]。
      if (s) setProduct(await MaterialOpsApi.resolveProductForScript(s));
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  if (loading) return <div style={{ padding: 40, color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>加载脚本…</div>;
  if (!script || !product) return <div style={{ padding: 40, color: "var(--fg-2)" }}>未找到脚本 {scriptId}</div>;

  const isFromLibrary = script.kind !== "my_script";

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
          script={script}
          product={product}
          mode="baseline"
          baseline={null}
          onClose={() => setGenOpen(false)}
          onViewLibrary={() => router.push("/material/assets")}
        />
      )}
    </>
  );
}
