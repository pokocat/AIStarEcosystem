"use client";

import * as React from "react";
import { Film, CheckCircle2, Ticket } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listMovies } from "@/api/film";
import { MOVIE_STATUS } from "@/constants/status";
import type { Movie } from "@/types/film";
import { formatCompactNumber, formatCredits } from "@/lib/format";

const ROLE_LABEL: Record<string, string> = { lead: "主角", supporting: "配角", cameo: "客串" };

export default function MoviesPage() {
  const [movies, setMovies] = React.useState<Movie[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<Movie | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listMovies();
        if (active) setMovies(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const counts = {
    total: movies.length,
    released: movies.filter((m) => m.status === "released").length,
    postProd: movies.filter((m) => m.status === "post-production").length,
    totalBox: movies.reduce((s, m) => s + (m.boxOffice ?? 0), 0),
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="电影"
        description="虚拟演员参演电影的角色、进度与上映审核。"
        breadcrumb={[{ label: "AI 作品" }, { label: "电影" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="总片目"     value={counts.total}    icon={Film} />
        <StatCard label="已上映"     value={counts.released} icon={CheckCircle2} tone="success" />
        <StatCard label="后期待审"   value={counts.postProd} icon={Ticket}       tone={counts.postProd ? "warning" : "default"} />
        <StatCard label="累计票房 · credits" value={formatCompactNumber(counts.totalBox)} icon={Ticket} />
      </section>

      <Card>
        <CardHeader><CardTitle>片目列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>片名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">票房 · credits</TableHead>
                <TableHead className="text-right">分成 · credits</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && movies.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无片目</TableCell></TableRow>
              )}
              {!loading && !loadError && movies.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.genre}</TableCell>
                  <TableCell className="text-sm">{ROLE_LABEL[m.role] ?? m.role}</TableCell>
                  <TableCell><StatusBadge meta={MOVIE_STATUS[m.status]} /></TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{m.boxOffice ? formatCredits(m.boxOffice) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCredits(m.revenue)}</TableCell>
                  <TableCell className="text-right">
                    {m.status === "post-production" ? (
                      <Button size="sm" variant="success" onClick={() => setTarget(m)}>批准上映</Button>
                    ) : (
                      <Button size="sm" variant="ghost">查看</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={`批准上映：${target.title}`}
          description={`${target.genre} · ${ROLE_LABEL[target.role] ?? target.role}`}
          tone="success"
          confirmLabel="批准上映"
          requireReason
        />
      )}
    </div>
  );
}
