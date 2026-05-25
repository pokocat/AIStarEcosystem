"use client";

import * as React from "react";
import { KeySquare, CheckCircle2, AlertCircle, Plus, Sparkles, Copy, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { createBatch, listBatches, listKeys, mintKeys, revokeKey } from "@/api/licenses";
import { listTenants } from "@/api/tenants";
import { listUsers } from "@/api/users";
import { LICENSE_BATCH_STATUS, LICENSE_KEY_STATUS, LICENSE_TIER } from "@/constants/status";
import { LICENSE_TIERS, type LicenseBatch, type LicenseKey, type LicenseTier } from "@/types/license";
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

  // dialog 状态
  const [createOpen, setCreateOpen] = React.useState(false);
  const [mintTarget, setMintTarget] = React.useState<LicenseBatch | null>(null);
  const [rawCodes, setRawCodes] = React.useState<{ batch: LicenseBatch; codes: string[] } | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<LicenseBatch | null>(null);

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
          <Button size="sm" onClick={() => setCreateOpen(true)}>
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
                          <div className="inline-flex items-center gap-1">
                            {b.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMintTarget(b)}
                                title="在该批次下追加铸造新激活码（明文一次性返回）"
                              >
                                <Sparkles className="h-3.5 w-3.5" /> 铸码
                              </Button>
                            )}
                            {b.status === "active" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRevokeTarget(b)}
                              >
                                撤回
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost">查看</Button>
                            )}
                          </div>
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

      <CreateBatchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenants={tenants}
        onCreated={(batch, codes) => {
          setCreateOpen(false);
          void reload();
          if (codes.length > 0) setRawCodes({ batch, codes });
        }}
      />

      <MintKeysDialog
        batch={mintTarget}
        onOpenChange={(open) => !open && setMintTarget(null)}
        onMinted={(batch, codes) => {
          setMintTarget(null);
          void reload();
          setRawCodes({ batch, codes });
        }}
      />

      <RawCodesDialog
        payload={rawCodes}
        onOpenChange={(open) => !open && setRawCodes(null)}
      />

      {revokeTarget && (
        <ActionDialog
          open={!!revokeTarget}
          onOpenChange={(open) => !open && setRevokeTarget(null)}
          title={`撤回批次：${revokeTarget.name}`}
          description={`批次号 ${revokeTarget.batchNo}，已核销 ${revokeTarget.activatedCount} 个秘钥。撤回后未兑换秘钥失效。`}
          tone="danger"
          confirmLabel="撤回批次"
          requireReason
          onConfirm={async () => {
            const remainingKeys = keys.filter(
              (k) => k.batchId === revokeTarget.id && k.status === "created",
            );
            for (const k of remainingKeys) {
              try {
                await revokeKey(k.id);
              } catch {
                // 单条失败继续后续
              }
            }
            await reload();
          }}
        />
      )}
    </div>
  );
}

// ── 新建批次 dialog ──────────────────────────────────────────────────────────
function CreateBatchDialog({
  open,
  onOpenChange,
  tenants,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenants: Tenant[];
  onCreated: (batch: LicenseBatch, codes: string[]) => void;
}) {
  const [name, setName] = React.useState("");
  const [tenantId, setTenantId] = React.useState<string>("");
  const [tier, setTier] = React.useState<LicenseTier>("basic");
  const [totalCount, setTotalCount] = React.useState("10");
  const [validFrom, setValidFrom] = React.useState("");
  const [validTo, setValidTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setTenantId(tenants[0]?.id ?? "");
    setTier("basic");
    setTotalCount("10");
    // 默认有效期：今天 ~ 一年后
    const today = new Date();
    const oneYearLater = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    setValidFrom(today.toISOString().slice(0, 10));
    setValidTo(oneYearLater.toISOString().slice(0, 10));
    setBusy(false);
    setError(null);
  }, [open, tenants]);

  const initialCreditGrant = LICENSE_TIERS[tier].initialCreditGrant;

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return setError("批次名不能为空");
    if (!tenantId) return setError("请选择发放方");
    const count = parseInt(totalCount, 10);
    if (!Number.isFinite(count) || count < 1) return setError("数量必须是正整数");
    if (count > 100) return setError("一次最多 100 把（避免一次性日志爆炸）");

    setBusy(true);
    setError(null);
    try {
      const batch = await createBatch({
        name: trimmedName,
        issuerTenantId: tenantId,
        initialCreditGrant,
        totalCount: count,
        validFrom: validFrom ? `${validFrom}T00:00:00Z` : undefined,
        validTo: validTo ? `${validTo}T23:59:59Z` : undefined,
      });
      // 创建 batch 时不返回明文码 —— 需用「铸码」单独获取。
      onCreated(batch, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建批次</DialogTitle>
          <DialogDescription>
            一个批次 = 一组秘钥 + 等级（点数包）。提交后可通过「铸码」按钮额外补铸激活码并取走明文。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">批次名</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：星梦娱乐 · 6 月种子艺人激活包"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">发放方（issuer tenant）</label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue placeholder="选择发证主体…" /></SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">秘钥等级</label>
              <Select value={tier} onValueChange={(v) => setTier(v as LicenseTier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(LICENSE_TIERS).map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}（{formatCredits(t.initialCreditGrant)} credits）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">数量</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={totalCount}
                onChange={(e) => setTotalCount(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">生效起点</label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">截止日期</label>
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            单包点数：<span className="font-medium text-foreground">{formatCredits(initialCreditGrant)}</span>
            （由等级派生 · 与 product_spec §2 对齐）
          </p>
        </div>

        {error && <div className="text-xs text-rose-600">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 创建中…</> : "创建批次"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 铸码 dialog ──────────────────────────────────────────────────────────────
function MintKeysDialog({
  batch,
  onOpenChange,
  onMinted,
}: {
  batch: LicenseBatch | null;
  onOpenChange: (o: boolean) => void;
  onMinted: (batch: LicenseBatch, codes: string[]) => void;
}) {
  const [count, setCount] = React.useState("5");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!batch) return;
    setCount("5");
    setBusy(false);
    setError(null);
  }, [batch]);

  const handleSubmit = async () => {
    if (!batch) return;
    const n = parseInt(count, 10);
    if (!Number.isFinite(n) || n < 1) return setError("数量必须是正整数");
    if (n > 100) return setError("一次最多 100 把");

    setBusy(true);
    setError(null);
    try {
      const res = await mintKeys(batch.id, n);
      onMinted(batch, res.rawCodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "铸码失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!batch} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> 铸造激活码
          </DialogTitle>
          <DialogDescription>
            在批次 <span className="font-medium">{batch?.name}</span> 下追加新激活码。
            明文仅本次响应返回；server 只存 sha256 哈希。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">铸造数量</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              单包点数 {formatCredits(batch?.initialCreditGrant ?? 0)} · 当前总量 {batch?.totalCount ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ 明文激活码只显示一次。提交后请立刻复制保管。
          </div>
        </div>

        {error && <div className="text-xs text-rose-600">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 铸造中…</> : "铸造"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 明文激活码展示 dialog（一次性） ──────────────────────────────────────────
function RawCodesDialog({
  payload,
  onOpenChange,
}: {
  payload: { batch: LicenseBatch; codes: string[] } | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const joined = payload ? payload.codes.join("\n") : "";

  const handleCopy = async () => {
    if (!joined) return;
    try {
      await navigator.clipboard.writeText(joined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 忽略剪贴板失败；用户可手动选中
    }
  };

  return (
    <Dialog open={!!payload} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeySquare className="h-4 w-4" /> 新铸激活码（共 {payload?.codes.length ?? 0} 把）
          </DialogTitle>
          <DialogDescription>
            批次 <span className="font-medium">{payload?.batch.name}</span> ·
            单包 {formatCredits(payload?.batch.initialCreditGrant ?? 0)} credits。
            ⚠️ 明文只显示这一次。关闭弹窗后无法再次获取。
          </DialogDescription>
        </DialogHeader>

        <textarea
          readOnly
          value={joined}
          rows={Math.min(payload?.codes.length ?? 1, 12)}
          className="w-full rounded-md border border-border bg-muted/30 p-3 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1.5" /> {copied ? "已复制" : "复制全部"}
          </Button>
          <Button onClick={() => onOpenChange(false)}>我已保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
