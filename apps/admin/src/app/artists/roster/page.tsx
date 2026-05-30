"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { listDigitalIps } from "@/api/digital-ips";
import { listStudios } from "@/api/studios";
import { ARTIST_STATUS, ARTIST_QUALITY } from "@/constants/status";
import { ARTIST_TYPE_META } from "@/constants/artist-meta";
import type { Artist } from "@/types/artist";
import type { AdminStudio } from "@/types/studio";
import { formatDateCN } from "@/lib/utils";
import { formatCompactNumber, formatCredits } from "@/lib/format";

export default function RosterPage() {
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [studios, setStudios] = React.useState<AdminStudio[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [quality, setQuality] = React.useState("all");
  const [studioFilter, setStudioFilter] = React.useState("all");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [a, s] = await Promise.all([
          listDigitalIps(0, 200),
          listStudios(0, 200),
        ]);
        if (cancelled) return;
        setArtists(a);
        setStudios(s);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 艺人必归属一个 Studio（studioId NOT NULL）。保留 ownerUserId 兜底，避免过渡期老数据空指针。
  const studioById = React.useMemo(() => new Map(studios.map((s) => [s.id, s])), [studios]);
  const studioByOwner = React.useMemo(
    () => new Map(studios.map((s) => [s.ownerUserId, s])),
    [studios]
  );
  const resolveStudio = React.useCallback(
    (a: Artist) => studioById.get(a.studioId) ?? studioByOwner.get(a.ownerUserId),
    [studioById, studioByOwner]
  );

  const filtered = artists.filter((a) => {
    if (type !== "all" && a.type !== type) return false;
    if (status !== "all" && a.status !== status) return false;
    if (quality !== "all" && a.quality !== quality) return false;
    if (studioFilter !== "all" && resolveStudio(a)?.id !== studioFilter) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="admin-page">
      <PageHeader
        title="艺人档案"
        description="全站虚拟艺人档案（来自后端 /admin/digital-ips）·支持按经纪公司筛选、状态流转与品质调整"
        breadcrumb={[{ label: "艺人与经纪" }, { label: "艺人档案" }]}
        actions={<Button size="sm">新建艺人档案</Button>}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="档案总数" value={artists.length} icon={Users} />
        <StatCard
          label="传说级"
          value={artists.filter((a) => a.quality === "legendary").length}
          hint="品质管控目标"
          icon={Users}
          tone="warning"
        />
        <StatCard
          label="活跃艺人"
          value={artists.filter((a) => a.status === "active").length}
          icon={Users}
          tone="success"
        />
        <StatCard
          label="覆盖经纪公司"
          value={new Set(artists.map((a) => resolveStudio(a)?.id).filter(Boolean)).size}
          hint="含个人创作者"
          icon={Users}
        />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">艺人清单</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按艺人名搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={studioFilter} onValueChange={setStudioFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部经纪公司</SelectItem>
              {studios.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {Object.entries(ARTIST_TYPE_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>{m.icon} {m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(ARTIST_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={quality} onValueChange={setQuality}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部品质</SelectItem>
              {Object.entries(ARTIST_QUALITY).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">艺人</TableHead>
                <TableHead className="min-w-[160px]">所属经纪公司</TableHead>
                <TableHead>分类</TableHead>
                <TableHead className="min-w-[96px]">状态</TableHead>
                <TableHead className="min-w-[72px]">品质</TableHead>
                <TableHead>等级</TableHead>
                <TableHead>粉丝</TableHead>
                <TableHead>月收益</TableHead>
                <TableHead className="min-w-[220px]">领域</TableHead>
                <TableHead className="text-right min-w-[80px]">歌曲</TableHead>
                <TableHead className="min-w-[110px]">最近活跃</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!loading && loadError && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-rose-600">
                    加载失败：{loadError}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.map((a) => {
                const meta = ARTIST_TYPE_META[a.type];
                const studio = resolveStudio(a);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={a.avatar} alt={a.name} />
                          <AvatarFallback>{a.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[240px]">{a.bio}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {studio ? (
                        <Link
                          href="/platform/accounts"
                          className="text-foreground hover:text-primary hover:underline whitespace-nowrap"
                        >
                          {studio.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {meta ? `${meta.icon} ${meta.label}` : a.type}
                    </TableCell>
                    <TableCell><StatusBadge meta={ARTIST_STATUS[a.status]} /></TableCell>
                    <TableCell><StatusBadge meta={ARTIST_QUALITY[a.quality]} /></TableCell>
                    <TableCell className="text-sm tabular-nums">{a.level}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCompactNumber(a.stats.fans)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCredits(a.stats.monthlyRevenue)}</TableCell>
                    <TableCell className="text-xs">
                      {(a.domains ?? []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(a.domains ?? []).slice(0, 3).map((d) => (
                            <span
                              key={d}
                              className="inline-flex whitespace-nowrap rounded bg-surface-muted px-1.5 py-0.5 text-muted-foreground"
                            >
                              {d}
                            </span>
                          ))}
                          {(a.domains ?? []).length > 3 && (
                            <span className="text-[11px] text-muted-foreground">+{(a.domains ?? []).length - 3}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {a.stats.songs > 0 ? (
                        <Link
                          href={`/content/songs?artist=${encodeURIComponent(a.id)}`}
                          className="text-primary hover:underline"
                          title={`查看 ${a.name} 的 ${a.stats.songs} 首歌曲`}
                        >
                          {a.stats.songs}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateCN(a.lastActive)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/artists/roster/${a.id}`}>详情</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    没有匹配的艺人
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
