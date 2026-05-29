"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MaterialOpsApi, ProductsApi } from "@/api";
import { MATERIAL_PRODUCTS, toMaterialProduct } from "@/mocks/material-ops";
import type { MaterialProduct, ScriptAsset } from "@/components/material-ops/types";
import { WorkshopScreen } from "@/components/material-ops/WorkshopScreen";

export function EditorClient({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<ScriptAsset | null>(null);
  const [product, setProduct] = React.useState<MaterialProduct | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const s = await MaterialOpsApi.getScript(scriptId);
      if (!alive) return;
      setDraft(s);
      if (s) {
        // 关联商品解析：优先脚本自带 product → 素材运营内置 6 商品 → 真实商品库（ProductsApi）。
        // 之前漏了最后一步，商品库选品建的脚本回退到 MATERIAL_PRODUCTS[0]（德绒打底衫）造成错配。
        let p: MaterialProduct | undefined =
          s.product ?? MATERIAL_PRODUCTS.find((m) => m.id === s.product_id);
        if (!p && s.product_id) {
          const real = await ProductsApi.getProduct(s.product_id);
          if (real) p = toMaterialProduct(real);
        }
        if (alive) setProduct(p ?? null);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [scriptId]);

  if (loading) return <div style={{ padding: 40, color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>加载脚本…</div>;
  if (!draft) return <div style={{ padding: 40, color: "var(--fg-2)" }}>未找到脚本 {scriptId}</div>;

  // 商品仍解析不到时才退回内置首个，避免整页崩；正常路径上面已覆盖商品库全集。
  const resolvedProduct: MaterialProduct = product ?? MATERIAL_PRODUCTS[0];

  const onSaveAndPreview = () => {
    const dur = draft.blocks.reduce((s, b) => s + b.dur, 0);
    MaterialOpsApi.saveScript({ ...draft, duration_sec: dur }).then(() => {
      router.push(`/material/workshop/${draft.id}`);
    });
  };

  return <WorkshopScreen draft={draft} setDraft={setDraft} product={resolvedProduct} onSaveAndPreview={onSaveAndPreview} />;
}
