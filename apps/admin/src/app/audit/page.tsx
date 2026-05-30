"use client";

import * as React from "react";
import { History, FileSignature, Wallet, ShieldCheck, Radio, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listTransactions } from "@/api/finance";
import { listSignedArtists, listDistributionQueue, listPendingCopyright } from "@/api/coach";
import { listPlatforms } from "@/api/distribution";
import type { Transaction } from "@/types/finance";
import type { SignedArtist, DistributionQueueItem, CopyrightItem } from "@/types/coach";
import type { Platform } from "@/types/distribution";
import { formatDateCN } from "@/lib/utils";

type AuditDomain = "finance" | "contract" | "distribution" | "copyright" | "platform";

interface AuditEntry {
  id: string;
  time: string;
  operator: string;
  domain: AuditDomain;
  action: string;
  ref: string;
  result: "success" | "pending" | "rejected";
  detail: string;
}

const DOMAIN_META: Record<AuditDomain, { label: string; icon: LucideIcon; tone: "success" | "warning" | "info" | "primary" | "neutral" }> = {
  finance: { label: "结算", icon: Wallet, tone: "success" },
  contract: { label: "合约", icon: FileSignature, tone: "primary" },
  distribution: { label: "分发", icon: Radio, tone: "info" },
  copyright: { label: "版权", icon: ShieldCheck, tone: "warning" },
  platform: { label: "渠道", icon: Radio, tone: "neutral" },
};

const RESULT_TONE: Record<AuditEntry["result"], "success" | "warning" | "danger"> = {
  success: "success",
  pending: "warning",
  rejected: "danger",
};

const RESULT_LABEL: Record<AuditEntry["result"], string> = {
  success: "已完成",
  pending: "进行中",
  rejected: "已驳回",
};

function buildEntries(
  transactions: Transaction[],
  signedArtists: SignedArtist[],
  distributionQueue: DistributionQueueItem[],
  copyrightItems: CopyrightItem[],
  platforms: Platform[],
): AuditEntry[] {
  const entries: AuditEntry[] = [];

  transactions.forEach((t) => {
    entries.push({
      id: `txn-${t.id}`,
      time: t.date,
      operator: t.status === "completed" ? "finance@star" : "ops@star",
      domain: "finance",
      action: t.type === "withdrawal" ? "提现复核" : "入账登记",
      ref: `#${t.id.toUpperCase()}`,
      result: t.status === "completed" ? "success" : "pending",
      detail: `${t.source} · ${t.amount}`,
    });
  });

  signedArtists.forEach((s) => {
    if (s.status === "negotiating") {
      entries.push({
        id: `con-${s.id}`,
        time: s.contractEnd,
        operator: "coach@star",
        domain: "contract",
        action: "合约续约谈判",
        ref: s.name,
        result: "pending",
        detail: `${s.mcn} · 到期 ${s.contractEnd}`,
      });
    }
  });

  distributionQueue.forEach((d) => {
    entries.push({
      id: `dist-${d.id}`,
      time: d.date,
      operator: "dist@star",
      domain: "distribution",
      action: d.status === "reviewing" ? "分发审核" : "分发已放行",
      ref: d.title,
      result: d.status === "reviewing" ? "pending" : "success",
      detail: `${d.artist} · 目标 ${d.platforms} 渠道`,
    });
  });

  copyrightItems.forEach((c) => {
    entries.push({
      id: `cp-${c.id}`,
      time: c.submitted,
      operator: "legal@star",
      domain: "copyright",
      action: c.status === "pending" ? "版权核验" : "版权已核验",
      ref: c.title,
      result: c.status === "pending" ? "pending" : "success",
      detail: `${c.artist} · ${c.type}`,
    });
  });

  platforms.forEach((p) => {
    if (p.status === "pending" || p.status === "disconnected") {
      entries.push({
        id: `plat-${p.id}`,
        time: p.lastSync,
        operator: "dist@star",
        domain: "platform",
        action: p.status === "pending" ? "渠道接入审核" : "渠道断开处置",
        ref: p.name,
        result: p.status === "pending" ? "pending" : "rejected",
        detail: `${p.category} · 上次同步 ${p.lastSync}`,
      });
    }
  });

  return entries.sort((a, b) => b.time.localeCompare(a.time));
}

export default function AuditPage() {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [signedArtists, setSignedArtists] = React.useState<SignedArtist[]>([]);
  const [distributionQueue, setDistributionQueue] = React.useState<DistributionQueueItem[]>([]);
  const [copyrightItems, setCopyrightItems] = React.useState<CopyrightItem[]>([]);
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [domain, setDomain] = React.useState<AuditDomain | "all">("all");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [tx, sa, dq, cp, pl] = await Promise.all([
          listTransactions(0, 200),
          listSignedArtists(),
          listDistributionQueue(),
          listPendingCopyright(),
          listPlatforms(),
        ]);
        if (!active) return;
        setTransactions(tx);
        setSignedArtists(sa);
        setDistributionQueue(dq);
        setCopyrightItems(cp);
        setPlatforms(pl);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const entries = React.useMemo(
    () => buildEntries(transactions, signedArtists, distributionQueue, copyrightItems, platforms),
    [transactions, signedArtists, distributionQueue, copyrightItems, platforms],
  );
  const filtered = entries.filter((e) => {
    if (domain !== "all" && e.domain !== domain) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = (e.ref + " " + e.detail + " " + e.operator + " " + e.action).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const pending = entries.filter((e) => e.result === "pending").length;
  const completed = entries.filter((e) => e.result === "success").length;

  return (
    <div className="admin-page">
      <PageHeader
        title="审计日志"
        description="所有人工介入动作的归档与追溯：结算 / 合约 / 分发 / 版权 / 渠道"
        breadcrumb={[{ label: "消息与日志" }, { label: "审计日志" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="记录总数" value={entries.length} icon={History} />
        <StatCard label="已完成" value={completed} icon={History} tone="success" />
        <StatCard label="进行中" value={pending} icon={History} tone="warning" />
        <StatCard label="涉及操作员" value={new Set(entries.map((e) => e.operator)).size} icon={History} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>操作流水</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索单号 / 对象 / 操作员"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={domain} onValueChange={(v) => setDomain(v as AuditDomain | "all")}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="finance">结算</TabsTrigger>
              <TabsTrigger value="contract">合约</TabsTrigger>
              <TabsTrigger value="distribution">分发</TabsTrigger>
              <TabsTrigger value="copyright">版权</TabsTrigger>
              <TabsTrigger value="platform">渠道</TabsTrigger>
            </TabsList>

            <TabsContent value={domain}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>域</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>对象</TableHead>
                    <TableHead>操作员</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
                  )}
                  {!loading && loadError && (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
                  )}
                  {!loading && !loadError && filtered.map((e) => {
                    const meta = DOMAIN_META[e.domain];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm tabular-nums">{formatDateCN(e.time)}</TableCell>
                        <TableCell>
                          <Badge tone={meta.tone}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{e.action}</TableCell>
                        <TableCell className="text-sm">{e.ref}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.operator}</TableCell>
                        <TableCell>
                          <Badge tone={RESULT_TONE[e.result]}>{RESULT_LABEL[e.result]}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.detail}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && !loadError && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        无匹配记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
