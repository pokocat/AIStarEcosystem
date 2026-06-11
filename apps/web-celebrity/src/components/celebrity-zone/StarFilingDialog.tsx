"use client";

// StarFilingDialog — 把公共商品池商品「报备」给已授权明星（v0.60 · web-star 打通）。
// 报备后进入明星商务工作台「商品入库」6 步流程；本弹层可回查该商品的全部报备进度。

import * as React from "react";
import { CheckCircle2, Loader2, Send, Star as StarIcon } from "lucide-react";
import type { Product, StarProductFiling } from "@ai-star-eco/types";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { CelebrityZoneApi, StarFilingApi } from "@/api";
import { CTA_PRIMARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

const STEP_COLORS: Record<number, string> = {
  0: "border-zinc-300 bg-zinc-100 text-zinc-600",
  1: "border-cyan-400/40 bg-cyan-500/10 text-cyan-700",
  2: "border-amber-400/40 bg-amber-500/10 text-amber-700",
  3: "border-violet-400/40 bg-violet-500/10 text-violet-700",
  4: "border-pink-400/40 bg-pink-500/10 text-pink-700",
  5: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700",
  6: "border-pink-400/40 bg-pink-500/10 text-pink-700",
};

export function StarFilingDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const open = product !== null;
  const [stars, setStars] = React.useState<CelebrityStar[] | null>(null);
  const [filings, setFilings] = React.useState<StarProductFiling[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successName, setSuccessName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !product) return;
    setSelected(null);
    setError(null);
    setSuccessName(null);
    CelebrityZoneApi.listStars().then(setStars).catch(() => setStars([]));
    StarFilingApi.listStarFilings({ productId: product.id }).then(setFilings).catch(() => setFilings([]));
  }, [open, product]);

  const file = async () => {
    if (!product || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const filing = await StarFilingApi.fileProductToStar(product.id, selected);
      setFilings((prev) => [filing, ...prev.filter((f) => f.id !== filing.id)]);
      setSuccessName(filing.starName);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "报备失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  };

  const authorized = (stars ?? []).filter((s) => s.authorization.status === "authorized");
  const others = (stars ?? []).filter((s) => s.authorization.status !== "authorized");
  const filedStarIds = new Set(filings.filter((f) => f.step !== 6).map((f) => f.starId));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg border-zinc-200 bg-white text-zinc-900 shadow-[var(--shadow-pop)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900">
            <Send className="h-4 w-4 text-violet-600" />
            报备明星{product ? ` — ${product.name}` : ""}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            报备后商品进入明星商务工作台「商品入库」流程：明星审核 → 双路寄样 → 样品确认 → 入库可带货。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 选择明星 */}
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-600">选择明星（仅已授权可报备）</div>
            {!stars ? (
              <div className="flex items-center gap-2 py-4 text-xs text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载明星列表…
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {authorized.map((s) => {
                  const already = filedStarIds.has(s.id);
                  const active = selected === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={already}
                      onClick={() => setSelected(active ? null : s.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                        already
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
                          : active
                            ? "border-violet-500 bg-violet-500/10 text-violet-700"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-400/60",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.avatar} alt={s.name} className="h-6 w-6 rounded-full object-cover" />
                      <span className="font-medium">{s.name}</span>
                      {already && <span className="text-[10px]">已报备</span>}
                      {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
                {authorized.length === 0 && (
                  <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    暂无已授权明星 —— 先到「明星市场」申请带货授权，明星端批准后即可报备商品。
                  </div>
                )}
              </div>
            )}
            {others.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
                <StarIcon className="h-3 w-3" />
                {others.map((s) => s.name).join("、")} 未授权，可在明星市场发起申请
              </div>
            )}
          </div>

          {successName && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              已报备给「{successName}」，等待明星端审核（可在下方追踪进度）
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-pink-300/50 bg-pink-50 px-3 py-2 text-xs text-pink-700">{error}</div>
          )}

          <button
            type="button"
            onClick={file}
            disabled={!selected || submitting}
            className={cn(CTA_PRIMARY, "w-full justify-center disabled:opacity-50")}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交报备
          </button>

          {/* 报备进度 */}
          {filings.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">本商品报备进度</div>
              <div className="space-y-1.5">
                {filings.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm text-zinc-700">
                      <StarIcon className="h-3.5 w-3.5 text-amber-500" />
                      {f.starName}
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        STEP_COLORS[f.step] ?? STEP_COLORS[0],
                      )}
                    >
                      {f.stepLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
