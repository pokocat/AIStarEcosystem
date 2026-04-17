"use client";

import * as React from "react";
import { Handshake, AlertTriangle, PenLine, FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { SignedArtists } from "@/mocks/coach";
import { SIGNED_ARTIST_STATUS } from "@/constants/status";
import type { SignedArtist } from "@/types/coach";
import { daysUntil, formatDateCN } from "@/lib/utils";

export default function ContractsPage() {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [mcn, setMcn] = React.useState("all");
  const [target, setTarget] = React.useState<{ artist: SignedArtist; action: "renew" | "revoke" | "adjust" } | null>(null);

  const mcns = Array.from(new Set(SignedArtists.map((a) => a.mcn)));

  const filtered = SignedArtists.filter((a) => {
    if (status !== "all" && a.status !== status) return false;
    if (mcn !== "all" && a.mcn !== mcn) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const counts = {
    active: SignedArtists.filter((a) => a.status === "active").length,
    negotiating: SignedArtists.filter((a) => a.status === "negotiating").length,
    expiring: SignedArtists.filter((a) => a.status === "expiring").length,
  };

  const within90 = SignedArtists.filter((a) => daysUntil(a.contractEnd) <= 90 && daysUntil(a.contractEnd) > 0).length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="合约管理"
        description="MCN / 经纪合约续约、调整分成与临期预警"
        breadcrumb={[{ label: "艺人与经纪" }, { label: "合约管理" }]}
        actions={<Button size="sm">新增合约</Button>}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="活跃合约" value={counts.active} icon={FileCheck2} tone="success" />
        <StatCard label="谈判中" value={counts.negotiating} icon={PenLine} tone="warning" />
        <StatCard label="临期" value={counts.expiring} icon={AlertTriangle} tone="danger" />
        <StatCard label="90 天内到期" value={within90} icon={Handshake} hint="需优先复核" tone="warning" />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">合约清单</CardTitle>
          <Input placeholder="搜索艺人" className="w-48" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(SIGNED_ARTIST_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mcn} onValueChange={setMcn}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部 MCN</SelectItem>
              {mcns.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>艺人</TableHead>
                <TableHead>MCN</TableHead>
                <TableHead>到期日</TableHead>
                <TableHead>剩余</TableHead>
                <TableHead>分成</TableHead>
                <TableHead>月收益</TableHead>
                <TableHead>作品数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const days = daysUntil(a.contractEnd);
                const danger = days <= 30;
                const warn = !danger && days <= 90;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{a.typeIcon}</span>
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.type}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{a.mcn}</TableCell>
                    <TableCell className="text-sm">{formatDateCN(a.contractEnd)}</TableCell>
                    <TableCell className={"tabular-nums text-sm " + (danger ? "text-rose-600 font-medium" : warn ? "text-amber-600" : "text-muted-foreground")}>
                      {days < 0 ? `已过 ${-days}天` : `${days} 天`}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{a.royaltyRate}%</TableCell>
                    <TableCell className="tabular-nums text-sm">{a.monthlyRevenue}</TableCell>
                    <TableCell className="tabular-nums text-sm">{a.contentCount}</TableCell>
                    <TableCell><StatusBadge meta={SIGNED_ARTIST_STATUS[a.status]} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setTarget({ artist: a, action: "renew" })}>续约</Button>
                        <Button size="sm" variant="ghost" onClick={() => setTarget({ artist: a, action: "adjust" })}>调整分成</Button>
                        {a.status !== "expiring" && (
                          <Button size="sm" variant="destructive" onClick={() => setTarget({ artist: a, action: "revoke" })}>解约</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={
            target.action === "renew"
              ? `续约：${target.artist.name}`
              : target.action === "adjust"
              ? `调整分成：${target.artist.name}`
              : `解约：${target.artist.name}`
          }
          description={`${target.artist.mcn} · 当前分成 ${target.artist.royaltyRate}% · 到期 ${target.artist.contractEnd}`}
          tone={target.action === "revoke" ? "danger" : "primary"}
          confirmLabel={target.action === "renew" ? "续约" : target.action === "adjust" ? "保存" : "解约"}
          requireReason
        />
      )}
    </div>
  );
}
