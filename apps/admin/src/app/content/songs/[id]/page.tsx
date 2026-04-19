"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Music2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionDialog } from "@/components/ActionDialog";
import { SONG_STATUS } from "@/constants/status";
import { getDigitalIp } from "@/api/digital-ips";
import { getStudio } from "@/api/studios";
import type { Song } from "@/types/music";
import type { Artist } from "@/types/artist";
import type { AdminStudio } from "@/types/studio";
import { getSong, approveSong, rejectSong } from "@/api/music";
import { formatCountCN, formatCurrencyCN, formatDateCN } from "@/lib/utils";
import { formatDuration } from "@/lib/format";

type ActionKind = "approve" | "reject";

export default function SongDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [song, setSong] = React.useState<Song | null>(null);
  const [artist, setArtist] = React.useState<Artist | null>(null);
  const [studio, setStudio] = React.useState<AdminStudio | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [action, setAction] = React.useState<ActionKind | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    getSong(id)
      .then(async (s) => {
        if (!alive) return;
        setSong(s);
        const [a, st] = await Promise.all([
          s.artistId ? getDigitalIp(s.artistId).catch(() => null) : Promise.resolve(null),
          s.studioId ? getStudio(s.studioId).catch(() => null) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setArtist(a);
        setStudio(st);
      })
      .catch(() => {
        if (alive) setNotFound(true);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-screen-md mx-auto py-12 text-center text-muted-foreground">
        未找到该曲目。
        <div className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/content/songs">返回列表</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!song) {
    return <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>;
  }

  const handleConfirm = async (reason: string) => {
    if (!action || !song) return;
    const updated =
      action === "approve"
        ? await approveSong(song.id, { reason })
        : await rejectSong(song.id, { reason });
    setSong(updated);
  };

  const actionConfig = {
    approve: { title: "人工通过并上架", tone: "success" as const, icon: CheckCircle2, confirm: "通过并上架" },
    reject:  { title: "驳回并下架",     tone: "danger"  as const, icon: XCircle,      confirm: "驳回" },
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title={song.title}
        description={song.description ?? "—"}
        breadcrumb={[
          { label: "AI 作品" },
          { label: "歌曲", href: "/content/songs" },
          { label: song.title },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-3.5 w-3.5" /> 返回
            </Button>
            {song.status !== "released" ? (
              <Button size="sm" variant="success" onClick={() => setAction("approve")}>
                通过并上架
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setAction("reject")}>
                驳回并下架
              </Button>
            )}
          </>
        }
      />

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="xl:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                <Music2 className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h2 className="text-xl font-semibold">{song.title}</h2>
                  <StatusBadge meta={SONG_STATUS[song.status]} />
                  <span className="text-xs text-muted-foreground">编号 {song.id}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{song.description ?? "—"}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>曲风：<span className="text-foreground">{song.genre}</span></span>
                  <span>时长：<span className="text-foreground tabular-nums">{formatDuration(song.duration)}</span></span>
                  <span>发行：<span className="text-foreground">{song.releaseDate ? formatDateCN(song.releaseDate) : "未发行"}</span></span>
                  {song.createdAt && (
                    <span>创建：<span className="text-foreground">{formatDateCN(song.createdAt)}</span></span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">演唱 / 归属</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {artist ? (
              <Link
                href={`/artists/roster/${artist.id}`}
                className="flex items-center gap-3 p-2 -m-2 rounded-md hover:bg-surface-muted"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={artist.avatar} alt={artist.name} />
                  <AvatarFallback>{artist.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{artist.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{artist.bio}</div>
                </div>
              </Link>
            ) : (
              <div className="text-sm text-muted-foreground">未指定演唱艺人。</div>
            )}
            <div className="border-t border-border pt-3">
              <div className="text-xs text-muted-foreground mb-1">所属经纪公司</div>
              {studio ? (
                <Link href="/platform/accounts" className="text-sm font-medium hover:text-primary hover:underline">
                  {studio.name}
                </Link>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="累计播放" value={formatCountCN(song.plays)} icon={Music2} />
        <StatCard label="累计收入" value={formatCurrencyCN(song.revenue)} tone="success" />
        <StatCard label="评分" value={song.rating ? song.rating.toFixed(1) : "—"} hint="用户 / 编辑评分" />
        <StatCard label="状态" value={SONG_STATUS[song.status].label} tone={song.status === "released" ? "success" : "warning"} />
      </section>

      {action && (
        <ActionDialog
          open={!!action}
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
          title={actionConfig[action].title}
          description={`目标曲目：《${song.title}》 · ${song.genre} · ${formatDuration(song.duration)}`}
          icon={actionConfig[action].icon}
          tone={actionConfig[action].tone}
          confirmLabel={actionConfig[action].confirm}
          requireReason={action !== "approve"}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
