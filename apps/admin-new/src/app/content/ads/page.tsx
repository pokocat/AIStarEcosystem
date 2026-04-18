"use client";

import * as React from "react";
import { Megaphone, CheckCircle2, Handshake } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { ADS } from "@/mocks/film";
import { AD_STATUS } from "@/constants/status";
import type { Advertisement } from "@/types/film";
import { formatCompactNumber, formatCredits } from "@/lib/format";

export default function AdsPage() {
  const [target, setTarget] = React.useState<{ ad: Advertisement; action: "approve" | "reject" } | null>(null);

  const counts = {
    total: ADS.length,
    negotiating: ADS.filter((a) => a.status === "negotiating").length,
    completed: ADS.filter((a) => a.status === "completed").length,
    totalPayCredits: ADS.reduce((s, a) => s + a.payment, 0),
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="商业广告"
        description="品牌代言 / TVC / 数字广告 / 社媒广告合约审核。"
        breadcrumb={[{ label: "AI 作品" }, { label: "商业广告" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="合约总数"     value={counts.total}       icon={Megaphone} />
        <StatCard label="洽谈中"       value={counts.negotiating} icon={Handshake}    tone={counts.negotiating ? "warning" : "default"} />
        <StatCard label="已交付"       value={counts.completed}   icon={CheckCircle2} tone="success" />
        <StatCard label="报酬总额 · credits" value={formatCredits(counts.totalPayCredits)} icon={Megaphone} tone="success" />
      </section>

      <Card>
        <CardHeader><CardTitle>广告合约</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>品牌</TableHead>
                <TableHead>产品</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">曝光量</TableHead>
                <TableHead className="text-right">报酬 · credits</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADS.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.brand}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.product}</TableCell>
                  <TableCell className="text-sm uppercase">{a.type}</TableCell>
                  <TableCell className="tabular-nums text-sm">{a.duration}s</TableCell>
                  <TableCell><StatusBadge meta={AD_STATUS[a.status]} /></TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCompactNumber(a.views)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCredits(a.payment)}</TableCell>
                  <TableCell className="text-right">
                    {a.status === "negotiating" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="success" onClick={() => setTarget({ ad: a, action: "approve" })}>通过合约</Button>
                        <Button size="sm" variant="destructive" onClick={() => setTarget({ ad: a, action: "reject" })}>驳回</Button>
                      </div>
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
          title={target.action === "approve" ? `通过合约：${target.ad.brand}` : `驳回合约：${target.ad.brand}`}
          description={`${target.ad.product} · ${target.ad.type.toUpperCase()} · ${formatCredits(target.ad.payment)} credits`}
          tone={target.action === "approve" ? "success" : "danger"}
          confirmLabel={target.action === "approve" ? "通过" : "驳回"}
          requireReason
        />
      )}
    </div>
  );
}
