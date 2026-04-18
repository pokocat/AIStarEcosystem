"use client";

import * as React from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "../ui/sheet";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Loader2, Music, Coins } from "lucide-react";
import type { Song, MusicGenre } from "@/types/music";
import { MusicApi, ApiError } from "@/api";
import {
  MUSIC_STATUS_COLORS,
  SONG_STATUS_LABEL,
} from "@/constants/music-ui";
import { formatCredits, formatCompactNumber } from "@/lib/format";

interface SongDetailDrawerProps {
  song: Song | null;
  genres: MusicGenre[];
  onClose: () => void;
  onSaved: (updated: Song) => void;
}

export function SongDetailDrawer({ song, genres, onClose, onSaved }: SongDetailDrawerProps) {
  const [title, setTitle] = React.useState("");
  const [genre, setGenre] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [lyrics, setLyrics] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 每次切换歌曲回填表单
  React.useEffect(() => {
    if (!song) return;
    setTitle(song.title);
    setGenre(song.genre);
    setCoverUrl(song.coverUrl ?? "");
    setLyrics(song.lyrics ?? "");
    setError(null);
  }, [song]);

  const dirty = !!song && (
    title !== song.title ||
    genre !== song.genre ||
    coverUrl !== (song.coverUrl ?? "") ||
    lyrics !== (song.lyrics ?? "")
  );

  const handleSave = async () => {
    if (!song || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await MusicApi.updateSong(song.id, {
        title: title.trim() || song.title,
        genre: genre || song.genre,
        coverUrl: coverUrl || undefined,
        lyrics: lyrics || undefined,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError
        ? `${err.message}（${err.code}）`
        : err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!song) return null;

  return (
    <Sheet open={!!song} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="bg-[#0c0c0e] border-white/10 text-white w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-pink-400" />
            歌曲详情
          </SheetTitle>
          <SheetDescription className="text-xs text-gray-400">
            编辑曲风、封面、歌词；基本信息与扣费记录不可变。
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 flex-1 space-y-5">
          {/* 封面预览 */}
          <div className="flex items-center gap-4">
            <div
              className="w-24 h-24 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0 bg-cover bg-center"
              style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
            >
              {!coverUrl && <Music className="w-10 h-10 text-white" />}
            </div>
            <div className="flex-1 space-y-1">
              <Badge variant="outline" className={`text-xs ${MUSIC_STATUS_COLORS[song.status]}`}>
                {SONG_STATUS_LABEL[song.status]}
              </Badge>
              {typeof song.creditsSpent === 'number' && (
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-400" />
                  创作消耗 {formatCredits(song.creditsSpent)} 积分
                </div>
              )}
              {song.modelVersion && (
                <div className="text-xs text-gray-500">
                  模型 {song.modelVersion}
                  {song.thinkDepth && ` · ${song.thinkDepth}`}
                </div>
              )}
            </div>
          </div>

          {/* 基础字段 */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-black/40 border-white/10 text-white"
              placeholder="歌曲标题"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-400">曲风</Label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-black/40 border border-white/10 text-sm text-white"
            >
              {/* 允许用户保留旧值，哪怕不在当前枚举里 */}
              {genres.findIndex(g => g.name === genre) < 0 && genre && (
                <option value={genre}>{genre}</option>
              )}
              {genres.map(g => (
                <option key={g.id} value={g.name}>{g.icon} {g.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-400">封面 URL</Label>
            <Input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className="bg-black/40 border-white/10 text-white"
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-400">歌词</Label>
            <Textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              className="bg-black/40 border-white/10 text-white min-h-[160px] font-mono text-xs"
              placeholder="按行输入歌词..."
            />
          </div>

          {/* 已发布统计（只读） */}
          {song.status === 'released' && (
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-black/40 border border-white/5">
              <div>
                <div className="text-xs text-gray-500 mb-1">播放</div>
                <div className="text-sm font-bold text-pink-400">{formatCompactNumber(song.plays)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">评分</div>
                <div className="text-sm font-bold text-yellow-400">{song.rating.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">收入</div>
                <div className="text-sm font-bold text-green-400">{formatCredits(song.revenue)}</div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 flex items-center gap-1">
              保存失败：{error}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-white/10 px-4 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-white/10 text-white hover:bg-white/5">
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-pink-600 hover:bg-pink-500 text-white"
          >
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            保存更改
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
