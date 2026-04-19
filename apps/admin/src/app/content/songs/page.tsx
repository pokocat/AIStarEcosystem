"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Music2, PauseCircle, Search, XCircle, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { SONG_STATUS } from "@/constants/status";
import { listDigitalIps } from "@/api/digital-ips";
import { listStudios } from "@/api/studios";
import type { Song, SongStatus } from "@/types/music";
import type { Artist } from "@/types/artist";
import type { AdminStudio } from "@/types/studio";
import { listSongs, listGenres, approveSong, rejectSong } from "@/api/music";
import { formatCountCN, formatCurrencyCN, formatDateCN } from "@/lib/utils";

function formatDuration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type ActionKind = "approve" | "reject";

function SongsReviewPageContent() {
  const searchParams = useSearchParams();
  const artistParam = searchParams?.get("artist") ?? null;

  const [songs, setSongs] = React.useState<Song[]>([]);
  const [genres, setGenres] = React.useState<{ id: string; name: string; icon: string }[]>([]);
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [studios, setStudios] = React.useState<AdminStudio[]>([]);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"all" | SongStatus>("all");
  const [genre, setGenre] = React.useState<string>("all");
  const [studioFilter, setStudioFilter] = React.useState<string>("all");
  const [artistFilter, setArtistFilter] = React.useState<string | null>(artistParam);
  const [target, setTarget] = React.useState<Song | null>(null);
  const [action, setAction] = React.useState<ActionKind | null>(null);

  // URL 参数变化时同步
  React.useEffect(() => { setArtistFilter(artistParam); }, [artistParam]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const [s, g, a, st] = await Promise.all([
        listSongs(),
        listGenres(),
        listDigitalIps(0, 500),
        listStudios(0, 200),
      ]);
      if (!alive) return;
      setSongs(s);
      setGenres(g);
      setArtists(a);
      setStudios(st);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const artistById = React.useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const studioById = React.useMemo(() => new Map(studios.map((s) => [s.id, s])), [studios]);

  // 解析一首歌的 studioId（优先取歌上的冗余字段；否则经艺人反查）
  const resolveStudioId = React.useCallback(
    (s: Song) => s.studioId ?? (s.artistId ? artistById.get(s.artistId)?.studioId : undefined),
    [artistById]
  );

  const filtered = songs.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (genre !== "all" && s.genre !== genre) return false;
    if (studioFilter !== "all" && resolveStudioId(s) !== studioFilter) return false;
    if (artistFilter && s.artistId !== artistFilter) return false;
    if (query && !s.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const activeArtist = artistFilter ? artistById.get(artistFilter) : undefined;

  const counts = {
    recording: songs.filter((s) => s.status === "recording").length,
    mixing: songs.filter((s) => s.status === "mixing").length,
    released: songs.filter((s) => s.status === "released").length,
  };

  const openAction = (song: Song, a: ActionKind) => {
    setTarget(song);
    setAction(a);
  };

  const closeDialog = () => {
    setTarget(null);
    setAction(null);
  };

  const handleConfirm = async (reason: string) => {
    if (!target || !action) return;
    const id = target.id;
    const updated =
      action === "approve"
        ? await approveSong(id, { reason })
        : await rejectSong(id, { reason });
    setSongs((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  };

  const actionConfig = {
    approve: { title: "人工通过并上架", tone: "success" as const, icon: CheckCircle2, confirm: "通过并上架" },
    reject:  { title: "驳回并下架",     tone: "danger"  as const, icon: XCircle,      confirm: "驳回" },
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="歌曲列表"
        description="默认策略：新建音乐自动通过审核并上架。本页用于查看发行情况与人工干预（如违规下架）。"
        breadcrumb={[{ label: "AI 作品" }, { label: "歌曲" }]}
        actions={
          <Button size="sm" variant="outline">
            导出清单
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="录制中" value={counts.recording} icon={Music2} tone="default" />
        <StatCard label="混音中 · 待发行" value={counts.mixing} icon={PauseCircle} tone="warning" />
        <StatCard label="已发行" value={counts.released} icon={CheckCircle2} tone="success" />
        <StatCard
          label="近 30 天播放"
          value={formatCountCN(songs.reduce((a, b) => a + b.plays, 0))}
          hint="累计播放量"
          icon={Music2}
        />
      </section>

      {activeArtist && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-900">
          <span>筛选艺人：</span>
          <Link href={`/artists/roster/${activeArtist.id}`} className="font-medium hover:underline">
            {activeArtist.name}
          </Link>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-indigo-100"
            aria-label="清除艺人筛选"
            onClick={() => setArtistFilter(null)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">曲目清单</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索歌曲"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as "all" | SongStatus)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="recording">录制中</SelectItem>
              <SelectItem value="mixing">混音中</SelectItem>
              <SelectItem value="released">已发行</SelectItem>
            </SelectContent>
          </Select>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="曲风" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部曲风</SelectItem>
              {genres.map((g) => (
                <SelectItem key={g.id} value={g.name}>
                  {g.icon} {g.name}
                </SelectItem>
              ))}
              {Array.from(new Set(songs.map((s) => s.genre)))
                .filter((g) => !genres.some((m) => m.name === g))
                .map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={studioFilter} onValueChange={setStudioFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="工作室" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部工作室</SelectItem>
              {studios.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>曲目</TableHead>
                <TableHead>艺人</TableHead>
                <TableHead>工作室</TableHead>
                <TableHead>曲风</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">播放</TableHead>
                <TableHead className="text-right">收入</TableHead>
                <TableHead>发行</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const artist = s.artistId ? artistById.get(s.artistId) : undefined;
                const studioIdResolved = resolveStudioId(s);
                const studio = studioIdResolved ? studioById.get(studioIdResolved) : undefined;
                const artistName = artist?.name ?? s.artistName ?? "—";
                const studioName = studio?.name ?? s.studioName ?? "—";
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">编号 {s.id}</div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{artistName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{studioName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.genre}</TableCell>
                    <TableCell className="tabular-nums text-sm">{formatDuration(s.duration)}</TableCell>
                    <TableCell>
                      <StatusBadge meta={SONG_STATUS[s.status]} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatCountCN(s.plays)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatCurrencyCN(s.revenue)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.releaseDate ? formatDateCN(s.releaseDate) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/content/songs/${s.id}`}>详情</Link>
                        </Button>
                        {s.status !== "released" ? (
                          <Button size="sm" variant="success" onClick={() => openAction(s, "approve")}>
                            通过
                          </Button>
                        ) : (
                          <Button size="sm" variant="destructive" onClick={() => openAction(s, "reject")}>
                            驳回
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                    没有匹配的曲目
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && action && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          title={actionConfig[action].title}
          description={`目标曲目：《${target.title}》 · ${target.genre} · ${formatDuration(target.duration)}`}
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

export default function SongsReviewPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto max-w-screen-2xl py-10 text-sm text-muted-foreground">正在加载歌曲列表...</div>}>
      <SongsReviewPageContent />
    </React.Suspense>
  );
}
