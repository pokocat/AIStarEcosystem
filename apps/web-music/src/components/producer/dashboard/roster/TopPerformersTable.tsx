"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TopPerformersTable.tsx
// 按本月营收排序前 N 位艺人。经纪人一眼看谁在拉车。
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { motion } from "motion/react";
import type { Artist } from "@ai-star-eco/types/artist";
import { formatCredits, formatCompactNumber } from "@/lib/format";
import { ARTIST_TYPE_LABELS } from "../../ArtistTypes";
import { ArtistAvatar } from "../../_shared/ArtistAvatar";

interface Props {
  artists: Artist[];
  /** 展示多少位（默认 3） */
  topN?: number;
  onSelect?: (artist: Artist) => void;
}

export function TopPerformersTable({ artists, topN = 3, onSelect }: Props) {
  const ranked = [...artists]
    .filter(a => (a.stats?.monthlyRevenue ?? 0) > 0)
    .sort((a, b) => (b.stats?.monthlyRevenue ?? 0) - (a.stats?.monthlyRevenue ?? 0))
    .slice(0, topN);

  if (ranked.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500 font-light">
        本月暂无营收数据
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {ranked.map((a, i) => (
        <motion.button
          key={a.id}
          type="button"
          onClick={() => onSelect?.(a)}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-black/20 hover:bg-black/40 border border-white/5 hover:border-cyan-500/25 transition text-left"
        >
          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
            i === 0 ? "bg-amber-500/15 text-amber-300" :
            i === 1 ? "bg-gray-500/15 text-gray-200" :
            i === 2 ? "bg-orange-500/15 text-orange-300" :
                      "bg-white/5 text-gray-400"
          }`}>
            {i + 1}
          </span>
          <ArtistAvatar artist={a} size={32} className="rounded-full border border-white/10" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{a.name}</div>
            <div className="text-[10px] text-gray-500">
              {ARTIST_TYPE_LABELS[a.type].zh} · {formatCompactNumber(a.stats?.fans ?? 0)} 粉丝
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-amber-300 tabular-nums font-semibold">{formatCredits(a.stats?.monthlyRevenue ?? 0)}</div>
            <div className="text-[10px] text-gray-500">本月营收</div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
