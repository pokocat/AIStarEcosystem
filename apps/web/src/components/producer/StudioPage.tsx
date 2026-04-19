"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Music, Play, Pause, Loader2, ArrowRight, Sparkles,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { Lang } from "../../translations";
import {
  type Artist, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
} from "./ArtistTypes";
import type { Song } from "@/types/music";
import { SONG_STATUS_LABEL } from "@/constants/music-ui";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import { MusicApi } from "@/api";
import { AIGenerationPanel } from "./AIGenerationPanel";

interface Props {
  lang: Lang;
  activeArtist: Artist;
  /** 兼容老接口（从 OverviewPage 跳转时传入），当前 StudioPage 内部已按真实歌曲渲染，忽略此字段。 */
  selectedTrackId?: number | null;
  onClearSelection?: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  recording: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  mixing:    "bg-purple-500/10 text-purple-300 border-purple-500/30",
  released:  "bg-green-500/10 text-green-300 border-green-500/30",
};

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StudioPage({ lang, activeArtist }: Props) {
  const zh = lang === "zh";
  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];
  const workshopName = zh ? typeConf.workshop.zh : typeConf.workshop.en;
  const typeLabel = zh ? ARTIST_TYPE_LABELS[activeArtist.type].zh : ARTIST_TYPE_LABELS[activeArtist.type].en;
  const templates = zh ? typeConf.templates.zh : typeConf.templates.en;

  const [songs, setSongs] = React.useState<Song[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // 模板注入 prompt 时通过 key 重挂载 panel
  const [initialPrompt, setInitialPrompt] = React.useState<string | undefined>(undefined);
  const [panelKey, setPanelKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    MusicApi.listSongs()
      .then(list => {
        if (cancelled) return;
        setSongs(list.filter(s => s.artistId === activeArtist.id));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeArtist.id]);

  function handleCreated(song: Song) {
    setSongs(prev => [song, ...prev]);
  }

  function applyTemplate(tmpl: string) {
    setInitialPrompt(`${tmpl} · ${typeLabel} · 中文`);
    setPanelKey(k => k + 1);
  }

  function togglePlay(song: Song) {
    if (!song.audioUrl) return;
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = song.audioUrl;
    audioRef.current.play().catch(() => {/* 浏览器自动播放策略 */});
    setPlayingId(song.id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {workshopName}
          </h1>
          <p className="text-gray-400 font-light mt-1 flex items-center gap-2">
            <span className="text-lg">{typeConf.icon}</span>
            {zh ? `${typeLabel}专属创作工坊 · 与大模型对话生成数字内容` : `${typeLabel} Exclusive Workshop`}
          </p>
        </div>
        <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
          <Sparkles className="w-3 h-3 mr-1" /> AI Playground
        </Badge>
      </div>

      {/* AI Generation Panel (main event) */}
      <AIGenerationPanel
        key={panelKey}
        artistId={activeArtist.id}
        artistName={activeArtist.name}
        initialPrompt={initialPrompt}
        onCreated={handleCreated}
      />

      {/* Templates */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {zh ? "创作模板" : "Templates"}
            </h3>
            <p className="text-xs text-gray-500 font-light mt-1">
              {zh ? "点击任一模板，其关键词会注入上方对话框作为新一轮生成的起点。" : "Click a template to inject keywords into the panel above."}
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {templates.map((tmpl, i) => (
            <motion.button
              key={tmpl + i}
              onClick={() => applyTemplate(tmpl)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition text-left group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-md ${typeConf.bgColor} flex items-center justify-center shrink-0`}>
                  <span className="text-sm">{typeConf.icon}</span>
                </div>
                <span className="text-sm font-medium truncate">{tmpl}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400 transition shrink-0" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Works list */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {zh ? "作品列表" : "Works"}
            </h3>
            <p className="text-xs text-gray-500 font-light mt-1">
              {zh ? `当前歌手：${activeArtist.name} · 共 ${songs.length} 首` : `${songs.length} tracks`}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> {zh ? "载入中..." : "Loading..."}
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500">
            <Music className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm font-light">{zh ? "还没有作品。用上方对话框开始生成第一首歌。" : "No tracks yet."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {songs.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 hover:border-cyan-500/20 hover:bg-white/[0.02] transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => togglePlay(s)}
                    disabled={!s.audioUrl}
                    className="w-9 h-9 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 flex items-center justify-center transition disabled:opacity-40"
                  >
                    {playingId === s.id
                      ? <Pause className="w-4 h-4 text-cyan-300" />
                      : <Play className="w-4 h-4 text-cyan-300 ml-0.5" />
                    }
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{s.title}</div>
                    <div className="text-xs text-gray-500 font-light flex items-center gap-2 mt-0.5">
                      <span>{s.genre}</span>
                      <span>·</span>
                      <span>{fmtDuration(s.duration)}</span>
                      {s.creditsSpent != null && (
                        <>
                          <span>·</span>
                          <span>{formatCredits(s.creditsSpent)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.status === "released" && (
                    <div className="text-xs text-gray-400 font-light hidden md:block">
                      <span className="text-pink-300">{formatCompactNumber(s.plays)}</span>
                      <span className="text-gray-600"> 播放</span>
                    </div>
                  )}
                  <Badge className={`text-xs ${STATUS_BADGE[s.status] ?? ""}`}>
                    {SONG_STATUS_LABEL[s.status]}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <p className="text-xs text-gray-600 font-light text-center">
        {zh
          ? "提示：进入「音乐工坊」可查看歌曲详情、修改歌词 / 封面、推进发布状态并跳转到「全网分发」。"
          : "Tip: open Music Workshop to edit lyrics, advance status and push to distribution."}
      </p>
    </div>
  );
}
