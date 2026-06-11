"use client";

import React, { useEffect, useState, useMemo } from 'react';
import {
  Users, Plus, Search, Grid3X3, List, ChevronDown, Eye, Edit, Copy,
  Star, Music, Film, ShoppingBag, Tv, Mic, GraduationCap, Gamepad,
  X, Mic2, Video, Sparkles, Headphones, Zap, Award, TrendingUp,
  BarChart3, Heart, Crown, ArrowUpRight, Loader2, AlertCircle,
  Wand2, ArrowRight, Image as ImageIcon, Tag as TagIcon, Lock, Calendar
} from 'lucide-react';
import { Button } from "@ai-star-eco/ui/ui/button";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Progress } from "@ai-star-eco/ui/ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { Lang } from "../../translations";
import {
  type Artist, type ArtistType, type Quality,
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
  QUALITY_CONFIG, STATUS_CONFIG, TALENT_LABELS
} from './ArtistTypes';
import { ArtistsApi, AppearanceForgeApi, ApiError } from "@/api";
import type { ForgeResult, ForgeMode, AppearanceStatus } from "@ai-star-eco/types/appearance-forge";
import { DEMO_FORGE_VIDEO_POOL } from "@/lib/forge-video";
import { ArtistAvatar } from "./_shared/ArtistAvatar";
import { ImportAvatarDialog } from "./ImportAvatarDialog";
import { DapAvatarGallery } from "./_shared/DapAvatarGallery";

/* ======== Artist Detail Dialog ======== */
// 结构：左列合并身份（头像 + 名字 + 稀有度 / 状态 / 等级 + 简介 + 领域 / 日期），
// 右列展示艺人形象（AI 形象画廊：主视频 + 缩略图矩阵）。
// 其余深度数据（才艺 / 商业 / 工坊）以横向 Tab 呈现在底部，不抢占主区视觉。
/** ISO 时间 → "2026-06-10"（无效 / 缺失显示 "—"） */
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ArtistDetailDialog = ({ artist, lang, onClose, onUpdated }: { artist: Artist; lang: Lang; onClose: () => void; onUpdated?: (a: Artist) => void }) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'talents' | 'stats' | 'works' | 'commercial'>('talents');
  const [showDisplayPicker, setShowDisplayPicker] = useState(false);
  const typeConf = ARTIST_TYPE_CONFIG[artist.type];
  const qualConf = QUALITY_CONFIG[artist.quality];
  const statusConf = STATUS_CONFIG[artist.status];
  const expPct = artist.maxExp > 0 ? Math.round((artist.exp / artist.maxExp) * 100) : 0;

  const radarData = Object.entries(TALENT_LABELS).map(([key, lbl]) => ({
    subject: zh ? lbl.zh : lbl.en,
    value: artist.talents[key as keyof typeof artist.talents],
    cap: typeConf.talentCaps[key as keyof typeof artist.talents],
  }));

  const tabs = [
    { id: 'talents' as const, label: zh ? '才艺能力' : 'Talents' },
    { id: 'stats' as const, label: zh ? '数据统计' : 'Stats' },
    { id: 'works' as const, label: zh ? '专属工坊' : 'Workshop' },
    { id: 'commercial' as const, label: zh ? '商业价值' : 'Commercial' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 关闭按钮（绝对定位，不再占主区） */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-gray-400 hover:text-white transition flex items-center justify-center"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 主体：两列 */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
            {/* ── 左列：身份 + 简介 ── */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* 头像 + 名字 + 稀有度 / 类型 / 状态 */}
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <ArtistAvatar artist={artist} size={96} className={`rounded-2xl border-2 ${qualConf.border}`} />
                  <div className={`absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full ${typeConf.bgColor} flex items-center justify-center text-base border-2 border-gray-900`}>
                    {typeConf.icon}
                  </div>
                  {artist.dapAvatarId && (
                    <button
                      onClick={() => setShowDisplayPicker(true)}
                      className="mt-2 w-full text-[10px] text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400/50 rounded-md py-1 transition flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> 更换展示图
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {artist.name}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <Badge className={`text-[10px] ${qualConf.color} ${qualConf.bg} ${qualConf.border} border`}>
                      {zh ? qualConf.zh : qualConf.en}
                    </Badge>
                    <span className={`text-[11px] ${typeConf.color}`}>
                      {zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <div className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                      {zh ? statusConf.zh : statusConf.en}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 shrink-0">Lv.</span>
                    <span className="text-sm font-bold text-cyan-300 shrink-0" style={{ fontFamily: "var(--font-display)" }}>
                      {artist.level}
                    </span>
                    <div className="flex-1 min-w-0"><Progress value={expPct} className="h-1.5" /></div>
                    <span className="text-[10px] text-gray-500 tabular-nums shrink-0">{artist.exp}/{artist.maxExp}</span>
                  </div>
                </div>
              </div>

              {/* 简介 */}
              <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{zh ? '简介' : 'Bio'}</div>
                <p className="text-sm text-gray-200 leading-relaxed">{artist.bio || (zh ? '该艺人尚未填写简介。' : 'No bio yet.')}</p>
              </div>

              {/* 领域 */}
              {artist.domains.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{zh ? '活跃领域' : 'Active Domains'}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {artist.domains.map(d => (
                      <Badge key={d} className="text-[10px] bg-white/[0.06] text-gray-200 border-0">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 日期 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                  <div className="text-[10px] text-gray-500 mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{zh ? '创建' : 'Created'}
                  </div>
                  <div className="text-xs font-semibold text-gray-200 tabular-nums">{fmtDate(artist.createdAt)}</div>
                </div>
                <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                  <div className="text-[10px] text-gray-500 mb-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />{zh ? '最后活跃' : 'Last Active'}
                  </div>
                  <div className="text-xs font-semibold text-gray-200 tabular-nums">{fmtDate(artist.lastActive)}</div>
                </div>
              </div>
            </div>

            {/* ── 右列：AI 形象画廊 ── */}
            <div className="lg:col-span-3">
              {artist.dapAvatarId ? (
                <DapAvatarGallery artist={artist} onUpdated={onUpdated} />
              ) : (
                <ArtistAppearanceShowcase artist={artist} />
              )}
            </div>
          </div>

          {/* ── 底部：深度数据 Tab ── */}
          <div className="border-t border-white/5">
            <div className="flex border-b border-white/5 px-6">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-3 text-sm transition relative ${tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t.label}
                  {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
                </button>
              ))}
            </div>
            <div className="p-6">
              {tab === 'talents' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                        <PolarGrid stroke="rgba(255,255,255,0.08)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 11 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Value" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
                        <Radar name="Cap" dataKey="cap" stroke="#a855f7" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(TALENT_LABELS).map(([key, lbl]) => {
                      const val = artist.talents[key as keyof typeof artist.talents];
                      const cap = typeConf.talentCaps[key as keyof typeof artist.talents];
                      const isPrimary = typeConf.primaryTalents.includes(key as keyof typeof TALENT_LABELS);
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400 flex items-center gap-1.5">
                              {zh ? lbl.zh : lbl.en}
                              {isPrimary && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                            </span>
                            <span className="font-semibold" style={{ color: lbl.color }}>{val}<span className="text-gray-600">/{cap}</span></span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
                            <div className="h-full rounded-full" style={{ width: `${val}%`, background: lbl.color }} />
                            <div className="absolute top-0 h-full w-px bg-white/30" style={{ left: `${cap}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === 'stats' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label: zh ? '歌曲' : 'Songs', value: artist.stats.songs, icon: Music, color: 'text-cyan-400' },
                      { label: zh ? '影视' : 'Dramas', value: artist.stats.dramas, icon: Film, color: 'text-purple-400' },
                      { label: zh ? '广告' : 'Ads', value: artist.stats.ads, icon: ShoppingBag, color: 'text-pink-400' },
                      { label: zh ? '综艺' : 'Shows', value: artist.stats.variety, icon: Tv, color: 'text-amber-400' },
                      { label: zh ? '粉丝' : 'Fans', value: formatCompactNumber(artist.stats.fans), icon: Heart, color: 'text-red-400' },
                      { label: zh ? '人气值' : 'Popularity', value: artist.stats.popularity, icon: TrendingUp, color: 'text-green-400' },
                    ].map((s, i) => (
                      <div key={i} className="bg-black/30 rounded-lg p-3 border border-white/5 text-center">
                        <s.icon className={`w-4 h-4 mx-auto mb-1.5 ${s.color} opacity-60`} />
                        <div className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
                        <div className="text-[10px] text-gray-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                    <div className="text-xs text-gray-500 mb-2">{zh ? '总收益' : 'Total Revenue'}</div>
                    <div className="text-2xl font-bold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>{formatCredits(artist.stats.revenue)}</div>
                    <div className="text-xs text-gray-500 mt-1">{zh ? '月均' : 'Monthly'}: {formatCredits(artist.stats.monthlyRevenue)}</div>
                  </div>
                </div>
              )}

              {tab === 'works' && (
                <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{typeConf.icon}</span>
                    <h4 className="font-bold">{zh ? typeConf.workshop.zh : typeConf.workshop.en}</h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{zh ? '该艺人类型的专属创作工坊和内容模板' : 'Exclusive workshop and content templates for this artist type'}</p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-2">{zh ? '可用模板' : 'Templates'}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(zh ? typeConf.templates.zh : typeConf.templates.en).map(t => (
                          <Badge key={t} className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">{zh ? '内容格式' : 'Content Formats'}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(zh ? typeConf.contentFormats.zh : typeConf.contentFormats.en).map(f => (
                          <Badge key={f} className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">{f}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">{zh ? '主要领域' : 'Primary Domains'}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(zh ? typeConf.primaryDomains.zh : typeConf.primaryDomains.en).map(d => (
                          <Badge key={d} className="text-[10px] bg-pink-500/10 text-pink-400 border-pink-500/20">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'commercial' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">{zh ? '商业价值' : 'Commercial Value'}</div>
                      <div className="text-2xl font-bold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>¥{formatCompactNumber(artist.commercialValue)}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">{zh ? '代言数' : 'Endorsements'}</div>
                      <div className="text-2xl font-bold text-pink-400" style={{ fontFamily: "var(--font-display)" }}>{artist.endorsements}</div>
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                    <div className="text-xs text-gray-500 mb-3">{zh ? '变现路径' : 'Monetization Paths'}</div>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                      {(zh ? typeConf.monetization.zh : typeConf.monetization.en).map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                          <span className="text-gray-300">{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      <ImportAvatarDialog
        open={showDisplayPicker}
        onClose={() => setShowDisplayPicker(false)}
        existingArtist={artist}
        onUpdated={(a) => onUpdated?.(a)}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ArtistAppearanceShowcase — 艺人形象（只读）：主视频 + 缩略图矩阵。
// 数据源 AppearanceForgeApi.listForgeHistory(artist.id)；mock 下回落 MOCK_APPEARANCES。
// 艺人卡片弹窗专用的轻量版本：不含 3D 旋转 / 不含 BioColumn（身份信息在左列）。
// ─────────────────────────────────────────────────────────────────────────────
const APP_MODE_LABEL: Record<ForgeMode, string> = {
  template_photo: "模版 + 照片",
  prompt_only: "文本指令",
  template_prompt: "模版 + 文本",
  random: "随机",
};

const APP_STATUS_META: Record<AppearanceStatus, { label: string; cls: string }> = {
  draft:    { label: "草稿",   cls: "bg-gray-500/15 text-gray-300 border-gray-500/25" },
  official: { label: "官方形象", cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  listed:   { label: "已上架",  cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  sold:     { label: "已售出",  cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
};

function pickShowcaseVideo(appearance: ForgeResult): string {
  if (appearance.videoUrl) return appearance.videoUrl;
  const id = appearance.id;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return DEMO_FORGE_VIDEO_POOL[Math.abs(h) % DEMO_FORGE_VIDEO_POOL.length];
}

function fmtAppearanceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ArtistAppearanceShowcase({ artist }: { artist: Artist }) {
  const [items, setItems] = useState<ForgeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    AppearanceForgeApi.listForgeHistory(artist.id)
      .then(list => {
        if (cancelled) return;
        setItems(list);
        const official = list.find(a => a.status === "official");
        setSelectedId(official?.id ?? artist.officialAppearanceId ?? list[0]?.id ?? null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [artist.id, artist.officialAppearanceId]);

  const selected = useMemo(
    () => items.find(a => a.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const counts = useMemo(() => {
    const by: Record<AppearanceStatus, number> = { draft: 0, official: 0, listed: 0, sold: 0 };
    for (const a of items) if (a.status) by[a.status]++;
    return by;
  }, [items]);

  const meta = selected ? APP_STATUS_META[selected.status ?? "draft"] : null;

  return (
    <div className="h-full flex flex-col gap-3 bg-black/30 rounded-xl border border-white/10 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>AI 形象画廊</h3>
            <p className="text-[10px] text-gray-500 font-light">
              共 {items.length} 张 · 官方 {counts.official} · 草稿 {counts.draft} · 已上架 {counts.listed} · 已售出 {counts.sold}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-gray-500 font-light hidden md:inline">只读 · 生成请前往锻造炉</span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[320px] rounded-lg bg-white/[0.03] border border-white/5">
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[320px] rounded-lg bg-white/[0.03] border border-white/5 text-center py-8">
          <ImageIcon className="w-7 h-7 text-gray-600 mb-2" />
          <div className="text-sm text-gray-300 mb-1">还没有生成过形象</div>
          <div className="text-xs text-gray-500 font-light">前往 AI 形象锻造炉生成第一张形象</div>
        </div>
      ) : selected && meta ? (
        <>
          {/* 主视频 */}
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-black/60 border border-white/10">
            <video
              key={selected.id}
              src={pickShowcaseVideo(selected)}
              poster={selected.image}
              autoPlay loop muted playsInline preload="metadata"
              className="w-full h-full object-cover bg-black"
            />
            {/* 左上：状态 / 模式徽章 */}
            <div className="absolute top-2 left-2 flex gap-1.5 z-10">
              <Badge className={`${meta.cls} text-[10px] border`}>{meta.label}</Badge>
              <Badge className="bg-black/55 text-gray-200 border-white/10 text-[10px] border">
                {APP_MODE_LABEL[selected.mode]}
              </Badge>
            </div>
            {/* 右上：使用次数 */}
            {(selected.usageCount ?? 0) > 0 && (
              <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-cyan-200">
                已使用 {selected.usageCount}
              </div>
            )}
            {/* 底部渐变：prompt / 锁定 / 日期 / marketplace */}
            <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0 space-y-1.5">
              <p className="text-xs text-gray-200 leading-snug line-clamp-2">{selected.prompt}</p>
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex items-center gap-2">
                  <span>{fmtAppearanceDate(selected.createdAt)}</span>
                  {selected.locked.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />锁定 {selected.locked.length}
                    </span>
                  )}
                </div>
                {selected.marketplace && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <TagIcon className="w-3 h-3" />
                    <span className="font-semibold tabular-nums">{formatCredits(selected.marketplace.price)}</span>
                    <span className="text-gray-500">· 售 {formatCompactNumber(selected.marketplace.soldCount)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 缩略图矩阵 */}
          <div>
            <div className="text-[10px] text-gray-500 font-light mb-1.5">历史形象（{items.length}）· 点击切换</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1
              [&::-webkit-scrollbar]:h-1
              [&::-webkit-scrollbar-thumb]:bg-white/10
              [&::-webkit-scrollbar-thumb]:rounded-full">
              {items.map(a => {
                const active = a.id === selected.id;
                const s = a.status ?? "draft";
                const sm = APP_STATUS_META[s];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`group relative shrink-0 w-16 aspect-[3/4] rounded-md overflow-hidden border transition ${
                      active
                        ? "border-cyan-400/70 ring-2 ring-cyan-400/40"
                        : "border-white/10 hover:border-cyan-500/40"
                    }`}
                    title={a.prompt}
                  >
                    <img src={a.thumbnail ?? a.image} alt={a.prompt} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    {s !== "draft" && (
                      <div className="absolute top-0.5 left-0.5">
                        <span className={`px-1 py-px rounded text-[8px] border leading-tight ${sm.cls}`}>{sm.label}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ======== Main MCN Matrix Component ======== */
export const MCNMatrix = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [showImport, setShowImport] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ArtistType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'level' | 'revenue'>('level');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    ArtistsApi.listArtists()
      .then(list => {
        if (!cancelled) setArtists(list);
      })
      .catch(err => {
        if (cancelled) return;
        const msg = err instanceof ApiError
          ? `${err.message}（${err.code}）`
          : err instanceof Error ? err.message : String(err);
        setLoadError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = [...artists];
    if (searchQuery) list = list.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (typeFilter !== 'all') list = list.filter(a => a.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'level') return b.level - a.level;
      return b.stats.revenue - a.stats.revenue;
    });
    return list;
  }, [artists, searchQuery, typeFilter, statusFilter, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: artists.length };
    artists.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return counts;
  }, [artists]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {zh ? 'AI 艺人孵化矩阵' : 'AI Artist Matrix'}
          </h1>
          <p className="text-gray-400 font-light mt-1">{zh ? '管理你的AI艺人生态' : 'Manage your AI artist ecosystem'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowImport(true)} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2">
            <Plus className="w-4 h-4" /> 从 AiAvatar 引入数字人
          </Button>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 text-xs rounded-full border transition ${typeFilter === 'all' ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
          {zh ? '全部' : 'All'} ({typeCounts.all})
        </button>
        {(Object.keys(ARTIST_TYPE_LABELS) as ArtistType[]).map(type => (
          <button key={type} onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 text-xs rounded-full border transition flex items-center gap-1 ${typeFilter === type ? `${ARTIST_TYPE_CONFIG[type].bgColor} ${ARTIST_TYPE_CONFIG[type].color} ${ARTIST_TYPE_CONFIG[type].borderColor}` : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
            {ARTIST_TYPE_CONFIG[type].icon} {zh ? ARTIST_TYPE_LABELS[type].zh : ARTIST_TYPE_LABELS[type].en}
            {typeCounts[type] ? ` (${typeCounts[type]})` : ''}
          </button>
        ))}
      </div>

      {/* Search + Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none transition"
            placeholder={zh ? '搜索艺人...' : 'Search artists...'} />
        </div>
        <div className="flex gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'level' | 'revenue')}
            className="bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400 focus:outline-none">
            <option value="level">{zh ? '按等级' : 'By Level'}</option>
            <option value="name">{zh ? '按名称' : 'By Name'}</option>
            <option value="revenue">{zh ? '按收益' : 'By Revenue'}</option>
          </select>
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`px-3 py-2 transition ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500'}`}><Grid3X3 className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-2 transition ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {zh ? '正在加载艺人...' : 'Loading artists...'}
        </div>
      )}
      {!loading && loadError && (
        <div className="flex items-center justify-center gap-2 py-16 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {zh ? `加载失败：${loadError}` : `Load failed: ${loadError}`}
        </div>
      )}
      {!loading && !loadError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 text-sm">
          <Users className="w-8 h-8 mb-3 opacity-50" />
          {artists.length === 0
            ? '还没有艺人 — 点击右上角从 AiAvatar 引入数字人'
            : (zh ? '当前筛选下没有匹配的艺人' : 'No artists match the current filter')}
        </div>
      )}

      {/* Grid View */}
      {!loading && !loadError && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((artist, i) => {
            const typeConf = ARTIST_TYPE_CONFIG[artist.type];
            const qualConf = QUALITY_CONFIG[artist.quality];
            const statusConf = STATUS_CONFIG[artist.status];
            return (
              <motion.div key={artist.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
                onClick={() => setSelectedArtist(artist)}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-5 hover:border-cyan-500/20 transition cursor-pointer group relative overflow-hidden">
                {/* Quality glow */}
                {artist.quality === 'legendary' && <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl" />}
                {artist.quality === 'epic' && <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full blur-xl" />}

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <ArtistAvatar artist={artist} size={48} className={`rounded-full border-2 ${qualConf.border}`} />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${typeConf.bgColor} flex items-center justify-center text-[10px]`}>{typeConf.icon}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white truncate">{artist.name}</span>
                      <Badge className={`text-[10px] ${qualConf.color} ${qualConf.bg} border-0 px-1.5`}>{zh ? qualConf.zh : qualConf.en}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${typeConf.color}`}>{zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500"><div className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />{zh ? statusConf.zh : statusConf.en}</span>
                    </div>
                  </div>
                </div>

                {/* Level bar */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-cyan-400 font-bold" style={{ fontFamily: "var(--font-display)" }}>Lv.{artist.level}</span>
                  <div className="flex-1"><Progress value={(artist.exp / artist.maxExp) * 100} className="h-1.5" /></div>
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center bg-black/20 rounded-lg py-2">
                    <div className="text-sm font-bold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>{formatCompactNumber(artist.stats.fans)}</div>
                    <div className="text-[10px] text-gray-500">{zh ? '粉丝' : 'Fans'}</div>
                  </div>
                  <div className="text-center bg-black/20 rounded-lg py-2">
                    <div className="text-sm font-bold text-purple-400" style={{ fontFamily: "var(--font-display)" }}>{artist.stats.songs + artist.stats.dramas + artist.stats.ads + artist.stats.variety}</div>
                    <div className="text-[10px] text-gray-500">{zh ? '作品' : 'Works'}</div>
                  </div>
                  <div className="text-center bg-black/20 rounded-lg py-2">
                    <div className="text-sm font-bold text-pink-400" style={{ fontFamily: "var(--font-display)" }}>{formatCredits(artist.stats.monthlyRevenue)}</div>
                    <div className="text-[10px] text-gray-500">{zh ? '月收' : 'Monthly'}</div>
                  </div>
                </div>

                {/* Talent bars — top 3 */}
                <div className="space-y-1.5">
                  {Object.entries(artist.talents)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([key, val]) => {
                      const lbl = TALENT_LABELS[key as keyof typeof TALENT_LABELS];
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 w-10 shrink-0">{zh ? lbl.zh : lbl.en}</span>
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${val}%`, background: lbl.color }} />
                          </div>
                          <span className="text-[10px] font-semibold w-6 text-right" style={{ color: lbl.color }}>{val}</span>
                        </div>
                      );
                    })}
                </div>

                {/* Hover action hint */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition">
                  <Eye className="w-4 h-4 text-cyan-400" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!loading && !loadError && filtered.length > 0 && viewMode === 'list' && (
        <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {[zh ? '艺人' : 'Artist', zh ? '类型' : 'Type', zh ? '等级' : 'Level', zh ? '品质' : 'Quality', zh ? '状态' : 'Status', zh ? '粉丝' : 'Fans', zh ? '月收益' : 'Monthly', ''].map((h, i) => (
                  <th key={i} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((artist, i) => {
                const typeConf = ARTIST_TYPE_CONFIG[artist.type];
                const qualConf = QUALITY_CONFIG[artist.quality];
                const statusConf = STATUS_CONFIG[artist.status];
                return (
                  <motion.tr key={artist.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .03 }}
                    onClick={() => setSelectedArtist(artist)}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ArtistAvatar artist={artist} size={32} className="rounded-full border border-white/10" />
                        <span className="text-sm font-semibold">{artist.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs ${typeConf.color}`}>{typeConf.icon} {zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}</span></td>
                    <td className="px-4 py-3"><span className="text-sm font-bold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>Lv.{artist.level}</span></td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] ${qualConf.color} ${qualConf.bg} border-0`}>{zh ? qualConf.zh : qualConf.en}</Badge></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs"><div className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />{zh ? statusConf.zh : statusConf.en}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatCompactNumber(artist.stats.fans)}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatCredits(artist.stats.monthlyRevenue)}</td>
                    <td className="px-4 py-3"><Eye className="w-4 h-4 text-gray-500 hover:text-cyan-400 transition" /></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-400">{zh ? '暂无匹配艺人' : 'No Artists Found'}</h3>
          <p className="text-sm text-gray-500 mt-1">{zh ? '尝试调整筛选条件' : 'Try adjusting your filters'}</p>
        </div>
      )}

      {/* Detail Dialog — 立即挂载/卸载，避免 AnimatePresence+layoutId 残留遮罩导致全页无法点击 */}
      {selectedArtist && (
        <ArtistDetailDialog
          artist={selectedArtist}
          lang={lang}
          onClose={() => setSelectedArtist(null)}
          onUpdated={(a) => {
            setArtists((prev) => prev.map((x) => (x.id === a.id ? a : x)));
            setSelectedArtist(a);
          }}
        />
      )}

      {/* 从 AiAvatar 引入数字人（v0.60 收敛：取代本地孵化/锻造） */}
      <ImportAvatarDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        defaultType="singer"
        importedAvatarIds={artists.filter((a) => a.type === "singer" && a.dapAvatarId).map((a) => String(a.dapAvatarId))}
        onImported={(a) => setArtists((prev) => [a, ...prev])}
      />
    </div>
  );
};
