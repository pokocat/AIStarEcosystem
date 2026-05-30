"use client";

import * as React from "react";
import { AudioLines, CheckCircle2, Mic2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { listVoiceWorks } from "@/api/film";
import { VOICE_WORK_STATUS } from "@/constants/status";
import type { VoiceWork } from "@/types/film";
import { formatCredits } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  animation: "动画",
  documentary: "纪录片",
  audiobook: "有声书",
  game: "游戏",
};

export default function VoicePage() {
  const [works, setWorks] = React.useState<VoiceWork[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listVoiceWorks();
        if (active) setWorks(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const counts = {
    total: works.length,
    delivered: works.filter((v) => v.status === "delivered").length,
    recording: works.filter((v) => v.status === "recording").length,
    totalPay: works.reduce((s, v) => s + v.payment, 0),
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="配音作品"
        description="动画 / 纪录片 / 有声书 / 游戏配音项目。"
        breadcrumb={[{ label: "AI 作品" }, { label: "配音作品" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="项目总数" value={counts.total}     icon={AudioLines} />
        <StatCard label="录音中"   value={counts.recording} icon={Mic2}        tone={counts.recording ? "warning" : "default"} />
        <StatCard label="已交付"   value={counts.delivered} icon={CheckCircle2} tone="success" />
        <StatCard label="报酬总额 · credits" value={formatCredits(counts.totalPay)} icon={AudioLines} tone="success" />
      </section>

      <Card>
        <CardHeader><CardTitle>配音项目</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>时长（分）</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">报酬 · credits</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && works.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">暂无项目</TableCell></TableRow>
              )}
              {!loading && !loadError && works.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.project}</TableCell>
                  <TableCell className="text-sm">{TYPE_LABEL[v.type] ?? v.type}</TableCell>
                  <TableCell className="tabular-nums text-sm">{v.duration}</TableCell>
                  <TableCell><StatusBadge meta={VOICE_WORK_STATUS[v.status]} /></TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCredits(v.payment)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">查看</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
