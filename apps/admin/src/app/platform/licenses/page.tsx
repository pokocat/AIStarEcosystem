"use client";

import * as React from "react";
import { KeySquare, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { LICENSE_BATCHES, LICENSE_KEYS } from "@/mocks/licenses";
import { TENANTS, ACCOUNTS } from "@/mocks/accounts";
import { LICENSE_BATCH_STATUS, LICENSE_KEY_STATUS } from "@/constants/status";
import type { LicenseBatch } from "@/types/license";
import { formatDateCN } from "@/lib/utils";
import { formatCredits, formatPercent } from "@/lib/format";

export default function LicensesPage() {
  const [target, setTarget] = React.useState<{ batch: LicenseBatch; action: "revoke" } | null>(null);

  const tenantById = React.useMemo(() => new Map(TENANTS.map((t) => [t.id, t])), []);
  const userById = React.useMemo(() => new Map(ACCOUNTS.map((u) => [u.id, u])), []);
  const batchById = React.useMemo(() => new Map(LICENSE_BATCHES.map((b) => [b.id, b])), []);

  const active = LICENSE_BATCHES.filter((b) => b.status === "active");
  const activatedKeys = LICENSE_KEYS.filter((k) => k.status === "activated").length;
  const pendingKeys = LICENSE_KEYS.filter((k) => k.status === "created").length;
  const totalGranted = LICENSE_BATCHES.reduce((s, b) => s + b.initialCreditGrant * b.activatedCount, 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="License 批次"
        description="批次 = 入场券 + 初始点数包。核销时一次性发放 credits，不设订阅。"
        breadcrumb={[{ label: "平台账户" }, { label: "License 批次" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 新建批次
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="发放中批次"        value={active.length}                 icon={KeySquare} tone="success" />
        <StatCard label="已兑换 License"    value={activatedKeys}                 icon={CheckCircle2} tone="success" />
        <StatCard label="未兑换单码"        value={pendingKeys}                   icon={AlertCircle}  tone={pendingKeys ? "warning" : "default"} />
        <StatCard label="累计发放点数"      value={formatCredits(totalGranted)}   icon={KeySquare}    tone="default" />
      </section>

      <Tabs defaultValue="batches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batches">批次 ({LICENSE_BATCHES.length})</TabsTrigger>
          <TabsTrigger value="keys">单码 ({LICENSE_KEYS.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <Card>
            <CardHeader><CardTitle>批次列表</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>批次号 / 名称</TableHead>
                    <TableHead>发放方</TableHead>
                    <TableHead className="text-right">单包点数</TableHead>
                    <TableHead className="text-right">核销 / 总量</TableHead>
                    <TableHead className="text-right">核销率</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LICENSE_BATCHES.map((b) => {
                    const issuer = tenantById.get(b.issuerTenantId);
                    const rate = b.totalCount > 0 ? (b.activatedCount / b.totalCount) * 100 : 0;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{b.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{b.batchNo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{issuer?.name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCredits(b.initialCreditGrant)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.activatedCount} / {b.totalCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatPercent(rate, 1)}</TableCell>
                        <TableCell className="text-xs">
                          {formatDateCN(b.validFrom)} ~ {formatDateCN(b.validTo)}
                        </TableCell>
                        <TableCell><StatusBadge meta={LICENSE_BATCH_STATUS[b.status]} /></TableCell>
                        <TableCell className="text-right">
                          {b.status === "active" ? (
                            <Button size="sm" variant="destructive" onClick={() => setTarget({ batch: b, action: "revoke" })}>
                              撤回
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost">查看</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys">
          <Card>
            <CardHeader><CardTitle>单码列表</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License Key</TableHead>
                    <TableHead>所属批次</TableHead>
                    <TableHead>兑换人</TableHead>
                    <TableHead>兑换时间</TableHead>
                    <TableHead>过期时间</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LICENSE_KEYS.map((k) => {
                    const b = batchById.get(k.batchId);
                    const user = k.activatedByUserId ? userById.get(k.activatedByUserId) : undefined;
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-mono text-xs">{k.maskedCode}</TableCell>
                        <TableCell className="text-sm">{b?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{user?.displayName ?? "—"}</TableCell>
                        <TableCell className="text-xs">{k.activatedAt ? formatDateCN(k.activatedAt) : "—"}</TableCell>
                        <TableCell className="text-xs">{k.expiresAt ? formatDateCN(k.expiresAt) : "—"}</TableCell>
                        <TableCell><StatusBadge meta={LICENSE_KEY_STATUS[k.status]} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={`撤回批次：${target.batch.name}`}
          description={`批次号 ${target.batch.batchNo}，已核销 ${target.batch.activatedCount} 个单码。撤回后未兑换单码失效。`}
          tone="danger"
          confirmLabel="撤回批次"
          requireReason
        />
      )}
    </div>
  );
}
