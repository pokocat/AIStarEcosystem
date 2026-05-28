"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MaterialOpsApi } from "@/api";
import { MATERIAL_PRODUCTS } from "@/mocks/material-ops";
import type { MaterialProduct, ScriptAsset } from "@/components/material-ops/types";
import { WorkshopScreen } from "@/components/material-ops/WorkshopScreen";

export function EditorClient({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<ScriptAsset | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    MaterialOpsApi.getScript(scriptId).then((s) => {
      setDraft(s);
      setLoading(false);
    });
  }, [scriptId]);

  if (loading) return <div style={{ padding: 40, color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>加载脚本…</div>;
  if (!draft) return <div style={{ padding: 40, color: "var(--fg-2)" }}>未找到脚本 {scriptId}</div>;

  const product: MaterialProduct = draft.product ?? MATERIAL_PRODUCTS.find((p) => p.id === draft.product_id) ?? MATERIAL_PRODUCTS[0];

  const onSaveAndPreview = () => {
    const dur = draft.blocks.reduce((s, b) => s + b.dur, 0);
    MaterialOpsApi.saveScript({ ...draft, duration_sec: dur }).then(() => {
      router.push(`/material/workshop/${draft.id}`);
    });
  };

  return <WorkshopScreen draft={draft} setDraft={setDraft} product={product} onSaveAndPreview={onSaveAndPreview} />;
}
