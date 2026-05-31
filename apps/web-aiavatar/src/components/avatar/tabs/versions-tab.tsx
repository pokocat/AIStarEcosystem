"use client";

import * as React from "react";
import { Check, RotateCcw, Star, Trash2 } from "lucide-react";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { dateTime } from "@/lib/format";

/** 版本时间线（任务书 §7 版本管理）：每次 AI 动作的快照，可标偏好/废弃、回退、查看参数。 */
export function VersionsTab({ detail, onChanged }: { detail: AiAvatarDetail; onChanged: () => void }) {
  const { versions, avatar } = detail;
  const [busy, setBusy] = React.useState<string | null>(null);

  if (versions.length === 0) {
    return <div className="rounded-xl border border-dashed border-zinc-700 py-14 text-center text-sm text-zinc-500">尚无版本 · 每次 AI 动作会生成一个版本快照</div>;
  }

  const act = async (fn: () => Promise<unknown>, key: string) => {
    setBusy(key); try { await fn(); onChanged(); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      {[...versions].reverse().map((v) => {
        const isCurrent = v.id === avatar.currentVersionId;
        const isFinal = v.id === avatar.finalizedVersionId;
        return (
          <div key={v.id} className={cn("flex gap-3 rounded-xl border p-3",
            v.discarded ? "border-zinc-800 opacity-50" : isCurrent ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800 bg-[var(--bg-1)]")}>
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg">
              {v.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.previewUrl} alt={`v${v.versionNo}`} className="h-full w-full object-cover" />
              ) : <div className="ph h-full w-full" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-amber-400">v{v.versionNo}</span>
                <span className="text-sm font-medium text-zinc-100">{v.label}</span>
                {isCurrent && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">当前</span>}
                {isFinal && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">定稿</span>}
                {v.preferred && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">偏好</span>}
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
      className={cn("rounded-md p-1.5", active ? "bg-amber-500/15 text-amber-300" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200")}>
      {children}
    </button>
  );
}
