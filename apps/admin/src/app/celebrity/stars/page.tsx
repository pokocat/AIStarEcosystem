"use client";

import * as React from "react";
import { Megaphone, Search, Flame } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CelebrityZoneApi } from "@/api";
import type { CelebrityCategory, CelebrityStar } from "@/types/celebrity-zone";

const CATEGORIES: CelebrityCategory[] = ["演员", "歌手", "主持人", "运动员", "网红", "综艺"];

const AUTH_LABEL: Record<string, string> = {
  authorized: "已授权",
  pending: "审核中",
  expired: "已过期",
  unauthorized: "未授权",
};

const AUTH_TONE: Record<string, string> = {
  authorized: "border-emerald-300 bg-emerald-50 text-emerald-700",
  pending: "border-amber-300 bg-amber-50 text-amber-700",
  expired: "border-rose-300 bg-rose-50 text-rose-700",
  unauthorized: "border-slate-300 bg-slate-50 text-slate-600",
};

export default function AdminCelebrityStarsPage() {
  const [stars, setStars] = React.useState<CelebrityStar[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<CelebrityCategory | "all">("all");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const list = await CelebrityZoneApi.listStars({
          category: category === "all" ? "全部" : category,
          sort: "hot",
        });
        if (!cancelled) setStars(list);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [category]);

  const filtered = stars.filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase())
  );

  const hotCount = stars.filter((s) => s.isHot).length;
  const authorizedCount = stars.filter((s) => s.authorization.status === "authorized").length;
  const totalGenerated = stars.reduce((sum, s) => sum + (s.stats.totalGenerated || 0), 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="明星档案"
        description="AI 明星专区市场可见的明星形象（来自 /admin/celebrity/stars）·授权状态 / 套餐用量 / 引用统计"
        breadcrumb={[{ label: "明星带货" }, { label: "明星档案" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="明星总数" value={stars.length} icon={Megaphone} />
        <StatCard label="热门" value={hotCount} icon={Flame} tone="warning" />
        <StatCard label="已授权" value={authorizedCount} icon={Megaphone} tone="success" />
        <StatCard label="累计生成视频" value={totalGenerated} icon={Megaphone} hint="所有明星累计 totalGenerated" />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">明星清单</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按明星名搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as CelebrityCategory | "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
              加载失败：{loadError}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>明星</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>授权</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead className="text-right">配额</TableHead>
                <TableHead className="text-right">已生成</TableHead>
                <TableHead>累计播放</TableHead>
                <TableHead>GMV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <img src={s.avatar} alt={s.name} className="h-9 w-9 rounded-full object-cover border" />
                      <div className="flex flex-col">
                        <span className="font-medium">{s.name} {s.isHot && <span className="text-amber-500">🔥</span>}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">{s.description}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><span className="rounded-md border px-2 py-0.5 text-xs">{s.category}</span></TableCell>
                  <TableCell>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${AUTH_TONE[s.authorization.status] ?? AUTH_TONE.unauthorized}`}>
                      {AUTH_LABEL[s.authorization.status] ?? s.authorization.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.pricingTier ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {(s.quotaUsed ?? 0)} / {(s.quotaTotal ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.stats.totalGenerated}</TableCell>
                  <TableCell className="text-sm">{s.stats.totalPlays}</TableCell>
                  <TableCell className="text-sm">{s.stats.gmv}</TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">没有匹配的明星</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
