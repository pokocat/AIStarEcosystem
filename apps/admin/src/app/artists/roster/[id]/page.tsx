"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDigitalIp } from "@/api/digital-ips";
import { listStudios } from "@/api/studios";
import { listUsers } from "@/api/users";
import { listSongs } from "@/api/music";
import { ARTIST_QUALITY, ARTIST_STATUS, STUDIO_KIND } from "@/constants/status";
import { ARTIST_TYPE_META, TALENT_LABELS } from "@/constants/artist-meta";
import type { Artist } from "@/types/artist";
import type { AdminStudio } from "@/types/studio";
import type { AepUser } from "@/types/account";
import type { Song } from "@/types/music";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import { formatDateCN } from "@/lib/utils";

export default function ArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [artist, setArtist] = React.useState<Artist | null>(null);
  const [studios, setStudios] = React.useState<AdminStudio[]>([]);
  const [users, setUsers] = React.useState<AepUser[]>([]);
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [errorMsg, setErrorMsg] = React.useState("");

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const [a, s, u, songList] = await Promise.all([
          getDigitalIp(id),
          listStudios(0, 200),
          listUsers(0, 500),
          listSongs(),
        ]);
        if (cancelled) return;
        if (!a) {
          setStatus("notfound");
          return;
        }
        setArtist(a);
        setStudios(s);
        setUsers(u);
        setSongs(songList);
        setStatus("ok");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "加载失败");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") {
    return <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>;
  }
  if (status === "notfound") return notFound();
  if (status === "error" || !artist) {
    return (
      <div className="py-12 text-center text-sm text-rose-600">
        加载失败：{errorMsg || "未知错误"}
        <div className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/artists/roster">返回列表</Link>
          </Button>
        </div>
      </div>
    );
  }

  const studio =
    studios.find((s) => s.id === artist.studioId) ??
    studios.find((s) => s.ownerUserId === artist.ownerUserId);
  const owner = studio ? users.find((u) => u.id === studio.ownerUserId) : undefined;
  const meta = ARTIST_TYPE_META[artist.type];

  // 从属关系下的代表作（按 artistId 过滤，前 5 首；无匹配则降级展示前 3 首最新歌曲）
  const relatedSongs = songs.filter((s) => s.artistId === artist.id);

  const expPercent = Math.min(100, Math.round((artist.exp / artist.maxExp) * 100));

  return (
    <div className="admin-page">
      <PageHeader
        title={artist.name}
        description={artist.bio}
        breadcrumb={[
          { label: "艺人与经纪" },
          { label: "艺人档案", href: "/artists/roster" },
          { label: artist.name },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/artists/roster">
                <ArrowLeft className="h-3.5 w-3.5" /> 返回清单
              </Link>
            </Button>
            <Button size="sm">编辑档案</Button>
          </>
        }
      />

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="xl:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={artist.avatar} alt={artist.name} />
                <AvatarFallback>{artist.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h2 className="text-xl font-semibold">{artist.name}</h2>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {meta ? `${meta.icon} ${meta.label}` : artist.type}
                  </span>
                  <StatusBadge meta={ARTIST_STATUS[artist.status]} />
                  <StatusBadge meta={ARTIST_QUALITY[artist.quality]} />
                </div>
                <p className="text-sm text-muted-foreground mb-3">{artist.bio}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {artist.domains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex whitespace-nowrap rounded bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground whitespace-nowrap">等级 {artist.level}</span>
                  <Progress value={expPercent} className="h-1.5 flex-1 max-w-[240px]" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {artist.exp.toLocaleString()} / {artist.maxExp.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              所属经纪公司
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {studio ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={studio.logoUrl} alt={studio.name} />
                    <AvatarFallback>{studio.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{studio.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <StatusBadge meta={STUDIO_KIND[studio.kind]} />
                    </div>
                  </div>
                </div>
                {studio.bio && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{studio.bio}</p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">负责账号</div>
                    <div className="font-medium truncate">{owner?.displayName ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">联系邮箱</div>
                    <div className="truncate">{studio.contactEmail ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">名下艺人</div>
                    <div className="font-medium tabular-nums">{studio.artistCount}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">入驻时间</div>
                    <div className="tabular-nums">{formatDateCN(studio.createdAt)}</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/platform/accounts">查看经纪公司</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                该艺人尚未绑定经纪公司（ownerUserId：{artist.ownerUserId ?? "—"}）。
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="粉丝数" value={formatCompactNumber(artist.stats.fans)} hint="累计关注" />
        <StatCard label="月收益" value={formatCredits(artist.stats.monthlyRevenue)} tone="success" hint="近 30 天" />
        <StatCard label="累计收益" value={formatCredits(artist.stats.revenue)} tone="success" />
        <StatCard label="商业价值" value={formatCredits(artist.commercialValue)} hint={`代言 ${artist.endorsements} 个`} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">六维才艺</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(artist.talents).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-14 shrink-0">{TALENT_LABELS[k] ?? k}</span>
                <Progress value={v} className="h-2 flex-1" />
                <span className="text-sm tabular-nums w-10 text-right">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">业务产出</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-muted-foreground">歌曲</div><div className="text-lg font-semibold tabular-nums">{artist.stats.songs}</div></div>
            <div><div className="text-xs text-muted-foreground">剧集</div><div className="text-lg font-semibold tabular-nums">{artist.stats.dramas}</div></div>
            <div><div className="text-xs text-muted-foreground">广告</div><div className="text-lg font-semibold tabular-nums">{artist.stats.ads}</div></div>
            <div><div className="text-xs text-muted-foreground">综艺</div><div className="text-lg font-semibold tabular-nums">{artist.stats.variety}</div></div>
            <div><div className="text-xs text-muted-foreground">人气</div><div className="text-lg font-semibold tabular-nums">{artist.stats.popularity}</div></div>
            <div><div className="text-xs text-muted-foreground">创建时间</div><div className="text-sm">{formatDateCN(artist.createdAt)}</div></div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">歌曲作品 · {relatedSongs.length}</CardTitle>
            {relatedSongs.length > 5 && (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/content/songs?artist=${encodeURIComponent(artist.id)}`}>全部歌曲</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="divide-y divide-border -mx-2">
            {relatedSongs.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                该艺人暂无歌曲。
              </div>
            )}
            {relatedSongs.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={`/content/songs/${s.id}`}
                className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.genre}</div>
                </div>
                <div className="text-sm tabular-nums text-muted-foreground">
                  {formatCompactNumber(s.plays)} 次播放
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
