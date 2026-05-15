"use client";

import React, { useRef, useEffect } from 'react';
import { motion } from "motion/react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Progress } from "@ai-star-eco/ui/ui/progress";
import { Zap, TrendingUp, Star } from 'lucide-react';
import { ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, type Artist } from './ArtistTypes';
import { ArtistAvatar } from './_shared/ArtistAvatar';
import type { Lang } from "../../translations";

const SKILL_LABELS: Record<string, { zh: string; en: string }> = {
  vocal: { zh: '声乐', en: 'Vocal' },
  dance: { zh: '舞蹈', en: 'Dance' },
  acting: { zh: '演技', en: 'Acting' },
  variety: { zh: '综艺', en: 'Variety' },
  charm: { zh: '魅力', en: 'Charm' },
  creativity: { zh: '创作力', en: 'Creativity' },
};

// Canvas-based radar chart
const RadarCanvas = ({ artist, size = 180 }: { artist: Artist; size?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const typeConf = ARTIST_TYPE_CONFIG[artist.type];
  const skills = artist.talents;
  const keys = Object.keys(skills) as (keyof typeof skills)[];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const n = keys.length;
    const angleStep = (Math.PI * 2) / n;
    const startAngle = -Math.PI / 2;

    // Draw grid rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = (radius / 4) * ring;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = startAngle + i * angleStep;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255,255,255,${ring === 4 ? 0.08 : 0.04})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw spokes
    for (let i = 0; i < n; i++) {
      const angle = startAngle + i * angleStep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.stroke();
    }

    // Draw cap (max) shape
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const key = keys[idx];
      const cap = typeConf.talentCaps[key];
      const val = cap / 100;
      const angle = startAngle + idx * angleStep;
      const x = cx + Math.cos(angle) * radius * val;
      const y = cy + Math.sin(angle) * radius * val;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(168, 85, 247, 0.05)';
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // Draw data shape
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const key = keys[idx];
      const val = skills[key] / 100;
      const angle = startAngle + idx * angleStep;
      const x = cx + Math.cos(angle) * radius * val;
      const y = cy + Math.sin(angle) * radius * val;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Draw dots + labels
    for (let i = 0; i < n; i++) {
      const key = keys[i];
      const val = skills[key] / 100;
      const angle = startAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius * val;
      const y = cy + Math.sin(angle) * radius * val;

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();

      // Label
      const lx = cx + Math.cos(angle) * (radius + 14);
      const ly = cy + Math.sin(angle) * (radius + 14);
      ctx.fillStyle = '#888';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${skills[key]}`, lx, ly);
    }
  }, [artist, size, keys, skills, typeConf]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />;
};

interface ArtistRadarCardProps {
  lang: Lang;
  artist: Artist;
  /**
   * 艺人详情页已在 Hero 显示头像 / 姓名 / Lv / 品质，此处传 true 以避免重复。
   * 默认 false（兼容其它调用点）。
   */
  hideIdentity?: boolean;
}

export const ArtistRadarCard = ({ lang, artist, hideIdentity = false }: ArtistRadarCardProps) => {
  const zh = lang === 'zh';
  const typeConf = ARTIST_TYPE_CONFIG[artist.type];
  const skills = artist.talents;
  const keys = Object.keys(skills) as (keyof typeof skills)[];
  const avgTalent = Math.round(keys.reduce((sum, k) => sum + skills[k], 0) / keys.length);
  const maxCap = Math.round(keys.reduce((sum, k) => sum + typeConf.talentCaps[k], 0) / keys.length);
  const potential = Math.round((avgTalent / maxCap) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }}
      className="bg-gray-900/50 border border-white/5 rounded-xl p-6 overflow-hidden min-w-0">
      <div className="flex items-center justify-between mb-4 gap-2 min-w-0">
        <h3 className="text-lg font-bold tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
          {zh ? '能力雷达' : 'Ability Radar'}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-0.5"><Zap className="w-3 h-3" /> {avgTalent}</span>
          <span className="text-[10px] text-gray-600">/</span>
          <span className="text-[10px] text-purple-400 font-semibold flex items-center gap-0.5"><Star className="w-3 h-3" /> {maxCap}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 min-w-0">
        {!hideIdentity && (
          <div className="flex items-center gap-3 w-full min-w-0">
            <div className="relative shrink-0">
              <ArtistAvatar artist={artist} size={56} className="rounded-full border-2 border-cyan-500/20" />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${typeConf.bgColor} flex items-center justify-center text-[10px]`}>{typeConf.icon}</div>
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold truncate">{artist.name}</div>
              <div className="text-xs text-gray-500 truncate">Lv.{artist.level} · {artist.quality.toUpperCase()}</div>
              <Badge className={`mt-1 text-[10px] ${typeConf.bgColor} ${typeConf.color} border-0`}>
                {typeConf.icon} {zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}
              </Badge>
            </div>
          </div>
        )}

        <div className="w-full flex justify-center overflow-hidden">
          <RadarCanvas artist={artist} size={160} />
        </div>
      </div>

      {/* Talent bars */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
        {keys.map(key => {
          const val = skills[key];
          const cap = typeConf.talentCaps[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-gray-400">{zh ? SKILL_LABELS[key]?.zh : SKILL_LABELS[key]?.en}</span>
                <span className="text-[10px] text-gray-500">{val}<span className="text-gray-700">/{cap}</span></span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden relative">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(cap / 100) * 100}%` }} transition={{ delay: .3, duration: .5 }}
                  className="absolute inset-y-0 left-0 bg-purple-500/15 rounded-full" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ delay: .4, duration: .6 }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Potential */}
      <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/5 flex items-center justify-between">
        <div className="text-xs text-gray-400">{zh ? '潜力开发度' : 'Potential Utilized'}</div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${potential}%` }} transition={{ delay: .6, duration: .8 }}
              className={`h-full rounded-full ${potential > 70 ? 'bg-green-400' : potential > 40 ? 'bg-amber-400' : 'bg-red-400'}`} />
          </div>
          <span className={`text-xs font-bold ${potential > 70 ? 'text-green-400' : potential > 40 ? 'text-amber-400' : 'text-red-400'}`}>{potential}%</span>
        </div>
      </div>
    </motion.div>
  );
};
