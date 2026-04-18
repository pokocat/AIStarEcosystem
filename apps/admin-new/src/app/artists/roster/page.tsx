"use client";

import * as React from "react";
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
import { MOCK_ARTISTS } from "@/mocks/artists";
import { ARTIST_STATUS, ARTIST_QUALITY } from "@/constants/status";
import { ARTIST_TYPE_META } from "@/constants/artist-meta";
import { formatDateCN } from "@/lib/utils";
import { formatCompactNumber, formatCredits } from "@/lib/format";

export default function RosterPage() {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [quality, setQuality] = React.useState("all");

  const filtered = MOCK_ARTISTS.filter((a) => {
    if (type !== "all" && a.type !== type) return false;
    if (status !== "all" && a.status !== status) return false;
    if (quality !== "all" && a.quality !== quality) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="艺人档案"
        description="全站虚拟艺人档案·支持检索、状态流转与品质调整"
        breadcrumb={[{ label: "艺人与经纪" }, { label: "艺人档案" }]}
        actions={<Button size="sm">新建艺人档案</Button>}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="档案总数" value={MOCK_ARTISTS.length} icon={Users} />
        <StatCard
          label="传说级"
          value={MOCK_ARTISTS.filter((a) => a.quality === "legendary").length}
          hint="品质管控目标"
          icon={Users}
          tone="warning"
        />
        <StatCard
          label="活跃艺人"
          value={MOCK_ARTISTS.filter((a) => a.status === "active").length}
          icon={Users}
          tone="success"
        />
        <StatCard
          label="领域覆盖"
          value={new Set(MOCK_ARTISTS.flatMap((a) => a.domains)).size}
          hint="主营领域去重"
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>艺人</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>品质</TableHead>
                <TableHead>Lv</TableHead>
                <TableHead>粉丝</TableHead>
                <TableHead>月收益</TableHead>
                <TableHead>领域</TableHead>
                <TableHead>最近活跃</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const meta = ARTIST_TYPE_META[a.type];
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={a.avatar} alt={a.name} />
                          <AvatarFallback>{a.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[240px]">{a.bio}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{meta.icon} {meta.label}</TableCell>
                    <TableCell><StatusBadge meta={ARTIST_STATUS[a.status]} /></TableCell>
                    <TableCell><StatusBadge meta={ARTIST_QUALITY[a.quality]} /></TableCell>
                    <TableCell className="text-sm tabular-nums">{a.level}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCompactNumber(a.stats.fans)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCredits(a.stats.monthlyRevenue)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {a.domains.slice(0, 3).map((d) => (
                          <span key={d} className="rounded bg-surface-muted px-1.5 py-0.5">{d}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateCN(a.lastActive)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost">详情</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
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
