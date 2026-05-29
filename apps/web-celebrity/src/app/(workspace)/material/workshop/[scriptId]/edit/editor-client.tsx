"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MaterialOpsApi } from "@/api";
import type { MaterialProduct, ScriptAsset } from "@/components/material-ops/types";
import { useConfirm } from "@/components/common/confirm-dialog";
import { WorkshopScreen } from "@/components/material-ops/WorkshopScreen";

export function EditorClient({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<ScriptAsset | null>(null);
  const [product, setProduct] = React.useState<MaterialProduct | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const { confirm, ConfirmHost } = useConfirm();

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

  const onDelete = async () => {
    if (deleting) return;
    const ok = await confirm({
      title: `删除脚本：${draft.name || draft.id}`,
      description: "删除后脚本会从脚本库隐藏，历史生成视频不会删除。",
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await MaterialOpsApi.deleteScript(draft.id);
      router.replace("/material/workshop");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <WorkshopScreen
        draft={draft}
        setDraft={setDraft}
        product={product}
        onProductChange={(nextProduct) => setProduct(nextProduct)}
        onSaveAndPreview={onSaveAndPreview}
        onDelete={onDelete}
      />
      <ConfirmHost />
    </>
  );
}
