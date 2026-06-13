"use client";

export const dynamic = "force-dynamic";

// 新建短视频 —— 对话框 + 短视频模版浮层（与短剧新建一致）。
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ShortCreateDialog } from "@/components/drama-workshop/short-create-dialog";

export default function ShortNewPage() {
  return (
    <React.Suspense fallback={<div className="ws-flush" style={{ background: "var(--bg)", minHeight: "100%" }} />}>
      <ShortNewInner />
    </React.Suspense>
  );
}

function ShortNewInner() {
  const sp = useSearchParams();
  return <ShortCreateDialog initialIdea={sp.get("idea") ?? ""} />;
}
