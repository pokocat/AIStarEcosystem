"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MaterialOpsApi } from "@/api";
import type { MaterialProduct, ScriptAsset } from "@/components/material-ops/types";
import { WorkshopScreen } from "@/components/material-ops/WorkshopScreen";

export function EditorClient({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<ScriptAsset | null>(null);
  const [product, setProduct] = React.useState<MaterialProduct | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    MaterialOpsApi.getScript(scriptId).then(async (s) => {
      if (cancelled) return;
      setDraft(s);
      // 按 product_id 解析真实关联商品（全量商品库），不再回退到错误的 MATERIAL_PRODUCTS[0]。
      if (s) setProduct(await MaterialOpsApi.resolveProductForScript(s));
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  if (loading) return <div style={{ padding: 40, color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>加载脚本…</div>;
  if (!draft || !product) return <div style={{ padding: 40, color: "var(--fg-2)" }}>未找到脚本 {scriptId}</div>;

  const onSaveAndPreview = () => {
    const dur = draft.blocks.reduce((s, b) => s + b.dur, 0);
    MaterialOpsApi.saveScript({ ...draft, duration_sec: dur }).then(() => {
      router.push(`/material/workshop/${draft.id}`);
    });
  };

  return <WorkshopScreen draft={draft} setDraft={setDraft} product={product} onSaveAndPreview={onSaveAndPreview} />;
}
