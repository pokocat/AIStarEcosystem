"use client";

import * as React from "react";
import { Mic2, TicketCheck, CalendarClock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { CONCERTS } from "@/mocks/music";
import { CONCERT_STATUS } from "@/constants/status";
import { formatCurrencyCN, formatDateCN } from "@/lib/utils";

export default function ConcertsPage() {
  const totalSeats = CONCERTS.reduce((a, b) => a + b.capacity, 0);
  const totalSold = CONCERTS.reduce((a, b) => a + b.soldTickets, 0);
  const selling = CONCERTS.filter((c) => c.status === "selling");
  const totalRevenue = CONCERTS.reduce((a, b) => a + b.revenue, 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="演出管理"
        description="演唱会 / 见面会的排期、售票与结算审核"
        breadcrumb={[{ label: "内容审核" }, { label: "演出管理" }]}
        actions={<Button size="sm">新建演出</Button>}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="总演出" value={CONCERTS.length} icon={Mic2} />
        <StatCard label="售票中" value={selling.length} icon={TicketCheck} tone="warning" />
        <StatCard label="座位售出率" value={`${Math.round((totalSold / totalSeats) * 100)}%`} icon={CheckCircle2} tone="success" />
        <StatCard label="累计票房" value={formatCurrencyCN(totalRevenue)} icon={CalendarClock} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>演出列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>演出</TableHead>
                <TableHead>场馆</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>票价</TableHead>
                <TableHead>出票</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">票房</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONCERTS.map((c) => {
                const rate = c.capacity > 0 ? Math.round((c.soldTickets / c.capacity) * 100) : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">ID {c.id}</div>
                    </TableCell>
                    <TableCell className="text-sm">{c.venue}</TableCell>
                    <TableCell className="text-sm">{formatDateCN(c.date)}</TableCell>
                    <TableCell className="tabular-nums text-sm">¥{c.ticketPrice}</TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="flex items-center gap-2 text-xs mb-1 tabular-nums">
                        <span className="font-medium">{c.soldTickets.toLocaleString("zh-CN")}</span>
                        <span className="text-muted-foreground">/ {c.capacity.toLocaleString("zh-CN")}</span>
                        <span className="ml-auto text-muted-foreground">{rate}%</span>
                      </div>
                      <Progress value={rate} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge meta={CONCERT_STATUS[c.status]} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {formatCurrencyCN(c.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost">
                        明细
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
