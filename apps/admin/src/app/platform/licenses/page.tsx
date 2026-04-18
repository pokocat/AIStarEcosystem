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
import { listBatches, listKeys } from "@/api/licenses";
import { listTenants } from "@/api/tenants";
import { listUsers } from "@/api/users";
import { LICENSE_BATCH_STATUS, LICENSE_KEY_STATUS, LICENSE_TIER } from "@/constants/status";
import { LICENSE_TIERS, type LicenseBatch, type LicenseKey } from "@/types/license";
import type { Tenant } from "@/types/account";
import type { AepUser } from "@/types/account";
import { formatDateCN } from "@/lib/utils";
import { formatCredits, formatPercent } from "@/lib/format";

export default function LicensesPage() {
  const [batches, setBatches] = React.useState<LicenseBatch[]>([]);
  const [keys, setKeys] = React.useState<LicenseKey[]>([]);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [users, setUsers] = React.useState<AepUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<{ batch: LicenseBatch; action: "revoke" } | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [b, k, t, u] = await Promise.all([
        listBatches(0, 200),
        listKeys(undefined, 0, 500),
        listTenants(0, 200),
        listUsers(0, 500),
      ]);
      setBatches(b);
      setKeys(k);
      setTenants(t);
      setUsers(u);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const tenantById = React.useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const batchById = React.useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);

  const active = batches.filter((b) => b.status === "active");
  const activatedKeys = keys.filter((k) => k.status === "activated").length;
  const pendingKeys = keys.filter((k) => k.status === "created").length;
  const totalGranted = batches.reduce((s, b) => s + b.initialCreditGrant * b.activatedCount, 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="秘钥批次"
        description="批次 = 入场券 + 初始点数包。核销时一次性发放积分，不设订阅。"
        breadcrumb={[{ label: "平台账户" }, { label: "秘钥批次" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 新建批次
          </Button>
        }
      />

      {/* 等级说明 */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Object.values(LICENSE_TIERS).map((t) => (
          <Card key={t.key}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <StatusBadge meta={LICENSE_TIER[t.key]} />
                <span>{t.label}</span>
              </CardTitle>
              <span className="text-lg font-semibold tabular-nums">
                {formatCredits(t.initialCreditGrant)}
              </span>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div>激活账户：<span className="text-foreground font-medium">{t.accountLabel}</span></div>
              <div>{t.description}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="发放中批次"    value={active.length}                 icon={KeySquare}   tone="success" />
        <StatCard label="已兑换秘钥"    value={activatedKeys}                 icon={CheckCircle2} tone="success" />
        <StatCard label="未兑换秘钥"    value={pendingKeys}                   icon={AlertCircle}  tone={pendingKeys ? "warning" : "default"} />
        <StatCard label="累计发放点数"  value={formatCredits(totalGranted)}   icon={KeySquare}    tone="default" />
      </section>

      <Tabs defaultValue="batches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batches">批次 ({batches.length})</TabsTrigger>
          <TabsTrigger value="keys">秘钥 ({keys.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <Card>
            <CardHeader><CardTitle>批次列表</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>批次号 / 名称</TableHead>
                    <TableHead>等级</TableHead>
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
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                    </TableRow>
                  )}
                  {!loading && loadError && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell>
                    </TableRow>
                  )}
                  {!loading && !loadError && batches.map((b) => {
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
                        <TableCell><StatusBadge meta={LICENSE_TIER[b.tier]} /></TableCell>
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
                  {!loading && !loadError && batches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">暂无批次</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys">
          <Card>
            <CardHeader><CardTitle>秘钥列表</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>秘钥编码</TableHead>
                    <TableHead>等级</TableHead>
                    <TableHead>所属批次</TableHead>
                    <TableHead>兑换人</TableHead>
                    <TableHead>兑换时间</TableHead>
                    <TableHead>过期时间</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                    </TableRow>
                  )}
                  {!loading && !loadError && keys.map((k) => {
                    const b = batchById.get(k.batchId);
                    const user = k.activatedByUserId ? userById.get(k.activatedByUserId) : undefined;
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-mono text-xs">{k.maskedCode}</TableCell>
                        <TableCell>{b ? <StatusBadge meta={LICENSE_TIER[b.tier]} /> : "—"}</TableCell>
                        <TableCell className="text-sm">{b?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{user?.displayName ?? "—"}</TableCell>
                        <TableCell className="text-xs">{k.activatedAt ? formatDateCN(k.activatedAt) : "—"}</TableCell>
                        <TableCell className="text-xs">{k.expiresAt ? formatDateCN(k.expiresAt) : "—"}</TableCell>
                        <TableCell><StatusBadge meta={LICENSE_KEY_STATUS[k.status]} /></TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && !loadError && keys.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无秘钥</TableCell>
                    </TableRow>
                  )}
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
          description={`批次号 ${target.batch.batchNo}，已核销 ${target.batch.activatedCount} 个秘钥。撤回后未兑换秘钥失效。`}
          tone="danger"
          confirmLabel="撤回批次"
          requireReason
        />
      )}
    </div>
  );
}
