"use client";

import * as React from "react";
import { Check, RotateCcw, Star, Trash2 } from "lucide-react";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { SafeImg } from "@/components/common/safe-img";
import { dateTime } from "@/lib/format";

/** 版本时间线：每次 AI 动作的快照，可标偏好/废弃、回退、查看参数。 */
export function VersionsTab({ detail, onChanged }: { detail: AiAvatarDetail; onChanged: () => void }) {
  const { versions, avatar } = detail;
  const [busy, setBusy] = React.useState<string | null>(null);

  if (versions.length === 0) {
    return <div className="rounded-xl border border-dashed border-[var(--line-strong)] py-14 text-center text-sm text-[var(--fg-3)]">尚无版本 · 每次 AI 动作会生成一个版本快照</div>;
  }

  const act = async (fn: () => Promise<unknown>, key: string) => {
    setBusy(key); try { await fn(); onChanged(); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2.5">
      {[...versions].reverse().map((v) => {
        const isCurrent = v.id === avatar.currentVersionId;
        const isFinal = v.id === avatar.finalizedVersionId;
        return (
          <div key={v.id} className={cn("flex gap-3 rounded-xl border p-3 transition",
            v.discarded ? "border-[var(--line)] opacity-55" : isCurrent ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--bg-1)]")}>
            <div className="aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--line)]">
              <SafeImg src={v.previewUrl} alt={`v${v.versionNo}`} className="h-full w-full" imgClassName="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-sm font-semibold text-[var(--brand-strong)]">v{v.versionNo}</span>
                <span className="text-sm font-medium text-[var(--fg-0)]">{v.label}</span>
                {isCurrent && <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-strong)]">当前</span>}
                {isFinal && <span className="rounded bg-[var(--success-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--success)]">定稿</span>}
                {v.preferred && <span className="rounded bg-[var(--violet-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--violet)]">偏好</span>}
              </div>
              <div className="meta mt-1">{v.note} · {v.assetIds.length} 张资产 · {dateTime(v.createdAt)}</div>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <IconBtn title="标记偏好" active={v.preferred} onClick={() => act(() => AiAvatarApi.markVersion(avatar.id, v.id, { preferred: !v.preferred }), v.id + "p")} busy={busy === v.id + "p"}><Star className="h-3.5 w-3.5" /></IconBtn>
              {!isCurrent && !avatar.status.startsWith("finalized") && (
                <IconBtn title="回退到此版本" onClick={() => act(() => AiAvatarApi.revertToVersion(avatar.id, v.id), v.id + "r")} busy={busy === v.id + "r"}><RotateCcw className="h-3.5 w-3.5" /></IconBtn>
              )}
              <IconBtn title={v.discarded ? "恢复" : "废弃"} onClick={() => act(() => AiAvatarApi.markVersion(avatar.id, v.id, { discarded: !v.discarded }), v.id + "d")} busy={busy === v.id + "d"}>
                {v.discarded ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              </IconBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IconBtn({ children, title, onClick, active, busy }: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean; busy?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={busy}
      className={cn("rounded-md p-1.5 transition", active ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[var(--fg-0)]")}>
      {children}
    </button>
  );
}
