"use client";
// ============================================================
// PipelineFrame — 7 步流程页公共框架：加载 avatar detail + 渲染向导条。
// ============================================================
import * as React from "react";
import { useParams } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { PipelineNav, type WizardStep } from "./pipeline-nav";
import { useApi } from "@/lib/hooks";
import { getAvatarDetail } from "@/api/ai-avatar";

export function useAvatarId(): string {
  const params = useParams<{ id: string }>();
  return Array.isArray(params.id) ? params.id[0] : params.id;
}

export function PipelineFrame({
  current,
  children,
}: {
  current: WizardStep;
  children: (detail: AiAvatarDetail, reload: () => void) => React.ReactNode;
}) {
  const id = useAvatarId();
  const { data, loading, error, reload } = useApi(() => getAvatarDetail(id), [id]);

  if (loading && !data) {
    return <Center>载入数字人…</Center>;
  }
  if (error || !data) {
    return <Center tone="err">{error || "数字人不存在"}</Center>;
  }
  return (
    <>
      <PipelineNav avatarId={id} mode={data.avatar.mode} current={current} />
      <div className="fade-up">{children(data, reload)}</div>
    </>
  );
}

function Center({ children, tone }: { children: React.ReactNode; tone?: "err" }) {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: "120px 0", color: tone === "err" ? "var(--err)" : "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
      {children}
    </div>
  );
}
