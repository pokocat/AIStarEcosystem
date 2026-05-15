"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ArtistOverview.tsx — 艺人视图（聚焦单位艺人）
//
// 经纪人在这里看一位 AI 艺人的完整画像：
//   - Hero：头像 / 姓名 / 类型 / Lv 进度 / 状态 / 稀有度 / Bio / 艺人切换下拉
//   - AppearanceGallery：AI 形象画廊（只读，突出商业化入口；所有写操作跳转锻造炉）
//   - 能力雷达（复用 ArtistRadarCard）
//   - 个人 KPI（本月营收 / 粉丝 / 人气 / 代言数）
//   - 孵化参数（bio + incubationParams + domains）
//   - 造型 / 音乐 两张快照卡（只读 + CTA 跳转深度页）
//   - 快捷工作流入口
//   - 个人动态时间线（从 ActivityFeed mock 按 artist.name 过滤）
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { motion } from "motion/react";
import {
  ChevronDown, TrendingUp, Users, Flame, Handshake, Music, Shirt, Sparkles,
  Globe as GlobeIcon, Heart, Wallet, Wand2, ChevronRight, Calendar,
} from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Progress } from "@ai-star-eco/ui/ui/progress";
import type { Artist } from "@ai-star-eco/types/artist";
import type { Song } from "@ai-star-eco/types/music";
import {
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
} from "../ArtistTypes";
import { QUALITY_CONFIG, STATUS_CONFIG } from "@/constants/artist-config";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";
import { formatCredits, formatCompactNumber, formatDuration } from "@/lib/format";
import { ArtistRadarCard } from "../ArtistRadarCard";
import { AppearanceGallery } from "./artist/AppearanceGallery";
import { ArtistAvatar } from "../_shared/ArtistAvatar";

interface Props {
  artist: Artist;
  artists: Artist[];
  songs: Song[];
  onSelectArtist: (a: Artist) => void;
  onNavigate: (page: string) => void;
}

const SONG_STATUS_LABEL: Record<Song["status"], { label: string; tone: string }> = {
  recording: { label: "录制中", tone: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  mixing:    { label: "混音中", tone: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  released:  { label: "已发行", tone: "bg-green-500/10 text-green-400 border-green-500/20" },
};

export function ArtistOverview({ artist, artists, songs, onSelectArtist, onNavigate }: Props) {
  const typeConf = ARTIST_TYPE_CONFIG[artist.type];
  const quality = QUALITY_CONFIG[artist.quality];
  const status = STATUS_CONFIG[artist.status];
  const expPct = artist.maxExp > 0 ? Math.round((artist.exp / artist.maxExp) * 100) : 0;

  // Artist-scoped 数据
  const artistSongs = songs
    .filter(s => s.artistId === artist.id)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const releasedCount = artistSongs.filter(s => s.status === "released").length;
  const topSongs = artistSongs.slice(0, 4);

  // 从 incubationParams 抽几个"面向经纪人"的关键字段做孵化快照；未知字段不展示。
  const incubation: Record<string, string> = {};
  if (artist.incubationParams) {
    const p = artist.incubationParams as Record<string, unknown>;
    const pick = (k: string, label: string, max?: number) => {
      const v = p[k];
      if (v == null || v === "") return;
      const raw = Array.isArray(v)
        ? v.filter(x => x !== null && x !== undefined && x !== "").map(String).join("、")
        : String(v);
      if (!raw) return;
      incubation[label] = typeof max === "number" && raw.length > max ? `${raw.slice(0, max)}…` : raw;
    };
    pick("faceStyle",    "面孔风格");
    pick("fashionStyle", "时尚风格");
    pick("age",          "视觉年龄");
    pick("height",       "身高");
    pick("generation",   "世代");
    pick("mbti",         "MBTI");
    pick("personaTags",  "人设标签");
    pick("sweetness",    "甜度");
    pick("energy",       "能量");
    pick("mystery",      "神秘感");
    pick("confidence",   "自信度");
    pick("vocalRange",   "音域");
    pick("musicGenres",  "主打曲风");
    pick("danceStyles",  "主打舞种");
    pick("fandomName",   "粉丝称号");
    pick("backstory",    "背景故事", 40);
  }

  // 衣橱快照：取 rare/epic/legendary 的前 4 件做"经典穿搭"占位
  const wardrobeSamples = CLOTHING_DATABASE
    .filter(c => c.rarity !== "common")
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* ── 顶部双列：左侧合并身份（头像 + 姓名 + 简介 + 领域 + 日期），右侧 AI 形象画廊 ── */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* 左：身份 + 简介 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-gray-900/80 p-6 flex flex-col gap-4"
        >
          <div className={`absolute inset-0 opacity-40 pointer-events-none bg-gradient-to-br ${typeConf.bgColor}`} />

          {/* 头像 + 名字 + 徽章 */}
          <div className="relative flex items-start gap-4">
            <div className="relative shrink-0">
              <ArtistAvatar artist={artist} size={96} className="rounded-2xl border-2 border-white/10" />
              <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${typeConf.bgColor} ${typeConf.color}`}>
                {typeConf.icon} {ARTIST_TYPE_LABELS[artist.type].zh}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                {artist.name}
              </h1>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <Badge className={`${quality.bg} ${quality.color} border ${quality.border} text-[10px]`}>
                  {quality.label}
                </Badge>
                <Badge className={`${status.color} bg-white/[0.06] border-0 text-[10px]`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
                  {status.label}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-gray-500 shrink-0">Lv.</span>
                <span className="text-sm font-bold text-cyan-300 shrink-0">{artist.level}</span>
                <div className="flex-1 min-w-0"><Progress value={expPct} className="h-1.5" /></div>
                <span className="text-[10px] text-gray-500 tabular-nums shrink-0">{artist.exp}/{artist.maxExp}</span>
              </div>
            </div>
          </div>

          {/* 艺人切换器 */}
          <div className="relative">
            <select
              aria-label="切换艺人"
              value={artist.id}
              onChange={(e) => {
                const next = artists.find(a => a.id === e.target.value);
                if (next) onSelectArtist(next);
              }}
              className="w-full appearance-none bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg pl-3 pr-9 py-2 text-sm text-gray-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            >
              {artists.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* 简介 */}
          <div className="relative bg-black/30 rounded-xl p-4 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">简介</div>
            <p className="text-sm text-gray-200 leading-relaxed">
              {artist.bio || "该艺人尚未填写简介。可在「AI 艺人孵化」向导里补充。"}
            </p>
          </div>

          {/* 领域 */}
          {artist.domains?.length ? (
            <div className="relative">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">活跃领域</div>
              <div className="flex flex-wrap gap-1.5">
                {artist.domains.map(d => (
                  <Badge key={d} className="text-[10px] bg-white/[0.06] text-gray-200 border-0">{d}</Badge>
                ))}
              </div>
            </div>
          ) : null}

          {/* 日期 */}
          <div className="relative grid grid-cols-2 gap-2">
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] text-gray-500 mb-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />创建
              </div>
              <div className="text-xs font-semibold text-gray-200 tabular-nums">{artist.createdAt}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] text-gray-500 mb-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />最后活跃
              </div>
              <div className="text-xs font-semibold text-gray-200 tabular-nums">{artist.lastActive}</div>
            </div>
          </div>

          {/* 造型 / 道具（原底部 2 列的衣橱快照上移至此） */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5 text-purple-400" />
                <h3 className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>造型 / 道具</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("wardrobe")} className="h-auto p-1 text-cyan-400 hover:bg-cyan-500/10 text-[10px]">
                前往衣橱 <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {wardrobeSamples.map(w => (
                <div key={w.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/5 group">
                  <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/85 to-transparent">
                    <div className="text-[9px] text-white font-medium truncate leading-tight">{w.name}</div>
                  </div>
                  <div className="absolute top-1 right-1 text-[8px] px-1 py-px rounded-full bg-black/60 text-amber-300 uppercase">
                    {w.rarity}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 font-light mt-2">精选收藏品（按稀有度）</p>
          </div>
        </motion.div>

        {/* 右：AI 形象画廊（compact：不重复展示简介，hero + 缩略条占主视觉） */}
        <div className="lg:col-span-3">
          <AppearanceGallery artist={artist} onGoToForge={() => onNavigate("appearance")} variant="compact" />
        </div>
      </div>

      {/* 雷达 + 个人 KPI + 孵化参数 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <ArtistRadarCard lang="zh" artist={artist} hideIdentity />

        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>个人数据</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: TrendingUp, label: "本月营收", value: formatCredits(artist.stats?.monthlyRevenue ?? 0), color: "text-amber-300", bg: "bg-amber-500/10" },
              { icon: Users,      label: "粉丝",     value: formatCompactNumber(artist.stats?.fans ?? 0),    color: "text-green-300", bg: "bg-green-500/10" },
              { icon: Flame,      label: "人气值",   value: `${artist.stats?.popularity ?? 0}`,              color: "text-pink-300",  bg: "bg-pink-500/10" },
              { icon: Handshake,  label: "代言数",   value: `${artist.endorsements ?? 0}`,                    color: "text-cyan-300",  bg: "bg-cyan-500/10" },
            ].map(s => (
              <div key={s.label} className="bg-black/20 border border-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-6 h-6 rounded ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-3 h-3 ${s.color}`} />
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</span>
                </div>
                <div className="text-lg font-bold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-bold tabular-nums text-cyan-300">{releasedCount}</div>
              <div className="text-[10px] text-gray-500">已发行歌曲</div>
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums text-purple-300">{artist.stats?.dramas ?? 0}</div>
              <div className="text-[10px] text-gray-500">参演剧集</div>
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums text-pink-300">{artist.stats?.variety ?? 0}</div>
              <div className="text-[10px] text-gray-500">综艺节目</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>孵化参数</h3>
          {artist.domains?.length ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {artist.domains.map(d => (
                <Badge key={d} className="text-[10px] bg-white/[0.06] text-gray-200 border-0">{d}</Badge>
              ))}
            </div>
          ) : null}
          {Object.keys(incubation).length === 0 ? (
            <p className="text-xs text-gray-500 font-light">该艺人没有写入孵化参数。可在「AI 艺人孵化」向导重新配置。</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {Object.entries(incubation).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 min-w-0">
                  <dt className="text-gray-500 shrink-0">{k}</dt>
                  <dd className="text-gray-200 truncate" title={v}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <Button
            variant="ghost" size="sm" onClick={() => onNavigate("incubator")}
            className="mt-4 w-full justify-between text-cyan-400 hover:bg-cyan-500/10 text-xs"
          >
            调整孵化参数 <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* 音乐作品（造型 / 道具已上移至左侧身份列） */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
        className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>音乐作品</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("studio")} className="text-cyan-400 hover:bg-cyan-500/10 text-xs">
              进入工坊 <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          {topSongs.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500 font-light">
              暂无作品，去「创作工坊」生成第一首歌曲
            </div>
          ) : (
            <div className="space-y-2">
              {topSongs.map(song => {
                const meta = SONG_STATUS_LABEL[song.status];
                return (
                  <div key={song.id} className="flex items-center gap-3 p-2 rounded-lg bg-black/20 border border-white/5">
                    {song.coverUrl
                      ? <img src={song.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                      : <div className="w-10 h-10 rounded bg-cyan-500/10 flex items-center justify-center"><Music className="w-4 h-4 text-cyan-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{song.title}</div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                        <span>{song.genre}</span>·
                        <span>{formatDuration(song.duration)}</span>
                        {song.status === "released" && <>· <span>{formatCompactNumber(song.plays)} 播放</span></>}
                      </div>
                    </div>
                    <Badge className={`text-[10px] font-medium ${meta.tone}`}>{meta.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
      </motion.div>

      {/* 快捷入口 */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { id: "studio",       icon: Wand2,      label: typeConf.workshop.zh, color: "text-cyan-300" },
            { id: "appearance",   icon: Sparkles,   label: "AI 形象锻造",         color: "text-purple-300" },
            { id: "wardrobe",     icon: Shirt,      label: "造型与道具",          color: "text-pink-300" },
            { id: "distribution", icon: GlobeIcon,  label: "全网分发",            color: "text-amber-300" },
            { id: "community",    icon: Heart,      label: "粉丝社群",            color: "text-red-300" },
          ].map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => onNavigate(a.id)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/25 transition text-left"
            >
              <a.icon className={`w-4 h-4 ${a.color}`} />
              <span className="text-xs text-gray-200 font-medium truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 后续动态：先不塞 ActivityFeed（其数据模型为全局动态，过滤会显得稀疏）。
          待后端 /api/me/digital-ips/:id/timeline 上线后在此渲染 artist-scoped 时间线。 */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <h3 className="text-lg font-bold tracking-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>近期里程碑</h3>
        <p className="text-xs text-gray-500 font-light mb-4">本艺人动态（占位）— 后端上线后接入 /me/digital-ips/:id/timeline</p>
        <div className="text-xs text-gray-500 text-center py-6">
          <Wallet className="w-5 h-5 mx-auto mb-2 text-gray-600" />
          等待时间线数据接入
        </div>
      </div>
    </div>
  );
}
