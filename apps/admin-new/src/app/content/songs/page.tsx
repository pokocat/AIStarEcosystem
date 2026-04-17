"use client";

import * as React from "react";
import { CheckCircle2, Music2, PauseCircle, Search, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { SONGS, MUSIC_GENRES } from "@/mocks/music";
import { SONG_STATUS } from "@/constants/status";
import type { Song, SongStatus } from "@/types/music";
import { formatCountCN, formatCurrencyCN, formatDateCN } from "@/lib/utils";

function formatDuration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SongsReviewPage() {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"all" | SongStatus>("all");
  const [genre, setGenre] = React.useState<string>("all");
  const [target, setTarget] = React.useState<Song | null>(null);
  const [action, setAction] = React.useState<"approve" | "reject" | "hold" | null>(null);

  const filtered = SONGS.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (genre !== "all" && s.genre !== genre) return false;
    if (query && !s.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const counts = {
    recording: SONGS.filter((s) => s.status === "recording").length,
    mixing: SONGS.filter((s) => s.status === "mixing").length,
    released: SONGS.filter((s) => s.status === "released").length,
  };

  const openAction = (song: Song, a: "approve" | "reject" | "hold") => {
    setTarget(song);
    setAction(a);
  };

  const actionConfig = {
    approve: { title: "审核通过并发行", tone: "success" as const, icon: CheckCircle2, confirm: "通过发行" },
    reject: { title: "驳回单曲", tone: "danger" as const, icon: XCircle, confirm: "驳回" },
    hold: { title: "挂起观察", tone: "warning" as const, icon: PauseCircle, confirm: "挂起" },
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="歌曲审核"
        description="单曲从制作到公开发行前必须经过平台审核"
        breadcrumb={[{ label: "内容审核" }, { label: "歌曲审核" }]}
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
          value={formatCountCN(SONGS.reduce((a, b) => a + b.plays, 0))}
          hint="累计播放量"
          icon={Music2}
        />
      </section>

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
              {MUSIC_GENRES.map((g) => (
                <SelectItem key={g.id} value={g.name}>
                  {g.icon} {g.name}
                </SelectItem>
              ))}
              {/* Include any unmapped genres present in data */}
              {Array.from(new Set(SONGS.map((s) => s.genre)))
                .filter((g) => !MUSIC_GENRES.some((m) => m.name === g))
                .map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>曲目</TableHead>
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
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">ID {s.id}</div>
                  </TableCell>
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
                    {s.status === "mixing" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="success" onClick={() => openAction(s, "approve")}>
                          通过
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(s, "hold")}>
                          挂起
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openAction(s, "reject")}>
                          驳回
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost">
                        查看
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
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
            if (!open) {
              setTarget(null);
              setAction(null);
            }
          }}
          title={actionConfig[action].title}
          description={`目标曲目：《${target.title}》 · ${target.genre} · ${formatDuration(target.duration)}`}
          icon={actionConfig[action].icon}
          tone={actionConfig[action].tone}
          confirmLabel={actionConfig[action].confirm}
          requireReason={action !== "approve"}
        />
      )}
    </div>
  );
}
