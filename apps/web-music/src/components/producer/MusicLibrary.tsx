"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Music, Play, Pause, Loader2, Volume2, VolumeX,
  SkipBack, SkipForward, Disc3,
} from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import type { Song } from "@ai-star-eco/types/music";
import { SONG_STATUS_LABEL, previewAudioForId } from "@/constants/music-ui";
import { formatCompactNumber, formatCredits } from "@/lib/format";

interface Props {
  songs: Song[];
  loading: boolean;
  artistName: string;
  artistAvatar?: string;
}

const STATUS_BADGE: Record<string, string> = {
  recording: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  mixing:    "bg-purple-500/10 text-purple-300 border-purple-500/30",
  released:  "bg-green-500/10 text-green-300 border-green-500/30",
};

function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicLibrary({ songs, loading, artistName, artistAvatar }: Props) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);       // 0..1
  const [elapsed, setElapsed] = React.useState(0);
  const [totalSec, setTotalSec] = React.useState(0);
  const [volume, setVolume] = React.useState(0.8);
  const [muted, setMuted] = React.useState(false);
  const [loadingSrc, setLoadingSrc] = React.useState(false);

  const current = React.useMemo(
    () => songs.find(s => s.id === currentId) ?? null,
    [songs, currentId],
  );

  // 初始化 <audio>。React 18 StrictMode 下会跑两次，所以用 ref 惰性创建。
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => {
      const d = audio.duration;
      setElapsed(audio.currentTime);
      setProgress(d > 0 ? audio.currentTime / d : 0);
    };
    const onMeta = () => setTotalSec(audio.duration || 0);
    const onEnd = () => { setPlaying(false); setProgress(0); setElapsed(0); };
    const onWait = () => setLoadingSrc(true);
    const onReady = () => setLoadingSrc(false);
    const onError = () => { setLoadingSrc(false); setPlaying(false); };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("waiting", onWait);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("waiting", onWait);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, []);

  // 音量 / 静音同步
  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = muted ? 0 : volume;
  }, [volume, muted]);

  function urlFor(song: Song): string {
    return song.audioUrl || previewAudioForId(song.id);
  }

  function playSong(song: Song) {
    const a = audioRef.current;
    if (!a) return;
    const url = urlFor(song);
    if (currentId !== song.id) {
      a.src = url;
      setCurrentId(song.id);
      setElapsed(0);
      setProgress(0);
      setTotalSec(song.duration || 0);
      setLoadingSrc(true);
    }
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function pause() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  function toggle(song: Song) {
    if (currentId === song.id && playing) pause();
    else playSong(song);
  }

  function step(delta: number) {
    if (!current) return;
    const idx = songs.findIndex(s => s.id === current.id);
    if (idx < 0) return;
    const next = songs[(idx + delta + songs.length) % songs.length];
    if (next) playSong(next);
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a || !isFinite(a.duration)) return;
    const p = Number(e.target.value) / 100;
    a.currentTime = p * a.duration;
    setProgress(p);
    setElapsed(p * a.duration);
  }

  const coverFallback = "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400";

  return (
    <div className="space-y-4 pb-28">
      {/* Header strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            音乐列表
          </h3>
          <p className="text-xs text-gray-500 font-light mt-1">
            当前歌手：{artistName} · 共 {songs.length} 首 · 点击缩略图即可预览
          </p>
        </div>
        <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
          <Disc3 className="w-3 h-3 mr-1" /> 在线预览
        </Badge>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> 载入中...
        </div>
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
          <Music className="w-8 h-8 text-gray-600 mb-2" />
          <p className="text-sm font-light">还没有作品。切换到「AI 音乐创作」生成第一首歌。</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {songs.map((s, i) => {
            const isCurrent = currentId === s.id;
            const isActivePlaying = isCurrent && playing;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`group bg-gray-900/50 border rounded-xl p-3 transition ${
                  isCurrent ? "border-cyan-500/40 shadow-[0_0_24px_rgba(6,182,212,0.15)]" : "border-white/5 hover:border-white/15"
                }`}
              >
                <div className="relative aspect-square overflow-hidden rounded-lg bg-black/40">
                  <img
                    src={s.coverUrl || coverFallback}
                    alt={s.title}
                    className={`w-full h-full object-cover transition ${isActivePlaying ? "scale-105 blur-[0.5px]" : "group-hover:scale-105"}`}
                  />
                  <button
                    onClick={() => toggle(s)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition"
                  >
                    <span className="w-12 h-12 rounded-full bg-cyan-500/90 hover:bg-cyan-400 text-white flex items-center justify-center shadow-lg">
                      {isActivePlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </span>
                  </button>
                  {isActivePlaying && (
                    <div className="absolute top-2 right-2 flex items-end gap-0.5 h-4">
                      {[0, 1, 2].map(n => (
                        <motion.span
                          key={n}
                          className="w-0.5 bg-cyan-300"
                          animate={{ height: ["30%", "90%", "40%", "100%", "30%"] }}
                          transition={{ repeat: Infinity, duration: 1 + n * 0.15, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold truncate" title={s.title}>{s.title}</div>
                    <Badge className={`text-[10px] shrink-0 ${STATUS_BADGE[s.status] ?? ""}`}>
                      {SONG_STATUS_LABEL[s.status]}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-gray-500 font-light flex items-center gap-1.5 flex-wrap">
                    <span>{s.genre}</span>
                    <span className="text-gray-700">·</span>
                    <span>{fmtTime(s.duration)}</span>
                    {s.status === "released" && (
                      <>
                        <span className="text-gray-700">·</span>
                        <span className="text-pink-300">{formatCompactNumber(s.plays)} 播放</span>
                      </>
                    )}
                    {s.creditsSpent != null && (
                      <>
                        <span className="text-gray-700">·</span>
                        <span className="text-amber-300">{formatCredits(s.creditsSpent)}</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Sticky player */}
      <div className="fixed bottom-4 left-4 right-4 md:left-[280px] md:right-8 z-40 pointer-events-none">
        <motion.div
          initial={false}
          animate={{ opacity: current ? 1 : 0, y: current ? 0 : 16 }}
          className="pointer-events-auto bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl px-4 py-3"
        >
          {current ? (
            <div className="flex items-center gap-3">
              <img
                src={current.coverUrl || artistAvatar || coverFallback}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold truncate">{current.title}</div>
                  {loadingSrc && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {artistName} · {current.genre}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-gray-500 w-9 text-right">
                    {fmtTime(elapsed)}
                  </span>
                  <input
                    type="range" min={0} max={100} value={Math.round(progress * 100)}
                    onChange={onSeek}
                    className="flex-1 h-1 accent-cyan-400 bg-white/10 rounded-full"
                  />
                  <span className="text-[10px] tabular-nums text-gray-500 w-9">
                    {fmtTime(totalSec || current.duration)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => step(-1)} className="w-8 h-8 text-gray-400 hover:text-white">
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={() => toggle(current)}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 hover:opacity-90"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => step(1)} className="w-8 h-8 text-gray-400 hover:text-white">
                  <SkipForward className="w-4 h-4" />
                </Button>
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  <button onClick={() => setMuted(m => !m)} className="text-gray-400 hover:text-white">
                    {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range" min={0} max={100} value={Math.round((muted ? 0 : volume) * 100)}
                    onChange={e => { setVolume(Number(e.target.value) / 100); setMuted(false); }}
                    className="w-20 h-1 accent-cyan-400 bg-white/10 rounded-full"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600 px-1 py-0.5">选中一首歌曲开始播放</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
