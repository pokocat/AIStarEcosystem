"use client";

export const dynamic = "force-dynamic";

// 新建短剧 —— 与「短视频」一致的对话框体验：居中 AI 对话框 + 上方「套爆款模板」浮层。
// （旧的两步向导 PickType/PickMode/GuidedStart/TemplateStart 已删除，统一到此对话框流。）
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CreateDialog } from "@/components/drama-workshop/new-project/create-dialog";

export default function NewProjectPage() {
  return (
    <React.Suspense fallback={<div className="ws-flush" style={{ background: "var(--bg)", minHeight: "100%" }} />}>
      <NewProjectInner />
    </React.Suspense>
  );
}

function NewProjectInner() {
  const sp = useSearchParams();
  return (
    <CreateDialog
      initialIdea={sp.get("idea") ?? ""}
      focusTemplate={sp.get("focus") === "template"}
    />
  );
}
