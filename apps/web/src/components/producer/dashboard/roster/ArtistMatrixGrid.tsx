"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ArtistMatrixGrid.tsx
// 经纪大盘"旗下艺人矩阵"：每位签约艺人一张小卡，点击切换 activeArtist。
// PR 3 接入艺人视图后，可追加"→ 进入艺人视图"的跳转。
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { motion } from "motion/react";
import { Badge } from "../../../ui/badge";
import type { Artist } from "@/types/artist";
import { ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS } from "../../ArtistTypes";
import { STATUS_CONFIG } from "@/constants/artist-config";
import { formatCompactNumber, formatCredits } from "@/lib/format";

interface Props {
  artists: Artist[];
  activeArtistId?: string;
  onSelect: (artist: Artist) => void;
}

export function ArtistMatrixGrid({ artists, activeArtistId, onSelect }: Props) {
  if (artists.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-500 font-light">
        暂无签约艺人 — 去「MCN与孵化」创建或邀请
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {artists.map((a, i) => {
        const typeConf = ARTIST_TYPE_CONFIG[a.type];
        const status = STATUS_CONFIG[a.status];
        const isActive = a.id === activeArtistId;
        return (
          <motion.button
            key={a.id}
            type="button"
            onClick={() => onSelect(a)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`text-left rounded-xl p-3 border transition bg-gray-900/60 hover:bg-gray-900/80 ${
              isActive ? "border-cyan-500/40 shadow-[0_0_0_1px_rgba(6,182,212,0.35)]" : "border-white/5 hover:border-white/15"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={a.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${typeConf.bgColor} flex items-center justify-center text-[8px]`}
                  aria-hidden
                >
                  {typeConf.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{a.name}</div>
                <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                  {ARTIST_TYPE_LABELS[a.type].zh}
                  <span className="text-cyan-400">Lv.{a.level}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <Badge className={`text-[10px] border-0 ${status.color} bg-white/[0.06]`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
                {status.label}
              </Badge>
              <span className="text-gray-400 tabular-nums">{formatCompactNumber(a.stats?.fans ?? 0)} 粉丝</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
              <span>本月</span>
              <span className="text-amber-300 tabular-nums">{formatCredits(a.stats?.monthlyRevenue ?? 0)}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
