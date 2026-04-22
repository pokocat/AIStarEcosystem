"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mapTone } from "@/components/shared/tone";
import { getSong, approveSong, rejectSong } from "@/api/music";
import { SONG_STATUS } from "@/constants/status";
import { formatCompactNumber, formatCredits, formatDuration } from "@/lib/format";
import type { Song } from "@/types/music";
import { toast } from "sonner";

export default function SongDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [song, setSong] = React.useState<Song | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    getSong(id)
      .then((s) => { if (alive) setSong(s); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const onApprove = async () => {
    try {
      const updated = await approveSong(id, { reason: "admin 人工复核通过" });
      setSong(updated);
      toast.success("已通过并上架");
    } catch (e) {
      toast.error("操作失败");
    }
  };
  const onReject = async () => {
    try {
      await rejectSong(id, { reason: "内容不符合上架规范" });
      toast.success("已驳回");
    } catch (e) {
      toast.error("操作失败");
    }
  };

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">加载中…</div>;
  if (!song) return <div className="py-10 text-center text-sm text-muted-foreground">未找到该歌曲</div>;

  const s = SONG_STATUS[song.status];

  return (
    <>
      <Link href="/content/songs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="h-4 w-4" /> 返回列表
      </Link>

      <PageHeader
        title={song.title}
        description={`${song.artistName ?? song.artistId} · ${song.genre}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={onReject} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 text-destructive bg-destructive-soft px-3 py-1.5 text-sm hover:bg-destructive/10">
              <XCircle className="h-4 w-4" /> 驳回
            </button>
            <button onClick={onApprove} className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-success-foreground hover:bg-success/90">
              <CheckCircle2 className="h-4 w-4" /> 通过并发行
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Section className="lg:col-span-1" title="封面 / 试听">
          <div className="aspect-square rounded-lg bg-muted overflow-hidden ring-1 ring-border flex items-center justify-center">
            {song.coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={song.coverUrl} alt={song.title} className="h-full w-full object-cover" />
            ) : (
              <PlayCircle className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          {song.audioUrl && (
            <audio controls src={song.audioUrl} className="mt-3 w-full" />
          )}
        </Section>

        <Section className="lg:col-span-2" title="元数据">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">状态</dt>
              <dd className="mt-0.5">{s && <StatusBadge tone={mapTone(s.tone)} label={s.label} />}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">时长</dt>
              <dd className="mt-0.5 tabular-nums">{formatDuration(song.duration)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">模型 / 深度</dt>
              <dd className="mt-0.5">{song.modelVersion ?? "—"} · {song.thinkDepth ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">生成扣费</dt>
              <dd className="mt-0.5 tabular-nums">{song.creditsSpent ?? 0} credits</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">创建时间</dt>
              <dd className="mt-0.5">{song.createdAt?.slice(0, 10) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">发行时间</dt>
              <dd className="mt-0.5">{song.releaseDate?.slice(0, 10) ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">简介</dt>
              <dd className="mt-0.5 text-[13px]">{song.description ?? "—"}</dd>
            </div>
          </dl>
        </Section>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="播放量" value={formatCompactNumber(song.plays)} tone="primary" />
        <StatCard label="收益"   value={formatCredits(song.revenue)} tone="emerald" />
        <StatCard label="评分"   value={song.rating > 0 ? song.rating.toFixed(1) : "—"} tone="amber" />
        <StatCard label="归属 Studio" value={song.studioName ?? song.studioId ?? "—"} tone="violet" />
      </div>

      <Section title="歌词">
        <pre className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{song.lyrics ?? "暂无歌词"}</pre>
      </Section>
    </>
  );
}
