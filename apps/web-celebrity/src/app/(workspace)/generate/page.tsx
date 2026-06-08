"use client";

// v0.37+：顶层「快速生成」入口 —— 直接列出已授权明星，每张卡片「开始生成」→ /star/{id}/generate。
// 入口外放：避免 市场 → 明星卡 → 详情 → 生成 的 3 跳路径，工作台主菜单单击即可看到可用明星。

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { listStars } from "@/api/celebrity-zone";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function QuickGeneratePage() {
  const [stars, setStars] = React.useState<CelebrityStar[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listStars();
        if (!cancelled) setStars(list);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "加载失败");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const authorized = stars.filter((s) => s.authorization?.status === "authorized");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h1 className="text-xl font-semibold text-zinc-900">快速生成</h1>
        </div>
        <p className="text-sm text-zinc-500">
          从已授权明星中直接进入生成工作台。如需新增明星，
          <Link href="/market" className="text-violet-600 hover:underline">浏览明星市场</Link> 申请授权。
        </p>
      </header>

      {loadError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          明星数据加载失败：{loadError}
        </div>
      )}

      {authorized.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-violet-500/25 bg-gradient-to-br from-violet-500/[0.05] to-pink-500/[0.04] p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-violet-500/60" />
          <h3 className="mt-3 text-base font-semibold text-zinc-800">还没有已授权的明星</h3>
          <p className="mt-1 text-sm text-zinc-600">
            前往明星市场挑选合适的 IP，提交授权申请通过后即可开始生成视频。
          </p>
          <Link
            href="/market"
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            浏览市场 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {authorized.map((s) => (
            <article
              key={s.id}
              className="group flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]"
            >
              <img
                src={s.avatar}
                alt={s.name}
                className="h-20 w-20 shrink-0 rounded-xl object-cover border border-zinc-200"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <div className="flex flex-1 flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-zinc-800 truncate">{s.name}</h3>
                  {s.isHot && <span className="text-xs text-amber-500">🔥</span>}
                </div>
                <div className="text-xs text-zinc-500">
                  {s.category} · {s.pricingTier ?? "标准版"} · 配额 {s.quotaUsed ?? 0}/{s.quotaTotal ?? 0}
                </div>
                <p className="text-xs text-zinc-600 line-clamp-2">{s.description}</p>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <Link
                    href={`/star/${s.id}/generate`}
                    className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                  >
                    开始生成 <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    href={`/star/${s.id}`}
                    className="text-xs text-zinc-500 hover:text-violet-600"
                  >
                    详情
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
