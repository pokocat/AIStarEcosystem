"use client";

export const dynamic = "force-dynamic";

// 新建短视频 —— 复用首页「短视频 tab」的创建控制台（ShortCreateConsole）：
// 创意市场单集创意 + TipTap 对话框 + 试试同款引用 chip。不再重复实现一套模版浮层。
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ShortCreateConsole } from "@/components/drama-workshop/short-create-console";

export default function ShortNewPage() {
  return (
    <React.Suspense fallback={<div className="ws-flush" style={{ background: "var(--bg)", minHeight: "100%" }} />}>
      <ShortNewInner />
    </React.Suspense>
  );
}

function ShortNewInner() {
  const sp = useSearchParams();
  return <ShortCreateConsole variant="standalone" initialIdea={sp.get("idea") ?? ""} />;
}
