"use client";

import * as React from "react";
import { Briefcase, Search, Coins } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CelebrityZoneApi } from "@/api";
import type { CelebrityProject, CelebrityProjectStatus, CelebrityProjectVideo } from "@/types/celebrity-zone";
import { formatDateCN } from "@/lib/utils";

const PROJECT_STATUSES: CelebrityProjectStatus[] = ["筹备中", "进行中", "已完成"];
const VIDEO_STATUS_LABEL: Record<string, string> = {
  已发布: "已发布",
  待审核: "待审核",
  生成中: "生成中",
  已驳回: "已驳回",
};

const PROJECT_TONE: Record<string, string> = {
  筹备中: "border-amber-300 bg-amber-50 text-amber-700",
  进行中: "border-cyan-300 bg-cyan-50 text-cyan-700",
  已完成: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

const VIDEO_TONE: Record<string, string> = {
  已发布: "border-emerald-300 bg-emerald-50 text-emerald-700",
  待审核: "border-amber-300 bg-amber-50 text-amber-700",
  生成中: "border-cyan-300 bg-cyan-50 text-cyan-700",
  已驳回: "border-rose-300 bg-rose-50 text-rose-700",
};

export default function AdminCelebrityProjectsPage() {
  const [projects, setProjects] = React.useState<CelebrityProject[]>([]);
  const [videos, setVideos] = React.useState<CelebrityProjectVideo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<CelebrityProjectStatus | "all">("all");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [p, v] = await Promise.all([
          CelebrityZoneApi.listProjects(status === "all" ? "全部" : status),
          CelebrityZoneApi.listAllVideos(),
        ]);
        if (cancelled) return;
        setProjects(p);
        setVideos(v);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  const filtered = projects.filter((p) =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.starName.toLowerCase().includes(q.toLowerCase())
  );

  const totalConversions = projects.reduce((s, p) => s + p.conversions, 0);
  const generatingVideos = videos.filter((v) => v.status === "生成中").length;
  const reviewingVideos = videos.filter((v) => v.status === "待审核").length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="带货项目"
        description="所有用户在 AI 明星专区下创建的带货项目（来自 /admin/celebrity/projects）·跨用户聚合"
        breadcrumb={[{ label: "明星带货" }, { label: "带货项目" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="项目总数" value={projects.length} icon={Briefcase} />
        <StatCard label="项目视频总数" value={videos.length} icon={Briefcase} />
        <StatCard label="待审核 / 生成中" value={reviewingVideos + generatingVideos} hint={`${reviewingVideos} 待审 · ${generatingVideos} 生成中`} icon={Briefcase} tone={generatingVideos + reviewingVideos > 0 ? "warning" : "default"} />
        <StatCard label="累计转化数" value={totalConversions} icon={Coins} tone="success" />
      </section>

      <Card className="mb-6">
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">项目清单</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按项目名 / 明星名搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as CelebrityProjectStatus | "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
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
                <TableHead>项目</TableHead>
                <TableHead>明星</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">视频数</TableHead>
                <TableHead className="text-right">配额</TableHead>
                <TableHead className="text-right">转化</TableHead>
                <TableHead>GMV</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <img src={p.starAvatar} alt={p.starName} className="h-7 w-7 rounded-full object-cover border" />
                      <span className="text-sm">{p.starName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${PROJECT_TONE[p.status]}`}>
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.videoCount}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {p.quota.used} / {p.quota.total}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.conversions}</TableCell>
                  <TableCell className="text-sm">{p.gmv}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateCN(p.createdAt)}</TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">暂无项目</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>项目视频流</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目</TableHead>
                <TableHead>明星</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>引擎</TableHead>
                <TableHead className="text-right">时长</TableHead>
                <TableHead className="text-right">播放</TableHead>
                <TableHead>创建</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-sm">{v.projectName}</TableCell>
                  <TableCell className="text-sm">{v.starName}</TableCell>
                  <TableCell className="text-sm font-medium">{v.productName}</TableCell>
                  <TableCell>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${VIDEO_TONE[v.status]}`}>
                      {VIDEO_STATUS_LABEL[v.status] ?? v.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{v.engine}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{v.durationSec}s</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{v.plays ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateCN(v.createdAt)}</TableCell>
                </TableRow>
              ))}
              {videos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">暂无视频</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
